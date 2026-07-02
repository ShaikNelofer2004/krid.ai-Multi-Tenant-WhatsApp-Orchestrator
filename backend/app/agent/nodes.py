"""
LangGraph Agent Nodes
Implements the 4 pipeline nodes as defined in the assignment:

  1. acknowledge_node      → Read receipt + typing indicator + DB save
  2. context_retriever_node → Fetch tenant config + last 5 messages
  3. llm_reasoning_node    → Gemini decides: text / image / document
  4. dispatcher_node       → Send WhatsApp message + save outbound log

Each node is an async function that takes AgentState and returns
a partial state dict with only the fields it updates.
"""
import logging
from datetime import datetime
from typing import Any

import httpx
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool

from app.agent.state import AgentState
from app.config import settings
from app.database.connection import get_db
from app.database.models import SessionStatus, MessageDirection
from app.whatsapp import client as wa

logger = logging.getLogger(__name__)



def _extract_text(content: Any) -> str:
    """
    Safely extract plain text from a Gemini LLM response content field.

    Gemini can return content in two formats:
      1. Plain string  → "Hello, how can I help?"
      2. Multipart list → [{'type': 'text', 'text': '...', 'extras': {...}}]

    Calling str() on a list produces Python dict literals which get sent raw
    to WhatsApp — this function always returns a clean string.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        # Extract all text parts and join them
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return " ".join(p for p in parts if p).strip()
    return str(content)


# ─── LLM Setup with API Key Fallback ─────────────────────────────────────────

# Errors that indicate quota/rate-limit exhaustion — trigger key rotation
_QUOTA_ERRORS = (
    "429",
    "quota",
    "resourceexhausted",
    "rate limit",
    "exceeded",
    "401",
    "403",
    "api key",
)

def _is_quota_error(exc: Exception) -> bool:
    """Return True if the exception looks like a quota / auth failure."""
    msg = str(exc).lower()
    return any(kw in msg for kw in _QUOTA_ERRORS)


def _make_llm(api_key: str) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=api_key,
        temperature=0.7,
    )


async def invoke_with_key_fallback(messages: list, tools: list | None = None) -> Any:
    """
    Invoke Gemini with automatic API-key fallback.

    Tries each key in settings.all_gemini_keys in order.
    On quota / auth error moves to the next key.
    Raises the last exception if all keys are exhausted.
    """
    keys = settings.all_gemini_keys
    last_exc: Exception | None = None

    for idx, key in enumerate(keys):
        try:
            llm = _make_llm(key)
            bound = llm.bind_tools(tools) if tools else llm
            result = await bound.ainvoke(messages)
            if idx > 0:
                logger.info(f"[LLM] Used fallback key #{idx} successfully.")
            return result
        except Exception as exc:
            if _is_quota_error(exc):
                logger.warning(
                    f"[LLM] Key #{idx} quota/auth error — rotating to next key. "
                    f"Error: {exc}"
                )
                last_exc = exc
                continue
            raise  # Non-quota errors propagate immediately

    logger.error("[LLM] All Gemini API keys exhausted!")
    raise last_exc  # type: ignore[misc]


# ─── LLM Tools for Agentic Decision-Making ────────────────────────────────────

@tool
def reply_with_text(message: str) -> str:
    """
    Use this tool when the customer's question can be answered with a text response.
    Supports WhatsApp markdown: *bold*, _italics_.
    Args:
        message: The text response to send to the customer.
    """
    return message


@tool
def send_catalog_pdf(asset_key: str, caption: str) -> str:
    """
    Use this tool when the customer requests a document, catalog, invoice,
    service schedule, or any PDF asset from the brand's media library.
    Args:
        asset_key: The key to look up in the tenant's media_library (e.g. 'catalog', 'invoice').
        caption: A short description of the document being sent.
    """
    return f"SEND_DOC:{asset_key}:{caption}"


@tool
def send_image_asset(asset_key: str, caption: str) -> str:
    """
    Use this tool when the customer requests to see a product image,
    showroom photo, repair diagram, or any visual asset.
    Args:
        asset_key: The key to look up in the tenant's media_library (e.g. 'sofa', 'engine').
        caption: A short caption for the image.
    """
    return f"SEND_IMG:{asset_key}:{caption}"


TOOLS = [reply_with_text, send_catalog_pdf, send_image_asset]


# ─── Node 1: Acknowledge Node ─────────────────────────────────────────────────

async def acknowledge_node(state: AgentState) -> dict[str, Any]:
    """
    First node in the pipeline. Fires immediately upon receiving a message.
    1. [Meta only] Sends read receipt + typing indicator
    2. Creates or retrieves the chat session in MongoDB
    3. Saves the inbound message to the audit log

    Twilio does not support read receipts or typing indicators,
    so those calls are skipped for channel=="twilio".
    """
    db = get_db()
    customer_phone = state["customer_phone"]
    tenant_id = state["tenant_id"]
    message_id = state["whatsapp_message_id"]
    channel = state.get("channel", "meta")

    # Step 1: Send read receipt + typing indicator
    if channel == "meta":
        # Meta Cloud API supports native typing indicator dots
        try:
            await wa.mark_as_read(message_id)
            await wa.send_typing_on(customer_phone)
            logger.info(f"Read receipt + typing indicator sent to {customer_phone}")
        except Exception as e:
            logger.warning(f"WhatsApp API call failed (non-fatal): {e}")

    elif channel == "twilio":
        # Twilio WhatsApp has no native typing indicator API.
        # Placeholder-message workaround is not viable — WhatsApp Business
        # cannot unsend messages, so the placeholder stays permanently.
        # The customer experiences a brief pause (~2-8s) then the real reply arrives.
        logger.info(f"[Twilio] No typing indicator available for {customer_phone} (platform limitation)")
        typing_sid = None


    # Step 2: Upsert chat session — get existing or create new
    sessions_col = db["chat_sessions"]
    session = await sessions_col.find_one(
        {"customer_phone": customer_phone, "tenant_id": tenant_id}
    )

    if session:
        session_id = str(session["_id"])
        # Update status to AGENT_RESPONDING
        await sessions_col.update_one(
            {"_id": session["_id"]},
            {
                "$set": {
                    "status": SessionStatus.AGENT_RESPONDING,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
    else:
        # Create new session
        new_session = {
            "customer_phone": customer_phone,
            "tenant_id": tenant_id,
            "status": SessionStatus.AGENT_RESPONDING,
            "context_variables": {},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await sessions_col.insert_one(new_session)
        session_id = str(result.inserted_id)

    # Step 3: Save inbound message to audit log
    media_url = state.get("media_url_direct")
    msg_type = state.get("message_type")
    mime = "image/jpeg" if msg_type == "image" else "application/pdf" if msg_type == "document" else None

    audit_col = db["message_audit_log"]
    await audit_col.insert_one({
        "session_id": session_id,
        "tenant_id": tenant_id,
        "direction": MessageDirection.INBOUND,
        "sender": customer_phone,
        "text_content": state.get("inbound_text"),
        "media_url": media_url,
        "media_mime_type": mime,
        "media_filename": "customer_upload" if media_url else None,
        "is_typing_indicator": False,
        "whatsapp_message_id": message_id,
        "timestamp": datetime.utcnow(),
    })

    logger.info(f"📨 Inbound message logged. Session: {session_id}")
    return {
        "session_id": session_id,
        "typing_message_sid": typing_sid if channel == "twilio" else None,
    }


# ─── Node 2: Context Retriever Node ───────────────────────────────────────────

async def context_retriever_node(state: AgentState) -> dict[str, Any]:
    """
    Fetches tenant configuration and conversation history from MongoDB.
    - Tenant config: system_prompt + media_library
    - Chat history: last 5 messages (for context window)
    """
    db = get_db()
    tenant_id = state["tenant_id"]
    session_id = state["session_id"]

    # Fetch tenant configuration
    tenant = await db["tenants"].find_one({"tenant_id": tenant_id})
    if not tenant:
        logger.error(f"Tenant not found: {tenant_id}")
        return {"error": f"Tenant {tenant_id} not found in database"}

    # Convert ObjectId to string for serialization
    tenant["_id"] = str(tenant["_id"])

    # Fetch last 20 messages for this session (increased from 5 for better memory)
    messages_cursor = (
        db["message_audit_log"]
        .find({"session_id": session_id, "is_typing_indicator": False})
        .sort("timestamp", -1)
        .limit(20)
    )
    raw_messages = await messages_cursor.to_list(length=20)
    raw_messages.reverse()  # Chronological order

    # Format into LangChain message format
    chat_history = []
    for msg in raw_messages:
        role = "human" if msg["direction"] == "INBOUND" else "assistant"
        content = msg.get("enriched_content") or msg.get("text_content") or ""
        if msg.get("media_url"):
            content += f"\n[Attached Media: {msg['media_url']}]"
        elif msg.get("media_id"):
            content += f"\n[Attached Media ID: {msg['media_id']}]"
        
        chat_history.append({"role": role, "content": content.strip()})

    logger.info(
        f"📚 Context loaded for tenant={tenant_id}: "
        f"{len(chat_history)} history messages"
    )

    # Inject product knowledge into system_prompt so the LLM can answer
    # specific price/product questions from the real catalog/rate-card text.
    product_knowledge = tenant.get("product_knowledge", "")
    if product_knowledge:
        tenant["system_prompt"] = (
            tenant.get("system_prompt", "") +
            f"\n\n--- PRODUCT KNOWLEDGE (from official catalog/rate card) ---\n"
            f"{product_knowledge}\n"
            f"--- END PRODUCT KNOWLEDGE ---"
        )

    return {
        "tenant_config": tenant,
        "chat_history": chat_history,
    }


# ─── Node 3: LLM Reasoning Node ───────────────────────────────────────────────

async def llm_reasoning_node(state: AgentState) -> dict[str, Any]:
    """
    Invokes Gemini Flash to determine the best response.
    Uses tool calling to decide between:
      - reply_with_text       → plain text reply
      - send_catalog_pdf      → document from media library
      - send_image_asset      → image from media library

    For image messages (Bonus): uses Gemini's multimodal capability
    to first describe the image before responding.
    """
    tenant_config = state.get("tenant_config", {})
    chat_history = state.get("chat_history", [])
    inbound_text = state.get("inbound_text", "")
    message_type = state.get("message_type", "text")

    # ── Bonus: Multimodal — WhatsApp image attachment (Meta, via media_id) ──────
    if message_type == "image" and state.get("media_id"):
        image_description = await _describe_image(state["media_id"])
        inbound_text = f"[Customer sent an image: {image_description}]\nCaption: {inbound_text}"

    # ── Bonus: Multimodal — WhatsApp image attachment (Twilio, direct URL) ──────
    elif message_type == "image" and state.get("media_url_direct"):
        # Twilio media URLs embed the Account SID in the path.
        # Match it against all configured Twilio accounts so we always
        # use the right credentials, even in multi-account setups.
        media_url_direct = state["media_url_direct"]
        twilio_auth = settings.twilio_auth_for_url(media_url_direct)
        image_description = await _describe_image_url(
            media_url_direct,
            auth=twilio_auth,
        )
        inbound_text = f"[Customer sent an image: {image_description}]\nCaption: {inbound_text}"

    # ── Bonus: Multimodal — image URL pasted in text ─────────────────────────
    # If customer pastes an image link, download + describe it with Gemini Vision
    elif message_type == "text" and inbound_text:
        url_description = await _describe_image_from_url_in_text(inbound_text)
        if url_description:
            inbound_text = f"{inbound_text}\n\n[Image analysis: {url_description}]"

    # If we enriched the text with vision descriptions, save it back to MongoDB 
    # so the AI remembers the image content in future conversation turns.
    # We save this to 'enriched_content' so we don't overwrite the customer's 
    # original 'text_content' which is displayed in the frontend UI.
    if inbound_text != state.get("inbound_text"):
        db = get_db()
        await db["message_audit_log"].update_one(
            {"whatsapp_message_id": state["whatsapp_message_id"]},
            {"$set": {"enriched_content": inbound_text}}
        )


    # ── Build conversation messages ────────────────────────────────────────────
    system_prompt = tenant_config.get("system_prompt", "You are a helpful assistant.")
    media_library = tenant_config.get("media_library", {})

    # Append media library context to system prompt so LLM knows what's available
    media_keys = ", ".join(f'"{k}"' for k in media_library.keys())
    system_prompt += (
        f"\n\nAvailable media assets in our library (use exact keys): {media_keys}. "
        "Use the send_catalog_pdf tool for PDF documents and send_image_asset for images. "
        "If unsure whether an asset exists, use reply_with_text."
    )

    # Build LangChain message list
    messages = [SystemMessage(content=system_prompt)]
    for msg in chat_history[:-1]:  # Exclude current message (already in inbound_text)
        if msg["role"] == "human":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=inbound_text))

    # ── Invoke LLM with tools (with automatic key fallback) ─────────────────────
    try:
        response = await invoke_with_key_fallback(messages, tools=TOOLS)
    except Exception as e:
        logger.error(f"LLM invocation failed: {e}")
        return {
            "llm_response": "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
            "response_type": "text",
            "media_asset_key": None,
            "media_url": None,
            "media_filename": None,
        }

    # ── Parse tool call result ─────────────────────────────────────────────────
    # ── Bonus: Sentiment / frustration detection ───────────────────────────────
    frustration_keywords = [
        "frustrated", "angry", "terrible", "worst", "useless",
        "awful", "horrible", "incompetent", "ridiculous", "furious",
        "unacceptable", "manager", "human"
    ]
    is_frustrated = any(kw in inbound_text.lower() for kw in frustration_keywords)
    if is_frustrated:
        logger.warning(f"⚠️ Frustration detected for {state['customer_phone']}")

    def _apply_frustration(ret_dict: dict) -> dict:
        if is_frustrated:
            ret_dict["error"] = "NEEDS_HUMAN"
        return ret_dict

    if response.tool_calls:
        tool_call = response.tool_calls[0]
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        if tool_name == "reply_with_text":
            return _apply_frustration({
                "llm_response": tool_args.get("message", ""),
                "response_type": "text",
                "media_asset_key": None,
                "media_url": None,
                "media_filename": None,
            })

        elif tool_name == "send_catalog_pdf":
            asset_key = tool_args.get("asset_key", "")
            caption = tool_args.get("caption", "")
            media_url = media_library.get(asset_key)

            if not media_url:
                # Asset not found — fallback to text
                return _apply_frustration({
                    "llm_response": f"I'm sorry, I couldn't find the {asset_key} in our library. {caption}",
                    "response_type": "text",
                    "media_asset_key": None,
                    "media_url": None,
                    "media_filename": None,
                })

            return _apply_frustration({
                "llm_response": caption,
                "response_type": "document",
                "media_asset_key": asset_key,
                "media_url": media_url,
                "media_filename": f"{asset_key}.pdf",
            })

        elif tool_name == "send_image_asset":
            asset_key = tool_args.get("asset_key", "")
            caption = tool_args.get("caption", "")
            media_url = media_library.get(asset_key)

            if not media_url:
                return _apply_frustration({
                    "llm_response": f"I'm sorry, I couldn't find an image for {asset_key}. {caption}",
                    "response_type": "text",
                    "media_asset_key": None,
                    "media_url": None,
                    "media_filename": None,
                })

            return _apply_frustration({
                "llm_response": caption,
                "response_type": "image",
                "media_asset_key": asset_key,
                "media_url": media_url,
                "media_filename": None,
            })

    # No tool call — LLM returned a direct text response
    text_content = _extract_text(response.content)

    return _apply_frustration({
        "llm_response": text_content,
        "response_type": "text",
        "media_asset_key": None,
        "media_url": None,
        "media_filename": None,
    })


async def _describe_image_url(image_url: str, auth: tuple | None = None) -> str:
    """
    Download an image from a direct public URL and describe it with Gemini Vision.

    Args:
        image_url: Public or authenticated image URL.
        auth:      Optional (username, password) tuple for Basic Auth.
                   Required for Twilio-hosted media URLs.
    """
    try:
        import base64
        async with httpx.AsyncClient(timeout=10) as http:
            # Use Basic Auth if credentials provided (needed for Twilio media URLs)
            # follow_redirects=True is required — Twilio returns 307 → CDN signed URL
            request_kwargs = {"auth": auth} if auth else {}
            resp = await http.get(image_url, follow_redirects=True, **request_kwargs)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/jpeg")
            if not content_type.startswith("image/"):
                return "an image (unsupported format)"
            image_b64 = base64.b64encode(resp.content).decode()

        vision_messages = [
            HumanMessage(content=[
                {"type": "text",
                 "text": "Describe this image in 1-2 sentences for a customer service context."},
                {"type": "image_url",
                 "image_url": {"url": f"data:{content_type};base64,{image_b64}"}},
            ])
        ]
        vision_response = await invoke_with_key_fallback(vision_messages)
        description = _extract_text(vision_response.content).strip()
        logger.info(f"[Vision] Image described: {description[:80]}")
        return description

    except Exception as e:
        logger.warning(f"[Vision] Image description failed ({image_url[:50]}): {e}")
        return "an image (could not be analyzed)"


async def _describe_image_from_url_in_text(text: str) -> str:
    """
    Detect image URLs in a customer's text message, download the first one,
    and use Gemini Vision to describe it.
    Returns a description string, or empty string if no image URL found.
    """
    import re
    pattern = re.compile(
        r'https?://[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp)'
        r'|https?://(?:images\.unsplash\.com|i\.imgur\.com|i\.ibb\.co|cdn\.[^\s]+)[^\s]*',
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return ""
    return await _describe_image_url(match.group(0))


async def _describe_image(media_id: str) -> str:
    """
    Bonus: Download image from Meta API and use Gemini Vision to describe it.
    """
    try:
        # Step 1: Get image URL from Meta
        async with httpx.AsyncClient() as http:
            url_resp = await http.get(
                f"https://graph.facebook.com/v20.0/{media_id}",
                headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            )
            url_resp.raise_for_status()
            image_url = url_resp.json().get("url", "")

            # Step 2: Download the image bytes
            img_resp = await http.get(
                image_url,
                headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            )
            img_resp.raise_for_status()
            import base64
            image_b64 = base64.b64encode(img_resp.content).decode()

        # Step 3: Send to Gemini Vision with key fallback
        vision_messages = [
            HumanMessage(content=[
                {"type": "text", "text": "Describe this image in 1-2 sentences for a customer service context."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
            ])
        ]
        vision_response = await invoke_with_key_fallback(vision_messages)
        return _extract_text(vision_response.content)

    except Exception as e:
        logger.warning(f"Image description failed: {e}")
        return "an image (could not be analyzed)"


# ─── Node 4: Dispatcher Node ──────────────────────────────────────────────────

async def dispatcher_node(state: AgentState) -> dict[str, Any]:
    """
    Final node. Sends the reply and updates the database.

    Channel routing (safe lazy import — deleting app/twilio/ won't break Meta):
      channel == "meta"   → uses app.whatsapp.client (unchanged)
      channel == "twilio" → lazy-imports app.twilio.sender at call time

    1. Routes to correct sender based on channel + response_type
    2. Saves the outbound message to the audit log
    3. Updates session status back to WAITING_FOR_BOT
       (or NEEDS_HUMAN if frustration was detected)
    """
    db = get_db()
    customer_phone = state["customer_phone"]
    tenant_id = state["tenant_id"]
    session_id = state["session_id"]
    response_type = state.get("response_type", "text")
    llm_response = state.get("llm_response", "")
    media_url = state.get("media_url")
    media_filename = state.get("media_filename")
    channel = state.get("channel", "meta")

    # ── Bonus: Frustration handover ────────────────────────────────────────────
    final_status = SessionStatus.WAITING_FOR_BOT
    if state.get("error") == "NEEDS_HUMAN":
        final_status = SessionStatus.NEEDS_HUMAN
        logger.warning(f"Session {session_id} flagged as NEEDS_HUMAN")

    # ── Send message via the correct channel ───────────────────────────────────
    sent_message_id = None

    if channel == "twilio":
        # ── Twilio path ───────────────────────────────────────────────────────
        try:
            from app.twilio.sender import send_twilio_message  # noqa: PLC0415
            tenant_config = state.get("tenant_config", {})
            sent_message_id = await send_twilio_message(
                to_phone=customer_phone,
                message_body=llm_response,
                tenant_config=tenant_config,
                media_url=media_url,
                response_type=response_type,
            )
            logger.info(f"[Twilio] Message dispatched ({response_type}) to {customer_phone}")
        except ImportError:
            logger.error("[Twilio] app/twilio/sender.py not found — Twilio module missing")
        except Exception as e:
            logger.error(f"[Twilio] Failed to send message: {e}")


    else:
        # ── Meta WhatsApp path (completely unchanged) ──────────────────────────
        try:
            if response_type == "text":
                result = await wa.send_text(customer_phone, llm_response)
                sent_message_id = result.get("messages", [{}])[0].get("id")

            elif response_type == "image" and media_url:
                result = await wa.send_image(customer_phone, media_url, caption=llm_response)
                sent_message_id = result.get("messages", [{}])[0].get("id")

            elif response_type == "document" and media_url:
                result = await wa.send_document(
                    customer_phone,
                    media_url,
                    filename=media_filename or "document.pdf",
                    caption=llm_response,
                )
                sent_message_id = result.get("messages", [{}])[0].get("id")

            logger.info(f"[Meta] Message dispatched ({response_type}) to {customer_phone}")

        except Exception as e:
            logger.error(f"[Meta] Failed to send WhatsApp message: {e}")
            try:
                await wa.send_text(
                    customer_phone,
                    "I'm sorry, something went wrong on our end. Please try again shortly.",
                )
            except Exception:
                pass

    # ── Save outbound message to audit log ────────────────────────────────────
    audit_col = db["message_audit_log"]
    await audit_col.insert_one({
        "session_id": session_id,
        "tenant_id": tenant_id,
        "direction": MessageDirection.OUTBOUND,
        "sender": "bot",
        "text_content": llm_response,
        "media_url": media_url,
        "media_mime_type": (
            "application/pdf" if response_type == "document"
            else "image/jpeg" if response_type == "image"
            else None
        ),
        "media_filename": media_filename,
        "is_typing_indicator": False,
        "whatsapp_message_id": sent_message_id,
        "timestamp": datetime.utcnow(),
    })

    # ── Update session status ──────────────────────────────────────────────────
    await db["chat_sessions"].update_one(
        {"_id": __import__("bson").ObjectId(session_id)},
        {"$set": {"status": final_status, "updated_at": datetime.utcnow()}},
    )

    logger.info(f"Session {session_id} updated to {final_status}")
    return {}

"""
Dashboard REST API
Provides endpoints for the React frontend monitoring dashboard:
  GET  /api/tenants                  → List all tenants
  GET  /api/sessions                 → Active sessions for a tenant
  GET  /api/messages                 → Message audit log for a session
  POST /api/broadcast                → Send template broadcast to a cohort
"""
import logging
from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.database.connection import get_db
from app.whatsapp import client as wa

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


def _serialize(doc: dict) -> dict:
    """
    Convert MongoDB document fields for JSON serialization:
    - ObjectId → string
    - datetime → ISO 8601 string with explicit UTC 'Z' suffix
      (without Z, JavaScript treats the timestamp as local time instead of UTC)
    """
    if doc is None:
        return doc
    doc["id"] = str(doc.pop("_id", ""))
    for key, val in doc.items():
        if isinstance(val, datetime):
            # Append Z so JS knows this is UTC → toLocaleTimeString() gives correct local time
            doc[key] = val.strftime("%Y-%m-%dT%H:%M:%S") + "Z"
    return doc


# ─── GET /api/tenants ─────────────────────────────────────────────────────────

@router.get("/tenants")
async def list_tenants():
    """Return all registered tenants for the tenant switcher dropdown."""
    db = get_db()
    tenants = await db["tenants"].find({}, {"system_prompt": 0}).to_list(length=100)
    return [_serialize(t) for t in tenants]


# ─── GET /api/sessions ────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(tenant_id: str = Query(..., description="Tenant ID to filter sessions")):
    """
    Return all active chat sessions for a given tenant.
    Used by the ChatMonitor component to show the list of active phone numbers.
    """
    db = get_db()
    sessions = (
        await db["chat_sessions"]
        .find({"tenant_id": tenant_id})
        .sort("updated_at", -1)
        .to_list(length=200)
    )
    return [_serialize(s) for s in sessions]


# ─── GET /api/messages ────────────────────────────────────────────────────────

@router.get("/messages")
async def get_messages(
    session_id: str = Query(..., description="Session ID to fetch messages for"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Return the message audit log for a specific chat session.
    Used by the ChatThread component to render the conversation.
    """
    db = get_db()
    messages = (
        await db["message_audit_log"]
        .find({"session_id": session_id})
        .sort("timestamp", 1)
        .to_list(length=limit)
    )
    return [_serialize(m) for m in messages]


# ─── GET /api/stats ───────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(tenant_id: str = Query(...)):
    """Return summary statistics for the dashboard header."""
    db = get_db()
    total_sessions = await db["chat_sessions"].count_documents({"tenant_id": tenant_id})
    active_sessions = await db["chat_sessions"].count_documents(
        {"tenant_id": tenant_id, "status": "AGENT_RESPONDING"}
    )
    needs_human = await db["chat_sessions"].count_documents(
        {"tenant_id": tenant_id, "status": "NEEDS_HUMAN"}
    )
    total_messages = await db["message_audit_log"].count_documents({"tenant_id": tenant_id})

    return {
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "needs_human": needs_human,
        "total_messages": total_messages,
    }


# ─── POST /api/broadcast ─────────────────────────────────────────────────────

class BroadcastRequest(BaseModel):
    tenant_id: str
    message: str
    phone_numbers: Optional[list[str]] = None
    media_url: Optional[str] = None       # Public image/PDF URL to attach
    media_type: Optional[str] = None      # "image" | "document" | None


async def _broadcast_send(phone: str, message: str, tenant_doc: dict,
                          media_url: Optional[str] = None,
                          media_type: Optional[str] = None) -> str:
    """
    Send a single broadcast message using the best available channel.
    Priority: Twilio (if configured) → Meta WhatsApp.
    Returns "ok" or raises an exception on failure.
    """
    account_sid = tenant_doc.get("twilio_account_sid", "")
    auth_token  = tenant_doc.get("twilio_auth_token", "")
    from_number = tenant_doc.get("twilio_whatsapp_number", "")

    has_twilio = (
        account_sid and auth_token and from_number
        and not account_sid.startswith("REPLACE_")
    )

    if has_twilio:
        from app.twilio.sender import send_twilio_message  # noqa: PLC0415
        sid = await send_twilio_message(
            to_phone=phone,
            message_body=message,
            tenant_config=tenant_doc,
            media_url=media_url,
            response_type=media_type or "text",
        )
        if sid is None:
            raise RuntimeError("Twilio returned no SID")
        return "ok"
    else:
        if media_url and media_type == "image":
            await wa.send_image(phone, media_url, caption=message)
        else:
            await wa.send_text(phone, message)
        return "ok"


@router.post("/broadcast")
async def send_broadcast(body: BroadcastRequest):
    """
    Trigger a broadcast message to a cohort of phone numbers.
    Auto-routes via Twilio if tenant has Twilio credentials, else uses Meta.
    If phone_numbers is empty, sends to all sessions for the tenant.
    """
    db = get_db()

    # Fetch tenant doc to check channel credentials
    tenant_doc = await db["tenants"].find_one({"tenant_id": body.tenant_id})
    if not tenant_doc:
        raise HTTPException(status_code=404, detail=f"Tenant '{body.tenant_id}' not found")

    # Resolve target phone numbers
    if body.phone_numbers:
        targets = body.phone_numbers
    else:
        sessions = await db["chat_sessions"].find(
            {"tenant_id": body.tenant_id},
            {"customer_phone": 1}
        ).to_list(length=500)
        targets = [s["customer_phone"] for s in sessions]

    if not targets:
        raise HTTPException(status_code=400, detail="No target phone numbers found")

    sent_count   = 0
    failed_count = 0

    for phone in targets:
        try:
            await _broadcast_send(phone, body.message, tenant_doc,
                                   media_url=body.media_url,
                                   media_type=body.media_type)
            sent_count += 1

            # Log broadcast message to audit trail
            await db["message_audit_log"].insert_one({
                "session_id":         "broadcast",
                "tenant_id":          body.tenant_id,
                "direction":          "OUTBOUND",
                "sender":             "bot",
                "text_content":       body.message,
                "media_url":          None,
                "media_mime_type":    None,
                "media_filename":     None,
                "is_typing_indicator": False,
                "whatsapp_message_id": None,
                "timestamp":          datetime.utcnow(),
            })

        except Exception as e:
            logger.error(f"Broadcast failed for {phone}: {e}")
            failed_count += 1

    return {
        "status":        "completed",
        "sent":          sent_count,
        "failed":        failed_count,
        "total_targets": len(targets),
    }

class GenerateBroadcastRequest(BaseModel):
    tenant_id: str
    keywords: str

@router.post("/generate-broadcast")
async def generate_broadcast(body: GenerateBroadcastRequest):
    """
    Generate a broadcast message using Groq if configured, else fallback to Gemini.
    """
    import httpx
    from app.config import settings
    from langchain_google_genai import ChatGoogleGenerativeAI
    
    db = get_db()
    tenant_doc = await db["tenants"].find_one({"tenant_id": body.tenant_id})
    if not tenant_doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    system_prompt = f"You are a marketing expert for {tenant_doc.get('name')}. Write a short, engaging WhatsApp broadcast message (under 300 characters) using these keywords: {body.keywords}. Use emojis. Do not use hashtags."

    if settings.GROQ_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": [{"role": "user", "content": system_prompt}],
                        "temperature": 0.7
                    },
                    timeout=10.0
                )
                res.raise_for_status()
                data = res.json()
                msg = data["choices"][0]["message"]["content"]
                return {"message": msg.strip()}
        except Exception as e:
            logger.error(f"Groq generation failed: {e}")
            raise HTTPException(status_code=500, detail="AI generation failed")
    else:
        try:
            llm = ChatGoogleGenerativeAI(
                model=settings.GEMINI_MODEL,
                google_api_key=settings.GOOGLE_API_KEY,
                temperature=0.7
            )
            msg = llm.invoke(system_prompt).content
            return {"message": msg.strip()}
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            raise HTTPException(status_code=500, detail="AI generation failed")

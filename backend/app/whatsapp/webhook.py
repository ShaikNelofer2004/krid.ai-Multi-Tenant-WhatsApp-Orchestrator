"""
WhatsApp Webhook Router
Exposes two endpoints:
  GET  /api/webhooks/whatsapp  → Meta's one-time hub verification challenge
  POST /api/webhooks/whatsapp  → Receives inbound messages, returns 200 OK immediately,
                                  launches the LangGraph agent as a background task
"""
import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response

from app.agent.graph import run_agent
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── GET: Webhook Verification ────────────────────────────────────────────────

@router.get("/api/webhooks/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta calls this endpoint once when you register the webhook in the
    Meta Developer dashboard. It sends a challenge string that we must
    echo back verbatim to prove we own this server.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("✅ WhatsApp webhook verified successfully.")
        return Response(content=hub_challenge, media_type="text/plain")

    logger.warning("❌ Webhook verification failed — token mismatch.")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


# ─── POST: Inbound Message Handler ────────────────────────────────────────────

@router.post("/api/webhooks/whatsapp")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    CRITICAL (as per assignment): This endpoint MUST return 200 OK to Meta
    within 3 seconds to prevent duplicate delivery retries. The LangGraph
    agent runs entirely in a background task AFTER the response is sent.

    Bonus: Validates X-Hub-Signature-256 header if WHATSAPP_APP_SECRET is set.
    """
    raw_body = await request.body()

    # ── Bonus: Webhook Security — X-Hub-Signature-256 validation ─────────────
    if settings.WHATSAPP_APP_SECRET:
        sig_header = request.headers.get("X-Hub-Signature-256", "")
        expected_sig = (
            "sha256="
            + hmac.new(
                settings.WHATSAPP_APP_SECRET.encode(),
                raw_body,
                hashlib.sha256,
            ).hexdigest()
        )
        if not hmac.compare_digest(sig_header, expected_sig):
            logger.warning("❌ Invalid X-Hub-Signature-256 — request rejected.")
            raise HTTPException(status_code=403, detail="Invalid signature")

    # ── Parse payload ─────────────────────────────────────────────────────────
    try:
        payload: dict[str, Any] = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.debug(f"Webhook payload received: {payload}")

    # ── Extract message data ──────────────────────────────────────────────────
    try:
        entry = payload["entry"][0]
        changes = entry["changes"][0]
        value = changes["value"]

        # Skip status updates (delivery receipts, read receipts from customer)
        if "statuses" in value and "messages" not in value:
            return {"status": "ok"}

        message = value["messages"][0]
        metadata = value["metadata"]

        inbound_data = _extract_message_data(message, metadata, value)

        if inbound_data is None:
            # Non-text/image message we can't handle yet — acknowledge and ignore
            return {"status": "ok"}

    except (KeyError, IndexError) as e:
        logger.warning(f"Webhook parsing error (non-message event): {e}")
        # Return 200 so Meta doesn't retry — this is likely a status update
        return {"status": "ok"}

    # ── CRITICAL: Fire background task BEFORE responding ─────────────────────
    # The LangGraph agent runs asynchronously. Meta gets its 200 OK immediately.
    background_tasks.add_task(run_agent, inbound_data)

    return {"status": "ok"}


def _extract_message_data(
    message: dict, metadata: dict, value: dict
) -> dict | None:
    """
    Parse the raw Meta webhook message object into a clean dict
    for consumption by the LangGraph agent.
    Handles text messages and image messages (for Bonus multimodal parsing).
    """
    msg_type = message.get("type")
    customer_phone = message.get("from")
    message_id = message.get("id")

    # Determine tenant from the receiving phone number ID
    # In production you'd look this up in DB; for now we map from phone_number_id
    phone_number_id = metadata.get("phone_number_id", "")
    tenant_id = _resolve_tenant(phone_number_id, value)

    if msg_type == "text":
        return {
            "tenant_id": tenant_id,
            "customer_phone": customer_phone,
            "whatsapp_message_id": message_id,
            "message_type": "text",
            "text": message["text"]["body"],
            "media_id": None,
        }
    elif msg_type == "image":
        # Bonus: multimodal image handling
        return {
            "tenant_id": tenant_id,
            "customer_phone": customer_phone,
            "whatsapp_message_id": message_id,
            "message_type": "image",
            "text": message.get("image", {}).get("caption", "[Customer sent an image]"),
            "media_id": message.get("image", {}).get("id"),
        }
    else:
        logger.info(f"Unsupported message type received: {msg_type}")
        return None


def _resolve_tenant(phone_number_id: str, value: dict) -> str:
    """
    Determine which tenant this message belongs to.
    In a real multi-tenant deployment, you would look up the phone_number_id
    in your tenants collection. For the prototype we use a simple mapping
    that can be extended via environment variables.

    Currently defaults to tenant_a for demo purposes — update with real
    phone_number_id values after Meta sandbox setup.
    """
    # TODO: Replace with DB lookup after Meta sandbox is configured
    # e.g. {"123456789": "tenant_a", "987654321": "tenant_b"}
    tenant_map = {
        settings.WHATSAPP_PHONE_NUMBER_ID: "tenant_a",
    }
    return tenant_map.get(phone_number_id, "tenant_a")

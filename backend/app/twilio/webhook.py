"""
app/twilio/webhook.py
FastAPI router for the Twilio WhatsApp sandbox webhook.

Endpoint: POST /api/webhooks/twilio?tenant=tenant_a

Twilio sends form-encoded POST data (not JSON) with fields:
  From  — sender phone  e.g. "whatsapp:+919440639183"
  Body  — message text  e.g. "Hi, I need help"
  To    — sandbox number e.g. "whatsapp:+14155238886"
  MessageSid — Twilio's unique message ID

Tenant routing is done via the ?tenant= query parameter set in
the Twilio Console webhook URL per tenant account.

To remove Twilio entirely:
  1. Delete app/twilio/ folder
  2. Remove the include_router line in app/main.py
  Meta WhatsApp is completely unaffected.
"""
import logging

from fastapi import APIRouter, Form, Query, HTTPException, BackgroundTasks, Response
from fastapi import Request

from app.agent.graph import run_agent
from app.database.connection import get_db
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Twilio Webhook"])


@router.post("/webhooks/twilio")
async def twilio_webhook(
    background_tasks: BackgroundTasks,
    tenant: str = Query(..., description="Tenant ID — set this in the Twilio Console webhook URL"),
    # Twilio sends form fields (application/x-www-form-urlencoded)
    From: str = Form(...),          # e.g. "whatsapp:+919440639183"
    Body: str = Form(""),           # message text (empty for image-only messages)
    To: str = Form(...),            # sandbox number
    MessageSid: str = Form(""),     # Twilio message SID
    NumMedia: int = Form(0),        # number of media attachments (0 = text only)
    MediaUrl0: str = Form(""),      # direct URL to first media item
    MediaContentType0: str = Form(""),  # MIME type e.g. "image/jpeg"
):
    """
    Receive an inbound WhatsApp message from Twilio sandbox.

    Validates the tenant exists in MongoDB, then fires the LangGraph
    agent pipeline as a background task (returns 200 to Twilio immediately
    — Twilio requires a response within 15 seconds).
    """
    db = get_db()

    # Validate tenant exists
    tenant_doc = await db["tenants"].find_one({"tenant_id": tenant})
    if not tenant_doc:
        logger.error(f"[Twilio] Unknown tenant: {tenant}")
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant}' not found")

    # Strip "whatsapp:" prefix from phone numbers for normalised storage
    raw_from = From.replace("whatsapp:", "").strip()
    # Ensure E.164 format — keep leading + if present
    customer_phone = raw_from if raw_from.startswith("+") else f"+{raw_from}"
    message_text = Body.strip()

    logger.info(
        f"[Twilio] Inbound from {customer_phone} "
        f"| tenant={tenant} | text='{message_text[:60]}' | media={NumMedia}"
    )

    # ── Detect message type ──────────────────────────────────────────────────────
    has_media = NumMedia > 0 and bool(MediaUrl0)
    is_image = has_media and MediaContentType0.startswith("image/")
    is_pdf = has_media and MediaContentType0 == "application/pdf"
    
    msg_type       = "image" if is_image else "document" if is_pdf else "text"
    media_url_val  = MediaUrl0.strip() if has_media else None

    # For the database text_content (frontend display), we just want exactly what 
    # the customer typed. No ugly "[Customer sent an image]" placeholders.
    inbound_text = message_text

    if not inbound_text and not is_image:
        # Silently accept status callbacks / empty pings
        return Response(content="", media_type="text/plain", status_code=200)

    # Build initial agent state
    initial_state = {
        "tenant_id":           tenant,
        "customer_phone":      customer_phone,
        "whatsapp_message_id": MessageSid or "twilio-no-sid",
        "inbound_text":        inbound_text,
        "message_type":        msg_type,
        "media_id":            None,            # Twilio provides direct URL, not media_id
        "media_url_direct":    media_url_val,   # Direct Twilio-hosted image URL
        "channel":             "twilio",
        # Fields filled by pipeline nodes:
        "session_id":          "",
        "tenant_config":       {},
        "chat_history":        [],
        "llm_response":        "",
        "response_type":       "text",
        "media_asset_key":     None,
        "media_url":           None,
        "media_filename":      None,
        "error":               None,
    }

    # Fire the agent in the background — return 200 to Twilio immediately
    background_tasks.add_task(run_agent, initial_state)

    # Twilio expects an empty 200 response (or TwiML — empty is fine for sandbox)
    return Response(content="", media_type="text/plain", status_code=200)

import httpx

@router.get("/media/proxy")
async def proxy_twilio_media(
    tenant: str = Query(...),
    url: str = Query(...)
):
    """
    Proxies authenticated Twilio media URLs to the frontend dashboard.
    The frontend cannot send HTTP Basic Auth in <img> tags.
    """
    db = get_db()
    tenant_doc = await db["tenants"].find_one({"tenant_id": tenant})
    if not tenant_doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    # Match credentials by Account SID embedded in the URL.
    # This handles multi-account Twilio setups correctly.
    auth = settings.twilio_auth_for_url(url)
    # Per-tenant override if stored in DB
    sid = tenant_doc.get("twilio_account_sid")
    token = tenant_doc.get("twilio_auth_token")
    if sid and token:
        auth = (sid, token)
    
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            # Step 1: Fetch Twilio URL with auth — Twilio returns a 307 redirect
            # to a signed CDN URL. We DON'T follow redirects here so we can
            # extract the CDN URL and fetch it separately without auth headers.
            resp = await client.get(url, auth=auth, follow_redirects=False)

            if resp.status_code in (301, 302, 307, 308):
                # Step 2: Follow redirect to CDN without auth (CDN uses signed URL)
                cdn_url = resp.headers.get("location")
                if cdn_url:
                    resp = await client.get(cdn_url, follow_redirects=True)
                else:
                    raise Exception("Redirect with no Location header")
            
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "application/octet-stream")
            return Response(content=resp.content, media_type=content_type)
        except Exception as e:
            logger.error(f"[Twilio Proxy] Failed to proxy {url}: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch media")

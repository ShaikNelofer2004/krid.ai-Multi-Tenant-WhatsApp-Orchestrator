"""
WhatsApp Cloud API Client
Wraps all Meta Graph API v20.0 calls:
  - mark_as_read      → sends a read receipt for an inbound message
  - send_typing_on    → activates the native WhatsApp typing indicator
  - send_text         → sends a plain/markdown text message
  - send_image        → sends an image by public URL
  - send_document     → sends a PDF/document by public URL
"""
import httpx
from app.config import settings

# Base URL for Meta Graph API
GRAPH_BASE = f"https://graph.facebook.com/v20.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"


def _headers() -> dict:
    """Return authorization headers for every Meta API request."""
    return {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }


async def mark_as_read(message_id: str) -> None:
    """
    Send a read receipt to Meta for the given inbound message_id.
    This causes the double blue ticks to appear on the customer's phone.
    """
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GRAPH_BASE, json=payload, headers=_headers())
        resp.raise_for_status()


async def send_typing_on(to: str) -> None:
    """
    Start the native WhatsApp typing indicator for the recipient.
    This keeps the user engaged while the LLM is generating a response.
    Payload structure exactly as specified in the assignment.
    """
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "typing_indicator",
        "typing_indicator": {
            "type": "text"
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GRAPH_BASE, json=payload, headers=_headers())
        resp.raise_for_status()


async def send_text(to: str, body: str) -> dict:
    """
    Send a plain text message. Supports WhatsApp markdown:
    *bold*, _italics_, ~strikethrough~, ```monospace```.
    Returns the Meta API response containing the message_id.
    """
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": body,
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GRAPH_BASE, json=payload, headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def send_image(to: str, url: str, caption: str = "") -> dict:
    """
    Send an image message using a publicly accessible URL.
    Meta downloads the image and delivers it to the customer.
    """
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "image",
        "image": {
            "link": url,
            "caption": caption,
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GRAPH_BASE, json=payload, headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def send_document(to: str, url: str, filename: str, caption: str = "") -> dict:
    """
    Send a document (PDF, etc.) using a publicly accessible URL.
    The filename is displayed to the customer in WhatsApp.
    """
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "document",
        "document": {
            "link": url,
            "caption": caption,
            "filename": filename,
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GRAPH_BASE, json=payload, headers=_headers())
        resp.raise_for_status()
        return resp.json()

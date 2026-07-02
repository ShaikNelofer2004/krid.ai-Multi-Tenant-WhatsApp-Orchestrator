"""
app/twilio/sender.py
Sends WhatsApp messages via Twilio REST API.

Supports: text, image (media_url), document/PDF (media_url)

Uses the tenant's own Twilio credentials (Account SID + Auth Token)
stored in MongoDB, so each tenant is fully isolated.

Deleting this file (along with the rest of app/twilio/) has zero
effect on the Meta WhatsApp channel.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def send_twilio_message(
    to_phone: str,
    message_body: str,
    tenant_config: dict,
    media_url: Optional[str] = None,
    response_type: str = "text",
) -> Optional[str]:
    """
    Send a WhatsApp message via Twilio.

    Supports:
      - text      → plain text reply
      - image     → media_url sent as WhatsApp image with caption
      - document  → media_url (PDF) sent as attachment with caption

    Args:
        to_phone:      Recipient phone e.g. "+919440639183"
        message_body:  Text body or caption for media messages
        tenant_config: Full tenant MongoDB doc with Twilio credentials
        media_url:     Public URL for image/PDF (None for text-only)
        response_type: "text" | "image" | "document"

    Returns:
        Twilio message SID string, or None on failure.
    """
    # Pull credentials from tenant config stored in MongoDB
    account_sid = tenant_config.get("twilio_account_sid", "")
    auth_token  = tenant_config.get("twilio_auth_token", "")
    from_number = tenant_config.get("twilio_whatsapp_number", "")

    if not account_sid or not auth_token or not from_number:
        logger.error(
            "[Twilio] Missing credentials in tenant config. "
            "Set twilio_account_sid, twilio_auth_token, twilio_whatsapp_number in MongoDB."
        )
        return None

    # Normalise recipient phone to Twilio's "whatsapp:+XXXXXXXXXX" format
    if not to_phone.startswith("whatsapp:"):
        to_number = f"whatsapp:{to_phone if to_phone.startswith('+') else '+' + to_phone}"
    else:
        to_number = to_phone

    try:
        from twilio.rest import Client  # noqa: PLC0415
        import asyncio

        loop = asyncio.get_event_loop()

        def _send():
            client = Client(account_sid, auth_token)

            # Build message kwargs
            kwargs = {
                "body": message_body,
                "from_": from_number,
                "to": to_number,
            }

            # Attach media for image responses
            # NOTE: PDFs are sent as a link in the message body because Twilio
            # WhatsApp sandbox does not reliably deliver PDF media_url attachments.
            # In a paid production account, you can use media_url for PDFs too.
            if media_url and response_type == "image":
                kwargs["media_url"] = [media_url]
                logger.info(f"[Twilio] Sending image with media_url: {media_url[:60]}...")

            elif media_url and response_type == "document":
                # Append the PDF link to the message body for sandbox compatibility
                kwargs["body"] = f"{message_body}\n\nDocument: {media_url}"
                logger.info(f"[Twilio] Sending document as link (sandbox): {media_url[:60]}...")

            message = client.messages.create(**kwargs)
            return message.sid

        sid = await loop.run_in_executor(None, _send)
        logger.info(f"[Twilio] Message sent to {to_number} | type={response_type} | SID: {sid}")
        return sid

    except ImportError:
        logger.error(
            "[Twilio] 'twilio' package not installed. Run: pip install twilio"
        )
        return None
    except Exception as e:
        logger.error(f"[Twilio] Failed to send message to {to_number}: {e}")
        return None

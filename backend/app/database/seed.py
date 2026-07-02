"""
Seed script: populates MongoDB with Tenant A and Tenant B data.
Run once before starting the server:
    python -m app.database.seed
"""
import asyncio
from datetime import datetime

import httpx

from app.database.connection import connect_db, close_db, get_db
from app.config import get_settings

settings = get_settings()


# ── Google Docs export URLs ────────────────────────────────────────────────────
TENANT_A_DOC_ID = "17M9N2jZmnCAcZWnElckaG_KDuLGHVZpeS5TTvhZKAWo"
TENANT_B_DOC_ID = "1HAY0-9-YEnhJApJEz1uMyzpQ6BAi7T3aqAUulamrMSY"

TENANT_A_PDF_URL = f"https://docs.google.com/document/d/{TENANT_A_DOC_ID}/export?format=pdf"
TENANT_B_PDF_URL = f"https://docs.google.com/document/d/{TENANT_B_DOC_ID}/export?format=pdf"
TENANT_A_TXT_URL = f"https://docs.google.com/document/d/{TENANT_A_DOC_ID}/export?format=txt"
TENANT_B_TXT_URL = f"https://docs.google.com/document/d/{TENANT_B_DOC_ID}/export?format=txt"


async def fetch_doc_text(url: str, label: str) -> str:
    """
    Download Google Doc as plain text for AI product knowledge.
    Stored in MongoDB so the AI can answer specific price/product questions.
    """
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            text = resp.text.strip()
            print(f"  Fetched {label} ({len(text)} chars)")
            return text
    except Exception as e:
        print(f"  WARNING: Could not fetch {label}: {e}")
        print(f"     Make sure the doc is shared as 'Anyone with the link can view'")
        return ""


TENANTS = [
    {
        "tenant_id": "tenant_a",
        "name": "The Grand Emporium",
        "system_prompt": (
            "You are an elegant sales assistant for The Grand Emporium, a premium luxury furniture brand. "
            "Your tone is sophisticated, warm, and helpful.\n\n"
            "PRODUCT KNOWLEDGE: You have our full product catalog in the product_knowledge field. "
            "Use it to answer specific questions about products, prices, and customisation. "
            "Quote exact prices from the catalog when customers ask.\n\n"
            "MEDIA TOOLS: When a customer asks for the full catalog or price list, use send_catalog_pdf "
            "with key 'catalog'. For product images use send_image_asset with key sofa/chair/dining/bedroom/showroom.\n\n"
            "Always respond in a refined, professional manner. Never mention competitor brands."
        ),
        "media_library": {
            "catalog":  TENANT_A_PDF_URL,
            "sofa":     "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
            "chair":    "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800",
            "dining":   "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800",
            "bedroom":  "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800",
            "showroom": "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800",
        },
        "twilio_account_sid":     settings.TWILIO_ACCOUNT_SID,
        "twilio_auth_token":      settings.TWILIO_AUTH_TOKEN,
        "twilio_whatsapp_number": settings.TWILIO_WHATSAPP_NUMBER,
        "created_at": datetime.utcnow(),
    },
    {
        "tenant_id": "tenant_b",
        "name": "Speedy Fix Auto",
        "system_prompt": (
            "You are a professional service advisor for Speedy Fix Auto, a premium automotive service center. "
            "Your tone is technical, trustworthy, and reassuring.\n\n"
            "PRODUCT KNOWLEDGE: You have our full service invoice and rate card in the product_knowledge field. "
            "Use it to quote exact service prices and repair estimates.\n\n"
            "IMPORTANT - When customer sends vehicle image:\n"
            "1. Describe exactly what damage you can see.\n"
            "2. Provide rough cost estimate in INR using rate card figures from product_knowledge.\n"
            "3. Mention final quote requires physical inspection.\n"
            "4. Offer to send invoice PDF.\n\n"
            "For non-image queries help with appointments, maintenance questions, and send PDFs when asked. "
            "Never refuse to give a rough estimate."
        ),
        "media_library": {
            "invoice":          TENANT_B_PDF_URL,
            "service_schedule": TENANT_B_PDF_URL,
            "repair_diagram":   "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800",
            "engine":           "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800",
            "oil_change":       "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
            "tire":             "https://images.unsplash.com/photo-1508974239320-0a029497e820?w=800",
        },
        "twilio_account_sid":     settings.TWILIO_ACCOUNT_SID_2 or settings.TWILIO_ACCOUNT_SID,
        "twilio_auth_token":      settings.TWILIO_AUTH_TOKEN_2 or settings.TWILIO_AUTH_TOKEN,
        "twilio_whatsapp_number": settings.TWILIO_WHATSAPP_NUMBER,
        "created_at": datetime.utcnow(),
    },
]


async def seed():
    """Insert or update tenants in MongoDB, fetching live doc content."""
    await connect_db()
    db = get_db()
    tenants_col = db["tenants"]

    print("\nUpserting tenant records (preserving existing data)...")
    # Note: history already cleared separately; only update tenant config here.

    print("\nFetching Google Doc content for AI knowledge...")
    TENANTS[0]["product_knowledge"] = await fetch_doc_text(TENANT_A_TXT_URL, "Luxe Haven catalog")
    TENANTS[1]["product_knowledge"] = await fetch_doc_text(TENANT_B_TXT_URL, "PrimeAuto rate card")

    print("\nUpserting tenant records...")
    for tenant in TENANTS:
        result = await tenants_col.update_one(
            {"tenant_id": tenant["tenant_id"]},
            {"$set": tenant},
            upsert=True,
        )
        action = "Inserted" if result.upserted_id else "Updated"
        ok = "with knowledge" if tenant.get("product_knowledge") else "NO knowledge - check doc sharing settings"
        print(f"  {action}: {tenant['name']} - {ok}")

    await db["tenants"].create_index("tenant_id", unique=True)
    await db["chat_sessions"].create_index([("customer_phone", 1), ("tenant_id", 1)])
    await db["chat_sessions"].create_index("tenant_id")
    await db["message_audit_log"].create_index("session_id")
    await db["message_audit_log"].create_index("tenant_id")
    await db["message_audit_log"].create_index("timestamp")
    print("Indexes created.")
    await close_db()
    print("\nSeeding complete!")
    print(f"Tenant A PDF: {TENANT_A_PDF_URL}")
    print(f"Tenant B PDF: {TENANT_B_PDF_URL}")


if __name__ == "__main__":
    asyncio.run(seed())

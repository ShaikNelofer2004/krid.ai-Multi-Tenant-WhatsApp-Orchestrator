"""
LangGraph Agent State Definition
The AgentState TypedDict is the single source of truth that flows
through all 4 nodes of the graph. Every node reads from and writes to
this shared state object.
"""
from typing import Any, Optional
from typing_extensions import TypedDict


class AgentState(TypedDict):
    """
    Shared state that flows through the LangGraph pipeline.

    Populated progressively as the graph executes:
    1. acknowledge_node     → fills inbound fields, sets session_id
    2. context_retriever    → fills tenant_config, chat_history
    3. llm_reasoning_node   → fills llm_response, response_type, media_asset_key
    4. dispatcher_node      → sends message (Meta or Twilio), updates status
    """

    # ── Inbound message fields (set by webhook before graph starts) ───────────────
    tenant_id: str                          # e.g. "tenant_a"
    customer_phone: str                     # Customer's phone number
    whatsapp_message_id: str                # Message ID (Meta) or SID placeholder (Twilio)
    inbound_text: str                       # The customer's message text
    message_type: str                       # "text" or "image"
    media_id: Optional[str]                 # Set if message_type == "image" via Meta (media_id for API fetch)
    media_url_direct: Optional[str]         # Set if message_type == "image" via Twilio (direct public URL)

    # ── Channel routing (set by webhook before graph starts) ─────────────────
    channel: str                            # "meta" | "twilio" — determines which sender to use

    # ── Session tracking (set by acknowledge_node) ────────────────────────────
    session_id: str                         # MongoDB _id of the ChatSession document
    typing_message_sid: Optional[str]       # Twilio SID of the "⏳ ..." placeholder (deleted before real reply)

    # ── Tenant context (set by context_retriever_node) ────────────────────────
    tenant_config: dict[str, Any]           # Full tenant doc: system_prompt, media_library
    chat_history: list[dict[str, str]]      # Last 5 messages [{role, content}, ...]

    # ── LLM decision (set by llm_reasoning_node) ──────────────────────────────
    llm_response: str                       # The text the bot will say
    response_type: str                      # "text" | "image" | "document"
    media_asset_key: Optional[str]          # Key to look up in media_library e.g. "catalog"
    media_url: Optional[str]                # Resolved public URL from media_library
    media_filename: Optional[str]           # Filename for documents e.g. "catalog.pdf"

    # ── Error handling ────────────────────────────────────────────────────────
    error: Optional[str]                    # Set if any node encounters an unrecoverable error

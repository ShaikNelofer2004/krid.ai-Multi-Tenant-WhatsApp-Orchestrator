from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


# ─── Helpers ──────────────────────────────────────────────────────────────────

class PyObjectId(ObjectId):
    """Custom ObjectId type compatible with Pydantic v2."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _info=None):
        if not ObjectId.is_valid(v):
            raise ValueError(f"Invalid ObjectId: {v}")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(cls.validate)


# ─── Enums ────────────────────────────────────────────────────────────────────

class SessionStatus(str, Enum):
    WAITING_FOR_BOT = "WAITING_FOR_BOT"
    AGENT_RESPONDING = "AGENT_RESPONDING"
    RESOLVED = "RESOLVED"
    NEEDS_HUMAN = "NEEDS_HUMAN"  # Bonus: frustration handover


class MessageDirection(str, Enum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"


# ─── Tenant ───────────────────────────────────────────────────────────────────

class TenantModel(BaseModel):
    """
    Represents a company (tenant) using the WhatsApp SaaS platform.
    Contains the LLM system prompt and a media library mapping
    query terms to public asset URLs.
    """
    tenant_id: str                          # e.g. "tenant_a"
    name: str                               # e.g. "Luxury Furniture Store"
    system_prompt: str                      # LLM instruction context for this brand
    media_library: dict[str, str]           # e.g. {"catalog": "https://...", "sofa": "https://..."}
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


# ─── Chat Session ─────────────────────────────────────────────────────────────

class ChatSessionModel(BaseModel):
    """
    Represents an ongoing conversation between a customer and a tenant's bot.
    Tracks status through WAITING_FOR_BOT → AGENT_RESPONDING → RESOLVED.
    """
    customer_phone: str                                     # Customer's WhatsApp phone number
    tenant_id: str                                          # Which tenant this session belongs to
    status: SessionStatus = SessionStatus.WAITING_FOR_BOT
    context_variables: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        use_enum_values = True


# ─── Message Audit Log ────────────────────────────────────────────────────────

class MessageAuditLogModel(BaseModel):
    """
    Immutable record of every inbound and outbound message.
    Used by the frontend dashboard to reconstruct conversation threads.
    """
    session_id: str                                         # References ChatSession._id
    tenant_id: str
    direction: MessageDirection                             # INBOUND or OUTBOUND
    sender: str                                             # Phone number or "bot"
    text_content: Optional[str] = None                     # Text body of the message
    media_url: Optional[str] = None                        # Public URL for image/document
    media_mime_type: Optional[str] = None                  # e.g. "application/pdf", "image/jpeg"
    media_filename: Optional[str] = None                   # e.g. "catalog.pdf"
    is_typing_indicator: bool = False                      # Metadata: was bot "typing"?
    whatsapp_message_id: Optional[str] = None              # Meta's message ID
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        use_enum_values = True

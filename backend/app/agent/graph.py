"""
LangGraph StateGraph — wires the 4 nodes into a sequential pipeline.

Flow (as specified in the assignment):
  [Webhook Inbound]
       │
       ▼
  acknowledge_node       ──► Send Read + Typing On (WhatsApp)
       │
       ▼
  context_retriever_node ──► Pull tenant rules + conversation history
       │
       ▼
  llm_reasoning_node     ──► Choose response type + media assets (Gemini)
       │
       ▼
  dispatcher_node        ──► Send Text/Image/Doc + Save state to MongoDB
"""
import asyncio
import logging
from typing import Any
from langgraph.graph import StateGraph, END

from app.agent.state import AgentState
from app.agent.nodes import (
    acknowledge_node,
    context_retriever_node,
    llm_reasoning_node,
    dispatcher_node,
)

logger = logging.getLogger(__name__)


def build_graph() -> StateGraph:
    """
    Construct and compile the LangGraph StateGraph.
    Returns a compiled graph ready for invocation.
    """
    graph = StateGraph(AgentState)

    # ── Register all 4 nodes ──────────────────────────────────────────────────
    graph.add_node("acknowledge", acknowledge_node)
    graph.add_node("context_retriever", context_retriever_node)
    graph.add_node("llm_reasoning", llm_reasoning_node)
    graph.add_node("dispatcher", dispatcher_node)

    # ── Define the sequential pipeline edges ─────────────────────────────────
    graph.set_entry_point("acknowledge")
    graph.add_edge("acknowledge", "context_retriever")
    graph.add_edge("context_retriever", "llm_reasoning")
    graph.add_edge("llm_reasoning", "dispatcher")
    graph.add_edge("dispatcher", END)

    return graph.compile()


# Compile once at module load — reused for every incoming message
_compiled_graph = build_graph()


async def run_agent(inbound_data: dict[str, Any]) -> None:
    """
    Entry point called by the webhook background task.
    Initializes the AgentState and runs the full LangGraph pipeline.

    This function runs AFTER the webhook has already returned 200 OK to Meta.
    """
    logger.info(
        f"🚀 Agent started for {inbound_data['customer_phone']} "
        f"(tenant: {inbound_data['tenant_id']})"
    )

    # Initialize state with inbound message data from webhook
    initial_state: AgentState = {
        # Inbound fields
        "tenant_id":           inbound_data["tenant_id"],
        "customer_phone":      inbound_data["customer_phone"],
        "whatsapp_message_id": inbound_data["whatsapp_message_id"],
        "inbound_text":        inbound_data.get("inbound_text", ""),  # fixed: was "text"
        "message_type":        inbound_data.get("message_type", "text"),
        "media_id":            inbound_data.get("media_id"),
        "media_url_direct":    inbound_data.get("media_url_direct"),  # Twilio direct image URL
        # Channel routing — "meta" or "twilio" (determines which sender is used)
        "channel":             inbound_data.get("channel", "meta"),
        # Fields populated by nodes (initialized as empty)
        "session_id":          "",
        "typing_message_sid":   None,   # Set by acknowledge_node for Twilio typing placeholder
        "tenant_config":       {},
        "chat_history":        [],
        "llm_response":        "",
        "response_type":       "text",
        "media_asset_key":     None,
        "media_url":           None,
        "media_filename":      None,
        "error":               None,
    }

    try:
        final_state = await _compiled_graph.ainvoke(initial_state)
        logger.info(
            f"✅ Agent completed for {inbound_data['customer_phone']} "
            f"— response_type: {final_state.get('response_type')}"
        )
    except Exception as e:
        logger.error(
            f"❌ Agent pipeline failed for {inbound_data['customer_phone']}: {e}",
            exc_info=True,
        )

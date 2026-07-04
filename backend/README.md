# 🖥️ Backend — Multi-Tenant WhatsApp AI Orchestrator

FastAPI + LangGraph + MongoDB + Gemini AI backend powering the WhatsApp agent pipeline.

---

## 📌 Table of Contents

1. [Overview](#-overview)
2. [Folder Structure](#-folder-structure)
3. [Setup & Installation](#-setup--installation)
4. [Environment Variables](#-environment-variables)
5. [Database Schema](#-database-schema)
6. [LangGraph Pipeline (All 4 Nodes)](#-langgraph-pipeline)
7. [Agent Tools Deep-Dive](#-agent-tools)
8. [WhatsApp Channels](#-whatsapp-channels)
9. [REST API Endpoints](#-rest-api-endpoints)
10. [Key Design Decisions](#-key-design-decisions)
11. [Running & Testing](#-running--testing)

---

## 📋 Overview

The backend is a fully async **FastAPI** application that:

1. Receives WhatsApp messages via webhooks (Meta or Twilio)
2. Returns `200 OK` **immediately** (never makes the webhook wait)
3. Processes the message through a **4-node LangGraph pipeline** in the background
4. Sends back a text, image, or PDF reply via WhatsApp
5. Stores everything in **MongoDB Atlas**
6. Exposes **REST endpoints** for the React dashboard

---

## 📁 Folder Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Pydantic Settings
│   ├── database/
│   │   ├── connection.py       # Motor async MongoDB client
│   │   ├── models.py           # Enums: SessionStatus, MessageDirection
│   │   └── seed.py             # Seeds Tenants into MongoDB
│   │
│   ├── agent/
│   │   ├── state.py            # AgentState TypedDict
│   │   ├── graph.py            # LangGraph StateGraph wiring + run_agent()
│   │   └── nodes.py            # Nodes + LLM tools + vision helpers
│   │
│   ├── whatsapp/
│   │   ├── client.py           # Meta WhatsApp Cloud API helpers
│   │   └── webhook.py          # Meta webhook endpoints
│   │
│   ├── twilio/
│   │   ├── sender.py           # Twilio REST API sender
│   │   └── webhook.py          # Twilio webhook endpoint
│   │
│   └── api/
│       └── dashboard.py        # Dashboard REST API
│
├── requirements.txt
├── Dockerfile
└── .env                        # Secrets (never commit this)
```

---

## ⚙️ Setup & Installation

```bash
# Navigate to backend folder
cd backend

# Create Python virtual environment
python -m venv venv

# Activate it
source venv/bin/activate  # macOS / Linux
# venv\Scripts\activate   # Windows

# Install all dependencies
pip install -r requirements.txt

# Seed the database (run ONCE before starting server)
python -m app.database.seed

# Start development server with hot-reload
uvicorn app.main:app --reload --port 8000
```

**Verify it's running:**
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

---

## 🔑 Environment Variables

Create `backend/.env` with these values:

```env
# ── MongoDB ─────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/
MONGODB_DB_NAME=whatsapp_saas

# ── Google Gemini AI ─────────────────────────────────────────────────
# Primary key
GOOGLE_API_KEY=AIzaSyCVt9GsFGTc...

# Fallback keys for automatic quota rotation
GOOGLE_API_KEY_FALLBACK_1=AQ.Ab8RN6KoM9Wd...
GOOGLE_API_KEY_FALLBACK_2=AQ.Ab8RN6LCDCI0...

# Gemini model to use
GEMINI_MODEL=gemini-2.0-flash

# ── Meta WhatsApp Cloud API ──────────────────────────────────────────
WHATSAPP_TOKEN=EAANkK9F6OPIBRy...
WHATSAPP_PHONE_NUMBER_ID=1113267475210652
WHATSAPP_VERIFY_TOKEN=kridaitoken123
WHATSAPP_APP_SECRET=faf4262c70c5fada...

# ── App Config ───────────────────────────────────────────────────────
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=false
```

---

## 🗄️ Database Schema

### Collection: `tenants`

```json
{
  "_id": "ObjectId",
  "tenant_id": "tenant_a",
  "name": "The Grand Emporium",
  "system_prompt": "You are an elegant sales assistant...",
  "product_knowledge": "THE GRAND EMPORIUM\nSovereign Sofa Set - ₹2,85,000...",
  "media_library": {
    "catalog":  "https://docs.google.com/document/.../export?format=pdf",
    "sofa":     "https://images.unsplash.com/photo-..."
  },
  "twilio_account_sid": "AC11790b40b...",
  "twilio_auth_token": "04cdee90e1...",
  "twilio_whatsapp_number": "whatsapp:+14155238886",
  "created_at": "2026-06-22T04:30:00Z"
}
```

### Collection: `chat_sessions`

```json
{
  "_id": "ObjectId",
  "customer_phone": "+919440639183",
  "tenant_id": "tenant_b",
  "status": "WAITING_FOR_BOT",
  "context_variables": {},
  "created_at": "2026-06-22T04:00:00Z",
  "updated_at": "2026-06-22T04:38:00Z"
}
```

**Session Statuses:**
- `AGENT_RESPONDING`: LangGraph pipeline is currently running
- `WAITING_FOR_BOT`: Reply sent, waiting for next customer message
- `NEEDS_HUMAN`: Frustration detected — human agent should take over
- `CLOSED`: Conversation ended

### Collection: `message_audit_log`

```json
{
  "_id": "ObjectId",
  "session_id": "6a37be43c1f9ba94525b5625",
  "tenant_id": "tenant_b",
  "direction": "INBOUND",
  "sender": "+919440639183",
  "text_content": "[Customer sent an image: Front bumper damage, cracked headlight]\nCaption: Give me a repair estimate",
  "media_url": "https://api.twilio.com/...",
  "media_mime_type": "image/jpeg",
  "timestamp": "2026-06-22T04:16:25Z"
}
```

---

## 🧠 LangGraph Pipeline

### Graph Definition (`graph.py`)

```python
graph = StateGraph(AgentState)
graph.add_node("acknowledge",   acknowledge_node)
graph.add_node("context",       context_retriever_node)
graph.add_node("llm",           llm_reasoning_node)
graph.add_node("dispatch",      dispatcher_node)
# Edges define linear execution: acknowledge -> context -> llm -> dispatch
```

### Node 1: `acknowledge_node`
Runs immediately (~50ms). Updates session status, logs inbound message, and sends native typing indicators/read receipts where supported.

### Node 2: `context_retriever_node`
Fetches the tenant configuration, last 20 messages of chat history, and dynamically injects `product_knowledge` into the LLM system prompt.

### Node 3: `llm_reasoning_node`
Handles image processing via Gemini Vision, builds the LangChain message payload, manages API key fallback rotation, and invokes the LLM. It also detects user frustration and sets `NEEDS_HUMAN` flags.

### Node 4: `dispatcher_node`
Routes the AI response back to the correct channel via `wa.send_text()`, `wa.send_image()`, or `wa.send_document()`. Logs the outbound interaction.

---

## 🔧 Agent Tools

- **`reply_with_text(message: str)`**: Used for general questions, greetings, price quotes, and scheduling. Supports WhatsApp Markdown.
- **`send_catalog_pdf(asset_key: str, caption: str)`**: Used when customers request brochures, service schedules, or invoices. Fetches public PDF URL.
- **`send_image_asset(asset_key: str, caption: str)`**: Used to send product photos, showroom pictures, or diagrams.

---

## 📞 WhatsApp Channels

The system natively supports two distinct channels:

### Meta WhatsApp Cloud API (`app/whatsapp/`)
Provides native integration with full support for `mark_as_read` and `send_typing_on`. Uses HMAC-SHA256 for secure webhook validation.

### Twilio WhatsApp (`app/twilio/`)
Supports per-tenant dynamic Twilio credentials allowing true multi-tenancy where each tenant can operate on entirely separate Twilio sub-accounts.

---

## 📡 REST API Endpoints

- `GET /api/tenants` — Returns all active tenants.
- `GET /api/sessions?tenant_id=xxx` — Returns all chat sessions.
- `GET /api/messages?session_id=xxx` — Returns message history for a session.
- `POST /api/broadcast` — Initiates a bulk message broadcast with optional images.

---

## 🔑 Key Design Decisions

1. **Background Pipeline:** `background_tasks.add_task()` runs the LangGraph pipeline post-HTTP response to ensure webhooks return a `200 OK` within seconds.
2. **API Key Fallback:** A rotating mechanism (`invoke_with_key_fallback()`) prevents system failures during Gemini free-tier rate limits.
3. **Multimodal Memory:** Gemini Vision descriptions of incoming images are saved to the audit log so the AI retains visual context in future turns.
4. **Pre-Injected Context:** Storing processed product knowledge directly in MongoDB during the seed phase eliminates runtime Google Docs fetching latency.

---

## 🧪 Running & Testing

1. Join the Twilio sandbox: send `join <your-keyword>` to `+14155238886`
2. Send: `"Show me your sofa"` → should receive sofa image
3. Send: `"Give me your catalog"` → should receive PDF
4. Send a photo → should receive Gemini Vision analysis

Check the interactive API documentation at http://localhost:8000/docs.

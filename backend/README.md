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
│   │                           # Registers all routers, lifespan events
│   │
│   ├── config.py               # Pydantic Settings — reads .env
│   │                           # Includes GOOGLE_API_KEY + 2 fallback keys
│   │
│   ├── database/
│   │   ├── connection.py       # Motor async MongoDB client
│   │   │                       # connect_db(), close_db(), get_db()
│   │   ├── models.py           # Enums: SessionStatus, MessageDirection
│   │   └── seed.py             # Seeds Tenant A + B into MongoDB
│   │                           # Fetches Google Docs as product_knowledge
│   │
│   ├── agent/
│   │   ├── state.py            # AgentState TypedDict — the shared pipeline state
│   │   ├── graph.py            # LangGraph StateGraph wiring + run_agent()
│   │   └── nodes.py            # All 4 nodes + LLM tools + vision helpers
│   │                           # invoke_with_key_fallback() for key rotation
│   │
│   ├── whatsapp/
│   │   ├── client.py           # Meta WhatsApp Cloud API v20.0 helpers
│   │   │                       # mark_as_read, send_typing_on, send_text,
│   │   │                       # send_image, send_document
│   │   └── webhook.py          # Meta webhook endpoints
│   │                           # GET /api/webhooks/whatsapp (hub verification)
│   │                           # POST /api/webhooks/whatsapp (inbound)
│   │                           # X-Hub-Signature-256 validation
│   │
│   ├── twilio/
│   │   ├── sender.py           # Twilio REST API sender
│   │   │                       # Handles text, image, document messages
│   │   └── webhook.py          # Twilio webhook endpoint
│   │                           # POST /api/webhooks/twilio?tenant=xxx
│   │                           # Parses NumMedia, MediaUrl0 for image support
│   │
│   └── api/
│       └── dashboard.py        # Dashboard REST API
│                               # GET /api/tenants
│                               # GET /api/sessions
│                               # GET /api/messages
│                               # POST /api/broadcast
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
venv\Scripts\activate      # Windows PowerShell
# source venv/bin/activate  # macOS / Linux

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
# Primary key — used first for every request
GOOGLE_API_KEY=AIzaSyCVt9GsFGTc...

# Fallback keys — automatically used if primary hits quota (429 error)
# The system tries Key 0 → Key 1 → Key 2 in order
GOOGLE_API_KEY_FALLBACK_1=AQ.Ab8RN6KoM9Wd...
GOOGLE_API_KEY_FALLBACK_2=AQ.Ab8RN6LCDCI0...

# Gemini model to use
GEMINI_MODEL=gemini-2.0-flash

# ── Meta WhatsApp Cloud API ──────────────────────────────────────────
# Get these from https://developers.facebook.com → Your App → WhatsApp
WHATSAPP_TOKEN=EAANkK9F6OPIBRy...          # Temporary access token
WHATSAPP_PHONE_NUMBER_ID=1113267475210652   # Your sandbox phone number ID
WHATSAPP_VERIFY_TOKEN=kridaitoken123        # Any secret string you choose
WHATSAPP_APP_SECRET=faf4262c70c5fada...     # App Settings → Basic → App Secret

# ── App Config ───────────────────────────────────────────────────────
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=false

# ── Twilio Credentials (stored per-tenant in MongoDB, not here) ──────
# Each tenant has its own twilio_account_sid and twilio_auth_token
# stored in the tenants collection. See seed.py.
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
  "product_knowledge": "LUXE HAVEN\nSovereign Sofa Set - ₹2,85,000...",
  "media_library": {
    "catalog":  "https://docs.google.com/document/.../export?format=pdf",
    "sofa":     "https://images.unsplash.com/photo-...",
    "chair":    "https://images.unsplash.com/photo-...",
    "dining":   "https://images.unsplash.com/photo-...",
    "bedroom":  "https://images.unsplash.com/photo-...",
    "showroom": "https://images.unsplash.com/photo-..."
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

| Status | Meaning |
|---|---|
| `AGENT_RESPONDING` | LangGraph pipeline is currently running |
| `WAITING_FOR_BOT` | Reply sent, waiting for next customer message |
| `NEEDS_HUMAN` | Frustration detected — human agent should take over |
| `CLOSED` | Conversation ended |

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
  "media_filename": null,
  "whatsapp_message_id": "SMf73b422569f8b948...",
  "is_typing_indicator": false,
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

graph.set_entry_point("acknowledge")
graph.add_edge("acknowledge", "context")
graph.add_edge("context",     "llm")
graph.add_edge("llm",         "dispatch")
graph.add_edge("dispatch",    END)

agent = graph.compile()
```

### Node 1: `acknowledge_node`

**File:** `app/agent/nodes.py`

**Runs:** Immediately when message arrives (~50ms)

```
Input:  raw inbound_data from webhook
Output: { session_id, typing_message_sid }
```

**Step-by-step:**
1. Checks `channel` field
2. **Meta:** Calls `wa.mark_as_read(message_id)` → blue ticks appear  
   **Meta:** Calls `wa.send_typing_on(phone)` → animated dots appear  
   **Twilio:** Logs "no native typing indicator"
3. `find_one` chat_sessions by `{customer_phone, tenant_id}`
   - Found → updates `status=AGENT_RESPONDING`, `updated_at=now`
   - Not found → inserts new session document
4. Inserts inbound message to `message_audit_log`

---

### Node 2: `context_retriever_node`

**File:** `app/agent/nodes.py`

**Runs:** After acknowledge (~30ms DB fetch)

```
Input:  { tenant_id, session_id }
Output: { tenant_config, chat_history }
```

**Step-by-step:**
1. Fetches full tenant doc from MongoDB (excluding heavy fields that aren't needed)
2. Fetches last **20 messages** for the session, sorted by timestamp ASC
3. Formats messages into `[{role: "human"|"assistant", content: "..."}]`
4. For messages with media, appends `[Attached Media: <url>]` to content
5. Injects `product_knowledge` text into the bottom of `system_prompt`:
   ```
   --- PRODUCT KNOWLEDGE (from official catalog/rate card) ---
   [full catalog text here]
   --- END PRODUCT KNOWLEDGE ---
   ```

---

### Node 3: `llm_reasoning_node`

**File:** `app/agent/nodes.py`

**Runs:** After context (~2-8s LLM call)

```
Input:  { inbound_text, tenant_config, chat_history, message_type, media_* }
Output: { llm_response, response_type, media_asset_key, media_url, media_filename, error }
```

**Step-by-step:**
1. **Image handling** (runs BEFORE LLM call):
   - Meta `media_id` → downloads from Meta API → Gemini Vision → description
   - Twilio `media_url_direct` → downloads with Basic Auth → Gemini Vision → description
   - Text URL detected → downloads → Gemini Vision → description
   - Description prepended to `inbound_text`, saved back to MongoDB audit log

2. **Build LangChain messages:**
   ```python
   messages = [SystemMessage(content=system_prompt_with_knowledge)]
   + [HumanMessage/AIMessage for each history item]
   + [HumanMessage(content=inbound_text)]
   ```

3. **Invoke Gemini with key rotation:**
   ```python
   response = await invoke_with_key_fallback(messages, tools=TOOLS)
   ```

4. **Parse response:**
   - Has tool calls → parse `tool_calls[0]`
   - No tool calls → `_extract_text(response.content)` (handles list/string both)

5. **Frustration check:**
   ```python
   if any(kw in inbound_text.lower() for kw in frustration_keywords):
       return { ..., "error": "NEEDS_HUMAN" }
   ```

**`_extract_text()` helper** — critical fix:
Gemini sometimes returns `content` as a list of dicts instead of a plain string:
```python
# Bad (was causing raw JSON in WhatsApp):
str([{'type': 'text', 'text': 'Hello', 'extras': {...}}])

# Good (what _extract_text() does):
"Hello"
```

---

### Node 4: `dispatcher_node`

**File:** `app/agent/nodes.py`

**Runs:** After LLM (~200ms send)

```
Input:  { channel, response_type, llm_response, media_url, media_filename }
Output: (saves to DB, updates session)
```

**Routing table:**

| `channel` | `response_type` | Action |
|---|---|---|
| `meta` | `text` | `wa.send_text(phone, text)` |
| `meta` | `image` | `wa.send_image(phone, url, caption)` |
| `meta` | `document` | `wa.send_document(phone, url, filename, caption)` |
| `twilio` | `text` | `send_twilio_message(phone, text)` |
| `twilio` | `image` | `send_twilio_message(phone, text, media_url)` |
| `twilio` | `document` | `send_twilio_message(phone, caption, media_url)` |

After sending:
- Saves outbound to `message_audit_log` with `direction=OUTBOUND`
- Updates `chat_sessions.status` → `WAITING_FOR_BOT` (or `NEEDS_HUMAN`)

---

## 🔧 Agent Tools

### `reply_with_text(message: str)`
- **Triggered by:** General questions, greetings, price quotes, appointment booking, any conversational response
- **Returns:** Plain text response
- **Supports:** WhatsApp Markdown (`*bold*`, `_italic_`, `~strikethrough~`)

### `send_catalog_pdf(asset_key: str, caption: str)`
- **Triggered by:** "send catalog", "price list", "invoice", "brochure", "document"
- **Resolves:** `tenant_config["media_library"][asset_key]` → PDF URL
- **Falls back to:** `reply_with_text` if asset key not found in library
- **Assets:** `catalog` (Tenant A), `invoice`/`service_schedule` (Tenant B)

### `send_image_asset(asset_key: str, caption: str)`
- **Triggered by:** "show me", "picture of", "image of", "photo of", "what does it look like"
- **Resolves:** `tenant_config["media_library"][asset_key]` → image URL
- **Assets:** `sofa`, `chair`, `dining`, `bedroom`, `showroom` (A), `engine`, `repair_diagram`, `oil_change`, `tire` (B)

---

## 📞 WhatsApp Channels

### Meta WhatsApp Cloud API (`app/whatsapp/`)

**Base URL:** `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`

| Function | Description | Payload type |
|---|---|---|
| `mark_as_read(msg_id)` | Shows blue double ticks | status update |
| `send_typing_on(phone)` | Shows animated dots | typing_indicator |
| `send_text(phone, body)` | Plain/markdown text | text |
| `send_image(phone, url, caption)` | Image from public URL | image |
| `send_document(phone, url, filename, caption)` | PDF/file | document |

**Webhook Security:** Every inbound POST is validated:
```python
expected = hmac.new(APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
received = request.headers["X-Hub-Signature-256"].replace("sha256=", "")
if not hmac.compare_digest(expected, received):
    raise HTTPException(403, "Invalid signature")
```

### Twilio WhatsApp (`app/twilio/`)

**Why per-tenant credentials:** Each tenant has their own `twilio_account_sid` + `twilio_auth_token` stored in MongoDB. This enables true multi-tenancy — Tenant A and Tenant B can have different Twilio sub-accounts.

**Inbound parsing (`webhook.py`):**
```python
From       = form_data.get("From", "")     # "whatsapp:+919440639183"
Body       = form_data.get("Body", "")     # Customer's text
NumMedia   = int(form_data.get("NumMedia", "0"))
MediaUrl0  = form_data.get("MediaUrl0")    # Direct image URL (if image sent)
MediaContentType0 = form_data.get("MediaContentType0")  # "image/jpeg"
```

**Outbound sending (`sender.py`):**
```python
client.messages.create(
    from_=tenant_config["twilio_whatsapp_number"],  # "whatsapp:+14155238886"
    to=f"whatsapp:{phone}",
    body=message_body,
    media_url=[media_url] if media_url else None,   # For images/PDFs
)
```

---

## 📡 REST API Endpoints

All endpoints are defined in `app/api/dashboard.py`.

### `GET /api/tenants`
Returns all tenants (excludes `system_prompt` for brevity).

```json
[
  { "id": "...", "tenant_id": "tenant_a", "name": "The Grand Emporium" },
  { "id": "...", "tenant_id": "tenant_b", "name": "Speedy Fix Auto" }
]
```

### `GET /api/sessions?tenant_id=tenant_b`
Returns all chat sessions for a tenant, sorted by `updated_at` descending.

```json
[
  {
    "id": "6a37be43c1f9ba94525b5625",
    "customer_phone": "+919440639183",
    "tenant_id": "tenant_b",
    "status": "WAITING_FOR_BOT",
    "updated_at": "2026-06-22T04:38:00Z"
  }
]
```

### `GET /api/messages?session_id=6a37be43...`
Returns full message history for a session.

```json
[
  {
    "id": "...",
    "direction": "INBOUND",
    "sender": "+919440639183",
    "text_content": "Give me a repair estimate for my damaged car",
    "media_url": "https://api.twilio.com/...",
    "media_mime_type": "image/jpeg",
    "timestamp": "2026-06-22T04:38:00Z",
    "is_typing_indicator": false
  }
]
```

### `POST /api/broadcast`

```json
{
  "tenant_id": "tenant_a",
  "message": "🎉 New catalog just dropped!",
  "phone_numbers": ["+919440639183"],    // null = all sessions
  "media_url": "https://...",            // optional image/PDF
  "media_type": "image"                  // "image" | "document"
}
```

---

## 🔑 Key Design Decisions

### 1. Why `background_tasks.add_task()` (not celery/redis)?
The webhook must return `200 OK` within 3 seconds or WhatsApp retries the delivery. `BackgroundTasks` runs the LangGraph pipeline after the HTTP response is sent — simple, zero extra infrastructure.

### 2. Why `invoke_with_key_fallback()` for Gemini?
Gemini Flash free tier has per-minute quota limits. With 3 API keys, the system can handle 3× the load before errors surface. The fallback is transparent to users.

### 3. Why save image descriptions back to MongoDB?
Without this, after Gemini Vision analyzed the photo, the description existed only in memory for that one request. On the next message, the AI would say "I don't know what image you're referring to." Saving the enriched `text_content` back means the description flows into the next turn's context window.

### 4. Why `_extract_text()` for LLM responses?
Gemini's newer models sometimes return `content` as a list of dicts (`[{'type': 'text', 'text': '...', 'extras': {...}}]`) instead of a plain string. Calling `str()` on a list produces Python repr — which gets sent raw to WhatsApp. `_extract_text()` normalizes all content formats.

### 5. Why store product knowledge in MongoDB (not retrieval at runtime)?
Fetching the Google Doc on every request would add 1-2s latency plus network dependency. At seed time we fetch it once, store it in MongoDB, and inject it into the system prompt on every request — fast and reliable.

### 6. Why 20 messages of context (not 5)?
With only 5 messages (≈ 2-3 turns), the AI would forget a booking request made 3 messages ago. 20 messages gives ~5-8 full conversation turns — enough for most complete service interactions.

---

## 🧪 Running & Testing

### Manual test via WhatsApp (Twilio)
1. Join the Twilio sandbox: send `join <your-keyword>` to `+14155238886`
2. Send: `"Show me your sofa"` → should receive sofa image
3. Send: `"Give me your catalog"` → should receive PDF
4. Send a photo → should receive Gemini Vision analysis

### Check logs
```bash
# Backend console shows structured logs:
2026-06-22 10:07:00 | INFO | app.twilio.webhook | [Twilio] Inbound from +919440639183
2026-06-22 10:07:00 | INFO | app.agent.graph    | 🚀 Agent started for +919440639183
2026-06-22 10:07:01 | INFO | app.agent.nodes    | 📨 Inbound message logged. Session: 6a37...
2026-06-22 10:07:01 | INFO | app.agent.nodes    | 📚 Context loaded: 20 history messages
2026-06-22 10:07:03 | INFO | app.agent.nodes    | [Twilio] Message dispatched (text)
2026-06-22 10:07:03 | INFO | app.agent.graph    | ✅ Agent completed — response_type: text
```

### API docs
Visit http://localhost:8000/docs for full interactive Swagger UI.

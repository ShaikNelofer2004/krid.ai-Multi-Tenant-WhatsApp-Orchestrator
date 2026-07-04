# Krid.Ai — Multi-Tenant WhatsApp AI Orchestrator

A cloud-native, multi-tenant AI agent system that enables multiple businesses to handle customer conversations over WhatsApp with full intelligence. The system can send text, images, and PDF documents, analyze incoming photos, detect customer frustration, and provide a live dashboard for monitoring all interactions.

---

## Table of Contents

1. [Live Demo — How to Test](#-live-demo--how-to-test)
2. [Project Overview](#-project-overview)
3. [Architecture](#-architecture)
4. [LangGraph Agent Pipeline](#-langgraph-agent-pipeline)
5. [Agent Tools](#-agent-tools)
6. [Features](#-features)
7. [Tech Stack](#-tech-stack)
8. [Quick Start](#-quick-start)
9. [Tenants & Business Scenarios](#-tenants--business-scenarios)
10. [Deployment](#-deployment)

---

## 🚀 Live Demo — How to Test

> **Everything is already deployed and live. No setup, no accounts, no webhooks needed. Just WhatsApp.**

> [!NOTE]
> **Cold Start Warning:** The backend is hosted on a free Render instance which goes to sleep after 15 minutes of inactivity. If you do not receive an instant reply to your first message, please wait up to 60 seconds for the server to wake up. All subsequent replies will be instant.

---

### Step 1 — Save the Number

Save this contact on your phone:

**Name:** `Krid AI Demo`
**Number:** `+1 415 523 8886`

---

### Step 2 — Pick a Tenant & Join

Open WhatsApp → send the join message to **+1 415 523 8886**:

| Tenant | Business | Send this message |
|---|---|---|
| **Tenant A** | 🪑 The Grand Emporium | `join north-excitement` |
| **Tenant B** | 🚗 Speedy Fix Auto | `join pictured-root` |

You'll get a confirmation reply. Now you're connected to that tenant's AI agent.

---

### Step 3 — Start Chatting

**Try with Tenant A — The Grand Emporium:**

| What to send | What the bot does |
|---|---|
| `Hi` | Greets you as an elegant furniture advisor |
| `Show me your sofa` | Sends a sofa photo |
| `Send me your catalog` | Sends the product catalog PDF |
| `What's the price of Emperor King Bed?` | Replies *"₹1,95,000"* from the catalog |
| `I want to visit your showroom` | Assists with booking |

**Try with Tenant B — Speedy Fix Auto:**

| What to send | What the bot does |
|---|---|
| `Hi` | Greets you as an automotive service advisor |
| `Send me an invoice` | Sends the service invoice PDF |
| `How much for an oil change?` | Replies *"₹3,100"* from the rate card |
| 📷 Send a car photo | Analyses visible damage + gives INR cost estimate |
| `I want to speak to a manager` | Detects frustration → escalates to human |

---

> 💡 While chatting, open the **Live Dashboard** to watch sessions, messages, and status updates appear in real-time.

---


## 📋 Project Overview

**Krid.Ai** is a Multi-Tenant WhatsApp AI Support & Sales Agent SaaS. It allows completely separate businesses ("tenants") to run their own AI-powered WhatsApp agent — each with their own:
- System prompt / personality
- Media library (product catalogs, images, invoices)
- Customer conversation history
- Live monitoring dashboard

**Two demo tenants are pre-configured:**

| Tenant | Business | What it does |
|---|---|---|
| **Tenant A** | The Grand Emporium | Sells luxury furniture, sends product catalog PDFs, showroom images |
| **Tenant B** | Speedy Fix Auto | Automotive service center, schedules appointments, sends invoices, analyzes car damage photos |

---

## 🏗️ Architecture

The system is built on a modular architecture separating the communication layer (WhatsApp/Twilio) from the AI Orchestration layer (LangGraph) and the data layer (MongoDB).

![System Architecture](system_architecture.png)

### Twilio Integration Note

While the system is fully equipped to integrate directly with the **Meta WhatsApp Cloud API** (fully implemented in `app/whatsapp/client.py`), this live demo uses the **Twilio WhatsApp Sandbox**. This ensures that anyone can test the system immediately without going through Meta's business verification and app review processes.

The system is **channel-agnostic**. Switching to Meta in production requires zero code changes—just setting the correct `.env` credentials and updating the webhook route.

---

## 🧠 LangGraph Agent Pipeline

The AI agent operates as a **stateful directed graph** using LangGraph. Every incoming message flows through exactly 4 nodes in sequence.

### Node 1 — Acknowledge Node
Reacts immediately to inbound messages. It logs the message, updates the `ChatSession` in MongoDB, and handles read receipts/typing indicators where supported.

### Node 2 — Context Retriever Node
Loads the full tenant document from MongoDB (`system_prompt`, `media_library`, `product_knowledge`) and the last 20 messages of conversation history. It injects the specific product knowledge into the AI's prompt dynamically.

### Node 3 — LLM Reasoning Node
The core brain powered by **Google Gemini**. It handles:
- **API Key Fallback Rotation:** Automatically switches keys if rate limits are hit.
- **Multimodal Image Handling:** If a user sends a photo, Gemini Vision describes the image and saves the context.
- **Frustration Detection:** Identifies angry/frustrated users and flags the session in the dashboard as `NEEDS_HUMAN`.

### Node 4 — Dispatcher Node
Executes the AI's decision by routing the response (text, image, or PDF document) back to the user via the correct channel (Twilio or Meta) and updates the final audit log.

---

## 🛠️ Agent Tools

The LLM is equipped with **3 structured tools** to interact with customers intelligently:

1. **`reply_with_text`**: Used for general questions, greetings, scheduling, and price quotes. Supports WhatsApp markdown (*bold*, _italics_).
2. **`send_catalog_pdf`**: Used when a customer requests a document like a catalog, invoice, or service schedule. It fetches the public PDF URL from the tenant's media library and sends it directly.
3. **`send_image_asset`**: Used to send product photos, showroom pictures, or repair diagrams from the tenant's pre-configured image assets.

---

## ✨ Features

- **Multi-Tenant Architecture:** Completely isolated tenants with separate prompts, media, history, and credentials.
- **Typing Indicators & Read Receipts:** Enhances user experience (fully native on Meta API).
- **Multimodal Support:** Customers can send photos for the AI to analyze (e.g., car damage estimation).
- **Conversation Memory:** Context-aware responses using the last 20 messages.
- **Live React Dashboard:** Real-time session monitoring and bulk broadcast campaigns.
- **Broadcast Campaigns:** Send bulk messages with optional image attachments to active sessions.
- **Webhook Security:** HMAC-SHA256 validation for secure webhook processing.

---

## 💻 Tech Stack

| Layer | Technology |
|---|---|
| **AI Orchestration** | LangGraph (Python) |
| **LLM** | Google Gemini (Flash & Vision) |
| **Backend** | FastAPI + Python 3.11 |
| **Database** | MongoDB Atlas (Motor async) |
| **WhatsApp Layer** | Twilio WhatsApp Sandbox (Demo) / Meta Cloud API (Prod) |
| **Frontend** | React + Vite + Tailwind CSS |
| **Infrastructure** | Docker + Docker Compose |

---

## ⚡ Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your MongoDB, Gemini, and Twilio credentials.

### 3. Seed Database

```bash
python -m app.database.seed
```
This fetches Google Docs content and seeds both demo tenants into your database.

### 4. Start Services

**Backend:**
```bash
uvicorn app.main:app --reload --port 8000
```
**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🏢 Tenants & Business Scenarios

### Tenant A — The Grand Emporium
**Webhook:** `POST /api/webhooks/twilio?tenant=tenant_a`  
**Persona:** Elegant, sophisticated, knowledgeable sales assistant  
**Capabilities:** Sends product catalogs, answers pricing questions, assists with showroom bookings.

### Tenant B — Speedy Fix Auto
**Webhook:** `POST /api/webhooks/twilio?tenant=tenant_b`  
**Persona:** Technical, trustworthy automotive service advisor  
**Capabilities:** Sends invoices, analyzes car damage photos, provides cost estimates, escalates to human managers when necessary.

---

## 🚀 Deployment

The project is fully dockerized and ready for cloud deployment.

### Docker Compose (Local Full Stack)
```bash
docker-compose up --build
```

### Cloud Deployment (Render / Railway / GCP)
1. Connect your GitHub repository.
2. Add the required environment variables.
3. Use `pip install -r requirements.txt` for the build command.
4. Set `uvicorn app.main:app --host 0.0.0.0 --port $PORT` as the start command.
5. Update your Twilio webhook URL to point to the live HTTPS URL.

# 🎨 Frontend — Multi-Tenant WhatsApp Dashboard

React + Vite + Tailwind CSS monitoring dashboard for the WhatsApp AI Orchestrator.

---

## 📌 Table of Contents

1. [Overview](#-overview)
2. [Folder Structure](#-folder-structure)
3. [Setup & Installation](#-setup--installation)
4. [Components](#-components)
5. [Design System](#-design-system)
6. [API Client](#-api-client)
7. [Features Deep-Dive](#-features-deep-dive)
8. [Key Implementation Details](#-key-implementation-details)
9. [Building for Production](#-building-for-production)

---

## 📋 Overview

The frontend is a **React Single-Page Application** built with Vite. It provides a live monitoring dashboard for business owners to:

- Switch between **Tenant A** (The Grand Emporium) and **Tenant B** (Speedy Fix Auto)
- Watch **live conversations** with real-time auto-refresh (every 3–5 seconds)
- View full **chat threads** with images inline and PDF badges
- Send **broadcast campaigns** to customers with optional image attachments
- See at a glance which sessions need human attention (highlighted red)

---

## 📁 Folder Structure

```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── main.jsx                   # React root mount
│   ├── App.jsx                    # Root layout — header + panels
│   ├── api.js                     # Axios instance + all API calls
│   ├── index.css                  # Full design system (tokens, components)
│   └── components/
│       ├── LandingPage.jsx        # Hero marketing page with feature cards
│       ├── TenantSwitcher.jsx     # Tenant dropdown + stats bar
│       ├── ChatMonitor.jsx        # Left panel — live session list
│       ├── ChatThread.jsx         # Right panel — full conversation view
│       └── BroadcastDrawer.jsx    # Slide-in drawer for bulk messaging
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json
└── Dockerfile
```

---

## ⚙️ Setup & Installation

```bash
cd frontend

# Install dependencies
npm install

# Start development server (hot module replacement)
npm run dev
# → http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment (optional)

If your backend runs on a different port or domain, set:

```bash
# frontend/.env
VITE_API_URL=http://localhost:8000
```

---

## 🧩 Components

### `LandingPage.jsx` — Hero Marketing Page
Features an animated gradient hero section, live stats display fetched from the API, and a premium glassmorphism design.

### `TenantSwitcher.jsx` — Tenant Selector + Stats Bar
The top navigation component allowing users to swap between active tenants. Displays four live stats cards auto-refreshing every 10s: Total Sessions, Processing, Needs Human, and Total Messages.

### `ChatMonitor.jsx` — Live Session List (Left Panel)
Shows all active conversations for the selected tenant, polling `/api/sessions?tenant_id=xxx` every 5 seconds. Includes red highlights for `NEEDS_HUMAN` sessions and skeleton loading animations.

### `ChatThread.jsx` — Conversation View (Right Panel)
Renders the full chat history when a session is selected.
- Distinguishes outbound (bot) and inbound (customer) messages with different UI bubbles.
- Renders images inline and provides clickable cards for PDF documents.
- Includes a **Smart Auto-Scroll** behavior to ensure reading older messages isn't interrupted by incoming polls.

### `BroadcastDrawer.jsx` — Bulk Campaign Sender
A slide-in drawer for managing bulk messaging campaigns. Supports manual phone entry or bulk importing all active sessions, composing markdown text, and attaching media URLs.

---

## 🎨 Design System

All design tokens and base components are defined in `src/index.css`.

### Color Palette

```css
/* Brand (Blue) */
--brand-50:  #eff6ff
--brand-600: #2563eb
--brand-700: #1d4ed8

/* Danger (Red) — for NEEDS_HUMAN */
--danger-light:  #fef2f2
--danger-border: #fecaca
--danger-mid:    #fee2e2
--danger-text:   #dc2626
--danger-dot:    #ef4444
```

### Typography
- **Font:** `Inter` (Google Fonts) — clean, modern sans-serif.

---

## 🔌 API Client

`src/api.js` manages external data fetching using Axios.

```javascript
import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL });
// Available functions: getTenants(), getSessions(), getMessages(), sendBroadcast()
```

---

## 🔍 Features Deep-Dive

### Correct Timestamp Display
MongoDB stores all dates as UTC with no timezone suffix. The application uses a robust `toUTC()` helper function to force proper UTC interpretation across all browsers (preventing Chrome vs. Firefox discrepancies), rendering accurate local times (e.g., `10:07 AM`).

### Smart Scroll Behavior
To prevent aggressive scrolling when reading historical messages, `ChatThread` detects if the user is within 150px of the bottom of the container. If they are reading higher up, a "↓ New message" badge appears instead of forcing a scroll jump.

### Real-time Polling Architecture
Stateless interval polling keeps the dashboard architecture simple without requiring WebSockets:
- **Tenant Stats:** 10 seconds
- **Session List:** 5 seconds
- **Active Chat Thread:** 3 seconds

---

## 📦 Building for Production

```bash
# Build optimized bundle
npm run build
# Output: dist/

# Docker build
docker build -t whatsapp-frontend .
docker run -p 3000:80 whatsapp-frontend
```

The production `Dockerfile` leverages a multi-stage build, compiling the React application via Node.js and serving the static assets using Nginx.

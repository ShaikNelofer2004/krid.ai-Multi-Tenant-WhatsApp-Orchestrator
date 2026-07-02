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

- Switch between **Tenant A** (Luxe Haven Furniture) and **Tenant B** (PrimeAuto Care)
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
├── postcss.config.js
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
VITE_API_BASE_URL=http://localhost:8000
```

Default `api.js` uses `http://localhost:8000` — change if deploying backend elsewhere.

---

## 🧩 Components

### `LandingPage.jsx` — Hero Marketing Page

The first screen users see before entering the dashboard.

**Features:**
- Animated gradient hero section with badge + tagline
- Live stats display (sessions, messages, tenants)
- Feature cards grid: AI Agent, Multi-Tenant, Live Monitoring, Rich Media, Smart Routing, Broadcast
- "Enter Dashboard" CTA button
- Premium glassmorphism design with animated blobs

**State:** Fetches live tenant count from API for the stats display.

---

### `TenantSwitcher.jsx` — Tenant Selector + Stats Bar

Top section of the dashboard. Lets business owners switch between tenants and shows live KPIs.

**Features:**
- Dropdown listing all tenants from `/api/tenants`
- **4 live stats cards** (auto-refresh every 10s):
  - Total Sessions
  - Processing (WAITING_FOR_BOT count)
  - Needs Human (NEEDS_HUMAN count — shown with warning icon)
  - Total Messages
- "Auto-refresh 10s" indicator

**Props:**
```jsx
<TenantSwitcher
  tenant={selectedTenant}        // current tenant object
  onTenantChange={setTenant}     // callback when switched
/>
```

---

### `ChatMonitor.jsx` — Live Session List (Left Panel)

Shows all active conversations for the selected tenant.

**Features:**
- Polls `/api/sessions?tenant_id=xxx` every **5 seconds**
- Phone number search filter
- Session rows with:
  - Avatar (last 2 digits of phone number)
  - Status badge (`Processing` / `Needs Human` / `Active` / `Closed`)
  - Relative time ("2 minutes ago", "about 1 hour ago")
  - Red highlight + pulsing dot for `NEEDS_HUMAN` sessions
  - Active session highlighted with brand-color left border
- Loading skeleton animation on first load
- "No sessions found" empty state

**Status Badge Colors:**

| Status | Label | Color |
|---|---|---|
| `ACTIVE` | Active | Blue |
| `WAITING_FOR_BOT` | Processing | Amber/Orange |
| `NEEDS_HUMAN` | Needs Human | Red (+ pulsing dot) |
| `CLOSED` | Closed | Grey |

**Time display:** All session timestamps are UTC from MongoDB. The `toUTC()` helper ensures correct local timezone conversion regardless of browser.

---

### `ChatThread.jsx` — Conversation View (Right Panel)

Full chat view when a session is selected from the left panel.

**Features:**

**Message Rendering:**
- `OUTBOUND` messages (bot) → right-aligned, blue gradient bubble, "AI Agent" label
- `INBOUND` messages (customer) → left-aligned, white bubble, "Customer" label
- Timestamps in local time (12-hour format, e.g. `10:07 AM`)

**Media Rendering:**
- `image/jpeg`, `image/png`, `image/webp` → renders inline `<img>` with rounded corners + shadow
- `application/pdf` (or URL ending in `.pdf`) → PDF card with:
  - Red PDF icon
  - Filename or `"Document.pdf"`
  - "Tap to open" subtitle
  - External link arrow
  - Clicks open in new tab

**Date Dividers:**
```
──────────── Yesterday ────────────
  [messages from yesterday]
──────────── Today ────────────
  [messages from today]
```

**Smart Auto-Scroll:**
- On initial load → jumps to bottom instantly
- On new message arriving:
  - If user is within **150px of bottom** → smoothly scrolls to bottom
  - If user has scrolled up → shows **"↓ New message"** floating button (brand blue, pill shape)
  - Clicking the button → scrolls to bottom and dismisses button
- No more forced scroll hijacking when reading history!

**Session Header:**
- Phone number + avatar
- Clean status label (not raw snake_case):
  - `WAITING_FOR_BOT` → `"Status: Bot Responding"`
  - `NEEDS_HUMAN` → `"⚠️ Requires human attention"` (danger color)
- Message count
- "Live" indicator with pulsing dot

**Auto-refresh:** Polls `/api/messages?session_id=xxx` every **3 seconds**.

---

### `BroadcastDrawer.jsx` — Bulk Campaign Sender

Slide-in drawer from the right edge of the screen.

**Features:**
- Phone number management:
  - Manual entry (type + press Enter or comma)
  - Chip-style phone number display with × remove button
  - "Load all sessions" button — auto-populates all session phone numbers for the current tenant
- Message composer with character counter
- Optional image/media attachment:
  - URL input field
  - Live image preview below the field
  - Preview auto-hides if URL is invalid or empty
- Send button with loading spinner
- Success/error toast feedback
- Keyboard shortcut: `Escape` to close

**API call:**
```javascript
POST /api/broadcast
{
  tenant_id: "tenant_a",
  message: "🎉 Our new sofa collection is here!",
  phone_numbers: ["+919440639183", "+919032665144"],
  media_url: "https://images.unsplash.com/...",
  media_type: "image"
}
```

---

## 🎨 Design System

All design tokens and base components are in `src/index.css`.

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

/* Neutral Slate — backgrounds, text */
slate-50 / slate-100 / slate-200 / slate-400 / slate-600 / slate-800
```

### Component Classes

```css
/* Buttons */
.btn-primary   → brand blue filled, hover darkens
.btn-secondary → white with border, hover light gray

/* Inputs */
.input         → rounded border, focus ring brand blue

/* Chat Bubbles */
.bubble-bot    → blue gradient (right-aligned)
.bubble-user   → white with border (left-aligned)

/* Status Badges */
.badge         → base pill style
.badge-info    → blue (Active)
.badge-warning → amber (Processing)
.badge-danger  → red (Needs Human)
.badge-neutral → gray (Closed)

/* Live indicator */
.dot-live      → pulsing green dot animation

/* Skeletons */
.skeleton      → shimmer loading animation

/* Animations */
.animate-fade-in   → fade in from opacity 0
.animate-fade-up   → fade in + slide up
```

### Typography

- **Font:** `Inter` (Google Fonts) — clean, modern sans-serif
- **Sizes:** xs (10-11px) for metadata, sm (13-14px) for content, base for headings

---

## 🔌 API Client

`src/api.js` — Axios instance with base URL configuration.

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
})

// Available functions:
getTenants()                          // GET /api/tenants
getSessions(tenantId)                 // GET /api/sessions?tenant_id=xxx
getMessages(sessionId)                // GET /api/messages?session_id=xxx
sendBroadcast(payload)                // POST /api/broadcast
```

---

## 🔍 Features Deep-Dive

### Correct Timestamp Display

MongoDB stores all dates as UTC with no timezone suffix (e.g. `"2026-06-22T04:37:00"`). Without correction, JavaScript interprets this as local time in Chrome but as UTC in Firefox — inconsistent across browsers.

**Fix — `toUTC()` helper:**
```javascript
function toUTC(ts) {
  if (!ts) return new Date(NaN)
  const s = String(ts)
  // If already has Z or +HH:MM, parse as-is
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s)
  // Otherwise, append Z to force UTC interpretation
  return new Date(s + 'Z')
}
```

Also fixed in backend: `_serialize()` in `dashboard.py` now always appends `Z` to all datetime fields before JSON serialization.

**Result:**
- `04:37` (UTC raw, wrong) → `10:07 AM` (IST, correct)

### Smart Scroll Behavior

Problem: Every time new messages arrived via polling, the chat would scroll to the bottom — even if the user was reading old messages halfway up.

**Solution:**
```javascript
const isNearBottom = () => {
  const el = scrollRef.current
  return el.scrollHeight - el.scrollTop - el.clientHeight < 150
}

// On new messages:
if (isNearBottom()) {
  scrollToBottom()        // near bottom → auto-scroll
} else {
  setHasNewMsg(true)      // scrolled up → show badge
}
```

### Real-time Polling Architecture

| Component | Poll interval | Why |
|---|---|---|
| `TenantSwitcher` (stats) | 10 seconds | Stats don't need sub-second freshness |
| `ChatMonitor` (sessions) | 5 seconds | New sessions appear within 5s |
| `ChatThread` (messages) | 3 seconds | Feels near-real-time for active chats |

No WebSockets needed — polling keeps it simple and stateless.

---

## 📦 Building for Production

```bash
# Build optimized bundle
npm run build
# Output: dist/

# Serve locally to test build
npm run preview

# Docker build
docker build -t whatsapp-frontend .
docker run -p 3000:80 whatsapp-frontend
```

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

The frontend is served as a static bundle via Nginx — zero Node.js runtime in production.

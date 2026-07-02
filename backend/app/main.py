"""
FastAPI Application Entry Point
Registers all routers, startup/shutdown lifecycle hooks,
CORS configuration, and health check endpoint.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.connection import connect_db, close_db
from app.whatsapp.webhook import router as webhook_router
from app.api.dashboard import router as dashboard_router
from app.twilio.webhook import router as twilio_router  # Twilio channel
from app.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App Instance ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Multi-Tenant WhatsApp Orchestrator",
    description=(
        "Agentic WhatsApp SaaS platform supporting multiple tenants "
        "with LangGraph-powered AI responses and Meta Cloud API integration."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Allow React frontend (running on :5173 in dev) to call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Lifecycle Events ─────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Connect to MongoDB when the server starts."""
    # Clear the settings cache so fresh .env values are always loaded on restart.
    get_settings.cache_clear()
    logger.info("Starting Multi-Tenant WhatsApp Orchestrator...")
    await connect_db()
    logger.info("Server ready.")


@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully close MongoDB connection on shutdown."""
    await close_db()
    logger.info("👋 Server shutting down.")


# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(webhook_router)          # /api/webhooks/whatsapp  (Meta — unchanged)
app.include_router(twilio_router, prefix="/api")  # /api/webhooks/twilio   (Twilio channel)
app.include_router(dashboard_router)        # /api/tenants, /api/sessions, /api/messages


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Simple health check endpoint used by cloud platforms and load balancers."""
    return {"status": "healthy", "service": "whatsapp-orchestrator"}


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API info."""
    return {
        "message": "Multi-Tenant WhatsApp Orchestrator API",
        "docs": "/docs",
        "health": "/health",
    }


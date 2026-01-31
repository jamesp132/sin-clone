"""AgentHub — Multi-agent AI system powered by Claude."""

import logging
import os

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from config import LOG_LEVEL
from db.database import init_db
from orchestrator.manager import AgentManager
from api.routes import router, set_manager as set_routes_manager
from api.websocket import websocket_endpoint, set_manager as set_ws_manager

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("agenthub")

# ── Application ───────────────────────────────────────────────────────────────

manager: AgentManager | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    global manager

    # Startup
    logger.info("Initializing AgentHub...")
    await init_db()

    manager = AgentManager()
    set_routes_manager(manager)
    set_ws_manager(manager)

    logger.info("AgentHub ready — %d agents online", len(manager.agents))
    yield

    # Shutdown
    logger.info("Shutting down AgentHub...")
    if manager:
        for ws in list(manager.websocket_connections):
            try:
                await ws.close()
            except Exception:
                pass
        manager.websocket_connections.clear()
    logger.info("AgentHub stopped")


app = FastAPI(
    title="AgentHub",
    description="Self-hosted multi-agent AI system powered by Claude",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(router)


@app.websocket("/ws")
async def ws_route(websocket: WebSocket):
    await websocket_endpoint(websocket)


# Also expose health at root /health for Docker healthcheck
@app.get("/health")
async def root_health():
    return {"status": "ok"}


# ── Static files (frontend build) ────────────────────────────────────────────

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

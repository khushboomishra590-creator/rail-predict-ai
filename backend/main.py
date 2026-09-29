from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.config import settings
from backend.routes import eta, trains, disruptions

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    docs_url=None,      # disable default — we mount a custom one below
    redoc_url="/redoc",
    swagger_ui_oauth2_redirect_url="/docs/oauth2-redirect",
)

# ---------------------------------------------------------------------------
# CORS — explicit allowed origins
# Wildcard ("*") cannot be used together with allow_credentials=True —
# browsers reject that combination. List every real origin explicitly.
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    # Vercel production
    "https://rail-predict-ai.vercel.app",
    # Allow any *.vercel.app preview deployments
    "https://rail-predict-ai-*.vercel.app",
    # Local development
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://rail-predict-ai.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Ngrok browser-warning bypass — adds the skip header to every response
# so Swagger UI's internal fetch for openapi.json also bypasses the warning
# ---------------------------------------------------------------------------
class NgrokSkipWarningMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response

app.add_middleware(NgrokSkipWarningMiddleware)

# ---------------------------------------------------------------------------
# Custom /docs — serves Swagger UI with bundled assets (no external CDN)
# This fixes the blank/error page when accessing via ngrok on the free plan
# ---------------------------------------------------------------------------
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=settings.APP_TITLE + " — Swagger UI",
        swagger_js_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
    )

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(trains.router)
app.include_router(eta.router)
app.include_router(disruptions.router)


# ---------------------------------------------------------------------------
# Startup — run Alembic migrations + idempotent seed on every boot.
# This replaces the Render "Pre-Deploy Command" (paid feature).
# Both operations are fully idempotent:
#   - alembic upgrade head   → no-op if schema is current
#   - seed()                 → skips existing records by unique key
# ---------------------------------------------------------------------------
@app.on_event("startup")
def run_migrations_and_seed() -> None:
    import logging
    log = logging.getLogger("startup")

    # ── 1. Alembic migrations ─────────────────────────────────────────────
    try:
        from pathlib import Path
        from alembic.config import Config
        from alembic import command as alembic_command

        alembic_cfg = Config(str(Path(__file__).resolve().parent / "alembic.ini"))
        # Override script_location so it resolves correctly regardless of cwd
        alembic_cfg.set_main_option(
            "script_location",
            str(Path(__file__).resolve().parent / "alembic"),
        )
        alembic_command.upgrade(alembic_cfg, "head")
        log.info("Alembic upgrade head: complete")
    except Exception as exc:
        log.error(f"Alembic migration failed: {exc}")

    # ── 2. Seed reference data ────────────────────────────────────────────
    try:
        import sys
        from pathlib import Path as _Path
        # Ensure repo root is on sys.path (needed when cwd is backend/)
        _root = str(_Path(__file__).resolve().parent.parent)
        if _root not in sys.path:
            sys.path.insert(0, _root)

        from backend.seed_trains import seed
        seed()
        log.info("Seed: complete")
    except Exception as exc:
        log.error(f"Seed failed: {exc}")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": settings.APP_VERSION}

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
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": settings.APP_VERSION}

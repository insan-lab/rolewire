"""Rolewire API entrypoint.

Route groups (§5):
* ``/v1/public/*`` — unauthenticated, rate-limited, CORS wide open (embedded on tenant domains)
* ``/v1/admin/*`` — JWT-authenticated, CORS locked to the admin panel origin
* ``/v1/webhooks/*`` — provider webhooks, authenticated by signature
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.db import dispose_engine
from app.core.redis_client import close_redis, redis_health
from app.routers import (
    admin_auth,
    admin_billing,
    admin_jobs,
    admin_oauth,
    admin_storage,
    public,
    webhooks,
)
from app.services.queue import close_pool

logger = logging.getLogger("rolewire")


class PublicCORSMiddleware(BaseHTTPMiddleware):
    """Wide-open CORS for ``/v1/public/*`` only.

    Businesses embed the public endpoints on arbitrary custom career-page domains, so those
    responses must allow any origin (§12). Admin routes stay restricted to the panel's origin,
    which the separate CORSMiddleware below enforces.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        is_public = request.url.path.startswith("/v1/public")
        if is_public and request.method == "OPTIONS":
            return JSONResponse(
                {},
                status_code=status.HTTP_204_NO_CONTENT,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": request.headers.get(
                        "access-control-request-headers", "content-type"
                    ),
                    "Access-Control-Max-Age": "600",
                },
            )
        response = await call_next(request)
        if is_public:
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Vary"] = "Origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    logger.info("rolewire api starting (environment=%s)", settings.environment)
    yield
    await close_pool()
    await close_redis()
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    docs_enabled = settings.expose_docs and not settings.is_prod

    app = FastAPI(
        title="Rolewire API",
        version="0.1.0",
        description="Headless job-posting and application-collection API.",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    # Admin origin lock first (innermost), public wildcard applied on the way out.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.admin_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["authorization", "content-type"],
    )
    app.add_middleware(PublicCORSMiddleware)

    app.include_router(public.router)
    app.include_router(admin_auth.router)
    app.include_router(admin_oauth.router)
    app.include_router(admin_jobs.router)
    app.include_router(admin_storage.router)
    app.include_router(admin_billing.router)
    app.include_router(webhooks.router)

    @app.get("/health", tags=["ops"], summary="Liveness probe")
    async def health() -> dict[str, object]:
        return {"status": "ok", "environment": settings.environment}

    @app.get("/health/ready", tags=["ops"], summary="Readiness probe (checks Redis)")
    async def ready() -> dict[str, object]:
        cache = await redis_health()
        return {"status": "ok" if cache["ok"] else "degraded", "redis": cache}

    return app


app = create_app()

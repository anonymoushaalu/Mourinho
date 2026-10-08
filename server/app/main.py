"""Application factory and composition root.

`create_app()` rather than a module-level singleton: tests can build an app with
overridden settings, and nothing is constructed as an import side effect.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import limiter
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.request_size import RequestSizeMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # Acquire pools/clients here; release after the yield. Lifespan is the
        # only place where startup failure reliably stops the process.
        yield

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        lifespan=lifespan,
        docs_url=settings.docs_url,
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.state.limiter = limiter

    # Middleware is LIFO: registered last runs first and wraps everything
    # registered before it -- including that earlier middleware's own
    # short-circuited responses, not just normal route responses.
    #
    # RequestSizeMiddleware can reject a request directly, without ever
    # calling `call_next()` -- confirmed (via a failing test, not assumed)
    # that when it's registered *outside* CORSMiddleware, CORS never runs for
    # that rejection at all, and a real cross-origin browser request gets a
    # response with no Access-Control-Allow-Origin header, which the browser
    # then blocks before the frontend ever sees the clean 413 body. So
    # RequestSizeMiddleware is registered first (innermost): CORS needs to be
    # able to wrap its short-circuited responses, same as it wraps a route's.
    #
    # RequestIdMiddleware is registered last (outermost) so a request id
    # exists before anything else -- including CORS and RequestSizeMiddleware
    # -- can log or build an error body.
    app.add_middleware(RequestSizeMiddleware)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
            expose_headers=["X-Request-ID"],
        )
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()

"""Test fixtures.

The app is built per-test-session from explicit settings, so tests never read
the developer's local `.env` and never depend on machine state.
"""

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Environment, Settings
from app.core.rate_limit import limiter
from app.main import create_app


@pytest.fixture(scope="session")
def settings() -> Settings:
    return Settings(
        environment=Environment.LOCAL,
        secret_key="test-secret-key-that-is-long-enough-000000",
        cors_origins=[],
    )


@pytest.fixture(scope="session")
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> None:
    """`app.core.rate_limit.limiter` is a module-level singleton, shared by
    the single, session-scoped `app` every test in the suite runs against --
    without this, request counts from one test's calls would carry over and
    spuriously rate-limit a later, unrelated test hitting the same endpoint
    from the same test-client "IP". Runs before every test, not just the
    rate-limit-specific ones, since any test calling a limited endpoint
    enough times could otherwise trip it by accident.
    """
    limiter.reset()

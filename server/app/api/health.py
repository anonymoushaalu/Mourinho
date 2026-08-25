"""Liveness endpoint.

Deliberately unversioned and outside the v1 prefix: orchestrator probes are
infrastructure, not part of the client-facing API contract.
"""

from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health(settings: SettingsDep) -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.version,
        environment=settings.environment.value,
    )

"""Aggregate router for API v1.

Versioning at the URL prefix lets v2 ship alongside v1 instead of breaking
existing clients. Feature routers are included here and nowhere else, so the
surface of a version is readable in one file.
"""

from fastapi import APIRouter

api_router = APIRouter()

# Feature routers are registered here as they are built, e.g.:
# from app.api.v1.routes import users
# api_router.include_router(users.router, prefix="/users", tags=["users"])

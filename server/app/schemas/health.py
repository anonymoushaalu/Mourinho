from typing import Literal

from app.schemas.base import Schema


class HealthResponse(Schema):
    status: Literal["ok"]
    version: str
    environment: str

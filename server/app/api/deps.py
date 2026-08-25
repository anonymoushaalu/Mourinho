"""Shared FastAPI dependencies.

Routes depend on these aliases rather than importing concrete objects, which is
what makes the wiring swappable in tests via `app.dependency_overrides`.
"""

from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings

SettingsDep = Annotated[Settings, Depends(get_settings)]

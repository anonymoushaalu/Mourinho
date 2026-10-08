"""Uniform error surface.

Clients get one predictable JSON shape for every failure and a stable `code`
they can branch on. Unhandled exceptions are logged in full server-side but
never leaked to the caller — tracebacks disclose paths and library versions.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.context import request_id_var

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for expected, client-facing failures."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"

    def __init__(self, message: str, details: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limit"


class LLMServiceError(AppError):
    status_code = status.HTTP_502_BAD_GATEWAY
    code = "llm_error"


class InvalidAudioError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_audio"


class TranscriptionServiceError(AppError):
    status_code = status.HTTP_502_BAD_GATEWAY
    code = "transcription_error"


class SpeechServiceError(AppError):
    status_code = status.HTTP_502_BAD_GATEWAY
    code = "speech_error"


class SpeechNotConfiguredError(AppError):
    """Distinct from SpeechServiceError: this is a deploy/config gap, not an
    upstream API failure -- the caller can't fix it by retrying or rephrasing."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "speech_not_configured"


class PayloadTooLargeError(AppError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    code = "payload_too_large"


def _body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "code": code,
        "message": message,
        "requestId": request_id_var.get(),
    }
    if details is not None:
        payload["details"] = details
    return payload


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_body("validation_error", "Request validation failed", exc.errors()),
        )

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_exceeded(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        # Same code ("rate_limit") Groq's own 429s already use (RateLimitedError,
        # raised from the route layer when Groq itself rate-limits us) -- the
        # frontend needs no new handling for this; a client can't tell, and
        # shouldn't need to, whether it was our limit or Groq's.
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content=_body(
                "rate_limit", "Too many requests. Please slow down and try again shortly."
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_body("internal_error", "An unexpected error occurred"),
        )

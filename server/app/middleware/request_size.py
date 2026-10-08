"""Request-size protection.

Rejects requests whose *declared* Content-Length exceeds a generous ceiling
before any body is read or parsed -- the fastest possible rejection, and a
backstop ahead of each route's own finer-grained validation (e.g.
`/voice/transcribe`'s 25MB audio cap, `ChatCompletionRequest`'s field-level
`max_length`). Checking the header costs nothing: HTTP headers arrive before
the body, so this never buffers an oversized payload just to reject it.

Known gap: a client that omits Content-Length and streams a large chunked
body instead bypasses this specific check. The slower, route-level checks
still catch it after the fact, since they operate on the bytes actually
read. Closing that gap fully means wrapping the ASGI `receive` callable to
cap bytes mid-stream -- disproportionate for a portfolio chatbot's threat
model; this header check handles the overwhelming majority of real abuse
and every honest client.

Builds the error response directly rather than raising `PayloadTooLargeError`
and letting `register_exception_handlers`'s normal `AppError` handler catch
it: confirmed (via a failing test, not assumed) that `BaseHTTPMiddleware`
wraps an exception raised directly from `dispatch()` -- as opposed to one
propagating up through `call_next()` from a route, which works fine -- in an
`ExceptionGroup` via Starlette's anyio `TaskGroup` machinery. FastAPI's
handler matching doesn't unwrap that group, so the exception fell through to
the generic 500 handler instead of the registered `AppError` one. Reusing
`_body()` directly keeps this response byte-for-byte the same shape the
normal exception-handler path would have produced.
"""

import logging
from collections.abc import Awaitable, Callable

from starlette import status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.errors import PayloadTooLargeError, _body

logger = logging.getLogger(__name__)

# Comfortably above the largest legitimate payload in this app
# (/voice/transcribe's 25MB audio cap), plus headroom for multipart
# boundary/header overhead on that same upload.
MAX_CONTENT_LENGTH = 26 * 1024 * 1024


class RequestSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                declared_size = int(content_length)
            except ValueError:
                declared_size = None  # malformed header -- let routing/parsing reject it
            if declared_size is not None and declared_size > MAX_CONTENT_LENGTH:
                # Path and declared size only -- there's nothing else to log
                # even if we wanted to: the body is never read.
                logger.warning(
                    "Rejected oversized request to %s (%d bytes, limit %d)",
                    request.url.path,
                    declared_size,
                    MAX_CONTENT_LENGTH,
                )
                message = (
                    f"Request body is too large ({declared_size} bytes). "
                    f"Maximum is {MAX_CONTENT_LENGTH} bytes."
                )
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content=_body(PayloadTooLargeError.code, message),
                )
        return await call_next(request)

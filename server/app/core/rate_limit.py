"""Per-IP rate limiting for the Groq-backed endpoints.

One `Limiter` instance, shared across the app, with in-memory storage --
no Redis or other external store needed, consistent with this app having
no database. The one real limitation of in-memory storage: it's
per-process. A single-process deployment (the normal case for an app this
size) gets exactly the limits below; running N worker processes/replicas
multiplies the *effective* limit by N, since each process counts
independently. Worth knowing before scaling out, not a reason to add
Redis now -- the same "add it when it's actually needed" call this
project already makes elsewhere (see ADR 0001).
"""

from fastapi import Request
from slowapi import Limiter


def get_client_ip(request: Request) -> str:
    """Per-IP rate-limit key.

    Trusts the first hop of `X-Forwarded-For` over the raw ASGI connection.
    Deployed behind a reverse proxy (Render, Railway, Fly, nginx, etc. --
    the normal case), `request.client.host` is always the proxy's own
    address, which would put every visitor in one shared bucket and make
    the limit meaningless. This trusts the header at face value: correct
    for a single reverse proxy in front of the app, but a client that can
    reach the origin directly could spoof it to dodge the limit. A
    deliberately proportionate trade-off for conservative abuse protection
    on a public portfolio chatbot, not a defense against a targeted,
    sophisticated attacker.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_client_ip)

# Named constants, not environment variables: slowapi's `@limiter.limit(...)`
# decorator reads its value once at import time, so making these dynamically
# env-configurable would need re-plumbing per request rather than per
# deploy -- disproportionate for a portfolio chatbot's rate limits. Tuning
# one of these is a one-line code change, same as MAX_AUDIO_BYTES in
# routes/voice.py.
#
# Chat: a real conversation sends a handful of messages per minute; 10
# comfortably covers normal use while bounding abuse.
CHAT_RATE_LIMIT = "10/minute"
# Transcription: recording and uploading audio is a heavier, more
# deliberate action than typing -- fewer legitimate calls/minute expected.
TRANSCRIBE_RATE_LIMIT = "6/minute"
# Speech output: triggered automatically at most once per completed chat
# reply (see GafferWidget's speak-trigger effect), so its natural call rate
# never exceeds chat's -- kept at the same limit for that reason.
SPEAK_RATE_LIMIT = "10/minute"

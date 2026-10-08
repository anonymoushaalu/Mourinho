"""Tests for cross-cutting API hardening: per-IP rate limiting and
request-size protection on the three Groq-backed public endpoints
(/chat/complete, /voice/transcribe, /voice/speak).
"""

from collections.abc import AsyncIterator
from typing import NoReturn

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.routes import chat as chat_routes
from app.api.v1.routes import voice as voice_routes
from app.core.config import Environment, Settings, get_settings
from app.core.rate_limit import CHAT_RATE_LIMIT, SPEAK_RATE_LIMIT, TRANSCRIBE_RATE_LIMIT
from app.main import create_app
from app.middleware.request_size import MAX_CONTENT_LENGTH
from app.services import llm_service, voice_service


def _limit_count(limit_str: str) -> int:
    """Extract the request count from a slowapi limit string, e.g. "10/minute" -> 10."""
    return int(limit_str.split("/")[0])


class _FakeLLMProvider(llm_service.LLMProvider):
    async def stream_response(self, system_prompt: str, user_message: str) -> NoReturn:
        raise NotImplementedError
        yield  # pragma: no cover

    async def complete(self, system_prompt: str, messages: list[dict[str, str]]) -> str:
        return "A reply."


class _FakeVoiceProvider(voice_service.VoiceProvider):
    async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        return "transcribed text"


class _FakeSpeechProvider(voice_service.SpeechProvider):
    async def synthesize(self, text: str) -> bytes:
        return b"fake-audio-bytes"


@pytest.fixture(autouse=True)
def _fake_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    """None of these tests care what Groq actually returns -- only how many
    requests get through before the limiter/size check intervenes."""
    monkeypatch.setattr(chat_routes, "get_llm_provider", lambda settings: _FakeLLMProvider())
    monkeypatch.setattr(voice_routes, "get_voice_provider", lambda settings: _FakeVoiceProvider())
    monkeypatch.setattr(voice_routes, "get_speech_provider", lambda settings: _FakeSpeechProvider())


@pytest.fixture
def tts_configured(app: FastAPI, settings: Settings) -> AsyncIterator[None]:
    """Same pattern as test_voice_speak.py -- route-level `Depends(get_settings)`
    doesn't see the session-scoped `settings` fixture, so `/voice/speak` tests
    need an explicit override to get past the "not configured" check."""
    configured = settings.model_copy(update={"groq_tts_voice": "test-voice"})
    app.dependency_overrides[get_settings] = lambda: configured
    yield
    app.dependency_overrides.pop(get_settings, None)


# --------------------------------------------------------------- rate limiting ---


async def test_chat_complete_rate_limited(client: AsyncClient) -> None:
    limit = _limit_count(CHAT_RATE_LIMIT)
    body = {"content": "Hello"}

    for _ in range(limit):
        response = await client.post("/api/v1/chat/complete", json=body)
        assert response.status_code == 200

    response = await client.post("/api/v1/chat/complete", json=body)
    assert response.status_code == 429
    assert response.json()["code"] == "rate_limit"


async def test_transcribe_rate_limited(client: AsyncClient) -> None:
    limit = _limit_count(TRANSCRIBE_RATE_LIMIT)
    files = {"audio": ("recording.webm", b"fake-audio-bytes", "audio/webm")}

    for _ in range(limit):
        response = await client.post("/api/v1/voice/transcribe", files=files)
        assert response.status_code == 200

    response = await client.post("/api/v1/voice/transcribe", files=files)
    assert response.status_code == 429
    assert response.json()["code"] == "rate_limit"


async def test_speak_rate_limited(client: AsyncClient, tts_configured: None) -> None:
    limit = _limit_count(SPEAK_RATE_LIMIT)
    body = {"text": "Hello"}

    for _ in range(limit):
        response = await client.post("/api/v1/voice/speak", json=body)
        assert response.status_code == 200

    response = await client.post("/api/v1/voice/speak", json=body)
    assert response.status_code == 429
    assert response.json()["code"] == "rate_limit"


async def test_chat_and_transcribe_limits_are_independent(client: AsyncClient) -> None:
    """Different endpoints, different buckets -- exhausting one doesn't
    affect the other, confirming the limit is scoped per-route, not global
    per-IP across the whole API."""
    for _ in range(_limit_count(CHAT_RATE_LIMIT)):
        assert (
            await client.post("/api/v1/chat/complete", json={"content": "Hi"})
        ).status_code == 200
    assert (await client.post("/api/v1/chat/complete", json={"content": "Hi"})).status_code == 429

    files = {"audio": ("recording.webm", b"fake-audio-bytes", "audio/webm")}
    response = await client.post("/api/v1/voice/transcribe", files=files)
    assert response.status_code == 200


async def test_rate_limit_is_per_ip(client: AsyncClient) -> None:
    """Different X-Forwarded-For values get independent limit buckets --
    confirms the key is genuinely per-IP, not shared across all callers."""
    limit = _limit_count(CHAT_RATE_LIMIT)
    body = {"content": "Hello"}

    for _ in range(limit):
        response = await client.post(
            "/api/v1/chat/complete", json=body, headers={"X-Forwarded-For": "1.1.1.1"}
        )
        assert response.status_code == 200

    exhausted = await client.post(
        "/api/v1/chat/complete", json=body, headers={"X-Forwarded-For": "1.1.1.1"}
    )
    assert exhausted.status_code == 429

    fresh = await client.post(
        "/api/v1/chat/complete", json=body, headers={"X-Forwarded-For": "2.2.2.2"}
    )
    assert fresh.status_code == 200


async def test_rate_limit_uses_first_forwarded_for_hop(client: AsyncClient) -> None:
    """A proxy chain's *first* address is the real client -- downstream hops
    changing (e.g. a different internal load balancer) must not reset the
    bucket for the same real visitor."""
    limit = _limit_count(CHAT_RATE_LIMIT)
    body = {"content": "Hello"}

    for _ in range(limit):
        response = await client.post(
            "/api/v1/chat/complete",
            json=body,
            headers={"X-Forwarded-For": "3.3.3.3, 10.0.0.1, 10.0.0.2"},
        )
        assert response.status_code == 200

    response = await client.post(
        "/api/v1/chat/complete",
        json=body,
        headers={"X-Forwarded-For": "3.3.3.3, 10.0.0.9"},
    )
    assert response.status_code == 429


async def test_rate_limit_error_never_exposes_secrets(client: AsyncClient) -> None:
    for _ in range(_limit_count(CHAT_RATE_LIMIT)):
        await client.post("/api/v1/chat/complete", json={"content": "Hi"})

    response = await client.post("/api/v1/chat/complete", json={"content": "Hi"})

    assert response.status_code == 429
    assert b"gsk_" not in response.content
    assert b"test-secret-key" not in response.content


# ------------------------------------------------------------ request size ---


async def test_oversized_chat_body_rejected_before_parsing(client: AsyncClient) -> None:
    """A declared Content-Length over the global ceiling is rejected before
    any parsing -- distinct from ChatCompletionRequest's own field-level
    max_length (2000 chars), which only fires after the body is read."""
    oversized_text = "x" * (MAX_CONTENT_LENGTH + 1024)
    response = await client.post("/api/v1/chat/complete", json={"content": oversized_text})

    assert response.status_code == 413
    assert response.json()["code"] == "payload_too_large"


async def test_oversized_speak_body_rejected_before_parsing(client: AsyncClient) -> None:
    oversized_text = "x" * (MAX_CONTENT_LENGTH + 1024)
    response = await client.post("/api/v1/voice/speak", json={"text": oversized_text})

    assert response.status_code == 413
    assert response.json()["code"] == "payload_too_large"


async def test_audio_over_global_ceiling_rejected_by_middleware(client: AsyncClient) -> None:
    """A file over the *global* 26MB ceiling is caught by the new
    size-protection middleware, before the route's own 25MB check ever runs."""
    oversized_audio = b"x" * (MAX_CONTENT_LENGTH + 1024)
    files = {"audio": ("recording.webm", oversized_audio, "audio/webm")}
    response = await client.post("/api/v1/voice/transcribe", files=files)

    assert response.status_code == 413
    assert response.json()["code"] == "payload_too_large"


async def test_audio_between_route_and_global_limits_still_rejected_by_route(
    client: AsyncClient,
) -> None:
    """A file over the route's own 25MB cap but under the global 26MB
    ceiling must still be rejected by the route's existing, more precise
    check -- confirms the new global middleware didn't replace it, only
    added a coarser backstop in front of it."""
    just_over_route_limit = b"x" * (voice_routes.MAX_AUDIO_BYTES + 1)
    files = {"audio": ("recording.webm", just_over_route_limit, "audio/webm")}
    response = await client.post("/api/v1/voice/transcribe", files=files)

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_audio"


async def test_request_size_error_never_exposes_secrets(client: AsyncClient) -> None:
    oversized_text = "x" * (MAX_CONTENT_LENGTH + 1024)
    response = await client.post("/api/v1/chat/complete", json={"content": oversized_text})

    assert response.status_code == 413
    assert b"gsk_" not in response.content


# ----------------------------------------------------- CORS + error interplay ---


async def test_size_rejection_still_gets_cors_headers() -> None:
    """Regression test for a real bug found while building this: with
    RequestSizeMiddleware registered *outside* CORSMiddleware, a short-
    circuited rejection (returned directly from middleware, never reaching
    `call_next()`) skipped CORS entirely -- the response had no
    Access-Control-Allow-Origin header at all. A real cross-origin browser
    would have the response blocked by its own CORS enforcement before the
    frontend ever saw the clean 413 body underneath. Needs its own
    CORS-enabled app; the shared `client`/`app` fixtures use `cors_origins=[]`.
    """
    settings = Settings(
        environment=Environment.LOCAL,
        secret_key="test-secret-key-that-is-long-enough-000000",
        cors_origins=["https://example-frontend.com"],
        groq_api_key="gsk_fake_key_for_this_test_only",
    )
    app = create_app(settings)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        oversized_text = "x" * (MAX_CONTENT_LENGTH + 1024)
        response = await client.post(
            "/api/v1/chat/complete",
            json={"content": oversized_text},
            headers={"Origin": "https://example-frontend.com"},
        )

        assert response.status_code == 413
        assert response.headers["access-control-allow-origin"] == "https://example-frontend.com"
        assert response.json()["code"] == "payload_too_large"
    assert b"test-secret-key" not in response.content

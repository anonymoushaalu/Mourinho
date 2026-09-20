"""Tests for the POST /api/v1/voice/speak endpoint."""

from collections.abc import Iterator

import httpx
import pytest
from fastapi import FastAPI
from groq import APIError, BadRequestError, RateLimitError
from httpx import AsyncClient

from app.api.v1.routes import voice as voice_routes
from app.core.config import Settings, get_settings
from app.services import voice_service


class _FakeSpeechProvider(voice_service.SpeechProvider):
    """Stands in for GroqSpeechProvider so tests never call the real Groq API."""

    def __init__(self, audio: bytes = b"fake-mp3-bytes") -> None:
        self._audio = audio

    async def synthesize(self, text: str) -> bytes:
        return self._audio


@pytest.fixture(autouse=True)
def _fake_speech_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Same pitfall as `test_voice.py`/`test_chat_complete.py`: patch where
    `get_speech_provider` is looked up (`voice_routes`), not where it's
    defined (`voice_service`) -- a `from ... import` binds a separate name.
    """
    monkeypatch.setattr(voice_routes, "get_speech_provider", lambda settings: _FakeSpeechProvider())


@pytest.fixture
def tts_configured(app: FastAPI, settings: Settings) -> Iterator[None]:
    """Overrides `get_settings` so `groq_tts_voice` is set for tests that need
    to get past the "not configured" check and reach the (mocked) provider.

    Route-level `Depends(get_settings)` calls the real, env-file-backed
    `get_settings()` -- the session-scoped `settings` fixture only configures
    `create_app()`'s own startup logic, not what routes see via `Depends`
    (a pre-existing `conftest.py` characteristic, unrelated to this feature).
    `dependency_overrides` is the standard FastAPI mechanism for this and is
    scoped to this fixture's tests only.
    """
    configured = settings.model_copy(update={"groq_tts_voice": "test-voice"})
    app.dependency_overrides[get_settings] = lambda: configured
    yield
    app.dependency_overrides.pop(get_settings, None)


async def test_speak_returns_audio(client: AsyncClient, tts_configured: None) -> None:
    response = await client.post("/api/v1/voice/speak", json={"text": "Hello there."})

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"fake-mp3-bytes"


async def test_speak_rejects_empty_text(client: AsyncClient, tts_configured: None) -> None:
    response = await client.post("/api/v1/voice/speak", json={"text": ""})

    assert response.status_code == 422


async def test_speak_rejects_missing_text(client: AsyncClient, tts_configured: None) -> None:
    response = await client.post("/api/v1/voice/speak", json={})

    assert response.status_code == 422


async def test_speak_rejects_oversized_text(client: AsyncClient, tts_configured: None) -> None:
    response = await client.post("/api/v1/voice/speak", json={"text": "x" * 2001})

    assert response.status_code == 422


async def test_speak_returns_not_configured_without_voice(client: AsyncClient) -> None:
    """No `tts_configured` override here -- `groq_tts_voice` defaults to None."""
    response = await client.post("/api/v1/voice/speak", json={"text": "Hello."})

    assert response.status_code == 503
    assert response.json()["code"] == "speech_not_configured"


async def test_speak_handles_rate_limit(
    client: AsyncClient, tts_configured: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _RateLimitedProvider(voice_service.SpeechProvider):
        async def synthesize(self, text: str) -> bytes:
            fake_response = httpx.Response(
                status_code=429,
                request=httpx.Request("POST", "https://api.groq.com/v1/audio/speech"),
            )
            raise RateLimitError("Rate limit exceeded", response=fake_response, body=None)

    monkeypatch.setattr(
        voice_routes, "get_speech_provider", lambda settings: _RateLimitedProvider()
    )

    response = await client.post("/api/v1/voice/speak", json={"text": "Hello."})

    assert response.status_code == 429
    assert response.json()["code"] == "rate_limit"


async def test_speak_handles_groq_bad_request(
    client: AsyncClient, tts_configured: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _RejectingProvider(voice_service.SpeechProvider):
        async def synthesize(self, text: str) -> bytes:
            fake_response = httpx.Response(
                status_code=400,
                request=httpx.Request("POST", "https://api.groq.com/v1/audio/speech"),
            )
            raise BadRequestError("Invalid voice", response=fake_response, body=None)

    monkeypatch.setattr(voice_routes, "get_speech_provider", lambda settings: _RejectingProvider())

    response = await client.post("/api/v1/voice/speak", json={"text": "Hello."})

    assert response.status_code == 502
    assert response.json()["code"] == "speech_error"


async def test_speak_handles_upstream_api_error(
    client: AsyncClient, tts_configured: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _FailingProvider(voice_service.SpeechProvider):
        async def synthesize(self, text: str) -> bytes:
            fake_request = httpx.Request("POST", "https://api.groq.com/v1/audio/speech")
            raise APIError("Upstream failure", fake_request, body=None)

    monkeypatch.setattr(voice_routes, "get_speech_provider", lambda settings: _FailingProvider())

    response = await client.post("/api/v1/voice/speak", json={"text": "Hello."})

    assert response.status_code == 502
    assert response.json()["code"] == "speech_error"


async def test_speak_handles_empty_audio_returned(
    client: AsyncClient, tts_configured: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        voice_routes, "get_speech_provider", lambda settings: _FakeSpeechProvider(audio=b"")
    )

    response = await client.post("/api/v1/voice/speak", json={"text": "Hello."})

    assert response.status_code == 502
    assert response.json()["code"] == "speech_error"


async def test_speak_never_exposes_api_key(client: AsyncClient, tts_configured: None) -> None:
    response = await client.post("/api/v1/voice/speak", json={"text": "Hello."})

    assert b"gsk_" not in response.content
    assert b"test-secret-key" not in response.content


async def test_existing_endpoints_untouched_by_speak(client: AsyncClient) -> None:
    """Sanity check that adding /voice/speak didn't disturb the other routes."""
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/chat" in paths
    assert "/api/v1/chat/complete" in paths
    assert "/api/v1/voice/transcribe" in paths
    assert "/api/v1/voice/speak" in paths

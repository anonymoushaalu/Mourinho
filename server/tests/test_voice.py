"""Tests for the POST /api/v1/voice/transcribe endpoint."""

import httpx
import pytest
from groq import APIError, BadRequestError, RateLimitError
from httpx import AsyncClient

from app.api.v1.routes import voice as voice_routes
from app.services import voice_service


class _FakeProvider(voice_service.VoiceProvider):
    """Stands in for GroqVoiceProvider so tests never call the real Groq API."""

    def __init__(self, text: str = "Who is Jabez?") -> None:
        self._text = text

    async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        return self._text


@pytest.fixture(autouse=True)
def _fake_voice_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every test in this module gets a fake Groq provider unless overridden.

    Patched on `voice_routes` (where `get_voice_provider` is looked up), not
    on `voice_service` (where it's defined) -- `voice.py`'s `from ... import
    get_voice_provider` binds a separate name in the route module's
    namespace, so patching the origin module would miss it. Same pitfall
    documented in `test_chat_complete.py`.
    """
    monkeypatch.setattr(voice_routes, "get_voice_provider", lambda settings: _FakeProvider())


def _audio_file(
    content: bytes = b"fake-webm-bytes",
    content_type: str = "audio/webm",
    filename: str = "recording.webm",
) -> dict[str, tuple[str, bytes, str]]:
    return {"audio": (filename, content, content_type)}


async def test_transcribe_returns_text(client: AsyncClient) -> None:
    response = await client.post("/api/v1/voice/transcribe", files=_audio_file())

    assert response.status_code == 200
    assert response.json()["text"] == "Who is Jabez?"


async def test_transcribe_accepts_ogg(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/voice/transcribe",
        files=_audio_file(content_type="audio/ogg", filename="recording.ogg"),
    )

    assert response.status_code == 200


async def test_transcribe_accepts_content_type_with_codec_param(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/voice/transcribe", files=_audio_file(content_type="audio/webm;codecs=opus")
    )

    assert response.status_code == 200


async def test_transcribe_rejects_unsupported_content_type(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/voice/transcribe",
        files=_audio_file(content_type="text/plain", filename="notes.txt"),
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_audio"


async def test_transcribe_rejects_empty_file(client: AsyncClient) -> None:
    response = await client.post("/api/v1/voice/transcribe", files=_audio_file(content=b""))

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_audio"


async def test_transcribe_rejects_oversized_file(client: AsyncClient) -> None:
    oversized = b"x" * (voice_routes.MAX_AUDIO_BYTES + 1)

    response = await client.post("/api/v1/voice/transcribe", files=_audio_file(content=oversized))

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_audio"


async def test_transcribe_requires_audio_field(client: AsyncClient) -> None:
    response = await client.post("/api/v1/voice/transcribe", files={})

    assert response.status_code == 422


async def test_transcribe_handles_rate_limit(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _RateLimitedProvider(voice_service.VoiceProvider):
        async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
            fake_response = httpx.Response(
                status_code=429,
                request=httpx.Request("POST", "https://api.groq.com/v1/audio/transcriptions"),
            )
            raise RateLimitError("Rate limit exceeded", response=fake_response, body=None)

    monkeypatch.setattr(voice_routes, "get_voice_provider", lambda settings: _RateLimitedProvider())

    response = await client.post("/api/v1/voice/transcribe", files=_audio_file())

    assert response.status_code == 429
    assert response.json()["code"] == "rate_limit"


async def test_transcribe_handles_groq_bad_request(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Groq itself rejecting the audio (e.g. corrupt/garbage bytes) maps to invalid_audio,
    not a 502.
    """

    class _RejectingProvider(voice_service.VoiceProvider):
        async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
            fake_response = httpx.Response(
                status_code=400,
                request=httpx.Request("POST", "https://api.groq.com/v1/audio/transcriptions"),
            )
            raise BadRequestError("Invalid audio file", response=fake_response, body=None)

    monkeypatch.setattr(voice_routes, "get_voice_provider", lambda settings: _RejectingProvider())

    response = await client.post("/api/v1/voice/transcribe", files=_audio_file())

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_audio"


async def test_transcribe_handles_upstream_api_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _FailingProvider(voice_service.VoiceProvider):
        async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
            fake_request = httpx.Request("POST", "https://api.groq.com/v1/audio/transcriptions")
            raise APIError("Upstream failure", fake_request, body=None)

    monkeypatch.setattr(voice_routes, "get_voice_provider", lambda settings: _FailingProvider())

    response = await client.post("/api/v1/voice/transcribe", files=_audio_file())

    assert response.status_code == 502
    assert response.json()["code"] == "transcription_error"


async def test_transcribe_handles_no_speech_detected(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        voice_routes, "get_voice_provider", lambda settings: _FakeProvider(text="   ")
    )

    response = await client.post("/api/v1/voice/transcribe", files=_audio_file())

    assert response.status_code == 502
    assert response.json()["code"] == "transcription_error"


async def test_transcribe_never_exposes_api_key(client: AsyncClient) -> None:
    response = await client.post("/api/v1/voice/transcribe", files=_audio_file())

    assert "gsk_" not in response.text
    assert "test-secret-key" not in response.text


async def test_existing_chat_endpoints_untouched(client: AsyncClient) -> None:
    """Sanity check that adding voice.py didn't disturb the existing chat routes."""
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/chat" in paths
    assert "/api/v1/chat/complete" in paths
    assert "/api/v1/voice/transcribe" in paths

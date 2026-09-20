"""Voice transcription provider abstraction.

Mirrors `llm_service.py`'s `LLMProvider` pattern: the rest of the application
depends on the `VoiceProvider` interface, not a specific speech-to-text
implementation, so the provider can be swapped without touching routing or
error handling.
"""

import logging
from abc import ABC, abstractmethod

from groq import Groq

from app.core.config import Settings

logger = logging.getLogger(__name__)


class VoiceProvider(ABC):
    """Abstract speech-to-text provider."""

    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        """Transcribe recorded audio to text.

        Args:
            audio_bytes: The raw audio file contents.
            filename: Original filename, passed through as a hint to the
                upstream API (some providers use the extension).
            content_type: The audio's MIME type, e.g. "audio/webm".

        Returns:
            The transcribed text.

        Raises:
            Provider-specific errors on failure.
        """
        ...


class GroqVoiceProvider(VoiceProvider):
    """Groq API implementation using Whisper speech-to-text."""

    def __init__(self, api_key: str, model: str = "whisper-large-v3-turbo") -> None:
        self.client = Groq(api_key=api_key)
        self.model = model

    async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        """Transcribe audio via Groq's Whisper endpoint.

        Same thread-pool-offload pattern as `GroqProvider` in `llm_service.py`:
        the Groq SDK call is synchronous, so it runs off the async event loop.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        def _call_groq_sync() -> str:
            transcription = self.client.audio.transcriptions.create(
                model=self.model,
                file=(filename, audio_bytes, content_type),
                response_format="json",
            )
            return transcription.text

        try:
            loop = asyncio.get_event_loop()
            executor = ThreadPoolExecutor(max_workers=1)
            return await loop.run_in_executor(executor, _call_groq_sync)
        except Exception:
            logger.exception("Groq API error during transcription")
            raise


def get_voice_provider(settings: Settings) -> VoiceProvider:
    """Factory: build the configured voice provider."""
    return GroqVoiceProvider(
        api_key=settings.groq_api_key,
        model=settings.groq_whisper_model,
    )

"""Voice provider abstractions: speech-to-text (`VoiceProvider`) and
text-to-speech (`SpeechProvider`).

Both mirror `llm_service.py`'s `LLMProvider` pattern: the rest of the
application depends on the interface, not a specific implementation, so a
provider can be swapped without touching routing or error handling. Kept as
two separate interfaces, not one merged abstraction -- STT and TTS are
genuinely different capabilities that happen to share a domain (voice) and an
upstream vendor (Groq), not one capability with two methods.
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


class SpeechProvider(ABC):
    """Abstract text-to-speech provider."""

    @abstractmethod
    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech audio from text.

        Args:
            text: The text to speak.

        Returns:
            Raw audio bytes (MP3-encoded).

        Raises:
            Provider-specific errors on failure.
        """
        ...


class GroqSpeechProvider(SpeechProvider):
    """Groq API implementation using Orpheus text-to-speech.

    Not PlayAI: `playai-tts` was decommissioned server-side (confirmed via a
    live call, 2026-09-20) despite the installed SDK's type hints still
    listing it as valid. `canopylabs/orpheus-v1-english` is its replacement.
    """

    def __init__(self, api_key: str, model: str, voice: str) -> None:
        self.client = Groq(api_key=api_key)
        self.model = model
        self.voice = voice

    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech via Groq's TTS endpoint.

        Same thread-pool-offload pattern as the other providers in this file.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        def _call_groq_sync() -> bytes:
            response = self.client.audio.speech.create(
                model=self.model,
                voice=self.voice,
                input=text,
                response_format="mp3",
            )
            return response.read()

        try:
            loop = asyncio.get_event_loop()
            executor = ThreadPoolExecutor(max_workers=1)
            return await loop.run_in_executor(executor, _call_groq_sync)
        except Exception:
            logger.exception("Groq API error during speech synthesis")
            raise


def get_speech_provider(settings: Settings) -> SpeechProvider:
    """Factory: build the configured speech provider.

    Raises:
        ValueError: if `groq_tts_voice` isn't configured. The route layer is
            expected to check this first and raise the HTTP-aware
            `SpeechNotConfiguredError` before ever calling this factory --
            this only fires as a defensive fallback if that check is skipped.
    """
    if not settings.groq_tts_voice:
        raise ValueError("groq_tts_voice is not configured")
    return GroqSpeechProvider(
        api_key=settings.groq_api_key,
        model=settings.groq_tts_model,
        voice=settings.groq_tts_voice,
    )

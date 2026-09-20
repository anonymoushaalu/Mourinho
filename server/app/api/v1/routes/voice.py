"""The Gaffer voice endpoint — speech-to-text via Groq Whisper.

Text-to-speech is deliberately out of scope here; see the voice service's
`VoiceProvider` interface for where it would extend to.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from groq import APIError, BadRequestError, RateLimitError

from app.core.config import Settings, get_settings
from app.core.errors import InvalidAudioError, RateLimitedError, TranscriptionServiceError
from app.schemas.voice import TranscribeResponse
from app.services.voice_service import get_voice_provider

logger = logging.getLogger(__name__)
router = APIRouter()

# Matches Groq's documented audio upload limit.
MAX_AUDIO_BYTES = 25 * 1024 * 1024

# MIME types MediaRecorder (and common file uploads) actually produce, that
# Groq's Whisper endpoint accepts. Matched against the type only -- any
# `;codecs=...` parameter is stripped before comparison.
ALLOWED_CONTENT_TYPES = frozenset(
    {
        "audio/webm",
        "audio/ogg",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/mp4",
        "audio/mpeg",
        "audio/mp3",
        "audio/flac",
        "audio/m4a",
        "audio/x-m4a",
    }
)


@router.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: Annotated[UploadFile, File(description="Recorded audio to transcribe.")],
    settings: Settings = Depends(get_settings),
) -> TranscribeResponse:
    """Transcribe a visitor's recorded audio to text.

    Request: multipart/form-data with an `audio` file field.
    Response: { "text": "..." }
    """
    content_type = (audio.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidAudioError(
            f"Unsupported audio type '{content_type or 'unknown'}'. "
            f"Supported types: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}."
        )

    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise InvalidAudioError("Uploaded audio file is empty.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise InvalidAudioError(
            f"Audio file too large ({len(audio_bytes)} bytes). Maximum is {MAX_AUDIO_BYTES} bytes."
        )

    voice_provider = get_voice_provider(settings)
    filename = audio.filename or "recording.webm"

    try:
        text = await voice_provider.transcribe(audio_bytes, filename, content_type)
    except RateLimitError as exc:
        logger.warning("Rate limited by Groq API during transcription")
        raise RateLimitedError(
            "I'm temporarily unavailable. Please try again in a little while."
        ) from exc
    except BadRequestError as exc:
        logger.warning("Groq rejected the uploaded audio as invalid")
        raise InvalidAudioError(
            "The audio file could not be processed. Try recording again."
        ) from exc
    except APIError as exc:
        logger.exception("Groq API error during transcription")
        raise TranscriptionServiceError(
            "The Gaffer couldn't understand that recording. Please try again."
        ) from exc

    if not text.strip():
        raise TranscriptionServiceError(
            "No speech was detected in the recording. Please try again."
        )

    return TranscribeResponse(text=text.strip())

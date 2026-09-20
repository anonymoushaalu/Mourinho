"""Voice transcription and speech synthesis schemas."""

from pydantic import Field

from app.schemas.base import Schema


class TranscribeResponse(Schema):
    """The transcribed text from a visitor's recorded audio."""

    text: str


class SpeakRequest(Schema):
    """Text for The Gaffer to speak aloud.

    `max_length` is a defensive client-side cap (matches `ChatRequest.content`'s
    existing limit) -- the actual upstream Orpheus/Groq limit is unverified as
    of this writing; Groq's own validation is the final word regardless.
    """

    text: str = Field(..., min_length=1, max_length=2000)

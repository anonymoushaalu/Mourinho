"""Voice transcription response schema."""

from app.schemas.base import Schema


class TranscribeResponse(Schema):
    """The transcribed text from a visitor's recorded audio."""

    text: str

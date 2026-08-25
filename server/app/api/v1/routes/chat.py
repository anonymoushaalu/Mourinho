"""The Gaffer chat endpoint — knowledge-grounded AI responses with streaming."""

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from groq import APIError, RateLimitError

from app.core.config import Settings, get_settings
from app.schemas.chat import ChatRequest, ChatDone, ChatError
from app.services.knowledge_service import get_gaffer_system_prompt
from app.services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)
router = APIRouter()


async def generate_stream(
    user_message: str, settings: Settings
) -> Any:
    """Generate streaming response events for a visitor's question.

    Yields NDJSON (newline-delimited JSON) matching the frontend's
    ChatStreamEvent discriminated union shape.
    """
    system_prompt = get_gaffer_system_prompt()
    llm_provider = get_llm_provider(settings)
    message_id = str(uuid.uuid4())

    try:
        async for text_chunk in llm_provider.stream_response(system_prompt, user_message):
            # Yield each text chunk as a { type: 'chunk', delta: '...' } line
            yield json.dumps(
                {"type": "chunk", "delta": text_chunk},
                separators=(",", ":"),
            ).encode() + b"\n"

        # End-of-response marker
        yield json.dumps(
            {"type": "done", "message_id": message_id},
            separators=(",", ":"),
        ).encode() + b"\n"

    except RateLimitError:
        logger.warning("Rate limited by Groq API")
        error_event: dict[str, Any] = {
            "type": "error",
            "error": {
                "code": "rate_limit",
                "message": "I'm temporarily unavailable. Please try again in a little while.",
            },
        }
        yield json.dumps(error_event, separators=(",", ":")).encode() + b"\n"
    except APIError as e:
        logger.exception("Groq API error during streaming")
        error_event: dict[str, Any] = {
            "type": "error",
            "error": {
                "code": "llm_error",
                "message": "The Gaffer encountered an error while thinking. Please try again.",
            },
        }
        yield json.dumps(error_event, separators=(",", ":")).encode() + b"\n"
    except Exception as e:
        logger.exception("Unexpected error during chat streaming")
        error_event: dict[str, Any] = {
            "type": "error",
            "error": {
                "code": "internal_error",
                "message": "Something went wrong. Please try again.",
            },
        }
        yield json.dumps(error_event, separators=(",", ":")).encode() + b"\n"


@router.post("/chat")
async def chat(
    request: ChatRequest, settings: Settings = Depends(get_settings)
) -> StreamingResponse:
    """Stream The Gaffer's response to a visitor's question.

    Request body: { "content": "Who is Jabez?" }

    Response: NDJSON stream where each line is a ChatStreamEvent:
    - { type: "chunk", delta: "..." }
    - { type: "done", message_id: "..." }
    - { type: "error", error: { code: "...", message: "..." } }

    The response ends with a "done" event. The frontend collects chunks and
    renders them incrementally, preserving the avatar state flow
    (idle → listening → thinking → speaking → complete → idle).
    """
    if not request.content.strip():
        raise HTTPException(
            status_code=400, detail="Message content cannot be empty"
        )

    return StreamingResponse(
        generate_stream(request.content, settings),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
        },
    )

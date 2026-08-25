"""LLM provider abstraction.

The rest of the application depends on the LLMProvider interface, not a specific
LLM implementation. This allows swapping providers (Groq, Gemini, Claude, etc.)
without touching routing, knowledge grounding, or error handling.
"""

import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from groq import Groq

from app.core.config import Settings

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract LLM provider."""

    @abstractmethod
    async def stream_response(
        self, system_prompt: str, user_message: str
    ) -> AsyncIterator[str]:
        """Stream a response token-by-token.

        Args:
            system_prompt: System instructions for the model.
            user_message: The user's question.

        Yields:
            Text chunks, one per yield.

        Raises:
            Provider-specific errors on failure.
        """
        ...


class GroqProvider(LLMProvider):
    """Groq API implementation using Chat Completions with streaming."""

    def __init__(self, api_key: str, model: str = "openai/gpt-oss-120b") -> None:
        self.client = Groq(api_key=api_key)
        self.model = model

    async def stream_response(
        self, system_prompt: str, user_message: str
    ) -> AsyncIterator[str]:
        """Stream a response from Groq.

        Groq's Python SDK is synchronous, so we run it in a thread pool.
        This keeps the FastAPI async event loop unblocked.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        def _call_groq_sync() -> AsyncIterator[str]:
            """Synchronous call to Groq API with streaming."""
            # Create the message list with system prompt and user message
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ]

            # Stream response from Groq
            with self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=1,
                max_completion_tokens=2048,
                top_p=1,
                reasoning_effort="medium",
                stream=True,
            ) as stream:
                for chunk in stream:
                    # Groq returns choice deltas; extract content
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content

        try:
            # Run the blocking Groq call in a thread pool to avoid blocking async loop
            loop = asyncio.get_event_loop()
            executor = ThreadPoolExecutor(max_workers=1)

            # The _call_groq_sync function returns an iterator, so we need to
            # get all chunks from it and yield them
            def _collect_groq_chunks() -> list[str]:
                chunks = []
                for chunk in _call_groq_sync():
                    chunks.append(chunk)
                return chunks

            chunks = await loop.run_in_executor(executor, _collect_groq_chunks)

            # Yield each chunk to the caller
            for chunk in chunks:
                yield chunk

        except Exception as e:
            logger.exception("Groq API error during response generation")
            # Let the caller handle this
            raise


def get_llm_provider(settings: Settings) -> LLMProvider:
    """Factory: build the configured LLM provider."""
    return GroqProvider(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
    )

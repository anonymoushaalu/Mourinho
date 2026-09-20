"""LLM provider abstraction.

The rest of the application depends on the LLMProvider interface, not a specific
LLM implementation. This allows swapping providers (Groq, Gemini, Claude, etc.)
without touching routing, knowledge grounding, or error handling.
"""

import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Iterable
from typing import cast

from groq import Groq
from groq.types.chat import ChatCompletionMessageParam

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

    @abstractmethod
    async def complete(self, system_prompt: str, messages: list[dict[str, str]]) -> str:
        """Return a single, non-streaming completion over a full message history.

        Args:
            system_prompt: System instructions for the model.
            messages: Prior conversation turns plus the latest one, each a
                plain `{"role": ..., "content": ...}` dict -- the service
                layer stays free of HTTP/wire schema types, per the project's
                layering rule.

        Returns:
            The assistant's reply text.

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

    async def complete(self, system_prompt: str, messages: list[dict[str, str]]) -> str:
        """Return a single, non-streaming completion from Groq.

        Same thread-pool-offload pattern as `stream_response`: the Groq SDK
        call is synchronous, so it runs off the async event loop.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        def _call_groq_sync() -> str:
            full_messages: list[dict[str, str]] = [
                {"role": "system", "content": system_prompt},
                *messages,
            ]

            response = self.client.chat.completions.create(
                model=self.model,
                # The SDK's overloads expect its own ChatCompletionMessageParam
                # union, not a plain dict -- the runtime shape is identical
                # (role/content keys), so this is a type-only cast, no
                # behavior change.
                messages=cast(Iterable[ChatCompletionMessageParam], full_messages),
                temperature=1,
                max_completion_tokens=2048,
                top_p=1,
                reasoning_effort="medium",
                stream=False,
            )

            if not response.choices:
                return ""
            return response.choices[0].message.content or ""

        try:
            loop = asyncio.get_event_loop()
            executor = ThreadPoolExecutor(max_workers=1)
            return await loop.run_in_executor(executor, _call_groq_sync)
        except Exception:
            logger.exception("Groq API error during chat completion")
            raise


def get_llm_provider(settings: Settings) -> LLMProvider:
    """Factory: build the configured LLM provider."""
    return GroqProvider(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
    )

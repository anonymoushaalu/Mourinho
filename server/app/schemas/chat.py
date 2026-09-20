"""Chat request/response schemas matching the frontend's ChatTransport contract."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.base import Schema


class ChatRequest(BaseModel):
    """A visitor's question for The Gaffer.

    Matches the frontend's `ChatTransportMessage` shape. The backend is the
    only sender; the frontend only sends messages here, never receives them.
    """

    content: str = Field(..., min_length=1, max_length=2000)


class NavigationAction(BaseModel):
    """An action surfaced under The Gaffer's response."""

    id: str
    label: str
    kind: Literal["internal-route", "external-link", "scroll-to-section"]
    target: str


class ChatChunk(BaseModel):
    """A streamed text delta from The Gaffer."""

    type: Literal["chunk"] = "chunk"
    delta: str


class ChatNavigationActions(BaseModel):
    """Navigation actions discovered in the response."""

    type: Literal["navigation-actions"] = "navigation-actions"
    actions: list[NavigationAction]


class ChatDone(BaseModel):
    """End-of-response marker."""

    type: Literal["done"] = "done"
    message_id: str


class ChatError(BaseModel):
    """An error occurred during response generation."""

    type: Literal["error"] = "error"
    error: dict[str, str] = Field(
        ...,
        description="Error details with 'code' and 'message' keys",
    )


# Discriminated union matching the frontend's ChatStreamEvent.
ChatStreamEvent = ChatChunk | ChatNavigationActions | ChatDone | ChatError


class ConversationMessage(Schema):
    """One turn in a conversation, either from the visitor or The Gaffer.

    `system` is deliberately excluded: the system prompt is always injected
    server-side from `knowledge_service`, never client-supplied.
    """

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatCompletionRequest(Schema):
    """A visitor's message plus prior conversation turns.

    Used by the non-streaming `/chat/complete` endpoint. Unlike `ChatRequest`
    (the streaming `/chat` endpoint), this carries the full conversation so
    multi-turn context reaches the model. `history` is capped to bound both
    the request payload and the token cost of each completion.
    """

    content: str = Field(..., min_length=1, max_length=2000)
    history: list[ConversationMessage] = Field(default_factory=list, max_length=40)


class ChatCompletionResponse(Schema):
    """The Gaffer's reply to a `ChatCompletionRequest`."""

    message: ConversationMessage
    message_id: str

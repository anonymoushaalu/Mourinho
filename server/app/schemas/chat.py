"""Chat request/response schemas matching the frontend's ChatTransport contract."""

from typing import Literal

from pydantic import BaseModel, Field


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

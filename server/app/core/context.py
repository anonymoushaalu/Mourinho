"""Per-request ambient state.

A ContextVar is the only safe way to carry request-scoped data through async
call stacks: each task gets its own copy, so concurrent requests cannot read
each other's values.
"""

from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="")

"""Base model for every wire schema.

Python is snake_case, JSON on the wire is camelCase. Doing that conversion once,
here, means neither side has to write translation code — and `populate_by_name`
keeps snake_case construction working in Python and in tests.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Schema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",  # unknown fields are rejected, not silently dropped
    )

"""Business logic.

Services know nothing about HTTP: no Request, no HTTPException, no status codes.
That boundary is what lets the same logic be reused from a worker or CLI, and
keeps route handlers thin enough to read at a glance.
"""

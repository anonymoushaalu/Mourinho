"""Data access.

The only layer that talks to a database or external store. Services depend on
these through interfaces, so the storage choice can change without touching
business logic.
"""

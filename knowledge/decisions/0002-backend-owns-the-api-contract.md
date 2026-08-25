# 0002 — The backend owns the API contract

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

Client and server both need to agree on request and response shapes. Kept
independently, the two drift, and the drift is only discovered at runtime in
production.

## Decision

Pydantic models in `server/app/schemas/` are the single source of truth. FastAPI
derives an OpenAPI document from them, and `npm run gen:api` turns that document
into TypeScript in `shared/src/generated/`. Generated files are never edited.

`shared/src/` also holds a small hand-written layer for things OpenAPI cannot
express: branded ID types, cross-cutting constants, and the error envelope.

Alternatives rejected:

- **Hand-written types on both sides** — no mechanism prevents drift.
- **Schema-first (OpenAPI YAML → both)** — an extra artefact to maintain, and it
  loses Pydantic's runtime validation, which is the actual enforcement point.

## Consequences

- Changing a response shape is a backend change; the client fails to compile
  until it is updated. That is the desired failure mode.
- Type generation requires a running backend, so it is a developer step, not a
  build step. CI verifies the checked-in output is current.

# Architecture

## Shape

A monorepo with three packages and one direction of dependency:

```
knowledge/  ──(informs)──▶  server/  ──(OpenAPI)──▶  shared/  ──▶  client/
```

`shared/` never imports from `client/` or `server/`. `client/` never imports
from `server/`. Enforced by lint rules and by `shared/` having no dependencies.

## Client layers

| Layer                  | Responsibility                                        |
| ---------------------- | ----------------------------------------------------- |
| `src/app/`             | Shell, providers, error boundary. Global wiring only. |
| `src/features/<name>/` | A vertical slice: UI, hooks, data access, types.      |
| `src/components/`      | Presentational primitives with no domain knowledge.   |
| `src/lib/`             | Cross-cutting utilities — the API client lives here.  |
| `src/config/`          | Validated environment access.                         |

Features are vertical, not horizontal. Grouping by technical kind
(`components/`, `hooks/`, `services/`) makes every change touch every folder;
grouping by feature keeps a change local and makes deletion trivial. A lint rule
blocks feature-to-feature imports, so slices stay independent.

## Server layers

| Layer               | Responsibility                                       |
| ------------------- | ---------------------------------------------------- |
| `app/api/`          | HTTP only: routing, status codes, dependency wiring. |
| `app/schemas/`      | Pydantic wire models. The contract.                  |
| `app/services/`     | Business logic. No HTTP types.                       |
| `app/repositories/` | Data access. The only layer that touches storage.    |
| `app/core/`         | Config, logging, errors, context.                    |
| `app/middleware/`   | Cross-cutting request handling.                      |

The dependency direction is `api → services → repositories`, never backwards.
Because services are HTTP-free, the same logic can be driven from a worker,
a scheduled job, or a CLI without refactoring.

## Cross-cutting decisions

**Application factory.** `create_app(settings)` builds the app rather than a
module-level singleton, so tests construct an isolated instance with explicit
settings and nothing is created as an import side effect.

**Fail-fast configuration.** Settings are validated at startup. A missing
`SECRET_KEY` or an unknown env key stops the process. A container that will not
start is a far cheaper failure than one serving traffic misconfigured.

**Request correlation.** Every request carries an `X-Request-ID`, in logs and in
error bodies. A user-reported failure maps to a log line without guesswork.

**Uniform errors.** One JSON shape for every failure with a stable `code` field.
Clients branch on `code`, never on `message`. Unhandled exceptions log fully but
return a generic body — tracebacks leak paths and versions.

**camelCase on the wire.** The Pydantic base model converts automatically, so
Python stays idiomatic and TypeScript stays idiomatic and no one writes mapping
code.

**Dev proxy over CORS.** Vite proxies `/api` to the backend, so dev requests are
same-origin. CORS is configured for real deployments only, with an explicit
origin allow-list; wildcards are rejected by a validator.

## What Phase 1 deliberately omits

Database, auth, and containerisation are absent because each has a real choice
attached and picking now would be guessing. The `repositories/` and `services/`
seams exist so those choices slot in without restructuring.

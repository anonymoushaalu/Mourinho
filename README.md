# Mourinho

Monorepo: React + Vite client, FastAPI server, shared type contract.

## Layout

```
client/      React + Vite + TypeScript SPA
server/      FastAPI application
shared/      Type contract shared by both runtimes (no runtime deps)
knowledge/   Domain notes and architecture decision records
docs/        Operational and contributor documentation
```

## Requirements

- Node 20+
- Python 3.11–3.14 (3.15 is beta and has no wheels for `pydantic-core`)

## Setup

```bash
# Frontend + shared (npm workspaces; run from the repo root)
npm install
cp client/.env.example client/.env.local

# Backend — use the launcher to pick a supported interpreter
cd server
py -3.13 -m venv .venv && .venv/Scripts/activate   # POSIX: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env    # then replace SECRET_KEY
```

## Running

```bash
# Terminal 1 — API on :8000
cd server && uvicorn app.main:app --reload

# Terminal 2 — client on :5173 (proxies /api to :8000)
npm run dev
```

## Checks

| Command                     | Scope                          |
| --------------------------- | ------------------------------ |
| `npm run lint`              | ESLint, type-aware             |
| `npm run typecheck`         | TypeScript, strict             |
| `npm run format`            | Prettier, write                |
| `cd server && ruff check .` | Lint + import order + security |
| `cd server && mypy app`     | Types, strict                  |
| `cd server && pytest`       | Tests                          |

## Regenerating API types

With the backend running:

```bash
npm run gen:api
```

Writes `shared/src/generated/api.ts` from the live OpenAPI document. See
[ADR 0002](knowledge/decisions/0002-backend-owns-the-api-contract.md).

## Documentation

- [Architecture](docs/architecture.md) — layers, boundaries, and why they exist
- [Environment configuration](docs/environment.md)
- [Knowledge base](knowledge/README.md)

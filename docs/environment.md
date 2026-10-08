# Environment configuration

## Principles

1. **Config comes from the environment**, never from committed files. `.env` is
   a local-development convenience only; staging and production inject values
   from the platform's secret store.
2. **`.env.example` is committed and complete.** It lists every variable with a
   safe placeholder, so a new machine is set up by copying it.
3. **Validated at boot.** Both runtimes validate on startup and crash on a bad
   or missing value rather than failing later at an arbitrary call site.
4. **Unknown keys are errors.** `extra="forbid"` catches typos in deploy
   manifests, which otherwise fail silently.

## Client — `client/.env.local`

Vite only exposes `VITE_`-prefixed variables, and it **inlines them into the
bundle at build time**. Anything here is public. There are no client secrets.

| Variable                    | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `VITE_API_BASE_URL`         | API origin. Empty in dev so calls stay same-origin. |
| `VITE_DEV_API_PROXY_TARGET` | Where the dev server forwards `/api`.               |

Because values are baked in at build time, each environment needs its own build.

## Server — `server/.env`

| Variable        | Purpose                                                        |
| --------------- | --------------------------------------------------------------- |
| `ENVIRONMENT`   | `local` \| `staging` \| `production`. Gates `/docs`.            |
| `LOG_LEVEL`     | Root log level.                                                 |
| `SECRET_KEY`    | Signing key, min 32 chars. No default — must be supplied.       |
| `CORS_ORIGINS`  | JSON array of allowed origins. `*` is rejected. **This is where the production frontend's URL goes** once it has one — never hardcoded in source; empty by default (no CORS middleware registered at all, not "permissive") until set. |
| `GROQ_API_KEY`  | Groq API key for chat, transcription, and speech. No default — must be supplied. Server-side only; never exposed to the client. |
| `GROQ_MODEL`    | Groq chat model id. Defaults to `openai/gpt-oss-120b`.          |
| `GROQ_WHISPER_MODEL` | Groq speech-to-text model id. Defaults to `whisper-large-v3-turbo`. |
| `GROQ_TTS_MODEL` | Groq text-to-speech model id. Defaults to `canopylabs/orpheus-v1-english`. Requires its own terms acceptance in the Groq console, separate from the API key. |
| `GROQ_TTS_VOICE` | Voice name for TTS. No default — `/voice/speak` returns a clear error until set; chat and voice input work without it. See `server/.env.example` for the console link and docs page. |

Generate a key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Get a free Groq API key at https://console.groq.com/

## Rate limiting and request-size protection

`/api/v1/chat/complete`, `/api/v1/voice/transcribe`, and `/api/v1/voice/speak`
are rate-limited per IP (named constants in `app/core/rate_limit.py`, not
environment variables — tuning one is a one-line code change, the same as
`MAX_AUDIO_BYTES` in `app/api/v1/routes/voice.py`). Per-IP keying trusts the
first hop of `X-Forwarded-For` over the raw connection, which only works
correctly behind a reverse proxy that sets that header (Render, Railway, Fly,
nginx, etc. all do by default). A request whose declared `Content-Length`
exceeds 26MB is rejected before any parsing, app-wide.

Both use in-memory state — no Redis or other store needed, matching "no
database" — with one real limitation: it's per-process. Running multiple
worker processes or replicas multiplies the *effective* limit by however many
there are, since each counts independently. Fine for a single-process
deployment (the normal case here); worth knowing before scaling out.

## Adding a variable

1. Add the field to `Settings` (server) or `ImportMetaEnv` (client) — typed, and
   with no default if it is a secret.
2. Add it to the matching `.env.example` with a placeholder and a comment.
3. Add it to the table above.
4. Add it to the deployment platform before merging.

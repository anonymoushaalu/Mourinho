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
| `CORS_ORIGINS`  | JSON array of allowed origins. `*` is rejected.                 |
| `GROQ_API_KEY`  | Groq API key for The Gaffer's chat and voice transcription. No default — must be supplied. Server-side only; never exposed to the client. |
| `GROQ_MODEL`    | Groq chat model id. Defaults to `openai/gpt-oss-120b`.          |
| `GROQ_WHISPER_MODEL` | Groq speech-to-text model id. Defaults to `whisper-large-v3-turbo`. |

Generate a key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Get a free Groq API key at https://console.groq.com/

## Adding a variable

1. Add the field to `Settings` (server) or `ImportMetaEnv` (client) — typed, and
   with no default if it is a secret.
2. Add it to the matching `.env.example` with a placeholder and a comment.
3. Add it to the table above.
4. Add it to the deployment platform before merging.

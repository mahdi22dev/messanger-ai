# AGENTS.md

## Two runtimes

- **Express server** — `node server.js` / `pnpm start` (uses `nodemon`, port 3044 by default)
- **Cloudflare Worker** — `wrangler dev` / `wrangler deploy` (entry: `worker/index.mjs`)

The worker is a **stub**: AI logic, MongoDB, and most commands are not ported. The Express server is the canonical implementation.

## Environment variables

All required, stored in `.env` (also leaked in `secrets.json` — never commit either):

| Variable | Used by |
|---|---|
| `PAGE_ACCESS_TOKEN` | server + worker |
| `VERIFY_TOKEN` | server + worker (named `VERIFY_TOKEN` in server code, not `FB_VERIFY_TOKEN`) |
| `GEMINI_API_KEY` | server only |
| `TG` | server only (Together AI) |
| `HF` | server only (HuggingFace — imported but unused) |
| `MONGODB_URL` | server only |
| `PORT` | server (defaults to 3044) |

## Package manager

Use **pnpm**, not npm. The lockfile is `pnpm-lock.yaml`.

```bash
pnpm install
pnpm start        # runs nodemon server.js
```

## Architecture

```
server.js          — Express entrypoint
controllers/
  MetaVerification.js  — GET /webhook (Facebook webhook verification)
  postWebHook.js       — POST /webhook (message handling + AI dispatch)
db.js              — MongoDB client, conversation history, model config, pending states
worker/index.mjs   — Cloudflare Worker stub (WIP)
```

## Database (MongoDB)

- DB: `chatbot_db` (hardcoded in `db.js`)
- Collections: `user_contexts` (conversation history), `config` (user model preference), `conversation_states` (pending actions with TTL)
- `ensureTTLIndex()` runs on server startup — creates TTL index on `conversation_states.expiresAt`
- Connection is cached and reused via `getMongoClient()` — do not create new clients

## AI models

Three backends, per-user model preference stored in `config` collection:

| Type | API | Model |
|---|---|---|
| `deepseek` (default) | Together AI (`TG` env) | `deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free` |
| `together` | Together AI (`TG` env) | `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` |
| `gemini` | Google GenAI (`GEMINI_API_KEY`) | `gemini-2.5-pro` |

## Known issues

- `controllers/postWebHook.js` ~line 431: `messages.map(m => console.log(m))` in a log statement — `.map()` returns `[undefined, ...]` but is used for side effects only; the actual messages array is fine
- `worker/index.mjs` has malformed code: `sendMessage` defined twice, and event-handling logic (~lines 77-115) is top-level code outside any function — the Worker returns `EVENT_RECEIVED` before handling events (due to `ctx.waitUntil`)
- Secrets are committed in `secrets.json` — rotate all keys before making the repo public
- No tests, no linting, no type checking configured
- `@huggingface/inference` is a dependency but unused in the codebase
- `marked` is a dependency but its usage is unclear from the codebase (likely intended for markdown formatting)
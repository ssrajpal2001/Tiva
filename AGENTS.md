# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

StudyBuddy AI Student Tutor — a pnpm monorepo with an Express 5 API server, an Expo/React Native frontend, and shared library packages. See `replit.md` for full stack details and key commands.

### Services

| Service | Run command | Port | Notes |
|---|---|---|---|
| **API Server** | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 | Requires `DATABASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL` env vars |
| **Student Tutor (Expo web)** | `cd artifacts/student-tutor && npx expo start --web --port 19006 --non-interactive` | 19006 | Set `EXPO_PUBLIC_DOMAIN=localhost:8080` so API calls reach the backend |
| **Mockup Sandbox** | `pnpm --filter @workspace/mockup-sandbox run dev` | (needs PORT env) | Optional — UI prototyping sandbox |

### Prerequisites before starting services

1. **PostgreSQL** must be running: `pg_ctlcluster 16 main start`
2. **DB schema push**: `DATABASE_URL="postgresql://studybuddy:studybuddy@localhost:5432/studybuddy" pnpm --filter db push`
3. The API server `dev` script runs `build` then `start` (esbuild bundle, not tsc). It does NOT hot-reload — restart the tmux session after code changes.

### Environment variables

| Variable | Required by | Value for local dev |
|---|---|---|
| `DATABASE_URL` | API server, DB lib | `postgresql://studybuddy:studybuddy@localhost:5432/studybuddy` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API server (OpenAI integration) | Must be a real key for AI features; set `sk-placeholder` to start the server without AI |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | API server (OpenAI integration) | `https://api.openai.com/v1` |
| `PORT` | API server | `8080` |
| `EXPO_PUBLIC_DOMAIN` | Student Tutor frontend | `localhost:8080` (points frontend API calls to the backend) |

### Gotchas

- The `pnpm run typecheck` command has pre-existing errors in `lib/api-zod` (duplicate exports) and `lib/integrations-openai-ai-react` (missing react types). The API server builds fine via esbuild regardless.
- The Expo `dev` script in `package.json` uses Replit-specific env vars. For local dev, run Expo directly: `npx expo start --web --port 19006 --non-interactive`.
- The OpenAI client (`lib/integrations-openai-ai-server/src/client.ts`) throws at import time if `AI_INTEGRATIONS_OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_BASE_URL` are missing — the server will crash on startup without them.
- The API server does NOT hot-reload. After code changes, you must kill and restart the process.

### Testing

- **API health check**: `curl http://localhost:8080/api/healthz` → `{"status":"ok"}`
- **Typecheck**: `pnpm run typecheck` (has pre-existing errors, see above)
- **Build API server**: `pnpm --filter @workspace/api-server run build`
- No automated test suite exists in this repo.

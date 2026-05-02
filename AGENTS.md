# AGENTS.md

## TiVa — Product Context

**TiVa** (pronounced *tee-vaa*) — tagline: "No more TV, only TiVa."

TiVa is NOT a generic AI chatbot or tutoring marketplace. It is an **AI-driven learning discipline and mastery system** for K-12 and undergraduate students in India. The codebase currently uses the working name "StudyBuddy" / "AI Student Tutor" in code, but the product name is **TiVa**.

### Core philosophy

- **Discipline & mastery over content overload.** Focus on spaced repetition, weak-topic tracking, and outcome-driven learning — not just delivering more videos.
- **Humanized AI mentor.** The AI simulates a human mentor with VOIP (WhatsApp-style) calls, proactive check-ins, and a dynamic personality (Friendly / Strict / Motivational) chosen by the student.
- **Daily Mastery Coach (DMC) framework** governs AI behavior: remember mistakes, re-ask via spaced repetition, one-click diagnostics for weak areas, multi-modal input (images, PDFs, docs, audio).

### Key feature areas (target state)

| Area | Requirements |
|---|---|
| **Communication** | Real-time VOIP calls, proactive "agent" calls to students, greeting simulation |
| **Learning Tools** | Subject/mode toggle in chat, weekly/monthly/yearly tests, live classroom sync (process teacher audio/PDFs/YouTube) |
| **Teacher Tools** | Upload lectures (voice/text/PDF), broadcast messages/live links, royalty tracking |
| **School Integration** | School login to update syllabus/books, school-level subscriptions for specific students |
| **Admin Panel** | Service toggling (free vs subscription), LLM Connect for AI integrations, teacher blacklisting, performance reports to principals/HODs, profile management |
| **Economy & Gamification** | Performance-linked discounts (test score = % discount on next month), TiVa coins, bonus coins for tests, subscription + handling fee split |
| **UI/UX** | Bold headings (no markdown stars in rendered UI), humanized polished format, animation-rich TiVa logo |

### Critical constraints

- Do NOT position as a generic "content platform" or "tutoring marketplace."
- Do NOT create "content overload" — focus on discipline and mastery.
- Do NOT rely on simple rating systems as standalone value; focus on outcome-driven positioning.

---

## Cursor Cloud specific instructions

### Project overview

TiVa (codebase name: StudyBuddy / AI Student Tutor) — a pnpm monorepo with an Express 5 API server, an Expo/React Native frontend, and shared library packages. See `replit.md` for full stack details and key commands.

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

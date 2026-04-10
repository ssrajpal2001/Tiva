# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is the StudyBuddy AI Student Tutor app — a full-stack AI learning companion for K-12 and higher education students in India.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo / React Native (web + iOS + Android)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2, streaming SSE)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## App Structure

### Artifacts
- `artifacts/api-server/` — Express API server (port 8080)
- `artifacts/student-tutor/` — Expo mobile app

### API Routes (`artifacts/api-server/src/routes/`)
- `profile.ts` — GET/POST /api/profile (student profiles)
- `tutor.ts` — CRUD /api/tutor/sessions, streaming SSE chat with AI tutor
- `progress.ts` — GET /api/progress/:deviceId, POST /api/progress/:deviceId/xp
- `openai/index.ts` — Generic OpenAI conversations

### Database Tables (`lib/db/src/schema/`)
- `studentProfilesTable` — student_profiles
- `chatSessionsTable` — chat_sessions
- `chatMessagesTable` — chat_messages
- `studentProgressTable` — student_progress
- `conversations` / `messages` — generic OpenAI conversations

### Expo App Screens (`artifacts/student-tutor/app/`)
- `_layout.tsx` — Root layout with all providers
- `onboarding.tsx` — 6-step onboarding (name, grade, board, subjects, goal, language)
- `(tabs)/index.tsx` — Chat tab (subject chips, recent sessions)
- `(tabs)/modes.tsx` — Learning Modes (Ask, Homework, Exam Prep, Revision)
- `(tabs)/progress.tsx` — XP, streak, subject breakdown, badges
- `(tabs)/profile.tsx` — Profile, voice personality picker
- `chat/[sessionId].tsx` — Full chat screen with SSE streaming, image upload

### Contexts (`artifacts/student-tutor/contexts/`)
- `ProfileContext.tsx` — Student profile state (AsyncStorage backed)
- `ProgressContext.tsx` — XP, streak, badges, level (AsyncStorage backed)

## Key Features
- Subject-specific AI tutor agents (Math, Science, English, History, etc.)
- Board/syllabus-aware responses (CBSE, ICSE, State Board, IB, IGCSE)
- 4 learning modes: Ask, Homework, Exam Prep, Revision
- Real-time streaming AI responses (SSE)
- Image/camera upload for scanning textbook questions
- XP + Streak + Level gamification system
- Badge system (7 badges: First Step, On Fire, etc.)
- Dark/light mode support
- Multi-language support (English, Hindi, Hinglish)

## Colors (Indigo/Blue Palette)
- Primary: #4361ee (light) / #748fff (dark)
- Background: #f8f7ff (light) / #0f0a1e (dark)
- Accent: #f72585 (pink)

# StudyBuddy AI Student Tutor — What Was Built

> A full-stack AI-powered learning companion for K-12 and higher education students in India. Students can ask questions, get homework help, prepare for exams, and revise topics — all with a personalized AI tutor that knows their syllabus, tracks their progress, and adapts to how they learn.

---

## 📱 App Overview

| | |
|---|---|
| **App Name** | StudyBuddy AI Student Tutor |
| **Purpose** | AI-powered personal tutor for Indian students |
| **Target Users** | Class 6–12 students + Undergraduate learners across India |
| **Supported Boards** | CBSE, ICSE, State Board, IB, IGCSE |
| **Platforms** | iOS, Android, and Web |
| **Languages** | English (primary); AI responds in Hindi/Hinglish if student writes that way |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Mobile App** | Expo / React Native with Expo Router |
| **Backend API** | Express 5 + Node.js 24 |
| **Database** | PostgreSQL + Drizzle ORM |
| **AI Model** | OpenAI gpt-5.2 via Replit AI Integrations |
| **Streaming** | Server-Sent Events (SSE) with rolling buffer parser |
| **Voice Output (TTS)** | expo-speech (built-in, no API key needed) |
| **Voice Input (STT)** | expo-av (recording) + OpenAI Whisper (transcription) |
| **Image OCR** | OpenAI vision model (gpt-5.2 multimodal) |
| **Language** | TypeScript 5.9 across frontend and backend |
| **Validation** | Zod v4 + drizzle-zod |
| **API Contract** | OpenAPI spec → Orval codegen (React Query hooks + Zod schemas) |
| **Architecture** | pnpm monorepo (workspaces) |

---

## ✨ Features Built

### 1. 🎓 Onboarding (6 Steps)
A guided, multi-step onboarding flow that personalises the app for each student:

1. **Name** — student enters their name
2. **Grade** — Class 6, 7, 8, 9, 10, 11, 12, or Undergraduate
3. **Board** — CBSE, ICSE, State Board, IB, IGCSE
4. **Subjects** — multi-select from 11 subjects (Math, Science, Physics, Chemistry, Biology, English, History, Geography, Social Studies, Computer Science, Economics)
5. **Goal** — optional learning goal (e.g. "Score 90% in boards")
6. **Language** — preferred language for interaction

All data is saved locally (AsyncStorage) **and** synced to the backend database.

---

### 2. 🤖 AI Chat System

Each subject has its own AI tutor with a distinct teaching style:

| Subject | Teaching Style |
|---|---|
| **Math** | Step-by-step, shows all working, verifies answers |
| **Physics** | Abstract concepts explained with everyday analogies |
| **Chemistry** | Mnemonics, balanced equations, real-world examples |
| **Biology** | Storytelling approach, life processes as adventures |
| **English** | Grammar rules with examples, constructive feedback |
| **History** | Storytelling, causes/effects, human impact |
| **Geography** | Visual descriptions, map context, human geography |
| **Science** | First principles, real-world connections |
| **Computer Science** | Step-by-step with pseudocode and real examples |
| **Economics** | Market examples connected to daily life |

**4 Learning Modes:**
- 📚 **Ask Anything** — open Q&A, clear thorough answers
- 📝 **Homework Helper** — step-by-step guidance (teaches understanding, not just answers)
- 🎯 **Exam Prep** — concise, exam-ready answers with key points examiners look for
- 🔄 **Revision** — quick bullet-point summaries, mnemonics, scannable key facts

**Technical details:**
- Responses stream in real-time (SSE) — text appears word by word as the AI types
- Robust SSE parser with rolling buffer handles any network chunking without data loss
- Last 20 messages of chat history sent to AI for context
- Full chat history loaded from server when you re-open a session
- All chats saved permanently to the database per student device

---

### 3. 📷 Image / OCR Question Scanning

Students can photograph their textbook or homework:
- **Camera** — take a live photo of a question
- **Photo Gallery** — upload from the phone's gallery
- AI reads the image, identifies the question, and provides a full step-by-step solution
- The extracted question text is saved in chat history for future reference

---

### 4. 🎤 Voice Input (Speech-to-Text)

- Tap the **microphone button** to start recording
- Speak your question naturally
- Tap again to stop — audio is transcribed by **OpenAI Whisper**
- Transcribed text appears in the input field ready to send
- Currently transcribes in English (Whisper language set to `en`)
- (Hidden on web browser — native mobile only)

---

### 5. 🔊 Voice Output (Text-to-Speech)

- **Long-press** any AI response to have it read aloud
- Reading speed and pitch adapts to the student's chosen **voice personality**:
  - 😊 **Friendly Teacher** — warm, slower pace
  - 🏋️ **Strict Coach** — focused, measured pace
  - 🏆 **Motivational Coach** — energetic, faster pace
- A **mute button** appears in the header while reading
- Uses `expo-speech` with Indian English voice (`en-IN`)

---

### 6. 🧠 Memory & Personalisation (Weak Topic Tracking)

The app learns what each student struggles with:
- After each AI response, if the student **clearly showed confusion, made an error, or revealed a knowledge gap**, the topic is recorded in the database
- Simple factual questions that were answered correctly are **not** tracked
- The **top 5 weak topics** per subject are automatically injected into the AI's system prompt for every new session — so the tutor already knows what to reinforce
- Students can view their weak areas on the Progress screen

---

### 7. 🏆 Progress & Gamification

#### XP & Levelling
- **+10 XP** for every AI response received
- **+5 XP daily login bonus** (awarded once per day, deterministically)
- **Level** = floor(√(totalXP ÷ 100)) + 1
- Named levels: Beginner → Explorer → Learner → Student → Scholar → Thinker → Expert → Champion → Genius → Master → Legend

#### Day Streak
- Consecutive days of activity tracked
- Streak resets if a day is missed
- Computed both on daily login and on XP award

#### Time Spent
- Tracks how long each chat exchange takes (per message)
- Accumulates total time per subject and overall
- Displayed as "X min" or "Xh Ym" on the Progress screen

#### Badges (9 total)
| Badge | Requirement |
|---|---|
| 🌟 First Step | Ask your first question |
| 🎀 Getting Started | Ask 10 questions |
| 🏆 Curious Mind | Ask 50 questions |
| 🔥 On Fire | 3-day streak |
| 🥇 Weekly Warrior | 7-day streak |
| 🔖 Rising Scholar | Reach Level 5 |
| 💎 Knowledge Seeker | Reach Level 10 |
| ⏱️ Hour Scholar | Study for 60 minutes total |
| 🏫 Dedicated Learner | Study for 300 minutes total |

#### Backend as Source of Truth
- Progress is synced to the backend database
- App fetches latest progress from the server on startup
- After each chat message, progress is refreshed from server to stay in sync

---

### 8. 👤 Profile

- Displays name, grade, board, and level badge
- **Voice Personality Picker**: Friendly Teacher, Strict Coach, or Motivational Coach
  - Changes are saved locally and synced to the backend
- Quick links to re-run onboarding or edit details
- Shows total XP and level name

---

### 9. 🔒 Security

- Every API request that reads or modifies a student's session requires a `deviceId` query parameter
- The backend verifies session ownership at the database level (`WHERE id = ? AND device_id = ?`) — no student can read or delete another student's chats
- Missing `deviceId` returns HTTP 400 immediately
- `chat_messages.session_id` is a proper integer **foreign key** referencing `chat_sessions.id` with `ON DELETE CASCADE` — deleting a session automatically cleans up all its messages
- No user accounts or passwords — privacy-first design using device IDs

---

## 🔌 API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check — returns `{ status: "ok" }` |
| `GET` | `/api/profile?deviceId=` | Get a student's profile |
| `POST` | `/api/profile` | Create or update a student's profile |
| `GET` | `/api/tutor/sessions?deviceId=` | List all chat sessions for a device |
| `POST` | `/api/tutor/sessions` | Create a new chat session |
| `GET` | `/api/tutor/sessions/:id?deviceId=` | Get session with full message history |
| `DELETE` | `/api/tutor/sessions/:id?deviceId=` | Delete a session and all its messages |
| `POST` | `/api/tutor/sessions/:id/messages` | Send a message (streams SSE response) |
| `POST` | `/api/tutor/sessions/:id/image-messages` | Send an image question (streams SSE) |
| `POST` | `/api/tutor/transcribe` | Transcribe audio to text (Whisper STT) |
| `GET` | `/api/tutor/weak-topics/:deviceId` | Get weak topics for a student |
| `GET` | `/api/progress/:deviceId` | Get progress + award daily login XP |
| `POST` | `/api/progress/:deviceId/xp` | Award XP after a chat message |

---

## 🗄️ Database Tables

| Table | Purpose |
|---|---|
| `student_profiles` | Student name, grade, board, subjects, goal, language, voice personality |
| `chat_sessions` | Each chat session: device, subject, mode, title, grade, board |
| `chat_messages` | Individual messages with role (user/assistant), content, FK to session |
| `student_progress` | XP, level, streak, total time, subject breakdown, badges, last login date |
| `weak_topics` | Topics per student+subject that need extra practice, with repeat count |

---

## 📲 App Screens

| Screen | What it does |
|---|---|
| **Onboarding** (`onboarding.tsx`) | 6-step setup flow: name, grade, board, subjects, goal, language |
| **Chat Tab** (`(tabs)/index.tsx`) | Lists recent sessions; start a new subject+mode chat |
| **Modes Tab** (`(tabs)/modes.tsx`) | Visual selector for the 4 learning modes with descriptions |
| **Progress Tab** (`(tabs)/progress.tsx`) | XP stats, time spent, subject breakdown, weak areas, badge showcase |
| **Profile Tab** (`(tabs)/profile.tsx`) | Profile info display, voice personality picker |
| **Chat Screen** (`chat/[sessionId].tsx`) | Full AI chat with streaming, image upload, mic button, TTS |

---

## 🚀 How to Run

```bash
# Install dependencies
pnpm install

# Start backend API
pnpm --filter @workspace/api-server run dev

# Start Expo app
pnpm --filter @workspace/student-tutor run dev
```

**Environment:** Requires the `DATABASE_URL` environment variable and OpenAI integration via Replit AI Integrations (no API key needed when running on Replit).

---

*Built with love for students across India 🇮🇳*

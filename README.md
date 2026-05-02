# TiVa — "No more TV, only TiVa"

AI-powered curriculum-aligned educational mentor for K-12 students.

---

## Quick Start on AWS EC2 (Cloud9)

### Prerequisites (one-time setup)

Your EC2 instance needs:
- Node.js 18+ (`node -v`)
- pnpm (`npm install -g pnpm`)
- PM2 (`npm install -g pm2`)
- PostgreSQL running locally or via connection string

EC2 Security Group must allow **inbound** on:
- Port **8080** (API server)
- Port **3000** (Web frontend)

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/ssrajpal2001/Tiva ~/tiva
cd ~/tiva
```

### Step 2 — Create your `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in these values:

| Variable | Value |
|---|---|
| `PORT` | `8080` |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/tiva` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Your OpenAI key from platform.openai.com |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `EXPO_PUBLIC_API_URL` | `http://<your-elastic-ip>:8080` |

### Step 3 — Run the startup script

```bash
chmod +x start.sh
./start.sh
```

This will:
1. Install all dependencies (`pnpm install`)
2. Build all packages (`pnpm build`)
3. Run database migrations
4. Start both processes via PM2

### Step 4 — Access the app

Open in your browser:
- **Frontend:** `http://<elastic-ip>:3000`
- **API health check:** `http://<elastic-ip>:8080/api/health`

---

### Useful commands

```bash
pm2 list          # Check if tiva-api and tiva-web are online
pm2 logs          # Live logs from both processes
pm2 logs tiva-api # API server logs only
pm2 restart all   # Restart both processes
pm2 save          # Save process list to survive reboot
pm2 startup       # Auto-start on server reboot (follow instructions it prints)
```

### After a `git pull` (updating the code)

```bash
cd ~/tiva
git pull
pnpm install      # if dependencies changed
pnpm build        # rebuild packages
pm2 restart all   # restart processes
```

---

## Project Structure

```
Tiva/
├── artifacts/
│   ├── api-server/        Express API — starts on PORT (default 8080)
│   └── student-tutor/     Expo React Native web app — starts on port 3000
├── lib/
│   ├── db/                PostgreSQL schema + Drizzle ORM
│   ├── api-client-react/  API client used by the frontend
│   ├── api-spec/          OpenAPI spec
│   └── integrations-*/   OpenAI integration layer
├── .env.example           Template — copy to .env and fill in values
├── ecosystem.config.cjs   PM2 process config
└── start.sh               One-command EC2 startup script
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | API server port (default: 8080) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Yes | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Yes | OpenAI API base URL |
| `EXPO_PUBLIC_API_URL` | Yes | Full URL of the API (e.g. `http://1.2.3.4:8080`) |
| `NODE_ENV` | No | `production` or `development` |
| `ELEVENLABS_API_KEY` | Future | ElevenLabs voice cloning (not yet implemented) |

---

## Feature Roadmap

| Phase | Feature | Status |
|---|---|---|
| A | TiVa branding, logo, tagline | Pending |
| B | Admin panel with feature flags | Pending |
| C | Teacher upload portal + vector embeddings | Pending |
| D | ElevenLabs voice cloning + proactive AI calls | Pending |
| E | Coins, performance discounts, referral system | Pending |

See [`Daily_Mastery_Coach.docx`](https://github.com/ssrajpal2001/Tiva) for the full product vision.

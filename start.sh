#!/usr/bin/env bash
# TiVa — EC2 startup script
# Run once after cloning and setting up .env:
#   chmod +x start.sh && ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=============================="
echo "  TiVa — EC2 Setup & Start"
echo "=============================="
echo ""

# --- 1. Check .env exists ---
if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found."
  echo "       Run: cp .env.example .env"
  echo "       Then fill in your API keys and database URL."
  exit 1
fi

# --- 2. Install pnpm if missing ---
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

# --- 3. Install PM2 if missing ---
if ! command -v pm2 &>/dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi

# --- 4. Install dependencies ---
echo ""
echo "[1/4] Installing dependencies..."
pnpm install

# --- 5. Build all packages ---
echo ""
echo "[2/4] Building packages..."
pnpm run build

# --- 6. Run DB migrations ---
echo ""
echo "[3/4] Running database migrations..."
(cd lib/db && pnpm run push) || {
  echo "WARNING: DB migration failed. Check your DATABASE_URL in .env."
  echo "         Continuing anyway — app may not work without a database."
}

# --- 7. Start processes with PM2 ---
echo ""
echo "[4/4] Starting TiVa with PM2..."

# Install dotenv for ecosystem config
npm install --prefix . dotenv 2>/dev/null || pnpm add -w dotenv

pm2 delete tiva-api tiva-web 2>/dev/null || true
pm2 start ecosystem.config.cjs

echo ""
echo "=============================="
echo "  TiVa is running!"
echo "=============================="
echo ""

# Load .env to show the elastic IP
set -a; source .env; set +a

API_PORT="${PORT:-8080}"
echo "  API:      http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_ELASTIC_IP'):${API_PORT}/api/health"
echo "  Frontend: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_ELASTIC_IP'):3000"
echo ""
echo "  pm2 list        — check process status"
echo "  pm2 logs        — view live logs"
echo "  pm2 save        — persist after reboot"
echo "  pm2 startup     — auto-start on reboot"
echo ""

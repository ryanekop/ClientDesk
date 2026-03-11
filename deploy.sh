#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Client Desk — Deploy Script (Standalone Mode)
# ═══════════════════════════════════════════════════════════════
# Jalankan di VPS: bash deploy.sh
# ═══════════════════════════════════════════════════════════════

set -e  # Stop jika ada error

APP_DIR="/var/www/clientdesk"
APP_NAME="clientdesk"

echo "═══════════════════════════════════════════"
echo "🚀 Deploying Client Desk..."
echo "═══════════════════════════════════════════"

# 1. Pull latest code
echo ""
echo "📥 [1/5] Pulling latest code from git..."
cd "$APP_DIR"
git pull origin main

# 2. Install dependencies
echo ""
echo "📦 [2/5] Installing dependencies..."
npm ci --production=false

# 2.5 Validate .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ ERROR: .env.local not found! Create it first."
    exit 1
fi
echo "✅ .env.local found"

# 3. Build
echo ""
echo "🔨 [3/5] Building application (standalone)..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 4. Copy static files + env to standalone
echo ""
echo "📂 [4/5] Copying static files & env..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp .env.local .next/standalone/.env.local
echo "✅ .env.local copied to standalone"

# 5. Restart PM2
echo ""
echo "♻️  [5/5] Restarting PM2..."

# Cek apakah proses sudah ada di PM2
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    pm2 restart "$APP_NAME"
else
    pm2 start ecosystem.config.js
fi

pm2 save

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Deploy selesai!"
echo "═══════════════════════════════════════════"
echo ""
echo "Cek status:  pm2 status"
echo "Cek logs:    pm2 logs $APP_NAME"
echo ""

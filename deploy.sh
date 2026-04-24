#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Client Desk — Deploy Script (Standalone Mode, RAM Adaptive)
# ═══════════════════════════════════════════════════════════════
# Jalankan di VPS: bash deploy.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/clientdesk"
APP_NAME="clientdesk"
TEMP_SWAP_FILE="/swapfile-clientdesk-build"
TEMP_SWAP_ENABLED=0

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Client Desk Deploy (RAM Adaptive)"
    echo "Usage: bash deploy.sh"
    exit 0
fi

cleanup() {
    if [ "${TEMP_SWAP_ENABLED}" -eq 1 ]; then
        echo ""
        echo "🧹 Cleaning temporary swap..."
        swapoff "${TEMP_SWAP_FILE}" || true
        rm -f "${TEMP_SWAP_FILE}" || true
    fi
}
trap cleanup EXIT

echo "═══════════════════════════════════════════"
echo "🚀 Deploying Client Desk..."
echo "═══════════════════════════════════════════"

echo ""
echo "📥 [1/5] Pulling latest code from git..."
cd "${APP_DIR}"
# Deploy harus selalu mengikuti lockfile dari remote.
# Jika lockfile lokal kotor, pull bisa gagal.
if ! git diff --quiet -- package-lock.json package.json; then
    echo "⚠️  Local package lock changes detected. Restoring package files before pull..."
    git restore package-lock.json package.json 2>/dev/null || true
fi
git pull --ff-only origin main

echo ""
echo "📦 [2/5] Installing dependencies..."
npm ci --production=false

if [ ! -f .env.local ]; then
    echo "❌ ERROR: .env.local not found! Create it first."
    exit 1
fi
echo "✅ .env.local found"

TOTAL_RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
TOTAL_SWAP_MB="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)"

if [ "${TOTAL_RAM_MB}" -le 2500 ]; then
    BUILD_MB=1536
elif [ "${TOTAL_RAM_MB}" -le 4500 ]; then
    BUILD_MB=3072
else
    BUILD_MB=4096
fi

if [ "${TOTAL_RAM_MB}" -le 2500 ] && [ "${TOTAL_SWAP_MB}" -lt 5000 ]; then
    echo ""
    echo "⚙️  Low RAM host detected (${TOTAL_RAM_MB}MB). Enabling temporary swap..."
    if [ ! -f "${TEMP_SWAP_FILE}" ]; then
        fallocate -l 4G "${TEMP_SWAP_FILE}" || dd if=/dev/zero of="${TEMP_SWAP_FILE}" bs=1M count=4096
        chmod 600 "${TEMP_SWAP_FILE}"
        mkswap "${TEMP_SWAP_FILE}" >/dev/null
    fi
    swapon "${TEMP_SWAP_FILE}" || true
    TEMP_SWAP_ENABLED=1
fi

echo ""
echo "🔨 [3/5] Building application (standalone)..."
echo "ℹ️  Build memory limit: ${BUILD_MB}MB"
NODE_OPTIONS="--max-old-space-size=${BUILD_MB}" npm run build

echo ""
echo "📂 [4/5] Copying static files & env..."
mkdir -p .next/standalone/public .next/standalone/.next/static
if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete public/ .next/standalone/public/
    rsync -a --delete .next/static/ .next/standalone/.next/static/
else
    rm -rf .next/standalone/public/* .next/standalone/.next/static/*
    cp -a public/. .next/standalone/public/
    cp -a .next/static/. .next/standalone/.next/static/
fi
cp .env.local .next/standalone/.env.local
echo "✅ .env.local copied to standalone"

echo ""
echo "♻️  [5/5] Reloading PM2..."
if pm2 reload "${APP_NAME}" --update-env; then
    echo "✅ PM2 reload succeeded"
elif pm2 restart "${APP_NAME}" --update-env; then
    echo "✅ PM2 restart fallback succeeded"
else
    echo "⚠️  PM2 reload/restart failed. Starting from ecosystem.config.js..."
    pm2 start ecosystem.config.js
fi
pm2 save
pm2 describe "${APP_NAME}" > /dev/null

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Deploy selesai!"
echo "═══════════════════════════════════════════"
echo ""
echo "Cek status:  pm2 status"
echo "Cek logs:    pm2 logs ${APP_NAME}"
echo ""

#!/bin/bash
# Client Desk deploy helper for prebuilt GitHub Actions artifacts.
# Usage on VPS:
#   bash deploy.sh /tmp/clientdesk-<sha>.tar.gz <sha>

set -euo pipefail

APP_DIR="/var/www/clientdesk"
APP_NAME="clientdesk"
APP_PORT="3001"
ARTIFACT="${1:-}"
RELEASE_SHA="${2:-$(date +%Y%m%d%H%M%S)}"

if [ -z "${ARTIFACT}" ] || [ ! -f "${ARTIFACT}" ]; then
  echo "Usage: bash deploy.sh /path/to/clientdesk-artifact.tar.gz [release-sha]"
  exit 1
fi

release_dir="${APP_DIR}/releases/${RELEASE_SHA}"
previous=""
if [ -L "${APP_DIR}/current" ]; then
  previous="$(readlink -f "${APP_DIR}/current" || true)"
fi

echo "Deploying ${APP_NAME} release ${RELEASE_SHA}..."
mkdir -p "${release_dir}"
tar -xzf "${ARTIFACT}" -C "${release_dir}"

if [ -f "${APP_DIR}/.env.local" ]; then
  cp "${APP_DIR}/.env.local" "${release_dir}/.env.local"
fi

ln -sfn "${release_dir}" "${APP_DIR}/current"

pm2 startOrReload "${release_dir}/ecosystem.config.js" --update-env

sleep 3
if ! curl -fsS -I "http://127.0.0.1:${APP_PORT}" >/dev/null; then
  echo "Health check failed."
  if [ -n "${previous}" ] && [ -d "${previous}" ]; then
    echo "Rolling back to previous release..."
    ln -sfn "${previous}" "${APP_DIR}/current"
    pm2 startOrReload "${previous}/ecosystem.config.js" --update-env
  fi
  exit 1
fi

pm2 save
find "${APP_DIR}/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf
echo "Deploy complete."

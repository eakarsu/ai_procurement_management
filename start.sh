#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$project_dir/.env"
set +a

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
: "${OPENROUTER_BASE_URL:?OPENROUTER_BASE_URL is required}"
[[ "${#JWT_SECRET}" -ge 32 ]] || { echo 'JWT_SECRET must be at least 32 characters' >&2; exit 1; }
backend_port="${BACKEND_PORT:?BACKEND_PORT is required}"
frontend_port="${FRONTEND_PORT:?FRONTEND_PORT is required}"
[[ "$backend_port" != "$frontend_port" ]] || { echo 'BACKEND_PORT and FRONTEND_PORT must differ' >&2; exit 1; }
for port in "$backend_port" "$frontend_port"; do
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || { echo "port $port is already in use" >&2; exit 1; }
done

if [[ "${MIGRATE_ON_START:-false}" == "true" ]]; then
  (cd "$project_dir/backend" && npx prisma migrate deploy)
fi
export BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin
export PROVISION_ADMIN_EMAIL="${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
export PROVISION_ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
export PROVISION_ADMIN_NAME="${PROVISION_ADMIN_NAME:-Runtime Administrator}"
export PROVISION_COMPANY_NAME="${PROVISION_COMPANY_NAME:-Runtime Procurement}"
export ENABLE_EXPERIMENTAL_ROUTES=true
(cd "$project_dir/backend" && node scripts/provision-admin.cjs)

cleanup() {
  trap - INT TERM EXIT
  [[ -z "${frontend_pid:-}" ]] || kill "$frontend_pid" 2>/dev/null || true
  [[ -z "${backend_pid:-}" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "${frontend_pid:-}" ]] || wait "$frontend_pid" 2>/dev/null || true
  [[ -z "${backend_pid:-}" ]] || wait "$backend_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

PORT="$backend_port" NODE_ENV=development npm --prefix "$project_dir/backend" start &
backend_pid=$!
for ((attempt=0; attempt<60; attempt++)); do
  curl -fsS "http://127.0.0.1:$backend_port/api/health" >/dev/null 2>&1 && break
  kill -0 "$backend_pid" 2>/dev/null || { wait "$backend_pid"; exit $?; }
  sleep 1
done
curl -fsS "http://127.0.0.1:$backend_port/api/health" >/dev/null
PORT="$frontend_port" HOSTNAME=127.0.0.1 NODE_ENV=production \
  NEXT_PUBLIC_API_URL="http://127.0.0.1:$backend_port" \
  npm --prefix "$project_dir/frontend" start -- --hostname 127.0.0.1 --port "$frontend_port" &
frontend_pid=$!
wait "$backend_pid" "$frontend_pid"

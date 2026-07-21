#!/bin/sh
set -eu
cd "$(dirname "$0")"
mode="${1:-check}"
require_config() {
  : "${DATABASE_URL:?DATABASE_URL is required}"
  if [ "${AUTH_MODE:-local}" = oidc ]; then
    : "${OIDC_ISSUER:?OIDC_ISSUER is required}"; : "${OIDC_AUDIENCE:?OIDC_AUDIENCE is required}"; : "${OIDC_JWKS_URL:?OIDC_JWKS_URL is required}"
  else
    : "${JWT_SECRET:?JWT_SECRET is required}"; [ "${#JWT_SECRET}" -ge 32 ] || { echo 'JWT_SECRET must be at least 32 characters' >&2; exit 1; }
  fi
}
start_services() {
  backend_dir="$(pwd)/backend"
  frontend_dir="$(pwd)/frontend"
  if [ -n "${RUNTIME_PROJECT_SOURCE:-}" ] && [ -d "$RUNTIME_PROJECT_SOURCE/backend" ] && [ -d "$RUNTIME_PROJECT_SOURCE/frontend" ]; then
    backend_dir="$RUNTIME_PROJECT_SOURCE/backend"
    frontend_dir="$RUNTIME_PROJECT_SOURCE/frontend"
  fi
  backend_port="${BACKEND_PORT:-${PORT:-3001}}"
  frontend_port="${FRONTEND_PORT:-3000}"
  backend_host="${BACKEND_HOST:-${HOST:-127.0.0.1}}"
  frontend_host="${FRONTEND_HOST:-127.0.0.1}"
  if [ "$backend_port" = "$frontend_port" ]; then
    echo 'BACKEND_PORT and FRONTEND_PORT must be different' >&2
    exit 1
  fi

  cleanup_services() {
    trap - INT TERM EXIT
    [ -z "${frontend_pid:-}" ] || kill "$frontend_pid" 2>/dev/null || true
    [ -z "${backend_pid:-}" ] || kill "$backend_pid" 2>/dev/null || true
    [ -z "${frontend_pid:-}" ] || wait "$frontend_pid" 2>/dev/null || true
    [ -z "${backend_pid:-}" ] || wait "$backend_pid" 2>/dev/null || true
  }
  trap cleanup_services INT TERM EXIT

  PORT="$backend_port" HOST="$backend_host" \
    CLIENT_URL="${CLIENT_URL:-http://$frontend_host:$frontend_port}" \
    CORS_ORIGIN="${CORS_ORIGIN:-http://$frontend_host:$frontend_port}" \
    npm --prefix "$backend_dir" start &
  backend_pid=$!
  attempts=0
  until curl -fsS "http://127.0.0.1:$backend_port/api/health" >/dev/null 2>&1; do
    kill -0 "$backend_pid" 2>/dev/null || { wait "$backend_pid"; exit $?; }
    attempts=$((attempts + 1))
    [ "$attempts" -lt "${STARTUP_TIMEOUT_SECONDS:-30}" ] || { echo 'backend readiness timed out' >&2; exit 1; }
    sleep 1
  done

  PORT="$frontend_port" HOSTNAME="$frontend_host" \
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:$backend_port}" \
    npm --prefix "$frontend_dir" start -- --hostname "$frontend_host" --port "$frontend_port" &
  frontend_pid=$!
  while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do sleep 1; done
  if ! kill -0 "$backend_pid" 2>/dev/null; then wait "$backend_pid"; else wait "$frontend_pid"; fi
}
case "$mode" in
  check) npm run build && npm run test ;;
  migrate) require_config; [ "${ALLOW_SCHEMA_MIGRATION:-}" = 1 ] || { echo 'Set ALLOW_SCHEMA_MIGRATION=1' >&2; exit 1; }; (cd backend && npx prisma migrate deploy) ;;
  start) require_config; start_services ;;
  *) echo 'usage: ./start.sh check|migrate|start' >&2; exit 2 ;;
esac

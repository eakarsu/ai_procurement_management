#!/usr/bin/env bash
set -euo pipefail

# Local demo credential bridge (Codex managed)
demo_credentials_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$demo_credentials_project_dir/.env" ]; then
  while IFS= read -r demo_credentials_line || [ -n "$demo_credentials_line" ]; do
    case "$demo_credentials_line" in ''|'#'*) continue ;; esac
    demo_credentials_line="${demo_credentials_line#export }"
    demo_credentials_key="${demo_credentials_line%%=*}"
    demo_credentials_value="${demo_credentials_line#*=}"
    case "$demo_credentials_key" in
      NODE_ENV|ENABLE_DEMO_CREDENTIAL_AUTOFILL|DEMO_EMAIL|DEMO_PASSWORD|SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|SEED_USER_EMAIL|SEED_USER_PASSWORD|PROVISION_ADMIN_EMAIL|PROVISION_ADMIN_PASSWORD|BOOTSTRAP_ADMIN_EMAIL|BOOTSTRAP_ADMIN_PASSWORD|ADMIN_EMAIL|ADMIN_PASSWORD|DEFAULT_EMAIL|DEFAULT_PASSWORD|DEMO_TENANT|BOOTSTRAP_TENANT_SLUG|GOVERNANCE_TENANT_ID|TENANT_ID) ;;
      *) continue ;;
    esac
    [ -n "${!demo_credentials_key+x}" ] && continue
    demo_credentials_first="${demo_credentials_value:0:1}"
    demo_credentials_last="${demo_credentials_value: -1}"
    if { [ "$demo_credentials_first" = '"' ] && [ "$demo_credentials_last" = '"' ]; } || { [ "$demo_credentials_first" = "'" ] && [ "$demo_credentials_last" = "'" ]; }; then
      demo_credentials_value="${demo_credentials_value:1:${#demo_credentials_value}-2}"
    fi
    export "$demo_credentials_key=$demo_credentials_value"
  done < "$demo_credentials_project_dir/.env"
fi
demo_credentials_email=""
demo_credentials_password=""
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
if [ -n "${PROVISION_ADMIN_EMAIL:-}" ] && [ -n "${PROVISION_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$PROVISION_ADMIN_EMAIL"
  demo_credentials_password="$PROVISION_ADMIN_PASSWORD"
elif [ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ] && [ -n "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$BOOTSTRAP_ADMIN_EMAIL"
  demo_credentials_password="$BOOTSTRAP_ADMIN_PASSWORD"
elif [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_ADMIN_EMAIL"
  demo_credentials_password="$SEED_ADMIN_PASSWORD"
elif [ -n "${SEED_USER_EMAIL:-}" ] && [ -n "${SEED_USER_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_USER_EMAIL"
  demo_credentials_password="$SEED_USER_PASSWORD"
elif [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  demo_credentials_email="$DEMO_EMAIL"
  demo_credentials_password="$DEMO_PASSWORD"
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$ADMIN_EMAIL"
  demo_credentials_password="$ADMIN_PASSWORD"
elif [ -n "${DEFAULT_EMAIL:-}" ] && [ -n "${DEFAULT_PASSWORD:-}" ]; then
  demo_credentials_email="$DEFAULT_EMAIL"
  demo_credentials_password="$DEFAULT_PASSWORD"
fi
if [ "${NODE_ENV:-development}" != production ] && [ "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" = true ] && [ -n "$demo_credentials_email" ] && [ -n "$demo_credentials_password" ]; then
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export NEXT_PUBLIC_DEMO_EMAIL="$demo_credentials_email"
  export NEXT_PUBLIC_DEMO_PASSWORD="$demo_credentials_password"
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$demo_credentials_email"
  export VITE_DEMO_PASSWORD="$demo_credentials_password"
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export REACT_APP_DEMO_EMAIL="$demo_credentials_email"
  export REACT_APP_DEMO_PASSWORD="$demo_credentials_password"
  if [ -n "$demo_credentials_tenant" ]; then
    export NEXT_PUBLIC_DEMO_TENANT="$demo_credentials_tenant"
    export VITE_DEMO_TENANT="$demo_credentials_tenant"
    export REACT_APP_DEMO_TENANT="$demo_credentials_tenant"
  else
    unset NEXT_PUBLIC_DEMO_TENANT VITE_DEMO_TENANT REACT_APP_DEMO_TENANT
  fi
else
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  unset NEXT_PUBLIC_DEMO_EMAIL NEXT_PUBLIC_DEMO_PASSWORD NEXT_PUBLIC_DEMO_TENANT
  unset VITE_DEMO_EMAIL VITE_DEMO_PASSWORD VITE_DEMO_TENANT
  unset REACT_APP_DEMO_EMAIL REACT_APP_DEMO_PASSWORD REACT_APP_DEMO_TENANT
fi
unset demo_credentials_email demo_credentials_password demo_credentials_tenant demo_credentials_project_dir demo_credentials_line demo_credentials_key demo_credentials_value demo_credentials_first demo_credentials_last

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

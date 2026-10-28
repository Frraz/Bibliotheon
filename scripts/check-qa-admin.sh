#!/usr/bin/env bash
# QA administrativa sintética. Requer build isolado e PostgreSQL descartável.
set -euo pipefail
PROJETO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJETO_DIR"
[[ "${BIBLIOTHEON_SYNTHETIC_TESTS:-}" == true ]] || { echo 'Use BIBLIOTHEON_SYNTHETIC_TESTS=true somente com banco sintético.' >&2; exit 2; }
SUITE="${1:-}"
case "$SUITE" in analytics|suppressions|commercial-admin|public-states|commercial-load|relationship-states|foundation|public-site|catalog-states|relationship|preferences|sequences|admin-foundation|admin-editorial|financial-ledger|financial-records|commercial-imports|catalog-resolutions|financial-resolutions|financial-coverage|financial-dimensions|commercial-operation|release-layout) ;; *) echo "Suíte QA administrativa inválida." >&2; exit 2 ;; esac
if (( $# > 1 )); then
  [[ $# == 2 && "$SUITE" == financial-records && "$2" == --zoom ]] || { echo 'Argumentos QA inválidos.' >&2; exit 2; }
fi
QA_PORT="${CHECK_ADMIN_QA_PORT:-${CHECK_FINANCIAL_QA_PORT:-3001}}"
[[ "$QA_PORT" =~ ^[0-9]{1,5}$ ]] && (( QA_PORT >= 1024 && QA_PORT <= 65535 )) || { echo 'Porta QA inválida.' >&2; exit 2; }
QA_PORT="$QA_PORT" python3 - <<'PY'
import os, socket
with socket.socket() as probe:
    probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try: probe.bind(('127.0.0.1', int(os.environ['QA_PORT'])))
    except OSError: raise SystemExit(f"Porta {os.environ['QA_PORT']} ocupada; servidor existente preservado.")
PY
command -v setsid >/dev/null
export NEXT_DIST_DIR=.next-qa PORT="$QA_PORT" APP_HOST=127.0.0.1
export PUBLIC_SITE_URL="http://127.0.0.1:$QA_PORT"
export TEST_BASE_URL="$PUBLIC_SITE_URL"
export CHECKOUT_ALLOWED_HOSTS_HOTMART=pay.example.invalid CHECKOUT_ALLOWED_HOSTS_KIWIFY=pay.example.invalid CHECKOUT_ALLOWED_HOSTS_CAKTO=pay.example.invalid
export EMAIL_TRANSPORT_ENABLED=false LEADS_ENABLED=false COMMERCIAL_EVENTS_ENABLED=false
case "$SUITE" in public-site|release-layout|relationship|relationship-states|preferences|sequences) export LEADS_ENABLED=true ;; esac
# A captura exige transporte configurado; esta chave sintética nunca sai da QA.
# O preload abaixo bloqueia e registra qualquer tentativa HTTP externa.
if [[ "$SUITE" == public-site || "$SUITE" == relationship || "$SUITE" == relationship-states ]]; then
  export EMAIL_TRANSPORT_ENABLED=true BREVO_API_KEY=synthetic-no-provider-key
  export BREVO_SENDER_EMAIL=sender@example.invalid BREVO_SENDER_NAME='Synthetic QA'
fi
export BREVO_CONTACT_SYNC_ENABLED=false BREVO_CONTACT_REGISTRATION_ENABLED=false BREVO_LIST_SYNC_ENABLED=false BREVO_CAMPAIGN_SEND_ENABLED=false BREVO_CAMPAIGN_OBSERVE_ENABLED=false
export HOTMART_WEBHOOK_ENABLED=true HOTMART_ACCOUNT_KEY=synthetic HOTMART_HOTTOK=synthetic-hotmart-private-token
export KIWIFY_WEBHOOK_ENABLED=true KIWIFY_ACCOUNT_KEY=synthetic KIWIFY_WEBHOOK_TOKEN=synthetic-kiwify-current-token-32-characters
export CAKTO_WEBHOOK_ENABLED=true CAKTO_ACCOUNT_KEY=synthetic CAKTO_WEBHOOK_SECRET=synthetic-cakto-current-secret-32-characters
export ANALYTICS_ENABLED=true BREVO_WEBHOOK_ENABLED=true
export BREVO_WEBHOOK_TOKEN=wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww BREVO_WEBHOOK_EVENT_SECRET=vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
umask 077
mkdir -p .local-logs
LOG_FILE="$PROJETO_DIR/.local-logs/qa-$SUITE.log"
export BIBLIOTHEON_QA_NETWORK_LOG="$LOG_FILE.network.jsonl"
: > "$BIBLIOTHEON_QA_NETWORK_LOG"
export NODE_OPTIONS="${NODE_OPTIONS:-} --import=\"$PROJETO_DIR/scripts/qa-network-guard.mjs\""
APP_PID=''
cleanup() {
  local result=$?
  trap - EXIT INT TERM
  if [[ -n "$APP_PID" ]]; then
    kill -TERM -- "-$APP_PID" 2>/dev/null || true
    for _ in {1..10}; do kill -0 "$APP_PID" 2>/dev/null || break; sleep 1; done
    kill -KILL -- "-$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [[ "$result" != 0 ]]; then echo "QA visual falhou; log privado: $LOG_FILE" >&2; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
setsid node --env-file-if-exists=.env.local scripts/start.mjs > "$LOG_FILE" 2>&1 < /dev/null &
APP_PID=$!
ready=false
for _ in {1..60}; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then break; fi
  if curl --noproxy '*' --fail --silent --max-time 2 "$PUBLIC_SITE_URL/health/ready" >/dev/null; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Servidor QA não ficou saudável.' >&2; exit 1; }
node --env-file-if-exists=.env.local --import tsx "scripts/qa-$SUITE.ts" "${@:2}"
[[ ! -s "$BIBLIOTHEON_QA_NETWORK_LOG" ]] || { echo 'QA recusada: tentativa HTTP externa bloqueada.' >&2; exit 1; }

#!/usr/bin/env bash
# CI/QA sintético Linux. Requer build pronto e banco exclusivo; nunca produção.
set -euo pipefail
PROJETO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJETO_DIR"
SUITES=(integration site hotmart-http kiwify-http cakto-http commercial-csv-http
  commercial-imports-http catalog-resolutions-http transaction-review-http financial-resolutions-http report-evidence-http financial-ledger-http brevo-webhook-http analytics-http privacy-delete-http admin-recovery)
QA_PORT="${CHECK_HTTP_PORT:-3000}"
if [[ ! "$QA_PORT" =~ ^[0-9]{1,5}$ ]] || (( QA_PORT < 1024 || QA_PORT > 65535 )); then
  echo 'CHECK_HTTP_PORT deve ser uma porta TCP entre 1024 e 65535.' >&2
  exit 2
fi
if [[ "${1:-}" == --list && $# == 1 ]]; then
  printf 'test:%s\n' "${SUITES[@]}"
  exit 0
fi
if [[ $# == 2 && "${1:-}" == --only ]]; then
  requested="$2"
  if [[ ! "$requested" =~ ^[a-z0-9-]+$ ]]; then
    echo "Suíte desconhecida: $requested" >&2
    exit 2
  fi
  if [[ ! " ${SUITES[*]} " == *" $requested "* ]]; then
    echo "Suíte desconhecida: $requested" >&2
    exit 2
  fi
  SUITES=("$requested")
fi
if [[ $# != 0 ]]; then
  if [[ $# == 2 && "${1:-}" == --only ]]; then :; else
    echo 'Uso: bash scripts/check-http.sh [--list | --only SUITE]. Build e banco sintéticos exclusivos necessários.' >&2
    exit 2
  fi
fi
if [[ "${BIBLIOTHEON_SYNTHETIC_TESTS:-}" != true ]]; then
  echo 'Confirme banco/ambiente descartáveis com BIBLIOTHEON_SYNTHETIC_TESTS=true; nunca usar em produção.' >&2
  exit 2
fi

command -v setsid >/dev/null || { echo 'setsid não encontrado.' >&2; exit 1; }
command -v curl >/dev/null || { echo 'curl não encontrado.' >&2; exit 1; }
# Evita testar ou encerrar um servidor previamente iniciado por outra ferramenta.
QA_PORT="$QA_PORT" python3 - <<'PY'
import os
import socket
with socket.socket() as probe:
    try:
        probe.bind(('127.0.0.1', int(os.environ['QA_PORT'])))
    except OSError:
        raise SystemExit(f"Porta {os.environ['QA_PORT']} ocupada; servidor existente preservado.")
PY
export PUBLIC_SITE_URL="http://127.0.0.1:$QA_PORT"
export TEST_BASE_URL="$PUBLIC_SITE_URL"
export PORT="$QA_PORT" APP_HOST=127.0.0.1
export CHECKOUT_ALLOWED_HOSTS_HOTMART=pay.example.invalid
export CHECKOUT_ALLOWED_HOSTS_KIWIFY=pay.example.invalid
export CHECKOUT_ALLOWED_HOSTS_CAKTO=pay.example.invalid
export EMAIL_TRANSPORT_ENABLED=false LEADS_ENABLED=false COMMERCIAL_EVENTS_ENABLED=false
export BREVO_CONTACT_SYNC_ENABLED=false BREVO_CONTACT_REGISTRATION_ENABLED=false
export BREVO_LIST_SYNC_ENABLED=false BREVO_CAMPAIGN_SEND_ENABLED=false BREVO_CAMPAIGN_OBSERVE_ENABLED=false
export HOTMART_WEBHOOK_ENABLED=true HOTMART_ACCOUNT_KEY=synthetic HOTMART_HOTTOK=synthetic-hotmart-private-token
export KIWIFY_WEBHOOK_ENABLED=true KIWIFY_ACCOUNT_KEY=synthetic KIWIFY_WEBHOOK_TOKEN=synthetic-kiwify-current-token-32-characters
export CAKTO_WEBHOOK_ENABLED=true CAKTO_ACCOUNT_KEY=synthetic CAKTO_WEBHOOK_SECRET=synthetic-cakto-current-secret-32-characters
export ANALYTICS_ENABLED=true BREVO_WEBHOOK_ENABLED=true
export BREVO_WEBHOOK_TOKEN=wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
export BREVO_WEBHOOK_EVENT_SECRET=vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
umask 077
mkdir -p .local-logs
LOG_FILE="$PROJETO_DIR/.local-logs/ci-http.log"
APP_PID=''
cleanup() {
  local result=$?
  trap - EXIT INT TERM
  if [[ -n "$APP_PID" ]]; then
    kill -TERM -- "-$APP_PID" 2>/dev/null || true
    for _ in {1..10}; do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 1
    done
    kill -KILL -- "-$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [[ "$result" != 0 ]]; then
    echo "QA HTTP falhou; log privado em $LOG_FILE (não publicado pelo workflow)." >&2
  fi
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
  if curl --noproxy '*' --fail --silent --max-time 2 "$PUBLIC_SITE_URL/health/ready" > /dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo 'Servidor não ficou saudável; suítes HTTP não serão executadas.' >&2
  exit 1
fi
for suite in "${SUITES[@]}"; do
  npm run "test:$suite"
done

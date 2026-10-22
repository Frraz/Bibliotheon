#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE=(docker compose --env-file .env.local -f compose.local.yaml)
RUN_DIR="$ROOT/.local-run"
LOG_DIR="$ROOT/.local-logs"
PID_FILE="$RUN_DIR/next.pid"
LOG_FILE="$LOG_DIR/next.log"
URL="http://127.0.0.1:3000"

mkdir -p "$RUN_DIR" "$LOG_DIR"

die() {
  echo "ERRO: $*" >&2
  exit 1
}

if [[ ! -f .env.local ]]; then
  die "Arquivo .env.local não encontrado."
fi

command -v node >/dev/null || die "Node.js não encontrado."
command -v docker >/dev/null || die "Docker não encontrado."
docker info >/dev/null 2>&1 || die "Docker não está disponível. Verifique o serviço e suas permissões."

[[ -x node_modules/.bin/next ]] ||
  die "Next.js não instalado. Execute: corepack pnpm install --frozen-lockfile"

[[ -f node_modules/payload/bin.js ]] ||
  die "Payload não encontrado. Instale as dependências do projeto."

# Evita iniciar uma segunda instância gerenciada pelo script.
if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if [[ "$OLD_PID" =~ ^[0-9]+$ ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    OLD_CMD="$(ps -p "$OLD_PID" -o args= 2>/dev/null || true)"
    if [[ "$OLD_CMD" == *"next dev --webpack --hostname 127.0.0.1"* ]]; then
      echo "Bibliotheon já está em execução: $URL"
      echo "PID: $OLD_PID"
      exit 0
    fi
    die "O PID $OLD_PID está ocupado por outro processo. Não vou encerrá-lo. Confira $PID_FILE."
  fi
  rm -f "$PID_FILE"
fi

# Não deixa o Next.js escolher silenciosamente a porta 3001.
if command -v ss >/dev/null 2>&1 &&
   ss -ltnp | awk '$4 ~ /:3000$/ {found=1} END {exit !found}'; then
  die "A porta 3000 já está ocupada. Confira: ss -ltnp | grep ':3000'"
fi

echo "==> Iniciando PostgreSQL local..."
"${COMPOSE[@]}" up -d --wait db

echo "==> Aplicando migrações do Payload..."
node --env-file=.env.local node_modules/payload/bin.js migrate

echo "==> Iniciando Next.js..."
nohup "$ROOT/node_modules/.bin/next" dev \
  --webpack --hostname 127.0.0.1 \
  > "$LOG_FILE" 2>&1 < /dev/null &

APP_PID=$!
echo "$APP_PID" > "$PID_FILE"

# Aguarda a resposta HTTP, sem declarar sucesso antes de o site responder.
for _ in $(seq 1 60); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "O Next.js encerrou inesperadamente. Últimos logs:" >&2
    tail -n 60 "$LOG_FILE" >&2 || true
    exit 1
  fi

  if curl --silent --fail --output /dev/null --max-time 2 "$URL"; then
    echo
    echo "Bibliotheon iniciado com sucesso!"
    echo "Site: $URL"
    echo "PID: $APP_PID"
    echo "Logs: $LOG_FILE"
    exit 0
  fi

  sleep 1
done

echo "O site não respondeu em até 60 segundos." >&2
tail -n 60 "$LOG_FILE" >&2 || true
kill "$APP_PID" 2>/dev/null || true
rm -f "$PID_FILE"
exit 1

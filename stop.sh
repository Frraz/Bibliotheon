#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE=(docker compose --env-file .env.local -f compose.local.yaml)
PID_FILE="$ROOT/.local-run/next.pid"

echo "==> Encerrando Next.js..."

if [[ -f "$PID_FILE" ]]; then
  APP_PID="$(cat "$PID_FILE")"

  if [[ ! "$APP_PID" =~ ^[0-9]+$ ]]; then
    echo "ERRO: PID inválido em $PID_FILE" >&2
    exit 1
  fi

  if kill -0 "$APP_PID" 2>/dev/null; then
    APP_CMD="$(ps -p "$APP_PID" -o args= 2>/dev/null || true)"

    if [[ "$APP_CMD" == *"next dev --webpack --hostname 127.0.0.1"* ]]; then
      kill -TERM "$APP_PID"

      for _ in $(seq 1 10); do
        kill -0 "$APP_PID" 2>/dev/null || break
        sleep 1
      done

      if kill -0 "$APP_PID" 2>/dev/null; then
        APP_CMD="$(ps -p "$APP_PID" -o args= 2>/dev/null || true)"
        if [[ "$APP_CMD" == *"next dev --webpack --hostname 127.0.0.1"* ]]; then
          echo "O Next.js não encerrou; enviando SIGKILL ao PID $APP_PID."
          kill -KILL "$APP_PID" 2>/dev/null || true
        fi
      fi

      echo "Next.js encerrado."
    else
      echo "ERRO: PID $APP_PID não corresponde ao Next.js esperado." >&2
      echo "Não encerrei esse processo. Confira $PID_FILE." >&2
      exit 1
    fi
  else
    echo "O processo registrado já não está em execução."
  fi

  rm -f "$PID_FILE"
else
  echo "Nenhum PID do Next.js registrado pelo start.sh."
fi

echo "==> Parando PostgreSQL local..."

if [[ -f .env.local ]] && docker info >/dev/null 2>&1; then
  "${COMPOSE[@]}" stop db
  echo "PostgreSQL local parado. Os dados foram preservados."
else
  echo "Não foi possível parar o banco: confira Docker e .env.local." >&2
  exit 1
fi

echo "Bibliotheon parado."

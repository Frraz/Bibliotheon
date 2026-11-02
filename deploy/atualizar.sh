#!/usr/bin/env bash
# Atualiza o Bibliotheon no servidor: código novo, backup do banco, build, troca e verificação.
# Se a verificação falhar, volta sozinho para a imagem anterior.
# Uso (no servidor, na pasta do projeto):  ./deploy/atualizar.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "✗ Falta o .env (copie de .env.example)"; exit 1; }
set -a; . ./.env; set +a
COMPOSE="docker compose -f docker-compose.prod.yml"

ANTERIOR="$(docker inspect --format '{{.Config.Image}}' bibliotheon_web 2>/dev/null || true)"
echo "▸ Código: git pull"
git pull --ff-only

TAG="$(git rev-parse --short HEAD)"
export IMAGE_TAG="$TAG"

echo "▸ Backup do banco antes da troca"
./deploy/backup.sh

echo "▸ Build da imagem bibliotheon:$TAG"
$COMPOSE build

echo "▸ Subindo"
mkdir -p data && { sudo -n chown -R 1000:1000 data 2>/dev/null || chown -R 1000:1000 data 2>/dev/null || true; }
$COMPOSE up -d

echo "▸ Verificando (até 60 s)"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORTA}/api/saude" >/dev/null 2>&1; then
    echo "✓ No ar: bibliotheon:$TAG"
    ./deploy/aquecer.sh || true   # imagens otimizadas já prontas para o primeiro visitante
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" .env || true
    exit 0
  fi
  sleep 2
done

echo "✗ Não respondeu. Voltando para a imagem anterior: ${ANTERIOR:-nenhuma}"
$COMPOSE logs --tail 40 web || true
if [ -n "$ANTERIOR" ]; then
  export IMAGE_TAG="${ANTERIOR##*:}"
  $COMPOSE up -d --no-build
fi
exit 1

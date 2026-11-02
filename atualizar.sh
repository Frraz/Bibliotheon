#!/usr/bin/env bash
# Coloca a versão mais recente do Bibliotheon no ar. Rode NO SERVIDOR, depois de fazer o push:
#
#   cd /var/www/docker-instances/Bibliotheon && ./atualizar.sh            # só atualiza se houver versão nova
#   ./atualizar.sh --forcar                                               # reconstrói mesmo sem versão nova
#
# Use --forcar depois de mudar o .env (e-mail de contato, Pixel, GA4, SITE_URL), pois esses valores entram no build.
# De outra máquina:  ssh deploy@147.93.15.214 'cd /var/www/docker-instances/Bibliotheon && ./atualizar.sh'
#
# O que faz: busca o código no GitHub, confere se está na última versão, faz backup do banco, constrói a imagem nova,
# troca o container e verifica /api/saude por 60 s. Se não responder, volta sozinho para a imagem anterior.
set -euo pipefail
cd "$(dirname "$0")"

FORCAR=0
case "${1:-}" in
  --forcar) FORCAR=1 ;;
  "") ;;
  *) echo "Uso: ./atualizar.sh [--forcar]"; exit 2 ;;
esac

[ -f .env ] || { echo "✗ Falta o .env (copie de .env.example)"; exit 1; }
set -a; . ./.env; set +a
COMPOSE="docker compose -f docker-compose.prod.yml"

# ---- 1. Código: conferir se está na última versão
echo "▸ Código: buscando no GitHub"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "✗ Há alterações locais no servidor (git status). Elas bloqueariam a atualização:"
  git status --short --untracked-files=no
  exit 1
fi
git fetch --quiet origin
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
LOCAL="$(git rev-parse HEAD)"
REMOTO="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTO" ]; then
  echo "  Já está na última versão do GitHub ($(git rev-parse --short HEAD))."
elif git merge-base --is-ancestor "$REMOTO" "$LOCAL"; then
  echo "  O servidor está à FRENTE do GitHub ($(git rev-parse --short HEAD) × $(git rev-parse --short "$REMOTO")): falta o git push na sua máquina."
else
  echo "  Há versão nova no GitHub: $(git rev-parse --short HEAD) → $(git rev-parse --short "$REMOTO")"
  git pull --ff-only --quiet origin "$BRANCH"
fi

TAG="$(git rev-parse --short HEAD)"
ANTERIOR="$(docker inspect --format '{{.Config.Image}}' bibliotheon_web 2>/dev/null || true)"

# ---- 2. Já está no ar? Então não há o que fazer (a menos que peçam --forcar)
if [ "$FORCAR" = 0 ] && [ "$ANTERIOR" = "bibliotheon:$TAG" ] \
   && curl -fsS "http://127.0.0.1:${PORTA}/api/saude" >/dev/null 2>&1; then
  echo "✓ O site já roda a versão $TAG. Nada a fazer (use --forcar para reconstruir)."
  exit 0
fi

export IMAGE_TAG="$TAG"

echo "▸ Backup do banco antes da troca"
./deploy/backup.sh || echo "  ! Backup falhou; seguindo mesmo assim (o banco não é alterado pelo build)."

echo "▸ Build da imagem bibliotheon:$TAG"
$COMPOSE build

echo "▸ Subindo"
mkdir -p data
# O container roda como uid 1000. Sem sudo: acerta o dono por um container descartável, só se preciso.
if [ "$(stat -c %u data)" != 1000 ]; then
  docker run --rm -v "$PWD/data:/d" alpine chown -R 1000:1000 /d
fi
$COMPOSE up -d

echo "▸ Verificando (até 60 s)"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORTA}/api/saude" >/dev/null 2>&1; then
    echo "✓ No ar: bibliotheon:$TAG — $(git log -1 --format=%s)"
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" .env || true
    ./deploy/aquecer.sh || true   # imagens otimizadas já prontas para o primeiro visitante
    if curl -fsS "${SITE_URL}/api/saude" >/dev/null 2>&1; then
      echo "✓ Também responde em ${SITE_URL}"
    else
      echo "  ! ${SITE_URL}/api/saude não respondeu: confira o nginx e o DNS."
    fi
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

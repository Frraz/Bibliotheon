#!/usr/bin/env bash
# Aquece o cache depois de um deploy: abre as páginas do sitemap e pede todas as variantes de imagem que elas usam.
# Sem isto, o primeiro visitante pagaria o custo de gerar as imagens otimizadas (LCP muito pior).
# Uso: ./deploy/aquecer.sh [url-base]    (padrão: http://127.0.0.1:$PORTA)
set -uo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }
BASE="${1:-http://127.0.0.1:${PORTA:-3000}}"

paginas="$BASE/ $(curl -fsS "$BASE/sitemap.xml" | grep -o '<loc>[^<]*</loc>' | sed -E 's|<loc>https?://[^/<]+||; s|</loc>||; s|^$|/|' | sed "s|^|$BASE|")"
total=0
for p in $paginas; do
  html="$(curl -fsS "$p" || true)"
  # variantes de imagem do otimizador (srcset e preload), com &amp; desfeito
  for u in $(printf '%s' "$html" | grep -oE '/_next/image\?[^" ,]+' | sed 's/&amp;/\&/g' | sort -u); do
    curl -fsS -o /dev/null "$BASE$u" && total=$((total + 1))
  done
done
echo "✓ Cache aquecido: $(echo $paginas | wc -w) página(s), $total variante(s) de imagem"

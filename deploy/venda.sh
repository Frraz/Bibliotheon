#!/usr/bin/env bash
# Operação de venda em produção, sem trocar o banco (as métricas ficam).
#
#   export BIBLIOTHEON_TOKEN=...             # o mesmo API_TOKEN do .env do servidor
#   deploy/venda.sh aplicar <slug> <arquivo.json>   # textos, preço, campanha e links (nomes do manifesto)
#   deploy/venda.sh amostra <slug> <amostra.pdf>
#   deploy/venda.sh relatorio [dias] [vendas] [afiliadas]
#   deploy/venda.sh leads > leads.csv
set -euo pipefail
: "${BIBLIOTHEON_TOKEN:?defina BIBLIOTHEON_TOKEN}"
URL="${BIBLIOTHEON_URL:-https://bibliotheon.com.br}"
chamar() { curl -sS --fail-with-body -H "Authorization: Bearer $BIBLIOTHEON_TOKEN" "$@"; }

case "${1:-}" in
  aplicar) chamar -X PATCH -H "content-type: application/json" --data-binary "@$3" "$URL/api/v1/ebooks/$2"; echo ;;
  amostra) chamar -X PUT -H "content-type: application/pdf" --data-binary "@$3" "$URL/api/v1/ebooks/$2/amostra"; echo ;;
  relatorio) chamar "$URL/api/v1/metricas?dias=${2:-30}&vendas=${3:-0}&afiliadas=${4:-0}" ;;
  leads) chamar "$URL/api/v1/leads" ;;
  *) sed -n 2,8p "$0"; exit 2 ;;
esac

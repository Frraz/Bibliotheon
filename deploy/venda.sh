#!/usr/bin/env bash
# Operação de venda em produção, sem trocar o banco (as métricas ficam).
#
#   export BIBLIOTHEON_TOKEN=...             # o mesmo API_TOKEN do .env do servidor (no servidor, dispensável: lê o .env)
#   deploy/venda.sh aplicar <slug> <arquivo.json>   # textos, preço, campanha e links (nomes do manifesto)
#   deploy/venda.sh amostra <slug> <amostra.pdf>
#   deploy/venda.sh relatorio [dias] [vendas] [afiliadas]
#   deploy/venda.sh leads > leads.csv
set -euo pipefail
# No servidor (ou onde houver um .env ao lado do repositório), usa o API_TOKEN dele: não precisa exportar nada.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -z "${BIBLIOTHEON_TOKEN:-}" ] && [ -f "$RAIZ/.env" ]; then
  BIBLIOTHEON_TOKEN="$(set -a; . "$RAIZ/.env" >/dev/null 2>&1; printf '%s' "${API_TOKEN:-}")"
fi
: "${BIBLIOTHEON_TOKEN:?defina BIBLIOTHEON_TOKEN (ou rode onde exista o .env com o API_TOKEN)}"
URL="${BIBLIOTHEON_URL:-https://bibliotheon.com.br}"
chamar() { curl -sS --fail-with-body -H "Authorization: Bearer $BIBLIOTHEON_TOKEN" "$@"; }

case "${1:-}" in
  aplicar) [ $# -ge 3 ] || { echo "Faltam argumentos: deploy/venda.sh aplicar <slug> <arquivo.json>" >&2; echo "Ex.: deploy/venda.sh aplicar criar-sistemas-com-ia seeds/001-sistemas-com-ia/renomear-promocao.json" >&2; exit 2; }
    [ -f "$3" ] || { echo "Arquivo não encontrado: $3 (rode da raiz do projeto)" >&2; exit 2; } ;;&
  amostra) [ $# -ge 3 ] || { echo "Faltam argumentos: deploy/venda.sh amostra <slug> <amostra.pdf>" >&2; exit 2; } ;;&
esac
case "${1:-}" in
  aplicar) chamar -X PATCH -H "content-type: application/json" --data-binary "@$3" "$URL/api/v1/ebooks/$2"; echo ;;
  amostra) chamar -X PUT -H "content-type: application/pdf" --data-binary "@$3" "$URL/api/v1/ebooks/$2/amostra"; echo ;;
  relatorio) chamar "$URL/api/v1/metricas?dias=${2:-30}&vendas=${3:-0}&afiliadas=${4:-0}" ;;
  leads) chamar "$URL/api/v1/leads" ;;
  *) sed -n 2,8p "$0"; exit 2 ;;
esac

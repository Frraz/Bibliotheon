#!/usr/bin/env bash
# Desenvolvimento local Linux. Produção: atualizar.sh.
set -euo pipefail
PROJETO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v python3 >/dev/null || { echo 'ERRO: Python 3 não encontrado.' >&2; exit 1; }
exec python3 "$PROJETO_DIR/scripts/local-dev.py" start "$@"

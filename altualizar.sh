#!/usr/bin/env bash
set -euo pipefail
PROJETO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$PROJETO_DIR/atualizar.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail
PROJETO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$PROJETO_DIR/ops/deploy.py" "$@"

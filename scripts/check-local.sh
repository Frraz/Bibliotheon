#!/usr/bin/env bash
# Checks sem banco, Docker, envio ou servidor. Integrações são executadas à parte.
set -euo pipefail
PROJETO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJETO_DIR"
export NEXT_TELEMETRY_DISABLED=1
bash -n atualizar.sh start.sh stop.sh scripts/check-local.sh scripts/check-integration.sh scripts/check-http.sh
npm run typecheck
npm run lint
npm test
python3 -m unittest discover -s tests/ops -p 'test_*.py'
python3 scripts/validar_documentacao.py

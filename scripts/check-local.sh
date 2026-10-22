#!/usr/bin/env bash
set -euo pipefail
export NEXT_TELEMETRY_DISABLED=1
node --env-file=.env.local node_modules/typescript/bin/tsc --noEmit
npm run lint
npm test
python3 -m unittest discover -s tests/ops -p 'test_*.py'
python3 scripts/validar_documentacao.py

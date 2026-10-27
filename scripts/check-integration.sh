#!/usr/bin/env bash
# Banco sintético exclusivo: as suítes compartilham fixtures e devem ser sequenciais.
set -euo pipefail
PROJETO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJETO_DIR"
SUITES=(database-bulk catalog catalog-identities catalog-identity-db catalog-resolutions transaction-review financial-resolutions report-evidence commercial-state-matrix financial-ledger financial-coverage financial-dimensions media marketing sequences batches brevo-sync preflight brevo-contacts
  brevo-lists preferences brevo-preferences brevo-campaigns brevo-send brevo-observation
  brevo-webhook analytics analytics-retention privacy-retention privacy-retention-deadline privacy-marketing-retention privacy-theme-retention privacy-theme-legacy privacy-identity-retention privacy-samples-retention privacy-inventory privacy-delete privacy-correct privacy-recovery privacy-recovery-pending commercial-inbox commercial-admin hotmart kiwify cakto
  commercial-csv commercial-imports)
if [[ "${1:-}" == --list && $# == 1 ]]; then
  printf 'test:%s\n' "${SUITES[@]}"
  exit 0
fi
if [[ $# != 0 ]]; then
  echo 'Uso: bash scripts/check-integration.sh [--list]. Executar somente com banco sintético exclusivo.' >&2
  exit 2
fi
if [[ "${BIBLIOTHEON_SYNTHETIC_TESTS:-}" != true ]]; then
  echo 'Confirme banco/ambiente descartáveis com BIBLIOTHEON_SYNTHETIC_TESTS=true; nunca usar em produção.' >&2
  exit 2
fi

for suite in "${SUITES[@]}"; do
  npm run "test:$suite"
done

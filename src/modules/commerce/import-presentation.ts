export type ImportKind = 'snapshot' | 'report_evidence'
export const importKindLabels = {snapshot: 'Snapshot comercial', report_evidence: 'Evidência complementar'} as const
export const importStateLabels: Record<string, string> = {
  ready: 'Pronto para conferência', blocked: 'Bloqueado para confirmação', stale: 'Plano desatualizado',
  queued: 'Fatos enfileirados', confirmed: 'Confirmação registrada', planned: 'Planejada', matched: 'Já corresponde ao histórico',
  duplicate: 'Repetida', recorded: 'Evidência registrada',
}
export const importClassificationLabels: Record<string, string> = {
  new: 'Nova', matched: 'Correspondente', duplicate: 'Repetida', conflict: 'Divergente', unknown_catalog: 'Catálogo desconhecido',
  ambiguous_catalog: 'Catálogo ambíguo', needs_review: 'Exige revisão', invalid: 'Inválida',
}
const reasons: Record<string, string> = {
  new_transaction: 'Transação ainda ausente do histórico.', same_snapshot: 'Snapshot já corresponde ao histórico.', duplicate_row: 'Linha repetida neste arquivo.',
  conflict_in_file: 'Linhas do arquivo divergem para a mesma identidade.', unknown_product: 'Produto não associado ao catálogo.', unknown_offer: 'Oferta não associada ao catálogo.',
  ambiguous_product: 'Produto associado a mais de um livro.', ambiguous_offer: 'Oferta com mais de um cadastro.', catalog_history_conflict: 'Catálogo e vínculo histórico divergem.',
  catalog_resolution_invalid: 'A associação auditada precisa de nova conferência.', catalog_resolution_held: 'A associação está mantida em revisão.',
  transaction_conflicted: 'Há evidências conflitantes para esta transação.', financial_resolution_review_required: 'A decisão financeira precisa de nova conferência.',
  ledger_conflict: 'Valores, estado ou identidade divergem do histórico.', existing_review: 'A transação já exige revisão.', additional_evidence: 'Há informação complementar que exige evidência própria.',
  incomplete_snapshot: 'O snapshot omite valores conhecidos no histórico.', settlement_evidence_required: 'Recebimento exige registro independente de liquidação.',
  future_event_time: 'A data está no futuro além da tolerância permitida.', pending_evidence: 'Há evidência anterior ainda não processada.', snapshot_not_supported: 'Este estado ou reversão exige evidência complementar e decisão.',
  report_evidence_new: 'Nova evidência; registrar não aplica valores à transação.', report_evidence_duplicate: 'Evidência idêntica já registrada ou repetida no arquivo.', report_record_conflict: 'A referência de linha já contém evidência diferente.',
  column_count: 'Quantidade de colunas inválida.', invalid_provider: 'Provedor inválido.', invalid_identity: 'Identificador inválido.', invalid_status: 'Estado inválido.', invalid_kind: 'Tipo de evidência inválido.',
  invalid_time: 'Data inválida; use ISO 8601 em UTC.', invalid_currency: 'Moeda inválida; use três letras maiúsculas.', invalid_money: 'Valor inválido; use centavos inteiros ou campo vazio.',
  invalid_refund: 'Base ou identidade do reembolso inválida.', invalid_replacements: 'Referências de substituição inválidas.', invalid_evidence: 'A linha não atende ao contrato de evidência.',
}
export const importReasonLabel = (code: string) => reasons[code] || 'É necessário conferir esta linha antes de prosseguir.'
const errors: Record<string, string> = {
  forbidden: 'Sua sessão expirou ou a origem não foi aceita. Entre novamente no painel.',
  invalid_header: 'O cabeçalho não corresponde ao contrato escolhido. Use o modelo disponível nesta tela.',
  invalid_utf8: 'Salve o arquivo em UTF-8 antes de reenviar.', invalid_quotes: 'Revise as aspas e a separação por vírgulas do CSV.',
  empty_file: 'Inclua pelo menos uma linha de dados após o cabeçalho.', too_large: 'O arquivo excede o limite do contrato escolhido.',
  too_many_rows: 'Há mais linhas do que o contrato permite.', field_too_long: 'Uma célula excede o limite de 512 caracteres.',
  invalid_rows: 'Há linhas inválidas. Confira os campos do contrato antes de criar o lote.', mixed_accounts: 'Cada lote deve conter um único provedor e uma única conta.',
  invalid_import_metadata: 'Revise a origem, a referência e o motivo da conferência.', future_event_time: reasons.future_event_time,
  idempotency_conflict: 'Esta tentativa já foi usada com dados diferentes. Confira os lotes recentes antes de criar outro.',
  batch_not_ready: 'O lote está bloqueado ou desatualizado. Confira o estado e prepare um novo lote após resolver a causa.',
  plan_conflict: 'O plano mudou. Reabra o lote antes de confirmar.', not_found: 'O lote não foi encontrado.',
  integrity_conflict: 'A integridade do lote exige revisão. A confirmação não foi aplicada.', invalid_confirmation: 'Confira o lote e marque a confirmação antes de continuar.',
}
export const importFailureLabel = (code: string) => errors[code] || 'Não foi possível confirmar a operação. Confira os lotes recentes e repita a mesma tentativa, sem alterar os dados.'
export type ImportPreview = {counts: Record<string, number>; lines: {line: number; classification: string; reason: string; duplicateOf?: number}[]}

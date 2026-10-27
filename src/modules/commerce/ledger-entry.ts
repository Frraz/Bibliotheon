import type {CostInput, SettlementInput} from './financial-ledger'

export type LedgerEntryKind = 'settlement' | 'cost'
export type LedgerEntryValues = {
  provider: string; accountKey: string; externalTransactionId: string; currency: string; amount: string; occurredAt: string;
  direction: string; settlementReference: string; sourceKind: string; sourceReference: string; recordReference: string;
  category: string; classification: string; campaignId: string;
}
export type LedgerEntrySeed = {id: string; values: LedgerEntryValues}
export const ledgerCategories = {advertising: 'Publicidade', commission: 'Comissão', production: 'Produção', software: 'Software', operations: 'Operação', other: 'Outro custo'} as const
export const ledgerSources = {provider_report: 'Relatório do provedor', manual_reconciliation: 'Conciliação manual', invoice: 'Nota ou fatura'} as const
export const ledgerKinds = {settlement: 'Liquidação', cost: 'Custo'} as const

/** Decimal input is converted exactly, without floating point rounding or separator guessing. */
export function ledgerAmountCents(value: string): number {
  const match = /^(0|[1-9]\d{0,13})(?:[.,](\d{1,2}))?$/.exec(value)
  if (!match) throw new Error('Informe um valor não negativo, sem separador de milhar e com até duas casas decimais.')
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('O valor excede o limite monetário seguro.')
  return Number(cents)
}
export function ledgerAmountInput(cents: number): string {
  const integer = BigInt(cents)
  return `${integer / 100n},${String(integer % 100n).padStart(2, '0')}`
}
export function ledgerMoney(cents: number, currency: string): string {
  const signed = BigInt(cents), integer = signed < 0n ? -signed : signed
  return `${signed < 0n ? '-' : ''}${new Intl.NumberFormat('pt-BR').format(integer / 100n)},${String(integer % 100n).padStart(2, '0')} ${currency}`
}
export function ledgerUTC(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) throw new Error('Confira a data e hora em UTC.')
  const date = new Date(value + 'Z')
  if (!Number.isFinite(date.getTime()) || !date.toISOString().startsWith(value)) throw new Error('Confira a data e hora em UTC.')
  return date.toISOString()
}
export function newLedgerEntry(kind: LedgerEntryKind): LedgerEntryValues {
  return {provider: 'hotmart', accountKey: '', externalTransactionId: '', currency: 'BRL', amount: '', occurredAt: '', direction: 'credit', settlementReference: '', sourceKind: kind === 'cost' ? 'invoice' : 'provider_report', sourceReference: '', recordReference: '', category: 'operations', classification: 'confirmed', campaignId: ''}
}
export function prepareLedgerEntry(kind: LedgerEntryKind, values: LedgerEntryValues, supersedes: string | null): SettlementInput | CostInput {
  const common = {amountCents: ledgerAmountCents(values.amount), currency: values.currency.toUpperCase(), sourceKind: values.sourceKind, sourceReference: values.sourceReference, recordReference: values.recordReference, supersedes}
  if (kind === 'settlement') return {...common, provider: values.provider, accountKey: values.accountKey, externalTransactionId: values.externalTransactionId, direction: values.direction, settlementReference: values.settlementReference, settledAt: ledgerUTC(values.occurredAt), evidenceVerified: true} as SettlementInput
  return {...common, category: values.category, classification: values.classification, campaignId: values.campaignId || null, incurredAt: ledgerUTC(values.occurredAt)} as CostInput
}
const failures: Record<string, string> = {
  forbidden: 'Sua sessão expirou ou a origem não foi aceita. Entre novamente no painel.',
  settlement_transaction_unverified: 'A transação precisa ter aprovação comprovada, moeda igual e nenhuma revisão pendente. Confira o histórico antes de registrar a liquidação.',
  settlement_record_conflict: 'Esta referência de linha já foi usada com dados diferentes. Confira o histórico e prepare uma correção explícita.',
  cost_record_conflict: 'Esta referência de custo já foi usada com dados diferentes. Confira o histórico e prepare uma correção explícita.',
  settlement_already_replaced: 'A liquidação já foi substituída. Abra o registro vigente antes de preparar outra correção.',
  cost_already_replaced: 'O custo já foi substituído. Abra o registro vigente antes de preparar outra correção.',
  invalid_settlement_replacement: 'A correção deve preservar transação, moeda, liquidação e fonte do registro anterior.',
  invalid_cost_replacement: 'A correção deve preservar categoria, moeda, campanha e fonte do custo anterior.',
  invalid_cost_campaign: 'A campanha não foi encontrada. Selecione uma campanha cadastrada ou deixe o custo sem campanha.',
  invalid_financial_time: 'A data precisa ser válida, em UTC e sem instante futuro além da tolerância de cinco minutos.',
  invalid_amount: 'Confira o valor não negativo e seu limite monetário.',
  invalid_settlement_evidence: 'Revise provedor, conta, transação, moeda e referências da liquidação.',
  invalid_cost_entry: 'Revise categoria, moeda, campanha e referências do custo.',
}
export const ledgerFailure = (code: string) => failures[code] || 'Não foi possível confirmar o registro. Confira o histórico e repita com a mesma fonte e referência de linha; a operação pode ter sido registrada.'

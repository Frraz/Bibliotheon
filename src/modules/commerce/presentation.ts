import type {CommercialInbox} from '../../payload-types'
import {COMMERCIAL_LEASE_MS} from './policy'

export const inboxStateLabels = {
 pending: 'Aguardando processamento', processing: 'Em processamento', applied: 'Aplicado ao histórico',
 ignored: 'Ignorado com registro', needs_review: 'Precisa de revisão', failed: 'Falha temporária',
} as const
export const retryReasonLabels = {
 catalog_updated: 'Corrigi o mapeamento do catálogo', service_restored: 'Restabeleci o serviço',
 reviewed_envelope: 'Conferi o evento e a causa da revisão',
} as const
const errors:Record<string,string> = {
 dispute_not_final: 'MED ou pré-chargeback exige conciliação; não comprova perda definitiva.',
 unknown_event_time: 'O evento não informa um instante financeiro inequívoco; exige conciliação.',
 unsupported_currency_precision: 'A moeda exige conferência de unidade/precisão antes da aplicação.', unsupported_purchase_shape: 'Assinatura, plano ou produto físico exige conciliação específica.', unsupported_native_status: 'O estado nativo exige conferência antes da aplicação.', approval_time_conflict: 'Os eventos divergem na data original de aprovação.',
 unknown_product: 'Produto sem mapeamento no catálogo.', unknown_offer: 'Oferta sem mapeamento no catálogo.',
 ambiguous_product: 'O produto corresponde a mais de um livro.', ambiguous_offer: 'A oferta corresponde a mais de um cadastro.',
 catalog_resolution_held: 'Associação mantida em revisão por decisão auditada.', catalog_resolution_invalid: 'A decisão de associação precisa de nova conferência.',
 catalog_limit: 'Há cadastros demais para resolver o produto com segurança.', catalog_identity_changed: 'A identidade do catálogo diverge do histórico.',
 event_key_conflict: 'Há envelopes diferentes para a mesma chave de evento.', transaction_conflicted: 'A transação tem uma colisão de evento não resolvida.',
 invalid_envelope: 'O envelope salvo não atende ao contrato.', envelope_integrity: 'A integridade do envelope precisa de conferência.',
 history_integrity: 'As referências do histórico precisam de conferência.', history_limit: 'O histórico excede o limite de processamento.',
 future_event_time: 'A data do evento está à frente do horário permitido.', attempts_exhausted: 'O orçamento de cinco tentativas foi esgotado.',
 processing_unavailable: 'O processamento local não pôde concluir a transação.',
 identity_or_currency_conflict: 'Os eventos divergem em produto ou moeda.', offer_conflict: 'Os eventos informam ofertas diferentes.',
 same_time_state_conflict: 'Há estados diferentes no mesmo instante.', same_time_value_conflict: 'Há valores diferentes no mesmo instante.',
 gross_conflict: 'O valor bruto diverge entre eventos.', refund_basis_unknown: 'A base do reembolso não foi confirmada.',
 refund_operation_conflict: 'A mesma operação de reembolso informa valores diferentes.', refund_total_regressed: 'O total reembolsado retrocedeu.',
 refund_exceeds_gross: 'O reembolso excede o bruto conhecido.', chargeback_exceeds_gross: 'O chargeback excede o bruto conhecido.',
 money_overflow: 'O valor ultrapassa o limite monetário seguro.', paid_state_regressed: 'Um evento posterior contradiz a aprovação conhecida.',
 approval_after_reversal: 'Há aprovação posterior a uma reversão.', reversal_state_regressed: 'Um evento posterior contradiz a reversão conhecida.',
}
export const commercialErrorLabel=(code:string|null|undefined)=>code ? errors[code] || 'Há uma divergência que exige conferência no histórico.' : 'Sem falha registrada.'
export function commercialDate(value:string|null|undefined){
 if(!value || !Number.isFinite(Date.parse(value)))return 'Não informado'
 return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Belem',dateStyle:'short',timeStyle:'short'}).format(new Date(value))
}
type RetryState=Pick<CommercialInbox,'state'|'conflicted'|'startedAt'>
export function retryAvailability(row:RetryState,now=Date.now()):string|null{
 if(row.conflicted)return 'Colisão de evento: o reprocessamento não resolve envelopes divergentes.'
 if(row.state==='applied'||row.state==='ignored')return 'O evento já foi concluído; não é necessário reprocessar.'
 if(row.state==='pending')return 'O evento já aguarda processamento na fila.'
 if(row.state==='processing'&&(!row.startedAt||!Number.isFinite(Date.parse(row.startedAt))||Date.parse(row.startedAt)>now-COMMERCIAL_LEASE_MS))return 'Há processamento em andamento. Atualize a página após o prazo de cinco minutos.'
 return null
}

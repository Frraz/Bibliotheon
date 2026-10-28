import type { CollectionConfig, Field, DateField } from 'payload'
import { deny, owner } from '../access/owner'

const reference = (name: string, relationTo: 'contacts' | 'themes' | 'lead-magnets' | 'magnet-requests' | 'email-sequences' | 'sequence-enrollments', required = true): Field => ({ name, type: 'relationship', relationTo, required, index: true })
const date = (name: string, required = false): DateField => ({ name, type: 'date', required, admin: { date: { displayFormat: 'dd/MM/yyyy HH:mm' } } })
const text = (name: string, required = false, unique = false, hidden = false): Field => ({ name, type: 'text', required, unique, ...(hidden ? { admin: { hidden: true } } : {}) })
const operational = (slug: CollectionConfig['slug'], singular: string, plural: string, fields: Field[]): CollectionConfig => ({
  slug, labels: { singular, plural },
  admin: { group: 'Relacionamento', description: 'Dados privados. Alterações operacionais passam pelos fluxos auditados.' },
  access: { read: owner, create: deny, update: deny, delete: deny },
  fields: fields.map(field => {
    if (field.type !== 'ui' && field.type !== 'join') {
      field.admin ??= {}
      field.admin.readOnly = true
    }
    return field
  }),
})
export const Contacts = operational('contacts', 'Contato', 'Contatos', [
  { name: 'email', type: 'email', required: true, unique: true }, date('confirmedAt'), date('globalSuppressedAt'),
  { name: 'deliveryState', type: 'select', required: true, defaultValue: 'ok', options: ['ok', 'bounced', 'complaint'] },
])
Contacts.admin = { ...Contacts.admin, useAsTitle: 'email', defaultColumns: ['email', 'confirmedAt', 'globalSuppressedAt', 'deliveryState'] }
export const Subscriptions = operational('subscriptions', 'Assinatura temática', 'Assinaturas temáticas', [
  reference('contact', 'contacts'), reference('theme', 'themes'), text('key', true, true),
  { name: 'state', type: 'select', required: true, options: ['pending', 'subscribed', 'unsubscribed'] },
  text('consentVersion'), date('subscribedAt'), date('unsubscribedAt'),
])
export const ConsentEvents = operational('consent-events', 'Registro de consentimento', 'Registros de consentimento', [
  reference('contact', 'contacts'), reference('theme', 'themes', false),
  { name: 'purpose', type: 'select', required: true, options: ['sample', 'marketing'] },
  { name: 'action', type: 'select', required: true, options: ['requested', 'confirmed', 'subscribed', 'unsubscribed', 'bounced', 'complaint', 'provider_blocked'] },
  text('version'), date('occurredAt', true), text('key', true, true),
])
export const MagnetRequests = operational('magnet-requests', 'Pedido de amostra', 'Pedidos de amostra', [
  reference('contact', 'contacts'), reference('magnet', 'lead-magnets'), reference('theme', 'themes'),
  text('magnetVersion', true), { name: 'marketingOptIn', type: 'checkbox', required: true, defaultValue: false }, text('consentVersion'), text('campaignCode'),
  text('confirmationTokenHash', false, true), date('expiresAt', true), date('confirmedAt'), date('deliveredAt'), date('revokedAt'),
])
export const EmailDeliveries = operational('email-deliveries', 'Envio de e-mail', 'Envios de e-mail', [
  text('key', true, true), reference('contact', 'contacts'), reference('request', 'magnet-requests'),
  { name: 'kind', type: 'select', required: true, options: ['confirmation', 'delivery'] },
  { name: 'state', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'sending', 'sent', 'uncertain', 'failed', 'canceled'] },
  { name: 'attempts', type: 'number', required: true, defaultValue: 0, min: 0 },
  date('nextAttemptAt', true), date('startedAt'), date('sentAt'), text('providerMessageId'),
  { name: 'errorCode', type: 'select', options: ['transport_disabled', 'quota', 'provider_rejected', 'uncertain_delivery', 'attempts_exhausted', 'recipient_suppressed', 'material_unavailable'] },
])
export const PreferenceTokens = operational('preference-tokens', 'Link de preferências', 'Links de preferências', [
  reference('contact', 'contacts'), text('tokenHash', true, true), date('expiresAt', true),
  text('sourceKey', false, true, true), text('nonce', false, false, true),
])
PreferenceTokens.admin = { ...PreferenceTokens.admin, hidden: true }
export const MarketingSuppressionTombstones = operational('marketing-suppression-tombstones', 'Supressão pseudonimizada', 'Supressões pseudonimizadas', [
  text('fingerprint', true, true, true), date('expiresAt', true),
])
MarketingSuppressionTombstones.admin = { ...MarketingSuppressionTombstones.admin, hidden: true, description: 'Impressão HMAC sem endereço ou relação com contato; mantida por até 12 meses para prevenir reimportação automática.' }
export const MailQuota = operational('mail-quota', 'Quota diária', 'Quotas diárias', [
  text('day', true, true), { name: 'reserved', type: 'number', required: true, defaultValue: 0, min: 0 },
])
export const RequestLimits = operational('request-limits', 'Limite de solicitação', 'Limites de solicitação', [
  text('key', true, true), { name: 'count', type: 'number', required: true, defaultValue: 0, min: 0 }, date('expiresAt', true),
])
RequestLimits.admin = { ...RequestLimits.admin, hidden: true }
export const SequenceEnrollments = operational('sequence-enrollments', 'Inscrição em sequência', 'Inscrições em sequências', [
  text('key', true, true, true), reference('contact', 'contacts'), reference('request', 'magnet-requests'), reference('magnet', 'lead-magnets'), reference('theme', 'themes'), reference('sequence', 'email-sequences'), text('magnetVersion', true), date('confirmedAt', true),
  { name: 'state', type: 'select', required: true, options: ['active', 'canceled', 'completed'], defaultValue: 'active' },
  { name: 'snapshot', label: 'Conteúdo revisado no momento da confirmação', type: 'json', required: true, admin: { components: { Field: '/components/admin/SequenceSnapshot#SequenceSnapshot' } } }, date('canceledAt'),
])
export const PromotionDeliveries = operational('promotion-deliveries', 'Etapa promocional', 'Etapas promocionais', [
  text('key', true, true, true), reference('enrollment', 'sequence-enrollments'), reference('contact', 'contacts'),
  { name: 'stage', label: 'Dia após confirmação', type: 'select', required: true, options: ['2', '4', '7', '10'] },
  date('dueAt', true), date('nextCheckAt', true),
  { name: 'batch', label: 'Lote promocional', type: 'relationship', relationTo: 'email-campaign-batches', index: true },
  { name: 'state', type: 'select', required: true, options: ['scheduled', 'ready', 'sending', 'accepted', 'observed', 'uncertain', 'rejected', 'canceled'], defaultValue: 'scheduled' },
  { name: 'errorCode', type: 'select', options: ['recipient_suppressed', 'material_unavailable', 'sequence_paused', 'offer_unavailable', 'provider_rejected', 'uncertain_delivery', 'marketing_review_due'] },
])
export const EmailCampaignBatches = operational('email-campaign-batches', 'Lote promocional', 'Lotes promocionais', [
  text('key', true, true, true), text('groupKey', true), reference('theme', 'themes'),
  { name: 'stage', type: 'select', required: true, options: ['2', '4', '7', '10'] }, text('day', true),
  { name: 'copy', label: 'Conteúdo imutável do lote', type: 'json', required: true },
  { name: 'members', label: 'Referências privadas de destinatários e etapas', type: 'json', required: true },
  { name: 'recipientCount', label: 'Destinatários', type: 'number', required: true, min: 1, max: 200 },
  { name: 'state', type: 'select', required: true, options: ['prepared', 'claimed', 'canceled', 'uncertain', 'rejected'], defaultValue: 'prepared' },
  date('nextAttemptAt', true), date('claimedAt'), date('canceledAt'),
  { name: 'providerCheck', label: 'Conferência recente de destinatários', type: 'json' },
  { name: 'preferenceCheck', label: 'Conferência recente dos links de preferências', type: 'json' },
  { name: 'errorCode', type: 'select', options: ['quota', 'eligibility_changed', 'uncertain_delivery', 'provider_absent', 'provider_unavailable', 'provider_rejected'] },
])
EmailCampaignBatches.admin = { ...EmailCampaignBatches.admin, description: 'Lote privado. Preparado ou reservado não significa enviado, aceito ou recebido. Transporte promocional ainda desativado.', defaultColumns: ['day', 'stage', 'recipientCount', 'state', 'errorCode'] }
SequenceEnrollments.admin = { ...SequenceEnrollments.admin, defaultColumns: ['magnet', 'magnetVersion', 'state', 'confirmedAt'] }
PromotionDeliveries.admin = { ...PromotionDeliveries.admin, description: 'Calendário local. Pronta significa elegível para agrupamento, sem comprovar envio ou recebimento.', defaultColumns: ['stage', 'dueAt', 'state', 'errorCode'] }
export const BrevoSuppressions = operational('brevo-suppressions', 'Sincronização de bloqueio', 'Sincronizações de bloqueio', [
  { name: 'contact', label: 'Contato', type: 'relationship', relationTo: 'contacts', required: true, unique: true },
  { name: 'revision', label: 'Revisão do pedido', type: 'number', required: true, min: 1, max: 2147483647 },
  { name: 'state', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'processing', 'synced', 'failed'] },
  { name: 'attempts', type: 'number', required: true, defaultValue: 0, min: 0 },
  date('nextAttemptAt', true), date('startedAt'), date('syncedAt'),
  { name: 'outcome', label: 'Última conferência no provedor', type: 'select', options: ['blocked', 'absent'] },
  { name: 'errorCode', type: 'select', options: ['provider_unavailable', 'provider_rejected'] },
])
BrevoSuppressions.admin = { ...BrevoSuppressions.admin, description: 'Fila privada para reforçar bloqueios de marketing no Brevo. Não reativa contatos nem envia mensagens. Sincronização externa desligada por padrão.', defaultColumns: ['contact', 'state', 'attempts', 'nextAttemptAt', 'outcome'] }
export const BrevoRegistrations = operational('brevo-registrations', 'Cadastro consentido no Brevo', 'Cadastros consentidos no Brevo', [
  { name: 'contact', type: 'relationship', relationTo: 'contacts', required: true, unique: true },
  { name: 'revision', label: 'Revisão do pedido', type: 'number', required: true, min: 1, max: 2147483647 },
  { name: 'state', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'processing', 'synced', 'failed', 'canceled', 'canceling'] },
  { name: 'attempts', type: 'number', required: true, defaultValue: 0, min: 0 },
  date('nextAttemptAt', true), date('startedAt'), date('syncedAt'), text('contactVersion'),
  { name: 'providerId', label: 'ID do contato no provedor', type: 'number', min: 1 },
  { name: 'errorCode', type: 'select', options: ['provider_unavailable', 'provider_rejected', 'local_ineligible', 'identity_changed'] },
])
BrevoRegistrations.admin = { ...BrevoRegistrations.admin, description: 'Fila privada. Somente consentimento confirmado autoriza cadastro; contatos existentes não são reativados. Cadastro não significa campanha ou mensagem.', defaultColumns: ['contact', 'state', 'attempts', 'nextAttemptAt', 'errorCode'] }
export const BrevoBatchLists = operational('brevo-batch-lists', 'Lista de destinatários Brevo', 'Listas de destinatários Brevo', [
  { name: 'batch', label: 'Lote promocional', type: 'relationship', relationTo: 'email-campaign-batches', required: true, unique: true },
  { name: 'name', label: 'Nome exclusivo no provedor', type: 'text', required: true },
  { name: 'folderId', label: 'Pasta no provedor', type: 'number', required: true, min: 1 },
  { name: 'providerListId', label: 'ID da lista no provedor', type: 'number', min: 1, unique: true },
  { name: 'audienceKey', label: 'Identidade do conjunto', type: 'text', required: true },
  { name: 'snapshot', label: 'Conjunto de referências da criação', type: 'json', required: true },
  { name: 'attemptedIds', label: 'Inclusões já tentadas', type: 'json', required: true },
  { name: 'verification', label: 'Conferência recente', type: 'json' },
  { name: 'state', type: 'select', required: true, options: ['creating', 'filling', 'ready', 'uncertain', 'failed', 'canceled'] },
  { name: 'leaseToken', label: 'Identificador da tentativa', type: 'text', admin: { hidden: true } },
  date('startedAt'), date('creationIssuedAt'), date('nextAttemptAt', true), date('verifiedAt'),
  { name: 'errorCode', type: 'select', options: ['provider_unavailable', 'provider_rejected', 'creation_rejected', 'creation_uncertain', 'membership_uncertain', 'membership_unverified', 'list_conflict', 'recipient_suppressed', 'local_ineligible'] },
])
BrevoBatchLists.admin = { ...BrevoBatchLists.admin, useAsTitle: 'name', description: 'Lista privada de um lote. Composição conferida não significa campanha ou envio. Inclusão incerta não é repetida automaticamente.', defaultColumns: ['batch', 'state', 'providerListId', 'nextAttemptAt', 'errorCode'] }
export const BrevoCampaignDrafts = operational('brevo-campaign-drafts', 'Rascunho de campanha Brevo', 'Rascunhos de campanhas Brevo', [
  { name: 'batch', type: 'relationship', relationTo: 'email-campaign-batches', required: true, unique: true },
  { name: 'observedIds', label: 'IDs observados no provedor', type: 'json', required: true },
  text('name', true), { name: 'contentHash', label: 'Identidade da cópia', type: 'text', required: true }, { name: 'content', label: 'Cópia imutável', type: 'json', required: true },
  { name: 'providerCampaignId', label: 'ID da campanha no provedor', type: 'number', min: 1, unique: true },
  { name: 'state', type: 'select', required: true, options: ['creating', 'ready', 'uncertain', 'failed', 'canceled'] },
  text('leaseToken', false, false, true), date('startedAt'), date('creationIssuedAt'), date('nextAttemptAt', true), date('verifiedAt'),
  { name: 'errorCode', type: 'select', options: ['provider_unavailable', 'provider_rejected', 'creation_rejected', 'creation_uncertain', 'campaign_conflict', 'local_ineligible'] },
])
BrevoCampaignDrafts.admin = { ...BrevoCampaignDrafts.admin, description: 'Rascunho privado. Ready não significa disparado ou aceito. Sem envio automático.', defaultColumns: ['batch', 'state', 'providerCampaignId', 'errorCode'] }
export const BrevoCampaignSends = operational('brevo-campaign-sends', 'Solicitação de disparo Brevo', 'Solicitações de disparo Brevo', [
  { name: 'batch', type: 'relationship', relationTo: 'email-campaign-batches', required: true, unique: true },
  { name: 'draft', label: 'Rascunho conferido', type: 'relationship', relationTo: 'brevo-campaign-drafts', unique: true },
  text('batchKey', true), text('contentHash'),
  { name: 'providerCampaignId', label: 'ID da campanha no provedor', type: 'number', min: 1, unique: true },
  { name: 'recipientCount', label: 'Destinatários únicos', type: 'number', min: 1, max: 200, required: true },
  { name: 'attempts', type: 'number', min: 0, required: true }, { name: 'recipientIdentities', type: 'json', admin: { hidden: true } }, text('attemptToken', false, false, true),
  { name: 'history', label: 'Histórico mínimo das tentativas', type: 'json', required: true },
  { name: 'state', type: 'select', required: true, options: ['preparing', 'issuing', 'submitted', 'observed', 'rejected', 'uncertain', 'canceled'] },
  text('leaseToken', false, false, true), date('prepareStartedAt'), date('nextAttemptAt', true),
  { name: 'errorCode', type: 'select', options: ['prerequisites', 'quota', 'provider_rejected', 'uncertain_delivery', 'local_ineligible'] },
  date('issuedAt'), date('settledAt'), date('retryRequestedAt'),
  { name: 'responseCode', label: 'Código HTTP confirmado', type: 'number' },
])
BrevoCampaignSends.admin = { ...BrevoCampaignSends.admin, description: 'Solicitação aceita pelo provedor não comprova entrega. Resultado incerto não é reenviado automaticamente. Cada tentativa preserva sua reserva diária.', defaultColumns: ['state', 'recipientCount', 'attempts', 'issuedAt', 'responseCode'] }
export const BrevoCampaignObservations = operational('brevo-campaign-observations', 'Observação de campanha', 'Observações de campanhas', [
  { name: 'send', label: 'Solicitação de disparo', type: 'relationship', relationTo: 'brevo-campaign-sends', required: true, unique: true },
  text('attemptToken', true, false, true), text('leaseToken', false, false, true), date('startedAt'), date('nextCheckAt'), date('checkedAt'),
  { name: 'state', type: 'select', required: true, options: ['pending', 'processing', 'matched', 'conflict', 'failed'] },
  { name: 'lastStatus', label: 'Último estado da campanha no provedor', type: 'select', options: ['draft', 'sent', 'archive', 'queued', 'suspended', 'in_process', 'in_review', 'cancelling', 'cancelled'] },
  { name: 'activityStatus', label: 'Atividade positiva mais forte observada', type: 'select', options: ['sent', 'queued', 'in_process', 'in_review'] },
  date('activityObservedAt'), date('sentObservedAt'), date('providerSentAt'),
  { name: 'errorCode', type: 'select', options: ['provider_unavailable', 'provider_absent', 'provider_rejected', 'campaign_conflict', 'unsupported_status'] },
])
BrevoCampaignObservations.admin = { ...BrevoCampaignObservations.admin, description: 'Consulta de campanha. Não comprova entrega individual, consentimento, clique ou venda e não autoriza reenvio.', defaultColumns: ['send', 'state', 'lastStatus', 'checkedAt', 'nextCheckAt'] }
export const BrevoWebhookEvents = operational('brevo-webhook-events', 'Evento Brevo', 'Eventos Brevo', [
  text('key', true, true, true), text('recipientFingerprint', true, false, true),
  reference('contact', 'contacts', false),
  { name: 'event', type: 'select', required: true, options: ['delivered', 'hard_bounce', 'soft_bounce', 'spam', 'unsubscribe'] },
  { name: 'providerCampaignId', type: 'number', required: true }, { name: 'providerWebhookId', type: 'number', required: true },
  date('occurredAt', true), { ...date('sentAt', true), label: 'Envio informado pelo provedor' }, date('receivedAt', true), date('processedAt'),
  { name: 'state', type: 'select', required: true, options: ['pending', 'processed', 'quarantined'] },
  { name: 'reason', type: 'select', options: ['unknown_contact', 'identity_changed', 'unknown_campaign', 'recipient_mismatch', 'emission_mismatch'] },
  { name: 'suppressionApplied', type: 'checkbox', required: true, defaultValue: false },
  { name: 'delivery', type: 'relationship', relationTo: 'promotion-deliveries' },
])
BrevoWebhookEvents.admin = { ...BrevoWebhookEvents.admin, description: 'Envelope mínimo autenticado, sem corpo/endereço ou links recebidos. ACK confirma persistência, não entrega ou venda.', defaultColumns: ['event', 'state', 'reason', 'occurredAt', 'receivedAt'] }
export const BrevoDeliveryReceipts = operational('brevo-delivery-receipts', 'Resultado por destinatário', 'Resultados por destinatário', [
  { name: 'delivery', type: 'relationship', relationTo: 'promotion-deliveries', required: true, unique: true },
  { name: 'send', type: 'relationship', relationTo: 'brevo-campaign-sends', required: true },
  text('recipientFingerprint', true, false, true), { name: 'providerCampaignId', type: 'number', required: true },
  date('firstObservedAt', true), { ...date('deliveredAt'), label: 'Entrega informada pelo provedor' }, date('hardBouncedAt'), date('softBouncedAt'), date('spamAt'), date('unsubscribedAt'),
])
BrevoDeliveryReceipts.admin = { ...BrevoDeliveryReceipts.admin, description: 'Notificações do provedor preservadas separadamente. Delivered não comprova leitura, compra ou receita; falhas posteriores permanecem visíveis.' }
export const PrivacyRequestAudit = operational('privacy-request-audit', 'Auditoria de pedido de dados', 'Auditorias de pedidos de dados', [
 {name:'subjectFingerprint',type:'text',required:true,index:true,admin:{hidden:true}},
 {name:'action',type:'select',required:true,options:['export','delete','correct']},
 {name:'outcome',type:'select',required:true,options:['completed','not_found','pending','failed']},
 {name:'counts',type:'json',required:true},
 {name:'actor',type:'relationship',relationTo:'admin-users',required:true},
 date('occurredAt',true),
])
PrivacyRequestAudit.admin={...PrivacyRequestAudit.admin,description:'Trilha sem email ou conteúdo exportado. A impressão HMAC é pseudônima e sujeita a prazo de retenção restrito.',defaultColumns:['action','outcome','occurredAt']}
export const ContactRetirements = operational('contact-retirements', 'Expurgo automático de identidade', 'Expurgos automáticos de identidade', [
  { name: 'subjectFingerprint', type: 'text', required: true, unique: true, admin: { hidden: true }, validate: (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) || 'Impressão HMAC inválida.' },
  date('retiredAt', true), date('expiresAt', true),
])
ContactRetirements.admin = { ...ContactRetirements.admin, hidden: true, description: 'Fato de expurgo automático sem email, ID de contato ou atribuição a um pedido humano; usado na recuperação por até 24 meses.', defaultColumns: ['retiredAt', 'expiresAt'] }
export const ThemeWithdrawals = operational('theme-withdrawals', 'Descadastro temático preservado', 'Descadastros temáticos preservados', [
  text('key', true, true, true),
  { name: 'subjectFingerprint', type: 'text', required: true, index: true, admin: { hidden: true }, validate: (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) || 'Impressão HMAC inválida.' },
  { name: 'themeId', type: 'text', required: true, index: true, validate: (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value) || 'Tema inválido.' },
  date('withdrawnAt', true), date('expiresAt', true),
])
ThemeWithdrawals.admin = { ...ThemeWithdrawals.admin, hidden: true, description: 'Fato de descadastro por assunto, sem endereço ou relação com contato; preservado por 24 meses para restauração.', defaultColumns: ['themeId', 'withdrawnAt', 'expiresAt'] }
export const relationshipCollections = [Contacts, Subscriptions, ConsentEvents, MagnetRequests, EmailDeliveries, PreferenceTokens, MarketingSuppressionTombstones, MailQuota, RequestLimits, SequenceEnrollments, PromotionDeliveries, EmailCampaignBatches, BrevoSuppressions, BrevoRegistrations, BrevoBatchLists, BrevoCampaignDrafts, BrevoCampaignSends, BrevoCampaignObservations, BrevoWebhookEvents, BrevoDeliveryReceipts, PrivacyRequestAudit, ContactRetirements, ThemeWithdrawals]
Subscriptions.admin = { ...Subscriptions.admin, defaultColumns: ['contact', 'theme', 'state', 'subscribedAt'] }
ConsentEvents.admin = { ...ConsentEvents.admin, defaultColumns: ['purpose', 'action', 'occurredAt'] }
MagnetRequests.admin = { ...MagnetRequests.admin, defaultColumns: ['magnet', 'marketingOptIn', 'confirmedAt', 'createdAt'] }
EmailDeliveries.admin = { ...EmailDeliveries.admin, defaultColumns: ['kind', 'state', 'attempts', 'nextAttemptAt', 'errorCode'] }
MailQuota.admin = { ...MailQuota.admin, defaultColumns: ['day', 'reserved'] }

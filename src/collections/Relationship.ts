import type { CollectionConfig, Field } from 'payload'
import { deny, owner } from '../access/owner'

const reference = (name: string, relationTo: 'contacts' | 'themes' | 'lead-magnets' | 'magnet-requests' | 'email-sequences' | 'sequence-enrollments', required = true): Field => ({ name, type: 'relationship', relationTo, required, index: true })
const date = (name: string, required = false): Field => ({ name, type: 'date', required, admin: { date: { displayFormat: 'dd/MM/yyyy HH:mm' } } })
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
  { name: 'action', type: 'select', required: true, options: ['requested', 'confirmed', 'subscribed', 'unsubscribed', 'bounced', 'complaint'] },
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
])
PreferenceTokens.admin = { ...PreferenceTokens.admin, hidden: true }
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
  { name: 'state', type: 'select', required: true, options: ['scheduled', 'ready', 'sending', 'accepted', 'uncertain', 'canceled'], defaultValue: 'scheduled' },
  { name: 'errorCode', type: 'select', options: ['recipient_suppressed', 'material_unavailable', 'sequence_paused', 'offer_unavailable'] },
])
SequenceEnrollments.admin = { ...SequenceEnrollments.admin, defaultColumns: ['magnet', 'magnetVersion', 'state', 'confirmedAt'] }
PromotionDeliveries.admin = { ...PromotionDeliveries.admin, description: 'Calendário local. Pronta significa elegível para agrupamento, sem comprovar envio ou recebimento.', defaultColumns: ['stage', 'dueAt', 'state', 'errorCode'] }
export const relationshipCollections = [Contacts, Subscriptions, ConsentEvents, MagnetRequests, EmailDeliveries, PreferenceTokens, MailQuota, RequestLimits, SequenceEnrollments, PromotionDeliveries]
Subscriptions.admin = { ...Subscriptions.admin, defaultColumns: ['contact', 'theme', 'state', 'subscribedAt'] }
ConsentEvents.admin = { ...ConsentEvents.admin, defaultColumns: ['purpose', 'action', 'occurredAt'] }
MagnetRequests.admin = { ...MagnetRequests.admin, defaultColumns: ['magnet', 'marketingOptIn', 'confirmedAt', 'createdAt'] }
EmailDeliveries.admin = { ...EmailDeliveries.admin, defaultColumns: ['kind', 'state', 'attempts', 'nextAttemptAt', 'errorCode'] }
MailQuota.admin = { ...MailQuota.admin, defaultColumns: ['day', 'reserved'] }

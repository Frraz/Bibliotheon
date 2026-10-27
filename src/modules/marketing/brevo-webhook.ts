import {readSendRecipients,sendRecipientFingerprint} from './send-recipients'
import type { Payload, PayloadRequest } from 'payload'
import type { BrevoWebhookEvent } from '../../payload-types'
import { webhookEventKey, webhookRecipient, type MarketingWebhookEvent, type WebhookConfig } from '../../integrations/brevo/webhook'
import { atomic, serial } from './transaction'
import { idOf } from './sequence-copy'
import { readBatchMembers } from './batch-copy'
import { readSendHistory } from './send-history'
import { readDraftSpec, draftHash } from './campaign-copy'
import { suppressLockedContact } from './suppression'

/** Caller holds event, send/batch (if known), and contact locks in that order. */
async function processLocked(req: PayloadRequest, row: BrevoWebhookEvent, config: WebhookConfig, now: number) {
  const { payload } = req
  const candidate = (await payload.find({ collection: 'brevo-campaign-sends', where: { providerCampaignId: { equals: row.providerCampaignId } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (candidate) { await serial(req, `brevo-send:${idOf(candidate.batch)}`); await serial(req, `promotion-batch:${idOf(candidate.batch)}`) }
  const send = candidate && await payload.findByID({ collection: 'brevo-campaign-sends', id: candidate.id, depth: 0, overrideAccess: true, req })
  if (!row.contact) return finish('unknown_contact')
  const contactId = idOf(row.contact)
  await serial(req, `contact:${contactId}`)
  const contact = (await payload.find({ collection: 'contacts', where: { id: { equals: contactId } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (!contact || webhookRecipient(contact.email, config.eventSecret) !== row.recipientFingerprint) return finish('identity_changed')
  let suppressionApplied = row.suppressionApplied
  const reason = row.event === 'spam' ? 'complaint' : row.event === 'hard_bounce' ? 'bounced' : row.event === 'unsubscribe' ? 'unsubscribed' : null
  if (reason && !suppressionApplied) {
    // Receipt time prevents an old pending confirmation from overriding this newly received withdrawal.
    await suppressLockedContact(req, contact, reason, `brevo-webhook:${row.key}`, now, config.linkSecret)
    suppressionApplied = true
  }
  if (!send || send.providerCampaignId !== row.providerCampaignId) return finish('unknown_campaign', suppressionApplied)
  const history = readSendHistory(send.history)
  if (!history?.length || history.length !== send.attempts || !send.issuedAt || Date.parse(row.sentAt) < Date.parse(history[0].issuedAt) - 1000 || Date.parse(row.occurredAt) < Date.parse(history[0].issuedAt) - 1000) return finish('emission_mismatch', suppressionApplied)
  if (!send.draft || !send.contentHash) return finish('emission_mismatch', suppressionApplied)
  const draft = await payload.findByID({ collection: 'brevo-campaign-drafts', id: idOf(send.draft), depth: 0, overrideAccess: true, req }), spec = readDraftSpec(draft.content)
  if (!spec || draft.providerCampaignId !== send.providerCampaignId || draft.contentHash !== send.contentHash || draftHash(spec) !== send.contentHash || idOf(draft.batch) !== idOf(send.batch)) return finish('emission_mismatch', suppressionApplied)
  const batch = await payload.findByID({ collection: 'email-campaign-batches', id: idOf(send.batch), depth: 0, overrideAccess: true, req }), members = readBatchMembers(batch.members)
  if (!members || batch.key !== send.batchKey || batch.recipientCount !== send.recipientCount) throw new Error('Manifesto de campanha inconsistente.')
  const member = members.find(item => item.contact === contactId)
  if (!member) return finish('recipient_mismatch', suppressionApplied)
  const identity=readSendRecipients(send.recipientIdentities)?.recipients.find(item=>item.contact===contactId&&item.delivery===member.delivery)
  if(!identity||identity.fingerprint!==sendRecipientFingerprint(contact.email,config.linkSecret)) return finish('recipient_mismatch',suppressionApplied)
  const delivery = await payload.findByID({ collection: 'promotion-deliveries', id: member.delivery, depth: 0, overrideAccess: true, req })
  if (!delivery.batch || idOf(delivery.batch) !== batch.id || idOf(delivery.contact) !== contactId) throw new Error('Destinatário da campanha inconsistente.')
  const receipt = (await payload.find({ collection: 'brevo-delivery-receipts', where: { delivery: { equals: delivery.id } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (receipt && (idOf(receipt.send) !== send.id || receipt.providerCampaignId !== row.providerCampaignId || receipt.recipientFingerprint !== row.recipientFingerprint)) throw new Error('Resultado de outra identidade.')
  const field = ({ delivered: 'deliveredAt', hard_bounce: 'hardBouncedAt', soft_bounce: 'softBouncedAt', spam: 'spamAt', unsubscribe: 'unsubscribedAt' } as const)[row.event]
  const at = receipt?.[field] && Date.parse(receipt[field]!) <= Date.parse(row.occurredAt) ? receipt[field]! : row.occurredAt
  if (receipt) await payload.update({ collection: 'brevo-delivery-receipts', id: receipt.id, data: { [field]: at }, overrideAccess: true, req })
  else await payload.create({ collection: 'brevo-delivery-receipts', data: { delivery: delivery.id, send: send.id, providerCampaignId: row.providerCampaignId, recipientFingerprint: row.recipientFingerprint, firstObservedAt: new Date(now).toISOString(), [field]: at }, overrideAccess: true, req })
  // Campaign activity is separate from HTTP acknowledgement and per-recipient outcome.
  await payload.update({ collection: 'brevo-campaign-sends', id: send.id, data: { state: 'observed', errorCode: null, leaseToken: null }, overrideAccess: true, req })
  await payload.update({ collection: 'email-campaign-batches', id: batch.id, data: { state: 'claimed', errorCode: null }, overrideAccess: true, req })
  if (['sending', 'uncertain', 'accepted', 'rejected'].includes(delivery.state)) await payload.update({ collection: 'promotion-deliveries', id: delivery.id, data: { state: 'observed', errorCode: null }, overrideAccess: true, req })
  await payload.update({ collection: 'brevo-webhook-events', id: row.id, data: { state: 'processed', reason: null, suppressionApplied, delivery: delivery.id, processedAt: new Date(now).toISOString() }, overrideAccess: true, req })
  return { state: 'processed' as const }

  async function finish(reason: 'unknown_contact' | 'identity_changed' | 'unknown_campaign' | 'recipient_mismatch' | 'emission_mismatch', applied = row.suppressionApplied) {
    await payload.update({ collection: 'brevo-webhook-events', id: row.id, data: { state: 'quarantined', reason, suppressionApplied: applied, processedAt: new Date(now).toISOString() }, overrideAccess: true, req })
    return { state: 'quarantined' as const }
  }
}
/** ACK only after envelope, safety effects and receipt commit together. No provider calls. */
export async function ingestBrevoWebhook(payload: Payload, event: MarketingWebhookEvent, config: WebhookConfig, now = Date.now()) {
  const key = webhookEventKey(event, config.eventSecret)
  return atomic(payload, async req => {
    await serial(req, `brevo-webhook:${key}`)
    const previous = (await payload.find({ collection: 'brevo-webhook-events', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (previous) return { state: 'duplicate' as const }
    // Resolve once; never bind a quarantined unknown address to a future different contact.
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: event.email } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    const row = await payload.create({ collection: 'brevo-webhook-events', data: { key, recipientFingerprint: webhookRecipient(event.email, config.eventSecret), contact: contact?.id, event: event.event, providerCampaignId: event.campaignId, providerWebhookId: event.webhookId, occurredAt: event.occurredAt, sentAt: event.sentAt, receivedAt: new Date(now).toISOString(), state: 'pending', suppressionApplied: false }, overrideAccess: true, req })
    return processLocked(req, row, config, now)
  })
}
/** Explicit replay uses only the retained normalized envelope, never changes its identity. */
export async function replayBrevoWebhook(payload: Payload, id: string, config: WebhookConfig, now = Date.now()) {
  return atomic(payload, async req => {
    const initial = await payload.findByID({ collection: 'brevo-webhook-events', id, depth: 0, overrideAccess: true, req })
    await serial(req, `brevo-webhook:${initial.key}`)
    const row = await payload.findByID({ collection: 'brevo-webhook-events', id, depth: 0, overrideAccess: true, req })
    if (row.state === 'processed') return { state: 'duplicate' as const }
    return processLocked(req, row, config, now)
  })
}

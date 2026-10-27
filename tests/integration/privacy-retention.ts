import { retainSuppressionTombstone } from '../../src/modules/marketing/suppression-tombstone'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { runPrivacyRequestAuditRetention } from '../../src/modules/marketing/privacy-retention'
import { requestMagnet } from '../../src/modules/marketing/service'
import { commercialEventDigest, commercialEventKey, commercialTransactionKey, type NormalizedCommercialEvent } from '../../src/modules/commerce/events'
import { processCommercialInbox } from '../../src/modules/commerce/inbox'
import { reviewChoice, transactionReviewContext } from '../../src/modules/commerce/transaction-review'
import { atomic } from '../../src/modules/marketing/transaction'

const seed = await seedRelationship(), { payload } = seed
for (const collection of ['commercial-audit', 'commercial-inbox', 'transaction-events', 'transactions'] as const) assert.equal((await payload.count({ collection, overrideAccess: true })).totalDocs, 0, 'Fixture de retenção comercial exige tabelas sintéticas vazias.')
const secret = 'synthetic-retention-secret-'.padEnd(48, 'x')
const createdAt = Date.now(), cleanupNow = createdAt + 30 * 86_400_000
const old = await payload.create({ collection: 'privacy-request-audit', overrideAccess: true, data: { subjectFingerprint: randomUUID().replaceAll('-', '').repeat(2), action: 'export', outcome: 'completed', counts: { contacts: 1 }, actor: seed.owner.id, occurredAt: new Date(cleanupNow - 2 * 365 * 86_400_000 - 86_400_000).toISOString() } })
const recent = await payload.create({ collection: 'privacy-request-audit', overrideAccess: true, data: { subjectFingerprint: randomUUID().replaceAll('-', '').repeat(2), action: 'delete', outcome: 'completed', counts: { contacts: 1 }, actor: seed.owner.id, occurredAt: new Date(cleanupNow - 365 * 86_400_000).toISOString() } })
const expiredSuppression = await payload.create({ collection: 'marketing-suppression-tombstones', overrideAccess: true, data: { fingerprint: randomUUID().replaceAll('-', '').repeat(2), expiresAt: new Date(cleanupNow - 1).toISOString() } })
const activeSuppression = await payload.create({ collection: 'marketing-suppression-tombstones', overrideAccess: true, data: { fingerprint: randomUUID().replaceAll('-', '').repeat(2), expiresAt: new Date(cleanupNow + 365 * 86_400_000).toISOString() } })
const request = async (label: string) => {
  const email = `retention-${label}-${randomUUID()}@example.com`
  await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: false }, secret, createdAt)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  const row = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  return { contact, row }
}
const abandoned = await request('abandoned')
const inFlight = await request('inflight')
const inFlightDelivery = (await payload.find({ collection: 'email-deliveries', where: { request: { equals: inFlight.row.id } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
await payload.update({ collection: 'email-deliveries', id: inFlightDelivery.id, data: { state: 'uncertain' }, overrideAccess: true })
const referenced = await request('referenced')
await payload.create({ collection: 'subscriptions', data: { contact: referenced.contact.id, theme: seed.theme.id, key: `${referenced.contact.id}:${seed.theme.id}`, state: 'unsubscribed' }, overrideAccess: true })
const suppressed = await request('suppressed')
await payload.update({ collection: 'contacts', id: suppressed.contact.id, data: { globalSuppressedAt: new Date(createdAt).toISOString() }, overrideAccess: true })
await retainSuppressionTombstone(payload,suppressed.contact.email,secret,createdAt)
const recentRequest = await request('recent')
await payload.update({ collection: 'magnet-requests', id: recentRequest.row.id, data: { createdAt: new Date(cleanupNow - 86_400_000).toISOString() } as never, overrideAccess: true })
const expiredPreference = await payload.create({ collection: 'preference-tokens', overrideAccess: true, data: { contact: abandoned.contact.id, tokenHash: randomUUID().replaceAll('-', '').repeat(2), expiresAt: new Date(cleanupNow - 1).toISOString() } })
const activePreference = await payload.create({ collection: 'preference-tokens', overrideAccess: true, data: { contact: recentRequest.contact.id, tokenHash: randomUUID().replaceAll('-', '').repeat(2), expiresAt: new Date(cleanupNow + 86_400_000).toISOString() } })
const oldCommercialAuditAt = new Date(cleanupNow - 3 * 365 * 86_400_000).toISOString()
const inbox = async (state: 'applied' | 'needs_review', conflicted = false, needsReview = false) => {
  const transaction = needsReview ? await payload.create({ collection: 'transactions', overrideAccess: true, data: { key: randomUUID().replaceAll('-', '').repeat(2), provider: 'hotmart', accountKey: 'synthetic', externalTransactionId: randomUUID(), externalProductId: 'synthetic-product', ebook: seed.books[0].id, offer: seed.offers[0].id, state: 'approved', currency: 'BRL', needsReview: true, reviewReason: 'synthetic_review' } }) : null
  const receipt = await payload.create({ collection: 'commercial-inbox', overrideAccess: true, data: { key: randomUUID().replaceAll('-', '').repeat(2), provider: 'hotmart', accountKey: 'synthetic', eventKey: randomUUID(), adapterVersion: 'synthetic-v1', envelopeHash: randomUUID().replaceAll('-', '').repeat(2), envelope: { synthetic: true }, transactionKey: transaction?.key, kind: 'event', state, receivedAt: oldCommercialAuditAt, nextAttemptAt: oldCommercialAuditAt, processedAt: oldCommercialAuditAt, attempts: 1, attemptBase: 0, conflicted, transaction: transaction?.id } })
  const audit = await payload.create({ collection: 'commercial-audit', overrideAccess: true, data: { inbox: receipt.id, ...(transaction ? { transaction: transaction.id } : {}), actorType: 'worker', action: 'applied', actor: seed.owner.id, occurredAt: oldCommercialAuditAt, reason: 'synthetic_retention' } })
  return { receipt, audit, transaction }
}
const settledAudit = await inbox('applied')
const settledEvent: NormalizedCommercialEvent = { provider: 'hotmart', accountKey: 'synthetic', eventKey: randomUUID(), externalTransactionId: randomUUID(), externalProductId: 'synthetic-product', externalOfferId: null, kind: 'approved', occurredAt: oldCommercialAuditAt, currency: 'BRL', grossCents: 1000, refundedCents: null, feesCents: null, producerNetCents: null, externalClickReference: null, refundBasis: null, externalRefundId: null, chargebackCents: null }
const settledTransactionKey = commercialTransactionKey(settledEvent), settledKey = commercialEventKey(settledEvent), settledHash = commercialEventDigest(settledEvent)
const settledTransaction = await payload.create({ collection: 'transactions', overrideAccess: true, data: { key: settledTransactionKey, provider: settledEvent.provider, accountKey: settledEvent.accountKey, externalTransactionId: settledEvent.externalTransactionId, externalProductId: settledEvent.externalProductId, ebook: seed.books[0].id, offer: seed.offers[0].id, state: 'approved', currency: 'BRL', grossCents: 1000, needsReview: false } })
await payload.update({ collection: 'commercial-inbox', id: settledAudit.receipt.id, overrideAccess: true, data: { key: settledKey, eventKey: settledEvent.eventKey, envelopeHash: settledHash, envelope: settledEvent, transactionKey: settledTransactionKey, transaction: settledTransaction.id } })
await payload.create({ collection: 'transaction-events', overrideAccess: true, data: { key: settledKey, transaction: settledTransaction.id, inbox: settledAudit.receipt.id, envelope: settledEvent, occurredAt: oldCommercialAuditAt, outcome: 'applied' } })
const unresolvedAudit = await inbox('needs_review')
const conflictedAudit = await inbox('applied', true)
const reviewTransactionAudit = await inbox('applied', false, true)
const recentCommercialAudit = await inbox('applied')
await payload.update({ collection: 'commercial-audit', id: recentCommercialAudit.audit.id, data: { occurredAt: new Date(cleanupNow - 86_400_000).toISOString() }, overrideAccess: true })
await payload.update({ collection: 'commercial-inbox', id: recentCommercialAudit.receipt.id, data: { processedAt: new Date(cleanupNow - 86_400_000).toISOString() }, overrideAccess: true })
const confirmed = await request('confirmed')
await payload.update({ collection: 'magnet-requests', id: confirmed.row.id, data: { confirmedAt: new Date(createdAt).toISOString() }, overrideAccess: true })
try {
  const preview = await runPrivacyRequestAuditRetention(payload, { now: cleanupNow, secret })
  assert.equal(preview.mode, 'preview'); assert.equal(preview.candidates, 1); assert.equal(preview.processed, 0)
  assert.equal(preview.unconfirmedRequests.candidates, 4); assert.equal(preview.unconfirmedRequests.processed, 0)
  assert.deepEqual(preview.expiredSuppressionTombstones, { candidates: 1, processed: 0 })
  assert.deepEqual(preview.expiredPreferenceTokens, { candidates: 1, processed: 0 })
  assert.deepEqual(preview.commercialInboxEnvelopes, { candidates: 4, eligible: 1, processed: 0, preservedForReconciliation: 3 })
  assert.deepEqual(preview.commercialAudit, { candidates: 4, eligible: 1, processed: 0, preservedForReconciliation: 3 })
  assert.equal((await payload.count({ collection: 'privacy-request-audit', overrideAccess: true })).totalDocs, 2)
  assert.equal((await payload.count({ collection: 'preference-tokens', overrideAccess: true })).totalDocs, 2)
  assert.ok(await payload.findByID({ collection: 'magnet-requests', id: abandoned.row.id, overrideAccess: true }))
  const applied = await runPrivacyRequestAuditRetention(payload, { now: cleanupNow, secret, apply: true })
  assert.equal(applied.mode, 'applied'); assert.equal(applied.candidates, 1); assert.equal(applied.processed, 1)
  assert.deepEqual(Object.keys(applied), ['mode', 'cutoff', 'candidates', 'processed', 'unconfirmedRequests', 'expiredSuppressionTombstones', 'expiredPreferenceTokens', 'commercialInboxEnvelopes', 'commercialAudit', 'confirmedSamples', 'suppressedMarketing', 'closedIdentities', 'withdrawnThemes', 'marketingDeadline', 'legacyThemeWithdrawals'])
  assert.deepEqual(Object.keys(applied.unconfirmedRequests), ['candidates', 'processed', 'removedDeliveries', 'canceledPendingDeliveries', 'removedContacts', 'skippedInFlight'])
  assert.deepEqual(applied.expiredSuppressionTombstones, { candidates: 1, processed: 1 })
  assert.deepEqual(applied.expiredPreferenceTokens, { candidates: 1, processed: 1 })
  assert.deepEqual(applied.commercialInboxEnvelopes, { candidates: 4, eligible: 1, processed: 1, preservedForReconciliation: 3 })
  assert.deepEqual(applied.commercialAudit, { candidates: 4, eligible: 1, processed: 1, preservedForReconciliation: 3 })
  await assert.rejects(payload.findByID({ collection: 'commercial-audit', id: settledAudit.audit.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection: 'commercial-audit', id: unresolvedAudit.audit.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection: 'commercial-audit', id: conflictedAudit.audit.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection: 'commercial-audit', id: reviewTransactionAudit.audit.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection: 'commercial-audit', id: recentCommercialAudit.audit.id, overrideAccess: true }))
  const redactedInbox = await payload.findByID({ collection: 'commercial-inbox', id: settledAudit.receipt.id, overrideAccess: true })
  assert.equal(redactedInbox.envelope, null)
  const retainedFact = (await payload.find({ collection: 'transaction-events', where: { inbox: { equals: settledAudit.receipt.id } }, limit: 1, overrideAccess: true })).docs[0]
  assert.deepEqual(retainedFact.envelope, settledEvent)
  assert.deepEqual(await processCommercialInbox(payload, settledAudit.receipt.id), { state: 'applied' })
  const context = await atomic(payload, req => transactionReviewContext(payload, reviewChoice({ provider: 'hotmart', accountKey: 'synthetic', externalTransactionId: settledEvent.externalTransactionId, action: 'hold', selections: [] }), req))
  assert.ok(context.receipts.some(receipt => receipt.id === settledAudit.receipt.id && receipt.variants.some(variant => variant.hash === settledHash && variant.event.kind === 'approved')))
  await assert.rejects(payload.findByID({ collection: 'preference-tokens', id: expiredPreference.id, overrideAccess: true }))
  assert.equal((await payload.findByID({ collection: 'preference-tokens', id: activePreference.id, overrideAccess: true })).tokenHash, activePreference.tokenHash)
  await assert.rejects(payload.findByID({ collection: 'marketing-suppression-tombstones', id: expiredSuppression.id, overrideAccess: true }))
  assert.equal((await payload.findByID({ collection: 'marketing-suppression-tombstones', id: activeSuppression.id, overrideAccess: true })).fingerprint, activeSuppression.fingerprint)
  assert.equal(applied.unconfirmedRequests.processed, 3)
  assert.equal(applied.unconfirmedRequests.canceledPendingDeliveries, 3)
  assert.equal(applied.unconfirmedRequests.removedContacts, 1)
  assert.equal(applied.unconfirmedRequests.skippedInFlight, 1)
  await assert.rejects(payload.findByID({ collection: 'magnet-requests', id: abandoned.row.id, overrideAccess: true }))
  await assert.rejects(payload.findByID({ collection: 'contacts', id: abandoned.contact.id, overrideAccess: true }))
  await assert.rejects(payload.findByID({ collection: 'magnet-requests', id: referenced.row.id, overrideAccess: true }))
  assert.equal((await payload.findByID({ collection: 'contacts', id: referenced.contact.id, overrideAccess: true })).email, referenced.contact.email)
  assert.equal((await payload.count({ collection: 'subscriptions', where: { contact: { equals: referenced.contact.id } }, overrideAccess: true })).totalDocs, 1)
  await assert.rejects(payload.findByID({ collection: 'magnet-requests', id: suppressed.row.id, overrideAccess: true }))
  await assert.rejects(payload.findByID({ collection: 'contacts', id: suppressed.contact.id, overrideAccess: true }))
  assert.equal(applied.closedIdentities.removedContacts,1)
  assert.equal((await payload.count({collection:'contact-retirements',overrideAccess:true})).totalDocs,1)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: inFlightDelivery.id, overrideAccess: true })).state, 'uncertain')
  assert.ok(await payload.findByID({ collection: 'magnet-requests', id: inFlight.row.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection: 'magnet-requests', id: recentRequest.row.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection: 'magnet-requests', id: confirmed.row.id, overrideAccess: true }))
  await assert.rejects(payload.findByID({ collection: 'privacy-request-audit', id: old.id, overrideAccess: true }))
  assert.equal((await payload.findByID({ collection: 'privacy-request-audit', id: recent.id, overrideAccess: true })).action, 'delete')
  const retried = await runPrivacyRequestAuditRetention(payload, { now: cleanupNow, secret, apply: true })
  assert.equal(retried.candidates, 0); assert.equal(retried.processed, 0)
  assert.equal(retried.unconfirmedRequests.processed, 0)
  assert.equal(retried.unconfirmedRequests.skippedInFlight, 1)
  assert.equal(retried.expiredSuppressionTombstones.processed, 0)
  assert.equal(retried.expiredPreferenceTokens.processed, 0)
  assert.deepEqual(retried.commercialInboxEnvelopes, { candidates: 3, eligible: 0, processed: 0, preservedForReconciliation: 3 })
  assert.deepEqual(retried.commercialAudit, { candidates: 3, eligible: 0, processed: 0, preservedForReconciliation: 3 })
  const backlogContact = await payload.create({ collection: 'contacts', overrideAccess: true, data: { email: `backlog-${randomUUID()}@example.invalid`, deliveryState: 'ok' } })
  const blockedAt = new Date(cleanupNow - 20 * 86_400_000).toISOString(), eligibleAt = new Date(cleanupNow - 10 * 86_400_000).toISOString()
  const blockedIds: string[] = []
  for (let index = 0; index < 100; index++) {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    const row = await payload.create({ collection: 'magnet-requests', overrideAccess: true, data: { id, contact: backlogContact.id, magnet: seed.magnet.id, theme: seed.theme.id, magnetVersion: seed.magnet.version, marketingOptIn: false, expiresAt: blockedAt, createdAt: blockedAt } as never })
    blockedIds.push(row.id)
    await payload.create({ collection: 'email-deliveries', overrideAccess: true, data: { key: `confirmation:${row.id}`, contact: backlogContact.id, request: row.id, kind: 'confirmation', state: index % 2 ? 'sending' : 'uncertain', attempts: 1, nextAttemptAt: blockedAt } })
  }
  const behindBacklog = await payload.create({ collection: 'magnet-requests', overrideAccess: true, data: { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', contact: backlogContact.id, magnet: seed.magnet.id, theme: seed.theme.id, magnetVersion: seed.magnet.version, marketingOptIn: false, expiresAt: eligibleAt, createdAt: eligibleAt } as never })
  const behindDelivery = await payload.create({ collection: 'email-deliveries', overrideAccess: true, data: { key: `confirmation:${behindBacklog.id}`, contact: backlogContact.id, request: behindBacklog.id, kind: 'confirmation', state: 'pending', attempts: 0, nextAttemptAt: eligibleAt } })
  const behindEvent = await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: backlogContact.id, theme: seed.theme.id, purpose: 'sample', action: 'requested', occurredAt: eligibleAt, key: `requested:${behindBacklog.id}` } })
  const backlogPreview = await runPrivacyRequestAuditRetention(payload, { now: cleanupNow, secret })
  assert.equal(backlogPreview.unconfirmedRequests.candidates, 102)
  assert.equal(backlogPreview.unconfirmedRequests.processed, 0)
  assert.ok(await payload.findByID({ collection: 'magnet-requests', id: behindBacklog.id, overrideAccess: true }))
  const backlogApplied = await runPrivacyRequestAuditRetention(payload, { now: cleanupNow, secret, apply: true })
  assert.deepEqual(backlogApplied.unconfirmedRequests, { candidates: 102, processed: 1, removedDeliveries: 1, canceledPendingDeliveries: 1, removedContacts: 0, skippedInFlight: 101 })
  for (const [collection, id] of [['magnet-requests', behindBacklog.id], ['email-deliveries', behindDelivery.id], ['consent-events', behindEvent.id]] as const) await assert.rejects(payload.findByID({ collection, id, overrideAccess: true }))
  assert.equal((await payload.count({ collection: 'magnet-requests', where: { id: { in: blockedIds } }, overrideAccess: true })).totalDocs, 100)
  assert.equal((await payload.count({ collection: 'email-deliveries', where: { and: [{ contact: { equals: backlogContact.id } }, { state: { in: ['sending', 'uncertain'] } }] }, overrideAccess: true })).totalDocs, 100)
  assert.ok(await payload.findByID({ collection: 'contacts', id: backlogContact.id, overrideAccess: true }))
  const backlogRepeat = await runPrivacyRequestAuditRetention(payload, { now: cleanupNow, secret, apply: true })
  assert.equal(backlogRepeat.unconfirmedRequests.processed, 0)
  assert.equal(backlogRepeat.unconfirmedRequests.skippedInFlight, 101)
  await mkdir('artifacts/privacy-retention', { recursive: true })
  await writeFile('artifacts/privacy-retention/d103-results.json', JSON.stringify({ date: '2026-10-25 America/Belem', environment: 'PostgreSQL local sintético; sem dados pessoais reais', checks: ['preview sem escrita e relatório sem identificadores pessoais', 'cutoff UTC de 24 meses para auditoria', 'expurgo seletivo/idempotente da auditoria', 'pedidos não confirmados após sete dias removem outbox pendente e evento associado', 'sending/uncertain retém pedido para conciliação', 'solicitações recentes/confirmadas preservadas', 'contatos com referência ou supressão preservados; identidade órfã removida', 'tombstone HMAC expirado é removido e tombstone ativo é preservado', 'token de preferências expirado é removido antes de avaliar vínculos; token ativo é preservado', 'auditoria comercial resolvida expira após 24 meses', 'auditoria de inbox não resolvido ou conflitante é preservada', 'auditoria ligada a transação ainda em revisão e registro recente são preservados', 'envelope da inbox expira após 90 dias somente com ledger normalizado íntegro', 'replay e revisão reconstroem envelope pelo ledger sem restaurar cópia da inbox', 'conflito, revisão, referência incompleta e envelope recente são preservados', 'preview de backlog com 102 candidatos sem escrita', '100 casos retidos na primeira página não impedem expurgo posterior', 'reexecução preserva 101 envios em andamento/incertos sem repetir exclusão'], syntheticRecords: true, externalCalls: false, messagesSent: 0 }, null, 2) + '\n')
  console.log('Retenção de privacidade: 18 verificações aprovadas.')
} finally {
  await payload.delete({ collection: 'commercial-audit', where: { id: { exists: true } }, overrideAccess: true })
  await payload.delete({ collection: 'transaction-events', where: { id: { exists: true } }, overrideAccess: true })
  await payload.delete({ collection: 'commercial-inbox', where: { id: { exists: true } }, overrideAccess: true })
  await payload.delete({ collection: 'transactions', where: { id: { exists: true } }, overrideAccess: true })
  await seed.cleanup()
}
process.exit(0)

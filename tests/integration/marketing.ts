import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { samplePDF } from '../fixtures/pdf'
import { seedSite } from '../fixtures/site'
import { confirmMagnet, LeadFlowError, requestMagnet, unsubscribe } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { dispatchEmail } from '../../src/modules/marketing/dispatcher'
import { createOpaqueToken, hashOpaqueToken } from '../../src/modules/marketing/tokens'
import { CONSENT_VERSION, type LeadInput } from '../../src/modules/marketing/validation'
import { applySuppression } from '../../src/modules/marketing/suppression'
import { atomic } from '../../src/modules/marketing/transaction'
import { reserveMailQuota } from '../../src/modules/marketing/quota'
import type { CollectionSlug } from 'payload'

const seed = await seedSite(), { payload } = seed
const secret = randomBytes(32).toString('hex'), suffix = randomBytes(5).toString('hex'), now = Date.now()
const contacts: string[] = []
let isolated = false
let mediaId: string | undefined, magnetId: string | undefined
const checks: string[] = []
try {
  for (const collection of ['privacy-request-audit', 'marketing-suppression-tombstones', 'contact-retirements', 'theme-withdrawals', 'preference-tokens', 'consent-events', 'subscriptions', 'magnet-requests', 'brevo-registrations', 'brevo-suppressions', 'contacts', 'email-deliveries', 'mail-quota', 'request-limits', 'payload-jobs', 'email-sequences', 'sequence-enrollments', 'promotion-deliveries'] as const) assert.equal((await payload.count({ collection, overrideAccess: true })).totalDocs, 0, `Use banco operacional vazio: ${collection}.`)
  isolated = true
  const bytes = samplePDF()
  const media = await payload.create({ collection: 'media', ...seed.auth, data: { alt: 'PDF sintético de teste', presentationRole: 'sample', visibility: 'private' }, file: { data: bytes, size: bytes.length, name: 'sample.pdf', mimetype: 'application/pdf' } })
  mediaId = media.id
  const magnet = await payload.create({ collection: 'lead-magnets', ...seed.auth, data: { title: 'Amostra sintética', slug: `amostra-${suffix}`, ebook: seed.books[0].id, media: media.id, version: 'test-v1', active: true } })
  magnetId = magnet.id
  async function request(name: string, marketingOptIn: boolean) {
    const email = `${name}-${suffix}@example.invalid`
    const input: LeadInput = { email, magnetId: magnet.id, marketingOptIn, ...(marketingOptIn ? { consentVersion: CONSENT_VERSION } : {}) }
    await Promise.all([requestMagnet(payload, input, secret, now), requestMagnet(payload, input, secret, now)])
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
    contacts.push(contact.id)
    const requests = await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, depth: 0, overrideAccess: true })
    assert.equal(requests.totalDocs, 1)
    const delivery = (await payload.find({ collection: 'email-deliveries', where: { request: { equals: requests.docs[0].id } }, depth: 0, overrideAccess: true })).docs[0]
    return { contact, request: requests.docs[0], delivery, input }
  }
  const basic = await request('sem-marketing', false)
  assert.equal((await payload.count({ collection: 'subscriptions', overrideAccess: true })).totalDocs, 0)
  let sends = 0, token = ''
  const transport = async (message: { text: string }) => {
    sends++
    token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''
    assert.ok(token)
    return { state: 'sent' as const, messageId: 'synthetic-confirmation' }
  }
  const options = { transport, secret, origin: 'http://127.0.0.1:3000', now }
  await Promise.all([processDelivery(payload, basic.delivery.id, options), processDelivery(payload, basic.delivery.id, options)])
  assert.equal(sends, 1)
  const stored = await payload.findByID({ collection: 'magnet-requests', id: basic.request.id, depth: 0, overrideAccess: true })
  assert.equal(stored.confirmationTokenHash, hashOpaqueToken(token))
  assert.equal(JSON.stringify(stored).includes(token), false)
  const confirmed = await Promise.all([confirmMagnet(payload, token, secret, now), confirmMagnet(payload, token, secret, now)])
  assert.ok(confirmed.every(r => r.downloadUrl.startsWith('/api/v1/downloads/')))
  assert.equal((await payload.count({ collection: 'subscriptions', overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'email-deliveries', where: { and: [{ request: { equals: basic.request.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })).totalDocs, 1)
  await assert.rejects(confirmMagnet(payload, token, secret, now + 86_400_000), e => e instanceof LeadFlowError && e.status === 410)
  await assert.rejects(confirmMagnet(payload, createOpaqueToken().token, secret, now), e => e instanceof LeadFlowError && e.status === 410)
  checks.push('pedido concorrente deduplicado; envio concorrente único; hash sem token; confirmação idempotente; amostra sem marketing; expiração')

  const opted = await request('com-marketing', true)
  await processDelivery(payload, opted.delivery.id, options)
  await confirmMagnet(payload, token, secret, now)
  const sub = (await payload.find({ collection: 'subscriptions', where: { contact: { equals: opted.contact.id } }, depth: 0, overrideAccess: true })).docs[0]
  assert.equal(sub.state, 'subscribed')
  const sampleDelivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: opted.request.id } }, { kind: { equals: 'delivery' } }] }, depth: 0, overrideAccess: true })).docs[0]
  let preference = ''
  await processDelivery(payload, sampleDelivery.id, { ...options, transport: async message => {
    preference = /\/preferencias\?t=([\w-]+)/.exec(message.text)?.[1] || ''
    assert.ok(preference)
    return { state: 'sent', messageId: 'synthetic-sample' }
  } })
  await Promise.all([unsubscribe(payload, preference, now, secret), unsubscribe(payload, preference, now, secret)])
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: sub.id, overrideAccess: true })).state, 'unsubscribed')
  await confirmMagnet(payload, token, secret, now + 1)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: sub.id, overrideAccess: true })).state, 'unsubscribed')
  const bounce = await request('bounce', false)
  const reviewedBounce = { email: bounce.input.email, reason: 'bounced' as const, source: 'brevo-review' as const, reference: `synthetic-bounce-${suffix}` }
  const applied = await Promise.all([applySuppression(payload, reviewedBounce, secret, now), applySuppression(payload, reviewedBounce, secret, now)])
  assert.equal(applied.filter(result => result.applied).length, 1)
  assert.equal(applied.reduce((count, result) => count + result.canceledPending, 0), 1)
  await processDelivery(payload, bounce.delivery.id, options)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: bounce.delivery.id, overrideAccess: true })).state, 'canceled')
  checks.push('opt-in confirmado; descadastro idempotente; confirmação antiga não reinscreve; bounce bloqueia entrega')

  const beforeConflict = (await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs
  await assert.rejects(applySuppression(payload, { ...reviewedBounce, email: `conflito-${suffix}@example.invalid` }, secret, now), e => e instanceof LeadFlowError && e.status === 422)
  await assert.rejects(applySuppression(payload, { ...reviewedBounce, reason: 'complaint' }, secret, now), e => e instanceof LeadFlowError && e.status === 422)
  assert.equal((await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs, beforeConflict)
  const event = (await payload.find({ collection: 'consent-events', where: { and: [{ contact: { equals: bounce.contact.id } }, { action: { equals: 'bounced' } }] }, overrideAccess: true })).docs[0]
  assert.ok(event.key.startsWith('suppression:brevo-review:'))
  assert.equal(event.key.includes(reviewedBounce.reference), false)
  assert.equal(event.key.includes(bounce.input.email), false)
  await applySuppression(payload, { ...reviewedBounce, reason: 'complaint', reference: `synthetic-complaint-${suffix}` }, secret, now + 1)
  await applySuppression(payload, { ...reviewedBounce, reference: `synthetic-second-bounce-${suffix}` }, secret, now + 2)
  assert.equal((await payload.findByID({ collection: 'contacts', id: bounce.contact.id, overrideAccess: true })).deliveryState, 'complaint')
  const unknownEmail = `unknown-blocked-${suffix}@example.invalid`
  await applySuppression(payload, { email: unknownEmail, reason: 'bounced', source: 'manual', reference: `synthetic-unknown-${suffix}` }, secret, now)
  const unknownContact = (await payload.find({ collection: 'contacts', where: { email: { equals: unknownEmail } }, overrideAccess: true })).docs[0]
  contacts.push(unknownContact.id)
  await requestMagnet(payload, { email: unknownEmail, magnetId: magnet.id, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, now)
  assert.equal((await payload.count({ collection: 'magnet-requests', where: { contact: { equals: unknownContact.id } }, overrideAccess: true })).totalDocs, 0)
  checks.push('supressão concorrente idempotente; referência conflitante rejeitada sem mutação; auditoria sem referência bruta; complaint não rebaixado; contato desconhecido não reativado')

  const manual = await request('manual-unsubscribe', true)
  await processDelivery(payload, manual.delivery.id, options)
  const manualToken = token
  await confirmMagnet(payload, manualToken, secret, now)
  const manualSample = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: manual.request.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })).docs[0]
  const manualResult = await applySuppression(payload, { email: manual.input.email, reason: 'unsubscribed', source: 'manual', reference: `synthetic-unsubscribe-${suffix}` }, secret, now + 1)
  assert.equal(manualResult.canceledPending, 0)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: manualSample.id, overrideAccess: true })).state, 'pending')
  assert.equal((await payload.find({ collection: 'subscriptions', where: { contact: { equals: manual.contact.id } }, overrideAccess: true })).docs[0].state, 'unsubscribed')
  await confirmMagnet(payload, manualToken, secret, now + 2)
  assert.equal((await payload.find({ collection: 'subscriptions', where: { contact: { equals: manual.contact.id } }, overrideAccess: true })).docs[0].state, 'unsubscribed')
  await processDelivery(payload, manualSample.id, { ...options, transport: async () => ({ state: 'sent', messageId: 'synthetic-after-unsubscribe' }) })
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: manualSample.id, overrideAccess: true })).state, 'sent')
  const inflight = await request('already-sending', false)
  await payload.update({ collection: 'email-deliveries', id: inflight.delivery.id, data: { state: 'sending', startedAt: new Date(now).toISOString(), attempts: 1 }, overrideAccess: true })
  const inflightResult = await applySuppression(payload, { email: inflight.input.email, reason: 'complaint', source: 'brevo-review', reference: `synthetic-inflight-${suffix}` }, secret, now)
  assert.equal(inflightResult.inFlight, 1)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: inflight.delivery.id, overrideAccess: true })).state, 'sending')
  checks.push('descadastro revisado preserva amostra e cancela assinatura; confirmação antiga não reinscreve; envio já iniciado permanece em conciliação')
  const oldPending = await request('old-pending-optin', true)
  await processDelivery(payload, oldPending.delivery.id, options)
  const oldPendingToken = token, suppressedAt = Date.now() + 1
  await applySuppression(payload, { email: oldPending.input.email, reason: 'unsubscribed', source: 'manual', reference: `synthetic-old-pending-${suffix}` }, secret, suppressedAt)
  await confirmMagnet(payload, oldPendingToken, secret, suppressedAt + 1)
  assert.equal((await payload.count({ collection: 'subscriptions', where: { contact: { equals: oldPending.contact.id } }, overrideAccess: true })).totalDocs, 0, 'Confirmação pendente anterior ao descadastro não pode inscrever marketing.')
  assert.equal((await payload.count({ collection: 'email-deliveries', where: { and: [{ request: { equals: oldPending.request.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })).totalDocs, 1)
  const racingEmail = `capture-vs-suppression-${suffix}@example.invalid`
  await Promise.all([
    requestMagnet(payload, { email: racingEmail, magnetId: magnet.id, marketingOptIn: false }, secret, now),
    applySuppression(payload, { email: racingEmail, reason: 'bounced', source: 'manual', reference: `synthetic-capture-race-${suffix}` }, secret, now),
  ])
  const racingContacts = await payload.find({ collection: 'contacts', where: { email: { equals: racingEmail } }, overrideAccess: true })
  assert.equal(racingContacts.totalDocs, 1)
  contacts.push(racingContacts.docs[0].id)
  assert.equal(racingContacts.docs[0].deliveryState, 'bounced')
  const racingDeliveries = await payload.find({ collection: 'email-deliveries', where: { contact: { equals: racingContacts.docs[0].id } }, overrideAccess: true })
  assert.ok(racingDeliveries.docs.every(delivery => delivery.state === 'canceled'))
  checks.push('confirmação ainda pendente após descadastro entrega somente amostra; captura e supressão concorrentes mantêm um contato e nenhuma entrega liberada')
  const withdrawn = await request('retirou-optin', true)
  await requestMagnet(payload, { ...withdrawn.input, marketingOptIn: false }, secret, now + 1)
  assert.equal((await payload.findByID({ collection: 'magnet-requests', id: withdrawn.request.id, overrideAccess: true })).marketingOptIn, false)
  await processDelivery(payload, withdrawn.delivery.id, options)
  await confirmMagnet(payload, token, secret, now + 1)
  assert.equal((await payload.count({ collection: 'subscriptions', where: { contact: { equals: withdrawn.contact.id } }, overrideAccess: true })).totalDocs, 0)
  const noUpgrade = await request('sem-upgrade-implicito', false)
  await requestMagnet(payload, { ...noUpgrade.input, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, now + 1)
  assert.equal((await payload.findByID({ collection: 'magnet-requests', id: noUpgrade.request.id, overrideAccess: true })).marketingOptIn, false)
  checks.push('retirada do opt-in pendente respeitada; pedido repetido não eleva consentimento silenciosamente')

  const uncertain = await request('timeout', false)
  let uncertainCalls = 0
  const quotaForNow = async () => (await payload.find({ collection: 'mail-quota', where: { day: { equals: new Date(now).toISOString().slice(0, 10) } }, overrideAccess: true })).docs[0]?.reserved ?? 0
  const beforeUncertain = await quotaForNow()
  await processDelivery(payload, uncertain.delivery.id, { ...options, transport: async () => { uncertainCalls++; throw new Error('synthetic timeout') } })
  assert.equal(await quotaForNow(), beforeUncertain + 1, 'Tentativa incerta mantém a capacidade reservada.')
  await processDelivery(payload, uncertain.delivery.id, options)
  assert.equal(await quotaForNow(), beforeUncertain + 1, 'Retomada não pode reenviar nem duplicar a reserva.')
  assert.equal(uncertainCalls, 1)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: uncertain.delivery.id, overrideAccess: true })).state, 'uncertain')
  const limited = await request('quota', false)
  await processDelivery(payload, limited.delivery.id, { ...options, quota: 1 })
  const delayed = await payload.findByID({ collection: 'email-deliveries', id: limited.delivery.id, overrideAccess: true })
  assert.equal(delayed.state, 'pending'); assert.equal(delayed.errorCode, 'quota')
  assert.ok(Date.parse(delayed.nextAttemptAt) > now)
  const retry = await request('retry', false)
  await processDelivery(payload, retry.delivery.id, { ...options, transport: async () => ({ state: 'retry' }) })
  const retried = await payload.findByID({ collection: 'email-deliveries', id: retry.delivery.id, overrideAccess: true })
  assert.equal(retried.state, 'pending'); assert.equal(retried.attempts, 1); assert.equal(Date.parse(retried.nextAttemptAt), now + 60_000)
  let nextAttempt = now + 60_000
  for (const delay of [300_000, 1_800_000, 7_200_000, 0]) {
    await processDelivery(payload, retry.delivery.id, { ...options, now: nextAttempt, transport: async () => ({ state: 'retry' }) })
    nextAttempt += delay
  }
  const exhausted = await payload.findByID({ collection: 'email-deliveries', id: retry.delivery.id, overrideAccess: true })
  assert.equal(exhausted.state, 'failed'); assert.equal(exhausted.attempts, 5)
  await processDelivery(payload, retry.delivery.id, options)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: retry.delivery.id, overrideAccess: true })).attempts, 5)
  checks.push('timeout incerto não reenvia; quota adia sem tentativa; retentativas em 1/5/30/120 minutos e limite total de cinco')
  await dispatchEmail(payload, now)
  const queued = (await payload.count({ collection: 'payload-jobs', overrideAccess: true })).totalDocs
  await dispatchEmail(payload, now)
  assert.ok(queued > 0)
  assert.equal((await payload.count({ collection: 'payload-jobs', overrideAccess: true })).totalDocs, queued)
  const abandoned = (await payload.find({ collection: 'payload-jobs', limit: 1, depth: 0, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'payload-jobs', id: abandoned.id, data: { processing: true }, overrideAccess: true })
  await dispatchEmail(payload, now)
  assert.equal((await payload.count({ collection: 'payload-jobs', overrideAccess: true })).totalDocs, queued + 1, 'Job abandonado antes do claim não pode bloquear o outbox.')
  checks.push('queda do job antes do claim permite recuperar a entrega pendente')
  const dayBucket = (await payload.find({ collection: 'request-limits', where: { key: { equals: `global-day:${new Date(now).toISOString().slice(0, 10)}` } }, overrideAccess: true })).docs[0]
  const hourBucket = (await payload.find({ collection: 'request-limits', where: { key: { equals: `global-hour:${new Date(now).toISOString().slice(0, 13)}` } }, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'request-limits', id: dayBucket.id, data: { count: 1000 }, overrideAccess: true })
  const countBefore = (await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs
  await assert.rejects(requestMagnet(payload, { email: `limitado-${suffix}@example.invalid`, magnetId: magnet.id, marketingOptIn: false }, secret, now), e => e instanceof LeadFlowError && e.status === 429)
  assert.equal((await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs, countBefore)
  assert.equal((await payload.findByID({ collection: 'request-limits', id: hourBucket.id, overrideAccess: true })).count, hourBucket.count, 'Falha no limite diário deve reverter o incremento horário.')
  checks.push('limite global durável rejeita novos endereços e reverte alterações na mesma transação')
  for (const collection of ['contacts', 'subscriptions', 'consent-events', 'magnet-requests', 'email-deliveries', 'preference-tokens', 'payload-jobs', 'mail-quota'] as const) await assert.rejects(payload.find({ collection, user: null, overrideAccess: false }))
  await assert.rejects(payload.update({ collection: 'consent-events', where: { contact: { equals: basic.contact.id } }, data: { action: 'unsubscribed' }, ...seed.auth }))
  checks.push('outbox recuperável; dispatcher repetido; APIs operacionais negadas a anônimo; consentimento imutável via owner')

  // No outbound transport: reserve recipients concurrently in the same shared ledger.
  const quotaNow = Date.parse('2030-01-01T23:59:59Z'), policy = { limit: 10, transactionalReserve: 3 }
  const reserve = (kind: 'transactional' | 'promotional', count: number, at = quotaNow) => atomic(payload, req => reserveMailQuota(req, { kind, count, now: at, policy }))
  const promotions = await Promise.all(Array.from({ length: 20 }, () => reserve('promotional', 1)))
  assert.equal(promotions.filter(result => result.granted).length, 7)
  const confirmations = await Promise.all(Array.from({ length: 8 }, () => reserve('transactional', 1)))
  assert.equal(confirmations.filter(result => result.granted).length, 3)
  assert.equal((await payload.find({ collection: 'mail-quota', where: { day: { equals: '2030-01-01' } }, overrideAccess: true })).docs[0].reserved, 10)
  assert.equal((await reserve('promotional', 1)).granted, false)
  assert.equal((await reserve('transactional', 1)).granted, false)
  const tomorrow = Date.parse('2030-01-02T00:00:00Z')
  await assert.rejects(atomic(payload, async req => {
    assert.equal((await reserveMailQuota(req, { kind: 'promotional', count: 7, now: tomorrow, policy })).granted, true)
    throw new Error('synthetic rollback')
  }), /synthetic rollback/)
  assert.equal((await payload.count({ collection: 'mail-quota', where: { day: { equals: '2030-01-02' } }, overrideAccess: true })).totalDocs, 0)
  assert.equal((await reserve('promotional', 8, tomorrow)).granted, false, 'Lote não deve reservar parcialmente.')
  assert.equal((await reserve('promotional', 7, tomorrow)).granted, true)
  assert.equal((await reserve('transactional', 3, tomorrow)).granted, true)
  assert.equal((await reserve('transactional', 1, tomorrow)).nextDayAt, '2030-01-03T00:00:00.000Z')
  await assert.rejects(payload.update({ collection: 'mail-quota', where: { day: { equals: '2030-01-01' } }, data: { reserved: 0 }, ...seed.auth }))
  checks.push('quota compartilhada concorrente: reserva transacional preservada; limite não excedido; lote indivisível; rollback e virada UTC sem liberar tentativa incerta')
  await mkdir('artifacts/marketing', { recursive: true })
  await writeFile('artifacts/marketing/local-results.json', JSON.stringify({ date: '2026-10-21 America/Belem', environment: 'PostgreSQL local e transporte sintético em memória', checks, externalEmailSent: false, limits: 'Não homologa Brevo, campanhas promocionais, quota da conta ou supressão externa.' }, null, 2))
  console.log(`Relacionamento: ${checks.length} grupos de cenários aprovados; nenhum e-mail externo enviado.`)
} finally {
  // All operational tables were required empty before this isolated fixture was created.
  if (isolated) {
  for (const collection of ['marketing-suppression-tombstones', 'contact-retirements', 'theme-withdrawals', 'brevo-registrations', 'brevo-suppressions', 'payload-jobs', 'preference-tokens', 'consent-events', 'email-deliveries', 'subscriptions', 'magnet-requests'] as CollectionSlug[]) {
    await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true })
  }
  for (const id of contacts) await payload.delete({ collection: 'contacts', id, overrideAccess: true })
  for (const collection of ['request-limits', 'mail-quota'] as const) await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true })
  if (magnetId) await payload.delete({ collection: 'lead-magnets', id: magnetId, overrideAccess: true })
  if (mediaId) await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
  }
  await seed.cleanup()
}
process.exit(0)

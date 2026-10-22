import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet, confirmMagnet } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { sequenceDays } from '../../src/modules/marketing/sequence-copy'
import { preparePromotionBatches, claimPromotionBatch as claimWithProvider } from '../../src/modules/marketing/batches'
import { readBatchMembers } from '../../src/modules/marketing/batch-copy'
import { applySuppression } from '../../src/modules/marketing/suppression'

const seed = await seedRelationship(), { payload, magnet } = seed
const secret = randomBytes(32).toString('hex'), suffix = randomBytes(6).toString('hex'), checks: string[] = []
const start = Math.floor(Date.now() / 86_400_000) * 86_400_000 + 12 * 3_600_000
const due = start + 2 * 86_400_000
const providerIds = new Map<string, number>()
const claimPromotionBatch = (cms: typeof payload, id: string, options: Parameters<typeof claimWithProvider>[2] = {}) => claimWithProvider(cms, id, { ...options, secret, client: { inspect: async (email: string) => { if (!providerIds.has(email)) providerIds.set(email, providerIds.size + 1); return { state: 'found', id: providerIds.get(email)!, blocked: false } }, block: async () => { throw new Error('Não escrever no provedor durante preflight.') } } })
try {
  const messages = Object.fromEntries(sequenceDays.map(day => [`day${day}`, { subject: `Assunto sintético ${day}`, text: `Conteúdo manual sintético ${day}.` }]))
  const sequence = await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Lotes exclusivamente sintéticos', magnet: magnet.id, magnetVersion: magnet.version, revision: 1, key: 'server-overwrites-synthetic-key', offer: seed.offers[1].id, active: true, ...messages } })
  async function person(name: string, campaignCode?: string, emailOverride?: string, magnetId = magnet.id) {
    const email = emailOverride || `${name}-${suffix}@example.invalid`
    await requestMagnet(payload, { email, magnetId, marketingOptIn: true, consentVersion: CONSENT_VERSION, ...(campaignCode ? { campaignCode } : {}) }, secret, start)
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
    const request = (await payload.find({ collection: 'magnet-requests', where: { and: [{ contact: { equals: contact.id } }, { magnet: { equals: magnetId } }] }, depth: 0, overrideAccess: true })).docs[0]
    const delivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'confirmation' } }] }, depth: 0, overrideAccess: true })).docs[0]
    let token = ''
    await processDelivery(payload, delivery.id, { secret, origin: 'http://127.0.0.1:3000', now: start, transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-batch-confirmation' } } })
    assert.ok(token)
    await confirmMagnet(payload, token, secret, start)
    return contact
  }
  const first = await person('first'), second = await person('second'), affiliate = await person('affiliate', seed.campaign.code)
  await payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { revision: 2, day2: { subject: 'Nova revisão sintética' } } })
  const revised = await person('revision')
  // A second actual material subscription may share the same reviewed copy.
  const additional = await payload.create({ collection: 'lead-magnets', ...seed.auth, data: { title: 'Segunda amostra sintética', slug: `segunda-${suffix}`, ebook: seed.books[0].id, media: seed.sampleMedia.id, version: 'synthetic-v1', active: true } })
  seed.extraMagnets.push(additional.id)
  await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Cópia sintética equivalente', magnet: additional.id, magnetVersion: additional.version, revision: 1, key: 'server-overwrites-other-key', offer: seed.offers[1].id, active: true, ...messages } })
  await person('same-recipient-other-material', undefined, first.email, additional.id)
  assert.equal((await preparePromotionBatches(payload, due - 1)).batches, 0)

  const hooks = payload.collections['email-campaign-batches'].config.hooks
  const previous = hooks.afterChange
  hooks.afterChange = [...previous, async () => { throw new Error('synthetic batch rollback') }]
  try { await assert.rejects(preparePromotionBatches(payload, due), /synthetic batch rollback/) }
  finally { hooks.afterChange = previous }
  assert.equal((await payload.count({ collection: 'email-campaign-batches', overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'promotion-deliveries', where: { batch: { exists: true } }, overrideAccess: true })).totalDocs, 0)
  checks.push('Falha após criação do lote reverte lote e vínculos; etapas permanecem recuperáveis e não há antecipação.')

  const assembled = await Promise.all([preparePromotionBatches(payload, due), preparePromotionBatches(payload, due)])
  assert.equal(assembled.reduce((sum, result) => sum + result.batches, 0), 3)
  assert.equal(assembled.reduce((sum, result) => sum + result.recipients, 0), 4)
  const batches = (await payload.find({ collection: 'email-campaign-batches', limit: 100, depth: 0, overrideAccess: true })).docs
  assert.equal(batches.length, 3)
  const withContact = (contact: string) => batches.find(batch => readBatchMembers(batch.members)!.some(member => member.contact === contact))!
  const normal = withContact(first.id), affiliated = withContact(affiliate.id), revision = withContact(revised.id)
  assert.equal(normal.id, withContact(second.id).id)
  assert.notEqual(normal.id, affiliated.id); assert.notEqual(normal.id, revision.id)
  assert.equal(normal.recipientCount, 2)
  assert.equal(readBatchMembers(normal.members)!.length, 3)
  assert.ok(batches.every(batch => !JSON.stringify(batch).includes('@example.invalid')))
  assert.equal((await preparePromotionBatches(payload, due)).batches, 0)
  const quotaAt = async (time: number) => (await payload.find({ collection: 'mail-quota', where: { day: { equals: new Date(time).toISOString().slice(0, 10) } }, depth: 0, overrideAccess: true })).docs[0]?.reserved ?? 0
  assert.equal(await quotaAt(due), 0)
  checks.push('Preparação concorrente cria três lotes distintos para revisão/contexto afiliado; dois destinatários da mesma cópia agrupados, sem endereços/tokens ou quota.')

  await assert.rejects(payload.find({ collection: 'email-campaign-batches', overrideAccess: false, user: null }))
  await assert.rejects(payload.update({ collection: 'email-campaign-batches', id: normal.id, ...seed.auth, data: { recipientCount: 1 } }))
  await assert.rejects(payload.create({ collection: 'email-campaign-batches', ...seed.auth, data: { ...normal, id: undefined } }))
  assert.equal((await payload.find({ collection: 'email-campaign-batches', ...seed.auth })).totalDocs, 3)
  checks.push('Coleção privada por Local API: anônimo não lê, owner lê mas não cria/altera estados operacionais.')

  assert.equal((await claimPromotionBatch(payload, normal.id, { now: due, policy: { limit: 2, transactionalReserve: 1 } })).state, 'quota')
  assert.equal(await quotaAt(due), 0)
  const blocked = await payload.findByID({ collection: 'email-campaign-batches', id: normal.id, depth: 0, overrideAccess: true })
  assert.equal(blocked.state, 'prepared')
  assert.equal(blocked.nextAttemptAt, new Date(Math.floor(due / 86_400_000) * 86_400_000 + 86_400_000).toISOString())
  const claims = await Promise.all([claimPromotionBatch(payload, affiliated.id, { now: due, policy: { limit: 3, transactionalReserve: 1 } }), claimPromotionBatch(payload, affiliated.id, { now: due, policy: { limit: 3, transactionalReserve: 1 } })])
  assert.equal(claims.filter(result => result.state === 'claimed').length, 1)
  assert.equal(await quotaAt(due), 1)
  checks.push('Lote indivisível respeita reserva transacional, adia para próximo dia UTC e claim concorrente reserva uma única vez.')

  const original = hooks.afterChange
  hooks.afterChange = [...original, async ({ doc }) => { if (doc.state === 'claimed') throw new Error('synthetic claim rollback'); return doc }]
  try { await assert.rejects(claimPromotionBatch(payload, revision.id, { now: due, policy: { limit: 3, transactionalReserve: 1 } }), /synthetic claim rollback/) }
  finally { hooks.afterChange = original }
  assert.equal(await quotaAt(due), 1)
  assert.equal((await payload.findByID({ collection: 'email-campaign-batches', id: revision.id, depth: 0, overrideAccess: true })).state, 'prepared')
  await applySuppression(payload, { email: revised.email, reason: 'unsubscribed', source: 'manual', reference: `synthetic-batch-${suffix}` }, secret, due)
  assert.equal((await claimPromotionBatch(payload, revision.id, { now: due })).state, 'canceled')
  assert.equal(await quotaAt(due), 1)
  assert.equal((await claimPromotionBatch(payload, normal.id, { now: due + 86_400_000, policy: { limit: 3, transactionalReserve: 1 } })).state, 'claimed')
  assert.equal(await quotaAt(due + 86_400_000), 2)
  checks.push('Falha no claim reverte quota/estado; supressão após preparação cancela antes de reservar; lote adiado é retomado sem dividir destinatários.')

  const seven = start + 7 * 86_400_000
  await preparePromotionBatches(payload, seven)
  const commercial = (await payload.find({ collection: 'email-campaign-batches', where: { and: [{ stage: { equals: '7' } }, { state: { equals: 'prepared' } }] }, depth: 0, limit: 100, overrideAccess: true })).docs.find(batch => readBatchMembers(batch.members)!.some(member => member.contact === affiliate.id))!
  assert.ok(commercial)
  await payload.update({ collection: 'campaigns', id: seed.campaign.id, ...seed.auth, data: { state: 'paused' } })
  assert.equal((await claimPromotionBatch(payload, commercial.id, { now: seven })).state, 'canceled')
  assert.equal(await quotaAt(seven), 0)
  const held = (await payload.find({ collection: 'promotion-deliveries', where: { and: [{ contact: { equals: affiliate.id } }, { stage: { equals: '7' } }] }, depth: 0, overrideAccess: true })).docs[0]
  assert.equal(held.state, 'scheduled'); assert.equal(held.errorCode, 'offer_unavailable'); assert.equal(held.batch, null)
  await payload.update({ collection: 'campaigns', id: seed.campaign.id, ...seed.auth, data: { state: 'active' } })
  await preparePromotionBatches(payload, seven + 900_000)
  assert.ok((await payload.find({ collection: 'promotion-deliveries', where: { id: { equals: held.id } }, depth: 0, overrideAccess: true })).docs[0].batch)
  checks.push('Oferta/campanha revalidada no claim; indisponibilidade cancela lote sem quota e permite novo agrupamento quando recuperada, preservando histórico.')

  await mkdir('artifacts/promotion-batches', { recursive: true })
  await writeFile('artifacts/promotion-batches/local-results.json', JSON.stringify({ date: '2026-10-22 America/Belem', environment: 'PostgreSQL loopback, relógio controlado, fixtures sintéticas e confirmação em memória', checks, promotionalSends: 0, externalCalls: false, limits: 'Agrupamento/claim locais. Sem sincronização/lista/campanha Brevo, envio, aceitação, entrega ou conciliação de resultado incerto. Claim não conectado ao worker.' }, null, 2))
  console.log(`Lotes promocionais: ${checks.length} grupos aprovados; nenhum envio ou chamada externa.`)
} finally { await seed.cleanup() }
process.exit(0)

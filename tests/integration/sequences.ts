import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { seedRelationship } from '../fixtures/relationship'
import { confirmMagnet, requestMagnet, unsubscribe } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { preparePromotions, readSequenceSnapshot } from '../../src/modules/marketing/sequence'
import { dueAt, sequenceDays } from '../../src/modules/marketing/sequence-copy'
import { createOpaqueToken, UNSUBSCRIBE_TTL } from '../../src/modules/marketing/tokens'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { applySuppression } from '../../src/modules/marketing/suppression'
import { mediaDirectory } from '../../src/modules/catalog/storage'

const seed = await seedRelationship(), { payload, magnet } = seed
const secret = randomBytes(32).toString('hex'), suffix = randomBytes(5).toString('hex'), checks: string[] = []
try {
  await assert.rejects(payload.update({ collection: 'media', id: seed.sampleMedia.id, ...seed.auth, data: { alt: 'Tentativa sintética' }, file: { data: seed.pdf, size: seed.pdf.length, name: 'replacement.pdf', mimetype: 'application/pdf' } }), /Arquivo vinculado/)
  assert.deepEqual(await readFile(path.join(mediaDirectory(), seed.sampleMedia.filename!)), seed.pdf)
  await payload.update({ collection: 'media', id: seed.sampleMedia.id, ...seed.auth, data: { alt: 'Amostra sintética com descrição revisada' } })
  await assert.rejects(payload.update({ collection: 'lead-magnets', id: magnet.id, ...seed.auth, data: { ebook: seed.books[1].id } }), /nova versão/)
  const copy = Object.fromEntries(sequenceDays.map(day => [`day${day}`, { subject: `Assunto sintético D+${day}`, text: `Conteúdo revisado sintético do dia ${day}. Sem envio real.` }]))
  const input = { name: 'Sequência exclusivamente sintética', magnet: magnet.id, magnetVersion: magnet.version, revision: 1, offer: seed.offers[0].id, key: 'owner-input-overwritten-by-server', ...copy }
  await assert.rejects(payload.create({ collection: 'email-sequences', ...seed.auth, data: { ...input, active: true, day10: { subject: '', text: '' } } }), /antes de ativar/)
  await assert.rejects(payload.create({ collection: 'email-sequences', ...seed.auth, data: { ...input, active: true, magnetVersion: 'inexistente' } }), /versão ativa/)
  const sequence = await payload.create({ collection: 'email-sequences', ...seed.auth, data: { ...input, active: true } })
  assert.ok(sequence.contentHash)
  assert.notEqual(sequence.key, input.key)
  const getStages = async (contact: string) => (await payload.find({ collection: 'promotion-deliveries', where: { contact: { equals: contact } }, limit: 100, sort: 'dueAt', depth: 0, overrideAccess: true })).docs
  async function pending(name: string, marketingOptIn = true, campaignCode?: string, emailOverride?: string, time = Date.now()) {
    const email = emailOverride || `${name}-${suffix}@example.invalid`
    await requestMagnet(payload, { email, magnetId: magnet.id, marketingOptIn, ...(marketingOptIn ? { consentVersion: CONSENT_VERSION } : {}), ...(campaignCode ? { campaignCode } : {}) }, secret, time)
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
    const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, sort: '-createdAt', depth: 0, overrideAccess: true })).docs[0]
    const delivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'confirmation' } }] }, depth: 0, overrideAccess: true })).docs[0]
    let token = ''
    await processDelivery(payload, delivery.id, { secret, origin: 'http://127.0.0.1:3000', now: time, transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-sequence-confirmation' } } })
    assert.ok(token)
    return { contact, request, token, email, time }
  }
  async function confirm(person: Awaited<ReturnType<typeof pending>>) {
    const at = person.time
    await Promise.all([confirmMagnet(payload, person.token, secret, at), confirmMagnet(payload, person.token, secret, at)])
    return (await payload.find({ collection: 'sequence-enrollments', where: { contact: { equals: person.contact.id } }, depth: 0, overrideAccess: true })).docs[0]
  }
  const sampleOnly = await pending('sample-only', false)
  assert.equal(await confirm(sampleOnly), undefined)
  const person = await pending('opted-in')
  assert.equal((await getStages(person.contact.id)).length, 0)
  const enrollment = await confirm(person), stages = await getStages(person.contact.id)
  assert.equal(stages.length, 4)
  assert.equal((await payload.count({ collection: 'sequence-enrollments', overrideAccess: true })).totalDocs, 1)
  assert.deepEqual(stages.map(stage => stage.dueAt), sequenceDays.map(day => dueAt(enrollment.confirmedAt, day)))
  assert.deepEqual(stages.map(stage => stage.stage), ['2', '4', '7', '10'])
  assert.ok(stages.every(stage => stage.state === 'scheduled'))
  checks.push('conteúdo incompleto/versão incompatível recusados; amostra sem marketing não matricula; confirmação concorrente cria uma inscrição e quatro datas exatas')

  const twoDays = Date.parse(enrollment.confirmedAt) + 2 * 86_400_000
  assert.equal((await preparePromotions(payload, twoDays - 1)).ready, 0)
  const quotaBefore = (await payload.find({ collection: 'mail-quota', depth: 0, overrideAccess: true })).docs.map(doc => doc.reserved)
  assert.equal((await preparePromotions(payload, twoDays)).ready, 1)
  assert.equal((await preparePromotions(payload, twoDays)).examined, 0)
  assert.equal((await getStages(person.contact.id))[0].state, 'ready')
  assert.deepEqual((await payload.find({ collection: 'mail-quota', depth: 0, overrideAccess: true })).docs.map(doc => doc.reserved), quotaBefore)
  checks.push('D+2 não é antecipado; preparação repetida respeita próxima conferência; calendário não reserva quota nem envia e-mail')

  await assert.rejects(payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { day2: { subject: 'Conteúdo alterado sem revisão' } } }))
  await payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { revision: 2, day2: { subject: 'Assunto sintético revisado' } } })
  await assert.rejects(payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { revision: 1 } }), /não pode diminuir/)
  const original = await payload.findByID({ collection: 'sequence-enrollments', id: enrollment.id, depth: 0, overrideAccess: true })
  assert.equal(readSequenceSnapshot(original.snapshot)?.revision, 1)
  assert.equal(readSequenceSnapshot(original.snapshot)?.messages[0].subject, 'Assunto sintético D+2')
  const newer = await pending('revision-two'), newerEnrollment = await confirm(newer)
  assert.equal(readSequenceSnapshot(newerEnrollment.snapshot)?.revision, 2)
  assert.equal(readSequenceSnapshot(newerEnrollment.snapshot)?.messages[0].subject, 'Assunto sintético revisado')
  assert.equal(readSequenceSnapshot(newerEnrollment.snapshot)?.messages[0].text, copy.day2.text)
  const repeated = await pending('repeated', true, undefined, person.email, Date.now() + 16 * 60_000)
  await confirm(repeated)
  assert.equal((await getStages(person.contact.id)).length, 4)
  checks.push('edição exige revisão maior; snapshot antigo preservado; novos contatos recebem revisão nova; nova solicitação não repete sequência da mesma versão')

  const preference = createOpaqueToken(), unsubAt = Date.now()
  await payload.create({ collection: 'preference-tokens', overrideAccess: true, data: { contact: person.contact.id, tokenHash: preference.hash, expiresAt: new Date(unsubAt + UNSUBSCRIBE_TTL).toISOString() } })
  await unsubscribe(payload, preference.token, unsubAt, secret)
  assert.ok((await getStages(person.contact.id)).every(stage => stage.state === 'canceled'))
  await applySuppression(payload, { email: newer.email, reason: 'complaint', source: 'manual', reference: `synthetic-sequence-block-${suffix}` }, secret)
  assert.ok((await getStages(newer.contact.id)).every(stage => stage.state === 'canceled'))
  checks.push('descadastro e complaint cancelam imediatamente etapas prontas e futuras, preservando histórico')

  const commercial = await pending('offer-check'), commercialEnrollment = await confirm(commercial)
  const sevenDays = Date.parse(commercialEnrollment.confirmedAt) + 7 * 86_400_000
  await payload.update({ collection: 'offers', id: seed.offers[0].id, ...seed.auth, data: { active: false } })
  await preparePromotions(payload, sevenDays)
  let commercialStages = await getStages(commercial.contact.id)
  assert.ok(commercialStages.filter(stage => ['2', '4'].includes(stage.stage)).every(stage => stage.state === 'ready'))
  assert.equal(commercialStages.find(stage => stage.stage === '7')?.errorCode, 'offer_unavailable')
  await payload.update({ collection: 'offers', id: seed.offers[0].id, ...seed.auth, data: { active: true, ebook: seed.books[1].id } })
  await preparePromotions(payload, sevenDays + 900_000)
  assert.equal((await getStages(commercial.contact.id)).find(stage => stage.stage === '7')?.state, 'scheduled', 'Oferta realocada para outro livro não pode ser enviada.')
  await payload.update({ collection: 'offers', id: seed.offers[0].id, ...seed.auth, data: { ebook: seed.books[0].id } })
  await preparePromotions(payload, sevenDays + 1_800_000)
  commercialStages = await getStages(commercial.contact.id)
  assert.equal(commercialStages.find(stage => stage.stage === '7')?.state, 'ready')
  const affiliate = await pending('affiliate-context', true, seed.campaign.code), affiliateEnrollment = await confirm(affiliate)
  assert.equal(readSequenceSnapshot(affiliateEnrollment.snapshot)?.campaignCode, seed.campaign.code)
  await preparePromotions(payload, Date.parse(affiliateEnrollment.confirmedAt) + 10 * 86_400_000)
  assert.ok((await getStages(affiliate.contact.id)).filter(stage => ['7', '10'].includes(stage.stage)).every(stage => stage.state === 'scheduled' && stage.errorCode === 'offer_unavailable'))
  checks.push('oferta indisponível/realocada retém promoção, permite conteúdo educativo e retoma após correção; contexto afiliado incompatível não recebe fallback')

  const racing = await pending('deactivation-race')
  await Promise.all([
    confirm(racing),
    payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { active: false } }),
  ])
  assert.equal((await payload.count({ collection: 'sequence-enrollments', where: { state: { equals: 'active' } }, overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'promotion-deliveries', where: { state: { in: ['ready', 'scheduled'] } }, overrideAccess: true })).totalDocs, 0)
  await payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { active: true } })
  const count = (await payload.count({ collection: 'sequence-enrollments', overrideAccess: true })).totalDocs
  await confirmMagnet(payload, commercial.token, secret, commercial.time)
  assert.equal((await payload.count({ collection: 'sequence-enrollments', overrideAccess: true })).totalDocs, count)
  checks.push('desativação concorrente cancela todos os calendários; reativar não reinicia inscrições anteriores')

  const changed = await pending('material-version-change'), changedEnrollment = await confirm(changed)
  await payload.update({ collection: 'lead-magnets', id: magnet.id, ...seed.auth, data: { version: 'synthetic-v2' } })
  await assert.rejects(payload.update({ collection: 'lead-magnets', id: magnet.id, ...seed.auth, data: { version: magnet.version } }), /já foi utilizada/)
  await preparePromotions(payload, Date.parse(changedEnrollment.confirmedAt) + 2 * 86_400_000)
  assert.ok((await getStages(changed.contact.id)).every(stage => stage.state === 'canceled' && stage.errorCode === 'material_unavailable'))
  for (const collection of ['email-sequences', 'sequence-enrollments', 'promotion-deliveries'] as const) await assert.rejects(payload.find({ collection, user: null, overrideAccess: false }))
  await assert.rejects(payload.update({ collection: 'sequence-enrollments', id: enrollment.id, data: { state: 'active' }, ...seed.auth }))
  await assert.rejects(payload.update({ collection: 'promotion-deliveries', id: stages[0].id, data: { state: 'accepted' }, ...seed.auth }))
  checks.push('material mudou de versão: cancela; coleções privadas; owner não fabrica aceite nem reativa inscrição por CRUD')
  await mkdir('artifacts/sequences', { recursive: true })
  await writeFile('artifacts/sequences/local-results.json', JSON.stringify({ environment: 'PostgreSQL local, relógio controlado e transporte de confirmação em memória', checks, promotionalSends: 0, externalCalls: false, limits: 'Calendário e elegibilidade locais; não homologa campanhas Brevo, batching, compra vinculada ou quota promocional.' }, null, 2))
  console.log(`Sequências: ${checks.length} grupos aprovados; nenhuma promoção ou chamada externa.`)
} finally { await seed.cleanup() }
process.exit(0)

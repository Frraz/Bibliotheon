import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet } from '../../src/modules/marketing/service'
import { deleteContactData } from '../../src/modules/marketing/privacy-delete'
import { correctContactEmail } from '../../src/modules/marketing/privacy-correct'
import { contactFingerprint } from '../../src/modules/marketing/contact'
import { suppressionFingerprint } from '../../src/modules/marketing/suppression-tombstone'
import { sendRecipientFingerprint } from '../../src/modules/marketing/send-recipients'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Somente banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed
const secret = 'synthetic-shared-reference-'.padEnd(48, 'x'), now = Date.now(), at = new Date(now).toISOString()
const checks: string[] = []
const originalFetch = globalThis.fetch
let externalCalls = 0
globalThis.fetch = (async () => { externalCalls++; throw new Error('Rede externa proibida no ensaio.') }) as typeof fetch
try {
  for (const kind of ['contact', 'delivery', 'email', 'contactFingerprint', 'suppressionFingerprint', 'sendFingerprint'] as const) {
    const email = `shared-${randomUUID()}@example.invalid`, replacement = `fixed-${randomUUID()}@example.invalid`
    await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: false }, secret)
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, limit: 1, overrideAccess: true })).docs[0]
    const delivery = (await payload.find({ collection: 'email-deliveries', where: { contact: { equals: contact.id } }, limit: 1, overrideAccess: true })).docs[0]
    const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, limit: 1, overrideAccess: true })).docs[0]
    const reference = { contact: contact.id.toUpperCase(), delivery: delivery.id, email: email.toUpperCase(), contactFingerprint: contactFingerprint(email, secret), suppressionFingerprint: suppressionFingerprint(email, secret), sendFingerprint: sendRecipientFingerprint(email, secret) }[kind]
    const batch = await payload.create({ collection: 'email-campaign-batches', overrideAccess: true, data: { key: randomUUID(), groupKey: randomUUID(), theme: seed.theme.id, stage: '2', day: at.slice(0, 10), copy: { synthetic: true }, members: kind === 'contact' ? { legacy: [{ [reference]: true }] } : [], recipientCount: 1, state: 'canceled', nextAttemptAt: at } })
    let removeReference: () => Promise<unknown>
    if (kind === 'email') {
      const row = await payload.create({ collection: 'brevo-campaign-drafts', overrideAccess: true, data: { batch: batch.id, name: 'synthetic', contentHash: 'synthetic', content: { legacy: `Destinatário: ${reference}` }, observedIds: [], state: 'canceled', nextAttemptAt: at } })
      removeReference = () => payload.delete({ collection: 'brevo-campaign-drafts', id: row.id, overrideAccess: true })
    } else if (kind === 'delivery' || kind === 'sendFingerprint') {
      const row = await payload.create({ collection: 'brevo-campaign-sends', overrideAccess: true, data: { batch: batch.id, batchKey: batch.key, recipientCount: 1, attempts: 0, history: { legacy: [reference] }, recipientIdentities: null, state: 'canceled', nextAttemptAt: at } })
      removeReference = () => payload.delete({ collection: 'brevo-campaign-sends', id: row.id, overrideAccess: true })
    } else if (kind !== 'contact') {
      const row = await payload.create({ collection: 'brevo-batch-lists', overrideAccess: true, data: { batch: batch.id, name: 'synthetic', folderId: 1, audienceKey: 'synthetic', snapshot: { legacy: [reference] }, attemptedIds: [], state: 'canceled', nextAttemptAt: at } })
      removeReference = () => payload.delete({ collection: 'brevo-batch-lists', id: row.id, overrideAccess: true })
    } else removeReference = () => payload.delete({ collection: 'email-campaign-batches', id: batch.id, overrideAccess: true })

    for (let repeat = 0; repeat < 2; repeat++) {
      const deleted = await deleteContactData(payload, email, seed.owner.id, secret, now)
      const corrected = await correctContactEmail(payload, email, replacement, seed.owner.id, secret, now)
      for (const result of [deleted, corrected]) {
        assert.equal(result.outcome, 'pending')
        assert.ok(result.blockers.includes('shared_campaign_manifest_requires_reconciliation'))
      }
    }
    assert.equal((await payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true })).email, email)
    assert.equal((await payload.findByID({ collection: 'email-deliveries', id: delivery.id, overrideAccess: true })).state, delivery.state)
    assert.equal((await payload.findByID({ collection: 'magnet-requests', id: request.id, overrideAccess: true })).revokedAt, request.revokedAt)
    assert.equal((await payload.count({ collection: 'privacy-request-audit', where: { subjectFingerprint: { equals: contactFingerprint(email, secret) } }, overrideAccess: true })).totalDocs, 2)
    checks.push(`${kind}: referência sem FK bloqueia exclusão/correção, preserva relações e reutiliza auditorias pending`)

    // Fixture cleanup is not provider reconciliation. Prove unrelated manifests do not block another contact.
    await removeReference()
    assert.equal((await deleteContactData(payload, email, seed.owner.id, secret, now)).outcome, 'completed')
    assert.equal((await payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true, disableErrors: true })), null)
  }
  checks.push('remoção da referência apenas na fixture permite retomar pending; manifestos sem vínculo não bloqueiam outro titular')
  assert.equal(externalCalls, 0)
  const sources = ['src/modules/marketing/privacy-shared-reference.ts', 'src/modules/marketing/privacy-delete.ts', 'src/modules/marketing/privacy-correct.ts', 'src/modules/marketing/privacy-marketing-retention.ts', 'tests/integration/privacy-shared-reference.ts']
  const sourceSHA256 = Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
  await mkdir('artifacts/privacy-retention', { recursive: true })
  const phase = process.env.BIBLIOTHEON_PRIVACY_REFERENCE_PHASE === 'D119' ? 'D119' : 'D118'
  const output = phase === 'D119' ? 'd119-shared-reference-results.json' : 'd118-results.json'
  await writeFile(`artifacts/privacy-retention/${output}`, JSON.stringify({ phase, completedAt: new Date().toISOString(), environment: 'PostgreSQL sintético descartável', checks, externalCalls, externalReconciliationPerformed: false, productionChanged: false, sourceSHA256 }, null, 2) + '\n')
  console.log(`Privacidade de manifestos compartilhados: ${checks.length} grupos aprovados; zero rede.`)
} finally { globalThis.fetch = originalFetch; await seed.cleanup() }
process.exit(0)

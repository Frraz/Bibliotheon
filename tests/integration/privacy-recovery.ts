import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { seedRelationship } from '../fixtures/relationship'
import { deleteContactData } from '../../src/modules/marketing/privacy-delete'
import { correctContactEmail } from '../../src/modules/marketing/privacy-correct'
import { requestMagnet } from '../../src/modules/marketing/service'
import { retainSuppressionTombstone } from '../../src/modules/marketing/suppression-tombstone'
import { exportPrivacyRecoveryManifest, replayPrivacyRecoveryManifest } from '../../src/modules/marketing/privacy-recovery'
import { contactFingerprint } from '../../src/modules/marketing/contact'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Somente banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed, secret = 'synthetic-recovery-secret'.padEnd(48,'x'), now = Date.now(), snapshotAt = new Date(now-3600000).toISOString(), checks: string[] = []
const previousFlags = { ...process.env }, originalFetch = globalThis.fetch
const privateDirectory = await mkdtemp(path.join(tmpdir(),'bibliotheon-privacy-recovery-')), run = promisify(execFile)
for (const flag of Object.keys(process.env).filter(key => key.endsWith('_ENABLED'))) process.env[flag] = 'false'
let outboundCalls = 0
globalThis.fetch = (async () => { outboundCalls++; throw new Error('Rede externa proibida no ensaio.') }) as typeof fetch
async function identity(label: string, email = `${label}-${randomUUID()}@example.invalid`, state: 'pending'|'uncertain' = 'pending') {
  const contact = await payload.create({ collection: 'contacts', overrideAccess: true, data: { email, deliveryState: 'ok' } })
  const request = await payload.create({ collection: 'magnet-requests', overrideAccess: true, data: { contact: contact.id, magnet: seed.magnet.id, theme: seed.theme.id, magnetVersion: seed.magnet.version, marketingOptIn: false, confirmationTokenHash: randomUUID().replaceAll('-','').repeat(2), expiresAt: new Date(now+86400000).toISOString() } })
  const delivery = await payload.create({ collection: 'email-deliveries', overrideAccess: true, data: { key: `confirmation:${request.id}`, contact: contact.id, request: request.id, kind: 'confirmation', state, attempts: state === 'uncertain' ? 1 : 0, nextAttemptAt: new Date(now).toISOString() } })
  return { contact, request, delivery, email }
}
try {
  const erased = await identity('erased'), corrected = await identity('corrected'), uncertain = await identity('uncertain'), absent = await identity('absent'), suppressed = await identity('suppressed'), bounced = await identity('bounced')
  const unknownEmail = `unknown-${randomUUID()}@example.invalid`
  await retainSuppressionTombstone(payload,unknownEmail,secret,now)
  await deleteContactData(payload,erased.email,seed.owner.id,secret,now)
  await correctContactEmail(payload,corrected.email,`corrected-new-${randomUUID()}@example.invalid`,seed.owner.id,secret,now)
  await deleteContactData(payload,uncertain.email,seed.owner.id,secret,now)
  await deleteContactData(payload,absent.email,seed.owner.id,secret,now)
  for (const fixture of [suppressed,bounced]) {
    await retainSuppressionTombstone(payload,fixture.email,secret,now)
    await payload.update({ collection: 'contacts', id: fixture.contact.id, overrideAccess: true, data: { globalSuppressedAt: new Date(now).toISOString(), deliveryState: fixture === bounced ? 'bounced' : 'ok' } })
    await payload.create({ collection: 'subscriptions', overrideAccess: true, data: { contact: fixture.contact.id, theme: seed.theme.id, key: `${fixture.contact.id}:${seed.theme.id}`, state: 'unsubscribed', unsubscribedAt: new Date(now).toISOString() } })
  }
  const manifest = await exportPrivacyRecoveryManifest(payload,secret,now+1000), input = JSON.stringify(manifest)
  assert.equal(manifest.entries.length,7)
  for (const fixture of [erased,corrected,uncertain,absent,suppressed,bounced]) assert.ok(!input.includes(fixture.email) && !input.includes(fixture.contact.id))
  assert.ok(!input.includes(seed.owner.id))
  assert.ok(!input.includes(unknownEmail))
  checks.push('exportação consistente e assinada com sete decisões; sem email, ID de contato, owner ou conteúdo')
  await run(process.execPath,['scripts/build-runtime.mjs'])
  const privateFile = path.join(privateDirectory,'manifest.json'), childEnv = { ...process.env, LEAD_TOKEN_SECRET: secret }
  const exportedCLI = await run(process.execPath,['--env-file-if-exists=.env.local','.release/privacy-recovery.js','export','--output',privateFile],{env:childEnv})
  assert.ok(exportedCLI.stdout.includes('"exported":true'))
  assert.equal((await stat(privateFile)).mode & 0o777,0o600)
  const privateContents = await readFile(privateFile,'utf8')
  const cliArgs = ['--env-file-if-exists=.env.local','.release/privacy-recovery.js','preview','--input',privateFile,'--snapshot-at',snapshotAt,'--owner',seed.owner.id,'--isolated']
  const previewCLI = await run(process.execPath,cliArgs,{env:childEnv})
  assert.ok(previewCLI.stdout.includes('"mode":"preview"') && !previewCLI.stdout.includes(suppressed.email))
  await chmod(privateFile,0o644)
  await assert.rejects(run(process.execPath,cliArgs,{env:childEnv}))
  assert.equal(await readFile(privateFile,'utf8'),privateContents)
  checks.push('CLI empacotada exporta com modo 600, preview sem conteúdo e recusa arquivo com permissões amplas')

  // Simulate an older restored database in this exclusive fixture, preserving the separately held manifest.
  await payload.delete({ collection: 'privacy-request-audit', where: { id: { exists: true } }, overrideAccess: true })
  await payload.delete({ collection: 'marketing-suppression-tombstones', where: { id: { exists: true } }, overrideAccess: true })
  const restoredErased = await identity('restored-erased',erased.email), restoredUncertain = await identity('restored-uncertain',uncertain.email,'uncertain')
  const restoredUnknown = await identity('restored-unknown',unknownEmail)
  await payload.update({ collection: 'contacts', id: corrected.contact.id, overrideAccess: true, data: { email: corrected.email, globalSuppressedAt: null } })
  for (const fixture of [suppressed,bounced]) {
    await payload.update({ collection: 'contacts', id: fixture.contact.id, overrideAccess: true, data: { globalSuppressedAt: null, deliveryState: 'ok' } })
    await payload.update({ collection: 'subscriptions', where: { contact: { equals: fixture.contact.id } }, overrideAccess: true, data: { state: 'subscribed', subscribedAt: snapshotAt, unsubscribedAt: null } })
  }
  await payload.create({ collection: 'privacy-request-audit', overrideAccess: true, data: { subjectFingerprint: contactFingerprint(erased.email,secret), action: 'delete', outcome: 'completed', counts: {}, actor: seed.owner.id, occurredAt: new Date(now).toISOString() } })
  const options = { secret, snapshotAt, ownerId: seed.owner.id, isolated: true, now: now+2000 }
  const preview = await replayPrivacyRecoveryManifest(payload,input,options)
  assert.equal(preview.matchedContacts,6); assert.equal(preview.processedContacts,0)
  assert.equal((await payload.findByID({ collection: 'contacts', id: suppressed.contact.id, overrideAccess: true })).globalSuppressedAt,null)
  assert.equal((await payload.count({ collection: 'marketing-suppression-tombstones', overrideAccess: true })).totalDocs,0)
  await assert.rejects(replayPrivacyRecoveryManifest(payload,input.replace('"version":2','"version":99'),{...options,apply:true}))
  await assert.rejects(replayPrivacyRecoveryManifest(payload,input,{...options,isolated:false,apply:true}))
  process.env.EMAIL_TRANSPORT_ENABLED = 'true'
  await assert.rejects(replayPrivacyRecoveryManifest(payload,input,{...options,apply:true}))
  process.env.EMAIL_TRANSPORT_ENABLED = 'false'
  const futureConsent = await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: suppressed.contact.id, purpose: 'marketing', action: 'subscribed', occurredAt: new Date(now+3000).toISOString(), key: `future:${randomUUID()}` } })
  await assert.rejects(replayPrivacyRecoveryManifest(payload,input,{...options,apply:true}))
  await payload.delete({ collection: 'consent-events', id: futureConsent.id, overrideAccess: true })
  checks.push('preview sem escrita e recusa de adulteração, operação habilitada, isolamento ausente e consentimento posterior')

  const applied = await replayPrivacyRecoveryManifest(payload,input,{...options,apply:true})
  assert.equal(applied.deletedContacts,2); assert.equal(applied.quarantinedContacts,4); assert.equal(applied.pendingContacts,2)
  await assert.rejects(payload.findByID({ collection: 'contacts', id: restoredErased.contact.id, overrideAccess: true }))
  await assert.rejects(payload.findByID({ collection: 'contacts', id: corrected.contact.id, overrideAccess: true }))
  assert.ok((await payload.findByID({ collection: 'contacts', id: restoredUncertain.contact.id, overrideAccess: true })).globalSuppressedAt)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: restoredUncertain.delivery.id, overrideAccess: true })).state,'uncertain')
  assert.ok((await payload.findByID({ collection: 'magnet-requests', id: restoredUncertain.request.id, overrideAccess: true })).revokedAt)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: suppressed.delivery.id, overrideAccess: true })).state,'pending')
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: bounced.delivery.id, overrideAccess: true })).state,'canceled')
  assert.equal((await payload.findByID({ collection: 'contacts', id: bounced.contact.id, overrideAccess: true })).deliveryState,'bounced')
  assert.equal((await payload.findByID({ collection: 'contacts', id: restoredUnknown.contact.id, overrideAccess: true })).deliveryState,'ok')
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: restoredUnknown.delivery.id, overrideAccess: true })).state,'canceled')
  assert.ok((await payload.find({ collection: 'subscriptions', overrideAccess: true })).docs.every(row => row.state === 'unsubscribed'))
  checks.push('exclusão/correção antigas reaplicadas inclusive com auditoria já existente; envio incerto retido, revogado e bloqueado')
  checks.push('retirada de marketing preserva amostra; bounce restaura restrição; causa desconhecida bloqueia sem inventar reclamação')
  const tombstones = (await payload.find({ collection: 'marketing-suppression-tombstones', overrideAccess: true })).docs
  for (const row of tombstones) assert.equal(row.expiresAt,manifest.entries.find(entry => entry.fingerprint === row.fingerprint)!.expiresAt)
  const auditCount = (await payload.count({ collection: 'privacy-request-audit', overrideAccess: true })).totalDocs
  const repeat = await replayPrivacyRecoveryManifest(payload,input,{...options,apply:true})
  assert.equal(repeat.deletedContacts,0); assert.equal(repeat.pendingContacts,2)
  assert.equal(repeat.importedDecisions,0); assert.equal(repeat.importedSuppressions,0)
  assert.equal((await payload.count({ collection: 'privacy-request-audit', overrideAccess: true })).totalDocs,auditCount)
  await assert.rejects(requestMagnet(payload,{ email: absent.email, magnetId: seed.magnet.id, marketingOptIn:false },secret,now+2000))
  assert.equal(outboundCalls,0); assert.equal(applied.releaseAuthorized,false)
  assert.ok(!JSON.stringify(applied).includes(erased.email) && !JSON.stringify(applied).includes(restoredErased.contact.id))
  checks.push('replay não duplica decisões nem renova prazos; recaptura de ausente bloqueada; relatório agregado e zero rede')
  await mkdir('artifacts/privacy-recovery',{recursive:true})
  await writeFile('artifacts/privacy-recovery/d104-results.json',JSON.stringify({date:new Date().toISOString(),environment:'PostgreSQL sintético local; restauração de histórico simulada sem restore físico',checks,checksPassed:checks.length,outboundCalls,realProviderUsed:false,productionChanged:false,physicalRestoreValidated:false},null,2)+'\n')
  console.log(`Recuperação de privacidade: ${checks.length} grupos aprovados.`)
} finally {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) if (!(key in previousFlags)) delete process.env[key]
  Object.assign(process.env,previousFlags)
  await seed.cleanup()
  await rm(privateDirectory,{recursive:true,force:true})
}
process.exit(0)

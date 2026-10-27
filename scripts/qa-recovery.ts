import { contactFingerprint } from '../src/modules/marketing/contact'
import { unsubscribeTheme } from '../src/modules/marketing/preferences'
import { createOpaqueToken } from '../src/modules/marketing/tokens'
import { migrations } from '../migrations'
import { expireClosedIdentities } from '../src/modules/marketing/privacy-identity-retention'
import { seedRelationship } from '../tests/fixtures/relationship'
import { deleteContactData } from '../src/modules/marketing/privacy-delete'
import { correctContactEmail } from '../src/modules/marketing/privacy-correct'
import { retainSuppressionTombstone } from '../src/modules/marketing/suppression-tombstone'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Somente banco sintético exclusivo.')
for (const flag of Object.keys(process.env).filter(key => key.endsWith('_ENABLED'))) process.env[flag] = 'false'
const imageReference = process.env.BIBLIOTHEON_RECOVERY_IMAGE || ''
const phase = process.env.BIBLIOTHEON_RECOVERY_PHASE || 'D114'
assert.match(phase,/^D[0-9]+$/)
const originalFetch = globalThis.fetch
let outboundCalls = 0
globalThis.fetch = (async () => { outboundCalls++; throw new Error('Rede externa proibida no ensaio.') }) as typeof fetch
const temp = await mkdtemp('/tmp/bibliotheon-recovery-')
const suffix = randomBytes(5).toString('hex'), password = randomBytes(24).toString('hex'), secret = randomBytes(48).toString('hex')
const repository = path.join(temp, 'encrypted-repository'), passwordFile = path.join(temp, 'key')
await writeFile(passwordFile, randomBytes(32).toString('hex'), { mode: 0o600 })
const env = { ...process.env, LEAD_TOKEN_SECRET: secret, RESTIC_BINARY: path.resolve('.local/bin/restic'), RESTIC_REPOSITORY: repository, RESTIC_PASSWORD_FILE: passwordFile }
function run(command: string[], customEnv = env, input?: string): string {
  const result = spawnSync(command[0], command.slice(1), { env: customEnv, input, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`Etapa local falhou: ${path.basename(command[0])} (saídas privadas não exibidas).`)
  return result.stdout
}
function report(output: string) {
  const line = output.trim().split('\n').reverse().find(value => value.startsWith('{'))
  assert.ok(line, 'Relatório JSON ausente.')
  return JSON.parse(line)
}
const sourceCompose = ['--compose-file', 'compose.local.yaml', '--env-file', '.env.local', '--lab']
const restoreCompose = path.join(temp, 'restore.yaml'), restoreEnv = path.join(temp, 'restore.env')
const target = path.join(temp, 'restored-media'), manifestFile = path.join(temp, 'privacy.json')
await writeFile(restoreEnv, `RESTORE_PASSWORD=${password}\n`, { mode: 0o600 })
await writeFile(restoreCompose, `name: bibliotheon-restore-${suffix}
services:
  db:
    image: postgres:17.9-alpine@sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609
    environment:
      POSTGRES_DB: bibliotheon_restore
      POSTGRES_USER: bibliotheon_restore
      POSTGRES_PASSWORD: \${RESTORE_PASSWORD}
${imageReference ? '' : '    ports: ["127.0.0.1::5432"]'}
    volumes: [restore-db:/var/lib/postgresql/data]
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U bibliotheon_restore -d bibliotheon_restore"]
      interval: 2s
      timeout: 2s
      retries: 20
volumes:
  restore-db:
${imageReference ? 'networks:\n  default:\n    internal: true\n' : ''}`, { mode: 0o600 })
const docker = ['docker', 'compose', '--file', restoreCompose, '--env-file', restoreEnv]
const imageID = imageReference ? run(['docker','image','inspect',imageReference,'--format','{{.Id}}']).trim() : null
if (imageID) assert.equal(imageID, JSON.parse(await readFile(process.env.BIBLIOTHEON_RECOVERY_BASELINE || 'artifacts/container/d107-results.json','utf8')).imageID, 'Usar a imagem da evidência de referência.')
const appName = `bibliotheon-restored-app-${suffix}`
let appStarted = false
const seed = await seedRelationship(), { payload } = seed
const sql = (query: string) => run([...docker, 'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'bibliotheon_restore', '-d', 'bibliotheon_restore', '-At', '-c', query]).trim()
async function identity(label: string, uncertain = false, kind: 'confirmation'|'delivery' = 'confirmation') {
  const email = `${label}-${suffix}@example.invalid`
  const confirmedAt = kind === 'delivery' ? new Date().toISOString() : null
  const contact = await payload.create({ collection: 'contacts', overrideAccess: true, data: { email, deliveryState: 'ok', confirmedAt } })
  const request = await payload.create({ collection: 'magnet-requests', overrideAccess: true, data: { contact: contact.id, magnet: seed.magnet.id, theme: seed.theme.id, magnetVersion: seed.magnet.version, marketingOptIn: false, confirmedAt, confirmationTokenHash: confirmedAt ? null : randomUUID().replaceAll('-', '').repeat(2), expiresAt: new Date(Date.now()+86400000).toISOString() } })
  if (confirmedAt) for (const action of ['requested','confirmed'] as const) await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: contact.id, theme: seed.theme.id, purpose: 'sample', action, version: 'synthetic-v1', occurredAt: confirmedAt, key: `${action}:${request.id}` } })
  const delivery = await payload.create({ collection: 'email-deliveries', overrideAccess: true, data: { key: `${kind}:${request.id}`, contact: contact.id, request: request.id, kind, state: uncertain ? 'uncertain' : 'pending', attempts: uncertain ? 1 : 0, nextAttemptAt: new Date().toISOString() } })
  return { contact, request, delivery, email }
}
try {
  const erased = await identity('erased'), corrected = await identity('corrected'), pending = await identity('pending', true)
  const suppressed = await identity('suppressed', false, 'delivery'), bounced = await identity('bounced', false, 'delivery'), untouched = await identity('untouched')
  const retired=await payload.create({collection:'contacts',overrideAccess:true,data:{email:`retired-${suffix}@example.invalid`,globalSuppressedAt:new Date(Date.now()-40*86400000).toISOString(),deliveryState:'ok'}})
  const secondTheme = await payload.create({collection:'themes',...seed.auth,data:{name:'Assunto independente sintético',slug:`outro-${suffix}`,introduction:'Somente teste de restauração.',_status:'published'}})
  seed.extraThemes.push(secondTheme.id)
  const topicSubscriptions=[]
  for(const theme of [seed.theme.id,secondTheme.id]) topicSubscriptions.push(await payload.create({collection:'subscriptions',overrideAccess:true,data:{contact:untouched.contact.id,theme,key:`${untouched.contact.id}:${theme}`,state:'subscribed',subscribedAt:new Date().toISOString()}}))
  const preference=createOpaqueToken()
  await payload.create({collection:'preference-tokens',overrideAccess:true,data:{contact:untouched.contact.id,tokenHash:preference.hash,expiresAt:new Date(Date.now()+86400000).toISOString()}})
  run([process.execPath, 'scripts/build-runtime.mjs'])
  run([env.RESTIC_BINARY, 'init'])
  run([...docker, 'up', '-d', '--wait'])
  console.log('Laboratório isolado pronto; capturando dump e mídia sintéticos.')
  const backup = report(run(['python3', 'ops/recovery.py', 'backup', ...sourceCompose, '--media-dir', path.resolve('uploads')]))
  assert.equal(backup.external, false)
  // Export decisions newer than the actual dump to a private file outside the snapshot.
  assert.equal((await deleteContactData(payload, erased.email, seed.owner.id, secret)).outcome, 'completed')
  assert.equal((await correctContactEmail(payload, corrected.email, `new-${suffix}@example.invalid`, seed.owner.id, secret)).outcome, 'completed')
  assert.equal((await deleteContactData(payload, pending.email, seed.owner.id, secret)).outcome, 'pending')
  for (const fixture of [suppressed, bounced]) {
    await retainSuppressionTombstone(payload, fixture.email, secret, Date.now())
    await payload.update({ collection: 'contacts', id: fixture.contact.id, overrideAccess: true, data: { globalSuppressedAt: new Date().toISOString(), deliveryState: fixture === bounced ? 'bounced' : 'ok' } })
  }
  const absent = await identity('absent')
  await deleteContactData(payload, absent.email, seed.owner.id, secret)
  await retainSuppressionTombstone(payload,retired.email,secret,Date.parse(retired.globalSuppressedAt!))
  assert.equal((await expireClosedIdentities(payload,Date.now(),true,secret)).removedContacts,1)
  await unsubscribeTheme(payload,preference.token,seed.theme.id,Date.now(),secret)
  // Simulate the pre-fact revision: the native withdrawal proof survives, its new marker does not.
  await payload.delete({collection:'theme-withdrawals',where:{subjectFingerprint:{equals:contactFingerprint(untouched.email,secret)}},overrideAccess:true})
  assert.equal((await payload.count({collection:'theme-withdrawals',overrideAccess:true})).totalDocs,0)
  run([process.execPath, '--env-file-if-exists=.env.local', '.release/privacy-recovery.js', 'export', '--output', manifestFile])
  assert.equal((await stat(manifestFile)).mode & 0o777, 0o600)
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  assert.equal(manifest.version, 4); assert.equal(manifest.entries.length, 9)
  assert.equal((await payload.count({collection:'theme-withdrawals',overrideAccess:true})).totalDocs,0)
  await payload.update({ collection: 'ebooks', id: seed.books[0].id, ...seed.auth, data: { title: 'Mudança posterior ao snapshot', _status: 'published' } })
  console.log('Decisões posteriores exportadas; restaurando snapshot anterior em banco vazio.')
  const restored = report(run(['python3', 'ops/recovery.py', 'restore', '--compose-file', restoreCompose, '--env-file', restoreEnv, '--media-dir', target, '--snapshot', backup.snapshot, '--lab']))
  assert.equal(restored.capturedAt, backup.capturedAt)
  assert.equal(restored.privacyReplayRequired, true); assert.equal(restored.outboundServicesStarted, false)
  assert.equal(Number(sql('SELECT count(*) FROM ebooks')), 4)
  assert.deepEqual(sql('SELECT name FROM payload_migrations WHERE batch >= 0 ORDER BY name').split('\n'),migrations.map(item=>item.name).sort())
  assert.equal(Number(sql("SELECT count(*) FROM ebooks WHERE title = 'Mudança posterior ao snapshot'")), 0)
  assert.equal(Number(sql('SELECT count(*) FROM contacts')), 7)
  assert.equal(Number(sql('SELECT count(*) FROM privacy_request_audit')), 0)
  assert.equal(Number(sql('SELECT count(*) FROM marketing_suppression_tombstones')), 0)
  for (const media of [seed.cover, seed.sampleMedia]) assert.ok((await readFile(path.join('uploads', media.filename!))).equals(await readFile(path.join(target, media.filename!))))
  let replay: (mode: 'preview'|'apply') => ReturnType<typeof report>
  let imageCLIHash: string | null = null
  let databaseContainer = ''
  const imageEnvFile = path.join(temp,'image.env')
  const limitedEnvFile = path.join(temp,'limited.env')
  if (imageID) {
    databaseContainer = run([...docker,'ps','-q','db']).trim()
    assert.match(databaseContainer,/^[a-f0-9]{12,64}$/)
    imageCLIHash = run(['docker','run','--rm','--network','none','--entrypoint','node',imageID,'-e',"console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/cli/privacy-recovery.js')).digest('hex'))"]).trim()
    assert.equal(imageCLIHash,createHash('sha256').update(await readFile('.release/privacy-recovery.js')).digest('hex'))
    const runtime = { PAYLOAD_SECRET: process.env.PAYLOAD_SECRET!, LEAD_TOKEN_SECRET: secret, DATABASE_URL: `postgresql://bibliotheon_restore:${password}@127.0.0.1:5432/bibliotheon_restore`, PUBLIC_SITE_URL: 'http://127.0.0.1:3000', MEDIA_DIR: '/app/uploads' }
    assert.ok(runtime.PAYLOAD_SECRET)
    await writeFile(imageEnvFile,Object.entries(runtime).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600})
    replay = mode => report(run(['docker','run','--rm','--network',`container:${databaseContainer}`,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:size=64m,mode=1777','--env-file',imageEnvFile,'--mount',`type=bind,src=${manifestFile},dst=/tmp/privacy.json,readonly`,'--entrypoint','node',imageID,'cli/privacy-recovery.js',mode,'--input','/tmp/privacy.json','--snapshot-at',restored.capturedAt,'--owner',seed.owner.id,'--isolated']))
    // Runtime credentials are distinct from maintenance and never enter argv/logs.
    const runtimePassword = randomBytes(24).toString('hex')
    run([...docker,'exec','-T','db','psql','-v','ON_ERROR_STOP=1','-U','bibliotheon_restore','-d','bibliotheon_restore'],env,`CREATE ROLE bibliotheon_runtime LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE; GRANT CONNECT ON DATABASE bibliotheon_restore TO bibliotheon_runtime; GRANT USAGE ON SCHEMA public TO bibliotheon_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO bibliotheon_runtime; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO bibliotheon_runtime;`)
    await writeFile(limitedEnvFile,Object.entries({...runtime,DATABASE_URL:`postgresql://bibliotheon_runtime:${runtimePassword}@127.0.0.1:5432/bibliotheon_restore`}).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600})
    assert.equal(run(['docker','network','inspect',`bibliotheon-restore-${suffix}_default`,'--format','{{.Internal}}']).trim(),'true')
  } else {
    const address = run([...docker, 'port', 'db', '5432']).trim()
    assert.match(address, /^127\.0\.0\.1:\d+$/)
    const childEnv = { ...env, DATABASE_URL: `postgresql://bibliotheon_restore:${password}@${address}/bibliotheon_restore` }
    replay = mode => report(run([process.execPath, '--env-file-if-exists=.env.local', '.release/privacy-recovery.js', mode, '--input', manifestFile, '--snapshot-at', restored.capturedAt, '--owner', seed.owner.id, '--isolated'], childEnv))
  }
  const preview = replay('preview')
  assert.equal(preview.matchedContacts, 7); assert.equal(preview.processedContacts, 0)
  assert.equal(Number(sql('SELECT count(*) FROM privacy_request_audit')), 0)
  assert.equal(Number(sql('SELECT count(*) FROM contacts WHERE global_suppressed_at IS NOT NULL')), 1)
  const applied = replay('apply')
  assert.equal(applied.deletedContacts, 3); assert.equal(applied.retiredContacts,1); assert.equal(applied.quarantinedContacts, 3)
  assert.equal(applied.withdrawnThemes,1)
  assert.equal(applied.pendingContacts, 1); assert.equal(applied.pendingDecisions, 1)
  assert.equal(applied.outboundCalls, 0); assert.equal(applied.releaseAuthorized, false)
  assert.equal(Number(sql('SELECT count(*) FROM contacts')), 4)
  assert.equal(Number(sql(`SELECT count(*) FROM contacts WHERE id IN ('${erased.contact.id}', '${corrected.contact.id}', '${retired.id}')`)), 0)
  const retirementState=sql('SELECT subject_fingerprint,retired_at,expires_at FROM contact_retirements ORDER BY subject_fingerprint')
  assert.equal(Number(sql('SELECT count(*) FROM contact_retirements')),1)
  assert.equal(sql(`SELECT state FROM email_deliveries WHERE id = '${pending.delivery.id}'`), 'uncertain')
  assert.equal(sql(`SELECT state FROM email_deliveries WHERE id = '${suppressed.delivery.id}'`), 'pending')
  assert.equal(sql(`SELECT kind FROM email_deliveries WHERE id = '${suppressed.delivery.id}'`), 'delivery')
  assert.equal(sql(`SELECT state FROM email_deliveries WHERE id = '${bounced.delivery.id}'`), 'canceled')
  assert.equal(sql(`SELECT delivery_state FROM contacts WHERE id = '${bounced.contact.id}'`), 'bounced')
  assert.equal(Number(sql(`SELECT count(*) FROM contacts WHERE id = '${untouched.contact.id}' AND global_suppressed_at IS NULL`)), 1)
  assert.equal(sql(`SELECT state FROM subscriptions WHERE id='${topicSubscriptions[0].id}'`),'unsubscribed')
  assert.equal(sql(`SELECT state FROM subscriptions WHERE id='${topicSubscriptions[1].id}'`),'subscribed')
  assert.equal(sql(`SELECT state FROM email_deliveries WHERE id='${untouched.delivery.id}'`),'pending')
  assert.equal(sql(`SELECT revoked_at IS NULL FROM magnet_requests WHERE id='${untouched.request.id}'`),'t')
  const topicMarkerState=sql('SELECT subject_fingerprint,theme_id,withdrawn_at,expires_at FROM theme_withdrawals ORDER BY key')
  assert.equal(Number(sql('SELECT count(*) FROM theme_withdrawals')),1)
  // Correct replay records the actual local deletion as well as the original correction.
  assert.equal(Number(sql('SELECT count(*) FROM privacy_request_audit')), 5)
  assert.equal(Number(sql("SELECT count(*) FROM privacy_request_audit WHERE outcome = 'pending'")), 1)
  const markers = sql('SELECT fingerprint, expires_at FROM marketing_suppression_tombstones ORDER BY fingerprint')
  assert.equal(Number(sql('SELECT count(*) FROM marketing_suppression_tombstones')), 3)
  const recoveredMarkers = JSON.parse(sql("SELECT json_agg(json_build_object('fingerprint', fingerprint, 'expiresAt', expires_at)) FROM marketing_suppression_tombstones")) as { fingerprint: string; expiresAt: string }[]
  for (const marker of recoveredMarkers) assert.equal(new Date(marker.expiresAt).toISOString(), manifest.entries.find((entry: { fingerprint: string }) => entry.fingerprint === marker.fingerprint).expiresAt)
  assert.equal(replay('apply').deletedContacts, 0)
  assert.equal(sql('SELECT subject_fingerprint,theme_id,withdrawn_at,expires_at FROM theme_withdrawals ORDER BY key'),topicMarkerState)
  assert.equal(sql('SELECT subject_fingerprint,retired_at,expires_at FROM contact_retirements ORDER BY subject_fingerprint'),retirementState)
  assert.equal(Number(sql('SELECT count(*) FROM privacy_request_audit')), 5)
  assert.equal(sql('SELECT fingerprint, expires_at FROM marketing_suppression_tombstones ORDER BY fingerprint'), markers)
  const repeated = spawnSync('python3', ['ops/recovery.py', 'restore', '--compose-file', restoreCompose, '--env-file', restoreEnv, '--media-dir', target, '--snapshot', backup.snapshot, '--lab'], { env, encoding: 'utf8', timeout: 120000 })
  assert.notEqual(repeated.status, 0); assert.equal(outboundCalls, 0)
  assert.equal(run([...docker, 'ps', '--status', 'running', '--services']).trim(), 'db')
  let restoredHTTP: Record<string, number> | null = null
  if (imageID) {
    console.log('Replay na imagem concluído; verificando aplicação restaurada com credencial limitada.')
    run(['docker','run','-d','--name',appName,'--network',`container:${databaseContainer}`,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:size=64m,mode=1777','--tmpfs','/app/.next/cache:size=64m,uid=1000,gid=1000','--env-file',limitedEnvFile,'-e','HOSTNAME=0.0.0.0','--mount',`type=bind,src=${target},dst=/app/uploads,readonly`,imageID])
    appStarted = true
    const script = `let input='';for await(const part of process.stdin)input+=part;const expected=JSON.parse(input);let ready=false;for(let i=0;i<90;i++){try{if((await fetch('http://127.0.0.1:3000/health/ready')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}if(!ready)throw Error('Readiness indisponível');const statuses={};for(const [key,route] of Object.entries(expected.routes)){const response=await fetch('http://127.0.0.1:3000'+route);statuses[key]=response.status;if(key==='cover'&&require('crypto').createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')!==expected.coverHash)throw Error('Mídia divergente');if(key==='catalog'&&!(await response.text()).includes(expected.title))throw Error('Catálogo divergente')}console.log(JSON.stringify(statuses));`
    restoredHTTP = report(run(['docker','exec','-i',appName,'node','-e',`(async()=>{${script}})().catch(()=>process.exit(1))`],env,JSON.stringify({title:seed.books[0].title,coverHash:createHash('sha256').update(await readFile(path.join(target,seed.cover.filename!))).digest('hex'),routes:{health:'/health/ready',catalog:'/ebooks',contacts:'/api/contacts',cover:`/api/v1/media/${seed.cover.id}`,privateSample:`/api/v1/media/${seed.sampleMedia.id}`}})))
    assert.deepEqual(restoredHTTP,{health:200,catalog:200,contacts:403,cover:200,privateSample:404})
    assert.equal(Number(sql('SELECT count(*) FROM contacts')),4)
    assert.equal(sql(`SELECT state FROM email_deliveries WHERE id = '${pending.delivery.id}'`),'uncertain')
    assert.equal(sql(`SELECT state FROM email_deliveries WHERE id = '${suppressed.delivery.id}'`),'pending')
    assert.equal(sql("SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname='bibliotheon_runtime'"),'f')
  }
  await mkdir('artifacts/recovery', { recursive: true })
  const evidence = { phase, imageID, imageCLIHash, restoredHTTP, applicationStartedAfterPrivacyReplay: !!imageID, runtimeCredentialSeparated: !!imageID, targetNetworkInternal: !!imageID, workerStarted: false, date: new Date().toISOString(), environment: imageID ? 'PostgreSQL 17.9, restic 0.19.1; imagem validada e rede interna sem portas; fixtures sintéticas' : 'PostgreSQL 17.9, restic 0.19.1; banco isolado com porta aleatória somente loopback; fixtures sintéticas', backupSeconds: backup.durationSeconds, restoreSeconds: restored.durationSeconds, restoredMigrations: migrations.length, restoredBooks: 4, mediaFiles: restored.mediaFiles, coverAndPrivateSampleByteIdentical: true, restoredPoint: 'anterior às decisões e à alteração do catálogo', manifestVersion: manifest.version, decisionsOutsideSnapshot: manifest.entries.length, automaticRetirementReapplied: true, thematicWithdrawalReapplied: true, legacyThematicProofExportedWithoutMutation: true, independentOtherThemePreserved: true, previewWithoutWrites: true, replay: applied, pendingPreserved: true, independentSamplePreserved: true, bouncedSampleCancelled: true, repeatedReplayDoesNotRenewMarkers: true, rejectsOverwrite: true, runningTargetServices: imageID ? ['db','isolated-app'] : ['db'], transportFlagsEnabled: false, outboundCalls, outboundServicesStarted: false, physicalRestoreValidated: true, applicationImageValidated: !!imageID, externalBackupVerified: false, productionRPO_RTO: 'não homologados', sourceSHA256: Object.fromEntries(await Promise.all(['scripts/qa-recovery.ts', 'ops/recovery.py', '.release/privacy-recovery.js', 'migrations/index.ts', 'src/payload.config.ts'].map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')]))), productionChanged: false }
  await writeFile(`artifacts/recovery/${phase.toLowerCase()}-results.json`, JSON.stringify(evidence, null, 2)+'\n')
  console.log(`Restore físico local aprovado: ${migrations.length} migrations, mídia íntegra, replay v4, descadastro temático e expurgo automático reaplicados. Sem envio externo.`)
} finally {
  try {
    if (appStarted) run(['docker','rm','-f',appName])
    run([...docker, 'down', '--volumes'])
  }
  finally {
    try { await seed.cleanup() }
    finally { globalThis.fetch = originalFetch; await rm(temp, { recursive: true, force: true }) }
  }
}
process.exit(0)

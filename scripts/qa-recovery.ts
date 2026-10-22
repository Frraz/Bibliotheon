import { seedSite } from '../tests/fixtures/site'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'

const temp = await mkdtemp('/tmp/bibliotheon-recovery-')
const suffix = randomBytes(5).toString('hex')
const repository = path.join(temp, 'encrypted-repository')
const passwordFile = path.join(temp, 'key')
await writeFile(passwordFile, randomBytes(32).toString('hex'), { mode: 0o600 })
const env = { ...process.env, RESTIC_BINARY: path.resolve('.local/bin/restic'), RESTIC_REPOSITORY: repository, RESTIC_PASSWORD_FILE: passwordFile }
function run(command: string[], customEnv = env): string {
  const result = spawnSync(command[0], command.slice(1), { env: customEnv, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`Etapa local falhou: ${command[0]} (saídas privadas não exibidas).`)
  return result.stdout
}
const sourceCompose = ['--compose-file', 'compose.local.yaml', '--env-file', '.env.local', '--lab']
const restoreCompose = path.join(temp, 'restore.yaml')
const restoreEnv = path.join(temp, 'restore.env')
const target = path.join(temp, 'restored-media')
await writeFile(restoreEnv, `RESTORE_PASSWORD=${randomBytes(24).toString('hex')}\n`, { mode: 0o600 })
await writeFile(restoreCompose, `name: bibliotheon-restore-${suffix}\nservices:\n  db:\n    image: postgres:17.9-alpine@sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609\n    environment:\n      POSTGRES_DB: bibliotheon_restore\n      POSTGRES_USER: bibliotheon_restore\n      POSTGRES_PASSWORD: \${RESTORE_PASSWORD}\n    volumes: [restore-db:/var/lib/postgresql/data]\n    healthcheck:\n      test: [CMD-SHELL, "pg_isready -U bibliotheon_restore -d bibliotheon_restore"]\n      interval: 2s\n      timeout: 2s\n      retries: 20\nvolumes:\n  restore-db:\n`)
const docker = ['docker', 'compose', '--file', restoreCompose, '--env-file', restoreEnv]
const seed = await seedSite()
try {
  run([env.RESTIC_BINARY, 'init'])
  run([...docker, 'up', '-d', '--wait'])
  const backup = JSON.parse(run(['python3', 'ops/recovery.py', 'backup', ...sourceCompose, '--media-dir', path.resolve('uploads')])) as { snapshot: string; external: boolean; durationSeconds: number }
  assert.equal(backup.external, false)
  await seed.payload.update({ collection: 'ebooks', id: seed.books[0].id, ...seed.auth, data: { title: 'Mudança posterior ao snapshot', _status: 'published' } })
  const restored = JSON.parse(run(['python3', 'ops/recovery.py', 'restore', '--compose-file', restoreCompose, '--env-file', restoreEnv, '--media-dir', target, '--snapshot', backup.snapshot, '--lab'])) as { durationSeconds: number; mediaFiles: number; outboundServicesStarted: boolean }
  assert.equal(restored.outboundServicesStarted, false)
  const count = Number(run([...docker, 'exec', '-T', 'db', 'psql', '-U', 'bibliotheon_restore', '-d', 'bibliotheon_restore', '-At', '-c', 'SELECT count(*) FROM ebooks']))
  assert.equal(count, 4)
  const restoredTitle = run([...docker, 'exec', '-T', 'db', 'psql', '-U', 'bibliotheon_restore', '-d', 'bibliotheon_restore', '-At', '-c', "SELECT count(*) FROM ebooks WHERE title = 'Mudança posterior ao snapshot'"])
  assert.equal(Number(restoredTitle), 0)
  const source = await readFile(path.join('uploads', seed.cover.filename!))
  const copy = await readFile(path.join(target, seed.cover.filename!))
  assert.ok(source.equals(copy))
  // A second restore must refuse the populated database or nonempty media target.
  const repeated = spawnSync('python3', ['ops/recovery.py', 'restore', '--compose-file', restoreCompose, '--env-file', restoreEnv, '--media-dir', target, '--snapshot', backup.snapshot, '--lab'], { env, encoding: 'utf8' })
  assert.notEqual(repeated.status, 0)
  await mkdir('artifacts/recovery', { recursive: true })
  await writeFile('artifacts/recovery/local-results.json', JSON.stringify({ date: '2026-10-21 America/Belem', environment: 'PostgreSQL 17.9, restic 0.19.1, projeto isolado sem portas; fixtures sintéticas', backupSeconds: backup.durationSeconds, restoreSeconds: restored.durationSeconds, restoredBooks: count, mediaHashes: 'verificados e conteúdo comparado', restoredPoint: 'revisão anterior à mudança pós-snapshot', rejectsOverwrite: true, outboundServicesStarted: false, externalBackupVerified: false, productionRPO_RTO: 'não homologados' }, null, 2))
  console.log('Recuperação local aprovada: backup criptografado, restore em banco vazio, ponto anterior, mídia íntegra e sobrescrita recusada. Sem envio externo.')
} finally {
  run([...docker, 'down', '--volumes'])
  await seed.cleanup()
  await rm(temp, { recursive: true, force: true })
}
process.exit(0)

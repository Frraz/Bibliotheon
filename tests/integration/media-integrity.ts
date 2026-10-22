import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { samplePDF } from '../fixtures/pdf'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { MEDIA_GC_GRACE, MEDIA_GC_INDEX } from '../../src/modules/catalog/media-files'
import { collectMedia } from '../../src/modules/catalog/media-gc'

const database = new URL(process.env.DATABASE_URL || '')
assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname), 'Use somente banco de teste em loopback.')
const temporary = await mkdtemp(path.join(os.tmpdir(), 'bibliotheon-media-integrity-'))
const directory = path.join(temporary, 'uploads')
await mkdir(directory, { mode: 0o700 })
process.env.MEDIA_DIR = directory
const { getPayload, createLocalReq } = await import('payload')
const config = (await import('../../src/payload.config')).default
const payload = await getPayload({ config }).catch(async error => { await rm(temporary, { recursive: true, force: true }); throw error })
let owner: import('../../src/payload-types').AdminUser | undefined
const ids: string[] = []
const checks: string[] = []
try {
  assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 0, 'O teste exige banco sem owner.')
  owner = await payload.create({ collection: 'admin-users', overrideAccess: true, context: { provisionAdmin: true }, data: { email: `media-${randomBytes(6).toString('hex')}@example.invalid`, password: randomBytes(32).toString('hex'), role: 'owner' } })
  const auth = { user: { ...owner, collection: 'admin-users' as const }, overrideAccess: false }
  const bytes = await sharp({ create: { width: 12, height: 18, channels: 3, background: '#163C56' } }).png().toBuffer()
  const media = await payload.create({ collection: 'media', ...auth, data: { alt: 'Imagem sintética de integridade', presentationRole: 'cover', visibility: 'private' }, file: { name: 'sample.png', data: bytes, size: bytes.length, mimetype: 'image/png' } })
  ids.push(media.id)
  const original = await readFile(path.join(directory, media.filename!))
  const pdf = samplePDF()
  await assert.rejects(payload.update({ collection: 'media', id: media.id, ...auth, data: { visibility: 'public' }, file: { name: 'sample.pdf', data: pdf, size: pdf.length, mimetype: 'application/pdf' } }), /PDF de amostra deve permanecer privado/)
  const after = await payload.findByID({ collection: 'media', id: media.id, ...auth })
  assert.equal(after.filename, media.filename)
  assert.deepEqual(await readFile(path.join(directory, media.filename!)), original, 'Uma substituição recusada deve preservar os bytes anteriores.')
  checks.push('Substituição recusada na validação preserva registro e bytes anteriores; reprodução anterior falhou por ENOENT.')

  const second = await sharp({ create: { width: 20, height: 30, channels: 3, background: '#431F58' } }).png().toBuffer()
  const replacement = () => ({ name: 'second.png', data: second, size: second.length, mimetype: 'image/png' })
  const hooks = payload.collections.media.config.hooks
  for (const stage of ['afterChange', 'afterOperation'] as const) {
    if (stage === 'afterChange') {
      const previous = hooks.afterChange
      hooks.afterChange = [...previous, async ({ req, doc }) => { if (req.context.syntheticMediaFailure) throw new Error('synthetic media rollback'); return doc }]
      try { await assert.rejects(payload.update({ collection: 'media', id: media.id, ...auth, context: { syntheticMediaFailure: true }, data: { alt: 'Mudança sintética recusada' }, file: replacement() }), /synthetic media rollback/) }
      finally { hooks.afterChange = previous }
    } else {
      const previous = hooks.afterOperation
      hooks.afterOperation = [...previous, async ({ req, result }) => { if (req.context.syntheticMediaFailure) throw new Error('synthetic media rollback'); return result }]
      try { await assert.rejects(payload.update({ collection: 'media', id: media.id, ...auth, context: { syntheticMediaFailure: true }, data: { alt: 'Mudança sintética recusada' }, file: replacement() }), /synthetic media rollback/) }
      finally { hooks.afterOperation = previous }
    }
    assert.equal((await payload.findByID({ collection: 'media', id: media.id, ...auth })).filename, media.filename)
    assert.deepEqual(await readFile(path.join(directory, media.filename!)), original)
  }
  checks.push('Falhas após escrita no banco e no último hook revertem dados sem apagar arquivo anterior.')

  const updated = await payload.update({ collection: 'media', id: media.id, ...auth, data: { alt: 'Nova imagem sintética válida' }, file: replacement() })
  assert.notEqual(updated.filename, media.filename)
  const updatedBytes = await readFile(path.join(directory, updated.filename!))
  assert.equal(updated.hash, createHash('sha256').update(updatedBytes).digest('hex'))
  assert.deepEqual(await readFile(path.join(directory, media.filename!)), original)
  await payload.update({ collection: 'media', id: media.id, ...auth, data: { caption: 'Legenda sintética editável' } })
  for (const data of [{ filename: `${randomUUID()}.webp` }, { mimeType: 'application/pdf' }]) {
    try { await payload.update({ collection: 'media', id: media.id, ...auth, data }) }
    catch (error) { assert.match(String(error), /Metadados do arquivo/) }
    // Payload may discard generated upload fields before collection hooks.
    const persisted = await payload.findByID({ collection: 'media', id: media.id, ...auth })
    assert.equal(persisted.filename, updated.filename)
    assert.equal(persisted.mimeType, updated.mimeType)
    assert.equal(persisted.hash, updated.hash)
  }
  const now = Date.now()
  const dry = await collectMedia(payload, { now })
  assert.ok(dry.candidates >= 3); assert.equal(dry.removed, 0)
  await assert.rejects(readFile(path.join(directory, MEDIA_GC_INDEX)), error => !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
  const marked = await collectMedia(payload, { apply: true, now })
  assert.equal(marked.removed, 0)
  assert.equal((await collectMedia(payload, { apply: true, now: now + MEDIA_GC_GRACE - 1 })).removed, 0)
  const cleaned = await collectMedia(payload, { apply: true, now: now + MEDIA_GC_GRACE })
  assert.equal(cleaned.removed, marked.candidates)
  assert.deepEqual(await readFile(path.join(directory, updated.filename!)), updatedBytes)
  checks.push('Upload válido substitui conteúdo/hash; metadados técnicos protegidos; dry-run não escreve; órfãos removidos somente após primeira observação +24h, sem tocar arquivo ativo.')

  const transactionID = await payload.db.beginTransaction()
  assert.ok(transactionID)
  const req = await createLocalReq({ req: { user: auth.user, transactionID } }, payload)
  let gcError: unknown, finished = false
  await payload.update({ collection: 'media', id: media.id, req, overrideAccess: false, data: { alt: 'Mudança em transação externa' }, file: replacement() })
  const concurrent = collectMedia(payload, { apply: true, now: now + 2 * MEDIA_GC_GRACE }).then(result => { finished = true; return result }, error => { gcError = error; finished = true; return null })
  try {
    let waiting = false
    const deadline = Date.now() + 5000
    while (!waiting && Date.now() < deadline) {
      const locks = await (payload.db as unknown as PostgresAdapter).drizzle.execute(sql`SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`)
      waiting = Number(locks.rows[0]?.waiting) > 0
      if (!waiting) await new Promise(resolve => setTimeout(resolve, 10))
    }
    assert.equal(waiting, true, 'A limpeza deve aguardar o lock da transação que está substituindo o arquivo.')
    assert.equal(finished, false)
  } finally { await payload.db.rollbackTransaction(transactionID); await concurrent }
  assert.equal(gcError, undefined)
  assert.equal((await payload.findByID({ collection: 'media', id: media.id, ...auth })).filename, updated.filename)
  assert.deepEqual(await readFile(path.join(directory, updated.filename!)), updatedBytes)
  checks.push('Limpeza concorrente observada esperando advisory lock no PostgreSQL; rollback externo preserva arquivo/registro ativos.')

  const previousDelete = hooks.afterDelete
  hooks.afterDelete = [...previousDelete, async ({ req, doc }) => { if (req.context.syntheticMediaFailure) throw new Error('synthetic delete rollback'); return doc }]
  try { await assert.rejects(payload.delete({ collection: 'media', id: media.id, ...auth, context: { syntheticMediaFailure: true } }), /synthetic delete rollback/) }
  finally { hooks.afterDelete = previousDelete }
  assert.equal((await payload.findByID({ collection: 'media', id: media.id, ...auth })).filename, updated.filename)
  assert.deepEqual(await readFile(path.join(directory, updated.filename!)), updatedBytes)
  await payload.delete({ collection: 'media', id: media.id, ...auth })
  ids.splice(ids.indexOf(media.id), 1)
  assert.deepEqual(await readFile(path.join(directory, updated.filename!)), updatedBytes)
  await collectMedia(payload, { apply: true, now: now + 3 * MEDIA_GC_GRACE })
  assert.deepEqual(await readFile(path.join(directory, updated.filename!)), updatedBytes)
  await collectMedia(payload, { apply: true, now: now + 4 * MEDIA_GC_GRACE })
  await assert.rejects(readFile(path.join(directory, updated.filename!)))
  checks.push('Delete revertido mantém bytes/registro; delete confirmado retira registro e só remove arquivo após carência.')

  const outside = path.join(temporary, 'outside.txt'), outsideBytes = Buffer.from('synthetic outside content')
  await writeFile(outside, outsideBytes)
  const link = path.join(directory, `${randomUUID()}.webp`)
  await symlink(outside, link)
  await writeFile(path.join(directory, 'notes.txt'), 'synthetic unknown file')
  assert.ok((await collectMedia(payload, { apply: true, now: now + 5 * MEDIA_GC_GRACE })).skipped >= 2)
  assert.deepEqual(await readFile(outside), outsideBytes)
  await writeFile(path.join(directory, MEDIA_GC_INDEX), '{broken')
  await assert.rejects(collectMedia(payload, { apply: true }), /índice de mídia/)
  assert.deepEqual(await readFile(outside), outsideBytes)
  checks.push('Symlink/arquivo desconhecido não removidos; índice corrompido interrompe sem seguir caminho externo.')
  await mkdir('artifacts/media-integrity', { recursive: true })
  await writeFile('artifacts/media-integrity/local-results.json', JSON.stringify({ date: '2026-10-22 America/Belem', environment: 'PostgreSQL loopback e diretório temporário exclusivo; arquivos sintéticos', checks, outboundCalls: false, limits: 'Domínio local e filesystem; servidor standalone, imagem e permissões do runtime precisam de rodada própria.' }, null, 2))
  console.log(`Integridade de mídia: ${checks.length} grupos aprovados; sem chamadas externas.`)
} finally {
  try {
    for (const id of ids) await payload.delete({ collection: 'media', id, overrideAccess: true })
    if (owner) await payload.delete({ collection: 'admin-users', id: owner.id, overrideAccess: true })
  } finally {
    await payload.destroy()
    await rm(temporary, { recursive: true, force: true })
  }
}
process.exit(0)

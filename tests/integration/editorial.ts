import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { readdir, mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises'
import { getPayload } from 'payload'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import config from '../../src/payload.config'
import { CONTRACT, fileDigest, type Manifest } from '../../src/modules/editorial/contract'
import { editorialRequest } from '../../src/modules/editorial/http'
import { up, down } from '../../migrations/20261029_010000_editorial_imports'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/bibliotheon_qa_editorial_[a-f0-9]+$/)
const payload = await getPayload({ config }), db = (payload.db as unknown as PostgresAdapter).drizzle
const checks: string[] = []
try {
  const migrationArgs = { db, payload } as never
  await down(migrationArgs); await up(migrationArgs); checks.push('migration up/down on empty tables')
  const owner = await payload.create({ collection: 'admin-users', data: { email: 'editorial@example.invalid', password: 'synthetic-password-12345', role: 'owner' }, overrideAccess: true, context: { provisionAdmin: true } })
  const user = { ...owner, collection: 'admin-users' as const }, auth = { user, overrideAccess: false as const }
  const login = await payload.login({ collection: 'admin-users', data: { email: owner.email, password: 'synthetic-password-12345' } })
  const origin = 'http://localhost:3000'
  const call = async (action: 'preview' | 'publish' | 'receipt', body: unknown, authorized = true, requestOrigin = origin) => {
    const response = await editorialRequest(new Request(`${origin}/api/v1/admin/editorial/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin, ...(authorized ? { Authorization: `JWT ${login.token}` } : {}) }, body: JSON.stringify(body) }), payload, action, { PUBLIC_SITE_URL: origin })
    return { status: response.status, body: await response.json() }
  }
  const png = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#162d40' } }).png().toBuffer()
  const manifest: Manifest = { contract: CONTRACT, sourceId: 'synthetic-book', language: 'pt-BR', edition: '1', book: { title: 'Livro sintético', slug: 'synthetic-book', theme: 'synthetic-theme', summary: 'Resumo sintético', audience: 'Testes', problem: 'Exercitar importação', promise: 'Conferir invariantes', requirements: 'Nenhum', limits: 'Não é produto real', body: 'Parágrafo um.\n\nParágrafo dois.', benefits: ['Aprendizagem sintética'], materialState: 'ready', presentationVariant: 'guide', accentPreset: 'mineral' }, cover: { file: 'cover.png', sha256: fileDigest(png), alt: 'Capa sintética' }, offers: [], pending: [] }
  const body = (m = manifest) => ({ manifest: m, cover: png.toString('base64') })
  assert.equal((await call('preview', body(), false)).status, 403)
  assert.equal((await call('preview', body(), true, 'https://evil.invalid')).status, 403)
  assert.equal((await call('publish', { ...body(), token: 'forged' })).status, 409)
  assert.equal((await call('publish', { ...body(), token: 'a.' + 'é'.repeat(43) })).status, 409)
  checks.push('HTTP owner authentication, origin and forged proof')
  const missing = await call('preview', body()); assert.equal(missing.status, 200); assert.equal(missing.body.canPublish, false)
  const theme = await payload.create({ collection: 'themes', data: { name: 'Tema sintético', slug: 'synthetic-theme', introduction: 'Introdução sintética', _status: 'published' }, ...auth })
  assert.equal((await call('preview', { ...body(), cover: Buffer.from('not an image').toString('base64') })).status, 422)
  const beforeFiles = await readdir(process.env.MEDIA_DIR!).catch(() => [])
  const first = await call('preview', body()); assert.equal(first.status, 200); assert.equal(first.body.canPublish, true, JSON.stringify(first.body))
  assert.equal((await payload.count({ collection: 'ebooks', overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'media', overrideAccess: true })).totalDocs, 0)
  assert.deepEqual(await readdir(process.env.MEDIA_DIR!).catch(() => []), beforeFiles)
  checks.push('preview has no catalogue/file writes; missing theme and invalid cover blocked')
  assert.equal((await call('publish', { ...body({ ...manifest, edition: '2' }), token: first.body.token })).status, 409)
  await payload.update({ collection: 'themes', id: theme.id, data: { introduction: 'Alteração depois da prévia' }, ...auth })
  assert.equal((await call('publish', { ...body(), token: first.body.token })).status, 409)
  const ready = await call('preview', body())
  const both = await Promise.all([call('publish', { ...body(), token: ready.body.token }), call('publish', { ...body(), token: ready.body.token })])
  assert.equal(both[0].status, 200, JSON.stringify(both[0].body)); assert.deepEqual(both[0], both[1])
  const ebookId = both[0].body.ebookId
  assert.equal((await payload.count({ collection: 'ebooks', overrideAccess: true })).totalDocs, 1)
  assert.equal((await payload.count({ collection: 'media', overrideAccess: true })).totalDocs, 1)
  const recovered = await call('receipt', { token: ready.body.token }); assert.equal(recovered.body.receipt.ebookId, ebookId)
  checks.push('stale package/state rejected; concurrent confirmation and lost-response receipt are idempotent')
  await assert.rejects(down(migrationArgs)); checks.push('rollback refuses existing import history')
  await payload.update({ collection: 'ebooks', id: ebookId, data: { title: 'Alterado no painel' }, draft: true, ...auth })
  const updated = structuredClone(manifest); updated.book.summary = 'Resumo atualizado'
  const preserved = await call('preview', body(updated)); assert.equal(preserved.body.book.title, 'Alterado no painel'); assert.equal(preserved.body.canPublish, true, JSON.stringify(preserved.body))
  assert.equal((await call('publish', { ...body(updated), token: preserved.body.token })).status, 200)
  updated.book.title = 'Alterado no pacote'
  const conflict = await call('preview', body(updated)); assert.ok(conflict.body.conflicts.includes('book.title'))
  assert.equal((await call('publish', { ...body(updated), token: conflict.body.token })).status, 422)
  updated.resolutions = { 'book.title': 'package' }
  const resolved = await call('preview', body(updated)); assert.equal(resolved.body.canPublish, true, JSON.stringify(resolved.body))
  assert.equal((await call('publish', { ...body(updated), token: resolved.body.token })).status, 200)
  checks.push('manual draft preserved, conflict blocked and explicit package resolution applied')
  for (const provider of ['hotmart', 'kiwify', 'cakto'] as const) {
    process.env[`CHECKOUT_ALLOWED_HOSTS_${provider.toUpperCase()}`] = 'pay.example.invalid'
    updated.offers.push({ key: provider, name: 'Oferta sintética', provider, accountKey: 'synthetic', externalProductId: 'synthetic-product', currency: 'BRL', checkoutUrl: 'https://pay.example.invalid/checkout', priceCents: 1000, active: true, primary: provider === 'hotmart', lastVerifiedAt: '2026-10-20T00:00:00.000Z', eligibilityNote: 'Verificação sintética, sem plataforma real.' })
  }
  const offerPreview = await call('preview', body(updated)); assert.equal(offerPreview.body.canPublish, true, JSON.stringify(offerPreview.body))
  const offersDone = await call('publish', { ...body(updated), token: offerPreview.body.token }); assert.equal(offersDone.status, 200, JSON.stringify(offersDone.body))
  assert.equal((await payload.count({ collection: 'offers', overrideAccess: true })).totalDocs, 3)
  const invalid = structuredClone(updated); invalid.offers[0].checkoutUrl = 'https://evil.invalid'; assert.equal((await call('preview', body(invalid))).body.canPublish, false)
  const changedIdentity = structuredClone(updated); changedIdentity.offers[0].externalProductId = 'different'; assert.equal((await call('preview', body(changedIdentity))).body.canPublish, false)
  const omitted = structuredClone(updated); omitted.offers = []
  const omittedPreview = await call('preview', body(omitted)); assert.equal((await call('publish', { ...body(omitted), token: omittedPreview.body.token })).status, 200)
  assert.equal((await payload.count({ collection: 'offers', overrideAccess: true })).totalDocs, 3)
  checks.push('three providers imported; invalid checkout/identity changes blocked; omitted offers preserved')
  // Force a native hook failure after upload to prove rollback of catalogue and receipt.
  const rollback = structuredClone(manifest); rollback.sourceId = 'rollback-book'; rollback.book.slug = 'rollback-book'; rollback.book.theme = 'synthetic-theme'
  const rollbackPreview = await call('preview', body(rollback)); assert.equal(rollbackPreview.body.canPublish, true)
  const hooks = payload.collections.ebooks.config.hooks.beforeChange!
  const fail = () => { throw new Error('synthetic rollback') }; hooks.push(fail)
  try { assert.equal((await call('publish', { ...body(rollback), token: rollbackPreview.body.token })).status, 503) } finally { hooks.pop() }
  assert.equal((await payload.count({ collection: 'ebooks', overrideAccess: true })).totalDocs, 1)
  assert.equal((await payload.count({ collection: 'media', overrideAccess: true })).totalDocs, 1)
  assert.equal((await call('receipt', { token: rollbackPreview.body.token })).body.receipt, null)
  assert.equal((await call('publish', { ...body(rollback), token: rollbackPreview.body.token })).status, 200)
  checks.push('failure after file upload rolls back DB/receipt; retry safely succeeds')
  // Changing only alt in the panel must not create new image copies on later imports.
  const liveBook = await payload.findByID({ collection: 'ebooks', id: ebookId, depth: 0, ...auth })
  await payload.update({ collection: 'media', id: String(liveBook.cover), data: { alt: 'Descrição alterada no painel' }, ...auth })
  const mediaCount = (await payload.count({ collection: 'media', overrideAccess: true })).totalDocs
  for (let n = 0; n < 2; n++) {
    const p = await call('preview', body(omitted)); assert.equal(p.body.book.coverAlt, 'Descrição alterada no painel')
    assert.equal((await call('publish', { ...body(omitted), token: p.body.token })).status, 200)
  }
  assert.equal((await payload.count({ collection: 'media', overrideAccess: true })).totalDocs, mediaCount)
  checks.push('manual cover alt preserved without repeated media uploads')

  const manualTheme = await payload.create({ collection: 'themes', data: { name: 'Tema manual', slug: 'manual-theme', introduction: 'Tema manual', _status: 'published' }, ...auth })
  await payload.update({ collection: 'ebooks', id: ebookId, data: { theme: manualTheme.id }, draft: true, ...auth })
  const preservedTheme = await call('preview', body(omitted)); assert.equal(preservedTheme.body.canPublish, true)
  await payload.update({ collection: 'themes', id: manualTheme.id, data: { archived: true }, ...auth })
  assert.equal((await call('publish', { ...body(omitted), token: preservedTheme.body.token })).status, 409)
  assert.equal((await call('preview', body(omitted))).body.canPublish, false)
  await payload.update({ collection: 'themes', id: manualTheme.id, data: { archived: false }, ...auth })
  checks.push('manually selected theme participates in preview validity and stale-state checks')

  // Real HTTP + PTY exercise the two user commands, hidden password, HTML and receipt.
  let cliOrigin = ''
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk))
      const content = Buffer.concat(chunks)
      if (request.url === '/api/admin-users/login') {
        const data = JSON.parse(content.toString())
        const logged = await payload.login({ collection: 'admin-users', data })
        response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ token: logged.token })); return
      }
      if (request.method === 'GET') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('Página sintética'); return }
      const action = request.url?.split('/').at(-1) as 'preview' | 'publish' | 'receipt'
      const headers = new Headers(); for (const [key, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(key, value)
      const result = await editorialRequest(new Request(cliOrigin + request.url, { method: 'POST', headers, body: content }), payload, action, { PUBLIC_SITE_URL: cliOrigin })
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(await result.text())
    } catch { response.writeHead(500); response.end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address(); assert.ok(address && typeof address !== 'string'); cliOrigin = `http://127.0.0.1:${address.port}`
  const directory = await mkdtemp(path.join(tmpdir(), 'editorial-cli-')), pkg = path.join(directory, 'publicacao/bibliotheon')
  try {
    const cliManifest = structuredClone(manifest); cliManifest.sourceId = 'cli-book'; cliManifest.book.slug = 'cli-book'
    await mkdir(pkg, { recursive: true }); await writeFile(path.join(pkg, 'manifest.json'), JSON.stringify(cliManifest)); await writeFile(path.join(pkg, 'cover.png'), png)
    for (const command of ['validar', 'preparar', 'publicar', 'publicar', 'consultar']) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('python3', ['tests/helpers/editorial_cli.py', command, directory], { env: { ...process.env, BIBLIOTHEON_URL: cliOrigin }, stdio: ['ignore', 'pipe', 'pipe'] })
        let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
        child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(output)))
      })
    }
    const cliReceipt = JSON.parse(await readFile(path.join(pkg, '.local/receipt.json'), 'utf8'))
    assert.equal(cliReceipt.sourceKey, 'cli-book:pt-BR'); assert.ok(cliReceipt.ebookId)
    const html = await readFile(path.join(pkg, '.local/preview.html'), 'utf8'); assert.ok(html.includes('Conteúdo resultante'))
    assert.ok(!html.includes('synthetic-password-12345'))
    checks.push('real HTTP/PTY client validate, preview HTML, publish, repeat and receipt; password hidden')
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await rm(directory, { recursive: true, force: true }) }
  const links = await db.execute(sql`SELECT count(*)::int AS count FROM editorial_links`); assert.equal(links.rows[0].count, 3)
  await mkdir('artifacts/editorial', { recursive: true }); await writeFile('artifacts/editorial/local-results.json', JSON.stringify({ synthetic: true, remoteWrites: false, checks }, null, 2) + '\n')
  console.log(`Editorial: ${checks.length} grupos sintéticos aprovados.`)
} finally { await payload.destroy() }
process.exit(0)

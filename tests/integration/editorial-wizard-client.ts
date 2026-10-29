import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { CONTRACT, digest, fileDigest } from '../../src/modules/editorial/contract'
const directory = await mkdtemp(path.join(tmpdir(), 'editorial-wizard-test-'))
const pkg = path.join(directory, 'publicacao/bibliotheon')
let logins = 0, publications = 0
const pending = 'Confirmar o slug do tema publicado no Bibliotheon; desenvolvimento-de-software é proposta local.'
const m = { contract: CONTRACT, sourceId: 'synthetic', language: 'pt-BR', edition: '1', book: { title: 'Livro sintético', slug: 'livro-sintetico', theme: 'proposta', summary: 'Resumo', materialState: 'ready', presentationVariant: 'guide', accentPreset: 'mineral' }, cover: { file: 'cover.png', alt: 'Capa', sha256: fileDigest(Buffer.from('synthetic-cover')) }, offers: [], pending: [pending] }
const server = createServer(async (request, response) => {
  try {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null
    response.setHeader('Content-Type', 'application/json')
    if (request.url === '/api/admin-users/login') { logins++; assert.equal(body.password, 'synthetic-password-12345'); response.end(JSON.stringify({ token: 'synthetic-token' })); return }
    if (request.url?.startsWith('/api/themes?')) { response.end(JSON.stringify({ docs: [{ id: 'theme', name: 'Tecnologia', slug: 'tecnologia', _status: 'published' }], hasNextPage: false })); return }
    if (request.url?.startsWith('/api/ebooks?')) { response.end(JSON.stringify({ docs: [], hasNextPage: false })); return }
    if (request.url === '/api/v1/admin/editorial/preview') { assert.equal(body.manifest.book.theme, 'tecnologia'); assert.deepEqual(body.manifest.pending, []); response.end(JSON.stringify({ contract: CONTRACT, packageHash: digest(body.manifest), token: 'synthetic-proof', canPublish: true, book: body.manifest.book, offers: [], blockers: [], conflicts: [], changes: [] })); return }
    if (request.url === '/api/v1/admin/editorial/receipt') { response.end(JSON.stringify({ contract: CONTRACT, receipt: null })); return }
    if (request.url === '/api/v1/admin/editorial/publish') { publications++; response.end(JSON.stringify({ contract: CONTRACT, ebookId: 'synthetic-book', path: '/ebooks/livro-sintetico', publishedAt: new Date().toISOString() })); return }
    if (request.url === '/ebooks/livro-sintetico') { response.end('{}'); return }
    response.writeHead(404); response.end('{}')
  } catch { response.writeHead(500); response.end('{}') }
})
try {
  await mkdir(pkg, { recursive: true }); await writeFile(path.join(pkg, 'manifest.json'), JSON.stringify(m)); await writeFile(path.join(pkg, 'cover.png'), 'synthetic-cover')
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address(); assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolve, reject) => {
    const child = spawn('python3', ['tests/helpers/editorial_wizard_cli.py', directory], { env: { ...process.env, BIBLIOTHEON_URL: `http://127.0.0.1:${address.port}` }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(output)))
  })
  assert.equal(logins, 1); assert.equal(publications, 1)
  const saved = JSON.parse(await readFile(path.join(pkg, 'manifest.json'), 'utf8')); assert.equal(saved.book.theme, 'tecnologia'); assert.deepEqual(saved.pending, [])
  assert.ok((await readdir(path.join(pkg, '.local'))).some(n => n.startsWith('manifest-antes-')))
  assert.equal(JSON.parse(await readFile(path.join(pkg, '.local/receipt.json'), 'utf8')).ebookId, 'synthetic-book')
  console.log('Assistente HTTP/PTY: tema, ausência de cadastro, página sem ofertas, backup, prévia e publicação sintética com um login aprovados.')
} finally { await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }) }

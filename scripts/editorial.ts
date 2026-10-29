import { readFile, writeFile, mkdir, realpath, stat, rename } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { CONTRACT, digest, fileDigest, parseManifest } from '../src/modules/editorial/contract'

const usage = 'Uso: bibliotheon validar|preparar|publicar|consultar <pasta-do-titulo>\nBIBLIOTHEON_URL: destino (padrão https://bibliotheon.com.br). Credenciais somente no terminal privado.'
const [action, title, ...extra] = process.argv.slice(2)
if (!action || action === '--help') { console.log(usage); process.exit(0) }
if (!title || extra.length || !['validar', 'preparar', 'publicar', 'consultar'].includes(action)) { console.error(usage); process.exit(2) }
const origin = new URL(process.env.BIBLIOTHEON_URL || 'https://bibliotheon.com.br').origin
const target = new URL(origin)
if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))) throw new Error('Destino exige HTTPS, exceto loopback local.')
const root = path.resolve(title, 'publicacao/bibliotheon'), stateDir = path.join(root, '.local'), statePath = path.join(stateDir, 'preview.json')
async function privateJSON(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await rename(temp, file)
}
async function loadState() { try { return JSON.parse(await readFile(statePath, 'utf8')) } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new Error('Prévia local inválida; preserve o arquivo e confira a operação.') } }
async function http(route: string, data: unknown, token?: string) {
  const response = await fetch(`${origin}${route}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `JWT ${token}` } : {}) }, body: JSON.stringify(data) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Destino não retornou JSON. Confira URL, implantação da integração e configuração do proxy.')
  const result = await response.json()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.code || 'request_failed'}${result.message ? ` — ${result.message}` : ''}`)
  return result
}
async function login() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Login exige terminal privado interativo. Não envie senhas por argumentos ou pelo chat.')
  let muted = false
  const output = new Writable({ write(chunk, _encoding, done) { if (!muted) process.stdout.write(chunk); done() } })
  const reader = createInterface({ input: process.stdin, output, terminal: true })
  try {
    const email = await reader.question(`Owner em ${origin}\nE-mail: `)
    process.stdout.write('Senha (oculta): '); muted = true
    const password = await reader.question(''); muted = false; process.stdout.write('\n')
    const result = await http('/api/admin-users/login', { email, password })
    if (!result.token) throw new Error('Login sem token; confira a versão do destino.')
    return result.token as string
  } finally { reader.close(); output.end() }
}
const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
async function main() {
  const old = await loadState()
  if (action === 'preparar' && old?.pending) throw new Error('Há uma confirmação sem resultado conhecido. Use consultar ou repita publicar com a mesma prévia.')
  if (action === 'consultar') {
    if (!old || old.origin !== origin) throw new Error('Não há prévia deste destino.')
    const token = await login(), result = await http('/api/v1/admin/editorial/receipt', { token: old.token }, token)
    if (result.contract !== CONTRACT) throw new Error('Contrato remoto incompatível.')
    if (!result.receipt) { console.log('Nenhum recibo confirmado. Preserve a prévia; repetir publicar usa a mesma operação.'); return }
    await privateJSON(path.join(stateDir, 'receipt.json'), { origin, ...result.receipt }); await privateJSON(statePath, { ...old, pending: false })
    console.log(`Publicação confirmada: ${origin}${result.receipt.path}`); return
  }
  const manifestFile = path.join(root, 'manifest.json')
  if ((await stat(manifestFile)).size > 256 * 1024) throw new Error('Manifesto maior que 256 KiB.')
  const manifest = parseManifest(JSON.parse(await readFile(manifestFile, 'utf8')))
  const coverPath = await realpath(path.join(root, manifest.cover.file))
  if (path.dirname(coverPath) !== await realpath(root)) throw new Error('Capa precisa estar dentro do pacote, sem link para arquivo externo.')
  if ((await stat(coverPath)).size > 5 * 1024 * 1024) throw new Error('Capa maior que 5 MiB.')
  const cover = await readFile(coverPath)
  if (fileDigest(cover) !== manifest.cover.sha256) throw new Error('Hash da capa diverge do manifesto.')
  if (action === 'validar') { console.log(`Contrato/hash válidos. ${manifest.pending.length} pendência(s). Validações do catálogo requerem preparar.`); return }
  if (action === 'publicar' && (!old || old.origin !== origin || old.packageHash !== digest(manifest))) throw new Error('Prepare uma prévia deste pacote e destino antes de publicar.')
  const token = await login(), data = { manifest, cover: cover.toString('base64') }
  if (action === 'preparar') {
    const result = await http('/api/v1/admin/editorial/preview', data, token)
    if (result.contract !== CONTRACT || result.packageHash !== digest(manifest)) throw new Error('Contrato ou hash remoto incompatível.')
    await privateJSON(statePath, { ...result, origin, pending: false })
    const ext = manifest.cover.file.split('.').at(-1), mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Prévia editorial</title><style>body{max-width:900px;margin:40px auto;padding:20px;font:18px system-ui}img{max-width:220px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>${escape(manifest.book.title)}</h1><p>Destino: ${escape(origin)} · prévia de conteúdo, não captura da página final.</p><img alt="${escape(manifest.cover.alt)}" src="data:${mime};base64,${data.cover}"><h2>Pendências e conflitos</h2><pre>${escape(JSON.stringify({ blockers: result.blockers, conflicts: result.conflicts }, null, 2))}</pre><h2>Conteúdo resultante</h2><pre>${escape(JSON.stringify({ book: result.book, offers: result.offers }, null, 2))}</pre><h2>Diferenças</h2><pre>${escape(JSON.stringify(result.changes, null, 2))}</pre></html>`
    await writeFile(path.join(stateDir, 'preview.html'), html, { mode: 0o600 })
    console.log(`Prévia: ${path.join(stateDir, 'preview.html')}\n${result.canPublish ? 'Pronto para revisar e executar publicar.' : 'Publicação bloqueada. Confira pendências/conflitos na prévia.'}`)
    return
  }
  if (!old.canPublish) throw new Error('Prévia bloqueada. Resolva as pendências e prepare novamente.')
  await privateJSON(statePath, { ...old, pending: true })
  let result
  try {
    const previous = await http('/api/v1/admin/editorial/receipt', { token: old.token }, token)
    result = previous.receipt || await http('/api/v1/admin/editorial/publish', { ...data, token: old.token }, token)
  } catch (error) {
    // Explicit HTTP refusals are final; network/503 failures remain uncertain.
    if (error instanceof Error && /^HTTP 4\d\d:/.test(error.message)) await privateJSON(statePath, { ...old, pending: false })
    throw error
  }
  if (result.contract !== CONTRACT) throw new Error('Resposta incompatível; consulte o recibo.')
  await privateJSON(path.join(stateDir, 'receipt.json'), { origin, ...result }); await privateJSON(statePath, { ...old, pending: false })
  const page = new URL(result.path, origin)
  if (page.origin !== origin) throw new Error('URL retornada diverge do destino.')
  try {
    const response = await fetch(page, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    console.log(`Publicado: ${page}\nConferência pública: HTTP ${response.status}. Recibo salvo; esta consulta não comprova entrega nas plataformas.`)
  } catch { console.log(`Publicado: ${page}\nRecibo salvo. Conferência pública indisponível; não repita o cadastro.`) }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Falha na integração.'); process.exitCode = 1 })

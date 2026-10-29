import { readFile, writeFile, mkdir, realpath, stat, rename } from 'node:fs/promises'
import path from 'node:path'
import { editorialHTTPError } from '../src/modules/editorial/client-errors'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { previewHTML } from '../src/modules/editorial/preview-html'
import { publicationWizard } from '../src/modules/editorial/wizard'
import { CONTRACT, digest, fileDigest, parseManifest } from '../src/modules/editorial/contract'

const usage = 'Uso: bibliotheon assistir|validar|preparar|publicar|consultar <pasta-do-titulo>\nBIBLIOTHEON_URL: destino (padrão https://bibliotheon.com.br). Credenciais somente no terminal privado.'
const [action, title, ...extra] = process.argv.slice(2)
if (!action || action === '--help') { console.log(usage); process.exit(0) }
if (!title || extra.length || !['assistir', 'validar', 'preparar', 'publicar', 'consultar'].includes(action)) { console.error(usage); process.exit(2) }
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
async function http(route: string, data: unknown, token?: string, method: 'GET' | 'POST' = 'POST') {
  const response = await fetch(`${origin}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `JWT ${token}` } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(data) })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    if (!response.ok) throw new Error(editorialHTTPError(response.status, route))
    throw new Error('Destino não retornou JSON. Confira URL, implantação da integração e configuração do proxy.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(editorialHTTPError(response.status, route, result.code, result.message))
  return result
}
let sessionToken: string | undefined
async function login() {
  if (sessionToken) return sessionToken
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
    sessionToken = result.token as string
    return sessionToken
  } finally { reader.close(); output.end() }
}
async function main(command = action) {
  const old = await loadState()
  if (command === 'assistir') {
    const manifestPath = path.join(root, 'manifest.json')
    let original = await readFile(manifestPath, 'utf8')
    const manifest = parseManifest(JSON.parse(original))
    if (old?.pending) throw new Error('Há uma confirmação incerta. Use consultar antes de alterar o pacote.')
    console.log(`Destino: ${origin}. O login será mantido somente na memória até este assistente encerrar.`)
    const token = await login()
    const ask = async (prompt: string) => {
      const reader = createInterface({ input: process.stdin, output: process.stdout })
      try { return await reader.question(prompt) } finally { reader.close() }
    }
    await publicationWizard(manifest, old?.origin === origin ? old : null, {
      ask, say: value => console.log(value),
      request: (route, data, method) => http(route, data, token, method),
      save: async value => {
        if (await readFile(manifestPath, 'utf8') !== original) throw new Error('O pacote foi alterado por outro processo. Inicie uma nova revisão.')
        if (await loadState().then(state => state?.pending)) throw new Error('Há uma confirmação incerta; preserve o pacote.')
        await mkdir(stateDir, { recursive: true, mode: 0o700 })
        await writeFile(path.join(stateDir, `manifest-antes-${Date.now()}.json`), original, { flag: 'wx', mode: 0o600 })
        await privateJSON(manifestPath, value)
        original = await readFile(manifestPath, 'utf8')
      },
      prepare: () => main('preparar'), readPreview: loadState, publish: () => main('publicar'),
    })
    return
  }
  if (command === 'preparar' && old?.pending) throw new Error('Há uma confirmação sem resultado conhecido. Use consultar ou repita publicar com a mesma prévia.')
  if (command === 'consultar') {
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
  if (command === 'validar') { console.log(`Contrato/hash válidos. ${manifest.pending.length} pendência(s). Validações do catálogo requerem preparar.`); return }
  if (command === 'publicar' && (!old || old.origin !== origin || old.packageHash !== digest(manifest))) throw new Error('Prepare uma prévia deste pacote e destino antes de publicar.')
  const token = await login(), data = { manifest, cover: cover.toString('base64') }
  if (command === 'preparar') {
    const result = await http('/api/v1/admin/editorial/preview', data, token)
    if (result.contract !== CONTRACT || result.packageHash !== digest(manifest)) throw new Error('Contrato ou hash remoto incompatível.')
    await privateJSON(statePath, { ...result, origin, pending: false })
    const html = previewHTML(manifest, result, origin, data.cover)
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

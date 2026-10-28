import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const root = createRequire(import.meta.url)
const richtext = createRequire(root.resolve('@payloadcms/richtext-lexical'))
const headless = createRequire(richtext.resolve('@lexical/headless'))
const payload = createRequire(root.resolve('payload'))
const ui = createRequire(root.resolve('@payloadcms/ui'))
const reactMonaco = createRequire(ui.resolve('@monaco-editor/react'))
const monaco = createRequire(reactMonaco.resolve('monaco-editor'))
const packageVersion = async (resolver, name) => {
  let folder = dirname(resolver.resolve(name))
  while (true) {
    try {
      const manifest = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'))
      if (manifest.name === name) return manifest.version
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    const parent = dirname(folder)
    if (parent === folder) throw new Error(`Manifesto de ${name} ausente.`)
    folder = parent
  }
}
const versions = { dompurify: await packageVersion(monaco, 'dompurify'), undici: await packageVersion(payload, 'undici'), 'happy-dom': await packageVersion(headless, 'happy-dom') }
assert.deepEqual(versions, { dompurify: '3.4.17', undici: '7.30.1', 'happy-dom': '21.0.4' })
const { createHeadlessEditor } = richtext('@lexical/headless')
const { withDOM } = richtext('@lexical/headless/dom')
const { $generateNodesFromDOM, $generateHtmlFromNodes } = richtext('@lexical/html')
const { $getRoot } = richtext('lexical')
withDOM(window => {
  const editor = createHeadlessEditor({ namespace: 'bibliotheon-dependency-qa', onError: error => { throw error } })
  const document = new window.DOMParser().parseFromString('<p>Conteúdo editorial <strong>preservado</strong>.</p>', 'text/html')
  editor.update(() => { $getRoot().append(...$generateNodesFromDOM(editor, document)) }, { discrete: true })
  const html = editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null))
  assert.match(html, /Conteúdo editorial/)
  assert.match(html, /<b[^>]*>preservado<\/b>|<strong[^>]*>preservado<\/strong>/)
})
assert.equal(await (await payload('undici').fetch('data:text/plain,bibliotheon')).text(), 'bibliotheon')

const { chromium } = root('@playwright/test')
const browser = await chromium.launch()
let externalRequests = 0
try {
  const page = await browser.newPage()
  page.on('request', request => { if (/^https?:/.test(request.url())) externalRequests++ })
  await page.route('**/*', route => route.abort())
  await page.addScriptTag({ path: join(dirname(monaco.resolve('dompurify')), 'purify.min.js') })
  const result = await page.evaluate(() => {
    const clean = DOMPurify.sanitize('<p>Texto <strong>editorial</strong></p><img src="x" onerror="bad()"><a href="javascript:bad()">Link</a>')
    const doc = new DOMParser().parseFromString(clean, 'text/html')
    return { version: DOMPurify.version, text: doc.body.textContent, unsafe: !!doc.querySelector('[onerror],script,[href^="javascript:"]'), template: DOMPurify.sanitize('<p>{{demo}}</p>', { SAFE_FOR_TEMPLATES: true }) }
  })
  assert.equal(result.version, versions.dompurify)
  assert.match(result.text, /Texto editorial/)
  assert.equal(result.unsafe, false)
  assert.ok(!result.template.includes('{{'))
  assert.equal(externalRequests, 0)
} finally { await browser.close() }
const sources = ['package.json', 'pnpm-lock.yaml', 'scripts/qa-dependency-compatibility.mjs']
const sourceSHA256 = Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
await mkdir('artifacts/security', { recursive: true })
await writeFile('artifacts/security/d120-compatibility.json', JSON.stringify({ phase: 'D120', completedAt: new Date().toISOString(), versions, checks: ['resolução a partir dos consumidores Payload/Lexical/Monaco', 'HTML para Lexical e HTML com texto/negrito preservados', 'Undici fetch data URL sem rede', 'DOMPurify no Chromium preserva conteúdo e remove atributos/código inseguros'], externalRequests, advisoryExploitCoverage: false, productionChanged: false, sourceSHA256 }, null, 2) + '\n')
console.log('Compatibilidade das dependências: quatro grupos aprovados; zero requisições externas.')

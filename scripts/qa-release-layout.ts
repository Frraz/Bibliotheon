import assert from 'node:assert/strict'
import { chromium, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { seedRelationship } from '../tests/fixtures/relationship'
import { testOrigin as base } from '../tests/fixtures/origin'
import { textBody } from '../tests/fixtures/site'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Somente banco descartável sintético.')
const output = 'artifacts/qa-release-layout'
await mkdir(output, { recursive: true })
const seed = await seedRelationship(), { payload } = seed
const folder = await mkdtemp(join(tmpdir(), 'bibliotheon-release-layout-'))
const extension = join(folder, 'extension'); await mkdir(extension)
await writeFile(join(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Bibliotheon native zoom QA', version: '1.0.0', permissions: ['tabs'], background: { service_worker: 'background.js' } }))
await writeFile(join(extension, 'background.js'), 'globalThis.ready = true;')
let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined
let labBrowser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let browserVersion: string | undefined
let externalRequests = 0
const runtimeErrors: string[] = []
const checks: Array<Record<string, unknown>> = []
const mode = process.env.BIBLIOTHEON_RELEASE_LAYOUT_MODE || 'all'
assert.ok(['all', 'lab'].includes(mode), 'Modo QA inválido.')
const runtimeSources = ['package.json', 'pnpm-lock.yaml', 'src/styles/admin.css', 'src/styles/site.css', 'patches/@payloadcms__ui@3.91.0.patch']
const extraArticles: string[] = [], extraThemes: string[] = []
type Tabs = { query: (query: object) => Promise<Array<{ id: number; url?: string }>>; setZoomSettings: (id: number, settings: object) => Promise<void>; setZoom: (id: number, factor: number) => Promise<void>; getZoom: (id: number) => Promise<number> }
try {
  const routes = [
    ['/', 'home'], ['/ebooks', 'catalog'], ['/ebooks?q=nenhumzzzz', 'catalog-empty'],
    ...seed.books.map(book => [`/ebooks/${book.slug}`, `lp-${book.presentationVariant}`]),
    [`/artigos/${seed.article.slug}`, 'article'], [`/temas/${seed.theme.slug}`, 'theme'],
    ['/sobre', 'about'], ['/contato', 'contact'], ['/privacidade', 'privacy'], ['/termos', 'terms'],
    [`/amostras/${seed.magnet.slug}`, 'sample'], ['/amostras/confirmar?t=expired', 'confirmation-invalid-token'], ['/preferencias?t=expired', 'preferences-invalid-token'],
    ['/admin', 'admin-dashboard'], ['/admin/collections/ebooks', 'admin-books'], [`/admin/collections/ebooks/${seed.books[0].id}`, 'admin-book-edit'],
    ['/admin/collections/articles', 'admin-articles'], ['/admin/collections/campaigns', 'admin-campaigns'], ['/admin/collections/contacts', 'admin-contacts'],
    ['/admin/collections/email-sequences', 'admin-sequences'], ['/admin/commercial-inbox', 'admin-inbox'], ['/admin/financial-ledger', 'admin-ledger'],
    ['/admin/financial-records', 'admin-records'], ['/admin/commercial-imports', 'admin-imports'], ['/admin/catalog-resolutions', 'admin-catalog-resolutions'],
    ['/admin/financial-resolutions', 'admin-financial-resolutions'], ['/admin/suppressions', 'admin-suppressions'], ['/admin/globals/site-settings', 'admin-settings'],
  ]
  if (mode === 'all') {
  context = await chromium.launchPersistentContext(join(folder, 'profile'), { channel: 'chromium', headless: true, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1280,960', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] })
  browserVersion = context.browser()?.version()
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  await context.route(/^https?:\/\//, route => { if (new URL(route.request().url()).origin === base) return route.continue(); externalRequests++; return route.abort() })
  context.on('page', page => page.on('pageerror', error => runtimeErrors.push(error.name)))
  await context.addInitScript(() => { try { localStorage.setItem('bibliotheon:appearance:v1', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') } catch {} })
  assert.equal((await context.request.post(base + '/api/admin-users/login', { data: { email: seed.owner.email, password: seed.password } })).status(), 200)
  const page = context.pages()[0] || await context.newPage()
  page.on('pageerror', error => runtimeErrors.push(error.name))
  const captureSession = await context.newCDPSession(page)
  async function captureNative(path: string) {
    const shot = await captureSession.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
    const buffer = Buffer.from(shot.data, 'base64')
    assert.equal(buffer.readUInt32BE(16), 1280, 'Captura deve preservar a largura física do viewport nativo.')
    await writeFile(path, buffer)
    return { path, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), sha256: createHash('sha256').update(buffer).digest('hex') }
  }
  async function zoom(page: Page, factor: number) {
    const actual = await worker.evaluate(async ({ url, factor }) => {
      const tabs = (globalThis as unknown as { chrome: { tabs: Tabs } }).chrome.tabs
      const tab = (await tabs.query({})).find(tab => tab.url === url)
      if (!tab) throw new Error('Aba sintética não encontrada para zoom.')
      await tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-tab' })
      await tabs.setZoom(tab.id, factor)
      return tabs.getZoom(tab.id)
    }, { url: page.url(), factor })
    assert.ok(Math.abs(actual - factor) < 0.01)
    await page.waitForFunction(factor => Math.abs(devicePixelRatio - factor) < 0.01, factor)
  }
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    for (const [route, name] of routes) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' })
      assert.equal(response?.status(), 200, `${name}: rota indisponível`)
      assert.ok(!page.url().includes('/admin/login'), `${name}: autenticação perdida`)
      await page.evaluate(() => document.fonts.ready)
      await zoom(page, 4)
      if (name === 'confirmation-invalid-token') { await page.getByRole('button', { name: 'Confirmar e acessar amostra', exact: true }).click(); await page.getByRole('alert').waitFor() }
      if (name === 'preferences-invalid-token') { await page.getByRole('button', { name: 'Consultar minhas assinaturas' }).click(); await page.getByRole('alert').waitFor() }
      if (name === 'admin-book-edit') { await page.getByRole('region', { name: 'Ações do documento' }).focus(); await page.keyboard.press('ArrowRight') }
      const metrics = await page.evaluate(() => ({ innerWidth, outerWidth, dpr: devicePixelRatio, scrollWidth: document.documentElement.scrollWidth, h1: document.querySelector('h1')?.textContent?.trim(), activeTheme: document.documentElement.getAttribute('data-theme') }))
      assert.equal(metrics.outerWidth, 1280)
      assert.equal(metrics.innerWidth, 320)
      assert.equal(metrics.activeTheme, theme, `${name}: tema incorreto`)
      assert.ok(metrics.h1, `${name}: página sem título`)
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      const violations = axe.violations.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })) }))
      const topCapture = await captureNative(`${output}/${name}-${theme}-native400-top.png`)
      await page.locator('h1').first().scrollIntoViewIfNeeded()
      const headingCapture = await captureNative(`${output}/${name}-${theme}-native400.png`)
      checks.push({ name, status: response?.status(), route: route.replaceAll(seed.books[0].slug, '[book]').replaceAll(seed.magnet.slug, '[magnet]'), theme, nativeZoom: 4, capture: 'CDP Page.captureScreenshot do viewport físico; helper Playwright recorta em zoom nativo', screenshots: [topCapture, headingCapture], metrics: { ...metrics, h1: true }, overflow: metrics.scrollWidth > metrics.innerWidth, violations })
      await writeFile(`${output}/d121-progress.json`, JSON.stringify({ checks, externalRequests, runtimeErrors }, null, 2) + '\n')
      assert.equal(metrics.scrollWidth > metrics.innerWidth, false, `${name}/${theme}: overflow no zoom nativo`)
      assert.deepEqual(violations, [], `${name}/${theme}: axe`)
      await page.keyboard.press('Tab')
      assert.ok(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), `${name}: teclado sem foco`)
      await zoom(page, 1)
    }
  }
  await context.close(); context = undefined
  assert.equal(externalRequests, 0)
  assert.deepEqual(runtimeErrors, [])
  const nativeSources = [...runtimeSources, 'scripts/qa-release-layout.ts']
  const nativeSHA256 = Object.fromEntries(await Promise.all(nativeSources.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
  await writeFile(`${output}/d121-native-results.json`, JSON.stringify({ phase: 'D121-native', status: 'passed', buildID: (await readFile('.next-qa/BUILD_ID', 'utf8')).trim(), checks, sourceSHA256: nativeSHA256, externalRequests, runtimeErrors, productionChanged: false }, null, 2) + '\n')
  } else {
    const native = JSON.parse(await readFile(`${output}/d121-native-results.json`, 'utf8'))
    assert.equal(native.status, 'passed')
    assert.equal(native.externalRequests, 0)
    assert.deepEqual(native.runtimeErrors, [])
    assert.equal(native.buildID, (await readFile('.next-qa/BUILD_ID', 'utf8')).trim())
    for (const file of runtimeSources) assert.equal(native.sourceSHA256[file], createHash('sha256').update(await readFile(file)).digest('hex'), 'Interface/build alterado; repetir modo all.')
    assert.equal(native.checks.length, 60)
    for (const item of native.checks) {
      assert.equal(item.overflow, false); assert.deepEqual(item.violations, [])
      for (const shot of item.screenshots) assert.equal(shot.sha256, createHash('sha256').update(await readFile(shot.path)).digest('hex'))
    }
    checks.push(...native.checks)
  }
  // Same agreed initial catalog size; no financial/customer data, no external traffic.
  for (let i = 0; i < 2; i++) extraThemes.push((await payload.create({ collection: 'themes', ...seed.auth, data: { name: `Tema sintético ${i}`, slug: `qa-theme-${i}-${seed.theme.id.slice(0, 8)}`, introduction: 'Somente laboratório.', _status: 'published' } })).id)
  const themes = [seed.theme.id, ...extraThemes]
  for (let i = seed.books.length; i < 30; i++) seed.books.push(await payload.create({ collection: 'ebooks', ...seed.auth, data: { title: `Livro sintético de laboratório ${i}`, slug: `qa-lab-${i}-${seed.theme.id.slice(0, 8)}`, summary: 'Conteúdo sintético de laboratório, sem oferta real.', audience: 'Teste local', problem: 'Avaliar desempenho', promise: 'Verificar o catálogo', requirements: 'Fixture local', limits: 'Não é produto à venda.', body: textBody('Texto exclusivamente sintético para o laboratório.'), cover: seed.cover.id, theme: themes[i % themes.length], materialState: 'ready', presentationVariant: 'guide', accentPreset: 'mineral', _status: 'published' } }))
  for (let i = 1; i < 30; i++) extraArticles.push((await payload.create({ collection: 'articles', ...seed.auth, data: { title: `Artigo sintético de laboratório ${i}`, slug: `qa-article-${i}-${seed.theme.id.slice(0, 8)}`, summary: 'Somente laboratório local.', author: 'Equipe sintética', theme: themes[i % themes.length], body: textBody('Texto sintético para testar paginação e desempenho.'), _status: 'published' } })).id)
  const performance: Array<Record<string, unknown>> = []
  labBrowser = await chromium.launch()
  browserVersion ??= labBrowser.version()
  const lab = await labBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await lab.route(/^https?:\/\//, route => { if (new URL(route.request().url()).origin === base) return route.continue(); externalRequests++; return route.abort() })
  for (const [route, name] of routes.filter(([,name]) => ['home', 'catalog', 'lp-guide', 'article'].includes(name))) {
    for (let run = 1; run <= 3; run++) {
      const sample = await lab.newPage()
      const cdp = await lab.newCDPSession(sample)
      await cdp.send('Network.enable')
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 })
      await sample.addInitScript(() => {
        const metrics = { lcp: 0, cls: 0, interactions: [] as number[] }
        ;(window as unknown as { qaMetrics: typeof metrics }).qaMetrics = metrics
        new PerformanceObserver(list => { for (const entry of list.getEntries()) metrics.lcp = entry.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => { for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput: boolean; value: number }>) if (!entry.hadRecentInput) metrics.cls += entry.value }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver(list => { for (const entry of list.getEntries() as Array<PerformanceEntry & { interactionId: number }>) if (entry.interactionId) metrics.interactions.push(entry.duration) }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
      })
      const response = await sample.goto(base + route, { waitUntil: 'networkidle' })
      assert.equal(response?.status(), 200)
      await sample.evaluate(() => document.fonts.ready)
      await sample.getByLabel('Aparência').focus()
      await sample.keyboard.press('ArrowDown')
      await sample.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const metrics = await sample.evaluate(() => ({ ...(window as unknown as { qaMetrics: { lcp: number; cls: number; interactions: number[] } }).qaMetrics, keydownCount: (window.performance as Performance & { eventCounts: Map<string, number> }).eventCounts.get('keydown') || 0 }))
      assert.ok(metrics.lcp > 0)
      assert.ok(metrics.keydownCount > 0, 'Interação real de teclado ausente.')
      performance.push({ name, run, ...metrics, sampleInteractionUpperBoundMs: Math.max(16, ...metrics.interactions) })
      await sample.close()
    }
  }
  await labBrowser.close(); labBrowser = undefined
  const budgets = [...new Set(performance.map(row => String(row.name)))].map(name => {
    const rows = performance.filter(row => row.name === name)
    const p75 = (key: string) => rows.map(row => Number(row[key])).sort((a,b) => a-b)[Math.ceil(rows.length * 0.75)-1]
    return { name, samples: rows.length, lcpP75Ms: p75('lcp'), clsP75: p75('cls'), interactionP75UpperBoundMs: p75('sampleInteractionUpperBoundMs'), passed: p75('lcp') <= 2500 && p75('cls') <= 0.1 && p75('sampleInteractionUpperBoundMs') <= 200 }
  })
  const load: Array<Record<string, unknown>> = []
  for (const concurrency of [5, 10]) {
    const durations: number[] = [], errors: number[] = []
    await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
      for (let i = 0; i < 5; i++) {
        const started = performanceNow()
        const response = await fetch(base + ['/', '/ebooks', '/artigos'][(i + worker) % 3])
        await response.arrayBuffer()
        durations.push(performanceNow() - started)
        if (response.status !== 200) errors.push(response.status)
      }
    }))
    durations.sort((a,b) => a-b)
    load.push({ concurrency, requests: durations.length, errors, medianMs: durations[Math.ceil(durations.length * 0.5) - 1], p95Ms: durations[Math.ceil(durations.length * 0.95) - 1] })
    assert.deepEqual(errors, [])
  }
  assert.equal(externalRequests, 0)
  assert.deepEqual(runtimeErrors, [])
  const sources = ['scripts/qa-release-layout.ts', 'package.json', 'pnpm-lock.yaml', 'src/styles/admin.css', 'src/styles/site.css', 'patches/@payloadcms__ui@3.91.0.patch']
  const sourceSHA256 = Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
  const buildID = (await readFile('.next-qa/BUILD_ID', 'utf8')).trim()
  await writeFile(`${output}/d121-results.json`, JSON.stringify({ phase: 'D121', mode, nativeEvidence: 'd121-native-results.json', completedAt: new Date().toISOString(), buildID, browser: browserVersion, nativeZoomMechanism: 'chrome.tabs.setZoom/getZoom; janela 1280; layout 320; DPR4', checks, dataset: { books: 30, themes: 3, articles: 30 }, lab: { viewport: { width: 390, height: 844 }, cpuSlowdown: 4, latencyMs: 150, downloadBytesPerSecond: 200000, coldBrowserCache: true, warmServer: true, performance, budgets, load, fieldMetricsClaimed: false, note: 'Amostras locais; duração das interações não é INP de campo. CLS agregado conservador, sem janela de sessão.' }, externalRequests, runtimeErrors, productionChanged: false, fullH05Accepted: false, sourceSHA256 }, null, 2) + '\n')
  assert.ok(budgets.every(row => row.passed), 'Orçamento de laboratório excedido; consultar d121-results.json.')
  console.log(`D121: ${checks.length} telas/temas com zoom nativo; ${performance.length} medições e carga local 5/10 aprovadas.`)
} finally {
  await context?.close()
  await labBrowser?.close()
  for (const id of extraArticles) await payload.delete({ collection: 'articles', id, overrideAccess: true })
  // Extra books are in seed.books; delete them before their added themes.
  for (const book of seed.books.splice(3)) await payload.delete({ collection: 'ebooks', id: book.id, overrideAccess: true })
  for (const id of extraThemes) await payload.delete({ collection: 'themes', id, overrideAccess: true })
  await seed.cleanup()
  await rm(folder, { recursive: true, force: true })
}
function performanceNow() { return globalThis.performance.now() }
process.exit(0)

import { testOrigin } from '../tests/fixtures/origin'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedRelationship } from '../tests/fixtures/relationship'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

const output = 'artifacts/qa-public-redesign/site'
await mkdir(output, { recursive: true })
const seed = await seedRelationship()
const browser = await chromium.launch()
const results: unknown[] = []
async function inspect(page: Page, route: string, name: string, theme: string, width: number) {
  const response = await page.goto(`${testOrigin}${route}`, { waitUntil: 'networkidle' })
  assert.equal(response?.status(), name === 'not-found' ? 404 : 200, name)
  await page.evaluate(() => document.fonts.ready)
  if (name === 'sample') assert.equal(await page.locator('input[type=email]').count(), 1, 'Formulário de amostra deve estar disponível na QA.')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}/${theme}/${width}: overflow`)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png`, fullPage: true })
  results.push({ route, name, theme, width, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), overflow: false })
  assert.deepEqual(axe.violations.map(v => v.id), [], `${name}/${theme}/${width}: axe`)
}
try {
  const routes = [
    ['/', 'home-3'], ['/artigos', 'articles'], [`/amostras/${seed.magnet.slug}`, 'sample'], ['/amostras/confirmar?t=expired', 'confirmation'], ['/preferencias?t=expired', 'preferences'], ['/ebooks', 'catalog'], [`/ebooks?tema=${seed.theme.slug}`, 'catalog-filter'], ['/ebooks?q=nenhumzzzz', 'catalog-empty'],
    ...seed.books.map(book => [`/ebooks/${book.slug}`, `lp-${book.presentationVariant}`]),
    [`/artigos/${seed.article.slug}`, 'article'], [`/temas/${seed.theme.slug}`, 'theme'],
    ['/sobre', 'about'], ['/contato', 'contact'], ['/privacidade', 'privacy'], ['/termos', 'terms'],
    [`/ebooks/${seed.books[0].slug}?c=${seed.campaign.code}`, 'lp-affiliate'],
  ]
  for (const theme of ['light', 'dark'] as const) for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors: string[] = []
      const checkoutPrefetches: string[] = []
    page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/comprar/')) checkoutPrefetches.push(request.url()) })
    for (const [route, name] of routes) await inspect(page, route, name, theme, width)
    assert.deepEqual(errors, [], `${theme}/${width}: JavaScript`)
      assert.deepEqual(checkoutPrefetches, [], 'Checkout não deve ser pré-carregado antes do clique.')
    if (width === 320) {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
      await inspect(page, '/', 'home-text-200', theme, width)
      await inspect(page, `/ebooks/${seed.books[0].slug}`, 'lp-text-200', theme, width)
    }
    await context.close()
  }
  // Additional reflow, long-title, absent-cover, keyboard and normal-motion states.
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, colorScheme: 'dark' })
  const page = await context.newPage()
  await seed.payload.update({ collection: 'ebooks', id: seed.books[0].id, ...seed.auth, data: { title: 'Um título editorial sintético muito longo para conferir a integridade da leitura e dos controles em dispositivos estreitos sem truncar o nome da edição digital', _status: 'published' } })
  await inspect(page, `/ebooks/${seed.books[0].slug}`, 'lp-long-title', 'dark', 320)
  await seed.payload.update({ collection: 'media', id: seed.cover.id, ...seed.auth, data: { visibility: 'private' } })
  await inspect(page, `/ebooks/${seed.books[0].slug}`, 'lp-missing-cover', 'dark', 320)
  assert.ok(await page.getByText('Capa indisponível').isVisible())
  await seed.payload.update({ collection: 'media', id: seed.cover.id, ...seed.auth, data: { visibility: 'public' } })
  await page.goto(testOrigin + '/')
  await page.keyboard.press('Tab')
  assert.equal(await page.locator(':focus').innerText(), 'Ir para o conteúdo')
  await context.close()
  for (const book of seed.books.slice(1)) await seed.payload.update({ collection: 'ebooks', id: book.id, ...seed.auth, data: { archived: true, _status: 'published' } })
  for (const theme of ['light', 'dark'] as const) for (const width of [320, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    const single = await ctx.newPage()
    await inspect(single, '/', 'home-one', theme, width)
    assert.equal(await single.locator('.feature-book').count(), 1)
    await inspect(single, '/pagina-inexistente-qa', 'not-found', theme, width)
    await ctx.close()
  }
  // Native browser zoom: physical 1280px window, actual 400% zoom (320 CSS px).
  const folder = await mkdtemp(join(tmpdir(), 'bibliotheon-public-zoom-'))
  let zoomContext: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined
  try {
    const extension = join(folder, 'extension'); await mkdir(extension)
    await writeFile(join(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Public zoom QA', version: '1.0.0', permissions: ['tabs'], background: { service_worker: 'background.js' } }))
    await writeFile(join(extension, 'background.js'), 'globalThis.ready = true;')
    zoomContext = await chromium.launchPersistentContext(join(folder, 'profile'), { channel: 'chromium', headless: true, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1280,960', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] })
    const worker = zoomContext.serviceWorkers()[0] || await zoomContext.waitForEvent('serviceworker')
    const zoomPage = zoomContext.pages()[0] || await zoomContext.newPage()
    for (const theme of ['light', 'dark'] as const) {
      await zoomPage.emulateMedia({ colorScheme: theme })
      for (const route of ['/', '/ebooks', `/ebooks/${seed.books[0].slug}`, `/artigos/${seed.article.slug}`]) {
        await zoomPage.goto(testOrigin + route, { waitUntil: 'networkidle' })
        const actual = await worker.evaluate(async ({ url }) => {
          const tabs = (globalThis as unknown as { chrome: { tabs: { query: (q: object) => Promise<{ id: number; url: string }[]>; setZoom: (id: number, factor: number) => Promise<void>; getZoom: (id: number) => Promise<number> } } }).chrome.tabs
          const tab = (await tabs.query({})).find(tab => tab.url === url)
          if (!tab) throw new Error('Aba de QA ausente')
          await tabs.setZoom(tab.id, 4)
          return tabs.getZoom(tab.id)
        }, { url: zoomPage.url() })
        assert.ok(Math.abs(actual - 4) < .01)
        await zoomPage.waitForFunction(() => innerWidth === 320)
        assert.equal(await zoomPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        const name = route === '/' ? 'home' : route.split('/').filter(Boolean).join('-')
        const cdp = await zoomContext.newCDPSession(zoomPage)
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
        await writeFile(`${output}/${name}-${theme}-native400.png`, Buffer.from(shot.data, 'base64'))
        await cdp.detach()
        results.push({ route, theme, nativeZoom: 4, width: 320, overflow: false })
      }
    }
  } finally { await zoomContext?.close(); await rm(folder, { recursive: true, force: true }) }
  await writeFile(`${output}/results.json`, JSON.stringify({ date: new Date().toISOString(), environment: 'Chromium, standalone local, dados sintéticos', results, limits: 'Não comprova conversão, desempenho de campo ou homologação externa. Painel e amostras possuem rodadas separadas.' }, null, 2))
  console.log(`Fase 1 pública: ${results.length} screenshots; rotas, axe, overflow, título longo, capa ausente e teclado aprovados.`)
} finally {
  await browser.close()
  await seed.cleanup()
}
process.exit(0)

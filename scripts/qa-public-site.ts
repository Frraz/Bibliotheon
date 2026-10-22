import { testOrigin } from '../tests/fixtures/origin'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedSite } from '../tests/fixtures/site'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'

const output = 'artifacts/qa-phase1'
await mkdir(output, { recursive: true })
const seed = await seedSite()
const browser = await chromium.launch()
const results: unknown[] = []
async function inspect(page: Page, route: string, name: string, theme: string, width: number) {
  const response = await page.goto(`${testOrigin}${route}`, { waitUntil: 'networkidle' })
  assert.equal(response?.status(), 200, name)
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}/${theme}/${width}: overflow`)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png`, fullPage: true })
  results.push({ route, name, theme, width, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), overflow: false })
  assert.deepEqual(axe.violations.map(v => v.id), [], `${name}/${theme}/${width}: axe`)
}
try {
  const routes = [
    ['/', 'home-3'], ['/ebooks', 'catalog'], [`/ebooks?tema=${seed.theme.slug}`, 'catalog-filter'], ['/ebooks?q=nenhumzzzz', 'catalog-empty'],
    ...seed.books.map(book => [`/ebooks/${book.slug}`, `lp-${book.presentationVariant}`]),
    [`/artigos/${seed.article.slug}`, 'article'], [`/temas/${seed.theme.slug}`, 'theme'],
    ['/sobre', 'about'], ['/contato', 'contact'], ['/privacidade', 'privacy'], ['/termos', 'terms'],
    [`/ebooks/${seed.books[0].slug}?c=${seed.campaign.code}`, 'lp-affiliate'],
  ]
  for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors: string[] = []
      const checkoutPrefetches: string[] = []
    page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/comprar/')) checkoutPrefetches.push(request.url()) })
    for (const [route, name] of routes) await inspect(page, route, name, theme, width)
    assert.deepEqual(errors, [], `${theme}/${width}: JavaScript`)
      assert.deepEqual(checkoutPrefetches, [], 'Checkout não deve ser pré-carregado antes do clique.')
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
  await writeFile(`${output}/results.json`, JSON.stringify({ date: '2026-10-21 America/Belem', environment: 'Chromium, standalone local, dados sintéticos', results, limits: 'Não comprova conversão, desempenho de campo ou homologação externa. Painel e amostras possuem rodadas separadas.' }, null, 2))
  console.log(`Fase 1 pública: ${results.length} screenshots; rotas, axe, overflow, título longo, capa ausente e teclado aprovados.`)
} finally {
  await browser.close()
  await seed.cleanup()
}
process.exit(0)

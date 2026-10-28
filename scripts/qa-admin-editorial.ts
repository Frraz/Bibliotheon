import { testOrigin } from '../tests/fixtures/origin'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedSite } from '../tests/fixtures/site'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = 'artifacts/qa-admin-editorial'
await mkdir(output, { recursive: true })
const seed = await seedSite()
const browser = await chromium.launch()
const results: unknown[] = []
const failures: string[] = []
let nativeDraftSaved = false
let keyboardSorted = false
let reducedMotionScrollStable = false
try {
  for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addCookies([{ name: 'payload-theme', value: theme, domain: '127.0.0.1', path: '/' }])
    await context.addInitScript(t => localStorage.setItem('bibliotheon:appearance:v1', t), theme)
    assert.equal((await context.request.post(testOrigin + '/api/admin-users/login', { data: { email: seed.owner.email, password: seed.password } })).status(), 200)
    const page = await context.newPage()
    const jsErrors: string[] = []
    page.on('pageerror', error => jsErrors.push(error.name))
    for (const [route, name] of [
      ['/admin/collections/ebooks', 'books-list'], [`/admin/collections/ebooks/${seed.books[0].id}`, 'book-edit'],
      [`/admin/collections/offers/${seed.offers[0].id}`, 'offer-edit'], [`/admin/collections/campaigns/${seed.campaign.id}`, 'campaign-edit'],
      ['/admin/globals/site-settings', 'institutional-edit'],
    ]) {
      assert.equal((await page.goto(testOrigin + route, { waitUntil: 'networkidle' }))?.status(), 200)
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png`, fullPage: true })
      results.push({ route: name, theme, width, overflow, jsErrors: jsErrors.length, violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })) })) })
      if (overflow || axe.violations.length || jsErrors.length) failures.push(`${name}/${theme}/${width}: overflow=${overflow}, JS=${jsErrors.length}, axe=${axe.violations.map(v => v.id).join(',')}`)
    }
    await context.close()
  }
  assert.deepEqual(failures, [], 'Todas as telas devem passar antes do teste de gravação.')
  // Exercise the native form and preserve the published revision until explicit publish.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.request.post(testOrigin + '/api/admin-users/login', { data: { email: seed.owner.email, password: seed.password } })
  const page = await context.newPage()
  await page.goto(`${testOrigin}/admin/collections/ebooks/${seed.books[0].id}`, { waitUntil: 'networkidle' })
  await page.getByRole('textbox', { name: /^Título/ }).fill('Título revisado pelo formulário nativo')
  await page.locator('#contents-row-0 .collapsible__drag').focus()
  await page.keyboard.press('Space')
  await expect(page.locator('#contents-row-0 .collapsible__drag')).toHaveAttribute('aria-pressed', 'true')
  // KeyboardSensor installs its document listener on the next task; await rendered readiness.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.keyboard.press('ArrowDown')
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const scrollAfterKey = await page.evaluate(() => document.scrollingElement!.scrollTop)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  assert.equal(await page.evaluate(() => document.scrollingElement!.scrollTop), scrollAfterKey, 'Redução de movimento exige rolagem estável, sem animação suave forçada pelo sensor.')
  reducedMotionScrollStable = true
  await expect.poll(() => page.locator('#contents-row-1').evaluate(element => {
    const transform = getComputedStyle(element).transform
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
  })).toBeLessThan(-1)
  await page.keyboard.press('Space')
  await expect(page.locator('input[name="contents.0.text"]')).toHaveValue(seed.books[0].contents![1].text)
  keyboardSorted = true
  await Promise.all([
    page.waitForResponse(response => response.url().includes(`/api/ebooks/${seed.books[0].id}`) && response.request().method() === 'PATCH' && response.status() === 200),
    page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click(),
  ])
  assert.equal((await seed.payload.findByID({ collection: 'ebooks', id: seed.books[0].id, draft: false, ...seed.auth })).title, seed.books[0].title)
  assert.equal((await seed.payload.findByID({ collection: 'ebooks', id: seed.books[0].id, draft: true, ...seed.auth })).title, 'Título revisado pelo formulário nativo')
  assert.equal((await seed.payload.findByID({ collection: 'ebooks', id: seed.books[0].id, draft: false, ...seed.auth })).contents![0].text, seed.books[0].contents![0].text)
  assert.equal((await seed.payload.findByID({ collection: 'ebooks', id: seed.books[0].id, draft: true, ...seed.auth })).contents![0].text, seed.books[0].contents![1].text)
  nativeDraftSaved = true
  await context.close()
  console.log('Painel editorial: listagem/edição de livro, oferta, campanha e institucional, temas e draft nativo aprovados.')
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ date: new Date().toISOString(), origin: testOrigin, results, keyboardSorted, nativeDraftSaved, reducedMotionScrollStable, limits: 'Fase 1; relacionamento, integrações e relatórios dependem da fase 2.' }, null, 2))
  await browser.close()
  await seed.cleanup()
}
process.exit(0)

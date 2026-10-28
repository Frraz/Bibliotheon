import { testOrigin } from '../tests/fixtures/origin'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const output = 'artifacts/qa-foundation'
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const results: unknown[] = []
try {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(testOrigin + '/', { waitUntil: 'networkidle' })
      assert.ok(await page.getByRole('heading', { name: 'Nosso catálogo está em preparação.', exact: true }).isVisible(), 'A rodada de fundação exige catálogo vazio.')
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme}/${width}: overflow`)
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      assert.deepEqual(axe.violations.map(v => v.id), [], `${theme}/${width}: axe`)
      assert.deepEqual(errors, [], `${theme}/${width}: JS`)
      await page.screenshot({ path: `${output}/home-${theme}-${width}.png`, fullPage: true })
      results.push({ route: '/', theme, width, overflow: false, axeViolations: 0, jsErrors: 0 })
      await context.close()
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(testOrigin + '/')
  await page.getByLabel('Aparência').selectOption('dark')
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.getByLabel('Aparência').selectOption('light')
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  await page.getByLabel('Aparência').selectOption('system')
  await page.emulateMedia({ colorScheme: 'dark' })
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(16, 28, 38)')
  await page.reload()
  await page.keyboard.press('Tab')
  assert.equal(await page.locator(':focus').innerText(), 'Ir para o conteúdo')
  await context.close()
  const blocked = await browser.newContext()
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError') } }) })
  const blockedPage = await blocked.newPage()
  await blockedPage.goto(testOrigin + '/')
  await blockedPage.getByLabel('Aparência').selectOption('dark')
  assert.equal(await blockedPage.locator('html').getAttribute('data-theme'), 'dark')
  await blocked.close()
  const noJS = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' })
  const staticPage = await noJS.newPage()
  await staticPage.goto(testOrigin + '/')
  assert.equal(await staticPage.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(16, 28, 38)')
  assert.ok(await staticPage.getByRole('heading', { name: 'Bibliotheon', exact: true }).isVisible())
  await noJS.close()
  const beforeHydration = await browser.newContext({ colorScheme: 'dark' })
  await beforeHydration.addInitScript(() => localStorage.setItem('bibliotheon:appearance:v1', 'light'))
  await beforeHydration.route('**/_next/static/chunks/**', route => route.abort())
  const unhydrated = await beforeHydration.newPage()
  await unhydrated.goto(testOrigin + '/', { waitUntil: 'domcontentloaded' })
  assert.equal(await unhydrated.locator('html').getAttribute('data-theme'), 'light', 'Preferência aplicada antes da hidratação React')
  await beforeHydration.close()
  await writeFile(`${output}/results.json`, JSON.stringify({ environment: 'local Chromium, standalone; catálogo vazio', date: new Date().toISOString(), results, appearance: 'persistência, system, storage negado, sem JS, skip link aprovados', limits: 'Não é B20 completo. Painel e demais estados possuem rodadas separadas.' }, null, 2))
  console.log(`Fundação: ${results.length} screenshots, axe e overflow aprovados; temas, teclado e fallbacks aprovados.`)
} finally { await browser.close() }

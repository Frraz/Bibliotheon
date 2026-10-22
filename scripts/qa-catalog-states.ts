import { testOrigin } from '../tests/fixtures/origin'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedSite } from '../tests/fixtures/site'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = 'artifacts/qa-phase1'
await mkdir(output, { recursive: true })
const seed = await seedSite()
const browser = await chromium.launch()
const results: unknown[] = []
try {
  for (const total of [1, 0, 20]) {
    if (total < 3) {
      for (const [index, book] of seed.books.entries()) await seed.payload.update({ collection: 'ebooks', id: book.id, ...seed.auth, data: { archived: index >= total, _status: 'published' } })
    } else {
      for (const book of seed.books) await seed.payload.update({ collection: 'ebooks', id: book.id, ...seed.auth, data: { archived: false, _status: 'published' } })
      for (let i = 3; i < 20; i++) seed.books.push(await seed.payload.create({ collection: 'ebooks', ...seed.auth, data: { title: `Edição sintética adicional ${i + 1}`, slug: `${seed.books[0].slug}-extra-${i}`, summary: 'Conteúdo sintético para validar catálogos maiores.', theme: seed.theme.id, cover: seed.cover.id, audience: 'Testes', problem: 'Validar paginação', promise: 'Conferir a experiência editorial.', requirements: 'Somente teste', limits: 'Não é produto real', materialState: 'ready', presentationVariant: 'guide', accentPreset: 'mineral', _status: 'published' } }))
    }
    for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
      const page = await context.newPage()
      assert.equal((await page.goto(testOrigin + '/', { waitUntil: 'networkidle' }))?.status(), 200)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      if (total === 0) assert.ok(await page.getByRole('heading', { name: 'Nosso catálogo está em preparação.' }).isVisible())
      if (total === 1) { assert.equal(await page.locator('.feature-book').count(), 1); assert.equal(await page.locator('.book-card').count(), 0) }
      if (total === 20) assert.equal(await page.locator('.book-card').count(), 6)
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      assert.deepEqual(axe.violations.map(v => v.id), [])
      await page.screenshot({ path: `${output}/home-${total}-${theme}-${width}.png`, fullPage: true })
      results.push({ total, theme, width, overflow: false, axeViolations: 0 })
      await context.close()
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(testOrigin + '/ebooks')
  assert.equal(await page.locator('.book-card').count(), 12)
  await page.getByRole('link', { name: 'Próxima', exact: true }).click()
  await expect(page.locator('.book-card')).toHaveCount(8)
  await page.screenshot({ path: `${output}/catalog-page2-light-390.png`, fullPage: true })
  const trigger = page.getByRole('button', { name: 'Menu', exact: true })
  await trigger.click()
  assert.ok(await page.getByRole('dialog', { name: 'Menu de navegação' }).isVisible())
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('.mobile-menu-trigger')?.getAttribute('aria-expanded') === 'false')
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  assert.ok(await trigger.evaluate(element => element === document.activeElement))
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.addStyleTag({ content: 'html{font-size:200%}' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Zoom de texto 200%')
  await page.screenshot({ path: `${output}/catalog-text200-light-1280.png`, fullPage: true })
  await context.close()
  await writeFile(`${output}/catalog-states-results.json`, JSON.stringify({ date: '2026-10-21 America/Belem', results, pagination: '12+8 itens', menu: 'dialog, Escape e retorno de foco aprovados', zoom: 'Texto 200% e reflow 320px em rodada separada; zoom nativo 400% ainda não homologado' }, null, 2))
  console.log('Catálogo: estados 0/1/20, 36 screenshots, paginação, diálogo móvel e zoom de texto aprovados.')
} finally { await browser.close(); await seed.cleanup() }
process.exit(0)

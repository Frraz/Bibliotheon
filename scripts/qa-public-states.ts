import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedSite, textBody } from '../tests/fixtures/site'
import { atomic } from '../src/modules/marketing/transaction'
import { testOrigin as base } from '../tests/fixtures/origin'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/bibliotheon_qa_browser_[a-f0-9]+$/)
const output = process.env.BIBLIOTHEON_PUBLIC_STATES_MODE === 'redesign' ? 'artifacts/qa-public-redesign/states' : 'artifacts/qa-public-states'
const mode = process.env.BIBLIOTHEON_PUBLIC_STATES_MODE || 'all'
assert.ok(['all', 'extras', 'redesign'].includes(mode))
await mkdir(output, { recursive: true })
const seed = await seedSite(), { payload } = seed, browser = await chromium.launch()
const results: Array<Record<string, unknown>> = [], runtimeErrors: string[] = [], expectedErrors: string[] = []
let fault = false, restored = false, externalRequests = 0, passed = false, fontsBlocked = 0
const longTitle = ('Conhecimento em prática e leitura editorial '.repeat(5)).slice(0, 160)
const longURL = `https://example.invalid/${'referencia'.repeat(28)}`
const body = textBody('Texto sintético extenso para conferir leitura e quebra de linhas. '.repeat(35))
const text = (value: string) => ({ type: 'text', version: 1, text: value, format: 0, style: '', mode: 'normal', detail: 0 })
body.root.children.push({ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, children: [{ type: 'link', version: 1, direction: 'ltr', format: '', indent: 0, fields: { linkType: 'custom', url: longURL, newTab: false }, children: [text(longURL)] }] } as unknown as typeof body.root.children[number])
body.root.children.push({ type: 'list', version: 1, direction: 'ltr', format: '', indent: 0, tag: 'ul', listType: 'bullet', start: 1, children: ['Primeiro item de leitura.', 'Segundo item com conteúdo explicativo.'].map(value => ({ type: 'listitem', version: 1, direction: 'ltr', format: '', indent: 0, value: 1, children: [text(value.repeat(8))] })) } as unknown as typeof body.root.children[number])

async function renameBooks(restore = false) {
  await atomic(payload, async req => {
    const id = await req.transactionID; assert.ok(id)
    const db = (payload.db as unknown as PostgresAdapter).sessions[id].db
    await db.execute(restore ? sql`ALTER TABLE public.ebooks_qa_fault RENAME TO ebooks` : sql`ALTER TABLE public.ebooks RENAME TO ebooks_qa_fault`)
  })
  fault = !restore; if (restore) restored = true
}
async function context(theme: 'light' | 'dark', width: number, reducedMotion: 'reduce' | 'no-preference' = 'reduce') {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion })
  await ctx.addInitScript(theme => localStorage.setItem('bibliotheon:appearance:v1', theme), theme)
  await ctx.route(/^https?:\/\//, route => {
    if (new URL(route.request().url()).origin === base) return route.continue()
    externalRequests++; return route.abort()
  })
  return ctx
}
function observe(page: Page) {
  page.on('pageerror', error => {
    if (fault && /Server Components render|server-side exception/i.test(error.message)) expectedErrors.push(error.name)
    else runtimeErrors.push(error.name)
  })
}
async function capture(page: Page, state: string, theme: string, width: number) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const path = `${output}/${state}-${theme}-${width}.png`
  await page.screenshot({ path, fullPage: true })
  const violations = axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, html: n.html })) }))
  results.push({ state, theme, width, overflow, violations, path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })
  await writeFile(`${output}/progress.json`, JSON.stringify({ results, runtimeErrors, expectedErrors, externalRequests }, null, 2) + '\n')
  assert.equal(overflow, false, `${state}/${theme}/${width}: overflow`)
  assert.deepEqual(violations, [], `${state}/${theme}/${width}: axe`)
}
try {
  // Real PostgreSQL failure in this exclusive disposable database, with guaranteed restoration.
  if (mode !== 'extras') {
  const errors: Array<{ context: BrowserContext; page: Page; theme: 'light' | 'dark'; width: number }> = []
  await renameBooks()
  try {
    if (mode !== 'extras') for (const theme of ['light', 'dark'] as const) for (const width of (mode === 'redesign' ? [320, 1440] : [360, 390, 768, 1024, 1440, 1920])) {
      const ctx = await context(theme, width), page = await ctx.newPage(); observe(page)
      errors.push({ context: ctx, page, theme, width })
      await page.goto(base + '/ebooks', { waitUntil: 'networkidle' })
      await expect(page.getByRole('heading', { name: 'Não foi possível carregar esta página.' })).toBeVisible()
      await capture(page, 'catalog-error', theme, width)
      const box = await page.getByRole('button', { name: 'Tentar novamente', exact: true }).boundingBox()
      assert.ok(box && box.height >= 44 && box.width >= 44)
    }
  } finally { if (fault) await renameBooks(true) }
  for (const item of errors) {
    const retry = item.page.getByRole('button', { name: 'Tentar novamente', exact: true })
    await retry.focus(); await item.page.keyboard.press('Enter')
    await expect(item.page.getByRole('heading', { name: 'Catálogo de e-books', exact: true })).toBeVisible()
    await expect(item.page).toHaveTitle(/Catálogo de e-books/)
    await item.page.waitForLoadState('networkidle')
    await capture(item.page, 'catalog-recovered', item.theme, item.width)
    await item.context.close()
  }
  }
  for (const book of seed.books) await payload.update({ collection: 'ebooks', id: book.id, ...seed.auth, data: { title: longTitle, body, _status: 'published' } })
  await payload.update({ collection: 'media', id: seed.cover.id, ...seed.auth, data: { visibility: 'private' } })
  await payload.update({ collection: 'articles', id: seed.article.id, ...seed.auth, data: { body, _status: 'published' } })
  await payload.updateGlobal({ slug: 'site-settings', ...seed.auth, data: { about: body, privacyPolicy: body, terms: body } })
  for (const book of seed.books.slice(1)) seed.offers.push(await payload.create({ collection: 'offers', ...seed.auth, data: { name: `Oferta sintética ${book.presentationVariant}`, ebook: book.id, provider: 'hotmart', accountKey: 'synthetic', externalProductId: `public-states-${book.id}`, active: true, primary: true, currency: 'BRL', priceCents: 9900, checkoutUrl: 'https://pay.example.invalid/fixture', lastVerifiedAt: new Date().toISOString(), eligibilityNote: 'Somente QA.' } }))
  const routes = [['/', 'home-long-missing-cover'], ['/ebooks', 'catalog-long-missing-cover'], [`/temas/${seed.theme.slug}`, 'theme-long'], ...seed.books.map(book => [`/ebooks/${book.slug}`, `lp-active-${book.presentationVariant}`]), [`/artigos/${seed.article.slug}`, 'article-long-link-list'], ['/sobre', 'about-long-link-list'], ['/privacidade', 'privacy-long-link-list'], ['/termos', 'terms-long-link-list']]
  if (mode !== 'extras') for (const theme of ['light', 'dark'] as const) for (const width of (mode === 'redesign' ? [320, 1440] : [360, 390, 768, 1024, 1440, 1920])) {
    const ctx = await context(theme, width), page = await ctx.newPage(); observe(page)
    try {
      for (const [path, state] of routes) {
        assert.equal((await page.goto(base + path, { waitUntil: 'networkidle' }))?.status(), 200)
        if (state.includes('missing-cover') || state.startsWith('lp-active')) assert.ok(await page.getByText('Capa indisponível', { exact: true }).count() > 0)
        if (state.startsWith('lp-active')) {
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(longTitle)
          await expect(page.locator('a[href^="/comprar/"]').first()).toBeVisible()
          assert.equal(await page.locator('a[href^="/amostras/"]').count(), 0)
        }
        if (state.includes('link-list')) { assert.equal(await page.locator('.prose a').first().getAttribute('href'), longURL); assert.ok(await page.locator('.prose ul li').count() >= 2) }
        await capture(page, state, theme, width)
      }
    } finally { await ctx.close() }
  }
  for (const offer of seed.offers) await payload.update({ collection: 'offers', id: offer.id, ...seed.auth, data: { active: false } })
  if (mode !== 'extras') for (const theme of ['light', 'dark'] as const) for (const width of (mode === 'redesign' ? [320, 1440] : [360, 390, 768, 1024, 1440, 1920])) {
    const ctx = await context(theme, width), page = await ctx.newPage(); observe(page)
    try {
      for (const book of seed.books) {
        assert.equal((await page.goto(`${base}/ebooks/${book.slug}`, { waitUntil: 'networkidle' }))?.status(), 200)
        assert.equal(await page.locator('a[href^="/comprar/"]').count(), 0)
        await expect(page.getByText('Oferta principal indisponível no momento.', { exact: true })).toBeVisible()
        await capture(page, `lp-inactive-${book.presentationVariant}`, theme, width)
      }
    } finally { await ctx.close() }
  }
  await payload.update({ collection: 'offers', id: seed.offers[0].id, ...seed.auth, data: { active: true } })
  for (const theme of ['light', 'dark'] as const) for (const width of [390, 1440]) {
    const ctx = await context(theme, width, 'no-preference'), page = await ctx.newPage(); observe(page)
    try {
      await ctx.route('**/*.woff2', route => { fontsBlocked++; return route.abort() })
      await page.goto(`${base}/artigos/${seed.article.slug}`, { waitUntil: 'networkidle' })
      await expect(page.locator('h1')).toBeVisible()
      await capture(page, 'font-fallback-normal-motion', theme, width)
      await page.goto(`${base}/ebooks/${seed.books[0].slug}`, { waitUntil: 'networkidle' })
      const summary = page.locator('.faq summary').first()
      // Use actual disclosure semantics, without navigating to a checkout.
      assert.equal(await summary.count(), 1)
      {
        await summary.hover(); await capture(page, 'component-hover', theme, width)
        await summary.focus(); await capture(page, 'component-focus', theme, width)
        await summary.hover(); await page.mouse.down()
        try { await capture(page, 'component-active', theme, width) } finally { await page.mouse.move(0, 0); await page.mouse.up(); await page.evaluate(() => getSelection()?.removeAllRanges()) }
        await summary.focus()
        await page.keyboard.press('Enter')
        await expect(summary.locator('..')).toHaveAttribute('open', '')
        await capture(page, 'component-expanded', theme, width)
      }
    } finally { await ctx.close() }
  }
  for (const theme of ['light', 'dark'] as const) for (const width of [390, 1440]) {
    const ctx = await context(theme, width, 'no-preference'), page = await ctx.newPage(); observe(page)
    let release!: () => void, delayedChunks = 0
    const gate = new Promise<void>(resolve => { release = resolve })
    await ctx.route('**/_next/static/chunks/**', async route => { delayedChunks++; await gate; await route.continue() })
    try {
      await page.goto(`${base}/ebooks/${seed.books[0].slug}`, { waitUntil: 'commit' })
      const title = page.getByRole('heading', { level: 1 }), buy = page.locator('a[href^="/comprar/"]').first()
      await expect(title).toBeVisible(); await expect(buy).toBeVisible()
      for (const element of [title, buy]) assert.ok(await element.evaluate(node => {
        let opacity = 1
        for (let el: Element | null = node; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity)
        return opacity > 0
      }))
      assert.ok(delayedChunks > 0)
      await capture(page, 'javascript-delayed-normal-motion', theme, width)
      release()
      await page.waitForLoadState('networkidle')
      await capture(page, 'javascript-resumed-normal-motion', theme, width)
    } finally { release(); await ctx.close() }
  }
  assert.ok(fontsBlocked > 0); assert.equal(externalRequests, 0); assert.deepEqual(runtimeErrors, [])
  passed = true
} finally {
  if (fault) await renameBooks(true)
  await browser.close(); await seed.cleanup()
  await writeFile(`${output}/${mode === 'extras' ? 'extras-results.json' : 'results.json'}`, JSON.stringify({ phase: mode === 'redesign' ? 'D130' : 'D125', mode, completedAt: new Date().toISOString(), status: passed ? 'passed' : 'failed', results, faultRestored: restored, runtimeErrors, expectedServerErrors: expectedErrors, externalRequests, fontsBlocked, fixturesCleaned: true, fullH05Accepted: false, limits: 'Dados sintéticos em banco/mídia exclusivos; falha real de tabela somente nesse banco e restauração obrigatória. Sem checkout externo, conta real ou aceite de toda a fase 2.' }, null, 2) + '\n')
}
console.log(`Estados públicos: ${results.length} capturas aprovadas, incluindo erro/recuperação e conteúdo adverso.`)
process.exit(0)

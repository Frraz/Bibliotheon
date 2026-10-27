import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
import {chromium, type BrowserContextOptions, type Page} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {seedCommerce} from '../tests/fixtures/commerce'
import {testOrigin as base} from '../tests/fixtures/origin'
import {previewCatalogResolution, decideCatalogResolution} from '../src/modules/commerce/catalog-resolutions'
import {commercialTransactionKey} from '../src/modules/commerce/events'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
const seed = await seedCommerce(), {payload} = seed, browser = await chromium.launch(), output = 'artifacts/qa-catalog-resolutions'
const checks: string[] = [], captures: {name: string; theme: string; width: number; axe: boolean; overflow: boolean; violations: string[]}[] = [], runtimeErrors: string[] = []
let externalRequests = 0, passed = false
await mkdir(output, {recursive: true})
const actor = {...seed.owner, collection: 'admin-users', role: 'owner'}
const scope = {provider: 'hotmart' as const, accountKey: 'synthetic', externalProductId: 'synthetic-product', externalOfferId: null}
const count = async () => (await payload.count({collection: 'catalog-resolutions', overrideAccess: true})).totalDocs
async function context(options: BrowserContextOptions = {}, auth = true) {
  const ctx = await browser.newContext({viewport: {width: 390, height: 1050}, reducedMotion: 'reduce', ...options})
  await ctx.route(/^https?:\/\//, route => {if (new URL(route.request().url()).origin === base) return route.continue(); externalRequests++; return route.abort()})
  await ctx.addInitScript(() => {try {localStorage.setItem('bibliotheon:appearance:v1', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')} catch {}})
  ctx.on('page', page => page.on('pageerror', error => runtimeErrors.push(error.name)))
  if (auth) assert.equal((await ctx.request.post(base + '/api/admin-users/login', {data: {email: seed.owner.email, password: seed.password}})).status(), 200)
  return ctx
}
async function capture(page: Page, name: string, theme = 'light', width = 390, axe = true) {
  if (axe) await page.waitForFunction(value => document.documentElement.getAttribute('data-theme') === value, theme)
  const analysis = axe ? await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze() : {violations: []}
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  await page.screenshot({path: `${output}/${name}.png`, fullPage: true})
  captures.push({name, theme, width, axe, overflow, violations: analysis.violations.map(v => v.id)})
  assert.equal(overflow, false, name + ': overflow'); assert.deepEqual(analysis.violations.map(v => v.id), [], name + ': axe')
}
async function fill(page: Page, input: {provider?: string; action?: string; target?: string; source?: string; product?: string; externalOffer?: string; kind?: string} = {}) {
  await page.goto(base + '/admin/catalog-resolutions', {waitUntil: 'networkidle'})
  await page.getByLabel('Provedor', {exact: true}).selectOption(input.provider || 'hotmart')
  await page.getByLabel('Identificador da conta', {exact: true}).fill('synthetic')
  await page.getByLabel('Identificador externo do produto', {exact: true}).fill(input.product || 'synthetic-product')
  if (input.externalOffer) await page.getByLabel('Identificador externo da oferta (opcional)', {exact: true}).fill(input.externalOffer)
  await page.getByLabel('Decisão', {exact: true}).selectOption(input.action || 'associate')
  if (input.action !== 'hold') {
    await page.getByLabel('Tipo de destino', {exact: true}).selectOption(input.kind || 'ebook')
    await page.getByLabel('ID do destino (UUID)', {exact: true}).fill(input.target || seed.books[1].id)
  }
  await page.getByLabel('Referência da fonte', {exact: true}).fill(input.source || 'qa-catalog-report')
}
async function preview(page: Page) {
  await page.getByRole('button', {name: 'Preparar prévia de identidade', exact: true}).click()
  await page.getByRole('heading', {name: 'Conferência da decisão de identidade', exact: true}).waitFor()
  assert.equal(await page.getByRole('button', {name: 'Registrar decisão conferida', exact: true}).isDisabled(), true)
}
async function commit(page: Page) {
  await page.getByRole('checkbox').check()
  await page.getByRole('button', {name: 'Registrar decisão conferida', exact: true}).focus(); await page.keyboard.press('Enter')
}
async function registered(page: Page) {
  const link = page.getByRole('link', {name: 'Consultar decisão registrada', exact: true}); await link.waitFor()
  return new URL((await link.getAttribute('href'))!, base).searchParams.get('entry')!
}
try {
  const anon = await context({}, false), ap = await anon.newPage()
  await ap.goto(base + '/admin/catalog-resolutions', {waitUntil: 'networkidle'}); await ap.waitForURL(url => url.pathname.includes('/admin/login'))
  for (const suffix of ['', '/preview']) assert.equal((await anon.request.post(base + '/api/v1/admin/catalog-resolutions' + suffix, {headers: {Origin: base}, data: {}})).status(), 403)
  await anon.close()
  const ctx = await context(), page = await ctx.newPage()
  for (const method of ['post', 'patch'] as const) assert.equal((await ctx.request[method](base + '/api/catalog-resolutions' + (method === 'patch' ? '/00000000-0000-4000-8000-000000000000' : ''), {data: {}})).status(), 403)
  await page.goto(base + '/admin/catalog-resolutions', {waitUntil: 'networkidle'}); await page.getByText('Nenhuma decisão nesta consulta.', {exact: true}).waitFor(); await capture(page, 'empty-light-390')
  assert.equal(await count(), 0); checks.push('Anônimo sem view/API; coleções nativas negam escrita owner; GET inicial sem decisão.')
  const original = await payload.create({collection: 'transactions', depth: 0, overrideAccess: true, data: {key: commercialTransactionKey({...scope, externalTransactionId: 'qa-catalog-original'}), ...scope, externalTransactionId: 'qa-catalog-original', ebook: seed.books[0].id, offer: seed.offers[0].id, state: 'approved', currency: 'BRL', grossCents: 9900, refundedCents: null, producerNetCents: null, feesCents: null, chargebackCents: null, approvedAt: '2026-10-23T12:00:00.000Z', needsReview: false}})
  for (let i = 0; i < 20; i++) await payload.create({collection: 'transactions', overrideAccess: true, data: {key: commercialTransactionKey({...scope, externalTransactionId: 'qa-snapshot-' + i}), ...scope, externalTransactionId: 'qa-snapshot-' + i, ebook: seed.books[0].id, offer: seed.offers[0].id, state: 'pending', currency: 'BRL', needsReview: false}})
  await fill(page); await preview(page); assert.equal(await count(), 0)
  const snapshot = page.locator('section[aria-labelledby="catalog-preview-heading"]')
  await snapshot.locator('summary').click()
  const firstTransactions = await snapshot.locator('a[href^="/admin/collections/transactions/"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))
  assert.equal(firstTransactions.length, 20)
  await snapshot.getByRole('button', {name: 'Próximas transações', exact: true}).click()
  const lastTransactions = await snapshot.locator('a[href^="/admin/collections/transactions/"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))
  assert.equal(lastTransactions.length, 1); assert.equal(new Set([...firstTransactions, ...lastTransactions]).size, 21)
  await snapshot.getByRole('button', {name: 'Transações anteriores', exact: true}).click()
  await snapshot.locator('summary').click()
  await page.getByRole('button', {name: 'Voltar e preparar nova prévia', exact: true}).click()
  assert.equal(await page.getByLabel('Identificador da conta', {exact: true}).inputValue(), 'synthetic')
  assert.equal(await page.getByLabel('Referência da fonte', {exact: true}).inputValue(), 'qa-catalog-report')
  await preview(page); await capture(page, 'review-light-390')
  let release!: () => void
  const releaseResponse = new Promise<void>(resolve => {release = resolve})
  let dropped = false
  await page.route('**/api/v1/admin/catalog-resolutions', async route => {if (dropped) return route.continue(); dropped = true; const response = await route.fetch(); assert.equal(response.status(), 201); await releaseResponse; await route.abort('failed')})
  await commit(page); await page.getByRole('status').filter({hasText: 'Aguardando a confirmação do servidor.'}).waitFor(); await capture(page, 'loading-light-390'); release(); await page.locator('.bibliotheon-catalog-resolutions').getByRole('alert').waitFor(); assert.equal(await count(), 1); await capture(page, 'lost-response-light-390')
  // Retry the exact prepared envelope and UUID, even though the old plan is now stale.
  await page.getByRole('button', {name: 'Registrar decisão conferida', exact: true}).click()
  const first = await registered(page); await page.getByText('Decisão já registrada; repetição sem duplicação.', {exact: false}).waitFor(); assert.equal(await count(), 1)
  await page.unroute('**/api/v1/admin/catalog-resolutions')
  assert.deepEqual(await payload.findByID({collection: 'transactions', id: original.id, depth: 0, overrideAccess: true}), original)
  checks.push('Prévia sem persistência, retorno preserva campos, confirmação por teclado, resposta perdida após commit e repetição idempotente; projeção original preservada.')
  await fill(page, {action: 'hold', source: 'qa-inconclusive'}); await preview(page); await commit(page); const held = await registered(page)
  const hold = await payload.findByID({collection: 'catalog-resolutions', id: held, overrideAccess: true, depth: 0})
  assert.equal(hold.action, 'hold'); assert.equal(hold.reason, 'evidence_inconclusive'); assert.equal(hold.evidenceVerified, false); assert.equal(hold.previous, first); assert.equal(hold.revision, 2)
  await page.getByRole('link', {name: 'Consultar decisão registrada', exact: true}).click(); await page.getByRole('heading', {name: 'Decisão selecionada', exact: true}).waitFor(); await capture(page, 'hold-detail-light-390')
  await page.getByRole('link', {name: 'Consultar decisão anterior', exact: true}).click(); await page.getByText('Substituída por revisão posterior do mesmo escopo.', {exact: false}).waitFor()
  await capture(page, 'previous-detail-light-390')
  await fill(page, {provider: 'kiwify', kind: 'offer', target: seed.offers[1].id, source: 'qa-kiwify-offer'}); await preview(page); await commit(page); await registered(page)
  await fill(page, {provider: 'cakto', source: 'qa-cakto-book'}); await preview(page); await commit(page); await registered(page)
  checks.push('Bloqueio encadeado com motivo/atestação corretos, anterior/sucessora navegáveis, oferta Kiwify e livro Cakto registrados em namespaces próprios.')
  const before = await count()
  await fill(page, {provider: 'kiwify', kind: 'offer', target: seed.offers[0].id})
  await page.getByRole('button', {name: 'Preparar prévia de identidade', exact: true}).click(); await page.locator('.bibliotheon-catalog-resolutions').getByRole('alert').waitFor()
  assert.equal(await page.getByLabel('ID do destino (UUID)', {exact: true}).inputValue(), seed.offers[0].id); assert.equal(await count(), before); await capture(page, 'error-light-390')
  await fill(page, {target: '00000000-0000-4000-8000-000000000000'}); await page.getByRole('button', {name: 'Preparar prévia de identidade', exact: true}).click(); await page.locator('.bibliotheon-catalog-resolutions').getByRole('alert').waitFor(); assert.equal(await count(), before)
  await fill(page); await preview(page)
  const competing = await previewCatalogResolution(payload, actor, {...scope, action: 'hold', targetOfferId: null, targetEbookId: null})
  await decideCatalogResolution(payload, actor, {...competing.choice, planHash: competing.planHash, sourceKind: 'manual_reconciliation', sourceReference: 'qa-concurrent-review', reason: 'evidence_inconclusive', evidenceVerified: false, confirmed: true}, crypto.randomUUID())
  await commit(page); await page.locator('.bibliotheon-catalog-resolutions').getByRole('alert').filter({hasText: 'O catálogo ou o histórico mudou.'}).waitFor(); assert.equal(await count(), before + 1); await capture(page, 'stale-light-390')
  // Stale must stay blocked. Only a fresh preview can authorize the next revision.
  await page.getByRole('button', {name: 'Voltar e preparar nova prévia', exact: true}).click(); await preview(page); await commit(page); const latest = await registered(page)
  assert.equal(await count(), before + 2)
  checks.push('Oferta fora do namespace e destino inexistente rejeitados sem gravação; alteração concorrente bloqueia plano stale e exige nova conferência.')
  for (let i = 0; i < 16; i++) {
    const choice = {...scope, externalProductId: 'qa-pagination-' + i, action: 'hold' as const, targetOfferId: null, targetEbookId: null}
    const plan = await previewCatalogResolution(payload, actor, choice)
    await decideCatalogResolution(payload, actor, {...choice, planHash: plan.planHash, sourceKind: 'manual_reconciliation', sourceReference: 'qa-pagination-report', reason: 'evidence_inconclusive', evidenceVerified: false, confirmed: true}, crypto.randomUUID(), Date.parse('2026-10-24T12:00:00.000Z'))
  }
  assert.equal(await count(), 22)
  await page.goto(base + '/admin/catalog-resolutions', {waitUntil: 'networkidle'})
  const history = page.locator('section[aria-labelledby="catalog-history-heading"]')
  const firstIDs = await history.getByRole('link', {name: /^Consultar decisão /, includeHidden: true}).evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))
  assert.equal(firstIDs.length, 20); await page.getByRole('link', {name: 'Próxima página', exact: true}).click(); await page.getByText('Página 2 de 2', {exact: false}).waitFor()
  const secondIDs = await history.getByRole('link', {name: /^Consultar decisão /, includeHidden: true}).evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))
  assert.equal(secondIDs.length, 2); assert.equal(new Set([...firstIDs, ...secondIDs]).size, 22)
  await page.getByLabel('Provedor do histórico', {exact: true}).selectOption('cakto'); await page.getByRole('button', {name: 'Filtrar histórico', exact: true}).click(); await page.waitForURL(url => url.searchParams.get('provider') === 'cakto'); await page.getByText('Página 1 de 1 · 1 decisões', {exact: false}).waitFor()
  await page.goto(base + '/admin/catalog-resolutions?entry=invalid', {waitUntil: 'networkidle'}); await page.locator('.bibliotheon-catalog-resolutions').getByRole('alert').waitFor(); assert.equal(await page.getByRole('button', {name: 'Preparar prévia de identidade', exact: true}).count(), 0)
  const nojs = await context({javaScriptEnabled: false}), plain = await nojs.newPage()
  await plain.goto(base + '/admin/catalog-resolutions', {waitUntil: 'networkidle'}); assert.equal(await plain.getByRole('button', {name: 'Preparar prévia de identidade', exact: true}).isDisabled(), true)
  await plain.locator('section[aria-labelledby="catalog-history-heading"] summary').first().click(); await capture(plain, 'nojs-history-390', 'light', 390, false)
  await plain.getByRole('link', {name: 'Próxima página', exact: true}).click(); await plain.getByText('Página 2 de 2', {exact: false}).waitFor(); await nojs.close()
  checks.push('22 decisões em páginas 20+2, instantes empatados sem duplicação, filtro por provedor, entrada inválida sem formulário e leitura/paginação sem JavaScript.')
  for (const theme of ['light', 'dark'] as const) {
    const visual = await context({colorScheme: theme}), screen = await visual.newPage()
    await fill(screen, {source: 's'.repeat(96), product: 'p'.repeat(200), externalOffer: 'o'.repeat(200)})
    await screen.getByLabel('Identificador da conta', {exact: true}).fill('a'.repeat(200))
    for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {await screen.setViewportSize({width, height: 1050}); await capture(screen, `form-${theme}-${width}`, theme, width)}
    await screen.setViewportSize({width: 320, height: 1050}); await screen.evaluate(() => {document.documentElement.style.fontSize = '200%'})
    await capture(screen, `zoom-form-${theme}-320`, theme, 320); await preview(screen); await capture(screen, `zoom-preview-${theme}-320`, theme, 320)
    await screen.goto(base + '/admin/catalog-resolutions?entry=' + latest, {waitUntil: 'networkidle'}); await capture(screen, `detail-${theme}-320`, theme, 320); await visual.close()
  }
  checks.push('Formulário em 14 combinações tema/largura 320–1920px, conferência e formulário com texto 200%/IDs longos, detalhes em ambos os temas; axe/overflow/runtime.')
  await ctx.close(); assert.equal(await count(), 22); assert.equal((await payload.count({collection: 'transaction-events', overrideAccess: true})).totalDocs, 0)
  assert.deepEqual(runtimeErrors, []); assert.equal(externalRequests, 0); passed = true
} finally {
  await browser.close(); await seed.cleanup()
  await writeFile(output + '/results.json', JSON.stringify({date: new Date().toISOString(), status: passed ? 'passed' : 'failed', checks, captures, runtimeErrors, externalRequests, fixturesCleaned: true, limits: 'UI de identidade/catalogo local, fontes sintéticas. Sem decisão financeira visual, homologação externa, zoom nativo 400%, release da imagem/restore ou produção.'}, null, 2) + '\n')
}
console.log(`QA de identidades: ${checks.length} grupos e ${captures.length} capturas aprovados; fixtures limpas.`)
process.exit(0)

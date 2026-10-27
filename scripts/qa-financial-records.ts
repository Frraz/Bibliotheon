import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
import {chromium, type BrowserContextOptions, type Page} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {seedCommerce} from '../tests/fixtures/commerce'
import {testOrigin as base} from '../tests/fixtures/origin'
import {commercialTransactionKey} from '../src/modules/commerce/events'
import {previewFinancialReport, recordFinancialCost} from '../src/modules/commerce/financial-ledger'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
const seed = await seedCommerce(), {payload} = seed, browser = await chromium.launch(), output = 'artifacts/qa-financial-records'
const actor = {id: seed.owner.id, collection: 'admin-users', role: 'owner'}, checks: string[] = [], runtimeErrors: string[] = []
const captures: {name: string; theme: string; width: number; axe: boolean; overflow: boolean; violations: string[]}[] = []
let externalRequests = 0, passed = false
const zoomOnly = process.argv.includes('--zoom')
await mkdir(output, {recursive: true})
const count = async (collection: 'commercial-settlement-evidence' | 'financial-cost-entries' | 'transactions' | 'transaction-events') => (await payload.count({collection, overrideAccess: true})).totalDocs
const idOf = (value: unknown) => typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : null
async function context(options: BrowserContextOptions = {}, authenticated = true) {
  const ctx = await browser.newContext({viewport: {width: 390, height: 1050}, reducedMotion: 'reduce', ...options})
  await ctx.route(/^https?:\/\//, route => { if (new URL(route.request().url()).origin === base) return route.continue(); externalRequests++; return route.abort() })
  await ctx.addInitScript(() => { try { localStorage.setItem('bibliotheon:appearance:v1', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') } catch {} })
  ctx.on('page', page => page.on('pageerror', error => runtimeErrors.push(error.name)))
  if (authenticated) assert.equal((await ctx.request.post(base + '/api/admin-users/login', {data: {email: seed.owner.email, password: seed.password}})).status(), 200)
  return ctx
}
async function capture(page: Page, name: string, theme: string, width: number, runAxe = true) {
  if (runAxe) await page.waitForFunction(value => document.documentElement.getAttribute('data-theme') === value, theme, {timeout: 10000})
  const result = runAxe ? await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze() : {violations: []}
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  await page.screenshot({path: `${output}/${name}.png`, fullPage: true})
  captures.push({name, theme, width, axe: runAxe, overflow, violations: result.violations.map(item => item.id)})
  assert.equal(overflow, false, name + ': overflow'); assert.deepEqual(result.violations.map(item => item.id), [], name + ': axe')
}
const labels: Record<string, string> = {account: 'Identificador da conta', transaction: 'Identificador da transação', amount: 'Valor do movimento', currency: 'Moeda', settlement: 'Referência da liquidação', source: 'Referência da fonte', line: 'Referência da linha', campaign: 'Campanha (opcional)'}
async function fill(page: Page, kind: 'settlement' | 'cost', overrides: Record<string, string> = {}) {
  const input = {provider: 'hotmart', account: 'synthetic', transaction: 'qa-record-hotmart', amount: '75,00', currency: 'BRL', settlement: 'qa-payout', source: 'qa-bank-report', line: 'qa-credit-line', direction: 'credit', date: '2026-10-23T12:00:05.123', category: 'production', classification: 'estimated', campaign: '', ...overrides}
  await page.goto(base + '/admin/financial-records?kind=' + kind, {waitUntil: 'networkidle'})
  if (kind === 'settlement') {
    await page.getByLabel('Provedor', {exact: true}).selectOption(input.provider)
    for (const field of ['account', 'transaction', 'settlement']) await page.getByLabel(labels[field], {exact: true}).fill(input[field as keyof typeof input])
    await page.getByLabel('Movimento', {exact: true}).selectOption(input.direction)
  } else {
    await page.getByLabel('Categoria do custo', {exact: true}).selectOption(input.category)
    await page.getByLabel('Classificação do custo', {exact: true}).selectOption(input.classification)
    await page.getByLabel(labels.campaign, {exact: true}).fill(input.campaign)
  }
  for (const field of ['amount', 'currency', 'source', 'line']) await page.getByLabel(labels[field], {exact: true}).fill(input[field as keyof typeof input])
  await page.getByLabel(kind === 'settlement' ? 'Data e hora da liquidação (UTC)' : 'Data e hora do custo (UTC)', {exact: true}).fill(input.date)
  if (overrides.sourceKind) await page.getByLabel('Fonte da conferência', {exact: true}).selectOption(overrides.sourceKind)
}
async function review(page: Page) {
  await page.getByRole('button', {name: 'Conferir registro', exact: true}).click()
  await page.getByRole('heading', {name: 'Conferência antes do registro', exact: true}).waitFor()
  assert.equal(await page.getByRole('button', {name: 'Registrar dados conferidos', exact: true}).isDisabled(), true)
}
async function confirm(page: Page) {
  await page.getByLabel('Conferi os valores, o instante, os vínculos e a fonte deste registro.').check()
  await page.getByRole('button', {name: 'Registrar dados conferidos', exact: true}).focus(); await page.keyboard.press('Enter')
}
async function saved(page: Page) {
  const link = page.getByRole('link', {name: 'Conferir registro no histórico', exact: true}); await link.waitFor()
  const id = new URL((await link.getAttribute('href'))!, base).searchParams.get('entry')!
  await link.click(); await page.waitForURL(url => url.searchParams.get('entry') === id, {timeout: 15000})
  await page.locator('section[aria-labelledby="ledger-selected-heading"]').getByText(id, {exact: true}).waitFor()
  return id
}
async function report() { return previewFinancialReport(payload, actor, {from: '2026-10-20', through: '2026-10-25'}) }
try {
  if (zoomOnly) {
    for (const kind of ['settlement', 'cost'] as const) for (const theme of ['light', 'dark'] as const) {
      const zoomContext = await context({colorScheme: theme, viewport: {width: 320, height: 1050}}), zoomPage = await zoomContext.newPage()
      await fill(zoomPage, kind, {account: 'a'.repeat(200), transaction: 't'.repeat(200), amount: '90071992547409,91', source: 's'.repeat(96), line: 'r'.repeat(96), campaign: kind === 'cost' ? seed.campaign.id : ''})
      await zoomPage.evaluate(() => {document.documentElement.style.fontSize = '200%'})
      const cramped = await zoomPage.locator('.bibliotheon-ledger-records').evaluate(root => [...root.querySelectorAll('p,li,dt,dd,label,summary,legend,button,a,h1,h2,h3')].filter(node => {const style = getComputedStyle(node);return node.getBoundingClientRect().height > 0 && parseFloat(style.lineHeight) < parseFloat(style.fontSize)}).map(node => node.tagName))
      assert.deepEqual(cramped, [])
      await capture(zoomPage, `zoom-form-${kind}-${theme}-320`, theme, 320)
      await review(zoomPage); await zoomPage.getByText('90.071.992.547.409,91 BRL', {exact: true}).waitFor()
      await capture(zoomPage, `zoom-review-${kind}-${theme}-320`, theme, 320)
      await zoomContext.close()
    }
    assert.equal(await count('commercial-settlement-evidence'), 0); assert.equal(await count('financial-cost-entries'), 0)
    checks.push('Dois formulários e suas conferências em 320px/texto 200%, claro/escuro, valor máximo seguro e referências/IDs longos; nenhuma gravação.')
    assert.deepEqual(runtimeErrors, []); assert.equal(externalRequests, 0); passed = true
  } else {
  const anon = await context({}, false), anonymousPage = await anon.newPage()
  await anonymousPage.goto(base + '/admin/financial-records', {waitUntil: 'networkidle'}); await anonymousPage.waitForURL(url => url.pathname.includes('/admin/login'), {timeout: 15000})
  for (const path of ['/api/v1/admin/settlement-evidence', '/api/v1/admin/financial-costs']) assert.equal((await anon.request.post(base + path, {headers: {Origin: base}, data: {}})).status(), 403)
  await anon.close(); checks.push('View e endpoints negam anônimo; operações usam sessão/origem owner e não escrevem por GET.')
  for (const theme of ['light', 'dark'] as const) for (const kind of ['settlement', 'cost'] as const) {
    const ctx = await context({colorScheme: theme}), page = await ctx.newPage(); await page.goto(base + '/admin/financial-records?kind=' + kind, {waitUntil: 'networkidle'})
    await page.getByText('Nenhum registro financeiro nesta consulta.').waitFor(); assert.equal(await page.getByRole('button', {name: 'Conferir registro', exact: true}).isDisabled(), true)
    await capture(page, `empty-${kind}-${theme}-390`, theme, 390); await ctx.close()
  }
  for (const [provider, currency] of [['hotmart', 'BRL'], ['kiwify', 'USD'], ['cakto', 'BRL']] as const) await payload.create({collection: 'transactions', overrideAccess: true, data: {key: commercialTransactionKey({provider, accountKey: 'synthetic', externalTransactionId: 'qa-record-' + provider}), provider, accountKey: 'synthetic', externalTransactionId: 'qa-record-' + provider, externalProductId: 'synthetic-product', ebook: seed.books[0].id, offer: seed.offers[['hotmart', 'kiwify', 'cakto'].indexOf(provider)].id, state: 'approved', currency, grossCents: 10000, refundedCents: 0, chargebackCents: 0, feesCents: 500, producerNetCents: 9500, approvedAt: '2026-10-20T12:00:00.000Z', lastEventAt: '2026-10-20T12:00:00.000Z', needsReview: false, projection: {refundAndChargebackOverlap: false}}})
  const ctx = await context({colorScheme: 'light'}), page = await ctx.newPage()
  await fill(page, 'settlement')
  await page.getByLabel('Identificador da conta', {exact: true}).fill('a'.repeat(200)); assert.equal((await page.getByLabel('Identificador da conta', {exact: true}).inputValue()).length, 200)
  await page.getByLabel('Identificador da transação', {exact: true}).fill('t'.repeat(200)); assert.equal((await page.getByLabel('Identificador da transação', {exact: true}).inputValue()).length, 200)
  await page.getByLabel('Identificador da conta', {exact: true}).fill('synthetic'); await page.getByLabel('Identificador da transação', {exact: true}).fill('qa-record-hotmart'); await review(page)
  assert.equal(await count('commercial-settlement-evidence'), 0); await page.getByText('75,00 BRL', {exact: true}).waitFor(); await page.getByText('2026-10-23T12:00:05.123Z', {exact: true}).waitFor()
  await capture(page, 'review-light-390', 'light', 390)
  let loseResponse = true, releaseWrite: () => void = () => {}
  const writeGate = new Promise<void>(resolve => { releaseWrite = resolve })
  await page.route('**/api/v1/admin/settlement-evidence', async route => { if (!loseResponse) return route.continue(); loseResponse = false; await writeGate; await route.fetch(); await route.abort('failed') })
  await confirm(page); await page.getByRole('button', {name: 'Registrando…', exact: true}).waitFor()
  assert.equal(await page.getByRole('button', {name: 'Voltar aos campos', exact: true}).isDisabled(), true)
  try { await capture(page, 'loading-light-390', 'light', 390) } finally { releaseWrite() }
  await page.getByRole('alert').filter({hasText: 'A resposta não chegou.'}).waitFor(); assert.equal(await count('commercial-settlement-evidence'), 1)
  await page.getByRole('button', {name: 'Registrar dados conferidos', exact: true}).click()
  await page.getByText('Esta fonte e referência de linha já estavam registradas.', {exact: false}).waitFor(); const originalCredit = await saved(page)
  assert.equal(await count('commercial-settlement-evidence'), 1)
  const initial = await payload.findByID({collection: 'commercial-settlement-evidence', id: originalCredit, overrideAccess: true})
  assert.equal(initial.amountCents, 7500); assert.equal(initial.settledAt, '2026-10-23T12:00:05.123Z'); assert.equal(idOf(initial.actor), seed.owner.id)
  await page.getByRole('link', {name: 'Preparar correção deste registro', exact: true}).click()
  for (const label of ['Provedor', 'Identificador da conta', 'Identificador da transação', 'Moeda', 'Referência da liquidação', 'Fonte da conferência', 'Referência da fonte']) assert.equal(await page.getByLabel(label, {exact: true}).isDisabled(), true)
  assert.equal(await page.getByLabel('Referência da linha', {exact: true}).inputValue(), '')
  await page.getByLabel('Valor do movimento', {exact: true}).fill('70,00'); await page.getByLabel('Referência da linha', {exact: true}).fill('qa-credit-corrected')
  await capture(page, 'correction-light-390', 'light', 390); await review(page); await confirm(page); const correctedCredit = await saved(page)
  assert.equal(await count('commercial-settlement-evidence'), 2); assert.equal((await payload.findByID({collection: 'commercial-settlement-evidence', id: originalCredit, overrideAccess: true})).amountCents, 7500)
  assert.equal(idOf((await payload.findByID({collection: 'commercial-settlement-evidence', id: correctedCredit, overrideAccess: true})).supersedes), originalCredit)
  await page.goto(base + '/admin/financial-records?kind=settlement&replace=' + originalCredit, {waitUntil: 'networkidle'})
  await page.getByText('Este registro já foi substituído.', {exact: false}).waitFor(); assert.equal(await page.getByRole('button', {name: 'Conferir registro', exact: true}).count(), 0)
  await fill(page, 'settlement', {amount: '5,00', direction: 'debit', line: 'qa-debit-line', settlement: 'qa-payout-reversal'}); await review(page); await confirm(page); await saved(page)
  assert.equal((await report()).currencies.find(row => row.currency === 'BRL')!.receivedCents, 6500)
  checks.push('Conferência não grava. Crédito com resposta perdida repete sem duplicar; correção preserva original/data milissegundos, bloqueia identidade e soma apenas a linha vigente menos o débito.')

  await fill(page, 'cost', {amount: '3,00', source: 'qa-production', line: 'qa-production-estimate', sourceKind: 'manual_reconciliation'}); await review(page); await confirm(page); const oldCost = await saved(page)
  assert.equal((await report()).currencies.find(row => row.currency === 'BRL')!.estimatedCostsCents, 300)
  await page.getByRole('link', {name: 'Preparar correção deste registro', exact: true}).click()
  for (const label of ['Categoria do custo', 'Moeda', 'Campanha (opcional)', 'Fonte da conferência', 'Referência da fonte']) assert.equal(await page.getByLabel(label, {exact: true}).isDisabled(), true)
  await page.getByLabel('Classificação do custo', {exact: true}).selectOption('confirmed'); await page.getByLabel('Valor do movimento', {exact: true}).fill('2,50'); await page.getByLabel('Referência da linha', {exact: true}).fill('qa-production-confirmed')
  await review(page); await confirm(page); const correctedCost = await saved(page)
  assert.equal((await payload.findByID({collection: 'financial-cost-entries', id: oldCost, overrideAccess: true})).classification, 'estimated')
  assert.equal(idOf((await payload.findByID({collection: 'financial-cost-entries', id: correctedCost, overrideAccess: true})).supersedes), oldCost)
  const confirmed = (await report()).currencies.find(row => row.currency === 'BRL')!; assert.equal(confirmed.estimatedCostsCents, null); assert.equal(confirmed.confirmedCostsCents, 250)
  await fill(page, 'cost', {amount: '10,00', category: 'advertising', classification: 'confirmed', campaign: seed.campaign.id, source: 'qa-ad-invoice', line: 'qa-ad-line'}); await review(page); await confirm(page); const campaignCost = await saved(page)
  assert.equal(idOf((await payload.findByID({collection: 'financial-cost-entries', id: campaignCost, overrideAccess: true, depth: 0})).campaign), seed.campaign.id)
  await page.getByRole('link', {name: 'Preparar correção deste registro', exact: true}).click()
  assert.equal(await page.getByLabel('Campanha (opcional)', {exact: true}).inputValue(), seed.campaign.id)
  await page.getByLabel('Valor do movimento', {exact: true}).fill('9,00'); await page.getByLabel('Referência da linha', {exact: true}).fill('qa-ad-corrected')
  await review(page); await confirm(page); const correctedCampaign = await saved(page)
  assert.equal(idOf((await payload.findByID({collection: 'financial-cost-entries', id: correctedCampaign, overrideAccess: true, depth: 0})).campaign), seed.campaign.id)
  const costSummary = (await report()).currencies.find(row => row.currency === 'BRL')!; assert.equal(costSummary.confirmedCostsCents, 1150); assert.equal(costSummary.marginComplete, false)
  checks.push('Custo estimado é substituído explicitamente por confirmado; campanha é gravada no relacionamento real e preservada na correção. Substituídos não são somados, ausência permanece null e margem não vira lucro.')

  await fill(page, 'settlement', {provider: 'kiwify', transaction: 'qa-record-kiwify', currency: 'USD', amount: '12,34', source: 'qa-usd-bank', line: 'qa-usd-line', settlement: 'qa-usd-payout'}); await review(page); await confirm(page); const usdID = await saved(page)
  await fill(page, 'settlement', {provider: 'cakto', transaction: 'qa-record-cakto', amount: '18,00', source: 'qa-cakto-bank', line: 'qa-cakto-line', settlement: 'qa-cakto-payout'}); await review(page); await confirm(page); await saved(page)
  const currencies = (await report()).currencies; assert.equal(currencies.find(row => row.currency === 'BRL')!.receivedCents, 8300); assert.equal(currencies.find(row => row.currency === 'USD')!.receivedCents, 1234)
  assert.equal(await count('transactions'), 3); assert.equal(await count('transaction-events'), 0)
  await page.goto(base + '/admin/financial-ledger?from=2026-10-20&through=2026-10-25&currency=BRL', {waitUntil: 'networkidle'})
  await page.getByText('83,00 BRL', {exact: false}).waitFor(); await page.getByText('11,50 BRL', {exact: true}).waitFor()
  await fill(page, 'cost', {currency: 'GBP', amount: '0', category: 'other', classification: 'confirmed', source: 'qa-explicit-zero', line: 'qa-zero-line'}); await review(page); await confirm(page); await saved(page)
  assert.equal((await report()).currencies.find(row => row.currency === 'GBP')!.confirmedCostsCents, 0)
  checks.push('Hotmart/Kiwify/Cakto registram movimentos na moeda da aprovação; BRL/USD continuam separados e a prévia existente reflete o ledger sem nova transação/evento nativo.')

  const settlementCount = await count('commercial-settlement-evidence'), costCount = await count('financial-cost-entries')
  for (const input of [{transaction: 'qa-missing-record', line: 'qa-missing-line'}, {currency: 'USD', line: 'qa-wrong-currency'}] as Record<string, string>[]) {
    await fill(page, 'settlement', input); await review(page); await confirm(page)
    await page.getByRole('alert').filter({hasText: 'A transação precisa ter aprovação comprovada'}).waitFor()
  }
  await capture(page, 'unverified-light-390', 'light', 390)
  await page.getByRole('button', {name: 'Voltar aos campos', exact: true}).click(); assert.equal(await page.getByLabel('Referência da linha', {exact: true}).inputValue(), 'qa-wrong-currency')
  await fill(page, 'cost', {amount: '1.234,56', source: 'qa-invalid-money', line: 'qa-invalid-money-line'}); await page.getByRole('button', {name: 'Conferir registro', exact: true}).click()
  await page.getByRole('alert').filter({hasText: 'Informe um valor não negativo'}).waitFor(); assert.equal(await page.getByLabel('Valor do movimento', {exact: true}).inputValue(), '1.234,56')
  await fill(page, 'cost', {source: 'qa-invalid-campaign', line: 'qa-invalid-campaign-line', campaign: crypto.randomUUID()}); await review(page); await confirm(page)
  await page.getByRole('alert').filter({hasText: 'A campanha não foi encontrada.'}).waitFor()
  await fill(page, 'cost', {source: 'qa-future', line: 'qa-future-line', date: '2027-10-23T12:00'}); await review(page); await confirm(page)
  await page.getByRole('alert').filter({hasText: 'A data precisa ser válida, em UTC'}).waitFor()
  assert.equal(await count('commercial-settlement-evidence'), settlementCount); assert.equal(await count('financial-cost-entries'), costCount)
  assert.equal((await ctx.request.post(base + '/api/financial-cost-entries', {headers: {Origin: base}, data: {amountCents: 1}})).status(), 403)
  assert.equal((await ctx.request.patch(base + '/api/commercial-settlement-evidence/' + correctedCredit, {headers: {Origin: base}, data: {amountCents: 1}})).status(), 403)
  checks.push('Aprovação ausente, moeda divergente, campanha inexistente, futuro e formato monetário ambíguo não gravam. Erros preservam entrada; CRUD nativo continua negado.')

  const timestamp = Date.now()
  for (let index = 0; index < 21; index++) await recordFinancialCost(payload, actor, {category: 'other', amountCents: 1, currency: 'EUR', campaignId: null, classification: 'estimated', sourceKind: 'manual_reconciliation', sourceReference: 'qa-pages', recordReference: 'qa-page-' + String(index).padStart(2, '0'), incurredAt: '2026-10-23T12:00:00.000Z'}, timestamp)
  await page.goto(base + '/admin/financial-records?kind=cost&currency=EUR', {waitUntil: 'networkidle'})
  assert.equal(await page.locator('.bibliotheon-ledger-history > li').count(), 20)
  const firstPage = await page.locator('.bibliotheon-ledger-history summary').allTextContents()
  await page.getByRole('link', {name: 'Próximos registros', exact: true}).click(); await page.getByText('Página 2 de 2', {exact: true}).waitFor(); assert.equal(await page.locator('.bibliotheon-ledger-history > li').count(), 1)
  const lastPage = await page.locator('.bibliotheon-ledger-history summary').allTextContents(); assert.equal(new Set([...firstPage, ...lastPage]).size, 21)
  await page.goto(base + '/admin/financial-records?kind=cost&replace=bad-id', {waitUntil: 'networkidle'}); await page.getByRole('alert').filter({hasText: 'Confira o tipo, a moeda e o identificador'}).waitFor(); assert.equal(await page.getByRole('button', {name: 'Conferir registro', exact: true}).count(), 0)
  const noJS = await context({javaScriptEnabled: false}), staticPage = await noJS.newPage()
  await staticPage.goto(base + '/admin/financial-records?kind=settlement&currency=USD', {waitUntil: 'networkidle'})
  assert.equal(await staticPage.getByRole('button', {name: 'Conferir registro', exact: true}).isDisabled(), true)
  assert.ok(await staticPage.locator('noscript').evaluateAll(nodes => nodes.some(node => node.textContent?.includes('Ative JavaScript para conferir e registrar.') && node.getBoundingClientRect().height > 0)))
  await staticPage.locator('.bibliotheon-ledger-history summary').click(); await staticPage.getByText('qa-usd-line', {exact: true}).waitFor(); await capture(staticPage, 'nojs-light-390', 'light', 390, false); await noJS.close()
  checks.push('Histórico paginado/filtrado inclui substituídos, datas, fontes e vínculos; 21 registros com o mesmo recordedAt não duplicam nas páginas. Identificador inválido não prepara formulário e leitura sem JS funciona sem habilitar gravação.')

  for (const kind of ['settlement', 'cost'] as const) for (const theme of ['light', 'dark'] as const) for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
    const themed = await context({colorScheme: theme, viewport: {width, height: 1050}}), screen = await themed.newPage()
    await screen.goto(base + '/admin/financial-records?kind=' + kind, {waitUntil: 'networkidle'}); await capture(screen, `${kind}-${theme}-${width}`, theme, width); await themed.close()
  }
  const dark = await context({colorScheme: 'dark'}), darkPage = await dark.newPage()
  await fill(darkPage, 'cost', {amount: '7,01', source: 'qa-unsaved-review', line: 'qa-unsaved-line'}); await review(darkPage); await capture(darkPage, 'review-dark-390', 'dark', 390)
  await darkPage.goto(base + '/admin/financial-records?kind=cost&replace=' + correctedCampaign, {waitUntil: 'networkidle'}); await capture(darkPage, 'correction-dark-390', 'dark', 390)
  await darkPage.goto(base + '/admin/financial-records?kind=settlement&entry=' + usdID + '&currency=USD', {waitUntil: 'networkidle'}); await darkPage.setViewportSize({width: 320, height: 1050}); await darkPage.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  const cramped = await darkPage.locator('.bibliotheon-ledger-records').evaluate(root => [...root.querySelectorAll('p,li,dt,dd,label,summary,legend,button,a,h1,h2,h3')].filter(node => {const style = getComputedStyle(node);return node.getBoundingClientRect().height > 0 && parseFloat(style.lineHeight) < parseFloat(style.fontSize)}).map(node => node.tagName))
  assert.deepEqual(cramped, []); await capture(darkPage, 'text-200-dark-320', 'dark', 320); await dark.close()
  assert.deepEqual(runtimeErrors, []); assert.equal(externalRequests, 0); passed = true
  }
} finally {
  await browser.close(); await seed.cleanup()
  await writeFile(output + (zoomOnly ? '/zoom-results.json' : '/results.json'), JSON.stringify({date: new Date().toISOString(), status: passed ? 'passed' : 'failed', checks, captures, runtimeErrors, externalRequests, fixturesCleaned: true, limits: 'Ledger owner local sintético. Sem homologação de fonte/conta, decisão financeira visual, zoom nativo 400%, imagem/restore final ou produção.'}, null, 2) + '\n')
}
console.log(`QA de registros financeiros: ${checks.length} grupos e ${captures.length} capturas aprovados; fixtures limpas.`)
process.exit(0)

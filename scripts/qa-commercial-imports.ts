import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
import {chromium, type BrowserContext, type BrowserContextOptions, type Page} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {seedCommerce} from '../tests/fixtures/commerce'
import {canonicalCSV, canonicalReportEvidenceCSV, csvFields, reportEvidenceFields} from '../tests/fixtures/commercial-csv'
import {testOrigin as base} from '../tests/fixtures/origin'
import {commercialTransactionKey} from '../src/modules/commerce/events'
import {processCommercialInbox} from '../src/modules/commerce/inbox'
import {stageCommercialImport} from '../src/modules/commerce/import-service'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
const seed = await seedCommerce(), {payload} = seed, browser = await chromium.launch(), output = 'artifacts/qa-commercial-imports'
const checks: string[] = [], captures: {name: string; theme: string; width: number; overflow: boolean; axe: boolean; violations: string[]}[] = [], runtimeErrors: string[] = []
let externalRequests = 0, passed = false, fixturesCleaned = false
const contexts: BrowserContext[] = []
await mkdir(output, {recursive: true})
async function count(collection: 'commercial-import-batches' | 'commercial-report-evidence' | 'commercial-inbox' | 'transactions' | 'transaction-events') { return (await payload.count({collection, overrideAccess: true})).totalDocs }
async function context(options: BrowserContextOptions = {}, authenticated = true) {
  const ctx = await browser.newContext({viewport: {width: 390, height: 1000}, reducedMotion: 'reduce', ...options}); contexts.push(ctx)
  await ctx.route(/^https?:\/\//, route => { if (new URL(route.request().url()).origin === base) return route.continue(); externalRequests++; return route.abort() })
  await ctx.addInitScript(() => { try { localStorage.setItem('bibliotheon:appearance:v1', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') } catch {} })
  ctx.on('page', page => page.on('pageerror', error => runtimeErrors.push(error.name)))
  if (authenticated) assert.equal((await ctx.request.post(base + '/api/admin-users/login', {data: {email: seed.owner.email, password: seed.password}})).status(), 200)
  return ctx
}
async function capture(page: Page, name: string, theme: string, width: number, runAxe = true) {
  if (runAxe) await page.waitForFunction(value => document.documentElement.getAttribute('data-theme') === value, theme, {timeout: 10000})
  const axe = runAxe ? await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze() : {violations: []}
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  await page.screenshot({path: `${output}/${name}.png`, fullPage: true})
  captures.push({name, theme, width, overflow, axe: runAxe, violations: axe.violations.map(item => item.id)})
  assert.equal(overflow, false, name + ': overflow'); assert.deepEqual(axe.violations.map(item => item.id), [], name + ': axe')
}
const snapshot = (id: string, provider = 'hotmart') => { const row = [...csvFields]; row[0] = provider; row[2] = id; row[4] = ''; return row }
async function upload(page: Page, bytes: Buffer, reference: string, kind = 'snapshot') {
  await page.getByLabel('Contrato do arquivo').selectOption(kind)
  await page.getByLabel('Arquivo CSV canônico em UTF-8').setInputFiles({name: 'canonical.csv', mimeType: 'text/csv', buffer: bytes})
  await page.getByLabel('Referência da conferência', {exact: true}).fill(reference)
  await page.getByRole('button', {name: 'Consultar prévia', exact: true}).click()
  await page.getByText('Prévia consultada. Nenhum lote ou fato foi gravado. Confira as linhas antes de preparar o lote.').waitFor()
}
async function stage(page: Page) {
  await page.getByRole('button', {name: 'Preparar lote para conferência'}).click()
  await page.getByRole('link', {name: 'Abrir lote registrado'}).waitFor()
  await page.getByRole('link', {name: 'Abrir lote registrado'}).click()
  await page.getByRole('heading', {name: 'Lote em conferência', exact: true}).waitFor()
  return new URL(page.url()).searchParams.get('batch')!
}
async function confirm(page: Page) {
  const button = page.getByRole('button', {name: 'Confirmar lote conferido', exact: true})
  assert.equal(await button.isDisabled(), true)
  await page.getByLabel('Conferi a fonte, as linhas e as consequências deste lote.').check()
  await button.focus(); await page.keyboard.press('Enter')
}
try {
  const anon = await context({}, false), anonymousPage = await anon.newPage()
  await anonymousPage.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'}); await anonymousPage.waitForURL(url => url.pathname.includes('/admin/login'), {timeout: 15000}); assert.ok(new URL(anonymousPage.url()).pathname.includes('/admin/login'))
  assert.equal((await anon.request.post(base + '/api/v1/admin/imports/preview', {headers: {Origin: base, 'Content-Type': 'text/csv'}, data: canonicalCSV()})).status(), 403)
  await anon.close(); checks.push('Acesso anônimo à view e à API recusado; a página usa autorização owner também no servidor.')
  for (const theme of ['light', 'dark'] as const) {
    const ctx = await context({colorScheme: theme}), page = await ctx.newPage()
    await page.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'})
    await page.getByText('Nenhum lote de conciliação registrado.').waitFor()
    assert.equal(await page.getByRole('button', {name: 'Consultar prévia', exact: true}).isDisabled(), true)
    await capture(page, 'empty-' + theme + '-390', theme, 390); await ctx.close()
  }
  const ctx = await context({colorScheme: 'light'}), page = await ctx.newPage()
  await page.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'})
  const bytes = canonicalCSV([snapshot('qa-ui-snapshot')])
  await page.getByLabel('Arquivo CSV canônico em UTF-8').setInputFiles({name: 'canonical.csv', mimeType: 'text/csv', buffer: bytes})
  await page.getByLabel('Referência da conferência', {exact: true}).fill('qa-ui-snapshot')
  let releasePreview: () => void = () => {}
  const previewGate = new Promise<void>(resolve => { releasePreview = resolve })
  await page.route('**/api/v1/admin/imports/preview', async route => { await previewGate; await route.continue() })
  await page.getByRole('button', {name: 'Consultar prévia', exact: true}).click()
  await page.getByRole('button', {name: 'Aguarde…', exact: true}).waitFor()
  assert.equal(await page.getByLabel('Contrato do arquivo').isDisabled(), true)
  try { await capture(page, 'loading-light-390', 'light', 390) } finally { releasePreview() }
  await page.getByText('Prévia consultada. Nenhum lote ou fato foi gravado. Confira as linhas antes de preparar o lote.').waitFor()
  await page.unroute('**/api/v1/admin/imports/preview')
  checks.push('Carregamento desabilita os campos/ações e mantém os dados até concluir a prévia; nenhum lote é gravado pela consulta.')
  assert.equal(await count('commercial-import-batches'), 0); assert.equal(await count('commercial-inbox'), 0)
  await page.getByLabel('Referência da conferência', {exact: true}).fill('qa-ui-snapshot-edited')
  assert.equal(await page.getByRole('button', {name: 'Preparar lote para conferência'}).count(), 0)
  await upload(page, bytes, 'qa-ui-snapshot')
  let lostStage = true
  await page.route('**/api/v1/admin/imports', async route => { if (!lostStage) return route.continue(); lostStage = false; await route.fetch(); await route.abort('failed') })
  await page.getByRole('button', {name: 'Preparar lote para conferência'}).click()
  await page.getByRole('alert').filter({hasText: 'A resposta não chegou.'}).waitFor()
  assert.equal(await count('commercial-import-batches'), 1)
  const snapshotID = await stage(page); assert.equal(await count('commercial-import-batches'), 1)
  await page.reload({waitUntil: 'networkidle'})
  await page.getByRole('heading', {name: 'Lote em conferência', exact: true}).waitFor()
  await page.getByText('Conferir dados da linha 2', {exact: true}).click(); await page.getByText('9.990', {exact: true}).waitFor()
  assert.ok(await page.getByText('Não informado', {exact: true}).count() > 0)
  await capture(page, 'ready-light-390', 'light', 390)
  assert.equal(await count('commercial-inbox'), 0)
  let lostCommit = true
  await page.route('**/api/v1/admin/imports/*/commit', async route => { if (!lostCommit) return route.continue(); lostCommit = false; await route.fetch(); await route.abort('failed') })
  await confirm(page)
  await page.getByRole('alert').filter({hasText: 'A resposta não chegou.'}).waitFor(); assert.equal(await count('commercial-inbox'), 1)
  await page.getByRole('button', {name: 'Confirmar lote conferido', exact: true}).click()
  await page.getByText('Fatos enfileirados para processamento. A confirmação não comprova aplicação, recebimento ou lucro.').waitFor()
  assert.equal(await count('commercial-inbox'), 1); assert.equal(await count('transactions'), 0)
  await page.reload({waitUntil: 'networkidle'}); assert.equal(await page.getByRole('button', {name: 'Confirmar lote conferido', exact: true}).count(), 0)
  const inbox = (await payload.find({collection: 'commercial-inbox', overrideAccess: true, limit: 1})).docs[0]
  await processCommercialInbox(payload, inbox.id, {now: Date.now()})
  assert.equal(await count('transactions'), 1)
  checks.push('Upload/prévia não persistem; mudança de entrada invalida a prévia. Stage e commit com resposta perdida são repetidos sem duplicar lote ou inbox. Retomada após reload funciona; queued não é transação aplicada.')

  await page.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'})
  const report = [...reportEvidenceFields]; report[0] = 'kiwify'; report[2] = 'qa-ui-report'; report[16] = 'qa-ui-report-line'
  await upload(page, canonicalReportEvidenceCSV([report]), 'qa-ui-report', 'report_evidence')
  const nativeBefore = await count('transaction-events'), txBefore = await count('transactions'), reportID = await stage(page)
  assert.equal(await count('commercial-report-evidence'), 0)
  await confirm(page); await page.getByText('Evidências registradas. Aplicar valores exige decisão financeira explícita; nenhum webhook nativo foi criado.').waitFor()
  assert.equal(await count('commercial-report-evidence'), 1); assert.equal(await count('transaction-events'), nativeBefore); assert.equal(await count('transactions'), txBefore)
  await page.reload({waitUntil: 'networkidle'}); await page.getByText('Estado da linha: Evidência registrada.', {exact: false}).waitFor()
  await upload(page, canonicalReportEvidenceCSV([report]), 'qa-ui-report', 'report_evidence')
  await page.getByRole('heading', {name: 'Prévia provisória do arquivo'}).waitFor()
  await page.getByText('Evidência idêntica já registrada ou repetida no arquivo.').waitFor()
  checks.push('Contrato complementar Kiwify: prévia, stage, confirmação e retomada registram uma prova sem criar transação/fato nativo; nova prévia reconhece duplicata.')

  await page.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'})
  await upload(page, canonicalCSV([snapshot('qa-ui-cakto', 'cakto')]), 'qa-ui-cakto')
  const caktoID = await stage(page); await confirm(page)
  await page.getByText('Fatos enfileirados para processamento. A confirmação não comprova aplicação, recebimento ou lucro.').waitFor()
  assert.equal((await payload.find({collection: 'commercial-inbox', where: {provider: {equals: 'cakto'}}, overrideAccess: true})).totalDocs, 1)
  checks.push('O mesmo fluxo canônico atende Hotmart, Kiwify e Cakto, com um provedor/conta por lote; sem conta externa homologada.')

  await page.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'})
  const blocked = snapshot('qa-ui-settled'); blocked[12] = '9000'
  await upload(page, canonicalCSV([blocked]), 'qa-ui-blocked'); const blockedID = await stage(page)
  await page.getByText('A confirmação está bloqueada.', {exact: false}).waitFor(); assert.equal(await page.getByRole('button', {name: 'Confirmar lote conferido', exact: true}).count(), 0)
  await capture(page, 'blocked-light-390', 'light', 390)
  await page.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'})
  await upload(page, canonicalCSV([snapshot('qa-ui-stale')]), 'qa-ui-stale'); const staleID = await stage(page)
  await payload.create({collection: 'transactions', overrideAccess: true, data: {key: commercialTransactionKey({provider: 'hotmart', accountKey: 'synthetic', externalTransactionId: 'qa-ui-stale'}), provider: 'hotmart', accountKey: 'synthetic', externalTransactionId: 'qa-ui-stale', externalProductId: 'synthetic-product', ebook: seed.books[0].id, offer: seed.offers[0].id, state: 'approved', currency: 'BRL', grossCents: 9990, feesCents: 990, approvedAt: csvFields[6], lastEventAt: csvFields[6], needsReview: false}})
  const inboxBeforeStale = await count('commercial-inbox')
  await confirm(page); await page.getByRole('alert').filter({hasText: 'O plano mudou.'}).waitFor()
  assert.equal((await payload.findByID({collection: 'commercial-import-batches', id: staleID, overrideAccess: true})).state, 'stale')
  assert.equal(await count('commercial-inbox'), inboxBeforeStale)
  await page.reload({waitUntil: 'networkidle'}); await page.getByText('O histórico mudou depois da preparação.', {exact: false}).waitFor()
  checks.push('Recebimento em snapshot fica bloqueado; divergência real criada entre stage/commit deixa o lote stale sem gravar novos fatos; a tela remove a confirmação e preserva o histórico.')

  await page.goto(base + '/admin/commercial-imports', {waitUntil: 'networkidle'})
  await page.getByLabel('Arquivo CSV canônico em UTF-8').setInputFiles({name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('email,value\nprivate@example.invalid,1\n')})
  await page.getByLabel('Referência da conferência', {exact: true}).fill('qa-ui-invalid')
  const batchesBeforeInvalid = await count('commercial-import-batches')
  await page.getByRole('button', {name: 'Consultar prévia', exact: true}).click()
  await page.getByRole('alert').filter({hasText: 'O cabeçalho não corresponde ao contrato escolhido.'}).waitFor()
  assert.equal(await page.getByLabel('Referência da conferência', {exact: true}).inputValue(), 'qa-ui-invalid')
  assert.equal(await count('commercial-import-batches'), batchesBeforeInvalid)
  await capture(page, 'error-light-390', 'light', 390)
  await page.getByLabel('Contrato do arquivo').selectOption('report_evidence')
  await page.getByLabel('Arquivo CSV canônico em UTF-8').setInputFiles({name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.alloc(512 * 1024 + 1, 65)})
  await page.getByRole('button', {name: 'Consultar prévia', exact: true}).click()
  await page.getByRole('alert').filter({hasText: 'O arquivo excede o limite do contrato escolhido.'}).waitFor()
  checks.push('Cabeçalho estranho é rejeitado sem armazenar dados; erro mantém os campos, mudança de contrato invalida a prévia e limite de tamanho é exibido antes do envio.')

  const pagination = await stageCommercialImport(payload, {id: seed.owner.id, collection: 'admin-users', role: 'owner'}, canonicalCSV(Array.from({length: 51}, (_, index) => snapshot('qa-ui-page-' + index))), {sourceKind: 'manual_reconciliation', sourceReference: 'qa-ui-pagination', reason: 'report_reconciliation'}, crypto.randomUUID())
  await page.goto(base + '/admin/commercial-imports?batch=' + pagination.id, {waitUntil: 'networkidle'})
  assert.equal(await page.locator('ol.bibliotheon-import-lines').first().locator(':scope > li').count(), 50)
  await page.getByRole('link', {name: 'Próximas linhas', exact: true}).click(); await page.getByText('Linha 52 · Nova', {exact: true}).waitFor()
  await page.getByText('Conferir dados da linha 52').click(); await page.getByText('qa-ui-page-50', {exact: true}).waitFor()
  const noJS = await context({javaScriptEnabled: false}), staticPage = await noJS.newPage()
  await staticPage.goto(base + '/admin/commercial-imports?batch=' + pagination.id + '&page=2', {waitUntil: 'networkidle'})
  await staticPage.getByRole('heading', {name: 'Lote em conferência', exact: true}).waitFor()
  assert.ok(await staticPage.locator('noscript').evaluateAll(nodes => nodes.some(node => node.textContent?.includes('Ative JavaScript para confirmar.') && node.getBoundingClientRect().height > 0)))
  assert.equal(await staticPage.getByRole('button', {name: 'Confirmar lote conferido', exact: true}).isDisabled(), true)
  await capture(staticPage, 'nojs-light-390', 'light', 390, false)
  await noJS.close(); checks.push('Lotes duráveis paginam 50 linhas com identidade em detalhe. Sem JavaScript, consulta permanece disponível e não confirma silenciosamente.')

  for (const theme of ['light', 'dark'] as const) for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
    const themed = await context({colorScheme: theme, viewport: {width, height: 1050}}), screen = await themed.newPage()
    await screen.goto(base + '/admin/commercial-imports?batch=' + reportID, {waitUntil: 'networkidle'})
    await screen.waitForFunction(value => document.documentElement.getAttribute('data-theme') === value, theme, {timeout: 10000})
    assert.equal(await screen.locator('html').getAttribute('data-theme'), theme)
    await capture(screen, `confirmed-${theme}-${width}`, theme, width); await themed.close()
  }
  const dark = await context({colorScheme: 'dark'}), darkPage = await dark.newPage()
  await darkPage.goto(base + '/admin/commercial-imports?batch=' + blockedID, {waitUntil: 'networkidle'}); await capture(darkPage, 'blocked-dark-390', 'dark', 390)
  await darkPage.setViewportSize({width: 320, height: 1050}); await darkPage.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  const crampedText = await darkPage.locator('.bibliotheon-commercial-imports').evaluate(root => [...root.querySelectorAll('p,li,dt,dd,label,summary,legend,button,a,h1,h2,h3')].filter(node => { const style = getComputedStyle(node); return node.getBoundingClientRect().height > 0 && parseFloat(style.lineHeight) < parseFloat(style.fontSize) }).map(node => node.tagName))
  assert.deepEqual(crampedText, [], 'Texto ampliado não pode manter entrelinha menor que a fonte.')
  await darkPage.getByText('Conferir dados da linha 2', {exact: true}).click(); await capture(darkPage, 'text-200-dark-320', 'dark', 320)
  await darkPage.setViewportSize({width: 390, height: 1050}); await darkPage.evaluate(() => { document.documentElement.style.fontSize = '' })
  await darkPage.goto(base + '/admin/commercial-imports?batch=' + pagination.id, {waitUntil: 'networkidle'}); await capture(darkPage, 'ready-dark-390', 'dark', 390)
  await dark.close()
  assert.ok(snapshotID && reportID && caktoID); assert.deepEqual(runtimeErrors, []); assert.equal(externalRequests, 0)
  passed = true
} finally {
  await browser.close(); await seed.cleanup(); fixturesCleaned = true
  await writeFile(output + '/results.json', JSON.stringify({date: new Date().toISOString(), status: passed ? 'passed' : 'failed', checks, captures, runtimeErrors, externalRequests, fixturesCleaned, limits: 'Jornadas locais sintéticas de importação canônica. Sem layout nativo, decisão financeira visual, lançamento, conta externa ou aceite B20 integral.'}, null, 2) + '\n')
}
console.log(`QA de importação: ${checks.length} grupos e ${captures.length} capturas aprovados; fixtures limpas.`)
process.exit(0)

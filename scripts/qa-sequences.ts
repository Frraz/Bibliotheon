import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedRelationship } from '../tests/fixtures/relationship'
import { testOrigin } from '../tests/fixtures/origin'
import { requestMagnet, confirmMagnet } from '../src/modules/marketing/service'
import { processDelivery } from '../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../src/modules/marketing/validation'
import { preparePromotions } from '../src/modules/marketing/sequence'
import { sequenceDays } from '../src/modules/marketing/sequence-copy'

const seed = await seedRelationship(), { payload } = seed, browser = await chromium.launch()
const snapshotReview = process.argv.includes('--snapshot-review')
const output = snapshotReview ? 'artifacts/qa-sequences/snapshot-review' : 'artifacts/qa-sequences', results: unknown[] = [], failures: string[] = []
let nativeCreated = false
await mkdir(output, { recursive: true })
try {
  const setup = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  assert.equal((await setup.request.post(`${testOrigin}/api/admin-users/login`, { data: { email: seed.owner.email, password: seed.password } })).status(), 200)
  const editor = await setup.newPage()
  await editor.goto(`${testOrigin}/admin/collections/email-sequences/create`, { waitUntil: 'networkidle' })
  await editor.getByRole('textbox', { name: /^Nome/ }).fill('Sequência sintética revisada no painel')
  await editor.getByRole('combobox', { name: /^Amostra/ }).click()
  await editor.getByRole('option', { name: seed.magnet.title, exact: true }).click()
  await editor.getByRole('textbox', { name: /^Versão da amostra/ }).fill(seed.magnet.version)
  await editor.getByRole('combobox', { name: /^Oferta/ }).click()
  await editor.getByRole('option', { name: seed.offers[0].name, exact: true }).click()
  for (const day of sequenceDays) {
    await editor.locator(`input[name="day${day}.subject"]`).fill(`Assunto sintético D+${day}`)
    await editor.locator(`textarea[name="day${day}.text"]`).fill(`Conteúdo sintético revisado da etapa D+${day}. Este texto existe somente no ensaio local.`)
  }
  await editor.getByRole('checkbox', { name: /Conteúdo revisado e sequência ativa/ }).check()
  const [created] = await Promise.all([
    editor.waitForResponse(response => new URL(response.url()).pathname === '/api/email-sequences' && response.request().method() === 'POST'),
    editor.getByRole('button', { name: 'Salvar', exact: true }).click(),
  ])
  assert.equal(created.status(), 201)
  const sequence = (await payload.find({ collection: 'email-sequences', limit: 1, depth: 0, ...seed.auth })).docs[0]
  assert.equal(sequence.active, true); assert.ok(sequence.key); assert.ok(sequence.contentHash)
  nativeCreated = true
  await setup.close()

  const secret = randomBytes(32).toString('hex'), email = `calendar-${randomBytes(5).toString('hex')}@example.invalid`, now = Date.now()
  await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, now)
  const delivery = (await payload.find({ collection: 'email-deliveries', limit: 1, depth: 0, overrideAccess: true })).docs[0]
  let token = ''
  await processDelivery(payload, delivery.id, { secret, origin: testOrigin, now, transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-calendar' } } })
  await confirmMagnet(payload, token, secret, now)
  const enrollment = (await payload.find({ collection: 'sequence-enrollments', limit: 1, depth: 0, overrideAccess: true })).docs[0]
  await preparePromotions(payload, now + 2 * 86_400_000)

  for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addCookies([{ name: 'payload-theme', value: theme, domain: new URL(testOrigin).hostname, path: '/' }])
    await context.addInitScript(value => localStorage.setItem('bibliotheon:appearance:v1', value), theme)
    assert.equal((await context.request.post(`${testOrigin}/api/admin-users/login`, { data: { email: seed.owner.email, password: seed.password } })).status(), 200)
    const page = await context.newPage(), errors: string[] = []
    page.on('pageerror', error => errors.push(error.name))
    for (const [name, route] of [
      ['dashboard', '/admin'],
      ['sequence', `/admin/collections/email-sequences/${sequence.id}`],
      ['enrollment', `/admin/collections/sequence-enrollments/${enrollment.id}`],
      ['calendar', '/admin/collections/promotion-deliveries'],
    ]) {
      if (snapshotReview && name !== 'enrollment') continue
      assert.equal((await page.goto(testOrigin + route, { waitUntil: 'networkidle' }))?.status(), 200)
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      if (name === 'enrollment') {
        const snapshot = page.getByRole('region', { name: 'Conteúdo registrado na confirmação' })
        assert.equal(await snapshot.isVisible(), true)
        await snapshot.locator('summary').filter({ hasText: 'D+2' }).focus()
        await page.keyboard.press('Enter')
        assert.equal(await snapshot.locator('details[open] p').isVisible(), true)
        assert.equal(await snapshot.locator('textarea').count(), 0)
      }
      // Full-page captures must start at the document top, after exercising the disclosure.
      // Otherwise Chromium places sticky controls halfway through the stitched image.
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForFunction(() => window.scrollY === 0)
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png`, fullPage: true })
      results.push({ name, theme, width, overflow, jsErrors: errors.length, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) })
      if (overflow || errors.length || axe.violations.length) failures.push(`${name}/${theme}/${width}: overflow=${overflow}, JS=${errors.length}, axe=${axe.violations.map(v => v.id).join(',')}`)
    }
    await context.close()
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ origin: testOrigin, environment: 'Standalone e PostgreSQL locais; dados sintéticos', nativeCreated, results, failures, externalCalls: false, limits: 'Valida calendário local; não homologa transporte de campanhas ou bloqueio no Brevo.' }, null, 2))
  assert.deepEqual(failures, [])
  console.log(`Calendário no painel: cadastro nativo e ${results.length} telas aprovados; nenhuma chamada externa.`)
} finally {
  await browser.close()
  await seed.cleanup()
}
process.exit(0)

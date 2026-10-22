import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedSite } from '../tests/fixtures/site'
import { testOrigin } from '../tests/fixtures/origin'

const seed = await seedSite(), { payload } = seed
const suffix = randomBytes(5).toString('hex'), contacts: string[] = [], screens: unknown[] = []
const output = 'artifacts/qa-suppressions', endpoint = `${testOrigin}/api/v1/admin/suppressions`
const browser = await chromium.launch()
let isolated = false
await mkdir(output, { recursive: true })
try {
  for (const collection of ['contacts', 'consent-events'] as const) assert.equal((await payload.count({ collection, overrideAccess: true })).totalDocs, 0, 'Use banco operacional vazio.')
  isolated = true
  const anonymous = await fetch(endpoint, { method: 'POST', headers: { Origin: testOrigin, 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(anonymous.status, 403)
  assert.match(anonymous.headers.get('cache-control') || '', /no-store/)
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await guestPage.goto(`${testOrigin}/admin/suppressions`)
  await guestPage.waitForURL(`${testOrigin}/admin/login`)
  assert.equal(new URL(guestPage.url()).pathname, '/admin/login')
  await guest.close()
  let firstInput: Record<string, string> | undefined
  for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addCookies([{ name: 'payload-theme', value: theme, domain: new URL(testOrigin).hostname, path: '/' }])
    await context.addInitScript(value => localStorage.setItem('bibliotheon:appearance:v1', value), theme)
    const login = await context.request.post(`${testOrigin}/api/admin-users/login`, { data: { email: seed.owner.email, password: seed.password } })
    assert.equal(login.status(), 200)
    if (!firstInput) {
      for (const headers of [{}, { Origin: 'https://other.example.invalid' }] as Record<string, string>[]) {
        const denied = await context.request.post(endpoint, { headers, data: {} })
        assert.equal(denied.status(), 403)
      }
      for (const data of [{}, { email: 'invalid', reason: 'ok' }, { excessive: 'x'.repeat(4096) }]) {
        const invalid = await context.request.post(endpoint, { headers: { Origin: testOrigin }, data })
        assert.equal(invalid.status(), 422)
      }
      assert.equal((await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs, 0)
    }
    const page = await context.newPage(), errors: string[] = []
    page.on('pageerror', error => errors.push(error.name))
    const response = await page.goto(`${testOrigin}/admin/suppressions`, { waitUntil: 'networkidle' })
    assert.equal(response?.status(), 200)
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    assert.match(response?.headers()['x-robots-tag'] || '', /noindex/)
    const form = page.locator('form.bibliotheon-operational-form')
    assert.equal(await form.getAttribute('method'), 'post')
    await assertScreen('initial')
    const input = { email: `suppression-${theme}-${width}-${suffix}@example.invalid`, reason: 'bounced', source: 'brevo-review', reference: `synthetic-${theme}-${width}-${suffix}` }
    if (!firstInput) firstInput = input
    await page.getByLabel('E-mail do contato', { exact: true }).fill(input.email)
    await page.getByLabel('Motivo', { exact: true }).selectOption(input.reason)
    await page.getByLabel('Onde você conferiu?', { exact: true }).selectOption(input.source)
    await page.getByText('Referência da conferência', { exact: true }).click()
    await page.getByLabel('Identificador', { exact: true }).fill(input.reference)
    assert.equal(await page.getByLabel('Identificador', { exact: true }).evaluate((element: HTMLInputElement) => element.checkValidity()), true)
    await page.getByLabel('Conferi o endereço e o motivo do bloqueio.').check()
    await page.route(endpoint, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
    await page.getByRole('button', { name: 'Registrar bloqueio' }).click()
    await page.getByRole('alert').waitFor()
    await assertScreen('error')
    await page.unroute(endpoint)
    assert.equal(await page.getByLabel('Identificador', { exact: true }).inputValue(), input.reference)
    await page.getByRole('button', { name: 'Registrar bloqueio' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('status').filter({ hasText: 'Bloqueio registrado.' }).waitFor()
    assert.equal(await page.getByLabel('E-mail do contato', { exact: true }).inputValue(), '')
    assert.equal(new URL(page.url()).search, '')
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: input.email } }, overrideAccess: true })).docs[0]
    assert.equal(contact.deliveryState, 'bounced')
    contacts.push(contact.id)
    await assertScreen('success')
    assert.deepEqual(errors, [])
    await context.close()

    async function assertScreen(state: string) {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${output}/${theme}-${width}-${state}.png`, fullPage: true })
      screens.push({ theme, width, state, overflow, violations: result.violations.map(v => v.id), jsErrors: errors.length })
      assert.deepEqual(result.violations.map(v => v.id), [])
      assert.equal(overflow, false)
    }
  }
  const session = await browser.newContext()
  await session.request.post(`${testOrigin}/api/admin-users/login`, { data: { email: seed.owner.email, password: seed.password } })
  const duplicate = await session.request.post(endpoint, { headers: { Origin: testOrigin }, data: firstInput })
  assert.equal(duplicate.status(), 200); assert.equal((await duplicate.json()).applied, false)
  const conflict = await session.request.post(endpoint, { headers: { Origin: testOrigin }, data: { ...firstInput, reason: 'complaint' } })
  assert.equal(conflict.status(), 422)
  assert.equal((await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs, contacts.length)
  assert.equal((await payload.count({ collection: 'consent-events', overrideAccess: true })).totalDocs, contacts.length)
  await session.close()
  await writeFile(`${output}/results.json`, JSON.stringify({ environment: 'Standalone e PostgreSQL loopback; somente contatos sintéticos', origin: testOrigin, checks: ['API anônima negada; view protegida', 'origem ausente/externa negada; JSON inválido/oversize recusado sem mutação', 'mesma referência idempotente; conflito recusado', 'erro mantém entrada; retentativa por teclado; contato bloqueado; entrada limpa no sucesso'], screens, externalCalls: false, limits: 'Não verifica supressão na conta Brevo nem campanhas promocionais.' }, null, 2))
  console.log(`Supressões: API, CSRF, idempotência e ${screens.length} telas aprovadas; nenhuma chamada externa.`)
} finally {
  await browser.close()
  if (isolated) {
    const created = await payload.find({ collection: 'contacts', where: { email: { contains: `-${suffix}@example.invalid` } }, limit: 100, overrideAccess: true })
    for (const contact of created.docs) {
      await payload.delete({ collection: 'consent-events', where: { contact: { equals: contact.id } }, overrideAccess: true })
      await payload.delete({ collection: 'contacts', id: contact.id, overrideAccess: true })
    }
  }
  await seed.cleanup()
}
process.exit(0)

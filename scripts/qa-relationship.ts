import { testOrigin } from '../tests/fixtures/origin'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedRelationship } from '../tests/fixtures/relationship'
import { processDelivery } from '../src/modules/marketing/delivery'

const base = testOrigin
const output = 'artifacts/qa-relationship'
const seed = await seedRelationship(), { payload } = seed
const browser = await chromium.launch()
const results: unknown[] = []
const secret = process.env.LEAD_TOKEN_SECRET
assert.ok(secret && secret.length >= 32, 'Configure chave privada local dos links.')
await mkdir(output, { recursive: true })
try {
  for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript(t => localStorage.setItem('bibliotheon:appearance:v1', t), theme)
    const page = await context.newPage()
    const screenshot = async (name: string) => {
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png`, fullPage: true })
      results.push({ name, theme, width, overflow, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })) })
      assert.equal(overflow, false); assert.deepEqual(axe.violations.map(v => v.id), [])
    }
    assert.equal((await page.goto(`${base}/amostras/${seed.magnet.slug}`, { waitUntil: 'networkidle' }))?.status(), 200)
    assert.equal(await page.getByRole('checkbox').isChecked(), false)
    assert.equal(await page.locator('form').getAttribute('method'), 'post', 'Sem JS, formulário não deve expor e-mail por query string.')
    await screenshot('capture')
    const email = `browser-${randomBytes(6).toString('hex')}@example.invalid`
    await page.getByLabel('Seu e-mail').fill(email)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Solicitar amostra', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'receberá um e-mail' }).waitFor()
    await screenshot('requested')
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
    const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, depth: 0, overrideAccess: true })).docs[0]
    assert.equal(request.confirmedAt, null)
    let token = '', preference = ''
    const delivery = (await payload.find({ collection: 'email-deliveries', where: { request: { equals: request.id } }, depth: 0, overrideAccess: true })).docs[0]
    await processDelivery(payload, delivery.id, { secret, origin: base, transport: async message => {
      token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''
      return { state: 'sent', messageId: 'synthetic-browser-confirmation' }
    } })
    assert.ok(token)
    const confirmation = await page.goto(`${base}/amostras/confirmar?t=${token}`, { waitUntil: 'networkidle' })
    assert.equal(confirmation?.status(), 200)
    assert.equal(confirmation?.headers()['referrer-policy'], 'no-referrer')
    assert.ok(confirmation?.headers()['cache-control'].includes('no-store'))
    assert.equal((await payload.findByID({ collection: 'magnet-requests', id: request.id, overrideAccess: true })).confirmedAt, null, 'GET/scanner não pode confirmar.')
    await screenshot('confirmation')
    await page.getByRole('button', { name: 'Confirmar e acessar amostra' }).click()
    await page.getByRole('link', { name: /^Baixar/ }).waitFor()
    await screenshot('download-ready')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /^Baixar/ }).click()])
    const temporary = await download.path()
    assert.ok(temporary); assert.deepEqual(await readFile(temporary), seed.pdf)
    const sampleDelivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'delivery' } }] }, depth: 0, overrideAccess: true })).docs[0]
    await processDelivery(payload, sampleDelivery.id, { secret, origin: base, transport: async message => {
      preference = /\/preferencias\?t=([\w-]+)/.exec(message.text)?.[1] || ''
      return { state: 'sent', messageId: 'synthetic-browser-sample' }
    } })
    assert.ok(preference)
    await page.goto(`${base}/preferencias?t=${preference}`, { waitUntil: 'networkidle' })
    assert.equal((await payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true })).globalSuppressedAt, null)
    await screenshot('preferences')
    await page.getByRole('button', { name: 'Cancelar marketing por e-mail' }).click()
    await page.getByRole('status').filter({ hasText: 'foi cancelado' }).waitFor()
    await screenshot('unsubscribed')
    assert.ok((await payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true })).globalSuppressedAt)
    await page.goto(`${base}/amostras/confirmar?t=invalido`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Confirmar e acessar amostra' }).click()
    await page.getByRole('alert').filter({ hasText: 'expirou' }).waitFor()
    await screenshot('expired')
    await context.close()
  }
  assert.equal((await fetch(`${base}/api/media/file/${seed.sampleMedia.filename}`)).status, 403)
  assert.equal((await fetch(`${base}/api/v1/downloads/invalid`)).status, 410)
  assert.equal((await fetch(`${base}/api/contacts`)).status, 403)
  console.log(`Relacionamento no navegador: ${results.length} screenshots; confirmação por POST, PDF privado, descadastro e erros aprovados; transporte em memória.`)
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ date: new Date().toISOString(), environment: 'Chromium local; fixtures e transporte em memória', results, limits: 'Não homologa entrega real, campanhas de marketing ou conta Brevo.' }, null, 2))
  await browser.close(); await seed.cleanup()
}
process.exit(0)

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { testOrigin } from '../tests/fixtures/origin'
import { seedRelationship } from '../tests/fixtures/relationship'
import { createOpaqueToken, UNSUBSCRIBE_TTL } from '../src/modules/marketing/tokens'

const base = testOrigin, output = 'artifacts/qa-preferences'
const seed = await seedRelationship(), { payload } = seed
const browser = await chromium.launch(), results: unknown[] = []
await mkdir(output, { recursive: true })
try {
  for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const now = Date.now(), contact = await payload.create({ collection: 'contacts', data: { email: `preferences-qa-${randomUUID()}@example.invalid`, deliveryState: 'ok', confirmedAt: new Date(now).toISOString() }, overrideAccess: true })
    const subscription = await payload.create({ collection: 'subscriptions', data: { contact: contact.id, theme: seed.theme.id, key: `${contact.id}:${seed.theme.id}`, state: 'subscribed', subscribedAt: new Date(now).toISOString(), consentVersion: 'synthetic-qa-only' }, overrideAccess: true })
    const token = createOpaqueToken()
    await payload.create({ collection: 'preference-tokens', data: { contact: contact.id, tokenHash: token.hash, expiresAt: new Date(now + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript(t => localStorage.setItem('bibliotheon:appearance:v1', t), theme)
    const page = await context.newPage()
    let posts = 0
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/v1/')) posts++ })
    const screenshot = async (name: string) => {
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png`, fullPage: true })
      results.push({ name, theme, width, overflow, violations: axe.violations.map(v => v.id) })
      assert.equal(overflow, false); assert.deepEqual(axe.violations.map(v => v.id), [])
    }
    const response = await page.goto(`${base}/preferencias?t=${token.token}`, { waitUntil: 'networkidle' })
    assert.equal(response?.status(), 200)
    assert.ok(response?.headers()['cache-control']?.includes('no-store'))
    assert.equal(posts, 0, 'Abrir link não deve consultar dados ou alterar assinatura.')
    assert.equal((await payload.findByID({ collection: 'subscriptions', id: subscription.id, overrideAccess: true })).state, 'subscribed')
    const consult = page.getByRole('button', { name: 'Consultar minhas assinaturas' })
    await consult.focus(); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: `Cancelar e-mails sobre ${seed.theme.name}` }).waitFor()
    await screenshot('subscribed')
    await page.getByRole('button', { name: `Cancelar e-mails sobre ${seed.theme.name}` }).click()
    await page.getByText('Não há assinaturas de assuntos ativas.').waitFor()
    await screenshot('theme-canceled')
    assert.equal((await payload.findByID({ collection: 'subscriptions', id: subscription.id, overrideAccess: true })).state, 'unsubscribed')
    await page.getByRole('button', { name: 'Cancelar marketing por e-mail' }).click()
    await page.getByText('O marketing por e-mail foi cancelado. Amostras que você solicitar continuam disponíveis.').waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Escolher por assunto' }).count(), 0)
    await screenshot('global-canceled')
    await context.close()
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ date: '2026-10-22 America/Belem', environment: 'Build .next-qa local; dados sintéticos; nenhum envio ou API externa', checks: ['GET sem consulta privada/mutação', 'consulta explícita por teclado', 'cancelamento temático com estado persistido', 'cancelamento global oculta escolhas antigas'], screenshots: results.length, results }, null, 2)+'\n')
  console.log(`Preferências no navegador: ${results.length} telas, dois temas/seis larguras; axe/overflow aprovados.`)
} finally { await browser.close(); await seed.cleanup() }
process.exit(0)

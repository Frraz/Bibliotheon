import { testOrigin } from '../tests/fixtures/origin'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = 'artifacts/qa-foundation'
await mkdir(output, { recursive: true })
assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL || '').hostname), 'Teste permitido apenas em banco loopback.')
const payload = await getPayload({ config })
assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 0, 'Banco local de teste deve estar vazio.')
const email = 'owner-sintetico@example.invalid'
const password = randomBytes(32).toString('hex')
const admin = await payload.create({ collection: 'admin-users', data: { email, password, role: 'owner' }, overrideAccess: true, context: { provisionAdmin: true } })
const browser = await chromium.launch()
const results: unknown[] = []
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addCookies([{ name: 'payload-theme', value: theme, domain: '127.0.0.1', path: '/' }])
    await context.addInitScript(t => localStorage.setItem('bibliotheon:appearance:v1', t), theme)
    const page = await context.newPage()
    const loginPage = await page.goto(testOrigin + '/admin/login', { waitUntil: 'networkidle' })
    assert.equal(loginPage?.status(), 200)
    await page.screenshot({ path: `${output}/admin-login-${theme}-${width}.png`, fullPage: true })
    const login = await context.request.post(testOrigin + '/api/admin-users/login', { data: { email, password } })
    assert.equal(login.status(), 200)
    const dashboard = await page.goto(testOrigin + '/admin', { waitUntil: 'networkidle' })
    assert.equal(dashboard?.status(), 200)
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    await page.screenshot({ path: `${output}/admin-dashboard-${theme}-${width}.png`, fullPage: true })
    results.push({ theme, width, overflow, violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary, html: n.html })) })) })
    assert.equal(overflow, false)
    assert.deepEqual(axe.violations.map(v => v.id), [])
    await page.getByLabel('Aparência', { exact: false }).selectOption('system')
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' })
    await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme === 'dark' ? 'light' : 'dark')
    await context.close()
  }
  console.log('Admin: login/dashboard em dois temas e duas larguras, axe/overflow e provider system aprovados.')
} finally {
  await writeFile(`${output}/admin-results.json`, JSON.stringify({ origin: testOrigin, results, limits: 'Rodada de login/dashboard; formulários editoriais e demais telas possuem rodadas próprias.' }, null, 2))
  await browser.close()
  await payload.delete({ collection: 'admin-users', id: admin.id, overrideAccess: true })
  await payload.destroy()
}
process.exit(0)

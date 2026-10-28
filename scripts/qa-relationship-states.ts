import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, type BrowserContext, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedRelationship } from '../tests/fixtures/relationship'
import { testOrigin as base } from '../tests/fixtures/origin'
import { processDelivery } from '../src/modules/marketing/delivery'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
const output = 'artifacts/qa-relationship-states'
const mode = process.env.BIBLIOTHEON_RELATIONSHIP_STATES_MODE || 'all'
assert.ok(['all', 'native'].includes(mode))
await mkdir(output, { recursive: true })
const seed = await seedRelationship(), { payload } = seed
const secret = process.env.LEAD_TOKEN_SECRET
assert.ok(secret && secret.length >= 32)
const folder = await mkdtemp(join(tmpdir(), 'bibliotheon-forms-native-'))
const extension = join(folder, 'extension'); await mkdir(extension)
await writeFile(join(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Synthetic native zoom', version: '1.0.0', permissions: ['tabs'], background: { service_worker: 'background.js' } }))
await writeFile(join(extension, 'background.js'), 'globalThis.ready = true')
const browser = await chromium.launch()
let persistent: BrowserContext | undefined, externalRequests = 0, passed = false
const runtimeErrors: string[] = [], results: Array<Record<string, unknown>> = []
type Tabs = { query: (query: object) => Promise<Array<{ id: number; url?: string }>>; setZoomSettings: (id: number, settings: object) => Promise<void>; setZoom: (id: number, value: number) => Promise<void>; getZoom: (id: number) => Promise<number> }

async function guard(context: BrowserContext, theme: 'light' | 'dark') {
  await context.route(/^https?:\/\//, route => {
    if (new URL(route.request().url()).origin === base) return route.continue()
    externalRequests++; return route.abort()
  })
  await context.addInitScript(theme => localStorage.setItem('bibliotheon:appearance:v1', theme), theme)
}
async function scenario(context: BrowserContext, theme: 'light' | 'dark', width: number, native = false) {
  const page = context.pages()[0] || await context.newPage()
  page.on('pageerror', error => runtimeErrors.push(error.name))
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  const cdp = native ? await context.newCDPSession(page) : undefined
  async function zoom() {
    if (!native) return
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
    const actual = await worker.evaluate(async url => {
      const tabs = (globalThis as unknown as { chrome: { tabs: Tabs } }).chrome.tabs
      const tab = (await tabs.query({})).find(tab => tab.url === url)
      if (!tab) throw new Error('Aba de QA ausente.')
      await tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-tab' })
      await tabs.setZoom(tab.id, 4)
      return tabs.getZoom(tab.id)
    }, page.url())
    assert.ok(Math.abs(actual - 4) < 1e-8)
    await page.waitForFunction(() => Math.abs(devicePixelRatio - 4) < 1e-8 && innerWidth === 320 && outerWidth === 1280)
  }
  async function capture(state: string, target: Locator) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const metrics = await page.evaluate(() => ({ width: innerWidth, outerWidth, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth > innerWidth }))
    assert.equal(metrics.overflow, false, `${state}/${theme}/${width}: overflow`)
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    const files = []
    const prefix = `${output}/${state}-${theme}-${native ? 'native400' : width}`
    if (cdp) {
      for (const [name, locator] of [['heading', page.locator('h1')], ['action', target]] as const) {
        await locator.scrollIntoViewIfNeeded()
        const shot: { data: string } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
        const bytes: Buffer = Buffer.from(shot.data, 'base64'), path = `${prefix}-${name}.png`
        assert.equal(bytes.readUInt32BE(16), 1280)
        await writeFile(path, bytes)
        files.push({ path, width: 1280, height: bytes.readUInt32BE(20), sha256: createHash('sha256').update(bytes).digest('hex') })
      }
    } else {
      const path = `${prefix}.png`
      await page.screenshot({ path, fullPage: true })
      files.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })
    }
    const violations = axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))
    results.push({ state, theme, width, nativeZoom: native ? 4 : 1, metrics, violations, files })
    await writeFile(`${output}/progress.json`, JSON.stringify({ results, externalRequests, runtimeErrors }, null, 2) + '\n')
    assert.deepEqual(violations, [], `${state}/${theme}/${width}: axe`)
  }
  async function hasFocus(state: string) {
    assert.equal(await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== document.documentElement), true, `${state}: foco do teclado perdido após a resposta`)
  }
  async function failTemporarily(endpoint: string, action: Locator, pendingName: string, state: string) {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const handler = async (route: import('@playwright/test').Route) => {
      await gate
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Falha temporária sintética. Tente novamente.' } }) })
    }
    const preserveFocus = state === 'capture' && width === 390 && !native
    const privacyLink = page.locator('.sample-form').getByRole('link', { name: 'aviso de privacidade', exact: true })
    await page.route(`**${endpoint}`, handler)
    try {
      await action.focus(); await page.keyboard.press('Enter')
      const loading = page.getByRole('button', { name: state === 'theme-unsubscribe' ? /^Cancelar e-mails sobre / : pendingName, exact: true })
      await expect(loading).toBeDisabled()
      await capture(`${state}-loading`, loading)
      if (preserveFocus) await privacyLink.focus()
    } finally { release() }
    await expect(page.getByRole('alert').filter({ hasText: 'Falha temporária sintética' })).toBeVisible()
    await page.unroute(`**${endpoint}`, handler)
    await capture(`${state}-error`, page.getByRole('alert').filter({ hasText: 'Falha temporária sintética' }))
    await hasFocus(`${state}-error`)
    if (preserveFocus) await expect(privacyLink).toBeFocused()
  }
  assert.equal((await page.goto(`${base}/amostras/${seed.magnet.slug}`, { waitUntil: 'networkidle' }))?.status(), 200)
  await zoom()
  const emailField = page.getByLabel('Seu e-mail'), submit = page.getByRole('button', { name: 'Solicitar amostra', exact: true })
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await capture('capture-active', emailField)
  await emailField.fill('endereco-invalido'); await submit.click()
  assert.equal(await emailField.evaluate((element: HTMLInputElement) => element.validity.typeMismatch), true)
  await expect(emailField).toBeFocused()
  await capture('capture-invalid-email', emailField)
  const email = `states-${randomBytes(6).toString('hex')}@example.invalid`
  await emailField.fill(email); await page.getByRole('checkbox').check()
  await failTemporarily('/api/v1/lead-requests', submit, 'Solicitando…', 'capture')
  await expect(emailField).toHaveValue(email)
  await submit.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'receberá um e-mail' })).toBeVisible()
  await capture('capture-retry-success', page.getByRole('status').filter({ hasText: 'receberá um e-mail' }))
  await hasFocus('capture-retry-success')
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
  const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, overrideAccess: true })).docs[0]
  const pending = (await payload.find({ collection: 'email-deliveries', where: { request: { equals: request.id } }, overrideAccess: true })).docs[0]
  let token = '', preference = ''
  await processDelivery(payload, pending.id, { secret: secret!, origin: base, transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-state-confirmation' } } })
  assert.ok(token)
  await page.goto(`${base}/amostras/confirmar?t=${token}`, { waitUntil: 'networkidle' }); await zoom()
  const confirm = page.getByRole('button', { name: 'Confirmar e acessar amostra', exact: true })
  await failTemporarily('/api/v1/lead-confirmations', confirm, 'Processando…', 'confirmation')
  await confirm.focus(); await page.keyboard.press('Enter')
  const download = page.getByRole('link', { name: /^Baixar/ }); await expect(download).toBeVisible()
  await capture('confirmation-retry-success', download); await hasFocus('confirmation-retry-success')
  const delivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })).docs[0]
  await processDelivery(payload, delivery.id, { secret: secret!, origin: base, transport: async message => { preference = /\/preferencias\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-state-sample' } } })
  assert.ok(preference)
  await page.goto(`${base}/preferencias?t=${preference}`, { waitUntil: 'networkidle' }); await zoom()
  const consult = page.getByRole('button', { name: 'Consultar minhas assinaturas', exact: true })
  await failTemporarily('/api/v1/preferences', consult, 'Consultando…', 'preferences')
  await consult.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /^Cancelar e-mails sobre / })).toBeVisible()
  await capture('preferences-retry-success', page.getByRole('button', { name: /^Cancelar e-mails sobre / })); await hasFocus('preferences-retry-success')
  const themeCancel = page.getByRole('button', { name: /^Cancelar e-mails sobre / })
  await failTemporarily('/api/v1/preferences', themeCancel, 'Cancelar este assunto', 'theme-unsubscribe')
  await themeCancel.focus(); await page.keyboard.press('Enter')
  await expect(page.getByText('Não há assinaturas de assuntos ativas.', { exact: true })).toBeVisible()
  const themeCanceled = page.getByRole('status').filter({ hasText: 'Os e-mails deste tema foram cancelados' })
  await capture('theme-unsubscribe-retry-success', themeCanceled); await hasFocus('theme-unsubscribe-retry-success')
  const cancel = page.getByRole('button', { name: 'Cancelar marketing por e-mail', exact: true })
  await failTemporarily('/api/v1/unsubscribe', cancel, 'Processando…', 'unsubscribe')
  await cancel.focus(); await page.keyboard.press('Enter')
  const canceled = page.getByRole('status').filter({ hasText: 'foi cancelado' }); await expect(canceled).toBeVisible()
  await capture('unsubscribe-retry-success', canceled); await hasFocus('unsubscribe-retry-success')
}
try {
  if (mode === 'all') for (const theme of ['light', 'dark'] as const) for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    try { await guard(context, theme); await scenario(context, theme, width) } finally { await context.close() }
  }
  for (const theme of ['light', 'dark'] as const) {
    persistent = await chromium.launchPersistentContext(join(folder, `profile-${theme}`), { channel: 'chromium', headless: true, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1280,960', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] })
    await guard(persistent, theme); await scenario(persistent, theme, 320, true)
    await persistent.close(); persistent = undefined
  }
  for (const theme of ['light', 'dark'] as const) for (const width of [390, 1440]) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 1000 }, colorScheme: theme })
    try {
      await guard(context, theme)
      const page = await context.newPage()
      let posts = 0
      page.on('request', request => { if (request.method() === 'POST') posts++ })
      for (const [path, state] of [[`/amostras/${seed.magnet.slug}`, 'capture-nojs'], ['/amostras/confirmar?t=synthetic-invalid', 'confirmation-nojs'], ['/preferencias?t=synthetic-invalid', 'preferences-nojs']] as const) {
        assert.equal((await page.goto(base + path, { waitUntil: 'networkidle' }))?.status(), 200)
        await expect(page.locator('.sample-form').getByText(/Ative o JavaScript para/)).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        assert.equal(overflow, false)
        assert.equal(posts, 0, 'HTML sem JS não pode confirmar/consultar/cancelar ao abrir o link.')
        const file = `${output}/${state}-${theme}-${width}.png`
        await page.screenshot({ path: file, fullPage: true })
        results.push({ state, theme, width, overflow, axe: 'not-run-javascript-disabled', posts, files: [{ path: file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') }] })
      }
    } finally { await context.close() }
  }
  assert.equal(externalRequests, 0); assert.deepEqual(runtimeErrors, [])
  passed = true
} finally {
  await persistent?.close(); await browser.close(); await rm(folder, { recursive: true })
  await seed.cleanup()
  await writeFile(`${output}/${mode === 'native' ? 'native-results.json' : 'results.json'}`, JSON.stringify({ phase: 'D123', mode, completedAt: new Date().toISOString(), status: passed ? 'passed' : 'failed', results, externalRequests, runtimeErrors, realMessagesSent: 0, fixturesCleaned: true, fullH05Accepted: false, limits: 'Dados sintéticos; respostas temporárias interceptadas e entrega em memória. Sem homologação de conta ou carga de produção.' }, null, 2) + '\n')
}
console.log(`Estados de relacionamento: ${results.length} combinações aprovadas, incluindo zoom nativo e foco por teclado.`)
process.exit(0)

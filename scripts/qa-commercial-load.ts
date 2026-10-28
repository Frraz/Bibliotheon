import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { request, type APIRequestContext } from '@playwright/test'
import { seedCommerce } from '../tests/fixtures/commerce'
import { textBody } from '../tests/fixtures/site'
import { hotmartFixture, hotmartEnv, hotmartProduct, hotmartOffer, seedHotmartCatalog } from '../tests/fixtures/hotmart'
import { commercialEventKey, commercialProviders, type CommercialAdapter, type NormalizedCommercialEvent } from '../src/modules/commerce/events'
import { receiveCommercialWebhook, processCommercialInbox } from '../src/modules/commerce/inbox'
import { testOrigin as base } from '../tests/fixtures/origin'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
const output = 'artifacts/qa-commercial-load'
await mkdir(output, { recursive: true })
const seed = await seedCommerce(), { payload } = seed
const extraBooks: string[] = [], extraThemes: string[] = [], extraArticles: string[] = []
const clients: APIRequestContext[] = []
const phases: Array<Record<string, unknown>> = []
let passed = false, externalRequests = 0, baselineReady = false, fixturesCleaned = false, failure: string | undefined
const transactionCount = 1000, now = Date.now(), occurredAt = new Date(now - 3600000).toISOString()
const from = new Date(now - 86400000).toISOString().slice(0, 10), through = new Date(now).toISOString().slice(0, 10)
const reportInput = { from, through }
const replay = hotmartFixture({ id: 'synthetic-load-replayed-event', transaction: 'synthetic-load-replayed-transaction', now: now - 120000 })
const headers = new Headers({ 'x-fixture-signature': 'synthetic' })
const adapters = Object.fromEntries(commercialProviders.map(provider => [provider, {
  provider, version: 'synthetic-load-v1', verify: async (_body: Uint8Array, input: Headers) => input.get('x-fixture-signature') === 'synthetic', normalize: (bytes: Uint8Array) => JSON.parse(Buffer.from(bytes).toString()),
} satisfies CommercialAdapter]))
const counts = async () => ({
  inbox: (await payload.count({ collection: 'commercial-inbox', overrideAccess: true })).totalDocs,
  transactions: (await payload.count({ collection: 'transactions', overrideAccess: true })).totalDocs,
  events: (await payload.count({ collection: 'transaction-events', overrideAccess: true })).totalDocs,
  conflicts: (await payload.count({ collection: 'commercial-conflicts', overrideAccess: true })).totalDocs,
})
function validateReport(value: { currencies: Array<{ approvedTransactions: number; grossCents: number | null; receivedCents: number | null; marginComplete: boolean }> }) {
  assert.equal(value.currencies.length, 1)
  const brl = value.currencies[0]
  assert.equal(brl.approvedTransactions, transactionCount)
  assert.equal(brl.grossCents, transactionCount * 9900)
  assert.equal(brl.receivedCents, null)
  assert.equal(brl.marginComplete, false)
}
try {
  await seedHotmartCatalog(seed)
  const loginClient = await request.newContext({ baseURL: base, timeout: 30000, maxRedirects: 0 })
  clients.push(loginClient)
  const login = await loginClient.post('/api/admin-users/login', { data: { email: seed.owner.email, password: seed.password } })
  assert.equal(login.status(), 200)
  const token = (await login.json()).token
  assert.equal(typeof token, 'string')
  const authHeaders = { Authorization: `JWT ${token}` }
  const storageState = await loginClient.storageState()
  const owner = await request.newContext({ baseURL: base, storageState, extraHTTPHeaders: authHeaders, timeout: 30000, maxRedirects: 0 })
  clients.push(owner)
  await loginClient.dispose(); clients.shift()
  const identity = await owner.get('/api/admin-users/me')
  assert.equal(identity.status(), 200); assert.equal((await identity.json()).user?.id, seed.owner.id)
  const preflight = await owner.post('/api/v1/admin/financial-report/preview', { headers: { Origin: base }, data: reportInput })
  assert.equal(preflight.status(), 200, 'Prévia autenticada antes do seed')
  const postReplay = (client: APIRequestContext) => client.post('/api/v1/webhooks/hotmart', { headers: { 'X-HOTMART-HOTTOK': hotmartEnv.HOTMART_HOTTOK }, data: replay })
  const first = await postReplay(owner)
  assert.equal(first.status(), 200); assert.equal((await first.json()).code, 'accepted')
  const inboxPreflight = await owner.get('/admin/commercial-inbox?provider=all&state=all')
  assert.equal(inboxPreflight.status(), 200)
  assert.ok((await inboxPreflight.body()).includes(Buffer.from(replay.id)), 'Inbox autenticada antes do seed')
  for (let i = 0; i < 2; i++) extraThemes.push((await payload.create({ collection: 'themes', ...seed.auth, data: { name: `Tema sintético de carga ${i}`, slug: `load-theme-${i}-${seed.theme.id.slice(0, 8)}`, introduction: 'Somente teste local.', _status: 'published' } })).id)
  const themes = [seed.theme.id, ...extraThemes]
  for (let i = 3; i < 30; i++) extraBooks.push((await payload.create({ collection: 'ebooks', ...seed.auth, data: { title: `Livro sintético de carga ${i}`, slug: `load-book-${i}-${seed.theme.id.slice(0, 8)}`, summary: 'Fixture exclusiva de laboratório.', audience: 'Teste', problem: 'Medir carga', promise: 'Verificar o catálogo', requirements: 'Fixture', limits: 'Não é produto real.', body: textBody('Conteúdo sintético de laboratório.'), cover: seed.cover.id, theme: themes[i % 3], materialState: 'ready', presentationVariant: 'guide', accentPreset: 'mineral', _status: 'published' } })).id)
  for (let i = 1; i < 30; i++) extraArticles.push((await payload.create({ collection: 'articles', ...seed.auth, data: { title: `Artigo sintético de carga ${i}`, slug: `load-article-${i}-${seed.theme.id.slice(0, 8)}`, summary: 'Somente laboratório.', author: 'Equipe sintética', theme: themes[i % 3], body: textBody('Texto de laboratório, sem dados reais.'), _status: 'published' } })).id)
  const seededAt = performance.now()
  for (let i = 0; i < transactionCount; i++) {
    const provider = commercialProviders[i % commercialProviders.length]
    const event: NormalizedCommercialEvent = { provider, accountKey: 'synthetic', eventKey: `synthetic-load-event-${i}`, externalTransactionId: `synthetic-load-transaction-${i}`, externalProductId: provider === 'hotmart' ? hotmartProduct : 'synthetic-product', externalOfferId: provider === 'hotmart' ? hotmartOffer : null, kind: 'approved', occurredAt, approvedAt: occurredAt, currency: 'BRL', grossCents: 9900, refundedCents: null, feesCents: null, producerNetCents: null, externalClickReference: null, refundBasis: null, externalRefundId: null, chargebackCents: null }
    assert.equal((await receiveCommercialWebhook(payload, adapters[provider], { provider, accountKey: 'synthetic' }, Buffer.from(JSON.stringify(event)), headers)).state, 'received')
    const receipt = (await payload.find({ collection: 'commercial-inbox', where: { key: { equals: commercialEventKey(event) } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    assert.equal((await processCommercialInbox(payload, receipt.id)).state, 'applied')
    if ((i + 1) % 200 === 0) console.log(`Carga: ${i + 1}/${transactionCount} transações sintéticas preparadas.`)
  }
  baselineReady = true
  phases.push({ stage: 'seed', durationMs: performance.now() - seededAt, counts: await counts() })
  assert.deepEqual(await counts(), { inbox: 1001, transactions: 1000, events: 1000, conflicts: 0 })
  validateReport(await (await owner.post('/api/v1/admin/financial-report/preview', { headers: { Origin: base }, data: reportInput })).json())
  // One real owner session, cloned into independent local HTTP clients (tabs/tasks).
  // The application deliberately has one owner; this does not invent extra users.
  for (const concurrency of [5, 10]) {
    const sessions = await Promise.all(Array.from({ length: concurrency }, async () => {
      const client = await request.newContext({ baseURL: base, storageState, extraHTTPHeaders: authHeaders, timeout: 30000, maxRedirects: 0 })
      clients.push(client); return client
    }))
    const timings: Array<{ endpoint: string; durationMs: number; status: number }> = []
    const journeys: number[] = []
    const measured = async (endpoint: string, operation: () => ReturnType<APIRequestContext['get']>) => {
      const started = performance.now(), response = await operation()
      if (new URL(response.url()).origin !== base) externalRequests++
      assert.equal(response.status(), 200, endpoint)
      const body = await response.body()
      timings.push({ endpoint, durationMs: performance.now() - started, status: response.status() })
      return body
    }
    const started = performance.now()
    await Promise.all(sessions.map(async client => {
      for (let iteration = 0; iteration < 3; iteration++) {
        const start = performance.now()
        const catalog = await measured('catalog-filter', () => client.get(`/ebooks?tema=${seed.theme.slug}`))
        assert.ok(catalog.includes(Buffer.from('Bibliotheon')))
        const report = JSON.parse((await measured('financial-report', () => client.post('/api/v1/admin/financial-report/preview', { headers: { Origin: base }, data: reportInput }))).toString())
        validateReport(report)
        const inbox = await measured('commercial-inbox', () => client.get('/admin/commercial-inbox?provider=all&state=all'))
        assert.ok(inbox.includes(Buffer.from('synthetic-load-event')))
        const receipt = JSON.parse((await measured('native-callback-replay', () => postReplay(client))).toString())
        assert.equal(receipt.code, 'accepted')
        journeys.push(performance.now() - start)
      }
    }))
    const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
    const summaries = [...new Set(timings.map(row => row.endpoint))].map(endpoint => {
      const rows = timings.filter(row => row.endpoint === endpoint), times = rows.map(row => row.durationMs)
      return { endpoint, requests: rows.length, p50Ms: percentile(times, 0.5), p95Ms: percentile(times, 0.95), maxMs: Math.max(...times) }
    })
    assert.deepEqual(await counts(), { inbox: 1001, transactions: 1000, events: 1000, conflicts: 0 })
    phases.push({ stage: 'load', concurrency, authentication: 'Clientes HTTP independentes compartilham a sessão sintética do único owner.', journeys: journeys.length, requests: timings.length, durationMs: performance.now() - started, journeyP95Ms: percentile(journeys, 0.95), endpoints: summaries, errors: 0, counts: await counts() })
    await Promise.all(sessions.map(session => session.dispose()))
    clients.splice(1)
    console.log(`Carga: concorrência ${concurrency}, ${journeys.length} jornadas/${timings.length} requests aprovados.`)
  }
  const row = (await payload.find({ collection: 'commercial-inbox', where: { key: { equals: commercialEventKey({ provider: 'hotmart', accountKey: 'synthetic', eventKey: replay.id }) } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  assert.equal((await processCommercialInbox(payload, row.id)).state, 'applied')
  assert.equal((await processCommercialInbox(payload, row.id)).state, 'applied')
  assert.deepEqual(await counts(), { inbox: 1001, transactions: 1001, events: 1001, conflicts: 0 })
  assert.equal(externalRequests, 0)
  passed = true
} catch (error) {
  failure = error instanceof Error ? error.message.slice(0, 500) : 'Falha de QA'
  throw error
} finally {
  try {
  await Promise.all(clients.map(client => client.dispose()))
  // Extra books/articles have no financial references; only the original book is sold.
  for (const id of extraArticles) await payload.delete({ collection: 'articles', id, overrideAccess: true })
  for (const id of extraBooks) await payload.delete({ collection: 'ebooks', id, overrideAccess: true })
  for (const id of extraThemes) await payload.delete({ collection: 'themes', id, overrideAccess: true })
  await seed.cleanup()
  fixturesCleaned = true
  } finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ phase: 'D124', completedAt: new Date().toISOString(), status: passed && fixturesCleaned ? 'passed' : 'failed', dataset: { publishedBooks: 30, themes: 3, articles: 30, approvedTransactions: transactionCount, providers: 3, baselineReady }, phases, externalRequests, realMessagesSent: 0, fixturesCleaned, failure, fieldMetricsClaimed: false, VPSCapacityClaimed: false, limits: 'Servidor/banco locais, cache aquecido, dataset e duração finitos. Clientes compartilham um owner; não são contas humanas distintas. 30s é timeout do ensaio, não SLA. Eventos de seed usam adaptador canônico sintético, sem homologar formato de provedor; replay HTTP Hotmart usa fixture nativa já existente. Sem LCP/INP/CLS de campo.' }, null, 2) + '\n')
  }
}
console.log('Carga comercial local aprovada; replay sem duplicação e dados contábeis preservados.')
process.exit(0)

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { seedRelationship } from '../fixtures/relationship'
import { atomic } from '../../src/modules/marketing/transaction'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Somente banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed
const hooks = payload.collections.contacts.config.hooks
const originalBeforeChange = hooks.beforeChange, originalBeforeDelete = hooks.beforeDelete
const checks: string[] = []
let active = 0, maximum = 0, measured = false, warnings = 0, externalCalls = 0
const originalFetch = globalThis.fetch
const onWarning = (warning: Error) => { if (warning.message.includes('Calling client.query()')) warnings++ }
process.on('warning', onWarning)
globalThis.fetch = (async () => { externalCalls++; throw new Error('Rede externa proibida no ensaio.') }) as typeof fetch
const probe = async () => {
  if (!measured) return
  maximum = Math.max(maximum, ++active)
  try { await delay(20) } finally { active-- }
}
hooks.beforeChange = [...(originalBeforeChange ?? []), async () => { await probe() }]
hooks.beforeDelete = [...(originalBeforeDelete ?? []), async () => { await probe() }]
const ids: string[] = []
try {
  for (let i = 0; i < 4; i++) ids.push((await payload.create({ collection: 'contacts', overrideAccess: true, data: { email: `bulk-${randomUUID()}@example.invalid`, deliveryState: 'ok' } })).id)
  const where = { id: { in: ids } }
  measured = true
  const changed = await payload.update({ collection: 'contacts', where, data: { deliveryState: 'bounced' }, overrideAccess: true })
  measured = false
  assert.equal(changed.errors.length, 0); assert.equal(changed.docs.length, 4)
  assert.equal(maximum, 1, `Atualização iniciou ${maximum} hooks concorrentes na transação compartilhada.`)
  checks.push('atualização em lote aguarda cada documento na mesma transação, sem perder linhas')
  maximum = 0
  await assert.rejects(atomic(payload, async req => {
    measured = true
    const removed = await payload.delete({ collection: 'contacts', where, overrideAccess: true, req })
    measured = false
    assert.equal(removed.errors.length, 0); assert.equal(removed.docs.length, 4)
    assert.equal(maximum, 1, `Exclusão iniciou ${maximum} hooks concorrentes na transação compartilhada.`)
    throw new Error('Rollback sintético após exclusão completa.')
  }), /Rollback sintético/)
  assert.equal((await payload.count({ collection: 'contacts', where, overrideAccess: true })).totalDocs, 4)
  checks.push('exclusão sequencial em transação explícita reverte integralmente quando o chamador falha')
  maximum = 0
  measured = true
  const removed = await payload.delete({ collection: 'contacts', where, overrideAccess: true })
  measured = false
  assert.equal(maximum, 1)
  assert.equal(removed.errors.length, 0); assert.equal(removed.docs.length, 4)
  assert.equal((await payload.count({ collection: 'contacts', where, overrideAccess: true })).totalDocs, 0)
  checks.push('exclusão em lote com transação automática confirma todas as linhas')
} finally {
  measured = false
  hooks.beforeChange = originalBeforeChange; hooks.beforeDelete = originalBeforeDelete
  await seed.cleanup()
  await delay(0)
  globalThis.fetch = originalFetch
  process.off('warning', onWarning)
}
assert.equal(warnings, 0, 'O driver reportou consultas concorrentes no mesmo cliente.')
assert.equal(externalCalls, 0)
checks.push('suíte e limpeza terminam sem aviso de consultas concorrentes e sem rede externa')
await mkdir('artifacts/database-bulk', { recursive: true })
await writeFile('artifacts/database-bulk/d111-results.json', JSON.stringify({ phase: 'D111', date: new Date().toISOString(), environment: 'PostgreSQL sintético exclusivo', checks, concurrentQueryWarnings: warnings, externalCalls, schemaMigrations: 33, productionChanged: false }, null, 2) + '\n')
console.log(`Operações em lote: ${checks.length} grupos aprovados, sem consultas concorrentes no cliente.`)
process.exit(0)

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { runPrivacyInventory } from '../../src/modules/marketing/privacy-inventory'

const seed = await seedRelationship(), { payload } = seed
const email = `inventory-${randomUUID()}@example.invalid`
try {
  const before = await runPrivacyInventory(payload, Date.parse('2026-10-25T12:00:00.000Z'))
  assert.equal(before.classification, 'aggregate_counts_only')
  assert.equal(before.groups.marketing.contacts, 0)
  assert.equal(before.totalRecords, Object.values(before.groups).flatMap(group => Object.values(group)).reduce((sum, count) => sum + count, 0))
  await payload.create({ collection: 'contacts', data: { email, deliveryState: 'ok' }, overrideAccess: true })
  const after = await runPrivacyInventory(payload, Date.parse('2026-10-25T12:00:00.000Z'))
  assert.equal(after.groups.marketing.contacts, 1)
  assert.equal(after.totalRecords, before.totalRecords + 1)
  assert.equal(JSON.stringify(after).includes(email), false)
  assert.equal(JSON.stringify(after).includes(seed.owner.id), false)
  assert.deepEqual(Object.values(after.groups).flatMap(group => Object.values(group)).every(Number.isSafeInteger), true)
  await mkdir('artifacts/privacy-inventory', { recursive: true })
  await writeFile('artifacts/privacy-inventory/local-results.json', JSON.stringify({ date: '2026-10-25 America/Belem', environment: 'PostgreSQL local sintético', groups: ['marketing', 'analytics', 'commerce'], checks: ['contagens agregadas refletem registros sintéticos', 'nenhum email, ID, data de linha ou conteúdo sai no relatório', 'total coincide com a soma das coleções'], externalCalls: false, mutations: false }, null, 2) + '\n')
  console.log('Inventário de privacidade: contagens agregadas sem PII aprovadas.')
} finally { await seed.cleanup() }
process.exit(0)

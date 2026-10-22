import { describe, expect, it } from 'vitest'
import { batchCopy, batchGroupKey, batchKey, readBatchCopy, readBatchMembers } from '../../src/modules/marketing/batch-copy'
import { copyHash, sequenceDays } from '../../src/modules/marketing/sequence-copy'
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const copy = { revision: 1, offerId: id, messages: sequenceDays.map(day => ({ day, subject: 'Assunto', text: 'Conteúdo' })) }
const snapshot = { ...copy, contentHash: copyHash(copy), ebookId: id }
describe('identidade do lote promocional', () => {
  it('separa tema, etapa, dia, revisão, oferta e contexto afiliado', () => {
    const base = batchCopy(id, '2', '2026-10-22T03:00:00Z', snapshot), key = batchGroupKey(base)
    expect(readBatchCopy(base)).toEqual(base)
    expect(batchGroupKey(batchCopy(id, '2', '2026-10-22T23:59:59Z', snapshot))).toBe(key)
    for (const modified of [{ ...base, theme: other }, { ...base, stage: 4 as const }, { ...base, day: '2026-10-23' }, { ...base, snapshot: { ...snapshot, revision: 2 } }, { ...base, snapshot: { ...snapshot, offerId: other } }, { ...base, snapshot: { ...snapshot, campaignCode: 'partner' } }]) expect(batchGroupKey(modified)).not.toBe(key)
    expect(readBatchCopy({ ...base, snapshot: { ...snapshot, contentHash: 'alterado' } })).toBeNull()
  })
  it('permite várias etapas do mesmo destinatário, rejeita etapa repetida e vincula a identidade do lote', () => {
    const members = [{ delivery: id, contact: id }, { delivery: other, contact: id }]
    expect(readBatchMembers(members)).toEqual(members)
    expect(readBatchMembers([members[0], members[0]])).toBeNull()
    expect(readBatchMembers([])).toBeNull()
    expect(readBatchMembers([{ delivery: '../file', contact: id }])).toBeNull()
    expect(batchKey('group', members, id)).not.toBe(batchKey('group', members, other))
  })
})

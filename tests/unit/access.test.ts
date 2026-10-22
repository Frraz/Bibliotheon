import { describe, expect, it } from 'vitest'
import { deny, owner } from '../../src/access/owner'
import type { AccessArgs } from 'payload'
describe('permissões', () => {
  const args = (user: unknown) => ({ req: { user } }) as AccessArgs
  it('nega anônimo, papel desconhecido e outra coleção', () => {
    for (const user of [null, { role: 'viewer', collection: 'admin-users' }, { role: 'owner', collection: 'contacts' }]) expect(owner(args(user))).toBe(false)
  })
  it('aceita apenas owner autenticado da coleção administrativa', () => expect(owner(args({ role: 'owner', collection: 'admin-users' }))).toBe(true))
  it('nega inscrição pública', () => expect(deny(args(null))).toBe(false))
})

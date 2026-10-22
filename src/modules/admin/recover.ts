import type { Payload } from 'payload'
import { parseProvisionInput } from './provision-input'

/** Host operator only; never exposed through a public endpoint or authenticated session. */
export async function recoverAdmin(payload: Payload, input: string) {
  const { email, password } = parseProvisionInput(input)
  const owners = await payload.find({ collection: 'admin-users', limit: 2, depth: 0, overrideAccess: true })
  const owner = owners.docs[0]
  if (owners.totalDocs !== 1 || owner?.role !== 'owner' || owner.email.toLowerCase() !== email) throw new Error('Não foi possível recuperar a conta administrativa informada.')
  // No authenticated user is supplied. Password update revokes every prior session;
  // explicit clears also invalidate old recovery links and reset a lockout.
  await payload.update({ collection: 'admin-users', id: owner.id, overrideAccess: true, data: {
    password, sessions: [], loginAttempts: 0, lockUntil: null,
    resetPasswordToken: null, resetPasswordExpiration: null, resetPasswordRequestedAt: null,
  } })
}

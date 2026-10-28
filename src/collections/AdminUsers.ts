import { APIError, Forbidden, type CollectionConfig } from 'payload'
import { deny, owner } from '../access/owner'

export const AdminUsers: CollectionConfig = {
  slug: 'admin-users',
  labels: { singular: 'Administrador', plural: 'Administradores' },
  auth: {
    tokenExpiration: 7200,
    maxLoginAttempts: 5,
    lockTime: 900000,
    cookies: { secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' },
  },
  admin: { useAsTitle: 'email', group: 'Operação' },
  access: { create: deny, read: owner, update: owner, delete: deny, unlock: deny, admin: ({ req }) => req.user?.role === 'owner' },
  endpoints: [
    { path: '/first-register', method: 'post', handler: () => Response.json({ error: 'Inscrição desabilitada.' }, { status: 403 }) },
    ...['/forgot-password', '/reset-password'].map(path => ({ path, method: 'post' as const, handler: () => Response.json({ errors: [{ message: 'Recuperação por e-mail indisponível. Solicite ao operador a recuperação privada da conta.' }] }, { status: 503, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } }) })),
  ],
  hooks: { beforeChange: [({ operation, req, data }) => {
    if (operation === 'create' && req.context.provisionAdmin !== true) throw new Forbidden()
    if (typeof data.password === 'string' && data.password.length < 5) throw new APIError('Use uma senha de pelo menos 5 caracteres.', 422)
    return data
  }] },
  fields: [{ name: 'role', type: 'select', options: ['owner'], required: true, defaultValue: 'owner', access: { update: () => false } }],
}

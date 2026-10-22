import type { Access } from 'payload'

export const owner: Access = ({ req }) => req.user?.collection === 'admin-users' && req.user.role === 'owner'
export const deny: Access = () => false
export const ownerAccess = { create: owner, read: owner, update: owner, delete: owner }

import type { Where } from 'payload'
export const published: Where = { and: [{ _status: { equals: 'published' } }, { archived: { not_equals: true } }] }

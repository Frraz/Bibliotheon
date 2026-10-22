import type { CollectionConfig } from 'payload'
import { deny, owner } from '../access/owner'
const validPath = (value: unknown) => typeof value === 'string' && /^\/(ebooks|artigos|temas)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use um caminho editorial válido.'
export const Redirects: CollectionConfig = {
  slug: 'redirects', labels: { singular: 'Redirecionamento', plural: 'Redirecionamentos' },
  admin: { useAsTitle: 'fromPath', group: 'Operação' },
  access: { read: owner, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'fromPath', type: 'text', unique: true, required: true, validate: validPath },
    { name: 'toPath', type: 'text', required: true, validate: validPath },
  ],
}

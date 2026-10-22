import type { CollectionConfig } from 'payload'
import { ownerAccess } from '../access/owner'
import { archiveField, publicationGuard, slugField } from './shared'
import { slugHooks } from '../modules/catalog/slugs'
export const Themes: CollectionConfig = {
  slug: 'themes', labels: { singular: 'Tema', plural: 'Temas' }, access: ownerAccess,
  admin: { useAsTitle: 'name', group: 'Conteúdo' }, versions: { drafts: true },
  fields: [ { name: 'name', type: 'text', required: true }, slugField, { name: 'introduction', type: 'textarea' }, archiveField ],
  hooks: { beforeChange: [slugHooks('themes', 'temas').before, publicationGuard(['name', 'introduction'])], afterChange: [slugHooks('themes', 'temas').after] },
}

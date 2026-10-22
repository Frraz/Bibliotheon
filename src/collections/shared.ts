import { APIError, type CollectionBeforeChangeHook, type Field } from 'payload'
import { slugValidation } from '../modules/catalog/validation'
import { fieldLabels } from './presentation'
export const slugField: Field = { name: 'slug', type: 'text', required: true, unique: true, index: true, validate: slugValidation }
export const archiveField: Field = { name: 'archived', label: 'Arquivado', type: 'checkbox', defaultValue: false, index: true }
export const titleField: Field = { name: 'title', label: 'Título', type: 'text', required: true, maxLength: 160 }
export const seoFields: Field = { name: 'seo', type: 'group', fields: [ { name: 'title', type: 'text', maxLength: 160 }, { name: 'description', type: 'textarea', maxLength: 300 } ] }
export const publicationGuard = (fields: string[]): CollectionBeforeChangeHook => ({ data, originalDoc }) => {
  const merged = { ...originalDoc, ...data }
  if (merged._status === 'published' && !merged.archived) {
    for (const field of fields) if (!merged[field]) throw new APIError(`Preencha ${fieldLabels[field] || field} antes de publicar.`, 422)
  }
  return data
}

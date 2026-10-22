export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
export function validSlug(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 160
}
export function slugValidation(value: unknown): true | string { return validSlug(value) || 'Use letras minúsculas sem acentos, números e hífens.' }
export const variants = ['guide', 'reading', 'workbook'] as const
export const accents = ['mineral', 'slate', 'plum'] as const

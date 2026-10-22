import type { Metadata } from 'next'
export const siteOrigin = () => process.env.PUBLIC_SITE_URL || 'http://localhost:3000'
export function pageMetadata(title: string, path: string, description?: string | null, noindex = false): Metadata {
  return { title, description: description || undefined, alternates: { canonical: new URL(path, siteOrigin()).href }, ...(noindex ? { robots: { index: false, follow: true } } : {}) }
}
export type SearchParams = Record<string, string | string[] | undefined>
export function single(value: string | string[] | undefined) { return typeof value === 'string' ? value : '' }
/** Preserve campaign context through editorial renames, including invalid duplicates so they fail closed. */
export function preserveCampaignQuery(target: string, query: SearchParams) {
  if (query.c === undefined) return target
  const params = new URLSearchParams()
  for (const value of Array.isArray(query.c) ? query.c : [query.c]) params.append('c', value)
  return `${target}?${params.toString()}`
}
export function pageNumber(value: string | string[] | undefined) {
  if (value === undefined) return 1
  return typeof value === 'string' && /^[1-9]\d{0,4}$/.test(value) ? Number(value) : null
}

import { createHash } from 'node:crypto'
import { accents, validSlug, variants } from '../catalog/validation'
import { providers } from '../commerce/checkout'

export const CONTRACT = 'bibliotheon-editorial/v1'
export class EditorialError extends Error {
  constructor(public status: number, public code: string, message: string = code) { super(message) }
}
export type Fields = Record<string, unknown>
export interface Manifest {
  contract: typeof CONTRACT; sourceId: string; language: string; edition: string
  associateEbookId?: string
  book: Fields & { title: string; slug: string; theme: string }
  cover: { file: string; sha256: string; alt: string }
  offers: (Fields & { key: string; provider: 'hotmart' | 'kiwify' | 'cakto' })[]
  resolutions?: Record<string, 'package' | 'remote'>
  pending: string[]
}
export const bookFields = ['title', 'slug', 'summary', 'theme', 'audience', 'problem', 'promise', 'body', 'benefits', 'contents', 'requirements', 'limits', 'materialState', 'presentationVariant', 'accentPreset', 'workbookExample', 'faq', 'seo']
export const offerFields = ['name', 'provider', 'accountKey', 'externalProductId', 'externalOfferId', 'checkoutUrl', 'priceCents', 'currency', 'active', 'primary', 'lastVerifiedAt', 'eligibilityNote']
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value ?? null)
}
export const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')
export const fileDigest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new EditorialError(422, 'invalid_package', message) }
function object(v: unknown): v is Fields { return !!v && typeof v === 'object' && !Array.isArray(v) }
function keys(v: Fields, allowed: string[]) { check(Object.keys(v).every(k => allowed.includes(k)), 'Campo desconhecido no pacote.') }
function text(v: unknown, max = 20000): v is string { return typeof v === 'string' && v.trim().length > 0 && v.length <= max }
export function parseManifest(input: unknown): Manifest {
  check(object(input), 'Manifesto precisa ser objeto.')
  keys(input, ['contract', 'sourceId', 'language', 'edition', 'associateEbookId', 'book', 'cover', 'offers', 'resolutions', 'pending'])
  check(input.contract === CONTRACT, 'Versão de contrato incompatível.')
  check(text(input.sourceId, 160) && /^[a-z0-9][a-z0-9._-]*$/.test(input.sourceId), 'sourceId estável inválido.')
  check(text(input.language, 20) && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.language), 'Idioma inválido.')
  check(text(input.edition, 80), 'Informe a edição.')
  if (input.associateEbookId !== undefined) check(typeof input.associateEbookId === 'string' && /^[0-9a-f-]{36}$/.test(input.associateEbookId), 'Associação exige UUID explícito.')
  check(object(input.book), 'Dados do livro ausentes.'); keys(input.book, bookFields)
  const b = input.book
  check(text(b.title, 160) && validSlug(b.slug) && validSlug(b.theme), 'Título, slug e slug do tema são obrigatórios.')
  for (const k of bookFields.filter(k => !['benefits', 'contents', 'faq', 'seo'].includes(k))) if (b[k] !== undefined) check(typeof b[k] === 'string' && (b[k] as string).length <= 40000, `Texto inválido: ${k}`)
  check(b.materialState === 'ready', 'Somente material pronto pode ser publicado pela integração.')
  check(variants.includes(b.presentationVariant as typeof variants[number]) && accents.includes(b.accentPreset as typeof accents[number]), 'Apresentação/acento inválidos.')
  for (const k of ['benefits', 'contents']) if (b[k] !== undefined) check(Array.isArray(b[k]) && (b[k] as unknown[]).length <= 100 && (b[k] as unknown[]).every(v => text(v, 2000)), `Lista inválida: ${k}`)
  if (b.faq !== undefined) { check(Array.isArray(b.faq) && b.faq.length <= 50, 'FAQ inválido.'); for (const f of b.faq) { check(object(f), 'FAQ inválido.'); keys(f, ['question', 'answer']); check(text(f.question, 1000) && text(f.answer, 5000), 'FAQ incompleto.') } }
  if (b.seo !== undefined) { check(object(b.seo), 'SEO inválido.'); keys(b.seo, ['title', 'description']); check(text(b.seo.title, 160) && text(b.seo.description, 300), 'SEO incompleto.') }
  check(object(input.cover), 'Capa ausente.'); keys(input.cover, ['file', 'sha256', 'alt'])
  check(text(input.cover.file, 120) && /^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(input.cover.file), 'Capa deve ser um arquivo de imagem dentro do pacote.')
  check(typeof input.cover.sha256 === 'string' && /^[a-f0-9]{64}$/.test(input.cover.sha256) && text(input.cover.alt, 1000), 'Hash/descrição da capa inválidos.')
  check(Array.isArray(input.offers) && input.offers.length <= 30, 'Ofertas inválidas.')
  const seen = new Set<string>()
  for (const o of input.offers) {
    check(object(o), 'Oferta inválida.'); keys(o, ['key', ...offerFields])
    check(text(o.key, 80) && validSlug(o.key) && !seen.has(o.key), 'Chave de oferta inválida/repetida.'); seen.add(o.key)
    check(providers.includes(o.provider as typeof providers[number]), 'Provedor inválido.')
    for (const k of ['name', 'accountKey', 'externalProductId']) check(text(o[k], 500), `Oferta sem ${k}.`)
    for (const k of ['externalOfferId', 'checkoutUrl', 'eligibilityNote', 'lastVerifiedAt']) if (o[k] !== undefined) check(typeof o[k] === 'string' && (o[k] as string).length <= 4096, `Oferta: ${k} inválido.`)
    check(o.currency === 'BRL' && typeof o.active === 'boolean' && typeof o.primary === 'boolean', 'Moeda/ativação da oferta inválida.')
    if (o.priceCents !== undefined) check(Number.isSafeInteger(o.priceCents) && Number(o.priceCents) >= 0, 'Preço deve ser inteiro em centavos.')
    if (o.lastVerifiedAt) check(Number.isFinite(Date.parse(String(o.lastVerifiedAt))) && Date.parse(String(o.lastVerifiedAt)) <= Date.now(), 'Data de verificação inválida/futura.')
  }
  check(Array.isArray(input.pending) && input.pending.length <= 100 && input.pending.every(v => text(v, 2000)), 'Pendências precisam ser uma lista.')
  if (input.resolutions !== undefined) { check(object(input.resolutions), 'Resoluções inválidas.'); for (const [k, v] of Object.entries(input.resolutions)) check(/^(book|cover|offers)\./.test(k) && ['remote', 'package'].includes(String(v)), 'Resolução inválida.') }
  check(Buffer.byteLength(JSON.stringify(input)) <= 256 * 1024, 'Manifesto maior que 256 KiB.')
  return input as unknown as Manifest
}
export function mergeFields(base: Fields | null, remote: Fields, incoming: Fields, prefix: string, resolutions: Manifest['resolutions'] = {}) {
  const value: Fields = { ...remote }, conflicts: string[] = [], changes: { field: string; before: unknown; after: unknown; action: string }[] = []
  for (const [key, next] of Object.entries(incoming)) {
    const field = `${prefix}.${key}`, current = remote[key] ?? null, previous = base?.[key] ?? null
    const same = (a: unknown, b: unknown) => canonical(a) === canonical(b)
    let action = 'package'
    if (same(current, next)) action = 'unchanged'
    else if (base && !same(current, previous)) {
      if (same(next, previous)) action = 'preserved'
      else if (resolutions[field]) action = resolutions[field] === 'remote' ? 'preserved' : 'package'
      else { action = 'conflict'; conflicts.push(field) }
    } else if (!base && Object.keys(remote).length && !same(current, next)) {
      if (resolutions[field]) action = resolutions[field] === 'remote' ? 'preserved' : 'package'
      else { action = 'conflict'; conflicts.push(field) }
    }
    if (action === 'package' || action === 'unchanged') value[key] = next
    if (action !== 'unchanged') changes.push({ field, before: current, after: next, action })
  }
  return { value, conflicts, changes }
}

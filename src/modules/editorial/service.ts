import { createHmac, timingSafeEqual } from 'node:crypto'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { atomic, serial } from '../marketing/transaction'
import { lockCommercialAccounts, lockCommercialProducts, lockEbooks } from '../commerce/lock'
import { allowedCheckoutHosts, validCheckout, validCents } from '../commerce/checkout'
import { MEDIA_FILES_LOCK } from '../catalog/media-files'
import { CONTRACT, EditorialError, bookFields, offerFields, digest, fileDigest, mergeFields, type Fields, type Manifest } from './contract'

type Actor = NonNullable<PayloadRequest['user']>
type Link = { source_key: string; ebook_id: string; base: Fields; offers: Record<string, { id: string; base: Fields }>; cover_hash: string; cover_id: string }
async function db(req: PayloadRequest) {
  const id = await req.transactionID
  const session = id && (req.payload.db as unknown as Pick<PostgresAdapter, 'sessions'>).sessions[id]?.db
  if (!session) throw new EditorialError(503, 'transaction_unavailable')
  return session
}
const sourceKey = (m: Manifest) => `${m.sourceId}:${m.language}`
const pick = (doc: Fields, fields: string[]) => Object.fromEntries(fields.map(k => [k, clean(doc[k] ?? null)]))
function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, val]) => [k, clean(val)]))
  return v
}
function bookData(m: Manifest, theme: string): Fields {
  const b: Fields = { ...m.book, theme }
  for (const k of ['benefits', 'contents']) if (Array.isArray(b[k])) b[k] = (b[k] as string[]).map(text => ({ text }))
  if (typeof b.body === 'string') b.body = { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: b.body.split(/\n\s*\n/).map(text => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] })) } }
  return b
}
export async function validateCover(m: Manifest, bytes: Buffer) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024 || fileDigest(bytes) !== m.cover.sha256) throw new EditorialError(422, 'invalid_cover', 'Capa ausente, maior que 5 MiB ou hash divergente.')
  let metadata
  try { metadata = await sharp(bytes, { limitInputPixels: 25000000 }).metadata(); await sharp(bytes, { limitInputPixels: 25000000 }).rotate().webp({ quality: 85 }).toBuffer() } catch { throw new EditorialError(422, 'invalid_cover', 'Imagem inválida.') }
  const extensions: Record<string, string[]> = { png: ['png'], jpeg: ['jpg', 'jpeg'], webp: ['webp'] }
  if (!extensions[metadata.format || '']?.includes(m.cover.file.split('.').at(-1)!)) throw new EditorialError(422, 'invalid_cover', 'Formato da capa não corresponde à extensão.')
}
async function linkFor(req: PayloadRequest, m: Manifest) {
  const rows = await (await db(req)).execute(sql`SELECT * FROM editorial_links WHERE source_key = ${sourceKey(m)}`)
  return rows.rows[0] as unknown as Link | undefined
}
async function plan(req: PayloadRequest, m: Manifest, lock = false) {
  const p = req.payload, auth = { req, overrideAccess: false as const, depth: 0 }, link = await linkFor(req, m)
  const blockers = [...m.pending], conflicts: string[] = [], changes: unknown[] = []
  if (link && m.associateEbookId && link.ebook_id !== m.associateEbookId) blockers.push('Origem já associada a outro livro.')
  const ebookId = link?.ebook_id || m.associateEbookId
  const current = ebookId ? await p.findByID({ collection: 'ebooks', id: ebookId, draft: true, ...auth }) : null
  const live = ebookId ? await p.findByID({ collection: 'ebooks', id: ebookId, draft: false, ...auth }) : null
  if (current?.archived) blockers.push('Livro arquivado: restaure explicitamente no painel antes de importar.')
  if (ebookId && !link) {
    const used = await (await db(req)).execute(sql`SELECT source_key FROM editorial_links WHERE ebook_id = ${ebookId}::uuid`)
    if (used.rows.length) blockers.push('Livro já associado a outra origem.')
  }
  const themes = await p.find({ collection: 'themes', where: { slug: { equals: m.book.theme } }, limit: 1, draft: false, ...auth })
  const theme = themes.docs[0]
  if (!theme || theme._status !== 'published' || theme.archived) blockers.push(`Publique o tema ${m.book.theme} no painel.`)
  const incoming = bookData(m, theme?.id || ''), remote = current ? pick(current as unknown as Fields, [...bookFields, 'cover']) : {}
  const coverId = `sha256:${m.cover.sha256}`
  if (current) remote.cover = link && current.cover === link.cover_id ? `sha256:${link.cover_hash}` : `media:${current.cover}`
  incoming.cover = coverId
  // Cover alt is reviewed as part of the package; never mutate an existing shared media record.
  const media = current?.cover && typeof current.cover === 'string' ? await p.findByID({ collection: 'media', id: current.cover, ...auth }) : null
  incoming.coverAlt = m.cover.alt
  if (current) remote.coverAlt = media?.alt ?? null
  const merge = mergeFields(link?.base || null, remote, incoming, 'book', m.resolutions)
  conflicts.push(...merge.conflicts); changes.push(...merge.changes)
  for (const k of ['summary', 'theme', 'audience', 'problem', 'promise', 'requirements', 'limits']) if (typeof merge.value[k] !== 'string' || !(merge.value[k] as string).trim()) blockers.push(`Preencha book.${k}.`)
  if (merge.value.presentationVariant === 'workbook' && !merge.value.workbookExample) blockers.push('Workbook exige exercício real.')
  if (merge.value.cover === remote.cover && !media) blockers.push('Escolha uma capa válida antes de publicar.')
  if (merge.value.cover === remote.cover && media && (media.visibility !== 'public' || media.presentationRole !== 'cover' || !media.mimeType?.startsWith('image/'))) blockers.push('A capa preservada precisa ser imagem pública com finalidade capa.')
  const selectedThemeId = String(merge.value.theme || '')
  if (lock && selectedThemeId) await (await db(req)).execute(sql`SELECT id FROM themes WHERE id = ${selectedThemeId}::uuid FOR UPDATE`)
  const selectedTheme = selectedThemeId ? (await p.find({ collection: 'themes', where: { id: { equals: selectedThemeId } }, limit: 1, draft: false, ...auth })).docs[0] : undefined
  if (!selectedTheme || selectedTheme._status !== 'published' || selectedTheme.archived) blockers.push('O tema resultante da revisão precisa estar publicado e não arquivado.')
  const slug = String(merge.value.slug)
  const collision = await p.find({ collection: 'ebooks', where: { slug: { equals: slug } }, limit: 2, draft: true, ...auth })
  if (collision.docs.some(d => d.id !== ebookId)) blockers.push('Slug já cadastrado. Informe associateEbookId explicitamente ou escolha outro slug.')
  if (slug !== current?.slug) {
    const reserved = await p.count({ collection: 'redirects', where: { fromPath: { equals: `/ebooks/${slug}` } }, ...auth })
    if (reserved.totalDocs) blockers.push('Slug reservado por endereço histórico.')
  }
  const allOffers = ebookId ? (await p.find({ collection: 'offers', where: { ebook: { equals: ebookId } }, pagination: false, ...auth })).docs : []
  const offers: { key: string; id?: string; data: Fields; incoming: Fields }[] = []
  for (const offer of m.offers) {
    const mapping = link?.offers[offer.key], existing = mapping ? allOffers.find(o => o.id === mapping.id) : undefined
    if (mapping && !existing) blockers.push(`Oferta vinculada ausente: ${offer.key}.`)
    const next = Object.fromEntries(Object.entries(offer).filter(([k]) => k !== 'key'))
    const merged = mergeFields(mapping?.base || null, existing ? pick(existing as unknown as Fields, offerFields) : {}, next, `offers.${offer.key}`, m.resolutions)
    conflicts.push(...merged.conflicts); changes.push(...merged.changes)
    const d = merged.value
    if (existing && ['provider', 'accountKey', 'externalProductId', 'externalOfferId'].some(k => (existing[k as keyof typeof existing] || '') !== (d[k] || ''))) blockers.push(`Preserve a identidade de ${offer.key}; use nova chave para nova oferta.`)
    if (d.checkoutUrl && !validCheckout(d.checkoutUrl, allowedCheckoutHosts(d.provider as 'hotmart'))) blockers.push(`Checkout não permitido: ${offer.key}.`)
    if (d.active && (!d.checkoutUrl || !validCents(d.priceCents) || !d.lastVerifiedAt || !d.eligibilityNote)) blockers.push(`Oferta ativa incompleta: ${offer.key}.`)
    const identities = await p.find({ collection: 'offers', where: { and: [{ provider: { equals: d.provider } }, { accountKey: { equals: d.accountKey } }, { externalProductId: { equals: d.externalProductId } }] }, pagination: false, ...auth })
    if (identities.docs.some(o => o.id !== existing?.id && (o.ebook !== ebookId || (o.externalOfferId || '') === (d.externalOfferId || '')))) blockers.push(`Identidade comercial já cadastrada: ${offer.key}; associação de ofertas antigas deve ser feita no painel, fora desta importação.`)
    offers.push({ key: offer.key, id: existing?.id, data: d, incoming: next })
  }
  const combined = [...allOffers.filter(o => !offers.some(v => v.id === o.id)), ...offers.map(o => o.data)]
  if (combined.filter(o => o.active && o.primary).length > 1) blockers.push('Somente uma oferta ativa pode ser primária.')
  const identities = offers.map(o => digest([o.data.provider, o.data.accountKey, o.data.externalProductId, o.data.externalOfferId || '']))
  if (new Set(identities).size !== identities.length) blockers.push('Identidade de oferta repetida no pacote.')
  const state = digest({ link, current, live, allOffers: [...allOffers].sort((a, b) => a.id.localeCompare(b.id)), theme, selectedTheme, media, collisions: [...collision.docs].sort((a, b) => a.id.localeCompare(b.id)) })
  return { contract: CONTRACT, sourceKey: sourceKey(m), packageHash: digest(m), state, ebookId, incoming, book: merge.value, offers, blockers, conflicts, changes, link, canPublish: !blockers.length && !conflicts.length }
}
function signature(payload: Payload, data: string) { return createHmac('sha256', payload.secret).update(`editorial-v1:${data}`).digest('base64url') }
function sign(payload: Payload, value: unknown) { const data = Buffer.from(JSON.stringify(value)).toString('base64url'); return `${data}.${signature(payload, data)}` }
function verify(payload: Payload, token: string): { actor: string; hash: string; state: string; expires: number } {
  const [data, sig, extra] = token.split('.'), expected = signature(payload, data || '')
  if (!data || !sig || extra || !/^[A-Za-z0-9_-]+$/.test(data) || !/^[A-Za-z0-9_-]+$/.test(sig) || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new EditorialError(409, 'invalid_preview', 'Prepare uma nova prévia.')
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()) } catch { throw new EditorialError(409, 'invalid_preview') }
}
export async function preview(payload: Payload, actor: Actor, m: Manifest, bytes: Buffer) {
  await validateCover(m, bytes)
  return atomic(payload, async req => {
    req.user = actor
    const result = await plan(req, m)
    const token = sign(payload, { actor: actor.id, hash: result.packageHash, state: result.state, expires: Date.now() + 24 * 60 * 60 * 1000 })
    const { link: _link, incoming: _incoming, ...visible } = result
    void _link; void _incoming
    return { ...visible, token }
  })
}
export async function receipt(payload: Payload, actor: Actor, token: string) {
  verify(payload, token)
  return atomic(payload, async req => {
    const rows = await (await db(req)).execute(sql`SELECT result FROM editorial_operations WHERE id = ${digest(token)} AND actor_id = ${actor.id}::uuid`)
    return rows.rows[0]?.result ?? null
  })
}
export async function publish(payload: Payload, actor: Actor, m: Manifest, bytes: Buffer, token: string) {
  const proof = verify(payload, token)
  if (proof.actor !== actor.id || proof.hash !== digest(m)) throw new EditorialError(409, 'package_changed', 'Pacote/owner diferente da prévia.')
  await validateCover(m, bytes)
  return atomic(payload, async req => {
    req.user = actor
    await serial(req, 'editorial-import')
    const conn = await db(req)
    const prior = await conn.execute(sql`SELECT result FROM editorial_operations WHERE id = ${digest(token)} AND actor_id = ${actor.id}::uuid`)
    if (prior.rows[0]) return prior.rows[0].result
    if (proof.expires < Date.now()) throw new EditorialError(409, 'preview_expired', 'Prévia expirou; prepare novamente.')
    await serial(req, MEDIA_FILES_LOCK)
    const link = await linkFor(req, m), id = link?.ebook_id || m.associateEbookId
    const existingOffers = id ? (await payload.find({ collection: 'offers', where: { ebook: { equals: id } }, pagination: false, depth: 0, req, overrideAccess: false })).docs : []
    await lockCommercialAccounts(req, [...m.offers, ...existingOffers])
    await lockCommercialProducts(req, [...m.offers, ...existingOffers])
    if (id) await lockEbooks(req, [id])
    // Row locks cover concurrent theme/media edits as well as the shared catalogue locks.
    await conn.execute(sql`SELECT id FROM themes WHERE slug = ${m.book.theme} FOR UPDATE`)
    const result = await plan(req, m, true)
    if (result.state !== proof.state) throw new EditorialError(409, 'remote_changed', 'O catálogo mudou. Prepare uma nova prévia.')
    if (!result.canPublish) throw new EditorialError(422, 'publication_blocked', 'Resolva as pendências/conflitos da prévia.')
    const auth = { req, overrideAccess: false as const, depth: 0 }
    const data = { ...result.book }
    let importedCover = link?.cover_id || '', importedHash = link?.cover_hash || ''
    const selected = String(data.cover)
    const selectedId = selected.startsWith('media:') ? selected.slice(6) : selected === `sha256:${link?.cover_hash}` ? link?.cover_id : undefined
    const selectedMedia = selectedId ? await payload.findByID({ collection: 'media', id: selectedId, ...auth }) : null
    if (!selectedId || data.coverAlt !== selectedMedia?.alt) {
      if (selected !== `sha256:${m.cover.sha256}`) throw new EditorialError(422, 'cover_alt_conflict', 'A descrição de uma capa preservada deve ser editada no painel.')
      const ext = m.cover.file.split('.').at(-1), mimetype = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
      const media = await payload.create({ collection: 'media', data: { alt: String(data.coverAlt), visibility: 'public', presentationRole: 'cover' }, file: { name: m.cover.file, data: bytes, size: bytes.length, mimetype }, ...auth })
      data.cover = media.id; importedCover = media.id; importedHash = m.cover.sha256
    } else data.cover = selectedId
    delete data.coverAlt
    const ebook = result.ebookId
      ? await payload.update({ collection: 'ebooks', id: result.ebookId, data: { ...data, _status: 'published' }, ...auth })
      : await payload.create({ collection: 'ebooks', data: { ...data, _status: 'published' } as never, ...auth })
    const mappings = { ...(link?.offers || {}) }
    // Demote primaries first to allow an explicitly reviewed replacement.
    for (const offer of [...result.offers].sort((a, b) => Number(!!a.data.primary) - Number(!!b.data.primary))) {
      const d = { ...offer.data, ebook: ebook.id }
      const saved = offer.id ? await payload.update({ collection: 'offers', id: offer.id, data: d, ...auth }) : await payload.create({ collection: 'offers', data: d as never, ...auth })
      mappings[offer.key] = { id: saved.id, base: { ...mappings[offer.key]?.base, ...offer.incoming } }
    }
    const baseline = { ...link?.base, ...result.incoming, cover: result.incoming.cover }
    await conn.execute(sql`INSERT INTO editorial_links (source_key, ebook_id, base, offers, cover_hash, cover_id) VALUES (${sourceKey(m)}, ${ebook.id}::uuid, ${JSON.stringify(baseline)}::jsonb, ${JSON.stringify(mappings)}::jsonb, ${importedHash}, ${importedCover || null}::uuid) ON CONFLICT (source_key) DO UPDATE SET base = EXCLUDED.base, offers = EXCLUDED.offers, cover_hash = EXCLUDED.cover_hash, cover_id = EXCLUDED.cover_id, updated_at = now()`)
    const receipt = { contract: CONTRACT, operationId: digest(token), sourceKey: sourceKey(m), packageHash: digest(m), ebookId: ebook.id, path: `/ebooks/${ebook.slug}`, edition: m.edition, publishedAt: new Date().toISOString(), offers: Object.fromEntries(Object.entries(mappings).map(([k, v]) => [k, v.id])) }
    await conn.execute(sql`INSERT INTO editorial_operations (id, actor_id, source_key, result) VALUES (${digest(token)}, ${actor.id}::uuid, ${sourceKey(m)}, ${JSON.stringify(receipt)}::jsonb)`)
    return receipt
  })
}

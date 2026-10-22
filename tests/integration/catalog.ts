import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { getPayload } from 'payload'
import config from '../../src/payload.config'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL || '').hostname), 'Teste permitido apenas em banco loopback.')
const payload = await getPayload({ config })
const suffix = randomBytes(6).toString('hex')
assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 0, 'Use banco local sem owner.')
const owner = await payload.create({ collection: 'admin-users', data: { email: `teste-${suffix}@example.invalid`, password: randomBytes(32).toString('hex'), role: 'owner' }, overrideAccess: true, context: { provisionAdmin: true } })
const user = { ...owner, collection: 'admin-users' as const }
const auth = { overrideAccess: false, user }
const cleanup: { collection: 'themes' | 'ebooks' | 'media' | 'offers' | 'lead-magnets'; id: string }[] = []
try {
  await assert.rejects(payload.find({ collection: 'ebooks', user: null, overrideAccess: false }))
  const theme = await payload.create({ collection: 'themes', data: { name: 'Tema sintético', slug: `tema-${suffix}`, introduction: 'Introdução sintética.', _status: 'published' }, ...auth })
  cleanup.unshift({ collection: 'themes', id: theme.id })
  const data = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#162D40' } }).png().toBuffer()
  await assert.rejects(payload.create({ collection: 'media', data: { alt: 'Inválido', visibility: 'public', presentationRole: 'cover' }, file: { name: '../escape.png', data, size: data.length, mimetype: 'image/png' }, ...auth }))
  await assert.rejects(payload.create({ collection: 'media', data: { alt: 'Inválido', visibility: 'public', presentationRole: 'cover' }, file: { name: 'fake.png', data: Buffer.from('<svg></svg>'), size: 11, mimetype: 'image/png' }, ...auth }))
  const cover = await payload.create({ collection: 'media', data: { alt: 'Capa sintética', visibility: 'public', presentationRole: 'cover' }, file: { name: 'capa.png', data, size: data.length, mimetype: 'image/png' }, ...auth })
  cleanup.unshift({ collection: 'media', id: cover.id })
  assert.equal(cover.mimeType, 'image/webp')
  assert.match(cover.filename || '', /^[a-f0-9-]+\.webp$/)
  assert.equal(cover.hash?.length, 64)
  const ebook = await payload.create({ collection: 'ebooks', data: { title: 'Edição sintética', slug: `livro-${suffix}`, materialState: 'production', _status: 'draft' }, draft: true, ...auth })
  cleanup.unshift({ collection: 'ebooks', id: ebook.id })
  await assert.rejects(payload.update({ collection: 'ebooks', id: ebook.id, data: { _status: 'published' }, ...auth }))
  const offerData = { ebook: ebook.id, name: 'Oferta sintética', provider: 'hotmart' as const, accountKey: 'synthetic', externalProductId: 'produto-teste', currency: 'BRL' as const, active: true, primary: true, checkoutUrl: 'https://pay.example.invalid/checkout?affiliate=abc&signature=xyz', priceCents: 9900, lastVerifiedAt: new Date().toISOString(), eligibilityNote: 'Somente teste sintético.' }
  for (const provider of ['HOTMART', 'KIWIFY', 'CAKTO']) process.env[`CHECKOUT_ALLOWED_HOSTS_${provider}`] = 'pay.example.invalid'
  await assert.rejects(payload.create({ collection: 'offers', data: offerData, ...auth }))
  await payload.update({ collection: 'ebooks', id: ebook.id, data: { summary: 'Conteúdo sintético para validação.', theme: theme.id, audience: 'Testes', problem: 'Validar domínio', promise: 'Exercitar invariantes', requirements: 'Nenhum', limits: 'Não é um produto real', cover: cover.id, materialState: 'ready', _status: 'published' }, ...auth })
  await payload.update({ collection: 'ebooks', id: ebook.id, data: { title: 'Nova revisão sintética' }, draft: true, ...auth })
  assert.equal((await payload.findByID({ collection: 'ebooks', id: ebook.id, draft: false, ...auth })).title, 'Edição sintética')
  assert.equal((await payload.findByID({ collection: 'ebooks', id: ebook.id, draft: true, ...auth })).title, 'Nova revisão sintética')
  const concurrent = await Promise.allSettled([payload.create({ collection: 'offers', data: offerData, ...auth }), payload.create({ collection: 'offers', data: { ...offerData, name: 'Concorrente' }, ...auth })])
  for (const result of concurrent) if (result.status === 'fulfilled') cleanup.unshift({ collection: 'offers', id: result.value.id })
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1, 'Índice único bloqueia segunda primária.')
  for (const provider of ['kiwify', 'cakto'] as const) {
    const offer = await payload.create({ collection: 'offers', data: { ...offerData, provider, primary: false }, ...auth })
    cleanup.unshift({ collection: 'offers', id: offer.id })
  }
  await assert.rejects(payload.update({ collection: 'ebooks', id: ebook.id, data: { materialState: 'production' }, ...auth }))
  await assert.rejects(payload.update({ collection: 'ebooks', id: ebook.id, data: { presentationVariant: 'workbook', _status: 'published' }, ...auth }))
  await assert.rejects(payload.update({ collection: 'ebooks', id: ebook.id, data: { accentPreset: 'arbitrary' as 'mineral' }, ...auth }))
  console.log('B02/T02/T17/T25 locais: publicação, drafts, uploads, três provedores, concorrência primária e enums aprovados.')
} finally {
  for (const item of cleanup) await payload.delete({ collection: item.collection, id: item.id, overrideAccess: true })
  await payload.delete({ collection: 'admin-users', id: owner.id, overrideAccess: true })
  await payload.destroy()
}
process.exit(0)

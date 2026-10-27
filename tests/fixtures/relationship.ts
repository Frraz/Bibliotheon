import assert from 'node:assert/strict'
import type { CollectionSlug } from 'payload'
import { seedSite } from './site'
import { samplePDF } from './pdf'

export async function seedRelationship() {
  const seed = await seedSite(), { payload } = seed
  // Never clean shared operational data if the precondition fails.
  try {
    for (const collection of ['contacts', 'subscriptions', 'magnet-requests', 'email-deliveries', 'preference-tokens', 'marketing-suppression-tombstones', 'contact-retirements', 'theme-withdrawals', 'consent-events', 'mail-quota', 'request-limits', 'payload-jobs', 'email-sequences', 'sequence-enrollments', 'brevo-webhook-events', 'brevo-delivery-receipts', 'brevo-campaign-observations', 'brevo-campaign-sends', 'brevo-campaign-drafts', 'brevo-batch-lists', 'promotion-deliveries', 'email-campaign-batches', 'brevo-registrations', 'brevo-suppressions', 'privacy-request-audit'] as const) assert.equal((await payload.count({ collection, overrideAccess: true })).totalDocs, 0, 'Use banco operacional vazio para fixtures de relacionamento.')
  } catch (error) { await seed.cleanup(); throw error }
  const bytes = samplePDF()
  const media = await payload.create({ collection: 'media', ...seed.auth, data: { alt: 'Amostra PDF sintética de validação', presentationRole: 'sample', visibility: 'private' }, file: { data: bytes, size: bytes.length, name: 'sample.pdf', mimetype: 'application/pdf' } })
  const magnet = await payload.create({ collection: 'lead-magnets', ...seed.auth, data: { title: 'Amostra: conhecimento em prática', description: 'Conheça um trecho do material e avalie se ele atende ao que você procura. Edição sintética exclusiva de testes locais.', slug: `amostra-${seed.books[0].slug}`, ebook: seed.books[0].id, media: media.id, version: 'synthetic-v1', active: true } })
  const extraMagnets: string[] = [], extraThemes: string[] = []
  return { ...seed, magnet, extraMagnets, extraThemes, sampleMedia: media, pdf: bytes, async cleanup() {
    for (const collection of ['privacy-request-audit', 'marketing-suppression-tombstones', 'contact-retirements', 'theme-withdrawals', 'brevo-registrations', 'brevo-suppressions', 'brevo-webhook-events', 'brevo-delivery-receipts', 'brevo-campaign-observations', 'brevo-campaign-sends', 'brevo-campaign-drafts', 'brevo-batch-lists', 'promotion-deliveries', 'email-campaign-batches', 'sequence-enrollments', 'email-sequences', 'payload-jobs', 'preference-tokens', 'consent-events', 'email-deliveries', 'subscriptions', 'magnet-requests', 'contacts', 'request-limits', 'mail-quota'] as CollectionSlug[]) await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true })
    for (const id of extraMagnets) await payload.delete({ collection: 'lead-magnets', id, overrideAccess: true })
    await payload.delete({ collection: 'lead-magnets', id: magnet.id, overrideAccess: true })
    await payload.delete({ collection: 'media', id: media.id, overrideAccess: true })
    for (const id of extraThemes) await payload.delete({ collection: 'themes', id, overrideAccess: true })
    await seed.cleanup()
  } }
}

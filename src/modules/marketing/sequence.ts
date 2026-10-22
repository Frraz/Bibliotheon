import type { Payload, PayloadRequest } from 'payload'
import type { MagnetRequest } from '../../payload-types'
import { atomic, serial } from './transaction'
import { availableMagnet } from './service'
import { copyHash, dueAt, enrollmentKey, idOf, sequenceCopy, sequenceDays, readSequenceSnapshot, type SequenceSnapshot } from './sequence-copy'
import { cancelPromotions } from './sequence-state'
import { CheckoutError, resolveCheckout } from '../commerce/resolve'

export { readSequenceSnapshot } from './sequence-copy'
export type { SequenceSnapshot } from './sequence-copy'
/** Caller already holds the contact lock and granted the actual thematic subscription. */
export async function enrollSequence(req: PayloadRequest, request: MagnetRequest, ebookId: string, confirmedAt: string) {
  const { payload } = req, contact = idOf(request.contact), magnet = idOf(request.magnet)
  const key = enrollmentKey(contact, magnet, request.magnetVersion)
  if ((await payload.count({ collection: 'sequence-enrollments', where: { key: { equals: key } }, overrideAccess: true, req })).totalDocs) return
  const templateKey = enrollmentKey('sequence', magnet, request.magnetVersion)
  await serial(req, `sequence:${templateKey}`)
  const template = (await payload.find({ collection: 'email-sequences', where: { and: [{ key: { equals: templateKey } }, { active: { equals: true } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  const copy = template && sequenceCopy(template)
  if (!template || !copy || copyHash(copy) !== template.contentHash) return
  const snapshot: SequenceSnapshot = { ...copy, contentHash: copyHash(copy), ebookId, ...(request.campaignCode ? { campaignCode: request.campaignCode } : {}) }
  const enrollment = await payload.create({ collection: 'sequence-enrollments', data: { key, contact, request: request.id, magnet, theme: idOf(request.theme), sequence: template.id, magnetVersion: request.magnetVersion, confirmedAt, state: 'active', snapshot }, overrideAccess: true, req })
  for (const day of sequenceDays) await payload.create({ collection: 'promotion-deliveries', data: { key: `${key}:${day}`, enrollment: enrollment.id, contact, stage: String(day) as '2' | '4' | '7' | '10', dueAt: dueAt(confirmedAt, day), nextCheckAt: dueAt(confirmedAt, day), state: 'scheduled' }, overrideAccess: true, req })
}

/** Local eligibility only. No campaign creation, quota reservation or outbound transport. */
export async function preparePromotions(payload: Payload, now = Date.now()) {
  const due = await payload.find({ collection: 'promotion-deliveries', where: { and: [{ state: { in: ['scheduled', 'ready'] } }, { nextCheckAt: { less_than_equal: new Date(now).toISOString() } }] }, sort: 'nextCheckAt', limit: 100, depth: 0, overrideAccess: true })
  let ready = 0, canceled = 0, held = 0
  for (const candidate of due.docs) await atomic(payload, async req => {
    await serial(req, `contact:${idOf(candidate.contact)}`)
    const delivery = await payload.findByID({ collection: 'promotion-deliveries', id: candidate.id, depth: 0, overrideAccess: true, req })
    if (!['scheduled', 'ready'].includes(delivery.state) || Date.parse(delivery.nextCheckAt) > now) return
    const enrollment = await payload.findByID({ collection: 'sequence-enrollments', id: idOf(delivery.enrollment), depth: 0, overrideAccess: true, req })
    const fail = async (errorCode: 'recipient_suppressed' | 'material_unavailable' | 'sequence_paused') => {
      await cancelPromotions(req, { id: { equals: enrollment.id } }, now, errorCode)
      // A previously canceled enrollment might have an inconsistent pending stage; fail closed.
      await payload.update({ collection: 'promotion-deliveries', id: delivery.id, data: { state: 'canceled', errorCode }, overrideAccess: true, req })
      canceled++
    }
    const contact = await payload.findByID({ collection: 'contacts', id: idOf(enrollment.contact), depth: 0, overrideAccess: true, req })
    const subscription = (await payload.find({ collection: 'subscriptions', where: { and: [{ contact: { equals: contact.id } }, { theme: { equals: idOf(enrollment.theme) } }, { state: { equals: 'subscribed' } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (enrollment.state !== 'active' || !contact.confirmedAt || contact.globalSuppressedAt || contact.deliveryState !== 'ok' || !subscription) return fail('recipient_suppressed')
    const templateKey = enrollmentKey('sequence', idOf(enrollment.magnet), enrollment.magnetVersion)
    await serial(req, `sequence:${templateKey}`)
    const template = (await payload.find({ collection: 'email-sequences', where: { and: [{ id: { equals: idOf(enrollment.sequence) } }, { active: { equals: true } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (!template) return fail('sequence_paused')
    const request = await payload.findByID({ collection: 'magnet-requests', id: idOf(enrollment.request), depth: 0, overrideAccess: true, req })
    const material = await availableMagnet(payload, idOf(enrollment.magnet), req), snapshot = readSequenceSnapshot(enrollment.snapshot)
    if (!snapshot || !request.confirmedAt || !request.marketingOptIn || request.revokedAt || !material || material.magnet.version !== enrollment.magnetVersion || material.theme.id !== idOf(enrollment.theme) || material.book.id !== snapshot.ebookId) return fail('material_unavailable')
    if (delivery.stage === '7' || delivery.stage === '10') {
      try {
        const offer = await resolveCheckout(snapshot.offerId, snapshot.campaignCode, { payload, req, now })
        if (offer.ebookID !== snapshot.ebookId) throw new CheckoutError(410, 'Oferta não corresponde ao material.')
      }
      catch (error) {
        if (!(error instanceof CheckoutError)) throw error
        await payload.update({ collection: 'promotion-deliveries', id: delivery.id, data: { state: 'scheduled', errorCode: 'offer_unavailable', nextCheckAt: new Date(now + 900_000).toISOString() }, overrideAccess: true, req })
        held++; return
      }
    }
    await payload.update({ collection: 'promotion-deliveries', id: delivery.id, data: { state: 'ready', errorCode: null, nextCheckAt: new Date(now + 900_000).toISOString() }, overrideAccess: true, req })
    ready++
  })
  return { examined: due.docs.length, ready, canceled, held }
}

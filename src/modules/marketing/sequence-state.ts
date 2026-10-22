import type { PayloadRequest, Where } from 'payload'

export async function cancelPromotions(req: PayloadRequest, where: Where, now = Date.now(), reason: 'recipient_suppressed' | 'material_unavailable' | 'sequence_paused' = 'recipient_suppressed') {
  const enrollments = await req.payload.update({ collection: 'sequence-enrollments', where: { and: [where, { state: { equals: 'active' } }] }, data: { state: 'canceled', canceledAt: new Date(now).toISOString() }, overrideAccess: true, req })
  if (enrollments.errors.length) throw new Error('Não foi possível cancelar o calendário.')
  for (let offset = 0; offset < enrollments.docs.length; offset += 250) {
    const ids = enrollments.docs.slice(offset, offset + 250).map(doc => doc.id)
    const deliveries = await req.payload.update({ collection: 'promotion-deliveries', where: { and: [{ enrollment: { in: ids } }, { state: { in: ['scheduled', 'ready'] } }] }, data: { state: 'canceled', errorCode: reason }, overrideAccess: true, req })
    if (deliveries.errors.length) throw new Error('Não foi possível cancelar as etapas.')
  }
}

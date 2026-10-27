import type { Payload } from 'payload'
import { configuredTransport, type MailMessage, type MailTransport } from '../../integrations/brevo/transactional'
import { atomic, serial } from './transaction'
import { availableMagnet } from './service'
import { createOpaqueToken, signDownload, UNSUBSCRIBE_TTL } from './tokens'
import { reserveMailQuota } from './quota'
import { configuredQuotaPolicy } from './quota-policy'
import { privacySubjectBlocked } from './privacy-block'

const relationId = (v: string | { id: string }) => typeof v === 'string' ? v : v.id
const retryDelays = [60_000, 300_000, 1_800_000, 7_200_000]
/** Claim commits BEFORE transport. A crash/uncertain result cannot blindly repeat a send. */
export async function processDelivery(payload: Payload, id: string, options?: { transport: MailTransport; secret: string; origin: string; now?: number; quota?: number }) {
  const now = options?.now ?? Date.now()
  const transport = options?.transport ?? configuredTransport()
  const secret = options?.secret ?? process.env.LEAD_TOKEN_SECRET
  const origin = options?.origin ?? process.env.PUBLIC_SITE_URL
  if (!transport || !secret || Buffer.byteLength(secret) < 32 || !origin) return
  const site = new URL(origin)
  if (site.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(site.hostname)) throw new Error('Origem de e-mail exige HTTPS.')
  const claimed = await atomic(payload, async req => {
    await serial(req, `delivery:${id}`)
    const delivery = await payload.findByID({ collection: 'email-deliveries', id, depth: 0, overrideAccess: true, req })
    if (delivery.state !== 'pending' || Date.parse(delivery.nextAttemptAt) > now) return null
    const contactId = relationId(delivery.contact)
    await serial(req, `contact:${contactId}`)
    const contact = await payload.findByID({ collection: 'contacts', id: contactId, depth: 0, overrideAccess: true, req })
    const request = await payload.findByID({ collection: 'magnet-requests', id: relationId(delivery.request), depth: 0, overrideAccess: true, req })
    const material = await availableMagnet(payload, relationId(request.magnet), req)
    const finish = async (errorCode: 'recipient_suppressed' | 'material_unavailable') => {
      await payload.update({ collection: 'email-deliveries', id, data: { state: 'canceled', errorCode }, overrideAccess: true, req })
      return null
    }
    if (contact.deliveryState !== 'ok' || await privacySubjectBlocked(payload,contact.email,secret,req)) return finish('recipient_suppressed')
    if (!material || material.magnet.version !== request.magnetVersion || request.revokedAt || material.theme.id !== relationId(request.theme)) return finish('material_unavailable')
    if (delivery.kind === 'confirmation' && (request.confirmedAt || Date.parse(request.expiresAt) <= now)) return finish('material_unavailable')
    if (delivery.kind === 'delivery' && !request.confirmedAt) return finish('material_unavailable')
    const quota = await reserveMailQuota(req, { kind: 'transactional', count: 1, now, policy: options?.quota === undefined ? configuredQuotaPolicy() : { limit: options.quota, transactionalReserve: 1 } })
    if (!quota.granted) {
      await payload.update({ collection: 'email-deliveries', id, data: { errorCode: 'quota', nextAttemptAt: quota.nextDayAt }, overrideAccess: true, req })
      return null
    }
    let message: MailMessage
    if (delivery.kind === 'confirmation') {
      const { token, hash } = createOpaqueToken()
      await payload.update({ collection: 'magnet-requests', id: request.id, data: { confirmationTokenHash: hash }, overrideAccess: true, req })
      message = { to: contact.email, subject: 'Confirme sua solicitação de amostra · Bibliotheon', text: `Você solicitou a amostra “${material.magnet.title}”.\n\nPara confirmar e acessar o material, abra o link e use o botão de confirmação:\n${site.origin}/amostras/confirmar?t=${token}\n\nEste link expira em 24 horas contadas da solicitação. Se não fez o pedido, ignore esta mensagem. O acesso à amostra não exige assinatura de marketing.` }
    } else {
      const download = `${site.origin}/api/v1/downloads/${signDownload(request.id, secret, now)}`
      let preference = ''
      if (request.marketingOptIn) {
        const { token, hash } = createOpaqueToken()
        await payload.create({ collection: 'preference-tokens', data: { contact: contactId, tokenHash: hash, expiresAt: new Date(now + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true, req })
        preference = `\n\nPreferências de e-mail e cancelamento de marketing:\n${site.origin}/preferencias?t=${token}`
      }
      message = { to: contact.email, subject: 'Sua amostra está disponível · Bibliotheon', text: `Sua amostra “${material.magnet.title}” está disponível:\n${download}\n\nO link de download vale por 24 horas. Para renovar, solicite a amostra novamente.${preference}` }
    }
    await payload.update({ collection: 'email-deliveries', id, data: { state: 'sending', startedAt: new Date(now).toISOString(), attempts: delivery.attempts + 1, errorCode: null }, overrideAccess: true, req })
    return { message, requestId: request.id, kind: delivery.kind }
  })
  if (!claimed) return
  let result: Awaited<ReturnType<MailTransport>>
  try { result = await transport(claimed.message) } catch { result = { state: 'uncertain' } }
  await atomic(payload, async req => {
    await serial(req, `delivery:${id}`)
    const delivery = await payload.findByID({ collection: 'email-deliveries', id, depth: 0, overrideAccess: true, req })
    if (delivery.state !== 'sending') return
    if (result.state === 'sent') {
      await payload.update({ collection: 'email-deliveries', id, data: { state: 'sent', sentAt: new Date(now).toISOString(), providerMessageId: result.messageId }, overrideAccess: true, req })
      if (claimed.kind === 'delivery') await payload.update({ collection: 'magnet-requests', id: claimed.requestId, data: { deliveredAt: new Date(now).toISOString() }, overrideAccess: true, req })
    } else if (result.state === 'retry' && delivery.attempts < 5) {
      await payload.update({ collection: 'email-deliveries', id, data: { state: 'pending', errorCode: 'provider_rejected', nextAttemptAt: new Date(now + retryDelays[delivery.attempts - 1]).toISOString() }, overrideAccess: true, req })
    } else {
      await payload.update({ collection: 'email-deliveries', id, data: { state: result.state === 'uncertain' ? 'uncertain' : 'failed', errorCode: result.state === 'uncertain' ? 'uncertain_delivery' : delivery.attempts >= 5 ? 'attempts_exhausted' : 'provider_rejected' }, overrideAccess: true, req })
    }
  })
}

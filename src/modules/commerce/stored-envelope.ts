import type { Payload, PayloadRequest } from 'payload'
import { commercialEventDigest, restoreStoredCommercialReceipt } from './events'

type InboxSource = {
  id: string
  key: string
  provider: 'hotmart' | 'kiwify' | 'cakto'
  accountKey: string
  adapterVersion: string
  envelopeHash: string
  envelope?: unknown | null
}

/** Rebuilds an expired inbox envelope from its retained normalized transaction fact. */
export async function storedCommercialEnvelope(payload: Payload, row: InboxSource, req?: PayloadRequest) {
  if (row.envelope) return row.envelope

  const facts = await payload.find({
    collection: 'transaction-events',
    where: { inbox: { equals: row.id } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
    ...(req ? { req } : {}),
    select: { key: true, envelope: true },
  })
  if (facts.docs.length !== 1) return null
  const [fact] = facts.docs
  if (fact.key !== row.key || !fact.envelope) return null
  const restored = restoreStoredCommercialReceipt(fact.envelope, { provider: row.provider, accountKey: row.accountKey }, row.adapterVersion)
  if (restored.state !== 'prepared' || restored.key !== row.key || restored.digest !== row.envelopeHash || commercialEventDigest(restored.event) !== row.envelopeHash) return null
  return fact.envelope
}

import type { Payload, PayloadRequest } from 'payload'
import { contactFingerprint } from './contact'
import { validLinkSecret } from './tokens'

/** Pending requests keep their data but cannot authorize new capture or outbound work. */
export async function privacySubjectBlocked(payload: Payload, email: string, secret: string|undefined, req?: PayloadRequest) {
  if (!validLinkSecret(secret)) throw new Error('Conferência de privacidade indisponível.')
  const result = await payload.count({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: contactFingerprint(email,secret) } }, { action: { in: ['delete','correct'] } }, { outcome: { in: ['pending','completed'] } }] }, overrideAccess: true, ...(req ? {req} : {}) })
  return result.totalDocs > 0
}

import { legacyThemeWithdrawalProof } from './legacy-theme-withdrawal'
import { replayThemeWithdrawal, storeThemeWithdrawal, hasNewerThemeConsent } from './theme-withdrawal'
import { hasPurposeAfterRetirement, replayContactRetirement, storeContactRetirement } from './privacy-identity-retention'
import type { Payload } from 'payload'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { atomic, serial } from './transaction'
import { contactFingerprint } from './contact'
import { suppressionFingerprint } from './suppression-tombstone'
import { deleteContactData } from './privacy-delete'
import { calendarMonths, PRIVACY_MANIFEST_ENTRIES, signPrivacyRecoveryManifest, verifyPrivacyRecoveryManifest, type PrivacyRecoveryEntry } from './privacy-recovery-manifest'

const inactiveFlags = ['LEADS_ENABLED','EMAIL_TRANSPORT_ENABLED','BREVO_CONTACT_SYNC_ENABLED','BREVO_CONTACT_REGISTRATION_ENABLED','BREVO_LIST_SYNC_ENABLED','BREVO_PREFERENCE_SYNC_ENABLED','BREVO_CAMPAIGN_SYNC_ENABLED','BREVO_CAMPAIGN_SEND_ENABLED','BREVO_CAMPAIGN_OBSERVE_ENABLED','BREVO_WEBHOOK_ENABLED','ANALYTICS_ENABLED','COMMERCIAL_EVENTS_ENABLED','DATA_RETENTION_ENABLED','HOTMART_WEBHOOK_ENABLED','KIWIFY_WEBHOOK_ENABLED','CAKTO_WEBHOOK_ENABLED','WORKER_ENABLED']
export function assertPrivacyRecoveryIsolation(isolated: boolean, env: Readonly<Record<string,string|undefined>> = process.env) {
  if (!isolated || inactiveFlags.some(flag => env[flag] !== undefined && env[flag] !== '' && env[flag] !== 'false')) throw new Error('Recuperação exige isolamento e flags de operação desligadas.')
}
export async function exportPrivacyRecoveryManifest(payload: Payload, secret: string, now = Date.now()) {
  return atomic(payload, async req => {
    const transactionID = await req.transactionID
    if (!transactionID) throw new Error('Transação de recuperação indisponível.')
    const db = (payload.db as unknown as PostgresAdapter).sessions[transactionID].db
    await db.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`)
    const generatedAt = new Date(now).toISOString()
    const audits = await payload.find({ collection: 'privacy-request-audit', where: { and: [{ action: { in: ['delete','correct'] } }, { or: [{ outcome: { equals: 'pending' } }, { and: [{ outcome: { equals: 'completed' } }, { occurredAt: { greater_than: calendarMonths(generatedAt,-24) } }] }] }] }, limit: PRIVACY_MANIFEST_ENTRIES+1, depth: 0, overrideAccess: true, req })
    const suppressions = await payload.find({ collection: 'marketing-suppression-tombstones', where: { expiresAt: { greater_than: generatedAt } }, limit: PRIVACY_MANIFEST_ENTRIES+1, depth: 0, overrideAccess: true, req })
    if (audits.totalDocs > PRIVACY_MANIFEST_ENTRIES || suppressions.totalDocs > PRIVACY_MANIFEST_ENTRIES) throw new Error('Manifesto excede o limite de recuperação.')
    const retirements = await payload.find({collection:'contact-retirements',where:{expiresAt:{greater_than:generatedAt}},limit:PRIVACY_MANIFEST_ENTRIES+1,depth:0,overrideAccess:true,req})
    if(retirements.totalDocs>PRIVACY_MANIFEST_ENTRIES)throw new Error('Manifesto excede o limite de recuperação.')
    const withdrawals = await payload.find({ collection: 'theme-withdrawals', where: { expiresAt: { greater_than: generatedAt } }, limit: PRIVACY_MANIFEST_ENTRIES+1, depth: 0, overrideAccess: true, req })
    if (withdrawals.totalDocs > PRIVACY_MANIFEST_ENTRIES) throw new Error('Manifesto excede o limite de recuperação.')
    const byKey = new Map<string, PrivacyRecoveryEntry>()
    for (const row of withdrawals.docs) byKey.set(`theme-unsubscribe:${row.subjectFingerprint}:${row.themeId}`, { kind: 'theme-unsubscribe', fingerprint: row.subjectFingerprint, theme: row.themeId, occurredAt: row.withdrawnAt, expiresAt: row.expiresAt, deliveryState: null, outcome: 'completed' })
    for (const row of audits.docs) {
      const entry: PrivacyRecoveryEntry = { kind: row.action as 'delete'|'correct', fingerprint: row.subjectFingerprint, occurredAt: row.occurredAt, expiresAt: row.outcome === 'pending' ? null : calendarMonths(row.occurredAt,24), deliveryState: null, outcome: row.outcome as 'pending'|'completed' }
      const key = `${entry.kind}:${entry.fingerprint}`, previous = byKey.get(key)
      if (!previous || entry.outcome === 'pending' && (previous.outcome !== 'pending' || previous.occurredAt! < entry.occurredAt!) || previous.outcome === 'completed' && entry.outcome === 'completed' && previous.expiresAt! < entry.expiresAt!) byKey.set(key,entry)
    }
    for(const row of retirements.docs)byKey.set(`retention:${row.subjectFingerprint}`,{kind:'retention',fingerprint:row.subjectFingerprint,occurredAt:row.retiredAt,expiresAt:row.expiresAt,deliveryState:null,outcome:'completed'})
    const contacts = await payload.find({ collection: 'contacts', limit: PRIVACY_MANIFEST_ENTRIES+1, depth: 0, overrideAccess: true, req, select: { email: true, deliveryState: true, createdAt: true } })
    if (contacts.totalDocs > PRIVACY_MANIFEST_ENTRIES) throw new Error('Inventário de contatos excede o limite de recuperação.')
    const deliveryStates = new Map(contacts.docs.map(contact => [suppressionFingerprint(contact.email,secret),contact.deliveryState]))
    for (const row of suppressions.docs) byKey.set(`suppression:${row.fingerprint}`, { kind: 'suppression', fingerprint: row.fingerprint, occurredAt: null, expiresAt: row.expiresAt, deliveryState: deliveryStates.get(row.fingerprint) ?? 'unknown', outcome: 'completed' })
    const subscriptions = await payload.find({ collection:'subscriptions', where:{state:{equals:'unsubscribed'}}, limit:PRIVACY_MANIFEST_ENTRIES+1, depth:0, overrideAccess:true, req })
    if(subscriptions.totalDocs>PRIVACY_MANIFEST_ENTRIES)throw new Error('Inventário temático excede o limite de recuperação.')
    const byId = new Map(contacts.docs.map(contact=>[contact.id,contact]))
    for(const sub of subscriptions.docs){
      const contactId=typeof sub.contact==='string'?sub.contact:sub.contact.id
      const theme=typeof sub.theme==='string'?sub.theme:sub.theme.id
      const contact=byId.get(contactId)
      if(!contact)throw new Error('Identidade temática não verificável no snapshot de exportação.')
      const fingerprint=contactFingerprint(contact.email,secret), key=`theme-unsubscribe:${fingerprint}:${theme}`, existing=byKey.get(key)
      if(existing?.occurredAt&&sub.unsubscribedAt&&existing.occurredAt>=sub.unsubscribedAt&&!await hasNewerThemeConsent(req,contactId,theme,existing.occurredAt))continue
      const proof=await legacyThemeWithdrawalProof(req,sub,now)
      if(proof.state==='verified')byKey.set(key,{kind:'theme-unsubscribe',fingerprint,theme,occurredAt:proof.withdrawnAt,expiresAt:proof.expiresAt,deliveryState:null,outcome:'completed'})
      else if(proof.state!=='expired') {
        const retirement=byKey.get(`retention:${fingerprint}`)
        const retirementCovers=retirement?.occurredAt&&!await hasPurposeAfterRetirement(req,contact,retirement.occurredAt)
        if(!byKey.has(`delete:${fingerprint}`)&&!byKey.has(`correct:${fingerprint}`)&&!retirementCovers&&!byKey.has(`suppression:${suppressionFingerprint(contact.email,secret)}`))throw new Error('Descadastro temático sem prova verificável impede exportação completa; concilie o histórico.')
      }
    }
    return signPrivacyRecoveryManifest([...byKey.values()],secret,now)
  })
}

async function quarantineContact(payload: Payload, id: string, entry: PrivacyRecoveryEntry, generatedAt: string, secret: string) {
  return atomic(payload, async req => {
    await serial(req, entry.fingerprint)
    await serial(req, `contact:${id}`)
    const contact = await payload.findByID({ collection: 'contacts', id, depth: 0, overrideAccess: true, req, disableErrors: true })
    if (!contact || (entry.kind === 'suppression' ? suppressionFingerprint(contact.email,secret) : contactFingerprint(contact.email,secret)) !== entry.fingerprint) return null
    if(entry.kind==='retention' && await hasPurposeAfterRetirement(req,contact,entry.occurredAt!))return {email:contact.email,newerPurpose:true}
    if (!contact.globalSuppressedAt) await payload.update({ collection: 'contacts', id, data: { globalSuppressedAt: generatedAt }, overrideAccess: true, req })
    if (entry.kind === 'suppression' && ['bounced','complaint'].includes(entry.deliveryState ?? '')) {
      const deliveryState = contact.deliveryState === 'complaint' || entry.deliveryState === 'complaint' ? 'complaint' : 'bounced'
      if (contact.deliveryState !== deliveryState) await payload.update({ collection: 'contacts', id, data: { deliveryState }, overrideAccess: true, req })
    }
    const update = async (collection: 'subscriptions'|'sequence-enrollments'|'promotion-deliveries'|'email-deliveries', where: import('payload').Where, data: object) => {
      const result = await payload.update({ collection, where, data: data as never, overrideAccess: true, req })
      if (result.errors.length) throw new Error('Não foi possível bloquear dados restaurados.')
    }
    await update('subscriptions', { and: [{ contact: { equals: id } }, { state: { not_equals: 'unsubscribed' } }] }, { state: 'unsubscribed', unsubscribedAt: generatedAt })
    await update('sequence-enrollments', { and: [{ contact: { equals: id } }, { state: { equals: 'active' } }] }, { state: 'canceled', canceledAt: generatedAt })
    await update('promotion-deliveries', { and: [{ contact: { equals: id } }, { state: { in: ['scheduled','ready','rejected'] } }] }, { state: 'canceled', errorCode: 'recipient_suppressed' })
    const tokens = await payload.find({ collection: 'preference-tokens', where: { contact: { equals: id } }, pagination: false, depth: 0, overrideAccess: true, req })
    for (const token of tokens.docs) await payload.delete({ collection: 'preference-tokens', id: token.id, overrideAccess: true, req })
    const registration = (await payload.find({ collection: 'brevo-registrations', where: { contact: { equals: id } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (registration?.state === 'pending' && registration.attempts === 0) await payload.update({ collection: 'brevo-registrations', id: registration.id, data: { state: 'canceled', errorCode: 'local_ineligible' }, overrideAccess: true, req })
    if (entry.kind !== 'suppression') {
      const requests = await payload.find({ collection: 'magnet-requests', where: { contact: { equals: id } }, pagination: false, depth: 0, overrideAccess: true, req })
      for (const request of requests.docs) if (!request.revokedAt || request.confirmationTokenHash) await payload.update({ collection: 'magnet-requests', id: request.id, data: { revokedAt: request.revokedAt || generatedAt, confirmationTokenHash: null }, overrideAccess: true, req })
    }
    if (entry.kind !== 'suppression' || entry.deliveryState !== 'ok' || contact.deliveryState !== 'ok') await update('email-deliveries', { and: [{ contact: { equals: id } }, { state: { equals: 'pending' } }] }, { state: 'canceled', errorCode: 'recipient_suppressed' })
    return { email: contact.email, newerPurpose:false }
  })
}

/** Latest signed decisions must be kept outside the snapshot being restored. No provider calls. */
export async function replayPrivacyRecoveryManifest(payload: Payload, input: string, options: { secret: string; snapshotAt: string; ownerId: string; isolated: boolean; apply?: boolean; now?: number }) {
  assertPrivacyRecoveryIsolation(options.isolated)
  const now = options.now ?? Date.now()
  const manifest = verifyPrivacyRecoveryManifest(input,options.secret,options.snapshotAt,now)
  const owner = await payload.findByID({ collection: 'admin-users', id: options.ownerId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!owner || owner.role !== 'owner') throw new Error('Owner de recuperação indisponível.')
  // Refuse a running/newer consent history rather than applying an obsolete decision set.
  if ((await payload.count({ collection: 'consent-events', where: { and: [{ action: { in: ['requested','confirmed','subscribed'] } }, { occurredAt: { greater_than: manifest.generatedAt } }] }, overrideAccess: true })).totalDocs) throw new Error('Há finalidades posteriores ao manifesto; exporte um manifesto atual.')
  const entries = manifest.entries.filter(entry => entry.outcome === 'pending' || entry.expiresAt! > new Date(now).toISOString())
  const retirements = new Map<string, PrivacyRecoveryEntry>(), privacy = new Map<string, PrivacyRecoveryEntry>(), suppression = new Map<string, PrivacyRecoveryEntry>()
  const thematic = new Map<string, PrivacyRecoveryEntry[]>()
  for (const entry of entries) {
    if (entry.kind === 'theme-unsubscribe') { thematic.set(entry.fingerprint, [...(thematic.get(entry.fingerprint) ?? []), entry]); continue }
    const target = entry.kind === 'suppression' ? suppression : entry.kind === 'retention' ? retirements : privacy, previous = target.get(entry.fingerprint)
    if (!previous || previous.outcome !== 'pending' || entry.outcome === 'pending') target.set(entry.fingerprint,entry)
  }
  const report = { mode: options.apply ? 'applied' : 'preview', manifestVersion: manifest.version, pendingCoverage: manifest.version >= 2, thematicCoverage: manifest.version >= 4, withdrawnThemes: 0, themePendingWithdrawals: 0, protectedNewerThemeConsents: 0, importedThemeWithdrawals: 0, entries: entries.length, pendingDecisions: entries.filter(entry => entry.outcome === 'pending').length, expiredEntries: manifest.entries.length-entries.length, matchedContacts: 0, processedContacts: 0, deletedContacts: 0, retiredContacts: 0, retirementPendingContacts: 0, protectedNewerPurposes: 0, quarantinedContacts: 0, pendingContacts: 0, importedDecisions: 0, importedSuppressions: 0, outboundCalls: 0, providerReconciliationPerformed: false, releaseAuthorized: false }
  const contacts = await payload.find({ collection: 'contacts', limit: PRIVACY_MANIFEST_ENTRIES+1, depth: 0, overrideAccess: true, select: { email: true } })
  if (contacts.totalDocs > PRIVACY_MANIFEST_ENTRIES) throw new Error('Inventário de contatos excede o limite de recuperação.')
  for (const contact of contacts.docs) {
    const entry = privacy.get(contactFingerprint(contact.email,options.secret)) ?? retirements.get(contactFingerprint(contact.email,options.secret)) ?? suppression.get(suppressionFingerprint(contact.email,options.secret))
    const themes = thematic.get(contactFingerprint(contact.email, options.secret)) ?? []
    if (!entry && !themes.length) continue
    report.matchedContacts++
    if (options.apply) {
      let thematicPending = false
      for (const withdrawal of themes) {
        const outcome = await replayThemeWithdrawal(payload, contact.id, withdrawal.fingerprint, withdrawal.theme!, withdrawal.occurredAt!, options.secret)
        if (outcome === 'withdrawn' || outcome === 'pending') report.withdrawnThemes++
        if (outcome === 'pending') { report.themePendingWithdrawals++; thematicPending = true }
        else if (outcome === 'newer') report.protectedNewerThemeConsents++
      }
      if (!entry) { report.processedContacts++; if (thematicPending) report.pendingContacts++ }
    }
    if (!entry) continue
    if (!options.apply) continue
    const quarantined = await quarantineContact(payload,contact.id,entry,manifest.generatedAt,options.secret)
    if (!quarantined) continue
    if(quarantined.newerPurpose) {
      report.protectedNewerPurposes++
      const block=suppression.get(suppressionFingerprint(contact.email,options.secret))
      if(block && await quarantineContact(payload,contact.id,block,manifest.generatedAt,options.secret)){report.processedContacts++;report.quarantinedContacts++;if(block.deliveryState==='unknown')report.pendingContacts++}
      continue
    }
    report.processedContacts++
    if(entry.kind==='retention') {
      const outcome=await replayContactRetirement(payload,contact.id,entry.fingerprint,entry.occurredAt!,options.secret)
      if(outcome==='removed'){report.retiredContacts++;report.deletedContacts++}
      else if(outcome==='newer')report.protectedNewerPurposes++
      else if(outcome==='held'){report.quarantinedContacts++;report.pendingContacts++;report.retirementPendingContacts++}
      continue
    }
    if (entry.kind === 'suppression') { report.quarantinedContacts++; if (entry.deliveryState === 'unknown') report.pendingContacts++; continue }
    if (entry.outcome === 'pending') { report.quarantinedContacts++; report.pendingContacts++; continue }
    const deleted = await deleteContactData(payload,quarantined.email,options.ownerId,options.secret,entry.occurredAt ? Date.parse(entry.occurredAt) : now)
    if (deleted.outcome === 'completed') report.deletedContacts++
    else { report.quarantinedContacts++; report.pendingContacts++ }
  }
  if (options.apply) for (const entry of entries) await atomic(payload, async req => {
    if (entry.kind === 'suppression') {
      if (!entry.expiresAt) throw new Error('Prazo de supressão inválido.')
      await serial(req,`marketing-suppression:${entry.fingerprint}`)
      const existing = (await payload.find({ collection: 'marketing-suppression-tombstones', where: { fingerprint: { equals: entry.fingerprint } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
      if (!existing) { await payload.create({ collection: 'marketing-suppression-tombstones', data: { fingerprint: entry.fingerprint, expiresAt: entry.expiresAt }, overrideAccess: true, req }); report.importedSuppressions++ }
      else if (existing.expiresAt < entry.expiresAt) { await payload.update({ collection: 'marketing-suppression-tombstones', id: existing.id, data: { expiresAt: entry.expiresAt }, overrideAccess: true, req }); report.importedSuppressions++ }
    } else if (entry.kind === 'theme-unsubscribe') {
      if (await storeThemeWithdrawal(req, entry.fingerprint, entry.theme!, entry.occurredAt!)) report.importedThemeWithdrawals++
    } else if(entry.kind==='retention') {
      await serial(req,entry.fingerprint)
      await storeContactRetirement(req,entry.fingerprint,entry.occurredAt!)
    } else {
      await serial(req,entry.fingerprint)
      const existing = await payload.count({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: entry.fingerprint } }, { action: { equals: entry.kind } }, { outcome: { equals: entry.outcome } }, ...(entry.outcome === 'completed' ? [{ occurredAt: { equals: entry.occurredAt } }] : [])] }, overrideAccess: true, req })
      if (!existing.totalDocs) { await payload.create({ collection: 'privacy-request-audit', data: { subjectFingerprint: entry.fingerprint, action: entry.kind, outcome: entry.outcome, counts: {}, actor: options.ownerId, occurredAt: entry.occurredAt! }, overrideAccess: true, req }); report.importedDecisions++ }
    }
  })
  return report
}

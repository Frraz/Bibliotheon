import { createHash } from 'node:crypto'
import { readBatchCopy } from './batch-copy'
import { preferenceOrigin } from './preference-links'
import { PREFERENCE_PLACEHOLDER } from '../../integrations/brevo/preferences'

export type DraftSpec = { name: string; senderId: number; listId: number; subject: string; htmlContent: string }
const escape = (value: string) => value.replace(/[&<>"'{}]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;' })[char]!)
export const draftHash = (spec: DraftSpec) => createHash('sha256').update(JSON.stringify([spec.name,spec.senderId,spec.listId,spec.subject,spec.htmlContent])).digest('hex')
export function readDraftSpec(value: unknown): DraftSpec | null {
  if (!value || typeof value !== 'object') return null
  const data = value as DraftSpec
  if (typeof data.name !== 'string' || !/^bibliotheon-[a-f0-9-]{36}$/.test(data.name) || !Number.isSafeInteger(data.senderId) || data.senderId < 1 || !Number.isSafeInteger(data.listId) || data.listId < 1 || typeof data.subject !== 'string' || !data.subject.trim() || data.subject.length > 160 || /[\x00-\x1f\x7f]|\{[{%#]/.test(data.subject) || typeof data.htmlContent !== 'string' || Buffer.byteLength(data.htmlContent)>65_536 || data.htmlContent.length < 10) return null
  return { name:data.name,senderId:data.senderId,listId:data.listId,subject:data.subject,htmlContent:data.htmlContent }
}
export function campaignCopy(batchId: string, value: unknown, origin: string, senderId: number, listId: number): DraftSpec {
  const copy = readBatchCopy(value)
  if (!copy || !/^[a-f0-9-]{36}$/.test(batchId)) throw new Error('Cópia de campanha inválida.')
  const site = preferenceOrigin(origin), message = copy.snapshot.messages.find(item => item.day === copy.stage)!
  const destination = new URL(`/comprar/${copy.snapshot.offerId}`,site)
  if (copy.snapshot.campaignCode) destination.searchParams.set('c',copy.snapshot.campaignCode)
  const main = copy.stage === 7 || copy.stage === 10 ? `<p><a href="${escape(destination.href)}">Consultar a oferta e as condições atuais</a></p>` : `<p><a href="${escape(site+'/ebooks')}">Explorar os e-books da Bibliotheon</a></p>`
  const paragraphs = message.text.split(/\n\s*\n/).map(part=>`<p>${escape(part).replace(/\n/g,'<br>')}</p>`).join('\n')
  const htmlContent = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Bibliotheon</title></head><body><main><p>Bibliotheon</p>${paragraphs}${main}<hr><p>Você confirmou uma assinatura de marketing da Bibliotheon.</p><p><a href="${PREFERENCE_PLACEHOLDER}">Escolher assuntos ou cancelar marketing</a></p><p><a href="{{ unsubscribe }}">Cancelar e-mails pelo Brevo</a></p></main></body></html>`
  const result = readDraftSpec({name:`bibliotheon-${batchId}`,senderId,listId,subject:message.subject,htmlContent})
  if (!result) throw new Error('Revise o assunto ou o conteúdo manual da campanha.')
  return result
}

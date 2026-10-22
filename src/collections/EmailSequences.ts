import { APIError, type CollectionConfig } from 'payload'
import { owner, deny } from '../access/owner'
import { copyHash, enrollmentKey, idOf, sequenceCopy, sequenceDays } from '../modules/marketing/sequence-copy'
import { serial } from '../modules/marketing/transaction'
import { cancelPromotions } from '../modules/marketing/sequence-state'

export const EmailSequences: CollectionConfig = {
  slug: 'email-sequences', labels: { singular: 'Sequência de e-mail', plural: 'Sequências de e-mail' },
  access: { read: owner, create: owner, update: owner, delete: deny },
  admin: { group: 'Relacionamento', useAsTitle: 'name', defaultColumns: ['name', 'magnet', 'magnetVersion', 'revision', 'active'], description: 'Conteúdo manual. Ative após revisar as quatro mensagens. O calendário não representa envio pelo Brevo.' },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 160 },
    { name: 'magnet', type: 'relationship', relationTo: 'lead-magnets', required: true },
    { name: 'magnetVersion', type: 'text', required: true, maxLength: 160 },
    { name: 'revision', label: 'Revisão do conteúdo', type: 'number', required: true, defaultValue: 1, min: 1, max: 2147483647, validate: (value: unknown) => Number.isSafeInteger(value) || 'Informe uma revisão inteira.', admin: { description: 'Aumente a revisão ao mudar mensagens ou oferta. Contatos já inscritos preservam a cópia anterior.' } },
    { name: 'offer', type: 'relationship', relationTo: 'offers', admin: { description: 'Oferta do mesmo livro, usada em D+7 e D+10. A disponibilidade será conferida novamente.' } },
    ...sequenceDays.map(day => ({ name: `day${day}`, label: `D+${day}`, type: 'group' as const, fields: [
      { name: 'subject', label: 'Assunto', type: 'text' as const, maxLength: 160 },
      { name: 'text', label: 'Mensagem em texto', type: 'textarea' as const, maxLength: 6000, admin: { description: 'Conteúdo revisado, sem HTML ou variáveis. Links funcionais e preferências serão acrescentados pelo transporte de campanhas.' } },
    ] })),
    { name: 'active', label: 'Conteúdo revisado e sequência ativa', type: 'checkbox', defaultValue: false, admin: { description: 'Somente novas confirmações com marketing entram nesta sequência. Desativar cancela etapas pendentes, sem reinscrição automática.' } },
    { name: 'key', type: 'text', unique: true, required: true, admin: { hidden: true } },
    { name: 'contentHash', label: 'Hash do conteúdo revisado', type: 'text', admin: { readOnly: true, hidden: true } },
  ],
  hooks: {
    beforeValidate: [({ data, originalDoc }) => {
      if (!data) return data
      const magnet = data.magnet ?? originalDoc?.magnet, version = data.magnetVersion ?? originalDoc?.magnetVersion
      if (magnet && typeof version === 'string') data.key = enrollmentKey('sequence', idOf(magnet), version)
      return data
    }],
    beforeChange: [async ({ data, originalDoc, req }) => {
    const merged = { ...originalDoc, ...data }
    for (const day of sequenceDays) merged[`day${day}`] = { ...originalDoc?.[`day${day}`], ...data[`day${day}`] }
    const magnetId = merged.magnet && idOf(merged.magnet)
    if (!magnetId || typeof merged.magnetVersion !== 'string' || !merged.magnetVersion.trim()) throw new APIError('Informe amostra e versão.', 422)
    if (originalDoc?.id && (idOf(originalDoc.magnet) !== magnetId || originalDoc.magnetVersion !== merged.magnetVersion)) throw new APIError('Crie outra sequência para uma amostra ou versão diferente.', 422)
    data.key = enrollmentKey('sequence', magnetId, merged.magnetVersion)
    await serial(req, `sequence:${data.key}`)
    if (originalDoc?.id) {
      const current = await req.payload.findByID({ collection: 'email-sequences', id: originalDoc.id, depth: 0, overrideAccess: true, req })
      if (current.updatedAt !== originalDoc.updatedAt) throw new APIError('A sequência foi alterada. Recarregue antes de salvar.', 409)
      if (originalDoc.active && !merged.active) await cancelPromotions(req, { sequence: { equals: originalDoc.id } }, Date.now(), 'sequence_paused')
    }
    const copy = sequenceCopy(merged)
    const hash = copy ? copyHash(copy) : null
    if (originalDoc?.id && merged.revision < originalDoc.revision) throw new APIError('A revisão do conteúdo não pode diminuir.', 422)
    if (originalDoc?.contentHash && hash !== originalDoc.contentHash && !(merged.revision > originalDoc.revision)) throw new APIError('Aumente a revisão ao alterar conteúdo ou oferta.', 422)
    data.contentHash = hash
    if (merged.active) {
      if (!copy) throw new APIError('Revise os quatro assuntos, mensagens e a oferta antes de ativar.', 422)
      const magnet = await req.payload.findByID({ collection: 'lead-magnets', id: magnetId, depth: 0, req, overrideAccess: false })
      const offer = await req.payload.findByID({ collection: 'offers', id: copy.offerId, depth: 0, req, overrideAccess: false })
      if (!magnet.active || magnet.version !== merged.magnetVersion || idOf(magnet.ebook) !== idOf(offer.ebook)) throw new APIError('A versão ativa da amostra e a oferta precisam pertencer ao mesmo livro.', 422)
    }
    return data
  }] },
}

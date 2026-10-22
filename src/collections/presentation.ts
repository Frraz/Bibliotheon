import type { CollectionConfig, Field } from 'payload'

export const fieldLabels: Record<string, string> = {
  name: 'Nome', slug: 'Endereço da página', title: 'Título', description: 'Descrição', summary: 'Resumo', body: 'Conteúdo',
  introduction: 'Introdução', author: 'Autoria', theme: 'Tema', ebook: 'Livro', offer: 'Oferta', provider: 'Plataforma',
  accountKey: 'Identificador da conta', externalProductId: 'ID do produto na plataforma', externalOfferId: 'ID da oferta na plataforma',
  checkoutUrl: 'URL oficial do checkout', currency: 'Moeda', active: 'Ativa', primary: 'Oferta principal', lastVerifiedAt: 'Última conferência',
  kind: 'Tipo', state: 'Estado', startsAt: 'Início', endsAt: 'Fim', utmSource: 'Origem da campanha (UTM)', utmMedium: 'Meio da campanha (UTM)', utmContent: 'Conteúdo da campanha (UTM)',
  text: 'Conteúdo', question: 'Pergunta', answer: 'Resposta', seo: 'Busca e compartilhamento', media: 'Arquivo da amostra', version: 'Versão',
  visibility: 'Visibilidade', presentationRole: 'Finalidade', hash: 'Resumo criptográfico do arquivo', role: 'Papel',
  contact: 'Contato', magnet: 'Amostra', key: 'Chave interna', confirmedAt: 'Confirmação', globalSuppressedAt: 'Cancelamento global de marketing',
  deliveryState: 'Estado de entrega', consentVersion: 'Versão do consentimento', subscribedAt: 'Inscrição', unsubscribedAt: 'Cancelamento',
  purpose: 'Finalidade', action: 'Ação', occurredAt: 'Quando ocorreu', magnetVersion: 'Versão da amostra', marketingOptIn: 'Marketing solicitado',
  campaignCode: 'Código da campanha', confirmationTokenHash: 'Hash do link de confirmação', expiresAt: 'Validade', deliveredAt: 'Amostra aceita pelo transporte',
  revokedAt: 'Revogação', request: 'Pedido de amostra', attempts: 'Tentativas', nextAttemptAt: 'Próxima tentativa', startedAt: 'Início do envio',
  sentAt: 'Aceito pelo transporte', providerMessageId: 'ID da mensagem no provedor', errorCode: 'Motivo da pendência', tokenHash: 'Hash do link de preferências',
  day: 'Dia (UTC)', reserved: 'Quota reservada', count: 'Solicitações',
  sequence: 'Sequência', enrollment: 'Inscrição', dueAt: 'Data prevista', nextCheckAt: 'Próxima conferência', canceledAt: 'Cancelamento',
}
const choiceLabels: Record<string, string> = {
  hotmart: 'Hotmart', kiwify: 'Kiwify', cakto: 'Cakto', guide: 'Guia prático', reading: 'Leitura', workbook: 'Caderno de exercícios',
  mineral: 'Mineral', slate: 'Ardósia', plum: 'Ameixa', owned: 'Própria', affiliate: 'Afiliada', draft: 'Rascunho',
  active: 'Ativa', paused: 'Pausada', closed: 'Encerrada', public: 'Pública', private: 'Privada', cover: 'Capa', sample: 'Amostra', contextual: 'Contextual',
  ok: 'Normal', bounced: 'Devolução permanente', complaint: 'Reclamação de spam', pending: 'Aguardando', subscribed: 'Inscrito', unsubscribed: 'Cancelado',
  requested: 'Solicitado', confirmed: 'Confirmado', marketing: 'Marketing', confirmation: 'Confirmação', delivery: 'Entrega da amostra',
  sending: 'Em envio', sent: 'Aceito pelo transporte', uncertain: 'Resultado incerto', failed: 'Falhou', canceled: 'Cancelado',
  transport_disabled: 'Transporte desativado', quota: 'Quota diária atingida', provider_rejected: 'Recusado pelo provedor',
  uncertain_delivery: 'Verificar aceitação no provedor', attempts_exhausted: 'Tentativas esgotadas', recipient_suppressed: 'Contato com entrega suspensa', material_unavailable: 'Amostra indisponível',
  owner: 'Proprietário',
  scheduled: 'Programada', ready: 'Pronta para agrupamento', accepted: 'Campanha aceita pelo provedor', completed: 'Concluída',
  sequence_paused: 'Sequência desativada', offer_unavailable: 'Oferta ou campanha indisponível',
}
const arrayLabels: Record<string, { singular: string; plural: string }> = {
  benefits: { singular: 'Aprendizagem', plural: 'Aprendizagens' }, contents: { singular: 'Seção', plural: 'Seções' }, faq: { singular: 'Dúvida', plural: 'Dúvidas' },
}
/** Presentation only: field names, stored enums, permissions and database schema are preserved. */
function presentFields(fields: Field[]): Field[] {
  return fields.map(original => {
    const field = { ...original }
    if ('name' in field && fieldLabels[field.name] && field.label === undefined) field.label = fieldLabels[field.name]
    if ('fields' in field) field.fields = presentFields(field.fields)
    if (field.type === 'tabs') field.tabs = field.tabs.map(tab => ({ ...tab, fields: presentFields(tab.fields) }))
    if (field.type === 'array' && arrayLabels[field.name] && !field.labels) field.labels = arrayLabels[field.name]
    if (field.type === 'select' || field.type === 'radio') field.options = field.options.map(option => typeof option === 'string' && choiceLabels[option] ? { value: option, label: choiceLabels[option] } : option)
    if (field.type === 'date' && !field.admin?.date?.pickerAppearance) field.admin = { ...field.admin, date: { ...field.admin?.date, pickerAppearance: 'dayAndTime', displayFormat: field.admin?.date?.displayFormat || 'dd/MM/yyyy HH:mm', timeFormat: 'HH:mm' } }
    return field
  })
}
export const presentCollections = (collections: CollectionConfig[]): CollectionConfig[] => collections.map(collection => ({ ...collection, fields: presentFields(collection.fields) }))

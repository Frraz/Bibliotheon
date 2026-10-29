import { parseManifest, type Manifest } from './contract'

type Document = Record<string, unknown>
export interface WizardIO {
  ask: (text: string) => Promise<string>
  say: (text: string) => void
  request: (route: string, data?: unknown, method?: 'GET' | 'POST') => Promise<Document>
  save: (manifest: Manifest) => Promise<void>
  prepare: () => Promise<void>
  readPreview: () => Promise<Document | null>
  publish: () => Promise<void>
}
const bootstrap = [
  'Confirmar o slug do tema publicado no Bibliotheon; desenvolvimento-de-software é proposta local.',
  'Conferir se este livro já existe no site; associar explicitamente seu UUID em caso de cadastro anterior.',
  'Confirmar preço, conta, IDs, checkout, elegibilidade e entrega de cada oferta desejada; preços do kit são propostas. Manter impedimentos por canal até revisão própria.',
]
export const fieldName = (key: string) => ({ title: 'Título', summary: 'Resumo', theme: 'Tema', audience: 'Público', problem: 'Problema abordado', promise: 'O que o livro entrega', requirements: 'Requisitos', limits: 'Limites', cover: 'Capa', coverAlt: 'Descrição da capa', body: 'Apresentação', materialState: 'Estado do material' }[key] || key)
async function choice(io: WizardIO, prompt: string, max: number): Promise<number> {
  for (;;) {
    const value = (await io.ask(prompt)).trim()
    if (/^\d+$/.test(value) && Number(value) <= max) return Number(value)
    io.say('Digite um dos números mostrados.')
  }
}
async function required(io: WizardIO, prompt: string) {
  for (;;) { const value = (await io.ask(prompt)).trim(); if (value) return value; io.say('Este dado é necessário. Use Ctrl+C para cancelar.') }
}
async function collection(io: WizardIO, name: string, query = ''): Promise<Document[]> {
  const docs: Document[] = []
  for (let page = 1; page <= 10; page++) {
    const result = await io.request(`/api/${name}?depth=0&draft=true&limit=100&page=${page}${query}`, undefined, 'GET')
    if (!Array.isArray(result.docs) || typeof result.hasNextPage !== 'boolean') throw new Error('Não foi possível conferir o catálogo completo. Nenhuma pendência será removida.')
    docs.push(...result.docs)
    if (!result.hasNextPage) return docs
  }
  throw new Error('Catálogo maior que o limite de conferência. Use o painel para localizar o cadastro antes de continuar.')
}
export async function publicationWizard(input: Manifest, old: Document | null, io: WizardIO) {
  if (old?.pending) { io.say('Há uma confirmação incerta. Use Consultar confirmação ou repita Publicar com a mesma prévia antes de alterar o pacote.'); return }
  const m = structuredClone(input)
  io.say(`\nPUBLICAR COM AJUDA\n${m.book.title}\nVamos conferir tema, cadastro e forma de venda. Digite 0 nas listas para cancelar.`)
  const themes = (await collection(io, 'themes')).filter(d => !d.archived)
  io.say('\n1 de 3 — Em qual tema o livro deve aparecer?')
  themes.forEach((d, i) => io.say(`${i + 1}. ${d.name}${d._status !== 'published' ? ' (rascunho; publique no painel antes de usar)' : ''}`))
  io.say(`${themes.length + 1}. Criar um novo tema\n0. Cancelar`)
  const selected = await choice(io, 'Tema: ', themes.length + 1)
  if (!selected) return
  if (selected === themes.length + 1) {
    const name = await required(io, 'Nome do tema (ex.: Desenvolvimento de software): ')
    const introduction = await required(io, 'Uma frase explicando esse tema aos leitores: ')
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/, '')
    if (!slug) throw new Error('O nome precisa permitir um endereço com letras ou números.')
    if (themes.some(d => d.slug === slug)) throw new Error('Esse tema já existe na lista. Escolha o cadastro existente.')
    io.say(`Tema: ${name}\nDescrição: ${introduction}\nEsta ação cria e publica o tema no site.`)
    if ((await io.ask('Digite CRIAR para confirmar, ou Enter para cancelar: ')).trim() !== 'CRIAR') return
    const created = await io.request('/api/themes', { name, slug, introduction, _status: 'published' }, 'POST')
    const doc = created.doc as Document | undefined
    if (!doc?.id || doc.slug !== slug || doc._status !== 'published') throw new Error('O tema não foi confirmado. Confira o painel antes de repetir a criação.')
    io.say('Tema criado e publicado. Se cancelar as próximas etapas, ele continuará disponível no site.')
    m.book.theme = slug
  } else {
    const theme = themes[selected - 1]
    if (theme._status !== 'published' || typeof theme.slug !== 'string') { io.say('Esse tema é rascunho. Publique-o no painel ou escolha um tema publicado.'); return }
    m.book.theme = theme.slug
  }
  io.say('\n2 de 3 — Conferir se este livro já está no site')
  const slug = encodeURIComponent(m.book.slug), title = encodeURIComponent(m.book.title)
  const matches = await collection(io, 'ebooks', `&where[or][0][slug][equals]=${slug}&where[or][1][title][equals]=${title}`)
  const existingId = old?.ebookId || m.associateEbookId
  if (existingId) {
    const result = await io.request(`/api/ebooks/${encodeURIComponent(String(existingId))}?depth=0&draft=true`, undefined, 'GET')
    if (result.id !== existingId) throw new Error('Cadastro já vinculado não pôde ser conferido. Confira o painel.')
    io.say(`Continuar com o cadastro vinculado: ${result.title}`)
    if ((await io.ask('Usar este cadastro? [s/N]: ')).trim().toLowerCase() !== 's') return
    m.associateEbookId = String(existingId)
  } else if (matches.length) {
    io.say('Encontramos cadastros com o mesmo título ou endereço. Escolha o livro correto; diferenças serão revisadas antes de publicar.')
    matches.forEach((d, i) => io.say(`${i + 1}. ${d.title} — /ebooks/${d.slug}${d.archived ? ' (arquivado)' : ''}`))
    io.say('0. Cancelar e conferir no painel')
    const match = await choice(io, 'Cadastro: ', matches.length)
    if (!match) return
    if (matches[match - 1].archived) { io.say('Restaure o livro no painel antes de continuar.'); return }
    m.associateEbookId = String(matches[match - 1].id)
  } else {
    io.say('Não encontramos cadastro com este título ou endereço.')
    if ((await io.ask('Preparar um novo cadastro deste livro? [s/N]: ')).trim().toLowerCase() !== 's') return
  }
  io.say('\n3 de 3 — Como publicar esta página?\n1. Somente apresentar o livro, sem cadastrar novas ofertas\n2. Apresentar o livro com uma oferta de compra\n0. Cancelar\nOfertas existentes no site são preservadas. PDF/EPUB e entrega continuam nas plataformas.')
  const mode = await choice(io, 'Escolha: ', 2)
  if (!mode) return
  if (mode === 1) {
    if (m.offers.length) { io.say('Seu pacote contém ofertas. Esta opção vai omiti-las deste envio, preservando as que já existem no site.'); if ((await io.ask('Continuar somente com a página? [s/N]: ')).trim().toLowerCase() !== 's') return }
    m.offers = []
  } else {
    io.say('É preciso ter um produto cadastrado e entrega verificada na plataforma. Não use preços propostos como aprovados.')
    if ((await io.ask('Você já conferiu os dados e a entrega da oferta que vai cadastrar? [s/N]: ')).trim().toLowerCase() !== 's') { io.say('Configure o produto na Hotmart, Kiwify ou Cakto e volte aqui. Você também pode publicar só a página pela opção 1.'); return }
    if (!m.offers.length) {
      const providers = ['hotmart', 'kiwify', 'cakto'] as const
      io.say('1. Hotmart\n2. Kiwify\n3. Cakto\n0. Cancelar')
      const providerChoice = await choice(io, 'Plataforma: ', 3); if (!providerChoice) return
      const provider = providers[providerChoice - 1]
      const accountKey = await required(io, 'Identificador da conta configurada no Bibliotheon (não é senha): ')
      const externalProductId = await required(io, provider === 'hotmart' ? 'ucode do produto Hotmart: ' : 'Identificador do produto na plataforma: ')
      const externalOfferId = (await io.ask('Identificador da oferta, se aplicável (Enter para nenhum): ')).trim()
      const checkoutUrl = await required(io, 'Link HTTPS do checkout confirmado: ')
      const price = await required(io, 'Preço aprovado em reais (ex.: 79,90): ')
      if (!/^\d{1,8}(?:[,.]\d{1,2})?$/.test(price)) throw new Error('Preço inválido. Use reais sem separador de milhares, como 79,90.')
      const priceCents = Math.round(Number(price.replace(',', '.')) * 100)
      const eligibilityNote = await required(io, 'Descreva a conferência real de elegibilidade e entrega realizada: ')
      const date = await required(io, 'Data dessa conferência (AAAA-MM-DD): ')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Data inválida; use AAAA-MM-DD.')
      m.offers = [{ key: provider, name: `Oferta ${provider}`, provider, accountKey, externalProductId, ...(externalOfferId ? { externalOfferId } : {}), checkoutUrl, priceCents, currency: 'BRL', active: true, primary: true, lastVerifiedAt: new Date(date).toISOString(), eligibilityNote }]
    } else io.say(`${m.offers.length} oferta(s) do pacote serão conferidas na prévia. O assistente não inventa nem altera seus dados.`)
  }
  m.pending = m.pending.filter(item => !bootstrap.includes(item))
  parseManifest(m)
  io.say(`\nResumo: ${m.book.title}\nTema: ${m.book.theme}\nNovas ofertas neste envio: ${m.offers.length}\nOutras pendências: ${m.pending.length}`)
  if ((await io.ask('Salvar estas escolhas no pacote e preparar a prévia? [s/N]: ')).trim().toLowerCase() !== 's') return
  await io.save(m)
  await io.prepare()
  let preview = await io.readPreview()
  for (let attempt = 0; attempt < 3 && preview && Array.isArray(preview.conflicts) && preview.conflicts.length; attempt++) {
    io.say('\nO painel e o pacote têm conteúdo diferente. Escolha o que preservar em cada campo:')
    const resolutions = { ...m.resolutions }
    for (const conflict of preview.conflicts) {
      const field = String(conflict)
      const change = Array.isArray(preview.changes) ? preview.changes.find(c => c.field === field) : null
      io.say(`\n${fieldName(field.split('.').at(-1)!)}\nNo site: ${JSON.stringify(change?.before ?? '').slice(0, 1500)}\nNo pacote: ${JSON.stringify(change?.after ?? '').slice(0, 1500)}\n1. Preservar conteúdo do site\n2. Usar conteúdo do pacote\n0. Cancelar`)
      const selected = await choice(io, 'Escolha: ', 2); if (!selected) return
      resolutions[field] = selected === 1 ? 'remote' : 'package'
    }
    m.resolutions = resolutions
    await io.save(m); await io.prepare(); preview = await io.readPreview()
  }
  if (!preview || preview.canPublish !== true) {
    const blockers = [...(Array.isArray(preview?.blockers) ? preview.blockers : []), ...(Array.isArray(preview?.conflicts) ? preview.conflicts.map(f => `Conflito no campo ${f}: escolha qual conteúdo preservar.`) : [])]
    io.say('\nAinda falta resolver:\n' + [...new Set(blockers)].map(v => `• ${v}`).join('\n'))
    if (preview && Array.isArray(preview.conflicts) && preview.conflicts.length) io.say('O catálogo continua mudando. Confira as alterações no painel e inicie outra revisão; nenhuma publicação foi feita.')
    return
  }
  io.say(`\nPRÉVIA LIBERADA\nTítulo: ${m.book.title}\nResumo: ${m.book.summary || ''}\nPúblico: ${m.book.audience || ''}\nTema: ${m.book.theme}\nNovas ofertas: ${m.offers.map(o => `${o.provider}: R$ ${(Number(o.priceCents || 0) / 100).toFixed(2)}`).join(', ') || 'nenhuma'}\nRevise também a capa e o conteúdo na prévia HTML salva. Nenhuma publicação foi feita ainda.`)
  if ((await io.ask('Se já revisou e deseja publicar agora, digite PUBLICAR; Enter encerra sem publicar: ')).trim() === 'PUBLICAR') await io.publish()
}

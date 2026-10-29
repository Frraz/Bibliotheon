import { describe, it, expect, vi } from 'vitest'
import { publicationWizard, type WizardIO } from '../../src/modules/editorial/wizard'
import { CONTRACT, type Manifest } from '../../src/modules/editorial/contract'
const pendingTheme = 'Confirmar o slug do tema publicado no Bibliotheon; desenvolvimento-de-software é proposta local.'
const manifest = (): Manifest => ({ contract: CONTRACT, sourceId: 'synthetic', language: 'pt-BR', edition: '1', book: { title: 'Livro sintético', slug: 'livro-sintetico', theme: 'proposta', materialState: 'ready', presentationVariant: 'guide', accentPreset: 'mineral', summary: 'Resumo' }, cover: { file: 'cover.png', alt: 'Capa sintética', sha256: 'a'.repeat(64) }, offers: [], pending: [pendingTheme] })
function fixture(answers: string[], options: { matches?: Record<string, unknown>[]; themes?: Record<string, unknown>[]; previews?: Record<string, unknown>[] } = {}) {
  const saved: Manifest[] = [], previews = [...(options.previews || [{ canPublish: true }])]
  const io: WizardIO = {
    ask: vi.fn(async () => { if (!answers.length) throw new Error('Unexpected prompt'); return answers.shift()! }), say: vi.fn(),
    request: vi.fn(async (route, data, method) => {
      if (method === 'GET' && route.startsWith('/api/themes?')) return { docs: options.themes || [{ id: 'theme', name: 'Tecnologia', slug: 'tecnologia', _status: 'published' }], hasNextPage: false }
      if (method === 'GET' && route.startsWith('/api/ebooks?')) return { docs: options.matches || [], hasNextPage: false }
      if (method === 'POST' && route === '/api/themes') return { doc: { id: 'created', ...(data as object) } }
      throw new Error('Unexpected request')
    }),
    save: vi.fn(async value => { saved.push(structuredClone(value)) }), prepare: vi.fn(async () => {}),
    readPreview: vi.fn(async () => previews.shift() || null), publish: vi.fn(async () => {}),
  }
  return { io, saved }
}
describe('assistente de publicação', () => {
  it('resolve tema com nome, confere ausência do livro e publica só página após confirmação', async () => {
    const { io, saved } = fixture(['1', 's', '1', 's', 'PUBLICAR'])
    await publicationWizard(manifest(), null, io)
    expect(saved[0].book.theme).toBe('tecnologia'); expect(saved[0].pending).toEqual([]); expect(saved[0].offers).toEqual([])
    expect(io.prepare).toHaveBeenCalledOnce(); expect(io.publish).toHaveBeenCalledOnce()
  })
  it('não remove pendências desconhecidas nem publica quando a prévia continua bloqueada', async () => {
    const m = manifest(); m.pending.push('Revisão especializada pendente')
    const { io, saved } = fixture(['1', 's', '1', 's'], { previews: [{ canPublish: false, blockers: ['Revisão especializada pendente'] }] })
    await publicationWizard(m, null, io)
    expect(saved[0].pending).toEqual(['Revisão especializada pendente']); expect(io.publish).not.toHaveBeenCalled()
  })
  it('não abre rede ou altera pacote em confirmação incerta', async () => {
    const { io } = fixture([]); await publicationWizard(manifest(), { pending: true }, io)
    expect(io.request).not.toHaveBeenCalled(); expect(io.save).not.toHaveBeenCalled()
  })
  it('criação do tema requer confirmação e rascunho não é usado como publicado', async () => {
    const { io } = fixture(['1', 'Nome', 'Descrição', ''], { themes: [] })
    await publicationWizard(manifest(), null, io)
    expect(io.request).not.toHaveBeenCalledWith('/api/themes', expect.anything(), 'POST'); expect(io.save).not.toHaveBeenCalled()
    const draft = fixture(['1'], { themes: [{ name: 'Rascunho', slug: 'rascunho', _status: 'draft' }] })
    await publicationWizard(manifest(), null, draft.io); expect(draft.io.save).not.toHaveBeenCalled()
  })
  it('tema novo é publicado somente com CRIAR e cancelamento posterior não confirma o livro', async () => {
    const { io } = fixture(['1', 'Tema novo', 'Descrição real', 'CRIAR', 'n'], { themes: [] })
    await publicationWizard(manifest(), null, io)
    expect(io.request).toHaveBeenCalledWith('/api/themes', { name: 'Tema novo', slug: 'tema-novo', introduction: 'Descrição real', _status: 'published' }, 'POST')
    expect(io.publish).not.toHaveBeenCalled(); expect(io.save).not.toHaveBeenCalled()
  })
  it('associa livro por escolha, mostra conflito e respeita escolha de preservar o site', async () => {
    const { io, saved } = fixture(['1', '1', '1', 's', '1', 'PUBLICAR'], { matches: [{ id: 'abcdef00-0000-0000-0000-000000000000', title: 'Livro sintético', slug: 'livro-sintetico' }], previews: [{ canPublish: false, conflicts: ['book.title'], changes: [{ field: 'book.title', before: 'Site', after: 'Pacote' }] }, { canPublish: true }] })
    await publicationWizard(manifest(), null, io)
    expect(saved[0].associateEbookId).toBe('abcdef00-0000-0000-0000-000000000000')
    expect(saved[1].resolutions).toEqual({ 'book.title': 'remote' }); expect(io.prepare).toHaveBeenCalledTimes(2); expect(io.publish).toHaveBeenCalledOnce()
  })
  it('oferta sem verificação não avança e cancelar não grava escolhas', async () => {
    const { io } = fixture(['1', 's', '2', 'n']); await publicationWizard(manifest(), null, io)
    expect(io.save).not.toHaveBeenCalled(); expect(io.publish).not.toHaveBeenCalled()
  })
  it('não aceita catálogo incompleto como prova de ausência do livro', async () => {
    const { io } = fixture([]); vi.mocked(io.request).mockResolvedValue({ docs: [] })
    await expect(publicationWizard(manifest(), null, io)).rejects.toThrow('catálogo completo')
    expect(io.save).not.toHaveBeenCalled()
  })
  it('converte preço aprovado em centavos e mantém dados de conferência declarados', async () => {
    const { io, saved } = fixture(['1', 's', '2', 's', '2', 'synthetic', 'product', '', 'https://pay.example.invalid/x', '79,90', 'Conferência sintética', '2026-01-01', 's', ''])
    await publicationWizard(manifest(), null, io)
    expect(saved[0].offers[0]).toMatchObject({ provider: 'kiwify', priceCents: 7990, accountKey: 'synthetic', eligibilityNote: 'Conferência sintética' })
    expect(io.publish).not.toHaveBeenCalled()
  })
})

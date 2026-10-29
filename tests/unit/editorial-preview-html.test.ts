import { describe, it, expect } from 'vitest'
import { previewHTML } from '../../src/modules/editorial/preview-html'
import type { Manifest } from '../../src/modules/editorial/contract'
const m = { cover: { file: 'cover.png', alt: 'Capa', sha256: 'a'.repeat(64) } } as Manifest
describe('prévia de conteúdo', () => {
  it('mostra campos legíveis e escapa texto do livro e bloqueios', () => {
    const html = previewHTML(m, { book: { title: '<script>danger</script>', cover: `sha256:${m.cover.sha256}`, body: { root: { children: [{ children: [{ text: 'Apresentação real' }] }] } }, benefits: [{ text: 'Aprender' }] }, offers: [], blockers: ['<pendente>', '<pendente>'], changes: [], canPublish: false }, 'https://example.invalid', 'YQ==')
    expect(html).not.toContain('<script>danger'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Apresentação real')
    expect(html.match(/<li>&lt;pendente&gt;<\/li>/g)).toHaveLength(1); expect(html).toContain('<details>')
  })
  it('não mostra a capa do pacote como se fosse a capa preservada do site', () => {
    const html = previewHTML(m, { book: { title: 'Título', cover: 'media:other' }, offers: [], canPublish: true }, 'https://example.invalid', 'YQ==')
    expect(html).toContain('Capa preservada do site'); expect(html).not.toContain('<img ')
  })
})

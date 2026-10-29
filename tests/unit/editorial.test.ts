import { describe, expect, it } from 'vitest'
import { canonical, mergeFields, parseManifest, CONTRACT } from '../../src/modules/editorial/contract'
export const fixture = () => ({ contract: CONTRACT, sourceId: 'synthetic-book', language: 'pt-BR', edition: '1', book: { title: 'Livro sintético', slug: 'synthetic-book', theme: 'synthetic-theme', materialState: 'ready', presentationVariant: 'guide', accentPreset: 'mineral' }, cover: { file: 'cover.png', sha256: 'a'.repeat(64), alt: 'Capa sintética' }, offers: [], pending: [] })
describe('editorial contract', () => {
  it('accepts minimal package with explicit readiness and pending list', () => expect(parseManifest(fixture()).sourceId).toBe('synthetic-book'))
  it('rejects unknown fields, paths, versions, invalid prices and duplicate offer keys', () => {
    expect(() => parseManifest({ ...fixture(), secret: 'x' })).toThrow()
    expect(() => parseManifest({ ...fixture(), contract: 'next' })).toThrow()
    expect(() => parseManifest({ ...fixture(), cover: { ...fixture().cover, file: '../cover.png' } })).toThrow()
    const offer = { key: 'hotmart', name: 'Teste', provider: 'hotmart', accountKey: 'synthetic', externalProductId: 'synthetic', currency: 'BRL', active: false, primary: false, priceCents: 10.5 }
    expect(() => parseManifest({ ...fixture(), offers: [offer] })).toThrow()
    expect(() => parseManifest({ ...fixture(), offers: [{ ...offer, priceCents: 10 }, { ...offer, priceCents: 10 }] })).toThrow()
  })
  it('preserves manual-only changes, merges package-only changes and reports conflicts', () => {
    const result = mergeFields({ title: 'old', summary: 'old', limits: 'old' }, { title: 'manual', summary: 'old', limits: 'manual' }, { title: 'old', summary: 'new', limits: 'new' }, 'book')
    expect(result.value).toEqual({ title: 'manual', summary: 'new', limits: 'manual' })
    expect(result.conflicts).toEqual(['book.limits'])
  })
  it('requires explicit resolution for first association and supports both choices', () => {
    expect(mergeFields(null, { title: 'old' }, { title: 'new' }, 'book').conflicts).toEqual(['book.title'])
    expect(mergeFields(null, { title: 'old' }, { title: 'new' }, 'book', { 'book.title': 'remote' }).value.title).toBe('old')
    expect(mergeFields(null, { title: 'old' }, { title: 'new' }, 'book', { 'book.title': 'package' }).value.title).toBe('new')
  })
  it('canonicalizes nested objects without changing array order', () => {
    expect(canonical({ b: 1, a: { z: 2, y: 1 } })).toBe(canonical({ a: { y: 1, z: 2 }, b: 1 }))
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]))
  })
})

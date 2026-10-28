import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Merge = ((target: unknown, source: unknown, options?: Record<string, unknown>) => Record<string | symbol, unknown>) & { all: (values: unknown[]) => Record<string, unknown> }
const requireFromPayload = createRequire(import.meta.resolve('payload'))
const entry = requireFromPayload.resolve('deepmerge')
const variants: [string, Merge][] = [
  ['CJS usado pelo Payload', requireFromPayload('deepmerge')],
  ['UMD distribuído', requireFromPayload(join(dirname(entry), 'umd.js'))],
]

describe.each(variants)('deepmerge: %s', (_name, merge) => {
  it('não aceita protótipo injetado em um alvo sem protótipo', () => {
    const result = merge(Object.create(null), JSON.parse('{"__proto__":{"admin":true},"title":"Livro"}'))
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(result.admin).toBeUndefined()
    expect(result.title).toBe('Livro')
  })

  it.each([null, undefined, 0, false, ''])('protege objeto aninhado quando o valor anterior é %s', previous => {
    const result = merge({ session: previous }, JSON.parse('{"session":{"__proto__":{"admin":true},"name":"owner"}}'))
    const session = result.session as Record<string, unknown>
    expect(Object.getPrototypeOf(session)).toBe(Object.prototype)
    expect(session.admin).toBeUndefined()
    expect(Object.hasOwn(session, '__proto__')).toBe(false)
    expect(session.name).toBe('owner')
    expect(({} as Record<string, unknown>).admin).toBeUndefined()
  })

  it('também protege a cópia do alvo e caminhos constructor/prototype', () => {
    const target = JSON.parse('{"__proto__":{"admin":true},"nested":{"constructor":{"prototype":{"admin":true}},"prototype":{"admin":true},"safe":1}}')
    const result = merge(target, JSON.parse('{"constructor":{"prototype":{"admin":true}},"prototype":{"admin":true},"nested":{"extra":2}}'))
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(result.admin).toBeUndefined()
    expect(Object.hasOwn(result, 'constructor')).toBe(false)
    expect(Object.hasOwn(result, 'prototype')).toBe(false)
    expect(result.nested).toEqual({ safe: 1, extra: 2 })
  })

  it('preserva merges válidos, símbolos, datas, arrays e a opção de substituir arrays', () => {
    const symbol = Symbol('config'), date = new Date('2026-10-28T00:00:00Z')
    const target = { fields: ['title'], config: { enabled: true }, [symbol]: 'private' }
    const source = { fields: ['price'], config: { quota: 50 }, date }
    const result = merge(target, source)
    expect(result).toEqual({ fields: ['title', 'price'], config: { enabled: true, quota: 50 }, date, [symbol]: 'private' })
    expect(result.date).toBe(date)
    expect(target.fields).toEqual(['title'])
    expect(merge(target, source, { arrayMerge: (_target: unknown, incoming: unknown) => incoming }).fields).toEqual(['price'])
    expect(merge.all([{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 })
  })
})

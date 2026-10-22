import { describe, expect, it } from 'vitest'
import { copyHash, dueAt, enrollmentKey, readSequenceSnapshot, sequenceCopy, sequenceDays } from '../../src/modules/marketing/sequence-copy'

const offer = 'd972990a-8765-47d4-ae6a-75ff42662156', ebookId = '589d58b8-7fb1-4daf-921d-b07265733099'
const template = { revision: 1, offer, ...Object.fromEntries(sequenceDays.map(day => [`day${day}`, { subject: `Assunto ${day}`, text: `Mensagem ${day}\r\nSegunda linha.` }])) }
describe('Calendário promocional e cópia revisada', () => {
  it('mantém quatro dias fixos desde a confirmação em UTC', () => {
    const anchor = '2026-10-21T23:30:00.000Z'
    expect(sequenceDays.map(day => dueAt(anchor, day))).toEqual(['2026-10-23T23:30:00.000Z', '2026-10-25T23:30:00.000Z', '2026-10-28T23:30:00.000Z', '2026-10-31T23:30:00.000Z'])
    expect(enrollmentKey('contact', 'material', 'v1')).toBe(enrollmentKey('contact', 'material', 'v1'))
    expect(enrollmentKey('contact', 'material', 'v1')).not.toBe(enrollmentKey('contact', 'material', 'v2'))
    expect(enrollmentKey('a:b', 'c', 'd')).not.toBe(enrollmentKey('a', 'b:c', 'd'))
  })
  it('normaliza texto, recusa assunto injetado, revisão fracionária e mensagens incompletas', () => {
    const copy = sequenceCopy(template)!
    expect(copy.messages).toHaveLength(4)
    expect(copy.messages[0].text).toBe('Mensagem 2\nSegunda linha.')
    for (const revision of [0, 1.1, '1', NaN, 2_147_483_648]) expect(sequenceCopy({ ...template, revision })).toBeNull()
    for (const subject of ['', 'a'.repeat(161), 'Oi\r\nBcc:alguem']) expect(sequenceCopy({ ...template, day2: { subject, text: 'Texto' } })).toBeNull()
    expect(sequenceCopy({ ...template, day10: null })).toBeNull()
    expect(sequenceCopy({ ...template, day4: { subject: 'Assunto', text: 'x'.repeat(6001) } })).toBeNull()
  })
  it('confere hash e estrutura do snapshot, preservando campanha sem aceitar conteúdo adulterado', () => {
    const copy = sequenceCopy(template)!
    const snapshot = { ...copy, contentHash: copyHash(copy), ebookId, campaignCode: 'partner-01' }
    expect(readSequenceSnapshot(snapshot)).toEqual(snapshot)
    expect(readSequenceSnapshot({ ...snapshot, contentHash: 'outro' })).toBeNull()
    expect(readSequenceSnapshot({ ...snapshot, messages: [...copy.messages].reverse() })).toBeNull()
    expect(readSequenceSnapshot({ ...snapshot, campaignCode: 'https://example.invalid' })).toBeNull()
    expect(copyHash({ ...copy, revision: 2 })).toBe(copyHash(copy))
    expect(copyHash({ ...copy, messages: copy.messages.map(message => ({ ...message, text: message.text + ' revisado' })) })).not.toBe(copyHash(copy))
  })
})

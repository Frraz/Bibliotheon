import {describe,it,expect} from 'vitest'
import {parseInboxFilters,inboxPageLink} from '../../src/modules/commerce/admin'
import {commercialDate,commercialErrorLabel,retryAvailability} from '../../src/modules/commerce/presentation'

describe('operação comercial: filtros e disponibilidade',()=>{
 it('inicia em atenção e mantém filtros na paginação',()=>{
  expect(parseInboxFilters({})).toEqual({provider:'all',state:'attention',page:1})
  expect(inboxPageLink(parseInboxFilters({provider:'cakto',state:'failed',page:'2'}),3)).toBe('/admin/commercial-inbox?provider=cakto&state=failed&page=3')
 })
 it('recusa filtros múltiplos/desconhecidos e páginas ambíguas',()=>{
  for(const input of [{provider:['hotmart','cakto']},{provider:'other'},{state:'approved'},{state:['failed']},{page:'0'},{page:'01'},{page:'-1'},{page:'1.5'},{page:'1000000'},{page:2},{event:'invalid'},{event:['00000000-0000-4000-8000-000000000000']}])expect(()=>parseInboxFilters(input)).toThrow('invalid_filters')
 })
 it('não oferece retry de concluído, pendente ou colisão',()=>{
  for(const state of ['pending','applied','ignored'] as const)expect(retryAvailability({state,conflicted:false},0)).toBeTruthy()
  expect(retryAvailability({state:'failed',conflicted:true},0)).toMatch(/Colisão/)
  expect(retryAvailability({state:'needs_review',conflicted:false},0)).toBeNull()
 })
 it('respeita a fronteira de cinco minutos e recusa lease sem data válida',()=>{
  const now=Date.parse('2026-10-24T12:00:00Z')
  expect(retryAvailability({state:'processing',conflicted:false,startedAt:new Date(now-299999).toISOString()},now)).toBeTruthy()
  expect(retryAvailability({state:'processing',conflicted:false,startedAt:new Date(now-300000).toISOString()},now)).toBeNull()
  for(const startedAt of [null,'invalid'])expect(retryAvailability({state:'processing',conflicted:false,startedAt},now)).toBeTruthy()
 })
 it('usa Belém e desconhecido sem inventar sucesso ou exibir erro bruto',()=>{
  expect(commercialDate('2026-10-24T02:30:00Z')).toBe('23/10/2026, 23:30')
  expect(commercialDate(null)).toBe('Não informado')
  expect(commercialDate('invalid')).toBe('Não informado')
  expect(commercialErrorLabel('buyer@example.invalid')).not.toContain('@')
  expect(commercialErrorLabel('event_key_conflict')).toMatch(/envelopes/)
 })
})

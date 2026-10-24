import {describe,it,expect} from 'vitest'
import {controlledCode,parsePageEvent,queryContext,publicPagePath} from '../../src/modules/analytics/validation'
const event={type:'page_view',eventId:'00000000-0000-0000-0000-000000000001',pagePath:'/ebooks/guia'}
describe('medição própria',()=>{
 it('permite apenas page_view e caminhos públicos sem query ou tokens',()=>{
  expect(parsePageEvent(event)).toEqual(event)
  for(const path of ['/preferencias','/amostras/confirmar','/preview/ebooks/x','/api/admin','/ebooks/guia?t=secret','/ebooks/person@example.invalid','//example.invalid','/admin'])expect(publicPagePath(path)).toBe(false)
  for(const extra of [{type:'purchase_approved'},{email:'person@example.invalid'},{eventId:'bad'},{pagePath:'/preferencias'},{utms:{source:'person@example.invalid'}}])expect(parsePageEvent({...event,...extra})).toBeNull()
 })
 it('limita códigos e só extrai parâmetros controlados, descartando queries sensíveis',()=>{
  for(const value of ['person@example.invalid','11999999999','https://host.invalid','a'.repeat(121),'Nome Pessoal'])expect(controlledCode(value)).toBe(false)
  expect(queryContext(new URLSearchParams('c=campanha&email=person@example.invalid&utm_source=organico'))).toEqual({campaignCode:'campanha',utms:{source:'organico'}})
  expect(queryContext(new URLSearchParams('c=campanha&utm_source=person@example.invalid'))).toEqual({})
  expect(queryContext(new URLSearchParams('c=campanha&c=outra'))).toEqual({})
 })
})

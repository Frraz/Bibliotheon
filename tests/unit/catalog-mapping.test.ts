import {describe,it,expect} from 'vitest'
import {catalogScopeKey,mapCatalogIdentity,type CatalogScope,type CatalogDecision,type CatalogEntry} from '../../src/modules/commerce/catalog-mapping'
import {catalogChoice} from '../../src/modules/commerce/catalog-resolutions'
const scope:CatalogScope={provider:'hotmart',accountKey:'synthetic',externalProductId:'product',externalOfferId:null}
const offer:CatalogEntry={id:'offer',...scope,ebook:'original-book'}
const second={...offer,id:'other-offer',ebook:'verified-book'}
const decision:CatalogDecision={id:'decision',scopeKey:catalogScopeKey(scope),revision:1,action:'associate',targetOffer:second.id,targetEbook:'verified-book'}
describe('Associação auditada sem alterar catálogo/fatos',()=>{
 it('preserva revisão de catálogo ambíguo até decisão exata e usa livro verificado',()=>{
  expect(mapCatalogIdentity(scope,[offer,second])).toEqual({state:'review',reason:'ambiguous_product'})
  expect(mapCatalogIdentity(scope,[offer,second],decision)).toEqual({state:'mapped',ebook:'verified-book',offer:'other-offer',resolutionId:'decision'})
  expect(offer.ebook).toBe('original-book')
 })
 it('não usa decisões de outra conta, provedor ou oferta, nem alvo alterado',()=>{
  for(const other of [{...scope,accountKey:'other'},{...scope,provider:'cakto' as const},{...scope,externalOfferId:'explicit'}])expect(mapCatalogIdentity(other,[offer,second],decision)).toEqual({state:'review',reason:'catalog_resolution_invalid'})
  expect(mapCatalogIdentity(scope,[offer,{...second,ebook:'changed'}],decision).state).toBe('review')
  expect(mapCatalogIdentity(scope,[offer],decision).state).toBe('review')
 })
 it('hold não cai em primária, mesmo com catálogo único',()=>{
  expect(mapCatalogIdentity(scope,[offer],{...decision,action:'hold',targetOffer:null,targetEbook:null})).toEqual({state:'review',reason:'catalog_resolution_held'})
 })
 it('livro verificado corrige cadastro único sem exigir nova oferta',()=>{
  expect(mapCatalogIdentity(scope,[offer],{...decision,targetOffer:null})).toEqual({state:'mapped',ebook:'verified-book',offer:null,resolutionId:'decision'})
 })
 it('referência legada sem livro não causa projeção nem exceção',()=>{
  expect(mapCatalogIdentity(scope,[{...offer,ebook:null}])).toEqual({state:'review',reason:'unknown_product'})
  expect(mapCatalogIdentity(scope,[{...offer,ebook:null}],{...decision,targetOffer:null}).state).toBe('mapped')
 })
 it('campos extras, origem em email e alvo ausente não entram no contrato',()=>{
  const choice={...scope,action:'hold',targetOfferId:null,targetEbookId:null}
  expect(catalogChoice(choice)).toEqual(choice)
  for(const invalid of [{...choice,actor:'forged'},{...choice,accountKey:'buyer@example.invalid'},{...choice,action:'associate'},{...choice,externalOfferId:''}])expect(()=>catalogChoice(invalid)).toThrow()
 })
})

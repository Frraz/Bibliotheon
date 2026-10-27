import {createHash} from 'node:crypto'
import type {CommercialProvider} from './events'
export type CatalogScope={provider:CommercialProvider;accountKey:string;externalProductId:string;externalOfferId:string|null}
export type CatalogEntry={id:string;provider:string;accountKey:string;externalProductId:string;externalOfferId?:string|null;ebook:string|{id:string}|null}
export type CatalogDecision={id:string;scopeKey:string;revision:number;action:'associate'|'hold';targetOffer:string|null;targetEbook:string|null}
export const catalogHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const catalogScopeKey=(scope:CatalogScope)=>catalogHash([scope.provider,scope.accountKey,scope.externalProductId,scope.externalOfferId||null])
export const catalogBookID=(value:string|{id:string}|null|undefined)=>typeof value==='string'?value:value?.id??null
export function mapCatalogIdentity(scope:CatalogScope,catalog:readonly CatalogEntry[],decision?:CatalogDecision){
 const scoped=catalog.filter(offer=>offer.provider===scope.provider&&offer.accountKey===scope.accountKey&&offer.externalProductId===scope.externalProductId)
 const exact=scope.externalOfferId?scoped.filter(offer=>offer.externalOfferId===scope.externalOfferId):scoped
 if(decision){
  if(decision.scopeKey!==catalogScopeKey(scope))return{state:'review' as const,reason:'catalog_resolution_invalid' as const}
  if(decision.action==='hold')return{state:'review' as const,reason:'catalog_resolution_held' as const}
  if(!decision.targetOffer&&decision.targetEbook)return{state:'mapped' as const,ebook:decision.targetEbook,offer:null,resolutionId:decision.id}
  const chosen=exact.find(offer=>offer.id===decision.targetOffer)
  if(!chosen||catalogBookID(chosen.ebook)!==decision.targetEbook)return{state:'review' as const,reason:'catalog_resolution_invalid' as const}
  return{state:'mapped' as const,ebook:decision.targetEbook!,offer:chosen.id,resolutionId:decision.id}
 }
 if(!exact.length)return{state:'review' as const,reason:scope.externalOfferId?'unknown_offer' as const:'unknown_product' as const}
 if(exact.some(offer=>!catalogBookID(offer.ebook)))return{state:'review' as const,reason:'unknown_product' as const}
 if(new Set(exact.map(offer=>catalogBookID(offer.ebook))).size!==1)return{state:'review' as const,reason:'ambiguous_product' as const}
 if(scope.externalOfferId&&exact.length!==1)return{state:'review' as const,reason:'ambiguous_offer' as const}
 return{state:'mapped' as const,ebook:catalogBookID(exact[0].ebook)!,offer:scope.externalOfferId?exact[0].id:null}
}

import type {CollectionConfig} from 'payload'
import {owner,deny} from '../access/owner'
import {commercialProviders} from '../modules/commerce/events'
export const CatalogResolutions:CollectionConfig={
 slug:'catalog-resolutions',labels:{singular:'Decisão de identidade',plural:'Decisões de identidade'},
 access:{read:owner,create:deny,update:deny,delete:deny},
 admin:{group:'Conciliação',useAsTitle:'sourceReference',defaultColumns:['provider','accountKey','externalProductId','revision','action','occurredAt'],description:'Trilha imutável. Associação efetiva não altera referências/envelopes originais nem aplica venda. Nova decisão exige prévia e conferência no servidor.'},
 fields:[
  {name:'key',type:'text',required:true,unique:true},{name:'requestHash',type:'text',required:true},{name:'scopeKey',type:'text',required:true,index:true},
  {name:'provider',type:'select',options:[...commercialProviders],required:true},{name:'accountKey',type:'text',required:true},{name:'externalProductId',type:'text',required:true},{name:'externalOfferId',type:'text'},
  {name:'revision',type:'number',required:true,min:1},{name:'previous',type:'relationship',relationTo:'catalog-resolutions'},
  {name:'action',type:'select',options:['associate','hold'],required:true},
  {name:'targetOffer',type:'relationship',relationTo:'offers'},{name:'targetEbook',type:'relationship',relationTo:'ebooks'},
  {name:'actor',type:'relationship',relationTo:'admin-users',required:true},{name:'occurredAt',type:'date',required:true},
  {name:'sourceKind',type:'select',options:['provider_report','manual_reconciliation'],required:true},{name:'sourceReference',type:'text',required:true},
  {name:'reason',type:'select',options:['catalog_mapping_verified','historical_mapping_correction','evidence_inconclusive'],required:true},
  {name:'evidenceVerified',type:'checkbox',required:true},{name:'planHash',type:'text',required:true},{name:'snapshot',type:'json',required:true},
 ].map(field=>({...field,admin:{readOnly:true}})) as CollectionConfig['fields'],
}

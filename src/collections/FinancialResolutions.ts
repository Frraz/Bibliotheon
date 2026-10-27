import type {CollectionConfig,Field} from 'payload'
import {owner,deny} from '../access/owner'
import {commercialProviders} from '../modules/commerce/events'
const text=(name:string,required=true,unique=false):Field=>({name,type:'text',required,unique})
const json=(name:string):Field=>({name,type:'json',required:true})
const model=(slug:CollectionConfig['slug'],fields:Field[]):CollectionConfig=>({slug,access:{read:owner,create:deny,update:deny,delete:deny},admin:{group:'Conciliação',description:'Prova imutável de resolução. Projeções substituem o resultado derivado; não somar aplicações como novas vendas.'},fields:fields.map(field=>{if(field.type!=='ui'&&field.type!=='join'){field.admin??={};field.admin.readOnly=true}return field})})
export const FinancialResolutions=model('financial-resolutions',[
 text('key',true,true),text('requestHash'),{name:'provider',type:'select',required:true,options:[...commercialProviders]},text('accountKey'),{name:'revision',type:'number',required:true,min:1},
 json('transactionKeys'),json('previousIds'),{name:'action',type:'select',required:true,options:['reconcile','hold']},json('choice'),json('coverage'),json('snapshot'),json('outcomes'),
 text('sourceHash'),text('planHash'),{name:'actor',type:'relationship',relationTo:'admin-users',required:true},{name:'occurredAt',type:'date',required:true},
 {name:'sourceKind',type:'select',required:true,options:['provider_report','manual_reconciliation']},text('sourceReference'),{name:'reason',type:'select',required:true,options:['provider_records_verified','incorrect_source_reconciled','evidence_inconclusive']},{name:'evidenceVerified',type:'checkbox',required:true},
])
export const FinancialResolutionApplications=model('financial-resolution-applications',[
 text('key',true,true),{name:'resolution',type:'relationship',relationTo:'financial-resolutions',required:true},text('sourceHash'),json('coverage'),json('outcomes'),
 {name:'actorType',type:'select',required:true,options:['owner','worker']},{name:'actor',type:'relationship',relationTo:'admin-users'}, {name:'occurredAt',type:'date',required:true},
])
export const financialResolutionCollections=[FinancialResolutions,FinancialResolutionApplications]

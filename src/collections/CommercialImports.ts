import type {CollectionConfig,Field} from 'payload'
import {owner,deny} from '../access/owner'
import {previewClassifications} from '../modules/commerce/import-preview'
const text=(name:string,required=false,unique=false):Field=>({name,type:'text',required,unique})
const date=(name:string,required=false):Field=>({name,type:'date',required})
const rel=(name:string,relationTo:'commercial-import-batches'|'admin-users'|'commercial-inbox'|'transactions',required=false):Field=>({name,type:'relationship',relationTo,required,index:true})
const model=(slug:CollectionConfig['slug'],singular:string,plural:string,fields:Field[]):CollectionConfig=>({slug,labels:{singular,plural},access:{read:owner,create:deny,update:deny,delete:deny},admin:{group:'Conciliação',description:'Registro privado. Confirmação de lote não comprova aplicação, liquidação ou venda real.'},fields:fields.map(field=>{if(field.type!=='ui'&&field.type!=='join'){field.admin??={};field.admin.readOnly=true}return field})})
export const CommercialImportBatches=model('commercial-import-batches','Lote de conciliação','Lotes de conciliação',[
 text('key',true,true),{name:'kind',type:'select',required:true,defaultValue:'snapshot',options:['snapshot','report_evidence']},text('requestHash',true),text('fileHash',true),text('manifestHash',true),text('planHash',true),
 {name:'sourceKind',type:'select',required:true,options:['provider_report','manual_reconciliation']},text('sourceReference',true),
 {name:'reason',type:'select',required:true,options:['missing_webhook','report_reconciliation']},rel('actor','admin-users',true),
 {name:'state',type:'select',required:true,options:['ready','blocked','stale','queued','confirmed']},
 {name:'rowCount',type:'number',required:true,min:1,max:10000},{name:'counts',type:'json',required:true},date('stagedAt',true),date('confirmedAt'),rel('confirmedBy','admin-users'),
])
CommercialImportBatches.admin={...CommercialImportBatches.admin,defaultColumns:['sourceKind','sourceReference','state','rowCount','stagedAt']}
export const CommercialImportRows=model('commercial-import-rows','Linha de conciliação','Linhas de conciliação',[
 text('key',true,true),rel('batch','commercial-import-batches',true),{name:'line',type:'number',min:2,max:10001,required:true},text('rowHash',true),text('transactionKey',true),{name:'normalized',type:'json',required:true},
 {name:'classification',type:'select',required:true,options:[...previewClassifications]},text('reason',true),{name:'duplicateOf',type:'number'},
 {name:'state',type:'select',required:true,options:['planned','matched','duplicate','blocked','queued','recorded']},rel('inbox','commercial-inbox'),rel('transaction','transactions'),
])
CommercialImportRows.admin={...CommercialImportRows.admin,defaultColumns:['batch','line','classification','reason','state']}
export const CommercialImportAudit=model('commercial-import-audit','Auditoria de conciliação','Auditorias de conciliação',[
 rel('batch','commercial-import-batches',true),rel('actor','admin-users',true),{name:'action',type:'select',required:true,options:['staged','queued','confirmed','stale','duplicate_commit']},date('occurredAt',true),text('reason',true),
])
export const commercialImportCollections=[CommercialImportBatches,CommercialImportRows,CommercialImportAudit]

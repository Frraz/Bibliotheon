import type {CollectionConfig,Field} from 'payload'
import {deny,owner} from '../access/owner'
import {commercialKinds,commercialProviders} from '../modules/commerce/events'
const text=(name:string,required=false,unique=false,hidden=false):Field=>({name,type:'text',required,unique,...(hidden?{admin:{hidden:true}}:{})})
const date=(name:string,required=false):Field=>({name,type:'date',required})
const rel=(name:string,relationTo:'commercial-inbox'|'transactions'|'ebooks'|'offers'|'admin-users',required=false,unique=false):Field=>({name,type:'relationship',relationTo,required,unique,index:true})
const scope=():Field[]=>[{name:'provider',type:'select',options:[...commercialProviders],required:true},text('accountKey',true)]
const money=(name:string):Field=>({name,type:'number',validate:(value:unknown)=>value==null||typeof value==='number'&&Number.isSafeInteger(value)||'Informe centavos inteiros seguros.'})
const operational=(slug:CollectionConfig['slug'],singular:string,plural:string,fields:Field[]):CollectionConfig=>({slug,labels:{singular,plural},admin:{group:'Operação comercial',description:'Envelope mínimo/histórico privado. Clique, aprovação e recebimento são conceitos distintos.'},access:{read:owner,create:deny,update:deny,delete:deny},fields:fields.map(field=>{if(field.type!=='ui'&&field.type!=='join'){field.admin??={};field.admin.readOnly=true}return field})})
export const CommercialInbox=operational('commercial-inbox','Evento comercial recebido','Eventos comerciais recebidos',[
 {name:'retryControls',type:'ui',admin:{components:{Field:'/components/admin/CommercialRetry#CommercialRetry'}}},
 text('key',true,true,true),...scope(),text('eventKey',true),text('adapterVersion',true),text('envelopeHash',true,false,true),{name:'envelope',type:'json',required:true,admin:{hidden:true}},text('transactionKey',false,false,true),
 {name:'kind',type:'select',required:true,options:['event','ignored']},{name:'state',type:'select',required:true,options:['pending','processing','applied','ignored','needs_review','failed']},
 date('receivedAt',true),date('nextAttemptAt',true),{name:'startedAt',label:'Processamento iniciado',type:'date'},date('processedAt'),date('lastSuccessAt'),{name:'attempts',type:'number',min:0,required:true,defaultValue:0},{name:'attemptBase',type:'number',min:0,required:true,defaultValue:0},text('leaseToken',false,false,true),text('errorCode'),{name:'conflicted',type:'checkbox',required:true,defaultValue:false},rel('transaction','transactions'),
])
CommercialInbox.admin={...CommercialInbox.admin,defaultColumns:['provider','accountKey','state','conflicted','receivedAt','attempts','errorCode']}
export const CommercialConflicts=operational('commercial-conflicts','Conflito comercial','Conflitos comerciais',[
 text('key',true,true,true),rel('inbox','commercial-inbox',true),text('envelopeHash',true,false,true),text('adapterVersion',true),{name:'envelope',type:'json',required:true},date('receivedAt',true),
])
export const Transactions=operational('transactions','Transação externa','Transações externas',[
 text('key',true,true,true),...scope(),text('externalTransactionId',true),text('externalProductId',true),text('externalOfferId'),rel('ebook','ebooks',true),rel('offer','offers'),
 {name:'state',type:'select',required:true,options:['unknown',...commercialKinds]},text('currency',true),money('grossCents'),money('refundedCents'),money('chargebackCents'),money('feesCents'),money('producerNetCents'),
 date('approvedAt'),date('lastEventAt'),date('lastSuccessAt'),{name:'needsReview',type:'checkbox',required:true,defaultValue:false},text('reviewReason'),{name:'projection',type:'json'},
])
Transactions.admin={...Transactions.admin,defaultColumns:['provider','externalTransactionId','state','currency','needsReview','approvedAt']}
export const TransactionEvents=operational('transaction-events','Fato de transação','Fatos de transações',[
 text('key',true,true,true),rel('transaction','transactions',true),rel('inbox','commercial-inbox',true,true),{name:'envelope',type:'json',required:true},date('occurredAt',true),{name:'outcome',type:'select',required:true,options:['applied','needs_review']},text('errorCode'),
])
export const CommercialAudit=operational('commercial-audit','Auditoria comercial','Auditorias comerciais',[
 rel('inbox','commercial-inbox',true),rel('transaction','transactions'),rel('actor','admin-users'),{name:'actorType',type:'select',required:true,options:['receiver','worker','owner']},
 {name:'action',type:'select',required:true,options:['received','ignored','conflict','applied','review','failed','retry']},text('reason'),date('occurredAt',true),
])
export const commerceCollections=[CommercialInbox,CommercialConflicts,Transactions,TransactionEvents,CommercialAudit]

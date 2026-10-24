import type {CollectionConfig,Field} from 'payload'
import {deny,owner} from '../access/owner'
const date=(name:string,required=false):Field=>({name,type:'date',required,...(name==='startedAt'?{label:'Início da sessão'}:{})})
const rel=(name:string,relationTo:'analytics-grants'|'visits'|'ebooks'|'offers'|'campaigns',required=false):Field=>({name,type:'relationship',relationTo,required,index:true})
const collection=(slug:CollectionConfig['slug'],singular:string,plural:string,fields:Field[]):CollectionConfig=>({slug,labels:{singular,plural},admin:{group:'Medição',description:'Medição própria sem IP, email ou identidade do comprador.'},access:{read:owner,create:deny,update:deny,delete:deny},fields:fields.map(field=>{if(field.type!=='ui'&&field.type!=='join'){field.admin??={};field.admin.readOnly=true}return field})})
export const AnalyticsGrants=collection('analytics-grants','Permissão de medição','Permissões de medição',[
 {name:'tokenHash',type:'text',required:true,unique:true,admin:{hidden:true}},{name:'consentVersion',type:'text',required:true},date('grantedAt',true),date('expiresAt',true),date('revokedAt'),rel('currentVisit','visits'),{name:'firstTouch',type:'json'},{name:'lastNonDirectTouch',type:'json'},date('attributionExpiresAt'),
])
export const Visits=collection('visits','Sessão medida','Sessões medidas',[
 rel('grant','analytics-grants',true),date('startedAt',true),date('lastSeenAt',true),date('expiresAt',true),{name:'firstTouch',type:'json'},{name:'lastNonDirectTouch',type:'json'},
])
export const PageViews=collection('page-views','Visualização medida','Visualizações medidas',[
 {name:'key',type:'text',required:true,unique:true,admin:{hidden:true}},rel('visit','visits',true),{name:'pagePath',type:'text',required:true},rel('ebook','ebooks'),rel('campaign','campaigns'),{name:'utms',type:'json'},date('occurredAt',true),
])
export const CheckoutClicks=collection('checkout-clicks','Saída de checkout','Saídas de checkout',[
 rel('offer','offers',true),rel('ebook','ebooks',true),rel('campaign','campaigns'),{name:'provider',type:'select',required:true,options:['hotmart','kiwify','cakto']},rel('visit','visits'),{name:'attributionAllowed',type:'checkbox',required:true,defaultValue:false},{name:'firstTouch',type:'json'},{name:'lastNonDirectTouch',type:'json'},date('occurredAt',true),
])
export const AnalyticsLimits=collection('analytics-limits','Limite de medição','Limites de medição',[
 {name:'key',type:'text',required:true,unique:true},{name:'count',type:'number',required:true,min:0},date('expiresAt',true),
])
export const analyticsCollections=[AnalyticsGrants,Visits,PageViews,CheckoutClicks,AnalyticsLimits]

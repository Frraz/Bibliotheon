import type {CollectionConfig,Field,CollectionSlug} from 'payload'
import {owner,deny} from '../access/owner'
import {commercialProviders} from '../modules/commerce/events'

const text=(name:string,required=true,unique=false):Field=>({name,type:'text',required,unique})
const amount=(name:string):Field=>({name,type:'number',required:true,min:0,validate:(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)||'Informe centavos inteiros não negativos.'})
const date=(name:string):Field=>({name,type:'date',required:true})
const relationship=(name:string,relationTo:CollectionSlug,required=false,unique=false):Field=>({name,type:'relationship',relationTo,required,unique,index:true})
const privateImmutable=(slug:CollectionConfig['slug'],description:string,fields:Field[]):CollectionConfig=>({slug,access:{read:owner,create:deny,update:deny,delete:deny},admin:{group:'Financeiro',description},fields:fields.map(field=>{if(field.type!=='ui'&&field.type!=='join'){field.admin??={};field.admin.readOnly=true}return field})})

export const CommercialSettlementEvidence=privateImmutable('commercial-settlement-evidence','Movimento de recebimento conferido pelo owner; não é calculado do bruto/líquido e não autentica relatório externo.',[
 text('key',true,true),text('requestHash'),{name:'provider',type:'select',required:true,options:[...commercialProviders]},text('accountKey'),text('externalTransactionId'),text('transactionKey'),
 text('currency'),{name:'direction',type:'select',required:true,options:['credit','debit']},amount('amountCents'),text('settlementReference'),{name:'sourceKind',type:'select',required:true,options:['provider_report','manual_reconciliation']},text('sourceReference'),text('recordReference'),
 relationship('supersedes','commercial-settlement-evidence',false,true),{name:'evidenceVerified',type:'checkbox',required:true},relationship('actor','admin-users',true),date('settledAt'),date('recordedAt'),
])

export const FinancialCostEntries=privateImmutable('financial-cost-entries','Custo operacional versionado. Confirmado e estimado permanecem separados; substituições mantêm a trilha anterior.',[
 text('key',true,true),text('requestHash'),{name:'category',type:'select',required:true,options:['advertising','commission','production','software','operations','other']},amount('amountCents'),text('currency'),
 relationship('campaign','campaigns'),{name:'classification',type:'select',required:true,options:['confirmed','estimated']},{name:'sourceKind',type:'select',required:true,options:['invoice','provider_report','manual_reconciliation']},text('sourceReference'),text('recordReference'),
 relationship('supersedes','financial-cost-entries',false,true),relationship('actor','admin-users',true),date('incurredAt'),date('recordedAt'),
])

export const financialLedgerCollections=[CommercialSettlementEvidence,FinancialCostEntries]

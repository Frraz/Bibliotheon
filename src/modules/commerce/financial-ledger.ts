import {financialDimensions} from './financial-report-dimensions'
import {attributedCampaign} from './campaign-attribution'
import {financialCohort} from './financial-report-cohort'
import type {Payload,PayloadRequest,Where} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import {atomic,serial} from '../marketing/transaction'
import {lockCommercialAccounts} from './lock'
import {commercialProviders,commercialTransactionKey,opaqueID,type AccountScope} from './events'
import {hashImport,requireImportOwner,type ImportActor} from './import-plan'

export class FinancialLedgerError extends Error{constructor(readonly status:number,readonly code:string){super(code)}}
const alias=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_-]{2,95}$/.test(v)
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const currency=(v:unknown):v is string=>typeof v==='string'&&/^[A-Z]{3}$/.test(v)
const instant=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null
const relationId=(v:unknown)=>typeof v==='string'?v:v&&typeof v==='object'&&'id'in v?String(v.id):null
const requireTime=(v:unknown,now:number)=>{const value=instant(v);if(!value||Date.parse(value)>now+300000)throw new FinancialLedgerError(422,'invalid_financial_time');return value}
const requireMoney=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new FinancialLedgerError(422,'invalid_amount');return v}
const strictObject=(value:unknown,required:string[],optional:string[]=[]):Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new FinancialLedgerError(422,'invalid_financial_record')
 const row=value as Record<string,unknown>,keys=Object.keys(row)
 if(required.some(key=>!Object.hasOwn(row,key))||keys.some(key=>!required.includes(key)&&!optional.includes(key)))throw new FinancialLedgerError(422,'invalid_financial_record')
 return row
}
const dbFor=async(payload:Payload,req:PayloadRequest,readOnly=false)=>{const id=await req.transactionID,db=id&&(payload.db as unknown as PostgresAdapter).sessions[id]?.db;if(!db)throw new FinancialLedgerError(503,'transaction_unavailable');if(readOnly)await db.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);await db.execute(sql`SET LOCAL statement_timeout='5s'`);return db}
const owner=(actor:ImportActor)=>requireImportOwner(actor)

export type SettlementInput=AccountScope&{externalTransactionId:string;currency:string;direction:'credit'|'debit';amountCents:number;settlementReference:string;settledAt:string;sourceKind:'provider_report'|'manual_reconciliation';sourceReference:string;recordReference:string;evidenceVerified:true;supersedes?:string|null}
function settlementInput(value:unknown,now:number):SettlementInput{
 const row=strictObject(value,['provider','accountKey','externalTransactionId','currency','direction','amountCents','settlementReference','settledAt','sourceKind','sourceReference','recordReference','evidenceVerified'],['supersedes'])
 if(!commercialProviders.includes(row.provider as AccountScope['provider'])||!opaqueID(row.accountKey)||!opaqueID(row.externalTransactionId)||!currency(row.currency)||!['credit','debit'].includes(String(row.direction))||!['provider_report','manual_reconciliation'].includes(String(row.sourceKind))||!alias(row.settlementReference)||!alias(row.sourceReference)||!alias(row.recordReference)||row.evidenceVerified!==true||row.supersedes!==undefined&&row.supersedes!==null&&!uuid(row.supersedes))throw new FinancialLedgerError(422,'invalid_settlement_evidence')
 return{provider:row.provider as AccountScope['provider'],accountKey:row.accountKey,externalTransactionId:row.externalTransactionId,currency:row.currency,direction:row.direction as 'credit'|'debit',amountCents:requireMoney(row.amountCents),settlementReference:row.settlementReference,settledAt:requireTime(row.settledAt,now),sourceKind:row.sourceKind as SettlementInput['sourceKind'],sourceReference:row.sourceReference,recordReference:row.recordReference,evidenceVerified:true,supersedes:row.supersedes==null?null:(row.supersedes as string).toLowerCase()}
}
const settlementKey=(input:SettlementInput)=>hashImport([input.provider,input.accountKey,input.sourceKind,input.sourceReference,input.recordReference])
async function settlementReplacement(payload:Payload,input:SettlementInput,req:PayloadRequest){
 if(!input.supersedes)return
 const old=await payload.findByID({collection:'commercial-settlement-evidence',id:input.supersedes,depth:0,overrideAccess:true,disableErrors:true,req})
 if(!old||old.transactionKey!==commercialTransactionKey(input)||old.currency!==input.currency||old.settlementReference!==input.settlementReference||old.sourceKind!==input.sourceKind||old.sourceReference!==input.sourceReference)throw new FinancialLedgerError(422,'invalid_settlement_replacement')
 const child=await payload.find({collection:'commercial-settlement-evidence',where:{supersedes:{equals:input.supersedes}},limit:1,depth:0,overrideAccess:true,req})
 if(child.docs.length)throw new FinancialLedgerError(409,'settlement_already_replaced')
}
/** Explicit per-transaction allocation of a reported cash movement; never derived from gross or producer net. */
export async function recordSettlementEvidence(payload:Payload,actor:ImportActor,value:unknown,now=Date.now()){
 const user=owner(actor),input=settlementInput(value,now),key=settlementKey(input),requestHash=hashImport(input),transactionKey=commercialTransactionKey(input)
 return atomic(payload,async req=>{
  await dbFor(payload,req);await lockCommercialAccounts(req,[input]);await serial(req,'settlement-evidence:'+key)
  const old=(await payload.find({collection:'commercial-settlement-evidence',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(old){if(old.requestHash!==requestHash)throw new FinancialLedgerError(409,'settlement_record_conflict');return{id:old.id,key,duplicate:true,received:false}}
  const tx=(await payload.find({collection:'transactions',where:{key:{equals:transactionKey}},limit:1,depth:0,overrideAccess:true,req,select:{key:true,provider:true,accountKey:true,externalTransactionId:true,state:true,currency:true,approvedAt:true,needsReview:true}})).docs[0]
  if(!tx||tx.needsReview||!['approved','partially_refunded','refunded','chargeback'].includes(tx.state)||!tx.approvedAt||tx.currency!==input.currency)throw new FinancialLedgerError(409,'settlement_transaction_unverified')
  await settlementReplacement(payload,input,req)
  const created=await payload.create({collection:'commercial-settlement-evidence',overrideAccess:true,req,data:{key,requestHash,provider:input.provider,accountKey:input.accountKey,externalTransactionId:input.externalTransactionId,transactionKey,currency:input.currency,direction:input.direction,amountCents:input.amountCents,settlementReference:input.settlementReference,sourceKind:input.sourceKind,sourceReference:input.sourceReference,recordReference:input.recordReference,supersedes:input.supersedes,evidenceVerified:true,actor:user.id,settledAt:input.settledAt,recordedAt:new Date(now).toISOString()}})
  return{id:created.id,key,duplicate:false,received:false}
 })
}

export type CostInput={category:'advertising'|'commission'|'production'|'software'|'operations'|'other';amountCents:number;currency:string;campaignId:string|null;classification:'confirmed'|'estimated';sourceKind:'invoice'|'provider_report'|'manual_reconciliation';sourceReference:string;recordReference:string;incurredAt:string;supersedes:string|null}
function costInput(value:unknown,now:number):CostInput{
 const row=strictObject(value,['category','amountCents','currency','campaignId','classification','sourceKind','sourceReference','recordReference','incurredAt'],['supersedes'])
 if(!['advertising','commission','production','software','operations','other'].includes(String(row.category))||!currency(row.currency)||!['confirmed','estimated'].includes(String(row.classification))||!['invoice','provider_report','manual_reconciliation'].includes(String(row.sourceKind))||!alias(row.sourceReference)||!alias(row.recordReference)||row.campaignId!==null&&!uuid(row.campaignId)||row.supersedes!==undefined&&row.supersedes!==null&&!uuid(row.supersedes))throw new FinancialLedgerError(422,'invalid_cost_entry')
 return{category:row.category as CostInput['category'],amountCents:requireMoney(row.amountCents),currency:row.currency,campaignId:row.campaignId as string|null,classification:row.classification as CostInput['classification'],sourceKind:row.sourceKind as CostInput['sourceKind'],sourceReference:row.sourceReference,recordReference:row.recordReference,incurredAt:requireTime(row.incurredAt,now),supersedes:row.supersedes==null?null:(row.supersedes as string).toLowerCase()}
}
const costKey=(input:CostInput)=>hashImport([input.sourceKind,input.sourceReference,input.recordReference])
async function costReplacement(payload:Payload,input:CostInput,req:PayloadRequest){
 if(!input.supersedes)return
 const old=await payload.findByID({collection:'financial-cost-entries',id:input.supersedes,depth:0,overrideAccess:true,disableErrors:true,req})
 if(!old||old.category!==input.category||old.currency!==input.currency||relationId(old.campaign)!==input.campaignId||old.sourceKind!==input.sourceKind||old.sourceReference!==input.sourceReference)throw new FinancialLedgerError(422,'invalid_cost_replacement')
 const child=await payload.find({collection:'financial-cost-entries',where:{supersedes:{equals:input.supersedes}},limit:1,depth:0,overrideAccess:true,req})
 if(child.docs.length)throw new FinancialLedgerError(409,'cost_already_replaced')
}
/** Costs are explicit owner records; estimated amounts remain distinguishable from confirmed values. */
export async function recordFinancialCost(payload:Payload,actor:ImportActor,value:unknown,now=Date.now()){
 const user=owner(actor),input=costInput(value,now),key=costKey(input),requestHash=hashImport(input)
 return atomic(payload,async req=>{
  await dbFor(payload,req);await serial(req,'financial-cost:'+key)
  const old=(await payload.find({collection:'financial-cost-entries',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(old){if(old.requestHash!==requestHash)throw new FinancialLedgerError(409,'cost_record_conflict');return{id:old.id,key,duplicate:true}}
  if(input.campaignId){const campaign=await payload.findByID({collection:'campaigns',id:input.campaignId,depth:0,overrideAccess:true,disableErrors:true,req});if(!campaign)throw new FinancialLedgerError(422,'invalid_cost_campaign')}
  await costReplacement(payload,input,req)
  const {campaignId,...entry}=input
  const created=await payload.create({collection:'financial-cost-entries',overrideAccess:true,req,data:{key,requestHash,...entry,campaign:campaignId,actor:user.id,recordedAt:new Date(now).toISOString()}})
  return{id:created.id,key,duplicate:false}
 })
}

export type FinancialReportRequest={from:string;through:string;currency?:string}
function reportRequest(value:unknown,now:number):{from:string;through:string;until:string;currency?:string}{
 const row=strictObject(value,['from','through'],['currency'])
 const day=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(Date.parse(v+'T00:00:00Z')).toISOString().slice(0,10)===v?v:null
 const from=day(row.from),through=day(row.through)
 if(!from||!through||from>through||Date.parse(through+'T00:00:00Z')>now||Date.parse(through+'T00:00:00Z')-Date.parse(from+'T00:00:00Z')>366*86400000||row.currency!==undefined&&!currency(row.currency))throw new FinancialLedgerError(422,'invalid_report_period')
 return{from,through,until:new Date(Date.parse(through+'T00:00:00Z')+86400000).toISOString(),...(row.currency?{currency:row.currency as string}:{})}
}
type TxRow={id:string;key:string;provider:AccountScope['provider'];accountKey:string;externalTransactionId:string;currency:string;state:string;approvedAt:string|null;grossCents:number|null;refundedCents:number|null;chargebackCents:number|null;feesCents:number|null;producerNetCents:number|null;needsReview:boolean;projection?:{refundAndChargebackOverlap?:boolean;externalClickReference?:string|null}|null;effectiveEbook?:string|null;ebook?:string|null;effectiveOffer?:string|null;offer?:string|null;lastSuccessAt?:string|null}
type SettlementRow={id:string;provider:AccountScope['provider'];transactionKey:string;currency:string;direction:'credit'|'debit';amountCents:number;settledAt:string;supersedes?:string|null}
type CostRow={id:string;currency:string;amountCents:number;incurredAt:string;classification:'confirmed'|'estimated';category:string;campaign?:string|null;supersedes?:string|null}
const sum=(values:number[])=>values.reduce((total,value)=>total+BigInt(value),BigInt(0))
const safe=(value:bigint)=>value<=BigInt(Number.MAX_SAFE_INTEGER)&&value>=BigInt(Number.MIN_SAFE_INTEGER)?Number(value):null
const publicOwner=owner
/** Bounded read-only accounting snapshot; unknown fields remain null and currencies are never converted. */
export async function previewFinancialReport(payload:Payload,actor:ImportActor,value:unknown,now=Date.now()){
 publicOwner(actor);const period=reportRequest(value,now)
 return atomic(payload,async req=>{
  await dbFor(payload,req,true)
  const paidStates=['approved','partially_refunded','refunded','chargeback']
  const candidateStates:Where={or:[{state:{in:paidStates}},{needsReview:{equals:true}}]}
  const txWhere:Where={and:[candidateStates,{approvedAt:{greater_than_equal:period.from+'T00:00:00.000Z'}},{approvedAt:{less_than:period.until}},...(period.currency?[{currency:{equals:period.currency}}]:[])]}
  const missingApprovalDates=await payload.count({collection:'transactions',where:{and:[candidateStates,{approvedAt:{equals:null}},...(period.currency?[{currency:{equals:period.currency}}]:[])]},overrideAccess:true,req})
  const missingReviewDates=await payload.count({collection:'transactions',where:{and:[{needsReview:{equals:true}},{approvedAt:{equals:null}},...(period.currency?[{currency:{equals:period.currency}}]:[])]},overrideAccess:true,req})
  const txResult=await payload.find({collection:'transactions',where:txWhere,sort:'approvedAt',limit:10001,depth:0,overrideAccess:true,req,select:{key:true,provider:true,accountKey:true,externalTransactionId:true,currency:true,state:true,approvedAt:true,grossCents:true,refundedCents:true,chargebackCents:true,feesCents:true,producerNetCents:true,needsReview:true,projection:true,effectiveEbook:true,ebook:true,effectiveOffer:true,offer:true,lastSuccessAt:true}})
  const settlementResult=await payload.find({collection:'commercial-settlement-evidence',limit:10001,depth:0,overrideAccess:true,req,select:{id:true,provider:true,transactionKey:true,currency:true,direction:true,amountCents:true,settledAt:true,supersedes:true}})
  const costResult=await payload.find({collection:'financial-cost-entries',limit:10001,depth:0,overrideAccess:true,req,select:{id:true,currency:true,amountCents:true,incurredAt:true,classification:true,category:true,campaign:true,supersedes:true}})
  if([txResult.totalDocs,settlementResult.totalDocs,costResult.totalDocs].some(count=>count>10000))throw new FinancialLedgerError(503,'report_history_limit')
  const txs=txResult.docs as unknown as TxRow[],settlements=settlementResult.docs as unknown as SettlementRow[],costs=costResult.docs as unknown as CostRow[]
  const current=<T extends {id:string;supersedes?:string|null}>(rows:T[]):T[]=>{const replaced=new Set(rows.flatMap(row=>row.supersedes?[row.supersedes]:[]));return rows.filter(row=>!replaced.has(row.id))}
  const activeSettlements=current(settlements).filter(row=>row.settledAt>=period.from+'T00:00:00.000Z'&&row.settledAt<period.until&&(!period.currency||row.currency===period.currency)),activeCosts=current(costs).filter(row=>row.incurredAt>=period.from+'T00:00:00.000Z'&&row.incurredAt<period.until&&(!period.currency||row.currency===period.currency))
  const cashMetadata=new Map(txs.map(row=>[row.key,row])),missingCashKeys=[...new Set(activeSettlements.map(row=>row.transactionKey))].filter(key=>!cashMetadata.has(key))
  for(let offset=0;offset<missingCashKeys.length;offset+=200){
   const linked=await payload.find({collection:'transactions',where:{key:{in:missingCashKeys.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{key:true,provider:true,accountKey:true,externalTransactionId:true,currency:true,state:true,approvedAt:true,grossCents:true,refundedCents:true,chargebackCents:true,feesCents:true,producerNetCents:true,needsReview:true,projection:true,ebook:true,effectiveEbook:true,offer:true,effectiveOffer:true,lastSuccessAt:true}})
   if(linked.totalDocs>200)throw new FinancialLedgerError(503,'report_history_limit')
   for(const row of linked.docs)cashMetadata.set(row.key,row as unknown as TxRow)
  }
  const clickIds=[...new Set(txs.flatMap(row=>{const reference=row.projection?.externalClickReference;return typeof reference==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(reference)?[reference.toLowerCase()]:[]}))],clicks=new Map<string,{id:string;provider:string;ebook:unknown;offer:unknown;campaign:unknown;attributionAllowed:boolean;occurredAt:string}>()
  for(let offset=0;offset<clickIds.length;offset+=200){
   const result=await payload.find({collection:'checkout-clicks',where:{id:{in:clickIds.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{provider:true,ebook:true,offer:true,campaign:true,attributionAllowed:true,occurredAt:true}})
   if(result.totalDocs>200)throw new FinancialLedgerError(503,'report_history_limit')
   for(const row of result.docs)clicks.set(row.id,row as unknown as {id:string;provider:string;ebook:unknown;offer:unknown;campaign:unknown;attributionAllowed:boolean;occurredAt:string})
  }
  const clickOfferIds=[...new Set([...clicks.values()].flatMap(click=>{const id=relationId(click.offer);return id?[id]:[]}))],clickOffers=new Map<string,{provider:string;accountKey:string;ebook:unknown}>()
  for(let offset=0;offset<clickOfferIds.length;offset+=200){
   const result=await payload.find({collection:'offers',where:{id:{in:clickOfferIds.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{provider:true,accountKey:true,ebook:true}})
   if(result.totalDocs>200)throw new FinancialLedgerError(503,'report_history_limit')
   for(const offer of result.docs)clickOffers.set(offer.id,offer as unknown as {provider:string;accountKey:string;ebook:unknown})
  }
  const txsWithAttribution=txs.map(row=>{
   const click=typeof row.projection?.externalClickReference==='string'?clicks.get(row.projection.externalClickReference.toLowerCase()):undefined
   const bookId=relationId(row.effectiveEbook)||relationId(row.ebook),offerId=relationId(row.effectiveOffer)||relationId(row.offer)
   const offer=click?clickOffers.get(relationId(click.offer)||''):undefined
   const attributedCampaignId=attributedCampaign({provider:row.provider,accountKey:row.accountKey,needsReview:row.needsReview,approvedAt:row.approvedAt,clickReference:row.projection?.externalClickReference||null,ebookId:bookId,offerId},{id:click?.id||'',provider:click?.provider as AccountScope['provider'],attributionAllowed:click?.attributionAllowed===true,occurredAt:click?.occurredAt||'',ebookId:relationId(click?.ebook),offerId:relationId(click?.offer),campaignId:relationId(click?.campaign)},{provider:offer?.provider as AccountScope['provider'],accountKey:offer?.accountKey||'',ebookId:relationId(offer?.ebook)})
   return{...row,attributedCampaign:attributedCampaignId}
  })
  const rawDimensions=financialDimensions(txsWithAttribution,activeSettlements,activeCosts,[...cashMetadata.values()],now)
  const bookIds=[...new Set(rawDimensions.byBook.flatMap(row=>row.ebookId?[row.ebookId]:[]))],campaignIds=[...new Set(rawDimensions.byCampaign.flatMap(row=>row.campaignId?[row.campaignId]:[]))],bookTitles=new Map<string,string>(),campaignCodes=new Map<string,string>()
  for(let offset=0;offset<bookIds.length;offset+=200){const books=await payload.find({collection:'ebooks',where:{id:{in:bookIds.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{title:true}});for(const row of books.docs)bookTitles.set(row.id,row.title)}
  for(let offset=0;offset<campaignIds.length;offset+=200){const campaigns=await payload.find({collection:'campaigns',where:{id:{in:campaignIds.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{code:true}});for(const row of campaigns.docs)campaignCodes.set(row.id,row.code)}
  const dimensions={...rawDimensions,byBook:rawDimensions.byBook.map(row=>({...row,ebookTitle:row.ebookId?bookTitles.get(row.ebookId)||null:null})),byCampaign:rawDimensions.byCampaign.map(row=>({...row,campaignCode:row.campaignId?campaignCodes.get(row.campaignId)||null:null}))}
  const currencies=new Set([...txs.map(row=>row.currency),...activeSettlements.map(row=>row.currency),...activeCosts.map(row=>row.currency)])
  const summaries=[...currencies].sort().map(code=>{
   const rows=txsWithAttribution.filter(row=>row.currency===code&&!row.needsReview),settled=activeSettlements.filter(row=>row.currency===code),expenses=activeCosts.filter(row=>row.currency===code)
   const quarantined=txs.filter(row=>row.currency===code&&row.needsReview)
   const cohortKeys=new Set(txs.filter(row=>row.currency===code).map(row=>row.key)),reviewKeys=new Set(quarantined.map(row=>row.key)),knownSettlements=new Set(settled.filter(row=>cohortKeys.has(row.transactionKey)).map(row=>row.transactionKey))
   const grossKnown=rows.filter(row=>row.grossCents!==null),refundKnown=rows.filter(row=>row.refundedCents!==null),chargebackKnown=rows.filter(row=>row.chargebackCents!==null),feesKnown=rows.filter(row=>row.feesCents!==null),netKnown=rows.filter(row=>row.producerNetCents!==null)
   const overlap=rows.filter(row=>row.projection?.refundAndChargebackOverlap===true),unknownOverlap=rows.filter(row=>row.projection?.refundAndChargebackOverlap!==false),unknownReversal=rows.filter(row=>row.refundedCents===null||row.chargebackCents===null)
   const received=settled,confirmedCosts=expenses.filter(row=>row.classification==='confirmed'),estimatedCosts=expenses.filter(row=>row.classification==='estimated')
   const gross=rows.length>0&&grossKnown.length===rows.length?safe(sum(grossKnown.map(row=>row.grossCents!))):null,refund=rows.length>0&&refundKnown.length===rows.length?safe(sum(refundKnown.map(row=>row.refundedCents!))):null,chargeback=rows.length>0&&chargebackKnown.length===rows.length?safe(sum(chargebackKnown.map(row=>row.chargebackCents!))):null,fee=rows.length>0&&feesKnown.length===rows.length?safe(sum(feesKnown.map(row=>row.feesCents!))):null,net=rows.length>0&&netKnown.length===rows.length?safe(sum(netKnown.map(row=>row.producerNetCents!))):null
   const cashCredits=sum(received.filter(row=>row.direction==='credit').map(row=>row.amountCents)),cashDebits=sum(received.filter(row=>row.direction==='debit').map(row=>row.amountCents)),cash=received.length?safe(cashCredits-cashDebits):null
   const confirmedCost=confirmedCosts.length?safe(sum(confirmedCosts.map(row=>row.amountCents))):null,estimatedCost=estimatedCosts.length?safe(sum(estimatedCosts.map(row=>row.amountCents))):null,knownContribution=gross===null||refund===null||chargeback===null||fee===null||confirmedCost===null||overlap.length>0||unknownOverlap.length>0?null:safe(BigInt(gross)-BigInt(refund)-BigInt(chargeback)-BigInt(fee)-BigInt(confirmedCost))
   const afterReversals=gross===null||refund===null||chargeback===null||overlap.length>0||unknownOverlap.length>0?null:safe(BigInt(gross)-BigInt(refund)-BigInt(chargeback))
   const overflowFields=[...(rows.length&&grossKnown.length===rows.length&&gross===null?['gross']:[]),...(rows.length&&refundKnown.length===rows.length&&refund===null?['refunded']:[]),...(rows.length&&chargebackKnown.length===rows.length&&chargeback===null?['chargeback']:[]),...(rows.length&&feesKnown.length===rows.length&&fee===null?['fees']:[]),...(rows.length&&netKnown.length===rows.length&&net===null?['producer_net']:[]),...(received.length&&safe(cashCredits)===null?['cash_credits']:[]),...(received.length&&safe(cashDebits)===null?['cash_debits']:[]),...(received.length&&cash===null?['received']:[]),...(confirmedCosts.length&&confirmedCost===null?['confirmed_costs']:[]),...(estimatedCosts.length&&estimatedCost===null?['estimated_costs']:[]),...(gross!==null&&refund!==null&&chargeback!==null&&!overlap.length&&!unknownOverlap.length&&afterReversals===null?['after_reversals']:[]),...(gross!==null&&refund!==null&&chargeback!==null&&fee!==null&&confirmedCost!==null&&!overlap.length&&!unknownOverlap.length&&knownContribution===null?['pre_tax_subtotal']:[])]
   const completeContribution=knownContribution!==null&&grossKnown.length===rows.length&&refundKnown.length===rows.length&&chargebackKnown.length===rows.length&&feesKnown.length===rows.length&&unknownOverlap.length===0&&estimatedCosts.length===0&&quarantined.length===0
   return{currency:code,approvedTransactions:rows.length,transactionsInReview:quarantined.length,grossCents:gross,grossCoverage:{known:grossKnown.length,total:rows.length},refundedCents:refund,refundCoverage:{known:refundKnown.length,total:rows.length},chargebackCents:chargeback,chargebackCoverage:{known:chargebackKnown.length,total:rows.length},refundChargebackOverlapTransactions:overlap.length,refundChargebackOverlapUnknownTransactions:unknownOverlap.length,afterKnownReversalsCents:afterReversals,feesCents:fee,feeCoverage:{known:feesKnown.length,total:rows.length},producerNetReportedCents:net,producerNetCoverage:{known:netKnown.length,total:rows.length},receivedCents:cash,receivedCoverage:{transactionsWithEvidence:knownSettlements.size,transactionsInReviewWithEvidence:new Set(received.filter(row=>reviewKeys.has(row.transactionKey)).map(row=>row.transactionKey)).size,transactionsWithCashInPeriod:new Set(received.map(row=>row.transactionKey)).size,creditsCents:received.length?safe(cashCredits):null,debitsCents:received.length?safe(cashDebits):null},confirmedCostsCents:confirmedCost,estimatedCostsCents:estimatedCost,costCoverage:{confirmed:confirmedCosts.length,estimated:estimatedCosts.length,shared:expenses.filter(row=>!row.campaign).length},estimatedPreTaxContributionCents:completeContribution?knownContribution:null,knownPreTaxSubtotalCents:knownContribution,marginComplete:false,arithmeticOverflowFields:overflowFields,marginIncompleteReasons:[...(overflowFields.length?['amount_overflow']:[]),...(unknownReversal.length?['reversal_amount_unknown']:[]),...(overlap.length?['refund_chargeback_overlap']:[]),...(unknownOverlap.length?['refund_chargeback_overlap_unknown']:[]),...(grossKnown.length<rows.length?['gross_amount_unknown']:[]),...(feesKnown.length<rows.length?['fees_unknown']:[]),...(confirmedCost===null?['confirmed_cost_coverage_unknown']:[]),...(estimatedCosts.length?['estimated_costs_present']:[]),...(quarantined.length?['transactions_in_review']:[]),'taxes_not_recorded']}
  })
  const cohorts=new Map<string,Map<string,TxRow[]>>()
  for(const tx of txs){const month=tx.approvedAt!.slice(0,7),group=cohorts.get(tx.currency)??new Map<string,TxRow[]>(),values=group.get(month)??[];values.push(tx);group.set(month,values);cohorts.set(tx.currency,group)}
  return{provisional:true,dimensions,observedAt:new Date(now).toISOString(),from:period.from,through:period.through,timezone:'UTC',transactionApprovalDateCoverage:{includedInWindow:txResult.totalDocs,inReviewIncluded:txs.filter(row=>row.needsReview).length,missingDateExcluded:missingApprovalDates.totalDocs,inReviewMissingDateExcluded:missingReviewDates.totalDocs},currencies:summaries,cohorts:[...cohorts].flatMap(([code,months])=>[...months].map(([month,rows])=>({currency:code,approvedMonth:month,...financialCohort(rows,now)}))).sort((a,b)=>a.currency.localeCompare(b.currency)||a.approvedMonth.localeCompare(b.approvedMonth)),settlementPeriod:{from:period.from,through:period.through},costPeriod:{from:period.from,through:period.through}}
 })
}

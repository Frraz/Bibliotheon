import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce} from '../fixtures/commerce'
import {commercialTransactionKey} from '../../src/modules/commerce/events'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[]
const paths={settlement:'/api/v1/admin/settlement-evidence',cost:'/api/v1/admin/financial-costs',report:'/api/v1/admin/financial-report/preview'}
const post=(path:string,body:unknown,headers:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})
try{
 const login=await post('/api/admin-users/login',{email:seed.owner.email,password:seed.password});assert.equal(login.status,200);const {token}=await login.json(),auth={Authorization:`JWT ${token}`}
 await payload.create({collection:'transactions',overrideAccess:true,data:{key:commercialTransactionKey({provider:'hotmart',accountKey:'synthetic',externalTransactionId:'financial-ledger-http'}),provider:'hotmart',accountKey:'synthetic',externalTransactionId:'financial-ledger-http',externalProductId:'synthetic-product',externalOfferId:null,ebook:seed.books[0].id,offer:seed.offers[0].id,state:'approved',currency:'BRL',grossCents:10000,refundedCents:0,chargebackCents:0,feesCents:500,producerNetCents:9500,approvedAt:'2026-10-20T12:00:00.000Z',lastEventAt:'2026-10-20T12:00:00.000Z',needsReview:false,projection:{refundAndChargebackOverlap:false}}})
 const settlement={provider:'hotmart',accountKey:'synthetic',externalTransactionId:'financial-ledger-http',currency:'BRL',direction:'credit',amountCents:9500,settlementReference:'synthetic-payout',settledAt:'2026-10-23T00:00:00.000Z',sourceKind:'provider_report',sourceReference:'synthetic-bank-report',recordReference:'synthetic-bank-line',evidenceVerified:true}
 assert.equal((await post(paths.settlement,settlement)).status,403)
 assert.equal((await post(paths.settlement,settlement,{...auth,Origin:'https://other.invalid'})).status,403)
 assert.equal((await post(paths.settlement,settlement,{...auth,'Content-Type':'text/csv'})).status,415)
 const saved=await post(paths.settlement,settlement,auth);assert.equal(saved.status,201);assert.equal(saved.headers.get('cache-control'),'private, no-store');assert.equal(saved.headers.get('referrer-policy'),'no-referrer');const savedBody=await saved.json()
 assert.equal((await post(paths.settlement,settlement,auth)).status,200)
 assert.equal((await post(paths.settlement,{...settlement,amountCents:9000},auth)).status,409)
 assert.equal((await post(paths.settlement,{...settlement,externalTransactionId:'missing-transaction',recordReference:'synthetic-missing-transaction-line'},auth)).status,409)
 const cost={category:'advertising',amountCents:1200,currency:'BRL',campaignId:null,classification:'confirmed',sourceKind:'invoice',sourceReference:'synthetic-invoice',recordReference:'synthetic-invoice-line',incurredAt:'2026-10-23T00:00:00.000Z'}
 const costSaved=await post(paths.cost,cost,auth);assert.equal(costSaved.status,201);assert.equal((await post(paths.cost,cost,auth)).status,200);assert.equal((await post(paths.cost,{...cost,amountCents:-1,recordReference:'synthetic-negative-line'},auth)).status,422)
 const report=await post(paths.report,{from:'2026-10-20',through:'2026-10-25'},auth);assert.equal(report.status,200);assert.equal(report.headers.get('cache-control'),'private, no-store');assert.equal(report.headers.get('referrer-policy'),'no-referrer');const result=await report.json(),brl=result.currencies.find((row:{currency:string})=>row.currency==='BRL');assert.equal(result.provisional,true);assert.equal(brl.receivedCents,9500);assert.equal(brl.confirmedCostsCents,1200);assert.equal(brl.marginComplete,false)
 assert.equal((await post(paths.report,{from:'2026-02-30',through:'2026-03-02'},auth)).status,422)
 for(const collection of ['commercial-settlement-evidence','financial-cost-entries']){assert.equal((await post('/api/'+collection,{},auth)).status,403);assert.equal((await fetch(base+'/api/'+collection)).status,403)}
 assert.equal((await fetch(base+'/api/commercial-settlement-evidence/'+savedBody.id,{method:'DELETE',headers:auth})).status,403)
 assert.equal((await payload.count({collection:'transaction-events',overrideAccess:true})).totalDocs,0)
 checks.push('HTTP owner/origem/MIME e coleções nativas protegem liquidação/custos; repetição idempotente, conflito e vínculo transacional não verificado são tratados sem escrita indevida.')
 checks.push('Prévia responde privada, limita datas, mantém recebido/custos separados e não afirma margem completa; cadastro não cria evento comercial.')
}finally{await seed.cleanup()}
await mkdir('artifacts/financial-ledger',{recursive:true});await writeFile('artifacts/financial-ledger/http-results.json',JSON.stringify({date:new Date().toISOString(),checks,schemaMigrations:28,externalCalls:false,limits:'HTTP local sintético; prova transcrita pelo owner, sem relatório nativo homologado, interface ou operação real.'},null,2)+'\n');console.log(`Ledger financeiro HTTP: ${checks.length} grupos aprovados; fixtures limpas.`);process.exit(0)

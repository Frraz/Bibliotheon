import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import type {PostgresAdapter} from '@payloadcms/db-postgres'
import {seedAnalytics} from '../fixtures/analytics'
import {runAnalyticsRetention} from '../../src/modules/analytics/retention'
import {atomic} from '../../src/modules/marketing/transaction'
import {down} from '../../migrations/20261025_185933_analytics_retention'
if(process.env.BIBLIOTHEON_SYNTHETIC_TESTS!=='true')throw new Error('Confirme ambiente sintético exclusivo; nunca executar limpeza contra dados reais.')
const seed=await seedAnalytics(),{payload}=seed,now=Date.parse('2026-10-25T12:00:00.000Z'),old='2026-07-01T10:00:00.000Z',checks:string[]=[]
try{
 const grant=await payload.create({collection:'analytics-grants',overrideAccess:true,data:{tokenHash:'a'.repeat(64),consentVersion:'synthetic-v1',grantedAt:old,expiresAt:'2027-01-01T00:00:00.000Z',attributionExpiresAt:'2026-07-31T00:00:00.000Z'}})
 const visit=await payload.create({collection:'visits',overrideAccess:true,data:{grant:grant.id,startedAt:old,lastSeenAt:old,expiresAt:'2026-07-01T10:30:00.000Z'}})
 await payload.update({collection:'analytics-grants',id:grant.id,overrideAccess:true,data:{currentVisit:visit.id,firstTouch:{kind:'campaign',campaign:seed.campaign.id},lastNonDirectTouch:{kind:'campaign',campaign:seed.campaign.id}}})
 const contextOnly=await payload.create({collection:'analytics-grants',overrideAccess:true,data:{tokenHash:'b'.repeat(64),consentVersion:'synthetic-v1',grantedAt:old,expiresAt:'2027-01-01T00:00:00.000Z',attributionExpiresAt:'2026-07-31T00:00:00.000Z',firstTouch:{kind:'campaign',campaign:seed.campaign.id},lastNonDirectTouch:{kind:'campaign',campaign:seed.campaign.id}}})
 for(let i=0;i<2;i++)await payload.create({collection:'page-views',overrideAccess:true,data:{key:`retention-page-${i}`,visit:visit.id,pagePath:`/ebooks/${seed.books[0].slug}`,ebook:seed.books[0].id,campaign:seed.campaign.id,occurredAt:old}})
 await payload.create({collection:'checkout-clicks',overrideAccess:true,data:{offer:seed.offers[0].id,ebook:seed.books[0].id,provider:'hotmart',campaign:seed.campaign.id,visit:visit.id,attributionAllowed:true,occurredAt:old}})
 await payload.create({collection:'analytics-limits',overrideAccess:true,data:{key:'retention-expired-analytics',count:1,expiresAt:old}})
 await payload.create({collection:'request-limits',overrideAccess:true,data:{key:'retention-expired-request',count:1,expiresAt:old}})
 const preview=await runAnalyticsRetention(payload,{now})
 assert.equal(preview.mode,'preview');assert.equal(preview.candidates.pageViews,2);assert.equal(preview.candidates.checkoutClicks,1)
 assert.equal((await payload.count({collection:'page-views',overrideAccess:true})).totalDocs,2)
 assert.equal((await payload.count({collection:'analytics-daily-aggregates',overrideAccess:true})).totalDocs,0)
 checks.push('Prévia reporta apenas contagens e não altera eventos, permissões ou agregados.')
 const applied=await runAnalyticsRetention(payload,{now,apply:true})
 assert.equal(applied.processed.pageViews,2);assert.equal(applied.processed.checkoutClicks,1);assert.equal(applied.aggregatesUpdated,3)
 assert.equal((await payload.count({collection:'page-views',overrideAccess:true})).totalDocs,0)
 assert.equal((await payload.count({collection:'checkout-clicks',overrideAccess:true})).totalDocs,0)
 const aggregates=(await payload.find({collection:'analytics-daily-aggregates',depth:0,overrideAccess:true})).docs
 const page=aggregates.find(row=>row.kind==='page_view'),click=aggregates.find(row=>row.kind==='checkout_click')
 assert.equal(page?.count,2);assert.equal(click?.count,1)
 assert.equal(page?.pagePath,'/ebooks');assert.notEqual(page?.pagePath,`/ebooks/${seed.books[0].slug}`)
 assert.equal('visit'in page!,false);assert.equal('grant'in page!,false);assert.equal(page?.key?.length,64)
 assert.equal((await payload.count({collection:'visits',overrideAccess:true})).totalDocs,0)
 const retainedGrant=await payload.findByID({collection:'analytics-grants',id:grant.id,depth:0,overrideAccess:true})
 assert.equal(retainedGrant.currentVisit,null);assert.equal(retainedGrant.firstTouch,null);assert.equal(retainedGrant.lastNonDirectTouch,null)
 const clearedContext=await payload.findByID({collection:'analytics-grants',id:contextOnly.id,depth:0,overrideAccess:true})
 assert.equal(clearedContext.firstTouch,null);assert.equal(clearedContext.lastNonDirectTouch,null)
 assert.equal((await payload.count({collection:'analytics-limits',overrideAccess:true})).totalDocs,0)
 assert.equal((await payload.count({collection:'request-limits',overrideAccess:true})).totalDocs,0)
 checks.push('Aplicação agrega por dia/dimensão em uma transação por fonte, remove evento identificável, visita e limites expirados, preserva permissão ativa sem contexto de sessão; repetição é idempotente.')
 const repeated=await runAnalyticsRetention(payload,{now,apply:true})
 assert.equal(repeated.aggregatesUpdated,0);assert.equal((await payload.findByID({collection:'analytics-daily-aggregates',id:page!.id,depth:0,overrideAccess:true})).count,2)
 checks.push('Reexecução não duplica contagens; agregados não contêm UUID de clique, grant ou visita.')
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 checks.push('Downgrade recusa remover agregados históricos.')
}finally{await seed.cleanup()}
await mkdir('artifacts/analytics-retention',{recursive:true})
await writeFile('artifacts/analytics-retention/local-results.json',JSON.stringify({date:new Date().toISOString(),timezone:'UTC',checks,externalCalls:false,limits:'Fixtures PostgreSQL sintéticas; política de retenção de cadastro comercial e reaplicação pós-restore continuam fora desta etapa.'},null,2)+'\n')
console.log(`Retenção analítica: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)

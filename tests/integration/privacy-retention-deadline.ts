import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { atomic } from '../../src/modules/marketing/transaction'
import { contactFingerprint } from '../../src/modules/marketing/contact'
import { storeThemeWithdrawal } from '../../src/modules/marketing/theme-withdrawal'
import { runPrivacyRequestAuditRetention } from '../../src/modules/marketing/privacy-retention'
import { workerHealth } from '../../src/modules/marketing/retention-policy'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Somente banco sintético exclusivo.')
const seed=await seedRelationship(), {payload}=seed
const now=Date.now(), secret='synthetic-deadline-secret-'.padEnd(48,'x'), checks:string[]=[]
const network=globalThis.fetch
let externalCalls=0
globalThis.fetch=(async()=>{externalCalls++;throw new Error('Rede externa proibida.')}) as typeof fetch
async function fixture(scope:'global'|'theme',days:number,held=false) {
  const at=new Date(now-days*86400000).toISOString()
  const contact=await payload.create({collection:'contacts',overrideAccess:true,data:{email:`deadline-${randomUUID()}@example.invalid`,deliveryState:'ok',globalSuppressedAt:scope==='global'?at:null}})
  const sub=await payload.create({collection:'subscriptions',overrideAccess:true,data:{contact:contact.id,theme:seed.theme.id,key:`${contact.id}:${seed.theme.id}`,state:'unsubscribed',unsubscribedAt:at}})
  await atomic(payload,async req=>{
    if(scope==='theme')await storeThemeWithdrawal(req,contactFingerprint(contact.email,secret),seed.theme.id,at)
    const db=(payload.db as unknown as PostgresAdapter).sessions[(await req.transactionID)!].db
    await db.execute(sql`UPDATE subscriptions SET updated_at=${at}::timestamptz WHERE id=${sub.id}::uuid`)
  })
  const provider=held?await payload.create({collection:'brevo-registrations',overrideAccess:true,data:{contact:contact.id,revision:1,state:'canceled',attempts:0,nextAttemptAt:at}}):null
  return {contact,sub,provider}
}
try {
  const global=await fixture('global',28),theme=await fixture('theme',28),recentGlobal=await fixture('global',27),recentTheme=await fixture('theme',27)
  const lateGlobal=await fixture('global',35),lateTheme=await fixture('theme',35),heldGlobal=await fixture('global',40,true),heldTheme=await fixture('theme',40,true)
  const preview=await runPrivacyRequestAuditRetention(payload,{now,secret})
  assert.equal(preview.suppressedMarketing.eligible,2);assert.equal(preview.withdrawnThemes.eligible,2)
  assert.equal(preview.marketingDeadline.overdueSubscriptions,4)
  assert.equal((await payload.count({collection:'subscriptions',overrideAccess:true})).totalDocs,8)
  checks.push('preview sem escrita, cutoff inclusivo de 28 dias e contagem agregada de quatro assinaturas além de 30 dias')
  const applied=await runPrivacyRequestAuditRetention(payload,{now,secret,apply:true})
  for(const item of [global,theme,lateGlobal,lateTheme])assert.equal(await payload.findByID({collection:'subscriptions',id:item.sub.id,overrideAccess:true,disableErrors:true}),null)
  for(const item of [recentGlobal,recentTheme,heldGlobal,heldTheme])assert.ok(await payload.findByID({collection:'subscriptions',id:item.sub.id,overrideAccess:true}))
  assert.equal(applied.marketingDeadline.overdueSubscriptions,2);assert.equal(applied.marketingDeadline.reviewRequired,true)
  assert.equal((await payload.count({collection:'contacts',overrideAccess:true})).totalDocs,8)
  assert.equal((await payload.count({collection:'theme-withdrawals',overrideAccess:true})).totalDocs,4)
  checks.push('retira estado elegível antes do prazo máximo, preservando identidade, fatos, registros recentes e vínculos de provedor')
  const health=JSON.stringify({version:2,completedAt:now,overdueSubscriptions:applied.marketingDeadline.overdueSubscriptions,activeMarketingReviews:0})
  assert.equal(workerHealth(String(now),health,true,now),false)
  checks.push('heartbeat recente não esconde duas exceções antigas; health exige revisão em vez de apagar vínculos')
  // Synthetic dependency closure, never evidence of a real provider reconciliation.
  for(const item of [heldGlobal,heldTheme])await payload.delete({collection:'brevo-registrations',id:item.provider!.id,overrideAccess:true})
  const resolved=await runPrivacyRequestAuditRetention(payload,{now,secret,apply:true})
  assert.equal(resolved.marketingDeadline.overdueSubscriptions,0);assert.equal(resolved.marketingDeadline.reviewRequired,false)
  assert.equal(workerHealth(String(now),JSON.stringify({version:2,completedAt:now,overdueSubscriptions:0,activeMarketingReviews:0}),true,now),true)
  checks.push('nova execução após fechamento sintético das dependências remove backlog e permite saúde positiva sem renovar fatos')
  assert.equal(externalCalls,0)
  await mkdir('artifacts/privacy-retention',{recursive:true})
  await writeFile('artifacts/privacy-retention/d113-results.json',JSON.stringify({phase:'D113',date:new Date().toISOString(),environment:'PostgreSQL sintético exclusivo',checks,eligibilityDays:28,deadlineDays:30,successMaxAgeHours:25,preview:preview.marketingDeadline,applied:applied.marketingDeadline,resolved:resolved.marketingDeadline,externalCalls,realProviderReconciliationPerformed:false,productionChanged:false},null,2)+'\n')
  console.log(`Prazo de retenção: ${checks.length} grupos aprovados; elegibilidade antecipada e exceções visíveis.`)
} finally {globalThis.fetch=network;await seed.cleanup()}
process.exit(0)

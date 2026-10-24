import assert from 'node:assert/strict'
import { testOrigin } from '../fixtures/origin'
import { seedRelationship } from '../fixtures/relationship'
import { mkdir,writeFile } from 'node:fs/promises'
const token=process.env.BREVO_WEBHOOK_TOKEN
assert.equal(token,'w'.repeat(64),'Execute somente no QA com token explicitamente sintético.')
const seed=await seedRelationship(),{payload}=seed,checks:string[]=[]
const url=`${testOrigin}/api/webhooks/brevo`
const post=(value:unknown,authorized=true)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(authorized?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(value)})
try{
 const person=await payload.create({collection:'contacts',data:{email:'webhook-http@example.invalid',deliveryState:'ok'},overrideAccess:true})
 const now=Math.floor(Date.now()/1000),event={id:1,camp_id:999999,email:person.email,event:'spam',ts_sent:now-60,ts_event:now-10,reason:'synthetic-only',URL:'https://example.invalid/private'}
 assert.equal((await post(event,false)).status,401);assert.equal((await payload.count({collection:'brevo-webhook-events',overrideAccess:true})).totalDocs,0)
 const first=await post(event);assert.equal(first.status,200);assert.equal(await first.text(),'{"code":"accepted"}');assert.equal(first.headers.get('cache-control'),'private, no-store')
 assert.equal((await payload.findByID({collection:'contacts',id:person.id,overrideAccess:true})).deliveryState,'complaint')
 const row=(await payload.find({collection:'brevo-webhook-events',depth:0,overrideAccess:true})).docs[0];assert.equal(row.state,'quarantined');assert.equal(row.reason,'unknown_campaign');assert.equal(row.suppressionApplied,true)
 assert.equal(JSON.stringify(row).includes(person.email),false);assert.equal(JSON.stringify(row).includes('example.invalid/private'),false)
 checks.push('Rota autenticada real persiste envelope mínimo e supressão antes de ACK; credencial ausente não abre registro.')
 const retries=await Promise.all([post({...event,id:2}),post({...event,id:3})]);assert.equal(retries.every(r=>r.status===200),true)
 assert.equal((await payload.count({collection:'brevo-webhook-events',overrideAccess:true})).totalDocs,1);assert.equal((await payload.count({collection:'consent-events',where:{contact:{equals:person.id}},overrideAccess:true})).totalDocs,1)
 checks.push('Retries HTTP concorrentes com IDs distintos deduplicam envelope e auditoria.')
 assert.equal((await post({...event,reason:'x'.repeat(32768)})).status,413)
 assert.equal((await post([event])).status,422)
 assert.equal((await post({...event,ts_event:now+600})).status,422)
 assert.equal((await post({...event,event:'opened'})).status,200)
 assert.equal((await fetch(url)).status,405)
 assert.equal((await payload.count({collection:'brevo-webhook-events',overrideAccess:true})).totalDocs,1)
 checks.push('Corpo grande, batch não habilitado, data futura e método incorreto recusados; abertura ignorada sem métricas fictícias.')
}finally{await seed.cleanup()}
await mkdir('artifacts/brevo-webhook',{recursive:true})
await writeFile('artifacts/brevo-webhook/http-results.json',JSON.stringify({date:new Date().toISOString(),timezone:'America/Belem',origin:testOrigin,checks,externalCalls:false,realMessagesSent:0,limits:'Token e payloads sintéticos em QA loopback; sem homologação real.'},null,2)+'\n')
console.log(`Webhook HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)

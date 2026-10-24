import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce} from '../fixtures/commerce'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {processCommercialInbox} from '../../src/modules/commerce/inbox'
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],extras:string[]=[],path='/api/v1/admin/imports'
const fields=(id:string)=>{const row=[...csvFields];row[2]=id;row[4]='';return row}
try{
 const sourceHeaders={'Content-Type':'text/csv','X-Import-Source':'provider_report','X-Import-Reference':'report-http-synthetic','X-Import-Reason':'missing_webhook'}
 const post=(body:BodyInit,headers:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{...sourceHeaders,Origin:base,'Idempotency-Key':randomUUID(),...headers},body})
 assert.equal((await post(canonicalCSV([fields('denied')]))).status,403)
 const login=await fetch(base+'/api/admin-users/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:seed.owner.email,password:seed.password})});assert.equal(login.status,200)
 const {token}=await login.json() as {token:string};assert.ok(token);const auth={Authorization:`JWT ${token}`}
 assert.equal((await post(canonicalCSV([fields('bad-origin')]),{...auth,Origin:'https://other.invalid'})).status,403)
 assert.equal((await post(canonicalCSV([fields('bad-source')]),{...auth,'X-Import-Reference':'never-store@example.invalid'})).status,422)
 const bad=fields('invalid');bad[1]='never-store@example.invalid';assert.equal((await post(canonicalCSV([bad]),auth)).status,422)
 assert.equal((await payload.count({collection:'commercial-import-batches',overrideAccess:true})).totalDocs,0)
 checks.push('Rota de estágio real exige owner/origem e metadados controlados; entradas pessoais/invalidas não geram lote ou linha.')

 const row=fields('http-import-first'),key=randomUUID(),response=await post(canonicalCSV([row,row]),{...auth,'Idempotency-Key':key});assert.equal(response.status,201);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('cache-control'),'private, no-store')
 const batch=await response.json();assert.equal(batch.state,'ready');assert.ok(batch.id&&batch.planHash)
 const duplicate=await post(canonicalCSV([row,row]),{...auth,'Idempotency-Key':key});assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).id,batch.id)
 const commit=(id:string,value:unknown,extra:Record<string,string>={})=>fetch(base+path+'/'+id+'/commit',{method:'POST',headers:{...auth,Origin:base,'Content-Type':'application/json',...extra},body:JSON.stringify(value)})
 assert.equal((await commit(batch.id,{confirmed:false,planHash:batch.planHash})).status,422);assert.equal((await commit(batch.id,{confirmed:true,planHash:'0'.repeat(64)})).status,409)
 assert.equal((await commit(batch.id,{confirmed:true,planHash:batch.planHash},{Authorization:''})).status,403)
 const queued=await commit(batch.id,{confirmed:true,planHash:batch.planHash});assert.equal(queued.status,202);assert.equal(queued.headers.get('referrer-policy'),'no-referrer');assert.equal((await queued.json()).state,'queued')
 assert.equal((await commit(batch.id.toUpperCase(),{confirmed:true,planHash:batch.planHash})).status,200)
 assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,1);assert.equal((await payload.count({collection:'transactions',overrideAccess:true})).totalDocs,0)
 checks.push('201 cria plano durável; repetição recupera mesmo lote. Confirmação explícita/plano correto gera 202 e um recibo, sem aplicação antecipada; retry uppercase é idempotente.')

 const rows=await payload.find({collection:'commercial-import-rows',where:{batch:{equals:batch.id}},sort:'line',depth:0,overrideAccess:true});assert.equal(rows.totalDocs,2);const first=rows.docs[0];assert.equal(first.state,'queued');assert.ok(first.inbox)
 assert.equal((await processCommercialInbox(payload,typeof first.inbox==='string'?first.inbox:first.inbox.id)).state,'applied')
 const sale=(await payload.find({collection:'transactions',overrideAccess:true})).docs[0];assert.equal(sale.state,'approved');assert.equal(sale.grossCents,9990);assert.equal(sale.producerNetCents,null)
 const matchedResponse=await post(canonicalCSV([row]),auth),matched=await matchedResponse.json();assert.equal(matched.state,'ready');const matchedCommit=await commit(matched.id,{confirmed:true,planHash:matched.planHash});assert.equal(matchedCommit.status,200);assert.equal((await matchedCommit.json()).state,'confirmed');assert.equal((await payload.count({collection:'transaction-events',overrideAccess:true})).totalDocs,1)
 checks.push('Vínculo de linha leva à inbox. Processamento explícito aplica centavos/data com fonte CSV, sem líquido inferido; snapshot compatível confirma sem criar novo fato financeiro.')

 const stale=await(await post(canonicalCSV([fields('http-stale')]),auth)).json(),offer=await payload.create({collection:'offers',...seed.auth,data:{name:'Ambiguidade HTTP sintética',provider:'hotmart',accountKey:'synthetic',externalProductId:'synthetic-product',ebook:seed.books[1].id,active:false,currency:'BRL'}});extras.push(offer.id)
 const staleCommit=await commit(stale.id,{confirmed:true,planHash:stale.planHash});assert.equal(staleCommit.status,409);assert.equal((await staleCommit.json()).state,'stale');assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,1)
 for(const collection of ['commercial-import-batches','commercial-import-rows','commercial-import-audit'] as const){
  assert.equal((await fetch(base+'/api/'+collection)).status,403)
  const result=await fetch(base+'/api/'+collection,{headers:auth});assert.equal(result.status,200);const list=await result.json();assert.ok(list.docs.length)
  assert.equal((await fetch(base+'/api/'+collection,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:'{}'})).status,403)
  assert.equal((await fetch(base+'/api/'+collection+'/'+list.docs[0].id,{method:'PATCH',headers:{...auth,'Content-Type':'application/json'},body:'{}'})).status,403)
  assert.equal((await fetch(base+'/api/'+collection+'/'+list.docs[0].id,{method:'DELETE',headers:auth})).status,403)
  for(const doc of list.docs)assert.equal(JSON.stringify(doc).includes('never-store'),false)
 }
 assert.equal((await commit(randomUUID(),{confirmed:true,planHash:'a'.repeat(64)})).status,404)
 checks.push('Catálogo mudado invalida o plano com 409 sem importação parcial. Coleções permitem consulta owner e negam escrita direta/anônimo; lote inexistente retorna 404 e registros não contêm entrada rejeitada.')
}finally{
 for(const id of extras)await payload.delete({collection:'offers',id,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/commercial-imports',{recursive:true})
await writeFile('artifacts/commercial-imports/http-results.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,externalCalls:false,realSales:0,limits:'Next/PostgreSQL loopback, owner/CSV sintéticos. Confirmação enfileira e aplicação é explícita no teste. Sem conta/relatório nativo, resolução de conflitos, custos/liquidação, relatório ou UI customizada.'},null,2)+'\n')
console.log(`Importações HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)

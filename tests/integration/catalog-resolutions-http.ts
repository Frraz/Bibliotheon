import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce,seedLegacyOffer,clearCatalogResolutionFixtures,commercialCollections} from '../fixtures/commerce'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {processCommercialInbox} from '../../src/modules/commerce/inbox'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Somente banco/HTTP sintéticos.')
const seed=await seedCommerce(),{payload}=seed,extras:string[]=[],checks:string[]=[],path='/api/v1/admin/catalog-resolutions'
try{
 const choice={provider:'hotmart',accountKey:'synthetic',externalProductId:'synthetic-product',externalOfferId:null,action:'associate',targetOfferId:seed.offers[0].id,targetEbookId:null}
 const post=(route:string,input:unknown,headers:Record<string,string>={})=>fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(input)})
 assert.equal((await post(path+'/preview',choice)).status,403)
 const login=await post('/api/admin-users/login',{email:seed.owner.email,password:seed.password});assert.equal(login.status,200);const {token}=await login.json();const auth={Authorization:`JWT ${token}`}
 assert.equal((await post(path+'/preview',choice,{...auth,Origin:'https://wrong.invalid'})).status,403)
 assert.equal((await post(path+'/preview',{...choice,actor:seed.owner.id},auth)).status,422)
 assert.equal((await post(path+'/preview',{large:'x'.repeat(5000)},auth)).status,413)
 assert.equal((await fetch(base+path+'/preview',{method:'POST',headers:{...auth,Origin:base,'Content-Type':'text/csv'},body:'fixture'})).status,415)
 assert.equal((await fetch(base+'/api/catalog-resolutions')).status,403)
 assert.equal((await post('/api/catalog-resolutions',{},auth)).status,403)
 checks.push('HTTP real exige autenticação/origem exata; recusa ator forjado, conteúdo incompatível e corpo excedido. Coleção privada não vira endpoint de escrita.')
 const legacy=await seedLegacyOffer(seed,{name:'Associação HTTP histórica',provider:'hotmart',accountKey:'synthetic',externalProductId:'synthetic-product',ebook:seed.books[1].id,active:false,currency:'BRL'});extras.push(legacy.id);choice.targetOfferId=legacy.id
 const previewResponse=await post(path+'/preview',choice,auth);assert.equal(previewResponse.status,200);assert.equal(previewResponse.headers.get('cache-control'),'private, no-store');assert.equal(previewResponse.headers.get('referrer-policy'),'no-referrer');const preview=await previewResponse.json()
 assert.equal((await payload.count({collection:'catalog-resolutions',overrideAccess:true})).totalDocs,0)
 const proof={sourceKind:'provider_report',sourceReference:'http-catalog-proof',reason:'historical_mapping_correction',evidenceVerified:true,confirmed:true}
 const body={...choice,planHash:preview.planHash,...proof},key=randomUUID()
 assert.equal((await post(path,{...body,evidenceVerified:false},{...auth,'Idempotency-Key':key})).status,422)
 const createdResponse=await post(path,body,{...auth,'Idempotency-Key':key});assert.equal(createdResponse.status,201);assert.equal(createdResponse.headers.get('referrer-policy'),'no-referrer');const created=await createdResponse.json()
 const duplicate=await post(path,body,{...auth,'Idempotency-Key':key.toUpperCase()});assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).id,created.id)
 assert.equal((await post(path,{...body,sourceReference:'different-source'},{...auth,'Idempotency-Key':key})).status,409)
 const rows=(await payload.find({collection:'catalog-resolutions',overrideAccess:true,depth:0})).docs;assert.equal(rows.length,1);assert.equal(rows[0].actor,seed.owner.id)
 for(const method of ['PATCH','DELETE'])assert.equal((await fetch(base+'/api/catalog-resolutions/'+created.id,{method,headers:{...auth,'Content-Type':'application/json'},...(method==='PATCH'?{body:'{}'}:{})})).status,403)
 checks.push('Prévia sem escrita e confirmação HTTP 201 com autoria autenticada; repetição upper/lower retorna 200 sem duplicar. Fonte alterada na mesma chave é 409; prova insuficiente 422; trilha não permite edição/exclusão owner.')
 const csv=(id:string)=>{const row=[...csvFields];row[2]=id;row[4]='';return canonicalCSV([row])}
 const stage=(id:string)=>fetch(base+'/api/v1/admin/imports',{method:'POST',headers:{...auth,Origin:base,'Content-Type':'text/csv','Idempotency-Key':randomUUID(),'X-Import-Source':'provider_report','X-Import-Reference':'http-resolution-report','X-Import-Reason':'report_reconciliation'},body:csv(id)})
 const commit=(batch:{id:string;planHash:string})=>post('/api/v1/admin/imports/'+batch.id+'/commit',{confirmed:true,planHash:batch.planHash},auth)
 const staged=await(await stage('http-resolved-sale')).json();assert.equal(staged.state,'ready');assert.equal((await commit(staged)).status,202)
 const row=(await payload.find({collection:'commercial-import-rows',where:{batch:{equals:staged.id}},depth:0,overrideAccess:true})).docs[0];assert.ok(row.inbox)
 assert.equal((await processCommercialInbox(payload,typeof row.inbox==='string'?row.inbox:row.inbox!.id)).state,'applied')
 const sale=(await payload.find({collection:'transactions',depth:0,overrideAccess:true})).docs[0];assert.equal(sale.ebook,seed.books[1].id);assert.equal(sale.grossCents,9990);assert.equal(sale.producerNetCents,null)
 const fact=(await payload.find({collection:'transaction-events',depth:0,overrideAccess:true})).docs[0];assert.equal(fact.catalogResolution,created.id)
 const second=await(await stage('http-stale-resolution')).json();assert.equal(second.state,'ready')
 const holdChoice={...choice,action:'hold',targetOfferId:null},holdPreview=await(await post(path+'/preview',holdChoice,auth)).json()
 const holdBody={...holdChoice,planHash:holdPreview.planHash,...proof,reason:'evidence_inconclusive',evidenceVerified:false}
 const decisions=await Promise.all([post(path,holdBody,{...auth,'Idempotency-Key':randomUUID()}),post(path,holdBody,{...auth,'Idempotency-Key':randomUUID()})]);assert.deepEqual(decisions.map(response=>response.status).sort(),[201,409])
 const stale=await commit(second);assert.equal(stale.status,409);assert.equal((await stale.json()).state,'stale')
 assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,1)
 const repeated=await post(path,body,{...auth,'Idempotency-Key':key});assert.equal(repeated.status,200);assert.equal((await repeated.json()).current,false)
 checks.push('CSV HTTP usa decisão ao enfileirar; aplicação explícita registra decisão no fato e livro efetivo sem líquido inventado. Hold concorrente tem único vencedor, invalida lote pronto com 409 e não altera venda já aplicada; revisão supersedida retorna current=false.')
}finally{
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 await clearCatalogResolutionFixtures(payload)
 for(const id of extras)await payload.delete({collection:'offers',id,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/catalog-resolutions',{recursive:true})
await writeFile('artifacts/catalog-resolutions/http-results.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,externalCalls:false,limits:'HTTP/Next e PostgreSQL locais; fixtures sintéticas. Decisão não prova venda/liquidação; aplicação da inbox é explícita na suíte. Sem UI customizada ou homologação externa.'},null,2)+'\n')
console.log(`Decisões de catálogo HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)

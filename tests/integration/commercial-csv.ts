import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {receiveCommercialWebhook,processCommercialInbox} from '../../src/modules/commerce/inbox'
import {commercialEventKey,type CommercialAdapter,type NormalizedCommercialEvent} from '../../src/modules/commerce/events'
import {previewCommercialCSV} from '../../src/modules/commerce/import-preview'
import {previewCommercialImportRequest} from '../../src/modules/commerce/import-http'
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],extraOffers:string[]=[]
const source=(provider:'hotmart'|'kiwify'|'cakto'):NormalizedCommercialEvent=>({provider,accountKey:'synthetic',eventKey:'fixture-csv-'+provider,externalTransactionId:'csv-'+provider,externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z',currency:'BRL',grossCents:9990,feesCents:990,refundedCents:null,producerNetCents:null,chargebackCents:null,externalClickReference:null,refundBasis:null,externalRefundId:null})
const fields=(provider:'hotmart'|'kiwify'|'cakto')=>{const values=[...csvFields];values[0]=provider;values[2]='csv-'+provider;values[4]='';return values}
const ingest=async(event:NormalizedCommercialEvent)=>{
 const adapter:CommercialAdapter={provider:event.provider,version:'synthetic-csv-baseline:1',verify:async()=>true,normalize:body=>JSON.parse(Buffer.from(body).toString())}
 await receiveCommercialWebhook(payload,adapter,{provider:event.provider,accountKey:event.accountKey},Buffer.from(JSON.stringify(event)),new Headers())
 const row=(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(event)}},depth:0,overrideAccess:true})).docs[0]
 await processCommercialInbox(payload,row.id)
}
const snapshot=async()=>{
 const rows:Record<string,unknown>={}
 for(const collection of commercialCollections)rows[collection]=(await payload.find({collection,limit:1000,sort:'id',depth:0,overrideAccess:true})).docs
 return rows
}
try{
 for(const provider of ['hotmart','kiwify','cakto'] as const)await ingest(source(provider))
 const before=await snapshot(),all=canonicalCSV([fields('hotmart'),fields('kiwify'),fields('cakto')])
 const preview=await previewCommercialCSV(payload,all)
 assert.equal(preview.counts.matched,3);assert.equal(preview.committable,false);assert.equal(preview.provisional,true);assert.deepEqual(await snapshot(),before)
 checks.push('Mesmo produto em três provedores resolve namespaces separados e três snapshots compatíveis. Prévia não modifica histórico, projeções, recibos, conflitos ou auditoria; nunca habilita commit.')
 const duplicate=await previewCommercialCSV(payload,canonicalCSV([fields('hotmart'),fields('hotmart')]));assert.equal(duplicate.counts.matched,1);assert.equal(duplicate.counts.duplicate,1);assert.equal(duplicate.lines[1].duplicateOf,2)
 const different=fields('hotmart');different[8]='10000';assert.equal((await previewCommercialCSV(payload,canonicalCSV([different]))).lines[0].reason,'ledger_conflict')
 const inFile=await previewCommercialCSV(payload,canonicalCSV([fields('hotmart'),different]));assert.equal(inFile.counts.conflict,2);assert.deepEqual(await snapshot(),before)
 checks.push('Repetição exata aponta o registro original; divergência com ledger ou dentro do CSV exige revisão sem criar novo fato ou alterar total.')
 const unknown=fields('hotmart');unknown[3]='unmapped-product';assert.equal((await previewCommercialCSV(payload,canonicalCSV([unknown]))).lines[0].reason,'unknown_product')
 const anotherAccount=fields('hotmart');anotherAccount[1]='other-account';assert.equal((await previewCommercialCSV(payload,canonicalCSV([anotherAccount]))).lines[0].classification,'unknown_catalog')
 const other=await payload.create({collection:'offers',...seed.auth,data:{name:'Ambiguidade sintética CSV',provider:'hotmart',accountKey:'synthetic',externalProductId:'synthetic-product',ebook:seed.books[1].id,active:false,currency:'BRL'}});extraOffers.push(other.id)
 assert.equal((await previewCommercialCSV(payload,canonicalCSV([fields('hotmart')]))).lines[0].reason,'ambiguous_product')
 await payload.delete({collection:'offers',id:other.id,overrideAccess:true});extraOffers.splice(extraOffers.indexOf(other.id),1)
 checks.push('Produto/conta desconhecidos e catálogo ambíguo não usam oferta primária, outro provedor ou outro livro como fallback. Leitura detecta ambiguidade legada sem reescrever identidades.')
 const settlement=fields('hotmart');settlement[12]='9000';assert.equal((await previewCommercialCSV(payload,canonicalCSV([settlement]))).lines[0].reason,'settlement_evidence_required')
 const incomplete=fields('hotmart');incomplete[10]='';assert.equal((await previewCommercialCSV(payload,canonicalCSV([incomplete]))).lines[0].reason,'incomplete_snapshot')
 await ingest({...source('hotmart'),grossCents:10000})
 const heldBefore=await snapshot();assert.equal((await previewCommercialCSV(payload,canonicalCSV([fields('hotmart')]))).lines[0].reason,'existing_review');assert.deepEqual(await snapshot(),heldBefore)
 checks.push('Recebimento informado exige evidência própria; campos vazios não viram zero. Revisão/colisão existente continua bloqueada, e CSV não resolve ou reprocessa a transação.')
 const login=await payload.login({collection:'admin-users',data:{email:seed.owner.email,password:seed.password}});assert.ok(login.token)
 const origin=new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin
 const request=(authorized:boolean,site=origin)=>new Request(origin+'/api/v1/admin/imports/preview',{method:'POST',headers:{Origin:site,'Content-Type':'text/csv',...(authorized?{Authorization:`JWT ${login.token}`}:{})},body:canonicalCSV([fields('kiwify')])})
 assert.equal((await previewCommercialImportRequest(request(false),payload)).status,403);assert.equal((await previewCommercialImportRequest(request(true,'https://other.invalid'),payload)).status,403)
 const response=await previewCommercialImportRequest(request(true),payload);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json()).counts.matched,1);assert.deepEqual(await snapshot(),heldBefore)
 checks.push('Handler com autenticação Payload real exige owner/origem; JWT válido permite consulta sem qualquer escrita comercial. Retorno privado e provisório, sem confirmação falsa.')
}finally{
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 for(const id of extraOffers)await payload.delete({collection:'offers',id,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/commercial-csv',{recursive:true})
await writeFile('artifacts/commercial-csv/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,externalCalls:false,realSales:0,limits:'Prévia somente de leitura e provisória. Sem ImportBatch/Row, commit, resolução de conflitos, liquidação/custos persistidos, relatório financeiro ou UI. Fixtures sintéticas em PostgreSQL loopback; sem exportação nativa de fornecedor.'},null,2)+'\n')
console.log(`CSV comercial: ${checks.length} grupos locais aprovados; fixtures limpas.`)
process.exit(0)

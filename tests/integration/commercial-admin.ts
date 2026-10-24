import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {createLocalReq} from 'payload'
import {seedCommerce} from '../fixtures/commerce'
import {seedCommercialOperations} from '../fixtures/commercial-operations'
import {commercialSummary,commercialInboxPage,parseInboxFilters} from '../../src/modules/commerce/admin'

const seed=await seedCommerce(),{payload}=seed,checks:string[]=[]
try{
 const anonymous=await createLocalReq({req:{user:null}},payload)
 await assert.rejects(commercialSummary(anonymous),/forbidden/)
 await assert.rejects(commercialInboxPage(anonymous,parseInboxFilters({})),/forbidden/)
 const req=await createLocalReq({user:{...seed.owner,collection:'admin-users'}},payload)
 const before=await commercialSummary(req)
 assert.equal(before.providers.length,3);assert.deepEqual(before.totals,{pending:0,processing:0,attention:0});assert.ok(before.providers.every(p=>p.lastSuccessAt===null&&p.lastReceivedAt===null&&p.oldestOutstandingAt===null))
 checks.push('Owner obrigatório antes de consulta; vazio preserva os três provedores, ausência de sucesso e contagens zero sem inventar atividade.')
 const rows=await seedCommercialOperations(seed),summary=await commercialSummary(req,rows.now)
 assert.deepEqual(summary.totals,{pending:22,processing:2,attention:4})
 const hotmart=summary.providers.find(p=>p.provider==='hotmart')!,kiwify=summary.providers.find(p=>p.provider==='kiwify')!,cakto=summary.providers.find(p=>p.provider==='cakto')!
 assert.equal(hotmart.lastSuccessAt,new Date(rows.now-5000).toISOString());assert.equal(hotmart.oldestOutstandingAt,new Date(rows.now-2*86400000).toISOString());assert.equal(hotmart.attention,4)
 assert.equal(kiwify.pending,1);assert.equal(kiwify.lastSuccessAt,null);assert.equal(cakto.oldestOutstandingAt,null);assert.equal(cakto.lastSuccessAt,null);assert.ok(cakto.lastReceivedAt)
 checks.push('Resumo separa fila/processamento/atenção; colisão em aplicado e lease vencido contam na atenção; ignorado não fabrica sucesso de aplicação. Datas vêm de registros, incluindo pendência mais antiga.')
 const attention=await commercialInboxPage(req,parseInboxFilters({}),rows.now)
 assert.equal(attention.totalDocs,4);assert.deepEqual(attention.docs.map(x=>x.id).sort(),[rows.applied.id,rows.failed.id,rows.review.id,rows.expired.id].sort())
 const first=await commercialInboxPage(req,parseInboxFilters({provider:'hotmart',state:'pending'}),rows.now),second=await commercialInboxPage(req,parseInboxFilters({provider:'hotmart',state:'pending',page:'2'}),rows.now)
 assert.equal(first.totalDocs,21);assert.equal(first.docs.length,20);assert.equal(second.docs.length,1);assert.equal(new Set([...first.docs,...second.docs].map(x=>x.id)).size,21)
 const selected=await commercialInboxPage(req,parseInboxFilters({state:'all',event:rows.failed.id}),rows.now);assert.equal(selected.totalDocs,1);assert.equal(selected.docs[0].id,rows.failed.id)
 const onlyKiwify=await commercialInboxPage(req,parseInboxFilters({provider:'kiwify',state:'all'}),rows.now);assert.equal(onlyKiwify.totalDocs,1);assert.equal(onlyKiwify.docs[0].id,rows.pending.id)
 await assert.rejects(commercialInboxPage(req,parseInboxFilters({provider:'kiwify',state:'all',page:'2'}),rows.now),/invalid_page/)
 checks.push('Filtros exatos por provedor/estado, atenção com quatro causas distintas, paginação estável 20+1 e página inválida recusada.')
 for(const item of [...attention.docs,...first.docs])for(const field of ['envelope','envelopeHash','leaseToken','transactionKey'])assert.equal(field in item,false)
 const snapshot=await payload.findByID({collection:'commercial-inbox',id:rows.failed.id,depth:0,overrideAccess:true});await commercialSummary(req,rows.now+1000);await commercialInboxPage(req,parseInboxFilters({state:'all'}),rows.now+1000)
 assert.deepEqual(await payload.findByID({collection:'commercial-inbox',id:rows.failed.id,depth:0,overrideAccess:true}),snapshot)
 checks.push('Modelo de listagem exclui envelope, impressão, token e chave da transação; leitura não reprocessa nem altera datas/tentativas do evento.')
}finally{await seed.cleanup()}
await mkdir('artifacts/commercial-admin',{recursive:true})
await writeFile('artifacts/commercial-admin/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,environment:'PostgreSQL loopback; fixture de estados operacionais sintéticos',externalCalls:false,realSales:0,limits:'Sem payloads/autenticação nativos, conta de provedor, dashboard financeiro ou homologação externa.'},null,2)+'\n')
console.log(`Painel comercial: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)

import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {seedCommerce,seedLegacyOffer} from '../fixtures/commerce'
import {atomic} from '../../src/modules/marketing/transaction'
import type {Offer} from '../../src/payload-types'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Confirme ambiente sintético exclusivo.')
const seed=await seedCommerce(),{payload}=seed,created:string[]=[],checks:string[]=[]
const data={name:'Identidade sintética',provider:'hotmart' as Offer['provider'],accountKey:'synthetic',externalProductId:'identity-product',ebook:seed.books[0].id,active:false,currency:'BRL' as const}
const create=async(more:Partial<typeof data>&{externalOfferId?:string}={})=>{const offer=await payload.create({collection:'offers',...seed.auth,data:{...data,...more}});created.push(offer.id);return offer}
const rejected=(work:Promise<unknown>)=>assert.rejects(work,/Identidade externa já cadastrada/)
try {
 await assert.rejects(payload.create({collection:'offers',data,user:null,overrideAccess:false}))
 const first=await create()
 await rejected(create());await rejected(create({externalOfferId:''}));await rejected(create({ebook:seed.books[1].id,externalOfferId:'other-offer'}))
 const explicit=await create({externalOfferId:'offer-a'});await create({externalOfferId:'offer-b'})
 await rejected(create({externalOfferId:'offer-a'}))
 await rejected(payload.update({collection:'offers',id:explicit.id,...seed.auth,data:{externalOfferId:null}}))
 assert.equal((await payload.findByID({collection:'offers',id:explicit.id,...seed.auth})).externalOfferId,'offer-a')
 checks.push('API local nega anônimo; identidade exata inclusive vazio/null e produto de outro livro são recusados mesmo inativos. Ofertas distintas do mesmo livro permanecem permitidas; update recusado preserva original.')
 await create({accountKey:'another-synthetic'});await create({provider:'kiwify'});await create({provider:'cakto'})
 await payload.update({collection:'offers',id:first.id,...seed.auth,data:{name:'Metadado sintético'}})
 checks.push('Provedor e conta isolam namespaces; metadados continuam editáveis e os três provedores permanecem no escopo.')
 const race=await Promise.allSettled([create({externalProductId:'concurrent-product'}),create({externalProductId:'concurrent-product',ebook:seed.books[1].id})])
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1)
 assert.equal((await payload.count({collection:'offers',where:{externalProductId:{equals:'concurrent-product'}},overrideAccess:true})).totalDocs,1)
 const candidates=await Promise.all([create({externalProductId:'edit-a'}),create({externalProductId:'edit-b'})])
 const edits=await Promise.allSettled(candidates.map(offer=>payload.update({collection:'offers',id:offer.id,...seed.auth,data:{externalProductId:'concurrent-edit'}})))
 assert.equal(edits.filter(r=>r.status==='fulfilled').length,1)
 checks.push('Criações e alterações concorrentes para a mesma identidade têm um único vencedor sob locks transacionais; nenhuma segunda oferta fica gravada.')
 await assert.rejects(atomic(payload,async req=>{await payload.create({collection:'offers',data:{...data,externalProductId:'rollback-product'},req,overrideAccess:true});throw new Error('synthetic rollback')}),/synthetic rollback/)
 assert.equal((await payload.count({collection:'offers',where:{externalProductId:{equals:'rollback-product'}},overrideAccess:true})).totalDocs,0)
 await create({externalProductId:'rollback-product'})
 const legacy:Offer=await seedLegacyOffer(seed,{...data,ebook:seed.books[1].id});created.push(legacy.id)
 await payload.update({collection:'offers',id:legacy.id,...seed.auth,data:{name:'Legado preservado'}})
 await rejected(create({externalOfferId:'new-after-legacy'}))
 assert.equal((await payload.findByID({collection:'offers',id:legacy.id,depth:0,...seed.auth})).ebook,seed.books[1].id)
 checks.push('Rollback remove a escrita e libera locks para nova tentativa. Ambiguidade legada sintética conserva identidades/metadados, bloqueando novas associações; correção histórica auditada ainda pendente.')
} finally {
 for(const id of created)await payload.delete({collection:'offers',id,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/catalog-identities',{recursive:true})
await writeFile('artifacts/catalog-identities/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,externalCalls:false,limits:'Guard da API Payload sob locks; SQL administrativo direto não é coberto. Sem migration/constraint nova, resolução auditada histórica, HTTP/browser ou homologação externa.'},null,2)+'\n')
console.log(`Identidades do catálogo: ${checks.length} grupos locais aprovados; fixtures limpas.`)
process.exit(0)

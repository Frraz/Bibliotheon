import {GET as checkoutRoute} from '../../src/app/(site)/comprar/[offerId]/route'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import type {PostgresAdapter} from '@payloadcms/db-postgres'
import {seedAnalytics} from '../fixtures/analytics'
import {chooseConsent,recordPageView,recordCheckoutClick,consentStatus,AnalyticsError} from '../../src/modules/analytics/service'
import {resolveCheckout} from '../../src/modules/commerce/resolve'
import {atomic} from '../../src/modules/marketing/transaction'
import {up,down} from '../../migrations/20261024_073316_analytics'
const seed=await seedAnalytics(),{payload}=seed,now=Date.now(),checks:string[]=[]
const page=(extra={})=>({type:'page_view' as const,eventId:randomUUID(),pagePath:`/ebooks/${seed.books[0].slug}`,...extra})
const count=async(collection:'analytics-grants'|'visits'|'page-views'|'checkout-clicks')=>(await payload.count({collection,overrideAccess:true})).totalDocs
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw new Error('synthetic rollback')}),/synthetic rollback/)
 assert.equal((await recordPageView(payload,page(),undefined,now)).state,'unmeasured');assert.equal(await count('analytics-grants'),0);assert.equal(await count('visits'),0)
 assert.equal((await chooseConsent(payload,'reject',undefined,now)).choice,'rejected');assert.equal(await count('analytics-grants'),0)
 const granted=await chooseConsent(payload,'accept',undefined,now);assert.equal(granted.choice,'granted');assert.ok('token'in granted);const token=granted.token
 assert.equal(await count('visits'),0);assert.equal(await consentStatus(payload,token,now),true)
 const event=page(),results=await Promise.all([recordPageView(payload,event,token,now),recordPageView(payload,event,token,now)]);assert.equal(results.filter(x=>x.state==='recorded').length,1);assert.equal(await count('visits'),1);assert.equal(await count('page-views'),1)
 checks.push('Migração down/up vazia revertida; nenhuma identificação/sessão antes de consentimento; concorrência deduplica page_view por permissão/evento.')
 await recordPageView(payload,page(),token,now+29*60000);assert.equal(await count('visits'),1)
 await recordPageView(payload,page(),token,now+60*60000);assert.equal(await count('visits'),2)
 checks.push('Sessão usa30 minutos de inatividade, renovada por evento válido; aceitar permissão não cria visita por si só.')
 await payload.update({collection:'campaigns',id:seed.campaign.id,...seed.auth,data:{utmSource:'organico',utmMedium:'conteudo',utmContent:'artigo',utmTerm:'iniciante'}})
 await recordPageView(payload,page({campaignCode:seed.campaign.code,utms:{source:'organico'}}),token,now+61*60000)
 let grant=(await payload.find({collection:'analytics-grants',depth:0,overrideAccess:true})).docs[0];assert.ok(grant.firstTouch);const first=grant.firstTouch,last=grant.lastNonDirectTouch
 await recordPageView(payload,page(),token,now+62*60000);grant=await payload.findByID({collection:'analytics-grants',id:grant.id,depth:0,overrideAccess:true});assert.deepEqual(grant.firstTouch,first);assert.deepEqual(grant.lastNonDirectTouch,last)
 await recordPageView(payload,page({campaignCode:seed.campaign.code,utms:{source:'forjado'}}),token,now+63*60000)
 const bad=(await payload.find({collection:'page-views',sort:'-occurredAt',limit:1,depth:0,overrideAccess:true})).docs[0];assert.equal(bad.campaign,null);assert.equal(bad.utms,null)
 await recordPageView(payload,page(),token,now+31*86400000);grant=await payload.findByID({collection:'analytics-grants',id:grant.id,depth:0,overrideAccess:true});assert.equal((grant.firstTouch as {kind:string}).kind,'direct');assert.notDeepEqual(grant.firstTouch,first);assert.equal(grant.lastNonDirectTouch,null)
 checks.push('First-touch/last-touch não direto duram30 dias; navegação direta não apaga fonte válida e parâmetros não cadastrados não são persistidos.')
 const target=await atomic(payload,req=>resolveCheckout(seed.offers[1].id,seed.campaign.code,{payload,req,now:now+31*86400000}))
 assert.equal(target.destination,seed.campaign.affiliateUrl)
 await recordCheckoutClick(payload,target,undefined,now+31*86400000)
 await recordCheckoutClick(payload,target,token,now+31*86400000+1000)
 const clicks=(await payload.find({collection:'checkout-clicks',sort:'occurredAt',depth:0,overrideAccess:true})).docs;assert.equal(clicks[0].visit,null);assert.equal(clicks[0].attributionAllowed,false);assert.equal(clicks[0].firstTouch,null);assert.ok(clicks[1].visit);assert.equal(clicks[1].attributionAllowed,true)
 checks.push('Saídas operacionais sem cookie ficam sem sessão/atribuição; saídas consentidas têm população própria. URL afiliada e parâmetros comerciais intactos, sem prova de compra.')
 const before=await count('page-views');await chooseConsent(payload,'reject',token,now+31*86400000+2000)
 assert.equal((await recordPageView(payload,page(),token,now+31*86400000+3000)).state,'unmeasured');assert.equal(await count('page-views'),before);assert.equal(await consentStatus(payload,token,now+31*86400000+3000),false)
 const regranted=await chooseConsent(payload,'accept',token,now+31*86400000+4000);assert.ok('token'in regranted);assert.notEqual(regranted.token,token)
 checks.push('Revogação bloqueia cookie antigo sem apagar a distinção de histórico; novo aceite explícito emite permissão nova e não reativa token revogado.')
 const hooks=payload.collections['page-views'].config.hooks,previous=hooks.afterChange,beforeVisits=await count('visits')
 hooks.afterChange=[...(previous||[]),async()=>{throw new Error('synthetic analytics rollback')}]
 try{await assert.rejects(recordPageView(payload,page(),regranted.token,now+31*86400000+5000),/synthetic analytics rollback/)}finally{hooks.afterChange=previous}
 assert.equal(await count('visits'),beforeVisits)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 await assert.rejects(payload.find({collection:'analytics-grants',overrideAccess:false,user:null}));await assert.rejects(payload.update({collection:'analytics-grants',id:grant.id,data:{revokedAt:null},overrideAccess:false,user:{...seed.owner,collection:'admin-users'}}))
 checks.push('Rollback reverte evento/sessão/contexto juntos; downgrade e APIs não apagam nem reativam permissões. Coleções privadas sem dados de comprador.')
 const clickHooks=payload.collections['checkout-clicks'].config.hooks,oldClicks=clickHooks.afterChange,oldFlag=process.env.ANALYTICS_ENABLED
 clickHooks.afterChange=[...(oldClicks||[]),async()=>{throw new Error('synthetic click persistence failure')}];process.env.ANALYTICS_ENABLED='true'
 try{
  const response=await checkoutRoute(new Request(`http://127.0.0.1:3001/comprar/${seed.offers[1].id}?c=${seed.campaign.code}`),{params:Promise.resolve({offerId:seed.offers[1].id})})
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),seed.campaign.affiliateUrl)
 }finally{clickHooks.afterChange=oldClicks;if(oldFlag===undefined)delete process.env.ANALYTICS_ENABLED;else process.env.ANALYTICS_ENABLED=oldFlag}
 checks.push('Falha real de hook de gravação analítica no handler não impede redirecionamento seguro nem altera URL/assinatura de checkout.')
 const quotaTime=now+32*86400000,limited=await chooseConsent(payload,'accept',undefined,quotaTime);assert.ok('token'in limited)
 const firstLimited=page({pagePath:'/'})
 await recordPageView(payload,firstLimited,limited.token,quotaTime)
 for(let i=1;i<60;i++)await recordPageView(payload,page({pagePath:'/'}),limited.token,quotaTime)
 const beforeLimit=await count('page-views')
 await assert.rejects(recordPageView(payload,page({pagePath:'/'}),limited.token,quotaTime),(error:unknown)=>error instanceof AnalyticsError&&error.status===429)
 assert.equal(await count('page-views'),beforeLimit);assert.equal((await recordPageView(payload,firstLimited,limited.token,quotaTime)).state,'duplicate')
 assert.equal((await chooseConsent(payload,'reject',limited.token,quotaTime+1)).choice,'rejected')
 checks.push('Limite real de 60 eventos/minuto bloqueia excedente sem gravar estado parcial; retry idempotente e retirada continuam disponíveis no limite.')


}finally{await seed.cleanup()}
await mkdir('artifacts/analytics',{recursive:true});await writeFile('artifacts/analytics/local-results.json',JSON.stringify({date:new Date().toISOString(),timezone:'America/Belem',checks,externalCalls:false,limits:'Medição local sintética; não comprova pessoas únicas, venda, atribuição de provedor ou homologação legal/produção.'},null,2)+'\n')
console.log(`Analytics: ${checks.length} grupos aprovados; fixtures limpas.`);process.exit(0)

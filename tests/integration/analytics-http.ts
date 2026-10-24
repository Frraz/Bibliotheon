import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {seedAnalytics} from '../fixtures/analytics'
import {testOrigin as origin} from '../fixtures/origin'
const seed=await seedAnalytics(),{payload}=seed,checks:string[]=[]
const post=(path:string,data:unknown,cookie='',requestOrigin=origin)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:requestOrigin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)})
const count=async(collection:'analytics-grants'|'visits'|'page-views'|'checkout-clicks')=>(await payload.count({collection,overrideAccess:true})).totalDocs
const event={type:'page_view',eventId:randomUUID(),pagePath:`/ebooks/${seed.books[0].slug}`,campaignCode:seed.campaign.code}
try{
 const status=await fetch(origin+'/api/v1/analytics-consent');assert.equal(status.status,200);assert.equal((await status.json()).enabled,true);assert.equal(status.headers.has('set-cookie'),false)
 await post('/api/v1/events',event);assert.equal(await count('analytics-grants'),0);assert.equal(await count('visits'),0)
 assert.equal((await post('/api/v1/events',{...event,type:'purchase_approved'})).status,400)
 assert.equal((await post('/api/v1/events',{...event,pagePath:'/preferencias'})).status,400)
 assert.equal((await post('/api/v1/analytics-consent',{choice:'accept'},'','https://evil.invalid')).status,400)
 assert.equal((await post('/api/v1/analytics-consent',{choice:{toString:'accept'}})).status,400)
 await post('/api/v1/analytics-consent',{choice:'reject'});assert.equal(await count('analytics-grants'),0)
 checks.push('Sem aceite não há identificador/sessão; rejeição é não identificável; origem externa, página sensível e compra enviada pelo browser são recusadas.')
 const accept=await post('/api/v1/analytics-consent',{choice:'accept'});assert.equal(accept.status,200);assert.deepEqual(await accept.json(),{enabled:true,choice:'granted'})
 const cookies=accept.headers.getSetCookie(),grantCookie=cookies.find(v=>v.startsWith('__Host-bibliotheon_analytics='));assert.ok(grantCookie)
 assert.match(grantCookie,/HttpOnly/);assert.match(grantCookie,/Secure/);assert.match(grantCookie,/SameSite=Lax/);assert.equal(grantCookie.includes('Domain='),false)
 const cookie=grantCookie.split(';')[0];assert.equal(await count('visits'),0)
 assert.equal((await post('/api/v1/events',event,cookie)).status,202);assert.equal((await post('/api/v1/events',event,cookie)).status,202)
 assert.equal(await count('visits'),1);assert.equal(await count('page-views'),1)
 checks.push('Aceite explícito usa cookie __Host/HttpOnly/Secure; token não aparece no JSON. Visualização autenticada é deduplicada no servidor.')
 const checkout=`/comprar/${seed.offers[1].id}?c=${seed.campaign.code}`
 const linked=await fetch(origin+checkout,{headers:{Cookie:cookie},redirect:'manual'});assert.equal(linked.status,302);assert.equal(linked.headers.get('location'),seed.campaign.affiliateUrl)
 const unlinked=await fetch(origin+checkout,{redirect:'manual'});assert.equal(unlinked.status,302);assert.equal(unlinked.headers.get('location'),seed.campaign.affiliateUrl)
 assert.equal((await fetch(origin+checkout,{method:'HEAD',redirect:'manual'})).status,302)
 assert.equal((await fetch(origin+checkout,{headers:{'Sec-Purpose':'prefetch'},redirect:'manual'})).status,302)
 const clicks=(await payload.find({collection:'checkout-clicks',depth:0,overrideAccess:true})).docs;assert.equal(clicks.length,2);assert.equal(clicks.filter(v=>v.attributionAllowed&&v.visit).length,1);assert.equal(clicks.filter(v=>!v.attributionAllowed&&!v.visit).length,1)
 checks.push('Redirecionamento HTTP mantém URL afiliada exatamente e separa saída operacional de saída consentida; nenhum clickId é acrescentado ao provedor.')
 assert.equal((await post('/api/v1/analytics-consent',{choice:'reject'},cookie)).status,200)
 await post('/api/v1/events',{...event,eventId:randomUUID()},cookie);assert.equal(await count('page-views'),1)
 for(const collection of ['analytics-grants','visits','page-views','checkout-clicks','analytics-limits'])assert.equal((await fetch(origin+`/api/${collection}`)).status,403)
 checks.push('Retirada bloqueia replay do cookie antigo e coleções analíticas permanecem privadas por HTTP.')
 const fresh=await post('/api/v1/analytics-consent',{choice:'accept'}),newCookie=fresh.headers.getSetCookie().find(v=>v.startsWith('__Host-bibliotheon_analytics='))!.split(';')[0]
 await payload.updateGlobal({slug:'site-settings',...seed.auth,data:{legalReady:false}})
 const off=await(await fetch(origin+'/api/v1/analytics-consent',{headers:{Cookie:newCookie}})).json();assert.equal(off.enabled,false);assert.equal(off.manage,true)
 await post('/api/v1/events',{...event,eventId:randomUUID()},newCookie);assert.equal(await count('page-views'),1)
 assert.equal((await post('/api/v1/analytics-consent',{choice:'reject'},newCookie)).status,200)
 const before=await count('analytics-grants');await post('/api/v1/analytics-consent',{choice:'accept'});assert.equal(await count('analytics-grants'),before)
 checks.push('Aviso institucional não revisado bloqueia nova coleta/aceite; retirada de permissão existente continua disponível.')
 const form=await fetch(origin+'/api/v1/analytics-withdrawal',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:newCookie},body:'choice=reject',redirect:'manual'});assert.equal(form.status,303);assert.equal(form.headers.get('location'),'/privacidade')
 const invalidForm=await fetch(origin+'/api/v1/analytics-withdrawal',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'choice=reject&choice=accept',redirect:'manual'});assert.equal(invalidForm.status,400)
 checks.push('Fallback de formulário nativo revoga sem JavaScript e só redireciona para privacidade; parâmetros duplicados são recusados.')

}finally{await seed.cleanup()}
await mkdir('artifacts/analytics',{recursive:true});await writeFile('artifacts/analytics/http-results.json',JSON.stringify({date:new Date().toISOString(),origin,checks,externalCalls:false,limits:'HTTP loopback e dados sintéticos; checkout externo não foi seguido.'},null,2)+'\n');console.log(`Analytics HTTP: ${checks.length} grupos aprovados; fixtures limpas.`);process.exit(0)

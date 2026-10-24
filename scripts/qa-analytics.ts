import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,expect,type Page,type BrowserContextOptions} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {seedAnalytics} from '../tests/fixtures/analytics'
import {testOrigin as base} from '../tests/fixtures/origin'
const seed=await seedAnalytics(),{payload}=seed,output='artifacts/qa-analytics',results:unknown[]=[]
const browser=await chromium.launch()
let externalAttempts=0
async function makeContext(options:BrowserContextOptions){
 const context=await browser.newContext(options)
 await context.route(/^https?:\/\//,route=>{if(new URL(route.request().url()).origin!==base){externalAttempts++;return route.abort()}return route.continue()})
 return context
}
await mkdir(output,{recursive:true})
try{
 const screenshot=async(page:Page,name:string,fullPage=true)=>{
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze(),overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  await page.screenshot({path:`${output}/${name}.png`,fullPage})
  results.push({name,overflow,violations:axe.violations.map(v=>v.id)});assert.equal(overflow,false);assert.deepEqual(axe.violations.map(v=>v.id),[])
 }
 for(const theme of ['light','dark'] as const)for(const width of [360,390,768,1024,1440,1920]){
  const context=await makeContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'})
  await context.addInitScript(t=>localStorage.setItem('bibliotheon:appearance:v1',t),theme)
  const page=await context.newPage();const before=(await payload.count({collection:'page-views',overrideAccess:true})).totalDocs
  await page.goto(`${base}/ebooks/${seed.books[0].slug}?c=${seed.campaign.code}`,{waitUntil:'networkidle'})
  await expect(page.getByRole('button',{name:'Aceitar medição'})).toBeVisible()
  assert.equal((await context.cookies()).some(c=>c.name.includes('analytics')),false)
  assert.equal((await payload.count({collection:'page-views',overrideAccess:true})).totalDocs,before)
  const accept=page.getByRole('button',{name:'Aceitar medição'}),reject=page.getByRole('button',{name:'Recusar medição'})
  const a=await accept.boundingBox(),b=await reject.boundingBox();assert.ok(a&&b);assert.ok(Math.abs(a.width-b.width)<=1)
  await screenshot(page,`initial-${theme}-${width}`)
  await reject.focus();await page.keyboard.press('Enter')
  await expect(page.getByText('Medição recusada. Você pode continuar navegando normalmente.')).toBeVisible()
  assert.equal((await context.cookies()).some(c=>c.name.includes('analytics')),false)
  await page.getByRole('button',{name:'Preferências de medição'}).click();await accept.focus();await page.keyboard.press('Tab');await expect(reject).toBeFocused();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Enter')
  await expect(page.getByText('Preferência salva. Você pode mudar quando quiser.')).toBeVisible()
  await expect.poll(async()=>(await payload.count({collection:'page-views',overrideAccess:true})).totalDocs).toBe(before+1)
  const cookie=(await context.cookies()).find(c=>c.name==='__Host-bibliotheon_analytics');assert.ok(cookie);assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true)
  await expect(page.getByRole('button',{name:'Preferências de medição'})).toBeFocused()
  await screenshot(page,`granted-${theme}-${width}`)
  await page.goto(`${base}/preferencias?t=synthetic-sensitive`,{waitUntil:'networkidle'})
  assert.equal((await payload.count({collection:'page-views',overrideAccess:true})).totalDocs,before+1)
  await page.getByRole('button',{name:'Preferências de medição'}).click();await page.getByRole('button',{name:'Recusar medição'}).click()
  await expect(page.getByText('Medição recusada. Você pode continuar navegando normalmente.')).toBeVisible()
  await page.goto(`${base}/ebooks/${seed.books[0].slug}`,{waitUntil:'networkidle'})
  assert.equal((await payload.count({collection:'page-views',overrideAccess:true})).totalDocs,before+1)
  assert.equal((await context.cookies()).some(c=>c.name.includes('analytics')),false)
  await screenshot(page,`revoked-${theme}-${width}`)
  await context.close()
 }
 const nojs=await makeContext({viewport:{width:390,height:1000},javaScriptEnabled:false})
 const consent=await nojs.request.post(base+'/api/v1/analytics-consent',{headers:{Origin:base},data:{choice:'accept'}});assert.equal(consent.status(),200)
 const nojsPage=await nojs.newPage();const beforeNojs=(await payload.count({collection:'page-views',overrideAccess:true})).totalDocs
 await nojsPage.goto(`${base}/ebooks/${seed.books[0].slug}`,{waitUntil:'networkidle'})
 await expect(nojsPage.getByRole('button',{name:'Revogar medição'})).toBeVisible();await nojsPage.getByRole('button',{name:'Revogar medição'}).click();await nojsPage.waitForURL(base+'/privacidade')
 assert.equal((await nojs.cookies()).some(c=>c.name==='__Host-bibliotheon_analytics'),false);assert.equal((await payload.count({collection:'page-views',overrideAccess:true})).totalDocs,beforeNojs)
 const nojsOverflow=await nojsPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(nojsOverflow,false)
 await nojsPage.screenshot({path:`${output}/nojs-withdrawal.png`,fullPage:true});results.push({name:'nojs-withdrawal',overflow:nojsOverflow,axe:'not_run_javascript_disabled',functional:'permission revoked; no extra page view'});await nojs.close()
 for(const theme of ['light','dark'] as const){
  const context=await makeContext({viewport:{width:1440,height:1000},colorScheme:theme,reducedMotion:'reduce'})
  const login=await context.request.post(base+'/api/admin-users/login',{data:{email:seed.owner.email,password:seed.password}});assert.equal(login.status(),200)
  const page=await context.newPage();await page.goto(base+'/admin',{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Medição dos últimos sete dias'})).toBeVisible();await screenshot(page,`dashboard-${theme}`)
  await page.goto(`${base}/admin/collections/campaigns/${seed.campaign.id}`,{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Link de divulgação'})).toBeVisible();await screenshot(page,`campaign-link-${theme}`)
  await context.close()
 }
 assert.equal(externalAttempts,0)
}finally{await browser.close();await seed.cleanup()}
await writeFile(`${output}/results.json`,JSON.stringify({date:new Date().toISOString(),origin:base,results,checks:['Antes de consentir e após revogar, nenhum identificador/visualização adicional.','Aceitar/rejeitar têm peso igual e funcionam por teclado; foco restaurado.','Rota com token não é medida.','Claro/escuro e seis larguras; painel e gerador privados.'],externalCalls:false,externalRequestsBlocked:externalAttempts,limits:'Dados sintéticos e navegador local; não substitui homologação integral do produto ou validação jurídica. Axe não executado no contexto sem JS; revogação/HTML/overflow capturados separadamente.'},null,2)+'\n')
console.log(`Analytics visual: ${results.length} telas aprovadas; axe nos contextos com JS, teclado/overflow e fallback sem JS; fixtures limpas.`);process.exit(0)

import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,expect,type Page,type BrowserContextOptions} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {seedCommerce} from '../tests/fixtures/commerce'
import {seedCommercialOperations} from '../tests/fixtures/commercial-operations'
import {testOrigin as base} from '../tests/fixtures/origin'

const seed=await seedCommerce(),{payload}=seed,output='artifacts/qa-commercial-admin',results:unknown[]=[],checks:string[]=[]
const browser=await chromium.launch().catch(async error=>{await seed.cleanup();throw error})
let externalAttempts=0,passed=false
const runtimeErrors:string[]=[]
await mkdir(output,{recursive:true})
async function context(options:BrowserContextOptions,authenticated=true){
 const ctx=await browser.newContext(options)
 ctx.on('page',page=>page.on('pageerror',error=>runtimeErrors.push(error.name)))
 await ctx.route(/^https?:\/\//,route=>{if(new URL(route.request().url()).origin!==base){externalAttempts++;return route.abort()}return route.continue()})
 await ctx.addInitScript(()=>{try{localStorage.setItem('bibliotheon:appearance:v1',matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{/* Initial about:blank frames may have an opaque origin. */}})
 if(authenticated){const login=await ctx.request.post(base+'/api/admin-users/login',{data:{email:seed.owner.email,password:seed.password}});assert.equal(login.status(),200)}
 return ctx
}
async function capture(page:Page,name:string,axeEnabled=true){
 const axe=axeEnabled?await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze():null
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
 await page.screenshot({path:`${output}/${name}.png`,fullPage:true})
 results.push({name,overflow,axeExecuted:!!axe,violations:axe?.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))||[]})
 assert.equal(overflow,false,`${name}: overflow`);if(axe)assert.deepEqual(axe.violations.map(v=>v.id),[],`${name}: axe`);console.log(`QA comercial: ${name}`)
}
try{
 const anonymous=await context({viewport:{width:390,height:900}},false),anon=await anonymous.newPage()
 await anon.goto(base+'/admin/commercial-inbox',{waitUntil:'networkidle'});assert.ok(new URL(anon.url()).pathname.includes('/admin/login'));await anonymous.close()
 checks.push('Anônimo redirecionado ao login sem receber o acompanhamento privado.')
 for(const theme of ['light','dark'] as const)for(const width of [360,1440]){
  const ctx=await context({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'}),page=await ctx.newPage()
  await page.goto(base+'/admin/commercial-inbox',{waitUntil:'networkidle'});await expect(page.getByText('Nenhum evento corresponde a estes filtros.')).toBeVisible();await expect(page.getByText('Sem aplicação registrada')).toHaveCount(3)
  await capture(page,`empty-${theme}-${width}`);await ctx.close()
 }
 const rows=await seedCommercialOperations(seed)
 for(const theme of ['light','dark'] as const)for(const width of [360,390,768,1024,1440,1920]){
  const ctx=await context({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'}),page=await ctx.newPage()
  await payload.update({collection:'commercial-inbox',id:rows.active.id,data:{startedAt:new Date().toISOString()},overrideAccess:true})
  await page.goto(base+'/admin/commercial-inbox',{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Acompanhamento de eventos'})).toBeVisible();await expect(page.locator('.bibliotheon-commercial-events > li')).toHaveCount(4)
  await capture(page,`attention-${theme}-${width}`)
  const row=page.locator('.bibliotheon-commercial-events > li').filter({has:page.getByRole('heading',{name:/ops-long-/})})
  await row.locator('summary').focus();await page.keyboard.press('Enter')
  const form=row.locator('form');await expect(form.getByRole('button',{name:'Recolocar na fila'})).toBeDisabled()
  await form.getByRole('combobox',{name:'O que você conferiu?'}).selectOption('service_restored')
  const checkbox=form.getByRole('checkbox');await checkbox.focus();await page.keyboard.press('Space');await page.keyboard.press('Tab');await expect(form.getByRole('button',{name:'Recolocar na fila'})).toBeFocused();await expect(form.getByRole('button',{name:'Recolocar na fila'})).toBeEnabled()
  await capture(page,`ready-${theme}-${width}`);await ctx.close()
 }
 checks.push('Atenção e formulário expandido em dois temas/seis larguras; identificação longa quebra linha; teclado abre disclosure, confirma revisão e alcança ação habilitada.')
 const ctx=await context({viewport:{width:1440,height:1000},colorScheme:'light',reducedMotion:'reduce'}),page=await ctx.newPage()
 await page.goto(base+'/admin',{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Operação de eventos comerciais'})).toBeVisible();await capture(page,'dashboard-light')
 await page.getByRole('link',{name:'Conferir eventos e reprocessamento'}).click();await page.waitForLoadState('networkidle')
 await page.getByRole('combobox',{name:'Provedor',exact:true}).selectOption('hotmart');await page.getByRole('combobox',{name:'Estado do processamento'}).selectOption('pending');await page.getByRole('button',{name:'Aplicar filtros'}).click();await page.waitForLoadState('networkidle');await expect(page.locator('.bibliotheon-commercial-events > li')).toHaveCount(20)
 await page.getByRole('link',{name:'Próxima página'}).click();await page.waitForLoadState('networkidle');await expect(page.locator('.bibliotheon-commercial-events > li')).toHaveCount(1);assert.equal(new URL(page.url()).searchParams.get('provider'),'hotmart');assert.equal(new URL(page.url()).searchParams.get('state'),'pending');await capture(page,'pagination-second-light')
 await page.goto(`${base}/admin/collections/commercial-inbox/${rows.failed.id}`,{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Conferir processamento'})).toBeVisible();assert.equal(await page.locator('form form').count(),0)
 await page.getByText('Últimas ações deste evento',{exact:true}).click();await page.getByText('Envelope mínimo salvo',{exact:true}).click();await expect(page.locator('.bibliotheon-commercial-history pre')).toContainText('externalTransactionId');await capture(page,'native-detail-light');await page.getByRole('link',{name:'Abrir este evento para reprocessamento'}).click();await page.waitForLoadState('networkidle');await expect(page.locator('.bibliotheon-commercial-events > li')).toHaveCount(1);assert.equal(new URL(page.url()).searchParams.get('event'),rows.failed.id)
 await page.goto(base+'/admin/commercial-inbox?state=invalid',{waitUntil:'networkidle'});await expect(page.getByRole('alert').filter({hasText:'Não foi possível carregar'})).toBeVisible();await capture(page,'invalid-filter-light');await page.getByRole('link',{name:'Reabrir acompanhamento com filtros padrão'}).click();await page.waitForLoadState('networkidle')
 checks.push('Resumo no dashboard, filtros GET/paginação, seleção por UUID a partir do CMS e erro recuperável; formulário de retry separado do formulário nativo.')

 // The response must remain visible after the event leaves the attention filter.
 const failedRow=page.locator('.bibliotheon-commercial-events > li').filter({has:page.getByRole('heading',{name:/ops-long-/})})
 await failedRow.locator('summary').click();const retry=failedRow.locator('form')
 await retry.getByRole('combobox').selectOption('service_restored');await retry.getByRole('checkbox').check()
 let release!:()=>void,posts=0;const gate=new Promise<void>(r=>{release=r})
 await page.route(`**/api/v1/admin/inbox/${rows.failed.id}/retry`,async route=>{posts++;await gate;await route.continue()})
 try{
  await retry.getByRole('button',{name:'Recolocar na fila'}).click();await expect(retry.getByRole('button',{name:'Registrando…'})).toBeDisabled();await retry.dispatchEvent('submit');await expect.poll(()=>posts).toBe(1);await capture(page,'retry-busy-light')
 }finally{release()}
 const notice=page.getByRole('status').filter({hasText:'Evento recolocado na fila.'});await expect(notice).toBeVisible();await expect(failedRow).toHaveCount(0);await expect(notice).toBeFocused();await capture(page,'retry-confirmed-light')
 const updated=await payload.findByID({collection:'commercial-inbox',id:rows.failed.id,depth:0,overrideAccess:true});assert.equal(updated.state,'pending');assert.equal(updated.attempts,2);assert.equal(updated.attemptBase,2)
 const audit=await payload.find({collection:'commercial-audit',where:{and:[{inbox:{equals:rows.failed.id}},{action:{equals:'retry'}}]},depth:0,overrideAccess:true});assert.equal(audit.totalDocs,1);assert.equal(audit.docs[0].reason,'service_restored');assert.equal(audit.docs[0].actor,seed.owner.id)
 checks.push('Submissão ocupada bloqueia repetição; resposta 202 real gera uma auditoria, conserva tentativas e atualiza a lista. Feedback e foco persistem quando a linha sai do filtro.')

 await page.goto(base+'/admin/commercial-inbox',{waitUntil:'networkidle'});const reviewRow=page.locator('.bibliotheon-commercial-events > li').filter({has:page.getByRole('heading',{name:'Hotmart · ops-review',exact:true})});await reviewRow.locator('summary').click();const reviewForm=reviewRow.locator('form');await reviewForm.getByRole('combobox').selectOption('catalog_updated');await reviewForm.getByRole('checkbox').check()
 for(const status of [409,403,503]){
  await page.route(`**/api/v1/admin/inbox/${rows.review.id}/retry`,route=>route.fulfill({status,contentType:'application/json',body:'{"error":{"code":"synthetic"}}'}))
  await reviewForm.getByRole('button',{name:'Recolocar na fila'}).click();await expect(reviewForm.getByRole('alert')).toBeVisible();await expect(reviewForm.getByRole('alert')).toBeFocused();await capture(page,`retry-error-${status}-light`);await page.unroute(`**/api/v1/admin/inbox/${rows.review.id}/retry`)
 }
 await page.route(`**/api/v1/admin/inbox/${rows.review.id}/retry`,route=>route.abort('failed'));await reviewForm.getByRole('button',{name:'Recolocar na fila'}).click();await expect(reviewForm.getByRole('alert')).toContainText('Não foi possível confirmar');await capture(page,'retry-network-light');await page.unroute(`**/api/v1/admin/inbox/${rows.review.id}/retry`)
 assert.equal((await payload.count({collection:'commercial-audit',where:{and:[{inbox:{equals:rows.review.id}},{action:{equals:'retry'}}]},overrideAccess:true})).totalDocs,0)
 const collision=page.locator('.bibliotheon-commercial-events > li').filter({has:page.getByRole('heading',{name:'Hotmart · ops-applied',exact:true})});await collision.locator('summary').click();await expect(collision.getByRole('button',{name:'Recolocar na fila'})).toBeDisabled();await expect(collision.getByText(/Colisão de evento: o reprocessamento/)).toBeVisible();await capture(page,'collision-blocked-light')
 await ctx.close()
 checks.push('Estados visuais 409/403/503 e rede interrompida preservam entrada e mostram erro focável sem fabricar auditoria; colisão mantém ação desativada.')

 const dark=await context({viewport:{width:390,height:1000},colorScheme:'dark',reducedMotion:'reduce'}),mobile=await dark.newPage()
 await mobile.goto(base+'/admin',{waitUntil:'networkidle'});await capture(mobile,'dashboard-dark')
 await mobile.goto(`${base}/admin/commercial-inbox?provider=all&state=all&event=${rows.pending.id}`,{waitUntil:'networkidle'});await mobile.getByText('Reprocessar evento',{exact:true}).click();await expect(mobile.getByRole('button',{name:'Recolocar na fila'})).toBeDisabled();await capture(mobile,'pending-blocked-dark')
 await mobile.goto(`${base}/admin/commercial-inbox?provider=cakto&state=ignored`,{waitUntil:'networkidle'});await mobile.getByText('Reprocessar evento',{exact:true}).click();await expect(mobile.getByRole('button',{name:'Recolocar na fila'})).toBeDisabled();await capture(mobile,'ignored-blocked-dark')
 await payload.update({collection:'commercial-inbox',id:rows.active.id,data:{startedAt:new Date().toISOString()},overrideAccess:true})
 await mobile.goto(`${base}/admin/commercial-inbox?state=processing`,{waitUntil:'networkidle'});await expect(mobile.locator('.bibliotheon-commercial-events > li')).toHaveCount(2);await capture(mobile,'processing-dark')
 await mobile.setViewportSize({width:320,height:900});await capture(mobile,'reflow-320-dark')
 await mobile.evaluate(()=>{document.documentElement.style.fontSize='200%'});await capture(mobile,'text-200-dark');await dark.close()
 const noJS=await context({viewport:{width:390,height:1000},colorScheme:'light',javaScriptEnabled:false}),staticPage=await noJS.newPage()
 await staticPage.goto(`${base}/admin/commercial-inbox?state=needs_review&event=${rows.review.id}`,{waitUntil:'networkidle'});await expect(staticPage.getByRole('heading',{name:'Acompanhamento de eventos'})).toBeVisible();await staticPage.getByText('Reprocessar evento',{exact:true}).click();assert.equal(await staticPage.locator('noscript').evaluate(node=>node.textContent),'Ative JavaScript para registrar o reprocessamento neste formulário.');assert.ok(await staticPage.locator('noscript').evaluate(node=>node.getBoundingClientRect().height>0));await staticPage.getByRole('combobox',{name:'O que você conferiu?'}).selectOption('catalog_updated');await staticPage.getByRole('checkbox').check();await expect(staticPage.getByRole('button',{name:'Recolocar na fila'})).toBeDisabled();await capture(staticPage,'nojs-read-only',false);await noJS.close()
 checks.push('Pendentes/ignorados sem retry, processamento ativo/vencido, dark mobile, reflow 320px/texto 200% e leitura sem JavaScript com ação desabilitada.')
 assert.equal(externalAttempts,0);assert.deepEqual(runtimeErrors,[]);passed=true
}finally{
 await browser.close();await seed.cleanup()
 await writeFile(`${output}/results.json`,JSON.stringify({date:new Date().toISOString(),origin:base,passed,runtimeErrors,results,checks,externalRequestsBlocked:externalAttempts,externalCalls:false,limits:'Fixtures sintéticas no PostgreSQL loopback. Erros de formulário interceptados; sucesso 202 e auditoria usam API real local. Sem homologação nativa dos provedores, financeiro ou produção. Axe não executado no fallback sem JS.'},null,2)+'\n')
}
console.log(`Painel comercial visual: ${results.length} telas aprovadas; fixtures limpas.`)
process.exit(0)

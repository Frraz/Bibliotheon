import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,type BrowserContext,type Page,BrowserContextOptions} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {seedCommerce} from '../tests/fixtures/commerce'
import {testOrigin as base} from '../tests/fixtures/origin'
import {commercialTransactionKey} from '../src/modules/commerce/events'
import {recordSettlementEvidence,recordFinancialCost} from '../src/modules/commerce/financial-ledger'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed=await seedCommerce(),{payload}=seed,output='artifacts/qa-financial-ledger',results:{name:string;theme:string;width:number;overflow:boolean;violations:string[]}[]=[],checks:string[]=[],runtimeErrors:string[]=[]
let externalRequests=0
const browser=await chromium.launch(),owner={id:seed.owner.id,collection:'admin-users',role:'owner'},noExternal=async(context:BrowserContext)=>context.route(/^https?:\/\//,route=>{if(new URL(route.request().url()).origin===base)return route.continue();externalRequests++;return route.abort()})
await mkdir(output,{recursive:true})
async function makeContext(options:BrowserContextOptions,authenticated=true){
 const context=await browser.newContext(options)
 await noExternal(context)
 await context.addInitScript(()=>{try{localStorage.setItem('bibliotheon:appearance:v1',matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{/* about:blank uses an opaque origin */}})
 context.on('page',page=>page.on('pageerror',error=>runtimeErrors.push(error.name)))
 if(authenticated){const login=await context.request.post(base+'/api/admin-users/login',{data:{email:seed.owner.email,password:seed.password}});assert.equal(login.status(),200)}
 return context
}
async function capture(page:Page,name:string,theme:string,width:number){
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze(),overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
 await page.screenshot({path:`${output}/${name}.png`,fullPage:true})
 results.push({name,theme,width,overflow,violations:axe.violations.map(v=>v.id)})
 assert.equal(overflow,false,`${name}: overflow no documento`);assert.deepEqual(axe.violations.map(v=>v.id),[],`${name}: axe`)
}
let passed=false
try{
 const anonymous=await makeContext({viewport:{width:390,height:900}},false),anon=await anonymous.newPage();await anon.goto(base+'/admin/financial-ledger',{waitUntil:'networkidle'});assert.ok(new URL(anon.url()).pathname.includes('/admin/login'));await anonymous.close();checks.push('Anônimo é redirecionado ao login; a consulta não expõe conteúdo financeiro.')
 for(const theme of ['light','dark'] as const){const ctx=await makeContext({viewport:{width:390,height:900},colorScheme:theme,reducedMotion:'reduce'}),page=await ctx.newPage();await page.goto(base+'/admin/financial-ledger',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Prévia financeira'}).waitFor();await assert.equal(await page.locator('html').getAttribute('data-theme'),theme);await page.getByText('Não há transações ou movimentos financeiros registrados para esta consulta.').waitFor();await capture(page,`empty-${theme}-390`,theme,390);await ctx.close()}
 checks.push('Estado vazio renderiza nos dois temas e não fabrica totais ou coortes.')
 const add=async(provider:'hotmart'|'kiwify',id:string,grossCents:number|null,refundedCents:number|null,chargebackCents:number|null,feesCents:number|null,producerNetCents:number|null)=>payload.create({collection:'transactions',overrideAccess:true,data:{key:commercialTransactionKey({provider,accountKey:'synthetic',externalTransactionId:id}),provider,accountKey:'synthetic',externalTransactionId:id,externalProductId:'synthetic-product',externalOfferId:null,ebook:seed.books[0].id,offer:seed.offers[0].id,state:'approved',currency:'BRL',grossCents,refundedCents,chargebackCents,feesCents,producerNetCents,approvedAt:'2026-10-20T12:00:00.000Z',lastEventAt:'2026-10-20T12:00:00.000Z',needsReview:false,projection:{refundAndChargebackOverlap:false}}})
 await add('hotmart','qa-financial-complete',10000,2000,0,500,7500);await add('kiwify','qa-financial-partial',null,null,null,null,null)
 const settledAt='2026-10-23T12:00:00.000Z',settlement={provider:'hotmart' as const,accountKey:'synthetic',externalTransactionId:'qa-financial-complete',currency:'BRL',settlementReference:'qa-payout',settledAt,sourceKind:'provider_report' as const,sourceReference:'qa-bank-report',recordReference:'qa-credit-line',evidenceVerified:true as const}
 await recordSettlementEvidence(payload,owner,{...settlement,direction:'credit',amountCents:7500});await recordSettlementEvidence(payload,owner,{...settlement,direction:'debit',amountCents:500,settlementReference:'qa-payout-reversal',recordReference:'qa-debit-line'})
 await recordFinancialCost(payload,owner,{category:'advertising',amountCents:1000,currency:'BRL',campaignId:null,classification:'confirmed',sourceKind:'invoice',sourceReference:'qa-invoice',recordReference:'qa-invoice-line',incurredAt:settledAt});await recordFinancialCost(payload,owner,{category:'production',amountCents:300,currency:'BRL',campaignId:null,classification:'estimated',sourceKind:'manual_reconciliation',sourceReference:'qa-estimate',recordReference:'qa-estimate-line',incurredAt:settledAt})
 for(const theme of ['light','dark'] as const)for(const width of [320,360,390,768,1024,1440,1920]){
  const ctx=await makeContext({viewport:{width,height:1050},colorScheme:theme,reducedMotion:'reduce'}),page=await ctx.newPage();await page.goto(base+'/admin/financial-ledger?from=2026-10-20&through=2026-10-25',{waitUntil:'networkidle'})
  await page.getByRole('heading',{name:'Coortes por mês de aprovação'}).waitFor();await page.getByLabel('Moeda (opcional)').fill('BRL');await page.getByLabel('De (UTC)').fill('2026-10-20');await page.getByLabel('Até (UTC)').fill('2026-10-25');await page.getByRole('button',{name:'Atualizar prévia'}).focus();await page.keyboard.press('Enter');await page.waitForLoadState('networkidle')
  await page.getByText('1/2',{exact:true}).waitFor();await page.getByText('70,00 BRL').waitFor();await page.getByText('10,00 BRL').waitFor();await page.getByText('3,00 BRL').waitFor();await page.getByText('Margem completa: não. Esta prévia não declara lucro.').waitFor()
  await capture(page,`report-${theme}-${width}`,theme,width);await ctx.close()
 }
 assert.equal((await payload.count({collection:'transaction-events',overrideAccess:true})).totalDocs,0)
 checks.push('Período/moeda por formulário GET, tabela de coortes, valores parciais null, créditos/débitos, custos estimados/confirmados, margem incompleta e acesso por teclado foram conferidos. Tela não escreve fatos comerciais.')
 assert.deepEqual(runtimeErrors,[]);assert.equal(externalRequests,0,'requisições externas bloqueadas');passed=true
}finally{
 await writeFile(`${output}/results.json`,JSON.stringify({date:new Date().toISOString(),checks,results,runtimeErrors,externalRequests,status:passed?'passed':'failed',limits:'B20 recortado para a tela financeira; fixtures sintéticas, sem screenshots com compradores, sem fonte nativa ou conta homologada.'},null,2)+'\n')
 await browser.close();await seed.cleanup()
}
console.log(`QA da prévia financeira: ${results.length} capturas aprovadas; fixtures limpas.`);process.exit(0)

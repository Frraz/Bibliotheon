import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],path='/api/v1/admin/imports/preview'
const fields=[...csvFields];fields[4]=''
const zeroLedger=async()=>{for(const collection of commercialCollections)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0)}
try{
 const post=(body:BodyInit,headers:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'text/csv',Origin:base,...headers},body})
 assert.equal((await post(canonicalCSV([fields]))).status,403)
 const login=await fetch(base+'/api/admin-users/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:seed.owner.email,password:seed.password})});assert.equal(login.status,200)
 const {token}=await login.json() as {token:string};assert.ok(token)
 const auth={Authorization:`JWT ${token}`}
 assert.equal((await post(canonicalCSV([fields]),{...auth,Origin:'https://other.invalid'})).status,403)
 const missingOrigin=await fetch(base+path,{method:'POST',headers:{...auth,'Content-Type':'text/csv'},body:canonicalCSV([fields])});assert.equal(missingOrigin.status,403)
 assert.equal((await fetch(base+path,{headers:auth})).status,405);await zeroLedger()
 checks.push('Rota real exige sessão owner e origem exata; anônimo, outra origem e ausência de Origin rejeitados, GET não disponível. Nenhuma escrita comercial.')
 const response=await post(canonicalCSV([fields,fields]),auth);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer')
 const preview=await response.json();assert.equal(preview.provisional,true);assert.equal(preview.committable,false);assert.equal(preview.counts.new,1);assert.equal(preview.counts.duplicate,1);assert.equal(preview.lines[1].duplicateOf,2);await zeroLedger()
 checks.push('Owner recebe prévia privada de candidato novo e repetição sem criar venda, recibo, fato, conflito ou auditoria; confirmação permanece indisponível.')
 const unsafe=[...fields];unsafe[1]='never-store@example.invalid';const invalid=await post(canonicalCSV([unsafe]),auth);assert.equal(invalid.status,200);const invalidBody=await invalid.text();assert.equal(invalidBody.includes('never-store'),false);assert.equal(JSON.parse(invalidBody).counts.invalid,1)
 for(const [headers,status] of [[{'Content-Type':'application/json'},415],[{'Content-Type':'text/csv; charset = utf-16'},415],[{'Content-Encoding':'gzip'},415]] as const)assert.equal((await post(canonicalCSV([fields]),{...auth,...headers})).status,status)
 assert.equal((await post('not-a-header',auth)).status,422);assert.equal((await post(' '.repeat(5*1024*1024+1),auth)).status,413);await zeroLedger()
 checks.push('Erros por registro não refletem dados pessoais. MIME/charset/encoding/cabeçalho/limite incorretos não persistem arquivo nem informações financeiras.')
 const rows=Array.from({length:201},(_,index)=>{const row=[...fields];row[2]='synthetic-bulk-'+index;return row})
 const bulk=await post(canonicalCSV(rows),auth);assert.equal(bulk.status,200);assert.equal((await bulk.json()).counts.new,201)
 const received=[...fields];received[12]='9000';const settlement=await post(canonicalCSV([received]),auth);assert.equal(settlement.status,200);assert.equal((await settlement.json()).lines[0].reason,'settlement_evidence_required');await zeroLedger()
 checks.push('Consultas em blocos cobrem 201 identidades sem gravação; recebimento informado exige evidência própria e não é inferido de aprovação/bruto.')
}finally{await seed.cleanup()}
await mkdir('artifacts/commercial-csv',{recursive:true})
await writeFile('artifacts/commercial-csv/http-results.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,externalCalls:false,realSales:0,limits:'Next loopback e owner/CSV sintéticos. Somente prévia provisória, sem persistência/commit/importação nativa/relatório financeiro ou homologação comercial.'},null,2)+'\n')
console.log(`CSV HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)

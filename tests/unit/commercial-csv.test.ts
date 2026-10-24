import {describe,it,expect,vi} from 'vitest'
import type {Payload} from 'payload'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {parseCommercialCSV,CommercialCSVError,CSV_MAX_BYTES,spreadsheetCSV} from '../../src/modules/commerce/csv'
import {assessCommercialCSV,type CatalogEntry,type PreviewTransaction} from '../../src/modules/commerce/import-preview'
import {previewCommercialImportRequest} from '../../src/modules/commerce/import-http'
const now=Date.parse('2026-10-24T12:00:00Z'),catalog:CatalogEntry[]=[{id:'offer',provider:'hotmart',accountKey:'synthetic',externalProductId:'synthetic-product',externalOfferId:'synthetic-offer',ebook:'ebook'}]
function transaction():PreviewTransaction{
 const parsed=parseCommercialCSV(canonicalCSV()),line=parsed.lines[0];if(!line.ok)throw new Error('invalid fixture')
 return{id:'transaction',key:line.key,provider:'hotmart',accountKey:'synthetic',externalTransactionId:'synthetic-transaction',externalProductId:'synthetic-product',externalOfferId:'synthetic-offer',ebook:'ebook',state:'approved',currency:'BRL',grossCents:9990,refundedCents:null,feesCents:990,producerNetCents:null,approvedAt:'2026-10-20T11:01:00.000Z',lastEventAt:'2026-10-20T11:01:00.000Z',needsReview:false}
}
const assess=(rows:readonly (readonly string[])[]=[csvFields],offers:CatalogEntry[]=catalog,ledger:PreviewTransaction[]=[])=>assessCommercialCSV(parseCommercialCSV(canonicalCSV(rows)),offers,ledger,now)
describe('CSV comercial canônico',()=>{
 it('preserva zero versus desconhecido, valores assinados e centavos seguros sem multiplicação',()=>{
  const fields=[...csvFields];fields[8]='0';fields[10]='-990';fields[11]='-100';fields[12]='-20'
  const parsed=parseCommercialCSV(canonicalCSV([fields])),line=parsed.lines[0];expect(line.ok).toBe(true);if(line.ok)expect(line.row).toMatchObject({grossCents:0,refundedCents:null,feesCents:-990,producerNetCents:-100,settledCents:-20})
  fields[8]='9007199254740991';expect(parseCommercialCSV(canonicalCSV([fields])).lines[0].ok).toBe(true)
  for(const amount of ['9007199254740992','99.90','1e2',' 9990','-1']){fields[8]=amount;expect(parseCommercialCSV(canonicalCSV([fields])).lines[0]).toMatchObject({ok:false,code:'invalid_money'})}
 })
 it('aceita BOM/CRLF/aspas escapadas; não adivinha delimitador/cabeçalho nem faz trim',()=>{
  const fields=[...csvFields];fields[2]='synthetic,"quoted"';const bytes=Buffer.concat([Buffer.from('\uFEFF'),canonicalCSV([fields])]);const line=parseCommercialCSV(bytes).lines[0];expect(line.ok).toBe(true);if(line.ok)expect(line.row.externalTransactionId).toBe('synthetic,"quoted"')
  expect(()=>parseCommercialCSV(Buffer.from(canonicalCSV().toString().replaceAll(',',';')))).toThrow('invalid_header')
  expect(()=>parseCommercialCSV(Buffer.from(canonicalCSV().toString().replace('provider,',' provider,')))).toThrow('invalid_header')
 })
 it('recusa UTF-8 inválido, aspas abertas, lixo após aspas, campo gigante e arquivo sem linhas',()=>{
  for(const [bytes,code] of [[Buffer.from([0xff]),'invalid_utf8'],[Buffer.from(canonicalCSV().toString().replace('synthetic-transaction','"unfinished')),'invalid_quotes'],[Buffer.from(canonicalCSV().toString().replace('synthetic-transaction','"closed"garbage')),'invalid_quotes'],[canonicalCSV([[...csvFields.slice(0,2),'x'.repeat(513),...csvFields.slice(3)]]),'field_too_long'],[Buffer.from(canonicalCSV([])),'empty_file']] as const){try{parseCommercialCSV(bytes);throw new Error('expected rejection')}catch(error){expect(error).toBeInstanceOf(CommercialCSVError);expect((error as CommercialCSVError).code).toBe(code)}}
 })
 it('limita 5 MiB/10 mil registros lógicos e não acumula milhões de colunas vazias',()=>{
  expect(()=>parseCommercialCSV(new Uint8Array(CSV_MAX_BYTES+1))).toThrow('too_large')
  expect(parseCommercialCSV(canonicalCSV(Array.from({length:10000},()=>csvFields))).lines).toHaveLength(10000)
  expect(()=>parseCommercialCSV(canonicalCSV(Array.from({length:10001},()=>csvFields)))).toThrow('too_many_rows')
  const header=canonicalCSV([]),many=Buffer.concat([header,Buffer.from(','.repeat(100000))]);expect(parseCommercialCSV(many).lines[0]).toMatchObject({ok:false,code:'column_count'})
 })
 it('retorna erro por registro sem expor email/token/campo submetido',()=>{
  const invalids=[{index:1,value:'never-store@example.invalid',code:'invalid_identity'},{index:0,value:'unknown',code:'invalid_provider'},{index:5,value:'paid',code:'invalid_status'},{index:6,value:'2026-02-30T12:00:00Z',code:'invalid_time'},{index:7,value:'brl',code:'invalid_currency'}]
  for(const item of invalids){const fields=[...csvFields];fields[item.index]=item.value;const line=parseCommercialCSV(canonicalCSV([fields])).lines[0];expect(line).toEqual({line:2,ok:false,code:item.code});expect(JSON.stringify(line)).not.toContain(item.value)}
  const fields=[...csvFields];fields[2]='identifier\nwith-newline';expect(parseCommercialCSV(canonicalCSV([fields])).lines[0]).toMatchObject({ok:false,code:'invalid_identity'})
 })
 it('normaliza instantes UTC, separa contas/provedores e identifica instantâneos iguais',()=>{
  const first=parseCommercialCSV(canonicalCSV()).lines[0],fields=[...csvFields];fields[6]='2026-10-20T11:01:00Z';const same=parseCommercialCSV(canonicalCSV([fields])).lines[0]
  expect(first.ok&&same.ok&&first.digest===same.digest).toBe(true)
  fields[1]='another-account';const other=parseCommercialCSV(canonicalCSV([fields])).lines[0];expect(first.ok&&other.ok&&first.key!==other.key).toBe(true)
  fields[6]='2026-10-20T11:01:00-03:00';expect(parseCommercialCSV(canonicalCSV([fields])).lines[0]).toMatchObject({ok:false,code:'invalid_time'})
 })
 it('neutraliza fórmulas em texto, preserva números assinados e escapa CSV para planilhas',()=>{
  expect(spreadsheetCSV([['=SUM(A1:A2)',' +1','\t@SUM(1)','-text',-100,null,'a,"b"']])).toBe('\'=SUM(A1:A2),\' +1,\'\t@SUM(1),\'-text,-100,,"a,""b"""\r\n')
  expect(spreadsheetCSV([['\x00=SUM(1)']])).toBe("'\x00=SUM(1)\r\n")
  expect(()=>spreadsheetCSV([[1.1]])).toThrow('invalid_export_number')
 })
})
describe('prévia não financeira e somente de leitura',()=>{
 it('distingue novo, compatível e repetição no mesmo arquivo; nunca habilita commit',()=>{
  expect(assess().lines[0]).toMatchObject({classification:'new',reason:'new_transaction'})
  const result=assess([csvFields,csvFields],catalog,[transaction()]);expect(result.counts).toMatchObject({matched:1,duplicate:1});expect(result.lines[1].duplicateOf).toBe(2);expect(result.provisional).toBe(true);expect(result.committable).toBe(false)
 })
 it('mesma transação com dois instantâneos diferentes bloqueia todas as ocorrências',()=>{
  const changed=[...csvFields];changed[8]='10000'
  const result=assess([csvFields,csvFields,changed]);expect(result.counts.conflict).toBe(3);expect(result.lines.every(line=>line.reason==='conflict_in_file')).toBe(true)
 })
 it('reconhece produto/oferta desconhecidos e ambiguidade sem usar oferta primária ou preço',()=>{
  expect(assess([csvFields],[]).lines[0]).toMatchObject({classification:'unknown_catalog',reason:'unknown_offer'})
  const withoutOffer=[...csvFields];withoutOffer[4]='';expect(assess([withoutOffer],[]).lines[0].reason).toBe('unknown_product')
  expect(assess([withoutOffer],[...catalog,{...catalog[0],id:'other',ebook:'other-book'}]).lines[0].reason).toBe('ambiguous_product')
  expect(assess([csvFields],[...catalog,{...catalog[0],id:'other'}]).lines[0].reason).toBe('ambiguous_offer')
 })
 it('confere produto/livro/moeda/estado/data/valores e preserva revisão anterior',()=>{
  const ledger=transaction();ledger.grossCents=10000;expect(assess([csvFields],catalog,[ledger]).lines[0]).toMatchObject({classification:'conflict',differences:['gross_cents']})
  ledger.needsReview=true;expect(assess([csvFields],catalog,[ledger]).lines[0].reason).toBe('existing_review')
  ledger.needsReview=false;ledger.ebook='other-book';expect(assess([csvFields],catalog,[ledger]).lines[0].reason).toBe('catalog_history_conflict')
 })
 it('não transforma lacuna em zero, aprovação em recebimento ou nova evidência em correção automática',()=>{
  const ledger=transaction(),fields=[...csvFields];fields[11]='9000';expect(assess([fields],catalog,[ledger]).lines[0].reason).toBe('additional_evidence')
  fields[11]='';fields[10]='';expect(assess([fields],catalog,[ledger]).lines[0].reason).toBe('incomplete_snapshot')
  fields[12]='9000';expect(assess([fields],catalog,[ledger]).lines[0].reason).toBe('settlement_evidence_required')
  fields[12]='';fields[6]='2027-01-01T00:00:00Z';expect(assess([fields]).lines[0].reason).toBe('future_event_time')
 })
 it('avalia dez mil duplicatas em tempo linear sem consultar ou gravar dados',()=>{
  const result=assess(Array.from({length:10000},()=>csvFields));expect(result.counts.new).toBe(1);expect(result.counts.duplicate).toBe(9999)
 })
})
describe('HTTP da prévia exige owner/origem antes da leitura',()=>{
 const mock=(user:unknown)=>({auth:vi.fn(async()=>({user})),find:vi.fn(async()=>{throw new Error('synthetic database failure')})})
 const owner={collection:'admin-users',role:'owner'},env={PUBLIC_SITE_URL:'http://127.0.0.1:3000'}
 const request=(body:BodyInit=canonicalCSV(),extra:HeadersInit={})=>new Request(env.PUBLIC_SITE_URL+'/api/v1/admin/imports/preview',{method:'POST',headers:{Origin:env.PUBLIC_SITE_URL,'Content-Type':'text/csv',...Object.fromEntries(new Headers(extra))},body})
 it('recusa anônimo, outra coleção, outro papel e origem diferente sem ler CSV',async()=>{
  for(const user of [null,{collection:'admin-users',role:'editor'},{collection:'contacts',role:'owner'}]){const db=mock(user),read=vi.fn(),stream=new ReadableStream({pull:read},{highWaterMark:0}),req=new Request(env.PUBLIC_SITE_URL,{method:'POST',body:stream,duplex:'half'} as RequestInit&{duplex:'half'});expect((await previewCommercialImportRequest(req,db as unknown as Payload,env)).status).toBe(403);expect(read).not.toHaveBeenCalled();expect(db.find).not.toHaveBeenCalled()}
  const db=mock(owner);expect((await previewCommercialImportRequest(request(undefined,{Origin:'https://other.invalid'}),db as unknown as Payload,env)).status).toBe(403)
 })
 it('rejeita MIME/charset/encoding/tamanho e não expõe erro ou conteúdo ao falhar',async()=>{
  const db=mock(owner)
  for(const [headers,status] of [[{'Content-Type':'application/json'},415],[{'Content-Type':'text/csv; charset=utf-16'},415],[{'Content-Type':'text/csv; charset = utf-16'},415],[{'Content-Type':'text/csv; charset=utf-8; charset=utf-16'},415],[{'Content-Encoding':'gzip'},415],[{'Content-Length':String(CSV_MAX_BYTES+1)},413]] as const)expect((await previewCommercialImportRequest(request(undefined,headers),db as unknown as Payload,env)).status).toBe(status)
  expect((await previewCommercialImportRequest(request('not-a-header'),db as unknown as Payload,env)).status).toBe(422);expect(db.find).not.toHaveBeenCalled()
  const result=await previewCommercialImportRequest(request(),db as unknown as Payload,env);expect(result.status).toBe(503);expect(await result.json()).toEqual({code:'unavailable'})
 })
 it('interrompe corpo lento em cinco segundos',async()=>{
  vi.useFakeTimers()
  try{const db=mock(owner),stream=new ReadableStream({start(){}},{highWaterMark:0}),req=new Request(env.PUBLIC_SITE_URL,{method:'POST',headers:{Origin:env.PUBLIC_SITE_URL,'Content-Type':'text/csv'},body:stream,duplex:'half'} as RequestInit&{duplex:'half'}),pending=previewCommercialImportRequest(req,db as unknown as Payload,env);await vi.advanceTimersByTimeAsync(5001);expect((await pending).status).toBe(408);expect(db.find).not.toHaveBeenCalled()}finally{vi.useRealTimers()}
 })
})

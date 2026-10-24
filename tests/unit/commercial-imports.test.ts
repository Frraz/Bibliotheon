import {describe,it,expect,vi} from 'vitest'
import type {Payload} from 'payload'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {validatedImport,importMetadata,prepareImportReceipt,restoreImport,importManifestHash,requireImportOwner} from '../../src/modules/commerce/import-plan'
import {restoreCommercialCSVLine} from '../../src/modules/commerce/csv'
import {stageCommercialImportRequest,commitCommercialImportRequest} from '../../src/modules/commerce/import-http'
const metadata={sourceKind:'provider_report',sourceReference:'report-20261024-001',reason:'missing_webhook'}
describe('manifesto e custódia de importação',()=>{
 it('exige fonte/referência/justificativa controladas sem campo livre ou identificador pessoal',()=>{
  expect(importMetadata(metadata)).toEqual(metadata)
  for(const extra of [{sourceKind:'webhook'},{sourceReference:'buyer@example.invalid'},{sourceReference:'https://example.invalid/report'},{sourceReference:'a'.repeat(97)},{reason:'texto livre'}, {email:'never-store@example.invalid'}])expect(importMetadata({...metadata,...extra})).toBeNull()
 })
 it('somente owner real da coleção administrativa pode preparar ou confirmar',()=>{
  for(const actor of [null,{id:'x',collection:'contacts',role:'owner'},{id:'x',collection:'admin-users',role:'editor'}])expect(()=>requireImportOwner(actor)).toThrow('forbidden')
 })
 it('recusa linhas inválidas e mistura de contas/provedores antes da persistência',()=>{
  const wrong=[...csvFields];wrong[1]='never-store@example.invalid';expect(()=>validatedImport(canonicalCSV([wrong]))).toThrow('invalid_rows')
  const second=[...csvFields];second[0]='cakto';expect(()=>validatedImport(canonicalCSV([csvFields,second]))).toThrow('mixed_accounts')
  second[0]='hotmart';second[1]='other-account';expect(()=>validatedImport(canonicalCSV([csvFields,second]))).toThrow('mixed_accounts')
 })
 it('revalida whitelist/tipos/canonicalização da linha salva, sem confiar no hash recebido',()=>{
  const {lines}=validatedImport(canonicalCSV()),row=lines[0].row
  expect(restoreCommercialCSVLine(row,2)?.digest).toBe(lines[0].digest)
  for(const value of [{...row,buyer:'never-store@example.invalid'},{...row,grossCents:'9990'},{...row,occurredAt:'2026-10-20T11:01:00Z'},{...row,externalOfferId:''},{...row,settledCents:NaN}])expect(restoreCommercialCSVLine(value,2)).toBeNull()
  expect(()=>restoreImport([], 'a'.repeat(64),'b'.repeat(64))).toThrow('integrity_conflict')
 })
 it('identidade da inbox independe de arquivo/fonte/ator, sem transformar snapshot em HMAC de fornecedor',()=>{
  const parsed=validatedImport(canonicalCSV()),receipt=prepareImportReceipt(parsed.lines[0]);expect(receipt.adapterVersion).toBe('csv-owner-snapshot-v1');expect(receipt.state).toBe('prepared')
  expect(receipt.event).toMatchObject({sourceEvent:'csv_snapshot_approved',approvedAt:'2026-10-20T11:01:00.000Z',grossCents:9990,refundedCents:null,chargebackCents:null,externalClickReference:null})
  expect(prepareImportReceipt(parsed.lines[0]).key).toBe(receipt.key);expect(importManifestHash(parsed)).toHaveLength(64)
 })
 it('reversão, devolução com base insuficiente e recebimento não são enfileirados por inferência',()=>{
  for(const [index,value] of [[5,'refunded'],[5,'partially_refunded'],[5,'chargeback'],[9,'0'],[12,'9000']] as const){const fields=[...csvFields];fields[index]=value;expect(()=>prepareImportReceipt(validatedImport(canonicalCSV([fields])).lines[0])).toThrow('snapshot_not_supported')}
 })
 it('não atribui aprovação a pendência/recusa/cancelamento',()=>{
  for(const status of ['pending','refused','canceled']){const fields=[...csvFields];fields[5]=status;expect(prepareImportReceipt(validatedImport(canonicalCSV([fields])).lines[0]).event).toMatchObject({kind:status,approvedAt:null})}
 })
})
describe('APIs de gravação exigem owner/origem e confirmação explícita',()=>{
 const env={PUBLIC_SITE_URL:'http://127.0.0.1:3000'},owner={id:'00000000-0000-4000-8000-000000000001',collection:'admin-users',role:'owner'}
 const mock=(user:unknown)=>({auth:vi.fn(async()=>({user})),findByID:vi.fn(),db:{beginTransaction:vi.fn()}})
 it('sem autenticação não lê corpo nem abre transação',async()=>{
  const db=mock(null),read=vi.fn(),req=()=>new Request(env.PUBLIC_SITE_URL,{method:'POST',body:new ReadableStream({pull:read},{highWaterMark:0}),duplex:'half'} as RequestInit&{duplex:'half'})
  expect((await stageCommercialImportRequest(req(),db as unknown as Payload,env)).status).toBe(403);expect((await commitCommercialImportRequest(req(),owner.id,db as unknown as Payload,env)).status).toBe(403);expect(read).not.toHaveBeenCalled();expect(db.db.beginTransaction).not.toHaveBeenCalled()
 })
 it('não aceita fonte livre ou JSON com plano/ator arbitrários',async()=>{
  const db=mock(owner),request=(body:unknown)=>new Request(env.PUBLIC_SITE_URL,{method:'POST',headers:{Origin:env.PUBLIC_SITE_URL,'Content-Type':'application/json'},body:JSON.stringify(body)})
  expect((await stageCommercialImportRequest(request({}),db as unknown as Payload,env)).status).toBe(422)
  for(const body of [{confirmed:false,planHash:'a'.repeat(64)},{confirmed:true,planHash:'a'.repeat(64),actor:owner.id},{confirmed:true,planHash:'bad'}])expect((await commitCommercialImportRequest(request(body),owner.id,db as unknown as Payload,env)).status).toBe(422)
  expect(db.db.beginTransaction).not.toHaveBeenCalled()
 })
 it('limita o JSON de confirmação a 4 KiB e não reflete conteúdo no erro',async()=>{
  const db=mock(owner),req=new Request(env.PUBLIC_SITE_URL,{method:'POST',headers:{Origin:env.PUBLIC_SITE_URL,'Content-Type':'application/json'},body:' '.repeat(4097)}),result=await commitCommercialImportRequest(req,owner.id,db as unknown as Payload,env)
  expect(result.status).toBe(413);expect(await result.json()).toEqual({code:'too_large'});expect(db.db.beginTransaction).not.toHaveBeenCalled()
 })
})

import { describe,it,expect,vi } from 'vitest'
import { createBrevoCampaigns } from '../../src/integrations/brevo/campaigns'
import { campaignCopy,draftHash,type DraftSpec } from '../../src/modules/marketing/campaign-copy'
import { copyHash,type SequenceCopy } from '../../src/modules/marketing/sequence-copy'
const id='00000000-0000-0000-0000-000000000001'
const spec:DraftSpec={name:`bibliotheon-${id}`,senderId:41,listId:51,subject:'Assunto sintético',htmlContent:'<p>Conteúdo sintético</p>'}
const report=(extra={})=>Response.json({id:61,name:spec.name,status:'draft',type:'classic',sender:{id:41},subject:spec.subject,htmlContent:spec.htmlContent,recipients:{lists:[51],exclusionLists:[]},mirrorActive:false,...extra})
describe('rascunhos Brevo',()=>{
 it('renderiza texto literal, só placeholders próprios e contexto de checkout preservado',()=>{
  const copy:SequenceCopy={revision:1,offerId:id,messages:([2,4,7,10] as const).map(day=>({day,subject:`Assunto ${day}`,text:'<script>alert(1)</script>\n{{ contact.EMAIL }}\n{% if true %}'}))}
  const rendered=campaignCopy(id,{theme:id,stage:7,day:'2026-10-22',snapshot:{...copy,contentHash:copyHash(copy),ebookId:id,campaignCode:'synthetic-affiliate'}},'https://example.invalid',41,51)
  expect(rendered.htmlContent).not.toContain('<script>');expect(rendered.htmlContent).not.toContain('{{ contact.EMAIL }}');expect(rendered.htmlContent).not.toContain('{%')
  expect(rendered.htmlContent).toContain('&#123;&#123; contact.EMAIL');expect(rendered.htmlContent).toContain('{{ contact.BIBLIOTHEON_PREFERENCES }}');expect(rendered.htmlContent).toContain('{{ unsubscribe }}')
  expect(rendered.htmlContent).toContain(`/comprar/${id}?c=synthetic-affiliate`)
  expect(draftHash(rendered)).not.toBe(draftHash({...rendered,listId:52}))
  copy.messages[2].subject='{{ contact.EMAIL }}'
  expect(()=>campaignCopy(id,{theme:id,stage:7,day:'2026-10-22',snapshot:{...copy,contentHash:copyHash(copy),ebookId:id}},'https://example.invalid',41,51)).toThrow()
 })
 it('POST cria somente rascunho clássico, sem agendamento, testes ou sendNow',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValue(Response.json({id:61},{status:201}))
  expect(await createBrevoCampaigns('synthetic',41,request).create(spec)).toEqual({state:'created',id:61})
  const [url,options]=request.mock.calls[0],body=JSON.parse(String(options?.body))
  expect(url).toBe('https://api.brevo.com/v3/emailCampaigns');expect(options?.redirect).toBe('error');expect(options?.signal).toBeDefined()
  expect(body).toEqual({name:spec.name,sender:{id:41},type:'classic',subject:spec.subject,htmlContent:spec.htmlContent,recipients:{listIds:[51]},abTesting:false,sendAtBestTime:false,mirrorActive:false})
 })
 it('sucesso sem ID, timeout e recusa não inventam recurso conhecido',async()=>{
  for(const [status,state] of [[201,'retry'],[400,'rejected'],[429,'retry'],[503,'retry']] as const){const request=vi.fn<typeof fetch>().mockResolvedValue(Response.json({},{status}));expect(await createBrevoCampaigns('synthetic',41,request).create(spec)).toEqual({state})}
  const request=vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout'));expect(await createBrevoCampaigns('synthetic',41,request).create(spec)).toEqual({state:'retry'})
 })
 it('verifica conteúdo, remetente, lista exata e estado; alterações nunca são corrigidas com PUT',async()=>{
  for(const extra of [{},{subject:'Outra cópia'},{sender:{id:42}},{recipients:{lists:[51,52],exclusionLists:[]}},{status:'sent'},{scheduledAt:'2026-10-23T00:00:00Z'},{mirrorActive:true},{abTesting:'true'},{recipients:{lists:[51],exclusionLists:[],segments:[1]}}]){
   const request=vi.fn<typeof fetch>().mockResolvedValue(report(extra));expect(await createBrevoCampaigns('synthetic',41,request).verify(61,spec)).toEqual({state:Object.keys(extra).length?'conflict':'verified'});expect(request.mock.calls[0][1]?.method).toBe('GET')
  }
 })
 it('reconcilia nome exclusivo com paginação completa; duplicidade/contagem instável não provam ausência',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({count:51,campaigns:Array.from({length:50},(_,i)=>({id:i+1,name:'other'}))})).mockResolvedValueOnce(Response.json({count:51,campaigns:[{id:61,name:spec.name}]}))
  expect(await createBrevoCampaigns('synthetic',41,request).find(spec.name)).toEqual({state:'found',id:61});expect(String(request.mock.calls[1][0])).toContain('offset=50')
  for(const [data,state] of [[{count:2,campaigns:[{id:1,name:spec.name},{id:2,name:spec.name}]},'conflict'],[{count:1001,campaigns:[]},'retry'],[{count:2,campaigns:[]},'retry']] as const){const stub=vi.fn<typeof fetch>().mockResolvedValue(Response.json(data));expect(await createBrevoCampaigns('synthetic',41,stub).find(spec.name)).toEqual({state})}
 })
 it('respostas grandes/malformadas e IDs inválidos são recusados sem ampliação de chamadas',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(131073)))
  const client=createBrevoCampaigns('synthetic',41,request);expect(await client.verify(61,spec)).toEqual({state:'retry'});expect(await client.verify(0,spec)).toEqual({state:'rejected'});expect(request).toHaveBeenCalledTimes(1)
  expect(()=>createBrevoCampaigns('synthetic',0,request)).toThrow()
 })
})

import { describe,it,expect,vi } from 'vitest'
import { campaignStatuses,createBrevoCampaignObserver,configuredBrevoCampaignObserver } from '../../src/integrations/brevo/campaign-observer'
const spec={name:'bibliotheon-00000000-0000-0000-0000-000000000001',senderId:41,listId:51,subject:'Sintético',htmlContent:'<p>Sintético</p>'}
const body=(extra={})=>({id:61,name:spec.name,status:'queued',type:'classic',sender:{id:41},subject:spec.subject,htmlContent:spec.htmlContent,recipients:{lists:[51],exclusionLists:[]},mirrorActive:false,...extra})
describe('observação Brevo',()=>{
 it('consulta nove estados nativos, sem mutações nem estatísticas no resultado',async()=>{
  for(const status of campaignStatuses){
   const request=vi.fn<typeof fetch>().mockResolvedValue(Response.json(body({status,sentDate:status==='sent'?'2026-10-24T03:00:00-03:00':undefined,statistics:{clickers:['private@example.invalid']}})))
   expect(await createBrevoCampaignObserver('synthetic',request).inspect(61,spec)).toEqual({state:'report',status,...(status==='sent'?{sentAt:'2026-10-24T06:00:00.000Z'}:{})})
   expect(request.mock.calls[0][0]).toBe('https://api.brevo.com/v3/emailCampaigns/61?statistics=globalStats');expect(request.mock.calls[0][1]?.method).toBe('GET');expect(request.mock.calls[0][1]?.redirect).toBe('error');expect(request.mock.calls[0][1]?.body).toBeUndefined()
  }
 })
 it('recusa metadados divergentes e estados de filtro camelCase',async()=>{
  for(const extra of [{name:'foreign'},{sender:{id:42}},{subject:'changed'},{htmlContent:'changed'},{recipients:{lists:[51,52],exclusionLists:[]}},{mirrorActive:true}])expect(await createBrevoCampaignObserver('synthetic',async()=>Response.json(body(extra))).inspect(61,spec)).toEqual({state:'conflict'})
  for(const status of ['inProcess','inReview','scheduled','unknown'])expect(await createBrevoCampaignObserver('synthetic',async()=>Response.json(body({status}))).inspect(61,spec)).toEqual({state:'unsupported'})
 })
 it('não transforma falha, ausência ou resposta inválida em atividade',async()=>{
  for(const [status,state] of [[404,'absent'],[401,'rejected'],[429,'retry'],[503,'retry'],[204,'retry']] as const)expect(await createBrevoCampaignObserver('synthetic',async()=>new Response(null,{status})).inspect(61,spec)).toEqual({state})
  for(const response of [new Response('x'.repeat(131073)),Response.json(body({sentDate:'invalid'}))])expect(await createBrevoCampaignObserver('synthetic',async()=>response).inspect(61,spec)).toEqual({state:'retry'})
  const request=vi.fn<typeof fetch>();expect(await createBrevoCampaignObserver('synthetic',request).inspect(0,spec)).toEqual({state:'rejected'});expect(request).not.toHaveBeenCalled()
 })
 it('configuração depende só da flag e da chave, sem ativar envio',()=>{
  vi.stubEnv('BREVO_CAMPAIGN_OBSERVE_ENABLED','false');expect(configuredBrevoCampaignObserver()).toBeNull()
  vi.stubEnv('BREVO_CAMPAIGN_OBSERVE_ENABLED','true');vi.stubEnv('BREVO_API_KEY','synthetic');vi.stubEnv('BREVO_CAMPAIGN_SEND_ENABLED','false');vi.stubEnv('LEAD_TOKEN_SECRET','');expect(configuredBrevoCampaignObserver()).not.toBeNull()
  vi.stubEnv('BREVO_API_KEY','invalid key');expect(configuredBrevoCampaignObserver()).toBeNull();vi.unstubAllEnvs()
 })
})

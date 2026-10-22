import { describe,it,expect,vi } from 'vitest'
import { createBrevoCampaignDispatch } from '../../src/integrations/brevo/campaign-dispatch'
import { readSendHistory } from '../../src/modules/marketing/send-history'
const attempt={number:1,token:'00000000-0000-0000-0000-000000000001',issuedAt:'2026-10-22T12:00:00.000Z',quotaDay:'2026-10-22',count:2,state:'issuing'}
describe('disparo de campanha e histórico mínimo',()=>{
 it('204 registra solicitação agendada pelo provedor, sem inventar entrega ou mensagem',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:204}))
  expect(await createBrevoCampaignDispatch('synthetic',request).sendNow(41)).toEqual({state:'submitted',code:204})
  const [url,options]=request.mock.calls[0];expect(url).toBe('https://api.brevo.com/v3/emailCampaigns/41/sendNow');expect(options?.method).toBe('POST');expect(options?.body).toBeUndefined();expect(options?.redirect).toBe('error');expect(options?.signal).toBeDefined()
 })
 it('somente recusas documentadas são negativas definitivas; demais respostas mantêm incerteza',async()=>{
  for(const code of [400,402,404]) {const request=vi.fn<typeof fetch>().mockResolvedValue(new Response('body discarded',{status:code}));expect(await createBrevoCampaignDispatch('synthetic',request).sendNow(41)).toEqual({state:'rejected',code})}
  for(const code of [200,201,401,403,409,429,500,503]) {const request=vi.fn<typeof fetch>().mockResolvedValue(new Response('body discarded',{status:code}));expect(await createBrevoCampaignDispatch('synthetic',request).sendNow(41)).toEqual({state:'uncertain'})}
 })
 it('timeout não é reenviado no cliente e ID inválido não produz requisição',async()=>{
  const request=vi.fn<typeof fetch>().mockRejectedValue(new Error('synthetic timeout')),client=createBrevoCampaignDispatch('synthetic',request)
  expect(await client.sendNow(41)).toEqual({state:'uncertain'});expect(request).toHaveBeenCalledTimes(1)
  await expect(client.sendNow(0)).rejects.toThrow();expect(request).toHaveBeenCalledTimes(1)
 })
 it('histórico preserva dia/contagem/tentativa e permite nova intenção somente após recusa confirmada',()=>{
  expect(readSendHistory([attempt])).toEqual([attempt])
  const rejected={...attempt,state:'rejected',code:402,settledAt:'2026-10-22T12:01:00.000Z'}
  expect(readSendHistory([rejected,{...attempt,number:2,token:'00000000-0000-0000-0000-000000000002'}])).not.toBeNull()
  expect(readSendHistory([attempt,{...attempt,number:2,token:'00000000-0000-0000-0000-000000000002'}])).toBeNull()
 })
 it('rejeita forja de resultado, duplicação, orçamento inválido ou mudança de dia',()=>{
  for(const item of [{...attempt,state:'submitted',code:200},{...attempt,state:'rejected',code:429},{...attempt,quotaDay:'2026-10-23'},{...attempt,count:0},{...attempt,state:'uncertain'},{...attempt,state:'delivered'}])expect(readSendHistory([item])).toBeNull()
  expect(readSendHistory([attempt,{...attempt,number:2}])).toBeNull();expect(readSendHistory({})).toBeNull()
 })
})

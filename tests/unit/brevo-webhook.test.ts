import { describe,it,expect,vi } from 'vitest'
import { authenticatedWebhook,parseMarketingWebhook,webhookConfig,webhookEventKey } from '../../src/integrations/brevo/webhook'
import {handleBrevoWebhook} from '../../src/integrations/brevo/webhook-http'
const env={BREVO_WEBHOOK_ENABLED:'true',BREVO_WEBHOOK_TOKEN:'a'.repeat(64),BREVO_WEBHOOK_PREVIOUS_TOKEN:'b'.repeat(64),BREVO_WEBHOOK_EVENT_SECRET:'c'.repeat(64),LEAD_TOKEN_SECRET:'d'.repeat(64)}
const settings=webhookConfig(env)!
const body={id:123,camp_id:456,event:'delivered',email:' Person@Example.invalid ',ts_sent:1700000000,ts_event:1700000060}
const request=(data:unknown=body,authorization=`Bearer ${env.BREVO_WEBHOOK_TOKEN}`)=>new Request('https://example.invalid/api/webhooks/brevo',{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(data)})
describe('webhook marketing Brevo',()=>{
 it('token atual/anterior estritos, segredos independentes e flag desligada',()=>{
  expect(settings).not.toBeNull();expect(authenticatedWebhook(`Bearer ${env.BREVO_WEBHOOK_TOKEN}`,settings)).toBe(true);expect(authenticatedWebhook(`Bearer ${env.BREVO_WEBHOOK_PREVIOUS_TOKEN}`,settings)).toBe(true)
  for(const token of ['',`Basic ${env.BREVO_WEBHOOK_TOKEN}`,`Bearer ${'e'.repeat(64)}`,`Bearer ${env.BREVO_WEBHOOK_TOKEN},extra`])expect(authenticatedWebhook(token,settings)).toBe(false)
  for(const extra of [{BREVO_WEBHOOK_ENABLED:'false'},{BREVO_WEBHOOK_EVENT_SECRET:env.BREVO_WEBHOOK_TOKEN},{BREVO_WEBHOOK_TOKEN:'short'},{BREVO_WEBHOOK_PREVIOUS_TOKEN:env.BREVO_WEBHOOK_TOKEN}])expect(webhookConfig({...env,...extra})).toBeNull()
 })
 it('projeta somente campos mínimos e separa enum de seleção',()=>{
  const event=parseMarketingWebhook({...body,reason:'private',URL:'https://secret.invalid',sending_ip:'private'},Date.now())
  expect(event).toEqual({event:'delivered',email:'person@example.invalid',campaignId:456,webhookId:123,sentAt:'2023-11-14T22:13:20.000Z',occurredAt:'2023-11-14T22:14:20.000Z'})
  for(const name of ['spam','unsubscribe','hard_bounce','soft_bounce'])expect(parseMarketingWebhook({...body,event:name})).not.toBeNull()
  expect(parseMarketingWebhook({...body,event:'hardBounce'})).toBeNull();expect(parseMarketingWebhook({...body,event:'opened'})).toBe('ignored')
  for(const extra of [{type:'transactional'},{channel:'sms'},{id:'123'},{camp_id:0},{ts_event:'1700000060'},{ts_event:1699999999},{ts_event:Math.floor(Date.now()/1000)+301},{email:'invalid'},{to:'123'}])expect(parseMarketingWebhook({...body,...extra})).toBeNull()
  expect(parseMarketingWebhook([body])).toBeNull()
 })
 it('deduplica semanticamente sem depender do id isolado ou campos extras',()=>{
  const a=parseMarketingWebhook(body)!,b=parseMarketingWebhook({...body,id:124,reason:'different'})!
  if(typeof a==='string'||typeof b==='string')throw new Error('fixture')
  expect(webhookEventKey(a,settings.eventSecret)).toBe(webhookEventKey(b,settings.eventSecret))
  expect(webhookEventKey({...a,event:'spam'},settings.eventSecret)).not.toBe(webhookEventKey(a,settings.eventSecret))
 })
 it('autentica antes de ler ou chamar persistência; falha temporária usa 429',async()=>{
  const ingest=vi.fn().mockResolvedValue(undefined)
  expect((await handleBrevoWebhook(request(),ingest,{...env,BREVO_WEBHOOK_ENABLED:'false'})).status).toBe(429)
  expect((await handleBrevoWebhook(request(body,'invalid'),ingest,env)).status).toBe(401);expect(ingest).not.toHaveBeenCalled()
  expect((await handleBrevoWebhook(request(),ingest,env)).status).toBe(200);expect(ingest).toHaveBeenCalledTimes(1)
  const failed=await handleBrevoWebhook(request(),async()=>{throw new Error('private data')},env);expect(failed.status).toBe(429);expect(failed.headers.get('retry-after')).toBe('60');expect(await failed.text()).not.toContain('private data')
 })
 it('limita corpo, recusa JSON inválido e ignora eventos não selecionados',async()=>{
  const ingest=vi.fn()
  expect((await handleBrevoWebhook(request({...body,reason:'x'.repeat(32768)}),ingest,env)).status).toBe(413)
  expect((await handleBrevoWebhook(request([body]),ingest,env)).status).toBe(422)
  expect((await handleBrevoWebhook(request({...body,event:'opened'}),ingest,env)).status).toBe(200);expect(ingest).not.toHaveBeenCalled()
 })
})

describe('identidade histórica do destinatário',()=>{
 it('captura apenas HMAC e recusa snapshot incompleto/duplicado',async()=>{
  const {captureSendRecipients,readSendRecipients,sendRecipientFingerprint}=await import('../../src/modules/marketing/send-recipients')
  const contact='00000000-0000-0000-0000-000000000001',delivery='00000000-0000-0000-0000-000000000002'
  const snapshot=captureSendRecipients([{contact,delivery}],[{contact,email:'person@example.invalid'}],settings.linkSecret)
  expect(JSON.stringify(snapshot)).not.toContain('@');expect(snapshot.recipients[0].fingerprint).toBe(sendRecipientFingerprint('person@example.invalid',settings.linkSecret))
  expect(readSendRecipients(null)).toBeNull();expect(readSendRecipients({version:1,recipients:[...snapshot.recipients,...snapshot.recipients]})).toBeNull()
  expect(()=>captureSendRecipients([{contact,delivery}],[],settings.linkSecret)).toThrow()
 })
})

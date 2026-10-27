import {describe,it,expect} from 'vitest'
import {attributedCampaign} from '../../src/modules/commerce/campaign-attribution'
const reference='a7196251-3e51-45b3-8d24-18a263d74191'
const transaction={provider:'hotmart' as const,accountKey:'conta-a',needsReview:false,approvedAt:'2026-10-25T12:00:00.000Z',clickReference:reference,ebookId:'book',offerId:'offer'}
const click={id:reference,provider:'hotmart' as const,attributionAllowed:true,occurredAt:'2026-10-01T12:00:00.000Z',ebookId:'book',offerId:'offer',campaignId:'campaign'}
const offer={provider:'hotmart' as const,accountKey:'conta-a',ebookId:'book'}
describe('attribution from a provider-returned consented click reference',()=>{
 it('matches the same provider/account/book/offer in the inclusive 30 day window',()=>expect(attributedCampaign(transaction,click,offer)).toBe('campaign'))
 it.each([
  [{...transaction,needsReview:true},click,offer],
  [{...transaction,accountKey:'conta-b'},click,offer],
  [{...transaction,provider:'kiwify' as const},click,offer],
  [{...transaction,offerId:'other'},click,offer],
  [{...transaction,ebookId:'other'},click,offer],
  [{...transaction,clickReference:'buyer@example.invalid'},click,offer],
  [transaction,{...click,attributionAllowed:false},offer],
  [transaction,{...click,occurredAt:'2026-09-24T11:59:59.999Z'},offer],
  [transaction,{...click,occurredAt:'2026-10-25T12:00:00.001Z'},offer],
  [transaction,click,{...offer,accountKey:'conta-b'}],
  [transaction,click,{...offer,ebookId:'other'}],
 ] as const)('keeps a nonmatching reference or context unknown',(...[tx,source,destination])=>expect(attributedCampaign(tx,source,destination)).toBeNull())
})

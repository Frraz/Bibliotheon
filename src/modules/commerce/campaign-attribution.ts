import type {CommercialProvider} from './events'

export type AttributionTransaction={provider:CommercialProvider;accountKey:string;needsReview:boolean;approvedAt:string|null;clickReference:string|null;ebookId:string|null;offerId:string|null}
export type AttributionClick={id:string;provider:CommercialProvider;attributionAllowed:boolean;occurredAt:string;ebookId:string|null;offerId:string|null;campaignId:string|null}
export type AttributionOffer={provider:CommercialProvider;accountKey:string;ebookId:string|null}
const clickUUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

/** Campaign attribution requires the exact consented click UUID returned by the provider. */
export function attributedCampaign(transaction:AttributionTransaction,click:AttributionClick|undefined,offer:AttributionOffer|undefined){
 if(transaction.needsReview||!click||!offer||!transaction.clickReference||!clickUUID.test(transaction.clickReference)||click.id.toLowerCase()!==transaction.clickReference.toLowerCase()||!click.attributionAllowed||!click.campaignId)return null
 const approved=transaction.approvedAt?Date.parse(transaction.approvedAt):NaN,clicked=Date.parse(click.occurredAt)
 if(!Number.isFinite(approved)||!Number.isFinite(clicked)||clicked>approved||approved-clicked>30*86400000)return null
 if(click.provider!==transaction.provider||offer.provider!==transaction.provider||offer.accountKey!==transaction.accountKey||click.offerId!==transaction.offerId||offer.ebookId!==transaction.ebookId||click.ebookId!==transaction.ebookId)return null
 return click.campaignId
}

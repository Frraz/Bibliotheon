import { draftHash, readDraftSpec, type DraftSpec } from '../../modules/marketing/campaign-copy'
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
/** Only identity/content/recipient configuration; status interpretation belongs to each caller. */
export function campaignIdentityMatches(value:unknown,id:number,spec:DraftSpec):value is Record<string,unknown>{
  const d=value
  if(!object(d)||d.id!==id||d.type!=='classic'||d.abTesting!==undefined&&d.abTesting!==false||d.sendAtBestTime!==undefined&&d.sendAtBestTime!==false||d.recurring!==undefined&&d.recurring!==false||d.mirrorActive!==false||!object(d.sender)||d.sender.id!==spec.senderId||!object(d.recipients)||Object.keys(d.recipients).some(k=>!['lists','exclusionLists'].includes(k))||!Array.isArray(d.recipients.lists)||d.recipients.lists.length!==1||d.recipients.lists[0]!==spec.listId||!Array.isArray(d.recipients.exclusionLists)||d.recipients.exclusionLists.length!==0)return false
  const observed=readDraftSpec({name:d.name,senderId:d.sender.id,listId:d.recipients.lists[0],subject:d.subject,htmlContent:d.htmlContent})
  return !!observed&&draftHash(observed)===draftHash(spec)
}

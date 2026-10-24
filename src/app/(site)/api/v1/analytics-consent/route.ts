import {cms} from '../../../../../modules/catalog/public'
import {chooseConsent,AnalyticsError} from '../../../../../modules/analytics/service'
import {analyticsEnabled,choiceCookie,cookieValue,failure,grantCookie,inputJSON,privateJSON,setCookie,status} from '../../../../../modules/analytics/http'
export const dynamic='force-dynamic'
export async function GET(request:Request){try{return privateJSON(await status(request))}catch(error){return failure(error)}}
export async function POST(request:Request){
 try{
  const value=await inputJSON(request)
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!('choice'in value)||typeof value.choice!=='string'||!['accept','reject'].includes(value.choice))throw new AnalyticsError(400,'invalid_input')
  const enabled=await analyticsEnabled()
  // Withdrawal remains possible after measurement was disabled.
  const choice=value.choice==='accept'?'accept':'reject'
  if(!enabled&&choice==='accept')return privateJSON({enabled:false,choice:'unset'})
  const result=await chooseConsent(await cms(),choice,cookieValue(request,grantCookie))
  const response=privateJSON({enabled,choice:result.choice})
  if(result.choice==='granted'){
   response.headers.append('Set-Cookie',setCookie(grantCookie,result.token,Math.max(0,Math.floor((Date.parse(result.expiresAt)-Date.now())/1000))))
   response.headers.append('Set-Cookie',setCookie(choiceCookie,'',0))
  }else{
   response.headers.append('Set-Cookie',setCookie(grantCookie,'',0))
   response.headers.append('Set-Cookie',setCookie(choiceCookie,'rejected',180*86400))
  }
  return response
 }catch(error){return failure(error)}
}

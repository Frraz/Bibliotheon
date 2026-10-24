import {cms} from '../../../../../modules/catalog/public'
import {chooseConsent,AnalyticsError} from '../../../../../modules/analytics/service'
import {choiceCookie,cookieValue,failure,grantCookie,inputJSON,setCookie} from '../../../../../modules/analytics/http'
export const dynamic='force-dynamic'
/** Native form fallback, including when JavaScript or optional measurement is disabled. */
export async function POST(request:Request){try{
 const value=await inputJSON(request,'form')
 if(!value||typeof value!=='object'||!('choice'in value)||value.choice!=='reject')throw new AnalyticsError(400,'invalid_input')
 await chooseConsent(await cms(),'reject',cookieValue(request,grantCookie))
 const response=new Response(null,{status:303,headers:{Location:'/privacidade','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}})
 response.headers.append('Set-Cookie',setCookie(grantCookie,'',0));response.headers.append('Set-Cookie',setCookie(choiceCookie,'rejected',180*86400))
 return response
}catch(error){return failure(error)}}

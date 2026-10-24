import {cms} from '../../../../../modules/catalog/public'
import {parsePageEvent} from '../../../../../modules/analytics/validation'
import {recordPageView,AnalyticsError} from '../../../../../modules/analytics/service'
import {analyticsEnabled,cookieValue,failure,grantCookie,inputJSON,privateJSON} from '../../../../../modules/analytics/http'
export const dynamic='force-dynamic'
export async function POST(request:Request){try{
 const value=parsePageEvent(await inputJSON(request));if(!value)throw new AnalyticsError(400,'invalid_input')
 if(!await analyticsEnabled())return privateJSON({accepted:true},202)
 await recordPageView(await cms(),value,cookieValue(request,grantCookie))
 return privateJSON({accepted:true},202)
}catch(error){return failure(error)}}

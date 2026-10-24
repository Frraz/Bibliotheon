export const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export const utmKeys=['source','medium','campaign','content','term'] as const
export type Utms=Partial<Record<typeof utmKeys[number],string>>
export const controlledCode=(value:unknown):value is string=>typeof value==='string'&&/^[a-z0-9][a-z0-9._~-]{0,119}$/.test(value)&&!/\d{9}/.test(value)
export type PageEvent={type:'page_view';eventId:string;pagePath:string;campaignCode?:string;utms?:Utms}
export const publicPagePath=(path:unknown):path is string=>typeof path==='string'&&path.length<=200&&(/^\/(?:ebooks|artigos|sobre|contato|privacidade|termos)?$/.test(path)||/^\/(?:ebooks|artigos|temas|amostras)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)&&path!=='/amostras/confirmar')
export function parsePageEvent(value:unknown):PageEvent|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const row=value as Record<string,unknown>
 if(Object.keys(row).some(k=>!['type','eventId','pagePath','campaignCode','utms'].includes(k))||row.type!=='page_view'||typeof row.eventId!=='string'||!uuid.test(row.eventId)||!publicPagePath(row.pagePath))return null
 if(row.campaignCode!==undefined&&!controlledCode(row.campaignCode))return null
 let utms:Utms|undefined
 if(row.utms!==undefined){if(!row.utms||typeof row.utms!=='object'||Array.isArray(row.utms))return null;utms={};for(const[k,v]of Object.entries(row.utms)){if(!utmKeys.includes(k as typeof utmKeys[number])||!controlledCode(v))return null;utms[k as typeof utmKeys[number]]=v}}
 return{type:'page_view',eventId:row.eventId.toLowerCase(),pagePath:row.pagePath,...(row.campaignCode?{campaignCode:row.campaignCode as string}:{}),...(utms?{utms}:{})}
}
export function queryContext(query:URLSearchParams):Pick<PageEvent,'campaignCode'|'utms'>{
 const code=query.get('c')||query.get('utm_campaign');if(!code||!controlledCode(code)||query.getAll('c').length>1)return{}
 const utms:Utms={};for(const key of utmKeys){const name=`utm_${key}`,value=query.get(name);if(query.getAll(name).length>1||value!==null&&!controlledCode(value))return{};if(value)utms[key]=value}
 return{campaignCode:code,utms}
}

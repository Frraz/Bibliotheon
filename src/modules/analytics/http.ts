import {AnalyticsError,consentStatus} from './service'
import {cms,siteSettings} from '../catalog/public'
const production=process.env.NODE_ENV==='production'
export const grantCookie=production?'__Host-bibliotheon_analytics':'bibliotheon_analytics'
export const choiceCookie=production?'__Host-bibliotheon_measurement':'bibliotheon_measurement'
export function cookieValue(request:Request,name:string){const values=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(`${name}=`));return values.length===1?values[0].slice(name.length+1):undefined}
export function setCookie(name:string,value:string,maxAge:number){return`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${production?'; Secure':''}`}
export const privateJSON=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})
export async function analyticsEnabled(){return process.env.ANALYTICS_ENABLED==='true'&&(await siteSettings()).legalReady===true}
export async function status(request:Request){
 const enabled=await analyticsEnabled(),token=cookieValue(request,grantCookie),rejected=cookieValue(request,choiceCookie)==='rejected'
 const accepted=token?await consentStatus(await cms(),token):false
 return{enabled,manage:enabled||!!token||rejected,choice:accepted?'granted' as const:rejected?'rejected' as const:'unset' as const}
}
export async function inputJSON(request:Request,kind:'json'|'form'='json'){
 if(request.headers.get('origin')!==new URL(process.env.PUBLIC_SITE_URL||'http://localhost:3000').origin||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!==(kind==='json'?'application/json':'application/x-www-form-urlencoded')||!request.body)throw new AnalyticsError(400,'invalid_input')
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AnalyticsError(408,'request_timeout')),5000);timer.unref?.()})
 try{for(;;){const item=await Promise.race([reader.read(),deadline]);if(item.done)break;size+=item.value.byteLength;if(size>2048){void reader.cancel().catch(()=>{});throw new Error('large')};chunks.push(item.value)}const text=Buffer.concat(chunks).toString('utf8');if(kind==='json')return JSON.parse(text) as unknown;const form=new URLSearchParams(text);if([...form.keys()].length!==1||form.getAll('choice').length!==1)throw new Error('invalid');return{choice:form.get('choice')}}catch(error){void reader.cancel().catch(()=>{});if(error instanceof AnalyticsError)throw error;throw new AnalyticsError(400,'invalid_input')}finally{clearTimeout(timer);reader.releaseLock()}
}
export const failure=(error:unknown)=>privateJSON({error:{code:error instanceof AnalyticsError?error.code:'unavailable',message:'Não foi possível registrar a preferência ou medição.'}},error instanceof AnalyticsError?error.status:503)

/** Preserve numeric lexemes before binary64 rounding. Requires Node 22 JSON reviver context. */
export class NativeNumber { constructor(readonly source:string){} }
export function nativeJSON(bytes:Uint8Array):unknown {
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
 return JSON.parse(text,((_:string,value:unknown,context?:{source?:string})=>{
  if(typeof value!=='number')return value
  if(!context?.source)throw new Error('number_source_unavailable')
  return new NativeNumber(context.source)
 }) as (key:string,value:unknown)=>unknown)
}
export function record(value:unknown):Record<string,unknown>|null {
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&!(value instanceof NativeNumber)?value as Record<string,unknown>:null
}
/** Exact integer source units; accepts JSON numeric exponent notation, never numeric strings. */
export function nativeInteger(value:unknown,signed=false):number|null {
 if(!(value instanceof NativeNumber))return null
 const match=/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value.source)
 if(!match||match[1]&&!signed)return null
 const digits=(match[2]+(match[3]||'')).replace(/^0+/,'')||'0',exponent=Number(match[4]||0)
 if(!Number.isSafeInteger(exponent)||Math.abs(exponent)>1000)return null
 if(digits==='0')return 0
 const scale=exponent-(match[3]?.length||0)
 let integer:string
 if(scale>=0){if(digits.length+scale>16)return null;integer=digits+'0'.repeat(scale)}
 else{if(-scale>=digits.length||!/^0+$/.test(digits.slice(scale)))return null;integer=digits.slice(0,scale)}
 const result=Number(match[1]+integer)
 return Number.isSafeInteger(result)?result:null
}

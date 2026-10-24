import {NativeNumber} from './native-json'
/** Exact nonnegative amount in hundredths; no rounding, coercion or currency conversion. */
export function nativeCents(value:unknown):number|null {
 if(!(value instanceof NativeNumber))return null
 const match=/^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value.source)
 if(!match)return null
 const digits=(match[1]+(match[2]||'')).replace(/^0+/,'')||'0',exponent=Number(match[3]||0)
 if(!Number.isSafeInteger(exponent)||Math.abs(exponent)>1000)return null
 if(digits==='0')return 0
 const scale=2+exponent-(match[2]?.length||0)
 let integer:string
 if(scale>=0){if(digits.length+scale>16)return null;integer=digits+'0'.repeat(scale)}
 else{if(-scale>=digits.length||!/^(?:0+)$/.test(digits.slice(scale)))return null;integer=digits.slice(0,scale)}
 const result=Number(integer)
 return Number.isSafeInteger(result)?result:null
}
const currencies=new Set(Intl.supportedValuesOf('currency'))
export function hundredthCurrency(currency:string){
 return currencies.has(currency)&&new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits===2
}

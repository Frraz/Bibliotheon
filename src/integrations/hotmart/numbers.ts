import {NativeNumber} from '../../modules/commerce/native-json'
export {NativeNumber,nativeJSON,record} from '../../modules/commerce/native-json'
export function nativeEpoch(value:unknown):string|null {
 if(!(value instanceof NativeNumber)||!/^\d+$/.test(value.source)||value.source.length>15)return null
 const number=Number(value.source)
 if(!Number.isSafeInteger(number)||number>253402300799999)return null
 return new Date(number).toISOString()
}
export {nativeCents,hundredthCurrency} from '../../modules/commerce/money'

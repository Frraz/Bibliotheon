import {createHash} from 'node:crypto'
import {commercialKinds,commercialProviders,commercialTransactionKey,opaqueID,type CommercialKind,type CommercialProvider} from './events'

export const CSV_MAX_BYTES=5*1024*1024,CSV_MAX_ROWS=10000
export const commercialCSVHeaders=['provider','account_key','transaction_id','product_id','offer_id','status','occurred_at','currency','gross_cents','refunded_cents','fees_cents','producer_net_cents','settled_cents'] as const
export class CommercialCSVError extends Error{constructor(readonly code:'too_large'|'invalid_utf8'|'invalid_header'|'invalid_quotes'|'field_too_long'|'too_many_rows'|'empty_file',readonly line?:number){super(code)}}
export type CommercialCSVRow={
 provider:CommercialProvider;accountKey:string;externalTransactionId:string;externalProductId:string;externalOfferId:string|null;
 status:CommercialKind;occurredAt:string;currency:string;grossCents:number|null;refundedCents:number|null;feesCents:number|null;producerNetCents:number|null;settledCents:number|null;
}
export type CSVLine={line:number;ok:true;row:CommercialCSVRow;key:string;digest:string}|{line:number;ok:false;code:'column_count'|'invalid_provider'|'invalid_identity'|'invalid_status'|'invalid_time'|'invalid_currency'|'invalid_money'}
/** RFC 4180 quoting; no trimming, delimiter guessing or raw input in diagnostics. */
export function parseCSVRecords(text:string,maxColumns:number):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',state:'start'|'plain'|'quoted'|'closed'='start'
 const append=(value:string)=>{field+=value;if(field.length>512)throw new CommercialCSVError('field_too_long',rows.length+1)}
 const finish=()=>{if(row.length<=maxColumns)row.push(field);field='';state='start'}
 const record=()=>{finish();rows.push(row);row=[];if(rows.length>CSV_MAX_ROWS+1)throw new CommercialCSVError('too_many_rows')}
 for(let i=0;i<text.length;i++){
  const char=text[i]
  if(state==='quoted'){
   if(char==='"'){if(text[i+1]==='"'){append('"');i++}else state='closed'}else append(char)
   continue
  }
  if(char===','){finish();continue}
  if(char==='\r'||char==='\n'){record();if(char==='\r'&&text[i+1]==='\n')i++;continue}
  if(state==='closed')throw new CommercialCSVError('invalid_quotes',rows.length+1)
  if(char==='"'){if(state!=='start')throw new CommercialCSVError('invalid_quotes',rows.length+1);state='quoted';continue}
  state='plain';append(char)
 }
 if(state==='quoted')throw new CommercialCSVError('invalid_quotes',rows.length+1)
 if(field||row.length||state!=='start')record()
 return rows
}
function integer(value:string,signed=false):number|null|undefined{
 if(value==='')return null
 if(value.length>18||!(signed?/^-?\d+$/:/^\d+$/).test(value))return undefined
 const amount=Number(value)
 return Number.isSafeInteger(amount)?amount:undefined
}
function instant(value:string):string|null{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return null
 const date=new Date(value)
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,19)===value.slice(0,19)?date.toISOString():null
}
export const commercialCSVRowDigest=(row:CommercialCSVRow)=>createHash('sha256').update(JSON.stringify([
 row.provider,row.accountKey,row.externalTransactionId,row.externalProductId,row.externalOfferId,row.status,row.occurredAt,row.currency,row.grossCents,row.refundedCents,row.feesCents,row.producerNetCents,row.settledCents,
])).digest('hex')
function normalize(values:string[],line:number):CSVLine{
 const invalid=(code:Extract<CSVLine,{ok:false}>['code']):CSVLine=>({line,ok:false,code})
 if(values.length!==commercialCSVHeaders.length)return invalid('column_count')
 const [provider,accountKey,externalTransactionId,externalProductId,offer,status,occurred,currency,...money]=values
 if(!commercialProviders.includes(provider as CommercialProvider))return invalid('invalid_provider')
 if(![accountKey,externalTransactionId,externalProductId].every(opaqueID)||offer!==''&&!opaqueID(offer))return invalid('invalid_identity')
 if(!commercialKinds.includes(status as CommercialKind))return invalid('invalid_status')
 const occurredAt=instant(occurred)
 if(!occurredAt)return invalid('invalid_time')
 if(!/^[A-Z]{3}$/.test(currency))return invalid('invalid_currency')
 const [grossCents,refundedCents,feesCents,producerNetCents,settledCents]=money.map((value,index)=>integer(value,index>=2))
 if([grossCents,refundedCents,feesCents,producerNetCents,settledCents].some(value=>value===undefined))return invalid('invalid_money')
 const row:CommercialCSVRow={provider:provider as CommercialProvider,accountKey,externalTransactionId,externalProductId,externalOfferId:offer||null,status:status as CommercialKind,occurredAt,currency,grossCents:grossCents!,refundedCents:refundedCents!,feesCents:feesCents!,producerNetCents:producerNetCents!,settledCents:settledCents!}
 return{line,ok:true,row,key:commercialTransactionKey(row),digest:commercialCSVRowDigest(row)}
}
export function parseCommercialCSV(bytes:Uint8Array){
 if(bytes.byteLength>CSV_MAX_BYTES)throw new CommercialCSVError('too_large')
 let text:string
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes).replace(/^\uFEFF/,'')}catch{throw new CommercialCSVError('invalid_utf8')}
 const rows=parseCSVRecords(text,commercialCSVHeaders.length),header=rows.shift()
 if(!header||header.length!==commercialCSVHeaders.length||header.some((value,index)=>value!==commercialCSVHeaders[index]))throw new CommercialCSVError('invalid_header')
 if(!rows.length)throw new CommercialCSVError('empty_file')
 return{fileHash:createHash('sha256').update(bytes).digest('hex'),lines:rows.map((values,index)=>normalize(values,index+2))}
}
/** Validate persisted normalized evidence again; hashes never authorize arbitrary JSON. */
export function restoreCommercialCSVLine(value:unknown,line:number):Extract<CSVLine,{ok:true}>|null{
 if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isInteger(line)||line<2||line>10001)return null
 const row=value as Record<string,unknown>,strings=['provider','accountKey','externalTransactionId','externalProductId','status','occurredAt','currency'],money=['grossCents','refundedCents','feesCents','producerNetCents','settledCents'],keys=[...strings,...money,'externalOfferId']
 if(Object.keys(row).length!==keys.length||Object.keys(row).some(key=>!keys.includes(key))||strings.some(key=>typeof row[key]!=='string')||row.externalOfferId!==null&&typeof row.externalOfferId!=='string'||money.some(key=>row[key]!==null&&(typeof row[key]!=='number'||!Number.isSafeInteger(row[key]))))return null
 const result=normalize([row.provider,row.accountKey,row.externalTransactionId,row.externalProductId,row.externalOfferId??'',row.status,row.occurredAt,row.currency,...money.map(key=>row[key]===null?'':String(row[key]))] as string[],line)
 return result.ok&&keys.every(key=>result.row[key as keyof CommercialCSVRow]===row[key])?result:null
}
/** Spreadsheet output is a presentation format; formula-like text is prefixed with an apostrophe. */
export function spreadsheetCSV(rows:readonly (readonly (string|number|null)[])[]):string{
 return rows.map(row=>row.map(cell=>{
  let value=cell===null?'':String(cell)
  if(typeof cell==='number'&&!Number.isSafeInteger(cell))throw new Error('invalid_export_number')
  if(typeof cell==='string'&&/^[\s\x00-\x1f\x7f]*[=+\-@]/.test(value))value="'"+value
  return /[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value
 }).join(',')).join('\r\n')+'\r\n'
}

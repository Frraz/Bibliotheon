// Kiwify root order timestamps are Brasília wall time, including historical DST.
// Never substitute the server timezone or guess between two DST occurrences.
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
function parts(epoch:number){
 const row=Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(part=>[part.type,part.value]))
 return `${row.year}-${row.month}-${row.day} ${row.hour}:${row.minute}:${row.second}`
}
export function kiwifyDate(value:unknown):string|null {
 if(typeof value!=='string')return null
 const match=/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2}))?$/.exec(value)
 if(!match)return null
 const wall=`${match[1]} ${match[2]}:${match[3]??'00'}`,utc=Date.parse(wall.replace(' ','T')+'Z')
 if(!Number.isFinite(utc)||new Date(utc).toISOString().slice(0,19)!==wall.replace(' ','T'))return null
 const offsets=new Set<number>()
 for(const hours of [-36,-12,0,12,36]){
  const probe=utc+hours*3600000
  const offset=Date.parse(parts(probe).replace(' ','T')+'Z')-probe
  if(Number.isFinite(offset))offsets.add(offset)
 }
 const candidates=[...offsets].map(offset=>utc-offset).filter(epoch=>parts(epoch)===wall)
 return candidates.length===1?new Date(candidates[0]).toISOString():null
}

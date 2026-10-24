/** Explicit ISO offset required. Common commercial precision is milliseconds, never rounded. */
export function caktoDate(value:unknown):string|null {
 if(typeof value!=='string')return null
 const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
 if(!match)return null
 const wall=match[1]+'.'+(match[2]??'').padEnd(3,'0').slice(0,3)
 const local=new Date(wall+'Z')
 if(!Number.isFinite(local.getTime())||local.toISOString().slice(0,23)!==wall)return null
 const instant=new Date(wall+match[3])
 return Number.isFinite(instant.getTime())?instant.toISOString():null
}

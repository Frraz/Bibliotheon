'use client'
import Link from 'next/link'
import {useEffect,useRef,useState} from 'react'
import {usePathname,useSearchParams} from 'next/navigation'
import {publicPagePath,queryContext} from '../modules/analytics/validation'
type Choice='unset'|'granted'|'rejected'
export function Analytics(){
 const path=usePathname(),query=useSearchParams(),[enabled,setEnabled]=useState(false),[visible,setVisible]=useState(false),[choice,setChoice]=useState<Choice>('unset'),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[paused,setPaused]=useState(false),[message,setMessage]=useState(''),[epoch,setEpoch]=useState(0)
 const preferenceButton=useRef<HTMLButtonElement>(null),channel=useRef<BroadcastChannel|null>(null),currentEvent=useRef<{key:string;id:string}|null>(null)
 useEffect(()=>{
  let live=true
  const refresh=()=>fetch('/api/v1/analytics-consent',{cache:'no-store',credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{if(live&&data){setEnabled(data.enabled===true);setVisible(data.enabled===true||data.manage===true||data.choice==='rejected');setChoice(data.choice);setEpoch(v=>v+1)}}).catch(()=>{})
  void refresh()
  if(typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel('bibliotheon:measurement-choice');channel.current.onmessage=()=>{void refresh()}}
  return()=>{live=false;channel.current?.close();channel.current=null}
 },[])
 useEffect(()=>{
  if(!enabled||choice!=='granted'||paused||!publicPagePath(path))return
  const key=`${path}?${query.toString()}`
  if(currentEvent.current?.key!==key)currentEvent.current={key,id:crypto.randomUUID()}
  const abort=new AbortController()
  void fetch('/api/v1/events',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'page_view',eventId:currentEvent.current.id,pagePath:path,...queryContext(new URLSearchParams(query.toString()))}),signal:abort.signal}).catch(()=>{})
  return()=>abort.abort()
 },[enabled,choice,path,query,epoch,paused])
 async function choose(value:'accept'|'reject'){
  if(busy)return;setBusy(true);setMessage('');if(value==='reject')setPaused(true)
  try{
   const response=await fetch('/api/v1/analytics-consent',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({choice:value})})
   if(!response.ok)throw new Error('unavailable')
   const data=await response.json();setEnabled(data.enabled===true);setVisible(data.enabled===true||data.manage===true||data.choice==='rejected');setChoice(data.choice);setEditing(false);setPaused(false);setEpoch(v=>v+1);channel.current?.postMessage('changed')
   setMessage(value==='accept'?'Preferência salva. Você pode mudar quando quiser.':'Medição recusada. Você pode continuar navegando normalmente.')
   requestAnimationFrame(()=>preferenceButton.current?.focus())
  }catch{setPaused(true);setEditing(true);setMessage('Não foi possível confirmar a alteração. A medição está pausada nesta página; tente salvar novamente.')}
  finally{setBusy(false)}
 }
 if(!visible)return null
 const open=choice==='unset'||editing
 return <section className="analytics-choice container" aria-labelledby="measurement-title">
  <div className="analytics-heading"><h2 id="measurement-title">Privacidade de navegação</h2><button ref={preferenceButton} type="button" aria-expanded={open} aria-controls="measurement-options" onClick={()=>setEditing(v=>!v)}>Preferências de medição</button></div>
  {<div id="measurement-options" hidden={!open}>{!enabled&&<p>A medição está desativada. Você pode remover a permissão armazenada.</p>}<p>Podemos medir páginas visitadas e saídas para o checkout para melhorar a Bibliotheon? A medição é opcional, sem ferramentas externas de anúncios. Recusar não altera o acesso aos livros.</p><p><Link href="/privacidade">Conheça o aviso de privacidade</Link>.</p><div className="analytics-actions"><button type="button" disabled={busy||!enabled} onClick={()=>void choose('accept')}>Aceitar medição</button><button type="button" disabled={busy} onClick={()=>void choose('reject')}>Recusar medição</button></div></div>}
  <p className="muted" role="status">{message||(!open?(choice==='granted'?'Medição permitida. Você pode revogar a permissão aqui.':'Medição recusada.'):busy?'Salvando preferência…':'Nenhum identificador de medição é criado antes da sua escolha.')}</p>
 </section>
}

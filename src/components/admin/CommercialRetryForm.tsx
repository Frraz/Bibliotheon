'use client'
import {useId,useState,useRef,useEffect,useContext,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {retryReasonLabels} from '../../modules/commerce/presentation'
import {CommercialFeedbackContext} from './CommercialFeedback'

export function CommercialRetryForm({id,blockedReason,processingEnabled}:{id:string;blockedReason:string|null;processingEnabled:boolean}){
 const uid=useId(),router=useRouter(),notice=useRef<HTMLParagraphElement>(null),publish=useContext(CommercialFeedbackContext)
 const [reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 useEffect(()=>{if(status||error)notice.current?.focus()},[status,error])
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(busy||blockedReason||!reason||!reviewed)return
  setBusy(true);setStatus('');setError('')
  try{
   const response=await fetch(`/api/v1/admin/inbox/${encodeURIComponent(id)}/retry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})})
   if(!response.ok){setError(response.status===403?'Sua sessão expirou ou a origem não foi aceita. Entre novamente no painel.':response.status===409?'O evento mudou ou tem uma colisão não resolvida. Atualize a página e confira o histórico.':response.status===422?'Selecione um motivo válido e confira o evento.':'Não foi possível confirmar o reprocessamento. Confira a auditoria antes de repetir.');return}
   const result=await response.json() as {state:string}
   if(result.state!=='queued'&&result.state!=='unchanged'){setError('Resposta não reconhecida. Confira o histórico antes de repetir.');return}
   const message=result.state==='queued'?`Evento recolocado na fila.${processingEnabled?' Aguarde o próximo ciclo de processamento.':' O processamento automático está desativado; o evento permanecerá pendente.'}`:'O evento já estava concluído. A conferência foi registrada sem alterar o histórico.'
   if(publish)publish(message);else setStatus(message)
   setReviewed(false);setReason('');router.refresh()
  }catch{setError('Não foi possível confirmar o reprocessamento. Confira a auditoria antes de repetir.')}
  finally{setBusy(false)}
 }
 return <form className="bibliotheon-operational-form" action={`/api/v1/admin/inbox/${encodeURIComponent(id)}/retry`} method="post" onSubmit={submit} aria-busy={busy}>
  <p id={`${uid}-help`}>Reprocesse somente após corrigir a causa. O envelope salvo e o histórico financeiro são preservados. A ação fica registrada com seu usuário e motivo.</p>
  {blockedReason&&<p>{blockedReason}</p>}
  <fieldset disabled={busy||!!blockedReason} aria-describedby={`${uid}-help`}><legend>Reprocessamento manual</legend>
   <label htmlFor={`${uid}-reason`}>O que você conferiu?</label><select id={`${uid}-reason`} name="reason" required value={reason} onChange={e=>{setReason(e.target.value);setReviewed(false)}}><option value="">Selecione o motivo</option>{Object.entries(retryReasonLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
   <label className="bibliotheon-review"><input name="reviewed" type="checkbox" required checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Corrigi a causa e conferi o evento salvo.</label>
   <button type="submit" disabled={busy||!!blockedReason||!reason||!reviewed}>{busy?'Registrando…':'Recolocar na fila'}</button>
  </fieldset>
  <p ref={notice} role={error?"alert":"status"} tabIndex={-1}>{error||status}</p>
  <noscript>Ative JavaScript para registrar o reprocessamento neste formulário.</noscript>
 </form>
}

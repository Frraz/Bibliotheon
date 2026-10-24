import type {UIFieldServerComponent} from 'payload'
import Link from 'next/link'
import {commercialDate,commercialErrorLabel,retryReasonLabels} from '../../modules/commerce/presentation'

export const CommercialRetry:UIFieldServerComponent=async({data,req})=>{
 if(req.user?.collection!=='admin-users'||req.user.role!=='owner'||!data?.id)return null
 const row=await req.payload.findByID({collection:'commercial-inbox',id:String(data.id),depth:0,overrideAccess:false,req})
 const audit=await req.payload.find({collection:'commercial-audit',where:{inbox:{equals:row.id}},sort:['-occurredAt','-id'],limit:10,depth:0,overrideAccess:false,req,select:{action:true,actorType:true,reason:true,occurredAt:true}})
 const actions={received:'Recebimento registrado',ignored:'Evento ignorado',conflict:'Colisão registrada',applied:'Aplicação ao histórico',review:'Revisão necessária',failed:'Falha de processamento',retry:'Reprocessamento solicitado'}
 return <section className="bibliotheon-sequence-copy bibliotheon-commercial-history"><h2>Conferir processamento</h2><p><Link href="/admin/commercial-inbox">Voltar ao acompanhamento comercial</Link></p><p><Link href={`/admin/commercial-inbox?provider=all&state=all&event=${row.id}`}>Abrir este evento para reprocessamento</Link></p><p>O reprocessamento é registrado no acompanhamento comercial. O envelope e o histórico abaixo são somente para consulta.</p>
  <details><summary>Envelope mínimo salvo</summary><p>Identificadores, datas e valores preservados no recebimento; esta consulta não altera o evento.</p><pre>{JSON.stringify(row.envelope,null,2)}</pre></details>
  <details><summary>Últimas ações deste evento</summary>{!audit.docs.length?<p>Sem ações registradas.</p>:<ol>{audit.docs.map(item=><li key={item.id}><p>{actions[item.action]} · {commercialDate(item.occurredAt)} (Belém) · {item.actorType==='owner'?'Proprietário':item.actorType==='worker'?'Processador':'Recepção'}{item.reason?` · ${item.reason in retryReasonLabels?retryReasonLabels[item.reason as keyof typeof retryReasonLabels]:commercialErrorLabel(item.reason)}`:''}</p></li>)}</ol>}<p>Até dez ações mais recentes. O histórico completo permanece na coleção de auditoria.</p><p><Link href="/admin/collections/commercial-audit">Consultar auditoria completa</Link></p></details>
 </section>
}

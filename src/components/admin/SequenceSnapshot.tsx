import Link from 'next/link'
import type { JSONFieldServerComponent } from 'payload'
import { readSequenceSnapshot } from '../../modules/marketing/sequence-copy'

export const SequenceSnapshot: JSONFieldServerComponent = ({ value, req }) => {
  if (req.user?.collection !== 'admin-users' || req.user.role !== 'owner') return null
  const snapshot = readSequenceSnapshot(value)
  if (!snapshot) return <p>Conteúdo registrado indisponível. Confira o histórico antes de prosseguir.</p>
  return <section className="bibliotheon-sequence-copy" aria-label="Conteúdo registrado na confirmação">
    <h2>Conteúdo registrado na confirmação</h2>
    <p>Revisão {snapshot.revision}. Estas mensagens foram registradas quando a assinatura foi confirmada.</p>
    {snapshot.messages.map(message => <details key={message.day}><summary>D+{message.day} · {message.subject}</summary><p>{message.text}</p></details>)}
    <p><Link href={`/admin/collections/offers/${snapshot.offerId}`}>Consultar oferta registrada</Link></p>
    <details><summary>Dados de conferência</summary><dl><dt>Hash do conteúdo</dt><dd>{snapshot.contentHash}</dd>{snapshot.campaignCode && <><dt>Campanha</dt><dd>{snapshot.campaignCode}</dd></>}</dl></details>
  </section>
}

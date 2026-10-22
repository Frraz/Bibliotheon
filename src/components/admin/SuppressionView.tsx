import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { SuppressionForm } from './SuppressionForm'

export function SuppressionView({ initPageResult, params, searchParams, user }: AdminViewServerProps) {
  const { req } = initPageResult
  if (req.user?.collection !== 'admin-users' || req.user.role !== 'owner') redirect('/admin/login')
  return <DefaultTemplate i18n={req.i18n} locale={initPageResult.locale} params={params} payload={req.payload} permissions={initPageResult.permissions} searchParams={searchParams} user={user} visibleEntities={initPageResult.visibleEntities}>
    <Gutter className="bibliotheon-dashboard bibliotheon-suppression"><header><p className="bibliotheon-kicker">Relacionamento</p><h1>Suspender e-mails</h1><p>Registre um pedido de descadastro ou um bloqueio que você conferiu.</p></header>
      <p>Descadastro suspende marketing e mantém a amostra solicitada. Devolução permanente e reclamação de spam também cancelam as entregas ainda na fila.</p>
      <p>Confira o bloqueio também na conta Brevo. A sincronização automática com o provedor ainda aguarda homologação. Um envio já iniciado precisa de conferência no provedor.</p>
      <SuppressionForm />
    </Gutter>
  </DefaultTemplate>
}

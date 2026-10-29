/** User guidance only: preserve HTTP status prefixes used by uncertain-result recovery. */
export function editorialHTTPError(status: number, route: string, code?: string, message?: string) {
  const editorial = route.startsWith('/api/v1/admin/editorial/')
  if (status === 401) return `HTTP 401: authentication_failed — ${route.endsWith('/login') ? 'Login recusado. Confira e-mail e senha do owner e tente novamente.' : 'Sessão recusada ou expirada. Execute a ação novamente para entrar com o owner.'}`
  if (status === 404 && editorial) return 'HTTP 404: editorial_api_missing — A API editorial não foi encontrada neste site. Confira o destino e implante a versão atual do Bibliotheon com a migration editorial; depois repita preparar. O e-book e o pacote não precisam ser recriados.'
  if (status === 403) return 'HTTP 403: forbidden — Acesso recusado. Confira a conta owner e a configuração de origem do site.'
  if (status === 409 && editorial) return `HTTP 409: ${code || 'review_required'} — ${message || 'A revisão mudou ou expirou. Confira a orientação da prévia e prepare novamente; se houver confirmação incerta, consulte o recibo antes.'}`
  if (status === 503 && editorial) return 'HTTP 503: unavailable — O serviço não confirmou o resultado. Se estava publicando, preserve o pacote e a prévia e use consultar antes de iniciar outra operação.'
  return `HTTP ${status}: ${code || 'request_failed'}${message ? ` — ${message}` : ''}`
}

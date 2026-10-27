import {analyticsEnabled,cookieValue,grantCookie} from '../../../../modules/analytics/http'
import {recordCheckoutClick} from '../../../../modules/analytics/service'
import {cms} from '../../../../modules/catalog/public'
import { CheckoutError, resolveCheckout } from '../../../../modules/commerce/resolve'
import { checkoutError } from '../../../../modules/catalog/checkout-error'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const nonce = request.headers.get('x-nonce') || undefined
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  try {
    const url = new URL(request.url)
    if (url.searchParams.has('url') || url.searchParams.has('redirectTo') || url.searchParams.getAll('c').length > 1) return checkoutError(400, 'O link contém parâmetros inválidos. Consulte as opções no catálogo.', nonce)
    const result = await resolveCheckout((await params).offerId, url.searchParams.get('c') || undefined)
    let destination=result.destination
    try {
      if(request.method==='GET'&&!request.headers.has('next-router-prefetch')&&!/prefetch/i.test(`${request.headers.get('purpose')||''} ${request.headers.get('sec-purpose')||''}`)&&await analyticsEnabled()){
        const click=await recordCheckoutClick(await cms(),result,cookieValue(request,grantCookie))
        const url=new URL(destination)
        // sck is documented by Hotmart, Kiwify and Cakto. Keep an existing
        // operator/provider value intact; that click remains unattributed.
        if(click.attributionReference&&!url.searchParams.has('sck')){url.searchParams.set('sck',click.attributionReference);destination=url.toString()}
      }
    } catch { /* A verified destination stays available if optional measurement fails. */ }
    return new Response(null, { status: 302, headers: { ...headers, Location: destination } })
  } catch (error) {
    if (error instanceof CheckoutError) return checkoutError(error.status, error.message, nonce)
    return checkoutError(503, 'Não foi possível verificar a oferta. Tente novamente em instantes.', nonce)
  }
}

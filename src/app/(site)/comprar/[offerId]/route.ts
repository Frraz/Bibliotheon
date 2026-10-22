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
    return new Response(null, { status: 302, headers: { ...headers, Location: result.destination } })
  } catch (error) {
    if (error instanceof CheckoutError) return checkoutError(error.status, error.message, nonce)
    return checkoutError(503, 'Não foi possível verificar a oferta. Tente novamente em instantes.', nonce)
  }
}

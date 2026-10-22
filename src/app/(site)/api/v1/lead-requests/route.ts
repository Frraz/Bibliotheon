import { cms } from '../../../../../modules/catalog/public'
import { captureEnabled, failure, linkSecret, privateJSON, readInput } from '../../../../../modules/marketing/http'
import { LeadFlowError, requestMagnet } from '../../../../../modules/marketing/service'
import { parseLeadInput } from '../../../../../modules/marketing/validation'
export async function POST(request: Request) {
  try {
    if (!await captureEnabled()) throw new LeadFlowError('unavailable', 503)
    const input = parseLeadInput(await readInput(request))
    if (!input) throw new LeadFlowError('invalid_input', 422)
    await requestMagnet(await cms(), input, linkSecret())
    return privateJSON({ message: 'Se a solicitação puder ser atendida, você receberá um e-mail para confirmar. Pode haver atraso conforme a fila de envio.' }, 202)
  } catch (error) { return failure(error) }
}

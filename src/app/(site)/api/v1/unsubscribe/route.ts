import { cms } from '../../../../../modules/catalog/public'
import { failure, privateJSON, readInput } from '../../../../../modules/marketing/http'
import { LeadFlowError, unsubscribe } from '../../../../../modules/marketing/service'
export async function POST(request: Request) {
  try {
    const input = await readInput(request)
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !('token' in input)) throw new LeadFlowError('invalid_input', 422)
    await unsubscribe(await cms(), input.token)
    return privateJSON({ message: 'O marketing por e-mail foi cancelado. Amostras que você solicitar continuam disponíveis.' })
  } catch (error) { return failure(error) }
}

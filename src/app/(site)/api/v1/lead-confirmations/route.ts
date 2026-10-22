import { cms } from '../../../../../modules/catalog/public'
import { failure, linkSecret, privateJSON, readInput } from '../../../../../modules/marketing/http'
import { confirmMagnet, LeadFlowError } from '../../../../../modules/marketing/service'
export async function POST(request: Request) {
  try {
    const input = await readInput(request)
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !('token' in input)) throw new LeadFlowError('invalid_input', 422)
    return privateJSON(await confirmMagnet(await cms(), input.token, linkSecret()))
  } catch (error) { return failure(error) }
}

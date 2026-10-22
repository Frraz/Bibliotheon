import { cms } from '../../../../../modules/catalog/public'
import { failure, privateJSON, readInput } from '../../../../../modules/marketing/http'
import { LeadFlowError } from '../../../../../modules/marketing/service'
import { readPreferences, unsubscribeTheme } from '../../../../../modules/marketing/preferences'

export async function POST(request: Request) {
  try {
    const input = await readInput(request)
    if (!input || typeof input !== 'object' || Array.isArray(input) || !('token' in input) || !('action' in input)) throw new LeadFlowError('invalid_input', 422)
    const keys = Object.keys(input).sort().join(',')
    if (input.action === 'read' && keys === 'action,token') return privateJSON(await readPreferences(await cms(), input.token))
    if (input.action !== 'unsubscribe-theme' || keys !== 'action,theme,token' || !('theme' in input)) throw new LeadFlowError('invalid_input', 422)
    await unsubscribeTheme(await cms(), input.token, input.theme)
    return privateJSON({ message: 'Os e-mails deste tema foram cancelados. As amostras solicitadas continuam disponíveis.' })
  } catch (error) { return failure(error) }
}

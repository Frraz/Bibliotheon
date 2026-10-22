import type { Payload } from 'payload'
import { parseSuppressionInput, applySuppression } from '../src/modules/marketing/suppression'
import { validLinkSecret } from '../src/modules/marketing/tokens'

// Local operator CLI. Keep submitted addresses/references out of arguments and logs.
let payload: Payload | undefined
try {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 4096) throw new Error('invalid_input')
    chunks.push(buffer)
  }
  const input = parseSuppressionInput(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  const secret = process.env.LEAD_TOKEN_SECRET
  if (!input || !validLinkSecret(secret)) throw new Error('invalid_input')
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('../src/payload.config')])
  payload = await getPayload({ config })
  console.log(JSON.stringify(await applySuppression(payload, input, secret)))
} catch {
  console.error('Não foi possível confirmar o registro. Confira a configuração e preserve a referência ao repetir a operação.')
  process.exitCode = 1
} finally {
  if (payload) await payload.destroy()
}
process.exit(process.exitCode || 0)

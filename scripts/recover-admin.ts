import type { Payload } from 'payload'
import { parseProvisionInput } from '../src/modules/admin/provision-input'
import { recoverAdmin } from '../src/modules/admin/recover'

let payload: Payload | undefined
try {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > 4096) throw new Error('invalid_input')
    chunks.push(bytes)
  }
  const input = Buffer.concat(chunks).toString('utf8')
  parseProvisionInput(input)
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('../src/payload.config')])
  payload = await getPayload({ config })
  await recoverAdmin(payload, input)
  console.log('Conta administrativa recuperada. Entre com a nova senha; as sessões anteriores foram encerradas.')
} catch {
  console.error('Não foi possível confirmar a recuperação. Confira os dados privados e a configuração do ambiente.')
  process.exitCode = 1
} finally {
  if (payload) await payload.destroy()
}
process.exit(process.exitCode || 0)

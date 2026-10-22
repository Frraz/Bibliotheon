import { getPayload } from 'payload'
import config from '../src/payload.config'
import { parseProvisionInput } from '../src/modules/admin/provision-input'

// Input is read from stdin to keep credentials out of arguments and source files.
let input = ''
for await (const chunk of process.stdin) {
  input += chunk
  if (Buffer.byteLength(input) > 4096) throw new Error('Entrada excede o limite do provisionamento.')
}
const { email, password } = parseProvisionInput(input)
const payload = await getPayload({ config })
const count = await payload.count({ collection: 'admin-users', overrideAccess: true })
if (count.totalDocs) throw new Error('Administrador já provisionado.')
await payload.create({ collection: 'admin-users', data: { email, password, role: 'owner' }, overrideAccess: true, context: { provisionAdmin: true } })
console.log('Administrador provisionado.')
await payload.destroy()
process.exit(0)

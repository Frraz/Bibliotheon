import type { Payload } from 'payload'
import { constants } from 'node:fs'
import { open, writeFile } from 'node:fs/promises'
import { assertPrivacyRecoveryIsolation, exportPrivacyRecoveryManifest, replayPrivacyRecoveryManifest } from '../src/modules/marketing/privacy-recovery'
import { PRIVACY_MANIFEST_LIMIT, verifyPrivacyRecoveryManifest } from '../src/modules/marketing/privacy-recovery-manifest'
import { validLinkSecret } from '../src/modules/marketing/tokens'

let payload: Payload | undefined
try {
  const args = process.argv.slice(2), secret = process.env.LEAD_TOKEN_SECRET ?? ''
  if (!validLinkSecret(secret)) throw new Error('Chave indisponível.')
  const exporting = args.length === 3 && args[0] === 'export' && args[1] === '--output'
  const replaying = args.length === 8 && ['preview','apply'].includes(args[0]) && args[1] === '--input' && args[3] === '--snapshot-at' && args[5] === '--owner' && args[7] === '--isolated' && /^[a-f0-9-]{36}$/i.test(args[6])
  if (!exporting && !replaying) throw new Error('Argumentos inválidos.')
  let input = ''
  if (replaying) {
    assertPrivacyRecoveryIsolation(true)
    const file = await open(args[2],constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const stat = await file.stat()
      if (!stat.isFile() || stat.mode & 0o077 || stat.size > PRIVACY_MANIFEST_LIMIT) throw new Error('Arquivo privado inválido.')
      const buffer = Buffer.alloc(PRIVACY_MANIFEST_LIMIT + 1)
      let size = 0
      while (size < buffer.length) {
        const read = await file.read(buffer,size,buffer.length-size,size)
        if (!read.bytesRead) break
        size += read.bytesRead
      }
      if (size > PRIVACY_MANIFEST_LIMIT) throw new Error('Arquivo excede limite.')
      input = buffer.subarray(0,size).toString('utf8')
    } finally { await file.close() }
    verifyPrivacyRecoveryManifest(input,secret,args[4])
  }
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'),import('../src/payload.config')])
  payload = await getPayload({ config })
  if (exporting) {
    const manifest = await exportPrivacyRecoveryManifest(payload,secret)
    await writeFile(args[2],JSON.stringify(manifest)+'\n',{ flag: 'wx', mode: 0o600 })
    console.log(JSON.stringify({ exported: true, version: manifest.version, entries: manifest.entries.length, generatedAt: manifest.generatedAt }))
  } else console.log(JSON.stringify(await replayPrivacyRecoveryManifest(payload,input,{ secret, snapshotAt: args[4], ownerId: args[6], isolated: true, apply: args[0] === 'apply' })))
} catch {
  console.error('Recuperação de privacidade não concluída. Confira argumentos, arquivo privado, chave, snapshot, owner e isolamento. Nenhum conteúdo do manifesto foi exibido.')
  process.exitCode = 1
} finally { if (payload) await payload.destroy() }
process.exit(process.exitCode || 0)

import type { Payload } from 'payload'

if (process.argv.includes('--help')) {
  console.log('media:gc [--apply] — padrão: conferência sem escrita; --apply registra órfãos/remove os maduros após 24h.')
  process.exit(0)
}
if (process.argv.slice(2).some(arg => arg !== '--apply') || process.argv.slice(2).length > 1) {
  console.error('Use media:gc sem argumentos ou somente --apply.'); process.exit(1)
}
let payload: Payload | undefined
try {
  const { getPayload } = await import('payload'), config = (await import('../src/payload.config')).default
  payload = await getPayload({ config })
  const { collectMedia } = await import('../src/modules/catalog/media-gc')
  console.log(JSON.stringify(await collectMedia(payload, { apply: process.argv.includes('--apply') })))
} catch { console.error('Limpeza de mídia interrompida. Confira banco, permissões e índice privado; nenhum caminho foi exibido.'); process.exitCode = 1 }
finally { await payload?.destroy() }
process.exit(process.exitCode || 0)

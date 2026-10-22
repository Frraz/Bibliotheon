import { cp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = process.env.NEXT_DIST_DIR || '.next'
const dist = path.resolve(root, distDirectory)
if (!dist.startsWith(root + path.sep)) throw new Error('Pasta de build deve ficar dentro do projeto.')
const standalone = path.join(dist, 'standalone')
await cp(path.join(dist, 'static'), path.join(standalone, distDirectory, 'static'), { recursive: true })
await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true })
const child = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: process.env.APP_HOST || '127.0.0.1', MEDIA_DIR: process.env.MEDIA_DIR || path.join(root, 'uploads') },
})
let shutdownTimer
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  child.kill(signal)
  shutdownTimer ??= setTimeout(() => child.kill('SIGKILL'), 10_000)
  shutdownTimer.unref()
})
child.on('error', () => { console.error('Não foi possível iniciar o build. Execute npm run build antes de npm start.'); process.exitCode = 1 })
child.on('exit', (code, signal) => {
  clearTimeout(shutdownTimer)
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1)
})

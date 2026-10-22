import { readFile } from 'node:fs/promises'
try {
  const timestamp = Number(await readFile('/tmp/bibliotheon-worker-health', 'utf8'))
  const age = Date.now() - timestamp
  process.exit(Number.isSafeInteger(timestamp) && age >= 0 && age <= 90_000 ? 0 : 1)
} catch { process.exit(1) }

import { readFile } from 'node:fs/promises'
import { workerHealth } from '../src/modules/marketing/retention-policy'
try {
  const heartbeat = await readFile('/tmp/bibliotheon-worker-health', 'utf8')
  const enabled = process.env.DATA_RETENTION_ENABLED === 'true'
  const retention = enabled ? await readFile('/tmp/bibliotheon-retention-health', 'utf8') : undefined
  process.exit(workerHealth(heartbeat, retention, enabled) ? 0 : 1)
} catch { process.exit(1) }

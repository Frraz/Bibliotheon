import { getPayload } from 'payload'
import config from '../src/payload.config'
import { migrations } from '../migrations'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

process.env.PAYLOAD_MIGRATING = 'true'
const payload = await getPayload({ config })
try {
  await payload.db.migrate({ migrations: migrations.map(({ name, up, down }) => ({
    name,
    up: (args: unknown) => up(args as MigrateUpArgs),
    down: (args: unknown) => down(args as MigrateDownArgs),
  })) })
  console.log('Migrações aplicadas. Rollback de código não reverte o schema.')
} finally { await payload.destroy() }
process.exit(0)

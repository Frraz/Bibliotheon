import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
if (process.env.BIBLIOTHEON_SYNTHETIC_TESTS !== 'true') throw new Error('Exige BIBLIOTHEON_SYNTHETIC_TESTS=true.')
const configured = new URL(process.env.DATABASE_URL || '')
if (!['localhost', '127.0.0.1'].includes(configured.hostname)) throw new Error('Somente PostgreSQL loopback.')
const name = `bibliotheon_qa_editorial_${randomBytes(6).toString('hex')}`
const maintenance = new URL(configured); maintenance.pathname = '/postgres'
const isolated = new URL(configured); isolated.pathname = `/${name}`
const require = createRequire(import.meta.resolve('@payloadcms/db-postgres')), { Client } = require('pg')
const admin = new Client({ connectionString: maintenance.toString() })
const media = await mkdtemp(path.join(tmpdir(), 'bibliotheon-editorial-'))
const env = { ...process.env, DATABASE_URL: isolated.toString(), MEDIA_DIR: media }
let created = false
async function run(args) {
  await new Promise((resolve, reject) => { const child = spawn(process.execPath, args, { stdio: 'inherit', env }); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Teste encerrou: ${code}`))) })
}
try {
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`); created = true
  await run(['node_modules/payload/bin.js', 'migrate'])
  await run(['--import', 'tsx', 'tests/integration/editorial.ts'])
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
  await admin.end(); await rm(media, { recursive: true, force: true })
}

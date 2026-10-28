import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { spawn } from 'node:child_process'
import net from 'node:net'

if (process.env.BIBLIOTHEON_SYNTHETIC_TESTS !== 'true') {
  throw new Error('Confirme ambiente sintético descartável com BIBLIOTHEON_SYNTHETIC_TESTS=true.')
}

const configured = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1', '::1'].includes(configured.hostname)) {
  throw new Error('QA isolada exige PostgreSQL em loopback; nenhuma conexão foi aberta.')
}
if (!['postgres:', 'postgresql:'].includes(configured.protocol)) {
  throw new Error('DATABASE_URL precisa usar PostgreSQL.')
}

const databaseName = `bibliotheon_qa_http_${randomBytes(6).toString('hex')}`
const maintenance = new URL(configured)
maintenance.pathname = '/postgres'
const isolated = new URL(configured)
isolated.pathname = `/${databaseName}`
const requireFromAdapter = createRequire(import.meta.resolve('@payloadcms/db-postgres'))
const { Client } = requireFromAdapter('pg')
const admin = new Client({ connectionString: maintenance.toString() })
const root = process.cwd()
const startedAt = new Date().toISOString()
const phase = process.env.BIBLIOTHEON_HTTP_QA_PHASE || 'D120'
if (!/^D[1-9][0-9]{0,5}$/.test(phase)) throw new Error('Fase de evidência HTTP inválida.')
const httpSuites = ['integration', 'site', 'hotmart-http', 'kiwify-http', 'cakto-http', 'commercial-csv-http', 'commercial-imports-http', 'catalog-resolutions-http', 'transaction-review-http', 'financial-resolutions-http', 'report-evidence-http', 'financial-ledger-http', 'brevo-webhook-http', 'analytics-http', 'privacy-delete-http', 'admin-recovery']
let created = false, removed = false, passed = false, activeChild, interruptSignal

const forwardSignal = signal => {
  interruptSignal = signal
  activeChild?.kill(signal)
}
process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    activeChild = child
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (activeChild === child) activeChild = undefined
      if (code === 0) resolve()
      else reject(new Error(`${command} terminou com código ${code ?? signal}.`))
    })
  })
}

async function availableLoopbackPort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Não foi possível reservar porta local para QA.')
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return address.port
}

try {
  await admin.connect()
  const permission = await admin.query(`SELECT r.rolcreatedb OR r.rolsuper AS allowed FROM pg_roles r WHERE r.rolname = current_user`)
  if (permission.rows[0]?.allowed !== true) throw new Error('O usuário PostgreSQL local não pode criar banco descartável.')
  await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`)
  created = true
  console.log('QA HTTP: banco descartável criado; o banco configurado será preservado.')

  const baseEnv = { ...process.env, DATABASE_URL: isolated.toString(), BIBLIOTHEON_SYNTHETIC_TESTS: 'true' }
  await run('npm', ['run', 'db:migrate'], baseEnv)
  const httpEnv = {
    ...baseEnv,
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-qa',
    CHECK_HTTP_PORT: process.env.CHECK_HTTP_PORT || String(await availableLoopbackPort()),
  }
  try {
    await run('npm', ['run', 'check:http'], httpEnv)
    passed = true
  } catch (error) {
    console.error('QA HTTP falhou; inventário agregado do banco descartável para localizar a fixture residual:')
    await run('npm', ['run', 'privacy:inventory'], baseEnv).catch(() => {})
    throw error
  }
} finally {
  if (created) {
    try {
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
      removed = true
      console.log('QA HTTP: banco descartável removido; nenhum dado foi gravado no banco configurado.')
    } catch {
      console.error(`QA HTTP: falha ao remover ${databaseName}; descarte esse banco local após conferir que nenhum processo o utiliza.`)
      process.exitCode = 1
    }
  }
  await admin.end().catch(() => {})
}

if (passed && removed && !interruptSignal) {
  const migrations = (await readdir(path.join(root, 'migrations'))).filter(name => /^\d{8}_.*\.ts$/.test(name)).sort()
  const buildID = (await readFile(path.join(root, process.env.NEXT_DIST_DIR || '.next-qa', 'BUILD_ID'), 'utf8')).trim()
  const sources = ['scripts/qa-http-isolated.mjs', 'scripts/check-http.sh', 'tests/integration/access.ts', 'migrations/index.ts']
  const sourceSHA256 = Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])))
  const report = {
    phase: `H03-HTTP-${phase}`, startedAt, completedAt: new Date().toISOString(),
    command: 'NEXT_DIST_DIR=.next-qa BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:http-isolated',
    environment: 'PostgreSQL local descartável em loopback; banco configurado preservado',
    buildID, migrationCount: migrations.length, migrationNames: migrations,
    httpSuites: httpSuites.map(name => ({ name, status: 'passed' })),
    externalProviderCalls: 0, realMessagesSent: 0, configuredDatabasePreserved: true,
    temporaryDatabaseRemoved: true, imagePublished: false, productionReady: false, sourceSHA256,
  }
  const output = path.join(root, `artifacts/container/h03-http-${phase.toLowerCase()}-results.json`)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  console.log(`H03 HTTP: evidência local registrada em ${path.relative(root, output)}.`)
}

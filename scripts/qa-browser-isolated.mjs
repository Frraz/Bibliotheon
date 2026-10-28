import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const suites = {
  'analytics': ['qa-analytics', 'results.json'],
  'suppressions': ['qa-suppressions', 'results.json'],
  'commercial-admin': ['qa-commercial-admin', 'results.json'],
  'financial-ledger': ['qa-financial-ledger', 'results.json'],
  'financial-records': ['qa-financial-records', 'results.json'],
  'commercial-imports': ['qa-commercial-imports', 'results.json'],
  'catalog-resolutions': ['qa-catalog-resolutions', 'results.json'],
  'financial-resolutions': ['qa-financial-resolutions', 'results.json'],
  'financial-coverage': ['qa-financial-coverage', 'results.json'],
  'financial-dimensions': ['qa-financial-dimensions', 'results.json'],
  'public-states': ['qa-public-states', 'results.json'],
  'commercial-load': ['qa-commercial-load', 'results.json'],
  'relationship-states': ['qa-relationship-states', 'results.json'],
  foundation: ['qa-public-redesign/foundation', 'results.json'],
  'public-site': ['qa-public-redesign/site', 'results.json'],
  'catalog-states': ['qa-phase1', 'catalog-states-results.json'],
  relationship: ['qa-relationship', 'results.json'],
  preferences: ['qa-preferences', 'results.json'],
  sequences: ['qa-sequences', 'results.json'],
  'admin-foundation': ['qa-foundation', 'admin-results.json'],
  'admin-editorial': ['qa-admin-editorial', 'results.json'],
  'commercial-operation': ['qa-commercial-operation', 'results.json'],
}
const suite = process.argv[2]
if (suite === 'public-states' && process.env.BIBLIOTHEON_PUBLIC_STATES_MODE === 'extras') suites[suite][1] = 'extras-results.json'
if (suite === 'relationship-states' && process.env.BIBLIOTHEON_RELATIONSHIP_STATES_MODE === 'native') suites[suite][1] = 'native-results.json'
if (suite === 'public-states' && process.env.BIBLIOTHEON_PUBLIC_STATES_MODE === 'redesign') suites[suite] = ['qa-public-redesign/states', 'results.json']
const phase = process.env.BIBLIOTHEON_BROWSER_QA_PHASE || 'D122'
assert.match(phase, /^D[1-9][0-9]{0,5}$/)
if (['remaining', 'admin-final'].includes(suite) && process.argv.length === 3) {
  assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
  const queue = suite === 'admin-final' ? ['analytics', 'suppressions', 'commercial-admin', 'financial-ledger', 'financial-records', 'commercial-imports', 'catalog-resolutions', 'financial-resolutions', 'financial-coverage', 'financial-dimensions'] : ['foundation', 'catalog-states', 'relationship', 'preferences', 'sequences', 'admin-foundation', 'commercial-operation']
  const children = new Set(), results = []
  let interrupted = false
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; for (const child of children) child.kill(signal) })
  await Promise.all([0, 1].map(async () => {
    while (queue.length && !interrupted) {
      const next = queue.shift()
      const code = await new Promise(resolve => {
        const child = spawn(process.execPath, [process.argv[1], next], { stdio: 'inherit', env: process.env })
        children.add(child)
        child.once('error', () => { children.delete(child); resolve(1) })
        child.once('exit', code => { children.delete(child); resolve(code ?? 1) })
      })
      results.push({ suite: next, code })
    }
  }))
  console.log(JSON.stringify({ phase, results, interrupted }))
  process.exit(interrupted || results.some(result => result.code !== 0) ? 1 : 0)
}
assert.ok(Object.hasOwn(suites, suite) && process.argv.length === 3, 'Informe uma única suíte permitida.')
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Exige confirmação de teste sintético.')
const configured = new URL(process.env.DATABASE_URL ?? '')
assert.ok(['postgres:', 'postgresql:'].includes(configured.protocol))
assert.ok(['localhost', '127.0.0.1', '::1'].includes(configured.hostname), 'Exige PostgreSQL loopback.')
const name = `bibliotheon_qa_browser_${randomBytes(6).toString('hex')}`
const maintenance = new URL(configured); maintenance.pathname = '/postgres'
const isolated = new URL(configured); isolated.pathname = `/${name}`
const { Client } = createRequire(import.meta.resolve('@payloadcms/db-postgres'))('pg')
const admin = new Client({ connectionString: maintenance.toString() })
const startedAt = new Date().toISOString()
const sourceFiles = ['scripts/qa-browser-isolated.mjs', 'scripts/qa-network-guard.mjs', 'scripts/check-qa-admin.sh', `scripts/qa-${suite}.ts`, ...(suite === 'relationship-states' ? ['src/components/SampleForms.tsx'] : suite === 'suppressions' ? ['src/components/admin/SuppressionForm.tsx'] : []), 'package.json', 'pnpm-lock.yaml', 'src/components/Appearance.tsx', 'src/components/SiteHeader.tsx', 'src/app/(site)/page.tsx', 'src/styles/admin.css', 'src/styles/site.css', 'patches/@payloadcms__ui@3.91.0.patch']
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
const before = await hashes()
const buildID = (await readFile('.next-qa/BUILD_ID', 'utf8')).trim()
let created = false, removed = false, mediaDirectory, mediaRemoved = false, passed = false, child, interrupted = false, failure
const run = (command, args, env) => new Promise((resolve, reject) => {
  child = spawn(command, args, { stdio: 'inherit', env })
  child.once('error', reject)
  child.once('exit', (code, signal) => {
    child = undefined
    if (code === 0) resolve()
    else reject(new Error(`Processo de QA terminou com código ${code ?? signal}.`))
  })
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; child?.kill(signal) })
async function availablePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return String(port)
}
try {
  await admin.connect()
  await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`)
  created = true
  console.log(`${suite}: banco descartável criado; banco configurado preservado.`)
  mediaDirectory = await mkdtemp(join(tmpdir(), 'bibliotheon-browser-media-'))
  const env = { ...process.env, DATABASE_URL: isolated.toString(), MEDIA_DIR: mediaDirectory, CHECK_ADMIN_QA_PORT: await availablePort() }
  await run('npm', ['run', 'db:migrate'], env)
  assert.equal(interrupted, false)
  await run('bash', ['scripts/check-qa-admin.sh', suite], env)
  assert.equal(interrupted, false)
  assert.deepEqual(await hashes(), before, 'Fontes alteradas durante a medição.')
  assert.equal((await readFile('.next-qa/BUILD_ID', 'utf8')).trim(), buildID)
  const resultPath = `artifacts/${suites[suite][0]}/${suites[suite][1]}`
  assert.ok((await stat(resultPath)).mtimeMs >= Date.parse(startedAt), 'Relatório não renovado.')
  JSON.parse(await readFile(resultPath, 'utf8'))
  passed = true
} catch (error) {
  failure = error.message
  process.exitCode = 1
} finally {
  if (created) {
    try { await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); removed = true }
    catch { failure = 'Falha no descarte do banco sintético; confira os bancos bibliotheon_qa_browser locais.'; process.exitCode = 1 }
  }
  await admin.end().catch(() => {})
  if (mediaDirectory) { await rm(mediaDirectory, { recursive: true }); mediaRemoved = true }
  const directory = `artifacts/${suites[suite][0]}`
  const artifacts = []
  for (const file of await readdir(directory).catch(() => [])) {
    const artifact = `${directory}/${file}`, info = await stat(artifact)
    if (info.isFile() && info.mtimeMs >= Date.parse(startedAt)) artifacts.push({ path: artifact, bytes: info.size, sha256: createHash('sha256').update(await readFile(artifact)).digest('hex') })
  }
  await mkdir(`artifacts/qa-release-layout/${phase.toLowerCase()}`, { recursive: true })
  await writeFile(`artifacts/qa-release-layout/${phase.toLowerCase()}/${suite}.json`, JSON.stringify({
    phase, suite, startedAt, completedAt: new Date().toISOString(), status: passed && removed && mediaRemoved && !interrupted ? 'passed' : 'failed',
    buildID, sourceSHA256: before, configuredDatabasePreserved: true, temporaryDatabaseRemoved: removed,
    temporaryMediaRemoved: mediaRemoved,
    artifacts, failure, limits: 'QA local sintética; não equivale a conta externa, revisão visual manual integral, capacidade da VPS ou deploy.',
  }, null, 2) + '\n')
  console.log(`${suite}: ${passed && removed ? 'passou; banco descartado' : 'falhou'}; evidência ${phase} registrada.`)
  if (failure) console.error(failure)
}

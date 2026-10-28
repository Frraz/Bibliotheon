// Preload exclusivo da QA: nunca incluído no runtime de produção.
import assert from 'node:assert/strict'
import { appendFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
assert.ok(process.env.BIBLIOTHEON_QA_NETWORK_LOG)
function check(input, options) {
  const target = typeof input === 'string' || input instanceof URL ? new URL(input) : undefined
  const hostname = target?.hostname ?? input?.hostname ?? input?.host ?? options?.hostname ?? options?.host ?? 'localhost'
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
    // Sem URL, headers, identificadores ou payloads no registro.
    appendFileSync(process.env.BIBLIOTHEON_QA_NETWORK_LOG, JSON.stringify({ event: 'external-http-blocked', pid: process.pid }) + '\n', { mode: 0o600 })
    throw new Error('HTTP externo bloqueado na QA sintética.')
  }
}
const originalFetch = globalThis.fetch
globalThis.fetch = async (input, options) => {
  check(input instanceof Request ? input.url : input)
  return originalFetch(input, options)
}
for (const transport of [http, https]) for (const method of ['request', 'get']) {
  const original = transport[method]
  transport[method] = function (input, ...args) { check(input, args[0]); return original.call(this, input, ...args) }
}
syncBuiltinESMExports()

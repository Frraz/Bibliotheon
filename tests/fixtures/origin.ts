const url = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000')
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Origem de QA deve ser somente uma origem loopback, sem credenciais ou parâmetros.')
export const testOrigin = url.origin

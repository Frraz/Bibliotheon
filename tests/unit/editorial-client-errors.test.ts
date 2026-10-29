import { describe, expect, it } from 'vitest'
import { editorialHTTPError } from '../../src/modules/editorial/client-errors'
describe('orientações do cliente editorial', () => {
  it('explica login recusado e sessão expirada sem confundir com deploy', () => {
    expect(editorialHTTPError(401, '/api/admin-users/login')).toContain('e-mail e senha')
    expect(editorialHTTPError(401, '/api/v1/admin/editorial/preview')).toContain('Sessão recusada ou expirada')
  })
  it('orienta implantação para rota editorial ausente, inclusive sem JSON', () => {
    expect(editorialHTTPError(404, '/api/v1/admin/editorial/preview')).toContain('implante a versão atual')
    expect(editorialHTTPError(404, '/api/admin-users/login')).not.toContain('editorial_api_missing')
  })
  it('preserva status 4xx e 503 usados na recuperação de confirmação incerta', () => {
    expect(editorialHTTPError(409, '/api/v1/admin/editorial/publish', 'remote_changed', 'Prepare novamente.')).toMatch(/^HTTP 409: remote_changed/)
    expect(editorialHTTPError(503, '/api/v1/admin/editorial/publish')).toContain('use consultar')
    expect(editorialHTTPError(422, '/api/v1/admin/editorial/preview', 'invalid_package', 'Confira capa.')).toBe('HTTP 422: invalid_package — Confira capa.')
  })
})

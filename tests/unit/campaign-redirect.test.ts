import { expect, it } from 'vitest'
import { preserveCampaignQuery } from '../../src/modules/catalog/seo'
it('mantém a campanha após troca de slug, sem aceitar destino arbitrário da query', () => {
  expect(preserveCampaignQuery('/ebooks/revisado', { c: 'parceiro-aprovado', url: 'https://evil.invalid', email: 'sintetico@example.invalid' })).toBe('/ebooks/revisado?c=parceiro-aprovado')
  expect(preserveCampaignQuery('/ebooks/revisado', {})).toBe('/ebooks/revisado')
})
it('não transforma campanha duplicada em ausência de contexto e oferta primária', () => {
  const target = new URL(preserveCampaignQuery('/ebooks/revisado', { c: ['parceiro', 'outro'] }), 'https://example.invalid')
  expect(target.searchParams.getAll('c')).toEqual(['parceiro', 'outro'])
})

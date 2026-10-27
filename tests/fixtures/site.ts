import {mkdir,writeFile,rm} from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '../../src/payload.config'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import assert from 'node:assert/strict'
import type { Ebook, Offer } from '../../src/payload-types'

export const textBody = (text: string) => ({ root: { type: 'root', version: 1, direction: 'ltr' as const, format: '' as const, indent: 0, children: [{ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, children: [{ type: 'text', version: 1, text, format: 0, style: '', mode: 'normal', detail: 0 }] }] } })
export async function seedSite() {
  const database = new URL(process.env.DATABASE_URL || '')
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname), 'Fixtures somente em banco loopback.')
  const payload = await getPayload({ config })
  assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 0, 'Banco de testes não pode conter owner.')
  const suffix = randomBytes(5).toString('hex')
  const password = randomBytes(32).toString('hex')
  const owner = await payload.create({ collection: 'admin-users', overrideAccess: true, context: { provisionAdmin: true }, data: { email: `sintetico-${suffix}@example.invalid`, password, role: 'owner' } })
  const user = { ...owner, collection: 'admin-users' as const }
  const auth = { user, overrideAccess: false }
  const previous = await payload.findGlobal({ slug: 'site-settings', overrideAccess: true, depth: 0 })
  await mkdir('.local-run',{recursive:true})
  const settingsBackup=`.local-run/fixture-site-settings-${suffix}.json`
  await writeFile(settingsBackup,JSON.stringify(previous)+'\n',{mode:0o600,flag:'wx'})
  const theme = await payload.create({ collection: 'themes', ...auth, data: { name: 'Aprendizagem sintética', slug: `tema-${suffix}`, introduction: 'Tema exclusivo de testes locais.', _status: 'published' } })
  const image = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#163C56"/><path d="M64 64H536V836H64Z" fill="none" stroke="#B9D9F2" stroke-width="2"/><text x="100" y="200" fill="white" font-family="serif" font-size="48">Edição</text><text x="100" y="265" fill="white" font-family="serif" font-size="48">sintética</text><text x="100" y="760" fill="#B9D9F2" font-family="sans-serif" font-size="20">Somente para testes locais</text></svg>')).png().toBuffer()
  const cover = await payload.create({ collection: 'media', ...auth, data: { alt: 'Capa sintética para testes', presentationRole: 'cover', visibility: 'public' }, file: { data: image, size: image.length, name: 'cover.png', mimetype: 'image/png' } })
  const books: Ebook[] = []
  for (const variant of ['guide', 'reading', 'workbook'] as const) {
    books.push(await payload.create({ collection: 'ebooks', ...auth, data: { title: `Edição sintética ${variant}`, slug: `${variant}-${suffix}`, summary: 'Um livro de demonstração criado apenas para validar a aplicação.', audience: 'Pessoas participando da validação local.', problem: 'Conferir a apresentação de uma edição digital.', promise: 'Conhecer a estrutura do material antes da escolha.', requirements: 'Este material é uma fixture de testes.', limits: 'Não é um produto à venda.', body: textBody('Trecho sintético: observar, experimentar e revisar são formas de consolidar uma aprendizagem. Esta passagem existe apenas para o teste de renderização.'), benefits: [{ text: 'Examinar um exemplo de estrutura editorial.' }], contents: [{ text: 'Introdução e contexto' }, { text: 'Exemplo aplicado' }, { text: 'Revisão e próximos passos' }], faq: [{ question: 'Este é um produto real?', answer: 'Não. Esta edição é exclusivamente uma fixture sintética de teste local.' }], cover: cover.id, theme: theme.id, materialState: 'ready', presentationVariant: variant, accentPreset: variant === 'reading' ? 'slate' : variant === 'workbook' ? 'plum' : 'mineral', workbookExample: variant === 'workbook' ? 'Escolha uma ideia do texto. Escreva como você a explicaria em duas frases. Compare sua explicação com a fonte e revise os trechos que ficaram ambíguos.' : undefined, _status: 'published' } }))
  }
  const draft = await payload.create({ collection: 'ebooks', ...auth, draft: true, data: { title: 'Rascunho privado sintético', slug: `privado-${suffix}`, materialState: 'production' } })
  const offers: Offer[] = []
  for (const provider of ['hotmart', 'kiwify', 'cakto'] as const) {
    process.env[`CHECKOUT_ALLOWED_HOSTS_${provider.toUpperCase()}`] = 'pay.example.invalid'
    offers.push(await payload.create({ collection: 'offers', ...auth, data: { name: `Oferta sintética ${provider}`, ebook: books[0].id, provider, accountKey: 'synthetic', externalProductId: 'synthetic-product', active: true, primary: provider === 'hotmart', currency: 'BRL', priceCents: 9900, checkoutUrl: `https://pay.example.invalid/${provider}?affiliate=original&signature=unchanged`, lastVerifiedAt: new Date().toISOString(), eligibilityNote: 'Fixture sintética. Sem publicação real.' } }))
  }
  const campaign = await payload.create({ collection: 'campaigns', ...auth, data: { code: `parceria-${suffix.slice(0,4)}x${suffix.slice(4)}`, ebook: books[0].id, offer: offers[1].id, audience: 'Testes', hypothesis: 'Preservar o destino afiliado.', channel: 'local', kind: 'affiliate', state: 'active', affiliateUrl: 'https://pay.example.invalid/afiliado?affiliate=partner&signature=keep%2Bthis' } })
  const article = await payload.create({ collection: 'articles', ...auth, data: { title: 'Artigo sintético de validação', slug: `artigo-${suffix}`, summary: 'Um texto criado somente para testar a renderização.', author: 'Equipe de teste sintética', theme: theme.id, ebook: books[0].id, body: textBody('Um exemplo curto para conferir legibilidade, autoria e navegação entre artigo e livro.'), _status: 'published' } })
  await payload.updateGlobal({ slug: 'site-settings', ...auth, data: { responsibleName: 'Responsável sintético', contactEmail: 'contato@example.invalid', about: textBody('Informações sintéticas de teste.'), privacyPolicy: textBody('Aviso sintético para testar a página.'), terms: textBody('Termos sintéticos para testar a página.'), legalReady: true } })
  return { payload, auth, owner, password, theme, cover, books, offers, campaign, article, draft, async cleanup() {
    await payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, data: { responsibleName: previous.responsibleName || null, contactEmail: previous.contactEmail || null, about: previous.about || null, privacyPolicy: previous.privacyPolicy || null, terms: previous.terms || null, legalReady: previous.legalReady || false } })
    await payload.delete({collection:'checkout-clicks',where:{offer:{in:offers.map(item=>item.id)}},overrideAccess:true})
    await payload.delete({collection:'page-views',where:{ebook:{in:[...books,draft].map(item=>item.id)}},overrideAccess:true})
    await payload.delete({ collection: 'campaigns', id: campaign.id, overrideAccess: true })
    for (const offer of offers) await payload.delete({ collection: 'offers', id: offer.id, overrideAccess: true })
    await payload.delete({ collection: 'articles', id: article.id, overrideAccess: true })
    for (const book of [...books, draft]) await payload.delete({ collection: 'ebooks', id: book.id, overrideAccess: true })
    await payload.delete({ collection: 'media', id: cover.id, overrideAccess: true })
    await payload.delete({ collection: 'themes', id: theme.id, overrideAccess: true })
    await payload.delete({ collection: 'admin-users', id: owner.id, overrideAccess: true })
    await rm(settingsBackup)
    await payload.destroy()
  } }
}

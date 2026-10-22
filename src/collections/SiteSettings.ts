import { APIError, type GlobalConfig } from 'payload'
import { owner } from '../access/owner'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings', label: 'Institucional', access: { read: owner, update: owner },
  admin: { group: 'Conteúdo' },
  fields: [
    { name: 'responsibleName', label: 'Responsável pela operação', type: 'text' },
    { name: 'contactEmail', label: 'E-mail público de contato', type: 'email' },
    { name: 'about', label: 'Sobre', type: 'richText' },
    { name: 'privacyPolicy', label: 'Aviso de privacidade', type: 'richText' },
    { name: 'terms', label: 'Termos', type: 'richText' },
    { name: 'legalReady', label: 'Responsável, contato e textos revisados para publicação', type: 'checkbox', defaultValue: false },
  ],
  hooks: { beforeChange: [({ data, originalDoc }) => {
    const merged = { ...originalDoc, ...data }
    if (merged.legalReady && ['responsibleName', 'contactEmail', 'about', 'privacyPolicy', 'terms'].some(key => !merged[key])) throw new APIError('Preencha responsável, contato e todos os textos antes de liberar a publicação institucional.', 422)
    return data
  }] },
}

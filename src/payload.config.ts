import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { pt } from '@payloadcms/translations/languages/pt'
import sharp from 'sharp'
import { AdminUsers } from './collections/AdminUsers'
import { Themes } from './collections/Themes'
import { Ebooks } from './collections/Ebooks'
import { Articles } from './collections/Articles'
import { Media } from './collections/Media'
import { LeadMagnets } from './collections/LeadMagnets'
import { Offers } from './collections/Offers'
import { Campaigns } from './collections/Campaigns'
import { SiteSettings } from './collections/SiteSettings'
import { Redirects } from './collections/Redirects'
import { commerceCollections } from './collections/Commerce'
import { commercialImportCollections } from './collections/CommercialImports'
import { analyticsCollections } from './collections/Analytics'
import { relationshipCollections } from './collections/Relationship'
import { EmailSequences } from './collections/EmailSequences'
import { deliverEmailTask } from './jobs/deliver-email'
import { presentCollections } from './collections/presentation'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const secret = process.env.PAYLOAD_SECRET
if (!secret || secret.length < 32 || secret.startsWith('REPLACE_')) throw new Error('Configure PAYLOAD_SECRET com pelo menos 32 caracteres aleatórios.')
if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.')
const origin = process.env.PUBLIC_SITE_URL || 'http://localhost:3000'

export default buildConfig({
  secret,
  serverURL: origin,
  csrf: [origin],
  cors: [origin],
  graphQL: { disable: true },
  upload: { abortOnLimit: true, requestSizeLimit: 21 * 1024 * 1024, limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 100 } },
  admin: {
    user: AdminUsers.slug,
    avatar: 'default',
    dateFormat: 'dd/MM/yyyy HH:mm',
    importMap: { baseDir: dirname },
    meta: { titleSuffix: ' · Bibliotheon' },
    components: {
      graphics: { Logo: '/components/admin/Brand#Brand', Icon: '/components/admin/Brand#BrandIcon' },
      providers: ['/components/admin/AppearanceAdapter#AppearanceAdapter'],
      views: {
        dashboard: { Component: '/components/admin/Dashboard#Dashboard' },
        commercialInbox: { Component: '/components/admin/CommercialInboxView#CommercialInboxView', path: '/commercial-inbox', exact: true, meta: { title: 'Acompanhamento de eventos' } },
        suppressions: { Component: '/components/admin/SuppressionView#SuppressionView', path: '/suppressions', exact: true, meta: { title: 'Suspender e-mails' } },
      },
    },
  },
  i18n: { supportedLanguages: { pt }, fallbackLanguage: 'pt' },
  collections: presentCollections([AdminUsers, Themes, Ebooks, Articles, Media, LeadMagnets, Offers, Campaigns, Redirects, EmailSequences, ...relationshipCollections, ...analyticsCollections, ...commerceCollections, ...commercialImportCollections]),
  globals: [SiteSettings],
  jobs: {
    tasks: [deliverEmailTask],
    access: { run: () => false, queue: () => false, cancel: () => false },
    deleteJobOnComplete: true,
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      access: { create: () => false, read: () => false, update: () => false, delete: () => false },
    }),
  },
  email: () => ({
    name: 'disabled-until-configured', defaultFromAddress: 'disabled@example.invalid', defaultFromName: 'Bibliotheon',
    sendEmail: async () => { throw new Error('Envio de e-mail desabilitado neste ambiente.') },
  }),
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL, max: 5 },
    idType: 'uuid',
    push: false,
    migrationDir: path.resolve(dirname, '../migrations'),
  }),
  sharp,
  typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
})

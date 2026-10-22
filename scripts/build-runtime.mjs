import { build } from 'esbuild'
await build({
  entryPoints: { migrate: 'scripts/migrate.ts', 'create-admin': 'scripts/create-admin.ts', 'recover-admin': 'scripts/recover-admin.ts', 'apply-suppression': 'scripts/apply-suppression.ts', 'prepare-promotions': 'scripts/prepare-promotions.ts', 'media-gc': 'scripts/media-gc.ts', 'sync-brevo-suppressions': 'scripts/sync-brevo-suppressions.ts', 'sync-brevo-registrations': 'scripts/sync-brevo-registrations.ts', 'prepare-brevo-list': 'scripts/prepare-brevo-list.ts', 'prepare-brevo-preferences': 'scripts/prepare-brevo-preferences.ts', 'prepare-brevo-campaign': 'scripts/prepare-brevo-campaign.ts', 'send-brevo-campaign': 'scripts/send-brevo-campaign.ts', worker: 'scripts/worker.ts', 'worker-health': 'scripts/worker-health.ts' },
  outdir: '.release', bundle: true, packages: 'external', platform: 'node', target: 'node22', format: 'esm',
})

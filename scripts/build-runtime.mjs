import { build } from 'esbuild'
await build({
  entryPoints: { migrate: 'scripts/migrate.ts', 'create-admin': 'scripts/create-admin.ts', 'recover-admin': 'scripts/recover-admin.ts', 'apply-suppression': 'scripts/apply-suppression.ts', 'prepare-promotions': 'scripts/prepare-promotions.ts', worker: 'scripts/worker.ts', 'worker-health': 'scripts/worker-health.ts' },
  outdir: '.release', bundle: true, packages: 'external', platform: 'node', target: 'node22', format: 'esm',
})

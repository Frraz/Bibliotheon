import * as migration_20261021_012104_initial from './20261021_012104_initial';
import * as migration_20261021_013444_catalog from './20261021_013444_catalog';
import * as migration_20261021_104729_public_site from './20261021_104729_public_site';
import * as migration_20261021_121334_relationship from './20261021_121334_relationship';
import * as migration_20261021_155133_relationship_jobs from './20261021_155133_relationship_jobs';
import * as migration_20261021_155500_relationship_invariants from './20261021_155500_relationship_invariants';
import * as migration_20261021_233105_sequences from './20261021_233105_sequences';
import * as migration_20261022_051922_promotion_batches from './20261022_051922_promotion_batches';
import * as migration_20261022_053258_brevo_suppressions from './20261022_053258_brevo_suppressions';
import * as migration_20261022_054929_provider_preflight from './20261022_054929_provider_preflight';
import * as migration_20261022_060415_brevo_registrations from './20261022_060415_brevo_registrations';
import * as migration_20261022_110941_brevo_batch_lists from './20261022_110941_brevo_batch_lists';
import * as migration_20261022_115043_brevo_preferences from './20261022_115043_brevo_preferences';
import * as migration_20261022_120651_brevo_campaign_drafts from './20261022_120651_brevo_campaign_drafts';
import * as migration_20261022_123536_brevo_campaign_sends from './20261022_123536_brevo_campaign_sends';

export const migrations = [
  {
    up: migration_20261021_012104_initial.up,
    down: migration_20261021_012104_initial.down,
    name: '20261021_012104_initial',
  },
  {
    up: migration_20261021_013444_catalog.up,
    down: migration_20261021_013444_catalog.down,
    name: '20261021_013444_catalog',
  },
  {
    up: migration_20261021_104729_public_site.up,
    down: migration_20261021_104729_public_site.down,
    name: '20261021_104729_public_site',
  },
  {
    up: migration_20261021_121334_relationship.up,
    down: migration_20261021_121334_relationship.down,
    name: '20261021_121334_relationship',
  },
  {
    up: migration_20261021_155133_relationship_jobs.up,
    down: migration_20261021_155133_relationship_jobs.down,
    name: '20261021_155133_relationship_jobs',
  },
  {
    up: migration_20261021_155500_relationship_invariants.up,
    down: migration_20261021_155500_relationship_invariants.down,
    name: '20261021_155500_relationship_invariants',
  },
  {
    up: migration_20261021_233105_sequences.up,
    down: migration_20261021_233105_sequences.down,
    name: '20261021_233105_sequences',
  },
  {
    up: migration_20261022_051922_promotion_batches.up,
    down: migration_20261022_051922_promotion_batches.down,
    name: '20261022_051922_promotion_batches',
  },
  {
    up: migration_20261022_053258_brevo_suppressions.up,
    down: migration_20261022_053258_brevo_suppressions.down,
    name: '20261022_053258_brevo_suppressions',
  },
  {
    up: migration_20261022_054929_provider_preflight.up,
    down: migration_20261022_054929_provider_preflight.down,
    name: '20261022_054929_provider_preflight',
  },
  {
    up: migration_20261022_060415_brevo_registrations.up,
    down: migration_20261022_060415_brevo_registrations.down,
    name: '20261022_060415_brevo_registrations',
  },
  {
    up: migration_20261022_110941_brevo_batch_lists.up,
    down: migration_20261022_110941_brevo_batch_lists.down,
    name: '20261022_110941_brevo_batch_lists',
  },
  {
    up: migration_20261022_115043_brevo_preferences.up,
    down: migration_20261022_115043_brevo_preferences.down,
    name: '20261022_115043_brevo_preferences',
  },
  {
    up: migration_20261022_120651_brevo_campaign_drafts.up,
    down: migration_20261022_120651_brevo_campaign_drafts.down,
    name: '20261022_120651_brevo_campaign_drafts',
  },
  {
    up: migration_20261022_123536_brevo_campaign_sends.up,
    down: migration_20261022_123536_brevo_campaign_sends.down,
    name: '20261022_123536_brevo_campaign_sends'
  },
];

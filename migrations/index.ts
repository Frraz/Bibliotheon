import * as migration_20261021_012104_initial from './20261021_012104_initial';
import * as migration_20261021_013444_catalog from './20261021_013444_catalog';
import * as migration_20261021_104729_public_site from './20261021_104729_public_site';
import * as migration_20261021_121334_relationship from './20261021_121334_relationship';
import * as migration_20261021_155133_relationship_jobs from './20261021_155133_relationship_jobs';
import * as migration_20261021_155500_relationship_invariants from './20261021_155500_relationship_invariants';
import * as migration_20261021_233105_sequences from './20261021_233105_sequences';

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
    name: '20261021_233105_sequences'
  },
];

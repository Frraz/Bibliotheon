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
import * as migration_20261024_064354_brevo_campaign_observations from './20261024_064354_brevo_campaign_observations';
import * as migration_20261024_070440_brevo_webhook_events from './20261024_070440_brevo_webhook_events';
import * as migration_20261024_071409_brevo_send_recipients from './20261024_071409_brevo_send_recipients';
import * as migration_20261024_073316_analytics from './20261024_073316_analytics';
import * as migration_20261024_115633_commercial_inbox from './20261024_115633_commercial_inbox';
import * as migration_20261024_190859_commercial_imports from './20261024_190859_commercial_imports';
import * as migration_20261024_231500_offer_identity_guard from './20261024_231500_offer_identity_guard';
import * as migration_20261025_003403_catalog_resolutions from './20261025_003403_catalog_resolutions';
import * as migration_20261025_014000_commercial_review_lookup from './20261025_014000_commercial_review_lookup';
import * as migration_20261025_031113_financial_resolutions from './20261025_031113_financial_resolutions';
import * as migration_20261025_041432_financial_report_evidence from './20261025_041432_financial_report_evidence';
import * as migration_20261025_051744_report_evidence_csv from './20261025_051744_report_evidence_csv';
import * as migration_20261025_054113_financial_ledger from './20261025_054113_financial_ledger';
import * as migration_20261025_185933_analytics_retention from './20261025_185933_analytics_retention';
import * as migration_20261025_192350_privacy_request_audit from './20261025_192350_privacy_request_audit';
import * as migration_20261025_213716_marketing_suppression_tombstones from './20261025_213716_marketing_suppression_tombstones';
import * as migration_20261025_224500_commercial_inbox_envelope_retention from './20261025_224500_commercial_inbox_envelope_retention';
import * as migration_20261026_231335_contact_retirements from './20261026_231335_contact_retirements';
import * as migration_20261027_001515_theme_withdrawals from './20261027_001515_theme_withdrawals';

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
    name: '20261022_123536_brevo_campaign_sends',
  },
  {
    up: migration_20261024_064354_brevo_campaign_observations.up,
    down: migration_20261024_064354_brevo_campaign_observations.down,
    name: '20261024_064354_brevo_campaign_observations',
  },
  {
    up: migration_20261024_070440_brevo_webhook_events.up,
    down: migration_20261024_070440_brevo_webhook_events.down,
    name: '20261024_070440_brevo_webhook_events',
  },
  {
    up: migration_20261024_071409_brevo_send_recipients.up,
    down: migration_20261024_071409_brevo_send_recipients.down,
    name: '20261024_071409_brevo_send_recipients',
  },
  {
    up: migration_20261024_073316_analytics.up,
    down: migration_20261024_073316_analytics.down,
    name: '20261024_073316_analytics',
  },
  {
    up: migration_20261024_115633_commercial_inbox.up,
    down: migration_20261024_115633_commercial_inbox.down,
    name: '20261024_115633_commercial_inbox',
  },
  {
    up: migration_20261024_190859_commercial_imports.up,
    down: migration_20261024_190859_commercial_imports.down,
    name: '20261024_190859_commercial_imports',
  },
  {
    up: migration_20261024_231500_offer_identity_guard.up,
    down: migration_20261024_231500_offer_identity_guard.down,
    name: '20261024_231500_offer_identity_guard',
  },
  {
    up: migration_20261025_003403_catalog_resolutions.up,
    down: migration_20261025_003403_catalog_resolutions.down,
    name: '20261025_003403_catalog_resolutions',
  },
  {
    up: migration_20261025_014000_commercial_review_lookup.up,
    down: migration_20261025_014000_commercial_review_lookup.down,
    name: '20261025_014000_commercial_review_lookup',
  },
  {
    up: migration_20261025_031113_financial_resolutions.up,
    down: migration_20261025_031113_financial_resolutions.down,
    name: '20261025_031113_financial_resolutions',
  },
  {
    up: migration_20261025_041432_financial_report_evidence.up,
    down: migration_20261025_041432_financial_report_evidence.down,
    name: '20261025_041432_financial_report_evidence',
  },
  {
    up: migration_20261025_051744_report_evidence_csv.up,
    down: migration_20261025_051744_report_evidence_csv.down,
    name: '20261025_051744_report_evidence_csv',
  },
  {
    up: migration_20261025_054113_financial_ledger.up,
    down: migration_20261025_054113_financial_ledger.down,
    name: '20261025_054113_financial_ledger',
  },
  {
    up: migration_20261025_185933_analytics_retention.up,
    down: migration_20261025_185933_analytics_retention.down,
    name: '20261025_185933_analytics_retention',
  },
  {
    up: migration_20261025_192350_privacy_request_audit.up,
    down: migration_20261025_192350_privacy_request_audit.down,
    name: '20261025_192350_privacy_request_audit',
  },
  {
    up: migration_20261025_213716_marketing_suppression_tombstones.up,
    down: migration_20261025_213716_marketing_suppression_tombstones.down,
    name: '20261025_213716_marketing_suppression_tombstones',
  },
  {
    up: migration_20261025_224500_commercial_inbox_envelope_retention.up,
    down: migration_20261025_224500_commercial_inbox_envelope_retention.down,
    name: '20261025_224500_commercial_inbox_envelope_retention',
  },
  {
    up: migration_20261026_231335_contact_retirements.up,
    down: migration_20261026_231335_contact_retirements.down,
    name: '20261026_231335_contact_retirements',
  },
  {
    up: migration_20261027_001515_theme_withdrawals.up,
    down: migration_20261027_001515_theme_withdrawals.down,
    name: '20261027_001515_theme_withdrawals'
  },
];

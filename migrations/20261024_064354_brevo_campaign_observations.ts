import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brevo_campaign_observations_state" AS ENUM('pending', 'processing', 'matched', 'conflict', 'failed');
  CREATE TYPE "public"."enum_brevo_campaign_observations_last_status" AS ENUM('draft', 'sent', 'archive', 'queued', 'suspended', 'in_process', 'in_review', 'cancelling', 'cancelled');
  CREATE TYPE "public"."enum_brevo_campaign_observations_activity_status" AS ENUM('sent', 'queued', 'in_process', 'in_review');
  CREATE TYPE "public"."enum_brevo_campaign_observations_error_code" AS ENUM('provider_unavailable', 'provider_absent', 'provider_rejected', 'campaign_conflict', 'unsupported_status');
  ALTER TYPE "public"."enum_promotion_deliveries_state" ADD VALUE 'observed' BEFORE 'uncertain';
  ALTER TYPE "public"."enum_brevo_campaign_sends_state" ADD VALUE 'observed' BEFORE 'rejected';
  CREATE TABLE "brevo_campaign_observations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"send_id" uuid NOT NULL,
  	"attempt_token" varchar NOT NULL,
  	"lease_token" varchar,
  	"started_at" timestamp(3) with time zone,
  	"next_check_at" timestamp(3) with time zone,
  	"checked_at" timestamp(3) with time zone,
  	"state" "enum_brevo_campaign_observations_state" NOT NULL,
  	"last_status" "enum_brevo_campaign_observations_last_status",
  	"activity_status" "enum_brevo_campaign_observations_activity_status",
  	"activity_observed_at" timestamp(3) with time zone,
  	"sent_observed_at" timestamp(3) with time zone,
  	"provider_sent_at" timestamp(3) with time zone,
  	"error_code" "enum_brevo_campaign_observations_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE brevo_campaign_sends DROP CONSTRAINT brevo_campaign_sends_intent;
  ALTER TABLE brevo_campaign_sends ADD CONSTRAINT brevo_campaign_sends_intent CHECK (state::text NOT IN ('issuing','submitted','rejected','uncertain','observed') OR (attempts > 0 AND draft_id IS NOT NULL AND provider_campaign_id IS NOT NULL AND content_hash IS NOT NULL AND attempt_token IS NOT NULL AND issued_at IS NOT NULL));
  INSERT INTO brevo_campaign_observations (send_id, attempt_token, state, next_check_at)
    SELECT id, attempt_token, 'pending', now() FROM brevo_campaign_sends
    WHERE attempts > 0 AND attempt_token IS NOT NULL AND state::text IN ('issuing','submitted','rejected','uncertain');
  CREATE INDEX brevo_campaign_observations_due_idx ON brevo_campaign_observations(next_check_at) WHERE next_check_at IS NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_campaign_observations_id" uuid;
  ALTER TABLE "brevo_campaign_observations" ADD CONSTRAINT "brevo_campaign_observations_send_id_brevo_campaign_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."brevo_campaign_sends"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "brevo_campaign_observations_send_idx" ON "brevo_campaign_observations" USING btree ("send_id");
  CREATE INDEX "brevo_campaign_observations_updated_at_idx" ON "brevo_campaign_observations" USING btree ("updated_at");
  CREATE INDEX "brevo_campaign_observations_created_at_idx" ON "brevo_campaign_observations" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_campaign_observations_fk" FOREIGN KEY ("brevo_campaign_observations_id") REFERENCES "public"."brevo_campaign_observations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brevo_campaign_observation_idx" ON "payload_locked_documents_rels" USING btree ("brevo_campaign_observations_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM brevo_campaign_observations WHERE checked_at IS NOT NULL OR lease_token IS NOT NULL OR activity_observed_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM brevo_campaign_sends WHERE state::text='observed')
      OR EXISTS (SELECT 1 FROM promotion_deliveries WHERE state::text='observed') THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar observações e atividade de campanhas.';
    END IF;
   END $$;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_campaign_observations_fk";
  DROP TABLE "brevo_campaign_observations";
  ALTER TABLE brevo_campaign_sends DROP CONSTRAINT brevo_campaign_sends_intent;
  DROP INDEX promotion_deliveries_due_idx;
  
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DATA TYPE text;
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DEFAULT 'scheduled'::text;
  DROP TYPE "public"."enum_promotion_deliveries_state";
  CREATE TYPE "public"."enum_promotion_deliveries_state" AS ENUM('scheduled', 'ready', 'sending', 'accepted', 'uncertain', 'rejected', 'canceled');
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DEFAULT 'scheduled'::"public"."enum_promotion_deliveries_state";
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DATA TYPE "public"."enum_promotion_deliveries_state" USING "state"::"public"."enum_promotion_deliveries_state";
  CREATE INDEX promotion_deliveries_due_idx ON promotion_deliveries(next_check_at) WHERE state IN ('scheduled', 'ready');
  ALTER TABLE "brevo_campaign_sends" ALTER COLUMN "state" SET DATA TYPE text;
  DROP TYPE "public"."enum_brevo_campaign_sends_state";
  CREATE TYPE "public"."enum_brevo_campaign_sends_state" AS ENUM('preparing', 'issuing', 'submitted', 'rejected', 'uncertain', 'canceled');
  ALTER TABLE "brevo_campaign_sends" ALTER COLUMN "state" SET DATA TYPE "public"."enum_brevo_campaign_sends_state" USING "state"::"public"."enum_brevo_campaign_sends_state";
  ALTER TABLE brevo_campaign_sends ADD CONSTRAINT brevo_campaign_sends_intent CHECK (state::text NOT IN ('issuing','submitted','rejected','uncertain') OR (attempts > 0 AND draft_id IS NOT NULL AND provider_campaign_id IS NOT NULL AND content_hash IS NOT NULL AND attempt_token IS NOT NULL AND issued_at IS NOT NULL));
  DROP INDEX "payload_locked_documents_rels_brevo_campaign_observation_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_campaign_observations_id";
  DROP TYPE "public"."enum_brevo_campaign_observations_state";
  DROP TYPE "public"."enum_brevo_campaign_observations_last_status";
  DROP TYPE "public"."enum_brevo_campaign_observations_activity_status";
  DROP TYPE "public"."enum_brevo_campaign_observations_error_code";`)
}

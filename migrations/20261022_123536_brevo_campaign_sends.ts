import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brevo_campaign_sends_state" AS ENUM('preparing', 'issuing', 'submitted', 'rejected', 'uncertain', 'canceled');
  CREATE TYPE "public"."enum_brevo_campaign_sends_error_code" AS ENUM('prerequisites', 'quota', 'provider_rejected', 'uncertain_delivery', 'local_ineligible');
  ALTER TYPE "public"."enum_promotion_deliveries_state" ADD VALUE 'rejected' BEFORE 'canceled';
  ALTER TYPE "public"."enum_promotion_deliveries_error_code" ADD VALUE 'provider_rejected';
  ALTER TYPE "public"."enum_promotion_deliveries_error_code" ADD VALUE 'uncertain_delivery';
  ALTER TYPE "public"."enum_email_campaign_batches_state" ADD VALUE 'rejected';
  CREATE TABLE "brevo_campaign_sends" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"batch_id" uuid NOT NULL,
  	"draft_id" uuid,
  	"batch_key" varchar NOT NULL,
  	"content_hash" varchar,
  	"provider_campaign_id" numeric,
  	"recipient_count" numeric NOT NULL,
  	"attempts" numeric NOT NULL,
  	"attempt_token" varchar,
  	"history" jsonb NOT NULL,
  	"state" "enum_brevo_campaign_sends_state" NOT NULL,
  	"lease_token" varchar,
  	"prepare_started_at" timestamp(3) with time zone,
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"error_code" "enum_brevo_campaign_sends_error_code",
  	"issued_at" timestamp(3) with time zone,
  	"settled_at" timestamp(3) with time zone,
  	"retry_requested_at" timestamp(3) with time zone,
  	"response_code" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_campaign_sends_id" uuid;
  ALTER TABLE "brevo_campaign_sends" ADD CONSTRAINT "brevo_campaign_sends_batch_id_email_campaign_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."email_campaign_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brevo_campaign_sends" ADD CONSTRAINT "brevo_campaign_sends_draft_id_brevo_campaign_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."brevo_campaign_drafts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brevo_campaign_sends" ADD CONSTRAINT "brevo_campaign_sends_counts" CHECK (attempts >= 0 AND attempts = trunc(attempts) AND recipient_count BETWEEN 1 AND 200 AND recipient_count = trunc(recipient_count));
  ALTER TABLE "brevo_campaign_sends" ADD CONSTRAINT "brevo_campaign_sends_id" CHECK (provider_campaign_id IS NULL OR provider_campaign_id BETWEEN 1 AND 9007199254740991 AND provider_campaign_id = trunc(provider_campaign_id));
  ALTER TABLE "brevo_campaign_sends" ADD CONSTRAINT "brevo_campaign_sends_intent" CHECK (state::text NOT IN ('issuing','submitted','rejected','uncertain') OR (attempts > 0 AND draft_id IS NOT NULL AND provider_campaign_id IS NOT NULL AND content_hash IS NOT NULL AND attempt_token IS NOT NULL AND issued_at IS NOT NULL));
  CREATE UNIQUE INDEX "brevo_campaign_sends_batch_idx" ON "brevo_campaign_sends" USING btree ("batch_id");
  CREATE UNIQUE INDEX "brevo_campaign_sends_draft_idx" ON "brevo_campaign_sends" USING btree ("draft_id");
  CREATE UNIQUE INDEX "brevo_campaign_sends_provider_campaign_id_idx" ON "brevo_campaign_sends" USING btree ("provider_campaign_id");
  CREATE INDEX "brevo_campaign_sends_updated_at_idx" ON "brevo_campaign_sends" USING btree ("updated_at");
  CREATE INDEX "brevo_campaign_sends_created_at_idx" ON "brevo_campaign_sends" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_campaign_sends_fk" FOREIGN KEY ("brevo_campaign_sends_id") REFERENCES "public"."brevo_campaign_sends"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brevo_campaign_sends_id_idx" ON "payload_locked_documents_rels" USING btree ("brevo_campaign_sends_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM brevo_campaign_sends WHERE attempts > 0 OR issued_at IS NOT NULL OR attempt_token IS NOT NULL OR history <> '[]'::jsonb)
      OR EXISTS (SELECT 1 FROM promotion_deliveries WHERE state::text='rejected' OR error_code::text IN ('provider_rejected','uncertain_delivery'))
      OR EXISTS (SELECT 1 FROM email_campaign_batches WHERE state::text='rejected') THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar tentativas, quota e resultados de disparo.';
    END IF;
   END $$;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_campaign_sends_fk";
  DROP TABLE "brevo_campaign_sends";
  
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DATA TYPE text;
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DEFAULT 'scheduled'::text;
  DROP TYPE "public"."enum_promotion_deliveries_state";
  CREATE TYPE "public"."enum_promotion_deliveries_state" AS ENUM('scheduled', 'ready', 'sending', 'accepted', 'uncertain', 'canceled');
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DEFAULT 'scheduled'::"public"."enum_promotion_deliveries_state";
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "state" SET DATA TYPE "public"."enum_promotion_deliveries_state" USING "state"::"public"."enum_promotion_deliveries_state";
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "error_code" SET DATA TYPE text;
  DROP TYPE "public"."enum_promotion_deliveries_error_code";
  CREATE TYPE "public"."enum_promotion_deliveries_error_code" AS ENUM('recipient_suppressed', 'material_unavailable', 'sequence_paused', 'offer_unavailable');
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "error_code" SET DATA TYPE "public"."enum_promotion_deliveries_error_code" USING "error_code"::"public"."enum_promotion_deliveries_error_code";
  ALTER TABLE "email_campaign_batches" ALTER COLUMN "state" SET DATA TYPE text;
  ALTER TABLE "email_campaign_batches" ALTER COLUMN "state" SET DEFAULT 'prepared'::text;
  DROP TYPE "public"."enum_email_campaign_batches_state";
  CREATE TYPE "public"."enum_email_campaign_batches_state" AS ENUM('prepared', 'claimed', 'canceled', 'uncertain');
  ALTER TABLE "email_campaign_batches" ALTER COLUMN "state" SET DEFAULT 'prepared'::"public"."enum_email_campaign_batches_state";
  ALTER TABLE "email_campaign_batches" ALTER COLUMN "state" SET DATA TYPE "public"."enum_email_campaign_batches_state" USING "state"::"public"."enum_email_campaign_batches_state";
  DROP INDEX "payload_locked_documents_rels_brevo_campaign_sends_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_campaign_sends_id";
  DROP TYPE "public"."enum_brevo_campaign_sends_state";
  DROP TYPE "public"."enum_brevo_campaign_sends_error_code";`)
}

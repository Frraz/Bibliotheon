import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brevo_campaign_drafts_state" AS ENUM('creating', 'ready', 'uncertain', 'failed', 'canceled');
  CREATE TYPE "public"."enum_brevo_campaign_drafts_error_code" AS ENUM('provider_unavailable', 'provider_rejected', 'creation_rejected', 'creation_uncertain', 'campaign_conflict', 'local_ineligible');
  CREATE TABLE "brevo_campaign_drafts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"batch_id" uuid NOT NULL,
  "observed_ids" jsonb NOT NULL,
  	"name" varchar NOT NULL,
  	"content_hash" varchar NOT NULL,
  	"content" jsonb NOT NULL,
  	"provider_campaign_id" numeric,
  	"state" "enum_brevo_campaign_drafts_state" NOT NULL,
  	"lease_token" varchar,
  	"started_at" timestamp(3) with time zone,
  	"creation_issued_at" timestamp(3) with time zone,
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"verified_at" timestamp(3) with time zone,
  	"error_code" "enum_brevo_campaign_drafts_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_campaign_drafts_id" uuid;
  ALTER TABLE "brevo_campaign_drafts" ADD CONSTRAINT "brevo_campaign_drafts_batch_id_email_campaign_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."email_campaign_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brevo_campaign_drafts" ADD CONSTRAINT "brevo_campaign_drafts_positive_id" CHECK (provider_campaign_id IS NULL OR provider_campaign_id >= 1 AND provider_campaign_id <= 9007199254740991 AND provider_campaign_id = trunc(provider_campaign_id));
  CREATE UNIQUE INDEX "brevo_campaign_drafts_batch_idx" ON "brevo_campaign_drafts" USING btree ("batch_id");
  CREATE UNIQUE INDEX "brevo_campaign_drafts_provider_campaign_id_idx" ON "brevo_campaign_drafts" USING btree ("provider_campaign_id");
  CREATE INDEX "brevo_campaign_drafts_updated_at_idx" ON "brevo_campaign_drafts" USING btree ("updated_at");
  CREATE INDEX "brevo_campaign_drafts_created_at_idx" ON "brevo_campaign_drafts" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_campaign_drafts_fk" FOREIGN KEY ("brevo_campaign_drafts_id") REFERENCES "public"."brevo_campaign_drafts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brevo_campaign_drafts_id_idx" ON "payload_locked_documents_rels" USING btree ("brevo_campaign_drafts_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM brevo_campaign_drafts WHERE creation_issued_at IS NOT NULL OR provider_campaign_id IS NOT NULL OR observed_ids <> '[]'::jsonb) THEN
      RAISE EXCEPTION 'Downgrade recusado: intencao ou IDs de campanhas existentes.';
    END IF;
   END $$;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_campaign_drafts_fk";
  DROP TABLE "brevo_campaign_drafts";
  
  DROP INDEX "payload_locked_documents_rels_brevo_campaign_drafts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_campaign_drafts_id";
  DROP TYPE "public"."enum_brevo_campaign_drafts_state";
  DROP TYPE "public"."enum_brevo_campaign_drafts_error_code";`)
}

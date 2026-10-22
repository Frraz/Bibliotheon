import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brevo_batch_lists_state" AS ENUM('creating', 'filling', 'ready', 'uncertain', 'failed', 'canceled');
  CREATE TYPE "public"."enum_brevo_batch_lists_error_code" AS ENUM('provider_unavailable', 'provider_rejected', 'creation_rejected', 'creation_uncertain', 'membership_uncertain', 'membership_unverified', 'list_conflict', 'recipient_suppressed', 'local_ineligible');
  CREATE TABLE "brevo_batch_lists" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"batch_id" uuid NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" numeric NOT NULL CHECK (folder_id > 0 AND folder_id = trunc(folder_id)),
  	"provider_list_id" numeric CHECK (provider_list_id IS NULL OR provider_list_id > 0 AND provider_list_id = trunc(provider_list_id)),
  	"audience_key" varchar NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"attempted_ids" jsonb NOT NULL,
  	"verification" jsonb,
  	"state" "enum_brevo_batch_lists_state" NOT NULL,
  	"lease_token" varchar,
  	"started_at" timestamp(3) with time zone,
  	"creation_issued_at" timestamp(3) with time zone,
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"verified_at" timestamp(3) with time zone,
  	"error_code" "enum_brevo_batch_lists_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_batch_lists_id" uuid;
  ALTER TABLE "brevo_batch_lists" ADD CONSTRAINT "brevo_batch_lists_batch_id_email_campaign_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."email_campaign_batches"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "brevo_batch_lists_batch_idx" ON "brevo_batch_lists" USING btree ("batch_id");
  CREATE UNIQUE INDEX "brevo_batch_lists_provider_list_id_idx" ON "brevo_batch_lists" USING btree ("provider_list_id");
  CREATE INDEX "brevo_batch_lists_updated_at_idx" ON "brevo_batch_lists" USING btree ("updated_at");
  CREATE INDEX "brevo_batch_lists_created_at_idx" ON "brevo_batch_lists" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_batch_lists_fk" FOREIGN KEY ("brevo_batch_lists_id") REFERENCES "public"."brevo_batch_lists"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brevo_batch_lists_id_idx" ON "payload_locked_documents_rels" USING btree ("brevo_batch_lists_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM brevo_batch_lists WHERE creation_issued_at IS NOT NULL OR provider_list_id IS NOT NULL OR jsonb_array_length(attempted_ids) > 0) THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar intenções e IDs de listas externas; prefira correção progressiva.';
    END IF;
  END $$;
  ALTER TABLE "brevo_batch_lists" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_batch_lists_fk";
  
  DROP INDEX "payload_locked_documents_rels_brevo_batch_lists_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_batch_lists_id";
  DROP TABLE "brevo_batch_lists";
  DROP TYPE "public"."enum_brevo_batch_lists_state";
  DROP TYPE "public"."enum_brevo_batch_lists_error_code";`)
}

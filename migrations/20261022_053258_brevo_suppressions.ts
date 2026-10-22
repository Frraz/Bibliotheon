import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brevo_suppressions_state" AS ENUM('pending', 'processing', 'synced', 'failed');
  CREATE TYPE "public"."enum_brevo_suppressions_outcome" AS ENUM('blocked', 'absent');
  CREATE TYPE "public"."enum_brevo_suppressions_error_code" AS ENUM('provider_unavailable', 'provider_rejected');
  CREATE TABLE "brevo_suppressions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"revision" numeric NOT NULL CHECK (revision BETWEEN 1 AND 2147483647 AND revision = trunc(revision)),
  	"state" "enum_brevo_suppressions_state" DEFAULT 'pending' NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL CHECK (attempts >= 0 AND attempts = trunc(attempts)),
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"synced_at" timestamp(3) with time zone,
  	"outcome" "enum_brevo_suppressions_outcome",
  	"error_code" "enum_brevo_suppressions_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_suppressions_id" uuid;
  ALTER TABLE "brevo_suppressions" ADD CONSTRAINT "brevo_suppressions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "brevo_suppressions_contact_idx" ON "brevo_suppressions" USING btree ("contact_id");
  CREATE INDEX "brevo_suppressions_due_idx" ON "brevo_suppressions" USING btree ("state", "next_attempt_at");
  CREATE INDEX "brevo_suppressions_updated_at_idx" ON "brevo_suppressions" USING btree ("updated_at");
  CREATE INDEX "brevo_suppressions_created_at_idx" ON "brevo_suppressions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_suppressions_fk" FOREIGN KEY ("brevo_suppressions_id") REFERENCES "public"."brevo_suppressions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brevo_suppressions_id_idx" ON "payload_locked_documents_rels" USING btree ("brevo_suppressions_id");
  -- Preserve suppression intent already stored before this queue existed. No provider calls.
  INSERT INTO brevo_suppressions (contact_id, revision, state, attempts, next_attempt_at)
    SELECT id, 1, 'pending', 0, now() FROM contacts
    WHERE global_suppressed_at IS NOT NULL OR delivery_state <> 'ok';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "brevo_suppressions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_suppressions_fk";
  
  DROP INDEX "payload_locked_documents_rels_brevo_suppressions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_suppressions_id";
  DROP TABLE "brevo_suppressions";
  DROP TYPE "public"."enum_brevo_suppressions_state";
  DROP TYPE "public"."enum_brevo_suppressions_outcome";
  DROP TYPE "public"."enum_brevo_suppressions_error_code";`)
}

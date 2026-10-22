import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brevo_registrations_state" AS ENUM('pending', 'processing', 'synced', 'failed', 'canceled', 'canceling');
  CREATE TYPE "public"."enum_brevo_registrations_error_code" AS ENUM('provider_unavailable', 'provider_rejected', 'local_ineligible', 'identity_changed');
  CREATE TABLE "brevo_registrations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"revision" numeric NOT NULL CHECK (revision BETWEEN 1 AND 2147483647 AND revision = trunc(revision)),
  	"state" "enum_brevo_registrations_state" DEFAULT 'pending' NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL CHECK (attempts >= 0 AND attempts = trunc(attempts)),
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"synced_at" timestamp(3) with time zone,
  	"contact_version" varchar,
  	"provider_id" numeric,
  	"error_code" "enum_brevo_registrations_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_registrations_id" uuid;
  ALTER TABLE "brevo_registrations" ADD CONSTRAINT "brevo_registrations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "brevo_registrations_contact_idx" ON "brevo_registrations" USING btree ("contact_id");
  CREATE INDEX "brevo_registrations_due_idx" ON "brevo_registrations" USING btree ("state", "next_attempt_at");
  CREATE INDEX "brevo_registrations_updated_at_idx" ON "brevo_registrations" USING btree ("updated_at");
  CREATE INDEX "brevo_registrations_created_at_idx" ON "brevo_registrations" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_registrations_fk" FOREIGN KEY ("brevo_registrations_id") REFERENCES "public"."brevo_registrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brevo_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("brevo_registrations_id");
  INSERT INTO brevo_registrations (contact_id, revision, state, attempts, next_attempt_at)
    SELECT c.id, 1, 'pending', 0, now() FROM contacts c
    WHERE c.confirmed_at IS NOT NULL AND c.global_suppressed_at IS NULL AND c.delivery_state='ok'
      AND EXISTS (SELECT 1 FROM subscriptions s WHERE s.contact_id=c.id AND s.state='subscribed');`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM brevo_registrations WHERE attempts > 0 OR provider_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar tentativas e compensações de cadastro; prefira correção progressiva.';
    END IF;
  END $$;
  ALTER TABLE "brevo_registrations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_registrations_fk";
  
  DROP INDEX "payload_locked_documents_rels_brevo_registrations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_registrations_id";
  DROP TABLE "brevo_registrations";
  DROP TYPE "public"."enum_brevo_registrations_state";
  DROP TYPE "public"."enum_brevo_registrations_error_code";`)
}

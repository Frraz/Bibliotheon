import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_commercial_report_evidence_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TABLE "commercial_report_evidence" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"provider" "enum_commercial_report_evidence_provider" NOT NULL,
  	"account_key" varchar NOT NULL,
  	"external_transaction_id" varchar NOT NULL,
  	"transaction_key" varchar NOT NULL,
  	"transaction_keys" jsonb NOT NULL,
  	"related_transaction_ids" jsonb NOT NULL,
  	"input" jsonb NOT NULL,
  	"envelope" jsonb NOT NULL,
  	"envelope_hash" varchar NOT NULL,
  	"version" varchar NOT NULL,
  	"actor_id" uuid NOT NULL,
  	"recorded_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_report_evidence_id" uuid;
  ALTER TABLE "commercial_report_evidence" ADD CONSTRAINT "commercial_report_evidence_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
  CREATE UNIQUE INDEX "commercial_report_evidence_key_idx" ON "commercial_report_evidence" USING btree ("key");
  CREATE INDEX "commercial_report_evidence_actor_idx" ON "commercial_report_evidence" USING btree ("actor_id");
  CREATE INDEX "commercial_report_evidence_updated_at_idx" ON "commercial_report_evidence" USING btree ("updated_at");
  CREATE INDEX "commercial_report_evidence_created_at_idx" ON "commercial_report_evidence" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_report_evidence_fk" FOREIGN KEY ("commercial_report_evidence_id") REFERENCES "public"."commercial_report_evidence"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_commercial_report_evidence_idx" ON "payload_locked_documents_rels" USING btree ("commercial_report_evidence_id");`)
 await db.execute(sql`
  CREATE INDEX commercial_report_evidence_members_idx ON public.commercial_report_evidence USING gin(transaction_keys);
  ALTER TABLE public.commercial_report_evidence ADD CONSTRAINT commercial_report_evidence_shape CHECK (
   key ~ '^[a-f0-9]{64}$' AND request_hash ~ '^[a-f0-9]{64}$' AND envelope_hash ~ '^[a-f0-9]{64}$' AND transaction_key ~ '^[a-f0-9]{64}$'
   AND version='owner-financial-evidence-v1' AND jsonb_typeof(input)='object' AND jsonb_typeof(envelope)='object'
   AND jsonb_typeof(transaction_keys)='array' AND jsonb_array_length(transaction_keys) BETWEEN 1 AND 10000 AND transaction_keys ? transaction_key
   AND jsonb_typeof(related_transaction_ids)='array' AND jsonb_array_length(related_transaction_ids)=jsonb_array_length(transaction_keys)
  );
  CREATE FUNCTION public.bibliotheon_report_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $guard$ BEGIN RAISE EXCEPTION 'report_evidence_immutable' USING ERRCODE='23514'; END $guard$;
  CREATE TRIGGER commercial_report_evidence_immutable BEFORE UPDATE OR DELETE ON public.commercial_report_evidence FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_report_evidence_immutable();
 `)

}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $guard$ BEGIN
    IF EXISTS(SELECT 1 FROM public.commercial_report_evidence) OR EXISTS(SELECT 1 FROM public.financial_resolutions WHERE snapshot @> '{"receipts":[{"kind":"report"}]}'::jsonb) THEN RAISE EXCEPTION 'report_evidence_downgrade_forbidden' USING ERRCODE='23514'; END IF;
   END $guard$;
   ALTER TABLE public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_commercial_report_evidence_fk;
   DROP INDEX public.payload_locked_documents_rels_commercial_report_evidence_idx;
   ALTER TABLE public.payload_locked_documents_rels DROP COLUMN commercial_report_evidence_id;
   DROP TABLE public.commercial_report_evidence;
   DROP FUNCTION public.bibliotheon_report_evidence_immutable();
   DROP TYPE public.enum_commercial_report_evidence_provider;
  `)
}

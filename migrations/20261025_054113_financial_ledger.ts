import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_commercial_settlement_evidence_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TYPE "public"."enum_commercial_settlement_evidence_direction" AS ENUM('credit', 'debit');
  CREATE TYPE "public"."enum_commercial_settlement_evidence_source_kind" AS ENUM('provider_report', 'manual_reconciliation');
  CREATE TYPE "public"."enum_financial_cost_entries_category" AS ENUM('advertising', 'commission', 'production', 'software', 'operations', 'other');
  CREATE TYPE "public"."enum_financial_cost_entries_classification" AS ENUM('confirmed', 'estimated');
  CREATE TYPE "public"."enum_financial_cost_entries_source_kind" AS ENUM('invoice', 'provider_report', 'manual_reconciliation');
  CREATE TABLE "commercial_settlement_evidence" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"provider" "enum_commercial_settlement_evidence_provider" NOT NULL,
  	"account_key" varchar NOT NULL,
  	"external_transaction_id" varchar NOT NULL,
  	"transaction_key" varchar NOT NULL,
  	"currency" varchar NOT NULL,
  	"direction" "enum_commercial_settlement_evidence_direction" NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"settlement_reference" varchar NOT NULL,
  	"source_kind" "enum_commercial_settlement_evidence_source_kind" NOT NULL,
  	"source_reference" varchar NOT NULL,
  	"record_reference" varchar NOT NULL,
  	"supersedes_id" uuid,
  	"evidence_verified" boolean DEFAULT false NOT NULL,
  	"actor_id" uuid NOT NULL,
  	"settled_at" timestamp(3) with time zone NOT NULL,
  	"recorded_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "financial_cost_entries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"category" "enum_financial_cost_entries_category" NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"currency" varchar NOT NULL,
  	"campaign_id" uuid,
  	"classification" "enum_financial_cost_entries_classification" NOT NULL,
  	"source_kind" "enum_financial_cost_entries_source_kind" NOT NULL,
  	"source_reference" varchar NOT NULL,
  	"record_reference" varchar NOT NULL,
  	"supersedes_id" uuid,
  	"actor_id" uuid NOT NULL,
  	"incurred_at" timestamp(3) with time zone NOT NULL,
  	"recorded_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_settlement_evidence_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "financial_cost_entries_id" uuid;
  ALTER TABLE "commercial_settlement_evidence" ADD CONSTRAINT "commercial_settlement_evidence_supersedes_id_commercial_settlement_evidence_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."commercial_settlement_evidence"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_settlement_evidence" ADD CONSTRAINT "commercial_settlement_evidence_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "financial_cost_entries" ADD CONSTRAINT "financial_cost_entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "financial_cost_entries" ADD CONSTRAINT "financial_cost_entries_supersedes_id_financial_cost_entries_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."financial_cost_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "financial_cost_entries" ADD CONSTRAINT "financial_cost_entries_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
  CREATE UNIQUE INDEX "commercial_settlement_evidence_key_idx" ON "commercial_settlement_evidence" USING btree ("key");
  CREATE UNIQUE INDEX "commercial_settlement_evidence_supersedes_idx" ON "commercial_settlement_evidence" USING btree ("supersedes_id");
  CREATE INDEX "commercial_settlement_evidence_actor_idx" ON "commercial_settlement_evidence" USING btree ("actor_id");
  CREATE INDEX "commercial_settlement_evidence_updated_at_idx" ON "commercial_settlement_evidence" USING btree ("updated_at");
  CREATE INDEX "commercial_settlement_evidence_created_at_idx" ON "commercial_settlement_evidence" USING btree ("created_at");
  CREATE UNIQUE INDEX "financial_cost_entries_key_idx" ON "financial_cost_entries" USING btree ("key");
  CREATE INDEX "financial_cost_entries_campaign_idx" ON "financial_cost_entries" USING btree ("campaign_id");
  CREATE UNIQUE INDEX "financial_cost_entries_supersedes_idx" ON "financial_cost_entries" USING btree ("supersedes_id");
  CREATE INDEX "financial_cost_entries_actor_idx" ON "financial_cost_entries" USING btree ("actor_id");
  CREATE INDEX "financial_cost_entries_updated_at_idx" ON "financial_cost_entries" USING btree ("updated_at");
  CREATE INDEX "financial_cost_entries_created_at_idx" ON "financial_cost_entries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_settlement_evide_fk" FOREIGN KEY ("commercial_settlement_evidence_id") REFERENCES "public"."commercial_settlement_evidence"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_financial_cost_entries_fk" FOREIGN KEY ("financial_cost_entries_id") REFERENCES "public"."financial_cost_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_commercial_settlement_evid_idx" ON "payload_locked_documents_rels" USING btree ("commercial_settlement_evidence_id");
  CREATE INDEX "payload_locked_documents_rels_financial_cost_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("financial_cost_entries_id");
  ALTER TABLE public.commercial_settlement_evidence ADD CONSTRAINT commercial_settlement_evidence_shape CHECK(
    key ~ '^[a-f0-9]{64}$' AND request_hash ~ '^[a-f0-9]{64}$' AND transaction_key ~ '^[a-f0-9]{64}$'
    AND length(account_key) BETWEEN 1 AND 200 AND btrim(account_key)=account_key AND account_key !~ '[[:space:][:cntrl:]@]' AND account_key !~* '^https?://'
    AND length(external_transaction_id) BETWEEN 1 AND 200 AND btrim(external_transaction_id)=external_transaction_id AND external_transaction_id !~ '[[:space:][:cntrl:]@]' AND external_transaction_id !~* '^https?://'
    AND currency ~ '^[A-Z]{3}$' AND amount_cents >= 0 AND amount_cents <= 9007199254740991 AND amount_cents = trunc(amount_cents)
    AND settlement_reference ~ '^[a-z][a-z0-9_-]{2,95}$' AND source_reference ~ '^[a-z][a-z0-9_-]{2,95}$' AND record_reference ~ '^[a-z][a-z0-9_-]{2,95}$'
    AND evidence_verified IS TRUE AND settled_at <= recorded_at + interval '5 minutes'
  );
  ALTER TABLE public.financial_cost_entries ADD CONSTRAINT financial_cost_entries_shape CHECK(
    key ~ '^[a-f0-9]{64}$' AND request_hash ~ '^[a-f0-9]{64}$' AND currency ~ '^[A-Z]{3}$'
    AND amount_cents >= 0 AND amount_cents <= 9007199254740991 AND amount_cents = trunc(amount_cents)
    AND source_reference ~ '^[a-z][a-z0-9_-]{2,95}$' AND record_reference ~ '^[a-z][a-z0-9_-]{2,95}$'
    AND incurred_at <= recorded_at + interval '5 minutes'
  );
  CREATE FUNCTION public.bibliotheon_financial_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $guard$ BEGIN RAISE EXCEPTION 'financial_ledger_immutable' USING ERRCODE='23514'; END $guard$;
  CREATE TRIGGER commercial_settlement_evidence_immutable BEFORE UPDATE OR DELETE ON public.commercial_settlement_evidence FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_ledger_immutable();
  CREATE TRIGGER financial_cost_entries_immutable BEFORE UPDATE OR DELETE ON public.financial_cost_entries FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_ledger_immutable();`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $guard$ BEGIN
    IF EXISTS(SELECT 1 FROM public.commercial_settlement_evidence) OR EXISTS(SELECT 1 FROM public.financial_cost_entries) THEN RAISE EXCEPTION 'financial_ledger_downgrade_forbidden' USING ERRCODE='23514'; END IF;
   END $guard$;
   DROP TRIGGER commercial_settlement_evidence_immutable ON public.commercial_settlement_evidence;
  DROP TRIGGER financial_cost_entries_immutable ON public.financial_cost_entries;
  DROP FUNCTION public.bibliotheon_financial_ledger_immutable();
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_settlement_evide_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_financial_cost_entries_fk";
  
  DROP INDEX "payload_locked_documents_rels_commercial_settlement_evid_idx";
  DROP INDEX "payload_locked_documents_rels_financial_cost_entries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_settlement_evidence_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "financial_cost_entries_id";
  DROP TABLE "commercial_settlement_evidence";
  DROP TABLE "financial_cost_entries";
  DROP TYPE "public"."enum_commercial_settlement_evidence_provider";
  DROP TYPE "public"."enum_commercial_settlement_evidence_direction";
  DROP TYPE "public"."enum_commercial_settlement_evidence_source_kind";
  DROP TYPE "public"."enum_financial_cost_entries_category";
  DROP TYPE "public"."enum_financial_cost_entries_classification";
  DROP TYPE "public"."enum_financial_cost_entries_source_kind";`)
}

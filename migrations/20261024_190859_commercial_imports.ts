import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_commercial_import_batches_source_kind" AS ENUM('provider_report', 'manual_reconciliation');
  CREATE TYPE "public"."enum_commercial_import_batches_reason" AS ENUM('missing_webhook', 'report_reconciliation');
  CREATE TYPE "public"."enum_commercial_import_batches_state" AS ENUM('ready', 'blocked', 'stale', 'queued', 'confirmed');
  CREATE TYPE "public"."enum_commercial_import_rows_classification" AS ENUM('new', 'matched', 'duplicate', 'conflict', 'unknown_catalog', 'ambiguous_catalog', 'needs_review', 'invalid');
  CREATE TYPE "public"."enum_commercial_import_rows_state" AS ENUM('planned', 'matched', 'duplicate', 'blocked', 'queued');
  CREATE TYPE "public"."enum_commercial_import_audit_action" AS ENUM('staged', 'queued', 'confirmed', 'stale', 'duplicate_commit');
  CREATE TABLE "commercial_import_batches" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"file_hash" varchar NOT NULL,
  	"manifest_hash" varchar NOT NULL,
  	"plan_hash" varchar NOT NULL,
  	"source_kind" "enum_commercial_import_batches_source_kind" NOT NULL,
  	"source_reference" varchar NOT NULL,
  	"reason" "enum_commercial_import_batches_reason" NOT NULL,
  	"actor_id" uuid NOT NULL,
  	"state" "enum_commercial_import_batches_state" NOT NULL,
  	"row_count" numeric NOT NULL,
  	"counts" jsonb NOT NULL,
  	"staged_at" timestamp(3) with time zone NOT NULL,
  	"confirmed_at" timestamp(3) with time zone,
  	"confirmed_by_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commercial_import_rows" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"batch_id" uuid NOT NULL,
  	"line" numeric NOT NULL,
  	"row_hash" varchar NOT NULL,
  	"transaction_key" varchar NOT NULL,
  	"normalized" jsonb NOT NULL,
  	"classification" "enum_commercial_import_rows_classification" NOT NULL,
  	"reason" varchar NOT NULL,
  	"duplicate_of" numeric,
  	"state" "enum_commercial_import_rows_state" NOT NULL,
  	"inbox_id" uuid,
  	"transaction_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commercial_import_audit" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"batch_id" uuid NOT NULL,
  	"actor_id" uuid NOT NULL,
  	"action" "enum_commercial_import_audit_action" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"reason" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_import_batches_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_import_rows_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_import_audit_id" uuid;
  ALTER TABLE "commercial_import_batches" ADD CONSTRAINT "commercial_import_batches_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_import_batches" ADD CONSTRAINT "commercial_import_batches_confirmed_by_id_admin_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_import_rows" ADD CONSTRAINT "commercial_import_rows_batch_id_commercial_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."commercial_import_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_import_rows" ADD CONSTRAINT "commercial_import_rows_inbox_id_commercial_inbox_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."commercial_inbox"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_import_rows" ADD CONSTRAINT "commercial_import_rows_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_import_audit" ADD CONSTRAINT "commercial_import_audit_batch_id_commercial_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."commercial_import_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_import_audit" ADD CONSTRAINT "commercial_import_audit_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "commercial_import_batches_key_idx" ON "commercial_import_batches" USING btree ("key");
  CREATE INDEX "commercial_import_batches_actor_idx" ON "commercial_import_batches" USING btree ("actor_id");
  CREATE INDEX "commercial_import_batches_confirmed_by_idx" ON "commercial_import_batches" USING btree ("confirmed_by_id");
  CREATE INDEX "commercial_import_batches_updated_at_idx" ON "commercial_import_batches" USING btree ("updated_at");
  CREATE INDEX "commercial_import_batches_created_at_idx" ON "commercial_import_batches" USING btree ("created_at");
  CREATE UNIQUE INDEX "commercial_import_rows_key_idx" ON "commercial_import_rows" USING btree ("key");
  CREATE INDEX "commercial_import_rows_batch_idx" ON "commercial_import_rows" USING btree ("batch_id");
  CREATE INDEX "commercial_import_rows_inbox_idx" ON "commercial_import_rows" USING btree ("inbox_id");
  CREATE INDEX "commercial_import_rows_transaction_idx" ON "commercial_import_rows" USING btree ("transaction_id");
  CREATE INDEX "commercial_import_rows_updated_at_idx" ON "commercial_import_rows" USING btree ("updated_at");
  CREATE INDEX "commercial_import_rows_created_at_idx" ON "commercial_import_rows" USING btree ("created_at");
  CREATE INDEX "commercial_import_audit_batch_idx" ON "commercial_import_audit" USING btree ("batch_id");
  CREATE INDEX "commercial_import_audit_actor_idx" ON "commercial_import_audit" USING btree ("actor_id");
  CREATE INDEX "commercial_import_audit_updated_at_idx" ON "commercial_import_audit" USING btree ("updated_at");
  CREATE INDEX "commercial_import_audit_created_at_idx" ON "commercial_import_audit" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_import_batches_fk" FOREIGN KEY ("commercial_import_batches_id") REFERENCES "public"."commercial_import_batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_import_rows_fk" FOREIGN KEY ("commercial_import_rows_id") REFERENCES "public"."commercial_import_rows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_import_audit_fk" FOREIGN KEY ("commercial_import_audit_id") REFERENCES "public"."commercial_import_audit"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_commercial_import_batches__idx" ON "payload_locked_documents_rels" USING btree ("commercial_import_batches_id");
  CREATE INDEX "payload_locked_documents_rels_commercial_import_rows_id_idx" ON "payload_locked_documents_rels" USING btree ("commercial_import_rows_id");
  CREATE INDEX "payload_locked_documents_rels_commercial_import_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("commercial_import_audit_id");
  CREATE UNIQUE INDEX commercial_import_rows_batch_line_idx ON commercial_import_rows(batch_id,line);
  ALTER TABLE commercial_import_batches ADD CONSTRAINT commercial_import_batches_row_count CHECK(row_count=trunc(row_count) AND row_count BETWEEN 1 AND 10000);
  ALTER TABLE commercial_import_rows ADD CONSTRAINT commercial_import_rows_line CHECK(line=trunc(line) AND line BETWEEN 2 AND 10001);
  ALTER TABLE commercial_import_batches ADD CONSTRAINT commercial_import_batches_hashes CHECK(key ~ '^[a-f0-9]{64}$' AND request_hash ~ '^[a-f0-9]{64}$' AND file_hash ~ '^[a-f0-9]{64}$' AND manifest_hash ~ '^[a-f0-9]{64}$' AND plan_hash ~ '^[a-f0-9]{64}$');
  ALTER TABLE commercial_import_rows ADD CONSTRAINT commercial_import_rows_hashes CHECK(key ~ '^[a-f0-9]{64}$' AND row_hash ~ '^[a-f0-9]{64}$' AND transaction_key ~ '^[a-f0-9]{64}$');`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
   IF EXISTS(SELECT 1 FROM commercial_import_batches) OR EXISTS(SELECT 1 FROM commercial_import_rows) OR EXISTS(SELECT 1 FROM commercial_import_audit) THEN
    RAISE EXCEPTION 'Conciliação com registros: downgrade recusado para preservar evidência.';
   END IF; END $$;
   ALTER TABLE "commercial_import_batches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "commercial_import_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "commercial_import_audit" DISABLE ROW LEVEL SECURITY;

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_import_batches_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_import_rows_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_import_audit_fk";
  
  DROP TABLE commercial_import_audit;
  DROP TABLE commercial_import_rows;
  DROP TABLE commercial_import_batches;
  DROP INDEX "payload_locked_documents_rels_commercial_import_batches__idx";
  DROP INDEX "payload_locked_documents_rels_commercial_import_rows_id_idx";
  DROP INDEX "payload_locked_documents_rels_commercial_import_audit_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_import_batches_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_import_rows_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_import_audit_id";
  DROP TYPE "public"."enum_commercial_import_batches_source_kind";
  DROP TYPE "public"."enum_commercial_import_batches_reason";
  DROP TYPE "public"."enum_commercial_import_batches_state";
  DROP TYPE "public"."enum_commercial_import_rows_classification";
  DROP TYPE "public"."enum_commercial_import_rows_state";
  DROP TYPE "public"."enum_commercial_import_audit_action";`)
}

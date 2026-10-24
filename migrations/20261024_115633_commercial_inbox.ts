import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_commercial_inbox_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TYPE "public"."enum_commercial_inbox_kind" AS ENUM('event', 'ignored');
  CREATE TYPE "public"."enum_commercial_inbox_state" AS ENUM('pending', 'processing', 'applied', 'ignored', 'needs_review', 'failed');
  CREATE TYPE "public"."enum_transactions_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TYPE "public"."enum_transactions_state" AS ENUM('unknown', 'pending', 'approved', 'refused', 'canceled', 'partially_refunded', 'refunded', 'chargeback');
  CREATE TYPE "public"."enum_transaction_events_outcome" AS ENUM('applied', 'needs_review');
  CREATE TYPE "public"."enum_commercial_audit_actor_type" AS ENUM('receiver', 'worker', 'owner');
  CREATE TYPE "public"."enum_commercial_audit_action" AS ENUM('received', 'ignored', 'conflict', 'applied', 'review', 'failed', 'retry');
  CREATE TABLE "commercial_inbox" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"provider" "enum_commercial_inbox_provider" NOT NULL,
  	"account_key" varchar NOT NULL,
  	"event_key" varchar NOT NULL,
  	"adapter_version" varchar NOT NULL,
  	"envelope_hash" varchar NOT NULL,
  	"envelope" jsonb NOT NULL,
  	"transaction_key" varchar,
  	"kind" "enum_commercial_inbox_kind" NOT NULL,
  	"state" "enum_commercial_inbox_state" NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"processed_at" timestamp(3) with time zone,
  	"last_success_at" timestamp(3) with time zone,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"attempt_base" numeric DEFAULT 0 NOT NULL,
  	"lease_token" varchar,
  	"error_code" varchar,
  	"conflicted" boolean DEFAULT false NOT NULL,
  	"transaction_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commercial_conflicts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"inbox_id" uuid NOT NULL,
  	"envelope_hash" varchar NOT NULL,
  	"adapter_version" varchar NOT NULL,
  	"envelope" jsonb NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "transactions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"provider" "enum_transactions_provider" NOT NULL,
  	"account_key" varchar NOT NULL,
  	"external_transaction_id" varchar NOT NULL,
  	"external_product_id" varchar NOT NULL,
  	"external_offer_id" varchar,
  	"ebook_id" uuid NOT NULL,
  	"offer_id" uuid,
  	"state" "enum_transactions_state" NOT NULL,
  	"currency" varchar NOT NULL,
  	"gross_cents" numeric,
  	"refunded_cents" numeric,
  	"chargeback_cents" numeric,
  	"fees_cents" numeric,
  	"producer_net_cents" numeric,
  	"approved_at" timestamp(3) with time zone,
  	"last_event_at" timestamp(3) with time zone,
  	"last_success_at" timestamp(3) with time zone,
  	"needs_review" boolean DEFAULT false NOT NULL,
  	"review_reason" varchar,
  	"projection" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "transaction_events" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"transaction_id" uuid NOT NULL,
  	"inbox_id" uuid NOT NULL,
  	"envelope" jsonb NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"outcome" "enum_transaction_events_outcome" NOT NULL,
  	"error_code" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commercial_audit" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"inbox_id" uuid NOT NULL,
  	"transaction_id" uuid,
  	"actor_id" uuid,
  	"actor_type" "enum_commercial_audit_actor_type" NOT NULL,
  	"action" "enum_commercial_audit_action" NOT NULL,
  	"reason" varchar,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_inbox_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_conflicts_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transactions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transaction_events_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_audit_id" uuid;
  ALTER TABLE "commercial_inbox" ADD CONSTRAINT "commercial_inbox_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_conflicts" ADD CONSTRAINT "commercial_conflicts_inbox_id_commercial_inbox_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."commercial_inbox"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_inbox_id_commercial_inbox_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."commercial_inbox"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_audit" ADD CONSTRAINT "commercial_audit_inbox_id_commercial_inbox_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."commercial_inbox"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_audit" ADD CONSTRAINT "commercial_audit_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_audit" ADD CONSTRAINT "commercial_audit_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_inbox" ADD CONSTRAINT "commercial_inbox_attempts_safe" CHECK (attempts = trunc(attempts) AND attempts BETWEEN 0 AND 9007199254740991 AND attempt_base = trunc(attempt_base) AND attempt_base BETWEEN 0 AND attempts);
  ALTER TABLE "commercial_inbox" ADD CONSTRAINT "commercial_inbox_hash" CHECK (key ~ '^[a-f0-9]{64}$' AND envelope_hash ~ '^[a-f0-9]{64}$');
  ALTER TABLE "commercial_inbox" ADD CONSTRAINT "commercial_inbox_lease" CHECK (state <> 'processing' OR (lease_token IS NOT NULL AND started_at IS NOT NULL));
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cents_safe" CHECK (
    (gross_cents IS NULL OR (gross_cents = trunc(gross_cents) AND gross_cents BETWEEN 0 AND 9007199254740991)) AND
    (refunded_cents IS NULL OR (refunded_cents = trunc(refunded_cents) AND refunded_cents BETWEEN 0 AND 9007199254740991)) AND
    (chargeback_cents IS NULL OR (chargeback_cents = trunc(chargeback_cents) AND chargeback_cents BETWEEN 0 AND 9007199254740991)) AND
    (fees_cents IS NULL OR (fees_cents = trunc(fees_cents) AND abs(fees_cents) <= 9007199254740991)) AND
    (producer_net_cents IS NULL OR (producer_net_cents = trunc(producer_net_cents) AND abs(producer_net_cents) <= 9007199254740991)));
  CREATE INDEX "commercial_inbox_due_idx" ON "commercial_inbox" (state, next_attempt_at) WHERE conflicted = false;
  CREATE INDEX "commercial_inbox_transaction_key_idx" ON "commercial_inbox" (transaction_key);
  CREATE INDEX "transactions_identity_idx" ON "transactions" (provider, account_key, external_product_id);
  CREATE UNIQUE INDEX "commercial_inbox_key_idx" ON "commercial_inbox" USING btree ("key");
  CREATE INDEX "commercial_inbox_transaction_idx" ON "commercial_inbox" USING btree ("transaction_id");
  CREATE INDEX "commercial_inbox_updated_at_idx" ON "commercial_inbox" USING btree ("updated_at");
  CREATE INDEX "commercial_inbox_created_at_idx" ON "commercial_inbox" USING btree ("created_at");
  CREATE UNIQUE INDEX "commercial_conflicts_key_idx" ON "commercial_conflicts" USING btree ("key");
  CREATE INDEX "commercial_conflicts_inbox_idx" ON "commercial_conflicts" USING btree ("inbox_id");
  CREATE INDEX "commercial_conflicts_updated_at_idx" ON "commercial_conflicts" USING btree ("updated_at");
  CREATE INDEX "commercial_conflicts_created_at_idx" ON "commercial_conflicts" USING btree ("created_at");
  CREATE UNIQUE INDEX "transactions_key_idx" ON "transactions" USING btree ("key");
  CREATE INDEX "transactions_ebook_idx" ON "transactions" USING btree ("ebook_id");
  CREATE INDEX "transactions_offer_idx" ON "transactions" USING btree ("offer_id");
  CREATE INDEX "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  CREATE UNIQUE INDEX "transaction_events_key_idx" ON "transaction_events" USING btree ("key");
  CREATE INDEX "transaction_events_transaction_idx" ON "transaction_events" USING btree ("transaction_id");
  CREATE UNIQUE INDEX "transaction_events_inbox_idx" ON "transaction_events" USING btree ("inbox_id");
  CREATE INDEX "transaction_events_updated_at_idx" ON "transaction_events" USING btree ("updated_at");
  CREATE INDEX "transaction_events_created_at_idx" ON "transaction_events" USING btree ("created_at");
  CREATE INDEX "commercial_audit_inbox_idx" ON "commercial_audit" USING btree ("inbox_id");
  CREATE INDEX "commercial_audit_transaction_idx" ON "commercial_audit" USING btree ("transaction_id");
  CREATE INDEX "commercial_audit_actor_idx" ON "commercial_audit" USING btree ("actor_id");
  CREATE INDEX "commercial_audit_updated_at_idx" ON "commercial_audit" USING btree ("updated_at");
  CREATE INDEX "commercial_audit_created_at_idx" ON "commercial_audit" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_inbox_fk" FOREIGN KEY ("commercial_inbox_id") REFERENCES "public"."commercial_inbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_conflicts_fk" FOREIGN KEY ("commercial_conflicts_id") REFERENCES "public"."commercial_conflicts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transaction_events_fk" FOREIGN KEY ("transaction_events_id") REFERENCES "public"."transaction_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_audit_fk" FOREIGN KEY ("commercial_audit_id") REFERENCES "public"."commercial_audit"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_commercial_inbox_id_idx" ON "payload_locked_documents_rels" USING btree ("commercial_inbox_id");
  CREATE INDEX "payload_locked_documents_rels_commercial_conflicts_id_idx" ON "payload_locked_documents_rels" USING btree ("commercial_conflicts_id");
  CREATE INDEX "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");
  CREATE INDEX "payload_locked_documents_rels_transaction_events_id_idx" ON "payload_locked_documents_rels" USING btree ("transaction_events_id");
  CREATE INDEX "payload_locked_documents_rels_commercial_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("commercial_audit_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM commercial_inbox) OR EXISTS(SELECT 1 FROM commercial_conflicts) OR EXISTS(SELECT 1 FROM transactions) OR EXISTS(SELECT 1 FROM transaction_events) OR EXISTS(SELECT 1 FROM commercial_audit) THEN
      RAISE EXCEPTION 'Downgrade recusado: preserve inbox e histórico comercial.';
    END IF;
   END $$;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_inbox_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_conflicts_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transaction_events_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_audit_fk";
  DROP TABLE "commercial_audit";
  DROP TABLE "transaction_events";
  DROP TABLE "commercial_conflicts";
  DROP TABLE "commercial_inbox";
  DROP TABLE "transactions";
  DROP INDEX "payload_locked_documents_rels_commercial_inbox_id_idx";
  DROP INDEX "payload_locked_documents_rels_commercial_conflicts_id_idx";
  DROP INDEX "payload_locked_documents_rels_transactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_transaction_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_commercial_audit_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_inbox_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_conflicts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "transaction_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_audit_id";
  DROP TYPE "public"."enum_commercial_inbox_provider";
  DROP TYPE "public"."enum_commercial_inbox_kind";
  DROP TYPE "public"."enum_commercial_inbox_state";
  DROP TYPE "public"."enum_transactions_provider";
  DROP TYPE "public"."enum_transactions_state";
  DROP TYPE "public"."enum_transaction_events_outcome";
  DROP TYPE "public"."enum_commercial_audit_actor_type";
  DROP TYPE "public"."enum_commercial_audit_action";`)
}

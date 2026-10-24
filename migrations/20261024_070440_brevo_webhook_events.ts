import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brevo_webhook_events_event" AS ENUM('delivered', 'hard_bounce', 'soft_bounce', 'spam', 'unsubscribe');
  CREATE TYPE "public"."enum_brevo_webhook_events_state" AS ENUM('pending', 'processed', 'quarantined');
  CREATE TYPE "public"."enum_brevo_webhook_events_reason" AS ENUM('unknown_contact', 'identity_changed', 'unknown_campaign', 'recipient_mismatch', 'emission_mismatch');
  CREATE TABLE "brevo_webhook_events" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"recipient_fingerprint" varchar NOT NULL,
  	"contact_id" uuid,
  	"event" "enum_brevo_webhook_events_event" NOT NULL,
  	"provider_campaign_id" numeric NOT NULL,
  	"provider_webhook_id" numeric NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"sent_at" timestamp(3) with time zone NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"processed_at" timestamp(3) with time zone,
  	"state" "enum_brevo_webhook_events_state" NOT NULL,
  	"reason" "enum_brevo_webhook_events_reason",
  	"suppression_applied" boolean DEFAULT false NOT NULL,
  	"delivery_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brevo_delivery_receipts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"delivery_id" uuid NOT NULL,
  	"send_id" uuid NOT NULL,
  	"recipient_fingerprint" varchar NOT NULL,
  	"provider_campaign_id" numeric NOT NULL,
  	"first_observed_at" timestamp(3) with time zone NOT NULL,
  	"delivered_at" timestamp(3) with time zone,
  	"hard_bounced_at" timestamp(3) with time zone,
  	"soft_bounced_at" timestamp(3) with time zone,
  	"spam_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE brevo_webhook_events ADD CONSTRAINT brevo_webhook_events_ids CHECK (provider_campaign_id BETWEEN 1 AND 9007199254740991 AND provider_campaign_id=trunc(provider_campaign_id) AND provider_webhook_id BETWEEN 1 AND 9007199254740991 AND provider_webhook_id=trunc(provider_webhook_id));
  ALTER TABLE brevo_webhook_events ADD CONSTRAINT brevo_webhook_events_time CHECK (sent_at <= occurred_at);
  ALTER TABLE brevo_delivery_receipts ADD CONSTRAINT brevo_delivery_receipts_campaign CHECK (provider_campaign_id BETWEEN 1 AND 9007199254740991 AND provider_campaign_id=trunc(provider_campaign_id));
  CREATE INDEX brevo_webhook_events_quarantine_idx ON brevo_webhook_events(processed_at) WHERE state='quarantined';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_webhook_events_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brevo_delivery_receipts_id" uuid;
  ALTER TABLE "brevo_webhook_events" ADD CONSTRAINT "brevo_webhook_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brevo_webhook_events" ADD CONSTRAINT "brevo_webhook_events_delivery_id_promotion_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."promotion_deliveries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brevo_delivery_receipts" ADD CONSTRAINT "brevo_delivery_receipts_delivery_id_promotion_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."promotion_deliveries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brevo_delivery_receipts" ADD CONSTRAINT "brevo_delivery_receipts_send_id_brevo_campaign_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."brevo_campaign_sends"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "brevo_webhook_events_key_idx" ON "brevo_webhook_events" USING btree ("key");
  CREATE INDEX "brevo_webhook_events_contact_idx" ON "brevo_webhook_events" USING btree ("contact_id");
  CREATE INDEX "brevo_webhook_events_delivery_idx" ON "brevo_webhook_events" USING btree ("delivery_id");
  CREATE INDEX "brevo_webhook_events_updated_at_idx" ON "brevo_webhook_events" USING btree ("updated_at");
  CREATE INDEX "brevo_webhook_events_created_at_idx" ON "brevo_webhook_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "brevo_delivery_receipts_delivery_idx" ON "brevo_delivery_receipts" USING btree ("delivery_id");
  CREATE INDEX "brevo_delivery_receipts_send_idx" ON "brevo_delivery_receipts" USING btree ("send_id");
  CREATE INDEX "brevo_delivery_receipts_updated_at_idx" ON "brevo_delivery_receipts" USING btree ("updated_at");
  CREATE INDEX "brevo_delivery_receipts_created_at_idx" ON "brevo_delivery_receipts" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_webhook_events_fk" FOREIGN KEY ("brevo_webhook_events_id") REFERENCES "public"."brevo_webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brevo_delivery_receipts_fk" FOREIGN KEY ("brevo_delivery_receipts_id") REFERENCES "public"."brevo_delivery_receipts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brevo_webhook_events_id_idx" ON "payload_locked_documents_rels" USING btree ("brevo_webhook_events_id");
  CREATE INDEX "payload_locked_documents_rels_brevo_delivery_receipts_id_idx" ON "payload_locked_documents_rels" USING btree ("brevo_delivery_receipts_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM brevo_webhook_events) OR EXISTS (SELECT 1 FROM brevo_delivery_receipts) THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar eventos autenticados e resultados por destinatário.';
    END IF;
   END $$;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_webhook_events_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brevo_delivery_receipts_fk";
  DROP TABLE "brevo_webhook_events";
  DROP TABLE "brevo_delivery_receipts";
  DROP INDEX "payload_locked_documents_rels_brevo_webhook_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_brevo_delivery_receipts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_webhook_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brevo_delivery_receipts_id";
  DROP TYPE "public"."enum_brevo_webhook_events_event";
  DROP TYPE "public"."enum_brevo_webhook_events_state";
  DROP TYPE "public"."enum_brevo_webhook_events_reason";`)
}

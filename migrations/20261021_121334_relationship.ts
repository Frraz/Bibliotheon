import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contacts_delivery_state" AS ENUM('ok', 'bounced', 'complaint');
  CREATE TYPE "public"."enum_subscriptions_state" AS ENUM('pending', 'subscribed', 'unsubscribed');
  CREATE TYPE "public"."enum_consent_events_purpose" AS ENUM('sample', 'marketing');
  CREATE TYPE "public"."enum_consent_events_action" AS ENUM('requested', 'confirmed', 'subscribed', 'unsubscribed', 'bounced', 'complaint');
  CREATE TYPE "public"."enum_email_deliveries_kind" AS ENUM('confirmation', 'delivery');
  CREATE TYPE "public"."enum_email_deliveries_state" AS ENUM('pending', 'sending', 'sent', 'uncertain', 'failed', 'canceled');
  CREATE TYPE "public"."enum_email_deliveries_error_code" AS ENUM('transport_disabled', 'quota', 'provider_rejected', 'uncertain_delivery', 'attempts_exhausted', 'recipient_suppressed', 'material_unavailable');
  CREATE TABLE "contacts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"email" varchar NOT NULL,
  	"confirmed_at" timestamp(3) with time zone,
  	"global_suppressed_at" timestamp(3) with time zone,
  	"delivery_state" "enum_contacts_delivery_state" DEFAULT 'ok' NOT NULL,
  	"unsubscribe_token_hash" varchar,
  	"unsubscribe_expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscriptions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"theme_id" uuid NOT NULL,
  	"key" varchar NOT NULL,
  	"state" "enum_subscriptions_state" NOT NULL,
  	"consent_version" varchar,
  	"subscribed_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consent_events" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"theme_id" uuid,
  	"purpose" "enum_consent_events_purpose" NOT NULL,
  	"action" "enum_consent_events_action" NOT NULL,
  	"version" varchar,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "magnet_requests" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"magnet_id" uuid NOT NULL,
  	"theme_id" uuid NOT NULL,
  	"magnet_version" varchar NOT NULL,
  	"marketing_opt_in" boolean DEFAULT false NOT NULL,
  	"consent_version" varchar,
  	"campaign_code" varchar,
  	"confirmation_token_hash" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"confirmed_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_deliveries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"request_id" uuid NOT NULL,
  	"kind" "enum_email_deliveries_kind" NOT NULL,
  	"state" "enum_email_deliveries_state" DEFAULT 'pending' NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"provider_message_id" varchar,
  	"error_code" "enum_email_deliveries_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mail_quota" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"day" varchar NOT NULL,
  	"reserved" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "request_limits" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"count" numeric DEFAULT 0 NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contacts_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriptions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_events_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "magnet_requests_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_deliveries_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mail_quota_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "request_limits_id" uuid;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "magnet_requests" ADD CONSTRAINT "magnet_requests_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "magnet_requests" ADD CONSTRAINT "magnet_requests_magnet_id_lead_magnets_id_fk" FOREIGN KEY ("magnet_id") REFERENCES "public"."lead_magnets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "magnet_requests" ADD CONSTRAINT "magnet_requests_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_request_id_magnet_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."magnet_requests"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");
  CREATE INDEX "contacts_updated_at_idx" ON "contacts" USING btree ("updated_at");
  CREATE INDEX "contacts_created_at_idx" ON "contacts" USING btree ("created_at");
  CREATE INDEX "subscriptions_contact_idx" ON "subscriptions" USING btree ("contact_id");
  CREATE INDEX "subscriptions_theme_idx" ON "subscriptions" USING btree ("theme_id");
  CREATE UNIQUE INDEX "subscriptions_key_idx" ON "subscriptions" USING btree ("key");
  CREATE INDEX "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX "consent_events_contact_idx" ON "consent_events" USING btree ("contact_id");
  CREATE INDEX "consent_events_theme_idx" ON "consent_events" USING btree ("theme_id");
  CREATE UNIQUE INDEX "consent_events_key_idx" ON "consent_events" USING btree ("key");
  CREATE INDEX "consent_events_updated_at_idx" ON "consent_events" USING btree ("updated_at");
  CREATE INDEX "consent_events_created_at_idx" ON "consent_events" USING btree ("created_at");
  CREATE INDEX "magnet_requests_contact_idx" ON "magnet_requests" USING btree ("contact_id");
  CREATE INDEX "magnet_requests_magnet_idx" ON "magnet_requests" USING btree ("magnet_id");
  CREATE INDEX "magnet_requests_theme_idx" ON "magnet_requests" USING btree ("theme_id");
  CREATE UNIQUE INDEX "magnet_requests_confirmation_token_hash_idx" ON "magnet_requests" USING btree ("confirmation_token_hash");
  CREATE INDEX "magnet_requests_updated_at_idx" ON "magnet_requests" USING btree ("updated_at");
  CREATE INDEX "magnet_requests_created_at_idx" ON "magnet_requests" USING btree ("created_at");
  CREATE UNIQUE INDEX "email_deliveries_key_idx" ON "email_deliveries" USING btree ("key");
  CREATE INDEX "email_deliveries_contact_idx" ON "email_deliveries" USING btree ("contact_id");
  CREATE INDEX "email_deliveries_request_idx" ON "email_deliveries" USING btree ("request_id");
  CREATE INDEX "email_deliveries_updated_at_idx" ON "email_deliveries" USING btree ("updated_at");
  CREATE INDEX "email_deliveries_created_at_idx" ON "email_deliveries" USING btree ("created_at");
  CREATE UNIQUE INDEX "mail_quota_day_idx" ON "mail_quota" USING btree ("day");
  CREATE INDEX "mail_quota_updated_at_idx" ON "mail_quota" USING btree ("updated_at");
  CREATE INDEX "mail_quota_created_at_idx" ON "mail_quota" USING btree ("created_at");
  CREATE UNIQUE INDEX "request_limits_key_idx" ON "request_limits" USING btree ("key");
  CREATE INDEX "request_limits_updated_at_idx" ON "request_limits" USING btree ("updated_at");
  CREATE INDEX "request_limits_created_at_idx" ON "request_limits" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contacts_fk" FOREIGN KEY ("contacts_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_events_fk" FOREIGN KEY ("consent_events_id") REFERENCES "public"."consent_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_magnet_requests_fk" FOREIGN KEY ("magnet_requests_id") REFERENCES "public"."magnet_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_deliveries_fk" FOREIGN KEY ("email_deliveries_id") REFERENCES "public"."email_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mail_quota_fk" FOREIGN KEY ("mail_quota_id") REFERENCES "public"."mail_quota"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_request_limits_fk" FOREIGN KEY ("request_limits_id") REFERENCES "public"."request_limits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("contacts_id");
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_consent_events_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_events_id");
  CREATE INDEX "payload_locked_documents_rels_magnet_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("magnet_requests_id");
  CREATE INDEX "payload_locked_documents_rels_email_deliveries_id_idx" ON "payload_locked_documents_rels" USING btree ("email_deliveries_id");
  CREATE INDEX "payload_locked_documents_rels_mail_quota_id_idx" ON "payload_locked_documents_rels" USING btree ("mail_quota_id");
  CREATE INDEX "payload_locked_documents_rels_request_limits_id_idx" ON "payload_locked_documents_rels" USING btree ("request_limits_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "contacts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "magnet_requests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "email_deliveries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mail_quota" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "request_limits" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contacts" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "consent_events" CASCADE;
  DROP TABLE "magnet_requests" CASCADE;
  DROP TABLE "email_deliveries" CASCADE;
  DROP TABLE "mail_quota" CASCADE;
  DROP TABLE "request_limits" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contacts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscriptions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_magnet_requests_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_email_deliveries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mail_quota_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_request_limits_fk";
  
  DROP INDEX "payload_locked_documents_rels_contacts_id_idx";
  DROP INDEX "payload_locked_documents_rels_subscriptions_id_idx";
  DROP INDEX "payload_locked_documents_rels_consent_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_magnet_requests_id_idx";
  DROP INDEX "payload_locked_documents_rels_email_deliveries_id_idx";
  DROP INDEX "payload_locked_documents_rels_mail_quota_id_idx";
  DROP INDEX "payload_locked_documents_rels_request_limits_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contacts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "magnet_requests_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "email_deliveries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mail_quota_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "request_limits_id";
  DROP TYPE "public"."enum_contacts_delivery_state";
  DROP TYPE "public"."enum_subscriptions_state";
  DROP TYPE "public"."enum_consent_events_purpose";
  DROP TYPE "public"."enum_consent_events_action";
  DROP TYPE "public"."enum_email_deliveries_kind";
  DROP TYPE "public"."enum_email_deliveries_state";
  DROP TYPE "public"."enum_email_deliveries_error_code";`)
}

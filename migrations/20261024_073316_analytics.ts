import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_checkout_clicks_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TABLE "analytics_grants" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"consent_version" varchar NOT NULL,
  	"granted_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"revoked_at" timestamp(3) with time zone,
  	"current_visit_id" uuid,
  	"first_touch" jsonb,
  	"last_non_direct_touch" jsonb,
  	"attribution_expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "visits" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"grant_id" uuid NOT NULL,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"last_seen_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"first_touch" jsonb,
  	"last_non_direct_touch" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "page_views" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"visit_id" uuid NOT NULL,
  	"page_path" varchar NOT NULL,
  	"ebook_id" uuid,
  	"campaign_id" uuid,
  	"utms" jsonb,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "checkout_clicks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"offer_id" uuid NOT NULL,
  	"ebook_id" uuid NOT NULL,
  	"campaign_id" uuid,
  	"provider" "enum_checkout_clicks_provider" NOT NULL,
  	"visit_id" uuid,
  	"attribution_allowed" boolean DEFAULT false NOT NULL,
  	"first_touch" jsonb,
  	"last_non_direct_touch" jsonb,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "analytics_limits" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"count" numeric NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE analytics_grants ADD CONSTRAINT analytics_grants_time CHECK (expires_at > granted_at AND (revoked_at IS NULL OR revoked_at >= granted_at));
  ALTER TABLE visits ADD CONSTRAINT visits_time CHECK (started_at <= last_seen_at AND last_seen_at < expires_at);
  ALTER TABLE checkout_clicks ADD CONSTRAINT checkout_clicks_consent CHECK ((attribution_allowed AND visit_id IS NOT NULL) OR (NOT attribution_allowed AND visit_id IS NULL AND first_touch IS NULL AND last_non_direct_touch IS NULL));
  CREATE INDEX page_views_time_idx ON page_views(occurred_at);
  CREATE INDEX checkout_clicks_time_idx ON checkout_clicks(occurred_at);
  CREATE INDEX visits_time_idx ON visits(started_at);
  CREATE INDEX analytics_grants_expiry_idx ON analytics_grants(expires_at);
  CREATE INDEX analytics_limits_expiry_idx ON analytics_limits(expires_at);
  ALTER TABLE "campaigns" ADD COLUMN "utm_term" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_grants_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "visits_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "page_views_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "checkout_clicks_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_limits_id" uuid;
  ALTER TABLE "analytics_grants" ADD CONSTRAINT "analytics_grants_current_visit_id_visits_id_fk" FOREIGN KEY ("current_visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "visits" ADD CONSTRAINT "visits_grant_id_analytics_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."analytics_grants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_views" ADD CONSTRAINT "page_views_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_views" ADD CONSTRAINT "page_views_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_views" ADD CONSTRAINT "page_views_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkout_clicks" ADD CONSTRAINT "checkout_clicks_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkout_clicks" ADD CONSTRAINT "checkout_clicks_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkout_clicks" ADD CONSTRAINT "checkout_clicks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkout_clicks" ADD CONSTRAINT "checkout_clicks_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "analytics_grants_token_hash_idx" ON "analytics_grants" USING btree ("token_hash");
  CREATE INDEX "analytics_grants_current_visit_idx" ON "analytics_grants" USING btree ("current_visit_id");
  CREATE INDEX "analytics_grants_updated_at_idx" ON "analytics_grants" USING btree ("updated_at");
  CREATE INDEX "analytics_grants_created_at_idx" ON "analytics_grants" USING btree ("created_at");
  CREATE INDEX "visits_grant_idx" ON "visits" USING btree ("grant_id");
  CREATE INDEX "visits_updated_at_idx" ON "visits" USING btree ("updated_at");
  CREATE INDEX "visits_created_at_idx" ON "visits" USING btree ("created_at");
  CREATE UNIQUE INDEX "page_views_key_idx" ON "page_views" USING btree ("key");
  CREATE INDEX "page_views_visit_idx" ON "page_views" USING btree ("visit_id");
  CREATE INDEX "page_views_ebook_idx" ON "page_views" USING btree ("ebook_id");
  CREATE INDEX "page_views_campaign_idx" ON "page_views" USING btree ("campaign_id");
  CREATE INDEX "page_views_updated_at_idx" ON "page_views" USING btree ("updated_at");
  CREATE INDEX "page_views_created_at_idx" ON "page_views" USING btree ("created_at");
  CREATE INDEX "checkout_clicks_offer_idx" ON "checkout_clicks" USING btree ("offer_id");
  CREATE INDEX "checkout_clicks_ebook_idx" ON "checkout_clicks" USING btree ("ebook_id");
  CREATE INDEX "checkout_clicks_campaign_idx" ON "checkout_clicks" USING btree ("campaign_id");
  CREATE INDEX "checkout_clicks_visit_idx" ON "checkout_clicks" USING btree ("visit_id");
  CREATE INDEX "checkout_clicks_updated_at_idx" ON "checkout_clicks" USING btree ("updated_at");
  CREATE INDEX "checkout_clicks_created_at_idx" ON "checkout_clicks" USING btree ("created_at");
  CREATE UNIQUE INDEX "analytics_limits_key_idx" ON "analytics_limits" USING btree ("key");
  CREATE INDEX "analytics_limits_updated_at_idx" ON "analytics_limits" USING btree ("updated_at");
  CREATE INDEX "analytics_limits_created_at_idx" ON "analytics_limits" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_grants_fk" FOREIGN KEY ("analytics_grants_id") REFERENCES "public"."analytics_grants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_visits_fk" FOREIGN KEY ("visits_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_views_fk" FOREIGN KEY ("page_views_id") REFERENCES "public"."page_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_checkout_clicks_fk" FOREIGN KEY ("checkout_clicks_id") REFERENCES "public"."checkout_clicks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_limits_fk" FOREIGN KEY ("analytics_limits_id") REFERENCES "public"."analytics_limits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_analytics_grants_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_grants_id");
  CREATE INDEX "payload_locked_documents_rels_visits_id_idx" ON "payload_locked_documents_rels" USING btree ("visits_id");
  CREATE INDEX "payload_locked_documents_rels_page_views_id_idx" ON "payload_locked_documents_rels" USING btree ("page_views_id");
  CREATE INDEX "payload_locked_documents_rels_checkout_clicks_id_idx" ON "payload_locked_documents_rels" USING btree ("checkout_clicks_id");
  CREATE INDEX "payload_locked_documents_rels_analytics_limits_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_limits_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM analytics_grants) OR EXISTS (SELECT 1 FROM visits) OR EXISTS (SELECT 1 FROM page_views) OR EXISTS (SELECT 1 FROM checkout_clicks) OR EXISTS (SELECT 1 FROM analytics_limits) OR EXISTS (SELECT 1 FROM campaigns WHERE utm_term IS NOT NULL AND utm_term <> '') THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar consentimentos e medição registrada.';
    END IF;
   END $$;
  ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_analytics_grants_fk;
  ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_visits_fk;
  ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_page_views_fk;
  ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_checkout_clicks_fk;
  ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_analytics_limits_fk;
  ALTER TABLE analytics_grants DROP CONSTRAINT analytics_grants_current_visit_id_visits_id_fk;
  DROP TABLE page_views;
  DROP TABLE checkout_clicks;
  DROP TABLE visits;
  DROP TABLE analytics_grants;
  DROP TABLE analytics_limits;
  DROP INDEX "payload_locked_documents_rels_analytics_grants_id_idx";
  DROP INDEX "payload_locked_documents_rels_visits_id_idx";
  DROP INDEX "payload_locked_documents_rels_page_views_id_idx";
  DROP INDEX "payload_locked_documents_rels_checkout_clicks_id_idx";
  DROP INDEX "payload_locked_documents_rels_analytics_limits_id_idx";
  ALTER TABLE "campaigns" DROP COLUMN "utm_term";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "analytics_grants_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "visits_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "page_views_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "checkout_clicks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "analytics_limits_id";
  DROP TYPE "public"."enum_checkout_clicks_provider";`)
}

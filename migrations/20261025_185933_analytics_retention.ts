import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_analytics_daily_aggregates_kind" AS ENUM('page_view', 'checkout_click');
  CREATE TYPE "public"."enum_analytics_daily_aggregates_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TABLE "analytics_daily_aggregates" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"day" timestamp(3) with time zone NOT NULL,
  	"kind" "enum_analytics_daily_aggregates_kind" NOT NULL,
  	"ebook_id" uuid,
  	"campaign_id" uuid,
  	"provider" "enum_analytics_daily_aggregates_provider",
  	"page_path" varchar,
  	"count" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_daily_aggregates_id" uuid;
  ALTER TABLE "analytics_daily_aggregates" ADD CONSTRAINT "analytics_daily_aggregates_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "analytics_daily_aggregates" ADD CONSTRAINT "analytics_daily_aggregates_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "analytics_daily_aggregates_key_idx" ON "analytics_daily_aggregates" USING btree ("key");
  CREATE INDEX "analytics_daily_aggregates_day_idx" ON "analytics_daily_aggregates" USING btree ("day");
  CREATE INDEX "analytics_daily_aggregates_ebook_idx" ON "analytics_daily_aggregates" USING btree ("ebook_id");
  CREATE INDEX "analytics_daily_aggregates_campaign_idx" ON "analytics_daily_aggregates" USING btree ("campaign_id");
  CREATE INDEX "analytics_daily_aggregates_updated_at_idx" ON "analytics_daily_aggregates" USING btree ("updated_at");
  CREATE INDEX "analytics_daily_aggregates_created_at_idx" ON "analytics_daily_aggregates" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_daily_aggregates_fk" FOREIGN KEY ("analytics_daily_aggregates_id") REFERENCES "public"."analytics_daily_aggregates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_analytics_daily_aggregates_idx" ON "payload_locked_documents_rels" USING btree ("analytics_daily_aggregates_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM analytics_daily_aggregates) THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar agregados históricos de medição.';
    END IF;
   END $$;
   ALTER TABLE "analytics_daily_aggregates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "analytics_daily_aggregates" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_analytics_daily_aggregates_fk";
  
  DROP INDEX "payload_locked_documents_rels_analytics_daily_aggregates_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "analytics_daily_aggregates_id";
  DROP TYPE "public"."enum_analytics_daily_aggregates_kind";
  DROP TYPE "public"."enum_analytics_daily_aggregates_provider";`)
}

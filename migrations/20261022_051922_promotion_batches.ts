import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_email_campaign_batches_stage" AS ENUM('2', '4', '7', '10');
  CREATE TYPE "public"."enum_email_campaign_batches_state" AS ENUM('prepared', 'claimed', 'canceled', 'uncertain');
  CREATE TYPE "public"."enum_email_campaign_batches_error_code" AS ENUM('quota', 'eligibility_changed', 'uncertain_delivery');
  CREATE TABLE "email_campaign_batches" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"group_key" varchar NOT NULL,
  	"theme_id" uuid NOT NULL,
  	"stage" "enum_email_campaign_batches_stage" NOT NULL,
  	"day" varchar NOT NULL,
  	"copy" jsonb NOT NULL,
  	"members" jsonb NOT NULL,
  	"recipient_count" numeric NOT NULL CHECK (recipient_count BETWEEN 1 AND 200 AND recipient_count = trunc(recipient_count)),
  	"state" "enum_email_campaign_batches_state" DEFAULT 'prepared' NOT NULL,
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"claimed_at" timestamp(3) with time zone,
  	"canceled_at" timestamp(3) with time zone,
  	"error_code" "enum_email_campaign_batches_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "promotion_deliveries" ADD COLUMN "batch_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_campaign_batches_id" uuid;
  ALTER TABLE "email_campaign_batches" ADD CONSTRAINT "email_campaign_batches_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "email_campaign_batches_key_idx" ON "email_campaign_batches" USING btree ("key");
  CREATE INDEX "email_campaign_batches_theme_idx" ON "email_campaign_batches" USING btree ("theme_id");
  CREATE INDEX "email_campaign_batches_updated_at_idx" ON "email_campaign_batches" USING btree ("updated_at");
  CREATE INDEX "email_campaign_batches_created_at_idx" ON "email_campaign_batches" USING btree ("created_at");
  ALTER TABLE "promotion_deliveries" ADD CONSTRAINT "promotion_deliveries_batch_id_email_campaign_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."email_campaign_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_campaign_batches_fk" FOREIGN KEY ("email_campaign_batches_id") REFERENCES "public"."email_campaign_batches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "promotion_deliveries_batch_idx" ON "promotion_deliveries" USING btree ("batch_id");
  CREATE INDEX "payload_locked_documents_rels_email_campaign_batches_id_idx" ON "payload_locked_documents_rels" USING btree ("email_campaign_batches_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_campaign_batches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promotion_deliveries" DROP CONSTRAINT "promotion_deliveries_batch_id_email_campaign_batches_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_email_campaign_batches_fk";
  
  DROP INDEX "promotion_deliveries_batch_idx";
  DROP INDEX "payload_locked_documents_rels_email_campaign_batches_id_idx";
  ALTER TABLE "promotion_deliveries" DROP COLUMN "batch_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "email_campaign_batches_id";
  DROP TABLE "email_campaign_batches";
  DROP TYPE "public"."enum_email_campaign_batches_stage";
  DROP TYPE "public"."enum_email_campaign_batches_state";
  DROP TYPE "public"."enum_email_campaign_batches_error_code";`)
}

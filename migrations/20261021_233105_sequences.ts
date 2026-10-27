import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sequence_enrollments_state" AS ENUM('active', 'canceled', 'completed');
  CREATE TYPE "public"."enum_promotion_deliveries_stage" AS ENUM('2', '4', '7', '10');
  CREATE TYPE "public"."enum_promotion_deliveries_state" AS ENUM('scheduled', 'ready', 'sending', 'accepted', 'uncertain', 'canceled');
  CREATE TYPE "public"."enum_promotion_deliveries_error_code" AS ENUM('recipient_suppressed', 'material_unavailable', 'sequence_paused', 'offer_unavailable');
  CREATE TABLE "email_sequences" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"magnet_id" uuid NOT NULL,
  	"magnet_version" varchar NOT NULL,
  	"revision" numeric DEFAULT 1 NOT NULL,
  	"offer_id" uuid,
  	"day2_subject" varchar,
  	"day2_text" varchar,
  	"day4_subject" varchar,
  	"day4_text" varchar,
  	"day7_subject" varchar,
  	"day7_text" varchar,
  	"day10_subject" varchar,
  	"day10_text" varchar,
  	"active" boolean DEFAULT false,
  	"key" varchar NOT NULL,
  	"content_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sequence_enrollments" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"request_id" uuid NOT NULL,
  	"magnet_id" uuid NOT NULL,
  	"theme_id" uuid NOT NULL,
  	"sequence_id" uuid NOT NULL,
  	"magnet_version" varchar NOT NULL,
  	"confirmed_at" timestamp(3) with time zone NOT NULL,
  	"state" "enum_sequence_enrollments_state" DEFAULT 'active' NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"canceled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promotion_deliveries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"enrollment_id" uuid NOT NULL,
  	"contact_id" uuid NOT NULL,
  	"stage" "enum_promotion_deliveries_stage" NOT NULL,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"next_check_at" timestamp(3) with time zone NOT NULL,
  	"state" "enum_promotion_deliveries_state" DEFAULT 'scheduled' NOT NULL,
  	"error_code" "enum_promotion_deliveries_error_code",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_sequences_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sequence_enrollments_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "promotion_deliveries_id" uuid;
  ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_magnet_id_lead_magnets_id_fk" FOREIGN KEY ("magnet_id") REFERENCES "public"."lead_magnets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_request_id_magnet_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."magnet_requests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_magnet_id_lead_magnets_id_fk" FOREIGN KEY ("magnet_id") REFERENCES "public"."lead_magnets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_deliveries" ADD CONSTRAINT "promotion_deliveries_enrollment_id_sequence_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."sequence_enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_deliveries" ADD CONSTRAINT "promotion_deliveries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "email_sequences_magnet_idx" ON "email_sequences" USING btree ("magnet_id");
  CREATE INDEX "email_sequences_offer_idx" ON "email_sequences" USING btree ("offer_id");
  CREATE UNIQUE INDEX "email_sequences_key_idx" ON "email_sequences" USING btree ("key");
  CREATE INDEX "email_sequences_updated_at_idx" ON "email_sequences" USING btree ("updated_at");
  CREATE INDEX "email_sequences_created_at_idx" ON "email_sequences" USING btree ("created_at");
  CREATE UNIQUE INDEX "sequence_enrollments_key_idx" ON "sequence_enrollments" USING btree ("key");
  CREATE INDEX "sequence_enrollments_contact_idx" ON "sequence_enrollments" USING btree ("contact_id");
  CREATE INDEX "sequence_enrollments_request_idx" ON "sequence_enrollments" USING btree ("request_id");
  CREATE INDEX "sequence_enrollments_magnet_idx" ON "sequence_enrollments" USING btree ("magnet_id");
  CREATE INDEX "sequence_enrollments_theme_idx" ON "sequence_enrollments" USING btree ("theme_id");
  CREATE INDEX "sequence_enrollments_sequence_idx" ON "sequence_enrollments" USING btree ("sequence_id");
  CREATE INDEX "sequence_enrollments_updated_at_idx" ON "sequence_enrollments" USING btree ("updated_at");
  CREATE INDEX "sequence_enrollments_created_at_idx" ON "sequence_enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "promotion_deliveries_key_idx" ON "promotion_deliveries" USING btree ("key");
  CREATE INDEX "promotion_deliveries_enrollment_idx" ON "promotion_deliveries" USING btree ("enrollment_id");
  CREATE INDEX "promotion_deliveries_contact_idx" ON "promotion_deliveries" USING btree ("contact_id");
  CREATE INDEX "promotion_deliveries_updated_at_idx" ON "promotion_deliveries" USING btree ("updated_at");
  CREATE INDEX "promotion_deliveries_created_at_idx" ON "promotion_deliveries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_sequences_fk" FOREIGN KEY ("email_sequences_id") REFERENCES "public"."email_sequences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sequence_enrollments_fk" FOREIGN KEY ("sequence_enrollments_id") REFERENCES "public"."sequence_enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotion_deliveries_fk" FOREIGN KEY ("promotion_deliveries_id") REFERENCES "public"."promotion_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_email_sequences_id_idx" ON "payload_locked_documents_rels" USING btree ("email_sequences_id");
  CREATE INDEX "payload_locked_documents_rels_sequence_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("sequence_enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_promotion_deliveries_id_idx" ON "payload_locked_documents_rels" USING btree ("promotion_deliveries_id");
  ALTER TABLE email_sequences ADD CONSTRAINT email_sequences_material_unique UNIQUE(magnet_id, magnet_version);
  ALTER TABLE email_sequences ADD CONSTRAINT email_sequences_revision_integer CHECK(revision >= 1 AND revision <= 2147483647 AND revision = trunc(revision));
  ALTER TABLE sequence_enrollments ADD CONSTRAINT sequence_enrollments_material_unique UNIQUE(contact_id, magnet_id, magnet_version);
  ALTER TABLE promotion_deliveries ADD CONSTRAINT promotion_deliveries_stage_unique UNIQUE(enrollment_id, stage);
  ALTER TABLE promotion_deliveries ADD CONSTRAINT promotion_deliveries_check_date CHECK(next_check_at >= due_at);
  CREATE INDEX promotion_deliveries_due_idx ON promotion_deliveries(next_check_at) WHERE state IN ('scheduled', 'ready');`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_email_sequences_fk;
    ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_sequence_enrollments_fk;
    ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_promotion_deliveries_fk;
    DROP INDEX payload_locked_documents_rels_email_sequences_id_idx;
    DROP INDEX payload_locked_documents_rels_sequence_enrollments_id_idx;
    DROP INDEX payload_locked_documents_rels_promotion_deliveries_id_idx;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN email_sequences_id;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN sequence_enrollments_id;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN promotion_deliveries_id;
    DROP TABLE promotion_deliveries;
    DROP TABLE sequence_enrollments;
    DROP TABLE email_sequences;
    DROP TYPE enum_sequence_enrollments_state;
    DROP TYPE enum_promotion_deliveries_stage;
    DROP TYPE enum_promotion_deliveries_state;
    DROP TYPE enum_promotion_deliveries_error_code;
  `)
}

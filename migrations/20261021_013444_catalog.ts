import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE UNIQUE INDEX "admin_users_single_owner" ON "admin_users" ("role");
   CREATE TYPE "public"."enum_themes_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__themes_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_ebooks_material_state" AS ENUM('production', 'ready');
  CREATE TYPE "public"."enum_ebooks_presentation_variant" AS ENUM('guide', 'reading', 'workbook');
  CREATE TYPE "public"."enum_ebooks_accent_preset" AS ENUM('mineral', 'slate', 'plum');
  CREATE TYPE "public"."enum_ebooks_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__ebooks_v_version_material_state" AS ENUM('production', 'ready');
  CREATE TYPE "public"."enum__ebooks_v_version_presentation_variant" AS ENUM('guide', 'reading', 'workbook');
  CREATE TYPE "public"."enum__ebooks_v_version_accent_preset" AS ENUM('mineral', 'slate', 'plum');
  CREATE TYPE "public"."enum__ebooks_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_media_visibility" AS ENUM('public', 'private');
  CREATE TYPE "public"."enum_media_presentation_role" AS ENUM('cover', 'sample', 'contextual');
  CREATE TYPE "public"."enum_offers_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TYPE "public"."enum_offers_currency" AS ENUM('BRL');
  CREATE TABLE "themes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"introduction" varchar,
  	"archived" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_themes_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_themes_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_introduction" varchar,
  	"version_archived" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__themes_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "ebooks_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "ebooks_contents" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "ebooks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "ebooks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"theme_id" uuid,
  	"audience" varchar,
  	"problem" varchar,
  	"promise" varchar,
  	"body" jsonb,
  	"requirements" varchar,
  	"limits" varchar,
  	"cover_id" uuid,
  	"material_state" "enum_ebooks_material_state" DEFAULT 'production',
  	"presentation_variant" "enum_ebooks_presentation_variant" DEFAULT 'guide',
  	"accent_preset" "enum_ebooks_accent_preset" DEFAULT 'mineral',
  	"workbook_example" varchar,
  	"search_text" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"archived" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_ebooks_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_ebooks_v_version_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_ebooks_v_version_contents" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_ebooks_v_version_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_ebooks_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_theme_id" uuid,
  	"version_audience" varchar,
  	"version_problem" varchar,
  	"version_promise" varchar,
  	"version_body" jsonb,
  	"version_requirements" varchar,
  	"version_limits" varchar,
  	"version_cover_id" uuid,
  	"version_material_state" "enum__ebooks_v_version_material_state" DEFAULT 'production',
  	"version_presentation_variant" "enum__ebooks_v_version_presentation_variant" DEFAULT 'guide',
  	"version_accent_preset" "enum__ebooks_v_version_accent_preset" DEFAULT 'mineral',
  	"version_workbook_example" varchar,
  	"version_search_text" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_archived" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__ebooks_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "articles" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"author" varchar,
  	"theme_id" uuid,
  	"ebook_id" uuid,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"archived" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_articles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_articles_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_author" varchar,
  	"version_theme_id" uuid,
  	"version_ebook_id" uuid,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_archived" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__articles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"visibility" "enum_media_visibility" DEFAULT 'private' NOT NULL,
  	"presentation_role" "enum_media_presentation_role" NOT NULL,
  	"hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric
  );
  
  CREATE TABLE "lead_magnets" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"ebook_id" uuid NOT NULL,
  	"media_id" uuid NOT NULL,
  	"version" varchar NOT NULL,
  	"active" boolean DEFAULT false,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "offers" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"ebook_id" uuid NOT NULL,
  	"provider" "enum_offers_provider" NOT NULL,
  	"account_key" varchar NOT NULL,
  	"external_product_id" varchar NOT NULL,
  	"external_offer_id" varchar,
  	"checkout_url" varchar,
  	"price_cents" numeric,
  	"currency" "enum_offers_currency" DEFAULT 'BRL' NOT NULL,
  	"active" boolean DEFAULT false,
  	"primary" boolean DEFAULT false,
  	"last_verified_at" timestamp(3) with time zone,
  	"eligibility_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "themes_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ebooks_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "articles_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lead_magnets_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "offers_id" uuid;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_parent_id_themes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ebooks_benefits" ADD CONSTRAINT "ebooks_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ebooks_contents" ADD CONSTRAINT "ebooks_contents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ebooks_faq" ADD CONSTRAINT "ebooks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ebooks" ADD CONSTRAINT "ebooks_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ebooks" ADD CONSTRAINT "ebooks_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ebooks_v_version_benefits" ADD CONSTRAINT "_ebooks_v_version_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_ebooks_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ebooks_v_version_contents" ADD CONSTRAINT "_ebooks_v_version_contents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_ebooks_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ebooks_v_version_faq" ADD CONSTRAINT "_ebooks_v_version_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_ebooks_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ebooks_v" ADD CONSTRAINT "_ebooks_v_parent_id_ebooks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ebooks_v" ADD CONSTRAINT "_ebooks_v_version_theme_id_themes_id_fk" FOREIGN KEY ("version_theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ebooks_v" ADD CONSTRAINT "_ebooks_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_theme_id_themes_id_fk" FOREIGN KEY ("version_theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_ebook_id_ebooks_id_fk" FOREIGN KEY ("version_ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lead_magnets" ADD CONSTRAINT "lead_magnets_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lead_magnets" ADD CONSTRAINT "lead_magnets_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offers" ADD CONSTRAINT "offers_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "themes_slug_idx" ON "themes" USING btree ("slug");
  CREATE INDEX "themes_archived_idx" ON "themes" USING btree ("archived");
  CREATE INDEX "themes_updated_at_idx" ON "themes" USING btree ("updated_at");
  CREATE INDEX "themes_created_at_idx" ON "themes" USING btree ("created_at");
  CREATE INDEX "themes__status_idx" ON "themes" USING btree ("_status");
  CREATE INDEX "_themes_v_parent_idx" ON "_themes_v" USING btree ("parent_id");
  CREATE INDEX "_themes_v_version_version_slug_idx" ON "_themes_v" USING btree ("version_slug");
  CREATE INDEX "_themes_v_version_version_archived_idx" ON "_themes_v" USING btree ("version_archived");
  CREATE INDEX "_themes_v_version_version_updated_at_idx" ON "_themes_v" USING btree ("version_updated_at");
  CREATE INDEX "_themes_v_version_version_created_at_idx" ON "_themes_v" USING btree ("version_created_at");
  CREATE INDEX "_themes_v_version_version__status_idx" ON "_themes_v" USING btree ("version__status");
  CREATE INDEX "_themes_v_created_at_idx" ON "_themes_v" USING btree ("created_at");
  CREATE INDEX "_themes_v_updated_at_idx" ON "_themes_v" USING btree ("updated_at");
  CREATE INDEX "_themes_v_latest_idx" ON "_themes_v" USING btree ("latest");
  CREATE INDEX "ebooks_benefits_order_idx" ON "ebooks_benefits" USING btree ("_order");
  CREATE INDEX "ebooks_benefits_parent_id_idx" ON "ebooks_benefits" USING btree ("_parent_id");
  CREATE INDEX "ebooks_contents_order_idx" ON "ebooks_contents" USING btree ("_order");
  CREATE INDEX "ebooks_contents_parent_id_idx" ON "ebooks_contents" USING btree ("_parent_id");
  CREATE INDEX "ebooks_faq_order_idx" ON "ebooks_faq" USING btree ("_order");
  CREATE INDEX "ebooks_faq_parent_id_idx" ON "ebooks_faq" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "ebooks_slug_idx" ON "ebooks" USING btree ("slug");
  CREATE INDEX "ebooks_theme_idx" ON "ebooks" USING btree ("theme_id");
  CREATE INDEX "ebooks_cover_idx" ON "ebooks" USING btree ("cover_id");
  CREATE INDEX "ebooks_search_text_idx" ON "ebooks" USING btree ("search_text");
  CREATE INDEX "ebooks_archived_idx" ON "ebooks" USING btree ("archived");
  CREATE INDEX "ebooks_updated_at_idx" ON "ebooks" USING btree ("updated_at");
  CREATE INDEX "ebooks_created_at_idx" ON "ebooks" USING btree ("created_at");
  CREATE INDEX "ebooks__status_idx" ON "ebooks" USING btree ("_status");
  CREATE INDEX "_ebooks_v_version_benefits_order_idx" ON "_ebooks_v_version_benefits" USING btree ("_order");
  CREATE INDEX "_ebooks_v_version_benefits_parent_id_idx" ON "_ebooks_v_version_benefits" USING btree ("_parent_id");
  CREATE INDEX "_ebooks_v_version_contents_order_idx" ON "_ebooks_v_version_contents" USING btree ("_order");
  CREATE INDEX "_ebooks_v_version_contents_parent_id_idx" ON "_ebooks_v_version_contents" USING btree ("_parent_id");
  CREATE INDEX "_ebooks_v_version_faq_order_idx" ON "_ebooks_v_version_faq" USING btree ("_order");
  CREATE INDEX "_ebooks_v_version_faq_parent_id_idx" ON "_ebooks_v_version_faq" USING btree ("_parent_id");
  CREATE INDEX "_ebooks_v_parent_idx" ON "_ebooks_v" USING btree ("parent_id");
  CREATE INDEX "_ebooks_v_version_version_slug_idx" ON "_ebooks_v" USING btree ("version_slug");
  CREATE INDEX "_ebooks_v_version_version_theme_idx" ON "_ebooks_v" USING btree ("version_theme_id");
  CREATE INDEX "_ebooks_v_version_version_cover_idx" ON "_ebooks_v" USING btree ("version_cover_id");
  CREATE INDEX "_ebooks_v_version_version_search_text_idx" ON "_ebooks_v" USING btree ("version_search_text");
  CREATE INDEX "_ebooks_v_version_version_archived_idx" ON "_ebooks_v" USING btree ("version_archived");
  CREATE INDEX "_ebooks_v_version_version_updated_at_idx" ON "_ebooks_v" USING btree ("version_updated_at");
  CREATE INDEX "_ebooks_v_version_version_created_at_idx" ON "_ebooks_v" USING btree ("version_created_at");
  CREATE INDEX "_ebooks_v_version_version__status_idx" ON "_ebooks_v" USING btree ("version__status");
  CREATE INDEX "_ebooks_v_created_at_idx" ON "_ebooks_v" USING btree ("created_at");
  CREATE INDEX "_ebooks_v_updated_at_idx" ON "_ebooks_v" USING btree ("updated_at");
  CREATE INDEX "_ebooks_v_latest_idx" ON "_ebooks_v" USING btree ("latest");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_theme_idx" ON "articles" USING btree ("theme_id");
  CREATE INDEX "articles_ebook_idx" ON "articles" USING btree ("ebook_id");
  CREATE INDEX "articles_archived_idx" ON "articles" USING btree ("archived");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "articles__status_idx" ON "articles" USING btree ("_status");
  CREATE INDEX "_articles_v_parent_idx" ON "_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_theme_idx" ON "_articles_v" USING btree ("version_theme_id");
  CREATE INDEX "_articles_v_version_version_ebook_idx" ON "_articles_v" USING btree ("version_ebook_id");
  CREATE INDEX "_articles_v_version_version_archived_idx" ON "_articles_v" USING btree ("version_archived");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_latest_idx" ON "_articles_v" USING btree ("latest");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "lead_magnets_slug_idx" ON "lead_magnets" USING btree ("slug");
  CREATE INDEX "lead_magnets_ebook_idx" ON "lead_magnets" USING btree ("ebook_id");
  CREATE INDEX "lead_magnets_media_idx" ON "lead_magnets" USING btree ("media_id");
  CREATE INDEX "lead_magnets_updated_at_idx" ON "lead_magnets" USING btree ("updated_at");
  CREATE INDEX "lead_magnets_created_at_idx" ON "lead_magnets" USING btree ("created_at");
  CREATE INDEX "offers_ebook_idx" ON "offers" USING btree ("ebook_id");
  CREATE INDEX "offers_active_idx" ON "offers" USING btree ("active");
  CREATE INDEX "offers_updated_at_idx" ON "offers" USING btree ("updated_at");
  CREATE INDEX "offers_created_at_idx" ON "offers" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_themes_fk" FOREIGN KEY ("themes_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ebooks_fk" FOREIGN KEY ("ebooks_id") REFERENCES "public"."ebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lead_magnets_fk" FOREIGN KEY ("lead_magnets_id") REFERENCES "public"."lead_magnets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_offers_fk" FOREIGN KEY ("offers_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_themes_id_idx" ON "payload_locked_documents_rels" USING btree ("themes_id");
  CREATE INDEX "payload_locked_documents_rels_ebooks_id_idx" ON "payload_locked_documents_rels" USING btree ("ebooks_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_lead_magnets_id_idx" ON "payload_locked_documents_rels" USING btree ("lead_magnets_id");
  CREATE INDEX "payload_locked_documents_rels_offers_id_idx" ON "payload_locked_documents_rels" USING btree ("offers_id");`)
  await db.execute(sql`
    CREATE UNIQUE INDEX "offers_one_active_primary" ON "offers" ("ebook_id") WHERE "active" = true AND "primary" = true;
    ALTER TABLE "offers" ADD CONSTRAINT "offers_integer_price" CHECK ("price_cents" IS NULL OR ("price_cents" >= 0 AND "price_cents" = floor("price_cents")));
    ALTER TABLE "offers" ADD CONSTRAINT "offers_active_complete" CHECK (NOT "active" OR ("checkout_url" IS NOT NULL AND "price_cents" IS NOT NULL AND "last_verified_at" IS NOT NULL AND "eligibility_note" IS NOT NULL));
  `)

}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "admin_users_single_owner";

   ALTER TABLE "themes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_themes_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ebooks_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ebooks_contents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ebooks_faq" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ebooks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ebooks_v_version_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ebooks_v_version_contents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ebooks_v_version_faq" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ebooks_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lead_magnets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "offers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "themes" CASCADE;
  DROP TABLE "_themes_v" CASCADE;
  DROP TABLE "ebooks_benefits" CASCADE;
  DROP TABLE "ebooks_contents" CASCADE;
  DROP TABLE "ebooks_faq" CASCADE;
  DROP TABLE "ebooks" CASCADE;
  DROP TABLE "_ebooks_v_version_benefits" CASCADE;
  DROP TABLE "_ebooks_v_version_contents" CASCADE;
  DROP TABLE "_ebooks_v_version_faq" CASCADE;
  DROP TABLE "_ebooks_v" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "_articles_v" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "lead_magnets" CASCADE;
  DROP TABLE "offers" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_themes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ebooks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_articles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lead_magnets_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_offers_fk";
  
  DROP INDEX "payload_locked_documents_rels_themes_id_idx";
  DROP INDEX "payload_locked_documents_rels_ebooks_id_idx";
  DROP INDEX "payload_locked_documents_rels_articles_id_idx";
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  DROP INDEX "payload_locked_documents_rels_lead_magnets_id_idx";
  DROP INDEX "payload_locked_documents_rels_offers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "themes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ebooks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "articles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lead_magnets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "offers_id";
  DROP TYPE "public"."enum_themes_status";
  DROP TYPE "public"."enum__themes_v_version_status";
  DROP TYPE "public"."enum_ebooks_material_state";
  DROP TYPE "public"."enum_ebooks_presentation_variant";
  DROP TYPE "public"."enum_ebooks_accent_preset";
  DROP TYPE "public"."enum_ebooks_status";
  DROP TYPE "public"."enum__ebooks_v_version_material_state";
  DROP TYPE "public"."enum__ebooks_v_version_presentation_variant";
  DROP TYPE "public"."enum__ebooks_v_version_accent_preset";
  DROP TYPE "public"."enum__ebooks_v_version_status";
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum__articles_v_version_status";
  DROP TYPE "public"."enum_media_visibility";
  DROP TYPE "public"."enum_media_presentation_role";
  DROP TYPE "public"."enum_offers_provider";
  DROP TYPE "public"."enum_offers_currency";`)
}

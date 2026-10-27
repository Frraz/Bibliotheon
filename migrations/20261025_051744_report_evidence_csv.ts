import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_commercial_import_batches_kind" AS ENUM('snapshot', 'report_evidence');
  ALTER TYPE "public"."enum_commercial_import_rows_state" ADD VALUE 'recorded';
  ALTER TABLE "commercial_import_batches" ADD COLUMN "kind" "enum_commercial_import_batches_kind" DEFAULT 'snapshot' NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $guard$ BEGIN
    IF EXISTS(SELECT 1 FROM public.commercial_import_batches WHERE kind='report_evidence') OR EXISTS(SELECT 1 FROM public.commercial_import_rows WHERE state='recorded') THEN RAISE EXCEPTION 'report_evidence_import_downgrade_forbidden' USING ERRCODE='23514'; END IF;
   END $guard$;
   ALTER TABLE "commercial_import_rows" ALTER COLUMN "state" SET DATA TYPE text;
  DROP TYPE "public"."enum_commercial_import_rows_state";
  CREATE TYPE "public"."enum_commercial_import_rows_state" AS ENUM('planned', 'matched', 'duplicate', 'blocked', 'queued');
  ALTER TABLE "commercial_import_rows" ALTER COLUMN "state" SET DATA TYPE "public"."enum_commercial_import_rows_state" USING "state"::"public"."enum_commercial_import_rows_state";
  ALTER TABLE "commercial_import_batches" DROP COLUMN "kind";
  DROP TYPE "public"."enum_commercial_import_batches_kind";`)
}

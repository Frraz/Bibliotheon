import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_promotion_deliveries_error_code" ADD VALUE 'marketing_review_due';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const rows = await db.execute(sql`SELECT count(*)::int AS count FROM "promotion_deliveries" WHERE "error_code" = 'marketing_review_due'`)
  if (rows.rows[0]?.count) throw new Error('Promoções retidas para revisão impedem rollback da migration.')
  await db.execute(sql`
   ALTER TABLE "promotion_deliveries" ALTER COLUMN "error_code" SET DATA TYPE text;
  DROP TYPE "public"."enum_promotion_deliveries_error_code";
  CREATE TYPE "public"."enum_promotion_deliveries_error_code" AS ENUM('recipient_suppressed', 'material_unavailable', 'sequence_paused', 'offer_unavailable', 'provider_rejected', 'uncertain_delivery');
  ALTER TABLE "promotion_deliveries" ALTER COLUMN "error_code" SET DATA TYPE "public"."enum_promotion_deliveries_error_code" USING "error_code"::"public"."enum_promotion_deliveries_error_code";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "preference_tokens" ADD COLUMN "source_key" varchar;
  ALTER TABLE "preference_tokens" ADD COLUMN "nonce" varchar;
  ALTER TABLE "email_campaign_batches" ADD COLUMN "preference_check" jsonb;
  CREATE UNIQUE INDEX "preference_tokens_source_key_idx" ON "preference_tokens" USING btree ("source_key");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM preference_tokens WHERE source_key IS NOT NULL OR nonce IS NOT NULL)
       OR EXISTS (SELECT 1 FROM email_campaign_batches WHERE preference_check IS NOT NULL) THEN
      RAISE EXCEPTION 'Downgrade recusado: links individuais ou conferencias existentes.';
    END IF;
   END $$;
   DROP INDEX "preference_tokens_source_key_idx";
  ALTER TABLE "preference_tokens" DROP COLUMN "source_key";
  ALTER TABLE "preference_tokens" DROP COLUMN "nonce";
  ALTER TABLE "email_campaign_batches" DROP COLUMN "preference_check";`)
}

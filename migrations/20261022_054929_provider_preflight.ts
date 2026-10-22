import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_consent_events_action" ADD VALUE 'provider_blocked';
  ALTER TYPE "public"."enum_email_campaign_batches_error_code" ADD VALUE 'provider_absent';
  ALTER TYPE "public"."enum_email_campaign_batches_error_code" ADD VALUE 'provider_unavailable';
  ALTER TYPE "public"."enum_email_campaign_batches_error_code" ADD VALUE 'provider_rejected';
  ALTER TABLE "email_campaign_batches" ADD COLUMN "provider_check" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM consent_events WHERE action::text='provider_blocked')
      OR EXISTS (SELECT 1 FROM email_campaign_batches WHERE error_code::text IN ('provider_absent','provider_unavailable','provider_rejected')) THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar registros da conferência do provedor; prefira correção progressiva.';
    END IF;
  END $$;
  ALTER TABLE "consent_events" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_consent_events_action";
  CREATE TYPE "public"."enum_consent_events_action" AS ENUM('requested', 'confirmed', 'subscribed', 'unsubscribed', 'bounced', 'complaint');
  ALTER TABLE "consent_events" ALTER COLUMN "action" SET DATA TYPE "public"."enum_consent_events_action" USING "action"::"public"."enum_consent_events_action";
  ALTER TABLE "email_campaign_batches" ALTER COLUMN "error_code" SET DATA TYPE text;
  DROP TYPE "public"."enum_email_campaign_batches_error_code";
  CREATE TYPE "public"."enum_email_campaign_batches_error_code" AS ENUM('quota', 'eligibility_changed', 'uncertain_delivery');
  ALTER TABLE "email_campaign_batches" ALTER COLUMN "error_code" SET DATA TYPE "public"."enum_email_campaign_batches_error_code" USING "error_code"::"public"."enum_email_campaign_batches_error_code";
  ALTER TABLE "email_campaign_batches" DROP COLUMN "provider_check";`)
}

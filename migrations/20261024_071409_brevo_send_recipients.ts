import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "brevo_campaign_sends" ADD COLUMN "recipient_identities" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM brevo_campaign_sends WHERE recipient_identities IS NOT NULL) THEN
      RAISE EXCEPTION 'Downgrade recusado: preservar identidade dos destinatários emitidos.';
    END IF;
   END $$;
  ALTER TABLE "brevo_campaign_sends" DROP COLUMN "recipient_identities";`)
}

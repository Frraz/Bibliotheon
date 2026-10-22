import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_contact_theme_unique UNIQUE(contact_id, theme_id);
    ALTER TABLE request_limits ADD CONSTRAINT request_limits_nonnegative CHECK(count >= 0 AND count = trunc(count));
    ALTER TABLE mail_quota ADD CONSTRAINT mail_quota_nonnegative CHECK(reserved >= 0 AND reserved = trunc(reserved));
    ALTER TABLE email_deliveries ADD CONSTRAINT email_deliveries_attempts CHECK(attempts >= 0 AND attempts <= 5 AND attempts = trunc(attempts));
    CREATE INDEX email_deliveries_due_idx ON email_deliveries(next_attempt_at) WHERE state = 'pending';
    CREATE INDEX magnet_requests_duplicate_idx ON magnet_requests(contact_id, magnet_id, created_at);
  `)
}
export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`
    DROP INDEX magnet_requests_duplicate_idx;
    DROP INDEX email_deliveries_due_idx;
    ALTER TABLE email_deliveries DROP CONSTRAINT email_deliveries_attempts;
    ALTER TABLE mail_quota DROP CONSTRAINT mail_quota_nonnegative;
    ALTER TABLE request_limits DROP CONSTRAINT request_limits_nonnegative;
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_contact_theme_unique;
  `)
}

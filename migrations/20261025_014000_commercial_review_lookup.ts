import {MigrateUpArgs,MigrateDownArgs,sql} from '@payloadcms/db-postgres'

export async function up({db}:MigrateUpArgs):Promise<void>{
 await db.execute(sql`
  CREATE INDEX commercial_conflicts_transaction_lookup_idx ON public.commercial_conflicts ((envelope->>'provider'),(envelope->>'accountKey'),(envelope->>'externalTransactionId'));
  -- Paths are the persisted internal normalized contract, not native provider payloads.
  -- Flags are derived; retain envelopes, events, identity references and known amounts.
  UPDATE public.transactions t SET needs_review=true,review_reason='event_key_conflict',updated_at=now()
  WHERE EXISTS (SELECT 1 FROM public.commercial_inbox i WHERE i.transaction_key=t.key AND (i.conflicted OR EXISTS(SELECT 1 FROM public.commercial_conflicts c WHERE c.inbox_id=i.id)))
   OR EXISTS (SELECT 1 FROM public.commercial_conflicts c WHERE c.envelope->>'provider'=t.provider::text AND c.envelope->>'accountKey'=t.account_key AND c.envelope->>'externalTransactionId'=t.external_transaction_id);
 `)
}
export async function down({db}:MigrateDownArgs):Promise<void>{
 // Do not invent the former review state or clear evidence of a known collision.
 await db.execute(sql`DROP INDEX public.commercial_conflicts_transaction_lookup_idx;`)
}

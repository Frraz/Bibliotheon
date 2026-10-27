import {MigrateUpArgs, MigrateDownArgs, sql} from '@payloadcms/db-postgres'

/** Preserve legacy rows; enforce future writes without rewriting external facts. */
export async function up({db}: MigrateUpArgs): Promise<void> {
 await db.execute(sql`
  CREATE INDEX offers_external_product_idx ON public.offers (provider, account_key, external_product_id);
  CREATE FUNCTION public.bibliotheon_offer_identity_guard() RETURNS trigger
  LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = pg_catalog, public AS $guard$
  DECLARE
   old_account text;
   new_account text;
   account_lock text;
  BEGIN
   IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.provider, NEW.account_key, NEW.external_product_id, COALESCE(NEW.external_offer_id, ''), NEW.ebook_id)
      IS NOT DISTINCT FROM ROW(OLD.provider, OLD.account_key, OLD.external_product_id, COALESCE(OLD.external_offer_id, ''), OLD.ebook_id)
    THEN RETURN NEW;
    END IF;
   END IF;

   -- VOLATILE queries obtain fresh snapshots after waiting for the account lock.
   -- Reject fixed-snapshot transactions rather than silently checking stale data.
   IF current_setting('transaction_isolation') NOT IN ('read committed', 'read uncommitted') THEN
    RAISE EXCEPTION 'offer_identity_requires_read_committed' USING ERRCODE = '25001';
   END IF;
   IF TG_OP <> 'INSERT' THEN
    old_account := 'commercial-account:[' || to_json(OLD.provider::text)::text || ',' || to_json(OLD.account_key)::text || ']';
   END IF;
   IF TG_OP <> 'DELETE' THEN
    new_account := 'commercial-account:[' || to_json(NEW.provider::text)::text || ',' || to_json(NEW.account_key)::text || ']';
   END IF;
   -- Same byte representation as JSON.stringify([provider, accountKey]) in lock.ts.
   FOR account_lock IN SELECT DISTINCT value COLLATE "C" FROM unnest(ARRAY[old_account, new_account]) AS keys(value)
    WHERE value IS NOT NULL ORDER BY value COLLATE "C"
   LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(account_lock, 0));
   END LOOP;

   IF TG_OP <> 'INSERT' AND EXISTS (
    SELECT 1 FROM public.transactions WHERE provider::text = OLD.provider::text
     AND account_key = OLD.account_key AND external_product_id = OLD.external_product_id
   ) THEN
    RAISE EXCEPTION 'offer_identity_has_history' USING ERRCODE = '23514', CONSTRAINT = 'offers_identity_history_guard';
   END IF;
   IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
   IF NEW.ebook_id IS NULL THEN
    RAISE EXCEPTION 'offer_identity_requires_ebook' USING ERRCODE = '23514', CONSTRAINT = 'offers_identity_ebook_guard';
   END IF;
   IF EXISTS (
    SELECT 1 FROM public.offers candidate WHERE candidate.provider = NEW.provider
     AND candidate.account_key = NEW.account_key AND candidate.external_product_id = NEW.external_product_id
     AND candidate.id <> NEW.id
     AND (candidate.ebook_id IS DISTINCT FROM NEW.ebook_id
       OR COALESCE(candidate.external_offer_id, '') = COALESCE(NEW.external_offer_id, ''))
   ) THEN
    RAISE EXCEPTION 'offer_identity_conflict' USING ERRCODE = '23514', CONSTRAINT = 'offers_identity_uniqueness_guard';
   END IF;
   RETURN NEW;
  END;
  $guard$;
  CREATE TRIGGER offers_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON public.offers
   FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_offer_identity_guard();
 `)
}

export async function down({db}: MigrateDownArgs): Promise<void> {
 await db.execute(sql`
  DO $guard$ BEGIN
   IF EXISTS (SELECT 1 FROM public.offers) THEN
    RAISE EXCEPTION 'offer_identity_guard downgrade recusado com ofertas existentes';
   END IF;
  END $guard$;
  DROP TRIGGER offers_identity_guard ON public.offers;
  DROP FUNCTION public.bibliotheon_offer_identity_guard();
  DROP INDEX public.offers_external_product_idx;
 `)
}

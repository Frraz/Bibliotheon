import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_catalog_resolutions_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TYPE "public"."enum_catalog_resolutions_action" AS ENUM('associate', 'hold');
  CREATE TYPE "public"."enum_catalog_resolutions_source_kind" AS ENUM('provider_report', 'manual_reconciliation');
  CREATE TYPE "public"."enum_catalog_resolutions_reason" AS ENUM('catalog_mapping_verified', 'historical_mapping_correction', 'evidence_inconclusive');
  CREATE TABLE "catalog_resolutions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"scope_key" varchar NOT NULL,
  	"provider" "enum_catalog_resolutions_provider" NOT NULL,
  	"account_key" varchar NOT NULL,
  	"external_product_id" varchar NOT NULL,
  	"external_offer_id" varchar,
  	"revision" numeric NOT NULL,
  	"previous_id" uuid,
  	"action" "enum_catalog_resolutions_action" NOT NULL,
  	"target_offer_id" uuid,
  	"target_ebook_id" uuid,
  	"actor_id" uuid NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"source_kind" "enum_catalog_resolutions_source_kind" NOT NULL,
  	"source_reference" varchar NOT NULL,
  	"reason" "enum_catalog_resolutions_reason" NOT NULL,
  	"evidence_verified" boolean DEFAULT false NOT NULL,
  	"plan_hash" varchar NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "transaction_events" ADD COLUMN "catalog_resolution_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "catalog_resolutions_id" uuid;
  ALTER TABLE "catalog_resolutions" ADD CONSTRAINT "catalog_resolutions_previous_id_catalog_resolutions_id_fk" FOREIGN KEY ("previous_id") REFERENCES "public"."catalog_resolutions"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "catalog_resolutions" ADD CONSTRAINT "catalog_resolutions_target_offer_id_offers_id_fk" FOREIGN KEY ("target_offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "catalog_resolutions" ADD CONSTRAINT "catalog_resolutions_target_ebook_id_ebooks_id_fk" FOREIGN KEY ("target_ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "catalog_resolutions" ADD CONSTRAINT "catalog_resolutions_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
  CREATE UNIQUE INDEX "catalog_resolutions_key_idx" ON "catalog_resolutions" USING btree ("key");
  CREATE INDEX "catalog_resolutions_scope_key_idx" ON "catalog_resolutions" USING btree ("scope_key");
  CREATE INDEX "catalog_resolutions_previous_idx" ON "catalog_resolutions" USING btree ("previous_id");
  CREATE INDEX "catalog_resolutions_target_offer_idx" ON "catalog_resolutions" USING btree ("target_offer_id");
  CREATE INDEX "catalog_resolutions_target_ebook_idx" ON "catalog_resolutions" USING btree ("target_ebook_id");
  CREATE INDEX "catalog_resolutions_actor_idx" ON "catalog_resolutions" USING btree ("actor_id");
  CREATE INDEX "catalog_resolutions_updated_at_idx" ON "catalog_resolutions" USING btree ("updated_at");
  CREATE INDEX "catalog_resolutions_created_at_idx" ON "catalog_resolutions" USING btree ("created_at");
  ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_catalog_resolution_id_catalog_resolutions_id_fk" FOREIGN KEY ("catalog_resolution_id") REFERENCES "public"."catalog_resolutions"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_catalog_resolutions_fk" FOREIGN KEY ("catalog_resolutions_id") REFERENCES "public"."catalog_resolutions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "transaction_events_catalog_resolution_idx" ON "transaction_events" USING btree ("catalog_resolution_id");
  CREATE INDEX "payload_locked_documents_rels_catalog_resolutions_id_idx" ON "payload_locked_documents_rels" USING btree ("catalog_resolutions_id");`)
  await db.execute(sql`
   CREATE UNIQUE INDEX catalog_resolutions_scope_revision_idx ON public.catalog_resolutions (scope_key,revision);
   ALTER TABLE public.catalog_resolutions ADD CONSTRAINT catalog_resolutions_revision_check CHECK (revision >= 1 AND revision <= 9007199254740991 AND revision = floor(revision));
   ALTER TABLE public.catalog_resolutions ADD CONSTRAINT catalog_resolutions_hash_check CHECK (key ~ '^[a-f0-9]{64}$' AND request_hash ~ '^[a-f0-9]{64}$' AND scope_key ~ '^[a-f0-9]{64}$' AND plan_hash ~ '^[a-f0-9]{64}$');
   ALTER TABLE public.catalog_resolutions ADD CONSTRAINT catalog_resolutions_source_check CHECK (source_reference ~ '^[a-z][a-z0-9_-]{2,95}$');
   ALTER TABLE public.catalog_resolutions ADD CONSTRAINT catalog_resolutions_decision_check CHECK (
    (action='associate' AND target_ebook_id IS NOT NULL AND evidence_verified AND reason IN ('catalog_mapping_verified','historical_mapping_correction'))
    OR (action='hold' AND target_offer_id IS NULL AND target_ebook_id IS NULL AND NOT evidence_verified AND reason='evidence_inconclusive')
   );
   CREATE FUNCTION public.bibliotheon_catalog_resolution_insert() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $guard$
   DECLARE head_id uuid; head_revision numeric; identity_json text;
   BEGIN
    IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
     RAISE EXCEPTION 'catalog_resolution_requires_read_committed' USING ERRCODE='25001';
    END IF;
    identity_json := '[' || to_json(NEW.provider::text)::text || ',' || to_json(NEW.account_key)::text || ',' || to_json(NEW.external_product_id)::text || ',' || COALESCE(to_json(NULLIF(NEW.external_offer_id,''))::text,'null') || ']';
    IF NEW.scope_key <> encode(sha256(convert_to(identity_json,'UTF8')),'hex') THEN
     RAISE EXCEPTION 'catalog_resolution_scope_integrity' USING ERRCODE='23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('commercial-account:[' || to_json(NEW.provider::text)::text || ',' || to_json(NEW.account_key)::text || ']',0));
    SELECT id,revision INTO head_id,head_revision FROM public.catalog_resolutions WHERE scope_key=NEW.scope_key ORDER BY revision DESC LIMIT 1;
    IF NEW.revision <> COALESCE(head_revision,0)+1 OR NEW.previous_id IS DISTINCT FROM head_id THEN
     RAISE EXCEPTION 'catalog_resolution_chain_conflict' USING ERRCODE='23514';
    END IF;
    IF NEW.action='associate' AND NEW.target_offer_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM public.offers WHERE id=NEW.target_offer_id AND ebook_id=NEW.target_ebook_id
      AND provider::text=NEW.provider::text AND account_key=NEW.account_key AND external_product_id=NEW.external_product_id
      AND (NEW.external_offer_id IS NULL OR external_offer_id=NEW.external_offer_id)
    ) THEN RAISE EXCEPTION 'catalog_resolution_target_scope' USING ERRCODE='23514'; END IF;
    RETURN NEW;
   END $guard$;
   CREATE TRIGGER catalog_resolutions_insert_guard BEFORE INSERT ON public.catalog_resolutions FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_catalog_resolution_insert();
   CREATE FUNCTION public.bibliotheon_catalog_resolution_immutable() RETURNS trigger LANGUAGE plpgsql AS $guard$
   BEGIN RAISE EXCEPTION 'catalog_resolution_immutable' USING ERRCODE='23514'; END $guard$;
   CREATE TRIGGER catalog_resolutions_immutable BEFORE UPDATE OR DELETE ON public.catalog_resolutions FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_catalog_resolution_immutable();
   CREATE FUNCTION public.bibliotheon_offer_resolution_reference() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $guard$
   BEGIN
    IF TG_OP='UPDATE' THEN
     IF ROW(NEW.id,NEW.provider,NEW.account_key,NEW.external_product_id,COALESCE(NEW.external_offer_id,''),NEW.ebook_id)
      IS NOT DISTINCT FROM ROW(OLD.id,OLD.provider,OLD.account_key,OLD.external_product_id,COALESCE(OLD.external_offer_id,''),OLD.ebook_id) THEN RETURN NEW; END IF;
    END IF;
    -- The BEFORE identity guard (migration 22) already acquired the account barrier.
    IF EXISTS (SELECT 1 FROM public.catalog_resolutions WHERE target_offer_id=OLD.id) THEN
     RAISE EXCEPTION 'offer_identity_referenced_by_resolution' USING ERRCODE='23514';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
   END $guard$;
   CREATE TRIGGER offers_catalog_resolution_reference AFTER UPDATE OR DELETE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_offer_resolution_reference();
  `)

}

export async function down({ db }: MigrateDownArgs): Promise<void> {
 await db.execute(sql`
  DO $guard$ BEGIN
   IF EXISTS (SELECT 1 FROM public.catalog_resolutions) OR EXISTS (SELECT 1 FROM public.transaction_events WHERE catalog_resolution_id IS NOT NULL) THEN
    RAISE EXCEPTION 'catalog_resolutions downgrade recusado com evidencias existentes';
   END IF;
  END $guard$;
  DROP TRIGGER offers_catalog_resolution_reference ON public.offers;
  DROP FUNCTION public.bibliotheon_offer_resolution_reference();
  ALTER TABLE public.transaction_events DROP CONSTRAINT transaction_events_catalog_resolution_id_catalog_resolutions_id_fk;
  ALTER TABLE public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_catalog_resolutions_fk;
  DROP INDEX public.transaction_events_catalog_resolution_idx;
  DROP INDEX public.payload_locked_documents_rels_catalog_resolutions_id_idx;
  ALTER TABLE public.transaction_events DROP COLUMN catalog_resolution_id;
  ALTER TABLE public.payload_locked_documents_rels DROP COLUMN catalog_resolutions_id;
  DROP TABLE public.catalog_resolutions;
  DROP FUNCTION public.bibliotheon_catalog_resolution_insert();
  DROP FUNCTION public.bibliotheon_catalog_resolution_immutable();
  DROP TYPE public.enum_catalog_resolutions_provider;
  DROP TYPE public.enum_catalog_resolutions_action;
  DROP TYPE public.enum_catalog_resolutions_source_kind;
  DROP TYPE public.enum_catalog_resolutions_reason;
 `)
}

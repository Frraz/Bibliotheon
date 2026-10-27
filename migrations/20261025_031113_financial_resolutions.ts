import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_financial_resolutions_provider" AS ENUM('hotmart', 'kiwify', 'cakto');
  CREATE TYPE "public"."enum_financial_resolutions_action" AS ENUM('reconcile', 'hold');
  CREATE TYPE "public"."enum_financial_resolutions_source_kind" AS ENUM('provider_report', 'manual_reconciliation');
  CREATE TYPE "public"."enum_financial_resolutions_reason" AS ENUM('provider_records_verified', 'incorrect_source_reconciled', 'evidence_inconclusive');
  CREATE TYPE "public"."enum_financial_resolution_applications_actor_type" AS ENUM('owner', 'worker');
  CREATE TABLE "financial_resolutions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"provider" "enum_financial_resolutions_provider" NOT NULL,
  	"account_key" varchar NOT NULL,
  	"revision" numeric NOT NULL,
  	"transaction_keys" jsonb NOT NULL,
  	"previous_ids" jsonb NOT NULL,
  	"action" "enum_financial_resolutions_action" NOT NULL,
  	"choice" jsonb NOT NULL,
  	"coverage" jsonb NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"outcomes" jsonb NOT NULL,
  	"source_hash" varchar NOT NULL,
  	"plan_hash" varchar NOT NULL,
  	"actor_id" uuid NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"source_kind" "enum_financial_resolutions_source_kind" NOT NULL,
  	"source_reference" varchar NOT NULL,
  	"reason" "enum_financial_resolutions_reason" NOT NULL,
  	"evidence_verified" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "financial_resolution_applications" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"resolution_id" uuid NOT NULL,
  	"source_hash" varchar NOT NULL,
  	"coverage" jsonb NOT NULL,
  	"outcomes" jsonb NOT NULL,
  	"actor_type" "enum_financial_resolution_applications_actor_type" NOT NULL,
  	"actor_id" uuid,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "transactions" ADD COLUMN "financial_resolution_id" uuid;
  ALTER TABLE "transactions" ADD COLUMN "effective_ebook_id" uuid;
  ALTER TABLE "transactions" ADD COLUMN "effective_offer_id" uuid;
  ALTER TABLE "transactions" ADD COLUMN "effective_product_id" varchar;
  ALTER TABLE "transaction_events" ADD COLUMN "financial_resolution_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "financial_resolutions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "financial_resolution_applications_id" uuid;
  ALTER TABLE "financial_resolutions" ADD CONSTRAINT "financial_resolutions_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "financial_resolution_applications" ADD CONSTRAINT "financial_resolution_applications_resolution_id_financial_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."financial_resolutions"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "financial_resolution_applications" ADD CONSTRAINT "financial_resolution_applications_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
  CREATE UNIQUE INDEX "financial_resolutions_key_idx" ON "financial_resolutions" USING btree ("key");
  CREATE INDEX "financial_resolutions_actor_idx" ON "financial_resolutions" USING btree ("actor_id");
  CREATE INDEX "financial_resolutions_updated_at_idx" ON "financial_resolutions" USING btree ("updated_at");
  CREATE INDEX "financial_resolutions_created_at_idx" ON "financial_resolutions" USING btree ("created_at");
  CREATE UNIQUE INDEX "financial_resolution_applications_key_idx" ON "financial_resolution_applications" USING btree ("key");
  CREATE INDEX "financial_resolution_applications_resolution_idx" ON "financial_resolution_applications" USING btree ("resolution_id");
  CREATE INDEX "financial_resolution_applications_actor_idx" ON "financial_resolution_applications" USING btree ("actor_id");
  CREATE INDEX "financial_resolution_applications_updated_at_idx" ON "financial_resolution_applications" USING btree ("updated_at");
  CREATE INDEX "financial_resolution_applications_created_at_idx" ON "financial_resolution_applications" USING btree ("created_at");
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financial_resolution_id_financial_resolutions_id_fk" FOREIGN KEY ("financial_resolution_id") REFERENCES "public"."financial_resolutions"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_effective_ebook_id_ebooks_id_fk" FOREIGN KEY ("effective_ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_effective_offer_id_offers_id_fk" FOREIGN KEY ("effective_offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_financial_resolution_id_financial_resolutions_id_fk" FOREIGN KEY ("financial_resolution_id") REFERENCES "public"."financial_resolutions"("id") ON DELETE no action ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_financial_resolutions_fk" FOREIGN KEY ("financial_resolutions_id") REFERENCES "public"."financial_resolutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_financial_resolution_applic_fk" FOREIGN KEY ("financial_resolution_applications_id") REFERENCES "public"."financial_resolution_applications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "transactions_financial_resolution_idx" ON "transactions" USING btree ("financial_resolution_id");
  CREATE INDEX "transactions_effective_ebook_idx" ON "transactions" USING btree ("effective_ebook_id");
  CREATE INDEX "transactions_effective_offer_idx" ON "transactions" USING btree ("effective_offer_id");
  CREATE INDEX "transaction_events_financial_resolution_idx" ON "transaction_events" USING btree ("financial_resolution_id");
  CREATE INDEX "payload_locked_documents_rels_financial_resolutions_id_idx" ON "payload_locked_documents_rels" USING btree ("financial_resolutions_id");
  CREATE INDEX "payload_locked_documents_rels_financial_resolution_appli_idx" ON "payload_locked_documents_rels" USING btree ("financial_resolution_applications_id");`)
 await db.execute(sql`
  CREATE UNIQUE INDEX financial_resolution_revision_idx ON public.financial_resolutions(provider,account_key,revision);
  CREATE INDEX financial_resolution_members_idx ON public.financial_resolutions USING gin(transaction_keys);
  CREATE INDEX financial_resolution_outcomes_idx ON public.financial_resolutions USING gin(outcomes jsonb_path_ops);
  CREATE INDEX financial_application_outcomes_idx ON public.financial_resolution_applications USING gin(outcomes jsonb_path_ops);
  CREATE INDEX financial_application_source_idx ON public.financial_resolution_applications(resolution_id,source_hash);
  ALTER TABLE public.financial_resolutions ADD CONSTRAINT financial_resolution_shape CHECK (
   revision>=1 AND revision<=9007199254740991 AND revision=floor(revision)
   AND key ~ '^[a-f0-9]{64}$' AND request_hash ~ '^[a-f0-9]{64}$' AND source_hash ~ '^[a-f0-9]{64}$' AND plan_hash ~ '^[a-f0-9]{64}$'
   AND jsonb_typeof(transaction_keys)='array' AND jsonb_array_length(transaction_keys) BETWEEN 1 AND 10000
   AND jsonb_typeof(previous_ids)='array' AND jsonb_typeof(coverage)='array' AND jsonb_typeof(outcomes)='array'
   AND source_reference ~ '^[a-z][a-z0-9_-]{2,95}$'
   AND ((action='hold' AND NOT evidence_verified AND reason='evidence_inconclusive') OR (action='reconcile' AND evidence_verified AND reason IN ('provider_records_verified','incorrect_source_reconciled')))
  );
  ALTER TABLE public.financial_resolution_applications ADD CONSTRAINT financial_application_shape CHECK (
   key ~ '^[a-f0-9]{64}$' AND source_hash ~ '^[a-f0-9]{64}$' AND jsonb_typeof(coverage)='array' AND jsonb_typeof(outcomes)='array'
   AND ((actor_type='owner' AND actor_id IS NOT NULL) OR (actor_type='worker' AND actor_id IS NULL))
  );
  CREATE FUNCTION public.bibliotheon_financial_insert() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $guard$
  DECLARE next_revision numeric; expected jsonb; supplied jsonb;
  BEGIN
   IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'financial_requires_read_committed' USING ERRCODE='25001'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('commercial-account:[' || to_json(NEW.provider::text)::text || ',' || to_json(NEW.account_key)::text || ']',0));
   SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM public.financial_resolutions WHERE provider=NEW.provider AND account_key=NEW.account_key;
   IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'financial_revision_conflict' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.transaction_keys) AS k(value) WHERE value !~ '^[a-f0-9]{64}$') OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(NEW.transaction_keys) AS k(value)) THEN RAISE EXCEPTION 'financial_members_integrity' USING ERRCODE='23514'; END IF;
   SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO expected FROM (SELECT DISTINCT head.id::text AS id FROM jsonb_array_elements_text(NEW.transaction_keys) AS keys(key) CROSS JOIN LATERAL (SELECT id FROM public.financial_resolutions WHERE transaction_keys ? keys.key ORDER BY revision DESC LIMIT 1) AS head) AS parents;
   SELECT COALESCE(jsonb_agg(value ORDER BY value),'[]'::jsonb) INTO supplied FROM jsonb_array_elements_text(NEW.previous_ids) AS parents(value);
   IF supplied<>expected THEN RAISE EXCEPTION 'financial_parent_conflict' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END $guard$;
  CREATE TRIGGER financial_resolutions_insert_guard BEFORE INSERT ON public.financial_resolutions FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_insert();
  CREATE FUNCTION public.bibliotheon_financial_immutable() RETURNS trigger LANGUAGE plpgsql AS $guard$ BEGIN RAISE EXCEPTION 'financial_evidence_immutable' USING ERRCODE='23514'; END $guard$;
  CREATE TRIGGER financial_resolutions_immutable BEFORE UPDATE OR DELETE ON public.financial_resolutions FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_immutable();
  CREATE TRIGGER financial_applications_immutable BEFORE UPDATE OR DELETE ON public.financial_resolution_applications FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_immutable();
  CREATE FUNCTION public.bibliotheon_financial_application_insert() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $guard$
  DECLARE decision public.financial_resolutions%ROWTYPE;
  BEGIN
   SELECT * INTO decision FROM public.financial_resolutions WHERE id=NEW.resolution_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'financial_resolution_missing' USING ERRCODE='23514'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('commercial-account:[' || to_json(decision.provider::text)::text || ',' || to_json(decision.account_key)::text || ']',0));
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(decision.transaction_keys) AS keys(key) CROSS JOIN LATERAL (SELECT id FROM public.financial_resolutions WHERE transaction_keys ? keys.key ORDER BY revision DESC LIMIT 1) AS head WHERE head.id<>decision.id) THEN RAISE EXCEPTION 'financial_application_superseded' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END $guard$;
  CREATE TRIGGER financial_applications_insert_guard BEFORE INSERT ON public.financial_resolution_applications FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_application_insert();
  CREATE FUNCTION public.bibliotheon_financial_offer_reference() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $guard$
  BEGIN
   IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.provider,NEW.account_key,NEW.external_product_id,COALESCE(NEW.external_offer_id,''),NEW.ebook_id) IS NOT DISTINCT FROM ROW(OLD.id,OLD.provider,OLD.account_key,OLD.external_product_id,COALESCE(OLD.external_offer_id,''),OLD.ebook_id) THEN RETURN NEW; END IF;
   IF EXISTS(SELECT 1 FROM public.financial_resolution_applications WHERE outcomes @> jsonb_build_array(jsonb_build_object('catalog',jsonb_build_object('offer',OLD.id::text)))) THEN RAISE EXCEPTION 'offer_identity_has_financial_evidence' USING ERRCODE='23514'; END IF;
   IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END $guard$;
  CREATE TRIGGER offers_financial_reference AFTER UPDATE OR DELETE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_offer_reference();
  CREATE FUNCTION public.bibliotheon_financial_ebook_reference() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $guard$
  BEGIN
   IF EXISTS(SELECT 1 FROM public.financial_resolution_applications WHERE outcomes @> jsonb_build_array(jsonb_build_object('catalog',jsonb_build_object('ebook',OLD.id::text)))) THEN RAISE EXCEPTION 'ebook_has_financial_evidence' USING ERRCODE='23514'; END IF;
   RETURN OLD;
  END $guard$;
  CREATE TRIGGER ebooks_financial_reference BEFORE DELETE ON public.ebooks FOR EACH ROW EXECUTE FUNCTION public.bibliotheon_financial_ebook_reference();
 `)

}

export async function down({ db }: MigrateDownArgs): Promise<void> {
 await db.execute(sql`
  DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM public.financial_resolutions) OR EXISTS(SELECT 1 FROM public.financial_resolution_applications) THEN RAISE EXCEPTION 'financial downgrade recusado com evidencias'; END IF; END $guard$;
  DROP TRIGGER offers_financial_reference ON public.offers;
  DROP TRIGGER ebooks_financial_reference ON public.ebooks;
  DROP FUNCTION public.bibliotheon_financial_offer_reference();
  DROP FUNCTION public.bibliotheon_financial_ebook_reference();
  ALTER TABLE public.transactions DROP CONSTRAINT transactions_financial_resolution_id_financial_resolutions_id_fk;
  ALTER TABLE public.transactions DROP CONSTRAINT transactions_effective_ebook_id_ebooks_id_fk;
  ALTER TABLE public.transactions DROP CONSTRAINT transactions_effective_offer_id_offers_id_fk;
  ALTER TABLE public.transaction_events DROP CONSTRAINT transaction_events_financial_resolution_id_financial_resolutions_id_fk;
  ALTER TABLE public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_financial_resolutions_fk;
  ALTER TABLE public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_financial_resolution_applic_fk;
  DROP INDEX public.transactions_financial_resolution_idx;
  DROP INDEX public.transactions_effective_ebook_idx;
  DROP INDEX public.transactions_effective_offer_idx;
  DROP INDEX public.transaction_events_financial_resolution_idx;
  DROP INDEX public.payload_locked_documents_rels_financial_resolutions_id_idx;
  DROP INDEX public.payload_locked_documents_rels_financial_resolution_appli_idx;
  ALTER TABLE public.transactions DROP COLUMN financial_resolution_id, DROP COLUMN effective_ebook_id, DROP COLUMN effective_offer_id, DROP COLUMN effective_product_id;
  ALTER TABLE public.transaction_events DROP COLUMN financial_resolution_id;
  ALTER TABLE public.payload_locked_documents_rels DROP COLUMN financial_resolutions_id, DROP COLUMN financial_resolution_applications_id;
  DROP TABLE public.financial_resolution_applications;
  DROP TABLE public.financial_resolutions;
  DROP FUNCTION public.bibliotheon_financial_application_insert();
  DROP FUNCTION public.bibliotheon_financial_insert();
  DROP FUNCTION public.bibliotheon_financial_immutable();
  DROP TYPE public.enum_financial_resolutions_provider;
  DROP TYPE public.enum_financial_resolutions_action;
  DROP TYPE public.enum_financial_resolutions_source_kind;
  DROP TYPE public.enum_financial_resolutions_reason;
  DROP TYPE public.enum_financial_resolution_applications_actor_type;
 `)
}

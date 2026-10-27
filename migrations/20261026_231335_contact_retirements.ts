import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "contact_retirements" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"subject_fingerprint" varchar NOT NULL,
  	"retired_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contact_retirements_id" uuid;
  CREATE UNIQUE INDEX "contact_retirements_subject_fingerprint_idx" ON "contact_retirements" USING btree ("subject_fingerprint");
  CREATE INDEX "contact_retirements_updated_at_idx" ON "contact_retirements" USING btree ("updated_at");
  CREATE INDEX "contact_retirements_created_at_idx" ON "contact_retirements" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contact_retirements_fk" FOREIGN KEY ("contact_retirements_id") REFERENCES "public"."contact_retirements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_contact_retirements_id_idx" ON "payload_locked_documents_rels" USING btree ("contact_retirements_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = await db.execute(sql`SELECT count(*)::int AS total FROM contact_retirements`)
  if (Number((result as unknown as {rows?:Array<{total:number}>}).rows?.[0]?.total ?? 0)>0) throw new Error('Migration down recusada: expurgos automáticos seriam perdidos.')
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contact_retirements_fk";
    DROP INDEX "payload_locked_documents_rels_contact_retirements_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contact_retirements_id";
    DROP TABLE "contact_retirements";
  `)
}

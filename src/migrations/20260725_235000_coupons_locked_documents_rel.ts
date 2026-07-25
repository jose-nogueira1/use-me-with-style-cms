import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Gap from 20260725_231500_coupons.ts: adding a new collection also needs a
// matching column on Payload's polymorphic payload_locked_documents_rels
// join table (used for the admin's "someone else is editing this" lock
// indicator) -- every other collection has one (see
// 20260725_150000_catalogue_taxonomies.ts for the same pattern with
// categories/merch_tags/colors/size_guides). Missed when the Coupons
// collection itself was added; surfaced as a runtime query error on any
// admin page that lists locked documents (i.e. every admin page).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "coupons_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk"
        FOREIGN KEY ("coupons_id") REFERENCES "coupons"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_coupons_id_idx" ON "payload_locked_documents_rels" ("coupons_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_coupons_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_coupons_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "coupons_id";
  `)
}

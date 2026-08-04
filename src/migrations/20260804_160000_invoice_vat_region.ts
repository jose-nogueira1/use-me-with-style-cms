import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Audit-trail field (2026-08-04, regional VAT): records which of the three
// Portugal VAT rates (or "flat" for Angola) applied to a given invoice's
// vat_rate column -- not used in any calculation, just makes it visible in
// the admin without cross-referencing the linked order's postal code.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_invoices_vat_region" AS ENUM('mainland', 'madeira', 'azores', 'flat');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "vat_region" "public"."enum_invoices_vat_region";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "vat_region";
    DROP TYPE IF EXISTS "public"."enum_invoices_vat_region";
  `)
}

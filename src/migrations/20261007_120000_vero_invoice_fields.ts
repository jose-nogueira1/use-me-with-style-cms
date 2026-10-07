import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Vero (AGT-certified) invoicing for Angola: which provider produced the row
// plus the fiscal identifiers and AGT validation state. Existing rows are
// internal documents.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_invoices_provider" AS ENUM('internal', 'vero');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_invoices_agt_status" AS ENUM('pending', 'validated', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "provider" "public"."enum_invoices_provider" DEFAULT 'internal',
      ADD COLUMN IF NOT EXISTS "vero_id" varchar,
      ADD COLUMN IF NOT EXISTS "vero_status" varchar,
      ADD COLUMN IF NOT EXISTS "atcud" varchar,
      ADD COLUMN IF NOT EXISTS "agt_status" "public"."enum_invoices_agt_status",
      ADD COLUMN IF NOT EXISTS "agt_errors" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "agt_errors",
      DROP COLUMN IF EXISTS "agt_status",
      DROP COLUMN IF EXISTS "atcud",
      DROP COLUMN IF EXISTS "vero_status",
      DROP COLUMN IF EXISTS "vero_id",
      DROP COLUMN IF EXISTS "provider";
    DROP TYPE IF EXISTS "public"."enum_invoices_agt_status";
    DROP TYPE IF EXISTS "public"."enum_invoices_provider";
  `)
}

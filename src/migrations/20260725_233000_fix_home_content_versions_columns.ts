import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Fixes a gap in 20260725_200000_home_content_versions.ts: Payload's
// global-versions schema for home-content needs, per version row, BOTH the
// row's own created_at/updated_at (when this snapshot was written) AND
// version_updated_at/version_created_at (the base doc's own timestamp
// fields AT the moment it was snapshotted) -- the original migration only
// added the former. Went unnoticed until local SQLite dev's schema-push
// tried to rebuild the table and failed because its copy step reads
// columns this table didn't have.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_home_content_v" ADD COLUMN IF NOT EXISTS "version_updated_at" timestamp(3) with time zone;
    ALTER TABLE "_home_content_v" ADD COLUMN IF NOT EXISTS "version_created_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_home_content_v" DROP COLUMN IF EXISTS "version_created_at";
    ALTER TABLE "_home_content_v" DROP COLUMN IF EXISTS "version_updated_at";
  `)
}

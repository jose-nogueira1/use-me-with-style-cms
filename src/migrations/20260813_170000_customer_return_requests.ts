import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'
export async function up({db}:MigrateUpArgs){await db.execute(sql`ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "origin" varchar DEFAULT 'admin', ADD COLUMN IF NOT EXISTS "evidence" jsonb;`)}
export async function down({db}:MigrateDownArgs){await db.execute(sql`ALTER TABLE "returns" DROP COLUMN IF EXISTS "origin", DROP COLUMN IF EXISTS "evidence";`)}

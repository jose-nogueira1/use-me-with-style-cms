import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "manual_whatsapp_number" varchar,
      ADD COLUMN IF NOT EXISTS "angola_whatsapp_number" varchar,
      ADD COLUMN IF NOT EXISTS "portugal_whatsapp_number" varchar,
      ADD COLUMN IF NOT EXISTS "manual_whatsapp_message_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "manual_whatsapp_message_e_n" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "manual_whatsapp_number",
      DROP COLUMN IF EXISTS "angola_whatsapp_number",
      DROP COLUMN IF EXISTS "portugal_whatsapp_number",
      DROP COLUMN IF EXISTS "manual_whatsapp_message_p_t",
      DROP COLUMN IF EXISTS "manual_whatsapp_message_e_n";
  `)
}

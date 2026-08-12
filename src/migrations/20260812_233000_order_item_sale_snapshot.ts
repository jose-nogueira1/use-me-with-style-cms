import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items"
      ADD COLUMN IF NOT EXISTS "regular_unit_price" numeric,
      ADD COLUMN IF NOT EXISTS "sale_discount_amount" numeric,
      ADD COLUMN IF NOT EXISTS "sale_discount_percentage" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items"
      DROP COLUMN IF EXISTS "regular_unit_price",
      DROP COLUMN IF EXISTS "sale_discount_amount",
      DROP COLUMN IF EXISTS "sale_discount_percentage";
  `)
}

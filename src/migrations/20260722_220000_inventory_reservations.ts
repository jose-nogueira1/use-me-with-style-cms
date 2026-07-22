import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "inventory_reservation_status" varchar DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "inventory_reservation_expires_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "inventory_reservation_released_at" timestamp(3) with time zone;

    CREATE INDEX IF NOT EXISTS "orders_inventory_reservation_status_idx"
      ON "orders" USING btree ("inventory_reservation_status");
    CREATE INDEX IF NOT EXISTS "orders_inventory_reservation_expires_at_idx"
      ON "orders" USING btree ("inventory_reservation_expires_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_inventory_reservation_expires_at_idx";
    DROP INDEX IF EXISTS "orders_inventory_reservation_status_idx";
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "inventory_reservation_released_at",
      DROP COLUMN IF EXISTS "inventory_reservation_expires_at",
      DROP COLUMN IF EXISTS "inventory_reservation_status";
  `)
}

import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "portugal_standard_shipping_price" numeric DEFAULT 4.9 NOT NULL,
      ADD COLUMN IF NOT EXISTS "portugal_tracked_shipping_price" numeric DEFAULT 6.9 NOT NULL,
      ADD COLUMN IF NOT EXISTS "portugal_free_shipping_threshold" numeric DEFAULT 75 NOT NULL;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_delivery_region" AS ENUM ('mainland', 'madeira', 'azores');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "delivery_region" "public"."enum_orders_delivery_region",
      ADD COLUMN IF NOT EXISTS "ctt_tracking_code" varchar;

    CREATE INDEX IF NOT EXISTS "orders_ctt_tracking_code_idx" ON "orders" USING btree ("ctt_tracking_code");
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_ctt_tracking_code_idx";
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "delivery_region",
      DROP COLUMN IF EXISTS "ctt_tracking_code";
    DROP TYPE IF EXISTS "public"."enum_orders_delivery_region";
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "portugal_standard_shipping_price",
      DROP COLUMN IF EXISTS "portugal_tracked_shipping_price",
      DROP COLUMN IF EXISTS "portugal_free_shipping_threshold";
  `)
}

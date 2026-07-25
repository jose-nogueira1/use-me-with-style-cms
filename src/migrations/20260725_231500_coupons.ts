import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Discounts phase 2 (2026-07-25): standalone Coupons collection. Not
// relationship-referenced from Orders -- see Coupons.ts / couponPricing.ts
// for why (orders snapshot the plain code string + resolved amount/label).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_coupons_type" AS ENUM('percent', 'fixed');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "coupons" (
      "id" serial PRIMARY KEY NOT NULL,
      "code" varchar NOT NULL,
      "active" boolean DEFAULT true,
      "description" varchar,
      "type" "public"."enum_coupons_type" DEFAULT 'percent' NOT NULL,
      "percent_off" numeric,
      "fixed_off_a_o_kz" numeric,
      "fixed_off_p_t_eur" numeric,
      "min_order_value_a_o_kz" numeric,
      "min_order_value_p_t_eur" numeric,
      "start_date" timestamp(3) with time zone,
      "end_date" timestamp(3) with time zone,
      "usage_limit" numeric,
      "usage_count" numeric DEFAULT 0,
      "max_redemptions_per_email" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons" ("code");
    CREATE INDEX IF NOT EXISTS "coupons_updated_at_idx" ON "coupons" ("updated_at");
    CREATE INDEX IF NOT EXISTS "coupons_created_at_idx" ON "coupons" ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "coupons";
    DROP TYPE IF EXISTS "public"."enum_coupons_type";
  `)
}

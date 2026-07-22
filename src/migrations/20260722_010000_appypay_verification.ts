import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "appy_pay_transaction_id" varchar,
      ADD COLUMN IF NOT EXISTS "appy_pay_status" varchar,
      ADD COLUMN IF NOT EXISTS "appy_pay_payment_method" varchar,
      ADD COLUMN IF NOT EXISTS "appy_pay_response_code" numeric,
      ADD COLUMN IF NOT EXISTS "appy_pay_response_message" varchar,
      ADD COLUMN IF NOT EXISTS "appy_pay_reference_entity" varchar,
      ADD COLUMN IF NOT EXISTS "appy_pay_reference_number" varchar,
      ADD COLUMN IF NOT EXISTS "appy_pay_reference_due_date" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "appy_pay_verified_at" timestamp(3) with time zone;

    CREATE UNIQUE INDEX IF NOT EXISTS "orders_appy_pay_transaction_id_idx"
      ON "orders" USING btree ("appy_pay_transaction_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_appy_pay_transaction_id_idx";
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "appy_pay_verified_at",
      DROP COLUMN IF EXISTS "appy_pay_reference_due_date",
      DROP COLUMN IF EXISTS "appy_pay_reference_number",
      DROP COLUMN IF EXISTS "appy_pay_reference_entity",
      DROP COLUMN IF EXISTS "appy_pay_response_message",
      DROP COLUMN IF EXISTS "appy_pay_response_code",
      DROP COLUMN IF EXISTS "appy_pay_payment_method",
      DROP COLUMN IF EXISTS "appy_pay_status",
      DROP COLUMN IF EXISTS "appy_pay_transaction_id";
  `)
}

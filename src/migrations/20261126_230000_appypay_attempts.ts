import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "orders_appy_pay_attempts" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY NOT NULL,
      "merchant_transaction_id" varchar NOT NULL,
      "transaction_id" varchar NOT NULL,
      "response_code" numeric,
      "response_message" varchar,
      "verified_at" timestamp(3) with time zone,
      "late_success_at" timestamp(3) with time zone
    );
    CREATE INDEX "orders_appy_pay_attempts_order_idx" ON "orders_appy_pay_attempts" ("_order");
    CREATE INDEX "orders_appy_pay_attempts_parent_id_idx" ON "orders_appy_pay_attempts" ("_parent_id");
    CREATE INDEX "orders_appy_pay_attempts_merchant_transaction_id_idx" ON "orders_appy_pay_attempts" ("merchant_transaction_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE "orders_appy_pay_attempts"`)
}

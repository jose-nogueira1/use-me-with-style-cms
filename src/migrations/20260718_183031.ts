import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Brings the original Railway Postgres schema in line with the collections
// added after the initial production migration. The earlier initial migration
// is intentionally a no-op placeholder, so this migration is explicit rather
// than relying on a generated full-schema diff that would recreate existing
// tables.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_orders_payment_method"
      ADD VALUE IF NOT EXISTS 'multicaixa_express';
    ALTER TYPE "public"."enum_orders_delivery_method"
      ADD VALUE IF NOT EXISTS 'courier_ao';

    DO $$ BEGIN
      CREATE TYPE "public"."enum_invoices_status" AS ENUM('issued', 'failed');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_market_settings_angola_payment_methods"
        AS ENUM('multicaixa_express', 'stripe', 'paypal');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_market_settings_angola_delivery_methods"
        AS ENUM('courier_ao');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "available_a_o" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "available_p_t" boolean DEFAULT true;

    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "address_line2" varchar,
      ADD COLUMN IF NOT EXISTS "postal_code" varchar,
      ADD COLUMN IF NOT EXISTS "tax_id" varchar,
      ADD COLUMN IF NOT EXISTS "appy_pay_merchant_transaction_id" varchar;

    CREATE UNIQUE INDEX IF NOT EXISTS "orders_appy_pay_merchant_transaction_id_idx"
      ON "orders" USING btree ("appy_pay_merchant_transaction_id");

    CREATE TABLE IF NOT EXISTS "invoices" (
      "id" serial PRIMARY KEY NOT NULL,
      "related_order_id" integer NOT NULL,
      "status" "enum_invoices_status" NOT NULL,
      "moloni_document_id" numeric,
      "moloni_number" varchar,
      "total" numeric,
      "currency" varchar,
      "customer_name" varchar,
      "customer_email" varchar,
      "error_message" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric,
      "focal_x" numeric,
      "focal_y" numeric
    );

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "invoices_id" integer;

    CREATE TABLE IF NOT EXISTS "market_settings_angola_payment_methods" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_market_settings_angola_payment_methods",
      "id" serial PRIMARY KEY NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "market_settings_angola_delivery_methods" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_market_settings_angola_delivery_methods",
      "id" serial PRIMARY KEY NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_order_id_orders_id_fk"
        FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk"
        FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "market_settings_angola_payment_methods"
        ADD CONSTRAINT "market_settings_angola_payment_methods_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."market_settings"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "market_settings_angola_delivery_methods"
        ADD CONSTRAINT "market_settings_angola_delivery_methods_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."market_settings"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "invoices_related_order_idx" ON "invoices" ("related_order_id");
    CREATE INDEX IF NOT EXISTS "invoices_updated_at_idx" ON "invoices" ("updated_at");
    CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices" ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "invoices_filename_idx" ON "invoices" ("filename");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_invoices_id_idx"
      ON "payload_locked_documents_rels" ("invoices_id");
    CREATE INDEX IF NOT EXISTS "market_settings_angola_payment_methods_order_idx"
      ON "market_settings_angola_payment_methods" ("order");
    CREATE INDEX IF NOT EXISTS "market_settings_angola_payment_methods_parent_idx"
      ON "market_settings_angola_payment_methods" ("parent_id");
    CREATE INDEX IF NOT EXISTS "market_settings_angola_delivery_methods_order_idx"
      ON "market_settings_angola_delivery_methods" ("order");
    CREATE INDEX IF NOT EXISTS "market_settings_angola_delivery_methods_parent_idx"
      ON "market_settings_angola_delivery_methods" ("parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "market_settings_angola_delivery_methods" CASCADE;
    DROP TABLE IF EXISTS "market_settings_angola_payment_methods" CASCADE;
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "invoices_id";
    DROP TABLE IF EXISTS "invoices" CASCADE;
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "appy_pay_merchant_transaction_id",
      DROP COLUMN IF EXISTS "tax_id",
      DROP COLUMN IF EXISTS "postal_code",
      DROP COLUMN IF EXISTS "address_line2";
    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "available_p_t",
      DROP COLUMN IF EXISTS "available_a_o";
    DROP TYPE IF EXISTS "public"."enum_market_settings_angola_delivery_methods";
    DROP TYPE IF EXISTS "public"."enum_market_settings_angola_payment_methods";
    DROP TYPE IF EXISTS "public"."enum_invoices_status";
    -- PostgreSQL enum values cannot be removed safely in-place. The added
    -- order enum values intentionally remain after rollback.
  `)
}

import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_invoices_market" AS ENUM('AO', 'PT');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "invoice_number" varchar,
      ADD COLUMN IF NOT EXISTS "sequence" numeric DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "year" numeric DEFAULT 2026,
      ADD COLUMN IF NOT EXISTS "market" "enum_invoices_market" DEFAULT 'PT',
      ADD COLUMN IF NOT EXISTS "issued_at" timestamp(3) with time zone DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "order_number" varchar DEFAULT 'LEGACY',
      ADD COLUMN IF NOT EXISTS "issuer_name" varchar DEFAULT 'Use Me With Style',
      ADD COLUMN IF NOT EXISTS "issuer_tax_id" varchar,
      ADD COLUMN IF NOT EXISTS "issuer_address" varchar,
      ADD COLUMN IF NOT EXISTS "customer_phone" varchar,
      ADD COLUMN IF NOT EXISTS "customer_tax_id" varchar,
      ADD COLUMN IF NOT EXISTS "customer_address" varchar,
      ADD COLUMN IF NOT EXISTS "vat_rate" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_note" varchar,
      ADD COLUMN IF NOT EXISTS "subtotal" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "shipping" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "net_total" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_total" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "payment_method" varchar,
      ADD COLUMN IF NOT EXISTS "payment_reference" varchar,
      ADD COLUMN IF NOT EXISTS "disclaimer" varchar DEFAULT 'Documento comercial interno, não certificado fiscalmente.',
      ADD COLUMN IF NOT EXISTS "footer" varchar,
      ADD COLUMN IF NOT EXISTS "pdf_filename" varchar,
      ADD COLUMN IF NOT EXISTS "pdf_data" jsonb;

    UPDATE "invoices"
      SET "invoice_number" = COALESCE("invoice_number", 'LEGACY-' || "id"::text)
      WHERE "invoice_number" IS NULL;

    ALTER TABLE "invoices"
      ALTER COLUMN "invoice_number" SET NOT NULL,
      ALTER COLUMN "sequence" SET NOT NULL,
      ALTER COLUMN "year" SET NOT NULL,
      ALTER COLUMN "market" SET NOT NULL,
      ALTER COLUMN "issued_at" SET NOT NULL,
      ALTER COLUMN "order_number" SET NOT NULL,
      ALTER COLUMN "issuer_name" SET NOT NULL,
      ALTER COLUMN "vat_rate" SET NOT NULL,
      ALTER COLUMN "subtotal" SET NOT NULL,
      ALTER COLUMN "shipping" SET NOT NULL,
      ALTER COLUMN "net_total" SET NOT NULL,
      ALTER COLUMN "tax_total" SET NOT NULL,
      ALTER COLUMN "disclaimer" SET NOT NULL;

    CREATE TABLE IF NOT EXISTS "invoices_lines" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "description" varchar NOT NULL,
      "quantity" numeric NOT NULL,
      "unit_price" numeric NOT NULL,
      "net_amount" numeric NOT NULL,
      "tax_amount" numeric NOT NULL,
      "gross_amount" numeric NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "invoice_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "phase_one_disclaimer" varchar DEFAULT 'Documento comercial interno, não certificado fiscalmente. Deve ser validado e tratado pelo contabilista da entidade emitente.' NOT NULL,
      "invoicing_enabled_a_o" boolean DEFAULT true,
      "issuer_name_a_o" varchar DEFAULT 'Use Me With Style',
      "issuer_tax_id_a_o" varchar,
      "issuer_address_a_o" varchar,
      "vat_rate_a_o" numeric DEFAULT 0,
      "tax_note_a_o" varchar,
      "invoice_prefix_a_o" varchar DEFAULT 'UMWS-AO',
      "invoice_footer_a_o" varchar,
      "invoicing_enabled_p_t" boolean DEFAULT true,
      "issuer_name_p_t" varchar DEFAULT 'Use Me With Style',
      "issuer_tax_id_p_t" varchar,
      "issuer_address_p_t" varchar,
      "vat_rate_p_t" numeric DEFAULT 0,
      "tax_note_p_t" varchar,
      "invoice_prefix_p_t" varchar DEFAULT 'UMWS-PT',
      "invoice_footer_p_t" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );

    DO $$ BEGIN
      ALTER TABLE "invoices_lines"
        ADD CONSTRAINT "invoices_lines_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."invoices"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DROP INDEX IF EXISTS "invoices_related_order_idx";
    CREATE UNIQUE INDEX "invoices_related_order_idx" ON "invoices" ("related_order_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_idx" ON "invoices" ("invoice_number");
    CREATE INDEX IF NOT EXISTS "invoices_sequence_idx" ON "invoices" ("sequence");
    CREATE INDEX IF NOT EXISTS "invoices_year_idx" ON "invoices" ("year");
    CREATE INDEX IF NOT EXISTS "invoices_market_idx" ON "invoices" ("market");
    CREATE INDEX IF NOT EXISTS "invoices_issued_at_idx" ON "invoices" ("issued_at");
    CREATE INDEX IF NOT EXISTS "invoices_lines_order_idx" ON "invoices_lines" ("_order");
    CREATE INDEX IF NOT EXISTS "invoices_lines_parent_idx" ON "invoices_lines" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "invoice_settings" CASCADE;
    DROP TABLE IF EXISTS "invoices_lines" CASCADE;
    DROP INDEX IF EXISTS "invoices_invoice_number_idx";
    DROP INDEX IF EXISTS "invoices_sequence_idx";
    DROP INDEX IF EXISTS "invoices_year_idx";
    DROP INDEX IF EXISTS "invoices_market_idx";
    DROP INDEX IF EXISTS "invoices_issued_at_idx";
    ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "pdf_data",
      DROP COLUMN IF EXISTS "pdf_filename",
      DROP COLUMN IF EXISTS "footer",
      DROP COLUMN IF EXISTS "disclaimer",
      DROP COLUMN IF EXISTS "payment_reference",
      DROP COLUMN IF EXISTS "payment_method",
      DROP COLUMN IF EXISTS "tax_total",
      DROP COLUMN IF EXISTS "net_total",
      DROP COLUMN IF EXISTS "shipping",
      DROP COLUMN IF EXISTS "subtotal",
      DROP COLUMN IF EXISTS "tax_note",
      DROP COLUMN IF EXISTS "vat_rate",
      DROP COLUMN IF EXISTS "customer_address",
      DROP COLUMN IF EXISTS "customer_tax_id",
      DROP COLUMN IF EXISTS "customer_phone",
      DROP COLUMN IF EXISTS "issuer_address",
      DROP COLUMN IF EXISTS "issuer_tax_id",
      DROP COLUMN IF EXISTS "issuer_name",
      DROP COLUMN IF EXISTS "order_number",
      DROP COLUMN IF EXISTS "issued_at",
      DROP COLUMN IF EXISTS "market",
      DROP COLUMN IF EXISTS "year",
      DROP COLUMN IF EXISTS "sequence",
      DROP COLUMN IF EXISTS "invoice_number";
    DROP TYPE IF EXISTS "public"."enum_invoices_market";
  `)
}

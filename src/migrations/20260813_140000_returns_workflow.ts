import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_market" AS ENUM('AO','PT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_currency" AS ENUM('Kz','EUR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_lang" AS ENUM('pt','en'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_status" AS ENUM('requested','approved','awaiting_item','received','inspected','resolved','rejected','customer_cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_resolution" AS ENUM('refund','exchange','store_credit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_reason" AS ENUM('wrong_size','wrong_colour','changed_mind','defective','incorrect_item','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_return_shipping_payer" AS ENUM('customer','use_me'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_returns_refund_status" AS ENUM('not_required','pending','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS "returns" (
      "id" serial PRIMARY KEY NOT NULL, "return_number" varchar NOT NULL, "order_id" integer NOT NULL,
      "order_number" varchar NOT NULL, "market" "public"."enum_returns_market" NOT NULL, "currency" "public"."enum_returns_currency" NOT NULL,
      "customer_name" varchar NOT NULL, "customer_email" varchar NOT NULL, "customer_phone" varchar,
      "lang" "public"."enum_returns_lang" DEFAULT 'pt', "status" "public"."enum_returns_status" DEFAULT 'requested' NOT NULL,
      "resolution" "public"."enum_returns_resolution" NOT NULL, "reason" "public"."enum_returns_reason" NOT NULL,
      "customer_note" varchar, "internal_note" varchar, "return_shipping_payer" "public"."enum_returns_return_shipping_payer" DEFAULT 'customer',
      "items" jsonb NOT NULL, "requested_amount" numeric NOT NULL, "approved_amount" numeric,
      "refund_status" "public"."enum_returns_refund_status" DEFAULT 'not_required', "refund_reference" varchar,
      "store_credit_code" varchar, "replacement_order_id" integer, "inventory_restocked_at" timestamp(3) with time zone,
      "resolved_at" timestamp(3) with time zone, "status_history" jsonb, "customer_last_notified_status" varchar,
      "phase2_self_service_note" varchar DEFAULT 'Phase 2: customer self-service return request form with secure identity verification and photo upload.',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict,
      CONSTRAINT "returns_replacement_order_id_orders_id_fk" FOREIGN KEY ("replacement_order_id") REFERENCES "public"."orders"("id") ON DELETE set null
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "returns_return_number_idx" ON "returns" ("return_number");
    CREATE INDEX IF NOT EXISTS "returns_order_idx" ON "returns" ("order_id");
    CREATE INDEX IF NOT EXISTS "returns_status_idx" ON "returns" ("status");
    CREATE INDEX IF NOT EXISTS "returns_created_at_idx" ON "returns" ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "returns_id" integer REFERENCES "public"."returns"("id") ON DELETE cascade;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_returns_id_idx" ON "payload_locked_documents_rels" ("returns_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "returns_id";
    DROP TABLE IF EXISTS "returns";
    DROP TYPE IF EXISTS "public"."enum_returns_refund_status"; DROP TYPE IF EXISTS "public"."enum_returns_return_shipping_payer";
    DROP TYPE IF EXISTS "public"."enum_returns_reason"; DROP TYPE IF EXISTS "public"."enum_returns_resolution";
    DROP TYPE IF EXISTS "public"."enum_returns_status"; DROP TYPE IF EXISTS "public"."enum_returns_lang";
    DROP TYPE IF EXISTS "public"."enum_returns_currency"; DROP TYPE IF EXISTS "public"."enum_returns_market";
  `)
}

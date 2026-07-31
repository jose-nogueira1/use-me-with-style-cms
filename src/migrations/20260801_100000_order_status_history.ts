import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Status-change audit trail (2026-08-01 request: "who changed what, when"
// once more than one admin touches an order). An array field on Orders
// (see Orders.ts's `statusHistory`), same mechanism `items` already uses --
// a child table Payload manages itself, following the exact shape/naming
// convention `invoices_lines` already established in this repo
// (20260720_120500_internal_invoicing.ts) for a different collection's
// array field: `_order`/`_parent_id`/`id` plus the field's own columns.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "orders_status_history" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "status" varchar NOT NULL,
      "changed_at" timestamp(3) with time zone NOT NULL,
      "changed_by" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "orders_status_history"
        ADD CONSTRAINT "orders_status_history_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "orders_status_history_order_idx" ON "orders_status_history" ("_order");
    CREATE INDEX IF NOT EXISTS "orders_status_history_parent_idx" ON "orders_status_history" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "orders_status_history" CASCADE;
  `)
}

import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// New global (2026-08-02, Jay-P: "curate instead of latest N" for the
// homepage Instagram feed section). Single-row parent table (same shape as
// every other Settings global) plus a child table for the ordered
// `entries` array, following the exact `_order`/`_parent_id`/`id` shape
// `orders_status_history` established (20260801_100000_order_status_history.ts)
// for a Payload-managed array field.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "instagram_spotlight" (
      "id" serial PRIMARY KEY NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now(),
      "created_at" timestamp(3) with time zone DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_updated_at_idx" ON "instagram_spotlight" ("updated_at");
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_created_at_idx" ON "instagram_spotlight" ("created_at");

    CREATE TABLE IF NOT EXISTS "instagram_spotlight_entries" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "permalink" varchar NOT NULL,
      "label_p_t" varchar,
      "label_e_n" varchar,
      "size" varchar DEFAULT 'regular'
    );

    DO $$ BEGIN
      ALTER TABLE "instagram_spotlight_entries"
        ADD CONSTRAINT "instagram_spotlight_entries_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."instagram_spotlight"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "instagram_spotlight_entries_order_idx" ON "instagram_spotlight_entries" ("_order");
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_entries_parent_idx" ON "instagram_spotlight_entries" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "instagram_spotlight_entries" CASCADE;
    DROP TABLE IF EXISTS "instagram_spotlight" CASCADE;
  `)
}

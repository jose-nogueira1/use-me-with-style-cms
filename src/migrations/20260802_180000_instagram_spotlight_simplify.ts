import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Simplifies the Instagram Spotlight global the same day it was first added
// (20260802_150000_instagram_spotlight.ts) -- Jay-P tried the ordered/
// labelled curation-list version and found it overkill: "just show the most
// recent 12 posts and allow me to choose the highlighted post." Down to one
// field: which post (if any) gets the large tile. The `entries` array and
// its child table are no longer needed at all.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "instagram_spotlight_entries" CASCADE;
    ALTER TABLE "instagram_spotlight" ADD COLUMN IF NOT EXISTS "highlighted_permalink" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "instagram_spotlight" DROP COLUMN IF EXISTS "highlighted_permalink";

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

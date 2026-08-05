import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "instagram_spotlight_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_rels_parent_idx" ON "instagram_spotlight_rels" ("parent_id");
    DO $$ BEGIN
      ALTER TABLE "instagram_spotlight_rels"
        ADD CONSTRAINT "instagram_spotlight_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."instagram_spotlight"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "instagram_spotlight_rels" CASCADE`)
}

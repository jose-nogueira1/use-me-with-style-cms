import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/** Adds product-tag assignments scoped to one storefront. The existing
 * products_rels/tag relationship remains the shared-both-markets source. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "products_market_tags" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tag_id" integer NOT NULL,
      "market" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "products_market_tags_order_idx" ON "products_market_tags" ("_order");
    CREATE INDEX IF NOT EXISTS "products_market_tags_parent_id_idx" ON "products_market_tags" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "products_market_tags_tag_idx" ON "products_market_tags" ("tag_id");
    CREATE INDEX IF NOT EXISTS "products_market_tags_market_idx" ON "products_market_tags" ("market");
    DO $$ BEGIN
      ALTER TABLE "products_market_tags" ADD CONSTRAINT "products_market_tags_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "products_market_tags" ADD CONSTRAINT "products_market_tags_tag_id_fk"
        FOREIGN KEY ("tag_id") REFERENCES "merch_tags"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "products_market_tags" CASCADE`)
}

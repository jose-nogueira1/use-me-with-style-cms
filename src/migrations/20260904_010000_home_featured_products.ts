import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Adds the ordered, market-specific product relationships used by the
// storefront's curated Featured shelf. The existing tag-driven collections
// remain untouched.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "home_collections" ADD COLUMN IF NOT EXISTS "featured_title_p_t" varchar DEFAULT 'Destaques';
    ALTER TABLE "home_collections" ADD COLUMN IF NOT EXISTS "featured_title_e_n" varchar DEFAULT 'Featured';
    ALTER TABLE "home_collections" ADD COLUMN IF NOT EXISTS "featured_item_limit" numeric DEFAULT 8;

    CREATE TABLE IF NOT EXISTS "home_collections_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );
    CREATE INDEX IF NOT EXISTS "home_collections_rels_order_idx" ON "home_collections_rels" ("order");
    CREATE INDEX IF NOT EXISTS "home_collections_rels_parent_idx" ON "home_collections_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "home_collections_rels_path_idx" ON "home_collections_rels" ("path");
    CREATE INDEX IF NOT EXISTS "home_collections_rels_products_idx" ON "home_collections_rels" ("products_id");
    DO $$ BEGIN
      ALTER TABLE "home_collections_rels" ADD CONSTRAINT "home_collections_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."home_collections"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "home_collections_rels" ADD CONSTRAINT "home_collections_rels_products_fk"
        FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "_home_collections_v" ADD COLUMN IF NOT EXISTS "version_featured_title_p_t" varchar;
    ALTER TABLE "_home_collections_v" ADD COLUMN IF NOT EXISTS "version_featured_title_e_n" varchar;
    ALTER TABLE "_home_collections_v" ADD COLUMN IF NOT EXISTS "version_featured_item_limit" numeric DEFAULT 8;
    CREATE TABLE IF NOT EXISTS "_home_collections_v_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );
    CREATE INDEX IF NOT EXISTS "_home_collections_v_rels_parent_idx" ON "_home_collections_v_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "_home_collections_v_rels_path_idx" ON "_home_collections_v_rels" ("path");
    CREATE INDEX IF NOT EXISTS "_home_collections_v_rels_products_idx" ON "_home_collections_v_rels" ("products_id");
    DO $$ BEGIN
      ALTER TABLE "_home_collections_v_rels" ADD CONSTRAINT "_home_collections_v_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."_home_collections_v"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "_home_collections_v_rels" ADD CONSTRAINT "_home_collections_v_rels_products_fk"
        FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_home_collections_v_rels" CASCADE;
    DROP TABLE IF EXISTS "home_collections_rels" CASCADE;
    ALTER TABLE "_home_collections_v" DROP COLUMN IF EXISTS "version_featured_title_p_t";
    ALTER TABLE "_home_collections_v" DROP COLUMN IF EXISTS "version_featured_title_e_n";
    ALTER TABLE "_home_collections_v" DROP COLUMN IF EXISTS "version_featured_item_limit";
    ALTER TABLE "home_collections" DROP COLUMN IF EXISTS "featured_title_p_t";
    ALTER TABLE "home_collections" DROP COLUMN IF EXISTS "featured_title_e_n";
    ALTER TABLE "home_collections" DROP COLUMN IF EXISTS "featured_item_limit";
  `)
}

import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Catalogue taxonomies (2026-07-25 admin request): categories, merchandising
// tags, and colours become admin-managed collections instead of hardcoded
// selects / free text.
//
// Data mapping (lossless for everything live in prod on 2026-07-25):
// - products.category (enum) -> categories rows seeded with the SAME slugs
//   (vestidos/tops/leggings/conjuntos), then products.category_id backfilled
//   by slug. Storefront ?cat= URLs keep working because they key on slug.
// - products.tag (enum NOVIDADE/BESTSELLER/QUASE ESGOTADO) -> merch_tags
//   rows, matched case-insensitively on the Portuguese label.
// - products_colors (free-text array table) -> distinct names become rows in
//   the new colors table (hex/swatch left empty for the admin to fill in),
//   and per-product rows become products_rels entries (Payload's storage for
//   hasMany relationships), preserving order.
//
// Column naming follows Payload's identifier mapper, which preserves capital
// boundaries: namePT -> name_p_t (see 20260722_152800 for the lesson learned).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name_p_t" varchar NOT NULL,
      "name_e_n" varchar,
      "slug" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");
    CREATE INDEX IF NOT EXISTS "categories_updated_at_idx" ON "categories" ("updated_at");
    CREATE INDEX IF NOT EXISTS "categories_created_at_idx" ON "categories" ("created_at");

    CREATE TABLE IF NOT EXISTS "merch_tags" (
      "id" serial PRIMARY KEY NOT NULL,
      "label_p_t" varchar NOT NULL,
      "label_e_n" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "merch_tags_updated_at_idx" ON "merch_tags" ("updated_at");
    CREATE INDEX IF NOT EXISTS "merch_tags_created_at_idx" ON "merch_tags" ("created_at");

    CREATE TABLE IF NOT EXISTS "colors" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "hex" varchar,
      "swatch_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "colors_name_idx" ON "colors" ("name");
    CREATE INDEX IF NOT EXISTS "colors_updated_at_idx" ON "colors" ("updated_at");
    CREATE INDEX IF NOT EXISTS "colors_created_at_idx" ON "colors" ("created_at");

    DO $$ BEGIN
      ALTER TABLE "colors" ADD CONSTRAINT "colors_swatch_id_media_id_fk"
        FOREIGN KEY ("swatch_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    -- Seed the previous enum values so existing data maps 1:1.
    INSERT INTO "categories" ("name_p_t", "name_e_n", "slug") VALUES
      ('Vestidos', 'Dresses', 'vestidos'),
      ('Tops', 'Tops', 'tops'),
      ('Leggings', 'Leggings', 'leggings'),
      ('Conjuntos', 'Sets', 'conjuntos')
    ON CONFLICT ("slug") DO NOTHING;

    INSERT INTO "merch_tags" ("label_p_t", "label_e_n")
    SELECT v.pt, v.en
    FROM (VALUES
      ('Novidade', 'New'),
      ('Bestseller', 'Bestseller'),
      ('Quase esgotado', 'Almost gone')
    ) AS v(pt, en)
    WHERE NOT EXISTS (SELECT 1 FROM "merch_tags" t WHERE t."label_p_t" = v.pt);

    INSERT INTO "colors" ("name")
    SELECT DISTINCT trim("color")
    FROM "products_colors"
    WHERE trim(coalesce("color", '')) <> ''
    ON CONFLICT ("name") DO NOTHING;

    -- Products: enum columns -> relationship id columns.
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "category_id" integer,
      ADD COLUMN IF NOT EXISTS "tag_id" integer;

    UPDATE "products" p
      SET "category_id" = c."id"
      FROM "categories" c
      WHERE p."category_id" IS NULL AND c."slug" = p."category"::text;

    -- Safety net: anything unmatched (shouldn't exist) lands in Vestidos
    -- rather than violating NOT NULL.
    UPDATE "products"
      SET "category_id" = (SELECT "id" FROM "categories" WHERE "slug" = 'vestidos')
      WHERE "category_id" IS NULL;

    ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;

    UPDATE "products" p
      SET "tag_id" = t."id"
      FROM "merch_tags" t
      WHERE p."tag_id" IS NULL AND p."tag" IS NOT NULL AND upper(t."label_p_t") = p."tag"::text;

    DO $$ BEGIN
      ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "products" ADD CONSTRAINT "products_tag_id_merch_tags_id_fk"
        FOREIGN KEY ("tag_id") REFERENCES "merch_tags"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");
    CREATE INDEX IF NOT EXISTS "products_tag_idx" ON "products" ("tag_id");

    -- hasMany relationship storage for products.colors.
    CREATE TABLE IF NOT EXISTS "products_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "colors_id" integer
    );
    CREATE INDEX IF NOT EXISTS "products_rels_order_idx" ON "products_rels" ("order");
    CREATE INDEX IF NOT EXISTS "products_rels_parent_idx" ON "products_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "products_rels_path_idx" ON "products_rels" ("path");
    CREATE INDEX IF NOT EXISTS "products_rels_colors_id_idx" ON "products_rels" ("colors_id");
    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_colors_fk"
        FOREIGN KEY ("colors_id") REFERENCES "colors"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    INSERT INTO "products_rels" ("order", "parent_id", "path", "colors_id")
    SELECT pc."_order", pc."_parent_id", 'colors', c."id"
    FROM "products_colors" pc
    JOIN "colors" c ON c."name" = trim(pc."color")
    WHERE NOT EXISTS (
      SELECT 1 FROM "products_rels" r
      WHERE r."parent_id" = pc."_parent_id" AND r."path" = 'colors' AND r."colors_id" = c."id"
    );

    -- Old storage, now fully converted.
    DROP TABLE IF EXISTS "products_colors";
    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "category",
      DROP COLUMN IF EXISTS "tag";
    DROP TYPE IF EXISTS "enum_products_category";
    DROP TYPE IF EXISTS "enum_products_tag";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_category" AS ENUM('vestidos', 'tops', 'leggings', 'conjuntos');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_tag" AS ENUM('NOVIDADE', 'BESTSELLER', 'QUASE ESGOTADO');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "category" "enum_products_category",
      ADD COLUMN IF NOT EXISTS "tag" "enum_products_tag";

    UPDATE "products" p
      SET "category" = c."slug"::"enum_products_category"
      FROM "categories" c
      WHERE c."id" = p."category_id" AND c."slug" IN ('vestidos', 'tops', 'leggings', 'conjuntos');
    UPDATE "products" SET "category" = 'vestidos' WHERE "category" IS NULL;
    ALTER TABLE "products" ALTER COLUMN "category" SET NOT NULL;

    UPDATE "products" p
      SET "tag" = upper(t."label_p_t")::"enum_products_tag"
      FROM "merch_tags" t
      WHERE t."id" = p."tag_id" AND upper(t."label_p_t") IN ('NOVIDADE', 'BESTSELLER', 'QUASE ESGOTADO');

    CREATE TABLE IF NOT EXISTS "products_colors" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "color" varchar NOT NULL
    );

    INSERT INTO "products_colors" ("_order", "_parent_id", "id", "color")
    SELECT coalesce(r."order", 1), r."parent_id", r."parent_id" || '-color-' || r."id", c."name"
    FROM "products_rels" r
    JOIN "colors" c ON c."id" = r."colors_id"
    WHERE r."path" = 'colors';

    DELETE FROM "products_rels" WHERE "path" = 'colors';
    DROP TABLE IF EXISTS "products_rels";

    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "category_id",
      DROP COLUMN IF EXISTS "tag_id";

    DROP TABLE IF EXISTS "colors";
    DROP TABLE IF EXISTS "merch_tags";
    DROP TABLE IF EXISTS "categories";
  `)
}

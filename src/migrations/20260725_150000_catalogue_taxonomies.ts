import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { PT_COLOR_HEX } from '../lib/colorPresets'

// Catalogue taxonomies + variant inventory + shared size guides
// (2026-07-25 admin requests, consolidated into ONE migration because none
// of the intermediate states ever reached production):
//
// 1. categories / merch_tags / colors become admin-managed collections
//    (were a hardcoded select, a hardcoded select, and free text).
// 2. Stock moves from per-size rows (products_sizes) to per-COLOUR+SIZE
//    variant rows (products_variants).
// 3. size_guides: shared measurement charts (cm, language-neutral),
//    replacing the free-text size_guide_p_t/e_n columns added earlier the
//    same week by 20260725_090000.
//
// Data mapping (lossless for everything live in prod):
// - products.category (enum) -> categories rows seeded with the SAME slugs,
//   so storefront ?cat= URLs survive; products.category_id backfilled.
// - products.tag (enum) -> merch_tags rows, matched on upper(label_p_t).
// - products_colors free text -> distinct rows in colors (hex/swatch left
//   for the admin to fill in).
// - products_sizes x product colours -> products_variants. The product's
//   FIRST colour inherits the existing per-size stock; additional colours
//   get 0-stock rows for the same sizes (stock was never tracked per
//   colour before, so there is nothing truthful to split -- the admin
//   redistributes counts in the new matrix editor).
// - Old free-text size guides are dropped (fields were days old; prod has
//   no meaningful data in them).
//
// Column naming follows Payload's identifier mapper, which preserves
// capital boundaries: namePT -> name_p_t (see 20260722_152800).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ---------------------------------------------------------------
    -- Taxonomy tables
    -- ---------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name_p_t" varchar NOT NULL,
      "name_e_n" varchar,
      "slug" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    -- 2026-07-28 incident: CREATE TABLE IF NOT EXISTS silently no-ops if a
    -- table by this name already exists -- it does NOT add missing columns.
    -- An earlier, narrower version of this migration's SQL already created
    -- categories/merch_tags/colors in prod (with data), but WITHOUT some of
    -- the columns this expanded version expects, crashing every deploy
    -- since ("column ... does not exist"). Defensively add anything that
    -- might be missing before any statement below references it.
    ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "name_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "name_e_n" varchar,
      ADD COLUMN IF NOT EXISTS "slug" varchar,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now();
    UPDATE "categories" SET "name_p_t" = 'Sem nome' WHERE "name_p_t" IS NULL;
    ALTER TABLE "categories" ALTER COLUMN "name_p_t" SET NOT NULL;
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
    ALTER TABLE "merch_tags"
      ADD COLUMN IF NOT EXISTS "label_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "label_e_n" varchar,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now();
    UPDATE "merch_tags" SET "label_p_t" = 'Sem etiqueta' WHERE "label_p_t" IS NULL;
    ALTER TABLE "merch_tags" ALTER COLUMN "label_p_t" SET NOT NULL;
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
    ALTER TABLE "colors"
      ADD COLUMN IF NOT EXISTS "name" varchar,
      ADD COLUMN IF NOT EXISTS "hex" varchar,
      ADD COLUMN IF NOT EXISTS "swatch_id" integer,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now();
    UPDATE "colors" SET "name" = 'cor-' || "id" WHERE "name" IS NULL;
    ALTER TABLE "colors" ALTER COLUMN "name" SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "colors_name_idx" ON "colors" ("name");
    CREATE INDEX IF NOT EXISTS "colors_swatch_idx" ON "colors" ("swatch_id");
    CREATE INDEX IF NOT EXISTS "colors_updated_at_idx" ON "colors" ("updated_at");
    CREATE INDEX IF NOT EXISTS "colors_created_at_idx" ON "colors" ("created_at");
    DO $$ BEGIN
      ALTER TABLE "colors" ADD CONSTRAINT "colors_swatch_id_media_id_fk"
        FOREIGN KEY ("swatch_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "size_guides" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "size_guides"
      ADD COLUMN IF NOT EXISTS "name" varchar,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now();
    UPDATE "size_guides" SET "name" = 'guia-' || "id" WHERE "name" IS NULL;
    ALTER TABLE "size_guides" ALTER COLUMN "name" SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "size_guides_name_idx" ON "size_guides" ("name");
    CREATE INDEX IF NOT EXISTS "size_guides_updated_at_idx" ON "size_guides" ("updated_at");
    CREATE INDEX IF NOT EXISTS "size_guides_created_at_idx" ON "size_guides" ("created_at");

    DO $$ BEGIN
      CREATE TYPE "public"."enum_size_guides_rows_size" AS ENUM('XS', 'S', 'M', 'L', 'XL');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE TABLE IF NOT EXISTS "size_guides_rows" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "size" "enum_size_guides_rows_size" NOT NULL,
      "bust" numeric,
      "waist" numeric,
      "hip" numeric,
      "length" numeric
    );
    CREATE INDEX IF NOT EXISTS "size_guides_rows_order_idx" ON "size_guides_rows" ("_order");
    CREATE INDEX IF NOT EXISTS "size_guides_rows_parent_id_idx" ON "size_guides_rows" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "size_guides_rows" ADD CONSTRAINT "size_guides_rows_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "size_guides"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    -- ---------------------------------------------------------------
    -- Seed the previous enum values so existing data maps 1:1
    -- ---------------------------------------------------------------
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

    -- 2026-07-28 incident: an earlier, further-along partial run of this
    -- migration already dropped products_colors/products_sizes (they're
    -- dropped near the end of this same file) without ever completing/
    -- being recorded as applied -- confirmed via prod error "relation
    -- products_colors does not exist". Guard every reference to these two
    -- old tables so this migration also succeeds from THAT partial state,
    -- not just from a clean/no-op state.
    DO $$ BEGIN
      IF to_regclass('public.products_colors') IS NOT NULL THEN
        INSERT INTO "colors" ("name")
        SELECT DISTINCT trim("color")
        FROM "products_colors"
        WHERE trim(coalesce("color", '')) <> ''
        ON CONFLICT ("name") DO NOTHING;
      END IF;
    END $$;

    -- Best-guess hex for colours whose name is a recognised Portuguese
    -- colour word (see lib/colorPresets.ts) -- these are literal colour
    -- names, so an empty swatch was never a meaningful default. Still
    -- fully editable afterwards; unrecognised names keep hex = NULL.
    ${sql.raw(
      Object.entries(PT_COLOR_HEX)
        .map(([name, hex]) => `UPDATE "colors" SET "hex" = '${hex}' WHERE "hex" IS NULL AND lower(trim("name")) = '${name.replace(/'/g, "''")}';`)
        .join('\n    '),
    )}

    -- ---------------------------------------------------------------
    -- Products: enum columns -> relationship columns; size guide fields
    -- ---------------------------------------------------------------
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "category_id" integer,
      ADD COLUMN IF NOT EXISTS "tag_id" integer,
      ADD COLUMN IF NOT EXISTS "size_guide_id" integer,
      ADD COLUMN IF NOT EXISTS "fit_note_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "fit_note_e_n" varchar;

    UPDATE "products" p
      SET "category_id" = c."id"
      FROM "categories" c
      WHERE p."category_id" IS NULL AND c."slug" = p."category"::text;
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
    DO $$ BEGIN
      ALTER TABLE "products" ADD CONSTRAINT "products_size_guide_id_size_guides_id_fk"
        FOREIGN KEY ("size_guide_id") REFERENCES "size_guides"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");
    CREATE INDEX IF NOT EXISTS "products_tag_idx" ON "products" ("tag_id");
    CREATE INDEX IF NOT EXISTS "products_size_guide_idx" ON "products" ("size_guide_id");

    -- ---------------------------------------------------------------
    -- Variant inventory: products_sizes x colours -> products_variants
    -- ---------------------------------------------------------------
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_variants_size" AS ENUM('XS', 'S', 'M', 'L', 'XL');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE TABLE IF NOT EXISTS "products_variants" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "color_id" integer NOT NULL,
      "size" "enum_products_variants_size" NOT NULL,
      "stock_a_o" numeric DEFAULT 0 NOT NULL,
      "stock_p_t" numeric DEFAULT 0 NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "products_variants_order_idx" ON "products_variants" ("_order");
    CREATE INDEX IF NOT EXISTS "products_variants_parent_id_idx" ON "products_variants" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "products_variants_color_idx" ON "products_variants" ("color_id");
    DO $$ BEGIN
      ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_color_id_colors_id_fk"
        FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      IF to_regclass('public.products_sizes') IS NOT NULL AND to_regclass('public.products_colors') IS NOT NULL THEN
        INSERT INTO "products_variants" ("_order", "_parent_id", "id", "color_id", "size", "stock_a_o", "stock_p_t")
        WITH pcolors AS (
          SELECT pc."_parent_id" AS parent_id,
                 col."id" AS color_id,
                 ROW_NUMBER() OVER (PARTITION BY pc."_parent_id" ORDER BY pc."_order") AS color_rank
          FROM "products_colors" pc
          JOIN "colors" col ON col."name" = trim(pc."color")
        )
        SELECT ROW_NUMBER() OVER (PARTITION BY ps."_parent_id" ORDER BY p.color_rank, ps."_order"),
               ps."_parent_id",
               ps."id" || '-c' || p.color_id,
               p.color_id,
               ps."size"::text::"enum_products_variants_size",
               CASE WHEN p.color_rank = 1 THEN ps."stock_a_o" ELSE 0 END,
               CASE WHEN p.color_rank = 1 THEN ps."stock_p_t" ELSE 0 END
        FROM "products_sizes" ps
        JOIN pcolors p ON p.parent_id = ps."_parent_id"
        ON CONFLICT ("id") DO NOTHING;
      END IF;
    END $$;

    -- ---------------------------------------------------------------
    -- Locked-documents bookkeeping columns for the new collections
    -- (Payload's edit-lock table needs one nullable FK per collection)
    -- ---------------------------------------------------------------
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "categories_id" integer,
      ADD COLUMN IF NOT EXISTS "merch_tags_id" integer,
      ADD COLUMN IF NOT EXISTS "colors_id" integer,
      ADD COLUMN IF NOT EXISTS "size_guides_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk"
        FOREIGN KEY ("categories_id") REFERENCES "categories"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_merch_tags_fk"
        FOREIGN KEY ("merch_tags_id") REFERENCES "merch_tags"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_colors_fk"
        FOREIGN KEY ("colors_id") REFERENCES "colors"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_size_guides_fk"
        FOREIGN KEY ("size_guides_id") REFERENCES "size_guides"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" ("categories_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_merch_tags_id_idx" ON "payload_locked_documents_rels" ("merch_tags_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_colors_id_idx" ON "payload_locked_documents_rels" ("colors_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_size_guides_id_idx" ON "payload_locked_documents_rels" ("size_guides_id");

    -- ---------------------------------------------------------------
    -- Drop the old storage, now fully converted
    -- ---------------------------------------------------------------
    DROP TABLE IF EXISTS "products_sizes";
    DROP TABLE IF EXISTS "products_colors";
    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "category",
      DROP COLUMN IF EXISTS "tag",
      DROP COLUMN IF EXISTS "size_guide_p_t",
      DROP COLUMN IF EXISTS "size_guide_e_n";
    DROP TYPE IF EXISTS "enum_products_category";
    DROP TYPE IF EXISTS "enum_products_tag";
    DROP TYPE IF EXISTS "enum_products_sizes_size";
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
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_sizes_size" AS ENUM('XS', 'S', 'M', 'L', 'XL');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "category" "enum_products_category",
      ADD COLUMN IF NOT EXISTS "tag" "enum_products_tag",
      ADD COLUMN IF NOT EXISTS "size_guide_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "size_guide_e_n" varchar;

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

    -- Rebuild per-size stock by summing variant stock across colours, and
    -- the colour list from distinct variant colours.
    CREATE TABLE IF NOT EXISTS "products_sizes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "size" "enum_products_sizes_size" NOT NULL,
      "stock_a_o" numeric NOT NULL,
      "stock_p_t" numeric NOT NULL
    );
    INSERT INTO "products_sizes" ("_order", "_parent_id", "id", "size", "stock_a_o", "stock_p_t")
    SELECT ROW_NUMBER() OVER (PARTITION BY pv."_parent_id" ORDER BY min(pv."_order")),
           pv."_parent_id",
           pv."_parent_id" || '-size-' || pv."size",
           pv."size"::text::"enum_products_sizes_size",
           SUM(pv."stock_a_o"),
           SUM(pv."stock_p_t")
    FROM "products_variants" pv
    GROUP BY pv."_parent_id", pv."size";

    CREATE TABLE IF NOT EXISTS "products_colors" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "color" varchar NOT NULL
    );
    INSERT INTO "products_colors" ("_order", "_parent_id", "id", "color")
    SELECT ROW_NUMBER() OVER (PARTITION BY sub.parent_id ORDER BY sub.first_order),
           sub.parent_id,
           sub.parent_id || '-color-' || sub.color_id,
           sub.name
    FROM (
      SELECT pv."_parent_id" AS parent_id, pv."color_id", c."name", MIN(pv."_order") AS first_order
      FROM "products_variants" pv JOIN "colors" c ON c."id" = pv."color_id"
      GROUP BY pv."_parent_id", pv."color_id", c."name"
    ) sub;

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "categories_id",
      DROP COLUMN IF EXISTS "merch_tags_id",
      DROP COLUMN IF EXISTS "colors_id",
      DROP COLUMN IF EXISTS "size_guides_id";

    DROP TABLE IF EXISTS "products_variants";
    DROP TYPE IF EXISTS "enum_products_variants_size";
    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "category_id",
      DROP COLUMN IF EXISTS "tag_id",
      DROP COLUMN IF EXISTS "size_guide_id",
      DROP COLUMN IF EXISTS "fit_note_p_t",
      DROP COLUMN IF EXISTS "fit_note_e_n";

    DROP TABLE IF EXISTS "size_guides_rows";
    DROP TABLE IF EXISTS "size_guides";
    DROP TYPE IF EXISTS "enum_size_guides_rows_size";
    DROP TABLE IF EXISTS "colors";
    DROP TABLE IF EXISTS "merch_tags";
    DROP TABLE IF EXISTS "categories";
  `)
}

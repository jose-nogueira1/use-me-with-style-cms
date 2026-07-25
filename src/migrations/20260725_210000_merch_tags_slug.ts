import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Merch tags become linkable "collections" (2026-07-25 follow-up to the
// home hero button): adds a stable slug, same auto-generated/immutable
// policy as Categories.slug. Existing rows are backfilled with a
// best-effort slug (lowercased label, non-alphanumerics -> hyphens) --
// good enough for the current seed data (Novidade/Bestseller/Quase
// esgotado, all plain ASCII); accented labels added later always get a
// proper slug through the collection's beforeValidate hook, which uses the
// same accent-stripping slugify() as Products/Categories.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "merch_tags" ADD COLUMN IF NOT EXISTS "slug" varchar;

    UPDATE "merch_tags"
    SET "slug" = regexp_replace(regexp_replace(lower(trim("label_p_t")), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
    WHERE "slug" IS NULL;

    -- De-duplicate in the unlikely event two labels collapsed to the same
    -- slug (mirrors the suffix-2/3/... policy the create-time hook uses).
    WITH ranked AS (
      SELECT "id", "slug", row_number() OVER (PARTITION BY "slug" ORDER BY "id") AS rn
      FROM "merch_tags"
    )
    UPDATE "merch_tags" m
    SET "slug" = m."slug" || '-' || ranked.rn
    FROM ranked
    WHERE m."id" = ranked."id" AND ranked.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS "merch_tags_slug_idx" ON "merch_tags" ("slug");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "merch_tags_slug_idx";
    ALTER TABLE "merch_tags" DROP COLUMN IF EXISTS "slug";
  `)
}

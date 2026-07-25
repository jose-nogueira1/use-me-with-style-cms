import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// New global (2026-07-25 admin request): editable storefront home-hero
// content -- previously hardcoded via i18n.ts translation keys with no
// admin-editable source. Single-row table, same shape as the other
// Settings globals (legal_content, market_settings).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "home_content" (
      "id" serial PRIMARY KEY NOT NULL,
      "hero_eyebrow_p_t" varchar DEFAULT 'Coleção SS26',
      "hero_eyebrow_e_n" varchar DEFAULT 'SS26 Collection',
      "hero_headline_p_t" varchar DEFAULT 'Moda que se move consigo.',
      "hero_headline_e_n" varchar DEFAULT 'Fashion that moves with you.',
      "hero_subtitle_p_t" varchar DEFAULT 'Peças pensadas para si, com preços sempre claros e diretos.',
      "hero_subtitle_e_n" varchar DEFAULT 'Considered pieces for you, with pricing always shown up front.',
      "hero_cta_label_p_t" varchar DEFAULT 'Ver tudo',
      "hero_cta_label_e_n" varchar DEFAULT 'Shop all',
      "hero_cta_href" varchar DEFAULT '/catalogo',
      "hero_image_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now(),
      "created_at" timestamp(3) with time zone DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "home_content_hero_image_idx" ON "home_content" ("hero_image_id");
    CREATE INDEX IF NOT EXISTS "home_content_updated_at_idx" ON "home_content" ("updated_at");
    CREATE INDEX IF NOT EXISTS "home_content_created_at_idx" ON "home_content" ("created_at");
    DO $$ BEGIN
      ALTER TABLE "home_content" ADD CONSTRAINT "home_content_hero_image_id_media_id_fk"
        FOREIGN KEY ("hero_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "home_content";
  `)
}

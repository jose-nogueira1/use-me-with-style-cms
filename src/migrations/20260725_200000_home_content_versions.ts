import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Auto-history for the home hero (2026-07-25 follow-up): enabling
// `versions: { max: 20 }` on the home-content global (see HomeContent.ts)
// makes Payload snapshot the previous content on every save. That storage
// is a separate, additive table -- home_content itself (the live/current
// doc) is untouched. Column names mirror the base table's fields, each
// under a `version_` prefix, per Payload's global-versions field builder.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_home_content_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "version_hero_eyebrow_p_t" varchar,
      "version_hero_eyebrow_e_n" varchar,
      "version_hero_headline_p_t" varchar,
      "version_hero_headline_e_n" varchar,
      "version_hero_subtitle_p_t" varchar,
      "version_hero_subtitle_e_n" varchar,
      "version_hero_cta_label_p_t" varchar,
      "version_hero_cta_label_e_n" varchar,
      "version_hero_cta_href" varchar,
      "version_hero_image_id" integer,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "_home_content_v_version_hero_image_idx" ON "_home_content_v" ("version_hero_image_id");
    CREATE INDEX IF NOT EXISTS "_home_content_v_created_at_idx" ON "_home_content_v" ("created_at");
    CREATE INDEX IF NOT EXISTS "_home_content_v_updated_at_idx" ON "_home_content_v" ("updated_at");
    DO $$ BEGIN
      ALTER TABLE "_home_content_v" ADD CONSTRAINT "_home_content_v_version_hero_image_id_media_id_fk"
        FOREIGN KEY ("version_hero_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_home_content_v";
  `)
}

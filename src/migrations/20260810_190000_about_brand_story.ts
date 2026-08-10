import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// SEO audit item 16: preserve the approved brand story, add factual AO/PT
// presence copy, and make the complete About page editable from the custom
// storefront admin. Values are ordered rows so the brand can evolve them.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "storefront_content"
      ADD COLUMN IF NOT EXISTS "about_eyebrow_p_t" varchar DEFAULT 'Use Me With Style',
      ADD COLUMN IF NOT EXISTS "about_eyebrow_e_n" varchar DEFAULT 'Use Me With Style',
      ADD COLUMN IF NOT EXISTS "about_title_p_t" varchar DEFAULT 'A nossa história',
      ADD COLUMN IF NOT EXISTS "about_title_e_n" varchar DEFAULT 'Our story',
      ADD COLUMN IF NOT EXISTS "about_intro_p_t" varchar DEFAULT 'A USE ME WITH STYLE é uma marca de activewear, moda feminina e lifestyle, criada para mulheres que valorizam conforto, confiança, elegância e versatilidade.',
      ADD COLUMN IF NOT EXISTS "about_intro_e_n" varchar DEFAULT 'USE ME WITH STYLE is an activewear, women’s fashion, and lifestyle brand created for women who value comfort, confidence, elegance, and versatility.',
      ADD COLUMN IF NOT EXISTS "about_story_title_p_t" varchar DEFAULT 'Missão',
      ADD COLUMN IF NOT EXISTS "about_story_title_e_n" varchar DEFAULT 'Mission',
      ADD COLUMN IF NOT EXISTS "about_story_body_p_t" varchar DEFAULT E'A marca disponibiliza peças pensadas para diferentes momentos da rotina feminina, desde o treino e o dia a dia até ocasiões que pedem um visual mais elegante. O nosso catálogo inclui conjuntos desportivos, peças casuais, vestidos e outros artigos selecionados para proporcionar conforto sem perder o estilo.\n\nCom atuação em Angola e Portugal e possibilidade de envios internacionais, a USE ME WITH STYLE procura aproximar mulheres de diferentes lugares através de coleções cuidadosamente selecionadas e disponibilizadas em quantidades limitadas.\n\nMais do que roupa, a USE ME WITH STYLE representa uma forma de vestir com confiança, personalidade e liberdade.',
      ADD COLUMN IF NOT EXISTS "about_story_body_e_n" varchar DEFAULT E'The brand offers pieces designed for different moments in a woman''s routine, from workouts and everyday life to occasions that call for a more elegant look. Our catalogue includes activewear sets, casual pieces, dresses, and other selected items designed to deliver comfort without compromising on style.\n\nWith a presence in Angola and Portugal and international shipping available, USE ME WITH STYLE brings women from different places closer together through carefully curated collections released in limited quantities.\n\nMore than just clothing, USE ME WITH STYLE represents a way of dressing with confidence, personality, and freedom.',
      ADD COLUMN IF NOT EXISTS "about_values_title_p_t" varchar DEFAULT 'O que nos guia',
      ADD COLUMN IF NOT EXISTS "about_values_title_e_n" varchar DEFAULT 'What guides us',
      ADD COLUMN IF NOT EXISTS "about_presence_title_p_t" varchar DEFAULT 'Angola e Portugal, perto de si',
      ADD COLUMN IF NOT EXISTS "about_presence_title_e_n" varchar DEFAULT 'Angola and Portugal, close to you',
      ADD COLUMN IF NOT EXISTS "about_angola_title_p_t" varchar DEFAULT 'Loja Angola',
      ADD COLUMN IF NOT EXISTS "about_angola_title_e_n" varchar DEFAULT 'Angola store',
      ADD COLUMN IF NOT EXISTS "about_angola_body_p_t" varchar DEFAULT 'Na loja Angola, encontra preços em Kz, entrega por estafeta nos 16 municípios de Luanda e pagamento por Multicaixa Express ou Referência. Para outros destinos, o apoio confirma as opções disponíveis.',
      ADD COLUMN IF NOT EXISTS "about_angola_body_e_n" varchar DEFAULT 'In the Angola store, prices are shown in Kz, with courier delivery across Luanda’s 16 municipalities and payment by Multicaixa Express or Reference. For other destinations, support confirms the available options.',
      ADD COLUMN IF NOT EXISTS "about_portugal_title_p_t" varchar DEFAULT 'Loja Portugal',
      ADD COLUMN IF NOT EXISTS "about_portugal_title_e_n" varchar DEFAULT 'Portugal store',
      ADD COLUMN IF NOT EXISTS "about_portugal_body_p_t" varchar DEFAULT 'Na loja Portugal, compra em euros e recebe via CTT, com opções Standard ou Registado quando disponíveis para o peso da encomenda. Madeira e Açores podem ter prazos diferentes.',
      ADD COLUMN IF NOT EXISTS "about_portugal_body_e_n" varchar DEFAULT 'In the Portugal store, you shop in euros and receive orders through CTT, with Standard or Registered options when available for the parcel weight. Madeira and the Azores may have different delivery times.',
      ADD COLUMN IF NOT EXISTS "about_cta_label_p_t" varchar DEFAULT 'Ver a coleção',
      ADD COLUMN IF NOT EXISTS "about_cta_label_e_n" varchar DEFAULT 'Shop the collection',
      ADD COLUMN IF NOT EXISTS "about_seo_title_p_t" varchar DEFAULT 'Moda desportiva em Angola e Portugal | Use Me With Style',
      ADD COLUMN IF NOT EXISTS "about_seo_title_e_n" varchar DEFAULT 'Activewear in Angola and Portugal | Use Me With Style',
      ADD COLUMN IF NOT EXISTS "about_seo_description_p_t" varchar DEFAULT 'Conheça a história e os valores da Use Me With Style, marca de activewear e moda feminina com presença em Angola e Portugal.',
      ADD COLUMN IF NOT EXISTS "about_seo_description_e_n" varchar DEFAULT 'Discover the story and values of Use Me With Style, an activewear and women’s fashion brand serving Angola and Portugal.';

    CREATE TABLE IF NOT EXISTS "storefront_content_about_values" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT true,
      "title_p_t" varchar NOT NULL,
      "title_e_n" varchar NOT NULL,
      "body_p_t" varchar NOT NULL,
      "body_e_n" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "storefront_content_about_values_order_idx" ON "storefront_content_about_values" ("_order");
    CREATE INDEX IF NOT EXISTS "storefront_content_about_values_parent_id_idx" ON "storefront_content_about_values" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "storefront_content_about_values" ADD CONSTRAINT "storefront_content_about_values_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."storefront_content"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    INSERT INTO "storefront_content_about_values"
      ("_order", "_parent_id", "id", "enabled", "title_p_t", "title_e_n", "body_p_t", "body_e_n")
    SELECT value."sort_order", content."id", value."slug" || '-' || content."id"::text, true,
      value."title_pt", value."title_en", value."body_pt", value."body_en"
    FROM "storefront_content" content
    CROSS JOIN (VALUES
      (0, 'quality', 'Qualidade em primeiro lugar', 'Quality first', 'Cada peça é escolhida para durar mais do que uma estação.', 'Every piece is chosen to outlast a single season.'),
      (1, 'pricing', 'Preços diretos', 'Honest pricing', 'Sem letras pequenas — o preço que vê é o preço que paga.', 'No fine print — the price you see is the price you pay.'),
      (2, 'close', 'Perto de si', 'Close to you', 'Duas lojas, uma só marca: Angola e Portugal, cada uma com o seu atendimento.', 'Two storefronts, one brand: Angola and Portugal, each with its own local service.')
    ) AS value("sort_order", "slug", "title_pt", "title_en", "body_pt", "body_en")
    WHERE NOT EXISTS (
      SELECT 1 FROM "storefront_content_about_values" existing WHERE existing."_parent_id" = content."id"
    )
    ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "storefront_content_about_values" CASCADE;
    ALTER TABLE "storefront_content"
      DROP COLUMN IF EXISTS "about_eyebrow_p_t",
      DROP COLUMN IF EXISTS "about_eyebrow_e_n",
      DROP COLUMN IF EXISTS "about_title_p_t",
      DROP COLUMN IF EXISTS "about_title_e_n",
      DROP COLUMN IF EXISTS "about_intro_p_t",
      DROP COLUMN IF EXISTS "about_intro_e_n",
      DROP COLUMN IF EXISTS "about_story_title_p_t",
      DROP COLUMN IF EXISTS "about_story_title_e_n",
      DROP COLUMN IF EXISTS "about_story_body_p_t",
      DROP COLUMN IF EXISTS "about_story_body_e_n",
      DROP COLUMN IF EXISTS "about_values_title_p_t",
      DROP COLUMN IF EXISTS "about_values_title_e_n",
      DROP COLUMN IF EXISTS "about_presence_title_p_t",
      DROP COLUMN IF EXISTS "about_presence_title_e_n",
      DROP COLUMN IF EXISTS "about_angola_title_p_t",
      DROP COLUMN IF EXISTS "about_angola_title_e_n",
      DROP COLUMN IF EXISTS "about_angola_body_p_t",
      DROP COLUMN IF EXISTS "about_angola_body_e_n",
      DROP COLUMN IF EXISTS "about_portugal_title_p_t",
      DROP COLUMN IF EXISTS "about_portugal_title_e_n",
      DROP COLUMN IF EXISTS "about_portugal_body_p_t",
      DROP COLUMN IF EXISTS "about_portugal_body_e_n",
      DROP COLUMN IF EXISTS "about_cta_label_p_t",
      DROP COLUMN IF EXISTS "about_cta_label_e_n",
      DROP COLUMN IF EXISTS "about_seo_title_p_t",
      DROP COLUMN IF EXISTS "about_seo_title_e_n",
      DROP COLUMN IF EXISTS "about_seo_description_p_t",
      DROP COLUMN IF EXISTS "about_seo_description_e_n";
  `)
}

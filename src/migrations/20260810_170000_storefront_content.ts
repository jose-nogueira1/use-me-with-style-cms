import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Editable FAQ and standalone size-guide copy. The global's field defaults
// reproduce the storefront content that existed before this migration, so a
// first read is backwards-compatible and the custom admin can save it without
// needing to visit Payload's generic UI.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "storefront_content" (
      "id" serial PRIMARY KEY NOT NULL,
      "faq_title_p_t" varchar DEFAULT 'Perguntas frequentes',
      "faq_title_e_n" varchar DEFAULT 'Frequently asked questions',
      "faq_intro_p_t" varchar DEFAULT 'Encontre informação prática antes de encomendar. As condições apresentadas acompanham a loja e o mercado que está a visitar.',
      "faq_intro_e_n" varchar DEFAULT 'Find practical information before ordering. The details below follow the store and market you are currently visiting.',
      "faq_support_prompt_p_t" varchar DEFAULT 'Não encontrou a resposta?',
      "faq_support_prompt_e_n" varchar DEFAULT 'Couldn''t find your answer?',
      "faq_support_label_p_t" varchar DEFAULT 'Contacte o apoio.',
      "faq_support_label_e_n" varchar DEFAULT 'Contact support.',
      "faq_seo_title_p_t" varchar DEFAULT 'Perguntas frequentes | Use Me With Style',
      "faq_seo_title_e_n" varchar DEFAULT 'Frequently asked questions | Use Me With Style',
      "faq_seo_description_p_t" varchar DEFAULT 'Respostas sobre entregas, pagamentos, tamanhos, trocas e devoluções da Use Me With Style em Angola e Portugal.',
      "faq_seo_description_e_n" varchar DEFAULT 'Answers about Use Me With Style delivery, payments, sizing, exchanges, and returns in Angola and Portugal.',
      "size_guide_title_p_t" varchar DEFAULT 'Guia de tamanhos',
      "size_guide_title_e_n" varchar DEFAULT 'Size guide',
      "size_guide_intro_p_t" varchar DEFAULT 'Encontre o tamanho certo para leggings, tops, vestidos e conjuntos. Tire as suas medidas sem apertar a fita e compare-as, em centímetros, com a tabela da categoria da peça.',
      "size_guide_intro_e_n" varchar DEFAULT 'Find the right size for leggings, tops, dresses and sets. Take your measurements without pulling the tape tight, then compare them in centimetres with the chart for your item category.',
      "size_guide_how_to_title_p_t" varchar DEFAULT 'Como medir',
      "size_guide_how_to_title_e_n" varchar DEFAULT 'How to measure',
      "size_guide_bust_p_t" varchar DEFAULT 'Busto: meça à volta da parte mais larga do peito.',
      "size_guide_bust_e_n" varchar DEFAULT 'Bust: measure around the fullest part of your chest.',
      "size_guide_waist_p_t" varchar DEFAULT 'Cintura: meça à volta da parte mais estreita do tronco.',
      "size_guide_waist_e_n" varchar DEFAULT 'Waist: measure around the narrowest part of your torso.',
      "size_guide_hip_p_t" varchar DEFAULT 'Anca: meça à volta da parte mais larga das ancas.',
      "size_guide_hip_e_n" varchar DEFAULT 'Hip: measure around the fullest part of your hips.',
      "size_guide_length_p_t" varchar DEFAULT 'Comprimento: compare com o comprimento indicado para a peça; o ponto inicial varia conforme o tipo de produto.',
      "size_guide_length_e_n" varchar DEFAULT 'Length: compare with the garment length shown; the starting point varies by product type.',
      "size_guide_closing_p_t" varchar DEFAULT 'A tabela associada à página de cada produto é sempre a referência principal. Entre dois tamanhos ou ainda com dúvidas?',
      "size_guide_closing_e_n" varchar DEFAULT 'The chart assigned to each product page is always the primary reference. Between sizes or still unsure?',
      "size_guide_support_label_p_t" varchar DEFAULT 'Fale connosco',
      "size_guide_support_label_e_n" varchar DEFAULT 'Contact us',
      "size_guide_catalog_label_p_t" varchar DEFAULT 'Explorar o catálogo',
      "size_guide_catalog_label_e_n" varchar DEFAULT 'Browse the catalogue',
      "size_guide_seo_title_p_t" varchar DEFAULT 'Guia de tamanhos | Use Me With Style',
      "size_guide_seo_title_e_n" varchar DEFAULT 'Size guide | Use Me With Style',
      "size_guide_seo_description_p_t" varchar DEFAULT 'Consulte o guia de tamanhos de leggings, tops, vestidos e conjuntos Use Me With Style e compare busto, cintura e anca em centímetros.',
      "size_guide_seo_description_e_n" varchar DEFAULT 'Use our size guide for leggings, tops, dresses and sets, and compare bust, waist and hip measurements in centimetres.',
      "updated_at" timestamp(3) with time zone DEFAULT now(),
      "created_at" timestamp(3) with time zone DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "storefront_content_faq_entries" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT true,
      "question_p_t" varchar NOT NULL,
      "question_e_n" varchar NOT NULL,
      "answer_p_t" varchar NOT NULL,
      "answer_e_n" varchar NOT NULL,
      "answer_p_t_p_t" varchar,
      "answer_e_n_p_t" varchar,
      "link_path" varchar,
      "link_label_p_t" varchar,
      "link_label_e_n" varchar
    );
    CREATE INDEX IF NOT EXISTS "storefront_content_updated_at_idx" ON "storefront_content" ("updated_at");
    CREATE INDEX IF NOT EXISTS "storefront_content_created_at_idx" ON "storefront_content" ("created_at");
    CREATE INDEX IF NOT EXISTS "storefront_content_faq_entries_order_idx" ON "storefront_content_faq_entries" ("_order");
    CREATE INDEX IF NOT EXISTS "storefront_content_faq_entries_parent_id_idx" ON "storefront_content_faq_entries" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "storefront_content_faq_entries" ADD CONSTRAINT "storefront_content_faq_entries_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."storefront_content"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "storefront_content_faq_entries" CASCADE;
    DROP TABLE IF EXISTS "storefront_content" CASCADE;
  `)
}

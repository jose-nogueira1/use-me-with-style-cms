import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Dedicated, market-aware homepage metadata. Angola's defaults deliberately
// surface the Luanda delivery and Multicaixa trust signals identified
// in SEO audit item 15; Portugal keeps its own accurate delivery positioning.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "storefront_content"
      ADD COLUMN IF NOT EXISTS "home_seo_title_angola_p_t" varchar DEFAULT 'Moda desportiva feminina em Luanda | Use Me With Style',
      ADD COLUMN IF NOT EXISTS "home_seo_title_angola_e_n" varchar DEFAULT 'Women''s activewear in Luanda | Use Me With Style',
      ADD COLUMN IF NOT EXISTS "home_seo_description_angola_p_t" varchar DEFAULT 'Compre moda desportiva feminina com entrega em Luanda e pagamento por Multicaixa Express ou Referência. Preços em Kz e apoio local.',
      ADD COLUMN IF NOT EXISTS "home_seo_description_angola_e_n" varchar DEFAULT 'Shop women''s activewear with delivery across Luanda and payment by Multicaixa Express or Reference. Prices in Kz and local support.',
      ADD COLUMN IF NOT EXISTS "home_seo_title_portugal_p_t" varchar DEFAULT 'Moda desportiva feminina em Portugal | Use Me With Style',
      ADD COLUMN IF NOT EXISTS "home_seo_title_portugal_e_n" varchar DEFAULT 'Women''s activewear in Portugal | Use Me With Style',
      ADD COLUMN IF NOT EXISTS "home_seo_description_portugal_p_t" varchar DEFAULT 'Compre leggings, conjuntos, tops e vestidos com entrega em Portugal. Peças versáteis para treino e para o dia a dia.',
      ADD COLUMN IF NOT EXISTS "home_seo_description_portugal_e_n" varchar DEFAULT 'Shop leggings, sets, tops and dresses with delivery across Portugal. Versatile pieces for training and everyday wear.';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "storefront_content"
      DROP COLUMN IF EXISTS "home_seo_title_angola_p_t",
      DROP COLUMN IF EXISTS "home_seo_title_angola_e_n",
      DROP COLUMN IF EXISTS "home_seo_description_angola_p_t",
      DROP COLUMN IF EXISTS "home_seo_description_angola_e_n",
      DROP COLUMN IF EXISTS "home_seo_title_portugal_p_t",
      DROP COLUMN IF EXISTS "home_seo_title_portugal_e_n",
      DROP COLUMN IF EXISTS "home_seo_description_portugal_p_t",
      DROP COLUMN IF EXISTS "home_seo_description_portugal_e_n";
  `)
}

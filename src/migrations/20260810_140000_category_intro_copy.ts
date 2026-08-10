import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// SEO audit task 8: give each category useful, editable landing-page copy.
// Existing catalogue rows are backfilled without overwriting any copy an
// administrator may already have entered before this migration runs.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "intro_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "intro_e_n" varchar;

    UPDATE "categories"
    SET "intro_p_t" = CASE "slug"
      WHEN 'vestidos' THEN 'Descubra vestidos desportivos femininos que combinam conforto, movimento e estilo, ideais para treinar ou acompanhar o seu dia em Angola e Portugal.'
      WHEN 'tops' THEN 'Explore tops desportivos femininos com suporte confortável e cortes versáteis, pensados para treinos, caminhadas e looks ativos do dia a dia.'
      WHEN 'leggings' THEN 'Encontre leggings femininas confortáveis e flexíveis, com modelos pensados para acompanhar cada movimento no treino e na rotina diária.'
      WHEN 'conjuntos' THEN 'Descubra conjuntos fitness femininos coordenados que unem conforto e estilo, para um look completo no treino e fora dele.'
      WHEN 'acessorios' THEN 'Complete o seu look ativo com acessórios práticos e elegantes, escolhidos para acompanhar o treino e facilitar a sua rotina.'
      ELSE "intro_p_t"
    END
    WHERE ("intro_p_t" IS NULL OR btrim("intro_p_t") = '')
      AND "slug" IN ('vestidos', 'tops', 'leggings', 'conjuntos', 'acessorios');

    UPDATE "categories"
    SET "intro_e_n" = CASE "slug"
      WHEN 'vestidos' THEN 'Discover women’s sports dresses that combine comfort, movement and style, ideal for training or everyday wear in Angola and Portugal.'
      WHEN 'tops' THEN 'Explore women’s sports tops with comfortable support and versatile cuts, designed for workouts, walks and everyday active looks.'
      WHEN 'leggings' THEN 'Find comfortable, flexible women’s leggings designed to move with you through every workout and daily routine.'
      WHEN 'conjuntos' THEN 'Discover coordinated women’s fitness sets that bring comfort and style together for a complete look in and out of the gym.'
      WHEN 'acessorios' THEN 'Complete your active look with practical, elegant accessories selected to support your workouts and simplify your routine.'
      ELSE "intro_e_n"
    END
    WHERE ("intro_e_n" IS NULL OR btrim("intro_e_n") = '')
      AND "slug" IN ('vestidos', 'tops', 'leggings', 'conjuntos', 'acessorios');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "intro_p_t",
      DROP COLUMN IF EXISTS "intro_e_n";
  `)
}

import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_posts_body_kind" AS ENUM('section', 'paragraph', 'bullets');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "posts" (
      "id" serial PRIMARY KEY NOT NULL,
      "title_p_t" varchar NOT NULL,
      "title_e_n" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "excerpt_p_t" varchar NOT NULL,
      "excerpt_e_n" varchar NOT NULL,
      "seo_title_p_t" varchar NOT NULL,
      "seo_title_e_n" varchar NOT NULL,
      "seo_description_p_t" varchar NOT NULL,
      "seo_description_e_n" varchar NOT NULL,
      "status" "public"."enum_posts_status" DEFAULT 'draft' NOT NULL,
      "published_at" timestamp(3) with time zone,
      "available_a_o" boolean DEFAULT true NOT NULL,
      "available_p_t" boolean DEFAULT true NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" ("slug");
    CREATE INDEX IF NOT EXISTS "posts_published_at_idx" ON "posts" ("published_at");
    CREATE INDEX IF NOT EXISTS "posts_updated_at_idx" ON "posts" ("updated_at");
    CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" ("created_at");

    CREATE TABLE IF NOT EXISTS "posts_body" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "kind" "public"."enum_posts_body_kind" DEFAULT 'paragraph' NOT NULL,
      "heading_p_t" varchar,
      "heading_e_n" varchar,
      "text_p_t" varchar NOT NULL,
      "text_e_n" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "posts_body_order_idx" ON "posts_body" ("_order");
    CREATE INDEX IF NOT EXISTS "posts_body_parent_id_idx" ON "posts_body" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "posts_body" ADD CONSTRAINT "posts_body_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "posts_id" integer;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_posts_id_idx"
      ON "payload_locked_documents_rels" ("posts_id");
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk"
        FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    INSERT INTO "posts" (
      "title_p_t", "title_e_n", "slug", "excerpt_p_t", "excerpt_e_n",
      "seo_title_p_t", "seo_title_e_n", "seo_description_p_t", "seo_description_e_n",
      "status", "published_at", "available_a_o", "available_p_t"
    ) VALUES
      (
        'Como escolher leggings para treino e dia a dia',
        'How to choose leggings for workouts and everyday wear',
        'como-escolher-leggings',
        'Compressão, tecido, cintura e ajuste: um guia prático para escolher leggings confortáveis para treinar e usar ao longo do dia.',
        'Compression, fabric, waistband and fit: a practical guide to choosing comfortable leggings for training and everyday wear.',
        'Como escolher leggings: guia de tecido e ajuste | Use Me With Style',
        'How to choose leggings: fabric and fit guide | Use Me With Style',
        'Saiba como escolher leggings para treino e dia a dia, comparando compressão, tecido, cintura, tamanho e transparência.',
        'Learn how to choose leggings for workouts and everyday wear by comparing compression, fabric, waistband, sizing and coverage.',
        'published', '2026-08-10T09:00:00.000Z', true, true
      ),
      (
        'O que vestir para o ginásio: guia prático',
        'What to wear to the gym: a practical guide',
        'o-que-vestir-no-ginasio',
        'Monte um conjunto de treino funcional e confortável, adequado ao tipo de exercício, à temperatura e à sua rotina.',
        'Build a functional, comfortable workout outfit suited to your exercise, the temperature and your routine.',
        'O que vestir para o ginásio: guia prático | Use Me With Style',
        'What to wear to the gym: practical outfit guide | Use Me With Style',
        'Descubra o que vestir para o ginásio: tops, leggings, camadas, calçado e acessórios para diferentes tipos de treino.',
        'Discover what to wear to the gym, from tops and leggings to layers, footwear and accessories for different workouts.',
        'published', '2026-08-10T10:00:00.000Z', true, true
      ),
      (
        'Guia de tecidos para roupa desportiva',
        'Fabric guide for activewear',
        'guia-tecidos-roupa-desportiva',
        'Entenda elasticidade, respirabilidade, secagem e cuidados para escolher roupa desportiva adequada ao seu treino.',
        'Understand stretch, breathability, drying and care so you can choose activewear suited to your workout.',
        'Tecidos para roupa desportiva: guia completo | Use Me With Style',
        'Activewear fabrics: a practical guide | Use Me With Style',
        'Compare os principais tecidos da roupa desportiva e saiba avaliar respirabilidade, elasticidade, secagem e durabilidade.',
        'Compare common activewear fabrics and learn how to assess breathability, stretch, drying and durability.',
        'published', '2026-08-10T11:00:00.000Z', true, true
      )
    ON CONFLICT ("slug") DO NOTHING;

    INSERT INTO "posts_body" ("_order", "_parent_id", "id", "kind", "heading_p_t", "heading_e_n", "text_p_t", "text_e_n")
    SELECT block."sort_order", post."id", 'leggings-' || block."sort_order"::text, block."kind"::"public"."enum_posts_body_kind",
      block."heading_pt", block."heading_en", block."text_pt", block."text_en"
    FROM "posts" post
    CROSS JOIN (VALUES
      (0, 'section', 'Comece pelo tipo de treino', 'Start with your workout', 'Para musculação e treinos funcionais, procure um tecido firme que acompanhe agachamentos e movimentos amplos. Para caminhada, mobilidade ou uso diário, uma construção mais leve pode oferecer o conforto de que precisa sem compressão excessiva.', 'For strength and functional training, look for a supportive fabric that moves through squats and wide ranges of motion. For walking, mobility or everyday wear, a lighter construction may provide the comfort you need without excessive compression.'),
      (1, 'section', 'Observe tecido, elasticidade e cobertura', 'Check fabric, stretch and coverage', 'O tecido deve recuperar a forma depois de esticado e manter cobertura durante o movimento. Faça um teste de agachamento num local bem iluminado e confirme se a peça permanece confortável sem enrolar, prender ou ficar transparente.', 'The fabric should recover after stretching and maintain coverage while you move. Try a squat test in good light and confirm that the garment stays comfortable without rolling, digging in or becoming sheer.'),
      (2, 'bullets', 'Uma verificação rápida', 'A quick checklist', 'A cintura mantém-se no lugar sem apertar\nAs costuras não limitam o movimento\nO tecido seca com facilidade depois do treino\nO tamanho acompanha cintura e anca sem excesso de tecido', 'The waistband stays in place without digging in\nThe seams do not restrict movement\nThe fabric dries easily after training\nThe size follows your waist and hips without excess fabric'),
      (3, 'section', 'Escolha a cintura e o tamanho', 'Choose the waistband and size', 'Uma cintura alta pode dar mais apoio e estabilidade; uma cintura média pode ser mais leve para rotinas casuais. Use as medidas de cintura e anca como referência e consulte o guia de tamanhos da peça. Se estiver entre dois tamanhos, considere o nível de compressão que prefere.', 'A high waist can provide more support and stability, while a mid-rise waist may feel lighter for casual routines. Use your waist and hip measurements and check the product size guide. If you are between sizes, consider the level of compression you prefer.'),
      (4, 'section', 'Pense também no dia a dia', 'Think beyond the workout', 'Leggings versáteis combinam com um top, uma camisola leve ou uma camada mais estruturada. Cores neutras facilitam combinações; cores e estampados podem dar personalidade. A melhor escolha é a que se adapta ao seu movimento e à forma como realmente usa a peça.', 'Versatile leggings work with a top, a light sweatshirt or a more structured layer. Neutral colours make styling easier, while colour and print can add personality. The best choice is the one that fits your movement and the way you actually wear it.')
    ) AS block("sort_order", "kind", "heading_pt", "heading_en", "text_pt", "text_en")
    WHERE post."slug" = 'como-escolher-leggings'
      AND NOT EXISTS (SELECT 1 FROM "posts_body" existing WHERE existing."_parent_id" = post."id");

    INSERT INTO "posts_body" ("_order", "_parent_id", "id", "kind", "heading_p_t", "heading_e_n", "text_p_t", "text_e_n")
    SELECT block."sort_order", post."id", 'gym-' || block."sort_order"::text, block."kind"::"public"."enum_posts_body_kind",
      block."heading_pt", block."heading_en", block."text_pt", block."text_en"
    FROM "posts" post
    CROSS JOIN (VALUES
      (0, 'section', 'Vista-se para o movimento', 'Dress for movement', 'O melhor conjunto de ginásio permite mover-se com segurança e sem distrações. Comece pelo tipo de treino: exercícios de força pedem estabilidade e cobertura; cardio costuma beneficiar de peças leves e respiráveis; mobilidade exige elasticidade e liberdade.', 'The best gym outfit lets you move safely without distractions. Start with the workout: strength sessions need stability and coverage, cardio often benefits from light breathable pieces, and mobility work calls for stretch and freedom.'),
      (1, 'section', 'A base do conjunto', 'Build the base layer', 'Combine leggings, calções ou calças de treino com um top que dê o apoio adequado à intensidade da atividade. Verifique o ajuste em movimentos reais antes de sair: levante os braços, faça uma flexão e experimente um agachamento.', 'Pair leggings, shorts or training trousers with a top that offers the right support for the intensity of your activity. Check the fit through real movements before you leave: raise your arms, bend and try a squat.'),
      (2, 'bullets', 'Leve apenas o essencial', 'Pack the essentials', 'Calçado adequado ao tipo de treino\nUma camada leve para antes e depois do exercício\nGarrafa de água reutilizável\nToalha pequena quando o espaço ou a aula exigir', 'Footwear suited to your workout\nA light layer for before and after exercise\nA reusable water bottle\nA small towel when the venue or class requires one'),
      (3, 'section', 'Adapte-se à temperatura', 'Adapt to the temperature', 'Em ambientes quentes, prefira tecidos respiráveis e evite camadas desnecessárias. Se o ginásio tiver ar condicionado forte ou se treinar cedo, leve uma camada fácil de retirar. O conforto térmico ajuda a manter a atenção no treino.', 'In warm conditions, prefer breathable fabrics and avoid unnecessary layers. If the gym has strong air conditioning or you train early, bring an easy-to-remove layer. Thermal comfort helps you stay focused on the session.'),
      (4, 'section', 'Confiança também conta', 'Confidence matters too', 'Funcionalidade vem primeiro, mas sentir-se bem com o conjunto pode tornar a rotina mais consistente. Escolha cores, cortes e combinações que representem o seu estilo sem comprometer apoio, cobertura ou liberdade de movimento.', 'Function comes first, but feeling good in your outfit can make your routine easier to maintain. Choose colours, cuts and combinations that reflect your style without compromising support, coverage or freedom of movement.')
    ) AS block("sort_order", "kind", "heading_pt", "heading_en", "text_pt", "text_en")
    WHERE post."slug" = 'o-que-vestir-no-ginasio'
      AND NOT EXISTS (SELECT 1 FROM "posts_body" existing WHERE existing."_parent_id" = post."id");

    INSERT INTO "posts_body" ("_order", "_parent_id", "id", "kind", "heading_p_t", "heading_e_n", "text_p_t", "text_e_n")
    SELECT block."sort_order", post."id", 'fabric-' || block."sort_order"::text, block."kind"::"public"."enum_posts_body_kind",
      block."heading_pt", block."heading_en", block."text_pt", block."text_en"
    FROM "posts" post
    CROSS JOIN (VALUES
      (0, 'section', 'O tecido muda a experiência da peça', 'Fabric changes how a garment performs', 'Na roupa desportiva, o tecido influencia elasticidade, toque, cobertura, gestão de humidade e tempo de secagem. A composição indicada na etiqueta é útil, mas a construção e a espessura do material também determinam como a peça se comporta.', 'In activewear, fabric affects stretch, feel, coverage, moisture management and drying time. The fibre composition on the label is useful, but the construction and weight of the material also determine how the garment performs.'),
      (1, 'section', 'Poliéster, poliamida e elastano', 'Polyester, polyamide and elastane', 'Poliéster e poliamida são fibras comuns por serem resistentes e de secagem relativamente rápida. O elastano acrescenta elasticidade e ajuda a peça a acompanhar o corpo. A percentagem, sozinha, não garante compressão ou qualidade: toque, densidade e recuperação também importam.', 'Polyester and polyamide are common because they are durable and relatively quick drying. Elastane adds stretch and helps the garment follow the body. Percentage alone does not guarantee compression or quality: feel, density and recovery matter too.'),
      (2, 'bullets', 'O que avaliar antes de comprar', 'What to assess before buying', 'Respirabilidade para a intensidade e o clima\nElasticidade em várias direções\nCobertura quando o tecido está esticado\nCosturas confortáveis e bem acabadas\nInstruções de lavagem compatíveis com a sua rotina', 'Breathability for the intensity and climate\nStretch in more than one direction\nCoverage when the fabric is extended\nComfortable, well-finished seams\nCare instructions that fit your routine'),
      (3, 'section', 'Algodão e misturas', 'Cotton and blends', 'O algodão oferece um toque familiar e confortável, especialmente em peças casuais e treinos leves. Contudo, pode reter mais humidade e demorar mais a secar. Misturas combinam características de diferentes fibras e podem equilibrar conforto, estrutura e manutenção.', 'Cotton offers a familiar comfortable feel, especially in casual pieces and light workouts. However, it can hold more moisture and take longer to dry. Blends combine fibre properties and may balance comfort, structure and care.'),
      (4, 'section', 'Cuidados que prolongam a vida útil', 'Care that extends garment life', 'Siga sempre a etiqueta. Em geral, lavar com água fria ou morna, evitar excesso de amaciador e secar sem calor intenso ajuda a preservar elasticidade e acabamento. Feche fechos, separe superfícies ásperas e não guarde a peça húmida depois do treino.', 'Always follow the care label. In general, washing in cool or warm water, avoiding excess fabric softener and drying without intense heat helps preserve stretch and finish. Close zips, separate rough surfaces and do not leave the garment damp after training.')
    ) AS block("sort_order", "kind", "heading_pt", "heading_en", "text_pt", "text_en")
    WHERE post."slug" = 'guia-tecidos-roupa-desportiva'
      AND NOT EXISTS (SELECT 1 FROM "posts_body" existing WHERE existing."_parent_id" = post."id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_posts_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_posts_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "posts_id";
    DROP TABLE IF EXISTS "posts_body" CASCADE;
    DROP TABLE IF EXISTS "posts" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_posts_body_kind";
    DROP TYPE IF EXISTS "public"."enum_posts_status";
  `)
}

import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`UPDATE storefront_content_faq_entries
    SET answer_p_t = replace(answer_p_t, '21 bairros', '23 bairros')
    WHERE answer_p_t LIKE 'Entregamos em Luanda%21 bairros organizados em 4 zonas%'`)
  await db.execute(sql`UPDATE storefront_content_faq_entries
    SET answer_e_n = replace(answer_e_n, '21 neighbourhoods', '23 neighbourhoods')
    WHERE answer_e_n LIKE 'We deliver in Luanda%21 neighbourhoods grouped in 4 zones%'`)
}

// Preserve published FAQ content on rollback.
export async function down(_args: MigrateDownArgs): Promise<void> {}

import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

const replacements = [
  ["storefront_content_faq_entries", "answer_p_t", "Entregamos em Luanda por estafeta local, em 21 bairros organizados em 4 zonas. O custo depende da zona e é apresentado no checkout; depois da confirmação, a equipa coordena consigo o horário de entrega. Não prometemos um prazo de 24 horas sem confirmação prévia.", "Entregamos em Luanda através da Zygo (zygo.ao), em 21 bairros organizados em 4 zonas. O custo depende da zona e é apresentado no checkout; depois da confirmação, a equipa coordena consigo o horário de entrega. Não prometemos um prazo de 24 horas sem confirmação prévia."],
  ["storefront_content_faq_entries", "answer_e_n", "We deliver in Luanda by local courier, across 21 neighbourhoods grouped in 4 zones. The fee depends on the zone and is shown at checkout; after confirmation, our team coordinates the delivery time. We do not promise 24-hour delivery without prior confirmation.", "We deliver in Luanda through Zygo (zygo.ao), across 21 neighbourhoods grouped in 4 zones. The fee depends on the zone and is shown at checkout; after confirmation, our team coordinates the delivery time. We do not promise 24-hour delivery without prior confirmation."],
  ["storefront_content_faq_entries", "answer_p_t", "Use o número da encomenda e o email utilizado na compra na página Consultar encomenda. A equipa coordena a entrega consigo. Pode consultar o estado na página Consultar encomenda.", "Use o número da encomenda e o email utilizado na compra na página Consultar encomenda. Depois de a encomenda ser enviada, enviamos-lhe por email o número de rastreio da Zygo, que pode consultar em zygo.ao/rastreio."],
  ["storefront_content_faq_entries", "answer_e_n", "Use the order number and the email used at checkout on the Track order page. Our team coordinates delivery with you. You can check the status on the Track order page.", "Use the order number and the email used at checkout on the Track order page. Once your order ships, we email you the Zygo tracking number, which you can follow at zygo.ao/rastreio."],
  ["storefront_content", "about_angola_body_p_t", "Na loja Angola, encontra preços em Kz, entrega em Luanda por estafeta local e pagamento por Multicaixa Express. Para outros destinos, o apoio confirma as opções disponíveis.", "Na loja Angola, encontra preços em Kz, entrega em Luanda pela Zygo e pagamento por Multicaixa Express. Para outros destinos, o apoio confirma as opções disponíveis."],
  ["storefront_content", "about_angola_body_e_n", "In the Angola store, prices are shown in Kz, with delivery in Luanda by local courier and payment by Multicaixa Express. For other destinations, support confirms the available options.", "In the Angola store, prices are shown in Kz, with delivery in Luanda by Zygo and payment by Multicaixa Express. For other destinations, support confirms the available options."],
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, column, before, after] of replacements) {
    await db.execute(sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${after} WHERE ${sql.identifier(column)} = ${before}`)
  }
}

// Published editorial content survives a code rollback.
export async function down(_args: MigrateDownArgs): Promise<void> {}

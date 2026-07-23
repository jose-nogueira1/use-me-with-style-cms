/**
 * Seeds a development catalogue into Payload so the storefront always reads
 * products through the real CMS API. The script is idempotent by product slug.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

type SeedProduct = {
  name: string
  slug: string
  category: 'vestidos' | 'tops' | 'leggings' | 'conjuntos'
  priceAOKz: number
  pricePTEur: number
  tag?: 'NOVIDADE' | 'BESTSELLER' | 'QUASE ESGOTADO'
  colors: string[]
  sizes: { size: 'XS' | 'S' | 'M' | 'L' | 'XL'; stockAO: number; stockPT: number }[]
}

const PRODUCTS: SeedProduct[] = [
  { name: 'Vestido Aurora', slug: 'vestido-aurora', category: 'vestidos', priceAOKz: 18500, pricePTEur: 22, tag: 'NOVIDADE', colors: ['Areia', 'Noite', 'Coral'], sizes: [{ size: 'S', stockAO: 4, stockPT: 2 }, { size: 'M', stockAO: 8, stockPT: 4 }, { size: 'L', stockAO: 12, stockPT: 5 }] },
  { name: 'Vestido Solene', slug: 'vestido-solene', category: 'vestidos', priceAOKz: 22000, pricePTEur: 26, colors: ['Preto', 'Marfim'], sizes: [{ size: 'S', stockAO: 2, stockPT: 1 }, { size: 'M', stockAO: 6, stockPT: 3 }, { size: 'L', stockAO: 9, stockPT: 4 }] },
  { name: 'Vestido Marés', slug: 'vestido-mares', category: 'vestidos', priceAOKz: 16500, pricePTEur: 20, tag: 'QUASE ESGOTADO', colors: ['Azul', 'Areia'], sizes: [{ size: 'S', stockAO: 0, stockPT: 0 }, { size: 'M', stockAO: 4, stockPT: 2 }, { size: 'L', stockAO: 7, stockPT: 3 }] },
  { name: 'Top Brisa', slug: 'top-brisa', category: 'tops', priceAOKz: 8500, pricePTEur: 10, colors: ['Preto', 'Branco', 'Rosa'], sizes: [{ size: 'S', stockAO: 15, stockPT: 6 }, { size: 'M', stockAO: 12, stockPT: 5 }, { size: 'L', stockAO: 8, stockPT: 3 }] },
  { name: 'Top Athena', slug: 'top-athena', category: 'tops', priceAOKz: 9500, pricePTEur: 11, tag: 'BESTSELLER', colors: ['Preto', 'Cinza'], sizes: [{ size: 'S', stockAO: 10, stockPT: 4 }, { size: 'M', stockAO: 14, stockPT: 6 }, { size: 'L', stockAO: 6, stockPT: 2 }] },
  { name: 'Top Lyra', slug: 'top-lyra', category: 'tops', priceAOKz: 7500, pricePTEur: 9, colors: ['Branco', 'Preto'], sizes: [{ size: 'S', stockAO: 5, stockPT: 2 }, { size: 'M', stockAO: 9, stockPT: 4 }, { size: 'L', stockAO: 11, stockPT: 5 }] },
  { name: 'Leggings Tempo', slug: 'leggings-tempo', category: 'leggings', priceAOKz: 12500, pricePTEur: 15, colors: ['Preto', 'Caramelo'], sizes: [{ size: 'S', stockAO: 18, stockPT: 7 }, { size: 'M', stockAO: 22, stockPT: 9 }, { size: 'L', stockAO: 15, stockPT: 6 }] },
  { name: 'Leggings Vento', slug: 'leggings-vento', category: 'leggings', priceAOKz: 14000, pricePTEur: 17, tag: 'NOVIDADE', colors: ['Preto', 'Antracite'], sizes: [{ size: 'S', stockAO: 8, stockPT: 3 }, { size: 'M', stockAO: 12, stockPT: 5 }, { size: 'L', stockAO: 9, stockPT: 4 }] },
  { name: 'Conjunto Sereno', slug: 'conjunto-sereno', category: 'conjuntos', priceAOKz: 24500, pricePTEur: 29, colors: ['Preto', 'Marfim'], sizes: [{ size: 'S', stockAO: 6, stockPT: 2 }, { size: 'M', stockAO: 10, stockPT: 4 }, { size: 'L', stockAO: 4, stockPT: 2 }] },
  { name: 'Conjunto Aurora', slug: 'conjunto-aurora', category: 'conjuntos', priceAOKz: 28000, pricePTEur: 33, tag: 'NOVIDADE', colors: ['Areia', 'Carvão'], sizes: [{ size: 'S', stockAO: 3, stockPT: 1 }, { size: 'M', stockAO: 8, stockPT: 3 }, { size: 'L', stockAO: 5, stockPT: 2 }] },
  { name: 'Top Íris', slug: 'top-iris', category: 'tops', priceAOKz: 8000, pricePTEur: 9.5, colors: ['Verde', 'Preto'], sizes: [{ size: 'S', stockAO: 11, stockPT: 4 }, { size: 'M', stockAO: 7, stockPT: 3 }, { size: 'L', stockAO: 14, stockPT: 6 }] },
  { name: 'Vestido Lume', slug: 'vestido-lume', category: 'vestidos', priceAOKz: 19500, pricePTEur: 23, colors: ['Coral', 'Preto'], sizes: [{ size: 'S', stockAO: 7, stockPT: 3 }, { size: 'M', stockAO: 9, stockPT: 4 }, { size: 'L', stockAO: 11, stockPT: 5 }] },
]

async function seed() {
  const payload = await getPayload({ config })

  for (const product of PRODUCTS) {
    const existing = await payload.find({
      collection: 'products',
      where: { slug: { equals: product.slug } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      const current = existing.docs[0]
      await payload.update({
        collection: 'products',
        id: current.id,
        data: {
          namePT: current.namePT || current.name,
          nameEN: current.nameEN || current.name,
          descriptionPT: current.descriptionPT || current.description || 'Uma peça versátil da coleção Use Me With Style, criada para conforto e confiança ao longo do dia.',
          descriptionEN: current.descriptionEN || 'A versatile Use Me With Style piece, designed for comfort and confidence throughout the day.',
        },
      })
      payload.logger.info(`Updated localized copy: ${product.name}`)
      continue
    }
    await payload.create({
      collection: 'products',
      data: {
        ...product,
        namePT: product.name,
        nameEN: product.name,
        descriptionPT: `Uma peça versátil da coleção Use Me With Style, criada para conforto e confiança ao longo do dia.`,
        descriptionEN: `A versatile Use Me With Style piece, designed for comfort and confidence throughout the day.`,
        colors: product.colors.map((color) => ({ color })),
        active: true,
        availableAO: true,
        availablePT: true,
      },
    })
    payload.logger.info(`Created product: ${product.name}`)
  }

  await payload.updateGlobal({
    slug: 'market-settings',
    data: {
      angolaPaymentLive: false,
      angolaBankTransferInstructions:
        'Instruções de pagamento Multicaixa Express enviadas por WhatsApp após a confirmação da encomenda.',
      angolaPaymentMethods: ['multicaixa_express', 'stripe', 'paypal'],
      angolaDeliveryMethods: ['courier_ao'],
      portugalPaymentMethods: ['paypal', 'stripe', 'mbway'],
      portugalDeliveryMethods: ['ctt', 'courier_pt'],
      // Client-provided legal copy (JOS-64, added 2026-07-23). Angola and
      // Portugal/EU have materially different terms (48h exchange-only vs.
      // 14-day statutory withdrawal with refund) so they're separate fields,
      // not a translation of each other.
      angolaReturnsPolicyText: [
        'Os pedidos de troca devem ser comunicados no prazo máximo de 48 horas após a receção da encomenda.',
        'As trocas estão sujeitas à disponibilidade de stock e apenas serão aceites se o artigo estiver nas mesmas condições em que foi entregue, sem sinais de uso, lavagem, odores, manchas, maquilhagem, desodorizante, pelos, danos ou alterações, e com as etiquetas originais intactas.',
        'Todos os artigos serão inspecionados pela equipa da USE ME WITH STYLE antes da aprovação da troca.',
        'Não serão realizados reembolsos por mudança de tamanho, cor, preferência pessoal ou desistência da compra. Quando possível, poderá ser realizada uma troca ou emitido crédito em loja.',
        'Os custos de recolha e nova entrega serão da responsabilidade da cliente, salvo em caso de defeito de fabrico ou envio incorreto.',
        'Qualquer defeito ou erro na encomenda deverá ser comunicado no prazo de 48 horas, acompanhado de fotografias ou vídeo.',
        'Esta política não prejudica os direitos legalmente reconhecidos ao consumidor.',
      ].join('\n\n'),
      portugalReturnsPolicyText: [
        'Nas compras realizadas online, o cliente dispõe de 14 dias consecutivos após a receção da encomenda para comunicar a intenção de devolução.',
        'Os artigos devem ser devolvidos sem sinais de uso, lavagem, odores, manchas, maquilhagem, desodorizante, pelos, danos ou alterações, e com as etiquetas originais intactas.',
        'A peça poderá ser experimentada apenas para verificar o tamanho e o ajuste. Todos os artigos devolvidos serão inspecionados pela equipa da USE ME WITH STYLE.',
        'Os custos da devolução serão da responsabilidade do cliente, salvo em caso de defeito ou erro imputável à USE ME WITH STYLE.',
        'O reembolso será efetuado após a receção e verificação do artigo, através do mesmo método de pagamento utilizado na compra e dentro do prazo legal aplicável.',
      ].join('\n\n'),
    },
  })

  payload.logger.info('Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

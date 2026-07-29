/**
 * Seeds a development catalogue into Payload so the storefront always reads
 * products through the real CMS API. The script is idempotent by product slug.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { guessHex, guessNameEN } from '../src/lib/colorPresets'

type SeedProduct = {
  name: string
  // English product name (2026-07-27 nameEN backfill, JOS QA report item).
  // Before this, both create and update paths defaulted nameEN to the
  // Portuguese `name`, so the field was always populated but never actually
  // translated -- the EN storefront silently showed PT names. See the
  // create/update logic below for how this is applied without clobbering a
  // real translation an admin may have entered by hand since.
  nameEN: string
  slug: string
  category: 'vestidos' | 'tops' | 'leggings' | 'conjuntos'
  priceAOKz: number
  pricePTEur: number
  tag?: 'NOVIDADE' | 'BESTSELLER' | 'QUASE ESGOTADO'
  colors: string[]
  sizes: { size: 'XS' | 'S' | 'M' | 'L' | 'XL'; stockAO: number; stockPT: number }[]
}

const PRODUCTS: SeedProduct[] = [
  { name: 'Vestido Aurora', nameEN: 'Aurora Dress', slug: 'vestido-aurora', category: 'vestidos', priceAOKz: 18500, pricePTEur: 22, tag: 'NOVIDADE', colors: ['Areia', 'Noite', 'Coral'], sizes: [{ size: 'S', stockAO: 4, stockPT: 2 }, { size: 'M', stockAO: 8, stockPT: 4 }, { size: 'L', stockAO: 12, stockPT: 5 }] },
  { name: 'Vestido Solene', nameEN: 'Solene Dress', slug: 'vestido-solene', category: 'vestidos', priceAOKz: 22000, pricePTEur: 26, colors: ['Preto', 'Marfim'], sizes: [{ size: 'S', stockAO: 2, stockPT: 1 }, { size: 'M', stockAO: 6, stockPT: 3 }, { size: 'L', stockAO: 9, stockPT: 4 }] },
  { name: 'Vestido Marés', nameEN: 'Tides Dress', slug: 'vestido-mares', category: 'vestidos', priceAOKz: 16500, pricePTEur: 20, tag: 'QUASE ESGOTADO', colors: ['Azul', 'Areia'], sizes: [{ size: 'S', stockAO: 0, stockPT: 0 }, { size: 'M', stockAO: 4, stockPT: 2 }, { size: 'L', stockAO: 7, stockPT: 3 }] },
  { name: 'Top Brisa', nameEN: 'Breeze Top', slug: 'top-brisa', category: 'tops', priceAOKz: 8500, pricePTEur: 10, colors: ['Preto', 'Branco', 'Rosa'], sizes: [{ size: 'S', stockAO: 15, stockPT: 6 }, { size: 'M', stockAO: 12, stockPT: 5 }, { size: 'L', stockAO: 8, stockPT: 3 }] },
  { name: 'Top Athena', nameEN: 'Athena Top', slug: 'top-athena', category: 'tops', priceAOKz: 9500, pricePTEur: 11, tag: 'BESTSELLER', colors: ['Preto', 'Cinza'], sizes: [{ size: 'S', stockAO: 10, stockPT: 4 }, { size: 'M', stockAO: 14, stockPT: 6 }, { size: 'L', stockAO: 6, stockPT: 2 }] },
  { name: 'Top Lyra', nameEN: 'Lyra Top', slug: 'top-lyra', category: 'tops', priceAOKz: 7500, pricePTEur: 9, colors: ['Branco', 'Preto'], sizes: [{ size: 'S', stockAO: 5, stockPT: 2 }, { size: 'M', stockAO: 9, stockPT: 4 }, { size: 'L', stockAO: 11, stockPT: 5 }] },
  { name: 'Leggings Tempo', nameEN: 'Tempo Leggings', slug: 'leggings-tempo', category: 'leggings', priceAOKz: 12500, pricePTEur: 15, colors: ['Preto', 'Caramelo'], sizes: [{ size: 'S', stockAO: 18, stockPT: 7 }, { size: 'M', stockAO: 22, stockPT: 9 }, { size: 'L', stockAO: 15, stockPT: 6 }] },
  { name: 'Leggings Vento', nameEN: 'Wind Leggings', slug: 'leggings-vento', category: 'leggings', priceAOKz: 14000, pricePTEur: 17, tag: 'NOVIDADE', colors: ['Preto', 'Antracite'], sizes: [{ size: 'S', stockAO: 8, stockPT: 3 }, { size: 'M', stockAO: 12, stockPT: 5 }, { size: 'L', stockAO: 9, stockPT: 4 }] },
  { name: 'Conjunto Sereno', nameEN: 'Serene Set', slug: 'conjunto-sereno', category: 'conjuntos', priceAOKz: 24500, pricePTEur: 29, colors: ['Preto', 'Marfim'], sizes: [{ size: 'S', stockAO: 6, stockPT: 2 }, { size: 'M', stockAO: 10, stockPT: 4 }, { size: 'L', stockAO: 4, stockPT: 2 }] },
  { name: 'Conjunto Aurora', nameEN: 'Aurora Set', slug: 'conjunto-aurora', category: 'conjuntos', priceAOKz: 28000, pricePTEur: 33, tag: 'NOVIDADE', colors: ['Areia', 'Carvão'], sizes: [{ size: 'S', stockAO: 3, stockPT: 1 }, { size: 'M', stockAO: 8, stockPT: 3 }, { size: 'L', stockAO: 5, stockPT: 2 }] },
  { name: 'Top Íris', nameEN: 'Iris Top', slug: 'top-iris', category: 'tops', priceAOKz: 8000, pricePTEur: 9.5, colors: ['Verde', 'Preto'], sizes: [{ size: 'S', stockAO: 11, stockPT: 4 }, { size: 'M', stockAO: 7, stockPT: 3 }, { size: 'L', stockAO: 14, stockPT: 6 }] },
  { name: 'Vestido Lume', nameEN: 'Glow Dress', slug: 'vestido-lume', category: 'vestidos', priceAOKz: 19500, pricePTEur: 23, colors: ['Coral', 'Preto'], sizes: [{ size: 'S', stockAO: 7, stockPT: 3 }, { size: 'M', stockAO: 9, stockPT: 4 }, { size: 'L', stockAO: 11, stockPT: 5 }] },
]

// Category/tag/colour taxonomies became collections on 2026-07-25; the seed
// resolves (or creates) taxonomy rows first, then references them by id.
const CATEGORY_META: Record<SeedProduct['category'], { namePT: string; nameEN: string }> = {
  vestidos: { namePT: 'Vestidos', nameEN: 'Dresses' },
  tops: { namePT: 'Tops', nameEN: 'Tops' },
  leggings: { namePT: 'Leggings', nameEN: 'Leggings' },
  conjuntos: { namePT: 'Conjuntos', nameEN: 'Sets' },
}

const TAG_META: Record<NonNullable<SeedProduct['tag']>, { labelPT: string; labelEN: string }> = {
  NOVIDADE: { labelPT: 'Novidade', labelEN: 'New' },
  BESTSELLER: { labelPT: 'Bestseller', labelEN: 'Bestseller' },
  'QUASE ESGOTADO': { labelPT: 'Quase esgotado', labelEN: 'Almost gone' },
}

async function seed() {
  const payload = await getPayload({ config })

  const categoryIdBySlug = new Map<string, number>()
  for (const [slug, meta] of Object.entries(CATEGORY_META)) {
    const existing = await payload.find({ collection: 'categories', where: { slug: { equals: slug } }, limit: 1 })
    const doc = existing.docs[0] ?? (await payload.create({ collection: 'categories', data: { ...meta, slug } }))
    categoryIdBySlug.set(slug, doc.id)
  }

  const tagIdByValue = new Map<string, number>()
  for (const [value, meta] of Object.entries(TAG_META)) {
    const existing = await payload.find({ collection: 'merch-tags', where: { labelPT: { equals: meta.labelPT } }, limit: 1 })
    const doc = existing.docs[0] ?? (await payload.create({ collection: 'merch-tags', data: meta }))
    tagIdByValue.set(value, doc.id)
  }

  const colorIdByName = new Map<string, number>()
  async function colorId(name: string): Promise<number> {
    const cached = colorIdByName.get(name)
    if (cached !== undefined) return cached
    const existing = await payload.find({ collection: 'colors', where: { namePT: { equals: name } }, limit: 1 })
    const doc = existing.docs[0] ?? (await payload.create({ collection: 'colors', data: { namePT: name, nameEN: guessNameEN(name), hex: guessHex(name) } }))
    colorIdByName.set(name, doc.id)
    return doc.id
  }

  // Shared size charts (2026-07-25): two dev fixtures covering the four
  // seeded categories; products reference one by category below.
  const SIZE_GUIDES: Record<string, { name: string; rows: { size: 'XS' | 'S' | 'M' | 'L' | 'XL'; bust?: number; waist?: number; hip?: number; length?: number }[] }> = {
    dresses: {
      name: 'Vestidos & Conjuntos — padrão',
      rows: [
        { size: 'XS', bust: 78, waist: 60, hip: 86 },
        { size: 'S', bust: 82, waist: 64, hip: 90 },
        { size: 'M', bust: 86, waist: 68, hip: 94 },
        { size: 'L', bust: 92, waist: 74, hip: 100 },
        { size: 'XL', bust: 98, waist: 80, hip: 106 },
      ],
    },
    activewear: {
      name: 'Tops & Leggings — padrão',
      rows: [
        { size: 'XS', bust: 76, waist: 58, hip: 84 },
        { size: 'S', bust: 80, waist: 62, hip: 88 },
        { size: 'M', bust: 84, waist: 66, hip: 92 },
        { size: 'L', bust: 90, waist: 72, hip: 98 },
        { size: 'XL', bust: 96, waist: 78, hip: 104 },
      ],
    },
  }
  const guideIdByKey = new Map<string, number>()
  for (const [key, guide] of Object.entries(SIZE_GUIDES)) {
    const existing = await payload.find({ collection: 'size-guides', where: { name: { equals: guide.name } }, limit: 1 })
    const doc = existing.docs[0] ?? (await payload.create({ collection: 'size-guides', data: guide }))
    guideIdByKey.set(key, doc.id)
  }
  const guideKeyByCategory: Record<SeedProduct['category'], string> = {
    vestidos: 'dresses',
    conjuntos: 'dresses',
    tops: 'activewear',
    leggings: 'activewear',
  }

  for (const product of PRODUCTS) {
    const existing = await payload.find({
      collection: 'products',
      where: { slug: { equals: product.slug } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      const current = existing.docs[0]
      // nameEN backfill (2026-07-27): the old default here was
      // `current.nameEN || current.name`, which left nameEN permanently
      // stuck on the untranslated Portuguese name (since the field was
      // always non-empty, just wrong). Only overwrite it with the real
      // translation when the stored value still looks like that old
      // default (equal to the PT name/namePT) -- if an admin has since
      // entered a genuine translation by hand, it won't match and is left
      // alone.
      const nameENLooksUntranslated =
        !current.nameEN || current.nameEN === current.name || current.nameEN === current.namePT
      await payload.update({
        collection: 'products',
        id: current.id,
        data: {
          namePT: current.namePT || current.name,
          nameEN: nameENLooksUntranslated ? product.nameEN : current.nameEN,
          descriptionPT: current.descriptionPT || current.description || 'Uma peça versátil da coleção Use Me With Style, criada para conforto e confiança ao longo do dia.',
          descriptionEN: current.descriptionEN || 'A versatile Use Me With Style piece, designed for comfort and confidence throughout the day.',
        },
      })
      payload.logger.info(`Updated localized copy: ${product.name}`)
      continue
    }
    // Variant rows = every colour x every size. Dev fixture convenience:
    // each colour gets the size row's full stock numbers (totals don't
    // matter for local testing; prod stock is entered by the admin).
    const productColorIds = await Promise.all(product.colors.map((name) => colorId(name)))
    const variants = productColorIds.flatMap((cid) =>
      product.sizes.map((row) => ({ color: cid, size: row.size, stockAO: row.stockAO, stockPT: row.stockPT })),
    )
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip colors/sizes off the spread; they became `variants`
    const { colors: _colors, sizes: _sizes, ...productRest } = product
    await payload.create({
      collection: 'products',
      data: {
        ...productRest,
        namePT: product.name,
        nameEN: product.nameEN,
        descriptionPT: `Uma peça versátil da coleção Use Me With Style, criada para conforto e confiança ao longo do dia.`,
        descriptionEN: `A versatile Use Me With Style piece, designed for comfort and confidence throughout the day.`,
        category: categoryIdBySlug.get(product.category)!,
        tag: product.tag ? tagIdByValue.get(product.tag) : undefined,
        variants,
        sizeGuide: guideIdByKey.get(guideKeyByCategory[product.category]),
        shippingWeightGrams: 500,
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
      angolaBankTransferInstructionsPT:
        'Instruções de pagamento Multicaixa Express enviadas por WhatsApp após a confirmação da encomenda.',
      angolaBankTransferInstructionsEN:
        'Multicaixa Express payment instructions sent via WhatsApp after order confirmation.',
      angolaPaymentMethods: ['multicaixa_express', 'stripe', 'paypal'],
      angolaDeliveryMethods: ['courier_ao'],
      portugalPaymentMethods: ['paypal', 'stripe', 'mbway'],
      portugalDeliveryMethods: ['ctt', 'courier_pt'],
      // Client-provided legal copy (JOS-64, added 2026-07-23). Angola and
      // Portugal/EU have materially different terms (48h exchange-only vs.
      // 14-day statutory withdrawal with refund) so they're separate fields,
      // not a translation of each other. English versions (added
      // 2026-07-24) are our own translation of the client's PT text, not
      // client-certified -- flagged for their sign-off before this seed's
      // EN copy is treated as final.
      angolaReturnsPolicyTextPT: [
        'Os pedidos de troca devem ser comunicados no prazo máximo de 48 horas após a receção da encomenda.',
        'As trocas estão sujeitas à disponibilidade de stock e apenas serão aceites se o artigo estiver nas mesmas condições em que foi entregue, sem sinais de uso, lavagem, odores, manchas, maquilhagem, desodorizante, pelos, danos ou alterações, e com as etiquetas originais intactas.',
        'Todos os artigos serão inspecionados pela equipa da USE ME WITH STYLE antes da aprovação da troca.',
        'Não serão realizados reembolsos por mudança de tamanho, cor, preferência pessoal ou desistência da compra. Quando possível, poderá ser realizada uma troca ou emitido crédito em loja.',
        'Os custos de recolha e nova entrega serão da responsabilidade da cliente, salvo em caso de defeito de fabrico ou envio incorreto.',
        'Qualquer defeito ou erro na encomenda deverá ser comunicado no prazo de 48 horas, acompanhado de fotografias ou vídeo.',
        'Esta política não prejudica os direitos legalmente reconhecidos ao consumidor.',
      ].join('\n\n'),
      angolaReturnsPolicyTextEN: [
        'Exchange requests must be made within a maximum of 48 hours of receiving the order.',
        'Exchanges are subject to stock availability and will only be accepted if the item is in the same condition it was delivered in: unworn, unwashed, and free of odors, stains, makeup, deodorant marks, hair/fibers, damage, or alterations, with the original tags intact.',
        'All items will be inspected by the USE ME WITH STYLE team before an exchange is approved.',
        "Refunds will not be issued for size or color changes, personal preference, or cancelling a purchase. Where possible, an exchange or store credit may be offered instead.",
        "Pickup and re-delivery costs are the customer's responsibility, except in cases of a manufacturing defect or an incorrect shipment.",
        'Any defect or error in the order must be reported within 48 hours, along with photos or video.',
        "This policy does not affect the consumer's legally recognized rights.",
      ].join('\n\n'),
      portugalReturnsPolicyTextPT: [
        'Nas compras realizadas online, o cliente dispõe de 14 dias consecutivos após a receção da encomenda para comunicar a intenção de devolução.',
        'Os artigos devem ser devolvidos sem sinais de uso, lavagem, odores, manchas, maquilhagem, desodorizante, pelos, danos ou alterações, e com as etiquetas originais intactas.',
        'A peça poderá ser experimentada apenas para verificar o tamanho e o ajuste. Todos os artigos devolvidos serão inspecionados pela equipa da USE ME WITH STYLE.',
        'Os custos da devolução serão da responsabilidade do cliente, salvo em caso de defeito ou erro imputável à USE ME WITH STYLE.',
        'O reembolso será efetuado após a receção e verificação do artigo, através do mesmo método de pagamento utilizado na compra e dentro do prazo legal aplicável.',
      ].join('\n\n'),
      portugalReturnsPolicyTextEN: [
        'For purchases made online, the customer has 14 consecutive days from receiving the order to notify us of their intention to return it.',
        'Items must be returned unworn, unwashed, and free of odors, stains, makeup, deodorant marks, hair/fibers, damage, or alterations, with the original tags intact.',
        'The item may be tried on only to check size and fit. All returned items will be inspected by the USE ME WITH STYLE team.',
        "Return shipping costs are the customer's responsibility, except in cases of a defect or an error attributable to USE ME WITH STYLE.",
        'The refund will be issued after the item is received and inspected, using the same payment method as the original purchase and within the applicable legal timeframe.',
      ].join('\n\n'),
      // Business hours + shipping info (JOS-64 follow-up, client copy
      // provided 2026-07-24). Same bilingual pattern as the returns policy.
      businessHoursTextPT: 'De segunda-feira a sábado, das 9h às 19h.\n\nDomingos e feriados: encerrado.',
      businessHoursTextEN: 'Monday to Saturday, 9am to 7pm.\n\nSundays and public holidays: closed.',
      angolaShippingTextPT:
        'Em Angola, as entregas serão realizadas através de empresas de motoboy, com o custo calculado de acordo com a localização da cliente. O pagamento da entrega poderá ser efetuado antecipadamente ou no ato da entrega, conforme a modalidade disponibilizada.',
      angolaShippingTextEN:
        "In Angola, deliveries are made through motorbike courier companies, with the cost calculated based on the customer's location. Delivery payment can be made in advance or on delivery, depending on the option available.",
      portugalShippingTextPT:
        'Em Portugal, os envios serão realizados através dos CTT, com o custo e o prazo estimado calculados de acordo com o destino.',
      portugalShippingTextEN:
        'In Portugal, shipments are made through CTT, with the cost and estimated delivery time calculated according to the destination.',
      internationalShippingTextPT:
        'Também estarão disponíveis envios internacionais, com custos e prazos definidos conforme o país de destino.',
      internationalShippingTextEN:
        'International shipping is also available, with costs and delivery times set according to the destination country.',
    },
  })

  // Privacy Policy + Terms & Conditions (user request, 2026-07-24).
  // *** AI-DRAFTED GENERIC TEMPLATE -- NOT CLIENT-PROVIDED, NOT LAWYER-
  // REVIEWED. *** Unlike every other MarketSettings/LegalContent field seeded
  // above (which is either client copy or a straight translation of it), this
  // text was written as a reasonable Phase 1 placeholder covering the basics
  // (GDPR for Portugal/EU, a nod to Angola's own data protection law, EU ODR
  // link, Livro de Reclamações reference) but must be reviewed by a lawyer
  // before it's treated as the real policy.
  await payload.updateGlobal({
    slug: 'legal-content',
    data: {
      privacyPolicyTextPT: [
        'A USE ME WITH STYLE respeita a privacidade dos seus clientes e visitantes e compromete-se a proteger os dados pessoais que lhe são confiados, em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD) para clientes em Portugal e na União Europeia, e com a Lei de Proteção de Dados Pessoais aplicável em Angola.',
        'Esta política explica que dados pessoais recolhemos, para que finalidade os utilizamos, com quem os partilhamos e quais os direitos que assistem a cada titular dos dados.',
        'Dados que recolhemos: recolhemos os dados fornecidos diretamente por si ao efetuar uma compra ou ao contactar-nos, nomeadamente nome, endereço de email, número de telefone, morada de entrega e faturação, e histórico de encomendas. Não recolhemos dados de pagamento diretamente — estes são processados pelos nossos parceiros de pagamento (Stripe, PayPal, MB WAY ou AppyPay/Multicaixa Express, consoante o método escolhido), que têm as suas próprias políticas de privacidade.',
        'Finalidade do tratamento: utilizamos os seus dados para processar e entregar encomendas, comunicar sobre o estado da sua encomenda (por email e WhatsApp), responder a pedidos de apoio ao cliente e, quando aplicável, cumprir obrigações legais e fiscais.',
        'Partilha de dados com terceiros: os seus dados poderão ser partilhados com prestadores de serviços que nos ajudam a operar a loja, nomeadamente empresas de entrega (CTT em Portugal, empresas de motoboy em Angola), processadores de pagamento, e serviços de alojamento e envio de email. Estes prestadores só têm acesso aos dados estritamente necessários para prestar o respetivo serviço.',
        'Prazo de conservação: conservamos os seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política e as obrigações legais aplicáveis, nomeadamente as obrigações fiscais e contabilísticas.',
        'Os seus direitos: tem o direito de aceder, retificar, apagar ou pedir a portabilidade dos seus dados pessoais, bem como o direito de se opor ou limitar o respetivo tratamento. Para exercer qualquer um destes direitos, contacte-nos através do formulário disponível na página de Ajuda ou por WhatsApp. Se residir em Portugal ou na União Europeia, tem também o direito de apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD).',
        'Cookies: este site utiliza cookies para melhorar a experiência de navegação e, quando autorizado por si, para fins de análise. Pode gerir as suas preferências de cookies a qualquer momento através da opção "Preferências de cookies" no rodapé do site.',
        'Alterações a esta política: esta política poderá ser atualizada periodicamente. A versão em vigor será sempre a publicada nesta página.',
      ].join('\n\n'),
      privacyPolicyTextEN: [
        'USE ME WITH STYLE respects the privacy of its customers and visitors and is committed to protecting the personal data entrusted to us, in accordance with the General Data Protection Regulation (GDPR) for customers in Portugal and the European Union, and with the personal data protection law applicable in Angola.',
        'This policy explains what personal data we collect, why we use it, who we share it with, and what rights each data subject has.',
        "Data we collect: we collect the data you provide directly when placing an order or contacting us, namely name, email address, phone number, delivery and billing address, and order history. We do not collect payment data directly — this is processed by our payment partners (Stripe, PayPal, MB WAY, or AppyPay/Multicaixa Express, depending on the method chosen), who have their own privacy policies.",
        'Purpose of processing: we use your data to process and deliver orders, communicate about your order status (by email and WhatsApp), respond to customer support requests, and, where applicable, comply with legal and tax obligations.',
        'Sharing data with third parties: your data may be shared with service providers who help us operate the store, namely delivery companies (CTT in Portugal, motorbike courier companies in Angola), payment processors, and hosting and email delivery services. These providers only have access to the data strictly necessary to provide their respective service.',
        'Retention period: we retain your data for as long as necessary to fulfil the purposes described in this policy and applicable legal obligations, including tax and accounting obligations.',
        "Your rights: you have the right to access, rectify, erase, or request portability of your personal data, as well as the right to object to or restrict its processing. To exercise any of these rights, contact us through the form on the Help page or via WhatsApp. If you reside in Portugal or the European Union, you also have the right to lodge a complaint with the Comissão Nacional de Proteção de Dados (CNPD).",
        'Cookies: this site uses cookies to improve the browsing experience and, when authorized by you, for analytics purposes. You can manage your cookie preferences at any time via the "Cookie preferences" option in the site footer.',
        'Changes to this policy: this policy may be updated periodically. The version in effect will always be the one published on this page.',
      ].join('\n\n'),
      termsTextPT: [
        'Estes Termos e Condições regulam a utilização do site e a compra de produtos junto da USE ME WITH STYLE, uma marca de vestuário e lifestyle com atuação em Angola e Portugal. Ao efetuar uma compra ou utilizar este site, aceita os termos aqui descritos.',
        'Produtos e disponibilidade: todos os produtos estão sujeitos a disponibilidade de stock. Fazemos os possíveis para garantir que as imagens, descrições e preços apresentados são exatos, mas podem ocorrer pequenas variações entre o artigo fotografado e o artigo recebido.',
        'Preços e pagamento: os preços apresentados incluem os impostos aplicáveis, salvo indicação em contrário. Os métodos de pagamento disponíveis variam consoante o mercado (Angola ou Portugal) e são apresentados no checkout. O pagamento é processado de forma segura pelos nossos parceiros de pagamento.',
        'Encomendas e confirmação: após a confirmação do pagamento, receberá uma confirmação de encomenda por email. A USE ME WITH STYLE reserva-se o direito de recusar ou cancelar uma encomenda em caso de erro manifesto de preço, indisponibilidade de stock ou suspeita de fraude, sendo o cliente sempre notificado e reembolsado nesses casos.',
        'Entrega: os prazos e custos de entrega variam consoante o destino e são apresentados no checkout. Para mais informação sobre entregas e envios, consulte a página de Ajuda.',
        'Trocas e devoluções: as condições de troca e devolução aplicáveis a cada mercado estão descritas na Política de Trocas e Devoluções, disponível na página de Ajuda.',
        'Resolução de litígios: em caso de litígio de consumo, o cliente residente em Portugal ou na União Europeia pode recorrer à Plataforma Europeia de Resolução de Litígios em Linha, disponível em ec.europa.eu/consumers/odr, ou apresentar reclamação através do Livro de Reclamações Eletrónico.',
        'Propriedade intelectual: todo o conteúdo deste site, incluindo textos, imagens e logótipos, é propriedade da USE ME WITH STYLE ou dos seus licenciadores, não podendo ser reproduzido sem autorização prévia.',
        'Alterações a estes termos: estes termos poderão ser atualizados periodicamente. A versão em vigor será sempre a publicada nesta página.',
      ].join('\n\n'),
      termsTextEN: [
        'These Terms & Conditions govern the use of this site and the purchase of products from USE ME WITH STYLE, an apparel and lifestyle brand operating in Angola and Portugal. By placing an order or using this site, you accept the terms described here.',
        'Products and availability: all products are subject to stock availability. We make every effort to ensure that the images, descriptions, and prices shown are accurate, but small variations between the photographed item and the item received may occur.',
        'Pricing and payment: prices shown include applicable taxes, unless stated otherwise. Available payment methods vary by market (Angola or Portugal) and are shown at checkout. Payment is processed securely by our payment partners.',
        'Orders and confirmation: after payment is confirmed, you will receive an order confirmation by email. USE ME WITH STYLE reserves the right to refuse or cancel an order in the event of an obvious pricing error, stock unavailability, or suspected fraud; the customer will always be notified and refunded in such cases.',
        'Delivery: delivery times and costs vary by destination and are shown at checkout. For more information on shipping and delivery, see the Help page.',
        'Returns and exchanges: the exchange and return conditions applicable to each market are described in the Returns & Exchanges Policy, available on the Help page.',
        'Dispute resolution: in the event of a consumer dispute, customers residing in Portugal or the European Union may use the European Online Dispute Resolution Platform, available at ec.europa.eu/consumers/odr, or file a complaint through the electronic complaints book (Livro de Reclamações Eletrónico).',
        'Intellectual property: all content on this site, including text, images, and logos, is the property of USE ME WITH STYLE or its licensors and may not be reproduced without prior authorization.',
        'Changes to these terms: these terms may be updated periodically. The version in effect will always be the one published on this page.',
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

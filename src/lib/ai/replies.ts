import type { ExtractionIntent, ExtractionLanguage } from './extraction'
import type { CatalogueMarket, OutOfStockRecovery, ProductContext, ProductVariantContext } from './catalogue'

export type ReplyLanguage = Exclude<ExtractionLanguage, 'unknown'>

export type ReplyFacts = {
  coupon?: { valid: boolean; code: string; discountText?: string | null; reason?: string | null }
  delivery?: string | null
  payment?: string | null
  returnPolicy?: string | null
}

export type DeterministicReplyInput = {
  intent: ExtractionIntent
  language: ReplyLanguage
  market: CatalogueMarket | null
  product?: ProductContext | null
  alternatives?: ProductContext[]
  outOfStockRecovery?: OutOfStockRecovery | null
  facts?: ReplyFacts
}

function money(value: number, market: CatalogueMarket): string {
  const formatted = market === 'AO'
    ? `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(value)} Kz`
    : `${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} EUR`
  return formatted.replace(/\u00a0/g, ' ')
}

function productName(product: ProductContext, language: ReplyLanguage): string {
  return language === 'en' ? (product.nameEN || product.namePT || product.name) : (product.namePT || product.nameEN || product.name)
}

function link(product: ProductContext): string {
  return product.productUrl ? ` ${product.productUrl}` : ''
}

function marketName(market: CatalogueMarket, language: ReplyLanguage): string {
  if (language === 'en') return market === 'AO' ? 'Angola' : 'Portugal'
  return market === 'AO' ? 'Angola' : 'Portugal'
}

function uniqueValues(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function availableSizes(product: ProductContext): string {
  return uniqueValues(product.variants.filter((variant) => variant.available).map((variant) => variant.size)).join(', ')
}

function optionLabel(product: ProductContext, language: ReplyLanguage, plural = false): string {
  const configured = product.optionLabel?.trim()
  if (!configured || /^(tamanho|size)$/i.test(configured)) {
    if (language === 'en') return plural ? 'Available sizes' : 'size'
    return plural ? 'Tamanhos disponíveis' : 'tamanho'
  }
  return configured
}

function alternativeProductLine(product: ProductContext, language: ReplyLanguage): string {
  const name = productName(product, language)
  const sizes = availableSizes(product)
  const price = product.price == null ? null : money(product.price, product.market)
  const label = optionLabel(product, language, true)
  if (language === 'en') return `${name}${sizes ? ` (${label.toLowerCase()}: ${sizes})` : ''}${price ? ` — ${price}` : ''}.${link(product)}`
  return `${name}${sizes ? ` (${label.toLowerCase()}: ${sizes})` : ''}${price ? ` — ${price}` : ''}.${link(product)}`
}

function sameProductRecoveryText(
  product: ProductContext,
  recovery: OutOfStockRecovery,
  language: ReplyLanguage,
): string[] {
  const parts: string[] = []
  const sameSize = recovery.sameProductOptions.filter((option) => option.kind === 'same_size_other_colour')
  const sameColour = recovery.sameProductOptions.filter((option) => option.kind === 'same_colour_other_size')
  const other = recovery.sameProductOptions.filter((option) => option.kind === 'other_variant')
  if (sameSize.length) {
    const size = sameSize[0]?.size
    const colours = uniqueValues(sameSize.map((option) => option.colour)).join(', ')
    parts.push(language === 'en'
      ? `The same product is available in size ${size || 'requested'} in ${colours}.`
      : `O mesmo produto está disponível no tamanho ${size || 'pedido'} nas cores ${colours}.`)
  }
  if (sameColour.length) {
    const colour = sameColour[0]?.colour
    const sizes = uniqueValues(sameColour.map((option) => option.size)).join(', ')
    parts.push(language === 'en'
      ? `In ${colour || 'the requested colour'}, the available sizes are ${sizes}.`
      : `Na cor ${colour || 'pedida'}, os tamanhos disponíveis são ${sizes}.`)
  }
  if (!sameSize.length && !sameColour.length && other.length) {
    const labels = other.slice(0, 4).map((option: ProductVariantContext) => [option.colour, option.size].filter(Boolean).join(' — ')).join('; ')
    parts.push(language === 'en' ? `Other available options for this product: ${labels}.` : `Outras opções disponíveis deste produto: ${labels}.`)
  }
  if (parts.length) parts[parts.length - 1] += link(product)
  return parts
}

function outOfStockReply(input: DeterministicReplyInput, product: ProductContext): string {
  const recovery = input.outOfStockRecovery
  const sections = [input.language === 'en'
    ? 'That exact option is currently out of stock.'
    : 'Essa opção está atualmente esgotada.']
  if (recovery) {
    sections.push(...sameProductRecoveryText(product, recovery, input.language))
    if (recovery.recommendations.length) {
      const heading = input.language === 'en' ? 'Similar products currently available:' : 'Produtos semelhantes disponíveis:'
      const recommendationLines: string[] = []
      for (const recommendation of recovery.recommendations) {
        const line = alternativeProductLine(recommendation.product, input.language)
        if ([...sections, heading, ...recommendationLines, line].join(' ').length > 790) break
        recommendationLines.push(line)
      }
      if (recommendationLines.length) sections.push(heading, ...recommendationLines)
    }
  }
  if (sections.length === 1) {
    sections.push(input.language === 'en'
      ? 'Our team can help you find an alternative.'
      : 'A nossa equipa pode ajudar a encontrar uma alternativa.')
  }
  return sections.join(' ')
}

function productAvailability(input: DeterministicReplyInput): string | null {
  const product = input.product
  if (!product || !input.market || !product.availableInMarket || product.variants.length === 0) return null
  const availableVariants = product.matchedVariants.filter((item) => item.available)
  const variant = availableVariants[0] || product.matchedVariants[0]
  const name = productName(product, input.language)
  const price = product.price == null ? null : money(product.price, input.market)
  if (availableVariants.length) {
    const sizes = [...new Set(availableVariants.map((item) => item.size).filter(Boolean))].join(', ')
    const availableOptionLabel = optionLabel(product, input.language, true)
    const kitContents = product.productType === 'bundle' && product.bundleContents.length
      ? (input.language === 'en' ? ` It includes ${product.bundleContents.map((item) => `${item.qty} × ${item.name}`).join(', ')}.` : ` Inclui ${product.bundleContents.map((item) => `${item.qty} × ${item.name}`).join(', ')}.`)
      : ''
    if (product.matchedVariants.length > 1) {
      if (input.language === 'en') return `Yes - ${name} is available in ${marketName(input.market, 'en')}.${sizes ? ` ${availableOptionLabel}: ${sizes}.` : ''}${kitContents}${price ? ` The current price is ${price}.` : ''}${link(product)}`
      return `Sim - ${name} está disponível em ${marketName(input.market, 'pt')}.${sizes ? ` ${availableOptionLabel}: ${sizes}.` : ''}${kitContents}${price ? ` O preço atual é ${price}.` : ''}${link(product)}`
    }
    if (input.language === 'en') return `Yes - ${name}${variant.size ? `, ${optionLabel(product, input.language)} ${variant.size}` : ''}, is available in ${marketName(input.market, 'en')}.${kitContents}${price ? ` The current price is ${price}.` : ''}${link(product)}`
    return `Sim - ${name}${variant.size ? `, ${optionLabel(product, input.language)} ${variant.size}` : ''}, está disponível em ${marketName(input.market, 'pt')}.${kitContents}${price ? ` O preço atual é ${price}.` : ''}${link(product)}`
  }
  return outOfStockReply(input, product)
}

function productPrice(input: DeterministicReplyInput): string | null {
  if (!input.product || !input.market || input.product.price == null) return null
  const name = productName(input.product, input.language)
  const value = money(input.product.price, input.market)
  if (input.language === 'en') return `${name} is currently ${value}.${link(input.product)}`
  return `${name} custa atualmente ${value}.${link(input.product)}`
}

function productSizing(input: DeterministicReplyInput): string | null {
  if (!input.product) return null
  const note = input.language === 'en' ? input.product.fitNote : input.product.fitNote
  if (!note) return null
  const name = productName(input.product, input.language)
  return input.language === 'en' ? `For ${name}: ${note}${link(input.product)}` : `Para ${name}: ${note}${link(input.product)}`
}

function simpleFact(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value.trim()
}

export function buildDeterministicReply(input: DeterministicReplyInput): string | null {
  switch (input.intent) {
    case 'greeting': return input.language === 'en' ? 'Hi! How can we help you today?' : 'Olá! Como podemos ajudar hoje?'
    case 'product_availability': return productAvailability(input)
    case 'product_price': return productPrice(input)
    case 'product_sizing': return productSizing(input)
    case 'coupon': {
      const coupon = input.facts?.coupon
      if (!coupon) return null
      if (coupon.valid) return input.language === 'en' ? `The code ${coupon.code} is valid${coupon.discountText ? `: ${coupon.discountText}` : ''}.` : `O código ${coupon.code} é válido${coupon.discountText ? `: ${coupon.discountText}` : ''}.`
      const reason = coupon.reason ? `: ${coupon.reason}` : '.'
      return input.language === 'en' ? `The code ${coupon.code} is not valid${reason}` : `O código ${coupon.code} não é válido${reason}`
    }
    case 'delivery': return simpleFact(input.facts?.delivery)
    case 'payment': return simpleFact(input.facts?.payment)
    case 'return_policy': return simpleFact(input.facts?.returnPolicy)
    default: return null
  }
}

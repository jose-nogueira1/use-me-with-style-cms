import type { ExtractionIntent, ExtractionLanguage } from './extraction'
import type { CatalogueMarket, ProductContext } from './catalogue'

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

function productAvailability(input: DeterministicReplyInput): string | null {
  const product = input.product
  if (!product || !input.market || !product.availableInMarket || product.matchedVariants.length === 0) return null
  const variant = product.matchedVariants[0]
  const name = productName(product, input.language)
  const price = product.price == null ? null : money(product.price, input.market)
  if (variant.available) {
    if (input.language === 'en') return `Yes - ${name}, size ${variant.size || 'requested'}, is available in ${marketName(input.market, 'en')}.${price ? ` The current price is ${price}.` : ''}${link(product)}`
    return `Sim - ${name}, tamanho ${variant.size || 'pedido'}, está disponível em ${marketName(input.market, 'pt')}.${price ? ` O preço atual é ${price}.` : ''}${link(product)}`
  }
  const alternative = input.alternatives?.find((candidate) => candidate.availableInMarket && candidate.matchedVariants.some((item) => item.available))
  if (alternative) {
    const alternativeName = productName(alternative, input.language)
    if (input.language === 'en') return `That exact option is currently out of stock. We can suggest ${alternativeName} instead.${link(alternative)}`
    return `Essa opção está atualmente esgotada. Podemos sugerir ${alternativeName} em alternativa.${link(alternative)}`
  }
  return input.language === 'en' ? `That exact option is currently out of stock. Please contact our team and we can help you find an alternative.` : `Essa opção está atualmente esgotada. Contacte a nossa equipa e ajudaremos a encontrar uma alternativa.`
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

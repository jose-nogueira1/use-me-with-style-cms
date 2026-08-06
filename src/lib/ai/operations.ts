import type { Payload } from 'payload'
import type { CatalogueMarket, OutOfStockRecovery, ProductContext } from './catalogue'
import type { MessageExtraction } from './extraction'
import type { AiUsage } from './provider'
import type { ReplyFacts } from './replies'
import { estimateAiCostUsd } from './telemetry'

export type ConversationMessage = {
  id: string | number
  direction: 'inbound' | 'outbound'
  body: string
  createdAt?: string | null
  aiMarket?: 'angola' | 'portugal' | null
  market?: 'AO' | 'PT' | null
}

export type AiAuditFacts = {
  market: CatalogueMarket | null
  intent: MessageExtraction['intent']
  product?: Pick<ProductContext, 'sourceRecordId' | 'name' | 'market' | 'price' | 'currency' | 'onSale' | 'availableInMarket' | 'matchedVariants' | 'productUrl'> | null
  alternatives?: Array<Pick<ProductContext, 'sourceRecordId' | 'name' | 'availableInMarket' | 'productUrl'>>
  outOfStockRecovery?: {
    sameProductOptions: Array<{ size: string | null; colour: string | null; kind: string }>
    recommendations: Array<{ sourceRecordId: string; name: string; reasons: string[]; score: number }>
  } | null
  policy?: { kind: 'delivery' | 'payment' | 'return_policy'; text: string } | null
  coupon?: { code: string; valid: boolean; detail?: string | null } | null
}

export async function loadConversationHistory(payload: Payload, contactHandle: string, currentId: string | number): Promise<ConversationMessage[]> {
  const result = await payload.find({
    collection: 'messages',
    where: { and: [
      { channel: { equals: 'instagram' } },
      { contactHandle: { equals: contactHandle } },
    ] },
    sort: '-createdAt',
    limit: 16,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs as unknown as ConversationMessage[])
    .filter((message) => String(message.id) !== String(currentId))
    .reverse()
    .slice(-12)
}

function localized(settings: Record<string, unknown>, base: string, market: CatalogueMarket, language: 'pt' | 'en'): string | null {
  const prefix = market === 'AO' ? 'angola' : 'portugal'
  const suffix = language === 'en' ? 'EN' : 'PT'
  const value = settings[`${prefix}${base}${suffix}`]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function loadReplyFacts(payload: Payload, extraction: MessageExtraction, market: CatalogueMarket | null, language: 'pt' | 'en'): Promise<ReplyFacts & { policyAudit: AiAuditFacts['policy']; couponAudit: AiAuditFacts['coupon'] }> {
  if (extraction.intent === 'coupon' && market && extraction.couponCode) {
    const code = extraction.couponCode.toUpperCase()
    const result = await payload.find({ collection: 'coupons', where: { code: { equals: code } }, limit: 1, depth: 0, overrideAccess: true })
    const coupon = result.docs[0] as any
    const now = new Date()
    let reason: string | null = null
    if (!coupon) reason = language === 'en' ? 'code not found' : 'código não encontrado'
    else if (coupon.active === false) reason = language === 'en' ? 'code is inactive' : 'código inativo'
    else if (coupon.startDate && now < new Date(coupon.startDate)) reason = language === 'en' ? 'code is not active yet' : 'código ainda não está ativo'
    else if (coupon.endDate && now > new Date(coupon.endDate)) reason = language === 'en' ? 'code has expired' : 'código expirado'
    else if (market === 'AO' ? coupon.availableAO === false : coupon.availablePT === false) reason = language === 'en' ? 'code is unavailable in this market' : 'código indisponível neste mercado'
    else if (coupon.usageLimit != null && Number(coupon.usageCount || 0) >= Number(coupon.usageLimit)) reason = language === 'en' ? 'usage limit reached' : 'limite de utilizações atingido'
    if (reason) return { coupon: { valid: false, code, reason }, couponAudit: { code, valid: false, detail: reason }, policyAudit: null }

    const amount = coupon.type === 'percent'
      ? `${coupon.percentOff}% ${language === 'en' ? 'off eligible non-sale items' : 'de desconto em artigos elegíveis sem promoção'}`
      : coupon.type === 'free_shipping'
        ? (language === 'en' ? 'free delivery' : 'entrega gratuita')
        : `${market === 'AO' ? coupon.fixedOffAOKz : coupon.fixedOffPTEur} ${market === 'AO' ? 'Kz' : 'EUR'} ${language === 'en' ? 'off' : 'de desconto'}`
    const minimum = market === 'AO' ? coupon.minOrderValueAOKz : coupon.minOrderValuePTEur
    const detail = minimum != null ? `${amount}; ${language === 'en' ? 'minimum order' : 'encomenda mínima'} ${minimum} ${market === 'AO' ? 'Kz' : 'EUR'}` : amount
    return { coupon: { valid: true, code, discountText: detail }, couponAudit: { code, valid: true, detail }, policyAudit: null }
  }
  if (!market || !['delivery', 'payment', 'return_policy'].includes(extraction.intent)) return { policyAudit: null, couponAudit: null }
  const settings = await payload.findGlobal({ slug: 'market-settings', depth: 0, overrideAccess: true }) as unknown as Record<string, unknown>
  if (extraction.intent === 'delivery') {
    const value = localized(settings, 'ShippingText', market, language)
    return { delivery: value, policyAudit: value ? { kind: 'delivery', text: value } : null, couponAudit: null }
  }
  if (extraction.intent === 'return_policy') {
    const value = localized(settings, 'ReturnsPolicyText', market, language)
    return { returnPolicy: value, policyAudit: value ? { kind: 'return_policy', text: value } : null, couponAudit: null }
  }
  const methodsKey = market === 'AO' ? 'angolaPaymentMethods' : 'portugalPaymentMethods'
  const methods = Array.isArray(settings[methodsKey]) ? (settings[methodsKey] as unknown[]).map(String) : []
  const instructions = market === 'AO'
    ? localized(settings, 'BankTransferInstructions', market, language)
    : localized(settings, 'ManualCheckoutInstructions', market, language)
  const prefix = language === 'en' ? 'Available payment methods' : 'Métodos de pagamento disponíveis'
  const value = [methods.length ? `${prefix}: ${methods.join(', ')}.` : null, instructions].filter(Boolean).join(' ')
  return { payment: value || null, policyAudit: value ? { kind: 'payment', text: value } : null, couponAudit: null }
}

export function buildAuditFacts(
  extraction: MessageExtraction,
  market: CatalogueMarket | null,
  products: ProductContext[],
  policy: AiAuditFacts['policy'],
  coupon: AiAuditFacts['coupon'] = null,
  outOfStockRecovery: OutOfStockRecovery | null = null,
): AiAuditFacts {
  const product = products[0]
  return {
    market,
    intent: extraction.intent,
    product: product ? {
      sourceRecordId: product.sourceRecordId,
      name: product.name,
      market: product.market,
      price: product.price,
      currency: product.currency,
      onSale: product.onSale,
      availableInMarket: product.availableInMarket,
      matchedVariants: product.matchedVariants,
      productUrl: product.productUrl,
    } : null,
    alternatives: products.slice(1, 6).map((candidate) => ({
      sourceRecordId: candidate.sourceRecordId,
      name: candidate.name,
      availableInMarket: candidate.availableInMarket,
      productUrl: candidate.productUrl,
    })),
    outOfStockRecovery: outOfStockRecovery ? {
      sameProductOptions: outOfStockRecovery.sameProductOptions.map((option) => ({
        size: option.size, colour: option.colour, kind: option.kind,
      })),
      recommendations: outOfStockRecovery.recommendations.map((recommendation) => ({
        sourceRecordId: recommendation.product.sourceRecordId,
        name: recommendation.product.name,
        reasons: recommendation.reasons,
        score: recommendation.score,
      })),
    } : null,
    policy,
    coupon,
  }
}

export function mergeUsage(...values: Array<AiUsage | undefined>): AiUsage {
  return values.reduce<AiUsage>((total, usage) => ({
    inputTokens: Number(total.inputTokens || 0) + Number(usage?.inputTokens || 0),
    outputTokens: Number(total.outputTokens || 0) + Number(usage?.outputTokens || 0),
    totalTokens: Number(total.totalTokens || 0) + Number(usage?.totalTokens || 0),
  }), {})
}

export function estimateRequestCost(model: string, usage?: AiUsage): number | null {
  const prices = model.includes('nano')
    ? { inputPerMillion: 0.20, outputPerMillion: 1.25 }
    : { inputPerMillion: 0.75, outputPerMillion: 4.50 }
  return estimateAiCostUsd(usage, prices)
}

export async function currentMonthSpend(payload: Payload, now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const result = await payload.find({
    collection: 'messages',
    where: { and: [
      { createdAt: { greater_than_equal: start } },
      { aiEstimatedCostUsd: { greater_than: 0 } },
    ] },
    limit: 1_000,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs as Array<{ aiEstimatedCostUsd?: number | null }>).reduce((sum, message) => sum + Number(message.aiEstimatedCostUsd || 0), 0)
}

export function handoffReply(language: 'pt' | 'en', intent: MessageExtraction['intent']): string {
  if (intent === 'complaint') return language === 'en' ? 'Thank you for telling us. Our team will review this personally and reply here shortly.' : 'Obrigada por nos informar. A nossa equipa vai analisar pessoalmente e responder aqui em breve.'
  if (intent === 'order_status') return language === 'en' ? 'Our team will check this securely. Please send your order number and the email used for the order.' : 'A nossa equipa vai verificar com segurança. Envie, por favor, o número da encomenda e o email utilizado.'
  return language === 'en' ? 'Thank you. Our team needs to verify this and will reply here shortly.' : 'Obrigada. A nossa equipa precisa de verificar esta informação e responderá aqui em breve.'
}

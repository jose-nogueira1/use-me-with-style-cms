import type { MessageExtraction } from './extraction'

export type SafetyDecision = {
  allowed: boolean
  requiresHuman: boolean
  priority: boolean
  reason: string
  askForMarket: boolean
  askForProduct: boolean
}

const MARKET_REQUIRED_INTENTS = new Set<MessageExtraction['intent']>([
  'product_availability', 'product_price', 'product_sizing', 'delivery', 'payment', 'coupon', 'return_policy',
])

const ALWAYS_HUMAN_INTENTS = new Set<MessageExtraction['intent']>(['complaint', 'order_status'])

export function evaluateExtractionSafety(extraction: MessageExtraction): SafetyDecision {
  if (ALWAYS_HUMAN_INTENTS.has(extraction.intent)) {
    return { allowed: false, requiresHuman: true, priority: true, reason: extraction.intent === 'complaint' ? 'complaint_requires_human' : 'order_status_requires_identity_check', askForMarket: false, askForProduct: false }
  }
  if (extraction.requiresHuman) {
    return { allowed: false, requiresHuman: true, priority: true, reason: 'model_requested_human_review', askForMarket: false, askForProduct: false }
  }
  if (extraction.confidence < 0.75) {
    return { allowed: false, requiresHuman: true, priority: true, reason: 'low_confidence', askForMarket: false, askForProduct: false }
  }
  if (MARKET_REQUIRED_INTENTS.has(extraction.intent) && !extraction.market) {
    return { allowed: false, requiresHuman: false, priority: false, reason: 'market_required', askForMarket: true, askForProduct: false }
  }
  if (['product_availability', 'product_price', 'product_sizing'].includes(extraction.intent) && extraction.candidateProductNames.length === 0) {
    return { allowed: false, requiresHuman: false, priority: false, reason: 'product_required', askForMarket: false, askForProduct: true }
  }
  if (extraction.candidateProductNames.length > 1) {
    return { allowed: false, requiresHuman: true, priority: false, reason: 'multiple_products_identified', askForMarket: false, askForProduct: false }
  }
  return { allowed: true, requiresHuman: false, priority: false, reason: 'eligible_for_retrieval', askForMarket: false, askForProduct: false }
}

export function isSensitiveMessage(extraction: Pick<MessageExtraction, 'intent' | 'requiresHuman'>): boolean {
  return extraction.intent === 'complaint' || extraction.requiresHuman
}

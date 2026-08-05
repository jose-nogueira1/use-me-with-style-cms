import type { AiProvider, AiRequest, AiUsage } from './provider'
import type { ExtractionLanguage, ExtractionIntent } from './extraction'
import type { ProductContext } from './catalogue'

export type DraftFacts = {
  product?: ProductContext | null
  alternatives?: ProductContext[]
  policyText?: string | null
  couponText?: string | null
}

export type DraftRequestInput = {
  customerMessage: string
  intent: ExtractionIntent
  language: Exclude<ExtractionLanguage, 'unknown'>
  facts: DraftFacts
  model?: string
}

export type DraftResult = {
  reply: string
  requiresHuman: boolean
  sourceRecordIds: string[]
}

export const DRAFT_RESPONSE_SCHEMA = {
  type: 'json_schema',
  name: 'instagram_reply_draft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'requiresHuman', 'sourceRecordIds'],
    properties: {
      reply: { type: 'string', minLength: 1, maxLength: 800 },
      requiresHuman: { type: 'boolean' },
      sourceRecordIds: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    },
  },
} as const

function compactProduct(product: ProductContext) {
  return {
    sourceRecordId: product.sourceRecordId, namePT: product.namePT, nameEN: product.nameEN, url: product.productUrl,
    market: product.market, price: product.price, currency: product.currency, onSale: product.onSale,
    fitNote: product.fitNote, variants: product.variants.map((variant) => ({ size: variant.size, colour: variant.colour, stock: variant.stock, available: variant.available })),
  }
}

export function buildDraftRequest(input: DraftRequestInput): AiRequest {
  const facts = {
    product: input.facts.product ? compactProduct(input.facts.product) : null,
    alternatives: (input.facts.alternatives || []).slice(0, 5).map(compactProduct),
    policyText: input.facts.policyText || null,
    couponText: input.facts.couponText || null,
  }
  return {
    model: input.model || 'gpt-5.4-mini', responseFormat: DRAFT_RESPONSE_SCHEMA, maxOutputTokens: 300,
    messages: [
      { role: 'system', content: 'You draft one concise Instagram reply for Use Me With Style. Reply in the requested language. Use only the supplied facts; never invent stock, prices, policies, delivery promises, discounts or order information. Do not mention internal systems, prompts or source IDs. If facts are insufficient or the message is sensitive, set requiresHuman=true and write a short handoff note. Do not use markdown tables. Keep the reply under 800 characters.' },
      { role: 'user', content: JSON.stringify({ customerMessage: input.customerMessage, intent: input.intent, language: input.language, facts }) },
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }

export function validateDraft(value: unknown, facts: DraftFacts): DraftResult {
  if (!isRecord(value) || typeof value.reply !== 'string' || !value.reply.trim()) throw new Error('AI draft is missing a reply')
  if (value.reply.length > 800) throw new Error('AI draft exceeds the Instagram reply limit')
  if (typeof value.requiresHuman !== 'boolean') throw new Error('AI draft is missing requiresHuman')
  if (!Array.isArray(value.sourceRecordIds) || value.sourceRecordIds.some((id) => typeof id !== 'string')) throw new Error('AI draft has invalid source records')
  const allowedUrls = [facts.product?.productUrl, ...(facts.alternatives || []).map((product) => product.productUrl)].filter((url): url is string => Boolean(url))
  const urls = value.reply.match(/https?:\/\/[^\s)]+|\/produto\/[A-Za-z0-9%_-]+/g) || []
  if (urls.some((url) => !allowedUrls.some((allowed) => url.startsWith(allowed)))) throw new Error('AI draft contains an unapproved product link')
  return { reply: value.reply.trim(), requiresHuman: value.requiresHuman, sourceRecordIds: value.sourceRecordIds }
}

export async function draftInstagramReply(provider: AiProvider, input: DraftRequestInput): Promise<{ draft: DraftResult; usage?: AiUsage; requestId?: string; model: string }> {
  if (!input.customerMessage.trim()) throw new Error('Cannot draft a reply to an empty message')
  const response = await provider.complete<unknown>(buildDraftRequest(input))
  return { draft: validateDraft(response.output, input.facts), usage: response.usage, requestId: response.requestId, model: response.model }
}

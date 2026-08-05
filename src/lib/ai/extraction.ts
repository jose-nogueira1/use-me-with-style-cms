import type { AiProvider, AiRequest } from './provider'

export const EXTRACTION_INTENTS = [
  'product_availability',
  'product_price',
  'product_sizing',
  'coupon',
  'delivery',
  'payment',
  'return_policy',
  'order_status',
  'complaint',
  'other',
] as const

export type ExtractionIntent = typeof EXTRACTION_INTENTS[number]
export type ExtractionLanguage = 'pt' | 'en' | 'unknown'
export type ExtractionMarket = 'angola' | 'portugal' | null

export type MessageExtraction = {
  intent: ExtractionIntent
  language: ExtractionLanguage
  candidateProductNames: string[]
  size: string | null
  colour: string | null
  couponCode: string | null
  market: ExtractionMarket
  confidence: number
  requiresHuman: boolean
}

export const EXTRACTION_RESPONSE_SCHEMA = {
  type: 'json_schema',
  name: 'instagram_message_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['intent', 'language', 'candidateProductNames', 'size', 'colour', 'couponCode', 'market', 'confidence', 'requiresHuman'],
    properties: {
      intent: { type: 'string', enum: [...EXTRACTION_INTENTS] },
      language: { type: 'string', enum: ['pt', 'en', 'unknown'] },
      candidateProductNames: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      size: { type: ['string', 'null'] },
      colour: { type: ['string', 'null'] },
      couponCode: { type: ['string', 'null'] },
      market: { type: ['string', 'null'], enum: ['angola', 'portugal', null] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      requiresHuman: { type: 'boolean' },
    },
  },
} as const

export type ConversationTurn = { direction: 'inbound' | 'outbound'; body: string }

export function buildExtractionRequest(body: string, model = 'gpt-5.4-nano', history: ConversationTurn[] = []): AiRequest {
  return {
    model,
    responseFormat: EXTRACTION_RESPONSE_SCHEMA,
    maxOutputTokens: 300,
    messages: [
      {
        role: 'system',
        content: [
          'You classify one Instagram customer message for a fashion sales/support inbox.',
          'Return only the requested JSON schema. Do not answer the customer.',
          'Understand Portuguese, English and mixed-language messages.',
          'Extract clues only; never invent a product, stock, price, policy or order status.',
          'The user payload contains the current message and recent conversation. Resolve short follow-ups such as a market, size, colour or coupon code using the unresolved earlier customer question.',
          'Use requiresHuman=true for complaints, refunds, cancellations, payment disputes, order-specific requests, ambiguity or low confidence.',
          'Use market=null unless the customer explicitly says Angola or Portugal.',
          'Use null for unknown size or colour and an empty array when no product is mentioned.',
        ].join(' '),
      },
      { role: 'user', content: JSON.stringify({
        currentMessage: body.trim(),
        recentConversation: history.slice(-12).map((turn) => ({ direction: turn.direction, body: turn.body.slice(0, 1_000) })),
      }) },
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseMessageExtraction(value: unknown): MessageExtraction {
  if (!isRecord(value)) throw new Error('AI extraction must be an object')
  const intent = value.intent
  const language = value.language
  const names = value.candidateProductNames
  const confidence = value.confidence
  const requiresHuman = value.requiresHuman
  if (!EXTRACTION_INTENTS.includes(intent as ExtractionIntent)) throw new Error('AI extraction returned an invalid intent')
  if (language !== 'pt' && language !== 'en' && language !== 'unknown') throw new Error('AI extraction returned an invalid language')
  if (!Array.isArray(names) || names.length > 5 || names.some((name) => typeof name !== 'string' || !name.trim())) throw new Error('AI extraction returned invalid product candidates')
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('AI extraction returned invalid confidence')
  if (typeof requiresHuman !== 'boolean') throw new Error('AI extraction returned invalid human-handoff flag')
  const market = value.market === null || value.market === undefined ? null : value.market
  if (market !== null && market !== 'angola' && market !== 'portugal') throw new Error('AI extraction returned an invalid market')
  const result: MessageExtraction = {
    intent: intent as ExtractionIntent,
    language,
    candidateProductNames: names.map((name) => name.trim()),
    size: nullableString(value.size),
    colour: nullableString(value.colour),
    couponCode: nullableString(value.couponCode)?.toUpperCase() || null,
    market,
    confidence,
    requiresHuman,
  }
  if (result.confidence < 0.75) result.requiresHuman = true
  if (['complaint', 'order_status'].includes(result.intent)) result.requiresHuman = true
  return result
}

export async function extractInstagramMessage(provider: AiProvider, body: string, model = 'gpt-5.4-nano', history: ConversationTurn[] = []): Promise<{ extraction: MessageExtraction; usage?: Awaited<ReturnType<AiProvider['complete']>>['usage']; requestId?: string; model: string }> {
  if (!body.trim()) throw new Error('Cannot extract an empty Instagram message')
  const response = await provider.complete<unknown>(buildExtractionRequest(body, model, history))
  return { extraction: parseMessageExtraction(response.output), usage: response.usage, requestId: response.requestId, model: response.model }
}

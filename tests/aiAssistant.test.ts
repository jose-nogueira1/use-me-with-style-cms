import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { buildExtractionRequest, parseMessageExtraction } from '../src/lib/ai/extraction'
import { getConversationMarket, resolveMarket } from '../src/lib/ai/marketState'
import { buildDeterministicReply } from '../src/lib/ai/replies'
import { evaluateExtractionSafety } from '../src/lib/ai/safety'
import { estimateRequestCost, mergeUsage } from '../src/lib/ai/operations'
import { recordAiTelemetry } from '../src/lib/ai/telemetry'
import { evaluateHybridAutoSend } from '../src/lib/ai/automation'
import { DEFAULT_AI_MESSAGING_SETTINGS, normalizeAiMessagingSettings } from '../src/lib/ai/settings'
import { getAiAssistantConfig } from '../src/lib/ai/config'
import {
  rankOutOfStockRecommendations,
  retrieveOutOfStockRecovery,
  sameProductRecoveryOptions,
  type OutOfStockRecovery,
  type ProductContext,
} from '../src/lib/ai/catalogue'

const safeExtraction = {
  intent: 'product_price' as const,
  language: 'pt' as const,
  candidateProductNames: ['Vestido Aurora'],
  size: null,
  colour: null,
  couponCode: null,
  market: 'angola' as const,
  confidence: 0.97,
  requiresHuman: false,
}

function product(overrides: Partial<ProductContext> = {}): ProductContext {
  return {
    sourceRecordId: '42', productId: 42, name: 'Vestido Aurora', namePT: 'Vestido Aurora', nameEN: 'Aurora Dress',
    slug: 'vestido-aurora', market: 'AO', availableInMarket: true, price: 25_000, currency: 'AOA', onSale: false,
    fitNote: null, sizeGuide: null, productUrl: 'https://ao.usemewithstyle.shop/produto/vestido-aurora',
    variants: [], matchedVariants: [], categoryId: 'dresses', categorySlug: 'vestidos', tagIds: ['summer'], tagSlugs: ['verao'],
    ...overrides,
  }
}

test('extraction receives recent conversation so a market-only follow-up retains the product question', () => {
  const request = buildExtractionRequest('Angola', 'gpt-5.4-nano', [
    { direction: 'inbound', body: 'Tem o vestido Aurora em M?' },
    { direction: 'outbound', body: 'Está a comprar para Angola ou Portugal?' },
  ])
  const payload = JSON.parse(request.messages[1].content)
  assert.equal(payload.currentMessage, 'Angola')
  assert.deepEqual(payload.recentConversation.map((turn: any) => turn.body), [
    'Tem o vestido Aurora em M?',
    'Está a comprar para Angola ou Portugal?',
  ])
})

test('strict extraction normalizes coupon and reuses a fresh conversation market', () => {
  const extraction = parseMessageExtraction({
    intent: 'coupon', language: 'pt', candidateProductNames: [], size: null, colour: null,
    couponCode: ' verão10 ', market: null, confidence: 0.96, requiresHuman: false,
  })
  const conversation = getConversationMarket([{ createdAt: new Date().toISOString(), aiMarket: 'portugal' }])
  assert.equal(extraction.couponCode, 'VERÃO10')
  assert.equal(resolveMarket(extraction, conversation), 'PT')
})

test('deterministic stock reply uses only the verified market variant and current price', () => {
  const reply = buildDeterministicReply({
    intent: 'product_availability', language: 'pt', market: 'AO',
    product: product({
      variants: [{ id: 1, size: 'M', colour: 'Preto', stock: 2, available: true }],
      matchedVariants: [{ id: 1, size: 'M', colour: 'Preto', stock: 2, available: true }],
    }),
  })
  assert.match(reply || '', /Vestido Aurora/)
  assert.match(reply || '', /25[ .]000 Kz/)
  assert.match(reply || '', /tamanho M/)
})

test('availability without a requested size uses every verified variant, not only the first row', () => {
  const reply = buildDeterministicReply({
    intent: 'product_availability', language: 'pt', market: 'AO',
    product: product({
      variants: [
        { id: 1, size: 'S', colour: 'Preto', stock: 0, available: false },
        { id: 2, size: 'M', colour: 'Preto', stock: 2, available: true },
      ],
      matchedVariants: [
        { id: 1, size: 'S', colour: 'Preto', stock: 0, available: false },
        { id: 2, size: 'M', colour: 'Preto', stock: 2, available: true },
      ],
    }),
  })
  assert.match(reply || '', /está disponível/)
  assert.match(reply || '', /Tamanhos disponíveis: M/)
})

test('out-of-stock recovery prioritizes same-size colours before other sizes', () => {
  const requested = product({
    variants: [
      { id: 1, size: 'M', colour: 'Preto', stock: 0, available: false },
      { id: 2, size: 'M', colour: 'Azul', stock: 2, available: true },
      { id: 3, size: 'S', colour: 'Preto', stock: 3, available: true },
      { id: 4, size: 'L', colour: 'Branco', stock: 1, available: true },
    ],
    matchedVariants: [{ id: 1, size: 'M', colour: 'Preto', stock: 0, available: false }],
  })
  const options = sameProductRecoveryOptions(requested, { size: 'M', colour: 'Preto' }, DEFAULT_AI_MESSAGING_SETTINGS)
  assert.deepEqual(options.map((option) => [option.kind, option.size, option.colour]), [
    ['same_size_other_colour', 'M', 'Azul'],
    ['same_colour_other_size', 'S', 'Preto'],
    ['other_variant', 'L', 'Branco'],
  ])
})

test('out-of-stock product recommendations rank category, tags, price and live stock', () => {
  const requested = product()
  const sameCategoryAndTag = product({
    sourceRecordId: '43', productId: 43, name: 'Vestido Sol', price: 27_000,
    variants: [{ id: 1, size: 'M', colour: 'Azul', stock: 2, available: true }],
  })
  const sharedTag = product({
    sourceRecordId: '44', productId: 44, name: 'Top Verão', categoryId: 'tops', categorySlug: 'tops', price: 24_000,
    variants: [{ id: 1, size: 'M', colour: 'Branco', stock: 5, available: true }],
  })
  const tooExpensive = product({
    sourceRecordId: '45', productId: 45, name: 'Vestido Luxo', price: 50_000,
    variants: [{ id: 1, size: 'M', colour: 'Preto', stock: 9, available: true }],
  })
  const unavailable = product({
    sourceRecordId: '46', productId: 46, name: 'Vestido Noite',
    variants: [{ id: 1, size: 'M', colour: 'Preto', stock: 0, available: false }],
  })
  const ranked = rankOutOfStockRecommendations(requested, [sharedTag, unavailable, tooExpensive, sameCategoryAndTag], DEFAULT_AI_MESSAGING_SETTINGS)
  assert.deepEqual(ranked.map((item) => item.product.sourceRecordId), ['43', '44'])
  assert.deepEqual(ranked[0]?.reasons, ['same_category', 'shared_merchandising_tag'])
})

test('out-of-stock retrieval queries the active market by category and merchandising tags', async () => {
  let query: Record<string, any> | null = null
  const requested = product({
    variants: [{ id: 1, size: 'M', colour: 'Preto', stock: 0, available: false }],
    matchedVariants: [{ id: 1, size: 'M', colour: 'Preto', stock: 0, available: false }],
  })
  const recovery = await retrieveOutOfStockRecovery({
    find: async (args) => {
      query = args as Record<string, any>
      return { docs: [{
        id: 43, name: 'Vestido Sol', namePT: 'Vestido Sol', slug: 'vestido-sol', active: true,
        availableAO: true, availablePT: true, priceAOKz: 27_000, pricePTEur: 45,
        category: { id: 'dresses', slug: 'vestidos' }, tag: [{ id: 'summer', slug: 'verao' }],
        variants: [{ id: 1, size: 'M', color: { id: 2, namePT: 'Azul' }, stockAO: 2, stockPT: 1 }],
      }] }
    },
  }, requested, { ...safeExtraction, intent: 'product_availability', size: 'M', colour: 'Preto' }, DEFAULT_AI_MESSAGING_SETTINGS)
  assert.deepEqual((query as any)?.where.and.slice(0, 2), [
    { active: { equals: true } }, { availableAO: { equals: true } },
  ])
  assert.deepEqual((query as any)?.where.and[2].or, [
    { category: { equals: 'dresses' } }, { tag: { in: ['summer'] } },
  ])
  assert.equal(recovery?.recommendations[0]?.product.productUrl, 'https://ao.usemewithstyle.shop/produto/vestido-sol')
})

test('deterministic out-of-stock reply includes verified variants and ranked products', () => {
  const requested = product({
    variants: [
      { id: 1, size: 'M', colour: 'Preto', stock: 0, available: false },
      { id: 2, size: 'M', colour: 'Azul', stock: 2, available: true },
    ],
    matchedVariants: [{ id: 1, size: 'M', colour: 'Preto', stock: 0, available: false }],
  })
  const alternative = product({
    sourceRecordId: '43', productId: 43, name: 'Vestido Sol', namePT: 'Vestido Sol', price: 27_000,
    productUrl: 'https://ao.usemewithstyle.shop/produto/vestido-sol',
    variants: [{ id: 1, size: 'M', colour: 'Preto', stock: 2, available: true }],
  })
  const recovery: OutOfStockRecovery = {
    sameProductOptions: [{ id: 2, size: 'M', colour: 'Azul', stock: 2, available: true, kind: 'same_size_other_colour' }],
    recommendations: [{ product: alternative, score: 100, reasons: ['same_category'], sharedTagCount: 0, priceDifferencePercent: 8 }],
  }
  const reply = buildDeterministicReply({
    intent: 'product_availability', language: 'pt', market: 'AO', product: requested, outOfStockRecovery: recovery,
  })
  assert.match(reply || '', /esgotada/i)
  assert.match(reply || '', /tamanho M.*Azul/i)
  assert.match(reply || '', /Vestido Sol.*27[ .]000 Kz/i)
  assert.match(reply || '', /produto\/vestido-sol/)
})

test('product questions ask for market first, then identify the product without escalating', () => {
  const missingBoth = evaluateExtractionSafety({ ...safeExtraction, market: null, candidateProductNames: [] })
  assert.equal(missingBoth.askForMarket, true)
  assert.equal(missingBoth.askForProduct, false)
  assert.equal(missingBoth.requiresHuman, false)

  const missingProduct = evaluateExtractionSafety({ ...safeExtraction, candidateProductNames: [] })
  assert.equal(missingProduct.askForMarket, false)
  assert.equal(missingProduct.askForProduct, true)
  assert.equal(missingProduct.requiresHuman, false)
})

test('usage and cost telemetry combine extraction and drafting without storing prompts', () => {
  const usage = mergeUsage(
    { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    { inputTokens: 200, outputTokens: 40, totalTokens: 240 },
  )
  assert.deepEqual(usage, { inputTokens: 300, outputTokens: 60, totalTokens: 360 })
  assert.equal(estimateRequestCost('gpt-5.4-nano', { inputTokens: 1_000_000, outputTokens: 1_000_000 }), 1.45)
})

test('worker is fail-closed, retries transient failures and human replies cancel pending jobs', () => {
  const worker = readFileSync(new URL('../src/endpoints/aiAssistant.ts', import.meta.url), 'utf8')
  const hook = readFileSync(new URL('../src/hooks/sendOutboundMessage.ts', import.meta.url), 'utf8')
  assert.match(worker, /cron_not_configured/)
  assert.match(worker, /attempts < MAX_ATTEMPTS/)
  assert.match(worker, /monthly_budget_reached/)
  assert.match(worker, /evaluateHybridAutoSend/)
  assert.match(hook, /cancelPendingAiJobs/)
})

test('telemetry preserves the logger receiver required by Pino', () => {
  const calls: string[] = []
  const logger = {
    prefix: 'bound',
    info(this: { prefix: string }, _details: unknown, message?: string) { calls.push(`${this.prefix}:${message}`) },
  }
  recordAiTelemetry(logger, { event: 'request_succeeded', provider: 'openai' })
  assert.deepEqual(calls, ['bound:[ai:request_succeeded]'])
})

test('approval remains the default and an authenticated setting can later activate guarded hybrid mode', () => {
  const approval = getAiAssistantConfig({ OPENAI_API_KEY: 'configured', AI_ASSISTANT_MODE: 'approval' })
  assert.equal(approval.mode, 'approval')
  const hybrid = getAiAssistantConfig(
    { OPENAI_API_KEY: 'configured', AI_ASSISTANT_MODE: 'approval' },
    { ...DEFAULT_AI_MESSAGING_SETTINGS, operatingMode: 'hybrid' },
  )
  assert.equal(hybrid.mode, 'hybrid')
  const stopped = getAiAssistantConfig(
    { OPENAI_API_KEY: 'configured', AI_ASSISTANT_MODE: 'off' },
    { ...DEFAULT_AI_MESSAGING_SETTINGS, operatingMode: 'hybrid' },
  )
  assert.equal(stopped.mode, 'off')
})

test('hybrid sends only deterministic, allowed, high-confidence verified replies', () => {
  const base = {
    mode: 'hybrid' as const,
    settings: { ...DEFAULT_AI_MESSAGING_SETTINGS, operatingMode: 'hybrid' as const },
    kind: 'deterministic_reply' as const,
    extraction: safeExtraction,
    deterministicReply: true,
    safetyAllowed: true,
    requiresHuman: false,
    conversationPaused: false,
    conversationAutoReplies24h: 0,
    globalAutoReplies1h: 0,
    newerConversationActivity: false,
  }
  assert.deepEqual(evaluateHybridAutoSend(base), { autoSend: true, reason: 'safe_verified_reply' })
  assert.equal(evaluateHybridAutoSend({ ...base, mode: 'approval' }).autoSend, false)
  assert.equal(evaluateHybridAutoSend({ ...base, deterministicReply: false }).reason, 'model_draft_requires_approval')
  assert.equal(evaluateHybridAutoSend({ ...base, requiresHuman: true }).reason, 'human_review_required')
  assert.equal(evaluateHybridAutoSend({ ...base, extraction: { ...safeExtraction, confidence: 0.8 } }).reason, 'below_auto_send_confidence')
  assert.equal(evaluateHybridAutoSend({ ...base, newerConversationActivity: true }).reason, 'newer_conversation_activity')
  assert.equal(evaluateHybridAutoSend({ ...base, conversationAutoReplies24h: 6 }).reason, 'conversation_rate_limit')
  assert.equal(evaluateHybridAutoSend({ ...base, globalAutoReplies1h: 40 }).reason, 'global_rate_limit')
})

test('market clarification has its own allow switch and settings are bounded', () => {
  const settings = normalizeAiMessagingSettings({
    operatingMode: 'hybrid', confidenceThreshold: 0.1, replyDelaySeconds: 999,
    maxAutoRepliesPerConversation: 0, maxAutoRepliesPerHour: 999, monthlyBudgetUsd: -3,
    autoReplyIntents: ['greeting', 'complaint', 'greeting'],
    outOfStockMaxAlternatives: 99, outOfStockPriceTolerancePercent: -1,
    outOfStockCategoryWeight: 120, outOfStockTagWeight: -10,
  })
  assert.equal(settings.confidenceThreshold, 0.75)
  assert.equal(settings.replyDelaySeconds, 120)
  assert.equal(settings.maxAutoRepliesPerConversation, 1)
  assert.equal(settings.maxAutoRepliesPerHour, 200)
  assert.equal(settings.monthlyBudgetUsd, 0)
  assert.deepEqual(settings.autoReplyIntents, ['greeting'])
  assert.equal(settings.outOfStockMaxAlternatives, 5)
  assert.equal(settings.outOfStockPriceTolerancePercent, 0)
  assert.equal(settings.outOfStockCategoryWeight, 100)
  assert.equal(settings.outOfStockTagWeight, 0)

  const decision = evaluateHybridAutoSend({
    mode: 'hybrid', settings: { ...settings, autoReplyMarketClarification: false },
    kind: 'market_clarification', extraction: { ...safeExtraction, market: null },
    deterministicReply: true, safetyAllowed: true, requiresHuman: false,
    conversationPaused: false, conversationAutoReplies24h: 0, globalAutoReplies1h: 0,
    newerConversationActivity: false,
  })
  assert.deepEqual(decision, { autoSend: false, reason: 'market_clarification_not_allowed' })

  const productDecision = evaluateHybridAutoSend({
    mode: 'hybrid', settings: { ...settings, autoReplyProductClarification: false },
    kind: 'product_clarification', extraction: { ...safeExtraction, candidateProductNames: [] },
    deterministicReply: true, safetyAllowed: true, requiresHuman: false,
    conversationPaused: false, conversationAutoReplies24h: 0, globalAutoReplies1h: 0,
    newerConversationActivity: false,
  })
  assert.deepEqual(productDecision, { autoSend: false, reason: 'product_clarification_not_allowed' })
})

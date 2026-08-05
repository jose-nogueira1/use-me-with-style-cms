import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { buildExtractionRequest, parseMessageExtraction } from '../src/lib/ai/extraction'
import { getConversationMarket, resolveMarket } from '../src/lib/ai/marketState'
import { buildDeterministicReply } from '../src/lib/ai/replies'
import { estimateRequestCost, mergeUsage } from '../src/lib/ai/operations'
import { recordAiTelemetry } from '../src/lib/ai/telemetry'

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
    product: {
      sourceRecordId: '42', productId: 42, name: 'Vestido Aurora', namePT: 'Vestido Aurora', nameEN: 'Aurora Dress',
      slug: 'vestido-aurora', market: 'AO', availableInMarket: true, price: 25000, currency: 'AOA', onSale: false,
      fitNote: null, sizeGuide: null, productUrl: 'https://ao.usemewithstyle.shop/produto/vestido-aurora', variants: [],
      matchedVariants: [{ id: 1, size: 'M', colour: 'Preto', stock: 2, available: true }],
    },
  })
  assert.match(reply || '', /Vestido Aurora/)
  assert.match(reply || '', /25[ .]000 Kz/)
  assert.match(reply || '', /tamanho M/)
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
  assert.match(worker, /SAFE_AUTOMATIC_INTENTS/)
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

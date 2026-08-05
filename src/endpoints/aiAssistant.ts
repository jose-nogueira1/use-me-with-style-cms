import type { Endpoint } from 'payload'
import { getAiAssistantConfig, canAutoSendAiReply } from '../lib/ai/config'
import { createAiProvider, AiProviderError, type AiUsage } from '../lib/ai/provider'
import { extractInstagramMessage, type MessageExtraction } from '../lib/ai/extraction'
import { retrieveProductContexts, type CatalogueMarket } from '../lib/ai/catalogue'
import { draftInstagramReply } from '../lib/ai/drafting'
import { evaluateExtractionSafety } from '../lib/ai/safety'
import { buildDeterministicReply } from '../lib/ai/replies'
import { claimAiMessageJob } from '../lib/ai/jobs'
import { getConversationMarket, marketQuestion, resolveMarket } from '../lib/ai/marketState'
import {
  buildAuditFacts,
  currentMonthSpend,
  estimateRequestCost,
  handoffReply,
  loadConversationHistory,
  loadReplyFacts,
  mergeUsage,
} from '../lib/ai/operations'
import { recordAiTelemetry } from '../lib/ai/telemetry'
import { sendInstagramMessage } from '../lib/messaging'

const MAX_ATTEMPTS = 3
const SAFE_AUTOMATIC_INTENTS = new Set<MessageExtraction['intent']>([
  'product_availability', 'product_price', 'product_sizing', 'delivery', 'payment', 'return_policy',
])

function language(extraction: MessageExtraction): 'pt' | 'en' {
  return extraction.language === 'en' ? 'en' : 'pt'
}

function marketValue(market: CatalogueMarket | null): MessageExtraction['market'] {
  return market === 'AO' ? 'angola' : market === 'PT' ? 'portugal' : null
}

function retryAt(attempts: number, now = new Date()): string {
  return new Date(now.getTime() + Math.min(15 * 60_000, 30_000 * (2 ** Math.max(0, attempts - 1)))).toISOString()
}

function usageFields(usage: AiUsage, cost: number) {
  return {
    aiInputTokens: Number(usage.inputTokens || 0),
    aiOutputTokens: Number(usage.outputTokens || 0),
    aiTotalTokens: Number(usage.totalTokens || 0),
    aiEstimatedCostUsd: cost,
  }
}

/** Background worker invoked by the Railway cron service. It is fail-closed,
 * retry-safe and intentionally defaults to approval rather than auto-send. */
export const aiAssistantEndpoint: Endpoint = {
  path: '/ai/process',
  method: 'post',
  handler: async (req) => {
    const secret = process.env.CRON_SECRET?.trim()
    if (!secret) return Response.json({ processed: 0, error: 'cron_not_configured' }, { status: 503 })
    if (req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })

    const config = getAiAssistantConfig()
    if (config.mode === 'off' || !config.apiKeyConfigured) return Response.json({ processed: 0, skipped: 'disabled' })
    if (config.monthlyBudgetUsd !== null && await currentMonthSpend(req.payload) >= config.monthlyBudgetUsd) {
      recordAiTelemetry(req.payload.logger, { event: 'request_skipped', provider: 'openai', reason: 'monthly_budget_reached' })
      return Response.json({ processed: 0, skipped: 'monthly_budget_reached' })
    }

    const found = await req.payload.find({
      collection: 'messages',
      where: { and: [
        { channel: { equals: 'instagram' } },
        { direction: { equals: 'inbound' } },
        { aiProcessingStatus: { equals: 'queued' } },
        { aiAvailableAt: { less_than_equal: new Date().toISOString() } },
      ] },
      sort: 'aiAvailableAt',
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    const provider = createAiProvider(config)
    let processed = 0
    let failed = 0
    let retried = 0

    for (const message of found.docs as any[]) {
      const claimed = await claimAiMessageJob(req.payload as any, message)
      if (!claimed) continue
      const startedAt = Date.now()
      try {
        const history = await loadConversationHistory(req.payload, String(claimed.contactHandle), claimed.id)
        const extractionResult = await extractInstagramMessage(
          provider,
          String((claimed as any).body || ''),
          config.extractionModel,
          history.map((turn) => ({ direction: turn.direction, body: turn.body })),
        )
        const extraction = extractionResult.extraction
        const market = resolveMarket(extraction, getConversationMarket(history))
        extraction.market = marketValue(market)
        const replyLanguage = language(extraction)
        const safety = evaluateExtractionSafety(extraction)

        if (safety.askForMarket) {
          const cost = estimateRequestCost(extractionResult.model, extractionResult.usage) || 0
          await req.payload.update({
            collection: 'messages', id: message.id, overrideAccess: true,
            data: {
              aiProcessingStatus: 'draft_ready', aiDraftStatus: 'draft_ready',
              aiDraft: marketQuestion(extraction.language), aiDraftConfidence: extraction.confidence,
              aiDraftReason: safety.reason, aiIntent: extraction.intent, aiLanguage: extraction.language,
              aiModel: extractionResult.model, aiRequestId: extractionResult.requestId,
              aiRequiresHuman: false, aiOutcome: 'market_clarification', aiCompletedAt: new Date().toISOString(),
              conversationStatus: 'needs_reply',
              ...usageFields(mergeUsage(extractionResult.usage), cost),
            },
          })
          recordAiTelemetry(req.payload.logger, { event: 'request_succeeded', provider: 'openai', model: extractionResult.model, requestId: extractionResult.requestId, durationMs: Date.now() - startedAt, usage: extractionResult.usage })
          processed++
          continue
        }

        const products = await retrieveProductContexts(req.payload as any, extraction, { market: market || undefined })
        const replyFacts = await loadReplyFacts(req.payload, extraction, market, replyLanguage)
        const auditFacts = buildAuditFacts(extraction, market, products, replyFacts.policyAudit, replyFacts.couponAudit)
        const deterministic = safety.allowed ? buildDeterministicReply({
          intent: extraction.intent,
          language: replyLanguage,
          market,
          product: products[0] || null,
          alternatives: products.slice(1),
          facts: replyFacts,
        }) : null

        let reply = deterministic
        let requiresHuman = safety.requiresHuman
        let sourceRecordIds = products.map((product) => product.sourceRecordId)
        let draftingUsage: AiUsage | undefined
        let draftingModel: string | undefined
        let draftingRequestId: string | undefined

        const factualIntent = ['product_availability', 'product_price', 'product_sizing', 'coupon', 'delivery', 'payment', 'return_policy'].includes(extraction.intent)
        if (!reply && (requiresHuman || factualIntent)) {
          reply = handoffReply(replyLanguage, extraction.intent)
          requiresHuman = true
        } else if (!reply) {
          const drafted = await draftInstagramReply(provider, {
            customerMessage: String((claimed as any).body || ''),
            intent: extraction.intent,
            language: replyLanguage,
            facts: { product: products[0] || null, alternatives: products.slice(1), policyText: replyFacts.policyAudit?.text || null },
            model: config.draftingModel,
          })
          reply = drafted.draft.reply
          requiresHuman = drafted.draft.requiresHuman || !safety.allowed
          sourceRecordIds = drafted.draft.sourceRecordIds
          draftingUsage = drafted.usage
          draftingModel = drafted.model
          draftingRequestId = drafted.requestId
        }

        const usage = mergeUsage(extractionResult.usage, draftingUsage)
        const cost = (estimateRequestCost(extractionResult.model, extractionResult.usage) || 0)
          + (draftingModel ? estimateRequestCost(draftingModel, draftingUsage) || 0 : 0)
        const priority = safety.priority || extraction.intent === 'complaint' || extraction.intent === 'order_status'
        const outcome = deterministic ? 'deterministic_draft' : requiresHuman ? 'human_handoff_draft' : 'model_draft'
        await req.payload.update({
          collection: 'messages', id: message.id, overrideAccess: true,
          data: {
            status: priority ? 'escalated' : 'open',
            conversationStatus: priority ? 'priority' : 'needs_reply',
            aiProcessingStatus: 'draft_ready', aiDraftStatus: 'draft_ready', aiDraft: reply,
            aiDraftConfidence: extraction.confidence, aiDraftSourceRecordIds: sourceRecordIds,
            aiDraftReason: products.length || !factualIntent ? safety.reason : 'verified_facts_unavailable',
            aiMarket: extraction.market, aiIntent: extraction.intent, aiLanguage: extraction.language,
            aiFacts: auditFacts, aiModel: draftingModel || extractionResult.model,
            aiRequestId: draftingRequestId || extractionResult.requestId,
            aiRequiresHuman: requiresHuman, aiOutcome: outcome,
            aiCompletedAt: new Date().toISOString(), aiLastError: null,
            ...usageFields(usage, cost),
          },
        })

        const safeAutomatic = Boolean(deterministic)
          && SAFE_AUTOMATIC_INTENTS.has(extraction.intent)
          && !requiresHuman && safety.allowed && !(claimed as any).aiBotPaused
        if (canAutoSendAiReply(config) && safeAutomatic) {
          await sendInstagramMessage(String((claimed as any).contactHandle), reply)
          await req.payload.create({
            collection: 'messages', overrideAccess: true,
            data: {
              channel: 'instagram', direction: 'outbound', contactHandle: (claimed as any).contactHandle,
              customerName: (claimed as any).customerName, body: reply, status: 'auto_handled',
              conversationStatus: 'waiting', sentByAutomation: true, automationNote: 'ai-auto-reply',
              aiModel: draftingModel || extractionResult.model, aiOutcome: 'automatic_sent',
            },
          })
          await req.payload.update({ collection: 'messages', id: message.id, data: { aiDraftStatus: 'approved', aiOutcome: 'automatic_sent' }, overrideAccess: true })
        }
        recordAiTelemetry(req.payload.logger, { event: 'request_succeeded', provider: 'openai', model: draftingModel || extractionResult.model, requestId: draftingRequestId || extractionResult.requestId, durationMs: Date.now() - startedAt, usage })
        processed++
      } catch (error) {
        const attempts = Number((claimed as any).aiAttempts || 1)
        const retry = attempts < MAX_ATTEMPTS
        const messageText = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500)
        await req.payload.update({
          collection: 'messages', id: message.id, overrideAccess: true,
          data: retry ? {
            aiProcessingStatus: 'queued', aiDraftStatus: 'queued', aiAvailableAt: retryAt(attempts), aiLastError: messageText,
          } : {
            aiProcessingStatus: 'failed', aiDraftStatus: 'failed', aiLastError: messageText,
            aiCompletedAt: new Date().toISOString(), aiOutcome: 'failed_after_retries', conversationStatus: 'priority', status: 'escalated',
          },
        })
        recordAiTelemetry(req.payload.logger, { event: 'request_failed', provider: 'openai', durationMs: Date.now() - startedAt, reason: messageText, errorStatus: error instanceof AiProviderError ? error.status : undefined })
        if (retry) retried++
        else failed++
      }
    }
    return Response.json({ processed, retried, failed })
  },
}

/** Authenticated, secret-free operational status for the storefront admin. */
export const aiAssistantStatusEndpoint: Endpoint = {
  path: '/ai/status',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return new Response('Unauthorized', { status: 401 })
    const config = getAiAssistantConfig()
    const monthSpendUsd = await currentMonthSpend(req.payload)
    return Response.json({
      mode: config.mode,
      enabled: config.mode !== 'off' && config.apiKeyConfigured,
      extractionModel: config.extractionModel,
      draftingModel: config.draftingModel,
      monthlyBudgetUsd: config.monthlyBudgetUsd,
      monthSpendUsd,
      automaticSending: config.mode === 'automatic',
    })
  },
}

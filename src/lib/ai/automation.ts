import type { Payload } from 'payload'
import type { MessageExtraction } from './extraction'
import type { AiMessagingSettings, HybridAutoReplyIntent } from './settings'

export type HybridReplyKind = 'market_clarification' | 'product_clarification' | 'deterministic_reply'

export type HybridDecisionInput = {
  mode: 'off' | 'shadow' | 'approval' | 'hybrid'
  settings: AiMessagingSettings
  kind: HybridReplyKind
  extraction: MessageExtraction
  deterministicReply: boolean
  safetyAllowed: boolean
  requiresHuman: boolean
  conversationPaused: boolean
  conversationAutoReplies24h: number
  globalAutoReplies1h: number
  newerConversationActivity: boolean
}

export type HybridDecision = { autoSend: boolean; reason: string }

/**
 * One auditable gate for every automatic reply. Drafting and sending are
 * deliberately separate: a message can be safe enough to draft while still
 * requiring approval because of confidence, allow-list or rate limits.
 */
export function evaluateHybridAutoSend(input: HybridDecisionInput): HybridDecision {
  if (input.mode !== 'hybrid') return { autoSend: false, reason: 'approval_mode' }
  if (input.settings.emergencyStop || !input.settings.assistantEnabled) return { autoSend: false, reason: 'automation_stopped' }
  if (input.conversationPaused) return { autoSend: false, reason: 'conversation_paused' }
  if (input.newerConversationActivity) return { autoSend: false, reason: 'newer_conversation_activity' }
  if (input.requiresHuman || !input.safetyAllowed) return { autoSend: false, reason: 'human_review_required' }
  if (input.extraction.confidence < input.settings.confidenceThreshold) return { autoSend: false, reason: 'below_auto_send_confidence' }
  if (input.conversationAutoReplies24h >= input.settings.maxAutoRepliesPerConversation) return { autoSend: false, reason: 'conversation_rate_limit' }
  if (input.globalAutoReplies1h >= input.settings.maxAutoRepliesPerHour) return { autoSend: false, reason: 'global_rate_limit' }
  if (input.kind === 'market_clarification') {
    return input.settings.autoReplyMarketClarification
      ? { autoSend: true, reason: 'safe_market_clarification' }
      : { autoSend: false, reason: 'market_clarification_not_allowed' }
  }
  if (input.kind === 'product_clarification') {
    return input.settings.autoReplyProductClarification
      ? { autoSend: true, reason: 'safe_product_clarification' }
      : { autoSend: false, reason: 'product_clarification_not_allowed' }
  }
  if (!input.deterministicReply) return { autoSend: false, reason: 'model_draft_requires_approval' }
  if (!input.settings.autoReplyIntents.includes(input.extraction.intent as HybridAutoReplyIntent)) return { autoSend: false, reason: 'intent_not_allowed' }
  return { autoSend: true, reason: 'safe_verified_reply' }
}

export type AutomationCounts = {
  conversationAutoReplies24h: number
  globalAutoReplies1h: number
  newerConversationActivity: boolean
}

export async function loadAutomationCounts(
  payload: Payload,
  message: { id: string | number; contactHandle: string; createdAt?: string | null },
  now = new Date(),
): Promise<AutomationCounts> {
  const hourAgo = new Date(now.getTime() - 60 * 60_000).toISOString()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString()
  const createdAt = message.createdAt || now.toISOString()
  const [conversation, global, newer] = await Promise.all([
    payload.count({
      collection: 'messages',
      where: { and: [
        { channel: { equals: 'instagram' } },
        { direction: { equals: 'outbound' } },
        { contactHandle: { equals: message.contactHandle } },
        { sentByAutomation: { equals: true } },
        { automationNote: { equals: 'ai-auto-reply' } },
        { createdAt: { greater_than_equal: dayAgo } },
      ] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'messages',
      where: { and: [
        { channel: { equals: 'instagram' } },
        { direction: { equals: 'outbound' } },
        { sentByAutomation: { equals: true } },
        { automationNote: { equals: 'ai-auto-reply' } },
        { createdAt: { greater_than_equal: hourAgo } },
      ] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'messages',
      where: { and: [
        { channel: { equals: 'instagram' } },
        { contactHandle: { equals: message.contactHandle } },
        { createdAt: { greater_than: createdAt } },
      ] },
      overrideAccess: true,
    }),
  ])
  return {
    conversationAutoReplies24h: conversation.totalDocs,
    globalAutoReplies1h: global.totalDocs,
    newerConversationActivity: newer.totalDocs > 0,
  }
}

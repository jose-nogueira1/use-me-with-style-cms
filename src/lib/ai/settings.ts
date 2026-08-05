import type { Payload } from 'payload'
import type { ExtractionIntent } from './extraction'

export const HYBRID_AUTO_REPLY_INTENTS = [
  'greeting',
  'product_availability',
  'product_price',
  'product_sizing',
  'delivery',
  'payment',
  'coupon',
  'return_policy',
] as const satisfies readonly ExtractionIntent[]

export type HybridAutoReplyIntent = typeof HYBRID_AUTO_REPLY_INTENTS[number]
export type AiOperatingMode = 'approval' | 'hybrid'

export type AiMessagingSettings = {
  assistantEnabled: boolean
  emergencyStop: boolean
  operatingMode: AiOperatingMode
  autoReplyIntents: HybridAutoReplyIntent[]
  autoReplyMarketClarification: boolean
  autoReplyProductClarification: boolean
  confidenceThreshold: number
  replyDelaySeconds: number
  maxAutoRepliesPerConversation: number
  maxAutoRepliesPerHour: number
  monthlyBudgetUsd: number
}

export const DEFAULT_AI_MESSAGING_SETTINGS: AiMessagingSettings = {
  assistantEnabled: true,
  emergencyStop: false,
  operatingMode: 'approval',
  autoReplyIntents: [...HYBRID_AUTO_REPLY_INTENTS],
  autoReplyMarketClarification: true,
  autoReplyProductClarification: true,
  confidenceThreshold: 0.92,
  replyDelaySeconds: 15,
  maxAutoRepliesPerConversation: 6,
  maxAutoRepliesPerHour: 40,
  monthlyBudgetUsd: 25,
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

export function normalizeAiMessagingSettings(value: unknown): AiMessagingSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const intents = Array.isArray(raw.autoReplyIntents)
    ? raw.autoReplyIntents.filter((intent): intent is HybridAutoReplyIntent => HYBRID_AUTO_REPLY_INTENTS.includes(intent as HybridAutoReplyIntent))
    : DEFAULT_AI_MESSAGING_SETTINGS.autoReplyIntents
  return {
    assistantEnabled: raw.assistantEnabled !== false,
    emergencyStop: raw.emergencyStop === true,
    operatingMode: raw.operatingMode === 'hybrid' ? 'hybrid' : 'approval',
    autoReplyIntents: [...new Set(intents)],
    autoReplyMarketClarification: raw.autoReplyMarketClarification !== false,
    autoReplyProductClarification: raw.autoReplyProductClarification !== false,
    confidenceThreshold: finiteNumber(raw.confidenceThreshold, 0.92, 0.75, 1),
    replyDelaySeconds: Math.round(finiteNumber(raw.replyDelaySeconds, 15, 5, 120)),
    maxAutoRepliesPerConversation: Math.round(finiteNumber(raw.maxAutoRepliesPerConversation, 6, 1, 20)),
    maxAutoRepliesPerHour: Math.round(finiteNumber(raw.maxAutoRepliesPerHour, 40, 1, 200)),
    monthlyBudgetUsd: finiteNumber(raw.monthlyBudgetUsd, 25, 0, 10_000),
  }
}

export async function loadAiMessagingSettings(payload: Pick<Payload, 'findGlobal'>): Promise<AiMessagingSettings> {
  const value = await payload.findGlobal({ slug: 'ai-messaging-settings', depth: 0, overrideAccess: true })
  return normalizeAiMessagingSettings(value)
}

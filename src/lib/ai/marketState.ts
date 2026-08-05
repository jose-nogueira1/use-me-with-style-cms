import type { CatalogueMarket } from './catalogue'
import type { MessageExtraction } from './extraction'

export type MarketState = {
  market: CatalogueMarket | null
  selectedAt: string | null
}

export type MarketStateMessage = {
  createdAt?: string | null
  aiMarket?: 'angola' | 'portugal' | null
  market?: 'AO' | 'PT' | null
}

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000

export function extractionMarket(extraction: Pick<MessageExtraction, 'market'>): CatalogueMarket | null {
  return extraction.market === 'angola' ? 'AO' : extraction.market === 'portugal' ? 'PT' : null
}

export function marketQuestion(language: 'pt' | 'en' | 'unknown' = 'pt'): string {
  return language === 'en' ? 'Are you shopping for Angola or Portugal?' : 'Está a comprar para Angola ou Portugal?'
}

export function getConversationMarket(messages: MarketStateMessage[], now = new Date()): MarketState {
  const latest = [...messages]
    .filter((message) => message.createdAt && (message.aiMarket || message.market))
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())[0]
  if (!latest?.createdAt) return { market: null, selectedAt: null }
  const selectedAt = new Date(latest.createdAt)
  if (!Number.isFinite(selectedAt.getTime()) || now.getTime() - selectedAt.getTime() > STALE_AFTER_MS) return { market: null, selectedAt: null }
  const market = latest.market || (latest.aiMarket === 'angola' ? 'AO' : latest.aiMarket === 'portugal' ? 'PT' : null)
  return { market, selectedAt: selectedAt.toISOString() }
}

export function resolveMarket(extraction: Pick<MessageExtraction, 'market'>, conversation: MarketState): CatalogueMarket | null {
  return extractionMarket(extraction) || conversation.market
}

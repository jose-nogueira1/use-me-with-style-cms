export type AiAssistantMode = 'off' | 'shadow' | 'approval' | 'automatic'

export type AiAssistantConfig = {
  mode: AiAssistantMode
  extractionModel: string
  draftingModel: string
  monthlyBudgetUsd: number | null
  apiKeyConfigured: boolean
}

const MODES: AiAssistantMode[] = ['off', 'shadow', 'approval', 'automatic']

function readMode(value: string | undefined): AiAssistantMode {
  const normalized = value?.trim().toLowerCase() as AiAssistantMode | undefined
  return normalized && MODES.includes(normalized) ? normalized : 'off'
}

function readBudget(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const budget = Number(value)
  return Number.isFinite(budget) && budget >= 0 ? budget : null
}

/**
 * Reads server-only AI settings. The default is deliberately off: adding an
 * API key must never activate customer-facing automation by accident.
 */
export function getAiAssistantConfig(env: Record<string, string | undefined> = process.env): AiAssistantConfig {
  return {
    mode: readMode(env.AI_ASSISTANT_MODE),
    extractionModel: env.OPENAI_AI_EXTRACTION_MODEL?.trim() || 'gpt-5.4-nano',
    draftingModel: env.OPENAI_AI_DRAFT_MODEL?.trim() || 'gpt-5.4-mini',
    monthlyBudgetUsd: readBudget(env.OPENAI_AI_MONTHLY_BUDGET_USD),
    apiKeyConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
  }
}

export function isAiAssistantEnabled(config = getAiAssistantConfig()): boolean {
  return config.mode !== 'off' && config.apiKeyConfigured
}

export function canAutoSendAiReply(config = getAiAssistantConfig()): boolean {
  return isAiAssistantEnabled(config) && config.mode === 'automatic'
}

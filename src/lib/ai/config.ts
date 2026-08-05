import { DEFAULT_AI_MESSAGING_SETTINGS, type AiMessagingSettings } from './settings'

export type AiAssistantMode = 'off' | 'shadow' | 'approval' | 'hybrid'

export type AiAssistantConfig = {
  mode: AiAssistantMode
  extractionModel: string
  draftingModel: string
  monthlyBudgetUsd: number | null
  apiKeyConfigured: boolean
  settings: AiMessagingSettings
}

function readEnvironmentMode(value: string | undefined): 'off' | 'shadow' | 'approval' | 'hybrid' {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'automatic') return 'hybrid'
  if (normalized === 'off' || normalized === 'shadow' || normalized === 'hybrid') return normalized
  return 'approval'
}

function readBudget(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const budget = Number(value)
  return Number.isFinite(budget) && budget >= 0 ? budget : null
}

/**
 * Combines server-only credentials/model settings with authenticated
 * operational settings. Approval is the default; the environment `off`
 * value remains an infrastructure-level kill switch that always wins.
 */
export function getAiAssistantConfig(
  env: Record<string, string | undefined> = process.env,
  settings: AiMessagingSettings = DEFAULT_AI_MESSAGING_SETTINGS,
): AiAssistantConfig {
  const environmentMode = readEnvironmentMode(env.AI_ASSISTANT_MODE)
  const stopped = !settings.assistantEnabled || settings.emergencyStop
  const mode: AiAssistantMode = stopped || environmentMode === 'off'
    ? 'off'
    : environmentMode === 'shadow'
      ? 'shadow'
      : settings.operatingMode
  return {
    mode,
    extractionModel: env.OPENAI_AI_EXTRACTION_MODEL?.trim() || 'gpt-5.4-nano',
    draftingModel: env.OPENAI_AI_DRAFT_MODEL?.trim() || 'gpt-5.4-mini',
    monthlyBudgetUsd: settings.monthlyBudgetUsd ?? readBudget(env.OPENAI_AI_MONTHLY_BUDGET_USD),
    apiKeyConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    settings,
  }
}

export function isAiAssistantEnabled(config = getAiAssistantConfig()): boolean {
  return config.mode !== 'off' && config.apiKeyConfigured
}

export function canAutoSendAiReply(config = getAiAssistantConfig()): boolean {
  return isAiAssistantEnabled(config) && config.mode === 'hybrid'
}

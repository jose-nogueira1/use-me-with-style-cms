import type { AiUsage } from './provider'

export type AiTelemetryEvent = {
  event: 'request_started' | 'request_succeeded' | 'request_failed' | 'request_skipped'
  provider: string
  model?: string
  requestId?: string
  durationMs?: number
  usage?: AiUsage
  reason?: string
  errorStatus?: number
}

export type AiTelemetryLogger = {
  info?: (details: unknown, message?: string) => void
  warn?: (details: unknown, message?: string) => void
  error?: (details: unknown, message?: string) => void
}

/**
 * Structured telemetry for T01. It deliberately records metadata only:
 * prompts, customer text and hidden reasoning must not enter application logs.
 */
export function recordAiTelemetry(logger: AiTelemetryLogger | undefined, event: AiTelemetryEvent): void {
  if (!logger) return
  const method = event.event === 'request_failed' ? logger.error : event.event === 'request_skipped' ? logger.warn : logger.info
  method?.({ ai: event }, `[ai:${event.event}]`)
}

export function estimateAiCostUsd(usage: AiUsage | undefined, prices: { inputPerMillion: number; outputPerMillion: number }): number | null {
  if (!usage) return null
  const input = Number(usage.inputTokens || 0)
  const output = Number(usage.outputTokens || 0)
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null
  return (input / 1_000_000) * prices.inputPerMillion + (output / 1_000_000) * prices.outputPerMillion
}

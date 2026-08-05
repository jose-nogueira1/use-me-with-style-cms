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
  const details = { ai: event }
  const message = `[ai:${event.event}]`
  // Pino methods depend on their logger receiver. Calling a detached method
  // loses that receiver and throws while attempting to read its symbols.
  if (event.event === 'request_failed') logger.error?.(details, message)
  else if (event.event === 'request_skipped') logger.warn?.(details, message)
  else logger.info?.(details, message)
}

export function estimateAiCostUsd(usage: AiUsage | undefined, prices: { inputPerMillion: number; outputPerMillion: number }): number | null {
  if (!usage) return null
  const input = Number(usage.inputTokens || 0)
  const output = Number(usage.outputTokens || 0)
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null
  return (input / 1_000_000) * prices.inputPerMillion + (output / 1_000_000) * prices.outputPerMillion
}

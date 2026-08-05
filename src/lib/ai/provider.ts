import { getAiAssistantConfig, type AiAssistantConfig } from './config'

export type AiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiRequest = {
  model: string
  messages: AiMessage[]
  /** JSON schema or other provider response-format descriptor, added in T03. */
  responseFormat?: Record<string, unknown>
  maxOutputTokens?: number
}

export type AiUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type AiResponse<T = unknown> = {
  output: T
  usage?: AiUsage
  requestId?: string
  model: string
}

export type AiProvider = {
  complete<T = unknown>(request: AiRequest): Promise<AiResponse<T>>
}

export class AiProviderError extends Error {
  readonly provider: string
  readonly status?: number
  readonly requestId?: string

  constructor(message: string, options: { provider: string; status?: number; requestId?: string }) {
    super(message)
    this.name = 'AiProviderError'
    this.provider = options.provider
    this.status = options.status
    this.requestId = options.requestId
  }
}

/**
 * OpenAI Responses API adapter. T01 establishes the boundary; T03 will add
 * the strict schema parsing and domain-specific prompts.
 */
export class OpenAiProvider implements AiProvider {
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async complete<T = unknown>(request: AiRequest): Promise<AiResponse<T>> {
    const response = await this.fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        input: request.messages,
        ...(request.responseFormat ? { text: { format: request.responseFormat } } : {}),
        ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
      }),
    })

    const requestId = response.headers.get('x-request-id') || undefined
    const body = await response.json().catch(() => ({})) as Record<string, any>
    if (!response.ok) {
      const message = typeof body.error?.message === 'string' ? body.error.message : `OpenAI request failed (${response.status})`
      throw new AiProviderError(message, { provider: 'openai', status: response.status, requestId })
    }

    const outputText = typeof body.output_text === 'string'
      ? body.output_text
      : body.output?.flatMap((item: any) => item.content ?? []).find((part: any) => typeof part.text === 'string')?.text
    let output: unknown = outputText ?? body.output
    if (typeof outputText === 'string') {
      try { output = JSON.parse(outputText) } catch { /* T03 decides whether text is acceptable. */ }
    }
    return {
      output: output as T,
      model: body.model || request.model,
      requestId,
      usage: body.usage ? {
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
        totalTokens: body.usage.total_tokens,
      } : undefined,
    }
  }
}

export function createAiProvider(config: AiAssistantConfig = getAiAssistantConfig()): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!config.apiKeyConfigured || !apiKey) throw new AiProviderError('OPENAI_API_KEY is not configured', { provider: 'openai' })
  return new OpenAiProvider(apiKey)
}

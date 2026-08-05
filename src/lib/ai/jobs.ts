import { isAiAssistantEnabled } from './config'

export type AiJobStatus = 'queued' | 'processing' | 'draft_ready' | 'failed' | 'cancelled'

export type AiJobMessage = {
  id: string
  channel?: string | null
  direction?: string | null
  contactHandle?: string | null
  externalId?: string | null
  aiProcessingStatus?: AiJobStatus | null
  aiAttempts?: number | null
  aiAvailableAt?: string | null
  aiStartedAt?: string | null
  aiCompletedAt?: string | null
  aiCancelledAt?: string | null
  aiLastError?: string | null
}

export type AiJobClient = {
  find: (args: Record<string, unknown>) => Promise<{ docs: AiJobMessage[] }>
  update: (args: Record<string, unknown>) => Promise<AiJobMessage>
}

const ACTIVE_STATUSES: AiJobStatus[] = ['queued', 'processing']

export function getDebouncedAvailability(now = new Date(), debounceMs = 7_500): string {
  return new Date(now.getTime() + debounceMs).toISOString()
}

export async function enqueueAiMessageJob(
  client: AiJobClient,
  message: AiJobMessage,
  options: { now?: Date; debounceMs?: number } = {},
): Promise<AiJobMessage | null> {
  if (!isAiAssistantEnabled()) return null
  if (message.channel !== 'instagram' || message.direction !== 'inbound') return null
  if (message.aiProcessingStatus && ACTIVE_STATUSES.includes(message.aiProcessingStatus)) return message

  return client.update({
    collection: 'messages',
    id: message.id,
    data: {
      aiProcessingStatus: 'queued',
      aiAttempts: Number(message.aiAttempts || 0),
      aiAvailableAt: getDebouncedAvailability(options.now, options.debounceMs),
      aiStartedAt: null,
      aiCompletedAt: null,
      aiCancelledAt: null,
      aiLastError: null,
    },
    overrideAccess: true,
  })
}

export async function cancelPendingAiJobs(client: AiJobClient, contactHandle: string, now = new Date()): Promise<number> {
  const result = await client.find({
    collection: 'messages',
    where: {
      and: [
        { channel: { equals: 'instagram' } },
        { contactHandle: { equals: contactHandle } },
        { direction: { equals: 'inbound' } },
        { aiProcessingStatus: { in: ACTIVE_STATUSES } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  await Promise.all(result.docs.map((message) => client.update({
    collection: 'messages',
    id: message.id,
    data: { aiProcessingStatus: 'cancelled', aiCancelledAt: now.toISOString() },
    overrideAccess: true,
  })))
  return result.docs.length
}

export async function claimAiMessageJob(client: AiJobClient, message: AiJobMessage, now = new Date()): Promise<AiJobMessage | null> {
  if (message.aiProcessingStatus !== 'queued') return null
  if (message.aiAvailableAt && new Date(message.aiAvailableAt).getTime() > now.getTime()) return null
  return client.update({
    collection: 'messages',
    id: message.id,
    data: {
      aiProcessingStatus: 'processing',
      aiAttempts: Number(message.aiAttempts || 0) + 1,
      aiStartedAt: now.toISOString(),
    },
    overrideAccess: true,
  })
}

import type { Endpoint } from 'payload'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { classifyIncomingMessage, markInstagramConversationSeen } from '../lib/messaging'
import { enqueueAiMessageJob } from '../lib/ai/jobs'

// Unified Meta webhook for both WhatsApp Business and Instagram messaging
// (JOS-58, Phase 1 messaging automation foundation). Meta's webhook
// verification handshake (GET) and event delivery (POST) share the same
// `/api/messaging-webhook` URL for both products, distinguished by
// `body.object`.
//
// Setup this endpoint needs once real credentials exist (see README):
//   - META_WEBHOOK_VERIFY_TOKEN -- arbitrary string you also enter in the
//     Meta App dashboard's webhook config.
//   - WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID -- WhatsApp Business
//     Cloud API.
//   - INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_PAGE_ID -- Instagram messaging via
//     the connected Facebook Page.
// Until those are set, inbound events are still logged and classified, but
// outbound sends log to the console instead of calling the Graph API (same
// "log instead of throw" pattern as notifyOrderEvent.ts).

const verifyEndpoint: Endpoint = {
  path: '/messaging-webhook',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN
    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  },
}

type InboundMessage = {
  channel: 'instagram'
  direction: 'inbound' | 'outbound'
  contactHandle: string
  customerName?: string
  body: string
  externalId?: string
  instagramContextType?: 'story_reply' | 'shared_post' | 'media' | 'inline_reply' | 'unsupported_media'
  instagramContextUrl?: string
  instagramContextPermalink?: string
  instagramContextMediaType?: string
  replyToExternalId?: string
}

type InstagramAttachment = {
  type?: unknown
  url?: unknown
  permalink?: unknown
  payload?: Record<string, unknown>
}

function validHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function instagramPermalink(...values: unknown[]): string | undefined {
  return values
    .map(validHttpUrl)
    .find((value) => {
      if (!value) return false
      const hostname = new URL(value).hostname.toLowerCase()
      return hostname === 'instagram.com' || hostname === 'www.instagram.com'
    })
}

function attachmentUrl(attachment?: InstagramAttachment): string | undefined {
  return validHttpUrl(
    attachment?.payload?.url
      ?? attachment?.payload?.media_url
      ?? attachment?.payload?.image_url
      ?? attachment?.payload?.video_url
      ?? attachment?.url,
  )
}

/** Logs only the webhook shape, never message content, IDs, URLs, or tokens. */
export function summarizeInstagramEvent(event: any) {
  const message = event?.message ?? {}
  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  return {
    messageKeys: Object.keys(message).sort(),
    replyToKeys: Object.keys(message.reply_to ?? {}).sort(),
    storyKeys: Object.keys(message.reply_to?.story ?? {}).sort(),
    attachments: attachments.map((attachment: InstagramAttachment) => ({
      type: typeof attachment?.type === 'string' ? attachment.type : 'unknown',
      attachmentKeys: Object.keys(attachment ?? {}).sort(),
      payloadKeys: Object.keys(attachment?.payload ?? {}).sort(),
      hasUsableUrl: Boolean(attachmentUrl(attachment)),
      hasInstagramPermalink: Boolean(instagramPermalink(
        attachment?.permalink,
        attachment?.payload?.permalink,
        attachment?.payload?.post_url,
      )),
    })),
  }
}

function extractInstagramEvent(entryId: unknown, event: any): InboundMessage | null {
  const senderId = event?.sender?.id
  const recipientId = event?.recipient?.id
  const message = event?.message
  if (!senderId || !message) return null
  const isOutbound = Boolean(message.is_echo) || String(senderId) === String(entryId)
  const contactHandle = isOutbound ? recipientId : senderId
  if (!contactHandle || String(contactHandle) === String(entryId)) return null

  const attachments: InstagramAttachment[] = Array.isArray(message.attachments) ? message.attachments : []
  const story = message.reply_to?.story
  const replyToExternalId = message.reply_to?.mid
  const normalizedType = (attachment?: InstagramAttachment) => String(attachment?.type ?? '').toLowerCase()
  const shared = attachments.find((attachment) =>
    ['share', 'ig_post', 'ig_reel', 'reel', 'media', 'post'].includes(normalizedType(attachment)),
  )
  const visualMedia = attachments.find((attachment) =>
    ['image', 'photo', 'video'].includes(normalizedType(attachment)),
  )
  const unsupported = Boolean(message.is_unsupported) || attachments.length > 0

  let instagramContextType: InboundMessage['instagramContextType']
  let instagramContextUrl: string | undefined
  let instagramContextPermalink: string | undefined
  let instagramContextMediaType: string | undefined
  if (story) {
    instagramContextType = 'story_reply'
    instagramContextUrl = validHttpUrl(story.url ?? story.media_url ?? story.image_url ?? story.video_url)
    instagramContextPermalink = instagramPermalink(story.permalink, story.post_url)
    instagramContextMediaType = story.video_url ? 'story_video' : 'story'
  } else if (replyToExternalId) {
    instagramContextType = 'inline_reply'
  } else if (shared) {
    instagramContextType = 'shared_post'
    instagramContextUrl = attachmentUrl(shared)
    instagramContextPermalink = instagramPermalink(
      shared.permalink,
      shared.payload?.permalink,
      shared.payload?.post_url,
      shared.payload?.url,
    )
    if (instagramContextUrl === instagramContextPermalink) instagramContextUrl = undefined
    instagramContextMediaType = normalizedType(shared)
  } else if (visualMedia) {
    instagramContextType = 'media'
    instagramContextUrl = attachmentUrl(visualMedia)
    instagramContextMediaType = normalizedType(visualMedia)
  } else if (unsupported) {
    instagramContextType = 'unsupported_media'
    instagramContextMediaType = normalizedType(attachments[0]) || undefined
  }

  const fallback = instagramContextType === 'story_reply'
    ? 'Replied to your story'
    : instagramContextType === 'shared_post'
      ? 'Shared an Instagram post'
      : instagramContextType === 'media'
        ? 'Sent media'
        : instagramContextType === 'unsupported_media'
          ? 'Sent media — open this conversation on Instagram'
          : instagramContextType === 'inline_reply'
            ? 'Replied to a message'
            : ''
  const text = typeof message.text === 'string' ? message.text.trim() : ''
  if (!text && !fallback) return null

  return {
    channel: 'instagram',
    direction: isOutbound ? 'outbound' : 'inbound',
    contactHandle: String(contactHandle),
    body: text || fallback,
    externalId: message.mid,
    ...(instagramContextType ? { instagramContextType } : {}),
    ...(instagramContextUrl ? { instagramContextUrl } : {}),
    ...(instagramContextPermalink ? { instagramContextPermalink } : {}),
    ...(instagramContextMediaType ? { instagramContextMediaType } : {}),
    ...(replyToExternalId ? { replyToExternalId } : {}),
  }
}

export function extractInboundMessages(payload: unknown): InboundMessage[] {
  const messages: InboundMessage[] = []
  if (!payload || typeof payload !== 'object') return messages
  const body = payload as Record<string, unknown>

  // WhatsApp is dormant, not deleted. Restore its parser here if the channel
  // is brought back; the active production inbox is Instagram-only.

  if (body.object === 'instagram') {
    const entries = (body.entry as any[]) ?? []
    for (const entry of entries) {
      for (const event of entry.messaging ?? []) {
        // eslint-disable-next-line no-console
        console.info('[instagram:webhook-shape]', summarizeInstagramEvent(event))
        const parsed = extractInstagramEvent(entry.id, event)
        if (parsed) messages.push(parsed)
      }
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const event = change.value ?? {}
        // eslint-disable-next-line no-console
        console.info('[instagram:webhook-shape]', summarizeInstagramEvent(event))
        const parsed = extractInstagramEvent(entry.id, event)
        if (parsed) messages.push(parsed)
      }
    }
  }

  return messages
}

export function extractInstagramSeenReceipts(payload: unknown): Array<{ contactHandle: string; externalId: string; seenAt: string }> {
  if (!payload || typeof payload !== 'object') return []
  const body = payload as Record<string, any>
  if (body.object !== 'instagram') return []
  const receipts: Array<{ contactHandle: string; externalId: string; seenAt: string }> = []
  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (!event?.sender?.id || !event?.read?.mid) continue
      receipts.push({
        contactHandle: String(event.sender.id),
        externalId: String(event.read.mid),
        seenAt: new Date(typeof event.timestamp === 'number' ? event.timestamp : Date.now()).toISOString(),
      })
    }
  }
  return receipts
}

const eventsEndpoint: Endpoint = {
  path: '/messaging-webhook',
  method: 'post',
  handler: async (req) => {
    let payload: unknown
    try {
      const rawBody = await req.text?.()
      if (typeof rawBody !== 'string') return new Response('Bad Request', { status: 400 })

      const appSecrets = [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(
        (secret): secret is string => Boolean(secret),
      )
      if (appSecrets.length > 0) {
        const signature = req.headers.get('x-hub-signature-256')
        if (!appSecrets.some((secret) => verifyMetaWebhookSignature(rawBody, signature, secret))) {
          return new Response('Unauthorized', { status: 401 })
        }
      }

      payload = JSON.parse(rawBody)
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const receipts = extractInstagramSeenReceipts(payload)
    for (const receipt of receipts) {
      try {
        const sent = await req.payload.find({
          collection: 'messages',
          where: {
            and: [
              { externalId: { equals: receipt.externalId } },
              { contactHandle: { equals: receipt.contactHandle } },
              { direction: { equals: 'outbound' } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (sent.docs[0]) {
          await req.payload.update({
            collection: 'messages',
            id: sent.docs[0].id,
            data: { instagramSeenAt: receipt.seenAt },
            overrideAccess: true,
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[instagram:seen-receipt-failed]', err)
      }
    }

    const inbound = extractInboundMessages(payload)

    for (const msg of inbound) {
      try {
        await handleInboundMessage(req.payload, msg)
      } catch (err) {
        // One malformed/failed message shouldn't drop the rest of the batch,
        // and Meta expects a 200 regardless or it will keep retrying.
        // eslint-disable-next-line no-console
        console.error('[messaging-webhook:handle-failed]', err)
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 })
  },
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature?.startsWith('sha256=')) return false
  const provided = signature.slice('sha256='.length)
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'))
}

async function handleInboundMessage(payloadClient: any, msg: InboundMessage) {
  const intent = msg.direction === 'inbound' ? classifyIncomingMessage(msg.body) : 'unknown'

  // Meta retries deliveries; its message ID is the stable idempotency key.
  if (msg.externalId) {
    const existing = await payloadClient.find({
      collection: 'messages',
      where: { externalId: { equals: msg.externalId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) return
  }

  // Match the echo of an admin-sent reply to its existing local row. Messages
  // composed directly in Instagram have no match and are imported normally.
  if (msg.direction === 'outbound') {
    const recentAdminReply = await payloadClient.find({
      collection: 'messages',
      where: {
        and: [
          { channel: { equals: 'instagram' } },
          { direction: { equals: 'outbound' } },
          { contactHandle: { equals: msg.contactHandle } },
          { body: { equals: msg.body } },
          { sentByAutomation: { equals: false } },
          { createdAt: { greater_than: new Date(Date.now() - 2 * 60 * 1000).toISOString() } },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const matched = recentAdminReply.docs[0]
    if (matched) {
      if (msg.externalId && matched.externalId !== msg.externalId) {
        await payloadClient.update({
          collection: 'messages',
          id: matched.id,
          data: { externalId: msg.externalId },
          overrideAccess: true,
        })
      }
      return
    }
  }

  let replyToText: string | undefined
  if (msg.replyToExternalId) {
    const repliedTo = await payloadClient.find({
      collection: 'messages',
      where: { externalId: { equals: msg.replyToExternalId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    replyToText = repliedTo.docs[0]?.body
  }

  let status: 'open' | 'escalated' | 'resolved' = msg.direction === 'outbound' ? 'resolved' : 'open'
  let conversationStatus: 'needs_reply' | 'waiting' | 'priority' = msg.direction === 'outbound' ? 'waiting' : 'needs_reply'
  let automationNote = msg.direction === 'outbound'
    ? 'instagram-app -- synced outbound echo'
    : 'instagram-inbox -- manual reply required'
  if (msg.direction === 'inbound' && intent === 'sensitive') {
    status = 'escalated'
    conversationStatus = 'priority'
    automationNote = 'sensitive-topic -- escalated to Raisa'
  }

  const messageDoc = await payloadClient.create({
    collection: 'messages',
    overrideAccess: true,
    data: {
      channel: msg.channel,
      direction: msg.direction,
      contactHandle: msg.contactHandle,
      customerName: msg.customerName,
      body: msg.body,
      status,
      conversationStatus,
      automationNote,
      externalId: msg.externalId,
      sentByAutomation: msg.direction === 'outbound',
      instagramContextType: msg.instagramContextType,
      instagramContextUrl: msg.instagramContextUrl,
      instagramContextPermalink: msg.instagramContextPermalink,
      instagramContextMediaType: msg.instagramContextMediaType,
      replyToExternalId: msg.replyToExternalId,
      replyToText,
    },
  })

  // Only inbound Instagram messages enter the approval-mode AI draft queue.
  // Outbound echoes are conversation history and must never trigger a draft.
  if (msg.direction === 'inbound') {
    await enqueueAiMessageJob(payloadClient, {
      id: messageDoc.id,
      channel: msg.channel,
      direction: msg.direction,
      contactHandle: msg.contactHandle,
    })
  }
}

const markConversationReadEndpoint: Endpoint = {
  path: '/instagram-conversations/read',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    let contactHandle = ''
    try {
      const body = await req.json?.() as { contactHandle?: unknown }
      contactHandle = typeof body?.contactHandle === 'string' ? body.contactHandle.trim() : ''
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!contactHandle) return Response.json({ error: 'contactHandle is required' }, { status: 400 })

    const unread = await req.payload.find({
      collection: 'messages',
      where: {
        and: [
          { channel: { equals: 'instagram' } },
          { contactHandle: { equals: contactHandle } },
          { direction: { equals: 'inbound' } },
          { adminReadAt: { exists: false } },
        ],
      },
      limit: 300,
      depth: 0,
      overrideAccess: true,
    })
    const readAt = new Date().toISOString()
    await Promise.all(unread.docs.map((message: any) => req.payload.update({
      collection: 'messages',
      id: message.id,
      data: { adminReadAt: readAt },
      overrideAccess: true,
    })))

    const instagramSynced = await markInstagramConversationSeen(contactHandle)
    return Response.json({ readAt, updatedIds: unread.docs.map((message: any) => message.id), instagramSynced })
  },
}

export const messagingWebhookEndpoints: Endpoint[] = [verifyEndpoint, eventsEndpoint, markConversationReadEndpoint]

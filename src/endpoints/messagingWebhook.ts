import type { Endpoint } from 'payload'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { classifyIncomingMessage } from '../lib/messaging'
// The AI/product-aware reply assistant is a later feature. Keep the existing
// reply helpers dormant until that plan is implemented and approved.
// import { buildAutoReply, sendInstagramMessage } from '../lib/messaging'
// WhatsApp is dormant, not deleted. Restore this import with the commented
// parser and reply branch below when the channel is brought back.
// import { sendWhatsAppMessage } from '../lib/messaging'

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
  contactHandle: string
  customerName?: string
  body: string
  externalId?: string
  instagramContextType?: 'story_reply' | 'shared_post' | 'inline_reply' | 'unsupported_media'
  instagramContextUrl?: string
  instagramContextMediaType?: string
  replyToExternalId?: string
}

function extractInstagramEvent(entryId: unknown, event: any): InboundMessage | null {
  const senderId = event?.sender?.id
  const message = event?.message
  if (!senderId || !message) return null
  if (message.is_echo || String(senderId) === String(entryId)) return null

  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  const story = message.reply_to?.story
  const replyToExternalId = message.reply_to?.mid
  const shared = attachments.find((attachment: any) =>
    ['share', 'ig_reel', 'reel', 'media'].includes(String(attachment?.type ?? '').toLowerCase()),
  )
  const unsupported = Boolean(message.is_unsupported) || attachments.length > 0

  let instagramContextType: InboundMessage['instagramContextType']
  let instagramContextUrl: string | undefined
  let instagramContextMediaType: string | undefined
  if (story) {
    instagramContextType = 'story_reply'
    instagramContextUrl = story.url
    instagramContextMediaType = 'story'
  } else if (replyToExternalId) {
    instagramContextType = 'inline_reply'
  } else if (shared) {
    instagramContextType = 'shared_post'
    instagramContextUrl = shared.payload?.url
    instagramContextMediaType = shared.type
  } else if (unsupported) {
    instagramContextType = 'unsupported_media'
    instagramContextMediaType = attachments[0]?.type
  }

  const fallback = instagramContextType === 'story_reply'
    ? 'Replied to your story'
    : instagramContextType === 'shared_post'
      ? 'Shared an Instagram post'
      : instagramContextType === 'unsupported_media'
        ? 'Sent media — open this conversation on Instagram'
        : instagramContextType === 'inline_reply'
          ? 'Replied to a message'
          : ''
  const text = typeof message.text === 'string' ? message.text.trim() : ''
  if (!text && !fallback) return null

  return {
    channel: 'instagram',
    contactHandle: String(senderId),
    body: text || fallback,
    externalId: message.mid,
    ...(instagramContextType ? { instagramContextType } : {}),
    ...(instagramContextUrl ? { instagramContextUrl } : {}),
    ...(instagramContextMediaType ? { instagramContextMediaType } : {}),
    ...(replyToExternalId ? { replyToExternalId } : {}),
  }
}

export function extractInboundMessages(payload: unknown): InboundMessage[] {
  const messages: InboundMessage[] = []
  if (!payload || typeof payload !== 'object') return messages
  const body = payload as Record<string, unknown>

  // Dormant WhatsApp parser (future reactivation):
  // if (body.object === 'whatsapp_business_account') {
  //   const entries = (body.entry as any[]) ?? []
  //   for (const entry of entries) {
  //     for (const change of entry.changes ?? []) {
  //       const value = change.value ?? {}
  //       const contacts = value.contacts ?? []
  //       for (const msg of value.messages ?? []) {
  //         if (msg.type !== 'text') continue
  //         messages.push({
  //           channel: 'whatsapp',
  //           contactHandle: msg.from,
  //           customerName: contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name,
  //           body: msg.text?.body ?? '',
  //           externalId: msg.id,
  //         })
  //       }
  //     }
  //   }
  // }

  if (body.object === 'instagram') {
    const entries = (body.entry as any[]) ?? []
    for (const entry of entries) {
      // Instagram API with Facebook Login sends the established Messenger-
      // style shape (`entry[].messaging[]`). Keep supporting it because the
      // production token currently uses the Page-based flow.
      for (const event of entry.messaging ?? []) {
        const parsed = extractInstagramEvent(entry.id, event)
        if (parsed) messages.push(parsed)
      }

      // Meta's current v26 webhook tester (and Instagram Login webhooks) send
      // the same message inside `entry[].changes[].value`. Supporting both
      // shapes lets us migrate login modes later without losing inbound DMs.
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const event = change.value ?? {}
        const parsed = extractInstagramEvent(entry.id, event)
        if (parsed) messages.push(parsed)
      }
    }
  }

  return messages
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
        // Meta's Page/Facebook Login and Instagram Login products use
        // different app secrets even when they share one callback URL.
        // Accept a valid signature from either configured product while
        // keeping unsigned or incorrectly signed requests rejected.
        if (!appSecrets.some((secret) => verifyMetaWebhookSignature(rawBody, signature, secret))) {
          return new Response('Unauthorized', { status: 401 })
        }
      }

      payload = JSON.parse(rawBody)
    } catch {
      return new Response('Bad Request', { status: 400 })
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
  const intent = classifyIncomingMessage(msg.body)

  // Meta retries webhooks when acknowledgements are delayed. `externalId` is
  // the stable message id, so ignore an event we have already persisted.
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

  // WhatsApp could match a sender phone number directly to an order. An
  // Instagram-scoped ID cannot be matched safely, so Instagram order-status
  // questions remain open for an admin unless the customer supplies details.
  // if (msg.channel === 'whatsapp' && intent === 'order_status') { ... }

  let status: 'open' | 'escalated' = 'open'
  let automationNote = 'instagram-inbox -- manual reply required'
  if (intent === 'sensitive') {
    status = 'escalated'
    automationNote = 'sensitive-topic -- escalated to Raisa'
  }

  await payloadClient.create({
    collection: 'messages',
    overrideAccess: true,
    data: {
      channel: msg.channel,
      direction: 'inbound',
      contactHandle: msg.contactHandle,
      customerName: msg.customerName,
      body: msg.body,
      status,
      automationNote,
      externalId: msg.externalId,
      instagramContextType: msg.instagramContextType,
      instagramContextUrl: msg.instagramContextUrl,
      instagramContextMediaType: msg.instagramContextMediaType,
      replyToExternalId: msg.replyToExternalId,
      replyToText,
    },
  })

  // Future AI-assisted reply path (deliberately dormant):
  // const reply = await buildProductAwareInstagramReply(...)
  // await sendInstagramMessage(msg.contactHandle, reply)
  // await payloadClient.create({ collection: 'messages', ... })

  // Dormant WhatsApp reply path (future reactivation):
  // await sendWhatsAppMessage(msg.contactHandle, reply)
}

export const messagingWebhookEndpoints: Endpoint[] = [verifyEndpoint, eventsEndpoint]

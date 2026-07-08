import type { Endpoint } from 'payload'

import { buildAutoReply, classifyIncomingMessage, sendInstagramMessage, sendWhatsAppMessage } from '../lib/messaging'

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
  channel: 'whatsapp' | 'instagram'
  contactHandle: string
  customerName?: string
  body: string
  externalId?: string
}

function extractInboundMessages(payload: unknown): InboundMessage[] {
  const messages: InboundMessage[] = []
  if (!payload || typeof payload !== 'object') return messages
  const body = payload as Record<string, unknown>

  if (body.object === 'whatsapp_business_account') {
    const entries = (body.entry as any[]) ?? []
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {}
        const contacts = value.contacts ?? []
        for (const msg of value.messages ?? []) {
          if (msg.type !== 'text') continue
          messages.push({
            channel: 'whatsapp',
            contactHandle: msg.from,
            customerName: contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name,
            body: msg.text?.body ?? '',
            externalId: msg.id,
          })
        }
      }
    }
  }

  if (body.object === 'instagram') {
    const entries = (body.entry as any[]) ?? []
    for (const entry of entries) {
      for (const event of entry.messaging ?? []) {
        if (!event.message?.text) continue
        messages.push({
          channel: 'instagram',
          contactHandle: event.sender?.id,
          body: event.message.text,
          externalId: event.message.mid,
        })
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
      payload = await req.json?.()
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

async function handleInboundMessage(payloadClient: any, msg: InboundMessage) {
  const intent = classifyIncomingMessage(msg.body)

  let matchedOrder: { id: string; orderNumber: string; status: string } | null = null
  if (intent === 'order_status' && msg.channel === 'whatsapp') {
    const result = await payloadClient.find({
      collection: 'orders',
      where: { customerPhone: { equals: msg.contactHandle } },
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
    })
    matchedOrder = result.docs[0] ?? null
  }

  let status: 'open' | 'auto_handled' | 'escalated' = 'open'
  let automationNote = 'unclassified -- needs manual review'
  if (intent === 'sensitive') {
    status = 'escalated'
    automationNote = 'sensitive-topic -- escalated to Raisa'
  } else if (intent === 'order_status' && matchedOrder) {
    status = 'auto_handled'
    automationNote = 'order-status-auto-reply'
  } else if (intent === 'order_status' && !matchedOrder) {
    automationNote = 'order-status-question -- no matching order found'
  } else if (intent === 'payment') {
    status = 'auto_handled'
    automationNote = 'payment-faq-auto-reply'
  } else if (intent === 'delivery') {
    status = 'auto_handled'
    automationNote = 'delivery-faq-auto-reply'
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
      relatedOrder: matchedOrder?.id,
      externalId: msg.externalId,
    },
  })

  const reply = buildAutoReply(intent, matchedOrder)
  if (!reply) return

  if (msg.channel === 'instagram') {
    await sendInstagramMessage(msg.contactHandle, reply)
  } else {
    await sendWhatsAppMessage(msg.contactHandle, reply)
  }

  await payloadClient.create({
    collection: 'messages',
    overrideAccess: true,
    data: {
      channel: msg.channel,
      direction: 'outbound',
      contactHandle: msg.contactHandle,
      customerName: msg.customerName,
      body: reply,
      status,
      automationNote,
      relatedOrder: matchedOrder?.id,
      sentByAutomation: true,
    },
  })
}

export const messagingWebhookEndpoints: Endpoint[] = [verifyEndpoint, eventsEndpoint]

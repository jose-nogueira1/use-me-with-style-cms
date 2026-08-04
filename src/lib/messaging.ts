// Shared WhatsApp/Instagram send helpers + Phase 1 automation rules
// (JOS-58). Deliberately simple keyword matching, NOT an AI agent -- that
// keeps behaviour auditable and predictable, which the ticket calls for
// ("Message automation rules are documented for Phase 1").
//
// Documented Phase 1 automation rules:
//   1. Sensitive topics (returns/complaints/refunds/cancellations) ALWAYS
//      escalate to a human (Raisa) -- never auto-resolved, at most a short
//      acknowledgement is sent so the customer knows it was received.
//   2. Order-status questions: if the sender's phone matches a known order,
//      auto-reply with that order's current status. If no order is found,
//      falls through to "open" for manual review instead of guessing.
//   3. Payment / delivery FAQs: auto-reply with a static Phase 1 answer
//      (drawn from MarketSettings-style policy text where practical).
//   4. Anything unmatched is left "open" for manual review -- Phase 1 does
//      not attempt to auto-answer questions it can't classify.

export type AutomationIntent = 'sensitive' | 'order_status' | 'payment' | 'delivery' | 'unknown'

const SENSITIVE_KEYWORDS = [
  'reclama', 'complaint', 'devolu', 'return', 'refund', 'reembolso',
  'cancelar', 'cancel', 'problema', 'defeito', 'errado', 'danificad',
]

const ORDER_STATUS_KEYWORDS = [
  'estado da encomenda', 'onde está a minha encomenda', 'onde esta a minha encomenda',
  'tracking', 'rastreio', 'minha encomenda', 'order status', 'where is my order',
]

const PAYMENT_KEYWORDS = ['pagamento', 'pagar', 'transferência', 'transferencia', 'como pago', 'payment', 'mbway', 'paypal']

const DELIVERY_KEYWORDS = ['entrega', 'prazo', 'quanto tempo', 'portes', 'shipping', 'delivery', 'envio']

export function classifyIncomingMessage(body: string): AutomationIntent {
  const text = body.toLowerCase()
  if (SENSITIVE_KEYWORDS.some((k) => text.includes(k))) return 'sensitive'
  if (ORDER_STATUS_KEYWORDS.some((k) => text.includes(k))) return 'order_status'
  if (PAYMENT_KEYWORDS.some((k) => text.includes(k))) return 'payment'
  if (DELIVERY_KEYWORDS.some((k) => text.includes(k))) return 'delivery'
  return 'unknown'
}

const STATUS_LABEL_PT: Record<string, string> = {
  new: 'recebida e por processar',
  payment_review: 'em revisão de pagamento',
  processing: 'em processamento',
  shipped: 'enviada',
  delivered: 'entregue',
  cancelled: 'cancelada',
}

export function buildAutoReply(
  intent: AutomationIntent,
  order?: { orderNumber: string; status: string } | null,
): string | null {
  switch (intent) {
    case 'sensitive':
      return 'Obrigada pela sua mensagem. A nossa equipa vai analisar o seu pedido e responder em breve.'
    case 'order_status':
      if (!order) return null // no matching order -- leave for manual review instead of guessing
      return `A sua encomenda ${order.orderNumber} está ${STATUS_LABEL_PT[order.status] ?? order.status}.`
    case 'payment':
      return 'Em Portugal aceitamos PayPal, Stripe e MB WAY. Em Angola, transferência bancária com confirmação manual. Para mais detalhes sobre uma encomenda específica, envie o número da encomenda.'
    case 'delivery':
      return 'Entregas em Portugal via CTT ou courier (1-2 dias úteis após confirmação). Em Angola, coordenação manual de entrega.'
    default:
      return null
  }
}

// CTT Portugal's real public tracking URL (2026-08-01 request: include a
// tracking link in the shipped notice). Verified format --
// https://appserver2.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=<CODE>&request_locale=<pt|en>
// -- not guessed; CTT codes (the ones cttTrackingCode's own validator
// accepts) work directly as the `objects` param. Only meaningful for PT
// orders -- Angola's `courier_ao` delivery has no equivalent tracking
// system, so there's nothing to build a link for there.
export function buildCttTrackingUrl(code: string, lang: 'pt' | 'en' = 'pt'): string {
  return `https://appserver2.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${encodeURIComponent(code)}&request_locale=${lang === 'en' ? 'en' : 'pt'}`
}

export async function sendWhatsAppMessage(toPhone: string, message: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:not-configured] would send to ${toPhone}: ${message}`)
    return
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: message },
      }),
    })
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('[whatsapp:send-failed]', res.status, await res.text())
    }
  } catch (err) {
    // Never let a messaging failure break an order write or webhook response.
    // eslint-disable-next-line no-console
    console.error('[whatsapp:send-error]', err)
  }
}

// Instagram DMs via the Instagram API with Instagram Login. The access token
// is account-scoped, so the sender is always `me`; the recipient is the
// Instagram-scoped ID received in the messaging webhook.
export async function sendInstagramMessage(toIgId: string, message: string): Promise<void> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN

  if (!token) {
    throw new Error('Instagram messaging is not configured: INSTAGRAM_ACCESS_TOKEN is missing')
  }

  const res = await fetch('https://graph.instagram.com/v26.0/me/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: toIgId },
      message: { text: message },
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Instagram message send failed (${res.status}): ${detail}`)
  }
}

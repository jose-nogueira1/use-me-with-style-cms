// Minimal PayPal Orders v2 REST client (JOS-61) -- deliberately hand-rolled,
// no SDK dependency. Matches this codebase's existing pattern of calling
// Meta's Graph API directly via fetch (see lib/messaging.ts) rather than
// pulling in a provider SDK; PayPal's own current docs also recommend direct
// REST calls over their older (now-legacy) checkout-server-sdk.
// Only used for Portugal/EUR orders -- Angola payments go through
// SWEG/AppyPay (JOS-57), never PayPal.

export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}

function paypalBase(): string {
  return process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !secret) throw new Error('PayPal is not configured')

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

type CreatePaypalOrderInput = {
  orderId: string
  orderNumber: string
  currency: string
  total: number
}

export async function createPaypalOrder(input: CreatePaypalOrderInput): Promise<{ paypalOrderId: string }> {
  const token = await getAccessToken()
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          // custom_id/invoice_id round-trip our order back to us on capture
          // without needing to persist the PayPal order id ahead of time.
          custom_id: input.orderId,
          invoice_id: input.orderNumber,
          amount: {
            currency_code: input.currency,
            value: input.total.toFixed(2),
          },
        },
      ],
    }),
  })
  const data = (await res.json()) as { id?: string; message?: string }
  if (!res.ok || !data.id) throw new Error(`PayPal create order failed (${res.status}): ${JSON.stringify(data)}`)
  return { paypalOrderId: data.id }
}

export async function capturePaypalOrder(
  paypalOrderId: string,
): Promise<{ status: string; orderId?: string; orderNumber?: string }> {
  const token = await getAccessToken()
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const data = (await res.json()) as {
    status?: string
    purchase_units?: { custom_id?: string; invoice_id?: string }[]
    message?: string
  }
  if (!res.ok) throw new Error(`PayPal capture failed (${res.status}): ${JSON.stringify(data)}`)

  const purchaseUnit = data.purchase_units?.[0]
  return {
    status: data.status ?? 'UNKNOWN',
    orderId: purchaseUnit?.custom_id,
    orderNumber: purchaseUnit?.invoice_id,
  }
}

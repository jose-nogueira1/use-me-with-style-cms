import Stripe from 'stripe'

// Real Stripe integration (JOS-61). Only used for Portugal/EUR orders --
// Angola payments go through SWEG/AppyPay (JOS-57), never Stripe. Follows
// the same "env decides, gracefully degrade" pattern as media storage
// (S3_BUCKET) and messaging (WHATSAPP_ACCESS_TOKEN): if STRIPE_SECRET_KEY
// isn't set, the create-session endpoint returns a clear 501 instead of the
// storefront silently pretending to take payment.

let cachedClient: Stripe | null | undefined

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripeClient(): Stripe | null {
  if (cachedClient !== undefined) return cachedClient
  const key = process.env.STRIPE_SECRET_KEY
  cachedClient = key ? new Stripe(key) : null
  return cachedClient
}

type CheckoutItemInput = {
  productName: string
  size?: string | null
  optionLabel?: string | null
  optionValue?: string | null
  productType?: 'standard' | 'bundle' | null
  color?: string
  qty: number
  unitPrice: number
}

type CreateCheckoutSessionInput = {
  orderId: string
  orderNumber: string
  currency: string
  items: CheckoutItemInput[]
  shippingCost: number
  customerEmail: string
  // Coupon codes (2026-07-25, discounts phase 2). Stripe Checkout Sessions
  // charge the sum of line_items -- there's no "total override" parameter,
  // and price_data line items can't have a negative unit_amount, so a
  // discount already baked into our own authoritative `order.total` would
  // otherwise silently NOT reduce what Stripe actually charges. Fixed below
  // by creating a throwaway, single-use Stripe Coupon for exactly this
  // amount and attaching it via the session's `discounts` param -- the
  // documented way to discount a Checkout Session.
  discountAmount?: number
  discountLabel?: string
}

export function stripeReturnSiteUrl(): string {
  const explicit = process.env.PORTUGAL_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const publicSite = (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
  try {
    const url = new URL(publicSite)
    // Stripe is a Portugal-only checkout. Returning via the geo-routed apex
    // could switch a PT order to AO when the buyer happens to be in Angola,
    // so production apex URLs are pinned to the PT market host. Local and
    // preview hosts remain unchanged for development.
    if (url.hostname === 'usemewithstyle.shop' || url.hostname === 'www.usemewithstyle.shop') {
      url.hostname = 'pt.usemewithstyle.shop'
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return publicSite
  }
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripeClient()
  if (!stripe) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)')

  const currency = input.currency.toLowerCase()

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.items.map((item) => ({
    quantity: item.qty,
    price_data: {
      currency,
      unit_amount: Math.round(item.unitPrice * 100),
      product_data: {
        name: `${item.productName}${item.productType === 'bundle' ? ' (Product kit)' : [item.optionValue || item.size, item.color].filter(Boolean).length ? ` (${[item.optionValue || item.size, item.color].filter(Boolean).join(', ')})` : ''}`,
      },
    },
  }))

  if (input.shippingCost > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: Math.round(input.shippingCost * 100),
        product_data: { name: 'Shipping' },
      },
    })
  }

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined
  if (input.discountAmount && input.discountAmount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: Math.round(input.discountAmount * 100),
      currency,
      duration: 'once',
      name: input.discountLabel || 'Discount',
    })
    discounts = [{ coupon: coupon.id }]
  }

  const base = stripeReturnSiteUrl()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: input.customerEmail,
    line_items: lineItems,
    ...(discounts ? { discounts } : {}),
    success_url: `${base}/encomenda-confirmada/${input.orderNumber}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout?stripe=cancelled`,
    metadata: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
    },
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return { url: session.url, sessionId: session.id }
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripeClient()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) throw new Error('Stripe webhook is not configured')
  return stripe.webhooks.constructEvent(rawBody, signature, secret)
}

export async function retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripeClient()
  if (!stripe) return null
  return stripe.checkout.sessions.retrieve(sessionId)
}

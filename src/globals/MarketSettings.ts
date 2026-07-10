import type { GlobalConfig } from 'payload'

// One editable place for the market/payment/delivery configuration required
// by JOS-20's acceptance criteria. Deliberately data-driven (not hard-coded
// in the frontend).
//
// 2026-07-10 decision: Angola payment methods are Multicaixa Express (via
// AppyPay), Stripe, and PayPal; delivery is local courier only. Real AppyPay
// API integration is still pending (JOS-57 -- credentials/API docs not in
// hand yet), so `angolaPaymentLive` stays OFF until then and Multicaixa
// Express orders fall back to the manual instructions/Payment Review flow
// below, same pattern Stripe/PayPal already had before they went live.
// Stripe and PayPal for Angola settle in EUR (neither supports AOA, and
// Stripe has no Angola merchant accounts) -- the storefront still displays
// Kz to the shopper; see Checkout.tsx's EUR-settlement branch.
export const MarketSettings: GlobalConfig = {
  slug: 'market-settings',
  admin: {
    group: 'Settings',
  },
  fields: [
    {
      name: 'angolaPaymentLive',
      type: 'checkbox',
      defaultValue: false,
      label: 'Angola: AppyPay (Multicaixa Express) integration is live',
      admin: {
        description:
          'Leave OFF until JOS-57 closes. While off, Multicaixa Express orders show the manual instructions below and land in Payment Review for manual confirmation -- Stripe/PayPal for Angola are unaffected (they settle in EUR and are already live).',
      },
    },
    {
      name: 'angolaBankTransferInstructions',
      type: 'textarea',
      label: 'Angola: manual Multicaixa Express instructions shown at checkout',
      admin: {
        description: 'Shown at checkout while angolaPaymentLive is off (e.g. "Payment instructions are sent by WhatsApp once the order is confirmed").',
      },
    },
    {
      name: 'angolaPaymentMethods',
      type: 'select',
      hasMany: true,
      defaultValue: ['multicaixa_express', 'stripe', 'paypal'],
      options: ['multicaixa_express', 'stripe', 'paypal'],
    },
    {
      name: 'angolaDeliveryMethods',
      type: 'select',
      hasMany: true,
      defaultValue: ['courier_ao'],
      options: ['courier_ao'],
    },
    {
      name: 'portugalPaymentMethods',
      type: 'select',
      hasMany: true,
      defaultValue: ['paypal', 'stripe', 'mbway'],
      options: ['paypal', 'stripe', 'mbway'],
    },
    {
      name: 'portugalDeliveryMethods',
      type: 'select',
      hasMany: true,
      defaultValue: ['ctt', 'courier_pt'],
      options: ['ctt', 'courier_pt'],
    },
    {
      name: 'returnsPolicyText',
      type: 'textarea',
      label: 'Returns policy shown at checkout / order confirmation',
      admin: {
        description:
          'Blueprint Technical Appendix flags this as needed before checkout ships and still open as of 2026-07-07. Fill in before launch.',
      },
    },
  ],
}

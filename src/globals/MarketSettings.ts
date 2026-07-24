import type { GlobalConfig } from 'payload'

// One editable place for the market/payment/delivery configuration required
// by JOS-20's acceptance criteria. Deliberately data-driven (not hard-coded
// in the frontend).
//
// 2026-07-10 decision: Angola payment methods are Multicaixa Express (via
// AppyPay), Stripe, and PayPal; delivery is local courier only.
// `angolaPaymentLive` remains the explicit operational switch: AppyPay is
// configured in code and the environment, but the administrator controls
// when buyers see the live widget.
// Stripe and PayPal for Angola settle in EUR (neither supports AOA, and
// Stripe has no Angola merchant accounts) -- the storefront still displays
// Kz to the shopper; see Checkout.tsx's EUR-settlement branch.
export const MarketSettings: GlobalConfig = {
  slug: 'market-settings',
  access: {
    // The storefront needs this configuration to choose market-specific
    // payment and delivery methods. Updates retain Payload's authenticated
    // default because no update access override is provided.
    read: () => true,
  },
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
          'Turn ON only after the AppyPay application and webhook are operational. Stripe/PayPal for Angola are unaffected because they use the separate EUR settlement path.',
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
      name: 'angolaReturnsPolicyTextPT',
      type: 'textarea',
      label: 'Angola: returns & exchanges policy — Portuguese (shown on Help page / checkout)',
      admin: {
        description:
          'Client-provided legal copy (JOS-64, added 2026-07-23). Angola’s policy differs materially from Portugal’s (48h exchange window, no refunds) so it is a separate field rather than a shared translation.',
      },
    },
    {
      name: 'angolaReturnsPolicyTextEN',
      type: 'textarea',
      label: 'Angola: returns & exchanges policy — English (shown on Help page / checkout)',
      admin: {
        description: 'English translation of the field above (JOS-64, added 2026-07-24), so the policy is bilingual like the rest of the storefront.',
      },
    },
    {
      name: 'portugalReturnsPolicyTextPT',
      type: 'textarea',
      label: 'Portugal/EU: returns & exchanges policy — Portuguese (shown on Help page / checkout)',
      admin: {
        description: 'Client-provided legal copy (JOS-64, added 2026-07-23). 14-day EU distance-selling withdrawal window.',
      },
    },
    {
      name: 'portugalReturnsPolicyTextEN',
      type: 'textarea',
      label: 'Portugal/EU: returns & exchanges policy — English (shown on Help page / checkout)',
      admin: {
        description: 'English translation of the field above (JOS-64, added 2026-07-24), so the policy is bilingual like the rest of the storefront.',
      },
    },
  ],
}

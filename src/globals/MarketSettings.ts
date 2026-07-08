import type { GlobalConfig } from 'payload'

// One editable place for the market/payment/delivery configuration required
// by JOS-20's acceptance criteria. Deliberately data-driven (not hard-coded
// in the frontend) because the Angola payment path is still unconfirmed
// (JOS-57): when SWEG/AppyPay is resolved, flip `angolaPaymentLive` here
// instead of shipping a code change.
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
      label: 'Angola: SWEG/AppyPay integration is live',
      admin: {
        description:
          'Leave OFF until JOS-57 closes. While off, the storefront only offers manual bank transfer for Angola and every AO order lands in Payment Review for manual confirmation.',
      },
    },
    {
      name: 'angolaBankTransferInstructions',
      type: 'textarea',
      label: 'Angola bank transfer instructions shown at checkout',
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

import type { GlobalConfig } from 'payload'

// One editable place for the market/payment/delivery configuration required
// by JOS-20's acceptance criteria. Deliberately data-driven (not hard-coded
// in the frontend).
//
// Angola payment is Multicaixa Express via AppyPay; delivery is local courier.
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
    // Split into PT/EN (2026-07-26 bilingual audit): this used to be a single
    // field whose English fallback in the storefront (Checkout.tsx's
    // DEFAULT_MARKET_SETTINGS) was hardcoded English-only text, so English-
    // toggle Angola shoppers -- Angola being the default/primary market --
    // saw English bank-transfer instructions regardless of admin content.
    // Same bilingual PT/EN pattern as the returns-policy/shipping fields
    // below, rather than a single shared field.
    {
      name: 'angolaBankTransferInstructionsPT',
      type: 'textarea',
      label: 'Angola: manual Multicaixa Express instructions shown at checkout — Portuguese',
      admin: {
        description: 'Shown at checkout while angolaPaymentLive is off (e.g. "As instruções de pagamento são enviadas por WhatsApp assim que a encomenda for confirmada").',
      },
    },
    {
      name: 'angolaBankTransferInstructionsEN',
      type: 'textarea',
      label: 'Angola: manual Multicaixa Express instructions shown at checkout — English',
      admin: {
        description: 'English translation of the field above (e.g. "Payment instructions are sent by WhatsApp once the order is confirmed").',
      },
    },
    {
      name: 'angolaPaymentMethods',
      type: 'select',
      hasMany: true,
      defaultValue: ['multicaixa_express'],
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
      name: 'angolaMunicipalityPrices',
      type: 'json',
      required: true,
      defaultValue: {
        Luanda: 3000, Cacuaco: 5000, Cazenga: 3500, Viana: 6000, Belas: 6500, Talatona: 4000,
        Mussulo: 8000, Sambizanga: 3000, Rangel: 3000, Maianga: 2500, Samba: 3500, Camama: 4500,
        Mulenvos: 5500, Kilamba: 5000, 'Hoji Ya Henda': 3500, Ingombota: 2500,
      },
      label: 'Angola: Luanda municipality delivery prices (Kz)',
      admin: { description: 'Placeholder local-courier prices. Edit the Kz value for any municipality; keep all 16 keys.' },
    },
    {
      name: 'angolaFreeShippingThreshold',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 80000,
      label: 'Angola: free-delivery threshold (Kz)',
      admin: { description: 'Applied to the merchandise total after discounts.' },
    },
    {
      name: 'portugalPaymentsEnabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Portugal: enable checkout payments',
      admin: {
        description:
          'Keep OFF until the Portuguese legal entity, invoicing process, and payment-provider accounts are approved. Turning this on re-enables PT checkout.',
      },
    },
    // Manual WhatsApp coordination while portugalPaymentsEnabled is off
    // (2026-08-04, Jay-P request) -- mirrors Angola's bank-transfer
    // fallback above: instead of hard-blocking PT checkout with an error,
    // the storefront now offers this one manual method and still creates a
    // real (pending) order for follow-up. Same bilingual PT/EN pattern as
    // the Angola instructions.
    {
      name: 'portugalManualCheckoutInstructionsPT',
      type: 'textarea',
      label: 'Portugal: manual WhatsApp coordination instructions shown at checkout — Portuguese',
      admin: {
        description: 'Shown at checkout while portugalPaymentsEnabled is off (e.g. "Vamos entrar em contacto por WhatsApp para combinar o pagamento.").',
      },
    },
    {
      name: 'portugalManualCheckoutInstructionsEN',
      type: 'textarea',
      label: 'Portugal: manual WhatsApp coordination instructions shown at checkout — English',
      admin: {
        description: 'English translation of the field above (e.g. "We\'ll reach out on WhatsApp to arrange payment.").',
      },
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
      name: 'portugalStandardShippingPrice',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 4.9,
      label: 'Portugal: CTT Standard price (EUR)',
      admin: { description: 'Customer charge for the untracked option below the free-delivery threshold.' },
    },
    {
      name: 'portugalTrackedShippingPrice',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 6.9,
      label: 'Portugal: CTT Registered price (EUR)',
      admin: { description: 'Customer charge for tracked CTT delivery below the free-delivery threshold.' },
    },
    {
      name: 'portugalFreeShippingThreshold',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 75,
      label: 'Portugal: free-delivery threshold (EUR)',
      admin: { description: 'Applied to the merchandise total after coupons and other discounts.' },
    },
    {
      name: 'portugalStandardWeightLimitGrams',
      type: 'number', required: true, min: 1, defaultValue: 2000,
      label: 'Portugal: standard parcel weight limit (grams)',
    },
    {
      name: 'portugalHeavyMainlandShippingPrice',
      type: 'number', required: true, min: 0, defaultValue: 9.9,
      label: 'Portugal: tracked delivery over weight limit - mainland (EUR)',
    },
    {
      name: 'portugalHeavyIslandsShippingPrice',
      type: 'number', required: true, min: 0, defaultValue: 14.9,
      label: 'Portugal: tracked delivery over weight limit - Madeira/Azores (EUR)',
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
    // Business hours + shipping info (JOS-64 follow-up, added 2026-07-24).
    // Client-provided copy, same bilingual PT/EN pattern as the returns
    // policy above. Business hours are shared across both markets (one
    // WhatsApp support line); shipping is per-market like delivery methods,
    // plus a shared international-shipping note.
    {
      name: 'businessHoursTextPT',
      type: 'textarea',
      label: 'Business hours — Portuguese (shown on Help page)',
      admin: { description: 'Client-provided copy, added 2026-07-24.' },
    },
    {
      name: 'businessHoursTextEN',
      type: 'textarea',
      label: 'Business hours — English (shown on Help page)',
      admin: { description: 'English translation of the field above, added 2026-07-24.' },
    },
    {
      name: 'angolaShippingTextPT',
      type: 'textarea',
      label: 'Angola: shipping & delivery info — Portuguese (shown on Help page)',
      admin: { description: 'Client-provided copy, added 2026-07-24.' },
    },
    {
      name: 'angolaShippingTextEN',
      type: 'textarea',
      label: 'Angola: shipping & delivery info — English (shown on Help page)',
      admin: { description: 'English translation of the field above, added 2026-07-24.' },
    },
    {
      name: 'portugalShippingTextPT',
      type: 'textarea',
      label: 'Portugal: shipping & delivery info — Portuguese (shown on Help page)',
      admin: { description: 'Client-provided copy, added 2026-07-24.' },
    },
    {
      name: 'portugalShippingTextEN',
      type: 'textarea',
      label: 'Portugal: shipping & delivery info — English (shown on Help page)',
      admin: { description: 'English translation of the field above, added 2026-07-24.' },
    },
    {
      name: 'internationalShippingTextPT',
      type: 'textarea',
      label: 'International shipping info — Portuguese (shown on Help page, both markets)',
      admin: { description: 'Client-provided copy, added 2026-07-24.' },
    },
    {
      name: 'internationalShippingTextEN',
      type: 'textarea',
      label: 'International shipping info — English (shown on Help page, both markets)',
      admin: { description: 'English translation of the field above, added 2026-07-24.' },
    },
  ],
}

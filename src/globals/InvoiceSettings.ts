import type { GlobalConfig } from 'payload'

// VAT rates (2026-08-04, Jay-P decision): Angola is a flat 14% everywhere.
// Portugal is NOT flat -- mainland, Madeira, and the Azores each have their
// own legal rate (23% / 22% / 16%). `vatRatePT` (a single PT-wide rate) has
// been replaced with three region-specific fields; which one applies to a
// given order is decided by `order.deliveryRegion` (already computed
// server-side from the postal code at order-create time, see
// authoritativeOrder.ts) -- see calculateIncludedVatInvoice in
// lib/internalInvoice.ts for where that selection actually happens.
//
// Field names deliberately avoid stacking the two-letter market code
// directly against another capitalized word (e.g. NOT `vatRatePTMainland`)
// -- Payload's Postgres column-naming splits consecutive capitals letter by
// letter (confirmed via `vatRatePT` -> `vat_rate_p_t` in the original
// single-rate migration), which would have made `vatRatePTMainland`'s
// column name a genuinely ambiguous guess. `vatRatePortugalMainland` etc.
// sidesteps that entirely: unambiguous `vat_rate_portugal_mainland`.
const angolaVatFields = [
  {
    name: 'vatRateAO',
    type: 'number' as const,
    min: 0,
    max: 100,
    defaultValue: 14,
    label: 'Angola: VAT rate included in storefront prices (%)',
    admin: {
      description:
        'The paid total never changes. This rate extracts the VAT portion already included in the price. Angola VAT is a flat 14% nationwide.',
    },
  },
]

const portugalVatFields = [
  {
    name: 'vatRatePortugalMainland',
    type: 'number' as const,
    min: 0,
    max: 100,
    defaultValue: 23,
    label: 'Portugal: VAT rate — mainland (%)',
    admin: { description: 'Applied to PT orders whose postal code classifies as mainland.' },
  },
  {
    name: 'vatRatePortugalMadeira',
    type: 'number' as const,
    min: 0,
    max: 100,
    defaultValue: 22,
    label: 'Portugal: VAT rate — Madeira (%)',
    admin: { description: 'Applied to PT orders whose postal code classifies as Madeira.' },
  },
  {
    name: 'vatRatePortugalAzores',
    type: 'number' as const,
    min: 0,
    max: 100,
    defaultValue: 16,
    label: 'Portugal: VAT rate — Azores (%)',
    admin: { description: 'Applied to PT orders whose postal code classifies as Azores.' },
  },
]

const marketFields = (market: 'AO' | 'PT', vatFields: typeof angolaVatFields | typeof portugalVatFields) => {
  const isAngola = market === 'AO'
  const label = isAngola ? 'Angola' : 'Portugal'
  const suffix = market

  return [
    {
      name: `invoicingEnabled${suffix}`,
      type: 'checkbox' as const,
      defaultValue: true,
      label: `${label}: generate internal invoices automatically`,
    },
    {
      name: `issuerName${suffix}`,
      type: 'text' as const,
      defaultValue: 'Use Me With Style',
      label: `${label}: issuer name`,
    },
    {
      name: `issuerTaxId${suffix}`,
      type: 'text' as const,
      label: `${label}: issuer tax ID`,
    },
    {
      name: `issuerAddress${suffix}`,
      type: 'textarea' as const,
      label: `${label}: issuer address`,
    },
    {
      type: 'collapsible' as const,
      label: `${label}: bank and payment details`,
      admin: { description: 'Optional details printed on new invoices. Existing invoice snapshots never change.' },
      fields: [
        { name: `bankName${suffix}`, type: 'text' as const, label: `${label}: bank name` },
        { name: `accountHolder${suffix}`, type: 'text' as const, label: `${label}: account holder` },
        { name: `bankAccount${suffix}`, type: 'text' as const, label: `${label}: IBAN / account number` },
        { name: `swiftBic${suffix}`, type: 'text' as const, label: `${label}: SWIFT / BIC` },
        {
          name: `paymentInstructions${suffix}`,
          type: 'textarea' as const,
          label: `${label}: additional payment instructions`,
        },
      ],
    },
    ...vatFields,
    {
      name: `taxNote${suffix}`,
      type: 'text' as const,
      label: `${label}: VAT / exemption note`,
      admin: { description: 'Optional note supplied by the accountant.' },
    },
    {
      name: `invoicePrefix${suffix}`,
      type: 'text' as const,
      defaultValue: `UMWS-${market}`,
      label: `${label}: internal invoice prefix`,
    },
    {
      name: `invoiceFooter${suffix}`,
      type: 'textarea' as const,
      label: `${label}: PDF footer`,
    },
  ]
}

export const InvoiceSettings: GlobalConfig = {
  slug: 'invoice-settings',
  label: 'Internal Invoicing',
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: 'Settings',
    description:
      'Phase 1 commercial documents for accounting support. These settings are snapshotted onto each invoice.',
  },
  fields: [
    // Split PT/EN (2026-07-26 bilingual audit): the invoice PDF renderer
    // (lib/internalInvoice.ts) previously showed this disclaimer -- and
    // every other label on the document -- in Portuguese regardless of the
    // order's `lang`, even though order-confirmation emails already branch
    // correctly by language. `phaseOneDisclaimerPT` keeps the original
    // field's data (same name minus the suffix would've required a data
    // migration; keeping both explicitly named avoids ambiguity).
    {
      name: 'phaseOneDisclaimerPT',
      type: 'textarea',
      required: true,
      defaultValue:
        'Documento comercial interno, não certificado fiscalmente. Deve ser validado e tratado pelo contabilista da entidade emitente.',
      label: 'Required non-fiscal disclaimer — Portuguese',
    },
    {
      name: 'phaseOneDisclaimerEN',
      type: 'textarea',
      required: true,
      defaultValue:
        'Internal commercial document, not fiscally certified. Must be validated and processed by the issuing entity’s accountant.',
      label: 'Required non-fiscal disclaimer — English',
    },
    {
      type: 'collapsible',
      label: 'Angola',
      fields: marketFields('AO', angolaVatFields),
    },
    {
      type: 'collapsible',
      label: 'Portugal',
      fields: marketFields('PT', portugalVatFields),
    },
  ],
}

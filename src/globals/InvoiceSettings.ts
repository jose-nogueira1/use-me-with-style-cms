import type { GlobalConfig } from 'payload'

const marketFields = (market: 'AO' | 'PT') => {
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
      name: `vatRate${suffix}`,
      type: 'number' as const,
      min: 0,
      max: 100,
      defaultValue: 0,
      label: `${label}: VAT rate included in storefront prices (%)`,
      admin: {
        description:
          'The paid total never changes. This rate extracts the VAT portion already included in the price.',
      },
    },
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
    {
      name: 'phaseOneDisclaimer',
      type: 'textarea',
      required: true,
      defaultValue:
        'Documento comercial interno, não certificado fiscalmente. Deve ser validado e tratado pelo contabilista da entidade emitente.',
      label: 'Required non-fiscal disclaimer',
    },
    {
      type: 'collapsible',
      label: 'Angola',
      fields: marketFields('AO'),
    },
    {
      type: 'collapsible',
      label: 'Portugal',
      fields: marketFields('PT'),
    },
  ],
}

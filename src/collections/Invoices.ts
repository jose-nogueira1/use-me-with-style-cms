import type { CollectionConfig } from 'payload'

// Immutable phase-one commercial invoice snapshots. The generated PDF and
// every value used to produce it live together here so later settings edits
// never rewrite the accounting record that was handed to the customer.
export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Internal Invoice', plural: 'Internal Invoices' },
  admin: {
    useAsTitle: 'invoiceNumber',
    defaultColumns: ['invoiceNumber', 'market', 'customerName', 'status', 'total', 'issuedAt'],
    group: 'Sales',
    description: 'Commercial documents for accounting support. Not certified fiscal invoices.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    staticDir: 'invoices',
    mimeTypes: ['application/pdf'],
  },
  fields: [
    { name: 'relatedOrder', type: 'relationship', relationTo: 'orders', required: true, unique: true },
    { name: 'invoiceNumber', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'sequence', type: 'number', required: true, min: 1, admin: { readOnly: true } },
    { name: 'year', type: 'number', required: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'issued',
      options: [
        { label: 'Issued internally', value: 'issued' },
        { label: 'Generation failed', value: 'failed' },
      ],
    },
    { name: 'market', type: 'select', required: true, options: ['AO', 'PT'] },
    { name: 'issuedAt', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'orderNumber', type: 'text', required: true },
    { name: 'issuerName', type: 'text', required: true },
    { name: 'issuerTaxId', type: 'text' },
    { name: 'issuerAddress', type: 'textarea' },
    { name: 'bankName', type: 'text' },
    { name: 'accountHolder', type: 'text' },
    { name: 'bankAccount', type: 'text' },
    { name: 'swiftBic', type: 'text' },
    { name: 'paymentInstructions', type: 'textarea' },
    { name: 'customerName', type: 'text', required: true },
    { name: 'customerEmail', type: 'email', required: true },
    { name: 'customerPhone', type: 'text' },
    { name: 'customerTaxId', type: 'text' },
    { name: 'customerAddress', type: 'textarea' },
    {
      name: 'lines',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'description', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true },
        { name: 'unitPrice', type: 'number', required: true },
        { name: 'netAmount', type: 'number', required: true },
        { name: 'taxAmount', type: 'number', required: true },
        { name: 'grossAmount', type: 'number', required: true },
      ],
    },
    { name: 'currency', type: 'select', required: true, options: ['Kz', 'EUR'] },
    { name: 'vatRate', type: 'number', required: true, min: 0 },
    // 2026-08-04, regional VAT: which of the three PT rates (or "flat" for
    // AO) vatRate above actually came from -- an audit-trail snapshot, not
    // used in any calculation. Optional: invoices issued before this
    // change have no region recorded.
    {
      name: 'vatRegion',
      type: 'select',
      options: ['mainland', 'madeira', 'azores', 'flat'],
      admin: { readOnly: true, description: 'Which VAT rate applied: PT region, or "flat" for Angola.' },
    },
    { name: 'taxNote', type: 'text' },
    { name: 'subtotal', type: 'number', required: true },
    { name: 'shipping', type: 'number', required: true },
    { name: 'netTotal', type: 'number', required: true },
    { name: 'taxTotal', type: 'number', required: true },
    { name: 'total', type: 'number', required: true },
    { name: 'paymentMethod', type: 'text' },
    { name: 'paymentReference', type: 'text' },
    { name: 'disclaimer', type: 'textarea', required: true },
    { name: 'footer', type: 'textarea' },
    { name: 'pdfFilename', type: 'text', admin: { readOnly: true } },
    { name: 'pdfData', type: 'json', admin: { hidden: true } },
    {
      name: 'errorMessage',
      type: 'textarea',
      admin: { readOnly: true },
    },
  ],
}

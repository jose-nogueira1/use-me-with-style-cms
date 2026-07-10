import type { CollectionConfig } from 'payload'

// PT-market invoices issued through Moloni ON (see lib/moloni.ts). One record
// per order, written automatically by hooks/notifyOrderEvent when an order's
// paymentStatus flips to 'paid' -- same trigger as the order-confirmation
// email/WhatsApp automation already wired up there. This collection is
// upload-enabled so the invoice PDF itself is stored and downloadable
// directly from the admin dashboard, independent of whether the email send
// succeeded. `status: failed` rows (with `errorMessage`) surface Moloni
// errors -- e.g. misconfiguration, AT rejection -- so an issue is visible in
// admin instead of only in server logs.
export const Invoices: CollectionConfig = {
  slug: 'invoices',
  admin: {
    useAsTitle: 'moloniNumber',
    defaultColumns: ['moloniNumber', 'relatedOrder', 'status', 'total', 'createdAt'],
    group: 'Sales',
  },
  upload: {
    staticDir: 'invoices',
    mimeTypes: ['application/pdf'],
  },
  fields: [
    { name: 'relatedOrder', type: 'relationship', relationTo: 'orders', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Issued', value: 'issued' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'moloniDocumentId',
      type: 'number',
      admin: { readOnly: true, description: 'Moloni ON internal document ID.' },
    },
    {
      name: 'moloniNumber',
      type: 'text',
      admin: { readOnly: true, description: 'Sequential invoice number assigned by Moloni ON.' },
    },
    { name: 'total', type: 'number' },
    { name: 'currency', type: 'text' },
    { name: 'customerName', type: 'text' },
    { name: 'customerEmail', type: 'email' },
    {
      name: 'errorMessage',
      type: 'textarea',
      admin: { readOnly: true, description: 'Populated when status is Failed, for admin troubleshooting.' },
    },
  ],
}

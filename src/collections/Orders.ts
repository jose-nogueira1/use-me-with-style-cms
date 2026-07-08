import type { CollectionConfig } from 'payload'

import { notifyOrderEvent } from '../hooks/notifyOrderEvent'

// Order statuses locked in JOS-52 (2026-06-02 decision log, confirmed in
// Linear): New, Payment Review, Processing, Shipped, Delivered, Cancelled.
export const ORDER_STATUSES = [
  { label: 'New', value: 'new' },
  { label: 'Payment Review', value: 'payment_review' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
] as const

// Angola's real payment path (SWEG/AppyPay, JOS-57) is still unconfirmed.
// `bank_transfer_ao` is the documented fallback (manual bank transfer +
// manual admin Payment Review) and is the only AO method actually wired up
// in the storefront today. `sweg_appypay` exists here so the schema doesn't
// need a migration the day JOS-57 closes, but it is NOT implemented in the
// checkout flow yet -- see MarketSettings global to flip it on later.
export const PAYMENT_METHODS = [
  { label: 'PayPal (PT)', value: 'paypal' },
  { label: 'Stripe (PT)', value: 'stripe' },
  { label: 'MB WAY (PT)', value: 'mbway' },
  { label: 'Bank transfer -- manual review (AO)', value: 'bank_transfer_ao' },
  { label: 'SWEG / AppyPay (AO) -- not yet integrated', value: 'sweg_appypay' },
] as const

export const DELIVERY_METHODS = [
  { label: 'CTT (PT)', value: 'ctt' },
  { label: 'Courier (PT)', value: 'courier_pt' },
  { label: 'Manual coordination (AO)', value: 'manual_ao' },
] as const

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'market', 'customerName', 'status', 'total', 'createdAt'],
    group: 'Sales',
  },
  access: {
    // The storefront must be able to create an order at checkout without an
    // authenticated session. Reading/updating/deleting stays admin-only
    // (default Payload behaviour once `auth`-gated collections exist).
    create: () => true,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && !data.orderNumber) {
          const prefix = data.market === 'AO' ? 'AO' : 'PT'
          data.orderNumber = `${prefix}-${Date.now().toString().slice(-6)}`
        }
        if (operation === 'create' && !data.status) {
          data.status = 'new'
        }
        return data
      },
    ],
    afterChange: [notifyOrderEvent],
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'market',
      type: 'select',
      required: true,
      options: [
        { label: 'Angola', value: 'AO' },
        { label: 'Portugal', value: 'PT' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [...ORDER_STATUSES],
    },
    { name: 'customerName', type: 'text', required: true },
    { name: 'customerPhone', type: 'text', required: true, label: 'Phone / WhatsApp' },
    { name: 'customerEmail', type: 'email', required: true },
    { name: 'address', type: 'text', required: true },
    { name: 'city', type: 'text', required: true },
    { name: 'country', type: 'text', required: true },
    { name: 'notes', type: 'textarea' },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'productName', type: 'text', required: true },
        { name: 'size', type: 'text', required: true },
        { name: 'color', type: 'text' },
        { name: 'qty', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', type: 'number', required: true, min: 0 },
      ],
    },
    { name: 'currency', type: 'select', required: true, options: ['Kz', 'EUR'] },
    { name: 'subtotal', type: 'number', required: true, min: 0 },
    { name: 'shippingCost', type: 'number', required: true, min: 0, defaultValue: 0 },
    { name: 'total', type: 'number', required: true, min: 0 },
    {
      name: 'paymentMethod',
      type: 'select',
      required: true,
      options: [...PAYMENT_METHODS],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Awaiting manual review', value: 'awaiting_manual_review' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'deliveryMethod',
      type: 'select',
      required: true,
      options: [...DELIVERY_METHODS],
    },
  ],
}

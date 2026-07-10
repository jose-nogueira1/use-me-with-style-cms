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

// 2026-07-10 decision: Angola's payment methods are Multicaixa Express (via
// AppyPay), Stripe, and PayPal -- Stripe/PayPal for Angola settle in EUR
// (neither gateway supports AOA). `multicaixa_express` is wired into
// checkout the same way `mbway` already was: a plain order create that lands
// in Payment Review until real AppyPay API integration ships (JOS-57 --
// credentials/API docs still pending). `bank_transfer_ao` / `sweg_appypay`
// are kept only so any existing order rows using those values stay valid;
// they're no longer offered at checkout.
export const PAYMENT_METHODS = [
  { label: 'PayPal', value: 'paypal' },
  { label: 'Stripe', value: 'stripe' },
  { label: 'MB WAY (PT)', value: 'mbway' },
  { label: 'Multicaixa Express -- via AppyPay (AO)', value: 'multicaixa_express' },
  { label: 'Bank transfer -- manual review (AO, legacy)', value: 'bank_transfer_ao' },
  { label: 'SWEG / AppyPay (AO, legacy) -- not implemented', value: 'sweg_appypay' },
] as const

// `courier_ao` is Angola's only delivery method (local courier, per the
// 2026-07-10 decision). `manual_ao` is kept only for existing order rows.
export const DELIVERY_METHODS = [
  { label: 'CTT (PT)', value: 'ctt' },
  { label: 'Courier (PT)', value: 'courier_pt' },
  { label: 'Local courier (AO)', value: 'courier_ao' },
  { label: 'Manual coordination (AO, legacy)', value: 'manual_ao' },
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
    {
      name: 'lang',
      type: 'select',
      defaultValue: 'pt',
      options: [
        { label: 'Português', value: 'pt' },
        { label: 'English', value: 'en' },
      ],
      admin: {
        description:
          'Storefront language the customer had selected at checkout -- determines the language of the order-confirmation email.',
      },
    },
    { name: 'address', type: 'text', required: true },
    {
      name: 'addressLine2',
      type: 'text',
      label: 'Floor / Door (Andar / Porta)',
      admin: { description: 'Optional PT address line -- not collected for Angola orders.' },
    },
    {
      name: 'postalCode',
      type: 'text',
      label: 'Postal Code (PT)',
      admin: { description: 'CTT format 0000-000 -- validated client-side on the PT storefront, not collected for Angola.' },
    },
    { name: 'city', type: 'text', required: true },
    { name: 'country', type: 'text', required: true },
    {
      name: 'taxId',
      type: 'text',
      label: 'NIF / Tax ID (PT)',
      admin: {
        description:
          'Portuguese tax number, optional -- when present, passed through to Moloni so it appears on the issued invoice (see lib/moloni.ts).',
      },
    },
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
    {
      name: 'paymentReference',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Stripe Checkout Session ID or PayPal Order ID for this payment (JOS-61) -- set automatically, for admin troubleshooting only.',
      },
    },
  ],
}

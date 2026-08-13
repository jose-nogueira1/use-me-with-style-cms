import { APIError, type CollectionConfig } from 'payload'

import { notifyOrderEvent } from '../hooks/notifyOrderEvent'
import { applyAuthoritativeOrderValues } from '../lib/authoritativeOrder'
import { manageInventoryReservation } from '../lib/inventoryReservation'
import { upsertCustomerAfterOrderCreate } from '../lib/customerUpsert'

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
// 2026-08-04 addition: 'manual_whatsapp' is Portugal's checkout fallback
// while portugalPaymentsEnabled is off -- same idea as Angola's manual
// bank-transfer path, coordinated by WhatsApp instead of a real gateway.
// See authoritativeOrder.ts for the server-side gate that only allows it
// while PT payments are deferred (and blocks it once they go live).
export const PAYMENT_METHODS = [
  { label: 'PayPal', value: 'paypal' },
  { label: 'Stripe', value: 'stripe' },
  { label: 'MB WAY (PT)', value: 'mbway' },
  { label: 'Multicaixa Express -- via AppyPay (AO)', value: 'multicaixa_express' },
  { label: 'Manual WhatsApp coordination (AO/PT while payments are deferred)', value: 'manual_whatsapp' },
  { label: 'Bank transfer -- manual review (AO, legacy)', value: 'bank_transfer_ao' },
  { label: 'SWEG / AppyPay (AO, legacy) -- not implemented', value: 'sweg_appypay' },
] as const

// `courier_ao` is Angola's only delivery method (local courier, per the
// 2026-07-10 decision). `manual_ao` is kept only for existing order rows.
export const DELIVERY_METHODS = [
  { label: 'CTT Standard - untracked (PT)', value: 'ctt' },
  { label: 'CTT Registered - tracked (PT)', value: 'courier_pt' },
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
    beforeValidate: [applyAuthoritativeOrderValues],
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        if (operation === 'update' && data.status === 'cancelled' && originalDoc?.status !== 'new') {
          throw new APIError('Only a new order can be cancelled.', 400, null, true)
        }
        return data
      },
      manageInventoryReservation,
      ({ context, data, operation, originalDoc, req }) => {
        if (operation === 'create' && !data.orderNumber) {
          const prefix = data.market === 'AO' ? 'AO' : 'PT'
          data.orderNumber = `${prefix}-${Date.now().toString().slice(-6)}`
        }
        if (operation === 'create' && !data.status) {
          data.status = data.paymentMethod === 'manual_whatsapp' ? 'payment_review' : 'new'
        }
        if (operation === 'create' && data.paymentMethod === 'manual_whatsapp' && !data.paymentStatus) {
          data.paymentStatus = 'awaiting_manual_review'
        }
        // Status-change audit trail (2026-08-01) -- appended here so it's
        // part of the same write as the status change it's describing, not
        // a separate afterChange call that could race or fail on its own.
        // Covers both create (the order's very first status, always
        // 'new' -- see above) and any update that actually changes status;
        // a same-status re-save (e.g. editing customer notes) adds nothing.
        // `req.user` is only set for authenticated admin requests -- a
        // storefront checkout create has none, so 'system' distinguishes
        // an automated transition from an admin's own action.
        const statusChanged = operation === 'create' || (typeof data.status === 'string' && data.status !== originalDoc?.status)
        if (statusChanged) {
          const nextStatus = typeof data.status === 'string' ? data.status : originalDoc?.status
          data.statusHistory = [
            ...(Array.isArray(originalDoc?.statusHistory) ? originalDoc.statusHistory : []),
            { status: nextStatus, changedAt: new Date().toISOString(), changedBy: req.user?.email ?? 'system' },
          ]
        }
        // 'cancelled' is a terminal state (2026-07-31, found via a screen
        // recording of manual admin QA that walked a shipped order back
        // through the pipeline via the status pills -- nothing previously
        // stopped that from landing on, or leaving, 'cancelled'). The admin
        // UI now confirms before any backward status click, but that's a
        // speed bump, not a guarantee, and this collection is also reachable
        // directly via the API. Reopening a cancelled order specifically is
        // worse than an ordinary backward click: manageInventoryReservation
        // only ever transitions a reservation OUT of 'active' once, to
        // either 'committed' or 'released' -- there is no path back from
        // 'released' to 'committed'/'active'. So a reopened order can end up
        // showing paymentStatus 'paid' and status 'processing' (a normal-
        // looking live order) while its stock was already given back to
        // general inventory and never re-reserved -- a real oversell risk,
        // confirmed by reproducing exactly this in the recording (an
        // AO order sitting at paymentStatus 'paid' / status 'processing'
        // with inventoryReservationStatus stuck at 'released'). Blocking the
        // transition out of 'cancelled' entirely closes that gap; there's no
        // "reopen" flow anywhere else in this codebase to preserve.
        if (
          operation === 'update' &&
          originalDoc?.status === 'cancelled' &&
          data.status &&
          data.status !== 'cancelled' &&
          !context.lateVerifiedPayment
        ) {
          throw new APIError('This order is cancelled and cannot be reopened. Create a new order instead.', 400, null, true)
        }
        return data
      },
    ],
    afterChange: [upsertCustomerAfterOrderCreate, notifyOrderEvent],
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
    // First/last name collected separately at checkout (2026-08-04) --
    // customerName above is still the combined value and remains the field
    // every existing consumer (admin list/search, invoices, emails) reads.
    // These two are optional, additive snapshot fields for future use (e.g.
    // a shipping-label API that wants them split); not required so existing
    // order rows and any older cached storefront bundle both stay valid.
    { name: 'customerFirstName', type: 'text', label: 'First name' },
    { name: 'customerLastName', type: 'text', label: 'Last name' },
    { name: 'customerPhone', type: 'text', required: true, label: 'Telephone' },
    { name: 'customerEmail', type: 'email', required: true },
    {
      name: 'analyticsConsent',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    { name: 'metaFbp', type: 'text', admin: { hidden: true } },
    { name: 'metaFbc', type: 'text', admin: { hidden: true } },
    { name: 'metaEventSourceUrl', type: 'text', admin: { hidden: true } },
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
    { name: 'address', type: 'text', required: true, label: 'Street name' },
    {
      name: 'addressLine2',
      type: 'text',
      required: true,
      label: 'House number / other',
      admin: { description: 'House number, floor/door, or other locator info -- collected for both Angola and Portugal orders since 2026-08-04.' },
    },
    {
      name: 'postalCode',
      type: 'text',
      label: 'Postal Code (PT)',
      admin: { description: 'CTT format 0000-000 -- validated client-side on the PT storefront, not collected for Angola.' },
    },
    {
      name: 'deliveryRegion',
      type: 'select',
      options: [
        { label: 'Portugal mainland', value: 'mainland' },
        { label: 'Madeira / Porto Santo', value: 'madeira' },
        { label: 'Azores', value: 'azores' },
      ],
      admin: {
        readOnly: true,
        description: 'Classified automatically from the Portuguese postal code when the order is created.',
      },
    },
    { name: 'city', type: 'text', required: true },
    { name: 'country', type: 'text', required: true },
    {
      name: 'taxId',
      type: 'text',
      label: 'NIF / Tax ID (PT)',
      admin: {
        description:
          'Customer tax number, optional -- snapshotted onto the internal commercial invoice for accounting review.',
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
        // `variantId` is the stable sellable identity introduced with
        // flexible accessory variants. `size` remains as a human-readable
        // legacy snapshot so old orders and invoice templates stay valid.
        { name: 'variantId', type: 'text', admin: { readOnly: true, hidden: true } },
        { name: 'size', type: 'text' },
        { name: 'optionLabel', type: 'text', admin: { readOnly: true } },
        { name: 'optionValue', type: 'text', admin: { readOnly: true } },
        // Human-readable, localized colour name -- resolved server-side at
        // order creation (see authoritativeOrder.ts), same snapshot pattern
        // as productName. What the admin/invoices show.
        { name: 'color', type: 'text' },
        // Colours became bilingual 2026-07-25: `color` above can no longer
        // double as a stable identity (its text depends on the buyer's
        // storefront language). `colorId` is the colours-collection row id,
        // set alongside `color` at order creation, and is what
        // inventoryReservation.ts matches against product variants --
        // exact and language-independent. Optional/hidden: orders created
        // before this field existed simply don't have it (inventory
        // matching falls back to the legacy name-based path for those).
        { name: 'colorId', type: 'text', admin: { readOnly: true, hidden: true } },
        { name: 'productType', type: 'select', options: ['standard', 'bundle'], defaultValue: 'standard', admin: { readOnly: true } },
        {
          name: 'inventoryComponents',
          type: 'json',
          admin: { hidden: true },
        },
        { name: 'qty', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', type: 'number', required: true, min: 0 },
        { name: 'regularUnitPrice', type: 'number', min: 0, admin: { readOnly: true } },
        { name: 'saleDiscountAmount', type: 'number', min: 0, admin: { readOnly: true } },
        { name: 'saleDiscountPercentage', type: 'number', min: 0, max: 100, admin: { readOnly: true } },
      ],
    },
    { name: 'currency', type: 'select', required: true, options: ['Kz', 'EUR'] },
    // `subtotal` stays the RAW, undiscounted line-item sum (auditability --
    // matches what's shown as "Subtotal" before any discount). The coupon
    // discount is subtracted going into `total` below, not folded into
    // subtotal itself.
    { name: 'subtotal', type: 'number', required: true, min: 0 },
    { name: 'shippingCost', type: 'number', required: true, min: 0, defaultValue: 0 },
    // Coupon codes (2026-07-25, discounts phase 2). Snapshotted as plain
    // values, not a relationship, so the coupon can be edited/deleted later
    // without touching historical orders/invoices -- see Coupons.ts.
    {
      name: 'couponCode',
      type: 'text',
      admin: { readOnly: true, description: 'Snapshot of the coupon code used, if any.' },
    },
    {
      name: 'discountAmount',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true, description: 'Amount deducted by the coupon, in the order currency.' },
    },
    {
      name: 'discountLabel',
      type: 'text',
      admin: { readOnly: true, description: 'Human-readable label shown on the invoice/admin, e.g. "SS26 (10% off)".' },
    },
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
      name: 'inventoryReservationStatus',
      type: 'select',
      defaultValue: 'none',
      options: ['none', 'active', 'committed', 'released'],
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'inventoryReservationExpiresAt',
      type: 'date',
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'inventoryReservationReleasedAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'deliveryMethod',
      type: 'select',
      required: true,
      options: [...DELIVERY_METHODS],
    },
    {
      name: 'cttTrackingCode',
      type: 'text',
      index: true,
      label: 'CTT tracking code',
      hooks: {
        beforeValidate: [({ value }) => typeof value === 'string' ? value.trim().toUpperCase().replace(/\s/g, '') || null : value],
      },
      validate: (value: unknown) => !value || /^[A-Z0-9]{8,40}$/.test(String(value)) || 'Enter a valid CTT tracking code (letters and numbers only).',
      admin: {
        description: 'For CTT Registered orders, enter the code from the CTT receipt or shipping portal. It becomes visible in the customer order lookup.',
      },
    },
    {
      name: 'paymentReference',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Provider transaction ID (Stripe, PayPal or AppyPay) -- set automatically for admin troubleshooting.',
      },
    },
    {
      name: 'appyPayMerchantTransactionId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          'Our <=15 character alphanumeric transaction ID sent to the AppyPay widget and echoed by its webhook.',
      },
    },
    {
      name: 'appyPayTransactionId',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'AppyPay gateway transaction UUID.' },
    },
    {
      name: 'appyPayStatus',
      type: 'select',
      options: ['Requested', 'Pending', 'Success', 'Failed'],
      admin: { readOnly: true },
    },
    { name: 'appyPayPaymentMethod', type: 'text', admin: { readOnly: true } },
    { name: 'appyPayResponseCode', type: 'number', admin: { readOnly: true } },
    { name: 'appyPayResponseMessage', type: 'text', admin: { readOnly: true } },
    { name: 'appyPayReferenceEntity', type: 'text', admin: { readOnly: true } },
    { name: 'appyPayReferenceNumber', type: 'text', admin: { readOnly: true } },
    { name: 'appyPayReferenceDueDate', type: 'date', admin: { readOnly: true } },
    { name: 'appyPayVerifiedAt', type: 'date', admin: { readOnly: true } },
    // Status-change audit trail (2026-08-01 request: accountability once
    // more than one admin touches an order -- "who changed what, when").
    // An array field, same mechanism `items` above already uses (a child
    // table Payload manages itself) -- appended to in the beforeChange hook
    // below rather than a separate collection, so it's part of the same
    // document write the status change itself is, with no risk of a
    // separate afterChange write racing or failing independently.
    {
      name: 'statusHistory',
      type: 'array',
      admin: {
        readOnly: true,
        description: 'Automatic log of every status change -- who changed it and when. Not manually editable.',
      },
      fields: [
        { name: 'status', type: 'text', required: true },
        { name: 'changedAt', type: 'date', required: true },
        { name: 'changedBy', type: 'text' },
      ],
    },
  ],
}

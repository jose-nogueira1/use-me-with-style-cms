import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { couponsEndpoints } from '../endpoints/coupons'

// Discounts phase 2 (2026-07-25, "figure out discounts" -- per-request
// AskUserQuestion-style decision: build phase 1 sale pricing THEN coupon
// codes). Redemption/validation logic lives in lib/couponPricing.ts, shared
// between the public /coupons/validate endpoint (advisory, powers the
// checkout "Apply" button) and authoritativeOrder.ts (the only place a
// coupon actually changes what's charged -- never trust a client-submitted
// discount amount, only the CODE).
//
// The validate endpoint is registered below as a COLLECTION-level endpoint
// (not in payload.config.ts's root `endpoints`) -- see endpoints/coupons.ts
// for why a root-level '/coupons/validate' 404s forever (collides with this
// collection's own slug in Payload's router).
//
// Not relationship-referenced from Orders: an order snapshots the plain
// code string + resolved discountAmount/discountLabel (see Orders.ts), so a
// coupon can be freely edited or deleted later without touching historical
// orders/invoices.
const normalizeCouponCode: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  if (typeof data.code === 'string') data.code = data.code.trim().toUpperCase()
  return data
}

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  labels: { singular: 'Coupon', plural: 'Coupons' },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'type', 'active', 'usageCount', 'usageLimit', 'startDate', 'endDate'],
    group: 'Sales',
  },
  access: {
    // No public read -- the storefront never lists codes, only validates a
    // specific one it already has (via the dedicated endpoint, which runs
    // with overrideAccess). Admin-only otherwise, Payload's default once an
    // auth collection exists.
  },
  hooks: {
    beforeValidate: [normalizeCouponCode],
  },
  endpoints: couponsEndpoints,
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      label: 'Code',
      admin: { description: 'What shoppers type at checkout. Case-insensitive -- always stored/matched uppercase.' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Uncheck to disable without deleting (keeps redemption history on past orders intact).' },
    },
    {
      name: 'description',
      type: 'text',
      admin: { description: 'Internal note (e.g. which campaign this is for) -- not shown to shoppers.' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'percent',
      options: [
        { label: 'Percentage off', value: 'percent' },
        { label: 'Fixed amount off', value: 'fixed' },
        // Free delivery (2026-07-31 admin request): waives shipping instead
        // of discounting merchandise -- no amount fields of its own (see
        // percentOff/fixedOffAOKz/fixedOffPTEur above, all conditioned on
        // the other two types so they stay hidden here). Enforcement lives
        // in lib/couponPricing.ts's resolveCoupon (returns freeShipping
        // instead of a discountAmount) and authoritativeOrder.ts (zeroes
        // shippingCost when freeShipping is true).
        { label: 'Free delivery', value: 'free_shipping' },
      ],
    },
    {
      name: 'percentOff',
      type: 'number',
      min: 1,
      max: 100,
      label: 'Percent off',
      admin: { condition: (data) => data.type === 'percent', description: '1-100.' },
      validate: (value: number | null | undefined, { siblingData }: { siblingData?: { type?: string } }) => {
        if (siblingData?.type === 'percent' && (value == null || value <= 0)) return 'Required for percentage-off coupons.'
        return true
      },
    },
    {
      name: 'fixedOffAOKz',
      type: 'number',
      min: 0,
      label: 'Fixed amount off -- Angola (Kz)',
      admin: { condition: (data) => data.type === 'fixed', description: 'Leave blank to not offer this coupon in Angola.' },
    },
    {
      name: 'fixedOffPTEur',
      type: 'number',
      min: 0,
      label: 'Fixed amount off -- Portugal (EUR)',
      admin: { condition: (data) => data.type === 'fixed', description: 'Leave blank to not offer this coupon in Portugal.' },
    },
    {
      name: 'minOrderValueAOKz',
      type: 'number',
      min: 0,
      label: 'Minimum order subtotal -- Angola (Kz)',
      admin: { description: 'Optional.' },
    },
    {
      name: 'minOrderValuePTEur',
      type: 'number',
      min: 0,
      label: 'Minimum order subtotal -- Portugal (EUR)',
      admin: { description: 'Optional.' },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: { description: 'Optional. Coupon is inactive before this date.' },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: { description: 'Optional. Coupon is inactive after this date.' },
      validate: (value: Date | string | null | undefined, { siblingData }: { siblingData?: { startDate?: Date | string } }) => {
        if (value && siblingData?.startDate && new Date(value) < new Date(siblingData.startDate)) {
          return 'End date must be after the start date.'
        }
        return true
      },
    },
    {
      name: 'usageLimit',
      type: 'number',
      min: 1,
      label: 'Total usage limit',
      admin: { description: 'Optional. Total redemptions allowed across every customer.' },
    },
    {
      name: 'usageCount',
      type: 'number',
      defaultValue: 0,
      label: 'Times used',
      admin: { readOnly: true, description: 'Incremented automatically whenever an order successfully uses this code.' },
    },
    {
      name: 'maxRedemptionsPerEmail',
      type: 'number',
      min: 1,
      label: 'Per-customer limit',
      admin: { description: 'Optional. Caps how many times the same customer email can use this code.' },
    },
    // Market scoping (2026-07-27, market-switch follow-up): previously a
    // coupon had no explicit per-market gate at all -- a percent-off code
    // applied everywhere unconditionally, and a fixed-amount code only
    // opted out of a market implicitly (leave its Kz/EUR field blank).
    // Same checkbox pattern as Products' availableAO/availablePT. Both
    // default true so every existing coupon keeps working in both markets
    // until an admin deliberately restricts one -- see
    // lib/couponPricing.ts's resolveCoupon for the enforcement.
    {
      name: 'availableAO',
      type: 'checkbox',
      defaultValue: true,
      label: 'Available in Angola',
      admin: { description: 'Uncheck to make this code invalid for Angola orders.', position: 'sidebar' },
    },
    {
      name: 'availablePT',
      type: 'checkbox',
      defaultValue: true,
      label: 'Available in Portugal',
      admin: { description: 'Uncheck to make this code invalid for Portugal orders.', position: 'sidebar' },
    },
  ],
}

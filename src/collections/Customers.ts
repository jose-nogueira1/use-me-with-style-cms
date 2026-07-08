import type { CollectionConfig } from 'payload'

// Lightweight customer/contact record -- NOT a customer-accounts system.
// Phase 1 decision (JOS-52): full accounts + wishlist are deferred to
// Phase 2; only "lightweight order lookup/order confirmation" is in scope.
// Rows here are upserted by the order-lookup API route (task #3/#4) by
// matching email, purely so admin has one place to see a customer's order
// history -- there is no customer-facing auth/login tied to this collection.
export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'market', 'orderCount'],
    group: 'Sales',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'phone', type: 'text' },
    {
      name: 'market',
      type: 'select',
      options: [
        { label: 'Angola', value: 'AO' },
        { label: 'Portugal', value: 'PT' },
      ],
    },
    { name: 'orderCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
  ],
}

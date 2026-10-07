import type { GlobalConfig } from 'payload'

// Storefront announcement bar (above the header). It carries the free-delivery
// message; the promoted discount code is chosen on the coupon itself ("Show on
// the announcement bar"). Leave a text blank to use the automatic wording, which
// is built from the market's free-delivery threshold. See lib/announcementBanner.ts.
// Field names use `Pt`/`En` (not `PT`/`EN`) so the Postgres column names are
// unambiguous: angola_delivery_text_pt.
export const AnnouncementBanner: GlobalConfig = {
  slug: 'announcement-banner',
  label: 'Announcement bar',
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: 'Settings',
    description:
      'The scrolling bar above the storefront header. Shows the free-delivery message and, optionally, one discount code (choose it on the coupon).',
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Angola',
      fields: [
        { name: 'angolaDeliveryEnabled', type: 'checkbox', defaultValue: true, label: 'Show the free-delivery message' },
        {
          name: 'angolaDeliveryTextPt',
          type: 'text',
          label: 'Free-delivery text — Portuguese',
          admin: { description: 'Optional. Blank = "Entrega grátis acima de <threshold>" from the market settings.' },
        },
        {
          name: 'angolaDeliveryTextEn',
          type: 'text',
          label: 'Free-delivery text — English',
          admin: { description: 'Optional. Blank = "Free delivery over <threshold>".' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Portugal',
      fields: [
        { name: 'portugalDeliveryEnabled', type: 'checkbox', defaultValue: true, label: 'Show the free-delivery message' },
        {
          name: 'portugalDeliveryTextPt',
          type: 'text',
          label: 'Free-delivery text — Portuguese',
          admin: { description: 'Optional. Blank = "Entrega grátis acima de <threshold>" from the market settings.' },
        },
        {
          name: 'portugalDeliveryTextEn',
          type: 'text',
          label: 'Free-delivery text — English',
          admin: { description: 'Optional. Blank = "Free delivery over <threshold>".' },
        },
      ],
    },
  ],
}

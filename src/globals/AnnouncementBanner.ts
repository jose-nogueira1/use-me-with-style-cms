import type { GlobalConfig } from 'payload'

// Storefront announcement bar (above the header). Per market it carries one
// message the admin writes (free delivery, a sale, opening hours, anything) that
// can be switched on and off; the promoted discount code is chosen on the coupon
// itself ("Show on the announcement bar"). See lib/announcementBanner.ts.
// Field names use `Pt`/`En` (not `PT`/`EN`) so the Postgres column names are
// unambiguous: angola_message_text_pt.
const messageFields = (market: 'angola' | 'portugal') => [
  { name: `${market}MessageEnabled`, type: 'checkbox' as const, defaultValue: false, label: 'Show the message' },
  {
    name: `${market}MessageTextPt`,
    type: 'text' as const,
    label: 'Message — Portuguese',
    admin: { description: 'If only one language is filled in, it is shown for both.' },
  },
  { name: `${market}MessageTextEn`, type: 'text' as const, label: 'Message — English' },
]

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
      'The scrolling bar above the storefront header. Shows a message you write (when switched on) and, optionally, one discount code (choose it on the coupon).',
  },
  fields: [
    { type: 'collapsible', label: 'Angola', fields: messageFields('angola') },
    { type: 'collapsible', label: 'Portugal', fields: messageFields('portugal') },
  ],
}

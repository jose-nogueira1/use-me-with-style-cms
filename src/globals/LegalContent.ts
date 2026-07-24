import type { GlobalConfig } from 'payload'

// Privacy Policy + Terms & Conditions (added 2026-07-24, user request). Store-
// wide rather than per-market like MarketSettings' returns/shipping fields --
// these apply the same way regardless of which storefront (ao./pt.) a visitor
// is on, so they get their own small global instead of growing MarketSettings
// further.
//
// IMPORTANT: the seeded PT/EN text is a generic, AI-drafted template (no
// client-provided legal copy exists yet, unlike the returns policy). It is
// NOT a substitute for review by a lawyer familiar with Angola's Lei de
// Proteção de Dados Pessoais and the EU GDPR before this is relied on in
// production. Flagged here and in scripts/seed.ts so it isn't mistaken for
// reviewed copy later.
export const LegalContent: GlobalConfig = {
  slug: 'legal-content',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Settings',
    description:
      'Privacy Policy and Terms & Conditions shown on the storefront. The seeded text is an AI-drafted generic template -- have it reviewed by a lawyer before treating it as final.',
  },
  fields: [
    {
      name: 'privacyPolicyTextPT',
      type: 'textarea',
      label: 'Privacy Policy — Portuguese',
      admin: { description: 'AI-drafted generic template, added 2026-07-24. Needs legal review before final.' },
    },
    {
      name: 'privacyPolicyTextEN',
      type: 'textarea',
      label: 'Privacy Policy — English',
      admin: { description: 'AI-drafted generic template, added 2026-07-24. Needs legal review before final.' },
    },
    {
      name: 'termsTextPT',
      type: 'textarea',
      label: 'Terms & Conditions — Portuguese',
      admin: { description: 'AI-drafted generic template, added 2026-07-24. Needs legal review before final.' },
    },
    {
      name: 'termsTextEN',
      type: 'textarea',
      label: 'Terms & Conditions — English',
      admin: { description: 'AI-drafted generic template, added 2026-07-24. Needs legal review before final.' },
    },
  ],
}

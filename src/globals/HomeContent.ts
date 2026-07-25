import type { GlobalConfig } from 'payload'

// Storefront home hero (2026-07-25 admin request): the "Coleção SS26 / Moda
// que se move consigo." banner was hardcoded via i18n.ts translation keys
// (ss26Collection/heroHeadline/heroSubtitle/shopAll) with no admin-editable
// source and a purely decorative placeholder standing in for the graphic --
// the admin had no way to change any of it. Same bilingual PT/EN pattern as
// every other storefront-content global (MarketSettings, LegalContent).
//
// defaultValues match the copy that was previously hardcoded, so nothing on
// the storefront changes until the admin actually edits this.
export const HomeContent: GlobalConfig = {
  slug: 'home-content',
  label: 'Home Page',
  access: {
    // The storefront needs this to render the hero; anyone can read it,
    // same as MarketSettings/LegalContent.
    read: () => true,
  },
  admin: {
    group: 'Settings',
    description: "Editable content for the storefront home page's hero banner.",
  },
  // 2026-07-25 follow-up ("save old homepage creations, in case I want to
  // re-activate them later"): every save now auto-snapshots the PREVIOUS
  // content (Payload's built-in global versioning -- no drafts/publish
  // workflow, just history), capped at the last 20. The admin UI lists
  // these and can restore any of them via POST /globals/home-content/
  // versions/:id (see Settings.tsx's HomeHeroSection).
  versions: {
    max: 20,
  },
  fields: [
    {
      name: 'heroEyebrowPT',
      type: 'text',
      label: 'Eyebrow — Portuguese',
      defaultValue: 'Coleção SS26',
      admin: { description: 'Small label above the headline, e.g. "Coleção SS26".' },
    },
    {
      name: 'heroEyebrowEN',
      type: 'text',
      label: 'Eyebrow — English',
      defaultValue: 'SS26 Collection',
    },
    {
      name: 'heroHeadlinePT',
      type: 'text',
      label: 'Headline — Portuguese',
      defaultValue: 'Moda que se move consigo.',
    },
    {
      name: 'heroHeadlineEN',
      type: 'text',
      label: 'Headline — English',
      defaultValue: 'Fashion that moves with you.',
    },
    {
      name: 'heroSubtitlePT',
      type: 'textarea',
      label: 'Subtitle — Portuguese',
      defaultValue: 'Peças pensadas para si, com preços sempre claros e diretos.',
    },
    {
      name: 'heroSubtitleEN',
      type: 'textarea',
      label: 'Subtitle — English',
      defaultValue: 'Considered pieces for you, with pricing always shown up front.',
    },
    {
      name: 'heroCtaLabelPT',
      type: 'text',
      label: 'Button label — Portuguese',
      defaultValue: 'Ver tudo',
    },
    {
      name: 'heroCtaLabelEN',
      type: 'text',
      label: 'Button label — English',
      defaultValue: 'Shop all',
    },
    {
      name: 'heroCtaHref',
      type: 'text',
      label: 'Button link',
      defaultValue: '/catalogo',
      admin: {
        description:
          'Where the button goes -- usually /catalogo, /catalogo?cat=vestidos to point at one category, or /catalogo?tag=ss26 to point at a themed collection (create a merchandising tag, e.g. "SS26", apply it to the relevant products, and use its slug here).',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero image',
      admin: { description: 'Optional. Replaces the decorative placeholder graphic on the right of the hero banner when set.' },
    },
  ],
}

import type { GlobalConfig } from 'payload'
import { deleteGlobalVersionEndpoint } from '../endpoints/globalVersions'

// Storefront home hero (2026-07-25 admin request): the "Coleção SS26 / Moda
// que se move consigo." banner was hardcoded via i18n.ts translation keys
// with no admin-editable source. Same bilingual PT/EN pattern as every
// other storefront-content global (MarketSettings, LegalContent).
//
// Split out of the combined `home-content` global (2026-08-04, admin
// feedback: "I don't like the previous versions is a global preview of the
// whole home page... it should have previous versions of just each
// individually" -- editing Categories or Collections was dirtying and
// snapshotting Hero too, and the one shared "Previous versions" list mixed
// all three together with no way to tell what actually changed). This
// global now owns ONLY the hero banner fields and gets its own independent
// version history. See HomeCategories.ts / HomeCollections.ts for the
// other two former sections, and
// src/migrations/20260804_180000_home_content_split.ts for how the
// existing `home-content` data was migrated across.
//
// defaultValues match the copy that was previously hardcoded, so nothing on
// the storefront changes until the admin actually edits this.
export const HomeHero: GlobalConfig = {
  slug: 'home-hero',
  label: 'Home Page — Hero',
  access: {
    // The storefront needs this to render the hero; anyone can read it,
    // same as MarketSettings/LegalContent.
    read: () => true,
  },
  admin: {
    group: 'Settings',
    description: "Editable content for the storefront home page's hero banner.",
  },
  // Every save auto-snapshots the PREVIOUS content (Payload's built-in
  // global versioning -- no drafts/publish workflow, just history), capped
  // at the last 20. The admin UI lists these and can restore any of them.
  versions: {
    max: 20,
  },
  // Admin-only: delete a single version snapshot (2026-08-04 follow-up --
  // see endpoints/globalVersions.ts for why this needs a custom endpoint).
  endpoints: [deleteGlobalVersionEndpoint('home-hero')],
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
      // 2026-07-31 (admin bug report: hero pointed at a "SS26" collection
      // but the button sent shoppers to the full catalogue): replaces the
      // old free-text heroCtaHref URL field. heroCtaType +
      // heroCtaCategorySlug/heroCtaTagSlug are driven by a dropdown in the
      // admin UI sourced from the real Categories/MerchTags lists, so the
      // stored slug always corresponds to something that actually exists
      // at save time.
      name: 'heroCtaType',
      type: 'select',
      label: 'Button link type',
      defaultValue: 'all',
      options: [
        { label: 'All products', value: 'all' },
        { label: 'One category', value: 'category' },
        { label: 'Merchandising tag / themed collection', value: 'tag' },
      ],
      admin: { description: 'Where the hero button sends shoppers.' },
    },
    {
      name: 'heroCtaCategorySlug',
      type: 'text',
      label: 'Category',
      admin: {
        description: 'Only used when link type is "One category".',
        condition: (_, siblingData) => siblingData?.heroCtaType === 'category',
      },
    },
    {
      name: 'heroCtaTagSlug',
      type: 'text',
      label: 'Merchandising tag',
      admin: {
        description: 'Only used when link type is "Merchandising tag". Pick a tag on the right.',
        condition: (_, siblingData) => siblingData?.heroCtaType === 'tag',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero image — desktop (16:9)',
      admin: { description: 'Desktop composition. Replaces the decorative placeholder graphic when set.' },
    },
    {
      name: 'heroImageMobile',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero image — mobile (4:5)',
      admin: { description: 'Optional mobile composition. The desktop image is used as a safe fallback when this is empty.' },
    },
  ],
}

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
      // 2026-07-31 (admin bug report: hero pointed at a "SS26" collection
      // but the button sent shoppers to the full catalogue): replaces the
      // old free-text `heroCtaHref` URL field, which required an admin to
      // correctly hand-type e.g. "/catalogo?tag=ss26" -- a typo, or the tag
      // being renamed/deleted later, silently degraded back to "shows
      // everything" with no warning (exactly this bug). heroCtaType +
      // heroCtaCategorySlug/heroCtaTagSlug are driven by a dropdown in the
      // admin UI (Settings.tsx) sourced from the real Categories/MerchTags
      // lists, so the stored slug always corresponds to something that
      // actually exists at save time. The storefront (Home.tsx) derives the
      // button's href from these instead of reading a raw URL string.
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
      label: 'Hero image',
      admin: { description: 'Optional. Replaces the decorative placeholder graphic on the right of the hero banner when set.' },
    },
    // Homepage curation (2026-08-04, user request: "how does the admin
    // choose which categories are present in the homepage and which
    // merchandising tag is also on the homepage. Admin should have total
    // control here"). Previously the category row showed EVERY category in
    // the system automatically, "New Arrivals" was hardcoded to whichever
    // tag happened to be literally named "New" (isNewArrival in the
    // platform's productAdapters.ts), and "Featured" wasn't tag-driven at
    // all -- just the first 8 products in list order. Both fields are
    // optional and empty by default: Home.tsx (platform) falls back to
    // exactly today's behaviour (show every category; New/Featured as
    // before) until an admin actually fills these in, so nothing changes on
    // deploy.
    {
      name: 'homepageCategorySlugs',
      type: 'array',
      label: 'Homepage categories',
      admin: {
        description:
          'Which categories appear in the homepage category row, and in what order. Leave empty to show every category (today\'s behaviour).',
      },
      fields: [
        {
          name: 'slug',
          type: 'text',
          required: true,
          label: 'Category',
          admin: { description: 'Picked from the real category list in Settings -- see Settings.tsx.' },
        },
      ],
    },
    {
      // Generalises "New Arrivals" + "Featured" into any number of
      // admin-defined, tag-driven shelves (2026-08-04 follow-up: "think
      // about me having a new collection, lets say summer ss26, I should be
      // able to feature it with the tag SS26, like we have featured and new
      // arrivals now"). Each row is one shelf: pick a real merch tag, give
      // it a bilingual title, cap how many products show. Order in this
      // array is the order shelves render on the homepage.
      name: 'collections',
      type: 'array',
      label: 'Homepage collections (tag-driven shelves)',
      admin: {
        description:
          'Each row is one product shelf on the homepage, driven by a merchandising tag (e.g. "New", "Bestseller", "SS26"). Leave empty to keep the previous fixed New Arrivals / Featured sections.',
      },
      fields: [
        {
          name: 'tagSlug',
          type: 'text',
          required: true,
          label: 'Merchandising tag',
          admin: { description: 'Picked from the real merch tag list in Settings.' },
        },
        { name: 'titlePT', type: 'text', required: true, label: 'Title -- Portuguese' },
        { name: 'titleEN', type: 'text', required: true, label: 'Title -- English' },
        {
          name: 'itemLimit',
          type: 'number',
          min: 1,
          max: 24,
          defaultValue: 8,
          label: 'Item limit',
          admin: { description: 'Maximum products shown in this shelf.' },
        },
      ],
    },
  ],
}

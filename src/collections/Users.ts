import type { CollectionConfig } from 'payload'

// Single admin user collection (Raisa + Jay-P). Phase 1 has no team
// permissions / multi-role support (deferred per JOS-52 decision log) --
// every user here is a full admin.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email'],
    group: 'Admin',
  },
  auth: true,
  fields: [
    // Email + password added automatically by `auth: true`.
    {
      name: 'name',
      type: 'text',
    },
  ],
  versions: false,
}

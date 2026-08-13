import type { CollectionConfig } from 'payload'

// Private singleton-style storage for the renewable Instagram credential.
// The token is AES-GCM encrypted before it reaches Payload, and this
// collection is inaccessible through both the REST API and Payload Admin.
export const InstagramTokenVault: CollectionConfig = {
  slug: 'instagram-token-vault',
  admin: { hidden: true },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'ciphertext', type: 'textarea', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'lastRefreshedAt', type: 'date' },
    { name: 'lastAttemptAt', type: 'date' },
    { name: 'lastError', type: 'textarea' },
    { name: 'lastAlertAt', type: 'date' },
    { name: 'lastAlertThreshold', type: 'number' },
  ],
  timestamps: true,
  versions: false,
}

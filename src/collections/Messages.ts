import type { CollectionConfig } from 'payload'

import { sendOutboundMessage } from '../hooks/sendOutboundMessage'

// Instagram messaging foundation (Phase 1, JOS-58 --
// narrowly scoped, not a full AI agent). Every inbound message received via
// the webhook and every outbound message (automated or admin-composed) is
// logged here so there's one place ("Mensagens" in admin) to see
// conversations, what was auto-handled, and what needs a human (Raisa).
export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    useAsTitle: 'body',
    defaultColumns: ['channel', 'direction', 'customerName', 'status', 'createdAt'],
    group: 'Sales',
  },
  access: {
    // Inbound messages arrive via the unauthenticated webhook, which writes
    // through the local API with overrideAccess -- no public REST access
    // needed. Reads/creates via the normal REST API (used by the admin UI to
    // send manual replies) stay behind Payload's default authenticated-only
    // access.
  },
  hooks: {
    afterChange: [sendOutboundMessage],
  },
  fields: [
    {
      name: 'channel',
      type: 'select',
      required: true,
      options: [
        { label: 'Instagram', value: 'instagram' },
        // WhatsApp is intentionally dormant. Keep the option here so the
        // channel can be restored later without reconstructing the schema.
        // { label: 'WhatsApp', value: 'whatsapp' },
      ],
      defaultValue: 'instagram',
      admin: { readOnly: true },
    },
    {
      name: 'direction',
      type: 'select',
      required: true,
      options: [
        { label: 'Inbound', value: 'inbound' },
        { label: 'Outbound', value: 'outbound' },
      ],
    },
    // Instagram-scoped user id -- the conversation key used by the inbox.
    { name: 'contactHandle', type: 'text', required: true, label: 'Instagram user ID' },
    { name: 'customerName', type: 'text' },
    { name: 'body', type: 'textarea', required: true },
    { name: 'instagramContextType', type: 'text', admin: { readOnly: true } },
    { name: 'instagramContextUrl', type: 'text', admin: { readOnly: true } },
    { name: 'instagramContextPermalink', type: 'text', admin: { readOnly: true } },
    { name: 'instagramContextMediaType', type: 'text', admin: { readOnly: true } },
    { name: 'replyToExternalId', type: 'text', admin: { readOnly: true } },
    { name: 'replyToText', type: 'textarea', admin: { readOnly: true } },
    { name: 'adminReadAt', type: 'date', admin: { readOnly: true } },
    { name: 'instagramSeenAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'conversationStatus',
      type: 'select',
      defaultValue: 'needs_reply',
      options: [
        { label: 'Needs reply', value: 'needs_reply' },
        { label: 'Waiting on customer', value: 'waiting' },
        { label: 'Priority', value: 'priority' },
        { label: 'Done', value: 'done' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open -- needs review', value: 'open' },
        { label: 'Auto-handled', value: 'auto_handled' },
        { label: 'Escalated', value: 'escalated' },
        { label: 'Resolved', value: 'resolved' },
      ],
    },
    // Which Phase 1 automation rule matched (or "none" / "sensitive-escalation"),
    // kept so the rules are auditable from the data itself, not just docs.
    { name: 'automationNote', type: 'text', admin: { readOnly: true } },
    { name: 'relatedOrder', type: 'relationship', relationTo: 'orders' },
    { name: 'relatedCustomer', type: 'relationship', relationTo: 'customers' },
    // True when this outbound doc was already sent by the webhook's
    // auto-reply logic (or by notifyOrderEvent) -- prevents the
    // sendOutboundMessage afterChange hook from sending it a second time.
    // Left false when an admin composes a manual reply in the Mensagens UI,
    // which is exactly when the hook SHOULD send it.
    { name: 'sentByAutomation', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    { name: 'externalId', type: 'text', admin: { readOnly: true } },
    { name: 'internalNote', type: 'textarea' },
    {
      name: 'aiProcessingStatus',
      type: 'select',
      admin: { readOnly: true },
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Processing', value: 'processing' },
        { label: 'Draft ready', value: 'draft_ready' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    { name: 'aiAttempts', type: 'number', admin: { readOnly: true } },
    { name: 'aiAvailableAt', type: 'date', admin: { readOnly: true } },
    { name: 'aiStartedAt', type: 'date', admin: { readOnly: true } },
    { name: 'aiCompletedAt', type: 'date', admin: { readOnly: true } },
    { name: 'aiCancelledAt', type: 'date', admin: { readOnly: true } },
    { name: 'aiLastError', type: 'text', admin: { readOnly: true } },
    {
      name: 'aiDraftStatus',
      type: 'select',
      admin: { readOnly: true },
      options: [
        { label: 'Queued', value: 'queued' }, { label: 'Draft ready', value: 'draft_ready' },
        { label: 'Approved', value: 'approved' }, { label: 'Dismissed', value: 'dismissed' }, { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'aiDraft', type: 'textarea', admin: { readOnly: true } },
    { name: 'aiDraftConfidence', type: 'number', admin: { readOnly: true, step: 0.01 } },
    { name: 'aiDraftSourceRecordIds', type: 'json', admin: { readOnly: true } },
    { name: 'aiDraftReason', type: 'text', admin: { readOnly: true } },
    {
      name: 'aiMarket', type: 'select', admin: { readOnly: true },
      options: [{ label: 'Angola', value: 'angola' }, { label: 'Portugal', value: 'portugal' }],
    },
    { name: 'aiIntent', type: 'text', admin: { readOnly: true } },
    { name: 'aiLanguage', type: 'text', admin: { readOnly: true } },
    { name: 'aiFacts', type: 'json', admin: { readOnly: true } },
    { name: 'aiModel', type: 'text', admin: { readOnly: true } },
    { name: 'aiRequestId', type: 'text', admin: { readOnly: true } },
    { name: 'aiInputTokens', type: 'number', admin: { readOnly: true } },
    { name: 'aiOutputTokens', type: 'number', admin: { readOnly: true } },
    { name: 'aiTotalTokens', type: 'number', admin: { readOnly: true } },
    { name: 'aiEstimatedCostUsd', type: 'number', admin: { readOnly: true, step: 0.000001 } },
    { name: 'aiRequiresHuman', type: 'checkbox', admin: { readOnly: true } },
    { name: 'aiOutcome', type: 'text', admin: { readOnly: true } },
    { name: 'aiAutomationDecision', type: 'text', admin: { readOnly: true } },
    { name: 'aiBotPaused', type: 'checkbox' },
  ],
}

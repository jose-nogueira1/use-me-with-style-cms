import type { CollectionConfig } from 'payload'

import { sendOutboundMessage } from '../hooks/sendOutboundMessage'

// WhatsApp/Instagram messaging automation FOUNDATION (Phase 1, JOS-58 --
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
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Instagram', value: 'instagram' },
      ],
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
    // The customer's WhatsApp phone number or Instagram-scoped user id --
    // this is the conversation key (grouped by channel + this field in the
    // admin Mensagens page).
    { name: 'contactHandle', type: 'text', required: true, label: 'Phone / Instagram ID' },
    { name: 'customerName', type: 'text' },
    { name: 'body', type: 'textarea', required: true },
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
  ],
}

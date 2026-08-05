import type { GlobalConfig } from 'payload'

/**
 * Day-to-day controls for the Instagram AI assistant. Secrets and model IDs
 * remain server environment variables; these operational controls are safe
 * for an authenticated store administrator to change without a deployment.
 *
 * Approval is the deliberate default. Selecting Hybrid merely enables the
 * guarded decision engine; only deterministic, verified, high-confidence
 * replies from the allow-list can leave the system without human approval.
 */
export const AiMessagingSettings: GlobalConfig = {
  slug: 'ai-messaging-settings',
  label: 'AI Messaging Bot',
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: 'Settings',
    description: 'Controls Instagram AI drafts and the guarded hybrid auto-reply mode.',
  },
  fields: [
    {
      name: 'assistantEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Generate AI suggestions',
    },
    {
      name: 'emergencyStop',
      type: 'checkbox',
      defaultValue: false,
      label: 'Emergency stop',
      admin: { description: 'Immediately stops new AI processing and automatic replies. Existing messages remain available to staff.' },
    },
    {
      name: 'operatingMode',
      type: 'select',
      required: true,
      defaultValue: 'approval',
      options: [
        { label: 'Approval — every reply needs a person', value: 'approval' },
        { label: 'Hybrid — safe replies can send automatically', value: 'hybrid' },
      ],
    },
    {
      name: 'autoReplyIntents',
      type: 'select',
      hasMany: true,
      defaultValue: ['greeting', 'product_availability', 'product_price', 'product_sizing', 'delivery', 'payment', 'coupon', 'return_policy'],
      label: 'Replies allowed to send automatically in Hybrid mode',
      options: [
        { label: 'Greetings and acknowledgements', value: 'greeting' },
        { label: 'Product availability and links', value: 'product_availability' },
        { label: 'Product prices and links', value: 'product_price' },
        { label: 'Product sizing', value: 'product_sizing' },
        { label: 'Delivery information', value: 'delivery' },
        { label: 'Payment methods', value: 'payment' },
        { label: 'Coupon validation', value: 'coupon' },
        { label: 'Returns policy', value: 'return_policy' },
      ],
    },
    {
      name: 'autoReplyMarketClarification',
      type: 'checkbox',
      defaultValue: true,
      label: 'Automatically ask Angola or Portugal when the market is missing',
    },
    {
      name: 'autoReplyProductClarification',
      type: 'checkbox',
      defaultValue: true,
      label: 'Automatically ask for the product name or link when it cannot be identified',
    },
    {
      name: 'confidenceThreshold',
      type: 'number',
      required: true,
      min: 0.75,
      max: 1,
      defaultValue: 0.92,
      label: 'Minimum confidence for automatic sending',
      admin: { step: 0.01, description: '0.92 means 92%. Lower values automate more replies but increase risk.' },
    },
    {
      name: 'replyDelaySeconds',
      type: 'number',
      required: true,
      min: 5,
      max: 120,
      defaultValue: 15,
      label: 'Wait before processing a new customer message (seconds)',
      admin: { description: 'Lets consecutive customer messages arrive before the assistant responds.' },
    },
    {
      name: 'maxAutoRepliesPerConversation',
      type: 'number',
      required: true,
      min: 1,
      max: 20,
      defaultValue: 6,
      label: 'Maximum automatic replies per conversation in 24 hours',
    },
    {
      name: 'maxAutoRepliesPerHour',
      type: 'number',
      required: true,
      min: 1,
      max: 200,
      defaultValue: 40,
      label: 'Maximum automatic replies across Instagram per hour',
    },
    {
      name: 'monthlyBudgetUsd',
      type: 'number',
      required: true,
      min: 0,
      max: 10_000,
      defaultValue: 25,
      label: 'Monthly AI spending guardrail (USD)',
      admin: { step: 1, description: 'New AI processing pauses when the estimated application spend reaches this amount.' },
    },
  ],
}

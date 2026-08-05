import type { Endpoint } from 'payload'
import { getAiAssistantConfig, canAutoSendAiReply } from '../lib/ai/config'
import { createAiProvider } from '../lib/ai/provider'
import { extractInstagramMessage } from '../lib/ai/extraction'
import { retrieveProductContexts } from '../lib/ai/catalogue'
import { draftInstagramReply } from '../lib/ai/drafting'
import { evaluateExtractionSafety } from '../lib/ai/safety'
import { sendInstagramMessage } from '../lib/messaging'

/** One-shot worker invoked by the existing Railway cron service. */
export const aiAssistantEndpoint: Endpoint = {
  path: '/ai/process', method: 'post',
  handler: async (req) => {
    const secret = process.env.CRON_SECRET
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
    const config = getAiAssistantConfig()
    if (config.mode === 'off' || !config.apiKeyConfigured) return Response.json({ processed: 0, skipped: 'disabled' })
    const found = await req.payload.find({ collection: 'messages', where: { and: [
      { channel: { equals: 'instagram' } }, { direction: { equals: 'inbound' } },
      { aiProcessingStatus: { equals: 'queued' } }, { aiAvailableAt: { less_than_equal: new Date().toISOString() } },
    ] }, sort: 'aiAvailableAt', limit: 10, depth: 0, overrideAccess: true })
    let processed = 0
    for (const message of found.docs as any[]) {
      const claimed = await req.payload.update({ collection: 'messages', id: message.id, data: { aiProcessingStatus: 'processing', aiStartedAt: new Date().toISOString(), aiAttempts: Number(message.aiAttempts || 0) + 1 }, overrideAccess: true })
      try {
        const provider = createAiProvider(config)
        const result = await extractInstagramMessage(provider, String(claimed.body || ''), config.extractionModel)
        const safety = evaluateExtractionSafety(result.extraction)
        if (safety.askForMarket) {
          await req.payload.update({ collection: 'messages', id: message.id, data: { aiProcessingStatus: 'draft_ready', aiDraftStatus: 'draft_ready', aiDraft: result.extraction.language === 'en' ? 'Are you shopping for Angola or Portugal?' : 'Está a comprar para Angola ou Portugal?', aiDraftConfidence: result.extraction.confidence, aiDraftReason: safety.reason }, overrideAccess: true })
          processed++; continue
        }
        const products = await retrieveProductContexts(req.payload as any, result.extraction)
        const draft = await draftInstagramReply(provider, { customerMessage: String(claimed.body || ''), intent: result.extraction.intent, language: result.extraction.language === 'en' ? 'en' : 'pt', facts: { product: products[0] || null, alternatives: products.slice(1) }, model: config.draftingModel })
        const status = draft.draft.requiresHuman || !safety.allowed ? 'open' : 'auto_handled'
        await req.payload.update({ collection: 'messages', id: message.id, data: { status, aiProcessingStatus: 'draft_ready', aiDraftStatus: 'draft_ready', aiDraft: draft.draft.reply, aiDraftConfidence: result.extraction.confidence, aiDraftSourceRecordIds: draft.draft.sourceRecordIds, aiDraftReason: safety.reason, aiCompletedAt: new Date().toISOString() }, overrideAccess: true })
        if (canAutoSendAiReply(config) && !draft.draft.requiresHuman && safety.allowed && !claimed.aiBotPaused) {
          await sendInstagramMessage(String(claimed.contactHandle), draft.draft.reply)
          await req.payload.create({ collection: 'messages', overrideAccess: true, data: { channel: 'instagram', direction: 'outbound', contactHandle: claimed.contactHandle, body: draft.draft.reply, status: 'auto_handled', sentByAutomation: true, automationNote: 'ai-auto-reply' } })
          await req.payload.update({ collection: 'messages', id: message.id, data: { aiDraftStatus: 'approved' }, overrideAccess: true })
        }
        processed++
      } catch (error) {
        await req.payload.update({ collection: 'messages', id: message.id, data: { aiProcessingStatus: 'failed', aiDraftStatus: 'failed', aiLastError: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500) }, overrideAccess: true })
      }
    }
    return Response.json({ processed })
  },
}

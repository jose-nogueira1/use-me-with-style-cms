import type { CollectionAfterChangeHook } from 'payload'

/**
 * Populates the Customers collection (see Customers.ts) by matching email --
 * that collection's own doc comment has always claimed this happens, but no
 * code ever actually did it (found during the 2026-07-27 admin QA pass).
 *
 * Lightweight order lookup/history only (JOS-52): no auth, no customer
 * account, just one admin-facing row per email with a running order count.
 * Fire-and-forget-tolerant, same defensive pattern as
 * incrementCouponUsageAfterOrderCreate -- a failure here must never fail
 * order creation, since the order itself is already committed by the time
 * this runs.
 */
export const upsertCustomerAfterOrderCreate: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  const email = String(doc.customerEmail ?? '').trim().toLowerCase()
  if (!email) return doc

  try {
    // `req` is passed through on every nested Local API call below so it
    // joins the SAME database transaction Payload already opened for this
    // order's own create/afterChange cycle, instead of trying to open a
    // second one -- omitting it throws `SQLITE_BUSY: database is locked`
    // every time (confirmed live 2026-07-27: this exact bug was already
    // silently breaking notifyOrderEvent.ts's message-logging on every
    // order, see the sibling `req` fix there).
    const matches = await req.payload.find({
      collection: 'customers',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
      req,
    })
    const existing = matches.docs[0]

    if (existing) {
      await req.payload.update({
        collection: 'customers',
        id: existing.id,
        overrideAccess: true,
        req,
        data: {
          // Snapshot the latest name/phone/market -- a returning customer's
          // details may have changed (new phone, ordered from the other
          // market this time), and the most recent order is the best guess
          // at their current info.
          name: doc.customerName ?? existing.name,
          phone: doc.customerPhone ?? existing.phone,
          market: doc.market ?? existing.market,
          orderCount: (Number(existing.orderCount) || 0) + 1,
        },
      })
    } else {
      await req.payload.create({
        collection: 'customers',
        overrideAccess: true,
        req,
        data: {
          name: String(doc.customerName ?? ''),
          email,
          phone: doc.customerPhone ?? undefined,
          market: doc.market,
          orderCount: 1,
        },
      })
    }
  } catch (err) {
    req.payload.logger.error({ err, customerEmail: email }, '[customers:upsert-failed]')
  }
  return doc
}

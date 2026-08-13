import { APIError, type CollectionConfig } from 'payload'
import { allocateReturnAmounts, requestedRefund, RETURN_RESOLUTIONS, RETURN_STATUSES, type ReturnItem } from '../lib/returns'
import { notifyReturnEvent } from '../hooks/notifyReturnEvent'
import { restockAcceptedReturnItems } from '../lib/inventoryReservation'

export const Returns: CollectionConfig = {
  slug: 'returns',
  labels: { singular: 'Return', plural: 'Returns' },
  admin: { useAsTitle: 'returnNumber', defaultColumns: ['returnNumber', 'orderNumber', 'market', 'status', 'resolution', 'requestedAmount', 'createdAt'], group: 'Sales' },
  access: { read: ({ req }) => Boolean(req.user), create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user), delete: () => false },
  hooks: {
    beforeValidate: [async ({ data, operation, req, context }) => {
      if (!data) return data
      if (operation === 'create') {
        const orderId = typeof data.order === 'object' ? data.order.id : data.order
        const order = await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, req })
        const customerInitiated = context.customerInitiated === true
        if (!['paid'].includes(String(order.paymentStatus)) || !(customerInitiated ? ['delivered'] : ['processing', 'shipped', 'delivered']).includes(String(order.status))) {
          throw new APIError('Returns can only be created for paid, fulfilled orders.', 400, null, true)
        }
        data.returnNumber ||= `RET-${order.market}-${Date.now().toString().slice(-8)}`
        data.orderNumber = order.orderNumber
        data.market = order.market
        data.currency = order.currency
        data.customerName = order.customerName
        data.customerEmail = order.customerEmail
        data.customerPhone = order.customerPhone
        data.lang = order.lang === 'en' ? 'en' : 'pt'
        data.items ||= allocateReturnAmounts(order.items as never[], Number(order.discountAmount || 0))
        const orderItems = allocateReturnAmounts(order.items as never[], Number(order.discountAmount || 0))
        const byId = new Map(orderItems.map((item) => [item.orderItemId, item]))
        const existing = await req.payload.find({ collection: 'returns', where: { and: [{ order: { equals: orderId } }, { status: { not_in: ['rejected', 'customer_cancelled'] } }] }, limit: 100, depth: 0, overrideAccess: true, req })
        const alreadyRequested = new Map<string, number>()
        for (const prior of existing.docs) for (const item of (Array.isArray(prior.items) ? prior.items : []) as ReturnItem[]) alreadyRequested.set(item.orderItemId, (alreadyRequested.get(item.orderItemId) || 0) + Number(item.quantity || 0))
        for (const item of data.items as ReturnItem[]) {
          const source = byId.get(String(item.orderItemId))
          const qty = Number(item.quantity)
          if (!source || !Number.isInteger(qty) || qty < 1 || qty + (alreadyRequested.get(String(item.orderItemId)) || 0) > source.quantity) throw new APIError('Return quantity exceeds the quantity available on the original order.', 400, null, true)
          const perUnitCoupon = source.quantity ? source.couponShare / source.quantity : 0
          item.product = source.product; item.productName = source.productName; item.variantId = source.variantId; item.colorId = source.colorId; item.inventoryComponents = source.inventoryComponents; item.size = source.size; item.color = source.color; item.unitPrice = source.unitPrice
          item.couponShare = Math.round(perUnitCoupon * qty * 100) / 100
          item.refundableAmount = Math.round((source.unitPrice * qty - item.couponShare) * 100) / 100
          item.inspection ||= 'pending'; item.restockQuantity ||= 0
        }
        data.requestedAmount = requestedRefund(data.items as ReturnItem[])
        if (!customerInitiated) data.approvedAmount ??= data.requestedAmount
        data.statusHistory = [{ status: data.status || 'requested', changedAt: new Date().toISOString(), changedBy: customerInitiated ? 'customer' : req.user?.email || 'system' }]
      }
      return data
    }],
    beforeChange: [async ({ data, operation, originalDoc, req, context }) => {
      if (context.returnSideEffect) return data
      if (operation === 'update' && data.status && data.status !== originalDoc?.status) {
        if (data.status === 'resolved' && !originalDoc?.inventoryRestockedAt) {
          const items = (data.items || originalDoc?.items || []) as ReturnItem[]
          for (const item of items) if (Number(item.restockQuantity || 0) > Number(item.quantity || 0)) throw new APIError('Restock quantity cannot exceed returned quantity.', 400, null, true)
          await restockAcceptedReturnItems(req, originalDoc.market, items)
          data.inventoryRestockedAt = new Date().toISOString()
          data.resolvedAt = new Date().toISOString()
        }
        if (data.status === 'resolved' && (data.resolution || originalDoc?.resolution) === 'exchange' && !originalDoc?.replacementOrder) {
          const orderId = typeof originalDoc.order === 'object' ? originalDoc.order.id : originalDoc.order
          const order = await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, req })
          const items = (data.items || originalDoc.items || []) as ReturnItem[]
          const exchangeItems = items.filter((item) => item.inspection === 'accepted').map((item) => ({
            product: item.product, productName: item.productName, variantId: item.replacementVariantId || item.variantId,
            size: item.size, color: item.color, colorId: item.colorId, inventoryComponents: item.inventoryComponents,
            qty: item.quantity, unitPrice: 0,
          }))
          if (!exchangeItems.length) throw new APIError('An exchange requires at least one accepted item.', 400, null, true)
          const replacement = await req.payload.create({ collection: 'orders', overrideAccess: true, req, context: { returnReplacement: true }, data: {
            market: order.market, lang: order.lang, customerName: order.customerName, customerFirstName: order.customerFirstName, customerLastName: order.customerLastName,
            customerPhone: order.customerPhone, customerEmail: order.customerEmail, address: order.address, addressLine2: order.addressLine2,
            postalCode: order.postalCode, deliveryRegion: order.deliveryRegion, city: order.city, country: order.country, taxId: order.taxId,
            notes: `Replacement for ${originalDoc.returnNumber} / ${order.orderNumber}`, items: exchangeItems,
            currency: order.currency, subtotal: 0, shippingCost: 0, total: 0, paymentMethod: 'manual_whatsapp', paymentStatus: 'paid',
            deliveryMethod: order.deliveryMethod, status: 'processing',
          } as never })
          data.replacementOrder = replacement.id
        }
        data.statusHistory = [...(originalDoc?.statusHistory || []), { status: data.status, changedAt: new Date().toISOString(), changedBy: context.customerInitiated ? 'customer' : req.user?.email || 'system' }]
      }
      return data
    }],
    afterChange: [notifyReturnEvent],
  },
  fields: [
    { name: 'returnNumber', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'origin', type: 'select', options: ['admin', 'customer'], defaultValue: 'admin', admin: { readOnly: true } },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'orderNumber', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'market', type: 'select', required: true, options: ['AO', 'PT'], admin: { readOnly: true } },
    { name: 'currency', type: 'select', required: true, options: ['Kz', 'EUR'], admin: { readOnly: true } },
    { name: 'customerName', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'customerEmail', type: 'email', required: true, admin: { readOnly: true } },
    { name: 'customerPhone', type: 'text', admin: { readOnly: true } },
    { name: 'lang', type: 'select', options: ['pt', 'en'], defaultValue: 'pt', admin: { readOnly: true } },
    { name: 'status', type: 'select', required: true, defaultValue: 'requested', options: [...RETURN_STATUSES] },
    { name: 'resolution', type: 'select', required: true, options: [...RETURN_RESOLUTIONS] },
    { name: 'reason', type: 'select', required: true, options: ['wrong_size', 'wrong_colour', 'changed_mind', 'defective', 'incorrect_item', 'other'] },
    { name: 'customerNote', type: 'textarea' },
    { name: 'internalNote', type: 'textarea' },
    { name: 'returnShippingPayer', type: 'select', defaultValue: 'customer', options: ['customer', 'use_me'] },
    { name: 'items', type: 'json', required: true, admin: { description: 'Item-level quantities, original paid allocation, inspection result and controlled restocking.' } },
    { name: 'evidence', type: 'json', admin: { description: 'Customer evidence images, base64 encoded and private to authenticated admin reads.' } },
    { name: 'requestedAmount', type: 'number', required: true, min: 0, admin: { readOnly: true } },
    { name: 'approvedAmount', type: 'number', min: 0 },
    { name: 'refundStatus', type: 'select', defaultValue: 'not_required', options: ['not_required', 'pending', 'completed', 'failed'] },
    { name: 'refundReference', type: 'text' },
    { name: 'storeCreditCode', type: 'text' },
    { name: 'replacementOrder', type: 'relationship', relationTo: 'orders', admin: { readOnly: true } },
    { name: 'inventoryRestockedAt', type: 'date', admin: { readOnly: true } },
    { name: 'resolvedAt', type: 'date', admin: { readOnly: true } },
    { name: 'statusHistory', type: 'json', admin: { readOnly: true } },
    { name: 'customerLastNotifiedStatus', type: 'text', admin: { readOnly: true } },
    { name: 'phase2SelfServiceNote', type: 'text', defaultValue: 'Phase 2: automated gateway refunds, return labels, carrier tracking, SLA automation and richer evidence storage.', admin: { readOnly: true } },
  ],
}

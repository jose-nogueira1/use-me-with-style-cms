export const RETURN_STATUSES = ['requested', 'approved', 'awaiting_item', 'received', 'inspected', 'resolved', 'rejected', 'customer_cancelled'] as const
export const RETURN_RESOLUTIONS = ['refund', 'exchange', 'store_credit'] as const

export type ReturnItem = {
  orderItemId: string
  product: string | number
  productName: string
  variantId?: string | null
  colorId?: string | null
  inventoryComponents?: Array<{ product: string | number; variantId: string; qty: number }> | null
  size?: string | null
  color?: string | null
  quantity: number
  unitPrice: number
  couponShare: number
  refundableAmount: number
  inspection?: 'pending' | 'accepted' | 'rejected'
  restockQuantity?: number
  inspectionNote?: string
  replacementVariantId?: string
}

export function allocateReturnAmounts(
  items: Array<{ id?: string; product: string | number | { id?: string | number }; productName: string; variantId?: string | null; colorId?: string | null; inventoryComponents?: ReturnItem['inventoryComponents']; size?: string | null; color?: string | null; qty: number; unitPrice: number }>,
  discountAmount: number,
): ReturnItem[] {
  const gross = items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0)
  let allocated = 0
  return items.map((item, index) => {
    const lineGross = Number(item.qty) * Number(item.unitPrice)
    const couponShare = index === items.length - 1
      ? Math.max(0, discountAmount - allocated)
      : gross > 0 ? Math.round((discountAmount * lineGross / gross) * 100) / 100 : 0
    allocated += couponShare
    const product = typeof item.product === 'object' ? item.product.id! : item.product
    return {
      orderItemId: String(item.id ?? index), product, productName: item.productName,
      variantId: item.variantId, colorId: item.colorId, inventoryComponents: item.inventoryComponents, size: item.size, color: item.color,
      quantity: Number(item.qty), unitPrice: Number(item.unitPrice), couponShare,
      refundableAmount: Math.max(0, lineGross - couponShare), inspection: 'pending', restockQuantity: 0,
    }
  })
}

export function requestedRefund(items: ReturnItem[]) {
  return Math.round(items.reduce((sum, item) => sum + Number(item.refundableAmount || 0), 0) * 100) / 100
}

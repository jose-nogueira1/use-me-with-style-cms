import type { Endpoint } from 'payload'

export const internalInvoiceEndpoints: Endpoint[] = [
  {
    path: '/internal-invoices/:id/pdf',
    method: 'get',
    handler: async (req) => {
      if (!req.user) return new Response('Unauthorized', { status: 401 })
      const id = String(req.routeParams?.id || '')
      if (!id) return new Response('Invoice ID is required', { status: 400 })

      try {
        const invoice = await req.payload.findByID({
          collection: 'invoices',
          id,
          overrideAccess: true,
        })
        const storedPdf = invoice.pdfData
        const base64 =
          typeof storedPdf === 'string'
            ? storedPdf
            : storedPdf && typeof storedPdf === 'object' && 'base64' in storedPdf
              ? String(storedPdf.base64)
              : ''
        if (!base64) return new Response('PDF is not available', { status: 404 })
        const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${invoice.pdfFilename || `${invoice.invoiceNumber}.pdf`}"`,
            'Cache-Control': 'private, no-store',
          },
        })
      } catch {
        return new Response('Invoice not found', { status: 404 })
      }
    },
  },
]

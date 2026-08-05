import type { Endpoint } from 'payload'

export const instagramProfileEndpoint: Endpoint = {
  path: '/instagram-profile', method: 'get',
  handler: async (req) => {
    const handle = new URL(req.url ?? '', 'http://localhost').searchParams.get('contactHandle')?.trim()
    const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
    if (!handle || !token) return Response.json({ username: handle || '', name: handle || '' })
    const loginToken = token.startsWith('IGAA')
    const host = loginToken ? 'graph.instagram.com' : 'graph.facebook.com'
    const resource = loginToken ? handle : handle
    // Instagram Login exposes username/name for messaging participants, but
    // profile_picture_url is not a supported field on this endpoint.
    const fields = loginToken ? 'id,username,name' : 'id,username,name,profile_picture_url'
    const response = await fetch(`https://${host}/v23.0/${resource}?fields=${fields}&access_token=${encodeURIComponent(token)}`)
    if (!response.ok) return Response.json({ username: handle, name: handle }, { status: 200 })
    const data = await response.json() as Record<string, unknown>
    return Response.json({ id: String(data.id ?? data.user_id ?? handle), username: data.username ?? handle, name: data.name ?? data.username ?? handle, profile_picture_url: data.profile_picture_url ?? null })
  },
}

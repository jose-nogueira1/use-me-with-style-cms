import type { Endpoint } from 'payload'

export const instagramProfileEndpoint: Endpoint = {
  path: '/instagram-profile', method: 'get',
  handler: async (req) => {
    const handle = new URL(req.url ?? '', 'http://localhost').searchParams.get('contactHandle')?.trim()
    const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
    if (!handle || !token) return Response.json({ username: handle || '', name: handle || '' })
    const loginToken = token.startsWith('IGAA')
    const host = loginToken ? 'graph.instagram.com' : 'graph.facebook.com'
    // Messaging participant profiles use `profile_pic`, not the business
    // account field `profile_picture_url`. Meta returns a short-lived URL, so
    // this endpoint deliberately fetches it afresh instead of caching it.
    const fields = 'id,username,name,profile_pic,is_verified_user'
    const response = await fetch(`https://${host}/v23.0/${encodeURIComponent(handle)}?fields=${fields}&access_token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
    if (!response.ok) return Response.json({ username: handle, name: handle, profile_pic: null }, { status: 200, headers: { 'Cache-Control': 'private, no-store' } })
    const data = await response.json() as Record<string, unknown>
    return Response.json({
      id: String(data.id ?? data.user_id ?? handle),
      username: data.username ?? handle,
      name: data.name ?? data.username ?? handle,
      profile_pic: data.profile_pic ?? null,
      is_verified_user: data.is_verified_user ?? false,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  },
}

import type { Endpoint } from 'payload'

import { getInstagramUserProfile } from '../lib/messaging'

export const instagramProfileEndpoint: Endpoint = {
  path: '/instagram-profile',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url ?? '', 'http://localhost')
    const contactHandle = url.searchParams.get('contactHandle')?.trim()
    if (!contactHandle) return Response.json({ error: 'contactHandle is required' }, { status: 400 })

    const profile = await getInstagramUserProfile(contactHandle)
    return profile
      ? Response.json(profile)
      : Response.json({ error: 'Profile unavailable' }, { status: 404 })
  },
}

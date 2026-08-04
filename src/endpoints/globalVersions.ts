import type { Endpoint, GlobalSlug } from 'payload'

// Admin request (2026-08-04, same session as the home-content three-way
// split): "Admin should have a way to delete old hero section, old
// categories and old homepage collections [version history entries]."
//
// Payload's local/REST API has find/restore for global versions
// (findVersionsOperationGlobal / restoreVersionOperationGlobal) but no
// delete -- `payload.db.deleteVersions()` exists at the DB-adapter level
// (used internally to wipe a collection doc's versions when the doc itself
// is deleted, via globalSlug OR collectionSlug) but nothing wires it up as
// an admin-facing endpoint for globals. This factory adds one:
// `DELETE /api/globals/<slug>/versions/:id`, sibling to the built-in
// `GET .../versions/:id` and `POST .../versions/:id` (restore) endpoints,
// so it can't collide with anything Payload registers itself.
//
// Deliberately per-row, not "clear all history": an admin might want to
// prune one bad/test snapshot while keeping the rest.
export function deleteGlobalVersionEndpoint(globalSlug: GlobalSlug): Endpoint {
  return {
    path: '/versions/:id',
    method: 'delete',
    handler: async (req) => {
      if (!req.user) return new Response('Unauthorized', { status: 401 })
      const id = req.routeParams?.id
      if (!id || typeof id !== 'string') {
        return Response.json({ error: 'Version id is required' }, { status: 400 })
      }

      // deleteVersions() is declared Promise<void> in Payload's public
      // types (its actual runtime return -- the deleted docs -- isn't part
      // of the contract), so confirm existence with a typed lookup first
      // rather than relying on the delete call's return value.
      try {
        await req.payload.findGlobalVersionByID({ slug: globalSlug, id, depth: 0 })
      } catch {
        return Response.json({ error: 'Version not found' }, { status: 404 })
      }

      await req.payload.db.deleteVersions({
        globalSlug,
        req,
        where: { id: { equals: id } },
      })
      return Response.json({ success: true })
    },
  }
}

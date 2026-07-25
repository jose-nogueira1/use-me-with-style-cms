import { redirect } from 'next/navigation'

// Root route (2026-07-25 follow-up): Payload's Next.js scaffold only defines
// routes for /admin and /api (see the sibling admin/ and api/ folders) --
// there was never a page for "/" itself, so it fell through to Next's
// default 404. This backend has no public root page of its own, so send
// visitors straight to the admin panel instead.
//
// Placed inside the (payload) route group (not a top-level src/app/page.tsx)
// so it shares that group's layout.tsx -- which is Payload-generated and
// provides the <html>/<body> root layout wrapper Next.js requires.
export default function RootPage() {
  redirect('/admin')
}

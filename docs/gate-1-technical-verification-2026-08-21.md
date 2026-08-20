# Gate 1 — CMS technical verification record

Date: 21 August 2026

Scope: Use Me With Style Phase 1 Payload CMS, migrations, build and production login surface

Branch: `chore/gate-1-technical-closeout`

Baseline `main`: `baaef2d`

## Outcome

The CMS test suite, real PostgreSQL migration suite, lint, production build, runtime dependency review, and non-destructive production login check passed. No launch-blocking CMS finding remains.

## Verified baseline

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | Pass | `npm ci` completed successfully |
| Lint | Pass | `npm run lint`; zero errors |
| Standard test suite | Pass | `npm test`; 160 passed and 20 PostgreSQL-only cases skipped by design when `TEST_POSTGRES_URL` is absent |
| PostgreSQL migration suite | Pass | `npm run test:migrations:postgres` against a disposable isolated PostgreSQL cluster; 20/20 passed |
| Production build | Pass | `npm run build`; Next.js 16.2.12/Payload build completed |
| Production login surface | Pass | `https://cms.usemewithstyle.shop/admin` redirected to `/admin/login`, rendered correctly, and produced zero console errors |
| Runtime audit | Reviewed | Six moderate transitive tooling advisories; disposition below |

## PostgreSQL migration method

The migration tests were run against a temporary local Homebrew PostgreSQL cluster on an isolated non-default port. Each test created and dropped its own uniquely named database. The cluster was stopped after the run and its validated temporary directory was removed. No development or production database was accessed.

## Dependency risk disposition

`npm audit --omit=dev` reports six moderate entries from one transitive chain:

`@payloadcms/db-postgres` / `@payloadcms/db-sqlite` → `drizzle-kit@0.31.7` → `@esbuild-kit/esm-loader@2.6.5` → `@esbuild-kit/core-utils@3.3.2` → `esbuild@0.18.20`

The advisory concerns an exposed esbuild development server accepting requests from arbitrary sites. The affected copy is nested under Payload's database migration tooling; it is not the Next.js/Payload production HTTP server and is not exposed by the deployed CMS. Current non-vulnerable esbuild copies used elsewhere remain installed separately.

Disposition:

- Payload and all first-party Payload packages are already on the current 3.88.0 release.
- npm reports no supported automatic fix for this transitive chain.
- No forced override is introduced because it could break Payload migration tooling and would exceed safe patch remediation.
- Keep development servers bound to trusted/local environments and do not expose migration tooling publicly.
- Re-run `npm audit --omit=dev` during routine maintenance and upgrade when Payload replaces or updates the affected dependency chain.

This is an accepted, monitored tooling risk, not a production runtime exposure or Gate 1 launch blocker.

## Gate decision

**PASS** — subject to the matching storefront verification record and the normal verified merge procedure. No application or schema change was required.

# CMS context

Payload/Next.js provides API data, access control, media and commerce behavior. SQLite is used locally; Railway uses PostgreSQL. The custom admin and storefront are in the separate React/Vite platform repository.

The canonical [shared glossary and decision map](https://github.com/jose-nogueira1/use-me-with-style-platform/blob/main/CONTEXT.md) is maintained in the platform. With sibling checkouts, read `../use-me-with-style-platform/CONTEXT.md` and its linked decisions. During an unpublished cross-repository change, use the matching local checkout/branch rather than assuming GitHub main contains it already.

Customer contact records are not customer login accounts. Admin identities are separate. Market (AO/PT) is independent of language (PT/EN). A deployed feature is not automatically approved for commercial use.

Schema changes can require the collection/global definition, generated Payload types, PostgreSQL migration and registry, SQLite synchronization, version tables, and frontend API types. Preserve the explicit `payload migrate` step in `npm start`; adapter configuration alone previously failed to apply production migrations.

Read [operations and recovery guidance](docs/operations-observability.md) for operational work. Client-facing handbooks live under `docs/client-delivery/`; do not replace them with engineering instructions.

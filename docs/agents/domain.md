# Domain documentation

Read root `CONTEXT.md`, then the shared platform glossary and decisions linked there. Keep CMS operational details in the existing runbooks. Cross-repository business decisions belong in the platform `docs/decisions/`, not in a competing CMS ADR tree.

Each repository uses a single-context layout. This workspace is two independent repositories, not a packages monorepo. Do not create a `CONTEXT-MAP.md` without an actual need.

Read `phase-1-closeout-baseline-2026-08-20.md` before relying on `phase-1-architecture-and-blockers.md`. The closeout baseline explicitly supersedes earlier payment, invoicing and launch assumptions. A newer file alone is not authority: look for approval and explicit supersession. Current user instructions take precedence for the authorized task; flag conflicting business decisions rather than silently rewriting them.

Use glossary terms consistently in specs, tickets, tests and reviews. Add unresolved concepts through `domain-modeling` only when needed. If an optional domain document is absent, continue with available evidence and do not invent its contents.

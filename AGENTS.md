# CMS engineering guidance

Payload 3 + Next.js backend. SQLite is local; PostgreSQL is used on Railway. The customer storefront and custom admin live in the separate platform repository.

## Read first

Read `CONTEXT.md`, then `docs/agents/domain.md` and the decisions relevant to the task. The approved Phase 1 closeout baseline supersedes older architecture and README assumptions where explicitly stated. Distinguish implemented, enabled, approved and live behavior.

## Commands

`npm ci`; `npm run dev`; `npm run verify`. `npm run dev` synchronizes an existing local SQLite schema; it does not bootstrap a blank database. `TEST_POSTGRES_URL=<disposable database URL> npm run test:migrations:postgres` runs real PostgreSQL tests and requires permission to create/drop temporary databases. `npm run test:sqlite` runs isolated SQLite coverage.

## Working rules

- Inspect Git status and preserve unrelated edits. Use a feature branch for new work unless the user explicitly requests another branch. Never force-push or rewrite shared history as a routine step.
- Honor the user's requested delivery scope. A local preview request is not a push/deploy request; skill defaults to commit do not override user instructions. Report what was actually committed, pushed and verified.
- For a small visual edit: implement, inspect the affected breakpoints and run relevant checks. Avoid speculative abstractions and tests that merely assert copied source text.
- For a substantive feature: use `grill-with-docs`/`domain-modeling` when decisions are unresolved, then `to-spec`/`to-tickets` for multi-session work, and `implement`/`tdd` with a final `code-review` as appropriate. Use `diagnosing-bugs` for reproducible failures. Do not invoke overlapping workflows together by default.
- Use the existing theme and accepted mobile behavior. Use `prototype` only when explicitly requested for visual alternatives. Accounts and other Stage 2 features remain outside unrelated tasks.
- Verify behavior at the affected interface. Prefer totals, inventory, payment idempotency, ownership, and admin save/reload tests over source-pattern checks. Report skipped tests and unverified deployment state.
- Follow `docs/agents/cms-storefront-changes.md` for schema/API work and `docs/agents/verification-and-release.md` for release work. Never use production credentials/data for tests or publish messages during verification.

## Agent skills

### Issue tracker

Linear is the existing shared tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the configured canonical role mapping, checking existing Linear labels before writes. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context per repository; the platform owns the shared glossary and decisions. See `docs/agents/domain.md`.

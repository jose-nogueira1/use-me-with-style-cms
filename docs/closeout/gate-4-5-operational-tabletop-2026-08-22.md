# Gate 4.5 — Operational response tabletop

Date: 2026-08-22

Technical and infrastructure owner: José

Client operations owner and authority to pause sales: Raisa

Emergency escalation: José ↔ Raisa WhatsApp conversation

Shared alert mailbox: `usemewithstyle.master@gmail.com`

## Decision

**PASS.** The incident routes, owners, detection signals, recovery actions, and sales-pause authority are defined and backed by working production monitoring. No deliberate production outage was introduced during this tabletop.

The exercise exposed one real monitoring defect: GitHub Actions was starting the nominal five-minute inventory heartbeat approximately every 25–35 minutes, while the operations monitor treated a heartbeat older than 15 minutes as stale. Successful cleanup runs therefore generated false alerts.

The freshness window was corrected to 45 minutes in PR #37 (`1f06c7accee4f6a9a2b8292f563d0475a01f89eb`). The monitor remains fail-closed beyond that window. Boundary tests pass, and production monitor run `32568633165` passed after merge.

## Live evidence

- Production operations monitor: successful on 2026-08-22, run `32568633165`.
- Checks passed: apex/AO/PT storefronts, public CMS API, Meta webhook verification, and inventory heartbeat.
- Heartbeat age at the passing run: 1,258 seconds.
- Latest five inspected inventory-cleanup heartbeat runs: successful.
- Latest inspected email-delivery canary: successful.
- Alert routing remains `usemewithstyle.master@gmail.com`; José and Raisa both control the mailbox.
- The prior controlled missed-heartbeat rehearsal confirmed that a failed check sends an alert and exits unsuccessfully.

## Tabletop scenarios

| Scenario | Detection | Immediate technical response | Operations decision and escalation | Recovery evidence |
| --- | --- | --- | --- | --- |
| Storefront outage | Production monitor fails the apex, AO, or PT HTML check; GitHub failure is the fallback signal if email delivery also fails. | José confirms scope across all three storefront URLs, checks Vercel deployment and runtime logs, and rolls back or restores the last known-good deployment when appropriate. | José informs Raisa through their WhatsApp conversation. Raisa decides whether sales must be paused and communicates the operational response. | Storefront health checks return HTML/HTTP 200 and a fresh monitor run succeeds. |
| CMS/admin outage | Public CMS API check fails, storefront content requests fail, or the admin cannot load operational data. | José checks Railway service health and logs, database connectivity, environment configuration, and the last successful deployment. If data recovery is required, José uses the encrypted daily backup and verified restore procedure. | José informs Raisa immediately because catalogue, order, and inventory operations may be unavailable. Raisa may pause sales. | CMS API succeeds, admin access and representative reads pass, and database integrity is confirmed. |
| Email failure | Daily canary is absent or fails; application email delivery errors appear; the operations monitor alert may fall back to the GitHub failure notification. | José checks Resend status, sender-domain/DNS state, API configuration, and recent application logs. Order state remains authoritative in the admin while delivery is restored. | José and Raisa monitor the shared master mailbox and coordinate through WhatsApp. Raisa handles any required customer follow-up. | Canary and controlled template email are received, and application logs show provider acceptance. |
| Meta webhook failure | Webhook verification check fails or inbound/outbound messaging stops. | José checks Meta app/webhook status, verification configuration, token validity, and CMS webhook logs. Token renewal remains a documented manual procedure. | José informs Raisa; messaging is treated as unavailable until a verified round trip succeeds. This does not alter the Phase 1 checkout fallback. | Verification handshake passes and, when separately authorized, a controlled inbound/outbound message succeeds. |
| Missed inventory-cleanup heartbeat | No successful independent GitHub heartbeat for more than 45 minutes, or the Railway cleanup endpoint reports failure. | José checks the Railway scheduler and GitHub run, then executes the documented cleanup command with the production secret if required. He verifies released-reservation counts and inventory consistency. | José informs Raisa if reservations or saleable stock may be affected. Raisa may pause sales until reconciliation is complete. | Cleanup endpoint succeeds, a new heartbeat completes, monitor returns green, and affected stock is reconciled. |

## Sales-pause rule

Raisa alone has authority to pause sales. José owns the technical investigation and supplies the impact assessment. The default escalation route is the direct José–Raisa WhatsApp conversation. A pause is recommended when checkout integrity, order capture, inventory accuracy, or recoverability cannot be demonstrated; a content-only degradation can remain live if purchasing and fulfilment remain safe.

## Recovery ownership and continuity

- José owns storefront, CMS, email/webhook, and inventory-heartbeat technical response.
- Raisa owns client operations and the sales-pause decision.
- José and Raisa both control Namecheap, AppyPay, Meta/Instagram, Resend, Cloudflare/R2, Railway, and the shared master mailbox.
- José controls Vercel and GitHub.
- PostgreSQL recovery target: 30-minute operational RTO and 24-hour RPO, supported by the verified encrypted backup rehearsal.
- Cloudflare R2 recovery was previously verified by upload, restore, checksum comparison, and exact cleanup.

## Verification performed

- `node --test tests/operationsMonitor.test.mjs`: 5 passed.
- ESLint for the monitor and regression tests: passed.
- PR #37 merged to `main`.
- Production operations monitor run `32568633165`: passed.

## Deferred / excluded

Gate 4.4 live Instagram messaging UAT remains explicitly unauthorized and untested. It is not represented as a pass in this evidence.

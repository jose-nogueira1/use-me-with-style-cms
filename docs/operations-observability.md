# Operations and observability

The CMS emits structured JSON-compatible events for payment failures, public order lookups, rate limits, and inventory reservation cleanup. Logs deliberately exclude customer email addresses, phone numbers, addresses, payment secrets, and full request bodies.

## Inventory cleanup

The repository includes the one-shot command `npm run cron:release-inventory`. It calls `POST /api/inventory/release-expired` with `Authorization: Bearer <CRON_SECRET>`, validates the response, emits a structured completion/failure event, and exits. The task is idempotent: it only releases active reservations whose expiry has passed. An authenticated Payload administrator may also run the endpoint manually.

### Railway configuration

Create a second Railway service from this same GitHub repository. It is a short-lived scheduled service, not another web server:

1. Set its custom start command to `npm run cron:release-inventory`.
2. Set its cron schedule to `*/5 * * * *` (Railway evaluates this in UTC and supports a minimum five-minute interval).
3. Add `PAYLOAD_PUBLIC_SERVER_URL=https://use-me-with-style-cms-production.up.railway.app`.
4. Generate a long random `CRON_SECRET` and set the identical value on the CMS web service and this scheduled service.
5. Do not assign the scheduled service a public domain.

The command terminates after every run, as required by Railway scheduled services. A non-2xx response, timeout, missing variable, or malformed response exits unsuccessfully so Railway records a failed deployment run. Alert when `inventory_cleanup_cron_failed` or `inventory_reservation_cleanup_failed` appears, or when the scheduled request does not produce a success event for 15 minutes.

If Railway reports that a deployment failed before initialization or build began, check the Railway status page before changing application code. After the provider incident clears, trigger a fresh deployment of the unchanged verified revision.

### Independent heartbeat monitor

The Railway job remains the primary five-minute cleanup scheduler. GitHub Actions provides an independent five-minute heartbeat using `.github/workflows/inventory-cleanup-heartbeat.yml`; the cleanup endpoint is idempotent, so this safely provides both a second execution path and durable success-run evidence. `.github/workflows/operations-monitor.yml` checks that a successful heartbeat exists within the last 15 minutes. A controlled missed-heartbeat alert can be rehearsed with the workflow-dispatch input without disabling production cleanup.

The production monitor also checks the root, Angola, and Portugal storefronts, the CMS content endpoint, and the Meta webhook verification handshake every 15 minutes. Failures are sent to the shared operations mailbox. GitHub records the workflow failure as the fallback signal if Resend itself is unavailable. `.github/workflows/email-delivery-canary.yml` sends a daily canary to exercise Resend independently of customer orders.

Required GitHub configuration:

- Secrets: `CRON_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DATABASE_PUBLIC_URL`, `BACKUP_ENCRYPTION_PASSPHRASE`.
- Variable: `OPS_ALERT_EMAIL`.
- Alert mailbox: `usemewithstyle.master@gmail.com`, controlled by José and Raisa.

## Database backup retention

`.github/workflows/database-backup.yml` creates a PostgreSQL 18 custom-format logical dump every day at 02:20 UTC, validates its restore manifest, encrypts it with AES-256-CBC/PBKDF2, removes the plaintext, and retains the encrypted artifact for 14 days. This provides a 24-hour operational RPO. The Gate 3 isolated restore rehearsal measured a 205-second database restore; allow a 30-minute operational RTO for download, decryption, provisioning, restore, validation, and DNS/application recovery steps.

The backup passphrase is stored as a GitHub Actions secret and in José's macOS Keychain. Never paste it into tickets, documentation, chat, or workflow logs. A restore must target a newly created isolated database first; compare table row-count evidence before any production recovery decision.

## Recommended alerts

- Any `inventory_reservation_cleanup_failed` event: page the operator.
- Five or more payment endpoint failures in ten minutes: urgent notification.
- Sustained `order_lookup_rate_limited` volume: investigate abusive traffic and consider a shared rate-limit store.
- No successful cleanup heartbeat for 15 minutes: verify the scheduler and CMS availability.

Use `requestId` to correlate a browser/deployment request with server logs. `durationMs` supports basic latency monitoring without recording customer data.

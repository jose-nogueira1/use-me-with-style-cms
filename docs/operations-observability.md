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

## Recommended alerts

- Any `inventory_reservation_cleanup_failed` event: page the operator.
- Five or more payment endpoint failures in ten minutes: urgent notification.
- Sustained `order_lookup_rate_limited` volume: investigate abusive traffic and consider a shared rate-limit store.
- No successful cleanup heartbeat for 15 minutes: verify the scheduler and CMS availability.

Use `requestId` to correlate a browser/deployment request with server logs. `durationMs` supports basic latency monitoring without recording customer data.

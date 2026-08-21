# Gate 3 — Production resilience evidence

Date: 2026-08-21

Technical operator: José

Client operations owner: Raisa

Alert mailbox: `usemewithstyle.master@gmail.com` (José and Raisa)

Emergency escalation: José ↔ Raisa WhatsApp conversation

## Decision

**Conditional GO.** Recovery rehearsals, production endpoint checks, alert simulation, monitoring code, and ownership attestation pass. Convert this to final GO after:

1. the feature branch is merged to `main` and all four GitHub workflows are dispatched successfully; and
2. José confirms receipt of the three Resend template tests, the shared-mailbox alert rehearsal, and the email canary.

No production customer record, inventory quantity, media object, or database was overwritten during these rehearsals.

## 4.1 Resend and mailbox operation

- Production Resend configuration accepted one real order-confirmation email, one order-status email, and one contact auto-reply addressed to José at `jose.nogueira.working@gmail.com`.
- Resend also accepted a controlled missed-heartbeat alert and a daily-canary sample addressed to `usemewithstyle.master@gmail.com`.
- The production API key is send-only: message creation succeeds, while email-detail lookup returns HTTP 401. This prevents the application credential from reading account email history. Inbox receipt is therefore a manual closeout confirmation.
- Raisa will monitor `support@usemewithstyle.shop` and `orders@usemewithstyle.shop` at delivery. José monitors them until delivery. José and Raisa both own mailbox recovery.
- Daily canary workflow: `.github/workflows/email-delivery-canary.yml`.

## 4.2 Cloudflare R2 recovery rehearsal

- Timestamp: `2026-08-21T13:45:29.104Z`.
- Scope: exact temporary prefix `_gate3-recovery-test/2026-08-21T13-45-29-104Z/` in the production bucket.
- Test payload: 65,536 random bytes.
- Source, downloaded, and recovered SHA-256: `cdf037296588efb58a7fcb275d53c0ccb6a642010522bc017976194b4618872d`.
- Result: upload, download, second-key restore, and checksum comparison passed.
- Cleanup: both exact test objects were deleted; subsequent reads returned not found. No rehearsal objects remain.

## 4.3 PostgreSQL backup and restore rehearsal

- Source: Railway production PostgreSQL 18.
- Isolation: new database `gate3_restore_20260821`; production database was read only.
- Dump duration: 42 seconds.
- Restore duration: 205 seconds.
- Restored evidence: 64 public tables, 824 total rows.
- Source/restored row-count evidence SHA-256: `0a2e3615c8ff86e46a7bd36ae7ebc0b4c6c35450c9527ae6d630883cc0585217`.
- Plain logical-dump SHA-256: `1e12abbab6affd881bcd7080865d5fe099eec5bc67a5df78dbd9904e6bef213b`.
- Local retained backup: `/Users/josenogueira/Documents/UseMeBackups/UseMeWithStyle-postgres-20260821T140829Z.dump.enc`.
- Encrypted-backup SHA-256: `f306a7bd7b30f49e0c00a0d66af3026babfb3bfacea00e36f1b9de13766e66c9`.
- Local file permission: owner read/write only (`0600`); encryption key stored in José's macOS Keychain.
- Cleanup: scratch database dropped after integrity comparison; absence verified.
- Scheduled retention: daily encrypted GitHub artifact, 14-day retention, in `.github/workflows/database-backup.yml`.
- Operational RPO: 24 hours.
- Operational RTO: 30 minutes (measured restore is 205 seconds; allowance covers artifact retrieval, decryption, provisioning, validation, and application recovery).
- Recovery operator: José. Raisa can escalate through the shared WhatsApp channel and has Railway control.

## 4.4 Inventory-cleanup heartbeat

- Railway primary scheduler: every five minutes.
- Three consecutive production endpoint rehearsals passed:
  - run 1: 851 ms, 0 expired reservations released;
  - run 2: 559 ms, 0 expired reservations released;
  - run 3: 627 ms, 0 expired reservations released.
- Independent heartbeat workflow: `.github/workflows/inventory-cleanup-heartbeat.yml`, every five minutes.
- Stale-heartbeat monitor: `.github/workflows/operations-monitor.yml`, 15-minute threshold.
- Controlled missed-heartbeat rehearsal: platform checks passed, the simulated heartbeat failed closed, and Resend accepted the alert to the shared mailbox.
- Recovery command: `PAYLOAD_PUBLIC_SERVER_URL=https://cms.usemewithstyle.shop npm run cron:release-inventory` with the production `CRON_SECRET` supplied securely.

## 4.5 Monitoring and alert routing

The independent production monitor covers:

- apex, Angola, and Portugal storefront availability;
- public CMS content availability;
- Meta/Instagram webhook verification handshake using the configured verification token;
- inventory-cleanup heartbeat freshness;
- inventory-cleanup execution failure; and
- a daily Resend canary.

Failure email destination: `usemewithstyle.master@gmail.com`. GitHub workflow failure is the fallback signal if Resend itself is unavailable.

Controlled live check result on 2026-08-21:

- 3 storefronts: passed;
- CMS: passed;
- Meta webhook handshake: passed;
- simulated missed heartbeat: detected;
- alert email API acceptance: passed.

## 4.6 Ownership and recovery attestation

| System | Confirmed control | Recovery / response owner |
| --- | --- | --- |
| Namecheap | José and Raisa | José technical; Raisa launch authority |
| AppyPay | José and Raisa | José technical; Raisa sales authority |
| Meta / Instagram | José and Raisa | José technical; shared operations escalation |
| Resend | José and Raisa | José technical; shared master mailbox |
| Cloudflare / R2 | José and Raisa | José recovery operator |
| Railway / PostgreSQL | José and Raisa | José recovery operator |
| Vercel | José | José |
| GitHub | José | José |

Raisa holds authority to pause sales. José owns storefront, CMS, email/webhook, and missed-heartbeat incident response. José explicitly accepted the current continuity model; delivery approval remains with Raisa.

## Secret-handling record

- No credential value is committed in this repository or this evidence record.
- GitHub Actions secrets configured: `CRON_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DATABASE_PUBLIC_URL`, `BACKUP_ENCRYPTION_PASSPHRASE`.
- GitHub Actions variable configured: `OPS_ALERT_EMAIL`.
- Backup passphrases are stored in GitHub Actions secrets and José's macOS Keychain, not in documentation.

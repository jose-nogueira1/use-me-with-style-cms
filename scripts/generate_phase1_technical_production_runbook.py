from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/Use_Me_With_Style_Phase_1_Technical_Production_Runbook.pdf"
LOGO = ROOT / "src/assets/use-me-logo-black-transparent.png"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")

GOLD = colors.HexColor("#B58A25")
GOLD_DARK = colors.HexColor("#755719")
INK = colors.HexColor("#171411")
SOFT = colors.HexColor("#6D675F")
PAPER = colors.HexColor("#FBF8F1")
RULE = colors.HexColor("#DDCFB0")
GREEN = colors.HexColor("#376A46")
RED = colors.HexColor("#9B3B32")
BLUE = colors.HexColor("#315D7A")


pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))
pdfmetrics.registerFont(TTFont("CourierNew", str(FONT_DIR / "Courier New.ttf")))

styles = getSampleStyleSheet()
body = ParagraphStyle("body", fontName="Arial", fontSize=8.8, leading=12.6, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.3, leading=9.8, textColor=SOFT)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=9)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=7, spaceAfter=7)
h3 = ParagraphStyle("h3", fontName="Arial-Bold", fontSize=10.5, leading=14, textColor=GOLD_DARK, spaceBefore=5, spaceAfter=4)
label = ParagraphStyle("label", fontName="Arial-Bold", fontSize=7, leading=9, textColor=GOLD_DARK)
cover_title = ParagraphStyle("cover", fontName="Arial-Bold", fontSize=24, leading=29, alignment=TA_CENTER, textColor=INK)
cover_sub = ParagraphStyle("cover_sub", fontName="Arial-Bold", fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=GOLD_DARK)
code_style = ParagraphStyle("code", fontName="CourierNew", fontSize=6.7, leading=9, textColor=INK)


def P(text, style=body):
    return Paragraph(text, style)


def bullets(items):
    out = []
    for item in items:
        out.append(Table([[P("•", body), P(item, body)]], colWidths=[5 * mm, 165 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return out


def steps(items):
    out = []
    for i, item in enumerate(items, 1):
        out.append(Table([[P(str(i), label), P(item, body)]], colWidths=[8 * mm, 162 * mm], style=[
            ("BACKGROUND", (0, 0), (0, 0), PAPER), ("BOX", (0, 0), (0, 0), .5, RULE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        out.append(Spacer(1, 2))
    return out


def callout(title, text, tone="gold"):
    palette = {
        "gold": (PAPER, GOLD_DARK, RULE), "green": (colors.HexColor("#EEF6F0"), GREEN, colors.HexColor("#B8D3BF")),
        "red": (colors.HexColor("#FBEFEE"), RED, colors.HexColor("#DEB8B4")), "blue": (colors.HexColor("#EDF4F8"), BLUE, colors.HexColor("#B8CAD5")),
    }
    bg, fg, border = palette[tone]
    return Table([[P(title.upper(), ParagraphStyle("co_l", parent=label, textColor=fg)), P(text, ParagraphStyle("co_b", parent=body, textColor=fg, spaceAfter=0))]], colWidths=[32 * mm, 138 * mm], style=[
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), .7, border),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])


def code(text):
    return Table([[Preformatted(text, code_style)]], colWidths=[170 * mm], style=[
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F2EFE9")), ("BOX", (0, 0), (-1, -1), .5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])


def table(headers, rows, widths):
    data = [[P(x, ParagraphStyle("th", parent=label, textColor=colors.white)) for x in headers]]
    data += [[P(str(x), small) for x in row] for row in rows]
    return Table(data, colWidths=widths, repeatRows=1, style=[
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("GRID", (0, 0), (-1, -1), .45, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def header_footer(canvas, doc):
    canvas.saveState(); w, h = A4
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(.8); canvas.line(18 * mm, h - 15 * mm, w - 18 * mm, h - 15 * mm)
    canvas.setFont("Arial", 7); canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - PHASE 1 TECHNICAL PRODUCTION RUNBOOK")
    canvas.drawRightString(w - 18 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def page(title, intro=None):
    out = [P(title, h1)]
    if intro: out += [P(intro, body), Spacer(1, 3)]
    return out


def build_story():
    s = [Spacer(1, 16 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
         P("CONTROLLED TECHNICAL RECORD", cover_sub), Spacer(1, 4 * mm),
         P("Technical Production<br/>Runbook - Phase 1", cover_title), Spacer(1, 4 * mm),
         P("Deployment, recovery, monitoring and incident response", cover_sub), Spacer(1, 13 * mm)]
    s += [table(["Field", "Controlled value"], [
        ("Document ID", "UMWS-P1-TR-001"), ("Version", "1.0"), ("Issue date", "22 August 2026"),
        ("Technical owner", "Jose"), ("Client operations owner", "Raisa"),
        ("Sales-pause authority", "Raisa"), ("Emergency channel", "Direct Jose-Raisa WhatsApp conversation"),
        ("Classification", "Operational - contains no secret values"),
    ], [43 * mm, 127 * mm]), Spacer(1, 8 * mm),
         callout("Safety rule", "This runbook identifies systems, commands and recovery controls but never contains passwords, tokens, private keys, recovery codes or full database connection strings. Retrieve secrets only from the approved secret store at execution time.", "red"),
         Spacer(1, 7 * mm), P("Runbook objectives", h2)]
    s += bullets(["Restore safe customer and administrator operation without undocumented developer knowledge.", "Prefer reversible actions and isolate recovery tests before production changes.", "Preserve evidence, release identifiers and an incident timeline.", "Separate technical response (Jose) from the sales-pause decision (Raisa)."])
    s += [PageBreak()]

    s += page("1. Production topology and ownership")
    s += [table(["Component", "Production position", "Control / owner"], [
        ("Storefront", "Vercel; apex, AO and PT hosts", "Jose controls Vercel and GitHub"),
        ("CMS and admin", "Railway; cms.usemewithstyle.shop", "Jose and Raisa control Railway; Jose responds"),
        ("Database", "Railway PostgreSQL 18", "Jose recovery operator; Raisa can escalate"),
        ("Media", "Cloudflare R2 / S3-compatible storage", "Jose recovery operator; shared account control"),
        ("Email", "Resend; support/orders sender domain", "Jose technical; shared recovery and mailbox"),
        ("Messaging", "Meta / Instagram webhook and API", "Shared account control; Jose technical"),
        ("DNS", "Namecheap", "Jose and Raisa"),
        ("Monitoring", "GitHub Actions and shared operations mailbox", "Jose response; Jose and Raisa monitor mailbox"),
    ], [34 * mm, 76 * mm, 60 * mm])]
    s += [P("Production hosts", h2)] + bullets(["https://usemewithstyle.shop - geo-routing entry point.", "https://ao.usemewithstyle.shop - Angola catalogue and checkout.", "https://pt.usemewithstyle.shop - Portugal catalogue and checkout.", "https://cms.usemewithstyle.shop - Payload CMS and API."])
    s += [P("Current release model", h2), P("Phase 1 uses one focused feature branch per repository, pull-request review, verified merge to main and production verification. Vercel and Railway deploy from their connected repositories. A separate persistent staging environment is a Phase 2 delivery-control improvement; production recovery must therefore rely on verified commits, provider deployment history and isolated data restoration.")]
    s += [PageBreak()]

    s += page("2. Release and deployment procedure")
    s += [P("Pre-deployment gate", h2)] + bullets(["Confirm scope and authorized change owner.", "Confirm focused branch and clean worktree; preserve unrelated local files.", "Run repository-specific lint, tests and production build.", "Review migration and environment-variable impact.", "Record current main commit and current healthy deployment before merge."])
    s += [P("Platform release", h2)] + steps([
        "Create a focused branch from current main in use-me-with-style-platform.",
        "Implement and verify locally. Run npm test, npm run lint and npm run build unless the change has a stricter test plan.",
        "Push the branch, open a pull request and review the exact diff and CI results.",
        "Merge only after checks pass. Confirm Vercel production deployment is READY and tied to the expected main commit.",
        "Verify apex, AO, PT, representative catalogue/product pages, admin login boundary and same-origin API reads.",
    ])
    s += [P("CMS release", h2)] + steps([
        "Create a focused branch from current main in use-me-with-style-cms.",
        "Run the relevant tests, npm run lint and npm run build. Review Payload migration and PostgreSQL effects.",
        "Push, open a pull request and merge only after verification.",
        "Confirm Railway deployment success for the expected main commit and inspect startup/migration logs.",
        "Verify the public CMS endpoint, admin access, representative product/category reads and dependent storefront calls.",
    ])
    s += [callout("Schema warning", "Do not roll application code backward across an incompatible database migration. Determine migration compatibility and preserve a verified backup before any schema-affecting release or rollback.", "red")]
    s += [PageBreak()]

    s += page("3. Post-deployment validation and rollback")
    s += [P("Minimum validation", h2), code("curl -fsS https://usemewithstyle.shop/ >/dev/null\ncurl -fsS https://ao.usemewithstyle.shop/ >/dev/null\ncurl -fsS https://pt.usemewithstyle.shop/ >/dev/null\ncurl -fsS 'https://cms.usemewithstyle.shop/api/products?limit=1' >/dev/null")]
    s += bullets(["Confirm Vercel/Railway deployment status and expected Git commit.", "Run the production operations monitor from GitHub Actions and require a green result.", "Exercise only safe representative reads unless a controlled UAT mutation was authorized.", "Record timestamp, commit, deployment URL/ID, checks and operator."])
    s += [P("Rollback decision", h2), table(["Condition", "Preferred action"], [
        ("Frontend regression; CMS/data healthy", "Promote/redeploy the last known-good Vercel deployment or revert the offending commit through a focused PR."),
        ("CMS code regression; schema compatible", "Redeploy the prior known-good Railway revision or revert through a focused PR, then verify CMS and storefront reads."),
        ("Schema or data may have changed", "Pause. Preserve evidence and backup. Restore into an isolated database first; do not blindly redeploy older code."),
        ("Provider outage", "Do not change verified application code. Confirm provider status and use the documented fallback/operational communication."),
    ], [62 * mm, 108 * mm])]
    s += [P("Rollback completion", h3)] + bullets(["Expected release is active.", "Production monitor passes.", "Representative customer and admin paths pass.", "Database and inventory integrity are confirmed.", "Raisa receives status and decides whether sales resume."])
    s += [PageBreak()]

    s += page("4. PostgreSQL backup and isolated restore")
    s += [P("Backup control", h2), P("GitHub workflow PostgreSQL encrypted backup runs daily at 02:20 UTC. It creates a PostgreSQL 18 custom-format dump, validates the restore manifest, encrypts it with AES-256-CBC/PBKDF2 (200,000 iterations), deletes plaintext and retains the encrypted artifact for 14 days. Operational targets: RPO 24 hours; RTO 30 minutes.")]
    s += [P("Restore preconditions", h2)] + bullets(["Jose is the recovery operator.", "Download the exact successful artifact and record its workflow run and SHA-256.", "Retrieve the passphrase from the approved secret store; never paste it into a command history, ticket or chat.", "Provision a new isolated PostgreSQL database. Never test the restore over production."])
    s += [P("Isolated restore skeleton", h2), code("# Set values in the current protected shell; do not log them.\nopenssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \\\n  -in useme-postgres-RUN_ID.dump.enc -out restore.dump \\\n  -pass env:BACKUP_ENCRYPTION_PASSPHRASE\n\npg_restore --list restore.dump >/dev/null\npg_restore --no-owner --no-privileges \\\n  --dbname=\"$ISOLATED_DATABASE_URL\" restore.dump")]
    s += [P("Validation", h3)] + bullets(["Compare expected table count and representative row counts with preserved source evidence.", "Run application read checks against the isolated database only.", "Confirm no production connection string was used.", "Remove plaintext dump securely after the controlled exercise; retain only approved encrypted evidence."])
    s += [callout("Production recovery", "Replacing or redirecting the production database requires a separate incident decision, a verified isolated restore, an impact assessment and Raisa's sales-pause/resume decision. Never point production at an unverified restore.", "red")]
    s += [PageBreak()]

    s += page("5. Cloudflare R2 media recovery")
    s += [P("Scope", h2), P("Media recovery is key-specific. The Gate 3 rehearsal proved upload, download, second-key recovery, checksum equality and exact cleanup. A recovery must never use a broad prefix deletion or overwrite an existing object without explicit validation.")]
    s += [P("Safe recovery sequence", h2)] + steps([
        "Identify the exact missing or corrupted media record, expected R2 bucket/key, database reference and affected pages.",
        "Perform read-only HEAD/GET checks for that exact key. Detect redirects, unexpected content type and zero-length data.",
        "Locate the approved source: retained original, verified backup copy or known-good object. Calculate and record SHA-256.",
        "Upload first to a unique temporary recovery key under a controlled _recovery-test/ prefix.",
        "Download the temporary object, compare SHA-256 and visually inspect the image.",
        "Only if the production key is confirmed absent, upload/copy the verified object to that exact key. If a conflicting object exists, stop and escalate instead of overwriting.",
        "Verify the CMS URL and every known storefront use. Delete only the exact temporary key and confirm its absence.",
    ])
    s += [P("Evidence record", h2)] + bullets(["Timestamp, operator, bucket and redacted key reference.", "Source and recovered SHA-256.", "Exact temporary key and cleanup confirmation.", "Affected CMS record and storefront validation.", "No credentials or signed URLs retained in evidence."])
    s += [PageBreak()]

    s += page("6. Inventory reservation cleanup and heartbeat")
    s += [P("Execution paths", h2), table(["Path", "Schedule", "Purpose"], [
        ("Railway scheduled service", "Every 5 minutes", "Primary npm run cron:release-inventory execution."),
        ("GitHub inventory heartbeat", "Nominally every 5 minutes", "Independent idempotent execution and durable run evidence."),
        ("Operations monitor", "Every 15 minutes", "Checks platform health and heartbeat freshness."),
    ], [55 * mm, 40 * mm, 75 * mm])]
    s += [callout("Authoritative threshold", "Alert when the latest successful independent heartbeat is more than 45 minutes old. The older 15-minute wording is superseded because GitHub scheduled runs were observed 25-35 minutes late. The monitor remains fail-closed beyond 45 minutes.", "blue")]
    s += [P("Manual recovery command", h2), code("PAYLOAD_PUBLIC_SERVER_URL=https://cms.usemewithstyle.shop \\\nCRON_SECRET=\"$CRON_SECRET\" npm run cron:release-inventory")]
    s += [P("Response procedure", h2)] + steps([
        "Check the latest Railway scheduler and GitHub heartbeat runs; distinguish provider delay from endpoint failure.",
        "Check CMS availability and structured cleanup failure events.",
        "If required, execute the manual command once with the secret supplied securely.",
        "Record released-reservation count and reconcile any affected saleable stock.",
        "Run/confirm a fresh heartbeat and production monitor. Inform Raisa if stock integrity was uncertain.",
    ])
    s += [PageBreak()]

    s += page("7. Monitoring, alerting and email canary")
    s += [table(["Control", "Frequency", "Success condition"], [
        ("Production operations monitor", "15 minutes", "Apex/AO/PT HTML, CMS API, Meta webhook handshake and heartbeat all pass."),
        ("Inventory cleanup heartbeat", "Nominal 5 minutes", "Cleanup endpoint succeeds; run evidence retained."),
        ("Email delivery canary", "Daily 08:15 UTC", "Resend accepts canary to shared operations mailbox and message is received."),
        ("Database backup", "Daily 02:20 UTC", "Encrypted artifact uploaded; manifest validation passed."),
    ], [55 * mm, 35 * mm, 80 * mm])]
    s += [P("Alert routing", h2)] + bullets(["Primary mailbox: usemewithstyle.master@gmail.com, controlled by Jose and Raisa.", "GitHub workflow failure is the fallback signal when Resend itself is unavailable.", "Jose responds to storefront, CMS, email/webhook and missed-heartbeat incidents.", "Raisa controls the sales-pause decision and customer operations response."])
    s += [P("Controlled monitor run", h2), code("# GitHub UI: Actions > Production operations monitor > Run workflow\n# Normal check: simulate_missed_heartbeat = false\n# Alert rehearsal only: true, with owner authorization")]
    s += [callout("Do not silence", "Do not disable a failing check merely to make the dashboard green. Identify provider delay, configuration drift or application failure, document the disposition and restore a meaningful signal.", "red")]
    s += [PageBreak()]

    s += page("8. Email and sender-domain incident procedure")
    s += [P("Detection", h2)] + bullets(["Daily canary missing or GitHub canary workflow failed.", "Application logs show provider rejection or template delivery error.", "Customer reports non-receipt across multiple messages.", "Resend sender-domain or DNS status is no longer verified."])
    s += [P("Response", h2)] + steps([
        "Treat the admin order record as authoritative; do not repeat order status transitions solely to resend email.",
        "Check Resend service status, sender-domain verification and the production API configuration.",
        "Check Namecheap DNS records without editing until the expected/current values are compared.",
        "Inspect sanitized application and GitHub workflow logs; never expose recipient data or API keys.",
        "Send a controlled canary and one authorized template test to Jose.",
        "Require provider acceptance and real mailbox receipt before closure. Raisa coordinates any manual customer follow-up.",
    ])
    s += [P("Closure evidence", h2)] + bullets(["Canary workflow run ID and timestamp.", "Sender domain verified.", "Authorized template types received.", "No repeated financial/order mutation used as a resend mechanism."])
    s += [PageBreak()]

    s += page("9. Meta / Instagram webhook and token operations")
    s += [P("Monitoring boundary", h2), P("The production monitor verifies the Meta webhook handshake. Live inbound/outbound messaging requires a separately authorized controlled account test. If messaging is unavailable, treat the channel as down and use the approved operational fallback; do not claim a round trip passed without evidence.")]
    s += [P("Incident response", h2)] + steps([
        "Check Meta platform/app status and the production webhook configuration.",
        "Confirm the callback URL and verification token placement without exposing the token.",
        "Inspect CMS webhook logs for signature failure, invalid payload, permission or token errors.",
        "Check access-token validity, scopes, page/Instagram account association and expiry.",
        "After correction, require a passing verification handshake and, when authorized, one inbound/outbound round trip.",
    ])
    s += [P("Manual token rotation", h2)] + steps([
        "Schedule rotation before expiry and confirm Jose and Raisa retain Meta account recovery access.",
        "Generate/extend the token through the approved Meta procedure. Do not use the removed automatic renewal workflow.",
        "Update the token only in the approved production secret location. Never commit it or paste it into Notion, Linear, GitHub issues or chat.",
        "Redeploy/restart only the service that reads the secret, then verify handshake and authorized messaging.",
        "Revoke the prior token when safe and record date, owner, expiry and test result without recording the value.",
    ])
    s += [callout("Signature rule", "Webhook signatures must remain enforced. Never bypass signature verification to restore messaging; fix configuration or provider ownership instead.", "red")]
    s += [PageBreak()]

    s += page("10. Secret and environment-variable rotation")
    s += [P("Secret placement", h2), table(["Secret class", "Approved location", "Rule"], [
        ("Frontend public configuration", "Vercel environment variables with VITE_ prefix", "Browser-visible by design; never place server secrets here."),
        ("CMS/database/provider secrets", "Railway/Vercel server environment or GitHub Actions secrets", "Production values only in production scope."),
        ("Workflow configuration", "GitHub Actions secrets/variables", "Use secrets for credentials; variables only for non-secret routing values."),
        ("Backup passphrase", "GitHub Actions secret and Jose macOS Keychain", "Never document, log or message the value."),
    ], [47 * mm, 64 * mm, 59 * mm])]
    s += [P("Rotation sequence", h2)] + steps([
        "Identify owner, consumers, expiry and blast radius. Record the change window.",
        "Create the new credential with minimum required permissions.",
        "Update one controlled environment at a time and preserve the prior credential until verification when the provider supports overlap.",
        "Redeploy/restart affected services and run the relevant health/functional checks.",
        "Revoke the old credential, confirm monitoring remains green and update the no-secret access register metadata.",
    ])
    s += [callout("Emergency rotation", "If exposure is suspected, revoke first when continuing use creates greater risk, pause affected operations, rotate all dependent locations, inspect logs and preserve an incident record.", "red")]
    s += [PageBreak()]

    s += page("11. Incident severity, command and sales pause")
    s += [table(["Severity", "Definition / examples", "Required response"], [
        ("SEV-1 Critical", "Security/data exposure; order capture, payment confirmation or inventory integrity unsafe; storefront/CMS broadly unavailable.", "Immediate Jose-Raisa escalation. Raisa decides pause. Preserve evidence and restore from known-good state."),
        ("SEV-2 High", "Major workflow degraded; email, invoices, CMS or messaging unavailable but authoritative records remain safe.", "Jose investigates promptly; Raisa coordinates manual operations and decides whether scope requires pause."),
        ("SEV-3 Normal", "Limited presentation/content defect or non-critical operational issue.", "Record, prioritize and repair through normal focused-branch release."),
    ], [28 * mm, 86 * mm, 56 * mm])]
    s += [P("Incident command", h2)] + bullets(["Technical lead: Jose.", "Client operations lead and sole sales-pause authority: Raisa.", "Emergency channel: direct Jose-Raisa WhatsApp conversation.", "Shared evidence mailbox: usemewithstyle.master@gmail.com."])
    s += [P("Pause-sales recommendation triggers", h2)] + bullets(["Checkout or order capture cannot be trusted.", "Inventory accuracy cannot be demonstrated.", "Customer data may be exposed.", "Production cannot be monitored or safely recovered.", "CMS failure prevents safe order/catalogue operations."])
    s += [P("Resume criteria", h2)] + bullets(["Root cause contained or safe workaround approved.", "Relevant monitor and representative workflow pass.", "Data and stock integrity confirmed.", "Known-good release and evidence recorded.", "Raisa explicitly authorizes sales to resume."])
    s += [PageBreak()]

    s += page("12. Scenario runbooks")
    s += [table(["Scenario", "Technical response", "Recovery proof"], [
        ("Storefront outage", "Check all hosts, Vercel deployment/logs and CMS dependency. Promote/redeploy known-good release when appropriate.", "All storefront checks HTTP 200/HTML; monitor green; representative browse/cart path passes."),
        ("CMS/admin outage", "Check Railway service/logs, DB connectivity, env configuration and latest deploy. Use isolated restore procedure if data recovery is required.", "CMS API/admin/representative reads pass; DB integrity confirmed; monitor green."),
        ("Email failure", "Check Resend, sender DNS, API config and logs. Keep admin order state authoritative.", "Canary and authorized template received; provider acceptance recorded."),
        ("Meta webhook failure", "Check app/webhook, verification, signature logs, scopes and token validity.", "Handshake passes and authorized round trip passes when allowed."),
        ("Missed heartbeat", "Check Railway/GitHub scheduler, run cleanup once if needed and reconcile stock.", "Fresh heartbeat, successful cleanup and monitor green."),
        ("Media object loss", "Identify exact key, validate source/checksum via temporary key, restore only absent exact key.", "Checksum and visual validation pass; affected pages load; temporary key removed."),
    ], [35 * mm, 84 * mm, 51 * mm])]
    s += [P("Provider incident rule", h2), P("When Vercel, Railway, GitHub, Cloudflare, Resend or Meta reports a provider incident before application initialization or networking succeeds, preserve the verified application revision. Do not make speculative code changes. Re-run the unchanged deployment or monitor after the provider confirms recovery.")]
    s += [PageBreak()]

    s += page("13. Evidence, communication and closure")
    s += [P("Required incident record", h2)] + bullets(["Start/end timestamps and severity.", "Reporter, technical lead, operations lead and decision owner.", "Affected market, service, customers and business capability.", "Release commit/deployment ID and last known-good reference.", "Sanitized detection evidence and timeline of actions.", "Data/stock integrity checks, recovery proof and monitor run.", "Sales pause/resume decisions by Raisa.", "Follow-up owner and target phase/date."])
    s += [P("Communication rules", h2)] + bullets(["State verified facts, impact and next action; label assumptions.", "Do not expose secrets or unnecessary personal data.", "Do not tell customers payment or fiscal integrations are active when they are deferred.", "Use the direct Jose-Raisa WhatsApp channel for emergencies and the shared mailbox for durable alert evidence."])
    s += [P("Closure checklist", h2)] + bullets(["Service restored and representative functional checks pass.", "Monitoring is green and meaningful.", "Database, inventory and media integrity confirmed where relevant.", "Temporary recovery resources cleaned up exactly.", "Old/revoked credentials removed where relevant.", "Raisa authorizes sales resume if paused.", "Evidence and follow-up actions recorded."])
    s += [PageBreak()]

    s += page("14. Quick reference and acceptance")
    s += [table(["Control", "Current value"], [
        ("Storefront monitoring", "Apex, AO and PT every 15 minutes"),
        ("CMS monitoring", "Public CMS API every 15 minutes"),
        ("Inventory freshness", "Fail closed when successful heartbeat is older than 45 minutes"),
        ("Email canary", "Daily at 08:15 UTC"),
        ("Database backup", "Daily at 02:20 UTC; encrypted; 14-day retention"),
        ("Database targets", "RPO 24 hours; operational RTO 30 minutes"),
        ("Alert mailbox", "usemewithstyle.master@gmail.com"),
        ("Technical owner", "Jose"), ("Sales-pause authority", "Raisa"),
    ], [58 * mm, 112 * mm])]
    s += [P("Authoritative source records", h2)] + bullets(["CMS docs/operations-observability.md", "CMS Gate 3 production resilience evidence (21 Aug 2026)", "CMS Gate 4.5 operational tabletop evidence (22 Aug 2026)", "Platform docs/environments.md", "Platform docs/production-domain-cutover.md", "GitHub production workflow definitions on CMS main"])
    s += [Spacer(1, 4 * mm), callout("Owner test", "Jose is the runbook owner and has rehearsed the recovery controls documented by Gate 3 and Gate 4.5. Final pack approval belongs to Raisa. Training and formal sign-off remain Gate 5.7 / Gate 6 activities.", "green")]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=18 * mm,
                          title="Use Me With Style - Phase 1 Technical Production Runbook", author="Use Me With Style delivery team")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()

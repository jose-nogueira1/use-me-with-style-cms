from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer, Table


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/Use_Me_With_Style_Phase_1_Production_Account_and_Access_Register.pdf"
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

body = ParagraphStyle("body", fontName="Arial", fontSize=8.6, leading=12.2, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.1, leading=9.5, textColor=SOFT)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=9)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=7, spaceAfter=7)
h3 = ParagraphStyle("h3", fontName="Arial-Bold", fontSize=10.5, leading=14, textColor=GOLD_DARK, spaceBefore=5, spaceAfter=4)
label = ParagraphStyle("label", fontName="Arial-Bold", fontSize=6.8, leading=8.5, textColor=GOLD_DARK)
cover_title = ParagraphStyle("cover", fontName="Arial-Bold", fontSize=23, leading=28, alignment=TA_CENTER, textColor=INK)
cover_sub = ParagraphStyle("cover_sub", fontName="Arial-Bold", fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=GOLD_DARK)


def P(text, style=body):
    return Paragraph(text, style)


def bullets(items):
    return [Table([[P("•", body), P(item, body)]], colWidths=[5 * mm, 165 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP")]) for item in items]


def steps(items):
    out = []
    for i, item in enumerate(items, 1):
        out += [Table([[P(str(i), label), P(item, body)]], colWidths=[8 * mm, 162 * mm], style=[
            ("BACKGROUND", (0, 0), (0, 0), PAPER), ("BOX", (0, 0), (0, 0), .5, RULE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]), Spacer(1, 2)]
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


def table(headers, rows, widths, font=small):
    data = [[P(x, ParagraphStyle("th", parent=label, textColor=colors.white)) for x in headers]]
    data += [[P(str(x), font) for x in row] for row in rows]
    return Table(data, colWidths=widths, repeatRows=1, style=[
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("GRID", (0, 0), (-1, -1), .45, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5), ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def header_footer(canvas, doc):
    canvas.saveState(); w, h = A4
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(.8); canvas.line(18 * mm, h - 15 * mm, w - 18 * mm, h - 15 * mm)
    canvas.setFont("Arial", 7); canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - PHASE 1 PRODUCTION ACCOUNT AND ACCESS REGISTER")
    canvas.drawRightString(w - 18 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def page(title, intro=None):
    out = [P(title, h1)]
    if intro: out += [P(intro, body), Spacer(1, 3)]
    return out


def build_story():
    s = [Spacer(1, 16 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
         P("CONTROLLED NO-SECRET REGISTER", cover_sub), Spacer(1, 4 * mm),
         P("Production Account and<br/>Access Register - Phase 1", cover_title), Spacer(1, 4 * mm),
         P("Ownership, recovery and credential-control metadata", cover_sub), Spacer(1, 13 * mm)]
    s += [table(["Field", "Controlled value"], [
        ("Document ID", "UMWS-P1-AR-001"), ("Version", "1.0"), ("Issue date", "22 August 2026"),
        ("Register owners", "Jose and Raisa"), ("Business / client operations owner", "Raisa"),
        ("Technical / infrastructure owner", "Jose"), ("Final pack approver", "Raisa"),
        ("Classification", "Operational metadata only - no secret values"),
    ], [46 * mm, 124 * mm]), Spacer(1, 8 * mm),
         callout("Prohibited content", "This document must never contain passwords, API keys, access tokens, database URLs, private keys, recovery codes, one-time codes, signed URLs or backup passphrases. Those values remain only in the approved provider secret store or credential manager.", "red"),
         Spacer(1, 7 * mm), P("Register scope", h2)]
    s += bullets(["Identify the legal/business owner and authorized operators.", "Record billing/recovery routing without exposing secret values.", "Name 2FA/recovery custodians and collaboration boundaries.", "Record secret location by system, not the value.", "Define review, rotation, expiry and recovery-test expectations."])
    s += [PageBreak()]

    s += page("1. Control model and status vocabulary")
    s += [P("Confirmed continuity model", h2), table(["Responsibility", "Confirmed owner"], [
        ("Client operations", "Raisa"), ("Technical runbook and infrastructure response", "Jose"),
        ("Account register maintenance", "Jose and Raisa"), ("Authority to pause sales", "Raisa"),
        ("Emergency escalation", "Direct Jose-Raisa WhatsApp conversation"),
        ("Shared alert mailbox", "usemewithstyle.master@gmail.com - controlled by Jose and Raisa"),
    ], [70 * mm, 100 * mm])]
    s += [P("Register statuses", h2), table(["Status", "Meaning"], [
        ("Verified", "Control or recovery path was directly exercised or evidenced during Phase 1 closeout."),
        ("Owner-confirmed", "Jose and/or Raisa confirmed control; sensitive details are intentionally excluded."),
        ("Deferred activation", "Account/access exists or onboarding is controlled, but the production integration is not live in Phase 1."),
        ("Review required", "Ownership exists but metadata must be reconfirmed at the stated review trigger."),
    ], [45 * mm, 125 * mm])]
    s += [callout("Access principle", "Use named individual access and provider collaboration features wherever supported. Do not share a single password when a provider can grant separate authorized users.", "blue")]
    s += [P("Review triggers", h2)] + bullets(["Quarterly access review.", "Any staff, contractor or ownership change.", "Suspected exposure or device loss.", "Provider expiry notice or permission change.", "Before activating a deferred payment or fiscal integration.", "At the start and end of each project phase."])
    s += [PageBreak()]

    s += page("2. Core production infrastructure accounts")
    s += [table(["System", "Business / control owner", "Authorized operation", "2FA / recovery custodian", "Status"], [
        ("Namecheap", "Use Me With Style / Raisa; shared control", "Jose and Raisa", "Jose and Raisa; recovery details held in provider account", "Owner-confirmed; production DNS active"),
        ("Vercel", "Project controlled by Jose", "Jose", "Jose", "Verified through production deployments"),
        ("Railway", "Use Me With Style; shared control", "Jose and Raisa; Jose recovery operator", "Jose and Raisa", "Verified service and PostgreSQL recovery"),
        ("Cloudflare / R2", "Use Me With Style; shared control", "Jose and Raisa; Jose recovery operator", "Jose and Raisa", "Verified R2 recovery rehearsal"),
        ("GitHub", "Repositories controlled by Jose", "Jose", "Jose", "Verified PR, Actions and release control"),
        ("PostgreSQL", "Use Me With Style via Railway", "Jose recovery; app service runtime", "Inherited from Railway control", "Verified backup and isolated restore"),
    ], [29 * mm, 39 * mm, 48 * mm, 37 * mm, 37 * mm])]
    s += [P("Billing and recovery routing", h2)] + bullets(["Provider-specific billing and recovery addresses remain in each provider account and are reviewed by the account owners.", "The shared master mailbox is the operational alert and recovery-coordination mailbox; this register does not claim it is the primary login for every provider.", "Vercel and GitHub continuity currently depends on Jose's control, explicitly accepted for Phase 1."])
    s += [P("Vendor support route", h2), table(["Provider", "Approved support route"], [
        ("Namecheap", "Authenticated account support and provider status page"), ("Vercel", "Project dashboard support and status page"),
        ("Railway", "Project dashboard support and status page"), ("Cloudflare", "Account support and Cloudflare status page"),
        ("GitHub", "Repository/Actions status and GitHub Support"),
    ], [45 * mm, 125 * mm])]
    s += [PageBreak()]

    s += page("3. Communications, email and messaging accounts")
    s += [table(["System", "Control / operators", "Secret location category", "Expiry / rotation", "Recovery evidence"], [
        ("Shared master Gmail", "Jose and Raisa", "Google account security settings; values excluded", "Review quarterly and after device/owner change", "Alert and manual email receipt confirmed"),
        ("Resend", "Jose and Raisa; Jose technical", "Resend account plus production/workflow secret stores", "Rotate on exposure, role change or provider requirement", "Real templates, alert and canary accepted/received"),
        ("support@ sender/mailbox", "Raisa at delivery; Jose until delivery", "Mail provider / Resend configuration", "Review at delivery and quarterly", "Production sender-domain operation evidenced"),
        ("orders@ sender/mailbox", "Raisa at delivery; Jose until delivery", "Mail provider / Resend configuration", "Review at delivery and quarterly", "Order email operation evidenced"),
        ("Meta / Instagram", "Jose and Raisa; Jose technical", "Meta account and production CMS secret store", "Manual renewal before token expiry; no automatic rotation job", "Webhook handshake verified; live round trip separately controlled"),
    ], [31 * mm, 40 * mm, 43 * mm, 41 * mm, 35 * mm])]
    s += [callout("Meta decision", "Instagram access-token renewal is manual. The automatic renewal workflow was removed by owner decision. Record the rotation date, owner, expiry and verification result, but never the token value.", "gold")]
    s += [P("Vendor support route", h2), table(["Provider", "Approved support route"], [
        ("Google", "Google account recovery and Workspace/Gmail support as applicable"),
        ("Resend", "Authenticated Resend support and status page"),
        ("Meta", "Meta Business support, app dashboard and platform status"),
    ], [45 * mm, 125 * mm])]
    s += [PageBreak()]

    s += page("4. Commerce, payment and application access")
    s += [table(["System", "Business owner", "Operators / collaborators", "Phase 1 position", "Activation control"], [
        ("AppyPay", "Use Me With Style / Raisa", "Jose and Raisa", "Code integration exists; live launch deferred for non-code onboarding/bureaucratic completion", "Before activation: confirm credentials, sandbox/live separation, success/failure/cancel tests, webhook and reconciliation"),
        ("Storefront Admin", "Use Me With Style / Raisa", "Raisa client operations; Jose technical", "Production operational", "Named admin access; remove stale users; verify login after access changes"),
        ("Payload CMS", "Use Me With Style", "Jose technical; Raisa has access but daily use minimized", "Production technical/backup administration", "Use only when Storefront Admin cannot perform the approved task"),
        ("WhatsApp fallback", "Use Me With Style / Raisa", "Raisa client operations", "Current manual checkout and future AppyPay fallback", "Raisa controls activation/operation; Jose maintains technical path"),
        ("External fiscal provider", "Use Me With Style / Raisa", "Not selected for Phase 1", "Deferred; app-generated documents are non-fiscal", "Provider selection, accountant/legal approval, sandbox proof and runbook required"),
    ], [30 * mm, 36 * mm, 39 * mm, 49 * mm, 36 * mm])]
    s += [callout("No live-payment claim", "AppyPay access and code readiness do not mean production payments are live. Phase 1 remains manual WhatsApp checkout. Payment credentials and provider-specific alerts enter the register when production activation is authorized.", "red")]
    s += [P("Deferred provider onboarding checklist", h2)] + steps([
        "Confirm legal/business owner, billing contact, recovery email and provider collaborators.",
        "Enable 2FA and record custodians without recording recovery codes.",
        "Separate sandbox and production credentials and secret locations.",
        "Record expiry/rotation behavior and vendor support route.",
        "Complete controlled production tests, reconciliation and incident-response updates before launch.",
    ])
    s += [PageBreak()]

    s += page("5. Secret-location and rotation matrix")
    s += [table(["Credential class", "Approved location", "Review / rotation rule", "Verification after change"], [
        ("Vercel public frontend variables", "Vercel project environment; VITE_ values only", "Review each release/environment change", "Production build and storefront/API checks"),
        ("Railway CMS secrets", "Railway production service variables", "Rotate on exposure, owner/role change or provider expiry", "CMS startup, API reads and dependent storefront checks"),
        ("Database credentials", "Railway service reference/variables and workflow secret where required", "Rotate on exposure, ownership change or database recovery", "CMS connectivity, backup workflow and isolated validation"),
        ("R2 access keys", "Railway production variables / Cloudflare account", "Rotate on exposure or permission/owner change", "Exact temporary object upload/download/checksum/cleanup"),
        ("Resend API key", "Railway and GitHub Actions secret stores", "Rotate on exposure, role change or provider requirement", "Canary plus authorized template receipt"),
        ("Meta verification/access tokens", "Railway production secret store; verification token also GitHub Actions", "Manual renewal before expiry; rotate on exposure/permission change", "Webhook handshake and authorized messaging test"),
        ("Cron secret", "CMS/Railway scheduler and GitHub Actions secrets", "Rotate on exposure or service/owner change", "One controlled cleanup and fresh heartbeat"),
        ("Backup passphrase", "GitHub Actions secret and Jose macOS Keychain", "Rotate on suspected exposure or recovery-policy change", "New encrypted backup and isolated decrypt/manifest test"),
    ], [38 * mm, 48 * mm, 48 * mm, 36 * mm])]
    s += [callout("Secret rule", "A location entry states where a secret is managed, never its value. Screenshots and evidence must redact environment values, connection strings, signed URLs and recovery material.", "red")]
    s += [PageBreak()]

    s += page("6. Access review and recovery-test register")
    s += [table(["System / control", "Last evidence", "Result", "Next review trigger"], [
        ("Vercel / storefront control", "Phase 1 production release verification", "Verified", "Quarterly; ownership change; failed deployment"),
        ("Railway CMS and PostgreSQL", "21 Aug 2026 backup/isolated restore", "Verified - 64 tables, 824 rows; 205-second restore", "Quarterly recovery review; schema-heavy release"),
        ("Cloudflare R2", "21 Aug 2026 exact-prefix recovery rehearsal", "Verified checksum and cleanup", "Quarterly; storage incident; key rotation"),
        ("Resend and mailboxes", "21 Aug 2026 templates, alert and canary", "Provider acceptance and receipt confirmed", "Daily canary; sender/DNS change"),
        ("GitHub Actions", "21-22 Aug 2026 production workflows", "Backup, heartbeat, monitor and canary successful", "Workflow/secret change; quarterly access review"),
        ("Meta webhook", "21-22 Aug 2026 verification monitor", "Handshake verified", "Token/configuration change; authorized live UAT"),
        ("Shared master mailbox", "21 Aug 2026 alert/canary receipt", "Jose confirmed receipt; shared control attested", "Quarterly; device/owner change"),
        ("Namecheap DNS", "Production domain and sender-domain configuration", "Owner-confirmed; production domains active", "DNS change; recovery-contact review"),
        ("AppyPay", "Access/control attestation", "Owner-confirmed; production activation deferred", "Before live activation"),
    ], [46 * mm, 45 * mm, 45 * mm, 34 * mm])]
    s += [P("Quarterly review procedure", h2)] + steps([
        "Jose and Raisa review all providers, authorized users and recovery contacts together.",
        "Remove obsolete collaborators and confirm least privilege.",
        "Confirm 2FA custodians and recovery access without viewing or copying recovery codes into the register.",
        "Review expiring credentials, billing ownership and vendor support route.",
        "Run the minimum safe recovery/verification check and record date, operator and result.",
        "Issue a new register version with a concise change note; retain the superseded PDF.",
    ])
    s += [PageBreak()]

    s += page("7. Emergency access loss and acceptance")
    s += [P("Account access-loss procedure", h2)] + steps([
        "Classify affected provider, production impact and whether checkout/order/inventory integrity is at risk.",
        "Jose informs Raisa through the direct WhatsApp escalation channel. Raisa decides whether sales pause.",
        "Use the provider's official recovery route and the confirmed recovery custodian. Never request or send recovery codes through ordinary chat.",
        "Preserve account notifications, timestamps and provider case references without secret values.",
        "After recovery, review sessions/collaborators, rotate affected credentials, verify service operation and update this register metadata.",
    ])
    s += [P("Current accepted continuity limitation", h2), P("Jose alone controls Vercel and GitHub. Jose and Raisa jointly control Namecheap, AppyPay, Meta/Instagram, Resend, Cloudflare/R2, Railway and the shared master mailbox. Jose explicitly accepted this continuity model for Phase 1; any ownership expansion is recorded as a later controlled access change.")]
    s += [P("Approval record", h2), table(["Role", "Name / position", "Status"], [
        ("Register owners", "Jose and Raisa", "Ownership confirmed"),
        ("Technical / infrastructure owner", "Jose", "Confirmed"),
        ("Client operations and sales-pause authority", "Raisa", "Confirmed"),
        ("Final pack approver", "Raisa", "Pending final Gate 5 pack approval"),
    ], [55 * mm, 65 * mm, 50 * mm])]
    s += [Spacer(1, 5 * mm), callout("Control outcome", "The Phase 1 production account and access model is documented without secret values. Provider-specific sensitive details remain in their approved systems; this PDF is the operational index for ownership, recovery and review.", "green")]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=18 * mm,
                          title="Use Me With Style - Phase 1 Production Account and Access Register", author="Use Me With Style delivery team")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()

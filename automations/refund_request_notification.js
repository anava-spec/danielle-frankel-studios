/*
================================================================================
AUTOMATION : Refund Request Notification — Record Created
BASE       : appMmEE4zyHMGhkkd (sandbox — mirror to Production when ready)
TABLE SRC  : refund_requests (tbl1A5lbdJxUREOPO)
TABLE REF  : staff (tblbYk88xJ8FQrLS4)
TRIGGER    : When record created — refund_requests
VERSION    : 1.0.0 — Initial version. All field IDs verified against the live
                     Sandbox base (appMmEE4zyHMGhkkd) via the schema tool
                     before writing this script — see field comments below.

OBJECTIVE
  Whenever a new refund_requests record is created (a new refund/discount
  case opened against an order), notify a staff member (currently Margo, via
  the `recipient` input below) with enough context to action it — Client,
  Order (Shopify order #), Refund Category, Refund Reason (if present), and
  Proposed Resolution. Unlike the customization_requests automations this
  project already has (new_request_notification.js, decision_notification.js),
  there is no scenario branching here — every refund_requests record
  creation notifies the configured recipient, full stop. Kept the same
  class-separation shape as those two scripts for consistency even though a
  ScenarioResolver isn't needed.

INPUTS (input.config())
  recordId  : the created refund_requests record's id — required.
  recipient : full_name of the staff member to notify (matched against
              staff.full_name, e.g. "Margo Lafontaine") — required when
              dryRun is not "true". Passed as an input (not hardcoded) per
              Axel, 2026-09-02, so the trigger config is the single place
              that decides who gets notified, not the script body.
  dryRun    : STRING "true" | "false" (not a native boolean — Axel,
              2026-09-02, wanted this mapped as text in the trigger step,
              so it's compared as a string below, not on truthiness).
              When "true": skips the staff lookup entirely and uses Axel's
              own contact info (see DRY_RUN_CONTACT) so test runs never
              page a real staff member. When "false": looks up `recipient`
              in the staff table for real name/email/Slack ID.
  isProduction : boolean, unrelated to dryRun — only picks which
              PAGE_URLS entry the deep link uses (sandbox vs. production
              base). Kept separate since it answers a different question
              (which base's link to build) than dryRun (who actually
              receives it).

GUARD CLAUSE
  1. recordId must be present in input.config() — the trigger must pass it.
  2. The record must actually exist when read back (defends against a
     delete-immediately-after-create race).
  3. recipient must be present when dryRun is not "true" — otherwise there's
     nothing to look up in the staff table.

  Client/Order/Refund Category are all plain multipleRecordLinks fields set
  directly by the interface at record-creation time (not formulas/rollups
  computed downstream), so — unlike new_request_notification.js's
  proposed_total_custom_price — there's no settle-and-poll concern here; a
  single read is enough.

ERROR HANDLING
  Errors thrown with descriptive messages. Airtable's native run-failure
  notification alerts the automation owner. No separate Send Email node
  needed for script failures — only for the notification itself.

OUTPUTS (output.set)
  status         : "SUCCESS" | "ERROR"
  recipientName  : who was notified — "Axel Nava" when dryRun="true",
                   otherwise the resolved staff.full_name (falls back to the
                   raw `recipient` input if no staff record matched)
  recipientEmail : recipient's email (may be blank if unset in staff table)
  slackId        : recipient's Slack ID (may be blank if unset in staff table)
  subject        : notification subject line
  slackMessage   : notification body, Slack mrkdwn link syntax (<url|text>)
  gmailMessage   : notification body, standard markdown link syntax ([text](url))
  error_message  : null on success
  log_summary    : full Logger output
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  REFUND_REQUESTS : 'tbl1A5lbdJxUREOPO', // refund_requests
  STAFF           : 'tblbYk88xJ8FQrLS4', // staff
};

// Fields — refund_requests (tbl1A5lbdJxUREOPO). Verified live against
// appMmEE4zyHMGhkkd via the schema tool — same ids the refund_requests.tsx
// interface uses (FIELD_IDS), re-verified here rather than copied blind.
const FIELDS_REQUEST = {
  case_name                : 'fldliFXL9ZpsM6TgG', // singleLineText
  client                    : 'fldH0VFOEMWk7ly6l', // multipleRecordLinks -> DF Clients (tblLLUlDgJ4ktzF7c) — primary field is Full Name, so the link's cached name IS the client's display name
  order                     : 'fldPJ9JwERMtCG0zq', // multipleRecordLinks -> Orders - Shopify (tblHFGbijtvZcRPkE) — primary field is Shopify Order Number, so the link's cached name IS the order number as text (no separate Orders lookup needed)
  refund_reason             : 'fldcrNKuzj4wbulVQ', // multilineText
  refund_category           : 'fldjtOVzR8t0imXfy', // multipleRecordLinks -> refund_categories (tblhbjY8Jh8KjqRf6) — primary field is Category Name, so the link's cached name IS the category's display name
  resolution_type_proposed  : 'fldVSbEmBpvZ1SEUE', // singleSelect — "Direct Refund" | "Applied as Discount on Order"
  request_stage             : 'fldtRq5M9XstW1FC1', // singleSelect — Requested | Under Review | Approved | Rejected | Cancelled
};

// Fields — staff (tblbYk88xJ8FQrLS4)
const FIELDS_STAFF = {
  full_name : 'fldc8INBZmwC3xeH7',
  email     : 'fld4Nxi4WQpUXnd0J',
  slack_id  : 'fldPBy4cPpVm8n1wp',
};

// Refund Requests interface page (Daily Ops -> Refund Requests), page
// pag8gr7A7fHJ86QAq — sandbox base id in the URL only; swap once mirrored to
// Production (page id itself is expected to stay the same, same as the
// customization_requests automations' PAGE_URLS convention — verify the
// Production page id once that mirror exists).
const PAGE_URLS = {
  sandbox    : 'https://airtable.com/appMmEE4zyHMGhkkd/pag8gr7A7fHJ86QAq',
  production : 'https://airtable.com/appMmEE4zyHMGhkkd/pag8gr7A7fHJ86QAq', // TODO: update to the Production base/page id once this automation is mirrored
};

const CONFIG = {
  LOG_LEVEL : 'B', // A=minimal | B=audit (default) | C=debug
};

// dryRun="true" (see MAIN EXECUTION BLOCK — arrives as a string input, not a
// native boolean, per Axel, 2026-09-02) skips the staff lookup entirely and
// uses Axel's own contact info instead — prevents test runs from paging a
// real staff member. Only the delivery address/name changes; the message
// content still reflects the real resolved case, so a dry run reads exactly
// like the real notification would.
const DRY_RUN_CONTACT = {
  name     : 'Axel Nava',
  email    : 'anava@singularagency.co',
  slack_id : 'U0AR34NA6UV',
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class Logger {
  constructor(level = 'B') {
    this.level   = level;
    this.entries = [];
    this._levels = { A: 1, B: 2, C: 3 };
  }
  _log(lvl, msg) {
    if (this._levels[this.level] >= this._levels[lvl]) {
      const e = `[${lvl}][${new Date().toISOString()}] ${msg}`;
      this.entries.push(e);
      console.log(e);
    }
  }
  minimal(msg) { this._log('A', msg); }
  audit(msg)   { this._log('B', msg); }
  debug(msg)   { this._log('C', msg); }
  error(msg)   {
    const e = `[ERR][${new Date().toISOString()}] ${msg}`;
    this.entries.push(e);
    console.error(e);
  }
  step(n, msg) { this._log('B', `── STEP ${n}: ${msg}`); }
  getSummary() { return this.entries.join('\n'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE MANAGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class DateManager {
  static now() { return new Date().toISOString(); }
  // Airtable's Automation script sandbox has no setTimeout/setInterval —
  // this is the standard synchronous busy-wait workaround for "just pause
  // for a bit" inside a script step. Not currently used by this script (no
  // formula/rollup settle needed — see GUARD CLAUSE), kept for parity with
  // the other automations in this project in case a future field needs it.
  static sleepSync(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) { /* busy wait */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DATA MAPPER CLASS
// Pure field-extraction logic. No Airtable writes. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

class RequestDataMapper {
  constructor(logger) { this.logger = logger; }

  _str(r, f)  { const v = r?.getCellValue(f); if (v === null || v === undefined) return null; if (typeof v === 'object' && v?.name) return v.name; return String(v); }
  _linkName(r, f)  { const v = r?.getCellValue(f); if (!v || !Array.isArray(v)) return null; return v[0]?.name ?? null; }
  // Dates/plain text read cleanest via Airtable's own formatted string
  // representation rather than re-deriving the format by hand.
  _asString(r, f) { const v = r?.getCellValueAsString ? r.getCellValueAsString(f) : null; return v || null; }

  extract(record) {
    this.logger.step(2, 'Extracting plain values from record');
    // Order's primary field is Shopify Order Number (verified live) — the
    // link's cached name IS the order number as text, no separate Orders
    // table read needed. Same reasoning for client (Full Name) and
    // refund_category (Category Name).
    const orderNumber = this._linkName(record, FIELDS_REQUEST.order);
    const data = {
      caseName        : this._str(record, FIELDS_REQUEST.case_name) ?? '—',
      clientName      : this._linkName(record, FIELDS_REQUEST.client) ?? 'a client',
      orderText       : orderNumber ? `#${orderNumber}` : '—',
      categoryName    : this._linkName(record, FIELDS_REQUEST.refund_category) ?? '—',
      refundReason    : this._asString(record, FIELDS_REQUEST.refund_reason),
      proposedResolution: this._str(record, FIELDS_REQUEST.resolution_type_proposed) ?? '—',
      requestStage    : this._str(record, FIELDS_REQUEST.request_stage) ?? '—',
    };
    this.logger.debug(`Extracted → ${JSON.stringify(data)}`);
    return data;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class RequestRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.REFUND_REQUESTS);
    this.logger = logger;
  }
  async getById(recordId) {
    this.logger.step(1, `Loading refund request record → ${recordId}`);
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_REQUEST) });
    const record = result.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Guard clause: refund request record not found → recordId: ${recordId}`);
    this.logger.audit(`Record loaded → ${recordId}`);
    return record;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class StaffRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.STAFF);
    this.logger = logger;
  }
  async findByFullName(fullName) {
    this.logger.step(3, `Looking up staff → "${fullName}"`);
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_STAFF) });
    const staff = result.records.find(r => r.getCellValue(FIELDS_STAFF.full_name) === fullName);
    if (!staff) this.logger.error(`No staff record matched full_name "${fullName}" — email/Slack will be blank`);
    return staff ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER CLASS
// Composes human-readable notification text. No logic — strings only.
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  // Shared details block — every field Margo needs to action the case
  // without opening the record first.
  static _details(data) {
    // "- " is each platform's own bulleted-list markdown — Slack's mrkdwn
    // renders a leading "- " as a list item, and Gmail's "Insert as
    // Markdown"/rich-text send does the same, no literal bullet glyph needed.
    const lines = [
      `- Client: ${data.clientName}`,
      `- Order: ${data.orderText}`,
      `- Refund Category: ${data.categoryName}`,
    ];
    if (data.refundReason) lines.push(`- Refund Reason: ${data.refundReason}`);
    lines.push(`- Proposed Resolution: ${data.proposedResolution}`);
    return lines.join('\n');
  }

  // The Interface page's own deep-link URL — the interface itself reads
  // ?record=recXXXX on load and jumps straight to that record's Detail Page,
  // same convention as new_request_notification.js / decision_notification.js.
  static _recordUrl(pageUrl, recordId) { return `${pageUrl}?record=${recordId}`; }
  static _slackLink(pageUrl, recordId) { return `<${MessageBuilder._recordUrl(pageUrl, recordId)}|Click here to review>`; }
  static _gmailLink(pageUrl, recordId) { return `[Click here to review](${MessageBuilder._recordUrl(pageUrl, recordId)})`; }

  static build(data, pageUrl, recordId) {
    const details = MessageBuilder._details(data);
    const subject = `New refund request needs your review — ${data.clientName}`;
    const intro   = `A new refund request for ${data.clientName} was just opened${data.orderText !== '—' ? ` on order ${data.orderText}` : ''}. It's waiting in Refund Requests for your review.`;
    return {
      subject,
      slackMessage: `${intro}\n\n${details}\n\n${MessageBuilder._slackLink(pageUrl, recordId)}`,
      gmailMessage: `${intro}\n\n${details}\n\n${MessageBuilder._gmailLink(pageUrl, recordId)}`,
    };
  }
  static error(errMsg) {
    return `❌ NOTIFICATION FAILED\nError: ${errMsg}\nAction: Review automation run logs for step-by-step trace.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS — Orchestrates all steps
// ─────────────────────────────────────────────────────────────────────────────

class RefundRequestNotificationService {
  constructor(requestRepo, staffRepo, mapper, logger, pageUrl) {
    this.requestRepo = requestRepo;
    this.staffRepo   = staffRepo;
    this.mapper      = mapper;
    this.logger      = logger;
    this.pageUrl     = pageUrl;
  }

  async run(recordId, recipient, dryRun) {
    this.logger.audit(`Service started → record: ${recordId} | recipient: ${recipient} | dryRun: ${dryRun}`);

    // Step 1 — Load record
    const record = await this.requestRepo.getById(recordId);

    // Step 2 — Extract plain data
    const data = this.mapper.extract(record);

    // Step 3 — Resolve who actually gets notified. dryRun="true" always
    // wins — Axel's own contact info, no staff lookup at all — so a test
    // run can never accidentally page a real staff member even if
    // `recipient` is also filled in during testing.
    let recipientName, recipientEmail, slackId;
    if (dryRun) {
      this.logger.step(3, `dryRun=true — using Axel's own contact info instead of looking up "${recipient}"`);
      recipientName  = DRY_RUN_CONTACT.name;
      recipientEmail = DRY_RUN_CONTACT.email;
      slackId        = DRY_RUN_CONTACT.slack_id;
    } else {
      if (!recipient) throw new Error(
        'Guard clause: missing required input "recipient" (and dryRun is not "true"). Map the intended staff member\'s full_name in the trigger config.'
      );
      const staff = await this.staffRepo.findByFullName(recipient);
      recipientName  = staff ? (staff.getCellValueAsString(FIELDS_STAFF.full_name) || recipient) : recipient;
      recipientEmail = staff ? (staff.getCellValueAsString(FIELDS_STAFF.email) || '') : '';
      slackId        = staff ? (staff.getCellValueAsString(FIELDS_STAFF.slack_id) || '') : '';
    }

    // Step 4 — Build messages (one per channel, same content, different link markdown)
    const { subject, slackMessage, gmailMessage } = MessageBuilder.build(data, this.pageUrl, recordId);

    this.logger.minimal(`SUCCESS → notify ${recipientName} for ${data.clientName} (${data.orderText})`);

    return {
      status         : 'SUCCESS',
      recipientName,
      recipientEmail,
      slackId,
      subject,
      slackMessage,
      gmailMessage,
      error_message  : null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE — Airtable only allows one call per script.
// ─────────────────────────────────────────────────────────────────────────────

const cfg      = input.config();
const recordId = cfg.recordId;
const recipient = cfg.recipient; // staff.full_name to notify, e.g. "Margo Lafontaine" — see INPUTS above
// Arrives as a STRING ("true"/"false"), not a native boolean — per Axel,
// 2026-09-02, the trigger step maps this as text. Compare as a string, not
// on truthiness (a non-empty string like "false" is still truthy in JS).
const dryRun = String(cfg.dryRun).trim().toLowerCase() === 'true';
// Unrelated to dryRun — false while testing against Sandbox, true once this
// automation is mirrored to run for real in Production — flip this input
// value, not the code.
const isProduction = cfg.isProduction === true;
const pageUrl       = isProduction ? PAGE_URLS.production : PAGE_URLS.sandbox;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status         : 'ERROR',
  recipientName  : null,
  recipientEmail : null,
  slackId        : null,
  subject        : null,
  slackMessage   : null,
  gmailMessage   : null,
  error_message  : null,
};

try {
  if (!recordId) throw new Error(
    'Guard clause: missing required input "recordId". Ensure the trigger step maps the created record\'s ID.'
  );

  logger.audit(`Automation started → recordId: ${recordId} | recipient: ${recipient} | dryRun: ${dryRun} | isProduction: ${isProduction}`);

  const service = new RefundRequestNotificationService(
    new RequestRepository(logger),
    new StaffRepository(logger),
    new RequestDataMapper(logger),
    logger,
    pageUrl
  );

  result = await service.run(recordId, recipient, dryRun);

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;
  result.slackMessage  = MessageBuilder.error(err.message);
  result.gmailMessage  = MessageBuilder.error(err.message);

  // !! CRITICAL — re-throw so Airtable marks the automation run as FAILED !!
  // output.set() alone does NOT fail the automation — only an uncaught error does.
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS — only reached on SUCCESS (catch block re-throws on error)
// ─────────────────────────────────────────────────────────────────────────────

output.set('status',         result.status);
output.set('recipientName',  result.recipientName);
output.set('recipientEmail', result.recipientEmail);
output.set('slackId',        result.slackId);
output.set('subject',        result.subject);
output.set('slackMessage',   result.slackMessage);
output.set('gmailMessage',   result.gmailMessage);
output.set('error_message',  result.error_message);
output.set('log_summary',    logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | recipient: ${result.recipientName}`);

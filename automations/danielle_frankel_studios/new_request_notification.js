/*
================================================================================
AUTOMATION : New Request Notification — Record Created
BASE       : app6Q4xMZ1ngJxiV8 (sandbox — mirror to Production when ready)
TABLE SRC  : customization_requests (tbl7HUWDI7IRjWY92)
TABLE REF  : staff (tblbYk88xJ8FQrLS4)
TRIGGER    : When record created — customization_requests
VERSION    : 1.0.0 — all field IDs verified against live base

OBJECTIVE
  Whenever a new customization_requests record is created — a brand-new ask
  from the SA, the SA re-countering Margo's own counter, or the client
  countering — notify whoever's queue it just landed in. Counter-Proposed
  status only ever exists because Margo just created it, so that one case
  routes to the SA; every other case (empty/New Request) routes to Margo.

GUARD CLAUSE
  1. recordId must be present in input.config() — the trigger must pass it.
  2. The record must actually exist when read back (defends against a
     delete-immediately-after-create race).
  3. internal_approval_status must resolve to a known value (New Request or
     Counter-Proposed) — anything else is an unexpected state and errors out
     loudly instead of silently notifying the wrong person.

ERROR HANDLING
  Errors thrown with descriptive messages. Airtable's native run-failure
  notification alerts the automation owner. No separate Send Email node
  needed for script failures — only for the notification itself.

OUTPUTS (output.set)
  status         : "SUCCESS" | "ERROR"
  recipientName  : staff full_name notified
  recipientEmail : staff Email (may be blank if unset in staff table)
  slackId        : staff slack_id (may be blank if unset in staff table)
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
  REQUESTS : 'tbl7HUWDI7IRjWY92', // customization_requests
  STAFF    : 'tblbYk88xJ8FQrLS4', // staff
};

// Fields — customization_requests (tbl7HUWDI7IRjWY92)
const FIELDS_REQUEST = {
  internal_approval_status   : 'fldEfOYgxOhyDiMEH',
  sales_associate            : 'fldZ5towmwbgJho67', // lookup (text) through client
  client                     : 'fldOeL4VVcXaKwwlN', // multipleRecordLinks
  customized_style           : 'fldCaKP1d4C0aohQE', // multipleRecordLinks
  is_hybrid                  : 'fld1stC4sHuPT4pT4', // singleSelect — Regular / Hybrid
  hybrid_style_names         : 'fldMHwhsQ7rmvjqBb', // rollup — already-formatted "Style A & Style B"
  date_of_request            : 'fldQdHAp256vsImBt',
  proposed_total_custom_price: 'fldtF37zwwAPb5hjS', // formula, currency-formatted
};

// Fields — staff (tblbYk88xJ8FQrLS4)
const FIELDS_STAFF = {
  full_name : 'fldc8INBZmwC3xeH7',
  email     : 'fld4Nxi4WQpUXnd0J',
  slack_id  : 'fldPBy4cPpVm8n1wp',
};

// Same Interface page in both bases (pagFJG1URt93CIOm1) — only the base ID
// in the URL differs. isProduction comes from input.config() (see MAIN
// EXECUTION BLOCK below): false while this automation is still being tested
// against Sandbox, true once mirrored to run for real in Production.
const PAGE_URLS = {
  sandbox    : 'https://airtable.com/app6Q4xMZ1ngJxiV8/pagFJG1URt93CIOm1',
  production : 'https://airtable.com/appUC2NFAlURayLx9/pagFJG1URt93CIOm1',
};

const CONFIG = {
  LOG_LEVEL       : 'B', // A=minimal | B=audit (default) | C=debug
  MARGO_FULL_NAME : 'Margo Lafontaine', // must match staff.full_name exactly
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
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DATA MAPPER CLASS
// Pure field-extraction logic. No Airtable writes. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

class RequestDataMapper {
  constructor(logger) { this.logger = logger; }

  _str(r, f)  { const v = r?.getCellValue(f); if (v === null || v === undefined) return null; if (typeof v === 'object' && v?.name) return v.name; return String(v); }
  _lookupStr(r, f) { const v = r?.getCellValue(f); if (!v || !Array.isArray(v)) return null; return v[0] ?? null; }
  _linkName(r, f)  { const v = r?.getCellValue(f); if (!v || !Array.isArray(v)) return null; return v[0]?.name ?? null; }
  // Dates and formula-currency read cleanest via Airtable's own formatted
  // string representation rather than re-deriving the format by hand.
  _asString(r, f) { const v = r?.getCellValueAsString ? r.getCellValueAsString(f) : null; return v || null; }

  extract(record) {
    this.logger.step(2, 'Extracting plain values from record');
    const isHybrid = this._str(record, FIELDS_REQUEST.is_hybrid) === 'Hybrid';
    const data = {
      internalStatus : this._str(record, FIELDS_REQUEST.internal_approval_status),
      saName         : this._lookupStr(record, FIELDS_REQUEST.sales_associate),
      clientName     : this._linkName(record, FIELDS_REQUEST.client) ?? 'a client',
      styleText      : isHybrid
        ? (this._asString(record, FIELDS_REQUEST.hybrid_style_names) ?? 'Hybrid')
        : (this._linkName(record, FIELDS_REQUEST.customized_style) ?? '—'),
      dateOfRequest  : this._asString(record, FIELDS_REQUEST.date_of_request) ?? '—',
      proposedTotal  : this._asString(record, FIELDS_REQUEST.proposed_total_custom_price) ?? '—',
    };
    this.logger.debug(`Extracted → ${JSON.stringify(data)}`);
    return data;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO RESOLVER CLASS
// Pure business logic — decides who gets notified and why. No Airtable calls.
// ─────────────────────────────────────────────────────────────────────────────

class ScenarioResolver {
  constructor(logger) { this.logger = logger; }

  resolve(data) {
    // Counter-Proposed only ever happens when Margo just created her own
    // counter — that record belongs on the SA's desk. Everything else that
    // lands here (a fresh ask, an SA re-counter, a client re-counter) is
    // New Request, which is Margo's queue.
    if (data.internalStatus === 'Counter-Proposed') {
      if (!data.saName) throw new Error(
        `Guard clause: Counter-Proposed record has no sales_associate to notify (client: ${data.clientName}).`
      );
      this.logger.step(3, `Resolved → Counter-Proposed, notify SA: ${data.saName}`);
      return { scenario: 'counterProposed', recipientQuery: data.saName };
    }
    if (data.internalStatus === 'New Request' || !data.internalStatus) {
      this.logger.step(3, `Resolved → New Request, notify Margo: ${CONFIG.MARGO_FULL_NAME}`);
      return { scenario: 'newRequest', recipientQuery: CONFIG.MARGO_FULL_NAME };
    }
    throw new Error(
      `Guard clause: unexpected internal_approval_status "${data.internalStatus}" on a just-created record (client: ${data.clientName}).`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class RequestRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.REQUESTS);
    this.logger = logger;
  }
  async getById(recordId) {
    this.logger.step(1, `Loading request record → ${recordId}`);
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_REQUEST) });
    const record = result.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Guard clause: request record not found → recordId: ${recordId}`);
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
    this.logger.step(4, `Looking up staff → "${fullName}"`);
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
  // Shared details block appended to every notification — same five fields
  // regardless of scenario, so the recipient never has to open the record
  // just to see the basics.
  static _details(data) {
    // "- " is each platform's own bulleted-list markdown — Slack's mrkdwn
    // renders a leading "- " as a list item, and Gmail's "Insert as
    // Markdown"/rich-text send does the same, no literal bullet glyph needed.
    return (
      `- Client: ${data.clientName}\n` +
      `- Style: ${data.styleText}\n` +
      `- Sales Associate: ${data.saName || '—'}\n` +
      `- Date of Request: ${data.dateOfRequest}\n` +
      `- Proposed Total: ${data.proposedTotal}`
    );
  }

  // The Interface page's own deep-link URL — the interface itself reads
  // ?record=recXXXX on load and jumps straight to that record's Detail Page
  // (see the interface code's deepLinkConsumedRef effect). Same link,
  // formatted per platform's own link markdown just below.
  static _recordUrl(pageUrl, recordId) { return `${pageUrl}?record=${recordId}`; }
  static _slackLink(pageUrl, recordId) { return `<${MessageBuilder._recordUrl(pageUrl, recordId)}|Click here to review>`; }
  static _gmailLink(pageUrl, recordId) { return `[Click here to review](${MessageBuilder._recordUrl(pageUrl, recordId)})`; }

  static forScenario(scenario, data, pageUrl, recordId) {
    const details = MessageBuilder._details(data);
    let intro;
    if (scenario === 'counterProposed') {
      intro = `Margo countered on ${data.clientName}'s request. It's on your desk in Workdesk as Counter-Proposed — review, approve, deny, or counter again.`;
    } else {
      intro = `A customization request for ${data.clientName} needs your review${data.saName ? ` (from ${data.saName})` : ''}. It's waiting in New Requests.`;
    }
    const subject = scenario === 'counterProposed'
      ? `Counter-proposal ready for your review — ${data.clientName}`
      : `New customization request needs your review — ${data.clientName}`;
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

class NewRequestNotificationService {
  constructor(requestRepo, staffRepo, mapper, resolver, logger, pageUrl) {
    this.requestRepo = requestRepo;
    this.staffRepo   = staffRepo;
    this.mapper      = mapper;
    this.resolver     = resolver;
    this.logger      = logger;
    this.pageUrl     = pageUrl;
  }

  async run(recordId) {
    this.logger.audit(`Service started → record: ${recordId}`);

    // Step 1 — Load record
    const record = await this.requestRepo.getById(recordId);

    // Step 2 — Extract plain data
    const data = this.mapper.extract(record);

    // Step 3 — Resolve scenario + recipient
    const { scenario, recipientQuery } = this.resolver.resolve(data);

    // Step 4 — Look up staff contact info
    const staff = await this.staffRepo.findByFullName(recipientQuery);
    const recipientEmail = staff ? (staff.getCellValueAsString(FIELDS_STAFF.email) || '') : '';
    const slackId         = staff ? (staff.getCellValueAsString(FIELDS_STAFF.slack_id) || '') : '';

    // Step 5 — Build messages (one per channel, same content, different link markdown)
    const { subject, slackMessage, gmailMessage } = MessageBuilder.forScenario(scenario, data, this.pageUrl, recordId);

    this.logger.minimal(`SUCCESS → notify ${recipientQuery} (${scenario}) for ${data.clientName}`);

    return {
      status         : 'SUCCESS',
      recipientName  : recipientQuery,
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

const cfg          = input.config();
const recordId     = cfg.recordId;
// false while testing against Sandbox, true once this automation is mirrored
// to run for real in Production — flip this input value, not the code.
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

  logger.audit(`Automation started → recordId: ${recordId} | isProduction: ${isProduction}`);

  const service = new NewRequestNotificationService(
    new RequestRepository(logger),
    new StaffRepository(logger),
    new RequestDataMapper(logger),
    new ScenarioResolver(logger),
    logger,
    pageUrl
  );

  result = await service.run(recordId);

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

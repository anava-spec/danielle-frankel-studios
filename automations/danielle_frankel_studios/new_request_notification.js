/*
================================================================================
AUTOMATION : New Request Notification — Record Created
BASE       : app6Q4xMZ1ngJxiV8 (sandbox — mirror to Production when ready)
TABLE SRC  : customization_requests (tbl7HUWDI7IRjWY92)
TABLE REF  : staff (tblbYk88xJ8FQrLS4)
TRIGGER    : When record created — customization_requests
VERSION    : 1.6.0 — Hybrid is no longer a parent + 2 structural child
                     records (hybrid_link self-link) — as of the 2026-07-26
                     schema rework, a Hybrid request is a single record with
                     two direct Styles links (customized_style +
                     additional_customized_style), and proposed_total_
                     custom_price (via the new effective_base_price field)
                     computes correctly for it natively. Removed the
                     Hybrid-child skip guard and the child-record fallback
                     total from v1.5.0 — neither is needed anymore, since
                     every Hybrid request is now its own single row from
                     creation. `shouldNotify` output kept for compatibility
                     with any Conditional Logic step already wired to it in
                     Airtable, but is now effectively always true on success.
                     ---
                     v1.5.0 — creating a Hybrid request creates 3 records (2 Style
                     1/Style 2 children + the parent), and the "record
                     created" trigger previously fired a notification for
                     all 3. Now checks hybrid_link_inverse (Airtable's
                     auto-generated reverse of hybrid_link — non-empty means
                     THIS record is a Hybrid child) and no-ops with
                     shouldNotify=false for children, mirroring the
                     interface's own exclusion of children from every list
                     view. Added `shouldNotify` output — gate the Slack/
                     Gmail action steps on it in Airtable, same as the
                     Decision Notification automation already does.
                     ---
                     v1.4.0 — proposedTotal now prefers the actual negotiated price
                     (internal_approved_pricing, else client_proposed_
                     pricing) over any calculated total, for both Regular
                     and Hybrid — same priority the interface itself uses.
                     The Hybrid child-based fallback (base_price + 85%
                     surcharge) now only applies when NEITHER negotiated
                     field has a value (a genuinely fresh Hybrid ask, never
                     countered) — v1.3.0 mistakenly always showed the
                     calculated total for Hybrid, even when a real
                     negotiated price existed.
                     ---
                     v1.3.0 — the "New Request" scenario splits into three
                     distinct messages (genuinely new ask / client
                     countered / SA countered), using isCounterProposal
                     (parent_customization_request non-empty) + decidedBy
                     (last_decision_by, now stamped on the new record
                     itself at creation, not just cleared on the parent
                     it supersedes) — previously all three shared one
                     generic message.
                     All field IDs verified against live base.

OBJECTIVE
  Whenever a new customization_requests record is created — a brand-new ask
  from the SA, the SA re-countering Margo's own counter, or the client
  countering — notify whoever's queue it just landed in, with a message that
  says explicitly which of the three it is. Counter-Proposed status only
  ever exists because Margo just created it, so that one case routes to the
  SA; every other case (empty/New Request) routes to Margo.

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
  hybrid_style_names         : 'fldEGgSq6Tohw9Xvz', // formula — "Style A & Style B", built off customized_style + additional_customized_style directly (2026-07-26 rework)
  internal_approved_pricing  : 'fldFRRjwVlCgHhPdA', // the negotiated price once Margo has approved/countered
  client_proposed_pricing    : 'fldNLwgg5sVAnoo4S', // the client's own counter-proposal price, before Margo reviews it
  date_of_request            : 'fldQdHAp256vsImBt',
  proposed_total_custom_price: 'fldtF37zwwAPb5hjS', // formula, currency-formatted — correct for both Regular and Hybrid
  parent_customization_request: 'fldh9tKr0Vmo84Yu6', // self-link — non-empty means this record is a counter-proposal
  last_decision_by           : 'fldQry5GGLTemQwZX', // Margo / SA / Client — who created THIS record (stamped by the interface at creation) or made the most recent decision on it
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
  // Airtable's Automation script sandbox has no setTimeout/setInterval —
  // this is the standard synchronous busy-wait workaround for "just pause
  // for a bit" inside a script step.
  static sleepSync(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) { /* busy wait */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING HELPER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class PricingHelper {
  static parseCurrencyString(str) {
    if (!str) return 0;
    const n = Number(String(str).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  static formatCurrency(n) {
    const safe = Number.isFinite(n) ? n : 0;
    return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
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
  _linkIds(r, f)   { const v = r?.getCellValue(f); if (!v || !Array.isArray(v)) return []; return v.map(x => x.id); }
  // Dates and formula-currency read cleanest via Airtable's own formatted
  // string representation rather than re-deriving the format by hand.
  _asString(r, f) { const v = r?.getCellValueAsString ? r.getCellValueAsString(f) : null; return v || null; }

  extract(record) {
    this.logger.step(2, 'Extracting plain values from record');
    const isHybrid = this._str(record, FIELDS_REQUEST.is_hybrid) === 'Hybrid';
    // A negotiated price always wins over any computed/calculated total —
    // internal_approved_pricing once Margo has weighed in (an internal
    // counter, or an approved client counter), otherwise
    // client_proposed_pricing while the client's own ask hasn't been
    // reviewed yet. Same priority the interface itself uses
    // (currentProposedPriceStr). Only a request with NEITHER — a genuinely
    // fresh ask, never countered — falls through to a calculated total:
    // proposed_total_custom_price for Regular, or the Hybrid child-based
    // fallback the Service computes next.
    const negotiatedPrice = this._asString(record, FIELDS_REQUEST.internal_approved_pricing)
      || this._asString(record, FIELDS_REQUEST.client_proposed_pricing);
    const data = {
      internalStatus     : this._str(record, FIELDS_REQUEST.internal_approval_status),
      saName             : this._lookupStr(record, FIELDS_REQUEST.sales_associate),
      clientName         : this._linkName(record, FIELDS_REQUEST.client) ?? 'a client',
      isHybrid,
      styleText          : isHybrid
        ? (this._asString(record, FIELDS_REQUEST.hybrid_style_names) ?? 'Hybrid')
        : (this._linkName(record, FIELDS_REQUEST.customized_style) ?? '—'),
      dateOfRequest      : this._asString(record, FIELDS_REQUEST.date_of_request) ?? '—',
      // proposed_total_custom_price is now correct for Hybrid too (2026-07-26
      // schema rework: effective_base_price computes the 85% surcharge over
      // whichever of the two directly-linked styles is pricier, feeding the
      // same formula chain Regular already used) — no more child-record
      // fallback needed here.
      proposedTotal      : negotiatedPrice ?? (this._asString(record, FIELDS_REQUEST.proposed_total_custom_price) ?? '—'),
      // Non-empty parent_customization_request means this record IS a
      // counter-proposal of something — combined with decidedBy (who created
      // it, stamped by the interface), this is what lets the resolver tell a
      // genuinely new ask apart from a client/SA re-counter that happens to
      // land at the same "New Request" status.
      isCounterProposal  : this._linkIds(record, FIELDS_REQUEST.parent_customization_request).length > 0,
      decidedBy          : this._str(record, FIELDS_REQUEST.last_decision_by),
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
    // counter — that record belongs on the SA's desk.
    if (data.internalStatus === 'Counter-Proposed') {
      if (!data.saName) throw new Error(
        `Guard clause: Counter-Proposed record has no sales_associate to notify (client: ${data.clientName}).`
      );
      this.logger.step(3, `Resolved → Counter-Proposed, notify SA: ${data.saName}`);
      return { scenario: 'counterProposed', recipientQuery: data.saName };
    }
    // Everything else here is "New Request" (Margo's queue), but three
    // different real causes land at that same status: a genuinely new ask,
    // the client re-countering, or the SA re-countering Margo's own counter.
    // isCounterProposal + decidedBy tell them apart.
    if (data.internalStatus === 'New Request' || !data.internalStatus) {
      if (data.isCounterProposal && data.decidedBy === 'Client') {
        this.logger.step(3, `Resolved → Client countered, notify Margo: ${CONFIG.MARGO_FULL_NAME}`);
        return { scenario: 'clientCounterProposed', recipientQuery: CONFIG.MARGO_FULL_NAME };
      }
      if (data.isCounterProposal && data.decidedBy === 'SA') {
        this.logger.step(3, `Resolved → SA countered, notify Margo: ${CONFIG.MARGO_FULL_NAME}`);
        return { scenario: 'saCounterProposed', recipientQuery: CONFIG.MARGO_FULL_NAME };
      }
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
  // On "record created", a formula/rollup field downstream of the just-
  // written style/customization_pricing links (proposed_total_custom_price,
  // here) can still be mid-recalculation on Airtable's side for a moment —
  // reading it immediately can return 0 even though the record itself is
  // fully written. Rather than trust a fixed delay (which either wastes
  // time or isn't long enough) or re-derive the formula ourselves in script
  // (fragile — proposed_total_custom_price is a 5-field-deep formula chain
  // that would silently drift out of sync with any future change to the
  // base), poll: re-fetch up to maxAttempts times, stopping as soon as
  // settleOnFieldId actually has a value.
  async getById(recordId, { settleOnFieldId = null, maxAttempts = 4, waitMs = 2000 } = {}) {
    this.logger.step(1, `Loading request record → ${recordId}`);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_REQUEST) });
      const record = result.records.find(r => r.id === recordId);
      if (!record) throw new Error(`Guard clause: request record not found → recordId: ${recordId}`);
      if (!settleOnFieldId || record.getCellValue(settleOnFieldId)) {
        this.logger.audit(`Record loaded → ${recordId} (settled on attempt ${attempt}/${maxAttempts})`);
        return record;
      }
      if (attempt < maxAttempts) {
        this.logger.audit(`${settleOnFieldId} still empty on attempt ${attempt}/${maxAttempts} — waiting ${waitMs}ms and retrying`);
        DateManager.sleepSync(waitMs);
      } else {
        this.logger.audit(`${settleOnFieldId} still empty after ${maxAttempts} attempts — proceeding with whatever it has`);
        return record;
      }
    }
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
    const entries = {
      counterProposed: {
        subject: `Counter-proposal ready for your review — ${data.clientName}`,
        intro: `Margo countered on ${data.clientName}'s request. It's on your desk in Workdesk as Counter-Proposed — review, approve, deny, or counter again.`,
      },
      clientCounterProposed: {
        subject: `Client counter-proposal needs your review — ${data.clientName}`,
        intro: `This is a counter-proposal from the client — ${data.clientName} countered on this request. It's waiting in New Requests for your review.`,
      },
      saCounterProposed: {
        subject: `SA counter-proposal needs your review — ${data.clientName}`,
        intro: `This is a counter-proposal from the SA — ${data.saName || 'the SA'} countered on this request. It's waiting in New Requests for your review.`,
      },
      newRequest: {
        subject: `New customization request needs your review — ${data.clientName}`,
        intro: `A customization request for ${data.clientName} needs your review${data.saName ? ` (from ${data.saName})` : ''}. It's waiting in New Requests.`,
      },
    };
    const entry = entries[scenario] ?? entries.newRequest;
    return {
      subject: entry.subject,
      slackMessage: `${entry.intro}\n\n${details}\n\n${MessageBuilder._slackLink(pageUrl, recordId)}`,
      gmailMessage: `${entry.intro}\n\n${details}\n\n${MessageBuilder._gmailLink(pageUrl, recordId)}`,
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

    // Step 1 — Load record, polling until proposed_total_custom_price has
    // actually settled (see RequestRepository.getById for why). Correct for
    // Hybrid too since the 2026-07-26 schema rework (effective_base_price
    // computes the 85% surcharge natively) — every request is its own
    // single record now, so no Hybrid-child skip or fallback total needed
    // here anymore.
    const record = await this.requestRepo.getById(recordId, {
      settleOnFieldId: FIELDS_REQUEST.proposed_total_custom_price,
    });

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
      shouldNotify   : true,
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
  shouldNotify   : false,
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
output.set('shouldNotify',   result.shouldNotify);
output.set('recipientName',  result.recipientName);
output.set('recipientEmail', result.recipientEmail);
output.set('slackId',        result.slackId);
output.set('subject',        result.subject);
output.set('slackMessage',   result.slackMessage);
output.set('gmailMessage',   result.gmailMessage);
output.set('error_message',  result.error_message);
output.set('log_summary',    logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | recipient: ${result.recipientName}`);

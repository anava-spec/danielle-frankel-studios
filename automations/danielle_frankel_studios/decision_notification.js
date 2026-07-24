/*
================================================================================
AUTOMATION : Decision Notification — Record Updated
BASE       : app6Q4xMZ1ngJxiV8 (sandbox — mirror to Production when ready)
TABLE SRC  : customization_requests (tbl7HUWDI7IRjWY92)
TABLE REF  : staff (tblbYk88xJ8FQrLS4)
TRIGGER    : When record updated — customization_requests
             (watched fields: internal_approval_status, client_approval_status)
VERSION    : 1.2.0 — proposedTotal now prefers the actual negotiated price
                     (internal_approved_pricing, else client_proposed_
                     pricing) over any calculated total, for both Regular
                     and Hybrid — same priority the interface itself uses.
                     The Hybrid child-based fallback now only applies when
                     NEITHER negotiated field has a value (a genuinely
                     fresh Hybrid ask, never countered) — v1.1.0 mistakenly
                     always showed the calculated total for Hybrid, even
                     when a real negotiated price existed (e.g. right after
                     Margo approves a Hybrid counter-proposal).
                     ---
                     v1.1.0 — fixed proposedTotal always reading $0/blank
                     for Hybrid requests: proposed_total_custom_price is a
                     Regular-only formula that Hybrid never populates (its
                     base_price and customization pricing live on its two
                     Style 1/Style 2 children, not the parent). Added
                     PricingHelper, which computes Hybrid's real total from
                     those two children's base_price (base + 85% surcharge
                     off the higher child).
                     All field IDs verified against live base.

OBJECTIVE
  Whenever Margo, the SA, or the client makes an Approve/Deny decision,
  notify whoever didn't just act. last_decision_by (Margo/SA/Client) — written
  by the interface itself at the moment of the decision — is what makes this
  possible, since internal_approval_status lands on the same "Approved"/
  "Denied" value regardless of who decided. Every Denied branch always
  includes the reason on record.

GUARD CLAUSE
  1. recordId must be present in input.config().
  2. The record must actually exist when read back.
  3. This is NOT an error path: if last_decision_by + the relevant status
     don't line up to a known decision (e.g. the field changed to "Request
     Review" or "Under Review" — a stage move, not a decision), the script
     completes normally with shouldNotify = false. A downstream Conditional
     Logic step gates Slack/Gmail on shouldNotify so nothing sends.

ERROR HANDLING
  Errors thrown with descriptive messages. Airtable's native run-failure
  notification alerts the automation owner.

OUTPUTS (output.set)
  status         : "SUCCESS" | "ERROR"
  shouldNotify   : true | false — gates the Conditional Logic step downstream
  recipientName  : staff full_name to notify (blank if shouldNotify is false)
  recipientEmail : staff Email
  slackId        : staff slack_id
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
  client_approval_status     : 'fldwE1BTp4G5eF2jR',
  last_decision_by           : 'fldQry5GGLTemQwZX',
  internal_denial_reason     : 'fldMaJF9el2FKX3jT',
  sa_denial_reason           : 'fldpouuzI4UeesdS3',
  client_denial_reason       : 'fldaNnUvdDPIdg3kN',
  sales_associate            : 'fldZ5towmwbgJho67', // lookup (text) through client
  client                     : 'fldOeL4VVcXaKwwlN', // multipleRecordLinks
  customized_style           : 'fldCaKP1d4C0aohQE', // multipleRecordLinks
  is_hybrid                  : 'fld1stC4sHuPT4pT4', // singleSelect — Regular / Hybrid
  hybrid_style_names         : 'fldMHwhsQ7rmvjqBb', // rollup — already-formatted "Style A & Style B"
  hybrid_link                : 'fldewS0eFvZsoS30g', // multipleRecordLinks — the 2 Style 1/Style 2 child records
  base_price                 : 'fldLBXbdD3SUfXSgL', // lookup — used to compute the Hybrid fallback total (see below)
  internal_approved_pricing  : 'fldFRRjwVlCgHhPdA', // the negotiated price once Margo has approved/countered
  client_proposed_pricing    : 'fldNLwgg5sVAnoo4S', // the client's own counter-proposal price, before Margo reviews it
  date_of_request            : 'fldQdHAp256vsImBt',
  proposed_total_custom_price: 'fldtF37zwwAPb5hjS', // formula, currency-formatted — Regular only, always empty/0 for Hybrid
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
// PRICING HELPER CLASS
// Pure math — mirrors the interface's own computeHybridCombinedTotal(),
// since Hybrid requests never populate proposed_total_custom_price (it's a
// Regular-only formula; the interface computes Hybrid's own total
// client-side from its two children's base prices instead).
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
  // Same formula as the interface: base + 85% surcharge, off the HIGHER of
  // the two children's base prices.
  static computeHybridTotal(basePrice1, basePrice2) {
    return Math.max(basePrice1, basePrice2) * 1.85;
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
      decidedBy      : this._str(record, FIELDS_REQUEST.last_decision_by),
      internalStatus : this._str(record, FIELDS_REQUEST.internal_approval_status),
      clientStatus   : this._str(record, FIELDS_REQUEST.client_approval_status),
      saName         : this._lookupStr(record, FIELDS_REQUEST.sales_associate),
      clientName     : this._linkName(record, FIELDS_REQUEST.client) ?? 'a client',
      isHybrid,
      hybridLinkIds  : isHybrid ? this._linkIds(record, FIELDS_REQUEST.hybrid_link) : [],
      styleText      : isHybrid
        ? (this._asString(record, FIELDS_REQUEST.hybrid_style_names) ?? 'Hybrid')
        : (this._linkName(record, FIELDS_REQUEST.customized_style) ?? '—'),
      dateOfRequest  : this._asString(record, FIELDS_REQUEST.date_of_request) ?? '—',
      proposedTotal  : negotiatedPrice
        ?? (isHybrid ? null : (this._asString(record, FIELDS_REQUEST.proposed_total_custom_price) ?? '—')),
      needsHybridFallback: isHybrid && !negotiatedPrice,
      internalDenialReason : this._str(record, FIELDS_REQUEST.internal_denial_reason),
      saDenialReason       : this._str(record, FIELDS_REQUEST.sa_denial_reason),
      clientDenialReason   : this._str(record, FIELDS_REQUEST.client_denial_reason),
    };
    this.logger.debug(`Extracted → ${JSON.stringify(data)}`);
    return data;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO RESOLVER CLASS
// Pure business logic — decides whether this update is a notification-worthy
// decision, who made it, who to notify, and (for denials) the reason.
// No Airtable calls.
// ─────────────────────────────────────────────────────────────────────────────

class ScenarioResolver {
  constructor(logger) { this.logger = logger; }

  resolve(data) {
    const isDecisionStatus = data.internalStatus === 'Approved' || data.internalStatus === 'Denied';
    const isClientDecision = data.clientStatus === 'Approved' || data.clientStatus === 'Denied';

    if (data.decidedBy === 'Margo' && isDecisionStatus) {
      this.logger.step(3, `Resolved → Margo ${data.internalStatus}, notify SA: ${data.saName}`);
      return {
        shouldNotify: true, recipientQuery: data.saName,
        scenario: `margo${data.internalStatus}`, // margoApproved | margoDenied
        reason: data.internalStatus === 'Denied' ? data.internalDenialReason : null,
      };
    }
    if (data.decidedBy === 'SA' && isDecisionStatus) {
      this.logger.step(3, `Resolved → SA ${data.internalStatus}, notify Margo`);
      return {
        shouldNotify: true, recipientQuery: CONFIG.MARGO_FULL_NAME,
        scenario: `sa${data.internalStatus}`, // saApproved | saDenied
        reason: data.internalStatus === 'Denied' ? data.saDenialReason : null,
      };
    }
    if (data.decidedBy === 'Client' && isClientDecision) {
      this.logger.step(3, `Resolved → Client ${data.clientStatus}, notify Margo`);
      return {
        shouldNotify: true, recipientQuery: CONFIG.MARGO_FULL_NAME,
        scenario: `client${data.clientStatus}`, // clientApproved | clientDenied
        reason: data.clientStatus === 'Denied' ? data.clientDenialReason : null,
      };
    }

    // Not a notification-worthy transition (e.g. -> Request Review,
    // -> Under Review, -> Denied • Counter-Proposal) — normal no-op, not an
    // error. The Conditional Logic step downstream gates on shouldNotify.
    this.logger.step(3, `Resolved → no notification-worthy decision (decidedBy: ${data.decidedBy}, internal: ${data.internalStatus}, client: ${data.clientStatus})`);
    return { shouldNotify: false, recipientQuery: null, scenario: null, reason: null };
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

  // Fetches specific records by ID from the same table — used to pull a
  // Hybrid request's two Style 1/Style 2 child records (linked via
  // hybrid_link) so their base_price can feed PricingHelper.computeHybridTotal.
  async getByIds(ids, fieldIds) {
    if (!ids.length) return [];
    const result = await this.table.selectRecordsAsync({ fields: fieldIds });
    return ids.map(id => result.records.find(r => r.id === id)).filter(Boolean);
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

  static forScenario(scenario, data, reason, pageUrl, recordId) {
    const details = MessageBuilder._details(data);
    const intros = {
      margoApproved  : { subject: `Margo approved — ${data.clientName}`, body: `Margo approved the request for ${data.clientName}. Ready to send to the client.` },
      margoDenied    : { subject: `Margo denied — ${data.clientName}`, body: `Margo denied the request for ${data.clientName}.\n\nReason: ${reason}` },
      saApproved     : { subject: `${data.saName} approved your counter — ${data.clientName}`, body: `${data.saName} approved your counter-proposal for ${data.clientName}. Ready to send to the client.` },
      saDenied       : { subject: `${data.saName} denied your counter — ${data.clientName}`, body: `${data.saName} denied your counter-proposal for ${data.clientName}.\n\nReason: ${reason}` },
      clientApproved : { subject: `Client approved — ${data.clientName}`, body: `${data.clientName} approved the proposal. Sent to production.` },
      clientDenied   : { subject: `Client denied — ${data.clientName}`, body: `${data.clientName} denied the proposal.\n\nReason: ${reason}` },
    };
    const entry = intros[scenario];
    if (!entry) return { subject: null, slackMessage: null, gmailMessage: null };
    return {
      subject: entry.subject,
      slackMessage: `${entry.body}\n\n${details}\n\n${MessageBuilder._slackLink(pageUrl, recordId)}`,
      gmailMessage: `${entry.body}\n\n${details}\n\n${MessageBuilder._gmailLink(pageUrl, recordId)}`,
    };
  }
  static error(errMsg) {
    return `❌ NOTIFICATION FAILED\nError: ${errMsg}\nAction: Review automation run logs for step-by-step trace.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS — Orchestrates all steps
// ─────────────────────────────────────────────────────────────────────────────

class DecisionNotificationService {
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

    // Only a Hybrid request with NO negotiated price at all (a genuinely
    // fresh ask, never countered) needs this — the mapper already prefers
    // internal_approved_pricing/client_proposed_pricing when either exists.
    // Hybrid never populates proposed_total_custom_price on its own, so this
    // fallback mirrors the interface's own computeHybridCombinedTotal from
    // its two Style 1/Style 2 children's base_price.
    if (data.needsHybridFallback) {
      const children = await this.requestRepo.getByIds(data.hybridLinkIds, [FIELDS_REQUEST.base_price]);
      const [c1, c2] = children;
      const b1 = c1 ? PricingHelper.parseCurrencyString(c1.getCellValueAsString(FIELDS_REQUEST.base_price)) : 0;
      const b2 = c2 ? PricingHelper.parseCurrencyString(c2.getCellValueAsString(FIELDS_REQUEST.base_price)) : 0;
      data.proposedTotal = PricingHelper.formatCurrency(PricingHelper.computeHybridTotal(b1, b2));
      this.logger.audit(`No negotiated price on record — Hybrid fallback total computed from children → ${data.proposedTotal}`);
    }

    // Step 3 — Resolve scenario (may resolve to shouldNotify: false — not an error)
    const { shouldNotify, recipientQuery, scenario, reason } = this.resolver.resolve(data);

    if (!shouldNotify) {
      this.logger.minimal('SUCCESS → no-op, not a notification-worthy transition');
      return {
        status: 'SUCCESS', shouldNotify: false,
        recipientName: null, recipientEmail: null, slackId: null,
        subject: null, slackMessage: null, gmailMessage: null, error_message: null,
      };
    }

    // Step 4 — Look up staff contact info
    const staff = await this.staffRepo.findByFullName(recipientQuery);
    const recipientEmail = staff ? (staff.getCellValueAsString(FIELDS_STAFF.email) || '') : '';
    const slackId         = staff ? (staff.getCellValueAsString(FIELDS_STAFF.slack_id) || '') : '';

    // Step 5 — Build messages (one per channel, same content, different link markdown)
    const { subject, slackMessage, gmailMessage } = MessageBuilder.forScenario(scenario, data, reason, this.pageUrl, recordId);

    this.logger.minimal(`SUCCESS → notify ${recipientQuery} (${scenario}) for ${data.clientName}`);

    return {
      status: 'SUCCESS', shouldNotify: true,
      recipientName: recipientQuery, recipientEmail, slackId,
      subject, slackMessage, gmailMessage, error_message: null,
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
    'Guard clause: missing required input "recordId". Ensure the trigger step maps the updated record\'s ID.'
  );

  logger.audit(`Automation started → recordId: ${recordId} | isProduction: ${isProduction}`);

  const service = new DecisionNotificationService(
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

logger.audit(`Script complete → status: ${result.status} | shouldNotify: ${result.shouldNotify}`);

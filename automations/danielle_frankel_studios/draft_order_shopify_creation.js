/*
================================================================================
AUTOMATION : Shopify Draft Order Creation — Call Cobalt Endpoint
BASE       : appMmEE4zyHMGhkkd (sandbox — mirror to Production appUC2NFAlURayLx9
             once verified)
TABLE SRC  : draft_orders (tblp7foUmlN9823WW)
TRIGGER    : When shopify_draft_order_status changes to "Endpoint Call Ongoing"
             (set by the Draft Orders interface right after it locks the
             record — see draft_orders.README.md)
GROUP      : Draft Orders
VERSION    : 1.0.0 — all field IDs verified against live sandbox base

OBJECTIVE
  Take a draft_orders record that the interface has already locked and
  flagged as "Endpoint Call Ongoing", re-confirm it's actually eligible,
  then call Cobalt's staging endpoint so Cobalt creates the real Shopify
  draft order (Cobalt owns all line-item / pricing / discount / notes
  logic — this script only sends the record ID and processes the result).
  On success, writes the returned Shopify identifiers back to the record
  and hands off a ready-made confirmation email to the initiator via a
  downstream native Send Email action. On any failure (guard clause,
  Cobalt error response, or network/timeout), writes a specific reason to
  sync_error_message and hands off a failure alert for the studio admin
  mailbox via a second downstream Send Email action.

isProd (real end-to-end test without emailing anyone, 2026-08-11)
  Optional boolean input, defaults to true (production behavior) when left
  unset. Set to false to run the REAL flow end-to-end — guard clause, real
  Cobalt call, real Shopify draft order, real Airtable write-back — but with
  shouldSendConfirmation/shouldSendFailureAlert forced to false afterward, so
  the downstream Send Email nodes never fire. Use this to verify Shopify +
  Airtable behavior without sending anyone an email. Independent of
  SIMULATION MODE below (which never touches Cobalt/Airtable at all).

SIMULATION MODE (email-content testing only, 2026-08-11)
  Two optional boolean inputs — simulateSuccessEmail / simulateFailureEmail —
  let you generate one or both email outputs WITHOUT calling Cobalt or
  writing anything to Airtable, so you can eyeball the email text without a
  real draft order or a valid COBALT_API_KEY. If draftOrderRecordId is also
  provided, the real draft_id/initiated_by_email are read for realism; if
  omitted (or the lookup fails), placeholder values are used instead. Either
  flag can be set alone or both together. When either is true, the normal
  guard clause / Cobalt call / Airtable writes are skipped entirely — this
  path never locks a record or hits the real endpoint.

GUARD CLAUSE (reconfirmed here even though the interface already checked
  before setting shopify_draft_order_status — this script is the source of
  truth, the interface check is only for UX)
  1. draftOrderRecordId must be present in input.config().
  2. The record must actually exist when read back.
  3. locked must be true.
  4. shopify_draft_order_status must currently be "Endpoint Call Ongoing"
     (protects against a stale/duplicate trigger firing on an already
     Completed/Failed record).
  5. client must be linked.
  6. style OR customizations must have at least one linked record.
  7. The linked client must have ready_to_wear_size set.
  Any of 3-7 failing → status set to "Failed", sync_error_message written
  with the specific reason, script exits without calling Cobalt. This is a
  normal guarded outcome, not a script error.

COBALT CALL
  POST https://df-airtable-crm-sync-staging-deeae361b95c.herokuapp.com/draft-orders/create
  Header: x-api-key: <COBALT_API_KEY, read via input.secret() — Airtable's
  Secrets panel, not input.config()>
  Body:   { "draftOrderId": "<draftOrderRecordId>" }
  Response codes handled: 200 success, 400 (already locked in Cobalt),
  404 (not found in Cobalt), 422 (product/variant unresolvable, including
  fallback), any other status or network/timeout error.

ERROR HANDLING
  Guard-clause failures and Cobalt failure responses are NOT thrown — they
  are normal outcomes written to shopify_draft_order_status = "Failed" +
  sync_error_message, then the script returns SUCCESS (the automation ran
  correctly; the *draft order* failed). Only an unexpected script error
  (e.g. can't write to Airtable at all) throws, so Airtable's native
  run-failure notification catches truly broken runs.
  If the write-back after a Cobalt success (or the email hand-off) itself
  fails, that's logged but NOT re-thrown — the Shopify draft order already
  exists at that point, so failing the automation run would be misleading.

OUTPUTS (output.set)
  status               : "SUCCESS" | "ERROR" (script-level, see above)
  outcome              : "Completed" | "Failed" | null (on ERROR)
  shopifyDraftOrderId  : written to draft_order_id (null on Failed/ERROR)
  draftOrderName       : written to draft_order_name (null on Failed/ERROR)
  invoiceUrl           : written to invoice_url (null on Failed/ERROR)
  shouldSendConfirmation : true | false — gates the confirmation Send Email
  confirmationToEmail    : initiator's email (initiated_by_email)
  confirmationSubject    : subject line
  confirmationMessage    : body, Markdown
  shouldSendFailureAlert : true | false — gates the failure Send Email
  failureToEmail          : studio admin mailbox (CONFIG.STUDIO_ADMIN_EMAIL)
  failureSubject           : subject line
  failureMessage           : body, Markdown
  error_message         : null on success
  log_summary            : full Logger output
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  DRAFT_ORDERS : 'tblp7foUmlN9823WW',
  DF_CLIENTS   : 'tblLLUlDgJ4ktzF7c',
};

// Fields — draft_orders (tblp7foUmlN9823WW)
const FIELDS_DRAFT_ORDER = {
  draft_id                    : 'fldXiofTxlsl3NSro', // formula, human-readable ID
  client                      : 'fldV0tUFndHpPYqDD', // multipleRecordLinks -> DF Clients
  style                       : 'fld6rRHCKAlANOviR', // multipleRecordLinks
  customizations               : 'fldN97WQmsI1M5J0g', // multipleRecordLinks
  locked                       : 'fldTcFzPYNKajZepk', // checkbox
  shopify_draft_order_status   : 'fldsQlDqjhvTodXgR', // singleSelect
  sync_error_message           : 'fldvexiG5evwmjnaw', // multilineText
  initiated_by_email           : 'fldCapGqxZZo1b9o4', // email
  draft_order_id                : 'fldV3F3ZNE1e4Dvv9', // singleLineText (Shopify identifier)
  draft_order_name               : 'fldVMaJhy6aMND88N', // singleLineText
  invoice_url                     : 'fldTUOmkWL6x6wFsH', // url
};

// Fields — DF Clients (tblLLUlDgJ4ktzF7c)
const FIELDS_DF_CLIENTS = {
  ready_to_wear_size : 'fldEEH4CK3Qqp0g0C', // number
};

const STATUS = {
  ENDPOINT_CALL_ONGOING : 'Endpoint Call Ongoing',
  COMPLETED             : 'Completed',
  FAILED                : 'Failed',
};

const CONFIG = {
  LOG_LEVEL         : 'B', // A=minimal | B=audit (default) | C=debug
  COBALT_ENDPOINT   : 'https://df-airtable-crm-sync-staging-deeae361b95c.herokuapp.com/draft-orders/create',
  STUDIO_ADMIN_EMAIL : 'julia.shao.collins@daniellefrankelstudio.com',
  // Same convention as waitlist_alert_readiness.js's BUSINESS_TIME_ZONE —
  // Airtable's script runtime executes in UTC, not the studio's local time.
  STUDIO_TIME_ZONE : 'America/New_York',
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
// Only used for timestamping log lines / message bodies here — no business
// date math in this automation (unlike waitlist_alert_readiness.js).
// ─────────────────────────────────────────────────────────────────────────────

class DateManager {
  static nowIso() { return new Date().toISOString(); }

  // Human-friendly timestamp for the failure email, e.g. "July 4th, 2026
  // 10:00 am" — studio timezone (matches CONFIG.STUDIO_TIME_ZONE, same
  // convention as waitlist_alert_readiness.js's BUSINESS_TIME_ZONE), not UTC
  // (Airtable's script runtime executes in UTC).
  static formatFriendly(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).formatToParts(date);
    const get = (type) => parts.find(p => p.type === type)?.value ?? '';
    const day = Number(get('day'));
    return `${get('month')} ${day}${DateManager._ordinalSuffix(day)}, ${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
  }

  static _ordinalSuffix(day) {
    if (day % 100 >= 11 && day % 100 <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT ORDER REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class DraftOrderRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.DRAFT_ORDERS);
    this.logger = logger;
  }

  async getById(recordId) {
    this.logger.step(1, `Loading draft_orders record → ${recordId}`);
    const record = await this.table.selectRecordAsync(recordId, {
      fields: Object.values(FIELDS_DRAFT_ORDER),
    });
    if (!record) throw new Error(`Guard clause: draft_orders record not found → recordId: ${recordId}`);
    this.logger.audit(`Record loaded → ${recordId}`);
    return record;
  }

  async writeFailed(recordId, errorMessage) {
    this.logger.step(6, `Writing Failed outcome → ${recordId}`);
    await this.table.updateRecordAsync(recordId, {
      [FIELDS_DRAFT_ORDER.shopify_draft_order_status] : { name: STATUS.FAILED },
      [FIELDS_DRAFT_ORDER.sync_error_message]          : errorMessage,
    });
    this.logger.audit('Failed status + sync_error_message written');
  }

  async writeCompleted(recordId, { shopifyDraftOrderId, draftOrderName, invoiceUrl }) {
    this.logger.step(6, `Writing Completed outcome → ${recordId}`);
    const payload = {
      [FIELDS_DRAFT_ORDER.shopify_draft_order_status] : { name: STATUS.COMPLETED },
      [FIELDS_DRAFT_ORDER.sync_error_message]          : null,
    };
    if (shopifyDraftOrderId) payload[FIELDS_DRAFT_ORDER.draft_order_id]   = String(shopifyDraftOrderId);
    if (draftOrderName)      payload[FIELDS_DRAFT_ORDER.draft_order_name] = String(draftOrderName);
    if (invoiceUrl)          payload[FIELDS_DRAFT_ORDER.invoice_url]       = String(invoiceUrl);
    await this.table.updateRecordAsync(recordId, payload);
    this.logger.audit('Completed status + Shopify identifiers written');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DF CLIENTS REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class DFClientsRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.DF_CLIENTS);
    this.logger = logger;
  }

  async getById(clientRecordId) {
    this.logger.step(2, `Loading linked DF Clients record → ${clientRecordId}`);
    const record = await this.table.selectRecordAsync(clientRecordId, {
      fields: [FIELDS_DF_CLIENTS.ready_to_wear_size],
    });
    if (!record) throw new Error(`Guard clause: linked DF Clients record not found → recordId: ${clientRecordId}`);
    return record;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY VALIDATOR CLASS
// Pure business logic — decides if this draft order is actually eligible
// to be sent to Cobalt right now. No Airtable writes.
// ─────────────────────────────────────────────────────────────────────────────

class EligibilityValidator {
  constructor(logger) { this.logger = logger; }

  // Checks everything derivable from the draft_orders record alone.
  // Returns { eligible, reason, clientRecordId }.
  validateDraftOrder(record) {
    const locked = record.getCellValue(FIELDS_DRAFT_ORDER.locked);
    if (!locked) {
      return { eligible: false, reason: 'Guard clause failed: draft order is not locked.' };
    }

    const statusVal = record.getCellValue(FIELDS_DRAFT_ORDER.shopify_draft_order_status);
    if (!statusVal || statusVal.name !== STATUS.ENDPOINT_CALL_ONGOING) {
      return {
        eligible: false,
        reason: `Guard clause failed: shopify_draft_order_status is "${statusVal?.name ?? 'empty'}", expected "${STATUS.ENDPOINT_CALL_ONGOING}".`,
      };
    }

    const clientLinks = record.getCellValue(FIELDS_DRAFT_ORDER.client);
    if (!Array.isArray(clientLinks) || clientLinks.length === 0) {
      return { eligible: false, reason: 'Guard clause failed: no client linked to this draft order.' };
    }

    const styleLinks = record.getCellValue(FIELDS_DRAFT_ORDER.style);
    const customizationLinks = record.getCellValue(FIELDS_DRAFT_ORDER.customizations);
    const hasStyle = Array.isArray(styleLinks) && styleLinks.length > 0;
    const hasCustomization = Array.isArray(customizationLinks) && customizationLinks.length > 0;
    if (!hasStyle && !hasCustomization) {
      return { eligible: false, reason: 'Guard clause failed: at least one Style or Customization is required.' };
    }

    return { eligible: true, reason: null, clientRecordId: clientLinks[0].id };
  }

  // Checks the linked client's ready_to_wear_size. Separate step because it
  // requires a second table read.
  validateClient(clientRecord) {
    const size = clientRecord.getCellValue(FIELDS_DF_CLIENTS.ready_to_wear_size);
    if (size === null || size === undefined) {
      return { eligible: false, reason: "Guard clause failed: client's Ready to Wear size is missing." };
    }
    return { eligible: true, reason: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COBALT SERVICE CLASS
// Owns the HTTP call to the Cobalt staging endpoint. No Airtable calls.
// ─────────────────────────────────────────────────────────────────────────────

class CobaltService {
  constructor(apiKey, logger) {
    this.apiKey = apiKey;
    this.logger = logger;
  }

  // Returns { httpStatus, ok, body } — never throws on a non-200 response,
  // only throws on a genuine network/fetch failure so the caller can tell
  // "Cobalt answered with an error" apart from "we couldn't reach Cobalt".
  async createDraftOrder(draftOrderRecordId) {
    this.logger.step(3, `Calling Cobalt → ${CONFIG.COBALT_ENDPOINT}`);
    let response;
    try {
      response = await fetch(CONFIG.COBALT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ draftOrderId: draftOrderRecordId }),
      });
    } catch (networkErr) {
      throw new Error(`Cobalt call failed — network/timeout error: ${networkErr.message}`);
    }

    let body = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON body (e.g. an empty 500) — leave body null, status still tells us the outcome.
    }

    this.logger.audit(`Cobalt responded → HTTP ${response.status}`);
    this.logger.debug(`Cobalt response body → ${JSON.stringify(body)}`);

    return { httpStatus: response.status, ok: response.ok, body };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER CLASS
// Composes the confirmation + failure emails. No logic — strings only.
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  static confirmation(draftId, draftOrderName, invoiceUrl) {
    const subject = `[Draft Order] Shopify draft order created — ${draftId}`;
    const message =
      `Your Shopify draft order was created successfully.\n\n` +
      `- **Draft order:** ${draftId}\n` +
      `- **Shopify draft order:** ${draftOrderName || '—'}\n` +
      `- **Invoice link:** ${invoiceUrl || '—'}`;
    return { subject, message };
  }

  static failureAlert(draftId, reason) {
    const subject = `[Draft Order] Shopify draft order creation FAILED — ${draftId}`;
    const message =
      `A Shopify draft order creation attempt failed and needs review.\n\n` +
      `- **Draft order:** ${draftId}\n` +
      `- **Reason:** ${reason}\n` +
      `- **Time:** ${DateManager.formatFriendly(new Date(), CONFIG.STUDIO_TIME_ZONE)}`;
    return { subject, message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS — Orchestrates all steps
// ─────────────────────────────────────────────────────────────────────────────

class DraftOrderShopifyCreationService {
  constructor(draftOrderRepo, clientsRepo, validator, cobalt, logger) {
    this.draftOrderRepo = draftOrderRepo;
    this.clientsRepo    = clientsRepo;
    this.validator       = validator;
    this.cobalt          = cobalt;
    this.logger          = logger;
  }

  // Maps a Cobalt HTTP status to a specific, actionable sync_error_message.
  _reasonForHttpFailure(httpStatus, body) {
    if (httpStatus === 404) return 'Draft order record not found in Cobalt (404).';
    if (httpStatus === 400) return 'Draft order is already locked in Cobalt (400).';
    if (httpStatus === 422) return 'Could not resolve a product/variant for this draft order, including fallback (422).';
    const detail = body?.error || body?.message;
    return `Cobalt returned an unexpected error (HTTP ${httpStatus})${detail ? `: ${detail}` : '.'}`;
  }

  async run(draftOrderRecordId) {
    this.logger.audit(`Service started → draft_orders record: ${draftOrderRecordId}`);

    // Step 1 — Load the draft order
    const record = await this.draftOrderRepo.getById(draftOrderRecordId);
    const draftId = record.getCellValueAsString(FIELDS_DRAFT_ORDER.draft_id) || draftOrderRecordId;
    const initiatedByEmail = record.getCellValueAsString(FIELDS_DRAFT_ORDER.initiated_by_email);

    // Step 2 — Guard clause, part 1 (fields on the draft order itself)
    const draftCheck = this.validator.validateDraftOrder(record);
    if (!draftCheck.eligible) {
      return this._fail(draftOrderRecordId, draftId, initiatedByEmail, draftCheck.reason);
    }

    // Step 2 — Guard clause, part 2 (linked client's ready_to_wear_size)
    const clientRecord = await this.clientsRepo.getById(draftCheck.clientRecordId);
    const clientCheck = this.validator.validateClient(clientRecord);
    if (!clientCheck.eligible) {
      return this._fail(draftOrderRecordId, draftId, initiatedByEmail, clientCheck.reason);
    }

    this.logger.step(2, `Guard passed → draft: ${draftId}`);

    // Step 3-4 — Call Cobalt
    let cobaltResult;
    try {
      cobaltResult = await this.cobalt.createDraftOrder(draftOrderRecordId);
    } catch (cobaltErr) {
      // Network/timeout — still a normal "Failed" outcome for this draft order,
      // not a script-level error (see header comment).
      return this._fail(draftOrderRecordId, draftId, initiatedByEmail, cobaltErr.message);
    }

    if (!cobaltResult.ok || cobaltResult.body?.success !== true) {
      const reason = this._reasonForHttpFailure(cobaltResult.httpStatus, cobaltResult.body);
      return this._fail(draftOrderRecordId, draftId, initiatedByEmail, reason);
    }

    // Step 5 — Success: write result back
    const { shopifyDraftOrderId, draftOrderName, invoiceUrl } = cobaltResult.body;
    await this.draftOrderRepo.writeCompleted(draftOrderRecordId, { shopifyDraftOrderId, draftOrderName, invoiceUrl });

    this.logger.minimal(`SUCCESS → Completed for ${draftId} | shopifyDraftOrderId: ${shopifyDraftOrderId}`);

    // Step 6 — Hand off confirmation email
    const { subject, message } = MessageBuilder.confirmation(draftId, draftOrderName, invoiceUrl);

    return {
      status: 'SUCCESS',
      outcome: STATUS.COMPLETED,
      shopifyDraftOrderId: shopifyDraftOrderId ?? null,
      draftOrderName: draftOrderName ?? null,
      invoiceUrl: invoiceUrl ?? null,
      shouldSendConfirmation: Boolean(initiatedByEmail),
      confirmationToEmail: initiatedByEmail || null,
      confirmationSubject: subject,
      confirmationMessage: message,
      shouldSendFailureAlert: false,
      failureToEmail: null,
      failureSubject: null,
      failureMessage: null,
      error_message: null,
    };
  }

  // Shared failure path — writes Failed + sync_error_message, builds the
  // admin failure alert. Not a thrown error (see header ERROR HANDLING).
  async _fail(draftOrderRecordId, draftId, initiatedByEmail, reason) {
    this.logger.step(6, `Not eligible / Cobalt failure → ${reason}`);
    await this.draftOrderRepo.writeFailed(draftOrderRecordId, reason);

    const { subject, message } = MessageBuilder.failureAlert(draftId, reason);

    this.logger.minimal(`SUCCESS → Failed for ${draftId} | reason: ${reason}`);

    return {
      status: 'SUCCESS',
      outcome: STATUS.FAILED,
      shopifyDraftOrderId: null,
      draftOrderName: null,
      invoiceUrl: null,
      shouldSendConfirmation: false,
      confirmationToEmail: null,
      confirmationSubject: null,
      confirmationMessage: null,
      shouldSendFailureAlert: true,
      failureToEmail: CONFIG.STUDIO_ADMIN_EMAIL,
      failureSubject: subject,
      failureMessage: message,
      error_message: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION SERVICE
// Builds the same shouldSendConfirmation/shouldSendFailureAlert output shape
// as a real run, but without ever calling Cobalt or writing to Airtable —
// used only to eyeball email content. See header comment for the two
// gating inputs (simulateSuccessEmail / simulateFailureEmail).
// ─────────────────────────────────────────────────────────────────────────────

class SimulationService {
  constructor(draftOrderRepo, logger) {
    this.draftOrderRepo = draftOrderRepo;
    this.logger = logger;
  }

  // Best-effort: pull the real draft_id/initiated_by_email if a valid
  // draftOrderRecordId was also provided, so the simulated email reads
  // realistically. Falls back to placeholders if it's missing or can't be
  // read — simulation mode should never fail just because of that.
  async _loadContext(draftOrderRecordId) {
    if (!draftOrderRecordId) {
      return { draftId: 'TEST-DRAFT', initiatedByEmail: 'simulation-test@example.com' };
    }
    try {
      const record = await this.draftOrderRepo.getById(draftOrderRecordId);
      const draftId = record.getCellValueAsString(FIELDS_DRAFT_ORDER.draft_id) || draftOrderRecordId;
      const initiatedByEmail = record.getCellValueAsString(FIELDS_DRAFT_ORDER.initiated_by_email) || 'simulation-test@example.com';
      return { draftId, initiatedByEmail };
    } catch (lookupErr) {
      this.logger.audit(`Simulation: could not load draftOrderRecordId (${lookupErr.message}) — using placeholder values.`);
      return { draftId: 'TEST-DRAFT', initiatedByEmail: 'simulation-test@example.com' };
    }
  }

  async run(draftOrderRecordId, simulateSuccessEmail, simulateFailureEmail) {
    this.logger.audit('Simulation mode → skipping guard clause, Cobalt call, and all Airtable writes.');
    const { draftId, initiatedByEmail } = await this._loadContext(draftOrderRecordId);

    const result = {
      status: 'SUCCESS',
      outcome: null,
      shopifyDraftOrderId: null,
      draftOrderName: null,
      invoiceUrl: null,
      shouldSendConfirmation: false,
      confirmationToEmail: null,
      confirmationSubject: null,
      confirmationMessage: null,
      shouldSendFailureAlert: false,
      failureToEmail: null,
      failureSubject: null,
      failureMessage: null,
      error_message: null,
    };

    if (simulateSuccessEmail) {
      const { subject, message } = MessageBuilder.confirmation(
        draftId, 'TEST-1001', 'https://example.myshopify.com/admin/draft_orders/999999/invoice'
      );
      result.shouldSendConfirmation = true;
      result.confirmationToEmail = initiatedByEmail;
      result.confirmationSubject = subject;
      result.confirmationMessage = message;
      this.logger.minimal('Simulation → confirmation email output generated.');
    }

    if (simulateFailureEmail) {
      const { subject, message } = MessageBuilder.failureAlert(
        draftId, 'Simulated failure — for email content verification only, not a real error.'
      );
      result.shouldSendFailureAlert = true;
      result.failureToEmail = CONFIG.STUDIO_ADMIN_EMAIL;
      result.failureSubject = subject;
      result.failureMessage = message;
      this.logger.minimal('Simulation → failure alert email output generated.');
    }

    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE — Airtable only allows one call per script.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const draftOrderRecordId = cfg.draftOrderRecordId;
// Email-content simulation — see SIMULATION MODE in the header comment.
// Both default to false/off; a real trigger run never sets these.
// Airtable's "Run a Script" Variables panel stores a manually-typed value as
// the literal string "true"/"false", not a real boolean — input.config()
// hands it back exactly as typed. A strict `=== true` check silently misses
// that (same pitfall as the is_prod bug elsewhere in this project), so
// accept the string form too.
const isTruthyInput = (v) => v === true || v === 'true';
const simulateSuccessEmail = isTruthyInput(cfg.simulateSuccessEmail);
const simulateFailureEmail = isTruthyInput(cfg.simulateFailureEmail);
// isProd — lets Axel run the REAL flow end-to-end (locks the record, hits
// the real Cobalt endpoint, creates a real Shopify draft order, writes the
// result back) while suppressing only the email hand-off, so he can verify
// Shopify/Airtable behavior without spamming an inbox. Defaults to true
// (production behavior — emails send) whenever the input is left unset, so
// the real deployed trigger never has to remember to set it; only set it to
// false explicitly when testing.
const isProd = cfg.isProd === undefined ? true : isTruthyInput(cfg.isProd);
// COBALT_API_KEY lives in Airtable's Secrets panel (input.secret()), not the
// Variables panel (input.config()) — keeps the raw key value out of the
// automation's Variables UI and run logs, unlike a plain input variable.
// Not read at all in simulation mode, so it's fine to leave unset while
// testing email content.
const cobaltApiKey = (simulateSuccessEmail || simulateFailureEmail) ? null : input.secret('COBALT_API_KEY');

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status: 'ERROR',
  outcome: null,
  shopifyDraftOrderId: null,
  draftOrderName: null,
  invoiceUrl: null,
  shouldSendConfirmation: false,
  confirmationToEmail: null,
  confirmationSubject: null,
  confirmationMessage: null,
  shouldSendFailureAlert: false,
  failureToEmail: null,
  failureSubject: null,
  failureMessage: null,
  error_message: null,
};

try {
  if (simulateSuccessEmail || simulateFailureEmail) {
    logger.audit(`Automation started → SIMULATION MODE (simulateSuccessEmail: ${simulateSuccessEmail}, simulateFailureEmail: ${simulateFailureEmail})`);
    const simulationService = new SimulationService(new DraftOrderRepository(logger), logger);
    result = await simulationService.run(draftOrderRecordId, simulateSuccessEmail, simulateFailureEmail);
  } else {
    if (!draftOrderRecordId) throw new Error(
      'Guard clause: missing required input "draftOrderRecordId". Map the trigger\'s record ID to this input in the Run Script action.'
    );
    if (!cobaltApiKey) throw new Error(
      'Guard clause: missing required secret "COBALT_API_KEY". Add it in this automation\'s Secrets panel (not Variables) and give this script access to it.'
    );

    logger.audit(`Automation started → draftOrderRecordId: ${draftOrderRecordId}`);

    const service = new DraftOrderShopifyCreationService(
      new DraftOrderRepository(logger),
      new DFClientsRepository(logger),
      new EligibilityValidator(logger),
      new CobaltService(cobaltApiKey, logger),
      logger
    );

    result = await service.run(draftOrderRecordId);

    // isProd = false → everything above still ran for real (lock, Cobalt
    // call, Shopify draft order, Airtable write-back) — only the email
    // hand-off is suppressed, so the downstream Send Email nodes never
    // fire. shouldSend flags are what those nodes gate on; leaving the
    // subject/message populated still lets the run log show what *would*
    // have been sent.
    if (!isProd) {
      logger.audit('isProd is false → suppressing email hand-off (shouldSendConfirmation/shouldSendFailureAlert forced to false).');
      result.shouldSendConfirmation = false;
      result.shouldSendFailureAlert = false;
    }
  }

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;

  // Best-effort: try to leave a trail on the record even for a true script
  // error, but don't let a failure here mask the original error. Never
  // writes in simulation mode — that path must never touch Airtable.
  try {
    if (draftOrderRecordId && !simulateSuccessEmail && !simulateFailureEmail) {
      const draftOrdersTable = base.getTable(TABLE_IDS.DRAFT_ORDERS);
      await draftOrdersTable.updateRecordAsync(draftOrderRecordId, {
        [FIELDS_DRAFT_ORDER.shopify_draft_order_status] : { name: STATUS.FAILED },
        [FIELDS_DRAFT_ORDER.sync_error_message]          : `Script error: ${err.message}`,
      });
      logger.audit('Script-error message written to draft_orders record');
    }
  } catch (writeErr) {
    logger.error(`Could not write script-error message → ${writeErr.message}`);
  }

  // !! CRITICAL — re-throw so Airtable marks the automation run as FAILED !!
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS — only reached when the script itself didn't throw (Completed and
// Failed *draft order* outcomes both land here with status: 'SUCCESS' — see
// header ERROR HANDLING for why)
// ─────────────────────────────────────────────────────────────────────────────

output.set('status',                  result.status);
output.set('outcome',                 result.outcome);
output.set('shopifyDraftOrderId',     result.shopifyDraftOrderId);
output.set('draftOrderName',          result.draftOrderName);
output.set('invoiceUrl',              result.invoiceUrl);
output.set('shouldSendConfirmation',  result.shouldSendConfirmation);
output.set('confirmationToEmail',     result.confirmationToEmail);
output.set('confirmationSubject',     result.confirmationSubject);
output.set('confirmationMessage',     result.confirmationMessage);
output.set('shouldSendFailureAlert',  result.shouldSendFailureAlert);
output.set('failureToEmail',          result.failureToEmail);
output.set('failureSubject',          result.failureSubject);
output.set('failureMessage',          result.failureMessage);
output.set('error_message',           result.error_message);
output.set('log_summary',             logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | outcome: ${result.outcome}`);

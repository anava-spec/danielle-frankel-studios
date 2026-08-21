/*
================================================================================
AUTOMATION : Waitlist Alert Readiness — Unresolved Within 5 Business Days
BASE       : appMmEE4zyHMGhkkd (sandbox — mirror to Production when ready)
TABLE SRC  : Waitlist (tblbm3hKDShEPNpoq)
TRIGGER    : When record matches conditions — Waitlist
             (resolution_status = Active AND resolved_by_df_clients_record
             is empty AND earliest_date_requested is not empty)
VERSION    : 1.0.0 — Initial build (JuliMigLui37091, waitlist_definitions.md
             section 4.1). Replaces the declarative "isWithin 5 calendar
             days" filter (Airtable's automation filters can't compute
             business days, and can't express a rolling "more than 24h
             since last alert" anti-spam guard) — this script implements the
             spec's real rule and hands off to a native Send Email action.

OBJECTIVE
  Decide whether THIS Waitlist record is due for Julia's "unresolved within
  5 business days" review-alert email right now, and if so, stamp
  last_alert_sent and hand a ready-made subject/message to the downstream
  native Send Email action. This script never sends the email itself — it
  only decides + writes the anti-spam stamp, so Airtable's own Send Email
  node (wired to output.shouldSend / output.subject / output.message) stays
  the single place that actually dispatches mail.

GUARD CLAUSE (spec 4.1 + business realities of the free-text sheet)
  1. waitlistRecordId must be present in input.config().
  2. The record must actually exist when read back.
  3. resolution_status must be "Active" — otherwise no-op. This alone
     excludes both "Resolved" (matched) and "Exception" (Julia flagged it as
     never becoming a DF Client — a third choice on this same select field).
  4. resolved_by_df_clients_record must be empty — otherwise no-op (matched).
  5. earliest_date_requested must be set — if blank, no-op (this is a
     data-entry gap staff needs to fill in; the record simply never alerts
     until it is set — see spec's free-text dates_requested limitation).
  6. earliest_date_requested must fall within the next 5 BUSINESS days
     (Mon-Fri), and must not already be in the past.
  7. Anti-spam — if last_alert_sent is set and less than 24 hours have
     elapsed, no-op (do not re-alert within the same day).
  None of steps 3-7 failing is an error — they're normal no-op outcomes.
  shouldSend = false covers all of them; check log_summary for which one.

ERROR HANDLING
  Errors thrown with descriptive messages. Airtable's native run-failure
  notification alerts the automation owner.

OUTPUTS (output.set)
  status         : "SUCCESS" | "ERROR"
  shouldSend     : true | false — gates the downstream Send Email action
  toEmail        : "it@daniellefrankelstudios.com" (blank if shouldSend false)
  subject        : email subject line (blank if shouldSend false)
  message        : email body, Markdown (blank if shouldSend false)
  error_message  : null on success
  log_summary    : full Logger output
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  WAITLIST : 'tblbm3hKDShEPNpoq', // Waitlist
};

// Fields — Waitlist (tblbm3hKDShEPNpoq)
const FIELDS_WAITLIST = {
  bride_name                   : 'fldI90ApFwjte8HBv',
  dates_requested               : 'fldDjo0WRAKvHdgR4',
  time_requested                 : 'fldLuKMVvuzadx630',
  wedding_date                    : 'fldUS6OAwOhngc71o',
  resolution_status               : 'fldiEQbjks80y5xTi', // singleSelect — Active / Resolved
  resolved_by_df_clients_record   : 'fldXI88jaK0MepaLn', // multipleRecordLinks
  contact_email                   : 'fld2cI0r58UEiinvC',
  contact_phone                   : 'fldrMkTOA2Y6DT8mC',
  notes                           : 'fldsn4PKhpwnOx5gu',
  last_alert_sent                 : 'flddV0or0cD3UHHbR', // dateTime
  earliest_date_requested         : 'fld5s87GbT2G3C60e', // date (real, staff-entered)
};

const CONFIG = {
  LOG_LEVEL             : 'B', // A=minimal | B=audit (default) | C=debug
  ACTIVE_STATUS_NAME    : 'Active',
  BUSINESS_DAYS_WINDOW  : 5,
  ANTI_SPAM_HOURS       : 24,
  JULIA_EMAIL           : 'it@daniellefrankelstudios.com',
  // Airtable's script runtime executes in UTC, not the studio's local time.
  // "today" must be computed in the studio's actual timezone or the
  // business-day count goes off by one whenever the script runs after
  // ~8pm ET (once UTC has already rolled to the next calendar day).
  BUSINESS_TIME_ZONE    : 'America/New_York',
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
// Pure date logic. No Airtable calls, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

class DateManager {
  static today() {
    // Get the current date *as observed in the studio's timezone*, not the
    // script runtime's (Airtable scripts execute in UTC). Using
    // Intl.DateTimeFormat to read the y/m/d in CONFIG.BUSINESS_TIME_ZONE,
    // then building a local-midnight Date from those parts, keeps this
    // directly comparable to parseDateOnly()'s output.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CONFIG.BUSINESS_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const y = Number(parts.find(p => p.type === 'year').value);
    const m = Number(parts.find(p => p.type === 'month').value);
    const d = Number(parts.find(p => p.type === 'day').value);
    return new Date(y, m - 1, d);
  }
  static parseDateOnly(str) {
    if (!str) return null;
    // record.getCellValue() on a date field always returns an ISO 8601
    // string (e.g. "2026-08-13" or "2026-08-13T00:00:00.000Z") regardless
    // of the field's display format (US, European, etc). Take just the
    // date portion and parse as local midnight, not UTC, so day-of-week
    // math below stays correct.
    const [y, m, d] = str.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  // Counts business days (Mon-Fri) strictly between "today" and "target",
  // inclusive of target, exclusive of today. Returns null if target is in
  // the past (before today).
  static businessDaysFromToday(target) {
    const today = DateManager.today();
    if (target < today) return null;
    let count = 0;
    const cursor = new Date(today);
    while (cursor < target) {
      cursor.setDate(cursor.getDate() + 1);
      const dow = cursor.getDay(); // 0=Sun, 6=Sat
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }
  static hoursSince(isoString) {
    if (!isoString) return Infinity;
    const then = new Date(isoString).getTime();
    if (Number.isNaN(then)) return Infinity;
    return (Date.now() - then) / (1000 * 60 * 60);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WAITLIST REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class WaitlistRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.WAITLIST);
    this.logger = logger;
  }
  async getById(recordId) {
    this.logger.step(1, `Loading Waitlist record → ${recordId}`);
    const record = await this.table.selectRecordAsync(recordId, { fields: Object.values(FIELDS_WAITLIST) });
    if (!record) throw new Error(`Guard clause: Waitlist record not found → recordId: ${recordId}`);
    this.logger.audit(`Record loaded → ${recordId}`);
    return record;
  }
  async stampAlertSent(recordId) {
    this.logger.step(4, `Stamping last_alert_sent → ${recordId}`);
    await this.table.updateRecordAsync(recordId, {
      [FIELDS_WAITLIST.last_alert_sent]: new Date().toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY RESOLVER CLASS
// Pure business logic — decides whether this record is due for an alert
// right now. No Airtable calls.
// ─────────────────────────────────────────────────────────────────────────────

class EligibilityResolver {
  constructor(logger) { this.logger = logger; }

  resolve(data) {
    if (data.resolutionStatus !== CONFIG.ACTIVE_STATUS_NAME) {
      this.logger.step(3, `Not eligible → resolution_status is "${data.resolutionStatus}", not Active`);
      return { eligible: false, reasonBlocked: 'not_active' };
    }
    if (data.hasLinkedClient) {
      this.logger.step(3, 'Not eligible → already linked to a DF Clients record');
      return { eligible: false, reasonBlocked: 'already_matched' };
    }
    if (!data.earliestDateRequested) {
      this.logger.step(3, 'Not eligible → earliest_date_requested is blank (needs staff data entry)');
      return { eligible: false, reasonBlocked: 'missing_date' };
    }

    const businessDaysOut = DateManager.businessDaysFromToday(data.earliestDateRequested);
    if (businessDaysOut === null) {
      this.logger.step(3, 'Not eligible → earliest_date_requested is already in the past');
      return { eligible: false, reasonBlocked: 'date_in_past' };
    }
    if (businessDaysOut > CONFIG.BUSINESS_DAYS_WINDOW) {
      this.logger.step(3, `Not eligible → ${businessDaysOut} business days out, outside the ${CONFIG.BUSINESS_DAYS_WINDOW}-day window`);
      return { eligible: false, reasonBlocked: 'outside_window' };
    }

    const hoursSinceLastAlert = DateManager.hoursSince(data.lastAlertSent);
    if (hoursSinceLastAlert < CONFIG.ANTI_SPAM_HOURS) {
      this.logger.step(3, `Not eligible → alerted ${hoursSinceLastAlert.toFixed(1)}h ago, inside the ${CONFIG.ANTI_SPAM_HOURS}h anti-spam window`);
      return { eligible: false, reasonBlocked: 'anti_spam' };
    }

    this.logger.step(3, `Eligible → ${businessDaysOut} business day(s) out, last alert ${hoursSinceLastAlert === Infinity ? 'never' : hoursSinceLastAlert.toFixed(1) + 'h ago'}`);
    return { eligible: true, reasonBlocked: null, businessDaysOut };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER CLASS
// Composes the email Julia receives. No logic — strings only.
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  static build(data, businessDaysOut) {
    const subject = `[Waitlist Alert] ${data.brideName} — Requested dates within 5 days, unresolved`;

    const dayWord = businessDaysOut === 1 ? 'business day' : 'business days';
    const intro =
      `This Waitlist request is still unresolved and its earliest requested ` +
      `date is only **${businessDaysOut} ${dayWord}** away. It hasn't been matched to ` +
      `a DF Clients record yet — please review and follow up with the bride ` +
      `directly if needed.`;

    const message =
      `${intro}\n\n` +
      `- **Bride:** ${data.brideName}\n` +
      `- **Dates requested:** ${data.datesRequested || '—'}\n` +
      `- **Time requested:** ${data.timeRequested || '—'}\n` +
      `- **Wedding date:** ${data.weddingDate || '—'}\n` +
      `- **Email:** ${data.contactEmail || '—'}\n` +
      `- **Phone:** ${data.contactPhone || '—'}\n` +
      `- **Notes:** ${data.notes || '—'}`;

    return { subject, message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS — Orchestrates all steps
// ─────────────────────────────────────────────────────────────────────────────

class WaitlistAlertReadinessService {
  constructor(waitlistRepo, resolver, logger) {
    this.waitlistRepo = waitlistRepo;
    this.resolver      = resolver;
    this.logger        = logger;
  }

  async run(recordId) {
    this.logger.audit(`Service started → Waitlist record: ${recordId}`);

    // Step 1 — Load record
    const record = await this.waitlistRepo.getById(recordId);

    // Step 2 — Extract plain data
    this.logger.step(2, 'Extracting plain values from record');
    const linkedClients = record.getCellValue(FIELDS_WAITLIST.resolved_by_df_clients_record);
    const data = {
      brideName             : record.getCellValueAsString(FIELDS_WAITLIST.bride_name),
      datesRequested         : record.getCellValueAsString(FIELDS_WAITLIST.dates_requested),
      timeRequested           : record.getCellValueAsString(FIELDS_WAITLIST.time_requested),
      weddingDate             : record.getCellValueAsString(FIELDS_WAITLIST.wedding_date),
      contactEmail            : record.getCellValueAsString(FIELDS_WAITLIST.contact_email),
      contactPhone            : record.getCellValueAsString(FIELDS_WAITLIST.contact_phone),
      notes                   : record.getCellValueAsString(FIELDS_WAITLIST.notes),
      resolutionStatus        : record.getCellValueAsString(FIELDS_WAITLIST.resolution_status),
      hasLinkedClient         : Array.isArray(linkedClients) && linkedClients.length > 0,
      earliestDateRequested   : DateManager.parseDateOnly(record.getCellValue(FIELDS_WAITLIST.earliest_date_requested)),
      lastAlertSent           : record.getCellValue(FIELDS_WAITLIST.last_alert_sent),
    };
    this.logger.debug(`Extracted → ${JSON.stringify({ ...data, earliestDateRequested: data.earliestDateRequested?.toISOString() ?? null })}`);

    // Step 3 — Resolve eligibility (may resolve to eligible: false — not an error)
    const { eligible, reasonBlocked, businessDaysOut } = this.resolver.resolve(data);

    if (!eligible) {
      this.logger.minimal(`SUCCESS → no-op, not eligible (${reasonBlocked})`);
      return {
        status: 'SUCCESS', shouldSend: false,
        toEmail: null, subject: null, message: null, error_message: null,
      };
    }

    // Step 4 — Stamp the anti-spam guard before handing off to Send Email,
    // so a slow downstream node can never cause a duplicate send.
    await this.waitlistRepo.stampAlertSent(recordId);

    // Step 5 — Build the email content
    const { subject, message } = MessageBuilder.build(data, businessDaysOut);

    this.logger.minimal(`SUCCESS → alert ready for "${data.brideName}"`);

    return {
      status: 'SUCCESS', shouldSend: true,
      toEmail: CONFIG.JULIA_EMAIL, subject, message, error_message: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE — Airtable only allows one call per script.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const waitlistRecordId = cfg.waitlistRecordId;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status        : 'ERROR',
  shouldSend    : false,
  toEmail       : null,
  subject       : null,
  message       : null,
  error_message : null,
};

try {
  if (!waitlistRecordId) throw new Error(
    'Guard clause: missing required input "waitlistRecordId". Map the trigger\'s record ID to this input in the Run Script action.'
  );

  logger.audit(`Automation started → waitlistRecordId: ${waitlistRecordId}`);

  const service = new WaitlistAlertReadinessService(
    new WaitlistRepository(logger),
    new EligibilityResolver(logger),
    logger
  );

  result = await service.run(waitlistRecordId);

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;

  // !! CRITICAL — re-throw so Airtable marks the automation run as FAILED !!
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS — only reached on SUCCESS (catch block re-throws on error)
// ─────────────────────────────────────────────────────────────────────────────

output.set('status',        result.status);
output.set('shouldSend',    result.shouldSend);
output.set('toEmail',       result.toEmail);
output.set('subject',       result.subject);
output.set('message',       result.message);
output.set('error_message', result.error_message);
output.set('log_summary',   logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | shouldSend: ${result.shouldSend}`);

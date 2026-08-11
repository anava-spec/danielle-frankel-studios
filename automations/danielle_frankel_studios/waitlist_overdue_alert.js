/*
================================================================================
AUTOMATION : Waitlist Overdue Alert — Notify Julia: Overdue & Unmatched
BASE       : appMmEE4zyHMGhkkd (sandbox — mirror to Production when ready)
TABLE SRC  : Waitlist (tblbm3hKDShEPNpoq)
TRIGGER    : When record matches conditions — Waitlist
             (resolution_status = Active AND resolved_by_df_clients_record
             is empty AND earliest_date_requested <= today AND
             overdue_notified is unchecked)
VERSION    : 1.1.0 — Email now includes a link to the record's Waitlist
             Follow-Up detail page. Sandbox and production share this same
             automation, so the correct base-specific URL is picked at
             runtime by the new is_prod input (map it to a literal true in
             production's copy of this step, false in sandbox's).
             1.0.0 — Initial build. Companion to waitlist_alert_readiness.js
             (the 5-business-day heads-up alert) — this one is the more
             urgent tier: the requested date has already passed and no one
             has acted. Feeds the "Waitlist Follow-Up" native Airtable page,
             where staff either link the matching DF Client or set
             resolution_status to "Exception" (never becoming a DF Client —
             a third choice on the same select field, not a separate flag).

OBJECTIVE
  Decide whether THIS Waitlist record is overdue and unnotified right now,
  and if so, stamp overdue_notified and hand a ready-made subject/message to
  the downstream native Send Email action. Mirrors the anti-spam-before-send
  pattern in waitlist_alert_readiness.js: the stamp is written BEFORE
  returning shouldSend=true, so a slow downstream node can never cause a
  duplicate send.

GUARD CLAUSE
  1. waitlistRecordId must be present in input.config().
  2. The record must actually exist when read back.
  3. resolution_status must be "Active" — otherwise no-op. This alone
     excludes both "Resolved" (matched) and "Exception" (Julia flagged it as
     never becoming a DF Client) records, since both are different select
     values than "Active".
  4. resolved_by_df_clients_record must be empty — otherwise no-op (matched;
     redundant with #3 in practice, kept as a defensive check).
  5. earliest_date_requested must be set — if blank, no-op (data-entry gap).
  6. earliest_date_requested must be today or in the past — otherwise no-op
     (not yet overdue; the 5-business-day alert covers the heads-up case).
  7. overdue_notified must be unchecked — otherwise no-op (already alerted;
     this fires once per record, not on a rolling anti-spam window, since
     the Follow-Up page is meant to be worked as a backlog, not re-pinged).

OUTPUTS (output.set)
  status         : "SUCCESS" | "ERROR"
  shouldSend     : true | false — gates the downstream Send Email action
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
  earliest_date_requested          : 'fld5s87GbT2G3C60e', // date
  resolution_status                 : 'fldiEQbjks80y5xTi', // singleSelect — Active / Resolved / Exception
  resolved_by_df_clients_record      : 'fldXI88jaK0MepaLn', // multipleRecordLinks
  contact_email                       : 'fld2cI0r58UEiinvC',
  contact_phone                        : 'fldrMkTOA2Y6DT8mC',
  notes                                 : 'fldsn4PKhpwnOx5gu',
  overdue_notified                       : 'fldzl6UCfITyAGeRg', // checkbox
};

const CONFIG = {
  LOG_LEVEL             : 'B', // A=minimal | B=audit (default) | C=debug
  ACTIVE_STATUS_NAME    : 'Active',
  // Script runtime executes in UTC — "today" must be computed in the
  // studio's actual timezone or an overdue record near midnight ET could be
  // evaluated a day off. Same fix as waitlist_alert_readiness.js.
  BUSINESS_TIME_ZONE    : 'America/New_York',
  // Waitlist Follow-Up detail-page URL, one per environment — the same
  // automation is shared between the sandbox and production copies of this
  // base, so which one applies is decided at runtime by the isProd input
  // (set per environment in the Run Script step), not by the base ID the
  // script happens to execute in. "{recordId}" is replaced with the
  // triggering Waitlist record's ID — nothing else about the URL changes.
  DETAIL_PAGE_URL_SANDBOX : 'https://airtable.com/appMmEE4zyHMGhkkd/pag3T4oDLEuMSuX9C/{recordId}?home=pag9MWcKpDSicCT7U',
  DETAIL_PAGE_URL_PROD    : 'https://airtable.com/appUC2NFAlURayLx9/pag3T4oDLEuMSuX9C/{recordId}?home=pag9MWcKpDSicCT7U',
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
  static today() {
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
    // string regardless of the field's display format — take just the date
    // portion and parse as local midnight, not UTC.
    const [y, m, d] = str.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
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
  async stampNotified(recordId) {
    this.logger.step(4, `Stamping overdue_notified → ${recordId}`);
    await this.table.updateRecordAsync(recordId, {
      [FIELDS_WAITLIST.overdue_notified]: true,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY RESOLVER CLASS
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
    if (data.earliestDateRequested > DateManager.today()) {
      this.logger.step(3, 'Not eligible → earliest_date_requested is still in the future (not yet overdue)');
      return { eligible: false, reasonBlocked: 'not_yet_overdue' };
    }
    if (data.overdueNotified) {
      this.logger.step(3, 'Not eligible → overdue_notified already checked (already alerted once)');
      return { eligible: false, reasonBlocked: 'already_notified' };
    }

    this.logger.step(3, 'Eligible → overdue and unnotified');
    return { eligible: true, reasonBlocked: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  // Swaps "{recordId}" into the environment-appropriate detail-page URL
  // template. isProd picks the template; everything else about the URL is
  // identical between environments.
  static buildDetailPageLink(recordId, isProd) {
    const template = isProd ? CONFIG.DETAIL_PAGE_URL_PROD : CONFIG.DETAIL_PAGE_URL_SANDBOX;
    return template.replace('{recordId}', recordId);
  }

  static build(data, detailPageUrl) {
    const subject = `[Waitlist Overdue] ${data.brideName} — earliest date has passed, unmatched`;

    const intro =
      `This Waitlist request's earliest requested date has already passed ` +
      `and it still hasn't been matched to a DF Client. Please review it on ` +
      `the Waitlist Follow-Up page — link the client if they exist, or set ` +
      `the status to Exception if this lead will never become a DF Client. ` +
      `If you link a client and mark it Resolved, please also fill in the ` +
      `resolved_at field yourself — that's not stamped automatically for ` +
      `manual matches, only for automatic ones.`;

    const message =
      `${intro}\n\n` +
      `- **Bride:** ${data.brideName}\n` +
      `- **Dates requested:** ${data.datesRequested || '—'}\n` +
      `- **Time requested:** ${data.timeRequested || '—'}\n` +
      `- **Email:** ${data.contactEmail || '—'}\n` +
      `- **Phone:** ${data.contactPhone || '—'}\n` +
      `- **Notes:** ${data.notes || '—'}\n\n` +
      `[View this record →](${detailPageUrl})`;

    return { subject, message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS — Orchestrates all steps
// ─────────────────────────────────────────────────────────────────────────────

class WaitlistOverdueAlertService {
  constructor(waitlistRepo, resolver, logger) {
    this.waitlistRepo = waitlistRepo;
    this.resolver      = resolver;
    this.logger        = logger;
  }

  async run(recordId, isProd) {
    this.logger.audit(`Service started → Waitlist record: ${recordId} (isProd=${isProd})`);

    const record = await this.waitlistRepo.getById(recordId);

    this.logger.step(2, 'Extracting plain values from record');
    const linkedClients = record.getCellValue(FIELDS_WAITLIST.resolved_by_df_clients_record);
    const data = {
      brideName             : record.getCellValueAsString(FIELDS_WAITLIST.bride_name),
      datesRequested         : record.getCellValueAsString(FIELDS_WAITLIST.dates_requested),
      timeRequested           : record.getCellValueAsString(FIELDS_WAITLIST.time_requested),
      contactEmail            : record.getCellValueAsString(FIELDS_WAITLIST.contact_email),
      contactPhone             : record.getCellValueAsString(FIELDS_WAITLIST.contact_phone),
      notes                     : record.getCellValueAsString(FIELDS_WAITLIST.notes),
      resolutionStatus          : record.getCellValueAsString(FIELDS_WAITLIST.resolution_status),
      hasLinkedClient           : Array.isArray(linkedClients) && linkedClients.length > 0,
      earliestDateRequested     : DateManager.parseDateOnly(record.getCellValue(FIELDS_WAITLIST.earliest_date_requested)),
      overdueNotified           : record.getCellValue(FIELDS_WAITLIST.overdue_notified) === true,
    };
    this.logger.debug(`Extracted → ${JSON.stringify({ ...data, earliestDateRequested: data.earliestDateRequested?.toISOString() ?? null })}`);

    const { eligible, reasonBlocked } = this.resolver.resolve(data);

    if (!eligible) {
      this.logger.minimal(`SUCCESS → no-op, not eligible (${reasonBlocked})`);
      return { status: 'SUCCESS', shouldSend: false, subject: null, message: null, error_message: null };
    }

    await this.waitlistRepo.stampNotified(recordId);

    const detailPageUrl = MessageBuilder.buildDetailPageLink(recordId, isProd);
    const { subject, message } = MessageBuilder.build(data, detailPageUrl);

    this.logger.minimal(`SUCCESS → overdue alert ready for "${data.brideName}"`);

    return { status: 'SUCCESS', shouldSend: true, subject, message, error_message: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const waitlistRecordId = cfg.waitlistRecordId;
// Set literally true/false per environment when mapping this Run Script
// step's inputs — sandbox's copy gets false, production's copy gets true.
const isProd = cfg.is_prod === true;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status        : 'ERROR',
  shouldSend    : false,
  subject       : null,
  message       : null,
  error_message : null,
};

try {
  if (!waitlistRecordId) throw new Error(
    'Guard clause: missing required input "waitlistRecordId". Map the trigger\'s record ID to this input in the Run Script action.'
  );

  logger.audit(`Automation started → waitlistRecordId: ${waitlistRecordId}`);

  const service = new WaitlistOverdueAlertService(
    new WaitlistRepository(logger),
    new EligibilityResolver(logger),
    logger
  );

  result = await service.run(waitlistRecordId, isProd);

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;

  // !! CRITICAL — re-throw so Airtable marks the automation run as FAILED !!
  throw err;
}

output.set('status',        result.status);
output.set('shouldSend',    result.shouldSend);
output.set('subject',       result.subject);
output.set('message',       result.message);
output.set('error_message', result.error_message);
output.set('log_summary',   logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | shouldSend: ${result.shouldSend}`);

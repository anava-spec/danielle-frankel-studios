/*
================================================================================
AUTOMATION : Waitlist Matching — New DF Client Created
BASE       : appMmEE4zyHMGhkkd (sandbox — mirror to Production when ready)
TABLE SRC  : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST : Waitlist (tblbm3hKDShEPNpoq)
TRIGGER    : When record created — DF Clients
VERSION    : 1.0.0 — Initial build (JuliMigLui37091, waitlist_definitions.md
             sections 2-3). Replaces the declarative "contains first name AND
             contains last name" automation (Airtable's automation filters
             can't concatenate two dynamic fields for a strict equals
             comparison, and can't express the conditional email/phone
             cross-check at all) — this script implements the spec exactly.

OBJECTIVE
  Whenever Acuity creates a new DF Clients record, check the Waitlist table
  for a standing request from the same bride and, if confirmed, mark it
  Resolved and link it back to the new client record — see spec section 2.2
  for the exact match rules and section 3 for resolution.

MATCH RULES (spec 2.2, in priority order — ALL must pass)
  1. Name — DF Clients First+Last combined equals Waitlist bride_name,
     case-insensitive, trimmed whitespace. Exact string equality only — no
     fuzzy/Levenshtein matching.
  2. Email — if BOTH records have an email, it must match (case-insensitive).
     If either is missing an email, this check is skipped (does not block
     the match).
  3. Phone — if BOTH records have a phone, it must match after normalizing
     to digits-only. If either is missing a phone, this check is skipped.

MULTIPLE WAITLIST RECORDS FOR THE SAME BRIDE (spec 4.3)
  If more than one Active Waitlist record passes all three checks (e.g. a
  duplicate data-entry row), only the FIRST match by record creation order
  is resolved. The rest stay Active and will surface via the separate
  "Alert Julia" automation/script if still unmatched after 5 business days.

GUARD CLAUSE
  1. dfClientRecordId must be present in input.config().
  2. The DF Clients record must actually exist when read back.
  3. This is NOT an error path: zero Waitlist matches is a normal outcome
     (most new clients were never on a waitlist) — the script completes
     with matchFound = false.

ERROR HANDLING
  Errors thrown with descriptive messages. Airtable's native run-failure
  notification alerts the automation owner.

OUTPUTS (output.set)
  status             : "SUCCESS" | "ERROR"
  matchFound         : true | false
  resolvedRecordId   : the Waitlist record ID that was resolved (null if none)
  resolvedBrideName  : bride_name of the resolved record (null if none)
  skippedDuplicateIds: array of other Active Waitlist record IDs that also
                       passed all three checks but were left Active per 4.3
                       (empty array if none)
  error_message      : null on success
  log_summary        : full Logger output
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  DF_CLIENTS : 'tblLLUlDgJ4ktzF7c', // DF Clients
  WAITLIST   : 'tblbm3hKDShEPNpoq', // Waitlist
};

// Fields — DF Clients (tblLLUlDgJ4ktzF7c)
const FIELDS_CLIENT = {
  first_name : 'fldFWlAODUcuroeXK',
  last_name  : 'fldQzSPiUvOid1nXo',
  email      : 'fld5f3IVZoX0QZZ8R',
  phone      : 'fldZrxF4bR6QBUwVK',
};

// Fields — Waitlist (tblbm3hKDShEPNpoq)
const FIELDS_WAITLIST = {
  bride_name                  : 'fldI90ApFwjte8HBv',
  contact_email                : 'fld2cI0r58UEiinvC',
  contact_phone                : 'fldrMkTOA2Y6DT8mC',
  resolution_status            : 'fldiEQbjks80y5xTi', // singleSelect — Active / Resolved
  resolved_at                  : 'fldi1u7Otn5dX5web', // dateTime
  resolved_by_df_clients_record: 'fldXI88jaK0MepaLn', // multipleRecordLinks -> DF Clients
};

const CONFIG = {
  LOG_LEVEL         : 'B', // A=minimal | B=audit (default) | C=debug
  ACTIVE_STATUS_NAME : 'Active',
  RESOLVED_STATUS_NAME: 'Resolved',
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
// MATCH NORMALIZER CLASS
// Pure normalization/comparison helpers. No Airtable calls, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

class MatchNormalizer {
  static normalizeName(str) {
    return (str ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  static normalizeEmail(str) {
    return (str ?? '').trim().toLowerCase();
  }
  static normalizePhone(str) {
    return (str ?? '').replace(/\D/g, '');
  }

  // Spec 2.2.1 — exact string equality after normalization, no fuzzy matching.
  static namesMatch(a, b) {
    const na = MatchNormalizer.normalizeName(a);
    const nb = MatchNormalizer.normalizeName(b);
    return na.length > 0 && na === nb;
  }
  // Spec 2.2.2/2.2.3 — skip the check if either side is missing; if both
  // present, they must match.
  static conditionalMatch(a, b, normalizeFn) {
    const na = normalizeFn(a);
    const nb = normalizeFn(b);
    if (!na || !nb) return true; // either missing -> skip, does not block match
    return na === nb;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DF CLIENTS REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class DfClientsRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.DF_CLIENTS);
    this.logger = logger;
  }
  async getById(recordId) {
    this.logger.step(1, `Loading DF Clients record → ${recordId}`);
    const record = await this.table.selectRecordAsync(recordId, { fields: Object.values(FIELDS_CLIENT) });
    if (!record) throw new Error(`Guard clause: DF Clients record not found → recordId: ${recordId}`);
    this.logger.audit(`Record loaded → ${recordId}`);
    return record;
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
  async getActiveRecords() {
    this.logger.step(2, 'Loading Active Waitlist records');
    const result = await this.table.selectRecordsAsync({
      fields: Object.values(FIELDS_WAITLIST),
      sorts: [], // default order returned by the API is creation order
    });
    const active = result.records.filter(
      r => r.getCellValueAsString(FIELDS_WAITLIST.resolution_status) === CONFIG.ACTIVE_STATUS_NAME
    );
    this.logger.audit(`${active.length} Active Waitlist record(s) loaded`);
    return active;
  }
  async resolve(recordId, dfClientRecordId) {
    this.logger.step(5, `Resolving Waitlist record → ${recordId}`);
    await this.table.updateRecordAsync(recordId, {
      [FIELDS_WAITLIST.resolution_status]: { name: CONFIG.RESOLVED_STATUS_NAME },
      [FIELDS_WAITLIST.resolved_at]: new Date().toISOString(),
      [FIELDS_WAITLIST.resolved_by_df_clients_record]: [{ id: dfClientRecordId }],
    });
    this.logger.audit(`Record ${recordId} marked Resolved -> linked to ${dfClientRecordId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHING SERVICE CLASS — Orchestrates all steps
// ─────────────────────────────────────────────────────────────────────────────

class WaitlistMatchingService {
  constructor(clientRepo, waitlistRepo, logger) {
    this.clientRepo   = clientRepo;
    this.waitlistRepo = waitlistRepo;
    this.logger       = logger;
  }

  async run(dfClientRecordId) {
    this.logger.audit(`Service started → DF Clients record: ${dfClientRecordId}`);

    // Step 1 — Load the new DF Clients record
    const client = await this.clientRepo.getById(dfClientRecordId);
    const clientFullName = `${client.getCellValueAsString(FIELDS_CLIENT.first_name)} ${client.getCellValueAsString(FIELDS_CLIENT.last_name)}`.trim();
    const clientEmail    = client.getCellValueAsString(FIELDS_CLIENT.email);
    const clientPhone    = client.getCellValueAsString(FIELDS_CLIENT.phone);
    this.logger.debug(`Client → name: "${clientFullName}" | email: "${clientEmail}" | phone: "${clientPhone}"`);

    // Step 2 — Load all Active Waitlist records
    const activeRecords = await this.waitlistRepo.getActiveRecords();

    // Step 3 — Apply the three match rules (2.2) to every Active record
    this.logger.step(3, 'Applying match rules (name exact, email/phone conditional)');
    const confirmedMatches = activeRecords.filter(r => {
      const brideName = r.getCellValueAsString(FIELDS_WAITLIST.bride_name);
      if (!MatchNormalizer.namesMatch(brideName, clientFullName)) return false;

      const waitlistEmail = r.getCellValueAsString(FIELDS_WAITLIST.contact_email);
      if (!MatchNormalizer.conditionalMatch(waitlistEmail, clientEmail, MatchNormalizer.normalizeEmail)) return false;

      const waitlistPhone = r.getCellValueAsString(FIELDS_WAITLIST.contact_phone);
      if (!MatchNormalizer.conditionalMatch(waitlistPhone, clientPhone, MatchNormalizer.normalizePhone)) return false;

      return true;
    });
    this.logger.audit(`${confirmedMatches.length} confirmed match(es) found`);

    if (confirmedMatches.length === 0) {
      this.logger.minimal(`SUCCESS → no Waitlist match for "${clientFullName}"`);
      return {
        status: 'SUCCESS', matchFound: false,
        resolvedRecordId: null, resolvedBrideName: null,
        skippedDuplicateIds: [], error_message: null,
      };
    }

    // Step 4 — Spec 4.3: multiple matches for the same bride -> resolve only
    // the first by creation order, leave the rest Active.
    const [winner, ...duplicates] = confirmedMatches;
    if (duplicates.length > 0) {
      this.logger.audit(`${duplicates.length} duplicate match(es) left Active per spec 4.3 → ${duplicates.map(d => d.id).join(', ')}`);
    }

    // Step 5 — Resolve the winning record
    await this.waitlistRepo.resolve(winner.id, dfClientRecordId);

    const resolvedBrideName = winner.getCellValueAsString(FIELDS_WAITLIST.bride_name);
    this.logger.minimal(`SUCCESS → resolved Waitlist record ${winner.id} ("${resolvedBrideName}") for client ${dfClientRecordId}`);

    return {
      status: 'SUCCESS', matchFound: true,
      resolvedRecordId: winner.id, resolvedBrideName,
      skippedDuplicateIds: duplicates.map(d => d.id), error_message: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE — Airtable only allows one call per script.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const dfClientRecordId = cfg.dfClientRecordId;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status              : 'ERROR',
  matchFound          : false,
  resolvedRecordId    : null,
  resolvedBrideName   : null,
  skippedDuplicateIds : [],
  error_message       : null,
};

try {
  if (!dfClientRecordId) throw new Error(
    'Guard clause: missing required input "dfClientRecordId". Map the trigger\'s record ID to this input in the Run Script action.'
  );

  logger.audit(`Automation started → dfClientRecordId: ${dfClientRecordId}`);

  const service = new WaitlistMatchingService(
    new DfClientsRepository(logger),
    new WaitlistRepository(logger),
    logger
  );

  result = await service.run(dfClientRecordId);

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;

  // !! CRITICAL — re-throw so Airtable marks the automation run as FAILED !!
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS — only reached on SUCCESS (catch block re-throws on error)
// ─────────────────────────────────────────────────────────────────────────────

output.set('status',              result.status);
output.set('matchFound',          result.matchFound);
output.set('resolvedRecordId',    result.resolvedRecordId);
output.set('resolvedBrideName',   result.resolvedBrideName);
output.set('skippedDuplicateIds', result.skippedDuplicateIds);
output.set('error_message',       result.error_message);
output.set('log_summary',         logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | matchFound: ${result.matchFound}`);

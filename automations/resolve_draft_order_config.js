/*
================================================================================
AUTOMATION : Shopify Draft Order Creation — Call Cobalt Endpoint
SCRIPT     : Script 1 of 2 — Resolve Automation Config
BASE       : appMmEE4zyHMGhkkd (sandbox — mirror to Production appUC2NFAlURayLx9
             once verified; the `resources` records this reads have separate
             checkbox values per base, so no automation config ever needs to
             be hand-edited when promoting sandbox → production)
TABLE SRC  : resources (tblFa56lQwVacMXto)
GROUP      : Draft Orders
VERSION    : 1.0.0 — all field IDs verified against live sandbox base

OBJECTIVE
  Reads three specific `resources` records by name (simulateSuccessEmail,
  simulateFailureEmail, isProd — see draft_order_shopify_creation.js's
  header for what each one does) and outputs their `checkbox` value as real
  booleans. Script 2 (draft_order_shopify_creation.js) maps its
  simulateSuccessEmail / simulateFailureEmail / isProd input variables to
  this script's outputs ({{Script 1.simulateSuccessEmail}} etc.) instead of
  manually-typed text — so switching sandbox vs. production behavior is a
  checkbox edit on a `resources` record, not an automation-config edit that
  has to be redone in both bases.

  `resources`' primary field (`name`) is a formula that just mirrors
  `source_name` (a singleSelect) — this script's TARGET_NAMES match against
  `source_name`'s option names directly, which must exist as choices on
  that field (simulateSuccessEmail / simulateFailureEmail / isProd — added
  manually via Airtable UI, singleSelect choices aren't addable via API).

RESOURCES NOT FOUND
  If a resources record for one of the three names doesn't exist (deleted,
  renamed, or the choice removed from source_name), this does NOT throw —
  it logs a warning and falls back to the same safe default
  draft_order_shopify_creation.js itself uses when the value is entirely
  absent: simulateSuccessEmail/simulateFailureEmail default false (skip
  simulation), isProd defaults true (production behavior — emails send).

OUTPUTS (output.set)
  simulateSuccessEmail : boolean
  simulateFailureEmail : boolean
  isProd                : boolean
  log_summary           : full Logger output
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  RESOURCES : 'tblFa56lQwVacMXto',
};

// Fields — resources (tblFa56lQwVacMXto)
const FIELDS_RESOURCES = {
  source_name : 'fldwH1ILW8D2ihxxk', // singleSelect — record's identity/name
  checkbox    : 'fld1OFamO1dYgDD0Z', // the boolean value this script reads
};

const CONFIG = {
  LOG_LEVEL : 'B', // A=minimal | B=audit (default) | C=debug
};

// Target resource names → their safe default if the record is missing.
const TARGETS = {
  simulateSuccessEmail : false,
  simulateFailureEmail : false,
  isProd                : true,
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
// RESOURCES REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ResourcesRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.RESOURCES);
    this.logger = logger;
  }

  // Returns a Map of source_name -> checkbox boolean, for every resources
  // record whose source_name matches one of the target names. Cheaper than
  // one selectRecordsAsync call per name.
  async getByNames(names) {
    this.logger.step(1, `Loading resources records → ${names.join(', ')}`);
    const result = await this.table.selectRecordsAsync({
      fields: [FIELDS_RESOURCES.source_name, FIELDS_RESOURCES.checkbox],
    });
    const byName = new Map();
    for (const record of result.records) {
      const name = record.getCellValueAsString(FIELDS_RESOURCES.source_name);
      if (names.includes(name)) {
        byName.set(name, !!record.getCellValue(FIELDS_RESOURCES.checkbox));
      }
    }
    this.logger.audit(`Matched ${byName.size} of ${names.length} target resources records`);
    return byName;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE — Airtable only allows one call per script.
// This script takes no inputs; TARGETS above is the full configuration.
// ─────────────────────────────────────────────────────────────────────────────

input.config();

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  simulateSuccessEmail : TARGETS.simulateSuccessEmail,
  simulateFailureEmail : TARGETS.simulateFailureEmail,
  isProd                : TARGETS.isProd,
};

try {
  logger.audit('Automation started → resolving draft-order-creation config from resources');

  const repo = new ResourcesRepository(logger);
  const byName = await repo.getByNames(Object.keys(TARGETS));

  for (const name of Object.keys(TARGETS)) {
    if (byName.has(name)) {
      result[name] = byName.get(name);
      logger.step(2, `${name} → ${result[name]} (from resources)`);
    } else {
      logger.error(`resources record "${name}" not found — falling back to default: ${TARGETS[name]}`);
    }
  }

  logger.minimal(`SUCCESS → simulateSuccessEmail: ${result.simulateSuccessEmail} | simulateFailureEmail: ${result.simulateFailureEmail} | isProd: ${result.isProd}`);

} catch (err) {
  // Config resolution failing outright (e.g. resources table unreachable)
  // falls back to the same safe defaults rather than blocking the whole
  // automation — Script 2 still runs, just with production-safe behavior.
  logger.error(`Config resolution failed → ${err.message}. Falling back to defaults.`);
}

output.set('simulateSuccessEmail', result.simulateSuccessEmail);
output.set('simulateFailureEmail', result.simulateFailureEmail);
output.set('isProd', result.isProd);
output.set('log_summary', logger.getSummary());

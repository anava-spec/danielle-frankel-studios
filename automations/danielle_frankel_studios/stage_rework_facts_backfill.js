/*
================================================================================
SCRIPT       : Stage Rework Facts Backfill (one-time, manual run)
BASE         : appMmEE4zyHMGhkkd (sandbox) — publish to appUC2NFAlURayLx9 later
TABLE SRC    : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : none — run manually once (ad hoc "Run script" button), NOT a
               recurring automation.
VERSION      : 1.0.0

OBJECTIVE
  Backfills the three "achieved" fact checkboxes added for the stage rework
  (stage_rework_handoff.md) that only started being written going forward by
  their respective live automations — any client who reached that milestone
  BEFORE the checkbox existed has it sitting blank/FALSE today, even though
  their current `stage` value proves they already achieved it.

  Confirmed via a live comparison (2026-08-20) between `stage` and a test
  formula field (`stage_formula_test`) that this backfill gap accounts for
  the overwhelming majority of the ~2,100 mismatches found — NOT logic bugs
  in the new stage formula (those were found and fixed separately).

  For each client, using their CURRENT `stage` value as ground truth:
    - order_ready_achieved   = TRUE if stage is at or past "Order Ready" in
                                STAGE_ORDER (Order Ready, In Alterations,
                                In Fulfillment, or Fulfilled).
    - deliberating_achieved  = TRUE if stage is at or past "Deliberating" in
                                STAGE_ORDER (Deliberating, Sold, Order Ready,
                                In Alterations, In Fulfillment, or Fulfilled).
    - did_not_convert_achieved = TRUE if stage is exactly "Did Not Convert".

  "Did Not Convert" clients are NOT backfilled for order_ready_achieved /
  deliberating_achieved — we can't know from `stage` alone whether they ever
  passed through those milestones before going inactive, and it doesn't
  matter for the stage formula either way: did_not_convert_achieved is
  checked first in the cascade, so those two facts are never even read for
  a Did Not Convert client.

  Never writes FALSE — only ever sets a fact to TRUE if it isn't already, per
  the "never regress" rule these facts follow everywhere else.

DRY_RUN
  Comes from input.config().dryRun (Input variable on the script step, not
  hardcoded) — defaults to TRUE if not passed. Review log_summary (counts per
  fact), then re-run with dryRun=false in the Input variables panel to apply.

OUTPUT
  Prints via Logger: clients scanned, and per-fact counts of how many would
  be (or were) updated, plus a sample of the first 20 updates for spot-check.
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients
};

const FIELDS_CLIENTS = {
  stage:                    'fldLcxVZvI1rigBlh', // singleSelect
  order_ready_achieved:     'flds1WfGHitZqHrBm', // checkbox
  deliberating_achieved:    'fldDsGeUzik9Nw9YP', // checkbox
  did_not_convert_achieved: 'fldWRzB7hU8SIf09I', // checkbox
};

// Progression order for the "at or past" comparisons. "Did Not Convert" is
// deliberately excluded — it's a side branch, not a point on this line.
const STAGE_ORDER = [
  'Pre-Appointment',
  'Deliberating',
  'Sold',
  'Order Ready',
  'In Alterations',
  'In Fulfillment',
  'Fulfilled',
];

const CONFIG = {
  LOG_LEVEL: 'B', // A=minimal | B=audit (default) | C=debug
  BATCH_SIZE: 50, // Airtable updateRecordsAsync limit per call
  SAMPLE_SIZE: 20,
  DID_NOT_CONVERT_STAGE_NAME: 'Did Not Convert',
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class Logger {
  constructor(level = 'B') { this.level = level; this.entries = []; this._levels = { A: 1, B: 2, C: 3 }; }
  _log(lvl, msg) { if (this._levels[this.level] >= this._levels[lvl]) { const e = `[${lvl}][${new Date().toISOString()}] ${msg}`; this.entries.push(e); console.log(e); } }
  minimal(msg) { this._log('A', msg); }
  audit(msg)   { this._log('B', msg); }
  debug(msg)   { this._log('C', msg); }
  error(msg)   { const e = `[ERR][${new Date().toISOString()}] ${msg}`; this.entries.push(e); console.error(e); }
  step(n, msg) { this._log('B', `── STEP ${n}: ${msg}`); }
  getSummary() { return this.entries.join('\n'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class ClientsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.CLIENTS); this.logger = logger; }

  async getAll() {
    this.logger.step(1, 'Loading all DF Clients');
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_CLIENTS) });
    this.logger.audit(`Loaded ${result.records.length} clients.`);
    return result.records;
  }

  async applyUpdates(updates) {
    this.logger.step(4, `Writing ${updates.length} record(s) in batches of ${CONFIG.BATCH_SIZE}`);
    for (let i = 0; i < updates.length; i += CONFIG.BATCH_SIZE) {
      const batch = updates.slice(i, i + CONFIG.BATCH_SIZE);
      await this.table.updateRecordsAsync(batch);
      this.logger.debug(`Batch written: records ${i + 1}-${i + batch.length}`);
    }
    this.logger.audit(`All ${updates.length} record(s) written.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKFILL EVALUATOR — pure logic, no Airtable calls
// ─────────────────────────────────────────────────────────────────────────────

class BackfillEvaluator {
  constructor(logger) { this.logger = logger; }

  // Returns the subset of fields (if any) that need writing for this client,
  // or null if nothing needs to change.
  evaluate(client) {
    const currentStage = client.getCellValueAsString(FIELDS_CLIENTS.stage);
    const fieldsToWrite = {};

    if (currentStage === CONFIG.DID_NOT_CONVERT_STAGE_NAME) {
      if (client.getCellValue(FIELDS_CLIENTS.did_not_convert_achieved) !== true) {
        fieldsToWrite[FIELDS_CLIENTS.did_not_convert_achieved] = true;
      }
      // order_ready_achieved / deliberating_achieved deliberately NOT
      // inferred here — see OBJECTIVE note above.
      return Object.keys(fieldsToWrite).length ? fieldsToWrite : null;
    }

    const idx = STAGE_ORDER.indexOf(currentStage);
    if (idx === -1) return null; // unknown/blank stage — nothing to infer

    if (idx >= STAGE_ORDER.indexOf('Order Ready') && client.getCellValue(FIELDS_CLIENTS.order_ready_achieved) !== true) {
      fieldsToWrite[FIELDS_CLIENTS.order_ready_achieved] = true;
    }
    if (idx >= STAGE_ORDER.indexOf('Deliberating') && client.getCellValue(FIELDS_CLIENTS.deliberating_achieved) !== true) {
      fieldsToWrite[FIELDS_CLIENTS.deliberating_achieved] = true;
    }

    return Object.keys(fieldsToWrite).length ? fieldsToWrite : null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  static summary({ scanned, orderReadyCount, deliberatingCount, didNotConvertCount, totalToUpdate, dryRun }) {
    return [
      `Scanned ${scanned} clients.`,
      `order_ready_achieved to set:     ${orderReadyCount}`,
      `deliberating_achieved to set:    ${deliberatingCount}`,
      `did_not_convert_achieved to set: ${didNotConvertCount}`,
      `Total records touched:           ${totalToUpdate}`,
      dryRun
        ? 'DRY RUN — nothing written. Re-run with dryRun=false to apply.'
        : 'LIVE RUN — all of the above was written.',
    ].join('\n');
  }
  static error(err) { return `❌ STAGE REWORK FACTS BACKFILL FAILED: ${err.message}`; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE — orchestrator
// ─────────────────────────────────────────────────────────────────────────────

class BackfillService {
  constructor(clientsRepo, evaluator, logger) {
    this.clientsRepo = clientsRepo;
    this.evaluator = evaluator;
    this.logger = logger;
  }

  async run(dryRun) {
    this.logger.audit(`Service started → dryRun=${dryRun}`);

    const clients = await this.clientsRepo.getAll();

    this.logger.step(2, 'Evaluating each client against STAGE_ORDER');
    const updates = [];
    let orderReadyCount = 0;
    let deliberatingCount = 0;
    let didNotConvertCount = 0;

    for (const client of clients) {
      const fieldsToWrite = this.evaluator.evaluate(client);
      if (!fieldsToWrite) continue;

      if (fieldsToWrite[FIELDS_CLIENTS.order_ready_achieved]) orderReadyCount++;
      if (fieldsToWrite[FIELDS_CLIENTS.deliberating_achieved]) deliberatingCount++;
      if (fieldsToWrite[FIELDS_CLIENTS.did_not_convert_achieved]) didNotConvertCount++;

      updates.push({ id: client.id, fields: fieldsToWrite });
    }

    this.logger.step(3, `${updates.length} client(s) need at least one fact written`);
    const sample = updates.slice(0, CONFIG.SAMPLE_SIZE).map(u => `  ${u.id}: ${JSON.stringify(u.fields)}`).join('\n');
    this.logger.audit(`Sample of updates (first ${CONFIG.SAMPLE_SIZE}):\n${sample}`);

    if (!dryRun && updates.length) {
      await this.clientsRepo.applyUpdates(updates);
    } else if (dryRun) {
      this.logger.audit('DRY RUN — skipping writes.');
    }

    return {
      scanned: clients.length,
      orderReadyCount,
      deliberatingCount,
      didNotConvertCount,
      totalToUpdate: updates.length,
      dryRun,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() is called exactly once, at global scope, before the try block.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const dryRun = cfg.dryRun !== false; // defaults to TRUE unless explicitly passed false

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status: 'ERROR', scanned: 0, order_ready_count: 0, deliberating_count: 0,
  did_not_convert_count: 0, total_to_update: 0, dry_run: dryRun,
  result_message: null, error_message: null,
};

try {
  logger.audit(`Backfill started → dryRun=${dryRun}`);

  const service = new BackfillService(
    new ClientsRepository(logger),
    new BackfillEvaluator(logger),
    logger
  );

  const summary = await service.run(dryRun);

  result = {
    status: 'SUCCESS',
    scanned: summary.scanned,
    order_ready_count: summary.orderReadyCount,
    deliberating_count: summary.deliberatingCount,
    did_not_convert_count: summary.didNotConvertCount,
    total_to_update: summary.totalToUpdate,
    dry_run: dryRun,
    result_message: MessageBuilder.summary(summary),
    error_message: null,
  };

} catch (err) {
  logger.error(`Backfill failed → ${err.message}`);
  result.error_message = err.message;
  result.result_message = MessageBuilder.error(err);
  // Re-throw → Airtable marks the run as FAILED, native notification fires
  throw err;

} finally {
  result.log_summary = logger.getSummary();
}

output.set('status',                 result.status);
output.set('scanned',                result.scanned);
output.set('order_ready_count',      result.order_ready_count);
output.set('deliberating_count',     result.deliberating_count);
output.set('did_not_convert_count',  result.did_not_convert_count);
output.set('total_to_update',        result.total_to_update);
output.set('dry_run',                result.dry_run);
output.set('result_message',         result.result_message);
output.set('error_message',          result.error_message);
output.set('log_summary',            result.log_summary);

logger.audit(`Script complete → status: ${result.status} | total_to_update: ${result.total_to_update} | dry_run: ${result.dry_run}`);

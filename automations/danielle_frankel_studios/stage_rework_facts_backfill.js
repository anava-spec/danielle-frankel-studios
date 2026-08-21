/*
================================================================================
SCRIPT       : Stage Rework Facts Backfill (one-time, manual run)
BASE         : appMmEE4zyHMGhkkd (sandbox) — publish to appUC2NFAlURayLx9 later
TABLE SRC    : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : none — run manually once (ad hoc "Run script" button), NOT a
               recurring automation.
VERSION      : 1.3.0 — added Phase 3: backfill pickup_appointment_completed_achieved
               (2026-08-21). Root cause: the live automation "Update phase to
               pick up when clients pick up appointment is before today..."
               had TWO stacked bugs in its trigger, both just fixed by Axel:
               (1) "Latest Pick Up Appointments" (fldPkOm7IaxjYPQ1i) was
               filtered against the deprecated appointment-type field, so it
               came back blank for anyone whose appointment was only tagged
               via the live field; (2) even after pointing it at the live
               field, its type filter (and the automation's own
               "appointment_types has any of" condition, fld91Zl5Ia2AO5rPV)
               only covered a subset of the real pickup-type values — e.g.
               "LA - Fit Assessment & Pick Up" was missing entirely, which is
               exactly the type on the concrete case that surfaced this
               (Joy Herwick, pickup appointment May 2025, still stuck at
               "Sold" as of 2026-08-21). Both are now fixed going forward,
               but `recordMatchesConditions` never re-fires for clients who
               already matched before the fix — so, same as Phases 1/2, this
               needs a one-time backfill for the backlog. Mirrors the live
               (now-corrected) trigger condition directly: stage is one of
               Sold/Order Ready/In Alterations/In Fulfillment, AND
               last_appointment (fldrK9nCjaQJcuH3w) is in the past, AND
               Latest Pick Up Appointments (fldPkOm7IaxjYPQ1i) is not empty
               AND in the past. Also extends SAFE_STAGE_CORRECTIONS with
               (Sold → Fulfilled) and (Order Ready → Fulfilled), since this
               fact newly applies to clients further back than "In
               Fulfillment" (the other two phases never needed to reach that
               far back).
VERSION      : 1.2.0 — added a second phase: safe direct `stage` correction,
               per Axel (2026-08-21). Rationale: Axel wants to show Julia
               `stage` vs. `stage_formula_test` already reconciled BEFORE
               converting `stage` to a formula, not after — so some of the
               known-safe mismatches need fixing directly, ahead of the
               conversion itself.
               Only two mismatch classes are auto-corrected, both diagnosed
               via a live stage vs. stage_formula_test diff (2026-08-21) as
               stale-trigger bugs, not business-logic ambiguity:
                 - FROM "In Alterations" TO whatever stage_formula_test says
                   — these are the Aug 20 incident's residue (a trigger with
                   no stage guard wrongly moved clients into "In Alterations"
                   regardless of where they actually were).
                 - FROM "In Fulfillment" TO "Fulfilled" — the
                   "Order Close Out v2" automation is deployed and correct,
                   but its `recordEntersView` trigger never re-fires for
                   clients who already matched the view's filter before the
                   automation existed; the formula catches these anyway.
               Every OTHER mismatch class found in the same diff (Fulfilled →
               In Fulfillment, Sold ↔ Deliberating, etc.) is deliberately left
               untouched — those involve a real backward move or a data
               contradiction (e.g. a "Sold" client missing a linked Shopify
               order) that needs a human to look at, not a script to guess.
               See SAFE_STAGE_CORRECTIONS below for the exact rule.
VERSION      : 1.1.0 — added alterations_scheduled_achieved to the backfill
               (2026-08-21), found via a live stage vs. stage_formula_test
               diff after the first backfill run: clients whose
               "Latest Alterations Appointment" (fldoF7SPEjWNi5JQF) was
               already non-empty before the live "Alterations Scheduled →
               In Alterations" automation started tracking this fact never
               got it backfilled — same root cause as the other three
               facts, just missed in v1.0.0 because it isn't purely derived
               from STAGE_ORDER position.
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

PREREQUISITE (Phase 2 only)
  `stage_formula_test` (fldReZU5QzRXXETgM) must already exist on DF Clients —
  a formula field implementing the new stage logic, used here purely as a
  read-only reference. If it doesn't exist yet in this base, Phase 2 finds
  nothing to correct (formulaStage comes back blank) and silently no-ops —
  it does not error.

OUTPUT
  Prints via Logger: clients scanned, per-fact counts for Phase 1, and
  per-transition counts for Phase 2's stage corrections, plus samples of
  each for spot-check.
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients
};

const FIELDS_CLIENTS = {
  stage:                          'fldLcxVZvI1rigBlh', // singleSelect
  order_ready_achieved:           'flds1WfGHitZqHrBm', // checkbox
  deliberating_achieved:          'fldDsGeUzik9Nw9YP', // checkbox
  did_not_convert_achieved:       'fldWRzB7hU8SIf09I', // checkbox
  alterations_scheduled_achieved: 'fldS2jgLMfDzOz1bj', // checkbox
  latest_alterations_appointment: 'fldoF7SPEjWNi5JQF', // lookup, dateTime — same field the live automation's trigger watches
  pickup_appointment_completed_achieved: 'fldP1yadf8MlknnhK', // checkbox
  last_appointment:               'fldrK9nCjaQJcuH3w', // lookup, dateTime — mirrors "Update phase to pick up..."'s trigger
  latest_pick_up_appointment:     'fldPkOm7IaxjYPQ1i', // lookup, dateTime — same field, now fixed to the live appointment_type field (2026-08-21)
  stage_formula_test:             'fldReZU5QzRXXETgM', // formula (text) — validated draft of the new stage logic, not yet live
};

// Stages the "Update phase to pick up..." automation's trigger allows as a
// starting point (its own `stage isAnyOf` condition) — reused by Phase 3.
const PICKUP_ELIGIBLE_STAGES = ['Sold', 'Order Ready', 'In Alterations', 'In Fulfillment'];

// Phase 2 — see VERSION 1.2.0 note above. Each entry: a FROM stage, and a
// predicate on the TO value (what stage_formula_test says it should be).
// Only pairs listed here get their `stage` corrected directly; everything
// else is left for manual review.
const SAFE_STAGE_CORRECTIONS = [
  { from: 'In Alterations', toMatches: () => true },              // the Aug 20 incident — any destination the formula names is trusted
  { from: 'In Fulfillment', toMatches: (to) => to === 'Fulfilled' }, // Order Close Out v2's stale recordEntersView trigger — forward-only
  { from: 'Sold',           toMatches: (to) => to === 'Fulfilled' }, // Phase 3 (VERSION 1.3.0) — pickup_appointment_completed_achieved backlog
  { from: 'Order Ready',    toMatches: (to) => to === 'Fulfilled' }, // same
];

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

  async applyUpdates(updates, stepNumber = 4) {
    this.logger.step(stepNumber, `Writing ${updates.length} record(s) in batches of ${CONFIG.BATCH_SIZE}`);
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

    // Not STAGE_ORDER-derived — mirrors the live automation's own trigger
    // condition (Latest Alterations Appointment is not empty), for clients
    // who already had that lookup populated before the automation existed.
    const hasAlterationsAppt = client.getCellValue(FIELDS_CLIENTS.latest_alterations_appointment) != null;
    if (hasAlterationsAppt && client.getCellValue(FIELDS_CLIENTS.alterations_scheduled_achieved) !== true) {
      fieldsToWrite[FIELDS_CLIENTS.alterations_scheduled_achieved] = true;
    }

    // Phase 3 (VERSION 1.3.0) — mirrors "Update phase to pick up..."'s own
    // (now-corrected) trigger condition, for clients whose pickup appointment
    // already happened before the fix landed.
    if (PICKUP_ELIGIBLE_STAGES.includes(currentStage) && client.getCellValue(FIELDS_CLIENTS.pickup_appointment_completed_achieved) !== true) {
      const now = new Date();
      const lastAppt = client.getCellValue(FIELDS_CLIENTS.last_appointment);
      const latestPickUp = client.getCellValue(FIELDS_CLIENTS.latest_pick_up_appointment);
      const lastApptPast = lastAppt != null && new Date(lastAppt) < now;
      const pickUpPast = latestPickUp != null && new Date(latestPickUp) < now;
      if (lastApptPast && pickUpPast) {
        fieldsToWrite[FIELDS_CLIENTS.pickup_appointment_completed_achieved] = true;
      }
    }

    return Object.keys(fieldsToWrite).length ? fieldsToWrite : null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE CORRECTION EVALUATOR — pure logic, no Airtable calls
// ─────────────────────────────────────────────────────────────────────────────

class StageCorrectionEvaluator {
  constructor(logger) { this.logger = logger; }

  // Returns { newStage } if this client's `stage` should be corrected
  // directly (matches one of SAFE_STAGE_CORRECTIONS and actually differs
  // from stage_formula_test), or null otherwise.
  evaluate(client) {
    const currentStage = client.getCellValueAsString(FIELDS_CLIENTS.stage);
    const formulaStage = client.getCellValueAsString(FIELDS_CLIENTS.stage_formula_test);

    if (!formulaStage || currentStage === formulaStage) return null;

    const rule = SAFE_STAGE_CORRECTIONS.find(r => r.from === currentStage);
    if (!rule || !rule.toMatches(formulaStage)) return null;

    return { newStage: formulaStage };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  static summary({ scanned, orderReadyCount, deliberatingCount, didNotConvertCount, alterationsScheduledCount, pickupCompletedCount, totalToUpdate, stageCorrectionsCount, stageCorrectionCounts, dryRun }) {
    const stageLines = Object.entries(stageCorrectionCounts || {}).map(([k, v]) => `    ${k}: ${v}`).join('\n');
    return [
      `Scanned ${scanned} clients.`,
      `-- Phase 1: facts --`,
      `order_ready_achieved to set:                  ${orderReadyCount}`,
      `deliberating_achieved to set:                 ${deliberatingCount}`,
      `did_not_convert_achieved to set:              ${didNotConvertCount}`,
      `alterations_scheduled_achieved to set:        ${alterationsScheduledCount}`,
      `pickup_appointment_completed_achieved to set: ${pickupCompletedCount}`,
      `Total records touched (facts):                ${totalToUpdate}`,
      `-- Phase 2: safe stage corrections --`,
      `Total records touched (stage):         ${stageCorrectionsCount}`,
      stageLines || '    (none)',
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
  constructor(clientsRepo, factEvaluator, stageCorrectionEvaluator, logger) {
    this.clientsRepo = clientsRepo;
    this.factEvaluator = factEvaluator;
    this.stageCorrectionEvaluator = stageCorrectionEvaluator;
    this.logger = logger;
  }

  async run(dryRun) {
    this.logger.audit(`Service started → dryRun=${dryRun}`);

    const clients = await this.clientsRepo.getAll();

    // ── Phase 1: fact checkboxes ────────────────────────────────────────────
    this.logger.step(2, 'Phase 1 — evaluating each client against STAGE_ORDER (facts)');
    const factUpdates = [];
    let orderReadyCount = 0;
    let deliberatingCount = 0;
    let didNotConvertCount = 0;
    let alterationsScheduledCount = 0;
    let pickupCompletedCount = 0;

    for (const client of clients) {
      const fieldsToWrite = this.factEvaluator.evaluate(client);
      if (!fieldsToWrite) continue;

      if (fieldsToWrite[FIELDS_CLIENTS.order_ready_achieved]) orderReadyCount++;
      if (fieldsToWrite[FIELDS_CLIENTS.deliberating_achieved]) deliberatingCount++;
      if (fieldsToWrite[FIELDS_CLIENTS.did_not_convert_achieved]) didNotConvertCount++;
      if (fieldsToWrite[FIELDS_CLIENTS.alterations_scheduled_achieved]) alterationsScheduledCount++;
      if (fieldsToWrite[FIELDS_CLIENTS.pickup_appointment_completed_achieved]) pickupCompletedCount++;

      factUpdates.push({ id: client.id, fields: fieldsToWrite });
    }

    this.logger.step(3, `Phase 1 — ${factUpdates.length} client(s) need at least one fact written`);
    const factSample = factUpdates.slice(0, CONFIG.SAMPLE_SIZE).map(u => `  ${u.id}: ${JSON.stringify(u.fields)}`).join('\n');
    this.logger.audit(`Sample of fact updates (first ${CONFIG.SAMPLE_SIZE}):\n${factSample}`);

    if (!dryRun && factUpdates.length) {
      await this.clientsRepo.applyUpdates(factUpdates, 4);
    } else if (dryRun) {
      this.logger.audit('DRY RUN — skipping fact writes.');
    }

    // ── Phase 2: safe direct stage correction (VERSION 1.2.0) ───────────────
    this.logger.step(5, 'Phase 2 — checking stage vs. stage_formula_test for the two known-safe mismatch classes');
    const stageUpdates = [];
    const stageCorrectionCounts = {};

    for (const client of clients) {
      const correction = this.stageCorrectionEvaluator.evaluate(client);
      if (!correction) continue;

      const fromStage = client.getCellValueAsString(FIELDS_CLIENTS.stage);
      const key = `${fromStage} → ${correction.newStage}`;
      stageCorrectionCounts[key] = (stageCorrectionCounts[key] || 0) + 1;

      stageUpdates.push({ id: client.id, fields: { [FIELDS_CLIENTS.stage]: { name: correction.newStage } } });
    }

    this.logger.step(6, `Phase 2 — ${stageUpdates.length} client(s) qualify for direct stage correction`);
    const stageSample = Object.entries(stageCorrectionCounts).map(([k, v]) => `  ${k}: ${v}`).join('\n');
    this.logger.audit(`Stage corrections by transition:\n${stageSample}`);

    if (!dryRun && stageUpdates.length) {
      await this.clientsRepo.applyUpdates(stageUpdates, 7);
    } else if (dryRun) {
      this.logger.audit('DRY RUN — skipping stage corrections.');
    }

    return {
      scanned: clients.length,
      orderReadyCount,
      deliberatingCount,
      didNotConvertCount,
      alterationsScheduledCount,
      pickupCompletedCount,
      totalToUpdate: factUpdates.length,
      stageCorrectionsCount: stageUpdates.length,
      stageCorrectionCounts,
      dryRun,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() is called exactly once, at global scope, before the try block.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
// Input variables can arrive as a real boolean or as the string "false"/"true"
// depending on how the variable was typed in the script step's UI — treat
// both the same way. Defaults to TRUE (safe) unless explicitly falsy.
const dryRun = !(cfg.dryRun === false || String(cfg.dryRun).toLowerCase() === 'false');

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status: 'ERROR', scanned: 0, order_ready_count: 0, deliberating_count: 0,
  did_not_convert_count: 0, alterations_scheduled_count: 0, pickup_completed_count: 0,
  total_to_update: 0, stage_corrections_count: 0, dry_run: dryRun,
  result_message: null, error_message: null,
};

try {
  logger.audit(`Backfill started → dryRun=${dryRun}`);

  const service = new BackfillService(
    new ClientsRepository(logger),
    new BackfillEvaluator(logger),
    new StageCorrectionEvaluator(logger),
    logger
  );

  const summary = await service.run(dryRun);

  result = {
    status: 'SUCCESS',
    scanned: summary.scanned,
    order_ready_count: summary.orderReadyCount,
    deliberating_count: summary.deliberatingCount,
    did_not_convert_count: summary.didNotConvertCount,
    alterations_scheduled_count: summary.alterationsScheduledCount,
    pickup_completed_count: summary.pickupCompletedCount,
    total_to_update: summary.totalToUpdate,
    stage_corrections_count: summary.stageCorrectionsCount,
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
output.set('alterations_scheduled_count', result.alterations_scheduled_count);
output.set('pickup_completed_count', result.pickup_completed_count);
output.set('total_to_update',        result.total_to_update);
output.set('stage_corrections_count', result.stage_corrections_count);
output.set('dry_run',                result.dry_run);
output.set('result_message',         result.result_message);
output.set('error_message',          result.error_message);
output.set('log_summary',            result.log_summary);

logger.audit(`Script complete → status: ${result.status} | total_to_update: ${result.total_to_update} | dry_run: ${result.dry_run}`);

/*
================================================================================
AUTOMATION   : Order Ready Evaluation — Record Updated (Orders - Shopify)
BASE         : app6Q4xMZ1ngJxiV8 (sandbox) — publish to appUC2NFAlURayLx9 later
TABLE SRC    : Orders - Shopify (tblHFGbijtvZcRPkE)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : Record updated — Orders - Shopify, watching: picked_status_percentage,
               gown_picked
VERSION      : 1.1.0 — replaces the "partially picked gown" check
               (Category Lookup + picked_status_percentage > 0, at the whole-order
               level) with the new gown_picked rollup (fldn0e6E4NjTPWlw0),
               which now correctly resolves "there is a GOWN-category item in the
               order AND that specific item is picked" at the order_items level.
               Also renames the target stage from "In Production" to
               "Order Ready" (choice rename done in Sandbox — publish before
               deploying this script).
               The Category Lookup field (fldSF1GXY5MgiAXdl) is no longer used —
               it can stay in the trigger's "watching" list only if Airtable
               requires it to avoid breaking the existing trigger; otherwise
               replace it with gown_picked there too.

OBJECTIVE
  Evaluates Julia's rule for "Order Ready":
    (a) gown_picked = TRUE (rollup: at least one GOWN-category item on the
        order is picked), OR
    (b) picked_status_percentage on the order is > 75%
  If either is true AND the client is NOT already at or past "Order Ready"
  in STAGE_ORDER, updates DF Clients.stage to "Order Ready". Never moves a
  client backward once they've already advanced further.

  DESIGN NOTE: the evaluation is PER ORDER (not aggregated across a client's
  multiple orders), since picked_status_percentage and gown_picked are
  order-level fields, not a client-level rollup. If a client has several
  orders, it only takes ONE qualifying order to mark Order Ready.

GUARD CLAUSE
  1. sourceRecordId (order) must come from the trigger.
  2. The order must have a linked client. If not, SKIP without error.
  3. If the client is already at a stage equal to or past "Order Ready" in
     STAGE_ORDER, SKIP — this automation only ADVANCES, never moves backward.
  4. Edge case: if gown_picked is null/undefined AND picked_status_percentage
     is null, SKIP — not enough data to evaluate (avoids a false positive
     from missing/delayed data out of Cobalt).

OUTPUTS (output.set)
  status            : "SUCCESS" | "ERROR"
  client_id         : record ID of the evaluated client, or null
  gown_ready        : boolean — whether it qualifies via gown_picked
  percent_picked    : number 0–1 — picked_status_percentage on the order
  qualifies         : boolean — final result of the Order Ready rule
  stage_written     : "Order Ready" | null (null if nothing was written)
  result_message    : human-readable summary
  error_message     : null on success
  log_summary       : full trace
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  ORDERS:  'tblHFGbijtvZcRPkE', // Orders - Shopify
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients
};

// Orders - Shopify fields — verified against customer_journey DBML
const FIELDS_ORDERS = {
  client:                   'fldeVnAInz9d1jpY5', // multipleRecordLinks -> DF Clients
  gown_picked:              'fldn0e6E4NjTPWlw0', // rollup (checkbox) — GOWN item picked, via order_items
  picked_status_percentage: 'fldjC8M11Pis7eMxF', // formula, 0-1 fraction
};

// DF Clients fields
const FIELDS_CLIENTS = {
  stage: 'fldLcxVZvI1rigBlh', // confirmed in pipeline.tsx
};

// Kept in parallel with the interfaces' STAGE_ORDER (pipeline.tsx /
// alterations.tsx) ONLY so this doesn't advance/regress incorrectly. See
// the duplication finding in the phase-logic audit.
const STAGE_ORDER = [
  'Pre-Appointment',
  'Deliberating',
  'Sold',
  'Order Ready',   // formerly "In Production"
  'In Alterations',
  'In Fulfillment',
  'Fulfilled',      // unified terminal stage — client close-out (can have several orders, each picked up or shipped), see order_close_out.js
];

const CONFIG = {
  LOG_LEVEL: 'B',                // A=minimal | B=audit (default) | C=debug
  PICK_PERCENT_THRESHOLD: 0.75,  // > 75% (strictly greater, per Julia)
  TARGET_STAGE: 'Order Ready',
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
// ORDER REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class OrderRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.ORDERS); this.logger = logger; }

  async getById(recordId) {
    this.logger.step(1, `Loading order → ${recordId}`);
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_ORDERS) });
    const record = result.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Order not found → recordId: ${recordId}`);
    this.logger.audit(`Order loaded → ${recordId}`);
    return record;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class ClientsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.CLIENTS); this.logger = logger; }

  async getById(clientId) {
    this.logger.step(3, `Loading client → ${clientId}`);
    const result = await this.table.selectRecordsAsync({ fields: [FIELDS_CLIENTS.stage] });
    const record = result.records.find(r => r.id === clientId);
    if (!record) throw new Error(`Client not found → clientId: ${clientId}`);
    this.logger.audit(`Client loaded → ${clientId}`);
    return record;
  }

  async writeStage(clientId, stageName) {
    this.logger.step(5, `Writing stage="${stageName}" → client: ${clientId}`);
    await this.table.updateRecordAsync(clientId, { [FIELDS_CLIENTS.stage]: { name: stageName } });
    this.logger.audit(`Stage written → ${stageName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER READY EVALUATOR — pure logic, no Airtable calls
// ─────────────────────────────────────────────────────────────────────────────

class OrderReadyEvaluator {
  constructor(logger) { this.logger = logger; }

  evaluate(order) {
    this.logger.step(4, 'Evaluating gown_picked and % picked on the order');

    const gownPicked    = order.getCellValue(FIELDS_ORDERS.gown_picked);            // boolean (rollup checkbox), or null
    const percentPicked = order.getCellValue(FIELDS_ORDERS.picked_status_percentage);

    const hasData = (gownPicked !== null && gownPicked !== undefined) || (percentPicked !== null && percentPicked !== undefined);
    if (!hasData) {
      this.logger.audit('gown_picked and picked_status_percentage both null — insufficient data. SKIP.');
      return { qualifies: false, gownReady: false, percentPicked: 0, evaluable: false };
    }

    const gownReady = gownPicked === true;
    const pct = percentPicked ?? 0;
    const qualifies = gownReady || pct > CONFIG.PICK_PERCENT_THRESHOLD;

    this.logger.audit(`gownPicked=${gownReady} | percentPicked=${(pct * 100).toFixed(1)}% | qualifies=${qualifies}`);
    return { qualifies, gownReady, percentPicked: pct, evaluable: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  static success(clientId, qualifies, stageWritten) {
    return qualifies
      ? `✅ ORDER READY → client ${clientId} qualifies. Stage written: ${stageWritten ?? '(no change — already further along)'}`
      : `ℹ️ NOT QUALIFIED yet → client ${clientId} doesn't meet gown-picked or >75%.`;
  }
  static skipped(reason) { return `⏭️ SKIPPED — ${reason}`; }
  static error(err) { return `❌ ORDER READY EVAL FAILED: ${err.message}`; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE — orchestrator
// ─────────────────────────────────────────────────────────────────────────────

class OrderReadyService {
  constructor(orderRepo, clientsRepo, evaluator, logger) {
    this.orderRepo = orderRepo;
    this.clientsRepo = clientsRepo;
    this.evaluator = evaluator;
    this.logger = logger;
  }

  async run(triggerRecordId) {
    this.logger.audit(`Service started → order: ${triggerRecordId}`);

    const order = await this.orderRepo.getById(triggerRecordId);

    const linkedClients = order.getCellValue(FIELDS_ORDERS.client) || [];
    if (!linkedClients.length) {
      return {
        status: 'SUCCESS', client_id: null, gown_ready: false, percent_picked: 0,
        qualifies: false, stage_written: null,
        result_message: MessageBuilder.skipped('Order has no linked client.'),
      };
    }
    const clientId = linkedClients[0].id;
    this.logger.step(2, `Client resolved → ${clientId}`);

    // GUARD 3 — never move backward
    const clientRecord = await this.clientsRepo.getById(clientId);
    const currentStage = clientRecord.getCellValueAsString(FIELDS_CLIENTS.stage);
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const targetIdx = STAGE_ORDER.indexOf(CONFIG.TARGET_STAGE);
    if (currentIdx !== -1 && currentIdx >= targetIdx) {
      return {
        status: 'SUCCESS', client_id: clientId, gown_ready: false, percent_picked: 0,
        qualifies: false, stage_written: null,
        result_message: MessageBuilder.skipped(`client is already at/past "${CONFIG.TARGET_STAGE}" (current stage: "${currentStage}"). Not moving backward.`),
      };
    }

    const { qualifies, gownReady, percentPicked, evaluable } = this.evaluator.evaluate(order);

    if (!evaluable) {
      return {
        status: 'SUCCESS', client_id: clientId, gown_ready: false, percent_picked: 0,
        qualifies: false, stage_written: null,
        result_message: MessageBuilder.skipped('Insufficient data (gown_picked and picked_status_percentage both null).'),
      };
    }

    let stageWritten = null;
    if (qualifies) {
      await this.clientsRepo.writeStage(clientId, CONFIG.TARGET_STAGE);
      stageWritten = CONFIG.TARGET_STAGE;
    }

    return {
      status: 'SUCCESS', client_id: clientId, gown_ready: gownReady, percent_picked: percentPicked,
      qualifies, stage_written: stageWritten,
      result_message: MessageBuilder.success(clientId, qualifies, stageWritten),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE, global scope, before the try block.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const triggerRecordId = cfg.recordId;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status: 'ERROR', client_id: null, gown_ready: false, percent_picked: 0,
  qualifies: false, stage_written: null, result_message: null, error_message: null,
};

try {
  if (!triggerRecordId) throw new Error(
    'Missing required input: recordId. Ensure the trigger passes the order Record ID via input variable "recordId".'
  );

  logger.audit(`Automation started → recordId: ${triggerRecordId}`);

  const service = new OrderReadyService(
    new OrderRepository(logger),
    new ClientsRepository(logger),
    new OrderReadyEvaluator(logger),
    logger
  );

  result = await service.run(triggerRecordId);
  result.error_message = null;

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;
  result.result_message = MessageBuilder.error(err);
  // Re-throw → Airtable marks run as FAILED, native notification fires
  throw err;

} finally {
  result.log_summary = logger.getSummary();
}

output.set('status',         result.status);
output.set('client_id',      result.client_id);
output.set('gown_ready',     result.gown_ready);
output.set('percent_picked', result.percent_picked);
output.set('qualifies',      result.qualifies);
output.set('stage_written',  result.stage_written);
output.set('result_message', result.result_message);
output.set('error_message',  result.error_message);
output.set('log_summary',    result.log_summary);

logger.audit(`Script complete → status: ${result.status} | qualifies: ${result.qualifies}`);

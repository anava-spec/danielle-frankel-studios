/*
================================================================================
AUTOMATION   : Order Close Out - In Fulfillment to Fulfilled
BASE         : appMmEE4zyHMGhkkd (sandbox) — publish to production after review
TABLE SRC    : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : Record enters view "fulfillment_ready_to_close_out" — DF Clients
               (stage = "In Fulfillment" AND (quantity_open_total = 0 OR
               sa_override_fulfilled)). See VERSION 3.0.0 note for why the
               view-based trigger replaced watching fields directly.
VERSION      : 3.0.0 — dropped Path B (appointment-confirmed pickup) and
               Path C (tracking + % shipped) entirely, per Axel (2026-08-20).
               Both were absorbed from automations with zero production runs
               ever (see v1.0.0 note), and on reflection neither is worth
               keeping active close-out logic on:
                 - Path B's fields (full_order_fulfilled_from_appt,
                   picked_up_from_appt) have no other meaningful dependents.
                 - Path C's percent_shipped rollup source-chains through a
                   field literally named "Shipped (num, 0-1) (deprecated)"
                   on Orders - Shopify, which itself derives from a
                   manually-editable single select ("Shipped status") that
                   any staff member can change by hand. Shipped quantity
                   should come from order_items (Apparel-Magic-synced data),
                   not a hand-set select field — using it to auto-close an
                   order would be trusting the wrong source of truth.
               Axel is following up with Julia on whether to delete
               full_order_fulfilled_from_appt, picked_up_from_appt,
               percent_shipped, and the two Orders - Shopify fields behind
               it (deprecated formula + "Shipped status" select) outright.
               Until that's decided, this script and the
               "fulfillment_ready_to_close_out" view simply don't reference
               them — no schema changes made here.
               Close-out is now just Path A (quantity_open_total == 0) OR
               Path D (sa_override_fulfilled), matching the view's filter
               1:1 — see TRIGGER note above. Manually tested against the
               sandbox test clients for A and D (Bryn Valaika, Elizabeth
               Lites); Path C's test client (Josephine D'Ippolito) is now
               moot since that path no longer exists.
VERSION      : 2.0.0 — replaced the direct order_items query from v1.0.0 with
               the DF Clients.quantity_open_total rollup field
               (fldVfOcvePRxXkVHT), added 2026-08-20 specifically so this
               could be a live trigger field (chained rollup: order_items
               .quantity_open -> Orders - Shopify.quantity_open_total ->
               DF Clients.quantity_open_total; the ALTERATIONS exclusion —
               Issue 2 fix — lives on the Orders - Shopify rollup's "only
               include linked records that meet conditions" filter, style
               _category has none of ALTERATIONS).
VERSION      : 1.0.0 — consolidated three previously separate automations
               into one, per Axel's request (2026-08-20) to stop fragmenting
               the base into one automation per stage transition: "Picked Up
               & Full Order Fulfilled - Update Phase to Fulfilled" (Path B),
               "Order is Shipped - Update Phase to Fulfilled" (Path C), and
               this automation's own placeholder. All three legacy
               automations have since been deleted by Axel.

OBJECTIVE
  Close out a client's order once fulfillment is actually done, and write
  DF Clients.stage = "Fulfilled" (the single choice that used to be named
  "Picked Up" before the separate "Shipped" choice was deleted — a client can
  have multiple orders, each individually picked up or shipped, so close-out
  is one unified client-level stage rather than a per-method value).

  Qualifies if the client is currently in "In Fulfillment" AND either:
    A. quantity_open_total == 0 (DF Clients rollup, chained from order_items
       through Orders - Shopify; ALTERATIONS items are excluded upstream so
       they never block or misroute this close-out, per the Issue 2 fix).
    D. sa_override_fulfilled is checked — a manual exception for staff, used
       when AM/Cobalt data is stale or incomplete. This is a true override:
       it does NOT require Path A, by design, so staff never have extra
       manual work in the normal flow.

GUARD CLAUSE
  1. sourceRecordId (client) must come from the trigger.
  2. If the client's stage is not exactly "In Fulfillment", SKIP — this
     automation only closes that specific stage; it never regresses or skips
     a stage. (Belt-and-suspenders: the "fulfillment_ready_to_close_out" view
     already filters to this stage, so a real trigger firing on a non-
     matching record shouldn't happen — but this guard costs nothing and
     protects against a manual test run or a future view-filter edit.)
  3. If neither A nor D hold, SKIP without writing anything. (Same
     belt-and-suspenders rationale as guard 2.)

OUTPUTS (output.set)
  status          : "SUCCESS" | "ERROR"
  client_id       : record ID of the evaluated client
  qualifies       : boolean — final result
  qualifying_path : "quantity_open" | "sa_override" | null
  stage_written   : "Fulfilled" | null (null if nothing was written)
  result_message  : human-readable summary
  error_message   : null on success
  log_summary     : full trace
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients
};

const FIELDS_CLIENTS = {
  stage:                'fldLcxVZvI1rigBlh', // singleSelect
  sa_override_fulfilled: 'fldqHU9ryVXgpZOGe', // checkbox — manual exception
  quantity_open_total:  'fldVfOcvePRxXkVHT', // rollup — chained order_items -> Orders - Shopify -> DF Clients, ALTERATIONS already excluded upstream
};

const CONFIG = {
  LOG_LEVEL:      'B',                // A=minimal | B=audit (default) | C=debug
  REQUIRED_STAGE: 'In Fulfillment',
  TARGET_STAGE:   'Fulfilled',
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

  async getById(clientId) {
    this.logger.step(1, `Loading client → ${clientId}`);
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_CLIENTS) });
    const record = result.records.find(r => r.id === clientId);
    if (!record) throw new Error(`Client not found → clientId: ${clientId}`);
    this.logger.audit(`Client loaded → ${clientId}`);
    return record;
  }

  async writeStage(clientId, stageName) {
    this.logger.step(4, `Writing stage="${stageName}" → client: ${clientId}`);
    await this.table.updateRecordAsync(clientId, { [FIELDS_CLIENTS.stage]: { name: stageName } });
    this.logger.audit(`Stage written → ${stageName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE-OUT EVALUATOR — pure logic, no Airtable calls
// ─────────────────────────────────────────────────────────────────────────────

class CloseOutEvaluator {
  constructor(logger) { this.logger = logger; }

  evaluate({ saOverride, quantityOpenTotal }) {
    this.logger.step(3, 'Evaluating the two close-out paths');

    if (saOverride === true) {
      return { qualifies: true, path: 'sa_override' };
    }
    // quantityOpenTotal is null/undefined when the client has no linked
    // orders yet — that must never read as "fully closed".
    if (quantityOpenTotal === 0) {
      return { qualifies: true, path: 'quantity_open' };
    }

    this.logger.audit('Neither close-out path qualifies yet.');
    return { qualifies: false, path: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  static success(clientId, path, stageWritten) {
    return `✅ CLOSED OUT → client ${clientId} via path "${path}". Stage written: ${stageWritten}`;
  }
  static skipped(reason) { return `⏭️ SKIPPED — ${reason}`; }
  static error(err) { return `❌ ORDER CLOSE OUT FAILED: ${err.message}`; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE — orchestrator
// ─────────────────────────────────────────────────────────────────────────────

class OrderCloseOutService {
  constructor(clientsRepo, evaluator, logger) {
    this.clientsRepo = clientsRepo;
    this.evaluator = evaluator;
    this.logger = logger;
  }

  async run(clientId) {
    this.logger.audit(`Service started → client: ${clientId}`);

    const client = await this.clientsRepo.getById(clientId);

    // GUARD 2 — only ever close out "In Fulfillment"
    const currentStage = client.getCellValueAsString(FIELDS_CLIENTS.stage);
    if (currentStage !== CONFIG.REQUIRED_STAGE) {
      return {
        status: 'SUCCESS', client_id: clientId, qualifies: false, qualifying_path: null, stage_written: null,
        result_message: MessageBuilder.skipped(`client stage is "${currentStage}", not "${CONFIG.REQUIRED_STAGE}".`),
      };
    }

    this.logger.step(2, 'Reading client-level close-out signals');
    const saOverride = client.getCellValue(FIELDS_CLIENTS.sa_override_fulfilled) === true;
    const quantityOpenTotal = client.getCellValue(FIELDS_CLIENTS.quantity_open_total);

    const { qualifies, path } = this.evaluator.evaluate({ saOverride, quantityOpenTotal });

    if (!qualifies) {
      return {
        status: 'SUCCESS', client_id: clientId, qualifies: false, qualifying_path: null, stage_written: null,
        result_message: MessageBuilder.skipped('neither close-out path qualifies yet.'),
      };
    }

    await this.clientsRepo.writeStage(clientId, CONFIG.TARGET_STAGE);

    return {
      status: 'SUCCESS', client_id: clientId, qualifies: true, qualifying_path: path, stage_written: CONFIG.TARGET_STAGE,
      result_message: MessageBuilder.success(clientId, path, CONFIG.TARGET_STAGE),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() is called exactly once, at global scope, before the try block.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const triggerRecordId = cfg.recordId;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status: 'ERROR', client_id: null, qualifies: false, qualifying_path: null, stage_written: null,
  result_message: null, error_message: null,
};

try {
  if (!triggerRecordId) throw new Error(
    'Missing required input: recordId. Ensure the trigger passes the client Record ID via the input variable "recordId".'
  );

  logger.audit(`Automation started → recordId: ${triggerRecordId}`);

  const service = new OrderCloseOutService(
    new ClientsRepository(logger),
    new CloseOutEvaluator(logger),
    logger
  );

  result = await service.run(triggerRecordId);
  result.error_message = null;

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;
  result.result_message = MessageBuilder.error(err);
  // Re-throw → Airtable marks the run as FAILED, native notification fires
  throw err;

} finally {
  result.log_summary = logger.getSummary();
}

output.set('status',          result.status);
output.set('client_id',       result.client_id);
output.set('qualifies',       result.qualifies);
output.set('qualifying_path', result.qualifying_path);
output.set('stage_written',   result.stage_written);
output.set('result_message',  result.result_message);
output.set('error_message',   result.error_message);
output.set('log_summary',     result.log_summary);

logger.audit(`Script complete → status: ${result.status} | qualifies: ${result.qualifies}`);

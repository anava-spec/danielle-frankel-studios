/*
================================================================================
AUTOMATION   : Order Close Out - In Fulfillment to Fulfilled
BASE         : appMmEE4zyHMGhkkd (sandbox) — publish to production after review
TABLE SRC    : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : Record updated — DF Clients, watching: stage, sa_override_fulfilled,
               full_order_fulfilled_from_appt, picked_up_from_appt,
               tracking_number, percent_shipped, quantity_open_total
VERSION      : 2.0.0 — replaces the direct order_items query from v1.0.0 with
               the new DF Clients.quantity_open_total rollup field
               (fldVfOcvePRxXkVHT), added 2026-08-20 specifically so this
               automation's trigger can watch it directly (chained rollup:
               order_items.quantity_open -> Orders - Shopify.quantity_open_total
               -> DF Clients.quantity_open_total). The ALTERATIONS exclusion
               (Issue 2 fix) lives on the Orders - Shopify rollup itself, via
               its "only include linked records that meet conditions" filter
               (style_category has none of ALTERATIONS) — Axel reconfigured
               it this way instead of the intermediate order_items formula
               field this script originally assumed, so there is one fewer
               field in the chain than the VERSION note above implies; the
               script itself is unaffected either way since it only reads
               the final DF Clients.quantity_open_total value. This is a
               separate automation from the original consolidation draft
               (Order Close Out - In Fulfillment to Fulfilled, wflndcP1aaQD2ORhK)
               because that one already had a script node pasted in, which
               locks it from further API edits — Axel is updating that node
               to this v2.0.0 script by hand and will delete the 3 legacy
               automations below once verified.
               Trigger note: recordMatchesConditions (which would only fire
               when a client actually starts matching "stage=In Fulfillment
               AND (A OR B OR C OR D)") was attempted first, per Axel's
               feedback that recordUpdated fires too often — but the Airtable
               MCP's recordMatchesConditions schema only accepts a flat list
               of leaf conditions under one and/or, not a nested OR-of-ANDs
               tree (confirmed via two rejected attempts). recordUpdated is
               what's actually wired on this automation's trigger; switching
               to recordMatchesConditions or recordEntersView is possible but
               has to be built by hand in the Airtable UI (its condition
               builder does support nested groups) — the API can't do it.
VERSION      : 1.0.0 — consolidates three previously separate automations into
               one, per Axel's request (2026-08-20) to stop fragmenting the
               base into one automation per stage transition:
                 1. "Picked Up & Full Order Fulfilled - Update Phase to
                    Fulfilled" (appointment-confirmed pickup) — absorbed as
                    Path B below.
                 2. "Order is Shipped - Update Phase to Fulfilled"
                    (tracking + 100% shipped) — absorbed as Path C below.
                 3. This automation's own placeholder — replaced with the
                    real script below (Path A + Path D + the manual override).
               Both automations above had zero production runs (confirmed via
               Run History) before being absorbed, so no in-flight behavior
               was lost by consolidating. They should be deleted once this
               script is verified in Airtable.

OBJECTIVE
  Close out a client's order once fulfillment is actually done, and write
  DF Clients.stage = "Fulfilled" (the single choice that used to be named
  "Picked Up" before the separate "Shipped" choice was deleted — a client can
  have multiple orders, each individually picked up or shipped, so close-out
  is one unified client-level stage rather than a per-method value).

  Qualifies if the client is currently in "In Fulfillment" AND any ONE of:
    A. quantity_open_total == 0 (DF Clients rollup, chained from order_items
       through Orders - Shopify — see VERSION note above; ALTERATIONS items
       are excluded at the order_items formula level so they never block or
       misroute this close-out, per the Issue 2 fix).
    B. full_order_fulfilled_from_appt AND picked_up_from_appt are both true
       (staff confirmed pickup in an appointment).
    C. tracking_number is not empty AND percent_shipped == 1 (100% shipped).
    D. sa_override_fulfilled is checked — a manual exception for staff, used
       when AM/Cobalt data is stale or incomplete. This is a true override:
       it does NOT require any of A/B/C, by design (per Axel, 2026-08-20) so
       staff never have extra manual work in the normal flow.

GUARD CLAUSE
  1. sourceRecordId (client) must come from the trigger.
  2. If the client's stage is not exactly "In Fulfillment", SKIP — this
     automation only closes that specific stage; it never regresses or skips
     a stage.
  3. If none of A/B/C/D hold, SKIP without writing anything.

OUTPUTS (output.set)
  status          : "SUCCESS" | "ERROR"
  client_id       : record ID of the evaluated client
  qualifies       : boolean — final result
  qualifying_path : "quantity_open" | "appointment_pickup" | "tracking_shipped" | "sa_override" | null
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
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients — order_items/Orders - Shopify no longer queried directly, see quantity_open_total rollup below
};

const FIELDS_CLIENTS = {
  stage:                           'fldLcxVZvI1rigBlh', // singleSelect
  sa_override_fulfilled:           'fldqHU9ryVXgpZOGe', // checkbox — manual exception
  full_order_fulfilled_from_appt:  'fldx299G71hQCdd2o', // checkbox (lookup from Appointment Records)
  picked_up_from_appt:             'fldKPRPO8GeASRimg', // checkbox (lookup from Appointment Records)
  tracking_number:                 'fldY0SvbuYeHUZa15', // singleLineText (client-level)
  percent_shipped:                 'fldigqrFBZwceLCT7', // formula/percent, 0-1 fraction
  quantity_open_total:             'fldVfOcvePRxXkVHT', // rollup — chained order_items -> Orders - Shopify -> DF Clients, ALTERATIONS already excluded
};

const CONFIG = {
  LOG_LEVEL:       'B',                // A=minimal | B=audit (default) | C=debug
  REQUIRED_STAGE:  'In Fulfillment',
  TARGET_STAGE:    'Fulfilled',
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

  evaluate({ saOverride, fullOrderFulfilledFromAppt, pickedUpFromAppt, trackingNumber, percentShipped, quantityOpenTotal }) {
    this.logger.step(3, 'Evaluating the four close-out paths');

    if (saOverride === true) {
      return { qualifies: true, path: 'sa_override' };
    }
    if (fullOrderFulfilledFromAppt === true && pickedUpFromAppt === true) {
      return { qualifies: true, path: 'appointment_pickup' };
    }
    if (trackingNumber && percentShipped === 1) {
      return { qualifies: true, path: 'tracking_shipped' };
    }
    // quantityOpenTotal is null/undefined when the client has no linked
    // orders yet — that must never read as "fully closed".
    if (quantityOpenTotal === 0) {
      return { qualifies: true, path: 'quantity_open' };
    }

    this.logger.audit('No close-out path qualifies yet.');
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
    const fullOrderFulfilledFromAppt = client.getCellValue(FIELDS_CLIENTS.full_order_fulfilled_from_appt) === true;
    const pickedUpFromAppt = client.getCellValue(FIELDS_CLIENTS.picked_up_from_appt) === true;
    const trackingNumber = client.getCellValueAsString(FIELDS_CLIENTS.tracking_number);
    const percentShipped = client.getCellValue(FIELDS_CLIENTS.percent_shipped);
    const quantityOpenTotal = client.getCellValue(FIELDS_CLIENTS.quantity_open_total);

    const { qualifies, path } = this.evaluator.evaluate({
      saOverride, fullOrderFulfilledFromAppt, pickedUpFromAppt, trackingNumber, percentShipped, quantityOpenTotal,
    });

    if (!qualifies) {
      return {
        status: 'SUCCESS', client_id: clientId, qualifies: false, qualifying_path: null, stage_written: null,
        result_message: MessageBuilder.skipped('none of the four close-out paths qualify yet.'),
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

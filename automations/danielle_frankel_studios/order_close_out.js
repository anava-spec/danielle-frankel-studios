/*
================================================================================
AUTOMATION   : Order Close Out - In Fulfillment to Fulfilled
BASE         : appMmEE4zyHMGhkkd (sandbox) — publish to production after review
TABLE SRC    : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : Record updated — DF Clients, watching: stage, sa_override_fulfilled,
               full_order_fulfilled_from_appt, picked_up_from_appt,
               tracking_number, percent_shipped
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
    A. quantity_open == 0 across every non-ALTERATIONS order_item on every
       Shopify order linked to the client (the "everything physically out"
       signal — ALTERATIONS items are in-studio work and must never block or
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

KNOWN LIMITATION
  Path A depends on order_items.quantity_open, which lives on a different
  table than the trigger (DF Clients) and has no client-level rollup yet.
  This script computes it live by querying order_items directly, so it is
  always evaluated correctly whenever the automation runs — but the
  automation is NOT triggered purely by an order_items change, only by a
  change on one of the watched DF Clients fields. In practice this is rarely
  an issue (an order reaching quantity_open == 0 is normally accompanied by a
  tracking_number/percent_shipped update from the AM sync, which does fire
  this trigger), but if Julia ever reports orders sitting at quantity_open ==
  0 without closing out, the fix is either a client-level rollup of
  quantity_open (so it can be added to watchFields) or a second trigger on
  Orders - Shopify resolving to the client (same pattern as
  order_ready_evaluation.js).

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
  CLIENTS:     'tblLLUlDgJ4ktzF7c', // DF Clients
  ORDERS:      'tblHFGbijtvZcRPkE', // Orders - Shopify
  ORDER_ITEMS: 'tblWOBS5nX0GZokaU', // order_items
};

const FIELDS_CLIENTS = {
  stage:                           'fldLcxVZvI1rigBlh', // singleSelect
  sa_override_fulfilled:           'fldqHU9ryVXgpZOGe', // checkbox — manual exception
  full_order_fulfilled_from_appt:  'fldx299G71hQCdd2o', // checkbox (lookup from Appointment Records)
  picked_up_from_appt:             'fldKPRPO8GeASRimg', // checkbox (lookup from Appointment Records)
  tracking_number:                 'fldY0SvbuYeHUZa15', // singleLineText (client-level)
  percent_shipped:                 'fldigqrFBZwceLCT7', // formula/percent, 0-1 fraction
  linked_orders:                   'fldWSGqQW9czYdams', // multipleRecordLinks -> Orders - Shopify (reverse of Orders.client)
};

const FIELDS_ORDER_ITEMS = {
  order:          'fldXrdBFm5SeGCTvq', // multipleRecordLinks -> Orders - Shopify
  quantity_open:  'fldvU2sU8b6V0wTlG', // number
  style_category: 'fld6qGDLnQvtgarg5', // multipleLookupValues (via DF Styles) — contains "ALTERATIONS" for alterations items
};

const CONFIG = {
  LOG_LEVEL:       'B',                // A=minimal | B=audit (default) | C=debug
  REQUIRED_STAGE:  'In Fulfillment',
  TARGET_STAGE:    'Fulfilled',
  EXCLUDED_STYLE_CATEGORY: 'ALTERATIONS',
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
    this.logger.step(6, `Writing stage="${stageName}" → client: ${clientId}`);
    await this.table.updateRecordAsync(clientId, { [FIELDS_CLIENTS.stage]: { name: stageName } });
    this.logger.audit(`Stage written → ${stageName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER ITEMS REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class OrderItemsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.ORDER_ITEMS); this.logger = logger; }

  // order_items has no reverse link back to Orders - Shopify exposed on this
  // table's schema in a way we can filter server-side, so — same approach as
  // fulfillment.tsx — pull everything and filter in memory against the set of
  // order record IDs linked to this client.
  async getOpenNonAlterationsQuantity(orderIds) {
    this.logger.step(4, `Loading order_items for ${orderIds.length} linked order(s)`);
    const result = await this.table.selectRecordsAsync({
      fields: [FIELDS_ORDER_ITEMS.order, FIELDS_ORDER_ITEMS.quantity_open, FIELDS_ORDER_ITEMS.style_category],
    });
    const orderIdSet = new Set(orderIds);
    let totalItems = 0;
    let openQuantity = 0;
    for (const item of result.records) {
      const linkedOrders = item.getCellValue(FIELDS_ORDER_ITEMS.order) || [];
      const belongsToClient = linkedOrders.some(o => orderIdSet.has(o.id));
      if (!belongsToClient) continue;

      const category = item.getCellValueAsString(FIELDS_ORDER_ITEMS.style_category);
      if (category.includes(CONFIG.EXCLUDED_STYLE_CATEGORY)) continue; // alterations never block close-out

      totalItems++;
      openQuantity += item.getCellValue(FIELDS_ORDER_ITEMS.quantity_open) ?? 0;
    }
    this.logger.audit(`Non-alterations order_items found: ${totalItems} | total quantity_open: ${openQuantity}`);
    return { totalItems, openQuantity };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE-OUT EVALUATOR — pure logic, no Airtable calls
// ─────────────────────────────────────────────────────────────────────────────

class CloseOutEvaluator {
  constructor(logger) { this.logger = logger; }

  evaluate({ saOverride, fullOrderFulfilledFromAppt, pickedUpFromAppt, trackingNumber, percentShipped, openQuantity, totalItems }) {
    this.logger.step(5, 'Evaluating the four close-out paths');

    if (saOverride === true) {
      return { qualifies: true, path: 'sa_override' };
    }
    if (fullOrderFulfilledFromAppt === true && pickedUpFromAppt === true) {
      return { qualifies: true, path: 'appointment_pickup' };
    }
    if (trackingNumber && percentShipped === 1) {
      return { qualifies: true, path: 'tracking_shipped' };
    }
    // Only qualifies via quantity_open if the client actually has non-alterations
    // items to evaluate — an empty set should never look like "fully closed".
    if (totalItems > 0 && openQuantity === 0) {
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
  constructor(clientsRepo, orderItemsRepo, evaluator, logger) {
    this.clientsRepo = clientsRepo;
    this.orderItemsRepo = orderItemsRepo;
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

    const linkedOrders = client.getCellValue(FIELDS_CLIENTS.linked_orders) || [];
    const orderIds = linkedOrders.map(o => o.id);
    this.logger.step(2, `Client has ${orderIds.length} linked order(s)`);

    const { totalItems, openQuantity } = orderIds.length
      ? await this.orderItemsRepo.getOpenNonAlterationsQuantity(orderIds)
      : { totalItems: 0, openQuantity: 0 };

    this.logger.step(3, 'Reading client-level close-out signals');
    const saOverride = client.getCellValue(FIELDS_CLIENTS.sa_override_fulfilled) === true;
    const fullOrderFulfilledFromAppt = client.getCellValue(FIELDS_CLIENTS.full_order_fulfilled_from_appt) === true;
    const pickedUpFromAppt = client.getCellValue(FIELDS_CLIENTS.picked_up_from_appt) === true;
    const trackingNumber = client.getCellValueAsString(FIELDS_CLIENTS.tracking_number);
    const percentShipped = client.getCellValue(FIELDS_CLIENTS.percent_shipped);

    const { qualifies, path } = this.evaluator.evaluate({
      saOverride, fullOrderFulfilledFromAppt, pickedUpFromAppt, trackingNumber, percentShipped, openQuantity, totalItems,
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
    new OrderItemsRepository(logger),
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

/*
================================================================================
SCRIPT       : Order Ready Backfill (one-time, manual run)
BASE         : app6Q4xMZ1ngJxiV8 (sandbox) — publish to appUC2NFAlURayLx9 later
TABLE SRC    : Orders - Shopify (tblHFGbijtvZcRPkE)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : none — run manually once (button / ad hoc "Run script"),
               NOT a recurring automation.
VERSION      : 1.0.0

OBJECTIVE (spec from Axel, 2026-07-21)
  Walks every existing order and advances to "Order Ready" any client who
  already meets the rule but never received it (e.g. because the live
  "Order Ready Evaluation" automation didn't exist yet or didn't run when
  the order hit those conditions).

  For each order in Orders - Shopify:
    1. client_stage (lookup of the linked client) must NOT be any of:
       In Alterations, In Fulfillment, Picked Up, Shipped, Did Not Convert
       AND
    2. picked_status_percentage >= 75%  OR  gown_picked = TRUE

  If the order qualifies:
    - Resolves the linked client in DF Clients.
    - Updates DF Clients.stage to "Order Ready".

  DEDUPE: if several orders qualify for the SAME client, only the first
  occurrence of that client is processed (subsequent orders for the same
  client are counted but skipped, without re-writing).

  Note: unlike the live automation, this backfill uses >= 75% (not
  strictly > 75%) and excludes by stage name instead of comparing against
  STAGE_ORDER — that's how Axel specified it for this one-off run.

OUTPUT
  Prints a summary to the console (via Logger): orders scanned, orders that
  qualified, distinct clients updated, and the detail of each
  update/skip.
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  ORDERS:  'tblHFGbijtvZcRPkE', // Orders - Shopify
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients
};

const FIELDS_ORDERS = {
  client:                   'fldeVnAInz9d1jpY5', // multipleRecordLinks -> DF Clients
  client_stage:             'fldxhlu6v6EnpzZk1', // multipleLookupValues -> DF Clients.stage
  gown_picked:              'fldn0e6E4NjTPWlw0', // rollup (checkbox)
  picked_status_percentage: 'fldjC8M11Pis7eMxF', // formula, 0-1 fraction
};

const FIELDS_CLIENTS = {
  stage: 'fldLcxVZvI1rigBlh',
};

const CONFIG = {
  LOG_LEVEL: 'B',                  // A=minimal | B=audit (default) | C=debug
  PICK_PERCENT_THRESHOLD: 0.75,    // >= 75%, per this backfill's spec
  TARGET_STAGE: 'Order Ready',
  EXCLUDED_CLIENT_STAGES: ['In Alterations', 'In Fulfillment', 'Picked Up', 'Shipped', 'Did Not Convert'],
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
  getSummary() { return this.entries.join('\n'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORIES
// ─────────────────────────────────────────────────────────────────────────────

class OrdersRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.ORDERS); this.logger = logger; }

  async getAll() {
    this.logger.audit('Loading all Orders records…');
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_ORDERS) });
    this.logger.audit(`Loaded ${result.records.length} orders.`);
    return result.records;
  }
}

class ClientsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.CLIENTS); this.logger = logger; }

  async writeStage(clientId, stageName) {
    await this.table.updateRecordAsync(clientId, { [FIELDS_CLIENTS.stage]: { name: stageName } });
    this.logger.audit(`Stage written → "${stageName}" — client: ${clientId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUALIFICATION LOGIC — pure logic, no Airtable calls
// ─────────────────────────────────────────────────────────────────────────────

function getClientStageFromLookup(order) {
  const raw = order.getCellValue(FIELDS_ORDERS.client_stage); // array of strings, or null
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw[0];
}

function qualifies(order, logger) {
  const clientStage = getClientStageFromLookup(order);
  if (clientStage && CONFIG.EXCLUDED_CLIENT_STAGES.includes(clientStage)) {
    logger.debug(`Order ${order.id} — client_stage="${clientStage}" is excluded. SKIP.`);
    return false;
  }

  const gownPicked = order.getCellValue(FIELDS_ORDERS.gown_picked) === true;
  const percentPicked = order.getCellValue(FIELDS_ORDERS.picked_status_percentage) ?? 0;
  const meetsPickThreshold = percentPicked >= CONFIG.PICK_PERCENT_THRESHOLD;

  if (!gownPicked && !meetsPickThreshold) return false;

  logger.debug(`Order ${order.id} qualifies — client_stage="${clientStage}" gownPicked=${gownPicked} percentPicked=${(percentPicked * 100).toFixed(1)}%`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

const logger = new Logger(CONFIG.LOG_LEVEL);

let ordersScanned = 0;
let ordersQualified = 0;
let clientsUpdated = 0;
let clientsSkippedAsDuplicate = 0;
const processedClientIds = new Set();

try {
  const ordersRepo = new OrdersRepository(logger);
  const clientsRepo = new ClientsRepository(logger);

  const orders = await ordersRepo.getAll();
  ordersScanned = orders.length;

  for (const order of orders) {
    if (!qualifies(order, logger)) continue;
    ordersQualified++;

    const linkedClients = order.getCellValue(FIELDS_ORDERS.client) || [];
    if (!linkedClients.length) {
      logger.audit(`Order ${order.id} qualifies but has no linked client — SKIP.`);
      continue;
    }
    const clientId = linkedClients[0].id;

    // DEDUPE — only the first occurrence of this client is processed.
    if (processedClientIds.has(clientId)) {
      clientsSkippedAsDuplicate++;
      logger.debug(`Client ${clientId} was already processed by an earlier order — SKIP (duplicate).`);
      continue;
    }
    processedClientIds.add(clientId);

    await clientsRepo.writeStage(clientId, CONFIG.TARGET_STAGE);
    clientsUpdated++;
  }

  logger.minimal(
    `Backfill complete — orders scanned: ${ordersScanned} | orders qualified: ${ordersQualified} | ` +
    `distinct clients updated: ${clientsUpdated} | duplicate orders skipped: ${clientsSkippedAsDuplicate}`
  );

} catch (err) {
  logger.error(`Backfill failed → ${err.message}`);
  throw err;
}

output.set('orders_scanned',    ordersScanned);
output.set('orders_qualified',  ordersQualified);
output.set('clients_updated',   clientsUpdated);
output.set('duplicates_skipped', clientsSkippedAsDuplicate);
output.set('log_summary',       logger.getSummary());

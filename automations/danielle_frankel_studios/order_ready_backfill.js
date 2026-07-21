/*
================================================================================
SCRIPT       : Order Ready Backfill (one-time, manual run)
BASE         : app6Q4xMZ1ngJxiV8 (sandbox) — publicar a appUC2NFAlURayLx9 luego
TABLE SRC    : Orders - Shopify (tblHFGbijtvZcRPkE)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : ninguno — se corre manualmente una sola vez (botón / "Run script"
               ad hoc), NO es una automation recurrente.
VERSION      : 1.0.0

OBJECTIVE (spec de Axel, 2026-07-21)
  Recorre todos los orders existentes y adelanta a "Order Ready" a cualquier
  cliente que ya cumpla la regla pero no la haya recibido (p.ej. porque el
  automation en vivo "Order Ready Evaluation" no existía o no corrió cuando
  el order alcanzó esas condiciones).

  Para cada order en Orders - Shopify:
    1. client_stage (lookup del cliente vinculado) NO debe ser ninguno de:
       In Alterations, In Fulfillment, Picked Up, Shipped, Did Not Convert
       Y
    2. picked_status_percentage >= 75%  O  gown_picked = TRUE

  Si el order califica:
    - Resuelve el cliente vinculado en DF Clients.
    - Actualiza DF Clients.stage a "Order Ready".

  DEDUPE: si varios orders califican para el MISMO cliente, solo se procesa
  la primera vez que aparece ese cliente (orders subsecuentes del mismo
  cliente se cuentan pero se saltan, sin re-escribir).

  Nota: a diferencia del automation en vivo, este backfill usa >= 75% (no
  estrictamente > 75%) y excluye por nombre de stage en vez de comparar
  contra STAGE_ORDER — así lo especificó Axel para este run puntual.

OUTPUT
  Imprime en consola (via Logger) el resumen: orders escaneados, orders que
  calificaron, clientes distintos actualizados, y el detalle de cada
  actualización/omisión.
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
  PICK_PERCENT_THRESHOLD: 0.75,    // >= 75%, por spec de este backfill
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
// QUALIFICATION LOGIC — lógica pura, sin llamadas a Airtable
// ─────────────────────────────────────────────────────────────────────────────

function getClientStageFromLookup(order) {
  const raw = order.getCellValue(FIELDS_ORDERS.client_stage); // array of strings, or null
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw[0];
}

function qualifies(order, logger) {
  const clientStage = getClientStageFromLookup(order);
  if (clientStage && CONFIG.EXCLUDED_CLIENT_STAGES.includes(clientStage)) {
    logger.debug(`Order ${order.id} — client_stage="${clientStage}" está excluido. SKIP.`);
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

    // DEDUPE — solo se procesa la primera vez que aparece este cliente.
    if (processedClientIds.has(clientId)) {
      clientsSkippedAsDuplicate++;
      logger.debug(`Client ${clientId} ya fue procesado por un order anterior — SKIP (duplicado).`);
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

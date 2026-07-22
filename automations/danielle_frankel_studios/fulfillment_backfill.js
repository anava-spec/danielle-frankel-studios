/*
================================================================================
SCRIPT       : Fulfillment Backfill (one-time, manual run)
BASE         : app6Q4xMZ1ngJxiV8 (sandbox) — publicar a appUC2NFAlURayLx9 luego
TABLE SRC    : order_items (tblWOBS5nX0GZokaU), DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : ninguno — se corre manualmente una sola vez (botón / "Run script"
               ad hoc), NO es una automation recurrente.
VERSION      : 1.0.0

OBJECTIVE (per docs/AIRTABLE PHASE LOGIC.docx — "Fulfillment" row)
  Regla oficial de fase:
    "Clients who are in Order Ready and do not have Alterations as an
     order item."
  Esta es la misma regla que ya implementa la automation en vivo "No Alts/
  Order Ready - Update Phase to In Fulfillment" (wfl6hMhwI9gPuaNPX, DF Clients).
  Este backfill existe porque 22 de 27 clientes actualmente en "In Fulfillment"
  no tenían wedding_date/items_sold poblados cuando fulfillment.tsx los filtraba
  con un gate oculto no derivado de esta regla (ver hallazgo del 2026-07-22) —
  y porque, igual que con Order Ready, es posible que existan clientes que YA
  califican para "In Fulfillment" pero nunca recibieron el update porque la
  automation en vivo no existía o no corrió cuando el order alcanzó esas
  condiciones.

  Para cada cliente en DF Clients:
    1. stage actual == "Order Ready" (exactamente — no se toca ningún otro
       stage; nunca se retrocede ni se salta un stage).
       Y
    2. Ninguno de sus order_items (tabla order_items, vía Orders - Shopify)
       tiene style_category == "ALTERATIONS".

  Si el cliente califica:
    - Actualiza DF Clients.stage a "In Fulfillment".

  NOTA DE DISEÑO: a diferencia de order_ready_backfill.js (que evalúa por
  order), aquí evaluamos por CLIENTE — un cliente puede tener varios orders/
  order_items, y basta con que UNO de sus order_items sea categoría
  ALTERATIONS para excluirlo (coherente con la redacción de la regla: "do not
  have Alterations as an order item", no "no todos sus items son Alterations").

  DRY_RUN: por defecto TRUE — solo imprime qué se actualizaría, sin escribir.
  Revisar el log_summary, y si el resultado se ve correcto, cambiar
  CONFIG.DRY_RUN a false y correr de nuevo para aplicar los cambios.

OUTPUT
  Imprime en consola (via Logger) el resumen: clientes en Order Ready
  escaneados, cuántos calificaron, cuántos se actualizaron (o se hubieran
  actualizado en dry run), y el detalle de cada actualización/omisión.
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  CLIENTS:     'tblLLUlDgJ4ktzF7c', // DF Clients
  ORDER_ITEMS: 'tblWOBS5nX0GZokaU', // order_items
};

const FIELDS_CLIENTS = {
  stage: 'fldLcxVZvI1rigBlh',
};

const FIELDS_ORDER_ITEMS = {
  client_from_order: 'fldf5Ig74DKpAXwAQ', // multipleLookupValues -> DF Clients, via order.client
  style_category:    'fld6qGDLnQvtgarg5', // multipleLookupValues -> DF Styles.Category, via style
};

const CONFIG = {
  LOG_LEVEL:        'B',                // A=minimal | B=audit (default) | C=debug
  SOURCE_STAGE:     'Order Ready',
  TARGET_STAGE:     'In Fulfillment',
  EXCLUDED_CATEGORY: 'ALTERATIONS',
  DRY_RUN:          true,               // flip to false to actually write, after reviewing the dry-run log
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

class OrderItemsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.ORDER_ITEMS); this.logger = logger; }

  async getAll() {
    this.logger.audit('Loading all order_items records…');
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_ORDER_ITEMS) });
    this.logger.audit(`Loaded ${result.records.length} order_items.`);
    return result.records;
  }
}

class ClientsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.CLIENTS); this.logger = logger; }

  async getAll() {
    this.logger.audit('Loading all DF Clients records…');
    const result = await this.table.selectRecordsAsync({ fields: [FIELDS_CLIENTS.stage] });
    this.logger.audit(`Loaded ${result.records.length} clients.`);
    return result.records;
  }

  async writeStage(clientId, stageName) {
    await this.table.updateRecordAsync(clientId, { [FIELDS_CLIENTS.stage]: { name: stageName } });
    this.logger.audit(`Stage written → "${stageName}" — client: ${clientId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUALIFICATION LOGIC — lógica pura, sin llamadas a Airtable
// ─────────────────────────────────────────────────────────────────────────────

// Recorre order_items una sola vez y arma el set de client IDs que tienen
// al menos un item categoría ALTERATIONS — evita N llamadas por cliente.
function buildAlterationsClientIdSet(orderItems, logger) {
  const ids = new Set();
  for (const item of orderItems) {
    const categories = item.getCellValue(FIELDS_ORDER_ITEMS.style_category); // array of strings, or null
    const hasAlterations = Array.isArray(categories) && categories.includes(CONFIG.EXCLUDED_CATEGORY);
    if (!hasAlterations) continue;

    const linkedClients = item.getCellValue(FIELDS_ORDER_ITEMS.client_from_order) || [];
    for (const c of linkedClients) ids.add(c.id);
  }
  logger.audit(`${ids.size} distinct client(s) have at least one ALTERATIONS order item.`);
  return ids;
}

function qualifies(client, alterationsClientIds, logger) {
  const stage = client.getCellValueAsString(FIELDS_CLIENTS.stage);
  if (stage !== CONFIG.SOURCE_STAGE) return false;

  if (alterationsClientIds.has(client.id)) {
    logger.debug(`Client ${client.id} — has an ALTERATIONS order item. SKIP.`);
    return false;
  }

  logger.debug(`Client ${client.id} qualifies — stage="${stage}", no ALTERATIONS order item.`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

const logger = new Logger(CONFIG.LOG_LEVEL);

let clientsScanned = 0;
let clientsQualified = 0;
let clientsUpdated = 0;

try {
  const orderItemsRepo = new OrderItemsRepository(logger);
  const clientsRepo = new ClientsRepository(logger);

  const orderItems = await orderItemsRepo.getAll();
  const alterationsClientIds = buildAlterationsClientIdSet(orderItems, logger);

  const clients = await clientsRepo.getAll();

  const inOrderReady = clients.filter(c => c.getCellValueAsString(FIELDS_CLIENTS.stage) === CONFIG.SOURCE_STAGE);
  clientsScanned = inOrderReady.length;
  logger.audit(`${clientsScanned} client(s) currently in "${CONFIG.SOURCE_STAGE}".`);

  for (const client of inOrderReady) {
    if (!qualifies(client, alterationsClientIds, logger)) continue;
    clientsQualified++;

    if (CONFIG.DRY_RUN) {
      logger.audit(`[DRY RUN] Would write stage="${CONFIG.TARGET_STAGE}" — client: ${client.id}`);
    } else {
      await clientsRepo.writeStage(client.id, CONFIG.TARGET_STAGE);
    }
    clientsUpdated++;
  }

  logger.minimal(
    `Backfill ${CONFIG.DRY_RUN ? '(DRY RUN) ' : ''}complete — clients in "${CONFIG.SOURCE_STAGE}" scanned: ${clientsScanned} | ` +
    `qualified for "${CONFIG.TARGET_STAGE}": ${clientsQualified} | ` +
    `${CONFIG.DRY_RUN ? 'would update' : 'updated'}: ${clientsUpdated}`
  );

} catch (err) {
  logger.error(`Backfill failed → ${err.message}`);
  throw err;
}

output.set('dry_run',           CONFIG.DRY_RUN);
output.set('clients_scanned',   clientsScanned);
output.set('clients_qualified', clientsQualified);
output.set('clients_updated',   clientsUpdated);
output.set('log_summary',       logger.getSummary());

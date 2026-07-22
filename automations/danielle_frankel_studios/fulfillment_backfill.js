/*
================================================================================
SCRIPT       : Fulfillment Backfill (one-time, manual run)
BASE         : app6Q4xMZ1ngJxiV8 (sandbox) — publicar a appUC2NFAlURayLx9 luego
TABLE SRC    : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : ninguno — se corre manualmente una sola vez (botón / "Run script"
               ad hoc), NO es una automation recurrente.
VERSION      : 2.0.0 — reemplaza el join manual contra order_items (v1.0.0) por
               la condición real de la automation en vivo "No Alts/Order Ready
               - Update Phase to In Fulfillment" (wfl6hMhwI9gPuaNPX), confirmada
               por Axel el 2026-07-22:
                 stage = "Order Ready" AND "Alterations In House" = FALSE
               más el nuevo campo booleano fldWaqPw2BO4XQIbX (formula en DF
               Clients: TRUE si alguno de los Shopify Orders del cliente tiene
               un order_item categoría ALTERATIONS, vía rollup encadenado
               Shopify Order # -> Orders-Shopify -> order_items.style_category).
               Ya no hace falta leer order_items directamente — este campo lo
               resuelve a nivel de cliente. Axel validó con una filter view en
               Airtable que estas 3 condiciones dan 308 clientes.

OBJECTIVE
  Adelanta a "In Fulfillment" a cualquier cliente que ya cumpla la condición
  real de la automation en vivo pero no la haya recibido (p.ej. porque la
  automation no existía o no corrió cuando el cliente alcanzó esas
  condiciones — mismo motivo que order_ready_backfill.js).

  Para cada cliente en DF Clients:
    1. stage actual == "Order Ready" (exactamente — no se toca ningún otro
       stage; nunca se retrocede ni se salta un stage).
       Y
    2. "Alterations In House" (fldNjcDXIaGPGY1E6) == FALSE.
       Y
    3. fldWaqPw2BO4XQIbX (¿tiene un order item categoría ALTERATIONS?) == FALSE.

  Si el cliente califica:
    - Actualiza DF Clients.stage a "In Fulfillment".

  DRY_RUN: por defecto TRUE — solo imprime qué se actualizaría, sin escribir.
  Revisar el log_summary (debería reportar ~308 clientes calificando, según
  la filter view de Axel), y si el resultado se ve correcto, cambiar
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
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients
};

const FIELDS_CLIENTS = {
  stage:                  'fldLcxVZvI1rigBlh', // singleSelect
  alterations_in_house:   'fldNjcDXIaGPGY1E6', // checkbox
  has_alterations_item:   'fldWaqPw2BO4XQIbX', // formula (checkbox result) — TRUE si algún order item es ALTERATIONS
};

const CONFIG = {
  LOG_LEVEL:    'B',              // A=minimal | B=audit (default) | C=debug
  SOURCE_STAGE: 'Order Ready',
  TARGET_STAGE: 'In Fulfillment',
  DRY_RUN:      true,             // flip to false to actually write, after reviewing the dry-run log
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
// REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class ClientsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.CLIENTS); this.logger = logger; }

  async getAll() {
    this.logger.audit('Loading all DF Clients records…');
    const result = await this.table.selectRecordsAsync({ fields: Object.values(FIELDS_CLIENTS) });
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

function qualifies(client, logger) {
  const stage = client.getCellValueAsString(FIELDS_CLIENTS.stage);
  if (stage !== CONFIG.SOURCE_STAGE) return false;

  const alterationsInHouse = client.getCellValue(FIELDS_CLIENTS.alterations_in_house) === true;
  if (alterationsInHouse) {
    logger.debug(`Client ${client.id} — "Alterations In House" = TRUE. SKIP.`);
    return false;
  }

  const hasAlterationsItem = client.getCellValue(FIELDS_CLIENTS.has_alterations_item) === true;
  if (hasAlterationsItem) {
    logger.debug(`Client ${client.id} — has an ALTERATIONS order item. SKIP.`);
    return false;
  }

  logger.debug(`Client ${client.id} qualifies — stage="${stage}", no in-house alterations, no ALTERATIONS order item.`);
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
  const clientsRepo = new ClientsRepository(logger);
  const clients = await clientsRepo.getAll();

  const inOrderReady = clients.filter(c => c.getCellValueAsString(FIELDS_CLIENTS.stage) === CONFIG.SOURCE_STAGE);
  clientsScanned = inOrderReady.length;
  logger.audit(`${clientsScanned} client(s) currently in "${CONFIG.SOURCE_STAGE}".`);

  for (const client of inOrderReady) {
    if (!qualifies(client, logger)) continue;
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

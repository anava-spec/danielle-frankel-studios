/*
================================================================================
SCRIPT       : Fulfillment Backfill (one-time, manual run)
BASE         : app6Q4xMZ1ngJxiV8 (sandbox) — publish to appUC2NFAlURayLx9 later
TABLE SRC    : DF Clients (tblLLUlDgJ4ktzF7c)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : none — run manually once (button / ad hoc "Run script"),
               NOT a recurring automation.
VERSION      : 2.0.0 — replaces the manual join against order_items (v1.0.0)
               with the real condition from the live automation "No Alts/Order
               Ready - Update Phase to In Fulfillment" (wfl6hMhwI9gPuaNPX),
               confirmed by Axel on 2026-07-22:
                 stage = "Order Ready" AND "Alterations In House" = FALSE
               plus the new boolean field fldWaqPw2BO4XQIbX (formula on DF
               Clients: TRUE if any of the client's Shopify Orders has an
               order_item in category ALTERATIONS, via a chained rollup
               Shopify Order # -> Orders-Shopify -> order_items.style_category).
               No longer necessary to read order_items directly — this field
               resolves it at the client level. Axel validated with a filter
               view in Airtable that these 3 conditions yield 308 clients.

OBJECTIVE
  Advances to "In Fulfillment" any client who already meets the live
  automation's real condition but never received it (e.g. because the
  automation didn't exist yet or didn't run when the client hit those
  conditions — same reason as order_ready_backfill.js).

  For each client in DF Clients:
    1. current stage == "Order Ready" (exactly — no other stage is touched;
       never moves backward or skips a stage).
       AND
    2. "Alterations In House" (fldNjcDXIaGPGY1E6) == FALSE.
       AND
    3. fldWaqPw2BO4XQIbX (does it have an ALTERATIONS-category order item?) == FALSE.

  If the client qualifies:
    - Updates DF Clients.stage to "In Fulfillment".

  DRY_RUN: comes from input.config().dryRun (a script-step Input variable,
  not hardcoded) — defaults to TRUE if not passed. Review the log_summary
  (should report ~308 qualifying clients, per Axel's filter view), and if
  the result looks correct, run again passing dryRun=false in the Input
  variables panel to apply the changes.

OUTPUT
  Prints a summary to the console (via Logger): clients in Order Ready
  scanned, how many qualified, how many were updated (or would have been
  updated in dry run), and the detail of each update/skip.
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
  has_alterations_item:   'fldWaqPw2BO4XQIbX', // formula (checkbox result) — TRUE if any order item is ALTERATIONS
};

// input.config() is called once, global scope, before the try block —
// dryRun is an optional Input variable on the "Run script" step. Airtable
// passes Input variables as text (string "false"/"true"), not boolean, so
// it's compared as a string — String(undefined) = "undefined", so if the
// input isn't configured it falls back to the TRUE default (never writes
// by accident).
const cfg = input.config();

const CONFIG = {
  LOG_LEVEL:    'B',              // A=minimal | B=audit (default) | C=debug
  SOURCE_STAGE: 'Order Ready',
  TARGET_STAGE: 'In Fulfillment',
  DRY_RUN:      String(cfg.dryRun) !== 'false',  // pass dryRun=false explicitly to actually write
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
// QUALIFICATION LOGIC — pure logic, no Airtable calls
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

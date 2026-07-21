/*
================================================================================
AUTOMATION   : Order Ready Evaluation — Record Updated (Orders - Shopify)
BASE         : app6Q4xMZ1ngJxiV8 (sandbox) — publicar a appUC2NFAlURayLx9 luego
TABLE SRC    : Orders - Shopify (tblHFGbijtvZcRPkE)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : Record updated — Orders - Shopify, watching: picked_status_percentage,
               gown_picked
VERSION      : 1.1.0 — reemplaza la verificación de "gown parcialmente picked"
               (Category Lookup + picked_status_percentage > 0, a nivel de order
               completo) por el nuevo rollup gown_picked (fldn0e6E4NjTPWlw0),
               que ya resuelve correctamente "hay un item categoría GOWN en el
               order Y ese item específico está picked" a nivel de order_items.
               También renombra el stage destino de "In Production" a
               "Order Ready" (rename de choice hecho en Sandbox — publicar antes
               de desplegar este script).
               Campo Category Lookup (fldSF1GXY5MgiAXdl) ya no se usa — puede
               quedar en el trigger "watching" solo si Airtable lo requiere para
               no romper el trigger existente; de lo contrario, reemplazarlo por
               gown_picked ahí también.

OBJECTIVE
  Evalúa la regla de Julia para "Order Ready":
    (a) gown_picked = TRUE (rollup: al menos un item categoría GOWN del order
        está picked), O
    (b) picked_status_percentage del order es > 75%
  Si cualquiera se cumple Y el cliente NO está ya en o después de "Order Ready"
  en STAGE_ORDER, actualiza DF Clients.stage a "Order Ready". Nunca retrocede
  a un cliente que ya avanzó más allá.

  NOTA DE DISEÑO: la evaluación es POR ORDER (no agregada entre múltiples orders
  del cliente), ya que picked_status_percentage y gown_picked son fields a nivel
  de order, no un rollup a nivel de cliente. Si un cliente tiene varios orders,
  basta con que UNO califique para marcar Order Ready.

GUARD CLAUSE
  1. sourceRecordId (order) debe venir del trigger.
  2. El order debe tener un client vinculado. Si no, SKIP sin error.
  3. Si el cliente ya está en una fase igual o posterior a "Order Ready" en
     STAGE_ORDER, SKIP — esta automation solo AVANZA, nunca retrocede.
  4. Edge case: si gown_picked es null/undefined Y picked_status_percentage es
     null, SKIP — no hay datos suficientes para evaluar (evita false positive
     por datos faltantes/atrasados de Cobalt).

OUTPUTS (output.set)
  status            : "SUCCESS" | "ERROR"
  client_id         : record ID del cliente evaluado, o null
  gown_ready        : boolean — si califica por gown_picked
  percent_picked    : número 0–1 — picked_status_percentage del order
  qualifies         : boolean — resultado final de la regla Order Ready
  stage_written     : "Order Ready" | null (null si no se escribió)
  result_message    : resumen legible
  error_message     : null en éxito
  log_summary       : trace completo
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  ORDERS:  'tblHFGbijtvZcRPkE', // Orders - Shopify
  CLIENTS: 'tblLLUlDgJ4ktzF7c', // DF Clients
};

// Orders - Shopify fields — verificados contra customer_journey DBML
const FIELDS_ORDERS = {
  client:                   'fldeVnAInz9d1jpY5', // multipleRecordLinks -> DF Clients
  gown_picked:              'fldn0e6E4NjTPWlw0', // rollup (checkbox) — GOWN item picked, vía order_items
  picked_status_percentage: 'fldjC8M11Pis7eMxF', // formula, 0-1 fraction
};

// DF Clients fields
const FIELDS_CLIENTS = {
  stage: 'fldLcxVZvI1rigBlh', // confirmado en pipeline.tsx
};

// Mantenido en paralelo al STAGE_ORDER de las interfaces (pipeline.tsx /
// alterations.tsx) SOLO para no avanzar/retroceder incorrectamente. Ver
// hallazgo de duplicación en la auditoría de phase logic.
const STAGE_ORDER = [
  'Pre-Appointment',
  'Deliberating',
  'Sold',
  'Order Ready',   // antes "In Production"
  'In Alterations',
  'In Fulfillment',
];

const CONFIG = {
  LOG_LEVEL: 'B',                // A=minimal | B=audit (default) | C=debug
  PICK_PERCENT_THRESHOLD: 0.75,  // > 75% (estrictamente mayor, por Julia)
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
// ORDER READY EVALUATOR — lógica pura, sin llamadas a Airtable
// ─────────────────────────────────────────────────────────────────────────────

class OrderReadyEvaluator {
  constructor(logger) { this.logger = logger; }

  evaluate(order) {
    this.logger.step(4, 'Evaluando gown_picked y % picked del order');

    const gownPicked    = order.getCellValue(FIELDS_ORDERS.gown_picked);            // boolean (rollup checkbox), or null
    const percentPicked = order.getCellValue(FIELDS_ORDERS.picked_status_percentage);

    const hasData = (gownPicked !== null && gownPicked !== undefined) || (percentPicked !== null && percentPicked !== undefined);
    if (!hasData) {
      this.logger.audit('gown_picked y picked_status_percentage ambos null — datos insuficientes. SKIP.');
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
      ? `✅ ORDER READY → client ${clientId} califica. Stage escrito: ${stageWritten ?? '(sin cambio — ya estaba más adelante)'}`
      : `ℹ️ NO CALIFICA aún → client ${clientId} no cumple gown-picked ni >75%.`;
  }
  static skipped(reason) { return `⏭️ SKIPPED — ${reason}`; }
  static error(err) { return `❌ ORDER READY EVAL FAILED: ${err.message}`; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE — orquestador
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
        result_message: MessageBuilder.skipped('Order sin client vinculado.'),
      };
    }
    const clientId = linkedClients[0].id;
    this.logger.step(2, `Client resuelto → ${clientId}`);

    // GUARD 3 — nunca retroceder
    const clientRecord = await this.clientsRepo.getById(clientId);
    const currentStage = clientRecord.getCellValueAsString(FIELDS_CLIENTS.stage);
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const targetIdx = STAGE_ORDER.indexOf(CONFIG.TARGET_STAGE);
    if (currentIdx !== -1 && currentIdx >= targetIdx) {
      return {
        status: 'SUCCESS', client_id: clientId, gown_ready: false, percent_picked: 0,
        qualifies: false, stage_written: null,
        result_message: MessageBuilder.skipped(`client ya está en/después de "${CONFIG.TARGET_STAGE}" (stage actual: "${currentStage}"). No se retrocede.`),
      };
    }

    const { qualifies, gownReady, percentPicked, evaluable } = this.evaluator.evaluate(order);

    if (!evaluable) {
      return {
        status: 'SUCCESS', client_id: clientId, gown_ready: false, percent_picked: 0,
        qualifies: false, stage_written: null,
        result_message: MessageBuilder.skipped('Datos insuficientes (gown_picked y picked_status_percentage ambos null).'),
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
// input.config() llamado UNA vez, scope global, antes del try.
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

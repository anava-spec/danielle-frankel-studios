/*
================================================================================
AUTOMATION   : Deliberating Achieved - Consolidated
BASE         : appMmEE4zyHMGhkkd (sandbox) — publish to production after review
TABLE SRC    : DF Appointments - Acuity (tblvV7uKTCaFFekoR)
TABLE DEST   : DF Clients (tblLLUlDgJ4ktzF7c)
TRIGGER      : Record enters view "stage_auto_advance" (viwYWqT6ETnH5qkdP) on
               DF Appointments - Acuity — filter: Cleared = TRUE, OR
               (stage_auto_advance_ready = TRUE AND Status != Cancelled AND
               DF Clients.stage = Pre-Appointment). Automation:
               "Deliberating Achieved - Consolidated" (wflfSURIS1zTby6Zo,
               draft — script not yet pasted in).
VERSION      : 1.0.0 — consolidates two previously separate automations into
               one, per Axel's request (2026-08-20) to keep one automation per
               fact for maintainability, so a stage-formula failure only ever
               needs to be debugged in one place:
                 1. "NY Client Clears - Slack Message" (the customScript half
                    that wrote stage = Deliberating on Cleared = TRUE).
                 2. "Auto-Advance to Deliberating Backup" (recordEntersView on
                    a 1-hour-after-appointment-end fallback view, for when
                    staff forgot to check the client in as Cleared).
               Both conditions are now expressed as ONE view filter (built by
               hand in the Airtable UI — nested OR-of-AND groups aren't
               buildable via the Airtable MCP, same limitation hit during the
               order_close_out.js work). This script only needs to know "the
               trigger fired," not which of the two conditions matched.
               "NY Client Clears - Slack Message" keeps its Slack-notification
               step untouched — only the stage-writing half is replaced here.
               "Auto-Advance to Deliberating Backup" becomes redundant once
               this is live and should be deactivated (not deleted, per the
               stage-rework spec's "rework, do not delete" rule).

OBJECTIVE
  Writes DF Clients.deliberating_achieved = TRUE for the client linked to the
  triggering appointment. This is a fact for the stage formula to read, not a
  direct stage write — see stage_rework_handoff.md.

GUARD CLAUSE
  1. sourceRecordId (appointment) must come from the trigger.
  2. The appointment must have a linked client. If not, SKIP without error.
  3. If deliberating_achieved is already TRUE for that client, SKIP — this
     fact never resets to FALSE once set (per the stage-rework spec).

OUTPUTS (output.set)
  status          : "SUCCESS" | "ERROR"
  client_id       : record ID of the resolved client, or null
  already_true    : boolean — whether the fact was already TRUE (no-op)
  fact_written    : boolean — whether this run actually wrote TRUE
  result_message  : human-readable summary
  error_message   : null on success
  log_summary     : full trace
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  APPOINTMENTS: 'tblvV7uKTCaFFekoR', // DF Appointments - Acuity
  CLIENTS:      'tblLLUlDgJ4ktzF7c', // DF Clients
};

const FIELDS_APPOINTMENTS = {
  client: 'fldcVVGhEsnYRsbyR', // multipleRecordLinks -> DF Clients (confirmed against the "NY Client Clears" automation)
};

const FIELDS_CLIENTS = {
  deliberating_achieved: 'fldDsGeUzik9Nw9YP', // checkbox
};

const CONFIG = {
  LOG_LEVEL: 'B', // A=minimal | B=audit (default) | C=debug
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
// APPOINTMENTS REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class AppointmentsRepository {
  constructor(logger) { this.table = base.getTable(TABLE_IDS.APPOINTMENTS); this.logger = logger; }

  async getById(recordId) {
    this.logger.step(1, `Loading appointment → ${recordId}`);
    const result = await this.table.selectRecordsAsync({ fields: [FIELDS_APPOINTMENTS.client] });
    const record = result.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Appointment not found → recordId: ${recordId}`);
    this.logger.audit(`Appointment loaded → ${recordId}`);
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
    const result = await this.table.selectRecordsAsync({ fields: [FIELDS_CLIENTS.deliberating_achieved] });
    const record = result.records.find(r => r.id === clientId);
    if (!record) throw new Error(`Client not found → clientId: ${clientId}`);
    this.logger.audit(`Client loaded → ${clientId}`);
    return record;
  }

  async markDeliberatingAchieved(clientId) {
    this.logger.step(5, `Writing deliberating_achieved = TRUE → client: ${clientId}`);
    await this.table.updateRecordAsync(clientId, { [FIELDS_CLIENTS.deliberating_achieved]: true });
    this.logger.audit('deliberating_achieved written.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

class MessageBuilder {
  static success(clientId) { return `✅ deliberating_achieved set → client ${clientId}`; }
  static skipped(reason) { return `⏭️ SKIPPED — ${reason}`; }
  static error(err) { return `❌ DELIBERATING ACHIEVED FAILED: ${err.message}`; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE — orchestrator
// ─────────────────────────────────────────────────────────────────────────────

class DeliberatingAchievedService {
  constructor(appointmentsRepo, clientsRepo, logger) {
    this.appointmentsRepo = appointmentsRepo;
    this.clientsRepo = clientsRepo;
    this.logger = logger;
  }

  async run(appointmentId) {
    this.logger.audit(`Service started → appointment: ${appointmentId}`);

    const appointment = await this.appointmentsRepo.getById(appointmentId);

    const linkedClients = appointment.getCellValue(FIELDS_APPOINTMENTS.client) || [];
    if (!linkedClients.length) {
      return {
        status: 'SUCCESS', client_id: null, already_true: false, fact_written: false,
        result_message: MessageBuilder.skipped('appointment has no linked client.'),
      };
    }
    const clientId = linkedClients[0].id;
    this.logger.step(2, `Client resolved → ${clientId}`);

    const client = await this.clientsRepo.getById(clientId);

    // GUARD 3 — never reset to FALSE, and never re-write TRUE unnecessarily
    const alreadyTrue = client.getCellValue(FIELDS_CLIENTS.deliberating_achieved) === true;
    if (alreadyTrue) {
      this.logger.step(4, 'deliberating_achieved is already TRUE — no-op');
      return {
        status: 'SUCCESS', client_id: clientId, already_true: true, fact_written: false,
        result_message: MessageBuilder.skipped(`client ${clientId} already has deliberating_achieved = TRUE.`),
      };
    }

    await this.clientsRepo.markDeliberatingAchieved(clientId);

    return {
      status: 'SUCCESS', client_id: clientId, already_true: false, fact_written: true,
      result_message: MessageBuilder.success(clientId),
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
  status: 'ERROR', client_id: null, already_true: false, fact_written: false,
  result_message: null, error_message: null,
};

try {
  if (!triggerRecordId) throw new Error(
    'Missing required input: recordId. Ensure the trigger passes the appointment Record ID via the input variable "recordId".'
  );

  logger.audit(`Automation started → recordId: ${triggerRecordId}`);

  const service = new DeliberatingAchievedService(
    new AppointmentsRepository(logger),
    new ClientsRepository(logger),
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

output.set('status',         result.status);
output.set('client_id',      result.client_id);
output.set('already_true',   result.already_true);
output.set('fact_written',   result.fact_written);
output.set('result_message', result.result_message);
output.set('error_message',  result.error_message);
output.set('log_summary',    result.log_summary);

logger.audit(`Script complete → status: ${result.status} | fact_written: ${result.fact_written}`);

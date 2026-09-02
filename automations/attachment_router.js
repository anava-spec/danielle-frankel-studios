/*
================================================================================
AUTOMATION : Copy Attachment → DF Clients / Proposals — Record Created
BASE       : app6Q4xMZ1ngJxiV8 (sandbox — see note below)
TABLE SRC  : Attachments  (tbli57E9YzWb5Qmku)
TABLE DST  : DF_Clients   (tblLLUlDgJ4ktzF7c)  — Measurements / Appointment Photos
             proposals    (tblP7tVuCuXMzI4ir)  — Customization Proposal / Signed Proposal
             DF Appointments - Acuity (tblvV7uKTCaFFekoR) — Recap Doc
TRIGGER    : When record is created in Attachments
VERSION    : 1.3.0 — added Recap Doc routing on top of the existing
                     Measurements / Appointment Photos / Customization
                     Proposal / Signed Proposal flows. attachments.appointment
                     links directly to DF Appointments - Acuity, so the
                     appointment is fetched by ID directly — no search/
                     matching needed. Writes recap_doc + flips
                     recap_stage_completed to true only once the file is
                     safely linked. Idempotent: if recap_doc is already set on
                     the target appointment, the incoming staging record is
                     discarded without overwriting anything (the UI already
                     hides the upload entry point once recap_doc is non-empty,
                     this is a defensive backstop, not the primary guard).

VERSION    : 1.2.0 — added Customization Proposal / Signed Proposal routing on
                     top of the existing Measurements / Appointment Photos
                     flow. attachments.customization_proposal links directly
                     to the Proposals table (not via Customizations), so a
                     Proposal is fetched by ID directly — no search/matching
                     needed. All field IDs verified against live base + the
                     customer_journey DBML schema export.

NOTE ON BASE: this automation must live on the SANDBOX base, because the
Recap interface (Generate Proposal / Upload Signed Document) still runs
against sandbox — the Proposals records this needs to update only exist
there. Recreate on production, pointing at the production Proposals table,
once that interface is published.

OBJECTIVE
  When a new record is created in the Attachments table (via the "Add
  Attachment" interface form), this automation reads the uploaded files and
  the selected type, then routes them to one of two destinations depending
  on that type:

    "Measurements" / "Appointment Photos"
      → APPENDS the files to the corresponding attachment field on the
        linked DF_Clients record. Existing attachments are never replaced.

    "Customization Proposal" / "Signed Proposal"
      → WRITES the files onto the Proposals record linked directly via
        customization_proposal, into unsigned_document or signed_document
        respectively. A signed copy can only ever be attached to a Proposal
        that already has its unsigned copy — see guard clause 4.

  Either way, the staging Attachments record is deleted once its files have
  been safely copied onto the real destination — it was only a transit
  vehicle for the upload, never permanent storage.

GUARD CLAUSE
  Enforced in script _validate() AND recommended upstream in a Condition node:
  1. type field must be set and recognised — one of the four values below
  2. attachments field must not be empty — nothing to copy if no files uploaded
  3. (Measurements / Appointment Photos) client field must not be empty
  4. (Customization Proposal / Signed Proposal) customization_proposal must
     not be empty and must point at a Proposal that exists, AND that Proposal
     must be at the right stage:
       - Customization Proposal → no restriction (unsigned_document is set/
                                   overwritten regardless of current value)
       - Signed Proposal        → the Proposal must already have
                                   unsigned_document set
  5. (Recap Doc) appointment must not be empty. If the linked Appointment's
     recap_doc is already set, the incoming file(s) are silently discarded
     (not appended, not overwritten) — this is a defensive backstop, since
     the UI's "Add Recap Doc" entry point already only appears while
     recap_doc is empty.

FIELD MAPPING
  type = "Measurements"        → DF_Clients.Measurements       (fldcWwbKOc9nkgzzV)
  type = "Appointment Photos"  → DF_Clients.Appointment_Photos (fldWti8XzHbnGcjz9)
  type = "Customization Proposal" → proposals.unsigned_document (fldlUFhODjgDyeOFg)
  type = "Signed Proposal"        → proposals.signed_document + status=Signed
  type = "Recap Doc"              → DF Appointments.recap_doc (fldNlAu1xqmTEtNZI) +
                                     recap_stage_completed=true (fldJmciXBeZjMCXY1)

ATTACHMENT COPY NOTE
  Attachments are copied as { url } only (no filename) — the same shape this
  script has always used for the DF_Clients route, kept consistent for the
  Proposals route too. An attachment already stored on an Airtable record
  has a real https url (Airtable's own CDN) that Airtable can re-fetch when
  writing it into another field — this is the standard way automation
  scripts move attachments between tables.

ERROR HANDLING
  Errors thrown with descriptive messages. Catch block re-throws so Airtable
  marks the automation run as FAILED and sends the native email notification.

OUTPUTS (output.set)
  status         : "SUCCESS" | "ERROR"
  client_id      : record ID of the updated client, or null (proposal route)
  proposal_id    : record ID of the updated proposal, or null (client route)
  files_appended : number of new files written
  error_message  : null on success
  log_summary    : full Logger output (B-level step trace)

NODE SETUP
  Node 1 — Trigger: When record is created → Attachments table
  Node 2 — Condition (upstream guard — optional but recommended):
             type is not empty
             attachments is not empty
  Node 3 — Run a Script
             Input variable: recordId → Record ID (trigger)
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  ATTACHMENTS  : 'tbli57E9YzWb5Qmku',
  CLIENTS      : 'tblLLUlDgJ4ktzF7c',
  PROPOSALS    : 'tblP7tVuCuXMzI4ir',
  APPOINTMENTS : 'tblvV7uKTCaFFekoR',
};

// Attachments table fields (tbli57E9YzWb5Qmku)
const FIELDS_ATTACHMENTS = {
  client               : 'fldTESnHcalw4JlbA', // multipleRecordLinks → DF_Clients
  type                 : 'fld39kLMqKEZucDXe', // singleSelect
  attachments          : 'fldBgFSXBWHlejuEK', // multipleAttachments
  customization_proposal: 'fldp6Cq7466RvRgij', // multipleRecordLinks → proposals (direct)
  appointment          : 'fld7PBB03aN6B305F', // multipleRecordLinks → DF Appointments - Acuity (direct)
};

// Target field on DF_Clients per type value (type option name → field ID)
const CLIENTS_TARGET_FIELD = {
  'Measurements'       : 'fldcWwbKOc9nkgzzV', // multipleAttachments
  'Appointment Photos' : 'fldWti8XzHbnGcjz9', // multipleAttachments
};

// Proposals table fields (tblP7tVuCuXMzI4ir)
const FIELDS_PROPOSALS = {
  unsigned_document    : 'fldlUFhODjgDyeOFg', // multipleAttachments
  signed_document      : 'fld1Z37faYGD7jDia', // multipleAttachments
  status               : 'fldW0GbVWnhZGUAtv', // singleSelect: Generated | Signed
};

// DF Appointments - Acuity fields (tblvV7uKTCaFFekoR)
const FIELDS_APPOINTMENTS = {
  recap_doc              : 'fldNlAu1xqmTEtNZI', // multipleAttachments
  recap_stage_completed   : 'fldJmciXBeZjMCXY1', // checkbox
};

const CLIENT_TYPES      = new Set(['Measurements', 'Appointment Photos']);
const PROPOSAL_TYPES    = new Set(['Customization Proposal', 'Signed Proposal']);
const APPOINTMENT_TYPES = new Set(['Recap Doc']);

const CONFIG = {
  LOG_LEVEL : 'B', // A=minimal | B=audit (default) | C=debug
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER CLASS
// Levels: A=minimal (errors + final result only)
//         B=audit   (default — step-by-step trace)
//         C=debug   (verbose — payload details)
// ─────────────────────────────────────────────────────────────────────────────

class Logger {
  constructor(level = 'B') {
    this.level   = level;
    this.entries = [];
    this._levels = { A: 1, B: 2, C: 3 };
  }
  _log(lvl, msg) {
    if (this._levels[this.level] >= this._levels[lvl]) {
      const e = `[${lvl}][${new Date().toISOString()}] ${msg}`;
      this.entries.push(e);
      console.log(e);
    }
  }
  minimal(msg) { this._log('A', msg); }
  audit(msg)   { this._log('B', msg); }
  debug(msg)   { this._log('C', msg); }
  error(msg)   {
    const e = `[ERR][${new Date().toISOString()}] ${msg}`;
    this.entries.push(e);
    console.error(e);
  }
  step(n, msg) { this._log('B', `── STEP ${n}: ${msg}`); }
  getSummary() { return this.entries.join('\n'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENTS REPOSITORY CLASS
// Read-only access to the Attachments table (the trigger record) + delete
// once its files are safely copied to the real destination.
// ─────────────────────────────────────────────────────────────────────────────

class AttachmentsRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.ATTACHMENTS);
    this.logger = logger;
  }

  async getById(recordId) {
    this.logger.step(1, `Loading Attachments record → ${recordId}`);
    const result = await this.table.selectRecordsAsync({
      fields: Object.values(FIELDS_ATTACHMENTS),
    });
    const record = result.records.find(r => r.id === recordId);
    if (!record) throw new Error(
      `Attachments record not found → recordId: ${recordId}`
    );
    this.logger.audit(`Attachments record loaded → ${recordId}`);
    return record;
  }

  async deleteRecord(recordId) {
    this.logger.step(6, `Deleting staging record → ${recordId}`);
    await this.table.deleteRecordAsync(recordId);
    this.logger.audit(`Staging record deleted → ${recordId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS REPOSITORY CLASS
// Read and write access to the DF_Clients table (Measurements / Appointment
// Photos route).
// ─────────────────────────────────────────────────────────────────────────────

class ClientsRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.CLIENTS);
    this.logger = logger;
  }

  async getById(clientId, targetFieldId) {
    this.logger.step(3, `Loading Client record → ${clientId}`);
    const result = await this.table.selectRecordsAsync({
      fields: [targetFieldId],
    });
    const record = result.records.find(r => r.id === clientId);
    if (!record) throw new Error(
      `Client record not found → clientId: ${clientId}`
    );
    this.logger.audit(`Client record loaded → ${clientId}`);
    return record;
  }

  async appendAttachments(clientId, targetFieldId, existingAttachments, newAttachments) {
    this.logger.step(5, `Appending ${newAttachments.length} file(s) → field: ${targetFieldId} | client: ${clientId}`);

    // Pass only { url } — the only property accepted by Airtable for both
    // existing and new entries when writing to a multipleAttachments field.
    const existingMapped = (existingAttachments ?? []).map(a => ({ url: a.url }));
    const newMapped      = newAttachments.map(a => ({ url: a.url }));
    const combined       = [...existingMapped, ...newMapped];

    this.logger.debug(`Existing: ${existingMapped.length} | New: ${newMapped.length} | Total: ${combined.length}`);

    await this.table.updateRecordAsync(clientId, {
      [targetFieldId]: combined,
    });

    this.logger.audit(`Attachments written → total in field: ${combined.length}`);
    return combined.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSALS REPOSITORY CLASS
// Read and write access to the proposals table (Customization Proposal /
// Signed Proposal route). attachments.customization_proposal links directly
// to the target Proposal record — no search/matching needed, just a fetch by
// ID (same pattern as ClientsRepository.getById).
// ─────────────────────────────────────────────────────────────────────────────

class ProposalsRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.PROPOSALS);
    this.logger = logger;
  }

  async getById(proposalId) {
    this.logger.step(3, `Loading Proposal record → ${proposalId}`);
    const result = await this.table.selectRecordsAsync({
      fields: [FIELDS_PROPOSALS.unsigned_document, FIELDS_PROPOSALS.signed_document],
    });
    const record = result.records.find(r => r.id === proposalId);
    if (!record) throw new Error(
      `Proposal record not found → proposalId: ${proposalId}`
    );
    this.logger.audit(`Proposal record loaded → ${proposalId}`);
    return record;
  }

  async writeUnsignedDocument(proposalId, attachments) {
    this.logger.step(5, `Writing unsigned_document → proposal: ${proposalId} | files: ${attachments.length}`);
    const mapped = attachments.map(a => ({ url: a.url }));
    await this.table.updateRecordAsync(proposalId, {
      [FIELDS_PROPOSALS.unsigned_document]: mapped,
    });
    this.logger.audit(`unsigned_document written → ${mapped.length} file(s)`);
  }

  async writeSignedDocument(proposalId, attachments) {
    this.logger.step(5, `Writing signed_document + status=Signed → proposal: ${proposalId} | files: ${attachments.length}`);
    const mapped = attachments.map(a => ({ url: a.url }));
    await this.table.updateRecordAsync(proposalId, {
      [FIELDS_PROPOSALS.signed_document]: mapped,
      [FIELDS_PROPOSALS.status]: { name: 'Signed' },
    });
    this.logger.audit(`signed_document + status written → ${mapped.length} file(s)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENTS REPOSITORY CLASS
// Read and write access to DF Appointments - Acuity (Recap Doc route).
// attachments.appointment links directly to the target Appointment record —
// no search/matching needed, same pattern as ProposalsRepository.getById.
// ─────────────────────────────────────────────────────────────────────────────

class AppointmentsRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.APPOINTMENTS);
    this.logger = logger;
  }

  async getById(appointmentId) {
    this.logger.step(3, `Loading Appointment record → ${appointmentId}`);
    const result = await this.table.selectRecordsAsync({
      fields: [FIELDS_APPOINTMENTS.recap_doc, FIELDS_APPOINTMENTS.recap_stage_completed],
    });
    const record = result.records.find(r => r.id === appointmentId);
    if (!record) throw new Error(
      `Appointment record not found → appointmentId: ${appointmentId}`
    );
    this.logger.audit(`Appointment record loaded → ${appointmentId}`);
    return record;
  }

  async writeRecapDoc(appointmentId, attachments) {
    this.logger.step(5, `Writing recap_doc + recap_stage_completed=true → appointment: ${appointmentId} | files: ${attachments.length}`);
    const mapped = attachments.map(a => ({ url: a.url }));
    await this.table.updateRecordAsync(appointmentId, {
      [FIELDS_APPOINTMENTS.recap_doc]: mapped,
      [FIELDS_APPOINTMENTS.recap_stage_completed]: true,
    });
    this.logger.audit(`recap_doc + recap_stage_completed written → ${mapped.length} file(s)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENT PROPAGATION SERVICE
// Orchestrates all steps: load → validate/route → write to the right
// destination → delete the staging record.
// ─────────────────────────────────────────────────────────────────────────────

class AttachmentPropagationService {
  constructor(attachmentsRepo, clientsRepo, proposalsRepo, appointmentsRepo, logger) {
    this.attachmentsRepo  = attachmentsRepo;
    this.clientsRepo      = clientsRepo;
    this.proposalsRepo    = proposalsRepo;
    this.appointmentsRepo = appointmentsRepo;
    this.logger           = logger;
  }

  _validate(record) {
    this.logger.step(2, 'Running guard clause validation');

    const typeCell = record.getCellValue(FIELDS_ATTACHMENTS.type);
    const typeName = typeCell?.name ?? null;
    if (!typeName) throw new Error(
      'Guard clause: type field is not selected. Must be one of: Measurements, ' +
      'Appointment Photos, Customization Proposal, Signed Proposal.'
    );

    const attachments = record.getCellValue(FIELDS_ATTACHMENTS.attachments);
    if (!attachments || attachments.length === 0) throw new Error(
      'Guard clause: attachments field is empty. Nothing to propagate.'
    );

    if (CLIENT_TYPES.has(typeName)) {
      const linkedClients = record.getCellValue(FIELDS_ATTACHMENTS.client);
      if (!linkedClients || linkedClients.length === 0) throw new Error(
        'Guard clause: client field is empty. Cannot propagate without a linked client.'
      );
      const targetFieldId = CLIENTS_TARGET_FIELD[typeName];
      this.logger.audit(
        `Guard passed (client route) → client: ${linkedClients[0].id} | type: ${typeName} | files: ${attachments.length}`
      );
      return { route: 'client', clientId: linkedClients[0].id, typeName, targetFieldId, newAttachments: attachments };
    }

    if (PROPOSAL_TYPES.has(typeName)) {
      const linkedProposal = record.getCellValue(FIELDS_ATTACHMENTS.customization_proposal);
      if (!linkedProposal || linkedProposal.length === 0) throw new Error(
        'Guard clause: customization_proposal field is empty. Cannot find the Proposal to attach to.'
      );
      this.logger.audit(
        `Guard passed (proposal route) → proposal: ${linkedProposal[0].id} | type: ${typeName} | files: ${attachments.length}`
      );
      return { route: 'proposal', proposalId: linkedProposal[0].id, typeName, newAttachments: attachments };
    }

    if (APPOINTMENT_TYPES.has(typeName)) {
      const linkedAppointment = record.getCellValue(FIELDS_ATTACHMENTS.appointment);
      if (!linkedAppointment || linkedAppointment.length === 0) throw new Error(
        'Guard clause: appointment field is empty. Cannot find the Appointment to attach the Recap Doc to.'
      );
      this.logger.audit(
        `Guard passed (appointment route) → appointment: ${linkedAppointment[0].id} | type: ${typeName} | files: ${attachments.length}`
      );
      return { route: 'appointment', appointmentId: linkedAppointment[0].id, typeName, newAttachments: attachments };
    }

    throw new Error(
      `Guard clause: unknown type value "${typeName}". Expected one of: Measurements, ` +
      `Appointment Photos, Customization Proposal, Signed Proposal, Recap Doc.`
    );
  }

  async _runClientRoute({ clientId, typeName, targetFieldId, newAttachments }) {
    const clientRecord = await this.clientsRepo.getById(clientId, targetFieldId);
    this.logger.step(4, `Reading existing attachments from field: ${targetFieldId}`);
    const existingAttachments = clientRecord.getCellValue(targetFieldId);
    this.logger.audit(`Existing count: ${existingAttachments?.length ?? 0}`);
    const totalFiles = await this.clientsRepo.appendAttachments(
      clientId, targetFieldId, existingAttachments, newAttachments
    );
    return { client_id: clientId, proposal_id: null, type: typeName, files_appended: newAttachments.length, total_files: totalFiles };
  }

  async _runProposalRoute({ proposalId, typeName, newAttachments }) {
    const proposalRecord = await this.proposalsRepo.getById(proposalId);
    const isSigned = typeName === 'Signed Proposal';

    if (isSigned) {
      const existingUnsigned = proposalRecord.getCellValue(FIELDS_PROPOSALS.unsigned_document);
      const hasUnsigned = !!existingUnsigned && existingUnsigned.length > 0;
      if (!hasUnsigned) throw new Error(
        `Guard clause: Proposal ${proposalId} does not have unsigned_document yet — a signed copy ` +
        `cannot be attached before the unsigned one exists.`
      );
      await this.proposalsRepo.writeSignedDocument(proposalId, newAttachments);
    } else {
      await this.proposalsRepo.writeUnsignedDocument(proposalId, newAttachments);
    }

    return { client_id: null, proposal_id: proposalId, type: typeName, files_appended: newAttachments.length, total_files: newAttachments.length };
  }

  // Idempotent by design: the "Add Recap Doc" entry point in the UI only
  // ever appears while recap_doc is empty, so a duplicate submission should
  // not normally reach here. This is a defensive backstop — if recap_doc is
  // already set, the incoming file(s) are discarded (not appended, not
  // overwritten) and the staging record is still deleted like any other
  // successful run, since nothing here is actually an error condition.
  async _runAppointmentRoute({ appointmentId, typeName, newAttachments }) {
    const appointmentRecord = await this.appointmentsRepo.getById(appointmentId);
    const existingRecapDoc = appointmentRecord.getCellValue(FIELDS_APPOINTMENTS.recap_doc);
    const alreadyHasRecapDoc = !!existingRecapDoc && existingRecapDoc.length > 0;

    if (alreadyHasRecapDoc) {
      this.logger.audit(
        `Skip write (duplicate guard) → appointment ${appointmentId} already has a Recap Doc. Discarding incoming file(s), no changes made.`
      );
      return { client_id: null, proposal_id: null, appointment_id: appointmentId, type: typeName, files_appended: 0, total_files: existingRecapDoc.length, skipped: true };
    }

    await this.appointmentsRepo.writeRecapDoc(appointmentId, newAttachments);
    return { client_id: null, proposal_id: null, appointment_id: appointmentId, type: typeName, files_appended: newAttachments.length, total_files: newAttachments.length, skipped: false };
  }

  async run(attachmentsRecordId) {
    this.logger.audit(`Service started → record: ${attachmentsRecordId}`);

    // Step 1 — Load the Attachments record
    const attachmentsRecord = await this.attachmentsRepo.getById(attachmentsRecordId);

    // Step 2 — Validate guard clauses and pick a route
    const validated = this._validate(attachmentsRecord);

    // Steps 3-5 — Load destination, read existing (client/appointment routes), write
    let outcome;
    if (validated.route === 'client') {
      outcome = await this._runClientRoute(validated);
    } else if (validated.route === 'proposal') {
      outcome = await this._runProposalRoute(validated);
    } else {
      outcome = await this._runAppointmentRoute(validated);
    }

    // Step 6 — Delete the staging record from the Attachments table. It was
    // only a transit vehicle for the uploaded files; once they're safely
    // written to the real destination (or discarded by the duplicate guard)
    // it is no longer needed.
    await this.attachmentsRepo.deleteRecord(attachmentsRecordId);

    this.logger.minimal(
      `SUCCESS → route: ${validated.route} | client: ${outcome.client_id ?? '—'} | proposal: ${outcome.proposal_id ?? '—'} | ` +
      `appointment: ${outcome.appointment_id ?? '—'} | type: ${outcome.type} | appended: ${outcome.files_appended} | ` +
      `skipped: ${!!outcome.skipped} | staging record deleted`
    );

    return {
      status         : 'SUCCESS',
      client_id      : outcome.client_id,
      proposal_id    : outcome.proposal_id,
      appointment_id : outcome.appointment_id ?? null,
      files_appended : outcome.files_appended,
      error_message  : null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE — global scope, before the try block.
// Variables declared before try so the catch block has access to them.
// ─────────────────────────────────────────────────────────────────────────────

// !! input.config() MUST be here — NEVER inside the try block !!
const cfg                 = input.config();
const attachmentsRecordId = cfg.recordId;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = {
  status         : 'ERROR',
  client_id      : null,
  proposal_id    : null,
  appointment_id : null,
  files_appended : 0,
  error_message  : null,
};

try {
  if (!attachmentsRecordId) throw new Error(
    'Missing required input: recordId. ' +
    'Ensure the trigger passes the Attachments record ID via input.config().'
  );

  logger.audit(`Automation started → recordId: ${attachmentsRecordId}`);

  const service = new AttachmentPropagationService(
    new AttachmentsRepository(logger),
    new ClientsRepository(logger),
    new ProposalsRepository(logger),
    new AppointmentsRepository(logger),
    logger
  );

  result = await service.run(attachmentsRecordId);

} catch (err) {
  logger.error(`Automation failed → ${err.message}`);
  result.error_message = err.message;

  // !! CRITICAL — re-throw so Airtable marks the automation run as FAILED !!
  // output.set() alone does NOT fail the automation — Airtable only marks a run
  // as failed when the script exits with an uncaught error. Without this throw,
  // the automation shows "Ran successfully" even when status = ERROR.
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS — Only reached on SUCCESS (catch block re-throws on error)
// ─────────────────────────────────────────────────────────────────────────────

output.set('status',         result.status);
output.set('client_id',      result.client_id);
output.set('proposal_id',    result.proposal_id);
output.set('appointment_id', result.appointment_id);
output.set('files_appended', result.files_appended);
output.set('error_message',  result.error_message);
output.set('log_summary',    logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | files appended: ${result.files_appended}`);

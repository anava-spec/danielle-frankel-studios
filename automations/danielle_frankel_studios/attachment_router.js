/*
================================================================================
AUTOMATION : Copy Attachment → DF Clients / Proposals — Record Created
BASE       : app6Q4xMZ1ngJxiV8 (sandbox — see note below)
TABLE SRC  : Attachments  (tbli57E9YzWb5Qmku)
TABLE DST  : DF_Clients   (tblLLUlDgJ4ktzF7c)  — Measurements / Appointment Photos
             proposals    (tblP7tVuCuXMzI4ir)  — Customization Proposal / Signed Proposal
TRIGGER    : When record is created in Attachments
VERSION    : 1.1.0 — added Customization Proposal / Signed Proposal routing on
                     top of the existing Measurements / Appointment Photos
                     flow. All field IDs verified against live base + the
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
      → WRITES the files onto the matching Proposals record (found via
        customization_request), into unsigned_document or signed_document
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
  4. (Customization Proposal / Signed Proposal) customization_request must
     not be empty, AND a matching Proposal must exist at the right stage:
       - Customization Proposal → a Proposal still missing unsigned_document
       - Signed Proposal        → a Proposal with unsigned_document already
                                   set and signed_document still empty

FIELD MAPPING
  type = "Measurements"        → DF_Clients.Measurements       (fldcWwbKOc9nkgzzV)
  type = "Appointment Photos"  → DF_Clients.Appointment_Photos (fldWti8XzHbnGcjz9)
  type = "Customization Proposal" → proposals.unsigned_document (fldlUFhODjgDyeOFg)
  type = "Signed Proposal"        → proposals.signed_document + status=Signed

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
  ATTACHMENTS : 'tbli57E9YzWb5Qmku',
  CLIENTS     : 'tblLLUlDgJ4ktzF7c',
  PROPOSALS   : 'tblP7tVuCuXMzI4ir',
};

// Attachments table fields (tbli57E9YzWb5Qmku)
const FIELDS_ATTACHMENTS = {
  client               : 'fldTESnHcalw4JlbA', // multipleRecordLinks → DF_Clients
  type                 : 'fld39kLMqKEZucDXe', // singleSelect
  attachments          : 'fldBgFSXBWHlejuEK', // multipleAttachments
  customization_request: 'fld5GbTtosSjljhAz', // multipleRecordLinks → Customizations
};

// Target field on DF_Clients per type value (type option name → field ID)
const CLIENTS_TARGET_FIELD = {
  'Measurements'       : 'fldcWwbKOc9nkgzzV', // multipleAttachments
  'Appointment Photos' : 'fldWti8XzHbnGcjz9', // multipleAttachments
};

// Proposals table fields (tblP7tVuCuXMzI4ir)
const FIELDS_PROPOSALS = {
  source_customization : 'fldeXnhSr8r6rw78k', // multipleRecordLinks → Customizations
  unsigned_document    : 'fldlUFhODjgDyeOFg', // multipleAttachments
  signed_document      : 'fld1Z37faYGD7jDia', // multipleAttachments
  status               : 'fldW0GbVWnhZGUAtv', // singleSelect: Generated | Signed
};

const CLIENT_TYPES   = new Set(['Measurements', 'Appointment Photos']);
const PROPOSAL_TYPES = new Set(['Customization Proposal', 'Signed Proposal']);

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
// Signed Proposal route). A Proposal is matched by source_customization, not
// by ID directly — the Attachments record only carries the Customization,
// since the Proposal it belongs to may not have existed yet when the
// interface first sent the user to this form.
// ─────────────────────────────────────────────────────────────────────────────

class ProposalsRepository {
  constructor(logger) {
    this.table  = base.getTable(TABLE_IDS.PROPOSALS);
    this.logger = logger;
  }

  async _matchesForCustomization(customizationId, extraFields) {
    const result = await this.table.selectRecordsAsync({
      fields: [FIELDS_PROPOSALS.source_customization, ...extraFields],
    });
    return result.records.filter(r => {
      const link = r.getCellValue(FIELDS_PROPOSALS.source_customization);
      return Array.isArray(link) && link.some(l => l.id === customizationId);
    });
  }

  // Multiple Proposals can exist for the same Customization over time (a
  // proposal can be regenerated) — the correct target is the most recently
  // created one still missing unsigned_document. selectRecordsAsync returns
  // records in creation order, so the last match is the most recent.
  async findPendingUnsigned(customizationId) {
    this.logger.step(3, `Searching Proposals for pending unsigned → customization: ${customizationId}`);
    const matches = (await this._matchesForCustomization(customizationId, [FIELDS_PROPOSALS.unsigned_document]))
      .filter(r => {
        const existing = r.getCellValue(FIELDS_PROPOSALS.unsigned_document);
        return !existing || existing.length === 0;
      });
    const record = matches.length ? matches[matches.length - 1] : null;
    if (!record) throw new Error(
      `Guard clause: no pending Proposal found for customization ${customizationId} ` +
      `(either none exists, or all matching Proposals already have unsigned_document set).`
    );
    this.logger.audit(`Matched pending-unsigned Proposal → ${record.id}`);
    return record;
  }

  // A signed copy can only ever belong to a Proposal that already has its
  // unsigned_document and doesn't have a signed_document yet.
  async findPendingSigned(customizationId) {
    this.logger.step(3, `Searching Proposals for pending signed → customization: ${customizationId}`);
    const matches = (await this._matchesForCustomization(customizationId, [FIELDS_PROPOSALS.unsigned_document, FIELDS_PROPOSALS.signed_document]))
      .filter(r => {
        const unsigned = r.getCellValue(FIELDS_PROPOSALS.unsigned_document);
        const signed   = r.getCellValue(FIELDS_PROPOSALS.signed_document);
        const hasUnsigned = !!unsigned && unsigned.length > 0;
        const hasSigned   = !!signed && signed.length > 0;
        return hasUnsigned && !hasSigned;
      });
    const record = matches.length ? matches[matches.length - 1] : null;
    if (!record) throw new Error(
      `Guard clause: no Proposal for customization ${customizationId} is ready for a signed document ` +
      `(a Proposal must already have unsigned_document, and not yet have signed_document, before a ` +
      `signed copy can be attached).`
    );
    this.logger.audit(`Matched pending-signed Proposal → ${record.id}`);
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
// ATTACHMENT PROPAGATION SERVICE
// Orchestrates all steps: load → validate/route → write to the right
// destination → delete the staging record.
// ─────────────────────────────────────────────────────────────────────────────

class AttachmentPropagationService {
  constructor(attachmentsRepo, clientsRepo, proposalsRepo, logger) {
    this.attachmentsRepo = attachmentsRepo;
    this.clientsRepo     = clientsRepo;
    this.proposalsRepo   = proposalsRepo;
    this.logger          = logger;
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
      const linkedCustomization = record.getCellValue(FIELDS_ATTACHMENTS.customization_request);
      if (!linkedCustomization || linkedCustomization.length === 0) throw new Error(
        'Guard clause: customization_request field is empty. Cannot find the Proposal to attach to.'
      );
      this.logger.audit(
        `Guard passed (proposal route) → customization: ${linkedCustomization[0].id} | type: ${typeName} | files: ${attachments.length}`
      );
      return { route: 'proposal', customizationId: linkedCustomization[0].id, typeName, newAttachments: attachments };
    }

    throw new Error(
      `Guard clause: unknown type value "${typeName}". Expected one of: Measurements, ` +
      `Appointment Photos, Customization Proposal, Signed Proposal.`
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

  async _runProposalRoute({ customizationId, typeName, newAttachments }) {
    const isSigned = typeName === 'Signed Proposal';
    const proposalRecord = isSigned
      ? await this.proposalsRepo.findPendingSigned(customizationId)
      : await this.proposalsRepo.findPendingUnsigned(customizationId);

    if (isSigned) {
      await this.proposalsRepo.writeSignedDocument(proposalRecord.id, newAttachments);
    } else {
      await this.proposalsRepo.writeUnsignedDocument(proposalRecord.id, newAttachments);
    }

    return { client_id: null, proposal_id: proposalRecord.id, type: typeName, files_appended: newAttachments.length, total_files: newAttachments.length };
  }

  async run(attachmentsRecordId) {
    this.logger.audit(`Service started → record: ${attachmentsRecordId}`);

    // Step 1 — Load the Attachments record
    const attachmentsRecord = await this.attachmentsRepo.getById(attachmentsRecordId);

    // Step 2 — Validate guard clauses and pick a route
    const validated = this._validate(attachmentsRecord);

    // Steps 3-5 — Load destination, read existing (client route only), write
    const outcome = validated.route === 'client'
      ? await this._runClientRoute(validated)
      : await this._runProposalRoute(validated);

    // Step 6 — Delete the staging record from the Attachments table. It was
    // only a transit vehicle for the uploaded files; once they're safely
    // written to the real destination it is no longer needed.
    await this.attachmentsRepo.deleteRecord(attachmentsRecordId);

    this.logger.minimal(
      `SUCCESS → route: ${validated.route} | client: ${outcome.client_id ?? '—'} | proposal: ${outcome.proposal_id ?? '—'} | ` +
      `type: ${outcome.type} | appended: ${outcome.files_appended} | staging record deleted`
    );

    return {
      status         : 'SUCCESS',
      client_id      : outcome.client_id,
      proposal_id    : outcome.proposal_id,
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
output.set('files_appended', result.files_appended);
output.set('error_message',  result.error_message);
output.set('log_summary',    logger.getSummary());

logger.audit(`Script complete → status: ${result.status} | files appended: ${result.files_appended}`);

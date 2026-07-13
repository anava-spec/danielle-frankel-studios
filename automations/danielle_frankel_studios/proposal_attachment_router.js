// ─────────────────────────────────────────────────────────────────────────────
// Proposal Attachment Router
// Base:    Danielle Frankel Studios SANDBOX — app6Q4xMZ1ngJxiV8
//          (NOT the production base. The Recap interface hasn't been
//          published yet, so the Proposal record this needs to update only
//          exists in sandbox. This automation must be created on the
//          sandbox base — table/field IDs below are already sandbox IDs.
//          When the interface is published to production, recreate this
//          automation there too, pointing at the production Proposals table.)
// Trigger: "When record created" on the `attachments` table (tbli57E9YzWb5Qmku)
// Node 2:  Condition — type is "Customization Proposal"
//          AND customization_request is not empty
//          AND attachments is not empty
// Node 3:  Run a script (this file) — input.config(): { recordId: <Attachments record ID from trigger> }
//
// Objective: the Recap interface can't upload a File directly into the
// Proposals table's unsigned_document field (the Interface Extensions SDK
// only accepts {url, filename} attachment values, not a browser File object).
// So "Generate Proposal" instead sends the user to this same attachments
// form (already used for Measurements / Appointment Photos) with type =
// "Customization Proposal", prefilled with client + customization_request.
// This script fires when that form submission lands, finds the matching
// Proposal record (linked to the same Customization, still missing its
// unsigned_document), and copies the just-uploaded attachment onto it.
//
// Attachment values ARE safely copyable here, unlike the interface-extension
// case above: an attachment already stored on an Airtable record has a real
// https `.url` (Airtable's own CDN) that Airtable's servers can re-fetch when
// writing it into another field — this is the standard way automation
// scripts move attachments between tables. That's a different situation
// from a local browser File object, which has no fetchable URL at all.
//
// Guard clause (kept in sync with the Condition node in Node 2):
//   1. type must equal "Customization Proposal"
//   2. customization_request must be linked to exactly one Customization
//   3. attachments must be non-empty
//   4. exactly one matching, still-unsigned Proposal record must be found
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  ATTACHMENTS: 'tbli57E9YzWb5Qmku',
  PROPOSALS:   'tblP7tVuCuXMzI4ir',
};

const FIELDS_ATTACHMENTS = {
  TYPE:                  'fld39kLMqKEZucDXe',
  CUSTOMIZATION_REQUEST: 'fld5GbTtosSjljhAz',
  ATTACHMENTS:           'fldBgFSXBWHlejuEK',
};

const FIELDS_PROPOSALS = {
  SOURCE_CUSTOMIZATION: 'fldeXnhSr8r6rw78k',
  UNSIGNED_DOCUMENT:    'fldlUFhODjgDyeOFg',
  STATUS:               'fldW0GbVWnhZGUAtv',
};

const CUSTOMIZATION_PROPOSAL_TYPE = 'Customization Proposal';

// ─── Logger ────────────────────────────────────────────────────────────────
class Logger {
  constructor() { this.lines = []; }
  step(n, msg) { this.lines.push(`[${n}] ${msg}`); }
  error(msg) { this.lines.push(`[ERROR] ${msg}`); }
  getSummary() { return this.lines.join('\n'); }
}

// ─── AttachmentsRepository ──────────────────────────────────────────────────
class AttachmentsRepository {
  constructor(table) { this.table = table; }
  async getById(recordId) {
    return this.table.selectRecordAsync(recordId);
  }
}

// ─── ProposalsRepository ────────────────────────────────────────────────────
class ProposalsRepository {
  constructor(table) { this.table = table; }

  // Multiple Proposals can exist for the same Customization over time (a
  // proposal can be regenerated). The correct target is the most recently
  // created one that doesn't have unsigned_document yet — the one the user
  // just generated and is now attaching a PDF to.
  async findPendingBySourceCustomization(customizationId) {
    const result = await this.table.selectRecordsAsync({
      fields: [FIELDS_PROPOSALS.SOURCE_CUSTOMIZATION, FIELDS_PROPOSALS.UNSIGNED_DOCUMENT],
    });
    const matches = result.records.filter(r => {
      const link = r.getCellValue(FIELDS_PROPOSALS.SOURCE_CUSTOMIZATION);
      const linked = Array.isArray(link) && link.some(l => l.id === customizationId);
      if (!linked) return false;
      const existingDoc = r.getCellValue(FIELDS_PROPOSALS.UNSIGNED_DOCUMENT);
      return !existingDoc || existingDoc.length === 0;
    });
    // selectRecordsAsync returns records in creation order — last match is the most recent.
    return matches.length ? matches[matches.length - 1] : null;
  }

  async writeUnsignedDocument(recordId, attachments) {
    return this.table.updateRecordAsync(recordId, {
      [FIELDS_PROPOSALS.UNSIGNED_DOCUMENT]: attachments,
    });
  }
}

// ─── ProposalAttachmentService ──────────────────────────────────────────────
class ProposalAttachmentService {
  constructor(attachmentsRepo, proposalsRepo, logger) {
    this.attachmentsRepo = attachmentsRepo;
    this.proposalsRepo = proposalsRepo;
    this.logger = logger;
  }

  _validate(attachmentRecord) {
    const type = attachmentRecord.getCellValue(FIELDS_ATTACHMENTS.TYPE);
    if (!type || type.name !== CUSTOMIZATION_PROPOSAL_TYPE) {
      throw new Error(
        `Guard clause: type is not "${CUSTOMIZATION_PROPOSAL_TYPE}" ` +
        `(got "${type ? type.name : 'empty'}"). This automation only handles proposal uploads.`
      );
    }

    const customizationLink = attachmentRecord.getCellValue(FIELDS_ATTACHMENTS.CUSTOMIZATION_REQUEST);
    if (!customizationLink || !customizationLink.length) {
      throw new Error('Guard clause: customization_request is empty. Cannot find the Proposal to attach to.');
    }

    const files = attachmentRecord.getCellValue(FIELDS_ATTACHMENTS.ATTACHMENTS);
    if (!files || !files.length) {
      throw new Error('Guard clause: attachments is empty. Nothing was uploaded to attach.');
    }

    this.logger.step(1, `Guard passed → customization: ${customizationLink[0].id} | files: ${files.length}`);
    return { customizationId: customizationLink[0].id, files };
  }

  async run(attachmentRecordId) {
    const attachmentRecord = await this.attachmentsRepo.getById(attachmentRecordId);
    if (!attachmentRecord) throw new Error(`Attachment record ${attachmentRecordId} not found.`);

    const { customizationId, files } = this._validate(attachmentRecord);

    const proposal = await this.proposalsRepo.findPendingBySourceCustomization(customizationId);
    if (!proposal) {
      throw new Error(
        `Guard clause: no pending Proposal found for customization ${customizationId} ` +
        `(either none exists, or all matching Proposals already have unsigned_document set).`
      );
    }
    this.logger.step(2, `Matched Proposal → ${proposal.id}`);

    // Airtable-hosted attachments have a real https url — safe to copy via
    // {url, filename}, unlike a local browser File (see header comment).
    const attachmentsToWrite = files.map(f => ({ url: f.url, filename: f.filename }));
    await this.proposalsRepo.writeUnsignedDocument(proposal.id, attachmentsToWrite);
    this.logger.step(3, `Wrote unsigned_document onto Proposal ${proposal.id}`);

    return proposal.id;
  }
}

// ─── MAIN EXECUTION BLOCK ────────────────────────────────────────────────────
const config = input.config(); // { recordId: string }

const logger = new Logger();

try {
  const attachmentsTable = base.getTable(TABLE_IDS.ATTACHMENTS);
  const proposalsTable = base.getTable(TABLE_IDS.PROPOSALS);

  const attachmentsRepo = new AttachmentsRepository(attachmentsTable);
  const proposalsRepo = new ProposalsRepository(proposalsTable);
  const service = new ProposalAttachmentService(attachmentsRepo, proposalsRepo, logger);

  const proposalId = await service.run(config.recordId);

  output.set('success', true);
  output.set('proposalId', proposalId);
  output.set('log', logger.getSummary());
} catch (err) {
  logger.error(err.message);
  output.set('success', false);
  output.set('log', logger.getSummary());
  throw err; // re-throw so Airtable marks the automation run as FAILED
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT ARRIVAL SLACK MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
// v1.0.0 — 2026-08-24
//
// Business rule (Issue #32/#45 — noisy "Missing Data" flags on Appointments):
// reception can now Check In a client even when Room and/or Sales Associate
// are missing — those became soft flags, no longer blocking. This script
// replaces the "Client Arrival Slack" automation's single hardcoded template
// (which assumed Room + SA were always both present) with a message built
// from whichever of Room/SA/Alterations Lead actually exist on the record —
// one script instead of the 4-branch Conditional Logic tree the Airtable UI
// wouldn't accept.
//
// Rules:
// - Client name is always included — the automation's own trigger filter
//   (checked_in = TRUE) implies a real appointment, and an appointment with
//   no linked client can't meaningfully fire this at all.
// - Sales Associate and Alterations Lead are mentioned by Slack ID (@-mention,
//   <@SLACK_ID>) when present, omitted when not — no placeholder text.
// - Alterations Lead is only ever mentioned when the appointment's own type
//   is "Alterations" (fldZO3rF3KOGxG0S5) — an Alterations Lead value that
//   happens to be present on a non-Alterations appointment (e.g. a stale
//   lookup) is deliberately not mentioned.
// - Room is only appended as its own sentence when at least one Room is
//   linked; multiple linked Rooms are joined with ", ".
//
// Wiring (customScript nodes can't be created via the Airtable MCP — paste
// this in by hand):
// 1. In "Client Arrival Slack" (wflkYewOVmmi43mc7, DF Appointments - Acuity,
//    trigger: checked_in = TRUE), delete the placeholder node and add a
//    "Run a script" step with this file. Script input: recordId = trigger
//    record ID.
// 2. Point the existing "Send to Slack" step's message field at this
//    script's `message` output (delete its old hardcoded template) — no
//    other change needed to that step.
//
// Field IDs (DF Appointments - Acuity, tblvV7uKTCaFFekoR):
const FIELD_IDS = {
  CLIENT_LINK:   'fldcVVGhEsnYRsbyR', // multipleRecordLinks -> DF Clients
  ROOM_LINK:     'fldKVUlPm7Gq3EUF9', // multipleRecordLinks -> Rooms
  SA_SLACK_ID:   'fldMJPFB0EWRQOwRC', // lookup (via Client) -> Staff Slack ID, text
  AL_SLACK_ID:   'fldx90yfm9ZXl1pJX', // lookup (via Alterations Lead link) -> Staff Slack ID, text
  APPT_TYPE:     'fldZO3rF3KOGxG0S5', // lookup -> appointment_types.type, singleSelect (short category, e.g. "Alterations")
};
const APPOINTMENTS_TABLE_ID = 'tblvV7uKTCaFFekoR';
const ALTERATIONS_TYPE_NAME = 'Alterations';

const CONFIG = { LOG_LEVEL: 'B' };

// ─────────────────────────────────────────────────────────────────────────────
class Logger {
  constructor(level) { this.level = level; this.lines = []; }
  a(msg) { this.lines.push(`[A][${new Date().toISOString()}] ${msg}`); }
  b(msg) { if (this.level !== 'A') this.lines.push(`[B][${new Date().toISOString()}] ${msg}`); }
  c(msg) { if (this.level === 'C') this.lines.push(`[C][${new Date().toISOString()}] ${msg}`); }
  summary() { return this.lines.join('\n'); }
}

// ─────────────────────────────────────────────────────────────────────────────
class AppointmentRepository {
  constructor(table) { this.table = table; }
  async getRecord(recordId) {
    return await this.table.selectRecordAsync(recordId, {
      fields: [FIELD_IDS.CLIENT_LINK, FIELD_IDS.ROOM_LINK, FIELD_IDS.SA_SLACK_ID, FIELD_IDS.AL_SLACK_ID, FIELD_IDS.APPT_TYPE],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads the raw cell values into plain strings/arrays — isolates every
// "linked record vs. lookup vs. singleSelect" shape quirk in one place.
class SnapshotMapper {
  static clientName(record) {
    const links = record.getCellValue(FIELD_IDS.CLIENT_LINK);
    return Array.isArray(links) && links[0] ? (links[0].name || '') : '';
  }
  static roomNames(record) {
    const links = record.getCellValue(FIELD_IDS.ROOM_LINK);
    if (!Array.isArray(links)) return [];
    return links.map((l) => l.name).filter(Boolean);
  }
  // Lookups of a text field come back as an array of plain strings.
  static lookupText(record, fieldId) {
    const raw = record.getCellValue(fieldId);
    if (!raw) return '';
    if (Array.isArray(raw)) return (raw[0] || '').toString().trim();
    return raw.toString().trim();
  }
  static appointmentTypeName(record) {
    const raw = record.getCellValue(FIELD_IDS.APPT_TYPE);
    if (!raw) return '';
    const first = Array.isArray(raw) ? raw[0] : raw;
    return (first && first.name) || '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class MessageBuilder {
  static slackMention(slackId) {
    return slackId ? `<@${slackId}>` : null;
  }

  static build({ clientName, roomNames, saSlackId, isAlterations, alSlackId }) {
    const mentions = [
      MessageBuilder.slackMention(saSlackId),
      isAlterations ? MessageBuilder.slackMention(alSlackId) : null,
    ].filter(Boolean);

    const mentionPrefix = mentions.length ? `${mentions.join(', ')}, ` : '';
    const roomSentence = roomNames.length ? `\nYou will be in ${roomNames.join(', ')}.` : '';
    const clientLabel = clientName || 'A client';

    return `${mentionPrefix}${clientLabel} is here for their appointment.${roomSentence}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class ArrivalMessageService {
  constructor(repo, logger) { this.repo = repo; this.logger = logger; }

  async run(recordId) {
    this.logger.a(`Building arrival message for record ${recordId}`);
    const record = await this.repo.getRecord(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    const clientName = SnapshotMapper.clientName(record);
    const roomNames = SnapshotMapper.roomNames(record);
    const saSlackId = SnapshotMapper.lookupText(record, FIELD_IDS.SA_SLACK_ID);
    const alSlackId = SnapshotMapper.lookupText(record, FIELD_IDS.AL_SLACK_ID);
    const appointmentType = SnapshotMapper.appointmentTypeName(record);
    const isAlterations = appointmentType === ALTERATIONS_TYPE_NAME;

    this.logger.b(`client="${clientName}" rooms=${JSON.stringify(roomNames)} sa_slack_id="${saSlackId}" appt_type="${appointmentType}" al_slack_id="${alSlackId}"`);

    const message = MessageBuilder.build({ clientName, roomNames, saSlackId, isAlterations, alSlackId });
    this.logger.b(`message="${message}"`);

    return { message, clientName, roomCount: roomNames.length, hasSA: !!saSlackId, hasAL: isAlterations && !!alSlackId };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
const config = input.config();
const logger = new Logger(CONFIG.LOG_LEVEL);

try {
  const recordId = config.recordId;
  if (!recordId) throw new Error('Missing input variable: recordId');

  const table = base.getTable(APPOINTMENTS_TABLE_ID);
  const repo = new AppointmentRepository(table);
  const service = new ArrivalMessageService(repo, logger);

  const result = await service.run(recordId);

  output.set('message', result.message);
  output.set('client_name', result.clientName);
  output.set('room_count', result.roomCount);
  output.set('has_sa', result.hasSA);
  output.set('has_al', result.hasAL);
  output.set('log_summary', logger.summary());
} catch (err) {
  logger.a(`ERROR: ${err.message}`);
  output.set('log_summary', logger.summary());
  throw err;
}

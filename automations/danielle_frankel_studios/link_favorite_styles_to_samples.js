// ─────────────────────────────────────────────────────────────────────────────
// LINK FAVORITE STYLES FROM ACUITY TO SAMPLES
// ─────────────────────────────────────────────────────────────────────────────
// v1.0.0 — 2026-08-26
//
// Replaces the "LINK FAVORITE STYLES FROM ACUITY TO SAMPLES" automation's
// findRecords -> repeatingGroup -> updateRecord chain, which had been failing
// ~50% of its daily runs (Airtable health report item #72).
//
// Root cause (confirmed against the live automation config + schema):
// the old updateRecord node wrote the appointment's favorite_styles_from_acuity
// *names* straight into Appointments.Sample Log (a multipleRecordLinks field),
// relying on Airtable to link-by-matching-primary-field-text. Sample Log's
// primary field ("label", fldY8RGD6wRe673Lh) is a formula —
// CONCATENATE(parent_style_name, " - S - ", size) — which is never equal to a
// bare style name, so the match almost always failed with
// "Cannot modify a computed field."
//
// Fix: match by style *link*, not by name/text. For every appointment this
// week with favorite styles set, find every Sample Log record whose
// parent_style (fldFWWLHDvxG0gtkH, linked to DF Styles) links to one of the
// same DF Styles records as the appointment's favorite_styles_from_acuity —
// then link ALL matching samples (not just the first) via record ID, which a
// computed primary field can never block.
//
// One-time backfill: the live automation's own trigger cadence (daily,
// scoped to "this calendar week") only fixes appointments going forward —
// it doesn't touch the runs that already failed since Aug 14. Re-pointing
// the trigger to a manual/button run does NOT widen that scope by itself,
// because the week filter lives in this script, not the trigger. Pass the
// input variable `allTime` = `true` on a manual run to skip the week filter
// and process every Consultation appointment with favorite styles set,
// regardless of date — leave it unset/false for the normal daily run.
//
// Field IDs:
const FIELD_IDS = {
  APPT_TIME:      'fldL7kYvgkmyhGniX', // DF Appointments - Acuity, dateTime (primary field)
  FAVORITE_STYLES:'fldCPhdJ885D7ytOf', // DF Appointments - Acuity, lookup (via Client) -> DF Styles links
  SAMPLE_LOG:     'fld1zp6LVxmNwddwl', // DF Appointments - Acuity, multipleRecordLinks -> sample_log
  APPT_TYPE:      'fldky9XlBM97luBf1', // DF Appointments - Acuity, singleSelect (compound type + studio + duration)
  PARENT_STYLE:   'fldFWWLHDvxG0gtkH', // sample_log, multipleRecordLinks -> DF Styles
};
const APPOINTMENTS_TABLE_ID = 'tblvV7uKTCaFFekoR';
const SAMPLE_LOG_TABLE_ID = 'tbloFb2w2SANfkDQy';
const TIME_ZONE = 'America/New_York';

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
// This calendar week (Sun–Sat), evaluated in the studio's own timezone —
// matches the automation trigger's old "isWithin: thisCalendarWeek" filter.
class CalendarWeek {
  static rangeFor(now, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const todayMidnightUtc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    const start = new Date(todayMidnightUtc);
    start.setUTCDate(start.getUTCDate() - weekdayIndex);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }
  static isWithin(dateValue, now, timeZone) {
    if (!dateValue) return false;
    const { start, end } = CalendarWeek.rangeFor(now, timeZone);
    const d = new Date(dateValue);
    return d >= start && d < end;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class AppointmentRepository {
  constructor(table) { this.table = table; }

  async findConsultationsWithFavorites(now, { allTime }) {
    const result = await this.table.selectRecordsAsync({
      fields: [FIELD_IDS.APPT_TIME, FIELD_IDS.FAVORITE_STYLES, FIELD_IDS.APPT_TYPE, FIELD_IDS.SAMPLE_LOG],
    });
    return result.records.filter((record) => {
      const favorites = record.getCellValue(FIELD_IDS.FAVORITE_STYLES);
      if (!Array.isArray(favorites) || favorites.length === 0) return false;

      const typeValue = record.getCellValueAsString(FIELD_IDS.APPT_TYPE) || '';
      if (!typeValue.toLowerCase().includes('consultation')) return false;

      if (allTime) return true;

      const apptTime = record.getCellValue(FIELD_IDS.APPT_TIME);
      return CalendarWeek.isWithin(apptTime, now, TIME_ZONE);
    });
  }

  static favoriteStyleIds(record) {
    const favorites = record.getCellValue(FIELD_IDS.FAVORITE_STYLES);
    return Array.isArray(favorites) ? favorites.map((f) => f.id).filter(Boolean) : [];
  }

  static currentSampleLogIds(record) {
    const existing = record.getCellValue(FIELD_IDS.SAMPLE_LOG);
    return Array.isArray(existing) ? existing.map((r) => r.id) : [];
  }

  async linkSamples(recordId, sampleLogRecordIds) {
    await this.table.updateRecordAsync(recordId, {
      [FIELD_IDS.SAMPLE_LOG]: sampleLogRecordIds.map((id) => ({ id })),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Builds a DF-Style-id -> [sample_log record id, ...] index once, so every
// appointment this run just does an in-memory lookup instead of a fresh query.
class SampleLogIndex {
  constructor(table) { this.table = table; this.byStyleId = new Map(); }

  async build() {
    const result = await this.table.selectRecordsAsync({ fields: [FIELD_IDS.PARENT_STYLE] });
    result.records.forEach((record) => {
      const parents = record.getCellValue(FIELD_IDS.PARENT_STYLE);
      if (!Array.isArray(parents)) return;
      parents.forEach((p) => {
        if (!p || !p.id) return;
        if (!this.byStyleId.has(p.id)) this.byStyleId.set(p.id, []);
        this.byStyleId.get(p.id).push(record.id);
      });
    });
    return this;
  }

  sampleIdsForStyleIds(styleIds) {
    const found = new Set();
    styleIds.forEach((styleId) => {
      (this.byStyleId.get(styleId) || []).forEach((sampleId) => found.add(sampleId));
    });
    return Array.from(found);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class LinkFavoriteStylesService {
  constructor(appointmentRepo, sampleLogIndex, logger) {
    this.appointmentRepo = appointmentRepo;
    this.sampleLogIndex = sampleLogIndex;
    this.logger = logger;
  }

  async run(now, { allTime } = {}) {
    this.logger.a('Building Sample Log parent_style index');
    await this.sampleLogIndex.build();
    this.logger.b(`Indexed ${this.sampleLogIndex.byStyleId.size} distinct styles across sample_log`);

    const appointments = await this.appointmentRepo.findConsultationsWithFavorites(now, { allTime });
    this.logger.a(`Found ${appointments.length} consultation appointment(s) ${allTime ? '(all time)' : 'this week'} with favorite styles set`);

    let updated = 0, unchanged = 0, noMatch = 0;
    for (const record of appointments) {
      const styleIds = AppointmentRepository.favoriteStyleIds(record);
      const matchedSampleIds = this.sampleLogIndex.sampleIdsForStyleIds(styleIds);
      const currentSampleIds = AppointmentRepository.currentSampleLogIds(record);

      if (matchedSampleIds.length === 0) {
        noMatch++;
        this.logger.b(`${record.id}: no sample_log match for style id(s) ${JSON.stringify(styleIds)}`);
        continue;
      }

      const sameSet = matchedSampleIds.length === currentSampleIds.length
        && matchedSampleIds.every((id) => currentSampleIds.includes(id));
      if (sameSet) {
        unchanged++;
        continue;
      }

      await this.appointmentRepo.linkSamples(record.id, matchedSampleIds);
      updated++;
      this.logger.b(`${record.id}: linked ${matchedSampleIds.length} sample(s) — ${JSON.stringify(matchedSampleIds)}`);
    }

    this.logger.a(`Done. updated=${updated} unchanged=${unchanged} noMatch=${noMatch} total=${appointments.length}`);
    return { updated, unchanged, noMatch, total: appointments.length };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
const config = input.config();
const logger = new Logger(CONFIG.LOG_LEVEL);

try {
  const now = new Date();
  // Optional input variable — leave unset/false for the normal daily run
  // (this week only); set to true for a one-time manual backfill run that
  // processes every Consultation appointment with favorite styles set,
  // regardless of date. See the "One-time backfill" note above.
  const allTime = config.allTime === true || config.allTime === 'true';

  const appointmentsTable = base.getTable(APPOINTMENTS_TABLE_ID);
  const sampleLogTable = base.getTable(SAMPLE_LOG_TABLE_ID);

  const appointmentRepo = new AppointmentRepository(appointmentsTable);
  const sampleLogIndex = new SampleLogIndex(sampleLogTable);
  const service = new LinkFavoriteStylesService(appointmentRepo, sampleLogIndex, logger);

  const result = await service.run(now, { allTime });

  output.set('updated', result.updated);
  output.set('unchanged', result.unchanged);
  output.set('no_match', result.noMatch);
  output.set('total', result.total);
  output.set('log_summary', logger.summary());
} catch (err) {
  logger.a(`ERROR: ${err.message}`);
  output.set('log_summary', logger.summary());
  throw err;
}

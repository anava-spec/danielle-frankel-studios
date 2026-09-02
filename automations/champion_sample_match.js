/*
================================================================================
AUTOMATION : Sample Tracker | Champion Match on Style Change
BASE       : appMmEE4zyHMGhkkd (sandbox — mirror to Production when ready)
TABLE SRC  : DF Clients (tblLLUlDgJ4ktzF7c)
TABLES REF : DF Styles (tbl0hWIRBbcB4UkVC), Sample Log / sample_log (tbloFb2w2SANfkDQy)
TRIGGER    : When record is updated — DF Clients — watch field:
             favorite_styles_from_acuity (fldZzNR0g5VEJ5RmX)
VERSION    : 1.0.0 — Initial build. Sample Tracker: Parent-Style Link
             Constraint + Close-Size Matching handoff, Step 5.

OBJECTIVE
  Whenever a client's favorite styles change, compute the best in-stock
  sample ("champion") per favorite style and write the result to
  champion_samples (fldEDcL6wGGmUt6ni) on the DF Clients record.

MATCH RULES (mirrors the Sample Tracker interface's close-size logic —
see sample_tracker.tsx SIZE_ORDER / CLOSE_SIZE_THRESHOLD)
  1. Only Active samples (status = "Active") with a parent_style link are
     candidates. A sample with no parent_style link is never a candidate.
  2. Only parent styles (is_parent_style = true) are matched — a favorite
     style that is itself a variant record is skipped (no champion written
     for it), consistent with the parent-style picker constraint elsewhere
     in this story.
  3. Distance = |ready_to_wear_size - sample size| on the shared numeric
     axis (SIZE_ORDER below). European sizes are their own axis.
  4. Minimum distance wins. If the minimum distance exceeds
     CLOSE_SIZE_THRESHOLD (1), no champion is written for that style.
  5. Tiebreaker among candidates at the minimum distance: prefer
     location_status = "In Studio" over "Away"/"Trunk Show".

GUARD CLAUSES (log + exit cleanly, NOT errors)
  1. favorite_styles_from_acuity is empty on the client record.
  2. ready_to_wear_size is null on the client record.
  3. ready_to_wear_size doesn't resolve to a known size on SIZE_ORDER.
  4. Per style: is_parent_style = false → skipped, not an error.
  5. Per style: no candidate within CLOSE_SIZE_THRESHOLD → skipped, not an error.
  None of these guards throw — they short-circuit to a SUCCESS result with
  championsWritten = 0 (or fewer than favorite_styles.length).

ERROR HANDLING
  Anything else (missing client record, Airtable API failure) throws with a
  descriptive message and is re-thrown so Airtable marks the run FAILED and
  fires its native failure notification. Errors are never suppressed.

OUTPUTS (output.set)
  status          : "SUCCESS" | "ERROR"
  championsWritten: number of champion sample IDs written
  skippedStyleIds : DF Styles record IDs that had no champion (variant or
                    no close-enough stock)
  error_message   : null on success
  log_summary     : full Logger output
================================================================================
*/

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_IDS = {
  DF_CLIENTS: 'tblLLUlDgJ4ktzF7c',
  DF_STYLES:  'tbl0hWIRBbcB4UkVC',
  SAMPLE_LOG: 'tbloFb2w2SANfkDQy',
};

const FIELDS_CLIENTS = {
  favorite_styles:    'fldZzNR0g5VEJ5RmX', // multipleRecordLinks -> DF Styles
  // Formula field — falls back to Size from Acuity Intake when the manual
  // entry (ready_to_wear_size_manual, fldEEH4CK3Qqp0g0C) is blank. Read this
  // field, never the manual one directly.
  ready_to_wear_size: 'fldSwfR25uvynWKI5', // formula (singleLineText result)
  champion_samples:   'fldEDcL6wGGmUt6ni', // multipleRecordLinks -> Sample Log
};

const FIELDS_STYLES = {
  name:            'fldEs3chQAeplPc1w',
  is_parent_style: 'fldahgBBH19TcIPzi', // checkbox
  sample_link:     'fld2naacQIqtyZDgB', // multipleRecordLinks -> Sample Log (inverse of parent_style)
};

const FIELDS_SAMPLES = {
  status:      'fldGUFM9bxpEGrwtj', // singleSelect: Active / Retired
  size:        'fldWEXxkqlC7EHCpL', // singleSelect
  in_studio:   'fldjLf5XSWEwsmdYh', // formula: location_status — "In Studio" / "Trunk Show" / "Away"
  style_link:  'fldFWWLHDvxG0gtkH', // multipleRecordLinks -> DF Styles (parent_style)
};

// Same axis as the Sample Tracker interface's SIZE_ORDER (sample_tracker.tsx).
// European sizes are their own axis — never cross-matched against US/letter.
const SIZE_ORDER = {
  'OS': 0, 'XS': 0, '0': 0,
  '2': 2,
  '4': 4, 'S': 4,
  '6': 6,
  '8': 8, 'M': 8,
  '10': 10,
  '12': 12, 'L': 12,
  '14': 14, 'XL': 14,
  '16': 16, 'XXL': 16,
  '35': 35, '36': 36, '37': 37, '38': 38, '38.5': 38.5,
  '39': 39, '39.5': 39.5, '40': 40, '41': 41, '42': 42,
};
const CLOSE_SIZE_THRESHOLD = 1;
const ACTIVE_STATUS_NAME = 'Active';
const IN_STUDIO_VALUE = 'In Studio';
const CONFIG = { LOG_LEVEL: 'B' }; // A=minimal | B=audit (default) | C=debug

function sizeToNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const t = String(raw).trim().toUpperCase();
  if (t in SIZE_ORDER) return SIZE_ORDER[t];
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class Logger {
  constructor(level = 'B') {
    this.level = level;
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
  error(msg) {
    const e = `[ERR][${new Date().toISOString()}] ${msg}`;
    this.entries.push(e);
    console.error(e);
  }
  step(n, msg) { this._log('B', `── STEP ${n}: ${msg}`); }
  getSummary() { return this.entries.join('\n'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DF CLIENTS REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class DfClientsRepository {
  constructor(logger) {
    this.table = base.getTable(TABLE_IDS.DF_CLIENTS);
    this.logger = logger;
  }
  async getById(recordId) {
    this.logger.step(1, `Loading DF Clients record -> ${recordId}`);
    const record = await this.table.selectRecordAsync(recordId, { fields: Object.values(FIELDS_CLIENTS) });
    if (!record) throw new Error(`Guard clause: DF Clients record not found -> recordId: ${recordId}`);
    this.logger.audit(`Record loaded -> ${recordId}`);
    return record;
  }
  async writeChampions(recordId, sampleRecordIds) {
    this.logger.step(5, `Writing ${sampleRecordIds.length} champion sample(s) -> ${recordId}`);
    await this.table.updateRecordAsync(recordId, {
      [FIELDS_CLIENTS.champion_samples]: sampleRecordIds.map(id => ({ id })),
    });
    this.logger.audit(`champion_samples updated on ${recordId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DF STYLES REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class DfStylesRepository {
  constructor(logger) {
    this.table = base.getTable(TABLE_IDS.DF_STYLES);
    this.logger = logger;
  }
  async getById(recordId) {
    const record = await this.table.selectRecordAsync(recordId, { fields: Object.values(FIELDS_STYLES) });
    return record; // may be null if the linked style was deleted — caller guards
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE LOG REPOSITORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SampleLogRepository {
  constructor(logger) {
    this.table = base.getTable(TABLE_IDS.SAMPLE_LOG);
    this.logger = logger;
  }
  // Formula fields (location_status) must be explicitly requested or they
  // return null — same rule the Sample Tracker interface follows.
  async getByIds(recordIds) {
    const samples = [];
    for (const id of recordIds) {
      const record = await this.table.selectRecordAsync(id, { fields: Object.values(FIELDS_SAMPLES) });
      if (record) samples.push(record);
    }
    return samples;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMPION MATCH SERVICE CLASS — Orchestrates all steps
// ─────────────────────────────────────────────────────────────────────────────

class ChampionMatchService {
  constructor(clientRepo, stylesRepo, sampleRepo, logger) {
    this.clientRepo = clientRepo;
    this.stylesRepo = stylesRepo;
    this.sampleRepo = sampleRepo;
    this.logger = logger;
  }

  async run(clientRecordId) {
    this.logger.audit(`Service started -> DF Clients record: ${clientRecordId}`);

    // Step 1 — Load the client record
    const client = await this.clientRepo.getById(clientRecordId);
    const favoriteLinks = client.getCellValue(FIELDS_CLIENTS.favorite_styles) || [];
    const rtwSizeRaw = client.getCellValue(FIELDS_CLIENTS.ready_to_wear_size);

    // Guard 1 — no favorite styles: not an error, nothing to compute.
    if (favoriteLinks.length === 0) {
      this.logger.minimal('SUCCESS -> favorite_styles_from_acuity is empty, nothing to match');
      return { status: 'SUCCESS', championsWritten: 0, skippedStyleIds: [], error_message: null };
    }

    // Guard 2 — no RTW size on file: not an error, nothing to compute.
    if (rtwSizeRaw === null || rtwSizeRaw === undefined || rtwSizeRaw === '') {
      this.logger.minimal('SUCCESS -> ready_to_wear_size is empty, nothing to match');
      return { status: 'SUCCESS', championsWritten: 0, skippedStyleIds: favoriteLinks.map(l => l.id), error_message: null };
    }

    // Guard 3 — RTW size doesn't resolve to a known numeric position.
    const rtwSize = sizeToNumber(rtwSizeRaw);
    if (rtwSize === null) {
      this.logger.minimal(`SUCCESS -> ready_to_wear_size "${rtwSizeRaw}" not in SIZE_ORDER, nothing to match`);
      return { status: 'SUCCESS', championsWritten: 0, skippedStyleIds: favoriteLinks.map(l => l.id), error_message: null };
    }

    // Step 2 — Evaluate each favorite style
    this.logger.step(2, `Evaluating ${favoriteLinks.length} favorite style(s) against RTW size ${rtwSizeRaw} (${rtwSize})`);
    const champions = [];
    const skippedStyleIds = [];

    for (const link of favoriteLinks) {
      const styleId = link.id;
      const style = await this.stylesRepo.getById(styleId);
      if (!style) { this.logger.audit(`Style ${styleId} not found (deleted?) -> skipped`); skippedStyleIds.push(styleId); continue; }

      // Guard 4 — variant styles are never matched.
      if (style.getCellValue(FIELDS_STYLES.is_parent_style) !== true) {
        this.logger.audit(`Style ${styleId} ("${style.getCellValueAsString(FIELDS_STYLES.name)}") is not a parent style -> skipped`);
        skippedStyleIds.push(styleId);
        continue;
      }

      const linkedSampleLinks = style.getCellValue(FIELDS_STYLES.sample_link) || [];
      const samples = await this.sampleRepo.getByIds(linkedSampleLinks.map(l => l.id));

      const candidates = [];
      for (const sample of samples) {
        if (sample.getCellValueAsString(FIELDS_SAMPLES.status) !== ACTIVE_STATUS_NAME) continue;
        const styleLink = sample.getCellValue(FIELDS_SAMPLES.style_link);
        if (!styleLink || styleLink.length === 0) continue; // rule 6 — link missing, not a candidate
        const sSize = sizeToNumber(sample.getCellValueAsString(FIELDS_SAMPLES.size));
        if (sSize === null) continue;
        const distance = Math.abs(rtwSize - sSize);
        const inStudio = sample.getCellValueAsString(FIELDS_SAMPLES.in_studio) === IN_STUDIO_VALUE;
        candidates.push({ sample, distance, inStudio });
      }

      if (candidates.length === 0) {
        this.logger.audit(`Style ${styleId} -> no Active candidates with a valid size`);
        skippedStyleIds.push(styleId);
        continue;
      }

      const minDistance = Math.min(...candidates.map(c => c.distance));

      // Guard 5 — nothing within the close-size threshold.
      if (minDistance > CLOSE_SIZE_THRESHOLD) {
        this.logger.audit(`Style ${styleId} -> closest candidate is ${minDistance} away, exceeds threshold ${CLOSE_SIZE_THRESHOLD} -> skipped`);
        skippedStyleIds.push(styleId);
        continue;
      }

      // Tiebreaker: prefer In Studio among candidates at minDistance.
      const atMin = candidates.filter(c => c.distance === minDistance);
      const champion = atMin.find(c => c.inStudio) ?? atMin[0];

      this.logger.audit(
        `Style ${styleId} -> champion ${champion.sample.id} (distance ${champion.distance}, ${champion.inStudio ? 'In Studio' : 'not In Studio'})`
      );
      champions.push(champion.sample.id);
    }

    // Step 5 — Write results (skip the write entirely if nothing qualified)
    if (champions.length > 0) {
      await this.clientRepo.writeChampions(clientRecordId, champions);
    } else {
      this.logger.audit('No champions qualified -> champion_samples left unchanged');
    }

    this.logger.minimal(`SUCCESS -> ${champions.length} champion(s) written, ${skippedStyleIds.length} style(s) skipped`);
    return { status: 'SUCCESS', championsWritten: champions.length, skippedStyleIds, error_message: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION BLOCK
// input.config() called ONCE — Airtable only allows one call per script.
// Map the trigger's record ID to "clientRecordId" in the Run Script action.
// ─────────────────────────────────────────────────────────────────────────────

const cfg = input.config();
const clientRecordId = cfg.clientRecordId;

const logger = new Logger(CONFIG.LOG_LEVEL);

let result = { status: 'ERROR', championsWritten: 0, skippedStyleIds: [], error_message: null };

try {
  if (!clientRecordId) throw new Error(
    'Guard clause: missing required input "clientRecordId". Map the trigger\'s record ID to this input in the Run Script action.'
  );

  logger.audit(`Automation started -> clientRecordId: ${clientRecordId}`);

  const service = new ChampionMatchService(
    new DfClientsRepository(logger),
    new DfStylesRepository(logger),
    new SampleLogRepository(logger),
    logger
  );

  result = await service.run(clientRecordId);

} catch (err) {
  logger.error(`Automation failed -> ${err.message}`);
  result.error_message = err.message;

  // !! CRITICAL — re-throw so Airtable marks the automation run as FAILED !!
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS — only reached on SUCCESS (catch block re-throws on error)
// ─────────────────────────────────────────────────────────────────────────────

output.set('status', result.status);
output.set('championsWritten', result.championsWritten);
output.set('skippedStyleIds', result.skippedStyleIds);
output.set('error_message', result.error_message);
output.set('log_summary', logger.getSummary());

logger.audit(`Script complete -> status: ${result.status} | championsWritten: ${result.championsWritten}`);

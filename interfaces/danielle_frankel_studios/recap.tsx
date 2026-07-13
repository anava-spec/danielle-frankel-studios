import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
} from '@airtable/blocks/interface/ui';
import type { Table, Record as AirtableRecord } from '@airtable/blocks/interface/models';
import {
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CaretDown as CaretDownIcon,
  Calendar as CalendarIcon,
  Ruler as RulerIcon,
  Camera as CameraIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Upload as UploadIcon,
  X as XIcon,
  Check as CheckIcon,
  ArrowLeft as ArrowLeftIcon,
  Lightning as LightningIcon,
  Printer as PrinterIcon,
  FileText as FileTextIcon,
} from '@phosphor-icons/react';

// ─── Write queue ──────────────────────────────────────────────────────────────
let _writeQueue = Promise.resolve();
function queueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = _writeQueue.then(fn);
  _writeQueue = next.then(() => {}, () => {});
  return next;
}

// ─── Table / field IDs ────────────────────────────────────────────────────────
const TABLE_IDS = {
  APPOINTMENTS:         'tblvV7uKTCaFFekoR',
  CLIENTS:              'tblLLUlDgJ4ktzF7c',
  STYLES:               'tbl0hWIRBbcB4UkVC',
  CUSTOMIZATIONS:       'tbl7HUWDI7IRjWY92',
  CUSTOMIZATION_PRICING:'tblccTHYe8BCqutyD',
  VENDORS:              'tblZzMdXOlBDJC0BS',
  ATTACHMENTS:          'tbli57E9YzWb5Qmku',
  STAFF:                'tblbYk88xJ8FQrLS4',
  PROPOSALS:            'tblP7tVuCuXMzI4ir',
} as const;

const APPT = {
  TIME:           'fldL7kYvgkmyhGniX',
  TYPE:           'fldZO3rF3KOGxG0S5',
  ROOM_LINK:      'fldKVUlPm7Gq3EUF9',
  CLIENT_LINK:    'fldcVVGhEsnYRsbyR',
  STATUS:         'fldZTkJdTBhmcchTb',
  CHECK_IN:       'fldarspmpxD4OFpnX',
  CLEARED:        'fldE1Ke90UVdyUFL1',
  PICKED_UP:      'fldaT5YwVqB87h8Ia',
  SA_NAME:        'fldAopgXS7Zw42ZgV',
  STUDIO_NAME:    'fldelULQNcaGnAv5K',
  APPT_END_TIME:  'fldFwFIBNtC76v0Y7',
  MEASUREMENTS:   'fldbXhNAVDZq9fl2u',
  APPT_PHOTOS:    'fldBEBwDmZd29rjkK',
  FOLLOW_UP:      'fldX0ymLcTeOMpBw7',
} as const;

const CLIENT = {
  FULL_NAME:          'fldB3Wyam01D3wR5Q',
  FIRST_NAME:         'fldFWlAODUcuroeXK',
  LAST_NAME:          'fldQzSPiUvOid1nXo',
  STAGE:              'fldLcxVZvI1rigBlh',
  EMAIL:              'fld5f3IVZoX0QZZ8R',
  PHONE:              'fldZrxF4bR6QBUwVK',
  WEDDING:            'fldbgknumKGS5W5WU',
  WEDDING_IF_NOT_SET: 'fldqwfmMczvLhiqk1',
  WEDDING_CONFIRMED:  'fldOZTDVcR1qwU6U2',
  WEDDING_LOCATION:   'fldikRqj41XYiIDBk',
  WEDDING_PLANNER:    'fldISwHPviwGQBHFJ',
  STUDIO_FORMULA:     'fldNQuys5CFap0drj',
  STUDIO_SHORT_NAME:  'fld1AWRrVteCUmVto',
  SA_NAME:            'fldH8lJJHPUjPnyHZ',
  SA_PHONE:           'fldl5vP5mpQrHsTsm',
  SA_EMAIL:           'fldiGcxcshWvxTKKf',
  APPT_COUNT:         'fldrnDWDgDx5IF5gz',
  NEXT_APPT:          'fldTe2cyBmicx9Ple',
  LAST_APPT:          'fldd01OccObkG9sGe',
  NEXT_APPT_ROOM:     'fldfQUSkQRooZi8sr',
  NEXT_APPT_ALT_LEAD: 'flddN7YHMuymJKbv9',
  LATEST_ALTS_APPT:   'fldoF7SPEjWNi5JQF',
  COUNTRY:            'flduQb1j7LceNZuC8',
  STYLISTS:           'fld2jVE1qluvlhV7D',
  RTW_SIZE:           'fldEEH4CK3Qqp0g0C',
  FAV_STYLES_ACUITY:  'fldZzNR0g5VEJ5RmX',
  SAMPLES_NOT_NEEDED: 'fldVPJWXThfyGuh6d',
  PERSONAL_NOTES:     'fldQiGCx5hRQ0Am1Z',
  MEAS_PHOTO:         'fldcWwbKOc9nkgzzV',
  APPT_PHOTO:         'fldWti8XzHbnGcjz9',
  MEAS_BUST:          'fldiCV13D0ym7Yirh',
  MEAS_WAIST:         'fldShyIHilro7fYol',
  MEAS_HIPS:          'fldx7dNHA3SZYC11C',
  MEAS_HEIGHT:        'fldTAlnT0Wk3LKPsb',
  MEAS_UNDER_BUST:    'fldjpZwsalPCU58B6',
  MEAS_HIGH_HIP:      'fldxSCXFJbpFZSjT4',
  MEAS_HOLLOW_HEM:    'fldTjlDvwQujNQq2Q',
  MEAS_SHOULDER_W:    'fldumkBChIto7hK3o',
  MEAS_ARM_LENGTH:    'fldgEc2qr3qjjSX00',
  MEAS_NOTES:         'fld66sFiCbMxKwtiB',
  FOLLOW_UP_SENT:     'fldmjiS7lHEn9qZHN',
  INTEREST_CUSTOM:    'fldTrFh5dMYvkl0F4',
  INTEREST_ALTS:      'fldibh40zShnDmLfj',
  INTEREST_M2M:       'fld3YweLOIcpr7xvL',
  APPT_NOTES:         'fldwHp8zC3GykAuO1',
  FAV_STYLES_APPT:    'fldVw8wCgPKvxN1jD',
  CUSTOMIZATION_LINK: 'fldlbAPEaoTwfFPTv',
  SIZE:               'fld2i9hJrfxTUuh1N',
  ATTACHMENTS:        'fldu3dTdfLaN5immv',
} as const;

const CUSTOM = {
  ID_FORMULA:            'fldl9cIcV80nYEDwe',
  DATE_OF_REQUEST:       'fldQdHAp256vsImBt',
  STATUS:                'fld5qkNKygBkRYF4v',
  CUSTOMIZED_STYLE:      'fldCaKP1d4C0aohQE',
  CUSTOMIZATION_PRICING: 'fldJY7GklAVZ7lsjw',
  CUSTOMIZATION_DETAIL:  'fldg1hEoZe9MFQj02',
  EMBROIDERY_AMOUNT:     'fldfryrwA8fipol7v',
  M2M:                   'fldonK9Rd5lOXeH8F',
  ALTERATIONS:           'fldM72sjV0aAwbX2D',
  RUSH:                  'fldt92ponsfyKqDS1',
  CLIENT:                'fldOeL4VVcXaKwwlN',
  SEND_TO_SLACK:         'fldG6tV91xqwh36P8',
  BASE_PRICE:            'fldLBXbdD3SUfXSgL',
  WEDDING_DATE:          'fldO0Lalw1SkwAf4D',
} as const;

const PRICING = {
  TYPE:      'fld4XT7jm39PR6l1V',
  IS_ACTIVE: 'fldWqVqCtMi5MVq9T',
  PRICE:     'fldoFj5qMu6IRX53d',
  PERCENT:   'fldzVvl1ZMSfEGQdQ',
  MULTIPLE:  'fldEKZTpnJ5Y1gjOw',
} as const;

// Proposals table — created in the sandbox base for "Customization Proposal
// Document Generation" (JuliMigLui37089). Field IDs are hardcoded (not
// discovered via getFieldIfExists by name) since this table was created
// directly via the Airtable API for this feature.
const PROPOSAL = {
  CLIENT:                     'fldlZNjszbY9gI1PT',
  SALES_ASSOCIATE:            'fld3JGsN4n496CT0q',
  SOURCE_CUSTOMIZATION:       'fldeXnhSr8r6rw78k',
  SNAPSHOT_STYLE:             'fldU3ODl61opCWqex',
  SNAPSHOT_CUSTOMIZATIONS:    'fldxLnC3GcflnLix2',
  SNAPSHOT_EMBROIDERY_AMOUNT: 'fldnTacwv9Ie43ySX',
  SNAPSHOT_PRICING:           'fldh80zFrkHTPZ8T8',
  UNSIGNED_DOCUMENT:          'fldlUFhODjgDyeOFg',
  SIGNED_DOCUMENT:            'fld1Z37faYGD7jDia',
  STATUS:                     'fldW0GbVWnhZGUAtv',
  GENERATED_AT:               'fldHoui3whPBjKs5x',
} as const;

// ─── External field source map ─────────────────────────────────────────────────
type FieldSource = 'acuity' | 'shopify' | 'apparel_magic';

const FIELD_SOURCE: Record<string, FieldSource> = {
  // Acuity — DF Clients
  [CLIENT.FULL_NAME]:          'acuity',
  [CLIENT.FIRST_NAME]:         'acuity',
  [CLIENT.LAST_NAME]:          'acuity',
  [CLIENT.PHONE]:              'acuity',
  [CLIENT.WEDDING]:            'acuity',
  [CLIENT.WEDDING_IF_NOT_SET]: 'acuity',
  [CLIENT.WEDDING_LOCATION]:   'acuity',
  [CLIENT.WEDDING_PLANNER]:    'acuity',
  [CLIENT.FAV_STYLES_ACUITY]:  'acuity',
  [CLIENT.PERSONAL_NOTES]:     'acuity',
  // Shopify — DF Clients
  [CLIENT.EMAIL]:              'shopify',
  [CLIENT.SIZE]:               'shopify',
  // Acuity — DF Appointments
  [APPT.TIME]:                 'acuity',
  [APPT.CLIENT_LINK]:          'acuity',
  [APPT.ROOM_LINK]:            'acuity',
  [APPT.STATUS]:               'acuity',
} as const;

function isFieldReadOnlyBySource(fieldId?: string): boolean {
  return !!fieldId && fieldId in FIELD_SOURCE;
}

// ─── Attachment form URL (production) ─────────────────────────────────────────
const ATTACHMENT_FORM_URL = 'https://airtable.com/appUC2NFAlURayLx9/pagRXpKT2IMcjQwqo/form';

// Same standalone form, but the SANDBOX copy — same pageId, different base.
// Used for the Proposal attach step specifically, because this interface
// still runs against sandbox (not yet published), so the Proposal record
// that needs the attachment only exists there. Update to the production URL
// once this interface is published and the Proposals table exists in prod.
const PROPOSAL_ATTACHMENT_FORM_URL = 'https://airtable.com/app6Q4xMZ1ngJxiV8/pagRXpKT2IMcjQwqo/form';

// Used for both the unsigned copy (right after "Generate Proposal") and the
// signed copy (from the Proposals list) — same form, different `type` value.
// The automations/danielle_frankel_studios/attachment_router.js automation
// reads customization_proposal (a direct link to this exact Proposal
// record) + type to route the attachment onto the right field. `hide_*`
// (paired with `prefill_*`) makes Airtable
// hide that field on the form entirely, leaving only the file picker visible.
type ProposalAttachmentType = 'Customization Proposal' | 'Signed Proposal';
// attachments.customization_proposal links directly to the Proposals table
// (not to Customizations) — proposalId here is a Proposals record ID.
function buildProposalAttachmentFormUrl(clientId: string, proposalId: string, type: ProposalAttachmentType): string {
  const url = new URL(PROPOSAL_ATTACHMENT_FORM_URL);
  url.searchParams.set('prefill_client', clientId);
  url.searchParams.set('hide_client', 'true');
  url.searchParams.set('prefill_customization_proposal', proposalId);
  url.searchParams.set('hide_customization_proposal', 'true');
  url.searchParams.set('prefill_type', type);
  url.searchParams.set('hide_type', 'true');
  return url.toString();
}

// ─── Customization status steps ───────────────────────────────────────────────
const CUSTOM_STATUS_STEPS = [
  'Sent to Production',
  'Pattern Making',
  'Ready to Cut',
  'Making at DF',
  'At Factory',
  'Need Info',
  'Complete',
] as const;

// ─── Rich text helper ─────────────────────────────────────────────────────────
// Airtable richText fields require an object with a `markdown` key when writing.
function toRichText(plain: string): { markdown: string } {
  return { markdown: plain };
}
function fromRichText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'markdown' in val) {
    return (val as { markdown: string }).markdown ?? '';
  }
  return '';
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDisplay(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(d);
}
function fmtNYTime(d: Date): string {
  const p = new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York', hour:'numeric', minute:'2-digit', hour12:true }).formatToParts(d);
  const hr = p.find(x=>x.type==='hour')?.value??'0';
  const mn = p.find(x=>x.type==='minute')?.value??'00';
  const ap = (p.find(x=>x.type==='dayPeriod')?.value??'').toLowerCase();
  return `${hr}:${mn}${ap}`;
}
function fmtFriendly(s: string|null|undefined): string {
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1]!, +m[2]!-1, +m[3]!) : new Date(s);
  if (isNaN(d.getTime())) return s;
  const month = new Intl.DateTimeFormat('en-US', { month:'long' }).format(d);
  const day = d.getDate();
  const v = day%100;
  const ord = (['th','st','nd','rd'][(v-20)%10]??['th','st','nd','rd'][v]??'th');
  return `${month} ${day}${ord}, ${d.getFullYear()}`;
}
// Same as fmtFriendly but without the ordinal suffix — "July 4, 2026".
function fmtUSDate(s: string|null|undefined): string {
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1]!, +m[2]!-1, +m[3]!) : new Date(s);
  if (isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat('en-US', { month:'long', day:'numeric', year:'numeric' }).format(d);
}

// ─── Proposal filename ─────────────────────────────────────────────────────
// client_style_date_time, all snake_case — used both as the suggested
// filename for Print → Save as PDF (via document.title, the only lever a
// web page has over that dialog's default filename) and as the `download`
// attribute on the Unsigned/Signed Proposal Download links.
function toSnakeCase(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
function buildProposalFilename(clientName: string, styleName: string, date: Date): string {
  const datePart = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  const timePart = `${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;
  return [toSnakeCase(clientName), toSnakeCase(styleName), datePart, timePart].filter(Boolean).join('_');
}
function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx) : '';
}
function parseFlexDate(s: string): Date|null {
  if (!s.trim()) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) { const d = new Date(+iso[1]!,+iso[2]!-1,+iso[3]!); return isNaN(d.getTime())?null:d; }
  const d = new Date(s);
  return isNaN(d.getTime())?null:d;
}
function weeksUntil(weddingIso: string|null|undefined): number|null {
  if (!weddingIso) return null;
  const d = parseFlexDate(weddingIso);
  if (!d) return null;
  const diff = d.getTime() - Date.now();
  return Math.floor(diff / (1000*60*60*24*7));
}
function isConsultation(label: string): boolean {
  return label.toLowerCase().includes('consultation');
}
function shortTypeLabel(full: string): string {
  return full.replace(/^(NY\s*-\s*(260|TRIBECA)\s*-\s*|LA\s*-\s*)/i,'').replace(/\s*-\s*\d+\s*Minutes?\s*$/i,'').trim();
}

// ─── Safe cell helpers ────────────────────────────────────────────────────────
function getStr(rec: AirtableRecord, fieldId: string): string {
  try {
    const tbl = rec as any;
    const field = tbl._table?.getFieldIfExists(fieldId);
    if (!field) return '';
    return rec.getCellValueAsString(field) ?? '';
  } catch { return ''; }
}
function getVal<T>(rec: AirtableRecord, fieldId: string): T|null {
  try {
    const tbl = rec as any;
    const field = tbl._table?.getFieldIfExists(fieldId);
    if (!field) return null;
    return rec.getCellValue(field) as T|null;
  } catch { return null; }
}

// ─── Pricing math ──────────────────────────────────────────────────────────────
// A Customization Pricing row prices itself one of three ways, in priority
// order: a flat dollar amount, a percentage of `basisAmount` (stored as a 0–1
// fraction), or a "multiple" fee scaled by multiplierFactor (Self Usage × the
// Amount-of-Embroidery/Paint/Lace tier — see computeMultiplierFactor below).
// Mirrors the same rule used in the Customizations detail interface, so a
// percent- or multiplier-based item prices identically in both places.
function resolvePricingRowAmount(
  r: AirtableRecord,
  priceField: ReturnType<Table['getFieldIfExists']>,
  percentField: ReturnType<Table['getFieldIfExists']>,
  multipleField: ReturnType<Table['getFieldIfExists']>,
  basisAmount: number,
  multiplierFactor: number
): { amount: number; label: string | null } {
  if (priceField) {
    const p = r.getCellValue(priceField);
    if (typeof p === 'number' && p > 0) return { amount: p, label: null };
  }
  if (percentField) {
    const p = r.getCellValue(percentField);
    // A percent-based row's dollar amount is derived, not stored — surface the
    // rate itself (e.g. "20% base cost") next to the name.
    if (typeof p === 'number' && p > 0) return { amount: basisAmount * p, label: `${Math.round(p * 100)}% base cost` };
  }
  if (multipleField) {
    const raw = r.getCellValue(multipleField);
    // The stored Multiple Fee is a base rate, not the final price — the real
    // formula scales it by Self Usage and the embroidery/paint/lace tier.
    // Surface the raw rate as a label (e.g. "$1,500.00 multiplier") since the
    // Price column now shows the scaled amount.
    if (typeof raw === 'number' && raw > 0) return { amount: raw * multiplierFactor, label: `${formatCurrency(raw)} multiplier` };
  }
  return { amount: 0, label: null };
}

// IF({Customization - Multiple Fee}, {Customization - Multiple Fee}, 0)
//   * IF({Self Usage}, {Self Usage}, 1)
//   * SWITCH(LOWER({Amount of Embroidery/Paint/Lace} & ""), "light", 0.33, "medium", 0.67, "full", 1, 0)
// The raw Multiple Fee term is applied where it's read, in
// resolvePricingRowAmount above — this only covers the Self Usage ×
// embroidery-tier portion, constant across every multiplier-priced line item
// on the same request.
function computeMultiplierFactor(selfUsage: number, embroidery: string | null): number {
  const selfUsageFactor = selfUsage && selfUsage !== 0 ? selfUsage : 1;
  const embroideryFactor = embroidery === 'Light' ? 0.33 : embroidery === 'Medium' ? 0.67 : embroidery === 'Full' ? 1 : 0;
  return selfUsageFactor * embroideryFactor;
}

function formatCurrency(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A lookup/rollup field's raw getCellValue() can be a wrapped object rather
// than a plain number (a bare `as number` cast silently carries that object
// through — formatCurrency on it then reads as blank/garbage rather than the
// real price). getCellValueAsString() already renders it correctly, so parse
// the number back out of that formatted string instead of trusting the raw
// cell shape. Same fix as the Customizations detail interface's Base Price.
//
// The base's number format can be US-style (1,990.00) or EU/LatAm-style
// (1.990,00) — whichever of "." or "," appears LAST is the real decimal
// separator only if followed by 1–2 digits (currency cents); everything
// before it is a thousands-grouping mark and gets stripped. If the trailing
// run is 3+ digits (or there's no separator), there is no decimal part.
function parseCurrencyString(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.,-]/g, '');
  if (!cleaned) return 0;
  const lastSepIndex = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  const trailingDigits = lastSepIndex === -1 ? 0 : cleaned.length - lastSepIndex - 1;
  const normalized = (lastSepIndex !== -1 && trailingDigits > 0 && trailingDigits <= 2)
    ? `${cleaned.slice(0, lastSepIndex).replace(/[.,]/g, '')}.${cleaned.slice(lastSepIndex + 1)}`
    : cleaned.replace(/[.,]/g, '');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// Matches a field/choice name against a concept keyword, normalized (lowercase,
// non-alphanumeric stripped) so naming drift doesn't silently break the match.
function normalizedIncludes(value: string, keyword: string): boolean {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').includes(keyword);
}

function getSingleSelectName(cell: unknown): string {
  if (!cell) return '';
  if (typeof cell === 'object' && 'name' in (cell as object)) return (cell as { name: string }).name ?? '';
  return String(cell);
}

// Airtable color token → saturated accent hex, same mapping used in the
// Customizations detail interface so Pre-Approval pills read identically
// across both interfaces.
const AIRTABLE_COLOR_HEX: Record<string, string> = {
  blueBright: '#2D7FF9',   blueLight1: '#2D7FF9',   blueLight2: '#2D7FF9',   blueDark1: '#1D4FBC',
  cyanBright: '#18BFFF',   cyanLight1: '#18BFFF',   cyanLight2: '#18BFFF',   cyanDark1: '#0D8EBD',
  tealBright: '#06A09B',   tealLight1: '#06A09B',   tealLight2: '#06A09B',   tealDark1: '#06A09B',
  greenBright: '#0B7D2C',  greenLight1: '#0B7D2C',  greenLight2: '#0B7D2C',  greenDark1: '#0B7D2C',
  yellowBright: '#B87503', yellowLight1: '#B87503',  yellowLight2: '#B87503', yellowDark1: '#B87503',
  orangeBright: '#CC3D00', orangeLight1: '#CC3D00',  orangeLight2: '#CC3D00', orangeDark1: '#CC3D00',
  redBright: '#BA1E45',    redLight1: '#BA1E45',     redLight2: '#BA1E45',    redDark1: '#BA1E45',
  pinkBright: '#B2158B',   pinkLight1: '#B2158B',    pinkLight2: '#B2158B',   pinkDark1: '#B2158B',
  purpleBright: '#6B1FBF', purpleLight1: '#6B1FBF',  purpleLight2: '#6B1FBF', purpleDark1: '#6B1FBF',
  grayBright: '#444466',   grayLight1: '#444466',    grayLight2: '#444466',   grayDark1: '#444466',
};

function getChoiceColorMap(field: unknown): Record<string, string> {
  if (!field) return {};
  try {
    const choices = ((field as { options?: { choices?: Array<{ name: string; color?: string }> } })
      .options?.choices ?? []);
    const map: Record<string, string> = {};
    for (const c of choices) {
      map[c.name] = c.color ? (AIRTABLE_COLOR_HEX[c.color] ?? '#9CA3AF') : '#9CA3AF';
    }
    return map;
  } catch { return {}; }
}

function ApprovalPill({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  if (!status) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
  const hex = colorMap[status] ?? '#9CA3AF';
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{ backgroundColor: hex + '20', color: hex, borderColor: hex + '55' }}>
      {status}
    </span>
  );
}

// ─── Source dot + FieldLabel ──────────────────────────────────────────────────
const SOURCE_DOT_COLOR: Record<FieldSource, string> = {
  acuity:        'bg-purple-500',
  shopify:       'bg-green-500',
  apparel_magic: 'bg-amber-500',
};

function FieldLabel({ label, fieldId, className }: { label: string; fieldId?: string; className?: string }) {
  const source = fieldId ? FIELD_SOURCE[fieldId] : undefined;
  return (
    <div className={`flex items-center gap-1.5 mb-1.5 ${className ?? ''}`}>
      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium">{label}</span>
      {source && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SOURCE_DOT_COLOR[source]}`} />}
    </div>
  );
}

// ─── Editable field wrappers ──────────────────────────────────────────────────
// Each wrapper checks isFieldReadOnlyBySource(fieldId) and falls back to a
// plain read-only display whenever the field comes from an external integration.
const _inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#F3EFE6] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]';

interface EditableTextProps {
  label: string; fieldId?: string; readOnly?: boolean;
  value: string; onChange?: (v: string) => void; onBlur?: () => void;
  placeholder?: string; className?: string;
}
function EditableText({ label, fieldId, readOnly, value, onChange, onBlur, placeholder, className }: EditableTextProps) {
  const effectiveRO = readOnly || isFieldReadOnlyBySource(fieldId);
  return (
    <div className={className}>
      <FieldLabel label={label} fieldId={fieldId} />
      {effectiveRO
        ? <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5 min-h-[38px] flex items-center">{value || '—'}</div>
        : <input value={value} onChange={e => onChange?.(e.target.value)} onBlur={onBlur}
            placeholder={placeholder} className={_inputCls} />
      }
    </div>
  );
}

interface EditableTextareaProps {
  label: string; fieldId?: string; readOnly?: boolean;
  value: string; onChange?: (v: string) => void; onBlur?: () => void;
  placeholder?: string; rows?: number;
}
function EditableTextarea({ label, fieldId, readOnly, value, onChange, onBlur, placeholder, rows = 3 }: EditableTextareaProps) {
  const effectiveRO = readOnly || isFieldReadOnlyBySource(fieldId);
  return (
    <div>
      <FieldLabel label={label} fieldId={fieldId} />
      {effectiveRO
        ? <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5 whitespace-pre-wrap">{value || '—'}</div>
        : <textarea value={value} onChange={e => onChange?.(e.target.value)} onBlur={onBlur}
            placeholder={placeholder} rows={rows} className={`${_inputCls} resize-none`} />
      }
    </div>
  );
}

interface EditableNumberProps {
  label: string; fieldId?: string; readOnly?: boolean;
  value: string; onChange?: (v: string) => void; onBlur?: () => void; placeholder?: string;
}
function EditableNumber({ label, fieldId, readOnly, value, onChange, onBlur, placeholder }: EditableNumberProps) {
  const effectiveRO = readOnly || isFieldReadOnlyBySource(fieldId);
  return (
    <div>
      <FieldLabel label={label} fieldId={fieldId} />
      {effectiveRO
        ? <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5 min-h-[38px] flex items-center">{value || '—'}</div>
        : <input type="number" value={value} onChange={e => onChange?.(e.target.value)} onBlur={onBlur}
            placeholder={placeholder}
            className={`${_inputCls} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            style={{ MozAppearance: 'textfield' } as React.CSSProperties} />
      }
    </div>
  );
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────
interface MiniCalProps { selected: Date; onSelect: (d:Date)=>void; onClose: ()=>void; }
function MiniCalendar({ selected, onSelect, onClose }: MiniCalProps) {
  const [view, setView] = useState(new Date(selected));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e:MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return ()=>document.removeEventListener('mousedown', h);
  }, [onClose]);
  const y=view.getFullYear(), m=view.getMonth();
  const start = (new Date(y,m,1).getDay() + 6) % 7;
  const total = new Date(y,m+1,0).getDate();
  const days: (number|null)[] = [];
  for (let i=0;i<start;i++) days.push(null);
  for (let d=1;d<=total;d++) days.push(d);
  const todayStr = fmtDateKey(new Date());
  const selStr = fmtDateKey(selected);
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <button onClick={()=>setView(new Date(y,m-1,1))} className="p-1 hover:bg-gray-100 hover:dark:bg-white/10 rounded"><CaretLeftIcon size={14} className="text-gray-600 dark:text-gray-400"/></button>
        <span className="text-sm font-semibold text-gray-800 dark:text-[#F3EFE6]">{new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(view)}</span>
        <button onClick={()=>setView(new Date(y,m+1,1))} className="p-1 hover:bg-gray-100 hover:dark:bg-white/10 rounded"><CaretRightIcon size={14} className="text-gray-600 dark:text-gray-400"/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 dark:text-gray-500 mb-1">
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day,i) => {
          if (!day) return <div key={`e${i}`} className="py-1"/>;
          const ds = fmtDateKey(new Date(y,m,day));
          return <button key={day} onClick={()=>{onSelect(new Date(y,m,day));onClose();}}
            className={`py-1 text-xs rounded-full transition-colors ${ds===selStr?'bg-[#D97706] dark:bg-[#FBBF24] text-white':ds===todayStr?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24]':'hover:bg-gray-100 hover:dark:bg-white/10 text-gray-800 dark:text-[#F3EFE6]'}`}>{day}</button>;
        })}
      </div>
      <button onClick={()=>{onSelect(new Date());onClose();}} className="mt-2 w-full text-xs text-[#D97706] dark:text-[#FBBF24] hover:underline">Today</button>
    </div>
  );
}

// ─── FilterDropdown ───────────────────────────────────────────────────────────
interface FilterDropdownProps { label:string; values:string[]; options:string[]; onChange:(v:string[])=>void; }
function FilterDropdown({ label, values, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const hasValue = values.length>0;
  const display = hasValue ? (values.length===1?(values[0]??label):`${values.length} selected`) : label;
  const toggle = (o:string) => onChange(values.includes(o)?values.filter(v=>v!==o):[...values,o]);
  return (
    <div className="flex items-center gap-2">
      <div ref={ref} className="relative">
        <button type="button" onClick={()=>setOpen(o=>!o)}
          className={`inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#25211A] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${hasValue?'border-[#D97706] dark:border-[#FBBF24] text-[#D97706] dark:text-[#FBBF24]':'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:dark:border-gray-500'}`}>
          <span className="truncate">{display}</span>
          {hasValue
            ? <XIcon size={14} className="flex-shrink-0 hover:text-red-600 hover:dark:text-red-300"
                onClick={(e)=>{ e.stopPropagation(); onChange([]); }}/>
            : <CaretDownIcon size={14} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open?'rotate-180':''}`}/>
          }
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg max-h-[260px] overflow-y-auto w-[240px] py-1">
            <button type="button" onClick={()=>{onChange([]);setOpen(false);}}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${values.length===0?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium':'text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'}`}>All</button>
            {options.map(o=>(
              <label key={o} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={values.includes(o)} onChange={()=>toggle(o)} className="accent-[#D97706] dark:accent-[#FBBF24]"/>
                <span className="truncate">{o}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StylesDropdown ───────────────────────────────────────────────────────────
interface StylesDropdownProps { selected:string[]; available:string[]; onToggle:(s:string)=>void; }
function StylesDropdown({ selected, available, onToggle }: StylesDropdownProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const filtered = useMemo(()=>q.trim()?available.filter(s=>s.toLowerCase().includes(q.toLowerCase())):available,[available,q]);
  return (
    <div ref={ref} className="relative">
      <div onClick={()=>setOpen(true)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm cursor-pointer bg-white dark:bg-[#25211A] min-h-[42px]">
        {selected.length===0?<span className="text-gray-400 dark:text-gray-500">Select styles…</span>:(
          <div className="flex flex-wrap gap-1.5">
            {selected.map(s=>(
              <span key={s} className="bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#4A3B18] rounded-full text-xs font-medium px-2.5 py-0.5 flex items-center gap-1">
                {s}<button onClick={e=>{e.stopPropagation();onToggle(s);}}><XIcon size={11}/></button>
              </span>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-[260px] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <input type="text" placeholder="Search styles…" value={q} onChange={e=>setQ(e.target.value)} autoFocus
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24]"/>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(s=>{
              const isSel = selected.includes(s);
              return (
                <button key={s} type="button" onClick={()=>onToggle(s)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isSel?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium':'text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSel?'bg-[#D97706] dark:bg-[#FBBF24] border-[#D97706] dark:border-[#FBBF24]':'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#25211A]'}`}>
                    {isSel && <CheckIcon size={10} weight="bold" className="text-white"/>}
                  </span>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AttachmentSection ────────────────────────────────────────────────────────
interface AttachSectionProps {
  label: string;
  type: 'Measurements'|'Appointment Photo';
  existing: Array<{id:string;url:string;filename:string;thumbnails?:{small?:{url:string}}}> | null;
  clientId: string | null;
}
function AttachmentSection({ label, type, existing, clientId }: AttachSectionProps) {
  const hasExisting = existing && existing.length > 0;
  const openForm = () => {
    const url = new URL(ATTACHMENT_FORM_URL);
    if (clientId) url.searchParams.set('prefill_client', clientId);
    url.searchParams.set('prefill_type', type);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };
  return (
    <div>
      {hasExisting && (
        <div className="flex gap-2 flex-wrap mb-3">
          {existing!.map(a=>(
            <div key={a.id} onClick={()=>window.open(a.url,'_blank','noopener,noreferrer')}
              className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0">
              <img src={a.thumbnails?.small?.url??a.url} alt={a.filename} className="w-full h-full object-cover"/>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={openForm} disabled={!clientId}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <UploadIcon size={14} className="text-gray-500 dark:text-gray-400"/>{hasExisting?'Add More':label}
      </button>
    </div>
  );
}

// ─── TodayCard ────────────────────────────────────────────────────────────────
interface TodayCardProps { record:AirtableRecord; apptTable:Table; clientRecords:AirtableRecord[]|null; onClick:()=>void; }
function TodayCard({ record, apptTable, clientRecords, onClick }: TodayCardProps) {
  const timeField  = apptTable.getFieldIfExists(APPT.TIME);
  const typeField  = apptTable.getFieldIfExists(APPT.TYPE);
  const clientLink = apptTable.getFieldIfExists(APPT.CLIENT_LINK);
  const measField  = apptTable.getFieldIfExists(APPT.MEASUREMENTS);
  const photosField= apptTable.getFieldIfExists(APPT.APPT_PHOTOS);
  const timeVal    = timeField ? (record.getCellValue(timeField) as string|null) : null;
  const typeLabel  = typeField ? record.getCellValueAsString(typeField) : '';
  const clientName = clientLink ? record.getCellValueAsString(clientLink) : '';
  const measRaw    = measField ? record.getCellValue(measField) : null;
  const photosRaw  = photosField ? record.getCellValue(photosField) : null;
  const measOk     = !(measRaw===null||measRaw===undefined||measRaw===false||(typeof measRaw==='number'&&measRaw===0)||(typeof measRaw==='string'&&(measRaw.trim()===''||measRaw.startsWith('0 ')))||(Array.isArray(measRaw)&&measRaw.length===0));
  const photosOk   = !(photosRaw===null||photosRaw===undefined||photosRaw===false||(Array.isArray(photosRaw)&&photosRaw.length===0));
  const needsData  = isConsultation(typeLabel) && (!measOk || !photosOk);
  return (
    <div onClick={onClick} className="min-w-[200px] max-w-[220px] bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl p-3 cursor-pointer flex-shrink-0 hover:shadow-md transition-shadow space-y-1">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{timeVal?fmtNYTime(new Date(timeVal)):'—'}</span>
        {needsData && <span className="bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30 rounded-full text-xs font-semibold px-2 py-0.5">Needs data</span>}
      </div>
      <div className="font-semibold text-sm text-gray-900 dark:text-[#F3EFE6]">{clientName||'Unknown Client'}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">{shortTypeLabel(typeLabel)||'Appointment'}</div>
      <div className="flex gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-0.5 ${measOk?'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30':'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30'}`}>
          <RulerIcon size={11}/>{measOk?'Done':'Missing'}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-0.5 ${photosOk?'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30':'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30'}`}>
          <CameraIcon size={11}/>{photosOk?'Done':'Missing'}
        </span>
      </div>
    </div>
  );
}

// ─── Rush fee calculation ──────────────────────────────────────────────────────
// Real Airtable formula (Customizations table, "Rush Fee with Proposed Custom
// Price"): tiered by Leadtime (Weeks) — weeks between today and the wedding —
// applied against Proposed Total Custom Price (Base Price + Customization
// Total, before Rush Fee/M2M-Alterations). Reimplemented client-side because
// in "add" mode no record exists yet for Airtable to compute the real formula
// field against — this is the only way to preview it before save. Shared by
// RushFeeBox's own display and CustomizationModal's Grand Total, so both
// always agree on the same computed fee.
function computeRushFeeTier(leadtimeWeeks: number | null, proposedTotal: number): { percent: number | null; feeAmount: number } {
  if (leadtimeWeeks === null) return { percent: null, feeAmount: 0 };
  const w = leadtimeWeeks;
  let percent: number | null = null;
  if      (w < 24 && w > 20) percent = 0;
  else if (w < 20 && w > 16) percent = 0.10;
  else if (w < 16 && w > 14) percent = 0.15;
  else if (w < 14 && w > 12) percent = 0.20;
  else if (w < 12 && w > 10) percent = 0.30;
  else if (w < 10 && w > 8)  percent = 0.40;
  else if (w < 8  && w > 6)  percent = 0.50;
  else if (w < 6  && w > 4)  percent = 0.75;
  return { percent, feeAmount: percent !== null ? percent * proposedTotal : 0 };
}

// IF(AND({Alterations}, {Made-to-Measure}), 2950, IF({Alterations}, 1950, IF({Made-to-Measure}, 1800, 0)))
// Flat matrix, not a picker of Pricing table rows — M2M and Alterations are
// now plain checkboxes (see CustomizationModal), and this is their combined
// dollar amount for both the live preview and the Order Summary.
function computeAltsM2mAmount(m2m: boolean, alts: boolean): number {
  if (m2m && alts) return 2950;
  if (alts) return 1950;
  if (m2m) return 1800;
  return 0;
}

// ─── RushFeeBox ───────────────────────────────────────────────────────────────
// Only ever rendered when leadtimeWeeks is null (see the call site) — once a
// leadtime is available, the Order Summary's own "Rush Fee (X%)" line
// already communicates the calculated value, so this box would be
// redundant. Its only job is explaining why rush can't be priced yet.
function RushFeeBox() {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <LightningIcon size={13} className="text-amber-600 dark:text-amber-300"/>
        <span className="text-xs font-bold text-amber-700 dark:text-amber-300 capitalize tracking-wider">Rush Fee — Automated Calculation</span>
      </div>
      <div className="text-sm text-amber-800 dark:text-amber-200">
        Rush fee can't be calculated yet because the wedding date isn't filled in.
      </div>
    </div>
  );
}

// ─── CustomizationStagePipeline ───────────────────────────────────────────────
interface CStagePipelineProps { currentStatus: string; onChange: (s:string)=>void; }
function CustomizationStagePipeline({ currentStatus, onChange }: CStagePipelineProps) {
  const idx = CUSTOM_STATUS_STEPS.indexOf(currentStatus as any);
  return (
    <div className="mb-5">
      <div className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-3">Stage</div>
      <div className="flex items-start overflow-x-auto pb-1">
        {CUSTOM_STATUS_STEPS.map((step, i) => {
          const isCurrent = i === idx;
          const isPast = i < idx;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center cursor-pointer min-w-0" onClick={()=>onChange(step)}>
                {isPast && (
                  <div className="w-6 h-6 rounded-full bg-emerald-700 dark:bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <CheckIcon size={12} weight="bold" className="text-white"/>
                  </div>
                )}
                {isCurrent && (
                  <div className="w-6 h-6 rounded-full border-2 border-emerald-700 dark:border-emerald-500 bg-white dark:bg-[#25211A] flex items-center justify-center flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-700 dark:bg-emerald-500"/>
                  </div>
                )}
                {!isPast && !isCurrent && (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#25211A] flex-shrink-0 hover:border-gray-400 hover:dark:border-gray-500 transition-colors"/>
                )}
                <span className={`text-[10px] mt-1.5 text-center leading-tight max-w-[60px] ${isCurrent?'text-emerald-700 dark:text-emerald-400 font-semibold':'text-gray-400 dark:text-gray-500'}`}>
                  {step}
                </span>
              </div>
              {i < CUSTOM_STATUS_STEPS.length-1 && (
                <div className={`flex-1 h-0.5 mt-3 mx-1 min-w-[8px] ${i<idx?'bg-emerald-700 dark:bg-emerald-500':'bg-gray-200 dark:bg-white/10'}`}/>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── PricingLineItemsTable ─────────────────────────────────────────────────────
// Invoice-style, searchable breakdown table for the main Customizations
// picker — replaces the old multi-select dropdown. Search adds a row; the
// total row is always shown, even at $0.00 with no line items. (M2M and
// Alterations no longer use this — they're plain checkboxes now, see
// CustomizationModal.)
interface PricingLineItemsTableProps {
  selected: string[];
  pricingRecords: AirtableRecord[] | null;
  pricingTable: Table | null;
  onChange: (ids: string[]) => void;
  preApprovalField: ReturnType<Table['getFieldIfExists']>;
  preApprovalColorMap: Record<string, string>;
  percentField: ReturnType<Table['getFieldIfExists']>;
  multipleField: ReturnType<Table['getFieldIfExists']>;
  basisAmount: number;
  multiplierFactor: number;
}
function PricingLineItemsTable({
  selected, pricingRecords, pricingTable, onChange,
  preApprovalField, preApprovalColorMap, percentField, multipleField, basisAmount, multiplierFactor,
}: PricingLineItemsTableProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);

  const typeField     = pricingTable?.getFieldIfExists(PRICING.TYPE) ?? null;
  const priceField    = pricingTable?.getFieldIfExists(PRICING.PRICE) ?? null;
  const activeField   = pricingTable?.getFieldIfExists(PRICING.IS_ACTIVE) ?? null;
  // percentField and multipleField come in as props (custom-property bound),
  // not a fixed FIELD_IDS lookup like the rest — see getCustomProperties for
  // why: this interface's connection to the Customization Pricing table
  // doesn't expose either field by their hardcoded IDs (same field IDs DO
  // resolve fine in the Customizations detail interface — Omni's field
  // exposure is per-interface-page-connection, not per-base).

  const selectedItems = useMemo(() => {
    if (!pricingRecords || !typeField) return [];
    return selected.map(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return null;
      const { amount, label } = resolvePricingRowAmount(r, priceField, percentField, multipleField, basisAmount, multiplierFactor);
      return {
        id: r.id,
        name: r.getCellValueAsString(typeField),
        label,
        amount,
        approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '',
      };
    }).filter((x): x is { id: string; name: string; label: string | null; amount: number; approval: string } => x !== null);
  }, [selected, pricingRecords, typeField, priceField, percentField, multipleField, basisAmount, multiplierFactor, preApprovalField]);

  const suggestions = useMemo(() => {
    if (!pricingRecords || !typeField) return [];
    return pricingRecords
      .filter(r => !selected.includes(r.id))
      .filter(r => !activeField || r.getCellValue(activeField) === true)
      .map(r => {
        const { amount, label } = resolvePricingRowAmount(r, priceField, percentField, multipleField, basisAmount, multiplierFactor);
        return { id: r.id, name: r.getCellValueAsString(typeField), label, amount };
      });
  }, [pricingRecords, selected, typeField, activeField, priceField, percentField, multipleField, basisAmount, multiplierFactor]);

  const filteredSuggestions = useMemo(() => {
    if (!query.trim()) return suggestions;
    const q = query.toLowerCase();
    return suggestions.filter(s => s.name.toLowerCase().includes(q));
  }, [suggestions, query]);

  const totalAmount = useMemo(() => selectedItems.reduce((sum, i) => sum + i.amount, 0), [selectedItems]);

  const addAndClear = (id: string) => { onChange([...selected, id]); setQuery(''); setOpen(false); };
  const remove = (id: string) => onChange(selected.filter(x => x !== id));

  return (
    <div>
      <div ref={ref} className="relative mb-2">
        <div className="relative">
          <MagnifyingGlassIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"/>
          <input type="text" placeholder="Search customizations to add…" value={query}
            onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] transition-colors"/>
        </div>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-[260px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filteredSuggestions.map(s=>(
              <button key={s.id} type="button" onClick={()=>addAndClear(s.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#FEF3C7] dark:bg-[#3A2E12] transition-colors border-b border-gray-50 dark:border-white/5 last:border-0">
                <span>{s.name}{s.label && <span className="text-xs font-medium text-gray-400 dark:text-gray-500"> ({s.label})</span>}</span>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{formatCurrency(s.amount)}</span>
              </button>
            ))}
            {filteredSuggestions.length===0 && <div className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">No matching customizations</div>}
          </div>
        )}
      </div>
      <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Customization</th>
              <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Rate</th>
              <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Pre-Approval</th>
              <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map(item=>(
              <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 last:border-0">
                <td className="px-3 py-2.5">
                  <button type="button" onClick={()=>remove(item.id)} aria-label={`Remove ${item.name}`} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors">
                    <XIcon size={13}/>
                  </button>
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-[#F3EFE6]">{item.name}</td>
                <td className="px-3 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">{item.label ?? '—'}</td>
                <td className="px-3 py-2.5"><ApprovalPill status={item.approval} colorMap={preApprovalColorMap}/></td>
                <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 text-right">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
            {selectedItems.length===0 && (
              <tr><td colSpan={5} className="px-3 py-5 text-center text-gray-400 dark:text-gray-500 text-sm">No customizations added yet.</td></tr>
            )}
            <tr className="border-t border-gray-200 dark:border-white/10">
              <td className="px-3 py-2.5"/>
              <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-[#F3EFE6]">Customization Total</td>
              <td className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-[#F3EFE6] text-right">{formatCurrency(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── StyleSelectSingle ────────────────────────────────────────────────────────
interface StyleSelectSingleProps { value:string|null; options:Array<{id:string;label:string}>; placeholder:string; onChange:(id:string|null)=>void; }
function StyleSelectSingle({ value, options, placeholder, onChange }: StyleSelectSingleProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)){setOpen(false);setQ('');} };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const filtered = useMemo(()=>q.trim()?options.filter(o=>o.label.toLowerCase().includes(q.toLowerCase())):options,[options,q]);
  const sel = options.find(o=>o.id===value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center justify-between gap-2 bg-white dark:bg-[#25211A] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-left outline-none hover:border-gray-400 hover:dark:border-gray-500 transition-colors">
        <span className={sel?'text-gray-900 dark:text-[#F3EFE6]':'text-gray-400 dark:text-gray-500'}>{sel?.label??placeholder}</span>
        <CaretDownIcon size={13} className={`text-gray-400 dark:text-gray-500 transition-transform ${open?'rotate-180':''}`}/>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-[260px] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <div className="relative">
              <MagnifyingGlassIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"/>
              <input type="text" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24]"/>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <button type="button" onClick={()=>{onChange(null);setOpen(false);setQ('');}}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${!value?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium':'text-gray-500 dark:text-gray-400 hover:bg-gray-50 hover:dark:bg-white/5'}`}>{placeholder}</button>
            {filtered.map(o=>(
              <button key={o.id} type="button" onClick={()=>{onChange(o.id);setOpen(false);setQ('');}}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${o.id===value?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium':'text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'}`}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CustomizationModal ───────────────────────────────────────────────────────
interface CustomizationModalProps {
  mode: 'add'|'edit';
  existingRecord: AirtableRecord | null;
  customizationsTable: Table | null;
  pricingTable: Table | null;
  pricingRecords: AirtableRecord[] | null;
  stylesRecords: AirtableRecord[] | null;
  stylesBasePriceField: ReturnType<Table['getFieldIfExists']>;
  pricingPercentField: ReturnType<Table['getFieldIfExists']>;
  pricingMultipleField: ReturnType<Table['getFieldIfExists']>;
  selfUsageField: ReturnType<Table['getFieldIfExists']>;
  stylesSelfUsageField: ReturnType<Table['getFieldIfExists']>;
  rushFeeProposedField: ReturnType<Table['getFieldIfExists']>;
  rushFeePercentField: ReturnType<Table['getFieldIfExists']>;
  leadtimeWeeksField: ReturnType<Table['getFieldIfExists']>;
  linkedClientId: string | null;
  favoriteStyleIds: string[];
  clientWeddingIso: string | null;
  clientName: string;
  saName: string;
  saRecordId: string | null;
  proposalsTable: Table | null;
  proposalRecords: AirtableRecord[] | null;
  base: ReturnType<typeof useBase>;
  onClose: () => void;
}

function CustomizationModal({
  mode, existingRecord, customizationsTable, pricingTable, pricingRecords, stylesRecords,
  stylesBasePriceField, pricingPercentField, pricingMultipleField, selfUsageField, stylesSelfUsageField,
  rushFeeProposedField, rushFeePercentField, leadtimeWeeksField,
  linkedClientId, favoriteStyleIds, clientWeddingIso,
  clientName, saName, saRecordId, proposalsTable, proposalRecords,
  base, onClose
}: CustomizationModalProps) {
  const custTable = customizationsTable ?? base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATIONS);

  // ── Field refs ────────────────────────────────────────────────────────────
  const fStatus     = custTable?.getFieldIfExists(CUSTOM.STATUS)                ?? null;
  const fStyled     = custTable?.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE)      ?? null;
  const fPricing    = custTable?.getFieldIfExists(CUSTOM.CUSTOMIZATION_PRICING) ?? null;
  const fDetail     = custTable?.getFieldIfExists(CUSTOM.CUSTOMIZATION_DETAIL)  ?? null;
  const fEmbroidery = custTable?.getFieldIfExists(CUSTOM.EMBROIDERY_AMOUNT)     ?? null;
  const fM2m        = custTable?.getFieldIfExists(CUSTOM.M2M)                   ?? null;
  const fAlts       = custTable?.getFieldIfExists(CUSTOM.ALTERATIONS)           ?? null;
  const fRush       = custTable?.getFieldIfExists(CUSTOM.RUSH)                  ?? null;
  const fClient     = custTable?.getFieldIfExists(CUSTOM.CLIENT)                ?? null;
  const fSlack      = custTable?.getFieldIfExists(CUSTOM.SEND_TO_SLACK)         ?? null;

  // ── State ─────────────────────────────────────────────────────────────────
  const initStyle = () => {
    if (!existingRecord || !fStyled) return null;
    const v = existingRecord.getCellValue(fStyled) as Array<{id:string}>|null;
    return v?.[0]?.id ?? null;
  };
  const initPricing = () => {
    if (!existingRecord || !fPricing) return [];
    const v = existingRecord.getCellValue(fPricing) as Array<{id:string}>|null;
    return v?.map(x=>x.id) ?? [];
  };
  const initStatus = () => {
    if (!existingRecord || !fStatus) return 'Sent to Production';
    return existingRecord.getCellValueAsString(fStatus) || 'Sent to Production';
  };

  const [status,      setStatus]      = useState(initStatus());
  const [styleId,     setStyleId]     = useState<string|null>(initStyle());
  const [pricingIds,  setPricingIds]  = useState<string[]>(initPricing());
  const [detail,      setDetail]      = useState(existingRecord && fDetail ? existingRecord.getCellValueAsString(fDetail) : '');
  const [embroidery,  setEmbroidery]  = useState<string|null>(existingRecord && fEmbroidery ? existingRecord.getCellValueAsString(fEmbroidery)||null : null);
  // M2M and Alterations are plain checkboxes — their combined dollar amount
  // is a flat lookup matrix (see computeAltsM2mAmount below), not a picker of
  // Pricing table rows.
  const [m2m,         setM2m]         = useState(existingRecord && fM2m ? !!(existingRecord.getCellValue(fM2m) as boolean|null) : false);
  const [alts,        setAlts]        = useState(existingRecord && fAlts ? !!(existingRecord.getCellValue(fAlts) as boolean|null) : false);
  // Rush defaults on for a brand-new request; an existing record's stored
  // value always wins once one exists.
  const [rush,        setRush]        = useState(() => existingRecord && fRush ? !!(existingRecord.getCellValue(fRush) as boolean|null) : mode === 'add');
  const [saving, setSaving] = useState(false);

  // Pre-Approval has no fixed field ID — matched by normalized name, same as
  // the Customizations detail interface.
  const preApprovalField = useMemo(
    () => pricingTable?.fields.find(f => normalizedIncludes(f.name, 'preapproval')) ?? null,
    [pricingTable]
  );
  const preApprovalColorMap = useMemo(() => getChoiceColorMap(preApprovalField), [preApprovalField]);

  // ── Base price from selected style ────────────────────────────────────────
  const basePrice = useMemo(()=>{
    if (!styleId || !stylesRecords || !stylesBasePriceField) return null;
    const rec = stylesRecords.find(r=>r.id===styleId);
    if (!rec) return null;
    return parseCurrencyString(rec.getCellValueAsString(stylesBasePriceField));
  }, [styleId, stylesRecords, stylesBasePriceField]);
  const basePriceNumber = basePrice ?? 0;

  // Self Usage (Customizations table) is a lookup off the Customized Style
  // link, so it's only readable once a Customizations record actually
  // exists — fine in "edit" mode, but "add" mode has no record yet. There,
  // fall back to reading the underlying number straight off the selected
  // Styles record (stylesSelfUsageField), the same way Base Price already
  // works pre-save — a best-effort preview, not the authoritative value.
  const selfUsageValue = useMemo(()=>{
    if (mode === 'edit' && existingRecord && selfUsageField) {
      return parseCurrencyString(existingRecord.getCellValueAsString(selfUsageField));
    }
    if (styleId && stylesRecords && stylesSelfUsageField) {
      const rec = stylesRecords.find(r=>r.id===styleId);
      if (rec) return parseCurrencyString(rec.getCellValueAsString(stylesSelfUsageField));
    }
    return 0;
  }, [mode, existingRecord, selfUsageField, styleId, stylesRecords, stylesSelfUsageField]);
  const multiplierFactor = useMemo(
    () => computeMultiplierFactor(selfUsageValue, embroidery),
    [selfUsageValue, embroidery]
  );

  // ── Order summary — Grand Total combines every section below ─────────────
  const pPriceField = pricingTable?.getFieldIfExists(PRICING.PRICE) ?? null;
  // pricingMultipleField comes in as a prop (custom-property bound), not a
  // fixed FIELD_IDS lookup — see getCustomProperties for why.
  const sumPricingIds = useCallback((ids: string[]) => {
    if (!pricingRecords) return 0;
    return ids.reduce((sum, id) => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return sum;
      return sum + resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor).amount;
    }, 0);
  }, [pricingRecords, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor]);

  const customizationTotal = useMemo(() => sumPricingIds(pricingIds), [sumPricingIds, pricingIds]);
  // IF(AND(Alterations, Made-to-Measure), 2950, IF(Alterations, 1950, IF(Made-to-Measure, 1800, 0)))
  const altsM2mAmount = useMemo(() => computeAltsM2mAmount(m2m, alts), [m2m, alts]);

  const proposedTotalCustomPrice = basePriceNumber + customizationTotal;
  // Leadtime (Weeks) and "Rush Fee with Proposed Custom Price" don't exist
  // yet for a record that hasn't been created ("add" mode) — fall back to a
  // client-side estimate there (weeks until the wedding). In "edit" mode,
  // prefer the real Leadtime (Weeks) field once it's present: our own
  // weeksUntil(clientWeddingIso) can diverge from it (e.g. if the real
  // formula falls back to a different date when Wedding is blank), which
  // was showing "Wedding: Unknown" / "no fee" even when Leadtime actually
  // had a value.
  const leadtimeWeeks = useMemo(() => {
    if (mode === 'edit' && existingRecord && leadtimeWeeksField) {
      const raw = existingRecord.getCellValueAsString(leadtimeWeeksField);
      if (raw) return parseCurrencyString(raw);
    }
    return weeksUntil(clientWeddingIso);
  }, [mode, existingRecord, leadtimeWeeksField, clientWeddingIso]);
  const clientRushEstimate = useMemo(
    () => computeRushFeeTier(leadtimeWeeks, proposedTotalCustomPrice),
    [leadtimeWeeks, proposedTotalCustomPrice]
  );
  const useStoredRushFee = mode === 'edit' && !!existingRecord && !!rushFeeProposedField;
  const rushFeeAmount = useMemo(() => {
    if (!rush) return 0;
    if (useStoredRushFee) return parseCurrencyString(existingRecord!.getCellValueAsString(rushFeeProposedField!));
    return clientRushEstimate.feeAmount;
  }, [rush, useStoredRushFee, existingRecord, rushFeeProposedField, clientRushEstimate]);
  const rushFeePercentDisplay = useMemo(() => {
    if (mode === 'edit' && existingRecord && rushFeePercentField) return existingRecord.getCellValueAsString(rushFeePercentField);
    return clientRushEstimate.percent !== null ? `${Math.round(clientRushEstimate.percent * 100)}%` : '';
  }, [mode, existingRecord, rushFeePercentField, clientRushEstimate]);

  const grandTotal = basePriceNumber + customizationTotal + altsM2mAmount + rushFeeAmount;

  // ── Generate Proposal ─────────────────────────────────────────────────────
  const [showProposalPreview, setShowProposalPreview] = useState(false);
  const [viewProposalId, setViewProposalId]           = useState<string|null>(null);
  const pTypeField = pricingTable?.getFieldIfExists(PRICING.TYPE) ?? null;

  const styleName = useMemo(
    () => (styleId ? (stylesRecords?.find(r=>r.id===styleId)?.name ?? '') : ''),
    [styleId, stylesRecords]
  );

  const proposalMissing = useMemo(() => {
    if (mode !== 'edit') return [];
    const missing: string[] = [];
    if (!styleName) missing.push('Customized Style');
    if (pricingIds.length === 0) missing.push('at least one selected customization');
    if (!embroidery) missing.push('Amount of Embroidery/Paint/Lace');
    if (grandTotal <= 0) missing.push('a calculated price greater than $0');
    if (!linkedClientId) missing.push('client');
    if (!saName) missing.push('sales associate');
    return missing;
  }, [mode, styleName, pricingIds, embroidery, grandTotal, linkedClientId, saName]);
  const canGenerateProposal = mode === 'edit' && !!existingRecord && proposalMissing.length === 0;

  // Same values already shown in this modal's own Order Summary — the printed
  // proposal is guaranteed to match what's on screen because it's built from
  // these, not re-derived from the record.
  const proposalSnapshot = useMemo<ProposalSnapshot | null>(() => {
    if (!canGenerateProposal || !pTypeField) return null;
    const lineItems: ProposalLineItem[] = pricingIds
      .map(id => {
        const r = pricingRecords?.find(pr=>pr.id===id);
        if (!r) return null;
        const { amount, label } = resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor);
        return {
          id: r.id,
          name: r.getCellValueAsString(pTypeField),
          label,
          amount,
          approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '',
        };
      })
      .filter((x): x is ProposalLineItem => x !== null);
    return {
      styleName,
      lineItems,
      basePriceNumber,
      customizationTotal,
      embroideryAmount: embroidery ?? '',
      m2m, alts, rush,
      altsM2mAmount,
      rushFeeAmount,
      rushFeePercentDisplay,
      grandTotal,
    };
  }, [canGenerateProposal, pTypeField, pricingIds, pricingRecords, pPriceField, pricingPercentField, pricingMultipleField,
      basePriceNumber, multiplierFactor, preApprovalField, styleName, customizationTotal, embroidery, m2m, alts, rush,
      altsM2mAmount, rushFeeAmount, rushFeePercentDisplay, grandTotal]);

  const customizationProposals = useMemo(() => {
    if (!proposalRecords || !existingRecord || !proposalsTable) return [];
    const fSourceP = proposalsTable.getFieldIfExists(PROPOSAL.SOURCE_CUSTOMIZATION);
    if (!fSourceP) return [];
    return proposalRecords.filter(r => {
      const lnk = r.getCellValue(fSourceP) as Array<{id:string}>|null;
      return lnk?.some(l=>l.id===existingRecord.id) ?? false;
    });
  }, [proposalRecords, proposalsTable, existingRecord]);

  // ── Auto-save for edit mode ───────────────────────────────────────────────
  const autoSave = useCallback((patch: Record<string,unknown>) => {
    if (mode !== 'edit' || !custTable || !existingRecord) return;
    queueWrite(()=>custTable!.updateRecordAsync(existingRecord.id, patch))
      .catch(err=>console.error('Customization auto-save failed:', err));
  }, [mode, custTable, existingRecord]);

  const handleStatus     = (s:string) => { setStatus(s); autoSave({ [CUSTOM.STATUS]: { name: s } }); };
  const handleStyleId    = (id:string|null) => { setStyleId(id); if (fStyled) autoSave({ [fStyled.id]: id ? [{id}] : null }); };
  const handlePricing    = (ids:string[]) => { setPricingIds(ids); if (fPricing) autoSave({ [fPricing.id]: ids.map(id=>({id})) }); };
  const handleDetail     = () => { if (fDetail) autoSave({ [fDetail.id]: detail || null }); };
  const handleEmbroidery = (v:string|null) => { setEmbroidery(v); if (fEmbroidery) autoSave({ [fEmbroidery.id]: v ? { name: v } : null }); };
  const handleM2m         = (v:boolean) => { setM2m(v); if (fM2m) autoSave({ [fM2m.id]: v }); };
  const handleAlts        = (v:boolean) => { setAlts(v); if (fAlts) autoSave({ [fAlts.id]: v }); };
  const handleRush        = (v:boolean) => { setRush(v); if (fRush) autoSave({ [fRush.id]: v }); };

  const handleSave = async () => {
    if (!custTable || mode !== 'add') return;
    setSaving(true);
    try {
      const fields: Record<string,unknown> = {};
      if (fStatus)   fields[CUSTOM.STATUS]    = { name: 'Sent to Production' };
      if (fStyled && styleId) fields[CUSTOM.CUSTOMIZED_STYLE] = [{ id: styleId }];
      if (fPricing && pricingIds.length) fields[CUSTOM.CUSTOMIZATION_PRICING] = pricingIds.map(id=>({id}));
      if (fDetail)   fields[CUSTOM.CUSTOMIZATION_DETAIL] = detail || null;
      if (fEmbroidery && embroidery) fields[CUSTOM.EMBROIDERY_AMOUNT] = { name: embroidery };
      if (fM2m)      fields[CUSTOM.M2M]        = m2m;
      if (fAlts)     fields[CUSTOM.ALTERATIONS] = alts;
      if (fRush)     fields[CUSTOM.RUSH]        = rush;
      if (fClient && linkedClientId) fields[CUSTOM.CLIENT] = [{ id: linkedClientId }];
      if (fSlack)    fields[CUSTOM.SEND_TO_SLACK] = true;
      await queueWrite(()=>custTable!.createRecordAsync(fields));
      onClose();
    } catch (err) { console.error('Failed to add customization:', err); }
    finally { setSaving(false); }
  };

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') onClose(); };
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[onClose]);

  // Style dropdown is scoped to the client's own Favorite Styles in
  // Appointment, not every style in the base. Falls back to the full list
  // when the client has none recorded, and always keeps whatever style is
  // already selected even if it isn't a favorite — narrows new picks,
  // doesn't hide an existing one.
  const styleOptions = useMemo(()=>{
    const all = stylesRecords ?? [];
    const base = favoriteStyleIds.length > 0
      ? all.filter(r=>favoriteStyleIds.includes(r.id) || r.id===styleId)
      : all;
    return base.map(r=>({id:r.id, label:r.name})).sort((a,b)=>a.label.localeCompare(b.label));
  },[stylesRecords, favoriteStyleIds, styleId]);
  const embroideryOptions = [{id:'Light',label:'Light'},{id:'Medium',label:'Medium'},{id:'Full',label:'Full'}];

  const labelCls = 'text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#F3EFE6] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]';

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ backgroundColor:'rgba(0,0,0,0.18)', backdropFilter:'blur(1px)' }}
      onClick={e=>{ if (e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="border-b border-gray-100 dark:border-white/5">
          <div className="p-5 flex items-center gap-3">
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 hover:dark:text-gray-300 transition-colors">
              <ArrowLeftIcon size={18}/>
            </button>
            <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] flex-1">{mode==='add'?'Add Customization Request':'Edit Customization'}</div>
            {mode === 'edit' && (
              <button type="button" disabled={!canGenerateProposal} onClick={()=>setShowProposalPreview(true)}
                title={canGenerateProposal ? 'Generate Proposal' : `Missing: ${proposalMissing.join(', ')}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white dark:text-[#1B1813] bg-[#D97706] dark:bg-[#FBBF24] rounded-lg hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                <FileTextIcon size={14}/>Generate Proposal
              </button>
            )}
          </div>
          {mode === 'edit' && !canGenerateProposal && (
            <div className="px-5 pb-3 -mt-2 text-[11px] text-red-500 dark:text-red-400">
              Missing for proposal: {proposalMissing.join(', ')}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stage pipeline — edit mode only */}
          {mode === 'edit' && (
            <CustomizationStagePipeline currentStatus={status} onChange={handleStatus}/>
          )}

          {/* Proposals generated from this customization request — chip label
              is the record's own primary field (proposal_id formula). */}
          {mode === 'edit' && proposalsTable && customizationProposals.length > 0 && (
            <div>
              <span className={labelCls}>Proposals</span>
              <div className="flex flex-wrap gap-2">
                {customizationProposals.map(p=>{
                  const fStatusP = proposalsTable.getFieldIfExists(PROPOSAL.STATUS);
                  const statusStr = fStatusP ? p.getCellValueAsString(fStatusP) : '';
                  const isSigned = statusStr === 'Signed';
                  return (
                    <button key={p.id} type="button"
                      onClick={()=>setViewProposalId(p.id)}
                      title="View proposal"
                      className={`rounded-full text-xs font-medium px-3 py-1 border transition-colors ${isSigned
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 hover:dark:bg-emerald-500/25'
                        : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-100 hover:dark:bg-white/10'}`}>
                      {p.name || 'Proposal'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customized Style — invoice-style row; Base Price is a lookup off
              the selected style. No overflow-hidden on the wrapper: the style
              picker's dropdown is absolutely positioned and pops out below
              the row, so clipping the container would clip and break it. */}
          <div>
            <span className={labelCls}>Customized Style</span>
            {/* No background/border here — this is a single fixed row, not an
                invoice table, so nothing implies more than one row could exist. */}
            <div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Style</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-right">Base Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2.5">
                      <StyleSelectSingle value={styleId} options={styleOptions} placeholder="Select a style…" onChange={handleStyleId}/>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-[#F3EFE6] text-right">{formatCurrency(basePriceNumber)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Embroidery Amount */}
          <div>
            <span className={labelCls}>Embroidery Amount</span>
            <div className="flex gap-2">
              {embroideryOptions.map(o=>(
                <button key={o.id} type="button" onClick={()=>handleEmbroidery(embroidery===o.id?null:o.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${embroidery===o.id?'bg-[#D97706] dark:bg-[#FBBF24] border-[#D97706] dark:border-[#FBBF24] text-white':'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customizations — invoice-style, searchable breakdown table */}
          <div>
            <span className={labelCls}>Customizations</span>
            <PricingLineItemsTable
              selected={pricingIds}
              pricingRecords={pricingRecords}
              pricingTable={pricingTable}
              onChange={handlePricing}
              preApprovalField={preApprovalField}
              preApprovalColorMap={preApprovalColorMap}
              percentField={pricingPercentField}
              multipleField={pricingMultipleField}
              basisAmount={basePriceNumber}
              multiplierFactor={multiplierFactor}
            />
          </div>

          {/* Flags */}
          <div>
            <span className={labelCls}>Flags</span>
            <div className="flex gap-2 mb-3">
              {([
                { label:'M2M',         active:m2m,  toggle:()=>handleM2m(!m2m),   color:'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30' },
                { label:'Alterations', active:alts, toggle:()=>handleAlts(!alts), color:'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/30' },
                { label:'Rush',        active:rush, toggle:()=>handleRush(!rush), color:'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-500/30' },
              ] as const).map(f=>(
                <button key={f.label} type="button" onClick={f.toggle}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${f.active?f.color:'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 bg-white dark:bg-[#25211A] hover:bg-gray-50 hover:dark:bg-white/5'}`}>
                  {f.active && <CheckIcon size={11} weight="bold"/>}
                  {f.label}
                </button>
              ))}
            </div>

            {/* Rush fee calculation — only shown when leadtime genuinely
                can't be determined yet (no wedding date). Once it can, the
                Order Summary's "Rush Fee (X%)" line covers it. */}
            {rush && leadtimeWeeks === null && <RushFeeBox />}
          </div>

          {/* Order Summary — Base Price + every section above, folded into one Grand Total */}
          <div className="pt-2">
            <span className={labelCls}>Order Summary</span>
            {([
              { label: 'Base Price',          amount: basePriceNumber, sub: null as string | null },
              { label: 'Customization Total', amount: customizationTotal, sub: null },
              ...((m2m || alts) ? [{ label: 'M2M / Alterations', amount: altsM2mAmount, sub: null }] : []),
              ...(rush ? [{ label: 'Rush Fee', amount: rushFeeAmount, sub: rushFeePercentDisplay || null }] : []),
            ]).map(({ label, amount, sub }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {label}
                  {sub && <span className="text-xs font-medium text-gray-400 dark:text-gray-500"> ({sub})</span>}
                </span>
                <span className="text-sm text-gray-900 dark:text-[#F3EFE6]">{formatCurrency(amount)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center font-bold text-gray-900 dark:text-[#F3EFE6] border-t border-gray-300 dark:border-gray-600 pt-2">
              <span className="text-sm">Grand Total</span>
              <span className="text-sm">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Customization Detail */}
          <div>
            <span className={labelCls}>Customization Detail</span>
            <textarea value={detail} onChange={e=>setDetail(e.target.value)} onBlur={handleDetail}
              placeholder="Describe the specific customization — e.g., 'Spaghetti → wide straps, deep V-neck to scoop, champagne colorway'"
              rows={3} className={`${inputCls} resize-none`}/>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end items-center">
          {mode==='add' && (
            <button onClick={handleSave} disabled={saving || !styleId}
              className="bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] rounded-lg px-5 py-2 text-sm font-semibold hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-50">
              {saving?'Adding…':'Add Customization'}
            </button>
          )}
        </div>
      </div>
    </div>

      {showProposalPreview && proposalSnapshot && linkedClientId && existingRecord && (
        <ProposalPreviewModal
          snapshot={proposalSnapshot}
          clientName={clientName}
          clientId={linkedClientId}
          saName={saName}
          saRecordId={saRecordId}
          customizationId={existingRecord.id}
          proposalsTable={proposalsTable}
          onClose={()=>setShowProposalPreview(false)}
        />
      )}

      {viewProposalId && proposalsTable && (() => {
        const rec = proposalRecords?.find(r=>r.id===viewProposalId) ?? null;
        if (!rec) return null;
        return (
          <ProposalDetailModal
            proposalRecord={rec}
            proposalsTable={proposalsTable}
            clientName={clientName}
            saName={saName}
            onClose={()=>setViewProposalId(null)}
          />
        );
      })()}
    </>
  );
}

// ─── Proposal snapshot ─────────────────────────────────────────────────────────
// Built directly from CustomizationModal's own already-computed values (see
// its "Generate Proposal" section) — not re-derived from scratch — so the
// numbers and line items on the printed document are guaranteed to match
// exactly what that modal displays. Copied into the Proposal record verbatim
// at save time, so a later edit to the source Customization can't silently
// change an already-generated proposal.
interface ProposalLineItem {
  id: string;
  name: string;
  label: string | null;
  amount: number;
  approval: string;
}
interface ProposalSnapshot {
  styleName: string;
  lineItems: ProposalLineItem[];
  basePriceNumber: number;
  customizationTotal: number;
  embroideryAmount: string;
  m2m: boolean;
  alts: boolean;
  rush: boolean;
  altsM2mAmount: number;
  rushFeeAmount: number;
  rushFeePercentDisplay: string;
  grandTotal: number;
}

// ─── ProposalPreviewModal ─────────────────────────────────────────────────────
// Opened from "Generate Proposal". Print → Confirm & Save creates the Proposal
// record (client/sales associate/source customization links + snapshot
// values, status "Generated"). The record is created WITHOUT
// unsigned_document: the Interface Extensions SDK only accepts attachment
// cell values shaped as { url, filename } — it can't take a local File
// directly (confirmed by Airtable's own write-time validation error) — so
// there is no way to push a file living only on the user's disk into an
// attachment field from this code. Once the record exists, the last step
// hands off to Airtable's own record page (which has no such restriction) so
// the user drops the printed PDF onto unsigned_document there directly —
// same reasoning as AttachmentSection's external-form handoff elsewhere in
// this file, just targeting the record we just created instead of a form.
//
// The Close countdown only guards against closing before the document has
// even been seen — once Confirm & Save succeeds, closing is immediate and
// unconditional.
const PROPOSAL_CLOSE_COUNTDOWN_SECONDS = 8;

interface ProposalPreviewModalProps {
  snapshot: ProposalSnapshot;
  clientName: string;
  clientId: string;
  saName: string;
  saRecordId: string | null;
  customizationId: string;
  proposalsTable: Table | null;
  onClose: () => void;
}
function ProposalPreviewModal({
  snapshot, clientName, clientId, saName, saRecordId, customizationId, proposalsTable, onClose,
}: ProposalPreviewModalProps) {
  const [countdown, setCountdown]     = useState(PROPOSAL_CLOSE_COUNTDOWN_SECONDS);
  // Not just set synchronously on click — the print dialog itself is async and
  // OS-native, so the only signal this page actually gets that printing (or a
  // "Save as PDF") really happened is the browser's own `afterprint` event.
  // There's no way to know from here whether the user actually saved a file
  // vs. cancelled the dialog — no browser API exposes that — but requiring
  // `afterprint` is strictly closer to "a file was produced" than assuming it
  // the instant Print is clicked.
  const [printed, setPrinted]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string|null>(null);
  const [createdRecordId, setCreatedRecordId] = useState<string|null>(null);
  const [generatedAt]                 = useState(() => new Date());

  const success = !!createdRecordId;
  const closeEnabled = countdown <= 0 || success;

  // Single interval started on mount, ticking down to 0 — not restarted per
  // render, so it can't drift or reset while the user interacts with the modal.
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // document.title is the only lever a web page has over the "Save as PDF"
  // dialog's suggested filename — set it just before printing, restore it
  // once the dialog closes.
  const originalTitleRef = useRef(document.title);
  useEffect(() => {
    const h = () => { setPrinted(true); document.title = originalTitleRef.current; };
    window.addEventListener('afterprint', h);
    return () => window.removeEventListener('afterprint', h);
  }, []);
  const handlePrint = () => {
    document.title = buildProposalFilename(clientName, snapshot.styleName, generatedAt);
    window.print();
  };

  // Escape is intercepted (not just ignored) while the countdown runs, same as
  // the click-outside guard below — neither can close the modal early.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && closeEnabled) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [closeEnabled, onClose]);

  const handleConfirmSave = async () => {
    if (!proposalsTable || saving || success) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const customizationsSummary = [
        snapshot.lineItems.length
          ? `Selections: ${snapshot.lineItems.map(i => `${i.name}${i.label ? ` (${i.label})` : ''} — ${formatCurrency(i.amount)}`).join('; ')}`
          : null,
        (snapshot.m2m || snapshot.alts) ? `M2M / Alterations: ${formatCurrency(snapshot.altsM2mAmount)}` : null,
        snapshot.rush ? `Rush Fee: ${formatCurrency(snapshot.rushFeeAmount)}${snapshot.rushFeePercentDisplay ? ` (${snapshot.rushFeePercentDisplay})` : ''}` : null,
      ].filter(Boolean).join('\n') || '—';

      const fields: Record<string, unknown> = {
        [PROPOSAL.CLIENT]:                     [{ id: clientId }],
        [PROPOSAL.SOURCE_CUSTOMIZATION]:        [{ id: customizationId }],
        [PROPOSAL.SNAPSHOT_STYLE]:              snapshot.styleName,
        [PROPOSAL.SNAPSHOT_CUSTOMIZATIONS]:     customizationsSummary,
        [PROPOSAL.SNAPSHOT_EMBROIDERY_AMOUNT]:  { name: snapshot.embroideryAmount },
        [PROPOSAL.SNAPSHOT_PRICING]:            snapshot.grandTotal,
        [PROPOSAL.STATUS]:                      { name: 'Generated' },
      };
      if (saRecordId) fields[PROPOSAL.SALES_ASSOCIATE] = [{ id: saRecordId }];
      const newId = await queueWrite(() => proposalsTable!.createRecordAsync(fields));
      setCreatedRecordId(newId);
    } catch (err) {
      console.error('Failed to save proposal:', err);
      setErrorMsg('Failed to save the proposal. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Users generally don't have direct Airtable access, so instead of linking
  // to the record itself, hand off to the same attachments form already used
  // for Measurements/Appointment Photos — prefilled so the only thing left
  // visible/actionable is the file picker. A sandbox-side automation (see
  // automations/danielle_frankel_studios/proposal_attachment_router.js)
  // copies the uploaded file onto this Proposal's unsigned_document.
  const openAttachmentForm = () => {
    if (!createdRecordId) return;
    window.open(buildProposalAttachmentFormUrl(clientId, createdRecordId, 'Customization Proposal'), '_blank', 'noopener,noreferrer');
  };

  // Zero-amount fees add no information on a client-facing proposal — skip them.
  const orderSummaryRows: Array<{ label: string; amount: number; sub: string | null }> = [
    { label: 'Base Price',          amount: snapshot.basePriceNumber,  sub: null },
    { label: 'Customization Total', amount: snapshot.customizationTotal, sub: null },
    ...((snapshot.m2m || snapshot.alts) ? [{ label: 'M2M / Alterations', amount: snapshot.altsM2mAmount, sub: null }] : []),
    ...(snapshot.rush ? [{ label: 'Rush Fee', amount: snapshot.rushFeeAmount, sub: snapshot.rushFeePercentDisplay || null }] : []),
  ].filter(row => row.amount !== 0);

  return (
    // Blur only — no dark dim — behind this popup.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 proposal-modal-chrome"
      style={{ backdropFilter:'blur(4px)' }}
      onClick={e=>{ if (e.target===e.currentTarget && closeEnabled) onClose(); }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .proposal-print-area, .proposal-print-area * { visibility: visible !important; }
          .proposal-print-area {
            position: absolute; top: 0; left: 0; width: 100%; padding: 32px;
            background: #ffffff !important; color: #111111 !important;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-white/10"
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] flex-1">Generate Proposal</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Document — the only thing that survives @media print. On-screen it
              uses the app's own background tint; print forces plain white
              paper regardless (see @media print above). */}
          <div className="proposal-print-area bg-[#F8F5EE] text-[#111111] rounded-xl border border-gray-200 dark:border-white/10 p-6">
            <div className="text-2xl font-bold mb-1">Danielle Frankel Studios</div>
            <div className="text-sm text-gray-500 mb-6">Customization Proposal</div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-sm"><span className="capitalize text-gray-500">Client: </span><span className="font-medium">{clientName}</span></div>
              <div className="text-sm"><span className="capitalize text-gray-500">Sales Associate: </span><span className="font-medium">{saName || '—'}</span></div>
              <div className="text-sm"><span className="capitalize text-gray-500">Style: </span><span className="font-medium">{snapshot.styleName}</span></div>
              <div className="text-sm"><span className="capitalize text-gray-500">Amount of Embroidery/Paint/Lace: </span><span className="font-medium">{snapshot.embroideryAmount}</span></div>
            </div>

            {/* Customizations — name + price only, no field title above the table */}
            <div className="mb-6">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {snapshot.lineItems.map(item=>(
                      <tr key={item.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2.5 text-sm text-gray-900">{item.name}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-700 text-right">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    {snapshot.lineItems.length===0 && (
                      <tr><td colSpan={2} className="px-3 py-5 text-center text-gray-400 text-sm">No customizations added.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Order Summary — flags (M2M/Alterations/Rush) only appear here, as
                rows, exactly like the Customization detail page's own summary. */}
            <div className="mb-6">
              <div className="text-xs capitalize tracking-wide text-gray-400 mb-2">Order Summary</div>
              {orderSummaryRows.map(({ label, amount, sub }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">
                    {label}
                    {sub && <span className="text-xs font-medium text-gray-400"> ({sub})</span>}
                  </span>
                  <span className="text-sm text-gray-900">{formatCurrency(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center font-bold text-gray-900 border-t border-gray-300 pt-2">
                <span className="text-sm">Grand Total</span>
                <span className="text-sm">{formatCurrency(snapshot.grandTotal)}</span>
              </div>
            </div>

            <div className="text-xs text-gray-400">Generated {fmtDisplay(generatedAt)}</div>
          </div>

          {!printed && (
            <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-white/5">
              Print (or save as PDF) to unlock saving the proposal.
            </div>
          )}

          {printed && !success && errorMsg && (
            <div className="text-sm text-red-600 dark:text-red-400 pt-2 border-t border-gray-100 dark:border-white/5">{errorMsg}</div>
          )}

        </div>

        {/* Footer — Close/Print/Confirm & Save while pending; once saved,
            those three disappear and only Upload Generated Proposal remains. */}
        <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end items-center gap-3">
          {success ? (
            <button type="button" onClick={openAttachmentForm}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white dark:text-[#1B1813] bg-[#D97706] dark:bg-[#FBBF24] rounded-lg hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors">
              <UploadIcon size={14}/>Upload Generated Proposal
            </button>
          ) : (
            <>
              <button type="button" onClick={()=>{ if (closeEnabled) onClose(); }} disabled={!closeEnabled}
                className="px-5 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {closeEnabled ? 'Close' : `Close (${countdown})`}
              </button>
              <button type="button" onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-700 hover:dark:bg-gray-200 transition-colors">
                <PrinterIcon size={14}/>Print
              </button>
              {printed && (
                <button type="button" onClick={handleConfirmSave} disabled={saving}
                  className="bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] rounded-lg px-5 py-2 text-sm font-semibold hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : errorMsg ? 'Retry' : 'Confirm & Save'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ProposalAttachmentField ────────────────────────────────────────────────
// One row inside ProposalDetailModal: either an "Upload" button (attachment
// not present yet) or a thumbnail + Download once it is. Shared between the
// unsigned and signed sections since both behave identically — only the
// label, files, and upload handler differ.
type ProposalFile = { id: string; url: string; filename: string; thumbnails?: { small?: { url: string }; large?: { url: string } } };
interface ProposalAttachmentFieldProps {
  label: string;
  files: ProposalFile[];
  onUpload: () => void;
  uploadDisabledReason?: string;
  // Suggested filename (without extension) — client_style_date_time,
  // snake_case. Falls back to the attachment's own filename if omitted.
  downloadBaseName?: string;
}
function ProposalAttachmentField({ label, files, onUpload, uploadDisabledReason, downloadBaseName }: ProposalAttachmentFieldProps) {
  const labelCls = 'text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const file = files[0];
  const downloadName = file ? (downloadBaseName ? `${downloadBaseName}${fileExtension(file.filename)}` : file.filename) : '';
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {file ? (
        <div className="flex items-center gap-3">
          {/* Opens in the same tab, per request — this navigates the interface away. */}
          <div onClick={()=>window.open(file.url, '_self')}
            className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0">
            <img src={file.thumbnails?.large?.url ?? file.thumbnails?.small?.url ?? file.url} alt={file.filename} className="w-full h-full object-cover"/>
          </div>
          <a href={file.url} download={downloadName} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            <UploadIcon size={14} className="text-gray-500 dark:text-gray-400 rotate-180"/>Download
          </a>
        </div>
      ) : (
        <div>
          <button type="button" onClick={onUpload} disabled={!!uploadDisabledReason}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white dark:text-[#1B1813] bg-[#D97706] dark:bg-[#FBBF24] rounded-lg hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-50">
            <UploadIcon size={14}/>Upload {label}
          </button>
          {uploadDisabledReason && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{uploadDisabledReason}</div>}
        </div>
      )}
    </div>
  );
}

// ─── ProposalDetailModal ────────────────────────────────────────────────────
// Opened by clicking a Proposal chip (from CustomizationModal's Proposals
// list or the Customization Requests table). Reuses the same document layout
// as ProposalPreviewModal's preview, but reads from the persisted snapshot_*
// fields on an already-saved record rather than live in-progress values —
// there's no structured line-items array stored on the record, only the
// flattened snapshot_customizations text, so this shows that text block
// instead of rebuilding a line-items table. Also owns both attachment slots
// (unsigned/signed): the Interface Extensions SDK can't push a local File
// into an attachment field, so uploading either one hands off to the same
// attachments form, prefilled with this exact Proposal record — the
// attachment_router automation matches it back and (for signed) sets status
// to "Signed" itself. A signed copy can't be uploaded before the unsigned
// one exists.
interface ProposalDetailModalProps {
  proposalRecord: AirtableRecord;
  proposalsTable: Table;
  clientName: string;
  saName: string;
  onClose: () => void;
}
function ProposalDetailModal({ proposalRecord, proposalsTable, clientName, saName, onClose }: ProposalDetailModalProps) {
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') onClose(); };
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[onClose]);

  const fStyle          = proposalsTable.getFieldIfExists(PROPOSAL.SNAPSHOT_STYLE);
  const fCustomizations = proposalsTable.getFieldIfExists(PROPOSAL.SNAPSHOT_CUSTOMIZATIONS);
  const fEmbroidery     = proposalsTable.getFieldIfExists(PROPOSAL.SNAPSHOT_EMBROIDERY_AMOUNT);
  const fPricing        = proposalsTable.getFieldIfExists(PROPOSAL.SNAPSHOT_PRICING);
  const fUnsigned       = proposalsTable.getFieldIfExists(PROPOSAL.UNSIGNED_DOCUMENT);
  const fSigned         = proposalsTable.getFieldIfExists(PROPOSAL.SIGNED_DOCUMENT);
  const fClientP        = proposalsTable.getFieldIfExists(PROPOSAL.CLIENT);
  const fGeneratedAt    = proposalsTable.getFieldIfExists(PROPOSAL.GENERATED_AT);

  const styleName          = fStyle ? proposalRecord.getCellValueAsString(fStyle) : '';
  const customizationsText = fCustomizations ? proposalRecord.getCellValueAsString(fCustomizations) : '';
  const embroidery         = fEmbroidery ? proposalRecord.getCellValueAsString(fEmbroidery) : '';
  const pricing            = fPricing ? ((proposalRecord.getCellValue(fPricing) as number|null) ?? 0) : 0;
  const clientId           = fClientP ? ((proposalRecord.getCellValue(fClientP) as Array<{id:string}>|null)?.[0]?.id ?? null) : null;
  const generatedAtRaw     = fGeneratedAt ? (proposalRecord.getCellValue(fGeneratedAt) as string|null) : null;
  const generatedAt        = generatedAtRaw ? new Date(generatedAtRaw) : new Date();
  const downloadBaseName   = buildProposalFilename(clientName, styleName, generatedAt);

  const unsigned = fUnsigned ? ((proposalRecord.getCellValue(fUnsigned) as ProposalFile[]|null) ?? []) : [];
  const signed   = fSigned   ? ((proposalRecord.getCellValue(fSigned)   as ProposalFile[]|null) ?? []) : [];
  const hasUnsigned = unsigned.length > 0;

  // document.title is the only lever a web page has over the "Save as PDF"
  // dialog's suggested filename — set it just before printing, restore it
  // once the dialog closes.
  const originalTitleRef = useRef(document.title);
  useEffect(() => {
    const h = () => { document.title = originalTitleRef.current; };
    window.addEventListener('afterprint', h);
    return () => window.removeEventListener('afterprint', h);
  }, []);
  const handlePrint = () => {
    document.title = downloadBaseName;
    window.print();
  };

  const openUnsignedUploadForm = () => {
    if (!clientId) return;
    window.open(buildProposalAttachmentFormUrl(clientId, proposalRecord.id, 'Customization Proposal'), '_blank', 'noopener,noreferrer');
  };
  const openSignedUploadForm = () => {
    if (!clientId || !hasUnsigned) return;
    window.open(buildProposalAttachmentFormUrl(clientId, proposalRecord.id, 'Signed Proposal'), '_blank', 'noopener,noreferrer');
  };

  return (
    // Blur only — no dark dim — behind this popup.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ backdropFilter:'blur(4px)' }}
      onClick={e=>{ if (e.target===e.currentTarget) onClose(); }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .proposal-print-area, .proposal-print-area * { visibility: visible !important; }
          .proposal-print-area {
            position: absolute; top: 0; left: 0; width: 100%; padding: 32px;
            background: #ffffff !important; color: #111111 !important;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-white/10"
        onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 hover:dark:text-gray-300 transition-colors">
            <ArrowLeftIcon size={18}/>
          </button>
          <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] flex-1">{proposalRecord.name || 'Proposal'}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="proposal-print-area bg-[#F8F5EE] text-[#111111] rounded-xl border border-gray-200 dark:border-white/10 p-6">
            <div className="text-2xl font-bold mb-1">Danielle Frankel Studios</div>
            <div className="text-sm text-gray-500 mb-6">Customization Proposal</div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-sm"><span className="capitalize text-gray-500">Client: </span><span className="font-medium">{clientName}</span></div>
              <div className="text-sm"><span className="capitalize text-gray-500">Sales Associate: </span><span className="font-medium">{saName || '—'}</span></div>
              <div className="text-sm"><span className="capitalize text-gray-500">Style: </span><span className="font-medium">{styleName}</span></div>
              <div className="text-sm"><span className="capitalize text-gray-500">Amount of Embroidery/Paint/Lace: </span><span className="font-medium">{embroidery}</span></div>
            </div>
            <div className="mb-6">
              <div className="text-sm whitespace-pre-wrap">{customizationsText || '—'}</div>
            </div>
            <div className="flex justify-between items-center border-t border-gray-200 pt-3">
              <span className="text-sm font-bold">Total Price</span>
              <span className="text-sm font-bold">{formatCurrency(pricing)}</span>
            </div>
          </div>

          {/* While unsigned isn't attached yet, offer Print here too — same
              document, in case it wasn't printed/saved during generation. */}
          {!hasUnsigned && (
            <button type="button" onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-700 hover:dark:bg-gray-200 transition-colors">
              <PrinterIcon size={14}/>Print
            </button>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ProposalAttachmentField label="Unsigned Proposal" files={unsigned} onUpload={openUnsignedUploadForm} downloadBaseName={downloadBaseName}/>
            <ProposalAttachmentField label="Signed Proposal" files={signed} onUpload={openSignedUploadForm} downloadBaseName={downloadBaseName}
              uploadDisabledReason={!hasUnsigned ? 'Attach the unsigned proposal first' : undefined}/>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PostAppointmentModal ─────────────────────────────────────────────────────
interface PostApptModalProps {
  record: AirtableRecord;
  apptTable: Table;
  clientsTable: Table;
  clientRecords: AirtableRecord[] | null;
  stylesTable: Table | null;
  stylesRecords: AirtableRecord[] | null;
  customizationsTable: Table | null;
  customizationRecords: AirtableRecord[] | null;
  pricingTable: Table | null;
  pricingRecords: AirtableRecord[] | null;
  stylesBasePriceField: ReturnType<Table['getFieldIfExists']>;
  pricingPercentField: ReturnType<Table['getFieldIfExists']>;
  pricingMultipleField: ReturnType<Table['getFieldIfExists']>;
  selfUsageField: ReturnType<Table['getFieldIfExists']>;
  stylesSelfUsageField: ReturnType<Table['getFieldIfExists']>;
  rushFeeProposedField: ReturnType<Table['getFieldIfExists']>;
  rushFeePercentField: ReturnType<Table['getFieldIfExists']>;
  leadtimeWeeksField: ReturnType<Table['getFieldIfExists']>;
  favoriteStylesApptField: ReturnType<Table['getFieldIfExists']>;
  staffTable: Table | null;
  staffRecords: AirtableRecord[] | null;
  proposalsTable: Table | null;
  proposalRecords: AirtableRecord[] | null;
  base: ReturnType<typeof useBase>;
  onClose: () => void;
}

function PostAppointmentModal({
  record, apptTable, clientsTable, clientRecords,
  stylesTable, stylesRecords, customizationsTable, customizationRecords,
  pricingTable, pricingRecords,
  stylesBasePriceField, pricingPercentField, pricingMultipleField, selfUsageField, stylesSelfUsageField,
  rushFeeProposedField, rushFeePercentField, leadtimeWeeksField, favoriteStylesApptField,
  staffTable, staffRecords, proposalsTable, proposalRecords,
  base, onClose
}: PostApptModalProps) {
  const [openCustomizationAdd, setOpenCustomizationAdd] = useState(false);
  const [editCustomizationId, setEditCustomizationId]   = useState<string|null>(null);

  const fClientLink = apptTable.getFieldIfExists(APPT.CLIENT_LINK);
  const fTypeField  = apptTable.getFieldIfExists(APPT.TYPE);
  const typeLabel   = fTypeField ? record.getCellValueAsString(fTypeField) : '';
  const shortType   = shortTypeLabel(typeLabel);
  const clientName  = fClientLink ? record.getCellValueAsString(fClientLink) : 'Unknown Client';
  const linked      = fClientLink ? (record.getCellValue(fClientLink) as Array<{id:string}>|null) : null;
  const clientId    = linked?.[0]?.id ?? null;
  const clientRec   = clientId ? (clientRecords?.find(c=>c.id===clientId)??null) : null;

  const cStr  = useCallback((fid:string)=>clientRec ? getStr(clientRec,fid) : '',[clientRec]);
  const cNum  = useCallback((fid:string)=>clientRec ? getVal<number>(clientRec,fid) : null,[clientRec]);
  const cBool = useCallback((fid:string)=>clientRec ? !!(getVal<boolean>(clientRec,fid)??false) : false,[clientRec]);

  // Wedding date
  const existingWeddingIso = clientRec ? (getVal<string>(clientRec, CLIENT.WEDDING)??'') : '';
  const [weddingDisplay, setWeddingDisplay] = useState(existingWeddingIso ? fmtFriendly(existingWeddingIso) : '');
  const [weddingIso, setWeddingIso]         = useState(existingWeddingIso);
  const [weddingConfirmed, setWeddingConfirmed] = useState(cBool(CLIENT.WEDDING_CONFIRMED));
  const [showCalendar, setShowCalendar]     = useState(false);

  // Measurements
  const [bust,       setBust]       = useState(cNum(CLIENT.MEAS_BUST)?.toString()??'');
  const [underBust,  setUnderBust]  = useState(cNum(CLIENT.MEAS_UNDER_BUST)?.toString()??'');
  const [waist,      setWaist]      = useState(cNum(CLIENT.MEAS_WAIST)?.toString()??'');
  const [highHip,    setHighHip]    = useState(cNum(CLIENT.MEAS_HIGH_HIP)?.toString()??'');
  const [hips,       setHips]       = useState(cNum(CLIENT.MEAS_HIPS)?.toString()??'');
  const [height,     setHeight]     = useState(cNum(CLIENT.MEAS_HEIGHT)?.toString()??'');
  const [hollowHem,  setHollowHem]  = useState(cNum(CLIENT.MEAS_HOLLOW_HEM)?.toString()??'');
  const [shoulderW,  setShoulderW]  = useState(cNum(CLIENT.MEAS_SHOULDER_W)?.toString()??'');
  const [armLength,  setArmLength]  = useState(cNum(CLIENT.MEAS_ARM_LENGTH)?.toString()??'');
  // measurement_notes is richText — read via fromRichText
  const [measNotes,  setMeasNotes]  = useState(fromRichText(getVal<unknown>(clientRec!, CLIENT.MEAS_NOTES)));
  const [size,       setSize]       = useState(cStr(CLIENT.SIZE));
  const [rtwSize,    setRtwSize]    = useState(cNum(CLIENT.RTW_SIZE)?.toString()??'');

  // Prefer the custom-property-bound field (see getCustomProperties) so the
  // style-filter feature and this editor always read the exact same field;
  // falls back to the hardcoded ID if the property somehow doesn't resolve.
  const existingFavStyles = clientRec
    ? ((favoriteStylesApptField
        ? (clientRec.getCellValue(favoriteStylesApptField) as Array<{id:string;name:string}>|null)
        : getVal<Array<{id:string;name:string}>>(clientRec, CLIENT.FAV_STYLES_APPT)) ?? [])
    : [];
  const [favStyles, setFavStyles] = useState<string[]>(existingFavStyles.map(s=>s.name));
  const [notes,     setNotes]     = useState(cStr(CLIENT.APPT_NOTES));

  const existingMeasPhotos = clientRec ? getVal<Array<{id:string;url:string;filename:string;thumbnails?:{small?:{url:string}}}>>(clientRec, CLIENT.MEAS_PHOTO) : null;
  const existingApptPhotos = clientRec ? getVal<Array<{id:string;url:string;filename:string;thumbnails?:{small?:{url:string}}}>>(clientRec, CLIENT.APPT_PHOTO) : null;

  // Customizations — computed reactively from live records, not clientRec linked field
  const linkedCustomizations = useMemo(() => {
    if (!customizationRecords || !clientId || !customizationsTable) return [];
    const clientField = customizationsTable.getFieldIfExists(CUSTOM.CLIENT);
    const styleField  = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE);
    if (!clientField || !styleField) return [];
    return customizationRecords
      .filter(r => {
        const lnk = r.getCellValue(clientField) as Array<{id:string}>|null;
        return lnk?.some(l=>l.id===clientId) ?? false;
      })
      .map(r => ({ id: r.id, name: r.getCellValueAsString(styleField) || 'Customization' }));
  }, [customizationRecords, customizationsTable, clientId]);

  const clientWeddingIso = weddingIso || null;

  // Line-item view of this client's Customization Requests — same grand-total
  // math as CustomizationModal's own Order Summary, so the Total Price column
  // here always agrees with what that modal shows for the same record.
  interface CustomizationRow {
    id: string;
    styleName: string;
    dateRequested: string;
    m2m: boolean;
    alts: boolean;
    rush: boolean;
    proposals: AirtableRecord[];
    grandTotal: number;
  }
  const customizationRows = useMemo<CustomizationRow[]>(() => {
    if (!customizationsTable) return [];
    const fStyled     = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE);
    const fPricing    = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZATION_PRICING);
    const fDateReq    = customizationsTable.getFieldIfExists(CUSTOM.DATE_OF_REQUEST);
    const fEmbroidery = customizationsTable.getFieldIfExists(CUSTOM.EMBROIDERY_AMOUNT);
    const fM2m        = customizationsTable.getFieldIfExists(CUSTOM.M2M);
    const fAlts       = customizationsTable.getFieldIfExists(CUSTOM.ALTERATIONS);
    const fRush       = customizationsTable.getFieldIfExists(CUSTOM.RUSH);
    const fSourceP    = proposalsTable?.getFieldIfExists(PROPOSAL.SOURCE_CUSTOMIZATION) ?? null;
    const pPriceField = pricingTable?.getFieldIfExists(PRICING.PRICE) ?? null;

    return linkedCustomizations
      .map((c): CustomizationRow | null => {
        const rec = customizationRecords?.find(r=>r.id===c.id);
        if (!rec) return null;

        const styleId  = fStyled ? ((rec.getCellValue(fStyled) as Array<{id:string}>|null)?.[0]?.id ?? null) : null;
        const styleRec = styleId ? (stylesRecords?.find(r=>r.id===styleId) ?? null) : null;
        const styleName = styleRec?.name ?? c.name;

        const dateRequested = fDateReq ? (rec.getCellValueAsString(fDateReq) || '') : '';

        const m2m  = fM2m  ? !!(rec.getCellValue(fM2m)  as boolean|null) : false;
        const alts = fAlts ? !!(rec.getCellValue(fAlts) as boolean|null) : false;
        const rush = fRush ? !!(rec.getCellValue(fRush) as boolean|null) : false;

        const proposals = (fSourceP && proposalRecords)
          ? proposalRecords.filter(p => {
              const link = p.getCellValue(fSourceP) as Array<{id:string}>|null;
              return link?.some(l=>l.id===rec.id) ?? false;
            })
          : [];

        const embroideryStr = fEmbroidery ? (rec.getCellValueAsString(fEmbroidery) || '') : '';
        const basePriceNumber = (styleRec && stylesBasePriceField)
          ? parseCurrencyString(styleRec.getCellValueAsString(stylesBasePriceField))
          : 0;
        const selfUsageValue = selfUsageField ? parseCurrencyString(rec.getCellValueAsString(selfUsageField)) : 0;
        const multiplierFactor = computeMultiplierFactor(selfUsageValue, embroideryStr || null);
        const pricingIds = fPricing ? ((rec.getCellValue(fPricing) as Array<{id:string}>|null)?.map(x=>x.id) ?? []) : [];
        const customizationTotal = pricingIds.reduce((sum, id) => {
          const r = pricingRecords?.find(pr => pr.id === id);
          if (!r) return sum;
          return sum + resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor).amount;
        }, 0);
        const altsM2mAmount = computeAltsM2mAmount(m2m, alts);
        const proposedTotal = basePriceNumber + customizationTotal;
        const leadtimeWeeks = leadtimeWeeksField
          ? (parseCurrencyString(rec.getCellValueAsString(leadtimeWeeksField)) || null)
          : weeksUntil(clientWeddingIso);
        const rushEstimate = computeRushFeeTier(leadtimeWeeks, proposedTotal);
        const rushFeeAmount = rush
          ? (rushFeeProposedField ? parseCurrencyString(rec.getCellValueAsString(rushFeeProposedField)) : rushEstimate.feeAmount)
          : 0;
        const grandTotal = basePriceNumber + customizationTotal + altsM2mAmount + rushFeeAmount;

        return { id: c.id, styleName, dateRequested, m2m, alts, rush, proposals, grandTotal };
      })
      .filter((r): r is CustomizationRow => r !== null);
  }, [linkedCustomizations, customizationRecords, customizationsTable, stylesRecords, pricingRecords, pricingTable,
      stylesBasePriceField, pricingPercentField, pricingMultipleField, selfUsageField, rushFeeProposedField,
      leadtimeWeeksField, proposalsTable, proposalRecords, clientWeddingIso]);

  // Sales associate has no linked Staff record anywhere else in this file — it's
  // a plain name field on both Appointments and Clients. Resolved against the
  // Staff table here (by name match) only so it can be linked on the Proposal;
  // passed down to CustomizationModal, which owns the actual Generate Proposal
  // action (see its title-bar button).
  const fApptSaName = apptTable.getFieldIfExists(APPT.SA_NAME);
  const saName = cStr(CLIENT.SA_NAME) || (fApptSaName ? record.getCellValueAsString(fApptSaName) : '');
  const saRecord = useMemo(
    () => (saName && staffRecords) ? (staffRecords.find(r=>r.name===saName) ?? null) : null,
    [saName, staffRecords]
  );

  // Save helper
  const saveClientField = useCallback((fieldId:string, value:unknown) => {
    if (!clientId) return;
    const t = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
    if (!t?.hasPermissionToUpdateRecords()) return;
    queueWrite(()=>t!.updateRecordAsync(clientId, { [fieldId]: value }))
      .catch(err=>console.error('Client save failed:', err));
  }, [clientId, base]);

  // Handlers
  const handleWeddingBlur = () => {
    if (!weddingDisplay.trim()) { setWeddingIso(''); saveClientField(CLIENT.WEDDING, null); return; }
    const d = parseFlexDate(weddingDisplay);
    if (d) {
      const iso = fmtDateKey(d);
      setWeddingIso(iso);
      setWeddingDisplay(fmtFriendly(iso));
      saveClientField(CLIENT.WEDDING, iso);
    }
  };
  const handleWeddingCalPick = (d:Date) => {
    const iso = fmtDateKey(d);
    setWeddingIso(iso);
    setWeddingDisplay(fmtFriendly(iso));
    saveClientField(CLIENT.WEDDING, iso);
    setShowCalendar(false);
  };
  const handleConfirmed    = (v:boolean) => { setWeddingConfirmed(v); saveClientField(CLIENT.WEDDING_CONFIRMED, v); };
  const handleMeasBlur     = (fieldId:string, val:string) => saveClientField(fieldId, val?parseFloat(val)||null:null);
  const handleNotesBlur    = () => saveClientField(CLIENT.APPT_NOTES, notes);
  // measurement_notes is richText — write as {markdown: value}
  const handleMeasNotesBlur = () => saveClientField(CLIENT.MEAS_NOTES, measNotes ? toRichText(measNotes) : null);
  const handleSizeBlur     = () => saveClientField(CLIENT.SIZE, size||null);
  const handleRtwBlur      = () => saveClientField(CLIENT.RTW_SIZE, rtwSize?parseFloat(rtwSize)||null:null);
  const handleStyleToggle  = (s:string) => {
    const updated = favStyles.includes(s)?favStyles.filter(x=>x!==s):[...favStyles,s];
    setFavStyles(updated);
    if (stylesRecords && clientId) {
      const ids = updated.map(name=>stylesRecords.find(r=>r.name===name)?.id).filter((id):id is string=>!!id).map(id=>({id}));
      const t = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
      if (t) queueWrite(()=>t.updateRecordAsync(clientId, { [CLIENT.FAV_STYLES_APPT]: ids.length>0?ids:null })).catch(console.error);
    }
  };
  const availableStyleNames = useMemo(()=>(stylesRecords??[]).map(r=>r.name).filter(Boolean).sort(),[stylesRecords]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') onClose(); };
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[onClose]);

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#F3EFE6] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]';
  const labelCls = 'text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const measInput = (label:string, val:string, set:(v:string)=>void, onBlur:()=>void, ph:string) => (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</div>
      <input value={val} onChange={e=>set(e.target.value)} onBlur={onBlur} placeholder={ph}
        className={`${inputCls} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        style={{ MozAppearance:'textfield' } as React.CSSProperties} type="number"/>
    </div>
  );

  const clientStage        = cStr(CLIENT.STAGE);
  const showPreApptFields  = clientStage === 'Pre-Appointment';
  const showDelibFields    = clientStage === 'Deliberating';
  const showSidebarFields  = showPreApptFields || showDelibFields;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
        style={{ backgroundColor:'rgba(0,0,0,0.18)', backdropFilter:'blur(1px)' }}
        onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
        <div className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          onClick={e=>e.stopPropagation()}>

          {/* Header */}
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-start gap-6 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0 text-xl font-bold text-gray-500 dark:text-gray-400">
                  {clientName ? clientName.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] truncate">{clientName || 'Unknown Client'}</div>
                  <div className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{shortType}</div>
                </div>
              </div>
              <div className="ml-auto flex flex-col justify-between h-14 items-start flex-shrink-0">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                  Acuity
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  Shopify
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  Apparel Magic
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Favorite Styles */}
            <div>
              <span className={labelCls}>Favorite Styles from Appointment</span>
              <StylesDropdown selected={favStyles} available={availableStyleNames} onToggle={handleStyleToggle}/>
            </div>

            {/* Wedding Date */}
            <div>
              <FieldLabel label="Wedding Date" fieldId={CLIENT.WEDDING} />
              <div className="flex items-center gap-3">
                {isFieldReadOnlyBySource(CLIENT.WEDDING) ? (
                  <div className="flex-1 text-sm text-gray-700 dark:text-gray-300 py-1.5">{weddingDisplay || '—'}</div>
                ) : (
                  <div className="relative flex-1">
                    <input type="text" value={weddingDisplay} onChange={e=>setWeddingDisplay(e.target.value)}
                      onBlur={handleWeddingBlur} placeholder="e.g. May 26, 2027"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-9 text-sm outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]"/>
                    <button type="button" onClick={()=>setShowCalendar(o=>!o)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-400">
                      <CalendarIcon size={15}/>
                    </button>
                    {showCalendar && <MiniCalendar selected={weddingIso?new Date(weddingIso+'T00:00:00'):new Date()} onSelect={handleWeddingCalPick} onClose={()=>setShowCalendar(false)}/>}
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={weddingConfirmed} onChange={e=>handleConfirmed(e.target.checked)} className="w-4 h-4 accent-[#D97706] dark:accent-[#FBBF24]"/>
                  Confirmed with client
                </label>
              </div>
            </div>

            {/* RTW Size + Order Size */}
            <div className="grid grid-cols-2 gap-4">
              <EditableNumber
                label="Ready-to-Wear Size"
                value={rtwSize}
                onChange={setRtwSize}
                onBlur={handleRtwBlur}
                placeholder="e.g. 8"
              />
              <EditableText
                label="Order Size"
                fieldId={CLIENT.SIZE}
                value={size}
                onChange={setSize}
                onBlur={handleSizeBlur}
                placeholder="e.g. 6"
              />
            </div>

            {/* Measurements */}
            <div>
              <span className={labelCls}>Measurements</span>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {measInput('Bust',           bust,      setBust,      ()=>handleMeasBlur(CLIENT.MEAS_BUST,      bust),      '34"')}
                {measInput('Under Bust',     underBust, setUnderBust, ()=>handleMeasBlur(CLIENT.MEAS_UNDER_BUST,underBust), '30"')}
                {measInput('Waist',          waist,     setWaist,     ()=>handleMeasBlur(CLIENT.MEAS_WAIST,     waist),     '26"')}
                {measInput('High Hip',       highHip,   setHighHip,   ()=>handleMeasBlur(CLIENT.MEAS_HIGH_HIP,  highHip),   '34"')}
                {measInput('Hips',           hips,      setHips,      ()=>handleMeasBlur(CLIENT.MEAS_HIPS,      hips),      '36"')}
                {measInput('Height',         height,    setHeight,    ()=>handleMeasBlur(CLIENT.MEAS_HEIGHT,    height),    '5\'6"')}
                {measInput('Hollow to Hem',  hollowHem, setHollowHem, ()=>handleMeasBlur(CLIENT.MEAS_HOLLOW_HEM,hollowHem),'58"')}
                {measInput('Shoulder Width', shoulderW, setShoulderW, ()=>handleMeasBlur(CLIENT.MEAS_SHOULDER_W,shoulderW), '14"')}
                {measInput('Arm Length',     armLength, setArmLength, ()=>handleMeasBlur(CLIENT.MEAS_ARM_LENGTH,armLength), '23"')}
              </div>
              <div className="mb-3">
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Measurement Notes (posture, concerns, alterations flags…)</div>
                <textarea value={measNotes} onChange={e=>setMeasNotes(e.target.value)} onBlur={handleMeasNotesBlur}
                  placeholder="Any posture notes, concerns, or alterations flags…" rows={2}
                  className={`${inputCls} resize-none`}/>
              </div>
              <AttachmentSection label="Upload Measurement Photo" type="Measurements" existing={existingMeasPhotos} clientId={clientId}/>
            </div>

            {/* Appointment Photo */}
            <div>
              <span className={labelCls}>Appointment Photo</span>
              <AttachmentSection label="Upload Appointment Photo" type="Appointment Photo" existing={existingApptPhotos} clientId={clientId}/>
            </div>

            {/* Customization Requests — invoice-style line-item table */}
            <div>
              <span className={labelCls}>Customization Requests</span>
              <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden mb-3">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left w-64">Style</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Date of Request</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Flags</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Proposals</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customizationRows.map(row=>{
                      const flagParts = [row.m2m && 'M2M', row.alts && 'Alts', row.rush && 'Rush'].filter(Boolean) as string[];
                      return (
                        <tr key={row.id} onClick={()=>setEditCustomizationId(row.id)}
                          className="border-b border-gray-100 dark:border-white/5 last:border-0 cursor-pointer hover:bg-[#FEF3C7] hover:dark:bg-[#3A2E12] transition-colors">
                          <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-[#F3EFE6] w-64">{row.styleName}</td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.dateRequested ? fmtUSDate(row.dateRequested) : '—'}</td>
                          <td className="px-3 py-2.5">
                            {flagParts.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {flagParts.map(f=>(
                                  <span key={f} className="bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#4A3B18] rounded-full text-xs font-medium px-2 py-0.5">{f}</span>
                                ))}
                              </div>
                            ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">{row.proposals.length > 0 ? row.proposals.length : '—'}</td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-[#F3EFE6] text-right">{formatCurrency(row.grandTotal)}</td>
                        </tr>
                      );
                    })}
                    {customizationRows.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-5 text-center text-gray-400 dark:text-gray-500 text-sm">No customization requests yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={()=>setOpenCustomizationAdd(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
                <UploadIcon size={14} className="text-gray-500 dark:text-gray-400"/>Add Customization Request
              </button>
            </div>

            {/* Post-Appointment Notes */}
            <div>
              <span className={labelCls}>Post-Appointment Notes</span>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={handleNotesBlur}
                placeholder="Any additional notes about the appointment…" rows={4}
                className={`${inputCls} resize-none`}/>
            </div>

            {/* Stage-specific sidebar fields */}
            {showSidebarFields && (
              <div className="border-t border-gray-100 dark:border-white/5 pt-5 space-y-4">
                <div className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-semibold">
                  {showPreApptFields ? 'Pre-Appointment Info' : 'Client Context'}
                </div>

                {showPreApptFields && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Country</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.COUNTRY)||'—'}</div></div>
                      <div><div className={labelCls}>Next Appointment</div><div className="text-sm text-gray-700 dark:text-gray-300">{fmtFriendly(cStr(CLIENT.NEXT_APPT))||'—'}</div></div>
                      <div><div className={labelCls}>Total Appointments</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.APPT_COUNT)||'—'}</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Studio</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.STUDIO_SHORT_NAME)||'—'}</div></div>
                      <div><div className={labelCls}>RTW Size (0–20)</div>
                        <input value={rtwSize} onChange={e=>setRtwSize(e.target.value)} onBlur={handleRtwBlur} placeholder="8" type="number"
                          className={`${inputCls} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                          style={{ MozAppearance:'textfield' } as React.CSSProperties}/>
                      </div>
                      <div/>
                    </div>
                    <div><FieldLabel label="Favorite Styles (Acuity)" fieldId={CLIENT.FAV_STYLES_ACUITY} /><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.FAV_STYLES_ACUITY)||'—'}</div></div>
                    <div><div className={labelCls}>Samples Not Where Needed</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.SAMPLES_NOT_NEEDED)||'—'}</div></div>
                    <EditableTextarea
                      label="Personal Style Notes"
                      fieldId={CLIENT.PERSONAL_NOTES}
                      value={cStr(CLIENT.PERSONAL_NOTES)}
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <EditableText
                        label="Wedding Location"
                        fieldId={CLIENT.WEDDING_LOCATION}
                        value={cStr(CLIENT.WEDDING_LOCATION)}
                      />
                      <EditableText
                        label="Wedding Planner"
                        fieldId={CLIENT.WEDDING_PLANNER}
                        value={cStr(CLIENT.WEDDING_PLANNER)}
                      />
                    </div>
                  </>
                )}

                {showDelibFields && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Country</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.COUNTRY)||'—'}</div></div>
                      <div><div className={labelCls}>Last Appointment</div><div className="text-sm text-gray-700 dark:text-gray-300">{fmtFriendly(cStr(CLIENT.LAST_APPT))||'—'}</div></div>
                      <div><div className={labelCls}>Next Appointment</div><div className="text-sm text-gray-700 dark:text-gray-300">{fmtFriendly(cStr(CLIENT.NEXT_APPT))||'—'}</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Customization Requests</div><div className="text-sm text-gray-700 dark:text-gray-300">{linkedCustomizations.length>0?String(linkedCustomizations.length):'—'}</div></div>
                      <div><div className={labelCls}>Interest in Alterations</div>
                        <button type="button" onClick={()=>saveClientField(CLIENT.INTEREST_ALTS, !cBool(CLIENT.INTEREST_ALTS))}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${cBool(CLIENT.INTEREST_ALTS)?'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30':'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10'}`}>
                          {cBool(CLIENT.INTEREST_ALTS)?<CheckIcon size={11} weight="bold"/>:<XIcon size={11}/>}
                          {cBool(CLIENT.INTEREST_ALTS)?'Yes':'No'}
                        </button>
                      </div>
                      <div><div className={labelCls}>Interest in M2M</div>
                        <button type="button" onClick={()=>saveClientField(CLIENT.INTEREST_M2M, !cBool(CLIENT.INTEREST_M2M))}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${cBool(CLIENT.INTEREST_M2M)?'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30':'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10'}`}>
                          {cBool(CLIENT.INTEREST_M2M)?<CheckIcon size={11} weight="bold"/>:<XIcon size={11}/>}
                          {cBool(CLIENT.INTEREST_M2M)?'Yes':'No'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className={labelCls}>Appointment Notes</span>
                      <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={handleNotesBlur} rows={3} className={`${inputCls} resize-none`}/>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {openCustomizationAdd && (
        <CustomizationModal
          mode="add"
          existingRecord={null}
          customizationsTable={customizationsTable}
          pricingTable={pricingTable}
          pricingRecords={pricingRecords}
          stylesRecords={stylesRecords}
          stylesBasePriceField={stylesBasePriceField}
          pricingPercentField={pricingPercentField}
          pricingMultipleField={pricingMultipleField}
          selfUsageField={selfUsageField}
          stylesSelfUsageField={stylesSelfUsageField}
          rushFeeProposedField={rushFeeProposedField}
          rushFeePercentField={rushFeePercentField}
          leadtimeWeeksField={leadtimeWeeksField}
          linkedClientId={clientId}
          favoriteStyleIds={existingFavStyles.map(s=>s.id)}
          clientWeddingIso={clientWeddingIso}
          clientName={clientName || 'Unknown Client'}
          saName={saName}
          saRecordId={saRecord?.id ?? null}
          proposalsTable={proposalsTable}
          proposalRecords={proposalRecords}
          base={base}
          onClose={()=>setOpenCustomizationAdd(false)}
        />
      )}

      {editCustomizationId && (
        <CustomizationModal
          mode="edit"
          existingRecord={customizationRecords?.find(r=>r.id===editCustomizationId)??null}
          customizationsTable={customizationsTable}
          pricingTable={pricingTable}
          pricingRecords={pricingRecords}
          stylesRecords={stylesRecords}
          stylesBasePriceField={stylesBasePriceField}
          pricingPercentField={pricingPercentField}
          pricingMultipleField={pricingMultipleField}
          selfUsageField={selfUsageField}
          stylesSelfUsageField={stylesSelfUsageField}
          rushFeeProposedField={rushFeeProposedField}
          rushFeePercentField={rushFeePercentField}
          leadtimeWeeksField={leadtimeWeeksField}
          linkedClientId={clientId}
          favoriteStyleIds={existingFavStyles.map(s=>s.id)}
          clientWeddingIso={clientWeddingIso}
          clientName={clientName || 'Unknown Client'}
          saName={saName}
          saRecordId={saRecord?.id ?? null}
          proposalsTable={proposalsTable}
          proposalRecords={proposalRecords}
          base={base}
          onClose={()=>setEditCustomizationId(null)}
        />
      )}
    </>
  );
}

// ─── Custom properties ────────────────────────────────────────────────────────
// Base Price (Styles) and Percent (Customization Pricing) are referenced by a
// hardcoded field ID elsewhere in this file, same as every other field here —
// but unlike those, these two aren't resolving (base price shows $0.00, the
// percent-based line items show nothing). Rather than keep guessing at IDs
// with no way to verify them, expose both as custom properties: this gives a
// panel entry to see what's actually available and bind the real field by
// hand, and doubles as a diagnostic — if a property shows no matching field
// at all, that field isn't exposed to this interface's data source, and no
// amount of guessing the right ID would have fixed it in code.
function getCustomProperties(base: ReturnType<typeof useBase>) {
  const stylesTable         = base.getTableByIdIfExists(TABLE_IDS.STYLES);
  const pricingTable        = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATION_PRICING);
  const customizationsTable = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATIONS);
  const clientsTable        = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
  return [
    { key:'appointmentsTable', label:'Appointments', type:'table' as const, defaultValue: base.tables.find(t=>t.id===TABLE_IDS.APPOINTMENTS) },
    { key:'clientsTable',      label:'Clients',      type:'table' as const, defaultValue: base.tables.find(t=>t.id===TABLE_IDS.CLIENTS) },
    // Favorite Styles in Appointment — used to scope the Style dropdown to
    // the client's own favorites. The hardcoded CLIENT.FAV_STYLES_APPT ID
    // already works for the favorites editor elsewhere in this file, so it's
    // used as the default here too — exposed as a property mainly so it can
    // be independently verified/rebound if the style filter itself needs a
    // different field than the editor does.
    clientsTable && {
      key: 'favoriteStylesApptField',
      label: 'Favorite Styles in Appointment field (Clients)',
      type: 'field' as const,
      table: clientsTable,
      defaultValue: clientsTable.getFieldIfExists(CLIENT.FAV_STYLES_APPT)
        ?? clientsTable.fields.find(f => normalizedIncludes(f.name, 'favoritestyle')),
    },
    stylesTable && {
      key: 'stylesBasePriceField',
      label: 'Base Price field (Styles)',
      type: 'field' as const,
      table: stylesTable,
      defaultValue: stylesTable.getFieldIfExists('flduZuxPxxMqXzNxD') ?? stylesTable.fields.find(f => normalizedIncludes(f.name, 'baseprice')),
    },
    pricingTable && {
      key: 'pricingPercentField',
      label: 'Percent field (Customization Pricing)',
      type: 'field' as const,
      table: pricingTable,
      defaultValue: pricingTable.getFieldIfExists(PRICING.PERCENT) ?? pricingTable.fields.find(f => normalizedIncludes(f.name, 'percent')),
    },
    // Multiple Fee has a known field ID (fldEKZTpnJ5Y1gjOw, same as the
    // Customizations detail interface), but this interface's connection to
    // the Customization Pricing table doesn't expose it by that ID — the
    // same "not every field ID resolves in every interface page" gap that
    // Percent hit above. Bound as a custom property for the same reason.
    pricingTable && {
      key: 'pricingMultipleField',
      label: 'Multiple Fee field (Customization Pricing)',
      type: 'field' as const,
      table: pricingTable,
      defaultValue: pricingTable.getFieldIfExists(PRICING.MULTIPLE) ?? pricingTable.fields.find(f => normalizedIncludes(f.name, 'multiple')),
    },
    // Self Usage is a lookup ON THE CUSTOMIZATIONS TABLE (via the Customized
    // Style link to DF Styles), not a field on Styles itself — same table as
    // the two Rush Fee properties below, and same reasoning: no known field
    // ID, added after this interface was first scoped. Only readable off an
    // existing record, so it's the authoritative "edit" mode value.
    customizationsTable && {
      key: 'selfUsageField',
      label: 'Self Usage field (Customizations)',
      type: 'field' as const,
      table: customizationsTable,
      defaultValue: customizationsTable.fields.find(f => normalizedIncludes(f.name, 'selfusage')),
    },
    // The underlying number Self Usage looks up, bound directly on Styles —
    // used only as an "add" mode pre-save preview (see CustomizationModal),
    // since there's no Customizations record yet to read the lookup off of.
    stylesTable && {
      key: 'stylesSelfUsageField',
      label: 'Self Usage field (Styles) — used for add-mode preview',
      type: 'field' as const,
      table: stylesTable,
      defaultValue: stylesTable.fields.find(f => normalizedIncludes(f.name, 'selfusage')),
    },
    // Rush Fee with Proposed Custom Price / Rush Fee % / Leadtime (Weeks)
    // have no known field ID — added to the Customizations table after this
    // interface was first scoped, same reasoning as the other custom
    // properties here.
    customizationsTable && {
      key: 'rushFeeProposedField',
      label: 'Rush Fee with Proposed Custom Price field (Customizations)',
      type: 'field' as const,
      table: customizationsTable,
      defaultValue: customizationsTable.fields.find(f => normalizedIncludes(f.name, 'rushfeewithproposedcustomprice'))
        ?? customizationsTable.fields.find(f => normalizedIncludes(f.name, 'rushfee') && normalizedIncludes(f.name, 'proposed')),
    },
    customizationsTable && {
      key: 'rushFeePercentField',
      label: 'Rush Fee % field (Customizations)',
      type: 'field' as const,
      table: customizationsTable,
      defaultValue: customizationsTable.fields.find(f => normalizedIncludes(f.name, 'rushfeepercent') || normalizedIncludes(f.name, 'rushfee%')),
    },
    customizationsTable && {
      key: 'leadtimeWeeksField',
      label: 'Leadtime (Weeks) field (Customizations)',
      type: 'field' as const,
      table: customizationsTable,
      defaultValue: customizationsTable.fields.find(f => normalizedIncludes(f.name, 'leadtimeweeks'))
        ?? customizationsTable.fields.find(f => normalizedIncludes(f.name, 'leadtime')),
    },
  ].filter(Boolean);
}

// ─── AppointmentsApp ──────────────────────────────────────────────────────────
function AppointmentsApp(): React.ReactElement {
  const base = useBase();
  const { errorState, customPropertyValueByKey } = useCustomProperties(getCustomProperties);
  const stylesBasePriceField = (customPropertyValueByKey?.stylesBasePriceField as ReturnType<Table['getFieldIfExists']>) ?? null;
  const pricingPercentField  = (customPropertyValueByKey?.pricingPercentField  as ReturnType<Table['getFieldIfExists']>) ?? null;
  const pricingMultipleField = (customPropertyValueByKey?.pricingMultipleField as ReturnType<Table['getFieldIfExists']>) ?? null;
  const selfUsageField       = (customPropertyValueByKey?.selfUsageField       as ReturnType<Table['getFieldIfExists']>) ?? null;
  const stylesSelfUsageField = (customPropertyValueByKey?.stylesSelfUsageField as ReturnType<Table['getFieldIfExists']>) ?? null;
  const rushFeeProposedField = (customPropertyValueByKey?.rushFeeProposedField as ReturnType<Table['getFieldIfExists']>) ?? null;
  const rushFeePercentField  = (customPropertyValueByKey?.rushFeePercentField  as ReturnType<Table['getFieldIfExists']>) ?? null;
  const leadtimeWeeksField   = (customPropertyValueByKey?.leadtimeWeeksField   as ReturnType<Table['getFieldIfExists']>) ?? null;
  const favoriteStylesApptField = (customPropertyValueByKey?.favoriteStylesApptField as ReturnType<Table['getFieldIfExists']>) ?? null;

  const appointmentsTable   = base.getTableByIdIfExists(TABLE_IDS.APPOINTMENTS);
  const clientsTable        = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
  const stylesTable         = base.getTableByIdIfExists(TABLE_IDS.STYLES);
  const customizationsTable = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATIONS);
  const pricingTable        = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATION_PRICING);
  const staffTable          = base.getTableByIdIfExists(TABLE_IDS.STAFF);
  const proposalsTable      = base.getTableByIdIfExists(TABLE_IDS.PROPOSALS);

  // useRecords — fall back to appointmentsTable to keep hook count stable
  const appointmentRecords = useRecords(appointmentsTable ?? null);
  const clientRecords      = useRecords(clientsTable ?? null);
  const _stylesRaw         = useRecords(stylesTable ?? appointmentsTable ?? null);
  const stylesRecords      = stylesTable ? _stylesRaw : null;
  const _customRaw         = useRecords(customizationsTable ?? appointmentsTable ?? null);
  const customizationRecords = customizationsTable ? _customRaw : null;
  const _pricingRaw        = useRecords(pricingTable ?? appointmentsTable ?? null);
  const pricingRecords     = pricingTable ? _pricingRaw : null;
  const _staffRaw          = useRecords(staffTable ?? appointmentsTable ?? null);
  const staffRecords       = staffTable ? _staffRaw : null;
  const _proposalsRaw      = useRecords(proposalsTable ?? appointmentsTable ?? null);
  const proposalRecords    = proposalsTable ? _proposalsRaw : null;

  const [selectedDate, setSelectedDate]        = useState(new Date());
  const [showCalendar, setShowCalendar]         = useState(false);
  const [selectedSA, setSelectedSA]             = useState<string[]>([]);
  const [selectedStudio, setSelectedStudio]     = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string|null>(null);
  const [clientSearch, setClientSearch]         = useState('');
  const [searchResults, setSearchResults]       = useState<AirtableRecord[]>([]);
  const [showSearchDrop, setShowSearchDrop]     = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(searchRef.current&&!searchRef.current.contains(e.target as Node)) setShowSearchDrop(false); };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);

  const fTime       = appointmentsTable?.getFieldIfExists(APPT.TIME)        ?? null;
  const fType       = appointmentsTable?.getFieldIfExists(APPT.TYPE)        ?? null;
  const fClient     = appointmentsTable?.getFieldIfExists(APPT.CLIENT_LINK) ?? null;
  const fSA         = appointmentsTable?.getFieldIfExists(APPT.SA_NAME)     ?? null;
  const fStudio     = appointmentsTable?.getFieldIfExists(APPT.STUDIO_NAME) ?? null;
  const fStatus     = appointmentsTable?.getFieldIfExists(APPT.STATUS)      ?? null;
  const fMeasField  = appointmentsTable?.getFieldIfExists(APPT.MEASUREMENTS)?? null;
  const fPhotosField= appointmentsTable?.getFieldIfExists(APPT.APPT_PHOTOS) ?? null;
  const fFollowUp   = appointmentsTable?.getFieldIfExists(APPT.FOLLOW_UP)   ?? null;

  useEffect(()=>{
    if (!clientSearch.trim()||!appointmentRecords||!fClient) { setSearchResults([]); setShowSearchDrop(false); return; }
    const q = clientSearch.toLowerCase();
    const m = appointmentRecords.filter(r=>r.getCellValueAsString(fClient!).toLowerCase().includes(q));
    setSearchResults(m.slice(0,10));
    setShowSearchDrop(m.length>0);
  },[clientSearch, appointmentRecords, fClient]);

  const today    = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const todayStr = fmtDateKey(today);
  const isToday  = useMemo(()=>fmtDateKey(selectedDate)===todayStr,[selectedDate, todayStr]);

  const saOptions = useMemo(()=>{
    if (!appointmentRecords||!fSA) return [];
    const s=new Set<string>();
    appointmentRecords.forEach(r=>{ const v=r.getCellValueAsString(fSA!); if(v) s.add(v); });
    return Array.from(s).sort();
  },[appointmentRecords, fSA]);

  const studioOptions = useMemo(()=>{
    if (!appointmentRecords||!fStudio) return [];
    const s=new Set<string>();
    appointmentRecords.forEach(r=>{ const v=r.getCellValueAsString(fStudio!); if(v) s.add(v); });
    return Array.from(s).sort();
  },[appointmentRecords, fStudio]);

  const filterAndSort = useCallback((records: AirtableRecord[], dateStr: string)=>{
    if (!fTime) return [];
    return records.filter(r=>{
      const t = r.getCellValue(fTime!) as string|null;
      if (!t||fmtDateKey(new Date(t))!==dateStr) return false;
      if (fClient && !(r.getCellValue(fClient!) as Array<{id:string}>|null)?.length) return false;
      if (fStatus && r.getCellValueAsString(fStatus!)==='Cancelled') return false;
      const type = fType ? r.getCellValueAsString(fType!) : '';
      if (!isConsultation(type)) return false;
      if (selectedSA.length && fSA && !selectedSA.includes(r.getCellValueAsString(fSA!))) return false;
      if (selectedStudio.length && fStudio && !selectedStudio.includes(r.getCellValueAsString(fStudio!))) return false;
      return true;
    }).sort((a,b)=>{
      const ta=a.getCellValue(fTime!) as string|null;
      const tb=b.getCellValue(fTime!) as string|null;
      if (!ta) return 1; if (!tb) return -1;
      return new Date(ta).getTime()-new Date(tb).getTime();
    });
  },[fTime, fStatus, fType, fSA, fStudio, selectedSA, selectedStudio]);

  const todayAppts    = useMemo(()=>filterAndSort(appointmentRecords??[], todayStr),[appointmentRecords, todayStr, filterAndSort]);
  const filteredRecs  = useMemo(()=>filterAndSort(appointmentRecords??[], fmtDateKey(selectedDate)),[appointmentRecords, selectedDate, filterAndSort]);
  const selectedRecord= useMemo(()=>selectedRecordId?(appointmentRecords?.find(r=>r.id===selectedRecordId)??null):null,[selectedRecordId, appointmentRecords]);

  const isEmpty = (v:unknown):boolean => {
    if (v===null||v===undefined||v===false) return true;
    if (typeof v==='number') return v===0;
    if (typeof v==='string') return v.trim()===''||v.startsWith('0 ');
    if (Array.isArray(v)) return v.length===0;
    return false;
  };
  const pillCls = (v:string) => {
    const l=v.toLowerCase();
    if (l==='missing'||l==='pending') return 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30';
    if (l==='complete'||l==='uploaded'||l==='sent') return 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30';
    return 'bg-orange-50 text-orange-600 border border-orange-200';
  };

  if (errorState) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 dark:text-gray-400">Error loading configuration.</p></div>;
  if (!appointmentsTable || !clientsTable) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center p-8">
        <p className="text-lg font-semibold text-gray-800 dark:text-[#F3EFE6] mb-2">Configuration Required</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Set Appointments and Clients tables in the properties panel.</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans antialiased bg-[#F8F5EE] dark:bg-[#1B1813]">
      <style>{`::-webkit-scrollbar-button{display:none;height:0;width:0}`}</style>
      {selectedRecord && (
        <PostAppointmentModal
          record={selectedRecord}
          apptTable={appointmentsTable}
          clientsTable={clientsTable}
          clientRecords={clientRecords}
          stylesTable={stylesTable}
          stylesRecords={stylesRecords}
          customizationsTable={customizationsTable}
          customizationRecords={customizationRecords}
          pricingTable={pricingTable}
          pricingRecords={pricingRecords}
          stylesBasePriceField={stylesBasePriceField}
          pricingPercentField={pricingPercentField}
          pricingMultipleField={pricingMultipleField}
          selfUsageField={selfUsageField}
          stylesSelfUsageField={stylesSelfUsageField}
          rushFeeProposedField={rushFeeProposedField}
          rushFeePercentField={rushFeePercentField}
          leadtimeWeeksField={leadtimeWeeksField}
          favoriteStylesApptField={favoriteStylesApptField}
          staffTable={staffTable}
          staffRecords={staffRecords}
          proposalsTable={proposalsTable}
          proposalRecords={proposalRecords}
          base={base}
          onClose={()=>setSelectedRecordId(null)}
        />
      )}

      {/* Header */}
      <div className="px-7 pt-5 pb-4 flex-shrink-0 flex items-center gap-3">
        <button onClick={()=>{ const d=new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }}
          className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
          <CaretLeftIcon size={14}/>
        </button>
        <div className="relative">
          <button onClick={()=>setShowCalendar(!showCalendar)}
            className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 cursor-pointer text-sm font-semibold text-gray-900 dark:text-[#F3EFE6] flex items-center gap-2 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            <CalendarIcon size={13} className="text-gray-500 dark:text-gray-400"/>{fmtDisplay(selectedDate)}
          </button>
          {showCalendar && <MiniCalendar selected={selectedDate} onSelect={(d)=>setSelectedDate(d)} onClose={()=>setShowCalendar(false)}/>}
        </div>
        <button onClick={()=>{ const d=new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }}
          className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
          <CaretRightIcon size={14}/>
        </button>
        {!isToday && (
          <button onClick={()=>setSelectedDate(new Date())}
            className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            Today
          </button>
        )}
        <div className="h-6 w-px bg-gray-200 dark:bg-white/10"/>
        {/* Search */}
        <div ref={searchRef} className="relative">
          <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10 pointer-events-none"/>
          <input type="text" placeholder="Search by client name…" value={clientSearch}
            onChange={e=>setClientSearch(e.target.value)}
            onFocus={()=>{ if(searchResults.length>0) setShowSearchDrop(true); }}
            className="pl-9 pr-8 py-1.5 text-sm bg-white dark:bg-[#25211A] border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] w-[200px]"/>
          {clientSearch && (
            <button type="button" onClick={()=>{setClientSearch('');setShowSearchDrop(false);}}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-400">
              <XIcon size={14}/>
            </button>
          )}
          {showSearchDrop && searchResults.length>0 && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg w-[280px] max-h-[300px] overflow-y-auto">
              {searchResults.map(rec=>{
                const name = fClient ? rec.getCellValueAsString(fClient!) : '';
                const t = fTime ? (rec.getCellValue(fTime!) as string|null) : null;
                return (
                  <button key={rec.id} onClick={()=>{setSelectedRecordId(rec.id);setShowSearchDrop(false);setClientSearch('');}}
                    className="w-full text-left px-4 py-2 hover:bg-[#FEF3C7] dark:bg-[#3A2E12] transition-colors border-b border-gray-100 dark:border-white/5 last:border-b-0">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t?`${fmtDisplay(new Date(t))} at ${fmtNYTime(new Date(t))}`:''}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <FilterDropdown label="Studio" values={selectedStudio} options={studioOptions} onChange={setSelectedStudio}/>
        <FilterDropdown label="Sales Associate" values={selectedSA} options={saOptions} onChange={setSelectedSA}/>
      </div>

      {/* Today's appointments */}
      <div className="px-7 pb-3 flex-shrink-0">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {todayAppts.length===0
            ? <p className="text-gray-400 dark:text-gray-500 text-xs py-3">No consultation appointments today for the selected filters.</p>
            : todayAppts.map(rec=>(
                <TodayCard key={rec.id} record={rec} apptTable={appointmentsTable} clientRecords={clientRecords} onClick={()=>setSelectedRecordId(rec.id)}/>
              ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-7 pb-5 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-white/10 w-full flex-1 min-h-0">
          <table className="w-full border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                {['Time','Client','Studio','Wedding Date','Sales Associate','Favorite Styles','Measurements','Photos','Follow-Up','Customizations'].map(h=>(
                  <th key={h} className="text-left px-3 py-2 text-xs text-gray-400 dark:text-gray-500 font-bold tracking-wider capitalize whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecs.length===0
                ? <tr><td colSpan={10} className="px-8 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">No consultation appointments for {fmtDisplay(selectedDate)}.</td></tr>
                : filteredRecs.map((rec,idx)=>{
                    const t      = fTime   ? (rec.getCellValue(fTime!)  as string|null) : null;
                    const name   = fClient ? rec.getCellValueAsString(fClient!) : '';
                    const studio = fStudio ? rec.getCellValueAsString(fStudio!) : '';
                    const sa     = fSA     ? rec.getCellValueAsString(fSA!)    : '';
                    const lnk    = fClient ? (rec.getCellValue(fClient!) as Array<{id:string}>|null) : null;
                    const cId    = lnk?.[0]?.id ?? null;
                    const cRec   = cId ? (clientRecords?.find(c=>c.id===cId)??null) : null;
                    const weddingRaw      = cRec ? getVal<string>(cRec, CLIENT.WEDDING) : null;
                    const wConfirmed      = cRec ? !!(getVal<boolean>(cRec, CLIENT.WEDDING_CONFIRMED)??false) : false;
                    const favStylesList   = cRec ? (getVal<Array<{id:string;name:string}>>(cRec, CLIENT.FAV_STYLES_APPT)??[]) : [];
                    const measRaw   = fMeasField   ? rec.getCellValue(fMeasField!)   : null;
                    const photosRaw = fPhotosField ? rec.getCellValue(fPhotosField!) : null;
                    const followRaw = fFollowUp    ? rec.getCellValue(fFollowUp!)    : null;
                    const measStatus   = isEmpty(measRaw)   ? 'Missing' : 'Complete';
                    const photosStatus = isEmpty(photosRaw) ? 'Missing' : 'Uploaded';
                    const followStatus = followRaw===true   ? 'Sent'    : 'Pending';
                    const custRaw  = cRec ? getVal<Array<{id:string;name:string}>>(cRec, CLIENT.CUSTOMIZATION_LINK) : null;
                    const custCount = custRaw?.length ?? 0;
                    return (
                      <tr key={rec.id} onClick={()=>setSelectedRecordId(rec.id)}
                        className={`border-b border-gray-100 dark:border-white/5 cursor-pointer transition-colors ${idx%2===0?'bg-white dark:bg-[#25211A]':'bg-gray-50 dark:bg-white/5'} hover:bg-[#FEF3C7] dark:bg-[#3A2E12]`}>
                        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap tabular-nums">{t?fmtNYTime(new Date(t)):'—'}</td>
                        <td className="px-3 py-3"><div className="font-semibold text-sm text-gray-900 dark:text-[#F3EFE6]">{name||'Unknown'}</div></td>
                        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{studio||'—'}</td>
                        <td className="px-3 py-3">
                          <div className="text-sm text-gray-700 dark:text-gray-300">{weddingRaw?fmtFriendly(weddingRaw):'—'}</div>
                          {weddingRaw && !wConfirmed && (
                            <span className="inline-flex mt-0.5 rounded-full text-xs font-medium px-2.5 py-0.5 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30">Needs confirmation</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{sa||'—'}</td>
                        <td className="px-3 py-3">
                          {favStylesList.length>0
                            ? <div className="flex flex-wrap gap-1">{favStylesList.slice(0,2).map(s=><span key={s.id} className="bg-gray-100 dark:bg-white/10 rounded px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">{s.name}</span>)}{favStylesList.length>2&&<span className="text-xs text-gray-400 dark:text-gray-500">+{favStylesList.length-2}</span>}</div>
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-3"><span className={`rounded-full text-xs font-medium px-2.5 py-0.5 ${pillCls(measStatus)}`}>{measStatus}</span></td>
                        <td className="px-3 py-3"><span className={`rounded-full text-xs font-medium px-2.5 py-0.5 ${pillCls(photosStatus)}`}>{photosStatus}</span></td>
                        <td className="px-3 py-3"><span className={`rounded-full text-xs font-medium px-2.5 py-0.5 ${pillCls(followStatus)}`}>{followStatus}</span></td>
                        <td className="px-3 py-3">{custCount>0?<span className="text-sm text-gray-700 dark:text-gray-300">{custCount} request{custCount===1?'':'s'}</span>:<span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

initializeBlock({ interface: () => <AppointmentsApp /> });
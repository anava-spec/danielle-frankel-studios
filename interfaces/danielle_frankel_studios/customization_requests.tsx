import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
} from '@airtable/blocks/interface/ui';
import {
  CaretDown as CaretDownIcon,
  X as XIcon,
  CheckCircle as CheckCircleIcon,
  XSquare as XSquareIcon,
  ArrowCounterClockwise as ArrowCounterClockwiseIcon,
  ArrowLeft as ArrowLeftIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
} from '@phosphor-icons/react';
import type { Table, Record as AirtableRecord, Field } from '@airtable/blocks/interface/models';
import { FieldType } from '@airtable/blocks/interface/models';

// ─── Palette: Champagne ───────────────────────────────────────────────────────
// Light: app_bg #F8F5EE · surface #FFFFFF · border #E9E0CE · accent amber-600
// Dark:  app_bg #1B1813 · surface #25211A · border #38322A · accent amber-400

// ─── Dark Mode ────────────────────────────────────────────────────────────────
function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return theme;
}

// ─── Table / Field IDs ────────────────────────────────────────────────────────
const FIELD_IDS = {
  CUSTOMIZATION_ID:            'fldl9cIcV80nYEDwe',
  CLIENT:                      'fldOeL4VVcXaKwwlN',
  DATE_OF_REQUEST:             'fldQdHAp256vsImBt',
  PRODUCTION_STATUS:           'fld5qkNKygBkRYF4v',
  APPROVAL_STATUS:             'fldEfOYgxOhyDiMEH',
  CUSTOMIZED_STYLE:            'fldCaKP1d4C0aohQE',
  CUSTOMIZATION_DETAIL:        'fldg1hEoZe9MFQj02',
  CUSTOMIZATION_PRICING:       'fldJY7GklAVZ7lsjw',
  BASE_PRICE:                  'fldLBXbdD3SUfXSgL',
  PROPOSED_CUSTOM_PRICING:     'fldXWP4eMZuSKWmep',
  PROPOSED_TOTAL_CUSTOM_PRICE: 'fldtF37zwwAPb5hjS',
  APPROVED_PRICING:            'fldFRRjwVlCgHhPdA',
  RUSH:                        'fldt92ponsfyKqDS1',
  RUSH_FEE:                    'fldfLFUmvEsER1pvI',
  ALTS_M2M:                    'fldpJN74mOSYTqx1f',
  ALTERATIONS:                 'fldM72sjV0aAwbX2D',
  MADE_TO_MEASURE:             'fldonK9Rd5lOXeH8F',
  M2M_OPTIONS:                 'fldXZqzpDkpCpEiaU',
  ALTERATIONS_OPTIONS:         'fld40aMei08HRGcJd',
  APPROVED_BY_PRODUCTION:      'fld6yhV6sLKglxfiu',
  SALES_ASSOCIATE:             'fldZ5towmwbgJho67',
  WEDDING_DATE:                'fldO0Lalw1SkwAf4D',
  DUE_DATE:                    'fldT2Kndwz0ZAMr4Y',
  AM_ORDER_NUMBER:             'fldBHv8y21WWNZiUa',
  AMOUNT_EMBROIDERY:           'fldfryrwA8fipol7v',
  SEND_TO_SLACK:               'fldG6tV91xqwh36P8',
  CUSTOMIZATION_DETAIL_NOTES:  'fldvZkupxKKTGpisu',
  PRICING_CUSTOMIZATION_TYPE:  'fld4XT7jm39PR6l1V',
  PRICING_SELECT:              'fldcGEEykOXjwEyqL',
  PRICING_PRICE:               'fldoFj5qMu6IRX53d',
  PRICING_PERCENT:             'fldzVvl1ZMSfEGQdQ',
  PRICING_MULTIPLE:            'fldEKZTpnJ5Y1gjOw',
  PRICING_IS_ACTIVE:           'fldWqVqCtMi5MVq9T',
  STAFF_FULL_NAME:             'fldc8INBZmwC3xeH7',
  STAFF_ROLE_NAME:             'fld1P7ZjPabKLrlPG',
  STAFF_IS_ACTIVE:             'fldB6rPTjxATp7uMf',
  STYLE_NAME:                  'fldEs3chQAeplPc1w',
} as const;

// Shared with getCustomProperties() below, so both the direct table lookup
// and the custom-property panel definition point at the same table.
const PRICING_TABLE_ID = 'tblccTHYe8BCqutyD';
const CUSTOMIZATIONS_TABLE_ID = 'tbl7HUWDI7IRjWY92';
// Same base as the Appointments interface — reuses its DF Clients table ID
// and "Favorite Styles in Appointment" field ID for the style-dropdown filter.
const CLIENTS_TABLE_ID = 'tblLLUlDgJ4ktzF7c';
const CLIENT_FAV_STYLES_APPT_FIELD_ID = 'fldVw8wCgPKvxN1jD';

const SA_ROLES = ['Client Specialist', 'General Manager', 'Account Manager', 'Client Relationships Director'];

const APPROVAL_STATUS_STEPS = [
  'Request', 'SA Draft', 'Sent to Production', 'Approved', 'Denied', 'Counter-Proposed', 'Proposed to Client', 'Purchased',
] as const;

const APPROVAL_STATUS_OPTIONS = [...APPROVAL_STATUS_STEPS];

// ─── External Field Sources ───────────────────────────────────────────────────
// Maps field IDs that are populated by external integrations to their source.
// Used to: (a) lock fields as non-editable, (b) show a colored dot on labels.
type FieldSource = 'acuity' | 'shopify' | 'apparel_magic';

const FIELD_SOURCE: Record<string, FieldSource> = {
  // Customizations table lookups
  [FIELD_IDS.WEDDING_DATE]:    'acuity',        // lookup of DF_Clients.Wedding_Date (Acuity)
  [FIELD_IDS.AM_ORDER_NUMBER]: 'apparel_magic', // lookup of AM Order Number (Apparel Magic)
  // DF_Styles fields (Shopify-sourced)
  [FIELD_IDS.STYLE_NAME]:      'shopify',
};

function isFieldReadOnlyBySource(fieldId?: string): boolean {
  if (!fieldId) return false;
  return fieldId in FIELD_SOURCE;
}

const SOURCE_COLORS: Record<FieldSource, { dot: string; text: string }> = {
  acuity:        { dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  shopify:       { dot: 'bg-green-500',  text: 'text-green-600  dark:text-green-400'  },
  apparel_magic: { dot: 'bg-amber-500',  text: 'text-amber-600  dark:text-amber-400'  },
};

// Renders a small colored dot next to a label when the field has an external source.
function SourceDot({ fieldId }: { fieldId?: string }) {
  if (!fieldId) return null;
  const source = FIELD_SOURCE[fieldId] as FieldSource | undefined;
  if (!source) return null;
  const { dot } = SOURCE_COLORS[source];
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1 ${dot}`} />;
}

// ─── Airtable color token → saturated accent hex ─────────────────────────────
// All Light1/Light2/Bright variants resolve to the same saturated color so that
// it can be used as text color with a low-opacity tint for the background.
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

// Builds a name→hex map from a singleSelect field's choices at runtime.
// Adapts automatically when field options are added/recolored.
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

// ─── Write Queue ──────────────────────────────────────────────────────────────
let _writeQueue = Promise.resolve();
function queueWrite(fn: () => Promise<void>): Promise<void> {
  const next = _writeQueue.then(fn);
  _writeQueue = next.then(() => {}, () => {});
  return next;
}

type ViewState = { layer: 1 } | { layer: 2; recordId: string; previousRecordId?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSingleSelectName(cell: unknown): string {
  if (!cell) return '';
  if (typeof cell === 'object' && 'name' in (cell as object)) return (cell as { name: string }).name ?? '';
  return String(cell);
}

function getLinkedRecordName(cell: unknown): string {
  if (!cell) return '—';
  if (Array.isArray(cell)) {
    return cell.map((v: unknown) =>
      typeof v === 'object' && v !== null && 'name' in v ? (v as { name: string }).name : String(v)
    ).filter(Boolean).join(', ') || '—';
  }
  return String(cell) || '—';
}

// Handles date fields and multipleLookupValues of date fields.
// Airtable SDK can return: ISO string, array of ISO strings, or array of date objects.
function resolveDateString(cell: unknown): string {
  if (cell == null) return '';
  if (Array.isArray(cell)) {
    for (const v of cell) {
      if (v == null) continue;
      if (typeof v === 'string' && v) return v;
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        // multipleLookupValues of date fields may wrap values
        const inner = obj.value ?? obj.date ?? obj.dateTime ?? obj.iso;
        if (inner && typeof inner === 'string') return inner;
        // fallback: stringify the object and hope for the best
        const s = String(v);
        if (s && s !== '[object Object]') return s;
      }
    }
    return '';
  }
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'object') {
    const obj = cell as Record<string, unknown>;
    const inner = obj.value ?? obj.date ?? obj.dateTime;
    if (inner && typeof inner === 'string') return inner;
  }
  return String(cell);
}

function formatWeddingDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '—';
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
    const day = d.getDate(); const year = d.getFullYear();
    const mod10 = day % 10; const mod100 = day % 100;
    const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
    return `${month} ${day}${suffix}, ${year}`;
  } catch { return '—'; }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  } catch { return '—'; }
}

// ─── FilterDropdown ───────────────────────────────────────────────────────────
function FilterDropdown({ label, values, options, onChange, searchable = false }: {
  label: string; values: string[]; options: string[]; onChange: (v: string[]) => void; searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);
  const filteredOptions = useMemo(
    () => searchable && query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options,
    [options, query, searchable]
  );
  const displayText = values.length === 0 ? 'All' : values.length === 1 ? values[0] : `${values.length} selected`;
  const toggle = useCallback((opt: string) => onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]), [values, onChange]);
  return (
    <div className="flex items-center gap-1.5" ref={containerRef}>
      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{label}</span>
      <div className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 min-w-[140px] bg-white dark:bg-[#25211A] border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-amber-400/50 outline-none transition-colors">
          <span className="truncate flex-1 text-left">{displayText}</span>
          {values.length > 0
            ? <XIcon size={14} className="text-gray-400 flex-shrink-0 hover:text-gray-600" onClick={e => { e.stopPropagation(); onChange([]); }} />
            : <CaretDownIcon size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg shadow-lg w-[240px] overflow-hidden">
            {searchable && (
              <div className="px-2 pt-1.5 pb-1 border-b border-gray-100 dark:border-white/5">
                <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
                  className="w-full rounded-md border border-gray-200 dark:border-[#38322A] bg-gray-50 dark:bg-[#1B1813] px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-amber-400 transition-colors" />
              </div>
            )}
            <button type="button" onClick={() => { onChange([]); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${values.length === 0 ? 'bg-amber-50 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>All</button>
            <div className="overflow-y-auto" style={{ maxHeight: Math.min(filteredOptions.length, 10) * 36 || 36, scrollbarWidth: 'none' }}>
              {filteredOptions.map(opt => {
                const sel = values.includes(opt);
                return (
                  <button key={opt} type="button" onClick={() => toggle(opt)} style={{ height: 36 }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${sel ? 'bg-amber-50 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                    <span className="truncate block">{opt}</span>
                  </button>
                );
              })}
              {filteredOptions.length === 0 && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No results</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ApprovalStatusPill — colors read from field choices at runtime ───────────
// colorMap is built via getChoiceColorMap(field) so it adapts as options change.
// Sizes are each 1pt smaller than the previous iteration:
//   table → text-xs (12px)   header chip → text-base (16px)
function ApprovalStatusPill({ status, colorMap, size = 'table' }: {
  status: string; colorMap: Record<string, string>; size?: 'table' | 'header';
}) {
  const hex = colorMap[status] ?? '#9CA3AF';
  const textSize = size === 'header' ? 'text-base' : 'text-xs';
  const inlineStyle = { backgroundColor: hex + '20', color: hex, borderColor: hex + '55' };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium border ${textSize}`}
      style={inlineStyle}
    >
      {status || '—'}
    </span>
  );
}

// ─── StyleSelectSingle ────────────────────────────────────────────────────────
function StyleSelectSingle({ value, options, placeholder, onChange, disabled }: {
  value: string | null; options: Array<{ id: string; label: string }>; placeholder: string;
  onChange: (id: string | null) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = useMemo(() => q.trim() ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options, [options, q]);
  const sel = options.find(o => o.id === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        className="w-full flex items-center justify-between gap-2 bg-white dark:bg-[#1B1813] border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-2 text-sm text-left outline-none hover:border-gray-400 dark:hover:border-amber-400/50 transition-colors disabled:opacity-50">
        <span className={sel ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>{sel?.label ?? placeholder}</span>
        <CaretDownIcon size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-xl shadow-xl max-h-[260px] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <div className="relative">
              <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-[#38322A] rounded-md focus:outline-none focus:border-amber-400 bg-white dark:bg-[#1B1813] text-gray-700 dark:text-gray-300" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            <button type="button" onClick={() => { onChange(null); setOpen(false); setQ(''); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${!value ? 'bg-amber-50 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>{placeholder}</button>
            {filtered.map(o => (
              <button key={o.id} type="button" onClick={() => { onChange(o.id); setOpen(false); setQ(''); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${o.id === value ? 'bg-amber-50 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pricing math ──────────────────────────────────────────────────────────────
// A Customization Pricing row prices itself one of three ways, in priority order:
// a flat dollar amount, a percentage of `basisAmount` (stored as a 0–1 fraction,
// matching the existing `${Math.round(p * 100)}%` display convention), or a
// "multiple" fee that gets scaled by multiplierFactor (Self Usage × the
// Amount-of-Embroidery/Paint/Lace tier — see computeMultiplierFactor below).
// Reused for both regular line items and the rush fee row so both go through
// the exact same rule.
function resolvePricingRow(
  r: AirtableRecord,
  fields: { priceField: unknown; percentField: unknown; multiField: unknown },
  basisAmount: number,
  multiplierFactor: number
): { amount: number; label: string | null } {
  const priceField = fields.priceField as Parameters<AirtableRecord['getCellValue']>[0] | null;
  const percentField = fields.percentField as Parameters<AirtableRecord['getCellValue']>[0] | null;
  const multiField = fields.multiField as Parameters<AirtableRecord['getCellValue']>[0] | null;
  if (priceField) { const p = r.getCellValue(priceField); if (typeof p === 'number' && p > 0) return { amount: p, label: null }; }
  if (percentField) {
    const p = r.getCellValue(percentField);
    // A percent-based row's dollar amount is derived, not stored — surface the
    // rate itself (e.g. "20% base cost") next to the name, or it silently
    // reads just like any flat-priced row.
    if (typeof p === 'number' && p > 0) return { amount: basisAmount * p, label: `${Math.round(p * 100)}% base cost` };
  }
  if (multiField) {
    const raw = r.getCellValue(multiField);
    // The stored Multiple Fee is a base rate, not the final price — Airtable's
    // real formula scales it by Self Usage and the embroidery/paint/lace tier
    // before it's the actual charge. Surface the raw rate as a label (e.g.
    // "$1,500.00 multiplier") since the Price column now shows the scaled amount.
    if (typeof raw === 'number' && raw > 0) return { amount: raw * multiplierFactor, label: `${formatCurrency(raw)} multiplier` };
  }
  return { amount: 0, label: null };
}

// IF({Customization - Multiple Fee}, {Customization - Multiple Fee}, 0)
//   * IF({Self Usage}, {Self Usage}, 1)
//   * SWITCH(LOWER({Amount of Embroidery/Paint/Lace} & ""), "light", 0.33, "medium", 0.67, "full", 1, 0)
// The first term (the raw Multiple Fee) is applied where it's read, in
// resolvePricingRow above — this only covers the Self Usage × embroidery-tier
// portion, since that part is constant across every multiplier-priced line
// item on the same request.
function computeMultiplierFactor(selfUsage: number, embroidery: string | null): number {
  const selfUsageFactor = selfUsage && selfUsage !== 0 ? selfUsage : 1;
  const embroideryFactor = embroidery === 'Light' ? 0.33 : embroidery === 'Medium' ? 0.67 : embroidery === 'Full' ? 1 : 0;
  return selfUsageFactor * embroideryFactor;
}

function formatCurrency(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Base Price can be a lookup/rollup, whose raw getCellValue() is a wrapped
// object rather than a plain number (formatCurrency on that silently prints
// "[object Object]" via Object.prototype.toLocaleString). getCellValueAsString
// already renders it correctly elsewhere in this file, so parse the number
// back out of that formatted string instead of trusting the raw cell shape.
//
// The base's number format can be US-style (1,990.00) or EU/LatAm-style
// (1.990,00) — a naive "strip commas, keep dots" parse silently misreads EU
// formatting, e.g. "$11.990,00" became 11.99 instead of 11990. Whichever of
// "." or "," appears LAST is the real decimal separator only if it's followed
// by 1–2 digits (currency cents); everything before it, dot or comma, is a
// thousands-grouping mark and gets stripped. If the trailing run is 3+ digits
// (or there's no separator at all), there is no decimal part — every "." and
// "," present is a thousands grouping.
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

// Matches the Pricing table's category/type text against a concept keyword,
// normalized (lowercase, non-alphanumeric stripped) so naming drift doesn't
// silently break the match — see skill guidance on field/choice matching.
function normalizedIncludes(value: string, keyword: string): boolean {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').includes(keyword);
}

// ─── Custom Properties ─────────────────────────────────────────────────────────
// Every other field in this file is bound by a hardcoded FIELD_IDS constant, so
// there's normally no config panel in Omni for the user to remap anything. The
// Pre-Approval field is the one exception: it has no known field ID (it wasn't
// given one when this interface was scoped), so it's the one property exposed
// here — this gives the user a panel entry to fix the binding by hand if the
// name-based auto-match below picks the wrong field or none.
//
// Manager Approval Status used to be here too, while it was still an unnamed
// single-select with no field ID. It's since been given a real, stable
// identity — the user repurposed APPROVED_BY_PRODUCTION (fld6yhV6sLKglxfiu)
// into that exact single-select — so it's back to a plain FIELD_IDS lookup in
// RecordDetailPage below, same as everything else in this file.
function getCustomProperties(base: ReturnType<typeof useBase>) {
  const pricingTable = base.getTableByIdIfExists(PRICING_TABLE_ID);
  const customizationsTable = base.getTableByIdIfExists(CUSTOMIZATIONS_TABLE_ID);
  const clientsTable = base.getTableByIdIfExists(CLIENTS_TABLE_ID);
  const isSingleSelect = (f: { config: { type: FieldType } }) => f.config.type === FieldType.SINGLE_SELECT;

  return [
    pricingTable && {
      key: 'preApprovalField',
      label: 'Pre-Approval field (Customization Pricing)',
      type: 'field' as const,
      table: pricingTable,
      shouldFieldBeAllowed: isSingleSelect,
      defaultValue: pricingTable.fields.find(f => normalizedIncludes(f.name, 'preapproval')),
    },
    // None of these three have a known field ID — Rush Fee with Proposed
    // Custom Price / Rush Fee % / Self Usage were all added after this
    // interface was first scoped, so (like Pre-Approval above) they're
    // exposed here rather than guessed at via FIELD_IDS.
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
      key: 'selfUsageField',
      label: 'Self Usage field (Customizations)',
      type: 'field' as const,
      table: customizationsTable,
      defaultValue: customizationsTable.fields.find(f => normalizedIncludes(f.name, 'selfusage')),
    },
    // Favorite Styles in Appointment (DF Clients) — used to scope the Style
    // dropdown to the client's own favorites. No known field ID was
    // confirmed for this interface's connection to the Clients table, so
    // (same reasoning as every other property here) it's exposed rather
    // than trusted as a hardcoded FIELD_IDS-style constant.
    clientsTable && {
      key: 'favoriteStylesApptField',
      label: 'Favorite Styles in Appointment field (Clients)',
      type: 'field' as const,
      table: clientsTable,
      defaultValue: clientsTable.getFieldIfExists(CLIENT_FAV_STYLES_APPT_FIELD_ID)
        ?? clientsTable.fields.find(f => normalizedIncludes(f.name, 'favoritestyle')),
    },
  ].filter(Boolean);
}

// ─── LineItemsTable ────────────────────────────────────────────────────────────
// Invoice-style, searchable breakdown table — replaces the old multi-select
// dropdown. Search adds a row; each row shows name, price, and that specific
// customization's own approval status (Pricing table's Pre-Approval field, not
// the whole request's APPROVAL_STATUS).
function LineItemsTable({
  selectedItems, suggestions, onAdd, onRemove, preApprovalColorMap, totalAmount, disabled,
}: {
  selectedItems: Array<{ id: string; name: string; label: string | null; amount: number; approval: string }>;
  suggestions: Array<{ id: string; name: string; label: string | null; amount: number }>;
  onAdd: (id: string) => void; onRemove: (id: string) => void;
  preApprovalColorMap: Record<string, string>; totalAmount: number; disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!query.trim()) return suggestions;
    const q = query.toLowerCase();
    return suggestions.filter(s => s.name.toLowerCase().includes(q));
  }, [suggestions, query]);

  const addAndClear = (id: string) => { onAdd(id); setQuery(''); setOpen(false); };

  return (
    <div>
      {!disabled && (
        <div ref={ref} className="relative mb-2">
          <div className="relative">
            <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search customizations to add…" value={query}
              onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-[#38322A] rounded-lg focus:outline-none focus:border-amber-400 bg-white dark:bg-[#1B1813] text-gray-700 dark:text-gray-300 transition-colors" />
          </div>
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-xl shadow-xl max-h-[260px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {filteredSuggestions.map(s => (
                <button key={s.id} type="button" onClick={() => addAndClear(s.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-white/5 last:border-0">
                  <span>
                    {s.name}
                    {s.label && <span className="text-sm font-medium text-gray-400 dark:text-gray-500"> ({s.label})</span>}
                  </span>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{formatCurrency(s.amount)}</span>
                </button>
              ))}
              {filteredSuggestions.length === 0 && <div className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">No matching customizations</div>}
            </div>
          )}
        </div>
      )}
      <div className="bg-white dark:bg-[#1B1813] border border-gray-200 dark:border-[#38322A] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
            <tr>
              {!disabled && <th className="px-3 py-2 w-8" />}
              <th className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Customization</th>
              <th className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Rate</th>
              <th className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Pre-Approval</th>
              <th className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map(item => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 last:border-0">
                {!disabled && (
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}
                      className="text-gray-400 hover:text-red-500 transition-colors">
                      <XIcon size={14} />
                    </button>
                  </td>
                )}
                <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100">{item.name}</td>
                <td className="px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400">{item.label ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <ApprovalStatusPill status={item.approval} colorMap={preApprovalColorMap} />
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 text-right">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
            {selectedItems.length === 0 && (
              <tr>
                <td colSpan={disabled ? 4 : 5} className="px-3 py-6 text-center text-gray-400 dark:text-gray-500 text-sm">
                  No customizations added yet.
                </td>
              </tr>
            )}
            {/* Total is always shown, even at $0.00 with no line items. */}
            <tr className="border-t border-gray-200 dark:border-white/10">
              {!disabled && <td className="px-3 py-2.5" />}
              <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100">Total</td>
              <td className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100 text-right">{formatCurrency(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── RecordDetailPage ─────────────────────────────────────────────────────────
function RecordDetailPage({
  record, table, pricingRecords, pricingTable, stylesRecords, preApprovalField,
  rushFeeProposedField, rushFeePercentField, selfUsageField,
  clientRecords, favoriteStylesApptField, onBack,
}: {
  record: AirtableRecord; table: Table; pricingRecords: AirtableRecord[]; pricingTable: Table | null;
  stylesRecords: AirtableRecord[]; preApprovalField: Field | null;
  rushFeeProposedField: Field | null; rushFeePercentField: Field | null; selfUsageField: Field | null;
  clientRecords: AirtableRecord[]; favoriteStylesApptField: Field | null;
  onBack: () => void;
}) {
  const canUpdate = table.hasPermissionToUpdateRecords();

  const fApprStatus = table.getFieldIfExists(FIELD_IDS.APPROVAL_STATUS);
  const fStyled     = table.getFieldIfExists(FIELD_IDS.CUSTOMIZED_STYLE);
  const fPricing    = table.getFieldIfExists(FIELD_IDS.CUSTOMIZATION_PRICING);
  const fDetail     = table.getFieldIfExists(FIELD_IDS.CUSTOMIZATION_DETAIL);
  const fEmbroidery = table.getFieldIfExists(FIELD_IDS.AMOUNT_EMBROIDERY);
  const fBasePrice  = table.getFieldIfExists(FIELD_IDS.BASE_PRICE);
  const fAltsM2m    = table.getFieldIfExists(FIELD_IDS.ALTS_M2M);
  const fApproved   = table.getFieldIfExists(FIELD_IDS.APPROVED_PRICING);
  const fClient     = table.getFieldIfExists(FIELD_IDS.CLIENT);
  const fManagerApproval = table.getFieldIfExists(FIELD_IDS.APPROVED_BY_PRODUCTION);

  // ── Pricing table fields, shared by every line item and the rush fee row ───
  const pPriceField   = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_PRICE) : null;
  const pPercentField = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_PERCENT) : null;
  const pMultiField   = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_MULTIPLE) : null;
  const pTypeField    = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_CUSTOMIZATION_TYPE) : null;
  const pActiveField  = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_IS_ACTIVE) : null;
  // Pre-Approval (per-line-item approval status) has no fixed field ID, so
  // unlike the rest of this file it's bound via the custom-properties panel
  // (see getCustomProperties above) rather than a hardcoded FIELD_IDS lookup —
  // that panel is what lets the user fix the binding by hand if it's wrong.

  const [approvalStatus, setApprovalStatus] = useState(fApprStatus ? getSingleSelectName(record.getCellValue(fApprStatus)) : '');
  const approvalColorMap = useMemo(() => getChoiceColorMap(fApprStatus), [fApprStatus]);
  const [styleId,    setStyleId]    = useState<string | null>(() => { const v = fStyled ? record.getCellValue(fStyled) as Array<{id: string}> | null : null; return v?.[0]?.id ?? null; });
  const [pricingIds, setPricingIds] = useState<string[]>(() => { const v = fPricing ? record.getCellValue(fPricing) as Array<{id: string}> | null : null; return v?.map(x => x.id) ?? []; });
  const [detail,     setDetail]     = useState(fDetail ? record.getCellValueAsString(fDetail) : '');
  const [embroidery, setEmbroidery] = useState<string | null>(fEmbroidery ? record.getCellValueAsString(fEmbroidery) || null : null);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterNotes, setCounterNotes] = useState(fDetail ? record.getCellValueAsString(fDetail) : '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // ── Concurrent-edit detection ──────────────────────────────────────────────
  // Hash the editable fields we care about so we can detect external changes.
  const recordHash = useCallback(() => [
    fApprStatus  ? record.getCellValueAsString(fApprStatus)  : '',
    fStyled      ? record.getCellValueAsString(fStyled)      : '',
    fPricing     ? record.getCellValueAsString(fPricing)     : '',
    fDetail      ? record.getCellValueAsString(fDetail)      : '',
    fEmbroidery  ? record.getCellValueAsString(fEmbroidery)  : '',
  ].join('||'), [record, fApprStatus, fStyled, fPricing, fDetail, fEmbroidery]);

  const mountedHashRef = useRef(recordHash());
  const [concurrentEditWarning, setConcurrentEditWarning] = useState(false);

  useEffect(() => {
    const current = recordHash();
    if (current !== mountedHashRef.current && !concurrentEditWarning) {
      setConcurrentEditWarning(true);
    }
  }, [recordHash, concurrentEditWarning]);

  const reloadFromRecord = useCallback(() => {
    if (fApprStatus)  setApprovalStatus(getSingleSelectName(record.getCellValue(fApprStatus)));
    if (fStyled)      setStyleId((record.getCellValue(fStyled) as Array<{id:string}>|null)?.[0]?.id ?? null);
    if (fPricing)     setPricingIds((record.getCellValue(fPricing) as Array<{id:string}>|null)?.map(x => x.id) ?? []);
    if (fDetail)      setDetail(record.getCellValueAsString(fDetail));
    if (fEmbroidery)  setEmbroidery(record.getCellValueAsString(fEmbroidery) || null);
    mountedHashRef.current = recordHash();
    setConcurrentEditWarning(false);
  }, [record, fApprStatus, fStyled, fPricing, fDetail, fEmbroidery, recordHash]);

  const autoSave = useCallback((patch: Record<string, unknown>) => {
    queueWrite(() => table.updateRecordAsync(record.id, patch)).catch(err => console.error('Auto-save failed:', err));
  }, [table, record.id]);

  const handleStyleId  = (id: string | null) => { setStyleId(id); if (fStyled) autoSave({ [fStyled.id]: id ? [{ id }] : null }); };
  const handlePricing  = (ids: string[])     => { setPricingIds(ids); if (fPricing) autoSave({ [fPricing.id]: ids.map(id => ({ id })) }); };
  const handleEmbroidery = (v: string | null) => { setEmbroidery(v); if (fEmbroidery) autoSave({ [fEmbroidery.id]: v ? { name: v } : null }); };
  const addLineItem    = (id: string) => handlePricing([...pricingIds, id]);
  const removeLineItem = (id: string) => handlePricing(pricingIds.filter(x => x !== id));

  const MANAGER_APPROVAL_OPTIONS = ['Pending Approval', 'Approved', 'Rejected'] as const;
  const [managerApprovalStatus, setManagerApprovalStatus] = useState(
    fManagerApproval ? (getSingleSelectName(record.getCellValue(fManagerApproval)) || 'Pending Approval') : 'Pending Approval'
  );
  // Once Approved or Rejected, the dropdown locks — only Pending Approval
  // stays editable. This is a deliberate one-way gate, not a permission check.
  const isManagerApprovalLocked = managerApprovalStatus === 'Approved' || managerApprovalStatus === 'Rejected';
  const handleManagerApprovalChange = (value: string) => {
    if (isManagerApprovalLocked) return;
    setManagerApprovalStatus(value);
    if (fManagerApproval) autoSave({ [fManagerApproval.id]: { name: value } });
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      // APPROVED_BY_PRODUCTION is now the Manager Approval single-select
      // field (see below) — a separate concern from this production-review
      // Approve/Deny flow, so it's no longer touched here as a side effect.
      await queueWrite(() => table.updateRecordAsync(record.id, {
        [FIELD_IDS.APPROVAL_STATUS]: { name: 'Approved' },
      }));
      setApprovalStatus('Approved');
    } catch (e) { setError('Failed to approve.'); }
    finally { setSaving(false); }
  };

  const handleDeny = async () => {
    setSaving(true);
    try {
      await queueWrite(() => table.updateRecordAsync(record.id, {
        [FIELD_IDS.APPROVAL_STATUS]: { name: 'Denied' },
      }));
      setApprovalStatus('Denied');
    } catch (e) { setError('Failed to deny.'); }
    finally { setSaving(false); }
  };

  const handleSubmitCounter = async () => {
    setSaving(true);
    try {
      const priceVal = counterPrice ? parseFloat(counterPrice) : null;
      await queueWrite(() => table.updateRecordAsync(record.id, {
        [FIELD_IDS.APPROVAL_STATUS]: { name: 'Counter-Proposed' },
        [FIELD_IDS.APPROVED_PRICING]: priceVal,
        [FIELD_IDS.CUSTOMIZATION_DETAIL]: counterNotes,
      }));
      setApprovalStatus('Counter-Proposed');
      setDetail(counterNotes);
      setShowCounterForm(false);
    } catch (e) { setError('Failed to submit counter-proposal.'); }
    finally { setSaving(false); }
  };

  const clientName   = fClient ? getLinkedRecordName(record.getCellValue(fClient)) : '—';

  // Style dropdown is scoped to the linked client's own Favorite Styles in
  // Appointment (DF Clients), not every style in the base. Falls back to the
  // full list when the client link, table, or field can't be resolved, and
  // always keeps whatever style is already selected in the list even if it
  // isn't one of the client's favorites — narrows new picks, doesn't hide
  // an existing one.
  const linkedClientId = fClient ? ((record.getCellValue(fClient) as Array<{ id: string }> | null)?.[0]?.id ?? null) : null;
  const favoriteStyleIds = useMemo(() => {
    if (!linkedClientId || !favoriteStylesApptField) return null;
    const clientRec = clientRecords.find(c => c.id === linkedClientId);
    if (!clientRec) return null;
    const v = clientRec.getCellValue(favoriteStylesApptField) as Array<{ id: string }> | null;
    return v ? v.map(x => x.id) : [];
  }, [linkedClientId, clientRecords, favoriteStylesApptField]);

  const styleOptions = useMemo(() => {
    const base = favoriteStyleIds && favoriteStyleIds.length > 0
      ? stylesRecords.filter(r => favoriteStyleIds.includes(r.id) || r.id === styleId)
      : stylesRecords;
    return base.map(r => ({ id: r.id, label: r.name })).sort((a, b) => a.label.localeCompare(b.label));
  }, [stylesRecords, favoriteStyleIds, styleId]);

  const isProductionReview = approvalStatus === 'Sent to Production';

  // ── Pricing breakdown ───────────────────────────────────────────────────────
  // Base Price, Rush Fee, and M2M / Alterations are shown as-is from their
  // stored fields (same values Current.txt always displayed — whatever formula
  // or rollup backs them in the base is out of scope here). Only Total
  // Customization Costs is computed live, from the line items table above,
  // since that's the one figure the picker used to leave stale.
  const preApprovalColorMap = useMemo(() => getChoiceColorMap(preApprovalField), [preApprovalField]);
  const basePriceNumber = fBasePrice ? parseCurrencyString(record.getCellValueAsString(fBasePrice)) : 0;
  // Rush Fee now reads the real "Rush Fee with Proposed Custom Price" formula
  // field directly (this interface never previews a not-yet-saved record, so
  // there's no need for a client-side estimate here — see the recap interface
  // for that case). Rush Fee % is a separate formula field, shown alongside
  // in parentheses, same styling as the other rate labels, omitted if blank.
  const rushFeeAmount = rushFeeProposedField ? parseCurrencyString(record.getCellValueAsString(rushFeeProposedField)) : 0;
  const rushFeePercentDisplay = rushFeePercentField ? record.getCellValueAsString(rushFeePercentField) : '';
  const altsM2mDisplay = fAltsM2m ? record.getCellValueAsString(fAltsM2m) || '—' : '—';
  const altsM2mAmount = fAltsM2m ? parseCurrencyString(record.getCellValueAsString(fAltsM2m)) : 0;

  // Self Usage is a lookup off Customized Style (DF Styles), same wrapped-cell
  // caveat as Base Price — read via getCellValueAsString, not raw getCellValue.
  const selfUsageValue = selfUsageField ? parseCurrencyString(record.getCellValueAsString(selfUsageField)) : 0;
  const multiplierFactor = useMemo(
    () => computeMultiplierFactor(selfUsageValue, embroidery),
    [selfUsageValue, embroidery]
  );

  const priceableFields = useMemo(
    () => ({ priceField: pPriceField, percentField: pPercentField, multiField: pMultiField }),
    [pPriceField, pPercentField, pMultiField]
  );

  const selectedItems = useMemo(() => {
    if (!pTypeField) return [];
    return pricingIds.map(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return null;
      const { amount, label } = resolvePricingRow(r, priceableFields, basePriceNumber, multiplierFactor);
      return {
        id: r.id,
        name: r.getCellValueAsString(pTypeField),
        label,
        amount,
        approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '',
      };
    }).filter((x): x is { id: string; name: string; label: string | null; amount: number; approval: string } => x !== null);
  }, [pricingIds, pricingRecords, pTypeField, priceableFields, basePriceNumber, multiplierFactor, preApprovalField]);

  const suggestions = useMemo(() => {
    if (!pTypeField) return [];
    return pricingRecords
      .filter(r => !pricingIds.includes(r.id))
      .filter(r => !pActiveField || r.getCellValue(pActiveField) === true)
      .map(r => {
        const { amount, label } = resolvePricingRow(r, priceableFields, basePriceNumber, multiplierFactor);
        return { id: r.id, name: r.getCellValueAsString(pTypeField), label, amount };
      });
  }, [pricingRecords, pricingIds, pTypeField, pActiveField, priceableFields, basePriceNumber, multiplierFactor]);

  const totalCustomizationCost = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.amount, 0),
    [selectedItems]
  );

  const grandTotal = basePriceNumber + totalCustomizationCost + rushFeeAmount + altsM2mAmount;

  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium mb-1.5 block';
  const inputCls = 'w-full border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-white dark:bg-[#1B1813] transition-colors';

  return (
    <div className="h-screen flex flex-col font-sans antialiased" style={{ backgroundColor: '#F8F5EE' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-[#E9E0CE] dark:border-[#38322A] bg-white dark:bg-[#25211A]">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-[#38322A] rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex-shrink-0">
          <ArrowLeftIcon size={16} />
          Go back
        </button>
        <span className="text-xl font-bold text-gray-900 dark:text-[#F5F3EF] truncate">{clientName}</span>
        {/* Approval Status chip — non-editable, colors from field choices */}
        {approvalStatus && (
          <ApprovalStatusPill status={approvalStatus} colorMap={approvalColorMap} size="header" />
        )}
        {/* Source legend + action buttons pushed to the right */}
        <div className="ml-auto flex items-center gap-4 flex-shrink-0">
          {/* Field source legend */}
          <div className="flex flex-col justify-between h-14 items-start">
            {(Object.entries(SOURCE_COLORS) as [FieldSource, { dot: string; text: string }][]).map(([src, { dot, text }]) => (
              <span key={src} className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                {src === 'acuity' ? 'Acuity' : src === 'shopify' ? 'Shopify' : 'Apparel Magic'}
              </span>
            ))}
          </div>
        {canUpdate && isProductionReview && (
          <div className="flex items-center gap-2">
            {!showCounterForm ? (
              <>
                <button type="button" onClick={handleApprove} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
                  <CheckCircleIcon size={15} /> Approve
                </button>
                <button type="button" onClick={handleDeny} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
                  <XSquareIcon size={15} /> Deny
                </button>
                <button type="button" onClick={() => setShowCounterForm(true)} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
                  <ArrowCounterClockwiseIcon size={15} /> Counter-Propose
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleSubmitCounter} disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors disabled:opacity-50">
                  Submit Counter-Proposal
                </button>
                <button type="button" onClick={() => setShowCounterForm(false)}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:underline cursor-pointer transition-colors">
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
        </div>{/* end ml-auto wrapper */}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Concurrent-edit warning */}
        {concurrentEditWarning && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 bg-amber-50 dark:bg-amber-400/10 border-b border-amber-200 dark:border-amber-400/30">
            <span className="text-sm text-amber-800 dark:text-amber-300">
              This record was updated by another user while you had it open.
            </span>
            <button type="button" onClick={reloadFromRecord}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40 hover:bg-amber-200 dark:hover:bg-amber-400/30 transition-colors">
              Reload record
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-5">
          <div className="mx-auto space-y-5" style={{ width: '60%' }}>

            {/* Customized Style — a single fixed row, not an invoice table: no
                background/border chrome, so nothing implies more than one row
                could exist here. No overflow-hidden on the wrapper (unlike the
                other invoice tables): the style picker's dropdown is
                absolutely positioned and pops out below the row, so clipping
                the container also clipped and broke the dropdown. Base Price
                is a lookup off the selected style, so it updates on its own
                once Airtable recomputes it after the write below. */}
            <div>
              <span className={labelCls}>Customized Style</span>
              <div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Style</th>
                      <th className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Base Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2.5">
                        <StyleSelectSingle value={styleId} options={styleOptions} placeholder="Select a style…"
                          onChange={handleStyleId} disabled={!canUpdate} />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100 text-right">{formatCurrency(basePriceNumber)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Embroidery Amount */}
            <div>
              <span className={labelCls}>Embroidery Amount</span>
              <div className="flex gap-2">
                {(['Light', 'Medium', 'Full'] as const).map(o => (
                  <button key={o} type="button"
                    onClick={() => canUpdate && handleEmbroidery(embroidery === o ? null : o)}
                    disabled={!canUpdate}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                      embroidery === o
                        ? 'bg-amber-600 dark:bg-amber-400 border-amber-600 dark:border-amber-400 text-white dark:text-gray-900'
                        : 'border-gray-300 dark:border-[#38322A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}>{o}</button>
                ))}
              </div>
            </div>

            {/* Customizations — invoice-style, searchable breakdown table */}
            <div>
              <span className={labelCls}>Customizations</span>
              <LineItemsTable
                selectedItems={selectedItems}
                suggestions={suggestions}
                onAdd={addLineItem}
                onRemove={removeLineItem}
                preApprovalColorMap={preApprovalColorMap}
                totalAmount={totalCustomizationCost}
                disabled={!canUpdate}
              />
            </div>

            {/* Additional Fees — Rush Fee / M2M / Grand Total */}
            <div className="pt-5">
              <span className={labelCls}>Additional Fees</span>
              {[
                { label: 'Rush Fee',          display: formatCurrency(rushFeeAmount), sub: rushFeePercentDisplay || null },
                { label: 'M2M / Alterations', display: altsM2mDisplay,                sub: null },
              ].map(({ label, display, sub }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {label}
                    {sub && <span className="text-sm font-medium text-gray-400 dark:text-gray-500"> ({sub})</span>}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-200">{display}</span>
                </div>
              ))}
              <div className="flex justify-between items-center font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-white/20 pt-2">
                <span className="text-sm">Grand Total</span>
                <span className="text-sm">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Customization Detail */}
            <div>
              <span className={labelCls}>Customization Detail</span>
              <textarea value={detail} onChange={e => setDetail(e.target.value)}
                onBlur={() => { if (fDetail) autoSave({ [fDetail.id]: detail || null }); }}
                disabled={!canUpdate}
                placeholder="Describe the specific customization…"
                rows={3} className={`${inputCls} resize-none`} />
            </div>

            {/* Manager-level approval — replaces the old Slack-based approval step.
                Locks once Approved is picked; Pending/Rejected stay editable. */}
            <div>
              <span className={labelCls}>Manager Approval</span>
              <select value={managerApprovalStatus} disabled={!canUpdate || isManagerApprovalLocked}
                onChange={e => handleManagerApprovalChange(e.target.value)}
                className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}>
                {MANAGER_APPROVAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Counter-proposal form */}
            {isProductionReview && showCounterForm && (
              <div className="space-y-3 border-t border-gray-200 dark:border-white/10 pt-4">
                <div>
                  <label className={labelCls}>Counter-Proposed Price</label>
                  <input type="number" value={counterPrice} onChange={e => setCounterPrice(e.target.value)}
                    className={`${inputCls} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                    placeholder="Enter revised price" />
                </div>
                <div>
                  <label className={labelCls}>Revised Design Notes</label>
                  <textarea value={counterNotes} onChange={e => setCounterNotes(e.target.value)}
                    className={`${inputCls} resize-none`} rows={3} />
                </div>
              </div>
            )}

            {/* Status banners */}
            {approvalStatus === 'Counter-Proposed' && (
              <div className="bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/30 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                Production has counter-proposed. Review the revised price above.
              </div>
            )}
            {approvalStatus === 'Denied' && (
              <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
                This customization request was denied.
              </div>
            )}
            {approvalStatus === 'Purchased' && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                Finalized and purchased.
              </div>
            )}
            {(approvalStatus === 'Approved' || approvalStatus === 'Counter-Proposed' || approvalStatus === 'Purchased') && fApproved && (
              <div>
                <span className={labelCls}>{approvalStatus === 'Counter-Proposed' ? 'Counter-Proposed Price' : 'Approved Price'}</span>
                <div className="text-sm text-gray-900 dark:text-gray-200">{record.getCellValueAsString(fApproved) || '—'}</div>
              </div>
            )}
            {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}

          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function CustomizationApp(): React.ReactElement {
  useTheme();
  const base = useBase();

  const customizationsTable = base.getTableByIdIfExists(CUSTOMIZATIONS_TABLE_ID);
  const pricingTable        = base.getTableByIdIfExists(PRICING_TABLE_ID);
  const stylesTable         = base.getTableByIdIfExists('tbl0hWIRBbcB4UkVC');
  const staffTable          = base.getTableByIdIfExists('tblbYk88xJ8FQrLS4');
  const clientsTable        = base.getTableByIdIfExists(CLIENTS_TABLE_ID);

  const { customPropertyValueByKey } = useCustomProperties(getCustomProperties);
  const preApprovalField     = (customPropertyValueByKey?.preApprovalField as Field | undefined) ?? null;
  const rushFeeProposedField = (customPropertyValueByKey?.rushFeeProposedField as Field | undefined) ?? null;
  const rushFeePercentField  = (customPropertyValueByKey?.rushFeePercentField as Field | undefined) ?? null;
  const selfUsageField       = (customPropertyValueByKey?.selfUsageField as Field | undefined) ?? null;
  const favoriteStylesApptField = (customPropertyValueByKey?.favoriteStylesApptField as Field | undefined) ?? null;

  const allCustomizationRecords = useRecords(customizationsTable);
  const pricingRecords          = useRecords(pricingTable);
  const styleRecords            = useRecords(stylesTable);
  const staffRecords            = useRecords(staffTable);
  const clientRecords           = useRecords(clientsTable);

  const [viewState,            setViewState]            = useState<ViewState>({ layer: 1 });
  const [filterSA,             setFilterSA]             = useState<string[]>([]);
  const [filterStyle,          setFilterStyle]          = useState<string[]>([]);
  const [filterApprovalStatus, setFilterApprovalStatus] = useState<string[]>([]);

  const saOptions = useMemo(() => {
    if (!staffTable || !staffRecords) return [];
    const isActiveField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_IS_ACTIVE);
    const roleNameField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_ROLE_NAME);
    const fullNameField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_FULL_NAME);
    return staffRecords.filter(r => {
      const active = isActiveField ? r.getCellValue(isActiveField) === true : true;
      if (!active) return false;
      const roleStr = roleNameField ? r.getCellValueAsString(roleNameField) : '';
      return SA_ROLES.some(role => roleStr.includes(role));
    }).map(r => fullNameField ? r.getCellValueAsString(fullNameField) : r.name).filter(Boolean).sort();
  }, [staffRecords, staffTable]);

  const styleOptions = useMemo(() => {
    if (!stylesTable) return [];
    const styleNameField = stylesTable.getFieldIfExists(FIELD_IDS.STYLE_NAME);
    return styleRecords.map(r => styleNameField ? r.getCellValueAsString(styleNameField) : r.name).filter(Boolean).sort();
  }, [styleRecords, stylesTable]);

  const fields = useMemo(() => {
    if (!customizationsTable) return null;
    return {
      client:                   customizationsTable.getFieldIfExists(FIELD_IDS.CLIENT),
      customizedStyle:          customizationsTable.getFieldIfExists(FIELD_IDS.CUSTOMIZED_STYLE),
      approvalStatus:           customizationsTable.getFieldIfExists(FIELD_IDS.APPROVAL_STATUS),
      salesAssociate:           customizationsTable.getFieldIfExists(FIELD_IDS.SALES_ASSOCIATE),
      dateOfRequest:            customizationsTable.getFieldIfExists(FIELD_IDS.DATE_OF_REQUEST),
      weddingDate:              customizationsTable.getFieldIfExists(FIELD_IDS.WEDDING_DATE),
      proposedTotalCustomPrice: customizationsTable.getFieldIfExists(FIELD_IDS.PROPOSED_TOTAL_CUSTOM_PRICE),
      approvedPricing:          customizationsTable.getFieldIfExists(FIELD_IDS.APPROVED_PRICING),
    };
  }, [customizationsTable]);

  const approvalChoiceColors = useMemo(() => getChoiceColorMap(fields?.approvalStatus ?? null), [fields]);

  const filteredRecords = useMemo(() => {
    if (!fields) return [];
    return allCustomizationRecords.filter(record => {
      const saValue     = fields.salesAssociate   ? record.getCellValueAsString(fields.salesAssociate) : '';
      const styleRaw    = fields.customizedStyle  ? record.getCellValue(fields.customizedStyle)        : null;
      const styleValue  = getLinkedRecordName(styleRaw);
      const approvalVal = fields.approvalStatus ? getSingleSelectName(record.getCellValue(fields.approvalStatus)) : '';
      return (filterSA.length === 0            || filterSA.some(f => saValue.includes(f)))
          && (filterStyle.length === 0          || filterStyle.some(f => styleValue.includes(f)))
          && (filterApprovalStatus.length === 0 || filterApprovalStatus.includes(approvalVal));
    }).sort((a, b) => {
      const aDate = fields.dateOfRequest ? resolveDateString(a.getCellValue(fields.dateOfRequest)) : '';
      const bDate = fields.dateOfRequest ? resolveDateString(b.getCellValue(fields.dateOfRequest)) : '';
      return bDate.localeCompare(aDate);
    });
  }, [allCustomizationRecords, filterSA, filterStyle, filterApprovalStatus, fields]);

  const selectedRecord = useMemo(() => {
    if (viewState.layer !== 2) return null;
    return allCustomizationRecords.find(r => r.id === viewState.recordId) ?? null;
  }, [viewState, allCustomizationRecords]);

  if (!customizationsTable || !pricingTable) {
    return (
      <div className="h-screen flex items-center justify-center font-sans" style={{ backgroundColor: '#F8F5EE' }}>
        <div className="text-center">
          <p className="text-gray-600 text-xl font-medium">Configuration Required</p>
          <p className="text-gray-500 text-sm mt-2">Ensure the Customizations and Customization Pricing tables are available.</p>
        </div>
      </div>
    );
  }

  if (!fields) {
    return (
      <div className="h-screen flex items-center justify-center font-sans" style={{ backgroundColor: '#F8F5EE' }}>
        <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (viewState.layer === 2 && selectedRecord) {
    return (
      <RecordDetailPage
        record={selectedRecord}
        table={customizationsTable}
        pricingRecords={pricingRecords}
        pricingTable={pricingTable}
        stylesRecords={styleRecords}
        preApprovalField={preApprovalField}
        rushFeeProposedField={rushFeeProposedField}
        rushFeePercentField={rushFeePercentField}
        selfUsageField={selfUsageField}
        clientRecords={clientRecords}
        favoriteStylesApptField={favoriteStylesApptField}
        onBack={() =>
          viewState.previousRecordId
            ? setViewState({ layer: 2, recordId: viewState.previousRecordId })
            : setViewState({ layer: 1 })
        }
      />
    );
  }

  // ── Layer 1: Table list ───────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col font-sans antialiased overflow-hidden" style={{ backgroundColor: '#F8F5EE' }}>
      {/* Filter Bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 border-b border-[#E9E0CE] dark:border-[#38322A] bg-white dark:bg-[#25211A] flex-wrap">
        <FilterDropdown label="Sales Associate" values={filterSA}             options={saOptions}               onChange={setFilterSA} />
        <FilterDropdown label="Style"           values={filterStyle}          options={styleOptions}            onChange={setFilterStyle} searchable />
        <FilterDropdown label="Approval Status" values={filterApprovalStatus} options={APPROVAL_STATUS_OPTIONS}  onChange={setFilterApprovalStatus} />
      </div>

      {/* Table */}
      <div className="p-6 overflow-auto flex-1">
        <div className="bg-white dark:bg-[#25211A] border border-[#E9E0CE] dark:border-[#38322A] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <tr>
                {['Client', 'Style', 'Approval Status', 'Sales Associate', 'Date of Request', 'Wedding Date', 'Proposed Total', 'Approved Price'].map(h => (
                  <th key={h} className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => {
                const approvalVal = fields.approvalStatus ? getSingleSelectName(record.getCellValue(fields.approvalStatus)) : '';
                const clientText  = fields.client          ? getLinkedRecordName(record.getCellValue(fields.client))         : '—';
                const styleText   = fields.customizedStyle ? getLinkedRecordName(record.getCellValue(fields.customizedStyle)) : '—';
                const saText      = fields.salesAssociate  ? record.getCellValueAsString(fields.salesAssociate) || '—'       : '—';
                const dateStr     = fields.dateOfRequest   ? resolveDateString(record.getCellValue(fields.dateOfRequest))    : '';
                const weddingRaw  = fields.weddingDate     ? record.getCellValue(fields.weddingDate)                         : null;
                const weddingStr  = resolveDateString(weddingRaw)
                  || (fields.weddingDate ? record.getCellValueAsString(fields.weddingDate) : '');
                const approvedVal = fields.approvedPricing          ? record.getCellValueAsString(fields.approvedPricing)          : '';
                const proposedVal = fields.proposedTotalCustomPrice ? record.getCellValueAsString(fields.proposedTotalCustomPrice) : '';
                const cellCls = 'px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300';
                return (
                  <tr key={record.id} onClick={() => setViewState({ layer: 2, recordId: record.id })}
                    className="border-b border-gray-100 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    <td className={cellCls}>{clientText}</td>
                    <td className={cellCls}>{styleText}</td>
                    <td className="px-3 py-2.5"><ApprovalStatusPill status={approvalVal} colorMap={approvalChoiceColors} /></td>
                    <td className={cellCls}>{saText}</td>
                    <td className={cellCls}>{formatDate(dateStr)}</td>
                    <td className={cellCls}>{formatWeddingDate(weddingStr)}</td>
                    <td className={cellCls}>{proposedVal || '—'}</td>
                    <td className={cellCls}>{approvedVal || '—'}</td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No customization records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

initializeBlock({ interface: () => <CustomizationApp /> });

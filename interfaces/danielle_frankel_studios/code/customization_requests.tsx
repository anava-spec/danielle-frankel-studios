import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import {
  CaretDown as CaretDownIcon,
  X as XIcon,
  ArrowLeft as ArrowLeftIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Trash as TrashIcon,
  Warning as WarningIcon,
  Plus as PlusIcon,
} from '@phosphor-icons/react';
import type { Table, Record as AirtableRecord, Field } from '@airtable/blocks/interface/models';
import { FieldType } from '@airtable/blocks/interface/models';

// ─── Palette: Champagne ───────────────────────────────────────────────────────
// Light: app_bg #F8F5EE · surface #FFFFFF · border #E9E0CE · accent amber-600
// Dark:  app_bg #1B1813 · surface #25211A · border #38322A · accent amber-400

// ─── Dark Mode ────────────────────────────────────────────────────────────────
function useTheme(): 'light' | 'dark' {
  // Reads Airtable's own light/dark preference, not the OS/browser setting.
  const { colorScheme } = useColorScheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorScheme === 'dark');
  }, [colorScheme]);
  return colorScheme;
}

// ─── useSmoothToggle ────────────────────────────────────────────────────────────
// Shared open/close transition for dropdown panels — same fade+scale technique
// every modal in this file already uses (mount immediately, flip to "visible"
// a tick later so the browser paints the 0-state first; on close, flip
// "visible" off immediately but delay the actual unmount so the fade-out has
// time to play). ~150ms, matching BRANDING.md §12's non-modal transition durations.
function useSmoothToggle(open: boolean, durationMs = 150) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs]);
  return { mounted, visible };
}

// ─── Table / Field IDs ────────────────────────────────────────────────────────
const FIELD_IDS = {
  CUSTOMIZATION_ID:            'fldl9cIcV80nYEDwe',
  CLIENT:                      'fldOeL4VVcXaKwwlN',
  DATE_OF_REQUEST:             'fldQdHAp256vsImBt',
  PRODUCTION_STATUS:           'fld5qkNKygBkRYF4v',
  APPROVAL_STATUS:             'fldEfOYgxOhyDiMEH',   // internal_approval_status — New Request / Under Review / Counter-Proposed / Approved / Denied
  CLIENT_APPROVAL_STATUS:      'fldwE1BTp4G5eF2jR',   // client_approval_status — Propose to Client / Counter-Proposed / Approved / Denied
  PARENT_CUSTOMIZATION_REQUEST: 'fldh9tKr0Vmo84Yu6',  // parent_customization_request — self-link, set on a counter-proposal child
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
  // Gates Embroidery Amount visibility: true iff any currently-selected
  // Customization Pricing line item has this checkbox checked (per Julia's
  // 2026-07-20 demo feedback — Embroidery is no longer tied to Style).
  PRICING_IS_EMBROIDERY:       'fldXgmTz2GNW969Mw',
  STAFF_FULL_NAME:             'fldc8INBZmwC3xeH7',
  STAFF_ROLE_NAME:             'fld1P7ZjPabKLrlPG',
  STAFF_IS_ACTIVE:             'fldB6rPTjxATp7uMf',
  STYLE_NAME:                  'fldEs3chQAeplPc1w',
  STYLE_BASE_PRICE:            'flduZuxPxxMqXzNxD',
  // Hybrid customizations — customization_type (formerly is_hybrid_customization) lives on the parent
  // record only (children default to 'Regular'). hybrid_customization is a
  // self-link parent -> children; HYBRID_LINK_INVERSE is Airtable's own
  // auto-generated symmetric reverse of that link (children -> parent) — a
  // record is a hybrid CHILD iff this reverse field is non-empty, no
  // cross-query needed to identify it.
  IS_HYBRID:                   'fld1stC4sHuPT4pT4',
  HYBRID_LINK:                 'fldewS0eFvZsoS30g',
  HYBRID_LINK_INVERSE:         'fldm2oHXY3MgjAFiz',
  HYBRID_WEIGHT:               'fldIQdVmgJzBwYbwl',
  HYBRID_TOTAL_PRICE:          'fldunhb83qALkU71Y',
  HYBRID_STYLE_NAMES:          'fldMHwhsQ7rmvjqBb', // rollup — already-formatted "Style A & Style B"
  // Client name rollup through hybrid_customization — resolves correctly for
  // both Regular and Hybrid parent rows (unlike CLIENT, which isn't always
  // populated directly on a Hybrid parent), so the main list table reads
  // this for its Client column instead.
  HYBRID_CUSTOMIZATION_CLIENT: 'fldW1QVWXgwqI0cJu',
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

// Reads a singleSelect field's current choice names straight off the field's
// own options — never hardcode a status list, since choices get renamed/
// added over time (this replaced a stale hardcoded list that caused the
// Production Status column/filter to compare against choice names that no
// longer existed on the field).
function getFieldChoiceNames(field: unknown): string[] {
  if (!field) return [];
  try {
    const choices = ((field as { options?: { choices?: Array<{ name: string }> } }).options?.choices ?? []);
    return choices.map(c => c.name);
  } catch { return []; }
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
  const panel = useSmoothToggle(open);
  // Trigger label swaps based on state (spec §5/§6): no value selected shows
  // the filter's own name as placeholder; a value selected shows the value
  // itself plus an inline clear-X — no external label sits beside the trigger.
  const hasValue = values.length > 0;
  const displayText = !hasValue ? label : values.length === 1 ? values[0] : `${values.length} selected`;
  const toggle = useCallback((opt: string) => onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]), [values, onChange]);
  return (
    <div className="relative" ref={containerRef}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 min-w-[140px] bg-white dark:bg-[#25211A] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
          hasValue
            ? 'border-amber-600 dark:border-amber-400 text-amber-700 dark:text-amber-400 hover:border-amber-700 dark:hover:border-amber-300'
            : 'border-gray-300 dark:border-[#38322A] text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-amber-400/50'
        }`}>
        <span className="truncate flex-1 text-left font-medium">{displayText}</span>
        {hasValue
          ? <XIcon size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 hover:text-amber-800 dark:hover:text-amber-200" onClick={e => { e.stopPropagation(); onChange([]); }} />
          : <CaretDownIcon size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {panel.mounted && (
        <div
          style={{ opacity: panel.visible ? 1 : 0, transform: panel.visible ? 'scale(1)' : 'scale(0.97)', transformOrigin: 'top left' }}
          className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg shadow-lg w-[240px] overflow-hidden transition-[opacity,transform] duration-150 ease-out">
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
  );
}

// ─── LayoutDropdown ────────────────────────────────────────────────────────────
// Same pattern as pipeline.tsx's ViewDropdown (§5b Layout Selector) — a single-
// value trigger, centered text, no placeholder state (a layout is always
// selected).
const LAYOUT_OPTIONS = ['ops', 'approval'] as const;
const LAYOUT_LABELS: Record<typeof LAYOUT_OPTIONS[number], string> = { ops: 'Workdesk', approval: 'Approval' };

function LayoutDropdown({ value, onChange }: { value: typeof LAYOUT_OPTIONS[number]; onChange: (v: typeof LAYOUT_OPTIONS[number]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (option: typeof LAYOUT_OPTIONS[number]) => {
    onChange(option);
    setIsOpen(false);
  };
  const panel = useSmoothToggle(isOpen);

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-[130px] bg-white dark:bg-[#25211A] border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-amber-400/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors">
        <span className="truncate text-center">{LAYOUT_LABELS[value]}</span>
      </button>
      {panel.mounted && (
        <div
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)', opacity: panel.visible ? 1 : 0, transform: panel.visible ? 'scale(1)' : 'scale(0.97)', transformOrigin: 'top right' }}
          className="absolute top-full right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg overflow-hidden w-[130px] py-1 transition-[opacity,transform] duration-150 ease-out">
          {LAYOUT_OPTIONS.map(option => (
            <button key={option} type="button" onClick={() => handleSelect(option)}
              className={`flex items-center w-full px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${value === option ? 'bg-amber-50 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              <span className="truncate">{LAYOUT_LABELS[option]}</span>
            </button>
          ))}
        </div>
      )}
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
      className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full font-medium border ${textSize}`}
      style={inlineStyle}
    >
      {status || '—'}
    </span>
  );
}

// ─── StyleSelectSingle ────────────────────────────────────────────────────────
const EMBROIDERY_OPTIONS = [{ id: 'Light', label: 'Light' }, { id: 'Medium', label: 'Medium' }, { id: 'Full', label: 'Full' }];

function StyleSelectSingle({ value, options, placeholder, onChange, disabled }: {
  value: string | null; options: Array<{ id: string; label: string }>; placeholder: string;
  onChange: (id: string | null) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false); setQ('');
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Rendered via a portal (below) so the panel isn't clipped by the modal's
  // own scrollable body — this is what let it get cut off by the bottom
  // border when the field sat near the bottom of the form.
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const updateDropdownPos = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const margin = 12;
    setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.max(160, window.innerHeight - r.bottom - margin) });
  }, []);
  useEffect(() => {
    if (!open) return;
    updateDropdownPos();
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    return () => { window.removeEventListener('scroll', updateDropdownPos, true); window.removeEventListener('resize', updateDropdownPos); };
  }, [open, updateDropdownPos]);

  const filtered = useMemo(() => q.trim() ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options, [options, q]);
  const sel = options.find(o => o.id === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        className="w-full flex items-center justify-between gap-2 bg-white dark:bg-[#1B1813] border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-2 text-sm text-left outline-none hover:border-gray-400 dark:hover:border-amber-400/50 transition-colors disabled:opacity-50">
        <span className={sel ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>{sel?.label ?? placeholder}</span>
        <CaretDownIcon size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && dropdownPos && createPortal(
        <div ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: dropdownPos.maxHeight }}
          className="z-[60] bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-xl shadow-xl flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <div className="relative">
              <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-[#38322A] rounded-md focus:outline-none focus:border-amber-400 bg-white dark:bg-[#1B1813] text-gray-700 dark:text-gray-300" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            {filtered.map(o => (
              <button key={o.id} type="button" onClick={() => { onChange(o.id); setOpen(false); setQ(''); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${o.id === value ? 'bg-amber-50 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>{o.label}</button>
            ))}
            {filtered.length === 0 && <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">No matches</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// A search-as-you-type client picker (distinct from StyleSelectSingle, which
// is click-to-open) — the input itself is always visible, filters options as
// the user types, and supports arrow-key navigation + Enter to select.
function ClientSearchBar({ value, options, placeholder, onChange, widthPercent = 30 }: {
  value: string | null; options: { id: string; label: string }[]; placeholder: string;
  onChange: (id: string | null) => void; widthPercent?: number;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value) ?? null;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => { setActiveIdx(0); }, [query, open]);

  const commit = (id: string) => {
    onChange(id);
    setQuery(options.find(o => o.id === id)?.label ?? '');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIdx]) commit(filtered[activeIdx].id); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={ref} className="relative" style={{ width: `${widthPercent}%` }}>
      <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
      <input type="text"
        value={open ? query : (selected?.label ?? query)}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#1B1813] border border-gray-300 dark:border-[#38322A] rounded-lg outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-gray-900 dark:text-gray-100" />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-xl shadow-xl max-h-[240px] overflow-y-auto">
          {filtered.map((o, i) => (
            <button key={o.id} type="button" onClick={() => commit(o.id)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${i === activeIdx ? 'bg-amber-50 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              {o.label}
            </button>
          ))}
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
    // before it's the actual charge. Surface the raw rate and the scaling
    // factor as a label (e.g. "$1,500.00 x 0.67") since the Price column
    // shows the scaled amount.
    if (typeof raw === 'number' && raw > 0) return { amount: raw * multiplierFactor, label: `${formatCurrency(raw)} x ${multiplierFactor.toFixed(2)}` };
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

function computeHybridCombinedTotal(basePrice1: number, basePrice2: number): number {
  return Math.max(basePrice1, basePrice2) * 1.85;
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Rendered via a portal (below) so the panel isn't clipped by the modal's
  // own scrollable body — position tracked in viewport coordinates, using
  // the tallest height the viewport allows below the search bar rather than
  // a fixed max-height.
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const updateDropdownPos = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const margin = 12;
    setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.max(160, window.innerHeight - r.bottom - margin) });
  }, []);
  useEffect(() => {
    if (!open) return;
    updateDropdownPos();
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    return () => { window.removeEventListener('scroll', updateDropdownPos, true); window.removeEventListener('resize', updateDropdownPos); };
  }, [open, updateDropdownPos]);

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions
      .filter(s => s.name !== 'Other')
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
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
          {open && dropdownPos && createPortal(
            <div ref={dropdownRef}
              style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: dropdownPos.maxHeight, scrollbarWidth: 'none' }}
              className="z-[60] bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-xl shadow-xl overflow-y-auto">
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
            </div>,
            document.body
          )}
        </div>
      )}
      {/* Nothing selected yet — a customization isn't always needed (e.g. a
          Hybrid request that's simply combining two styles), so don't show
          an empty invoice table; just the search bar above is enough. Body
          scrolls internally with a max-height once it grows past a handful
          of rows, so the whole modal doesn't have to be scrolled instead. */}
      {selectedItems.length > 0 && (
        <div className="bg-white dark:bg-[#1B1813] border border-gray-200 dark:border-[#38322A] rounded-lg overflow-hidden">
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
                <tr>
                  {!disabled && <th className="px-3 py-2 w-8 bg-gray-50 dark:bg-white/5" />}
                  <th className="px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize tracking-wide text-left bg-gray-50 dark:bg-white/5">Customization</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize tracking-wide text-left bg-gray-50 dark:bg-white/5">Rate</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize tracking-wide text-center bg-gray-50 dark:bg-white/5">Pre-Approval</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize tracking-wide text-right bg-gray-50 dark:bg-white/5">Price</th>
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
                    <td className="px-3 py-2.5 text-center">
                      <ApprovalStatusPill status={item.approval} colorMap={preApprovalColorMap} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200 dark:border-white/10">
                  {!disabled && <td className="px-3 py-2.5" />}
                  <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100">Total</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100 text-right">{formatCurrency(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HybridChildColumn ──────────────────────────────────────────────────────────
// One of a Hybrid parent's two child Customizations records, scoped to just
// this child and auto-saving straight to its own record id.
// Hybrid no longer has Customizations, Embroidery, Flags, or a per-style
// weight (per Julia, 2026-07-20 demo feedback) — a Hybrid child is just its
// Style and Additional Details. The combined price (85% over the higher
// Base Price) is shown once, at the parent level, not per child.
function HybridChildColumn({
  title, childRecord, table, styleOptions, canUpdate,
}: {
  title: string; childRecord: AirtableRecord; table: Table;
  styleOptions: { id: string; label: string }[]; canUpdate: boolean;
}) {
  const fStyled    = table.getFieldIfExists(FIELD_IDS.CUSTOMIZED_STYLE);
  const fDetail    = table.getFieldIfExists(FIELD_IDS.CUSTOMIZATION_DETAIL);

  const [styleId, setStyleId] = useState<string | null>(() => (fStyled ? (childRecord.getCellValue(fStyled) as Array<{ id: string }> | null)?.[0]?.id ?? null : null));
  const [detail,  setDetail]  = useState(fDetail ? childRecord.getCellValueAsString(fDetail) : '');

  const autoSave = useCallback((patch: Record<string, unknown>) => {
    queueWrite(() => table.updateRecordAsync(childRecord.id, patch)).catch(err => console.error('Hybrid child auto-save failed:', err));
  }, [table, childRecord.id]);
  const handleStyleId = (id: string | null) => { setStyleId(id); if (fStyled) autoSave({ [fStyled.id]: id ? [{ id }] : null }); };

  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';

  return (
    <div className="border border-gray-200 dark:border-[#38322A] rounded-xl p-4 space-y-4">
      <div className="font-bold text-gray-900 dark:text-gray-100">{title}</div>

      <div>
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className={labelCls.replace(' mb-1.5 block', '')}>Style</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">Only shows styles the bride chose in Acuity or during the appointment.</span>
        </div>
        <StyleSelectSingle value={styleId} options={styleOptions} placeholder="Select a style…" onChange={handleStyleId} disabled={!canUpdate} />
      </div>

      <div>
        <span className={labelCls}>Additional Details</span>
        <textarea value={detail} onChange={e => setDetail(e.target.value)}
          onBlur={() => { if (fDetail) autoSave({ [fDetail.id]: detail || null }); }}
          disabled={!canUpdate} placeholder="Describe the specific customization…"
          rows={3} className="w-full border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-white dark:bg-[#1B1813] transition-colors resize-none" />
      </div>
    </div>
  );
}

// ─── DeleteConfirmModal ────────────────────────────────────────────────────────
// Standard centered modal (backdrop + rounded-2xl container). The Delete button
// stays disabled behind a 5-second countdown so an accidental click can't
// immediately fire an irreversible delete.
function DeleteConfirmModal({ clientName, onConfirm, onClose }: {
  clientName: string; onConfirm: () => void; onClose: () => void;
}) {
  const [countdown, setCountdown] = useState(5);
  const [deleting, setDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(3px)', opacity: isVisible?1:0 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[440px] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide mb-0.5">Delete request</p>
            <p className="text-xl font-bold text-gray-900 dark:text-[#F5F3EF]">Are you sure?</p>
          </div>
          <button onClick={requestClose} disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0 disabled:opacity-50">
            <XIcon size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3">
            <WarningIcon size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              This will permanently delete the customization request for <strong>{clientName}</strong>. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
          <button type="button" onClick={requestClose} disabled={deleting}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={countdown > 0 || deleting}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {deleting ? 'Deleting…' : countdown > 0 ? `Delete permanently (${countdown})` : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NewRequestModal ────────────────────────────────────────────────────────────
interface DraftSectionValue {
  styleId: string | null;
  pricingIds: string[];
  embroidery: string | null;
  detail: string;
}
function emptyDraftSection(): DraftSectionValue {
  return { styleId: null, pricingIds: [], embroidery: null, detail: '' };
}

// Same field set as HybridChildColumn / RecordDetailPage's Regular body
// (Style, Customizations, conditional Embroidery, Additional Details), but
// for a record that doesn't exist yet — local state only. showCustomizations
// defaults true (Regular) and false for Hybrid sections, which only ever
// show Style + Additional Details (per Julia's 2026-07-20 demo feedback).
function DraftSectionFields({
  title, value, onChange, styleOptions, pricingRecords, pricingTable, preApprovalField, preApprovalColorMap,
  basePriceNumber, multiplierFactor, showCustomizations = true, embroideryApplicable = false,
}: {
  title?: string; value: DraftSectionValue; onChange: (patch: Partial<DraftSectionValue>) => void;
  styleOptions: { id: string; label: string }[]; pricingRecords: AirtableRecord[]; pricingTable: Table | null;
  preApprovalField: Field | null; preApprovalColorMap: Record<string, string>;
  basePriceNumber: number; multiplierFactor: number; showCustomizations?: boolean; embroideryApplicable?: boolean;
}) {
  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const inputCls = 'w-full border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-white dark:bg-[#1B1813] transition-colors';

  const pTypeField    = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_CUSTOMIZATION_TYPE) ?? null;
  const pActiveField  = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_IS_ACTIVE) ?? null;
  const priceableFields = useMemo(() => ({
    priceField: pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_PRICE) ?? null,
    percentField: pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_PERCENT) ?? null,
    multiField: pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_MULTIPLE) ?? null,
  }), [pricingTable]);

  const selectedItems = useMemo(() => {
    if (!pTypeField) return [];
    return value.pricingIds.map(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return null;
      const { amount, label } = resolvePricingRow(r, priceableFields, basePriceNumber, multiplierFactor);
      return { id: r.id, name: r.getCellValueAsString(pTypeField), label, amount, approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '' };
    }).filter((x): x is { id: string; name: string; label: string | null; amount: number; approval: string } => x !== null);
  }, [value.pricingIds, pricingRecords, pTypeField, priceableFields, basePriceNumber, multiplierFactor, preApprovalField]);

  const suggestions = useMemo(() => {
    if (!pTypeField) return [];
    return pricingRecords
      .filter(r => !value.pricingIds.includes(r.id))
      .filter(r => !pActiveField || r.getCellValue(pActiveField) === true)
      .map(r => {
        const { amount, label } = resolvePricingRow(r, priceableFields, basePriceNumber, multiplierFactor);
        return { id: r.id, name: r.getCellValueAsString(pTypeField), label, amount };
      });
  }, [pricingRecords, value.pricingIds, pTypeField, pActiveField, priceableFields, basePriceNumber, multiplierFactor]);

  const totalCustomizationCost = useMemo(() => selectedItems.reduce((sum, i) => sum + i.amount, 0), [selectedItems]);

  return (
    <div className="border border-gray-200 dark:border-[#38322A] rounded-xl p-4 space-y-4">
      {title && <div className="font-semibold text-base text-gray-900 dark:text-gray-100">{title}</div>}

      <div>
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className={labelCls.replace(' mb-1.5 block', '')}>Style</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">Only shows styles the bride chose in Acuity or during the appointment.</span>
        </div>
        <StyleSelectSingle value={value.styleId} options={styleOptions} placeholder="Select a style…" onChange={id => onChange({ styleId: id })} />
      </div>

      {showCustomizations && (
        <div>
          <span className={labelCls}>Customizations</span>
          <LineItemsTable
            selectedItems={selectedItems} suggestions={suggestions}
            onAdd={id => onChange({ pricingIds: [...value.pricingIds, id] })}
            onRemove={id => onChange({ pricingIds: value.pricingIds.filter(x => x !== id) })}
            preApprovalColorMap={preApprovalColorMap} totalAmount={totalCustomizationCost}
          />
        </div>
      )}

      {showCustomizations && embroideryApplicable && (
        <div>
          <span className={labelCls}>Embroidery Amount</span>
          <StyleSelectSingle value={value.embroidery} options={EMBROIDERY_OPTIONS} placeholder="Select…" onChange={id => onChange({ embroidery: id })} />
        </div>
      )}

      <div>
        <span className={labelCls}>Additional Details</span>
        <textarea value={value.detail} onChange={e => onChange({ detail: e.target.value })}
          placeholder="Describe the specific customization…" rows={3} className={`${inputCls} resize-none`} />
      </div>
    </div>
  );
}

function NewRequestModal({
  customizationsTable, pricingTable, pricingRecords, stylesRecords, stylesBasePriceField,
  clientsTable, clientRecords, preApprovalField, onClose, onCreated,
}: {
  customizationsTable: Table; pricingTable: Table | null; pricingRecords: AirtableRecord[];
  stylesRecords: AirtableRecord[]; stylesBasePriceField: Field | null;
  clientsTable: Table | null; clientRecords: AirtableRecord[]; preApprovalField: Field | null;
  onClose: () => void; onCreated: (recordId: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [requestClose]);

  const preApprovalColorMap = useMemo(() => getChoiceColorMap(preApprovalField), [preApprovalField]);

  // Any client is selectable here — no stage filter (per Julia's 2026-07-20
  // demo feedback: "just don't even filter it out, it's fine").
  const fClientFullName = clientsTable?.getFieldIfExists('fldB3Wyam01D3wR5Q') ?? null;
  const clientOptions = useMemo(() => {
    return clientRecords
      .map(r => ({ id: r.id, label: fClientFullName ? r.getCellValueAsString(fClientFullName) || r.name : r.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clientRecords, fClientFullName]);

  const [clientId, setClientId] = useState<string | null>(null);
  const [kind, setKind] = useState<'Hybrid' | 'Regular' | null>(null);
  // 'select': Client + Regular/Hybrid chooser, both visible at once.
  // 'form': the field-editing form, reached via Continue.
  const [stage, setStage] = useState<'select' | 'form'>('select');
  const [regularSection, setRegularSection] = useState<DraftSectionValue>(emptyDraftSection());
  const [hybridSections, setHybridSections] = useState<[DraftSectionValue, DraftSectionValue]>([emptyDraftSection(), emptyDraftSection()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styleOptions = useMemo(() => stylesRecords.map(r => {
    const price = stylesBasePriceField ? parseCurrencyString(r.getCellValueAsString(stylesBasePriceField)) : 0;
    return { id: r.id, label: `${r.name} — ${formatCurrency(price)}` };
  }).sort((a, b) => a.label.localeCompare(b.label)), [stylesRecords, stylesBasePriceField]);

  const pIsEmbroideryField = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_IS_EMBROIDERY) ?? null;
  const embroideryApplicableFor = useCallback((section: DraftSectionValue) => {
    if (!pIsEmbroideryField) return false;
    return section.pricingIds.some(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      return r ? !!(r.getCellValue(pIsEmbroideryField) as boolean | null) : false;
    });
  }, [pIsEmbroideryField, pricingRecords]);

  const sectionTotals = useCallback((section: DraftSectionValue) => {
    const styleRec = section.styleId ? (stylesRecords.find(r => r.id === section.styleId) ?? null) : null;
    const basePriceNumber = styleRec && stylesBasePriceField ? parseCurrencyString(styleRec.getCellValueAsString(stylesBasePriceField)) : 0;
    const multiplierFactor = computeMultiplierFactor(0, section.embroidery); // Self Usage only exists post-save
    const pPriceField = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_PRICE) ?? null;
    const pPercentField = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_PERCENT) ?? null;
    const pMultiField = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_MULTIPLE) ?? null;
    const customizationTotal = section.pricingIds.reduce((sum, id) => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return sum;
      return sum + resolvePricingRow(r, { priceField: pPriceField, percentField: pPercentField, multiField: pMultiField }, basePriceNumber, multiplierFactor).amount;
    }, 0);
    const grandTotal = basePriceNumber + customizationTotal;
    return { basePriceNumber, multiplierFactor, customizationTotal, grandTotal };
  }, [stylesRecords, stylesBasePriceField, pricingTable, pricingRecords]);

  const regularTotals = sectionTotals(regularSection);
  const hybridTotals: [ReturnType<typeof sectionTotals>, ReturnType<typeof sectionTotals>] = [sectionTotals(hybridSections[0]), sectionTotals(hybridSections[1])];
  const hybridCombinedTotal = computeHybridCombinedTotal(hybridTotals[0].basePriceNumber, hybridTotals[1].basePriceNumber);

  const canSubmit = kind === 'Regular'
    ? !!clientId && !!regularSection.styleId
    : kind === 'Hybrid'
      ? !!clientId && !!hybridSections[0].styleId && !!hybridSections[1].styleId
      : false;

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === 'Regular') {
        const s = regularSection;
        const fields: Record<string, unknown> = {
          [FIELD_IDS.CLIENT]: [{ id: clientId }],
          [FIELD_IDS.APPROVAL_STATUS]: { name: 'New Request' },
          [FIELD_IDS.CUSTOMIZED_STYLE]: s.styleId ? [{ id: s.styleId }] : null,
          [FIELD_IDS.CUSTOMIZATION_PRICING]: s.pricingIds.map(id => ({ id })),
          [FIELD_IDS.CUSTOMIZATION_DETAIL]: s.detail || null,
          [FIELD_IDS.AMOUNT_EMBROIDERY]: s.embroidery ? { name: s.embroidery } : null,
        };
        const newId = await customizationsTable.createRecordAsync(fields);
        onCreated(newId);
      } else {
        // Hybrid children carry only Style + Additional Details (no
        // Customizations/Embroidery/Flags/Weight — those are Regular-only
        // or removed entirely per Julia's 2026-07-20 demo feedback).
        const buildChildFields = (s: DraftSectionValue): Record<string, unknown> => ({
          [FIELD_IDS.CLIENT]: [{ id: clientId }],
          [FIELD_IDS.APPROVAL_STATUS]: { name: 'New Request' },
          [FIELD_IDS.IS_HYBRID]: { name: 'Regular' },
          [FIELD_IDS.CUSTOMIZED_STYLE]: s.styleId ? [{ id: s.styleId }] : null,
          [FIELD_IDS.CUSTOMIZATION_DETAIL]: s.detail || null,
        });
        const child1Id = await customizationsTable.createRecordAsync(buildChildFields(hybridSections[0]));
        const child2Id = await customizationsTable.createRecordAsync(buildChildFields(hybridSections[1]));
        const parentId = await customizationsTable.createRecordAsync({
          [FIELD_IDS.CLIENT]: [{ id: clientId }],
          [FIELD_IDS.APPROVAL_STATUS]: { name: 'New Request' },
          [FIELD_IDS.IS_HYBRID]: { name: 'Hybrid' },
          [FIELD_IDS.HYBRID_LINK]: [{ id: child1Id }, { id: child2Id }],
        });
        onCreated(parentId);
      }
    } catch (e) {
      console.error('Failed to create customization request:', e);
      setError('Failed to create request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Past the select stage, clicking outside or "back" returns to the
  // Client/kind menu instead of closing the modal outright — only the
  // select stage itself closes on dismiss (per Julia's 2026-07-20 feedback).
  const handleDismiss = () => {
    if (stage === 'form') { setStage('select'); setKind(null); }
    else requestClose();
  };

  const modalTitle = kind === 'Hybrid' ? 'New Hybrid Customization'
    : kind === 'Regular' ? 'New Regular Customization'
    : 'New Customization Request';
  const selectedClientLabel = clientOptions.find(o => o.id === clientId)?.label ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible ? 1 : 0 }}
      onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}>
      {/* max-width is NOT in the transitioned properties — animating a
          container resize at the same moment its content swaps entirely
          (chooser -> form) reads as a glitch, not a smooth transition. The
          width change snaps instantly; only the modal's own open/close
          (opacity + scale) animates, per BRANDING.md's modal spec. */}
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'scale(1)' : 'scale(0.96)', maxWidth: stage === 'select' ? '480px' : '960px' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xl text-gray-900 dark:text-[#F5F3EF] truncate">{modalTitle}</div>
            {stage === 'form' && selectedClientLabel && (
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{selectedClientLabel}</div>
            )}
          </div>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <XIcon size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {stage === 'select' && (
            <>
              <div>
                <span className="text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block">Client</span>
                <ClientSearchBar value={clientId} options={clientOptions} placeholder="Search clients…" onChange={setClientId} widthPercent={30} />
              </div>

              <div>
                <div className="text-[13px] text-gray-500 dark:text-gray-400 mb-3">Is this a Regular or Hybrid customization?</div>
                <div className="space-y-3">
                  <button type="button" onClick={() => setKind('Regular')}
                    className={`w-full text-left border rounded-xl p-4 transition-colors ${kind === 'Regular' ? 'border-amber-400' : 'border-gray-200 dark:border-[#38322A] hover:border-amber-400'}`}>
                    <div className="font-bold text-gray-900 dark:text-gray-100 mb-0.5">Regular</div>
                    <div className="text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">A single style, customized as usual.</div>
                  </button>
                  <button type="button" onClick={() => setKind('Hybrid')}
                    className={`w-full text-left border rounded-xl p-4 transition-colors ${kind === 'Hybrid' ? 'border-amber-400' : 'border-gray-200 dark:border-[#38322A] hover:border-amber-400'}`}>
                    <div className="font-bold text-gray-900 dark:text-gray-100 mb-0.5">Hybrid</div>
                    <div className="text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">Two styles combined into one request.</div>
                  </button>
                </div>
              </div>
            </>
          )}

          {stage === 'form' && kind === 'Regular' && (
            <div className="flex gap-6 items-stretch">
              <div className="w-[60%] min-w-0">
                <DraftSectionFields
                  value={regularSection} onChange={patch => setRegularSection(prev => ({ ...prev, ...patch }))}
                  styleOptions={styleOptions} pricingRecords={pricingRecords} pricingTable={pricingTable}
                  preApprovalField={preApprovalField} preApprovalColorMap={preApprovalColorMap}
                  basePriceNumber={regularTotals.basePriceNumber} multiplierFactor={regularTotals.multiplierFactor}
                  embroideryApplicable={embroideryApplicableFor(regularSection)}
                />
              </div>
              <div className="w-[40%] shrink-0">
                <div className="sticky top-0 p-4 rounded-lg space-y-1 border border-gray-200 dark:border-[#38322A] bg-gray-50 dark:bg-white/5">
                  <span className="text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block">Summary</span>
                  {[
                    { l: 'Base Price', a: regularTotals.basePriceNumber },
                    { l: 'Customization Total', a: regularTotals.customizationTotal },
                  ].map(({ l, a }) => (
                    <div key={l} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                      <span className="text-base text-gray-600 dark:text-gray-400">{l}</span>
                      <span className="text-base text-gray-900 dark:text-gray-100">{formatCurrency(a)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center font-bold text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-white/20 pt-1.5 mt-1">
                    <span className="text-lg">Grand Total</span>
                    <span className="text-lg">{formatCurrency(regularTotals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {stage === 'form' && kind === 'Hybrid' && (
            <div className="flex gap-6 items-stretch">
              <div className="w-[60%] min-w-0 space-y-4">
                <DraftSectionFields
                  title="Style 1" value={hybridSections[0]}
                  onChange={patch => setHybridSections(prev => [{ ...prev[0], ...patch }, prev[1]])}
                  styleOptions={styleOptions} pricingRecords={pricingRecords} pricingTable={pricingTable}
                  preApprovalField={preApprovalField} preApprovalColorMap={preApprovalColorMap}
                  basePriceNumber={hybridTotals[0].basePriceNumber} multiplierFactor={hybridTotals[0].multiplierFactor}
                  showCustomizations={false}
                />
                <DraftSectionFields
                  title="Style 2" value={hybridSections[1]}
                  onChange={patch => setHybridSections(prev => [prev[0], { ...prev[1], ...patch }])}
                  styleOptions={styleOptions} pricingRecords={pricingRecords} pricingTable={pricingTable}
                  preApprovalField={preApprovalField} preApprovalColorMap={preApprovalColorMap}
                  basePriceNumber={hybridTotals[1].basePriceNumber} multiplierFactor={hybridTotals[1].multiplierFactor}
                  showCustomizations={false}
                />
              </div>
              <div className="w-[40%] shrink-0">
                <div className="sticky top-0 p-4 rounded-lg space-y-1 border border-gray-200 dark:border-[#38322A] bg-gray-50 dark:bg-white/5">
                  <span className="text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block">Summary</span>
                  {(() => {
                    const higherIsStyle1 = hybridTotals[0].basePriceNumber >= hybridTotals[1].basePriceNumber;
                    return (
                      <>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                          <span className="text-base text-gray-600 dark:text-gray-400">Style 1 Base Price{higherIsStyle1 && ' (higher)'}</span>
                          <span className="text-base text-gray-900 dark:text-gray-100">{formatCurrency(hybridTotals[0].basePriceNumber)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                          <span className="text-base text-gray-600 dark:text-gray-400">Style 2 Base Price{!higherIsStyle1 && ' (higher)'}</span>
                          <span className="text-base text-gray-900 dark:text-gray-100">{formatCurrency(hybridTotals[1].basePriceNumber)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                          <span className="text-base text-gray-600 dark:text-gray-400">+85% Surcharge</span>
                          <span className="text-base text-gray-900 dark:text-gray-100">{formatCurrency(Math.max(hybridTotals[0].basePriceNumber, hybridTotals[1].basePriceNumber) * 0.85)}</span>
                        </div>
                        <div className="flex justify-between items-center font-bold text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-white/20 pt-1.5 mt-1">
                          <span className="text-lg">Grand Total</span>
                          <span className="text-lg">{formatCurrency(hybridCombinedTotal)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
          <button type="button" onClick={handleDismiss} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            {stage === 'form' ? 'Back' : 'Cancel'}
          </button>
          {stage === 'select' && (
            <button type="button" onClick={() => setStage('form')} disabled={!clientId || !kind}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-600 dark:bg-amber-400 text-white dark:text-gray-900 hover:bg-amber-700 dark:hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Continue
            </button>
          )}
          {stage === 'form' && kind !== null && (
            <button type="button" onClick={handleSubmit} disabled={!canSubmit || saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-600 dark:bg-amber-400 text-white dark:text-gray-900 hover:bg-amber-700 dark:hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Creating…' : 'Create Request'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ApproveDenyConfirmModal ────────────────────────────────────────────────────
// Simple confirm modal, same shell as DeleteConfirmModal (no countdown — this
// isn't destructive in the same irreversible-data-loss sense, just a stage move).
function ApproveDenyConfirmModal({ action, clientName, onConfirm, onClose }: {
  action: 'Approve' | 'Deny'; clientName: string; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);
  const [saving, setSaving] = useState(false);
  const handleConfirm = async () => { setSaving(true); await onConfirm(); };
  const isApprove = action === 'Approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible ? 1 : 0 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[440px] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'scale(1)' : 'scale(0.96)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide mb-0.5">{action} request</p>
            <p className="text-xl font-bold text-gray-900 dark:text-[#F5F3EF]">Are you sure?</p>
          </div>
          <button onClick={requestClose} disabled={saving}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0 disabled:opacity-50">
            <XIcon size={18} />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {isApprove
              ? <>This will approve the customization request for <strong>{clientName}</strong> and move it forward to be proposed to the client.</>
              : <>This will deny the customization request for <strong>{clientName}</strong>. This action cannot be undone.</>}
          </p>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
          <button type="button" onClick={requestClose} disabled={saving}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={saving}
            className={`px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {saving ? 'Saving…' : action}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CounterProposalModal ───────────────────────────────────────────────────────
// A counter-proposal is a full child Customizations record (parent_customization_
// request links it back), created directly from a Stage A record — same shell/
// two-panel pattern as NewRequestModal, but skips the customization-type chooser
// (parent's type/style/customizations are copied read-only) and adds the
// internal Approved Price field the production team is actually proposing.
function CounterProposalModal({
  parentRecord, customizationsTable, pricingRecords, pricingTable, preApprovalField, allCustomizationRecords,
  onClose, onSubmitted,
}: {
  parentRecord: AirtableRecord; customizationsTable: Table; pricingRecords: AirtableRecord[];
  pricingTable: Table | null; preApprovalField: Field | null; allCustomizationRecords: AirtableRecord[];
  onClose: () => void; onSubmitted: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [requestClose]);

  const fClient          = customizationsTable.getFieldIfExists(FIELD_IDS.CLIENT);
  const fIsHybrid         = customizationsTable.getFieldIfExists(FIELD_IDS.IS_HYBRID);
  const fStyled           = customizationsTable.getFieldIfExists(FIELD_IDS.CUSTOMIZED_STYLE);
  const fHybridStyleNames = customizationsTable.getFieldIfExists(FIELD_IDS.HYBRID_STYLE_NAMES);
  const fHybridLink       = customizationsTable.getFieldIfExists(FIELD_IDS.HYBRID_LINK);
  const fPricing          = customizationsTable.getFieldIfExists(FIELD_IDS.CUSTOMIZATION_PRICING);
  const fBasePrice        = customizationsTable.getFieldIfExists(FIELD_IDS.BASE_PRICE);
  const pPriceField   = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_PRICE) ?? null;
  const pPercentField = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_PERCENT) ?? null;
  const pMultiField   = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_MULTIPLE) ?? null;
  const pTypeField    = pricingTable?.getFieldIfExists(FIELD_IDS.PRICING_CUSTOMIZATION_TYPE) ?? null;

  const clientName = fClient ? getLinkedRecordName(parentRecord.getCellValue(fClient)) : '—';
  const isHybrid = !!(fIsHybrid && parentRecord.getCellValueAsString(fIsHybrid) === 'Hybrid');
  const typeText = fIsHybrid ? (parentRecord.getCellValueAsString(fIsHybrid) || 'Regular') : 'Regular';
  const typeColorMap = useMemo(() => getChoiceColorMap(fIsHybrid), [fIsHybrid]);
  const styleText = isHybrid
    ? (fHybridStyleNames ? (parentRecord.getCellValueAsString(fHybridStyleNames) || 'Hybrid') : 'Hybrid')
    : (fStyled ? getLinkedRecordName(parentRecord.getCellValue(fStyled)) : '—');

  const pricingIds = useMemo(() => {
    if (isHybrid || !fPricing) return [];
    const v = parentRecord.getCellValue(fPricing) as Array<{ id: string }> | null;
    return v?.map(x => x.id) ?? [];
  }, [isHybrid, fPricing, parentRecord]);

  const basePriceNumber = (!isHybrid && fBasePrice) ? parseCurrencyString(parentRecord.getCellValueAsString(fBasePrice)) : 0;

  const preApprovalColorMap = useMemo(() => getChoiceColorMap(preApprovalField), [preApprovalField]);
  const selectedItems = useMemo(() => {
    if (isHybrid || !pTypeField) return [];
    return pricingIds.map(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return null;
      const { amount, label } = resolvePricingRow(r, { priceField: pPriceField, percentField: pPercentField, multiField: pMultiField }, basePriceNumber, 1);
      return { id: r.id, name: r.getCellValueAsString(pTypeField), label, amount, approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '' };
    }).filter((x): x is { id: string; name: string; label: string | null; amount: number; approval: string } => x !== null);
  }, [isHybrid, pricingIds, pricingRecords, pTypeField, pPriceField, pPercentField, pMultiField, basePriceNumber, preApprovalField]);
  const totalCustomizationCost = selectedItems.reduce((sum, i) => sum + i.amount, 0);

  // Hybrid has no per-request Base Price/Customizations of its own — its
  // "original cost" is the 85%-over-the-higher-child-Base-Price total,
  // computed from its two linked children (same math as RecordDetailPage).
  const hybridChildRecords = useMemo<AirtableRecord[]>(() => {
    if (!isHybrid || !fHybridLink) return [];
    const ids = ((parentRecord.getCellValue(fHybridLink) as Array<{ id: string }> | null) ?? []).map(x => x.id);
    return ids.map(id => allCustomizationRecords.find(r => r.id === id)).filter((r): r is AirtableRecord => !!r);
  }, [isHybrid, fHybridLink, parentRecord, allCustomizationRecords]);
  const hybridOriginalTotal = useMemo(() => {
    if (!isHybrid || !fBasePrice) return 0;
    const [c1, c2] = hybridChildRecords;
    const b1 = c1 ? parseCurrencyString(c1.getCellValueAsString(fBasePrice)) : 0;
    const b2 = c2 ? parseCurrencyString(c2.getCellValueAsString(fBasePrice)) : 0;
    return computeHybridCombinedTotal(b1, b2);
  }, [isHybrid, fBasePrice, hybridChildRecords]);

  const originalTotal = isHybrid ? hybridOriginalTotal : (basePriceNumber + totalCustomizationCost);

  const [internalApprovedPrice, setInternalApprovedPrice] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = parseFloat(internalApprovedPrice);
  const canSubmit = internalApprovedPrice.trim() !== '' && !isNaN(priceNum);

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await queueWrite(() => customizationsTable.updateRecordAsync(parentRecord.id, {
        [FIELD_IDS.APPROVAL_STATUS]: { name: 'Denied' },
      }));
      const clientLink = fClient ? (parentRecord.getCellValue(fClient) as Array<{ id: string }> | null) : null;
      const childFields: Record<string, unknown> = {
        [FIELD_IDS.PARENT_CUSTOMIZATION_REQUEST]: [{ id: parentRecord.id }],
        [FIELD_IDS.APPROVAL_STATUS]: { name: 'Counter-Proposed' },
        [FIELD_IDS.APPROVED_PRICING]: priceNum,
        [FIELD_IDS.CUSTOMIZATION_DETAIL]: additionalDetails || null,
      };
      if (clientLink) childFields[FIELD_IDS.CLIENT] = clientLink.map(c => ({ id: c.id }));
      if (fIsHybrid) childFields[FIELD_IDS.IS_HYBRID] = { name: typeText };
      if (!isHybrid) {
        if (fStyled) {
          const styleLink = parentRecord.getCellValue(fStyled) as Array<{ id: string }> | null;
          childFields[FIELD_IDS.CUSTOMIZED_STYLE] = styleLink ? styleLink.map(s => ({ id: s.id })) : null;
        }
        childFields[FIELD_IDS.CUSTOMIZATION_PRICING] = pricingIds.map(id => ({ id }));
      }
      await customizationsTable.createRecordAsync(childFields);
      onSubmitted();
    } catch (e) {
      console.error('Failed to submit counter-proposal:', e);
      setError('Failed to submit counter-proposal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const inputCls = 'w-full border border-gray-300 dark:border-[#38322A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-white dark:bg-[#1B1813] transition-colors';
  const readOnlyCls = `${inputCls} opacity-70 cursor-not-allowed bg-gray-50 dark:bg-white/5`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible ? 1 : 0 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'scale(1)' : 'scale(0.96)', maxWidth: '960px' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xl text-gray-900 dark:text-[#F5F3EF] truncate">Counter-Proposal</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{clientName}</div>
          </div>
          <button onClick={requestClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <XIcon size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-6 items-stretch">
            <div className="w-[60%] min-w-0 space-y-4">
              <div className="flex gap-4">
                <div className="w-1/2">
                  <span className={labelCls}>Parent Request</span>
                  <div className={readOnlyCls}>{parentRecord.name}</div>
                </div>
                <div className="w-1/2">
                  <span className={labelCls}>Internal Approved Price</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">$</span>
                    <input type="number" value={internalApprovedPrice} onChange={e => setInternalApprovedPrice(e.target.value)}
                      className={`${inputCls} pl-6 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                      placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-1/2">
                  <span className={labelCls}>Customization Type</span>
                  <ApprovalStatusPill status={typeText} colorMap={typeColorMap} />
                </div>
                <div className="w-1/2">
                  <span className={labelCls}>Style</span>
                  <div className={readOnlyCls}>{styleText}</div>
                </div>
              </div>

              {!isHybrid && (
                <div>
                  <span className={labelCls}>Customizations</span>
                  <LineItemsTable
                    selectedItems={selectedItems}
                    suggestions={[]}
                    onAdd={() => {}}
                    onRemove={() => {}}
                    preApprovalColorMap={preApprovalColorMap}
                    totalAmount={totalCustomizationCost}
                    disabled
                  />
                </div>
              )}

              <div>
                <span className={labelCls}>Additional Details</span>
                <textarea value={additionalDetails} onChange={e => setAdditionalDetails(e.target.value)}
                  placeholder="Describe the revised proposal…"
                  rows={3} className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div className="w-[40%] shrink-0">
              <div className="sticky top-0 p-4 rounded-lg space-y-1.5 border border-gray-200 dark:border-[#38322A] bg-gray-50 dark:bg-white/5">
                <span className={labelCls}>Internal Approved Price</span>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 pb-2">
                  {canSubmit ? formatCurrency(priceNum) : '—'}
                </div>
                <div className="border-t border-gray-300 dark:border-white/20 pt-3 space-y-1.5">
                  <span className={labelCls}>Original Costs</span>
                  {!isHybrid ? (
                    <>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                        <span className="text-base text-gray-600 dark:text-gray-400">Base Price</span>
                        <span className="text-base text-gray-900 dark:text-gray-100">{formatCurrency(basePriceNumber)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-base text-gray-600 dark:text-gray-400">Customization Total</span>
                        <span className="text-base text-gray-900 dark:text-gray-100">{formatCurrency(totalCustomizationCost)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-base text-gray-600 dark:text-gray-400">Hybrid Combined Total</span>
                      <span className="text-base text-gray-900 dark:text-gray-100">{formatCurrency(hybridOriginalTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-white/20 pt-1.5 mt-1">
                    <span className="text-base">Original Total</span>
                    <span className="text-base">{formatCurrency(originalTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
          <button type="button" onClick={requestClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            Back
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit || saving}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-600 dark:bg-amber-400 text-white dark:text-gray-900 hover:bg-amber-700 dark:hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Sending…' : 'Send Counter-Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RecordDetailPage ─────────────────────────────────────────────────────────
function RecordDetailPage({
  record, table, pricingRecords, pricingTable, stylesRecords, stylesBasePriceField, preApprovalField,
  selfUsageField,
  clientRecords, favoriteStylesApptField, allCustomizationRecords, onBack,
}: {
  record: AirtableRecord; table: Table; pricingRecords: AirtableRecord[]; pricingTable: Table | null;
  stylesRecords: AirtableRecord[]; stylesBasePriceField: Field | null; preApprovalField: Field | null;
  selfUsageField: Field | null;
  clientRecords: AirtableRecord[]; favoriteStylesApptField: Field | null;
  allCustomizationRecords: AirtableRecord[];
  onBack: () => void;
}) {
  const canUpdate = table.hasPermissionToUpdateRecords();

  const fApprStatus = table.getFieldIfExists(FIELD_IDS.APPROVAL_STATUS);
  const fStyled     = table.getFieldIfExists(FIELD_IDS.CUSTOMIZED_STYLE);
  const fPricing    = table.getFieldIfExists(FIELD_IDS.CUSTOMIZATION_PRICING);
  const fIsHybrid   = table.getFieldIfExists(FIELD_IDS.IS_HYBRID);
  const fHybridLink = table.getFieldIfExists(FIELD_IDS.HYBRID_LINK);
  const isHybrid = !!(fIsHybrid && record.getCellValueAsString(fIsHybrid) === 'Hybrid');
  const hybridChildRecords = useMemo<AirtableRecord[]>(() => {
    if (!isHybrid || !fHybridLink) return [];
    const ids = ((record.getCellValue(fHybridLink) as Array<{ id: string }> | null) ?? []).map(x => x.id);
    return ids.map(id => allCustomizationRecords.find(r => r.id === id)).filter((r): r is AirtableRecord => !!r);
  }, [isHybrid, fHybridLink, record, allCustomizationRecords]);
  const fDetail     = table.getFieldIfExists(FIELD_IDS.CUSTOMIZATION_DETAIL);
  const fEmbroidery = table.getFieldIfExists(FIELD_IDS.AMOUNT_EMBROIDERY);
  const fBasePrice  = table.getFieldIfExists(FIELD_IDS.BASE_PRICE);
  const fApproved   = table.getFieldIfExists(FIELD_IDS.APPROVED_PRICING);
  const fClient     = table.getFieldIfExists(FIELD_IDS.CLIENT);
  const fManagerApproval = table.getFieldIfExists(FIELD_IDS.APPROVED_BY_PRODUCTION);
  const fClientApprovalStatus = table.getFieldIfExists(FIELD_IDS.CLIENT_APPROVAL_STATUS);
  const fProposedTotal        = table.getFieldIfExists(FIELD_IDS.PROPOSED_TOTAL_CUSTOM_PRICE);

  // ── Pricing table fields, shared by every line item and the rush fee row ───
  const pPriceField   = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_PRICE) : null;
  const pPercentField = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_PERCENT) : null;
  const pMultiField   = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_MULTIPLE) : null;
  const pTypeField    = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_CUSTOMIZATION_TYPE) : null;
  const pActiveField  = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_IS_ACTIVE) : null;
  const pIsEmbroideryField = pricingTable ? pricingTable.getFieldIfExists(FIELD_IDS.PRICING_IS_EMBROIDERY) : null;
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
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDenyConfirm, setShowDenyConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const canDelete = table.hasPermissionToDeleteRecords();

  const handleDelete = async () => {
    try {
      await queueWrite(() => table.deleteRecordAsync(record.id));
      setShowDeleteModal(false);
      onBack();
    } catch (e) { setError('Failed to delete request.'); setShowDeleteModal(false); }
  };

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

  // Approved: internal_approval_status -> Approved, AND client_approval_status
  // -> "Propose to Client" (moves it to the client-facing pipeline), with
  // internal_approved_pricing set to the current proposed_total_custom_price
  // at the moment of approval (a snapshot, not a live-linked value).
  const handleApprove = async () => {
    setSaving(true);
    try {
      const proposedTotal = fProposedTotal ? (record.getCellValue(fProposedTotal) as number | null) : null;
      const patch: Record<string, unknown> = { [FIELD_IDS.APPROVAL_STATUS]: { name: 'Approved' } };
      if (fClientApprovalStatus) patch[FIELD_IDS.CLIENT_APPROVAL_STATUS] = { name: 'Propose to Client' };
      if (fApproved) patch[FIELD_IDS.APPROVED_PRICING] = proposedTotal;
      await queueWrite(() => table.updateRecordAsync(record.id, patch));
      setApprovalStatus('Approved');
    } catch (e) { setError('Failed to approve.'); }
    finally { setSaving(false); setShowApproveConfirm(false); }
  };

  // Denied: internal_approval_status -> Denied. Flow ends here — no further
  // client-approval-status write, per spec.
  const handleDeny = async () => {
    setSaving(true);
    try {
      await queueWrite(() => table.updateRecordAsync(record.id, {
        [FIELD_IDS.APPROVAL_STATUS]: { name: 'Denied' },
      }));
      setApprovalStatus('Denied');
    } catch (e) { setError('Failed to deny.'); }
    finally { setSaving(false); setShowDenyConfirm(false); }
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
    // Base Price folded into the label itself (shown in both the closed/
    // selected view and each dropdown row), matching recap.tsx's Style picker.
    return base.map(r => {
      const price = stylesBasePriceField ? parseCurrencyString(r.getCellValueAsString(stylesBasePriceField)) : 0;
      return { id: r.id, label: `${r.name} — ${formatCurrency(price)}` };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [stylesRecords, favoriteStyleIds, styleId, stylesBasePriceField]);

  // Stage A: New Request / Under Review (empty status counts as New Request,
  // same as the Workdesk's Approval-layout bucket) — the only stages where
  // Approve/Deny/Counter-Propose apply. Every other status is Stage B.
  const isStageA = approvalStatus === '' || approvalStatus === 'New Request' || approvalStatus === 'Under Review';

  // ── Pricing breakdown ───────────────────────────────────────────────────────
  // Base Price is shown as-is from its stored field. Total Customization
  // Costs is computed live from the line items table above.
  const preApprovalColorMap = useMemo(() => getChoiceColorMap(preApprovalField), [preApprovalField]);
  const basePriceNumber = fBasePrice ? parseCurrencyString(record.getCellValueAsString(fBasePrice)) : 0;

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

  const grandTotal = basePriceNumber + totalCustomizationCost;

  const hybridChildBasePrices = useMemo<[number, number]>(() => {
    if (!isHybrid || !fBasePrice) return [0, 0];
    const [c1, c2] = hybridChildRecords;
    const b1 = c1 ? parseCurrencyString(c1.getCellValueAsString(fBasePrice)) : 0;
    const b2 = c2 ? parseCurrencyString(c2.getCellValueAsString(fBasePrice)) : 0;
    return [b1, b2];
  }, [isHybrid, fBasePrice, hybridChildRecords]);
  const hybridCombinedTotal = useMemo(
    () => computeHybridCombinedTotal(hybridChildBasePrices[0], hybridChildBasePrices[1]),
    [hybridChildBasePrices]
  );

  const embroideryApplicable = useMemo(() => {
    if (!pIsEmbroideryField || !pricingRecords) return false;
    return pricingIds.some(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      return r ? !!(r.getCellValue(pIsEmbroideryField) as boolean | null) : false;
    });
  }, [pIsEmbroideryField, pricingRecords, pricingIds]);

  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
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
        {/* Production Status chip — non-editable, colors from field choices */}
        {approvalStatus && (
          <ApprovalStatusPill status={approvalStatus} colorMap={approvalColorMap} size="header" />
        )}
        {/* Action buttons pushed to the right — field-sync-source legend removed, not used here */}
        <div className="ml-auto flex items-center gap-4 flex-shrink-0">
          {canUpdate && isStageA && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowApproveConfirm(true)} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50">
                Approve
              </button>
              <button type="button" onClick={() => setShowDenyConfirm(true)} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
                Deny
              </button>
              <button type="button" onClick={() => setShowCounterModal(true)} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50">
                Counter-Propose
              </button>
            </div>
          )}
          {canDelete && (
            <button type="button" onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
              <TrashIcon size={15} /> Delete
            </button>
          )}
        </div>{/* end ml-auto wrapper */}
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          clientName={clientName}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

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

            {/* Fields (60%) + sticky Summary (40%) — same split as recap.tsx's
                edit-mode layout, for both Regular and Hybrid (parity: the two
                interfaces share one field layout, only the page chrome
                around it differs — modal in recap.tsx, full page here). */}
            {!isHybrid && (
            <div className="flex gap-6 items-stretch">
              <div className="w-[60%] min-w-0 space-y-5">
                <div>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className={labelCls.replace(' mb-1.5 block', '')}>Style</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">Only shows styles the bride chose in Acuity or during the appointment.</span>
                  </div>
                  <StyleSelectSingle value={styleId} options={styleOptions} placeholder="Select a style…"
                    onChange={handleStyleId} disabled={!canUpdate} />
                </div>

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

                {embroideryApplicable && (
                  <div>
                    <span className={labelCls}>Embroidery Amount</span>
                    <StyleSelectSingle value={embroidery} options={EMBROIDERY_OPTIONS} placeholder="Select…"
                      onChange={handleEmbroidery} disabled={!canUpdate} />
                  </div>
                )}

                <div>
                  <span className={labelCls}>Additional Details</span>
                  <textarea value={detail} onChange={e => setDetail(e.target.value)}
                    onBlur={() => { if (fDetail) autoSave({ [fDetail.id]: detail || null }); }}
                    disabled={!canUpdate}
                    placeholder="Describe the specific customization…"
                    rows={3} className={`${inputCls} resize-none`} />
                </div>
              </div>

              <div className="w-[40%] shrink-0">
                <div className="sticky top-0 p-4 rounded-lg space-y-1.5 border border-gray-200 dark:border-[#38322A] bg-gray-50 dark:bg-white/5">
                  <span className={labelCls}>Summary</span>
                  {[
                    { label: 'Base Price',         display: formatCurrency(basePriceNumber) },
                    { label: 'Customization Total', display: formatCurrency(totalCustomizationCost) },
                  ].map(({ label, display }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                      <span className="text-base text-gray-600 dark:text-gray-400">{label}</span>
                      <span className="text-base text-gray-900 dark:text-gray-200">{display}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-white/20 pt-1.5 mt-1">
                    <span className="text-lg">Grand Total</span>
                    <span className="text-lg">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Hybrid: Style 1 / Style 2 stacked in the 60% column, one
                sticky Summary panel in the 40% column — mirrors recap.tsx's
                isHybridMode block exactly. Each child auto-saves to its own
                record; the Hybrid Grand Total is 85% over the higher of the
                two Base Prices, computed client-side (per Julia's 2026-07-20
                demo feedback), not the stale hybrid_proposed_total_custom_price
                rollup, which still reflects the old per-child-weight formula. */}
            {isHybrid && (() => {
              const [b1, b2] = hybridChildBasePrices;
              const higherIsStyle1 = b1 >= b2;
              return (
                <div className="flex gap-6 items-stretch">
                  <div className="w-[60%] min-w-0 space-y-4">
                    {hybridChildRecords.length < 2 && (
                      <div className="text-sm text-red-500 dark:text-red-400">
                        Missing {2 - hybridChildRecords.length} of 2 linked style records for this Hybrid request.
                      </div>
                    )}
                    {hybridChildRecords[0] && (
                      <HybridChildColumn
                        title="Style 1" childRecord={hybridChildRecords[0]} table={table}
                        styleOptions={styleOptions} canUpdate={canUpdate}
                      />
                    )}
                    {hybridChildRecords[1] && (
                      <HybridChildColumn
                        title="Style 2" childRecord={hybridChildRecords[1]} table={table}
                        styleOptions={styleOptions} canUpdate={canUpdate}
                      />
                    )}
                  </div>

                  <div className="w-[40%] shrink-0">
                    <div className="sticky top-0 p-4 rounded-lg space-y-1.5 border border-gray-200 dark:border-[#38322A] bg-gray-50 dark:bg-white/5">
                      <span className={labelCls}>Summary</span>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                        <span className="text-base text-gray-600 dark:text-gray-400">Style 1 Base Price{higherIsStyle1 && ' (higher)'}</span>
                        <span className="text-base text-gray-900 dark:text-gray-200">{formatCurrency(b1)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                        <span className="text-base text-gray-600 dark:text-gray-400">Style 2 Base Price{!higherIsStyle1 && ' (higher)'}</span>
                        <span className="text-base text-gray-900 dark:text-gray-200">{formatCurrency(b2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                        <span className="text-base text-gray-600 dark:text-gray-400">+85% Surcharge</span>
                        <span className="text-base text-gray-900 dark:text-gray-200">{formatCurrency(Math.max(b1, b2) * 0.85)}</span>
                      </div>
                      <div className="flex justify-between items-center font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-white/20 pt-1.5 mt-1">
                        <span className="text-lg">Grand Total</span>
                        <span className="text-lg">{formatCurrency(hybridCombinedTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
            {approvalStatus === 'Approved' && (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-300">
                Approved — proposed to the client.
              </div>
            )}
            {(approvalStatus === 'Approved' || approvalStatus === 'Counter-Proposed') && fApproved && (
              <div>
                <span className={labelCls}>{approvalStatus === 'Counter-Proposed' ? 'Counter-Proposed Price' : 'Approved Price'}</span>
                <div className="text-sm text-gray-900 dark:text-gray-200">{record.getCellValueAsString(fApproved) || '—'}</div>
              </div>
            )}
            {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}

          </div>
        </div>

      </div>

      {showApproveConfirm && (
        <ApproveDenyConfirmModal
          action="Approve"
          clientName={clientName}
          onConfirm={handleApprove}
          onClose={() => setShowApproveConfirm(false)}
        />
      )}
      {showDenyConfirm && (
        <ApproveDenyConfirmModal
          action="Deny"
          clientName={clientName}
          onConfirm={handleDeny}
          onClose={() => setShowDenyConfirm(false)}
        />
      )}
      {showCounterModal && (
        <CounterProposalModal
          parentRecord={record}
          customizationsTable={table}
          pricingRecords={pricingRecords}
          pricingTable={pricingTable}
          preApprovalField={preApprovalField}
          allCustomizationRecords={allCustomizationRecords}
          onClose={() => setShowCounterModal(false)}
          onSubmitted={() => { setShowCounterModal(false); onBack(); }}
        />
      )}
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
  const stylesBasePriceField = stylesTable?.getFieldIfExists(FIELD_IDS.STYLE_BASE_PRICE) ?? null;

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
  const [layout,               setLayout]               = useState<typeof LAYOUT_OPTIONS[number]>('ops');
  const [filterSA,             setFilterSA]             = useState<string[]>([]);
  const [filterStyle,          setFilterStyle]          = useState<string[]>([]);
  const [filterApprovalStatus, setFilterApprovalStatus] = useState<string[]>([]);
  const [clientSearch,         setClientSearch]         = useState('');
  const [showNewRequest,       setShowNewRequest]       = useState(false);
  const [draggedRecordId,      setDraggedRecordId]      = useState<string | null>(null);

  // Smooth (not animated) layout swap — same fade-in-on-mount technique used by
  // every modal in this file, just applied to the layout body instead of a
  // backdrop, so switching Workdesk/Approval doesn't read as an abrupt snap.
  const [layoutVisible, setLayoutVisible] = useState(true);
  useEffect(() => {
    setLayoutVisible(false);
    const t = setTimeout(() => setLayoutVisible(true), 10);
    return () => clearTimeout(t);
  }, [layout]);

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
      hybridCustomizationClient: customizationsTable.getFieldIfExists(FIELD_IDS.HYBRID_CUSTOMIZATION_CLIENT),
      customizedStyle:          customizationsTable.getFieldIfExists(FIELD_IDS.CUSTOMIZED_STYLE),
      approvalStatus:           customizationsTable.getFieldIfExists(FIELD_IDS.APPROVAL_STATUS),
      salesAssociate:           customizationsTable.getFieldIfExists(FIELD_IDS.SALES_ASSOCIATE),
      dateOfRequest:            customizationsTable.getFieldIfExists(FIELD_IDS.DATE_OF_REQUEST),
      weddingDate:              customizationsTable.getFieldIfExists(FIELD_IDS.WEDDING_DATE),
      proposedTotalCustomPrice: customizationsTable.getFieldIfExists(FIELD_IDS.PROPOSED_TOTAL_CUSTOM_PRICE),
      approvedPricing:          customizationsTable.getFieldIfExists(FIELD_IDS.APPROVED_PRICING),
      isHybrid:                 customizationsTable.getFieldIfExists(FIELD_IDS.IS_HYBRID),
      hybridLinkInverse:        customizationsTable.getFieldIfExists(FIELD_IDS.HYBRID_LINK_INVERSE),
      hybridStyleNames:         customizationsTable.getFieldIfExists(FIELD_IDS.HYBRID_STYLE_NAMES),
      hybridLink:               customizationsTable.getFieldIfExists(FIELD_IDS.HYBRID_LINK),
      basePrice:                customizationsTable.getFieldIfExists(FIELD_IDS.BASE_PRICE),
    };
  }, [customizationsTable]);

  const approvalChoiceColors = useMemo(() => getChoiceColorMap(fields?.approvalStatus ?? null), [fields]);
  const approvalStatusOptions = useMemo(() => getFieldChoiceNames(fields?.approvalStatus ?? null), [fields]);

  const filteredRecords = useMemo(() => {
    if (!fields) return [];
    return allCustomizationRecords.filter(record => {
      // A hybrid's two child Customizations (one per style) only ever exist
      // to feed the parent's price — they're never their own row here, only
      // embedded inside the parent's detail page. Airtable's own auto-
      // generated reverse of the hybrid_customization self-link (children ->
      // parent) identifies a child directly: non-empty means "I'm a child".
      const isHybridChild = fields.hybridLinkInverse
        ? ((record.getCellValue(fields.hybridLinkInverse) as Array<{ id: string }> | null)?.length ?? 0) > 0
        : false;
      if (isHybridChild) return false;
      const saValue     = fields.salesAssociate   ? record.getCellValueAsString(fields.salesAssociate) : '';
      const styleRaw    = fields.customizedStyle  ? record.getCellValue(fields.customizedStyle)        : null;
      const styleValue  = getLinkedRecordName(styleRaw);
      const approvalVal = fields.approvalStatus ? getSingleSelectName(record.getCellValue(fields.approvalStatus)) : '';
      const clientValue = fields.client ? getLinkedRecordName(record.getCellValue(fields.client)) : '';
      return (filterSA.length === 0            || filterSA.some(f => saValue.includes(f)))
          && (filterStyle.length === 0          || filterStyle.some(f => styleValue.includes(f)))
          && (filterApprovalStatus.length === 0 || filterApprovalStatus.includes(approvalVal))
          && (!clientSearch.trim()              || clientValue.toLowerCase().includes(clientSearch.trim().toLowerCase()));
    }).sort((a, b) => {
      const aDate = fields.dateOfRequest ? resolveDateString(a.getCellValue(fields.dateOfRequest)) : '';
      const bDate = fields.dateOfRequest ? resolveDateString(b.getCellValue(fields.dateOfRequest)) : '';
      return bDate.localeCompare(aDate);
    });
  }, [allCustomizationRecords, filterSA, filterStyle, filterApprovalStatus, clientSearch, fields]);

  // Shared row-projection logic — used by both the Ops (single-table) layout
  // and the Approval layout's two split tables, so the two never drift.
  const buildRowData = useCallback((record: AirtableRecord) => {
    const isHybridRow = fields?.isHybrid ? record.getCellValueAsString(fields.isHybrid) === 'Hybrid' : false;
    const approvalVal = fields?.approvalStatus ? getSingleSelectName(record.getCellValue(fields.approvalStatus)) : '';
    const clientText  = (fields?.hybridCustomizationClient ? record.getCellValueAsString(fields.hybridCustomizationClient) : '')
      || (fields?.client ? getLinkedRecordName(record.getCellValue(fields.client)) : '')
      || '—';
    const styleText   = isHybridRow
      ? (fields?.hybridStyleNames ? (record.getCellValueAsString(fields.hybridStyleNames) || 'Hybrid') : 'Hybrid')
      : (fields?.customizedStyle ? getLinkedRecordName(record.getCellValue(fields.customizedStyle)) : '—');
    const saText      = fields?.salesAssociate ? record.getCellValueAsString(fields.salesAssociate) || '—' : '—';
    const dateStr     = fields?.dateOfRequest  ? resolveDateString(record.getCellValue(fields.dateOfRequest)) : '';
    const weddingRaw  = fields?.weddingDate    ? record.getCellValue(fields.weddingDate) : null;
    const weddingStr  = resolveDateString(weddingRaw)
      || (fields?.weddingDate ? record.getCellValueAsString(fields.weddingDate) : '');
    const approvedVal = fields?.approvedPricing ? record.getCellValueAsString(fields.approvedPricing) : '';
    // Hybrid total is computed client-side (85% over the higher child Base
    // Price) rather than trusted from the stale hybrid_proposed_total_custom_price
    // rollup, which still reflects the old per-child-weight formula — see recap.tsx.
    const proposedVal = isHybridRow
      ? (() => {
          if (!fields?.hybridLink || !fields.basePrice) return '';
          const childIds = ((record.getCellValue(fields.hybridLink) as Array<{ id: string }> | null) ?? []).map(x => x.id);
          const children = childIds.map(id => allCustomizationRecords.find(r => r.id === id)).filter((r): r is AirtableRecord => !!r);
          const [c1, c2] = children;
          const b1 = c1 ? parseCurrencyString(c1.getCellValueAsString(fields.basePrice)) : 0;
          const b2 = c2 ? parseCurrencyString(c2.getCellValueAsString(fields.basePrice)) : 0;
          return formatCurrency(computeHybridCombinedTotal(b1, b2));
        })()
      : (fields?.proposedTotalCustomPrice ? record.getCellValueAsString(fields.proposedTotalCustomPrice) : '');
    return { approvalVal, clientText, styleText, saText, dateStr, weddingStr, proposedVal, approvedVal };
  }, [fields, allCustomizationRecords]);

  // Approval layout — same underlying filtered set (search/SA/Style still
  // apply), split into the two status buckets. "New Requests" includes both
  // an empty status and the explicit "Request" choice, per Axel's spec.
  const newRequestRecords = useMemo(
    () => filteredRecords.filter(r => { const v = buildRowData(r).approvalVal; return v === '' || v === 'New Request'; }),
    [filteredRecords, buildRowData]
  );
  const underReviewRecords = useMemo(
    () => filteredRecords.filter(r => buildRowData(r).approvalVal === 'Under Review'),
    [filteredRecords, buildRowData]
  );

  const handleDropToUnderReview = useCallback(() => {
    if (!draggedRecordId || !customizationsTable) { setDraggedRecordId(null); return; }
    const id = draggedRecordId;
    setDraggedRecordId(null);
    queueWrite(() => customizationsTable.updateRecordAsync(id, {
      [FIELD_IDS.APPROVAL_STATUS]: { name: 'Under Review' },
    })).catch(err => console.error('Approval status drag-update failed:', err));
  }, [draggedRecordId, customizationsTable]);

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
        stylesBasePriceField={stylesBasePriceField}
        preApprovalField={preApprovalField}
        selfUsageField={selfUsageField}
        clientRecords={clientRecords}
        favoriteStylesApptField={favoriteStylesApptField}
        allCustomizationRecords={allCustomizationRecords}
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
    <>
    {/* Keep the scrollbar track/thumb but drop the up/down arrow buttons —
        matches recap.tsx's established global scrollbar pattern. */}
    <style>{`::-webkit-scrollbar-button{display:none;height:0;width:0}`}</style>
    <div className="h-screen flex flex-col font-sans antialiased overflow-hidden" style={{ backgroundColor: '#F8F5EE' }}>
      {/* Filter Bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 border-b border-[#E9E0CE] dark:border-[#38322A] bg-white dark:bg-[#25211A] flex-wrap">
        <div className="relative">
          <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input type="text" placeholder="Search by client…" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-[#25211A] border border-gray-300 dark:border-[#38322A] rounded-lg outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 w-[220px]" />
        </div>
        <FilterDropdown label="Sales Associate" values={filterSA}             options={saOptions}               onChange={setFilterSA} />
        <FilterDropdown label="Style"           values={filterStyle}          options={styleOptions}            onChange={setFilterStyle} searchable />
        {layout === 'ops' && (
          <FilterDropdown label="Approval Status" values={filterApprovalStatus} options={approvalStatusOptions}  onChange={setFilterApprovalStatus} />
        )}
        <div className="ml-auto flex items-center gap-3">
          <LayoutDropdown value={layout} onChange={setLayout} />
          <button type="button" onClick={() => setShowNewRequest(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 dark:bg-amber-400 dark:text-gray-900 rounded-lg hover:bg-amber-700 dark:hover:bg-amber-300 transition-colors">
            <PlusIcon size={14} />New Customization Request
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden transition-opacity duration-200 ease-out" style={{ opacity: layoutVisible ? 1 : 0 }}>
      {layout === 'ops' ? (
        /* Table */
        <div className="p-6 overflow-auto flex-1">
          <div className="bg-white dark:bg-[#25211A] border border-[#E9E0CE] dark:border-[#38322A] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                <tr>
                  {['Client', 'Style', 'Approval Status', 'Sales Associate', 'Date of Request', 'Wedding Date', 'Proposed Total', 'Approved Price'].map(h => (
                    <th key={h} className="px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize tracking-wide text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(record => {
                  const { approvalVal, clientText, styleText, saText, dateStr, weddingStr, proposedVal, approvedVal } = buildRowData(record);
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
      ) : (
        /* Approval layout — New Requests (drag source) / Under Review (drop target) */
        <div className="p-6 overflow-auto flex-1">
          <div className="grid grid-cols-2 gap-6 h-full">
            <div className="flex flex-col min-h-0">
              <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 flex-shrink-0">
                New Requests <span className="text-gray-400 dark:text-gray-500 font-normal">({newRequestRecords.length})</span>
              </h2>
              <div className="bg-white dark:bg-[#25211A] border border-[#E9E0CE] dark:border-[#38322A] rounded-xl overflow-hidden flex-1 min-h-0 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 sticky top-0">
                    <tr>
                      {['Client', 'Style', 'Sales Associate', 'Date of Request', 'Proposed Total'].map(h => (
                        <th key={h} className="px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize tracking-wide text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {newRequestRecords.map(record => {
                      const { clientText, styleText, saText, dateStr, proposedVal } = buildRowData(record);
                      const cellCls = 'px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300';
                      return (
                        <tr key={record.id} draggable
                          onDragStart={() => setDraggedRecordId(record.id)}
                          onDragEnd={() => setDraggedRecordId(null)}
                          onClick={() => setViewState({ layer: 2, recordId: record.id })}
                          className="border-b border-gray-100 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5 cursor-move transition-colors">
                          <td className={cellCls}>{clientText}</td>
                          <td className={cellCls}>{styleText}</td>
                          <td className={cellCls}>{saText}</td>
                          <td className={cellCls}>{formatDate(dateStr)}</td>
                          <td className={cellCls}>{proposedVal || '—'}</td>
                        </tr>
                      );
                    })}
                    {newRequestRecords.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                          No new requests.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col min-h-0">
              <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 flex-shrink-0">
                Under Review <span className="text-gray-400 dark:text-gray-500 font-normal">({underReviewRecords.length})</span>
              </h2>
              <div onDragOver={e => e.preventDefault()} onDrop={handleDropToUnderReview}
                className={`bg-white dark:bg-[#25211A] border rounded-xl overflow-hidden flex-1 min-h-0 overflow-y-auto transition-colors ${
                  draggedRecordId ? 'border-amber-400 dark:border-amber-400 ring-2 ring-amber-400/30' : 'border-[#E9E0CE] dark:border-[#38322A]'
                }`}>
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 sticky top-0">
                    <tr>
                      {['Client', 'Style', 'Sales Associate', 'Date of Request', 'Proposed Total'].map(h => (
                        <th key={h} className="px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize tracking-wide text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {underReviewRecords.map(record => {
                      const { clientText, styleText, saText, dateStr, proposedVal } = buildRowData(record);
                      const cellCls = 'px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300';
                      return (
                        <tr key={record.id} onClick={() => setViewState({ layer: 2, recordId: record.id })}
                          className="border-b border-gray-100 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5 cursor-pointer transition-colors">
                          <td className={cellCls}>{clientText}</td>
                          <td className={cellCls}>{styleText}</td>
                          <td className={cellCls}>{saText}</td>
                          <td className={cellCls}>{formatDate(dateStr)}</td>
                          <td className={cellCls}>{proposedVal || '—'}</td>
                        </tr>
                      );
                    })}
                    {underReviewRecords.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Drag a new request here to send it for review.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>

    {showNewRequest && customizationsTable && (
      <NewRequestModal
        customizationsTable={customizationsTable}
        pricingTable={pricingTable}
        pricingRecords={pricingRecords}
        stylesRecords={styleRecords}
        stylesBasePriceField={stylesBasePriceField}
        clientsTable={clientsTable}
        clientRecords={clientRecords}
        preApprovalField={preApprovalField}
        onClose={() => setShowNewRequest(false)}
        onCreated={recordId => { setShowNewRequest(false); setViewState({ layer: 2, recordId }); }}
      />
    )}
    </>
  );
}

initializeBlock({ interface: () => <CustomizationApp /> });

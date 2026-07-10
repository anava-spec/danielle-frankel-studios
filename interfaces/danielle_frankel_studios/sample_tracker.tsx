import {
  initializeBlock,
  useBase,
  useRecords,
} from '@airtable/blocks/interface/ui';
import type { Table, Record } from '@airtable/blocks/interface/models';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// ─── WRITE QUEUE (safe sequential writes) ────────────────────────────────────
let _writeQueue = Promise.resolve();
function queueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = _writeQueue.then(fn);
  _writeQueue = next.then(() => {}, () => {});
  return next;
}

// ─── PALETTE: CHAMPAGNE ────────────────────────────────────────────────────────
const LIGHT = {
  app_bg: '#F8F5EE',
  surface: '#FFFFFF',
  surface_alt: '#F3EFE6',
  border: '#E9E0CE',
  text_primary: '#1A1612',
  text_secondary: '#6B5E4E',
  text_muted: '#9C8E7E',
  accent: '#D97706',
  accent_subtle: '#FEF3C7',
  badge_in_studio: '#D1FAE5',
  badge_in_studio_text: '#065F46',
  badge_trunk: '#FEF3C7',
  badge_trunk_text: '#92400E',
  badge_away: '#F3F4F6',
  badge_away_text: '#374151',
  risk_bg: '#FFF7ED',
  risk_border: '#FED7AA',
  risk_text: '#9A3412',
  row_hover: '#FBF8F2',
  overlay: 'rgba(0,0,0,0.4)',
  input_border: '#D1C8BA',
  input_focus: '#D97706',
};
const DARK = {
  app_bg: '#1B1813',
  surface: '#25211A',
  surface_alt: '#2E2920',
  border: '#38322A',
  text_primary: '#F5F0E8',
  text_secondary: '#C4B49E',
  text_muted: '#7A6E62',
  accent: '#FBBF24',
  accent_subtle: '#3B2F0A',
  badge_in_studio: '#064E3B',
  badge_in_studio_text: '#6EE7B7',
  badge_trunk: '#451A03',
  badge_trunk_text: '#FCD34D',
  badge_away: '#374151',
  badge_away_text: '#D1D5DB',
  risk_bg: '#2C1A0E',
  risk_border: '#78350F',
  risk_text: '#FCA5A5',
  row_hover: '#2E2920',
  overlay: 'rgba(0,0,0,0.6)',
  input_border: '#4A3F35',
  input_focus: '#FBBF24',
};
type Tok = typeof LIGHT;

function useTheme() {
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return isDark ? DARK : LIGHT;
}

// ─── FIELD / TABLE IDS ────────────────────────────────────────────────────────
const FIELD_IDS = {
  SAMPLE: {
    LABEL:     'fldY8RGD6wRe673Lh', // formula: StyleName - S - Size (read-only)
    STYLE_NAME:'fldey0Dj1iCDrk9iz', // singleLineText
    SIZE:      'fldWEXxkqlC7EHCpL', // singleSelect
    LOCATION:  'fldPHYcHjncDy3JTG', // singleSelect
    TYPE:      'fld00hfqAy5lUGote', // singleSelect: Garment, Shoes, Accessories
    NOTES:     'fldDOwmisGyOOKN7O', // multilineText
    STATUS:    'fldjLf5XSWEwsmdYh', // formula: In Studio / Trunk Show / Away
  },
  APPT: {
    APPOINTMENT_TIME: 'fldL7kYvgkmyhGniX',
    CLIENT:           'fldcVVGhEsnYRsbyR',
    FAVORITE_STYLES:  'fldCPhdJ885D7ytOf',
    STATUS:           'fldZTkJdTBhmcchTb',
    SA_NAME:          'fldAopgXS7Zw42ZgV', // multipleLookupValues → SA name string
  },
  CLIENT: {
    FULL_NAME:        'fldB3Wyam01D3wR5Q',
    READY_TO_WEAR_SIZE:'fldEEH4CK3Qqp0g0C',
  },
} as const;

const TABLE_IDS = {
  SAMPLE_LOG:   'tbloFb2w2SANfkDQy',
  APPOINTMENTS: 'tblvV7uKTCaFFekoR',
  CLIENTS:      'tblLLUlDgJ4ktzF7c',
} as const;

// ─── KNOWN SELECT OPTIONS (from DBML) ────────────────────────────────────────
const LOCATION_OPTIONS = [
  'NY Sales - 14th Floor', 'LA Sales', 'Trunk Show',
  'Press Pull', 'Production', 'Design', 'Damaged', 'Archive', 'Other',
];
const SIZE_OPTIONS = [
  '0', '0-2', '2', '2-4', '4', '6', '8', '10', '12', '14', '16',
  'XS', 'S', 'M', 'L', 'XXL', 'OS', 'OS 2', 'OS 8',
];
const TYPE_OPTIONS = ['Garment', 'Shoes', 'Accessories'];

type LocationStatus = 'in-studio' | 'at trunk show' | 'away';
type TimePeriod = '7' | '14' | '30' | 'all';

interface StyleMatch {
  style: string;
  inStudio: boolean;
  bestSample: Record | null; // best in-studio match
  anySample: Record | null;  // any sample of this style (for modal on missing rows)
  distance: number | null;
}
interface RiskAlert {
  apptRecord: Record;
  clientName: string;
  apptDate: string;
  daysUntil: number;
  styleMatches: StyleMatch[];
  missingData?: 'no-styles' | 'no-size'; // incomplete-data states
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function deriveLocationStatus(loc: string | null): LocationStatus {
  if (!loc) return 'away';
  if (loc === 'NY Sales - 14th Floor' || loc === 'LA Sales') return 'in-studio';
  if (loc === 'Trunk Show') return 'at trunk show';
  return 'away';
}
function sizeToNumber(s: string | null): number | null {
  if (!s) return null;
  const t = s.trim();
  if (t === 'OS' || t === 'OS ') return 0;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}
function getLocationValue(r: Record): string | null {
  const v = r.getCellValue(FIELD_IDS.SAMPLE.LOCATION);
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'name' in (v as object)) return (v as any).name;
  return null;
}
function truncate(s: string, n: number) { return s.length <= n ? s : s.slice(0, n - 1) + '…'; }
function fmtDate(raw: string) {
  return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysUntil(dateStr: string) {
  const ms = new Date(dateStr.slice(0, 10)).getTime() - new Date(todayStr()).getTime();
  return Math.round(ms / 86400000);
}

// ─── CHEVRON SVG ─────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{ flexShrink: 0, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function Checkmark({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6L4.5 8.5L10 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── FILTER DROPDOWN (multi-select, matches reference interface style) ─────────
interface FilterDropdownProps {
  label: string;
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  tok: Tok;
  minWidth?: number;
}
function FilterDropdown({ label, values, options, onChange, tok, minWidth = 130 }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (opt: string) => {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  };

  const display = values.length === 0
    ? 'All'
    : values.length === 1 ? (values[0] ?? 'All')
    : `${values.length} selected`;

  const isActive = values.length > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* Label outside the button */}
      <span style={{ fontSize: '11px', fontWeight: 500, color: tok.text_muted, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div ref={ref} style={{ position: 'relative' }}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
            minWidth, background: tok.surface,
            border: `1px solid ${isActive ? tok.accent : tok.border}`,
            borderRadius: '8px', padding: '5px 10px',
            fontSize: '12px', color: isActive ? tok.accent : tok.text_primary,
            fontWeight: isActive ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'border-color 0.15s',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{display}</span>
          <Chevron open={open} />
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: Math.max(minWidth, 160), padding: '4px 0',
          }}>
            {/* All */}
            <div
              onClick={() => { onChange([]); setOpen(false); }}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
                background: !isActive ? tok.accent_subtle : 'transparent',
                color: !isActive ? tok.accent : tok.text_primary,
                fontWeight: !isActive ? 600 : 400,
              }}
            >
              All
            </div>
            <div style={{ height: '1px', background: tok.border, margin: '2px 0' }} />

            {/* Options */}
            {options.map(opt => {
              const checked = values.includes(opt);
              return (
                <div
                  key={opt}
                  onClick={() => toggle(opt)}
                  style={{
                    padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
                    background: checked ? tok.accent_subtle : 'transparent',
                    color: checked ? tok.accent : tok.text_primary,
                    fontWeight: checked ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {opt}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear link */}
      {isActive && (
        <button
          type="button"
          onClick={() => onChange([])}
          style={{
            fontSize: '11px', color: tok.text_muted, cursor: 'pointer',
            background: 'none', border: 'none', padding: 0,
            textDecoration: 'underline', whiteSpace: 'nowrap',
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── SINGLE SELECT DROPDOWN (no checkboxes, for time period) ─────────────────
interface SelectOption { key: string; label: string; }
interface SingleSelectDropdownProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (key: string) => void;
  tok: Tok;
  minWidth?: number;
}
function SingleSelectDropdown({ label, value, options, onChange, tok, minWidth = 110 }: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.key === value);
  const display = selected?.label ?? 'All';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '11px', fontWeight: 500, color: tok.text_muted, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
            minWidth, background: tok.surface,
            border: `1px solid ${tok.border}`,
            borderRadius: '8px', padding: '5px 10px',
            fontSize: '12px', color: tok.text_primary, fontWeight: 400,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'border-color 0.15s',
          }}
        >
          <span>{display}</span>
          <Chevron open={open} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: Math.max(minWidth, 140), padding: '4px 0',
          }}>
            {options.map(opt => {
              const isSelected = opt.key === value;
              return (
                <div
                  key={opt.key}
                  onClick={() => { onChange(opt.key); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                    background: isSelected ? tok.accent_subtle : 'transparent',
                    color: isSelected ? tok.accent : tok.text_primary,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = tok.surface_alt; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? tok.accent_subtle : 'transparent'; }}
                >
                  {opt.label}
                  {isSelected && <Checkmark color={tok.accent} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INLINE SELECT (for modal editable fields) ────────────────────────────────
interface InlineSelectProps {
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  tok: Tok;
  escapeModal?: boolean; // use fixed positioning so dropdown overlays the modal
}
function InlineSelect({ value, options, onChange, placeholder = 'Select…', tok, escapeModal = false }: InlineSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const ITEM_HEIGHT = 34; // px per option row
  const MAX_VISIBLE = 8;

  const handleOpen = () => {
    if (escapeModal && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const idealHeight = Math.min(options.length, MAX_VISIBLE) * ITEM_HEIGHT + 6;
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 3,
        left: rect.left,
        width: rect.width,
        zIndex: 2000,
        maxHeight: Math.min(idealHeight, spaceBelow),
        overflowY: 'auto',
      });
    }
    setOpen(o => !o);
  };

  const baseListStyle = {
    background: tok.surface, border: `1px solid ${tok.border}`,
    borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', padding: '3px 0',
  };
  const listStyle: React.CSSProperties = escapeModal
    ? { ...dropdownStyle, ...baseListStyle }
    : {
        position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 400,
        maxHeight: `${MAX_VISIBLE * ITEM_HEIGHT + 6}px`, overflowY: 'auto',
        ...baseListStyle,
      };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
          width: '100%', padding: '7px 10px', cursor: 'pointer',
          background: tok.surface,
          border: `1px solid ${open ? tok.input_focus : tok.input_border}`,
          borderRadius: '8px', fontSize: '13px',
          color: value ? tok.text_primary : tok.text_muted,
          transition: 'border-color 0.15s',
        }}
      >
        <span>{value ?? placeholder}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div style={listStyle}>
          {options.map(opt => {
            const isSel = opt === value;
            return (
              <div
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  padding: '7px 10px', cursor: 'pointer', fontSize: '13px',
                  background: isSel ? tok.accent_subtle : 'transparent',
                  color: isSel ? tok.accent : tok.text_primary, fontWeight: isSel ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = tok.surface_alt; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSel ? tok.accent_subtle : 'transparent'; }}
              >
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── LOCATION BADGE ───────────────────────────────────────────────────────────
function LocationBadge({ status, tok }: { status: LocationStatus; tok: Tok }) {
  const map: Record<LocationStatus, { bg: string; color: string; label: string }> = {
    'in-studio':    { bg: tok.badge_in_studio, color: tok.badge_in_studio_text, label: 'In Studio' },
    'at trunk show':{ bg: tok.badge_trunk,     color: tok.badge_trunk_text,     label: 'Trunk Show' },
    'away':         { bg: tok.badge_away,      color: tok.badge_away_text,      label: 'Away' },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
      background: s.bg, color: s.color, fontSize: '11px', fontWeight: 600,
      border: `1px solid ${s.color}22`,
    }}>
      {s.label}
    </span>
  );
}

// ─── SAMPLE DETAIL MODAL (editable per AC) ────────────────────────────────────
interface SampleDetailModalProps {
  record: Record;
  sampleTable: Table;
  onClose: () => void;
  tok: Tok;
}
function SampleDetailModal({ record, sampleTable, onClose, tok }: SampleDetailModalProps) {
  // ── Read initial values ──
  const getStr = (fid: string) => record.getCellValueAsString(fid) || '';
  const getSingleSelectName = (fid: string): string | null => {
    const v = record.getCellValue(fid);
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && 'name' in (v as object)) return (v as any).name;
    return null;
  };

  const label      = getStr(FIELD_IDS.SAMPLE.LABEL) || getStr(FIELD_IDS.SAMPLE.STYLE_NAME);
  const [styleName, setStyleName] = useState(getStr(FIELD_IDS.SAMPLE.STYLE_NAME));
  const [size,      setSize]      = useState<string | null>(getSingleSelectName(FIELD_IDS.SAMPLE.SIZE));
  const [type,      setType]      = useState<string | null>(getSingleSelectName(FIELD_IDS.SAMPLE.TYPE));
  const [locVal,    setLocVal]    = useState<string | null>(getLocationValue(record));
  const [notes,     setNotes]     = useState(getStr(FIELD_IDS.SAMPLE.NOTES));

  const canWrite = sampleTable.hasPermissionToUpdateRecords?.() ?? true;

  const save = useCallback((patch: Record<string, unknown>) => {
    queueWrite(() => sampleTable.updateRecordAsync(record.id, patch))
      .catch(err => console.error('[SampleTracker] save error:', err));
  }, [sampleTable, record.id]);

  const handleLocation = (val: string) => {
    setLocVal(val);
    save({ [FIELD_IDS.SAMPLE.LOCATION]: { name: val } });
  };
  const handleSize = (val: string) => {
    setSize(val);
    save({ [FIELD_IDS.SAMPLE.SIZE]: { name: val } });
  };
  const handleType = (val: string) => {
    setType(val);
    save({ [FIELD_IDS.SAMPLE.TYPE]: { name: val } });
  };
  const handleStyleName = () => {
    save({ [FIELD_IDS.SAMPLE.STYLE_NAME]: styleName || null });
  };
  const handleNotes = () => {
    save({ [FIELD_IDS.SAMPLE.NOTES]: notes || null });
  };

  // Close on backdrop / Escape
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const status = deriveLocationStatus(locVal);

  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      fontSize: '10px', fontWeight: 700, color: tok.text_muted,
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px',
    }}>
      {children}
    </div>
  );

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: tok.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          width: '480px', maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px 14px', borderBottom: `1px solid ${tok.border}`,
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, color: tok.text_muted,
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px',
          }}>
            Sample
          </div>
          {/* Title + status chip inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: tok.text_primary, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {label}
            </div>
            <LocationBadge status={status} tok={tok} />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Style Name + Location — row 0 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <FieldLabel>Style Name</FieldLabel>
              {canWrite ? (
                <input
                  type="text"
                  value={styleName}
                  onChange={e => setStyleName(e.target.value)}
                  onBlur={e => {
                    (e.target as HTMLInputElement).style.borderColor = tok.input_border;
                    handleStyleName();
                  }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = tok.input_focus; }}
                  placeholder="Style name…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '7px 10px', borderRadius: '8px',
                    border: `1px solid ${tok.input_border}`,
                    background: tok.surface, color: tok.text_primary,
                    fontSize: '13px', outline: 'none', fontFamily: 'inherit',
                  }}
                />
              ) : (
                <div style={{ fontSize: '13px', color: tok.text_primary }}>{styleName || '—'}</div>
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: tok.text_muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Location</div>
                {locVal && (
                  <span style={{ fontSize: '11px', color: tok.text_muted }}>
                    {status === 'in-studio' ? '· Available' : status === 'at trunk show' ? '· Trunk Show' : '· Away'}
                  </span>
                )}
              </div>
              {canWrite
                ? <InlineSelect value={locVal} options={LOCATION_OPTIONS} onChange={handleLocation} tok={tok} escapeModal />
                : <div style={{ fontSize: '13px', color: tok.text_primary }}>{locVal ?? '—'}</div>
              }
            </div>
          </div>

          {/* Size + Type — row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <FieldLabel>Size</FieldLabel>
              {canWrite
                ? <InlineSelect value={size} options={SIZE_OPTIONS} onChange={handleSize} tok={tok} escapeModal />
                : <div style={{ fontSize: '13px', color: tok.text_primary }}>{size ?? '—'}</div>
              }
            </div>
            <div>
              <FieldLabel>Type</FieldLabel>
              {canWrite
                ? <InlineSelect value={type} options={TYPE_OPTIONS} onChange={handleType} tok={tok} escapeModal />
                : <div style={{ fontSize: '13px', color: tok.text_primary }}>{type ?? '—'}</div>
              }
            </div>
          </div>

          {/* Notes — row 3 */}
          <div>
            <FieldLabel>Notes</FieldLabel>
            {canWrite ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={handleNotes}
                placeholder="Add notes…"
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px', borderRadius: '8px',
                  border: `1px solid ${tok.input_border}`,
                  background: tok.surface, color: tok.text_primary,
                  fontSize: '13px', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
                onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = tok.input_focus; }}
                onBlurCapture={e => { (e.target as HTMLTextAreaElement).style.borderColor = tok.input_border; handleNotes(); }}
              />
            ) : (
              <div style={{ fontSize: '13px', color: tok.text_secondary, lineHeight: 1.5 }}>
                {notes || '—'}
              </div>
            )}
          </div>

          {!canWrite && (
            <div style={{ fontSize: '11px', color: tok.text_muted, fontStyle: 'italic' }}>
              Read-only — interface needs write permissions to Sample Log.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
function SampleTracker() {
  const tok = useTheme();
  const base = useBase();

  const sampleTable = base.getTableByIdIfExists(TABLE_IDS.SAMPLE_LOG);
  const apptTable   = base.getTableByIdIfExists(TABLE_IDS.APPOINTMENTS);
  const clientTable = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);

  const sampleRecords = useRecords(sampleTable ?? null);
  const apptRecords   = useRecords(apptTable ?? null);
  const clientRecords = useRecords(clientTable ?? null);

  // ── Filter state ──
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [typeFilter,     setTypeFilter]     = useState<string[]>([]);
  const [statusFilter,   setStatusFilter]   = useState<string[]>([]);
  const [search,         setSearch]         = useState('');
  const [timePeriod,     setTimePeriod]     = useState<TimePeriod>('7');
  const [saFilter,       setSaFilter]       = useState<string[]>([]);
  const [selectedSample, setSelectedSample] = useState<Record | null>(null);

  // ── Inventory filter options ──
  const locationOptions = useMemo(() => {
    if (!sampleRecords) return [];
    const s = new Set<string>();
    for (const r of sampleRecords) { const v = getLocationValue(r); if (v) s.add(v); }
    return Array.from(s).sort();
  }, [sampleRecords]);

  const typeOptions = useMemo(() => {
    if (!sampleRecords) return [];
    const s = new Set<string>();
    for (const r of sampleRecords) { const v = r.getCellValueAsString(FIELD_IDS.SAMPLE.TYPE); if (v) s.add(v); }
    return Array.from(s).sort();
  }, [sampleRecords]);

  // ── Status options from formula field ──
  const statusOptions = useMemo(() => {
    if (!sampleRecords) return [];
    const s = new Set<string>();
    for (const r of sampleRecords) {
      const v = r.getCellValueAsString(FIELD_IDS.SAMPLE.STATUS);
      if (v) s.add(v);
    }
    return Array.from(s).sort();
  }, [sampleRecords]);

  // ── SA options (derived from appointment records) ──
  const saOptions = useMemo(() => {
    if (!apptRecords) return [];
    const s = new Set<string>();
    for (const r of apptRecords) {
      const v = r.getCellValueAsString(FIELD_IDS.APPT.SA_NAME);
      if (v) v.split(',').map(x => x.trim()).filter(Boolean).forEach(x => s.add(x));
    }
    return Array.from(s).sort();
  }, [apptRecords]);

  // ── Time period options ──
  const TIME_OPTIONS: SelectOption[] = [
    { key: '7',   label: 'Next 7 days' },
    { key: '14',  label: 'Next 14 days' },
    { key: '30',  label: 'Next month' },
    { key: 'all', label: 'All future' },
  ];

  // ── Filtered sample records ──
  const filteredSamples = useMemo(() => {
    if (!sampleRecords) return [];
    return sampleRecords
      .filter(r => {
        const locVal    = getLocationValue(r);
        const typeVal   = r.getCellValueAsString(FIELD_IDS.SAMPLE.TYPE);
        const styleName = r.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME);

        if (locationFilter.length > 0 && (!locVal || !locationFilter.includes(locVal))) return false;
        if (typeFilter.length > 0 && !typeFilter.includes(typeVal)) return false;
        if (statusFilter.length > 0) {
          const statusVal = r.getCellValueAsString(FIELD_IDS.SAMPLE.STATUS);
          if (!statusFilter.includes(statusVal)) return false;
        }
        if (search) {
          const q = search.toLowerCase();
          if (!styleName.toLowerCase().includes(q) && !(locVal ?? '').toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ord: Record<LocationStatus, number> = { 'in-studio': 0, 'at trunk show': 1, 'away': 2 };
        const la = deriveLocationStatus(getLocationValue(a));
        const lb = deriveLocationStatus(getLocationValue(b));
        if (ord[la] !== ord[lb]) return ord[la] - ord[lb];
        return a.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME)
          .localeCompare(b.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME));
      });
  }, [sampleRecords, locationFilter, typeFilter, statusFilter, search]);

  // ── Pre-index in-studio samples by normalized style name (avoids O(N²) scan) ──
  const inStudioByStyle = useMemo(() => {
    if (!sampleRecords) return new Map<string, Record[]>();
    const map = new Map<string, Record[]>();
    for (const sample of sampleRecords) {
      const locVal = getLocationValue(sample);
      if (deriveLocationStatus(locVal) !== 'in-studio') continue;
      const name = sample.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME).toLowerCase().trim();
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(sample);
    }
    return map;
  }, [sampleRecords]);

  // ── Risk alerts (future appointments, one per client) ──
  const { allAlerts, unevaluatedCount } = useMemo((): { allAlerts: RiskAlert[]; unevaluatedCount: number } => {
    if (!apptRecords || !clientRecords || !sampleRecords) return { allAlerts: [], unevaluatedCount: 0 };
    const today = todayStr();
    const clientMap = new Map<string, Record>();
    for (const c of clientRecords) clientMap.set(c.id, c);

    const futureAppts = apptRecords
      .filter(appt => {
        const raw = appt.getCellValue(FIELD_IDS.APPT.APPOINTMENT_TIME) as string | null;
        if (!raw || raw.slice(0, 10) < today) return false;
        const status = appt.getCellValueAsString(FIELD_IDS.APPT.STATUS);
        if (status && (status.toLowerCase().includes('cancel') || status.toLowerCase().includes('no show'))) return false;
        return true;
      })
      .sort((a, b) => {
        const aR = (a.getCellValue(FIELD_IDS.APPT.APPOINTMENT_TIME) as string) ?? '';
        const bR = (b.getCellValue(FIELD_IDS.APPT.APPOINTMENT_TIME) as string) ?? '';
        return aR.localeCompare(bR);
      });

    // Keep only the next appointment per client
    const clientNextAppt = new Map<string, Record>();
    for (const appt of futureAppts) {
      const linked = appt.getCellValue(FIELD_IDS.APPT.CLIENT) as Array<{ id: string }> | null;
      if (!linked || linked.length === 0) continue;
      const clientId = linked[0].id;
      if (!clientNextAppt.has(clientId)) clientNextAppt.set(clientId, appt);
    }

    const alerts: RiskAlert[] = [];
    let unevaluated = 0;

    for (const appt of clientNextAppt.values()) {
      const apptTimeRaw = appt.getCellValue(FIELD_IDS.APPT.APPOINTMENT_TIME) as string;
      const clientLinked = appt.getCellValue(FIELD_IDS.APPT.CLIENT) as Array<{ id: string; name: string }>;
      const clientId = clientLinked[0].id;
      const clientRec = clientMap.get(clientId);

      const clientName = clientRec
        ? (clientRec.getCellValueAsString(FIELD_IDS.CLIENT.FULL_NAME) || clientLinked[0].name)
        : clientLinked[0].name;
      const clientSizeRaw = clientRec ? clientRec.getCellValueAsString(FIELD_IDS.CLIENT.READY_TO_WEAR_SIZE) : null;
      const clientSize = clientSizeRaw ? sizeToNumber(clientSizeRaw) : null;

      const favStylesStr = appt.getCellValueAsString(FIELD_IDS.APPT.FAVORITE_STYLES);
      const favStyles = favStylesStr
        ? favStylesStr.split(',').map(s => s.toLowerCase().trim()).filter(Boolean)
        : [];

      // #3 — No styles on file: surface as incomplete-data alert
      if (favStyles.length === 0) {
        unevaluated++;
        alerts.push({
          apptRecord: appt,
          clientName,
          apptDate: fmtDate(apptTimeRaw),
          daysUntil: daysUntil(apptTimeRaw),
          styleMatches: [],
          missingData: 'no-styles',
        });
        continue;
      }

      // #4 — Client size missing: flag but still evaluate style presence
      const sizeIsMissing = clientSize === null;

      // Use pre-indexed map — O(unique style names) instead of O(all samples)
      const styleMatches: StyleMatch[] = favStyles.map(fs => {
        const candidates: Record[] = [];
        for (const [name, samples] of inStudioByStyle) {
          if (name === fs || name.includes(fs) || fs.includes(name)) {
            candidates.push(...samples);
          }
        }

        // Find any sample of this style (even if not in-studio) for modal on missing rows
        let anySample: Record | null = null;
        for (const sample of sampleRecords) {
          const sName = sample.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME).toLowerCase().trim();
          if (sName === fs || sName.includes(fs) || fs.includes(sName)) { anySample = sample; break; }
        }

        if (candidates.length === 0) return { style: fs, inStudio: false, bestSample: null, anySample, distance: null };

        let bestSample: Record | null = null;
        let bestDist: number | null = null;
        for (const sample of candidates) {
          const sSize = sizeToNumber(sample.getCellValueAsString(FIELD_IDS.SAMPLE.SIZE));
          // If client size is missing, distance is null — don't default to 0
          const dist = (!sizeIsMissing && clientSize !== null && sSize !== null) ? Math.abs(clientSize - sSize) : null;
          if (bestSample === null || (dist !== null && (bestDist === null || dist < bestDist))) { bestDist = dist; bestSample = sample; }
        }
        return { style: fs, inStudio: true, bestSample, anySample: bestSample, distance: bestDist };
      });

      if (!styleMatches.some(m => !m.inStudio) && !sizeIsMissing) continue;

      // If all styles are in-studio but size is missing, still surface as incomplete
      if (!styleMatches.some(m => !m.inStudio) && sizeIsMissing) {
        unevaluated++;
        alerts.push({
          apptRecord: appt,
          clientName,
          apptDate: fmtDate(apptTimeRaw),
          daysUntil: daysUntil(apptTimeRaw),
          styleMatches,
          missingData: 'no-size',
        });
        continue;
      }

      alerts.push({
        apptRecord: appt,
        clientName,
        apptDate: fmtDate(apptTimeRaw),
        daysUntil: daysUntil(apptTimeRaw),
        styleMatches,
        missingData: sizeIsMissing ? 'no-size' : undefined,
      });
    }

    return { allAlerts: alerts.sort((a, b) => a.daysUntil - b.daysUntil), unevaluatedCount: unevaluated };
  }, [apptRecords, clientRecords, inStudioByStyle]);

  // ── Apply time period + SA filter ──
  const visibleAlerts = useMemo(() => {
    let filtered = allAlerts;

    // Time period
    if (timePeriod !== 'all') {
      const days = parseInt(timePeriod, 10);
      filtered = filtered.filter(a => a.daysUntil <= days);
    }

    // SA filter
    if (saFilter.length > 0) {
      filtered = filtered.filter(a => {
        const sa = a.apptRecord.getCellValueAsString(FIELD_IDS.APPT.SA_NAME);
        return saFilter.some(s => sa.toLowerCase().includes(s.toLowerCase()));
      });
    }

    return filtered;
  }, [allAlerts, timePeriod, saFilter]);

  const inputStyle: React.CSSProperties = {
    paddingLeft: '28px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px',
    borderRadius: '8px', border: `1px solid ${search ? tok.accent : tok.border}`,
    background: tok.surface, color: tok.text_primary,
    fontSize: '12px', width: '170px', outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      height: '100vh', background: tok.app_bg, color: tok.text_primary,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '10px 12px 12px', boxSizing: 'border-box',
    }}>

      {/* ── TOOLBAR ── */}
      <div style={{ display: 'flex', gap: '10px', paddingBottom: '10px', flexShrink: 0 }}>
        {/* Left 70%: inventory filters */}
        <div style={{ width: '70%', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search with clear button */}
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
              style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: tok.text_muted, pointerEvents: 'none' }}>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text" placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={inputStyle}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: tok.text_muted, fontSize: '14px', lineHeight: 1, padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>

          <FilterDropdown label="Location" values={locationFilter} options={locationOptions} onChange={setLocationFilter} tok={tok} />
          <FilterDropdown label="Type"     values={typeFilter}     options={typeOptions}     onChange={setTypeFilter}     tok={tok} minWidth={100} />
          <FilterDropdown label="Status"   values={statusFilter}   options={statusOptions}   onChange={setStatusFilter}   tok={tok} minWidth={100} />
        </div>

        {/* Right 30%: alert filters — aligned with Sample Alerts panel */}
        <div style={{ width: '30%', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <FilterDropdown       label="SA"     values={saFilter}  options={saOptions}   onChange={setSaFilter}    tok={tok} minWidth={120} />
          <SingleSelectDropdown label="Period" value={timePeriod} options={TIME_OPTIONS} onChange={v => setTimePeriod(v as TimePeriod)} tok={tok} minWidth={110} />
        </div>
      </div>

      {/* ── DUAL PANEL BODY ── */}
      <div style={{ display: 'flex', flex: 1, gap: '10px', overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT: SAMPLE INVENTORY 70% */}
        <div style={{
          width: '70%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: tok.surface, borderRadius: '12px',
          border: `1px solid ${tok.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {/* Title row with count */}
          <div style={{
            padding: '9px 14px 7px', borderBottom: `1px solid ${tok.border}`,
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: tok.text_muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Sample Inventory
            </span>
            <span style={{ fontSize: '10px', color: tok.text_muted }}>·</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: tok.text_muted }}>{filteredSamples.length}</span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: tok.surface_alt, position: 'sticky', top: 0, zIndex: 2 }}>
                  {['Style', 'Status', 'Size', 'Type', 'Location', 'Notes'].map(col => (
                    <th key={col} style={{
                      padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: '10px',
                      color: tok.text_muted, textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: `1px solid ${tok.border}`, whiteSpace: 'nowrap',
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSamples.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: tok.text_muted, fontSize: '13px' }}>
                      No samples match the current filters.
                    </td>
                  </tr>
                ) : filteredSamples.map(record => {
                  const locVal = getLocationValue(record);
                  return (
                    <tr
                      key={record.id}
                      onClick={() => setSelectedSample(record)}
                      style={{ background: tok.surface, cursor: 'pointer', borderBottom: `1px solid ${tok.border}` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = tok.row_hover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = tok.surface; }}
                    >
                      <td style={{ padding: '7px 12px', fontWeight: 600, color: tok.text_primary, maxWidth: '160px' }}>
                        {truncate(record.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME), 28)}
                      </td>
                      <td style={{ padding: '7px 12px' }}>
                        <LocationBadge status={deriveLocationStatus(locVal)} tok={tok} />
                      </td>
                      <td style={{ padding: '7px 12px', color: tok.text_secondary }}>
                        {record.getCellValueAsString(FIELD_IDS.SAMPLE.SIZE) || '—'}
                      </td>
                      <td style={{ padding: '7px 12px', color: tok.text_secondary }}>
                        {record.getCellValueAsString(FIELD_IDS.SAMPLE.TYPE) || '—'}
                      </td>
                      <td style={{ padding: '7px 12px', color: tok.text_secondary, maxWidth: '140px' }}>
                        {truncate(locVal || '—', 22)}
                      </td>
                      <td style={{ padding: '7px 12px', color: tok.text_muted, fontSize: '12px', maxWidth: '180px' }}>
                        {record.getCellValueAsString(FIELD_IDS.SAMPLE.NOTES)
                          ? truncate(record.getCellValueAsString(FIELD_IDS.SAMPLE.NOTES), 40) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: SAMPLE ALERTS 30% */}
        <div style={{
          width: '30%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: tok.surface, borderRadius: '12px',
          border: `1px solid ${tok.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {/* Title row with count — time period filter moved to toolbar */}
          <div style={{
            padding: '9px 12px 8px', borderBottom: `1px solid ${tok.border}`,
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: tok.text_muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Sample Alerts
            </span>
            <span style={{ fontSize: '10px', color: tok.text_muted }}>·</span>
            <span style={{
              fontSize: '10px', fontWeight: 600,
              color: visibleAlerts.length > 0 ? tok.risk_text : tok.text_muted,
            }}>
              {visibleAlerts.length}
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
            {visibleAlerts.length === 0 ? (
              unevaluatedCount > 0 ? (
                <div style={{ padding: '20px 16px', borderRadius: '8px', background: tok.badge_trunk, border: `1px solid ${tok.risk_border}`, margin: '8px 0' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: tok.badge_trunk_text, marginBottom: '4px' }}>
                    ⚠ Some appointments couldn't be evaluated
                  </div>
                  <div style={{ fontSize: '12px', color: tok.text_secondary }}>
                    {unevaluatedCount} appointment{unevaluatedCount > 1 ? 's are' : ' is'} missing styles or client size data. Review client records to complete evaluation.
                  </div>
                </div>
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: tok.text_muted, fontSize: '13px' }}>
                  No missing styles for this period.
                </div>
              )
            ) : visibleAlerts.map(alert => (
              <RiskCard key={alert.apptRecord.id} alert={alert} tok={tok} onSelectSample={setSelectedSample} />
            ))}
          </div>
        </div>
      </div>

      {/* ── SAMPLE DETAIL MODAL ── */}
      {selectedSample && sampleTable && (
        <SampleDetailModal
          record={selectedSample}
          sampleTable={sampleTable}
          onClose={() => setSelectedSample(null)}
          tok={tok}
        />
      )}
    </div>
  );
}

// ─── RISK CARD ────────────────────────────────────────────────────────────────
function RiskCard({ alert, tok, onSelectSample }: { alert: RiskAlert; tok: Tok; onSelectSample: (r: Record) => void }) {
  const [expanded, setExpanded] = useState(false);
  const urgency = alert.daysUntil <= 2 ? 'high' : alert.daysUntil <= 4 ? 'medium' : 'low';
  const c = {
    high:   { border: '#EF4444', dot: '#EF4444', bg: tok.risk_bg },
    medium: { border: tok.risk_border, dot: '#F59E0B', bg: tok.risk_bg },
    low:    { border: tok.border, dot: tok.accent, bg: tok.surface_alt },
  }[urgency];

  return (
    <div style={{ marginBottom: '7px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '9px 11px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '8px', userSelect: 'none' }}
      >
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: '5px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: tok.text_primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alert.clientName}
          </div>
          <div style={{ fontSize: '11px', color: tok.text_secondary, marginTop: '1px' }}>
            {alert.apptDate} · <span style={{ color: alert.daysUntil <= 2 ? '#EF4444' : tok.text_muted, fontWeight: 600 }}>
              {alert.daysUntil === 0 ? 'Today' : alert.daysUntil === 1 ? 'Tomorrow' : `${alert.daysUntil}d`}
            </span>
          </div>
          {alert.missingData === 'no-styles' ? (
            <div style={{ fontSize: '11px', color: tok.badge_trunk_text, marginTop: '2px', fontWeight: 600 }}>
              ⚠ No styles on file
            </div>
          ) : alert.missingData === 'no-size' ? (
            <div style={{ fontSize: '11px', color: tok.badge_trunk_text, marginTop: '2px', fontWeight: 600 }}>
              ⚠ Client size missing — distance unavailable
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: tok.risk_text, marginTop: '2px' }}>
              {alert.styleMatches.filter(m => !m.inStudio).length} style(s) not in studio
            </div>
          )}
        </div>
        <span style={{ fontSize: '9px', color: tok.text_muted, flexShrink: 0, paddingTop: '4px' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded: style coverage */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${tok.border}`, padding: '9px 11px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: tok.text_muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
            Style Coverage
          </div>
          {alert.missingData === 'no-styles' ? (
            <div style={{ fontSize: '12px', color: tok.badge_trunk_text, padding: '6px 0' }}>
              No requested styles on file for this appointment. Update the client's favorite styles in DF Appointments – Acuity to enable evaluation.
            </div>
          ) : alert.missingData === 'no-size' && alert.styleMatches.length === 0 ? (
            <div style={{ fontSize: '12px', color: tok.badge_trunk_text, padding: '6px 0' }}>
              Client size is missing. Add the client's ready-to-wear size in DF Clients to enable size-distance matching.
            </div>
          ) : null}
          {alert.styleMatches.map(m => {
            const sampleToOpen = m.bestSample ?? m.anySample;
            const rowLabel = sampleToOpen
              ? (sampleToOpen.getCellValueAsString(FIELD_IDS.SAMPLE.LABEL) || sampleToOpen.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME))
              : m.style;
            const isClickable = !!sampleToOpen;
            return (
              <div
                key={m.style}
                onClick={() => { if (sampleToOpen) onSelectSample(sampleToOpen); }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 0', borderBottom: `1px solid ${tok.border}`,
                  cursor: isClickable ? 'pointer' : 'default',
                }}
                onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = tok.surface_alt; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '12px', color: tok.text_primary, flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rowLabel}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {m.inStudio ? (
                    <span style={{ color: tok.badge_in_studio_text, background: tok.badge_in_studio, padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 600 }}>
                      In Studio
                    </span>
                  ) : (
                    <span style={{ color: tok.risk_text, background: tok.risk_bg, padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, border: `1px solid ${tok.risk_border}` }}>
                      Missing
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

initializeBlock({ interface: () => <SampleTracker /> });
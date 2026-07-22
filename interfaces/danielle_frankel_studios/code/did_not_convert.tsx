import './style.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
} from '@airtable/blocks/interface/ui';
import {
  X as XIcon,
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
} from '@phosphor-icons/react';

// ─── Field IDs ────────────────────────────────────────────────────────────────
const FIELD_IDS = {
  FULL_NAME:                   'fldB3Wyam01D3wR5Q',
  STAGE:                       'fldLcxVZvI1rigBlh',
  SALES_ASSOCIATE:             'fldBTKBaw8YvNAlwK',
  FAVORITE_STYLES_FROM_ACUITY: 'fldZzNR0g5VEJ5RmX',
  LAST_APPOINTMENT:            'fldd01OccObkG9sGe',
  APPOINTMENT_COUNT:           'fldrnDWDgDx5IF5gz',
  WEDDING_DATE_FORMATTED:      'fldbgknumKGS5W5WU',
  PERSONAL_STYLE_NOTES:        'fldQiGCx5hRQ0Am1Z',
  STYLE_NAME:                  'fldEs3chQAeplPc1w',
} as const;

// ─── Utilities ────────────────────────────────────────────────────────────────
type AnyRecord = { id: string; getCellValue: (f: string) => unknown; getCellValueAsString: (f: string) => string };

// LAST_APPOINTMENT is a lookup field. This interface's runtime returns lookup
// cell values as an array of one entry per linked record — either a plain
// string, or (per BRANDING.md §9's lookup-color note, same underlying
// runtime quirk) an object of the shape { linkedRecordId, value }. The
// previous version of this file only checked for a plain string first
// element, so it silently rendered "—" for every lookup-shaped value.
function unwrapLookupString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.length > 0 ? unwrapLookupString(value[0]) : null;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === 'string') return obj.value;
    if (obj.value instanceof Date) return (obj.value as Date).toISOString();
    if (typeof obj.name === 'string') return obj.name;
  }
  return null;
}

function formatDate(value: unknown, opts: Intl.DateTimeFormatOptions): string {
  const s = unwrapLookupString(value);
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

function getSAName(record: AnyRecord): string {
  const v = record.getCellValue(FIELD_IDS.SALES_ASSOCIATE);
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const f = v[0];
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object' && 'name' in f) return (f as { name: string }).name;
  }
  return '';
}

function getLastApptTimestamp(record: AnyRecord): number {
  const s = unwrapLookupString(record.getCellValue(FIELD_IDS.LAST_APPOINTMENT));
  if (!s) return 0;
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function getAppointmentCount(record: AnyRecord): number {
  const v = record.getCellValue(FIELD_IDS.APPOINTMENT_COUNT);
  return typeof v === 'number' ? v : 0;
}

// ─── SearchInput ──────────────────────────────────────────────────────────────
function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        placeholder="Search client..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-8 pr-7 py-1.5 w-64 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <XIcon size={13} />
        </button>
      )}
    </div>
  );
}

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────
function MultiSelectDropdown({
  label, options, selected, onChange, isOpen, setIsOpen,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (v: Set<string>) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setIsOpen]);

  const displayText = selected.size === 0 ? label : `${label}: ${selected.size}`;

  return (
    <div ref={containerRef} className="flex items-center gap-1.5">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          <span className="text-gray-700">{displayText}</span>
          <CaretDownIcon size={13} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div
              className="max-h-60 overflow-y-auto py-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    const next = new Set(selected);
                    next.has(opt) ? next.delete(opt) : next.add(opt);
                    onChange(next);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                    selected.has(opt) ? 'bg-amber-50 text-amber-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── SortButton ───────────────────────────────────────────────────────────────
function SortButton({
  label, colKey, sortState, onClick,
}: {
  label: string;
  colKey: string;
  sortState: Record<string, 'asc' | 'desc' | 'none'>;
  onClick: () => void;
}) {
  const dir = sortState[colKey];
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-800">
      {label}
      {dir === 'desc' && <CaretDownIcon size={11} />}
      {dir === 'asc' && <CaretUpIcon size={11} />}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function DidNotConvertApp(): React.ReactElement {
  const base = useBase();

  const clientsTable = base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c');
  const stylesTable  = base.getTableByIdIfExists('tbl0hWIRBbcB4UkVC');

  // Hooks must be called unconditionally
  const allClientRecords = useRecords(clientsTable ?? null) as AnyRecord[] | null;
  const styleRecords     = useRecords(stylesTable ?? null) as AnyRecord[] | null;

  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedSAs, setSelectedSAs]       = useState(new Set<string>());
  const [saOpen, setSaOpen]                 = useState(false);
  const [sortState, setSortState]           = useState<Record<string, 'asc' | 'desc' | 'none'>>({
    clientName: 'none',
    salesAssociate: 'none',
    favoriteStyles: 'none',
    lastAppointmentDate: 'none',
    appointmentCount: 'none',
    weddingDate: 'none',
    notes: 'none',
  });

  // Guard — rendered after hooks
  if (!clientsTable || !stylesTable) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-red-500">Required tables not found. Check table IDs.</p>
      </div>
    );
  }

  // Style name map
  const styleNameMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!styleRecords) return m;
    for (const r of styleRecords) {
      const n = r.getCellValue(FIELD_IDS.STYLE_NAME);
      if (typeof n === 'string') m.set(r.id, n);
    }
    return m;
  }, [styleRecords]);

  // DNC records only
  const dncRecords = useMemo((): AnyRecord[] => {
    if (!allClientRecords) return [];
    return allClientRecords.filter(r => {
      const s = r.getCellValue(FIELD_IDS.STAGE);
      const name = s && typeof s === 'object' && 'name' in s ? (s as { name: string }).name : '';
      return name === 'Did Not Convert';
    });
  }, [allClientRecords]);

  // SA filter options
  const saOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of dncRecords) {
      const v = getSAName(r);
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  }, [dncRecords]);

  // Linked style names helper
  const getStyleNames = (record: AnyRecord): string[] => {
    const v = record.getCellValue(FIELD_IDS.FAVORITE_STYLES_FROM_ACUITY);
    if (!v || !Array.isArray(v)) return [];
    return v
      .map(l => l && typeof l === 'object' && 'id' in l ? styleNameMap.get((l as { id: string }).id) ?? '' : '')
      .filter(Boolean);
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return dncRecords.filter(r => {
      const name = r.getCellValueAsString(FIELD_IDS.FULL_NAME).toLowerCase();
      const sa   = getSAName(r);
      const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase());
      const matchSA     = selectedSAs.size === 0 || selectedSAs.has(sa);
      return matchSearch && matchSA;
    });
  }, [dncRecords, searchQuery, selectedSAs]);

  // Sorted records
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    const key = Object.keys(sortState).find(k => sortState[k] !== 'none');
    if (!key) return sorted;
    const dir = sortState[key];
    sorted.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (key) {
        case 'clientName':
          av = a.getCellValueAsString(FIELD_IDS.FULL_NAME).toLowerCase();
          bv = b.getCellValueAsString(FIELD_IDS.FULL_NAME).toLowerCase();
          break;
        case 'salesAssociate':
          av = getSAName(a).toLowerCase();
          bv = getSAName(b).toLowerCase();
          break;
        case 'lastAppointmentDate':
          av = getLastApptTimestamp(a);
          bv = getLastApptTimestamp(b);
          break;
        case 'appointmentCount':
          av = getAppointmentCount(a);
          bv = getAppointmentCount(b);
          break;
        case 'weddingDate':
          av = formatDate(a.getCellValue(FIELD_IDS.WEDDING_DATE_FORMATTED), { month: 'short', year: 'numeric' });
          bv = formatDate(b.getCellValue(FIELD_IDS.WEDDING_DATE_FORMATTED), { month: 'short', year: 'numeric' });
          break;
        case 'notes':
          av = a.getCellValueAsString(FIELD_IDS.PERSONAL_STYLE_NOTES).toLowerCase();
          bv = b.getCellValueAsString(FIELD_IDS.PERSONAL_STYLE_NOTES).toLowerCase();
          break;
        case 'favoriteStyles':
          av = getStyleNames(a).join(',').toLowerCase();
          bv = getStyleNames(b).join(',').toLowerCase();
          break;
      }
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return dir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [filteredRecords, sortState]);

  function cycleSort(col: string) {
    setSortState(prev => {
      const cur = prev[col];
      const next = cur === 'none' ? 'desc' : cur === 'desc' ? 'asc' : 'none';
      const reset = Object.fromEntries(Object.keys(prev).map(k => [k, 'none' as const]));
      return { ...reset, [col]: next };
    });
  }

  const columns: [string, string | null][] = [
    ['Client name',            'clientName'],
    ['Sales associate',        'salesAssociate'],
    ['Favorite styles',        'favoriteStyles'],
    ['Last appointment date',  'lastAppointmentDate'],
    ['Appointment count',      'appointmentCount'],
    ['Wedding date',           'weddingDate'],
    ['Notes',                  'notes'],
  ];

  const colWidths = ['16%', '16%', '20%', '14%', '10%', '12%', '12%'];

  return (
    <div className="font-sans antialiased flex flex-col" style={{ backgroundColor: '#F8F5EE', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-3 flex items-center gap-4 flex-wrap">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
        <MultiSelectDropdown
          label="Sales associate"
          options={saOptions}
          selected={selectedSAs}
          onChange={setSelectedSAs}
          isOpen={saOpen}
          setIsOpen={setSaOpen}
        />
      </div>

      {/* Table container */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="bg-white border border-[#E9E0CE] rounded-xl h-full flex flex-col overflow-hidden">

          {/* Sticky header */}
          <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
            <table className="w-full table-fixed">
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr>
                  {columns.map(([label, key]) => (
                    <th key={label} className="px-4 py-2.5 text-left">
                      {key
                        ? <SortButton label={label} colKey={key} sortState={sortState} onClick={() => cycleSort(key)} />
                        : <span className="text-xs font-semibold text-gray-600">{label}</span>
                      }
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
            {sortedRecords.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-gray-400">No clients match the current filters.</p>
              </div>
            ) : (
              <table className="w-full table-fixed">
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <tbody>
                  {sortedRecords.map(record => {
                    const fullName       = record.getCellValueAsString(FIELD_IDS.FULL_NAME) || '—';
                    const saName         = getSAName(record) || '—';
                    const styleNames     = getStyleNames(record);
                    const lastAppt       = formatDate(record.getCellValue(FIELD_IDS.LAST_APPOINTMENT), { month: 'short', day: 'numeric', year: 'numeric' });
                    const appointmentCount = getAppointmentCount(record);
                    const weddingDate    = formatDate(record.getCellValue(FIELD_IDS.WEDDING_DATE_FORMATTED), { month: 'short', year: 'numeric' });
                    const notes          = record.getCellValueAsString(FIELD_IDS.PERSONAL_STYLE_NOTES);

                    return (
                      <tr
                        key={record.id}
                        className="border-b border-gray-100 hover:bg-amber-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{fullName}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{saName}</td>
                        <td className="px-4 py-2.5">
                          {styleNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {styleNames.map((name, i) => (
                                <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{lastAppt}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{appointmentCount}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{weddingDate}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700 truncate">{notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

initializeBlock({ interface: () => <DidNotConvertApp /> });
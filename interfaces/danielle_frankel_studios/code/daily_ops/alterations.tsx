import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table, Record as AirtableRecord, Field } from '@airtable/blocks/interface/models';
import {
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CaretDown as CaretDownIcon,
  CalendarBlank as CalendarBlankIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  X as XIcon,
  WarningCircle as WarningCircleIcon,
  Info as InfoIcon,
} from '@phosphor-icons/react';

// ─── Dark mode ────────────────────────────────────────────────────────────────
function useTheme(): 'light' | 'dark' {
  // Reads Airtable's own light/dark preference, not the OS/browser setting.
  const { colorScheme } = useColorScheme();
  useEffect(() => {
    const root = document.documentElement;
    if (colorScheme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  }, [colorScheme]);
  return colorScheme;
}

// ─── Constants — DF Clients (tblLLUlDgJ4ktzF7c) ───────────────────────────────
const FIELD_IDS = {
  CLIENT_FULL_NAME:                 'fldB3Wyam01D3wR5Q',
  CLIENT_STAGE:                     'fldLcxVZvI1rigBlh',  // singleSelect — used only to filter to "In Alterations"
  CLIENT_ITEMS_SOLD:                'fldEStULoGtNIjxPO',  // Item Sold — shown unfiltered, every purchased item
  CLIENT_ALTERATIONS_LEAD:          'fldWxPkO98xA8OF8y',  // most_recent_alterations_lead — lookup of linked record names
  CLIENT_FIRST_ALTERATIONS_APPT:    'fldRS6ctrPGlEPqlR',  // first_alterations_appointment — lookup, dateTime
  CLIENT_NEXT_ALTERATIONS_APPT:     'fldGiXSJ9p6dGFhLY',  // next_alterations_appointment — lookup, dateTime
  CLIENT_WEDDING_DATE:              'fldbgknumKGS5W5WU',  // Wedding Date (Formatted)
} as const;

// Duplicated from pipeline.tsx — every interface file here is a fully
// self-contained bundle (no cross-file imports), so shared constants like
// this one are copied per-file rather than imported from a shared module.
const STAGE_ORDER = [
  'Pre-Appointment',
  'Deliberating',
  'Sold',
  'Order Ready',
  'In Alterations',
  'In Fulfillment',
] as const;

const ALTERATIONS_STAGE: (typeof STAGE_ORDER)[number] = 'In Alterations';

// ─── Status pill — semantic red/green pair (BRANDING.md §1/§9), not the
// champagne accent, since "Unpaid" is a needs-attention state and "Paid" is
// a satisfied one. ──────────────────────────────────────────────────────────
function StatusPill({ label, tone }: { label: string; tone: 'green' | 'red' }): React.ReactElement {
  const cls = tone === 'green'
    ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30'
    : 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/30';
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

// ─── Missing-data pill (matches appointments.tsx's MissingDataPill) ───────────
function MissingDatePill(): React.ReactElement {
  return (
    <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium border bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/30 whitespace-nowrap">
      Missing Date
    </span>
  );
}

// ─── Date helpers ──────────────────────────────────────────────────────────────
// Reads the raw cell value (ISO 8601 for date/dateTime lookups) instead of
// getCellValueAsString, which renders using the field's configured display
// format and can silently swap day/month for ambiguous dates depending on
// the viewer's locale — same rationale as this file's prior version.
function extractFirstLookupDate(record: AirtableRecord, field: Field | null | undefined): string | null {
  if (!field) return null;
  try {
    const raw = record.getCellValue(field);
    if (Array.isArray(raw)) {
      if (raw.length === 0) return null;
      const first = raw[0];
      if (first === null || first === undefined) return null;
      if (typeof first === 'string') return first;
      if (first instanceof Date) return first.toISOString();
      if (typeof first === 'object') {
        const obj = first as Record<string, unknown>;
        if (typeof obj.value === 'string') return obj.value;
      }
      return null;
    }
    if (typeof raw === 'string') return raw;
    if (raw instanceof Date) return raw.toISOString();
    return null;
  } catch { return null; }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return (
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  );
}
function getLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayLocalString(): string {
  return getLocalDateString(new Date());
}

// "Paid" = client purchased Alterations (found in Item Sold); "Unpaid" =
// they need to pay before their alterations appointment.
function isPaidForAlterations(itemsStr: string): boolean {
  return itemsStr.toLowerCase().includes('alterations');
}

// ─── Calendar utilities ────────────────────────────────────────────────────────
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_EN = ['MO','TU','WE','TH','FR','SA','SU'];
function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-start
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── CalendarPopup ──────────────────────────────────────────────────────────────
interface CalendarPopupProps { selected: Date | null; onSelect: (d: Date | null) => void; onClose: () => void; }
function CalendarPopup({ selected, onSelect, onClose }: CalendarPopupProps) {
  const [viewDate, setViewDate] = useState(selected ?? new Date());
  const today = new Date();
  const days = getCalendarDays(viewDate.getFullYear(), viewDate.getMonth());
  return (
    <div className="absolute z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-xl p-3 w-[272px]">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="p-1 rounded-md border border-gray-200 dark:border-[#34312C] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5">
          <CaretLeftIcon size={14} />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{MONTHS_EN[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
        <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="p-1 rounded-md border border-gray-200 dark:border-[#34312C] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5">
          <CaretRightIcon size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_EN.map(d => <div key={d} className="text-center text-[11px] font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === viewDate.getMonth();
          const isSelected = selected ? isSameDay(d, selected) : false;
          const isToday = isSameDay(d, today);
          return (
            <button key={i} type="button" onClick={() => { onSelect(d); onClose(); }}
              className={`mx-auto w-7 h-7 rounded-full text-xs flex items-center justify-center transition-colors ${
                isSelected ? 'bg-amber-600 dark:bg-amber-400 text-white dark:text-[#25211A] font-semibold'
                : isToday ? 'border border-amber-500 dark:border-amber-400 text-amber-600 dark:text-amber-400 font-medium'
                : inMonth ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                : 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-white/10">
        <button type="button" onClick={() => { onSelect(null); onClose(); }}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Clear</button>
        <button type="button" onClick={() => { onSelect(today); onClose(); }}
          className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 dark:hover:text-amber-300">Today</button>
      </div>
    </div>
  );
}

// ─── DatePicker ─────────────────────────────────────────────────────────────────
interface DatePickerProps { label: string; value: Date | null; onChange: (d: Date | null) => void; }
function DatePicker({ label, value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center justify-between gap-2 min-w-[150px] bg-white dark:bg-[#1e1d1b] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
          value ? 'border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300'
                : open ? 'border-amber-500 dark:border-amber-400 ring-1 ring-amber-500 dark:ring-amber-400 text-gray-400 dark:text-gray-500'
                : 'border-gray-300 dark:border-[#34312C] text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'}`}>
        <span className="truncate">{value ? formatDate(getLocalDateString(value)) : label}</span>
        {value ? (
          <XIcon size={14} className="text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 flex-shrink-0"
            onClick={e => { e.stopPropagation(); onChange(null); }} />
        ) : (
          <CalendarBlankIcon size={14} className="text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && <CalendarPopup selected={value} onSelect={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ─── SingleSelectDropdown (one option or cleared — label acts as its own
// placeholder when nothing is selected, matching BRANDING.md §5) ──────────────
interface ToggleOption { value: string; label: string; }
interface SingleSelectDropdownProps { label: string; value: string | null; options: ToggleOption[]; onChange: (v: string | null) => void; align?: 'left' | 'right'; }
function SingleSelectDropdown({ label, value, options, onChange, align = 'left' }: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const current = options.find(o => o.value === value) ?? null;
  const hasValue = !!current;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center justify-between gap-2 min-w-[150px] bg-white dark:bg-[#242220] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
          hasValue ? 'border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300'
                   : 'border-gray-300 dark:border-[#34312C] text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'}`}>
        <span className="truncate">{current ? current.label : label}</span>
        {hasValue ? (
          <XIcon size={14} className="text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 flex-shrink-0"
            onClick={e => { e.stopPropagation(); onChange(null); }} />
        ) : (
          <CaretDownIcon size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-lg w-[160px] py-1`}>
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                o.value === value ? 'bg-amber-600 dark:bg-amber-400 text-white dark:text-[#25211A] font-medium'
                                   : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pill ───────────────────────────────────────────────────────────────────────
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
      {children}
    </span>
  );
}
function renderPills(value: string): React.ReactElement {
  const parts = value.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => <Pill key={i}>{p}</Pill>)}
    </div>
  );
}

// ─── Custom Properties ──────────────────────────────────────────────────────────
function getCustomProperties(base: ReturnType<typeof useBase>) {
  return [
    {
      key: 'clientsTable', label: 'Clients', type: 'table' as const,
      defaultValue: base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c') ?? base.tables[0],
    },
  ];
}

// ─── AlterationsApp ─────────────────────────────────────────────────────────────
function AlterationsApp(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
  const clientsTable = (customPropertyValueByKey.clientsTable as Table | undefined) ?? null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedWeddingDate, setSelectedWeddingDate] = useState<Date | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'Paid' | 'Unpaid' | null>(null);
  const [showFilterInfo, setShowFilterInfo] = useState(false);

  const fields = useMemo(() => {
    if (!clientsTable) return {};
    return Object.fromEntries(
      Object.entries(FIELD_IDS).map(([, id]) => [id, clientsTable.getFieldIfExists(id)])
    );
  }, [clientsTable]);

  const allRecords = useRecords(clientsTable ?? null);

  // Records eligible for this page — an OR of three baseline signals (stage,
  // an alterations appointment, or Item Sold containing "Alterations"), plus
  // the hidden future-wedding-date filter and the Wedding Date picker, but
  // NOT the search selection itself. Both the search typeahead and the final
  // table read from this same set, so the search box can never suggest a
  // client the page's own filters would exclude from the list.
  const eligibleRecords = useMemo(() => {
    if (!allRecords) return [];
    const fStage = fields[FIELD_IDS.CLIENT_STAGE];
    const fWedding = fields[FIELD_IDS.CLIENT_WEDDING_DATE];
    const fItems = fields[FIELD_IDS.CLIENT_ITEMS_SOLD];
    const fFirstAppt = fields[FIELD_IDS.CLIENT_FIRST_ALTERATIONS_APPT];
    const fNextAppt = fields[FIELD_IDS.CLIENT_NEXT_ALTERATIONS_APPT];
    const today = getTodayLocalString();
    const selectedWeddingStr = selectedWeddingDate ? getLocalDateString(selectedWeddingDate) : null;

    return allRecords.filter(rec => {
      // Baseline scope — OR of three signals, any one qualifies a client:
      // In Alterations stage, a first/next alterations appointment on file,
      // or "Alterations" showing up in their Item Sold.
      const stage = fStage ? (rec.getCellValue(fStage) as { name: string } | null)?.name ?? null : null;
      const isInAlterationsStage = stage === ALTERATIONS_STAGE;
      const hasAlterationsAppt = !!extractFirstLookupDate(rec, fFirstAppt) || !!extractFirstLookupDate(rec, fNextAppt);
      const itemsStrForScope = fItems ? (rec.getCellValueAsString(fItems) ?? '') : '';
      const hasAlterationsItem = isPaidForAlterations(itemsStrForScope);
      if (!isInAlterationsStage && !hasAlterationsAppt && !hasAlterationsItem) return false;

      // Hidden filter — always applied, not user-facing: excludes clients
      // with a wedding date already in the past. Blank wedding dates are
      // NOT excluded — most In Alterations clients don't have this field
      // filled in yet, and hiding them would hide most of the stage. Those
      // rows show a "Missing Date" pill instead (see Wedding Date column).
      if (fWedding) {
        const wd = rec.getCellValue(fWedding) as string | null;
        if (wd && getLocalDateString(new Date(wd)) < today) return false;
      }

      if (selectedWeddingStr && fWedding) {
        const wd = rec.getCellValue(fWedding) as string | null;
        if (!wd || getLocalDateString(new Date(wd)) !== selectedWeddingStr) return false;
      }

      if (paymentStatusFilter && fItems) {
        const itemsStr = rec.getCellValueAsString(fItems) ?? '';
        const isPaid = isPaidForAlterations(itemsStr);
        if (paymentStatusFilter === 'Paid' && !isPaid) return false;
        if (paymentStatusFilter === 'Unpaid' && isPaid) return false;
      }

      return true;
    });
  }, [allRecords, fields, selectedWeddingDate, paymentStatusFilter]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
    if (!fName) return [];
    const q = searchQuery.trim().toLowerCase();
    return eligibleRecords
      .filter(r => (r.getCellValueAsString(fName) ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [eligibleRecords, searchQuery, fields]);

  const alterationsRecords = useMemo(() => {
    const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
    const fNextAppt = fields[FIELD_IDS.CLIENT_NEXT_ALTERATIONS_APPT];

    const recs = selectedClientId
      ? eligibleRecords.filter(rec => rec.id === selectedClientId)
      : eligibleRecords;

    return recs.slice().sort((a, b) => {
      const nextA = fNextAppt ? extractFirstLookupDate(a, fNextAppt) : null;
      const nextB = fNextAppt ? extractFirstLookupDate(b, fNextAppt) : null;
      if (nextA && !nextB) return -1;
      if (!nextA && nextB) return 1;
      if (nextA && nextB) {
        const diff = new Date(nextA).getTime() - new Date(nextB).getTime();
        if (diff !== 0) return diff;
      }
      const nameA = fName ? (a.getCellValueAsString(fName) ?? '') : '';
      const nameB = fName ? (b.getCellValueAsString(fName) ?? '') : '';
      return nameA.localeCompare(nameB);
    });
  }, [eligibleRecords, fields, selectedClientId]);

  if (errorState) return (
    <div className="h-screen flex items-center justify-center bg-[#F6F4F0] dark:bg-[#1A1917]">
      <div className="text-center p-8">
        <WarningCircleIcon size={40} className="text-red-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-red-600">Configuration Error</p>
        <p className="text-xs text-gray-500 mt-1">Check the properties panel.</p>
      </div>
    </div>
  );
  if (!clientsTable) return (
    <div className="h-screen flex items-center justify-center bg-[#F6F4F0] dark:bg-[#1A1917]">
      <div className="text-center p-8">
        <p className="text-base font-semibold text-gray-700">Configuration Required</p>
        <p className="text-sm text-gray-500 mt-1">Select the DF Clients table in the properties panel.</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden antialiased bg-[#F6F4F0] dark:bg-[#1A1917]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Filter Bar */}
      <div className="px-6 pt-5 pb-4 flex-shrink-0 flex items-center gap-2">
        <div className="relative flex-1 max-w-[360px]">
          <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedClientId(null); }}
            placeholder="Search by client name…"
            className="w-full pl-9 pr-7 py-1.5 text-sm bg-white dark:bg-[#242220] border border-gray-300 dark:border-[#34312C] rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-400 transition-colors" />
          {searchQuery && (
            <button type="button" onClick={() => { setSearchQuery(''); setSelectedClientId(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <XIcon size={13} />
            </button>
          )}
          {searchQuery.trim() && !selectedClientId && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-lg max-h-[240px] overflow-y-auto w-full py-1">
              {searchResults.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No matches</div>
              ) : searchResults.map(r => (
                <button key={r.id} type="button"
                  onClick={() => { setSelectedClientId(r.id); setSearchQuery(r.getCellValueAsString(fields[FIELD_IDS.CLIENT_FULL_NAME]!) ?? ''); }}
                  className="w-full text-left px-3 py-1.5 text-sm capitalize text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  {r.getCellValueAsString(fields[FIELD_IDS.CLIENT_FULL_NAME]!) || '—'}
                </button>
              ))}
            </div>
          )}
        </div>
        <DatePicker label="Wedding Date" value={selectedWeddingDate} onChange={setSelectedWeddingDate} />
        <SingleSelectDropdown
          label="Payment Status"
          value={paymentStatusFilter}
          onChange={v => setPaymentStatusFilter(v as 'Paid' | 'Unpaid' | null)}
          options={[
            { value: 'Paid', label: 'Paid' },
            { value: 'Unpaid', label: 'Unpaid' },
          ]}
        />
        <div className="ml-auto relative flex-shrink-0"
          onMouseEnter={() => setShowFilterInfo(true)}
          onMouseLeave={() => setShowFilterInfo(false)}>
          <span aria-label="Hidden filter info" className="inline-flex items-center text-gray-400 dark:text-gray-500 cursor-help">
            <InfoIcon size={16} />
          </span>
          {showFilterInfo && (
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 z-30 w-[260px] bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-xl p-3 text-xs text-gray-600 dark:text-gray-300">
              This list always shows clients who match at least one of: stage is "In Alterations," have an alterations appointment on file, or have "Alterations" in Item Sold. It always excludes clients whose wedding date is already in the past — regardless of the filters above.
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-6 pb-4 flex flex-col">
        <div className="bg-white dark:bg-[#242220] border border-[#E5E1DA] dark:border-[#34312C] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1e1d1b]">
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[160px]">Client</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[200px]">Item Sold</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[150px]">Alteration Lead</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[150px]">First Alts Appointment</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[150px]">Next Alts Appointment</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[120px]">Wedding Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[110px]">Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {alterationsRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No clients currently in alterations.</td>
                  </tr>
                ) : alterationsRecords.map(rec => {
                  const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
                  const fItems = fields[FIELD_IDS.CLIENT_ITEMS_SOLD];
                  const fLead = fields[FIELD_IDS.CLIENT_ALTERATIONS_LEAD];
                  const fFirstAppt = fields[FIELD_IDS.CLIENT_FIRST_ALTERATIONS_APPT];
                  const fNextAppt = fields[FIELD_IDS.CLIENT_NEXT_ALTERATIONS_APPT];
                  const fWedding = fields[FIELD_IDS.CLIENT_WEDDING_DATE];

                  const name = fName ? (rec.getCellValueAsString(fName) ?? '') : '';
                  const itemsStr = fItems ? (rec.getCellValueAsString(fItems) ?? '') : '';
                  const leadStr = fLead ? (rec.getCellValueAsString(fLead) ?? '') : '';
                  const firstApptStr = extractFirstLookupDate(rec, fFirstAppt);
                  const nextApptStr = extractFirstLookupDate(rec, fNextAppt);
                  const weddingStr = fWedding ? (rec.getCellValue(fWedding) as string | null) : null;
                  const isPaid = isPaidForAlterations(itemsStr);

                  return (
                    <tr key={rec.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5 text-sm font-medium capitalize text-gray-900 dark:text-[#F5F3EF]">{name || '—'}</td>
                      <td className="px-3 py-2.5">{renderPills(itemsStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{leadStr || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(firstApptStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(nextApptStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                        {weddingStr ? formatDate(weddingStr) : <MissingDatePill />}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill label={isPaid ? 'Paid' : 'Unpaid'} tone={isPaid ? 'green' : 'red'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

initializeBlock({ interface: () => <AlterationsApp /> });

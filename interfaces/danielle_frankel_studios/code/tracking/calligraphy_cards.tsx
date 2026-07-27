import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table } from '@airtable/blocks/interface/models';
import {
  CaretDown as CaretDownIcon,
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CalendarBlank as CalendarBlankIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  X as XIcon,
  Check as CheckIcon,
  WarningCircle as WarningCircleIcon,
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
  CLIENT_FULL_NAME:             'fldB3Wyam01D3wR5Q',
  CLIENT_DUE_DATE:              'fldnhs2n4z2EdZK9N',
  CLIENT_ITEMS_SOLD:            'fldEStULoGtNIjxPO',
  CLIENT_GOWN_NAME:             'fldJvr5mNgwmhfBlv',
  CLIENT_WEDDING_DATE:          'fldbgknumKGS5W5WU',
  CLIENT_CALLIGRAPHY_CARD_SENT: 'fldsBLLXkKPgqlN2e',
} as const;

// ─── Date helpers ──────────────────────────────────────────────────────────────
function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}
function getLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayLocalString(): string {
  return getLocalDateString(new Date());
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

// ─── SingleToggleDropdown (always exactly one of two options active) ──────────
interface ToggleOption { value: string; label: string; }
interface SingleToggleDropdownProps { value: string; options: ToggleOption[]; onChange: (v: string) => void; align?: 'left' | 'right'; }
function SingleToggleDropdown({ value, options, onChange, align = 'left' }: SingleToggleDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const current = options.find(o => o.value === value) ?? options[0];
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#242220] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300">
        <span className="truncate">{current.label}</span>
        <CaretDownIcon size={14} className={`text-amber-600 dark:text-amber-300 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-lg w-[200px] py-1`}>
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

// ─── Checkbox ───────────────────────────────────────────────────────────────────
interface CheckboxProps { checked: boolean; onChange: () => void; disabled?: boolean; hasError?: boolean; }
function Checkbox({ checked, onChange, disabled = false, hasError = false }: CheckboxProps) {
  return (
    <button type="button" disabled={disabled}
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
        hasError ? 'border-red-400 dark:border-red-500'
        : checked ? 'bg-amber-600 dark:bg-amber-400 border-amber-600 dark:border-amber-400'
                  : 'bg-white dark:bg-[#1e1d1b] border-gray-300 dark:border-[#34312C]'} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      {checked && <CheckIcon size={11} weight="bold" className="text-white dark:text-[#25211A]" />}
    </button>
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

// ─── CalligraphyCardsApp ────────────────────────────────────────────────────────
function CalligraphyCardsApp(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
  const clientsTable = (customPropertyValueByKey.clientsTable as Table | undefined) ?? null;

  const [calligraphyFilter, setCalligraphyFilter] = useState<'pending' | 'done'>('pending');
  const [weddingDateFilter, setWeddingDateFilter] = useState<'upcoming' | 'all'>('upcoming');
  const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [updateErrors, setUpdateErrors] = useState<Record<string, boolean>>({});

  const fields = useMemo(() => {
    if (!clientsTable) return {};
    return Object.fromEntries(
      Object.entries(FIELD_IDS).map(([, id]) => [id, clientsTable.getFieldIfExists(id)])
    );
  }, [clientsTable]);

  const allRecords = useRecords(clientsTable ?? null);
  const canWrite = clientsTable ? clientsTable.hasPermissionToUpdateRecords() : false;

  const handleToggleCalligraphyCard = useCallback(async (recordId: string, current: boolean) => {
    const field = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_SENT];
    if (!clientsTable || !field) return;
    setUpdateErrors(prev => ({ ...prev, [recordId]: false }));
    try {
      await clientsTable.updateRecordAsync(recordId, { [field.id]: !current });
    } catch (err) {
      console.error('Failed to update calligraphy_card_sent', err);
      setUpdateErrors(prev => ({ ...prev, [recordId]: true }));
    }
  }, [clientsTable, fields]);

  const searchResults = useMemo(() => {
    if (!allRecords || !searchQuery.trim()) return [];
    const fNameField = fields[FIELD_IDS.CLIENT_FULL_NAME];
    if (!fNameField) return [];
    const q = searchQuery.trim().toLowerCase();
    return allRecords
      .filter(r => (r.getCellValueAsString(fNameField) ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [allRecords, searchQuery, fields]);

  const filteredRecords = useMemo(() => {
    if (!allRecords) return [];
    const fSent = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_SENT];
    const fWedding = fields[FIELD_IDS.CLIENT_WEDDING_DATE];
    const fDue = fields[FIELD_IDS.CLIENT_DUE_DATE];
    const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
    const today = getTodayLocalString();
    const selectedDueStr = selectedDueDate ? getLocalDateString(selectedDueDate) : null;

    let recs = allRecords.filter(rec => {
      if (fSent) {
        const sent = !!rec.getCellValue(fSent);
        if (calligraphyFilter === 'pending' && sent) return false;
        if (calligraphyFilter === 'done' && !sent) return false;
      }
      if (fWedding) {
        const wd = rec.getCellValue(fWedding) as string | null;
        if (weddingDateFilter === 'upcoming') {
          if (!wd) return false;
          const wdLocal = getLocalDateString(new Date(wd));
          if (wdLocal < today) return false;
        }
      }
      if (selectedDueStr && fDue) {
        const due = rec.getCellValue(fDue) as string | null;
        if (!due || getLocalDateString(new Date(due)) !== selectedDueStr) return false;
      }
      if (selectedClientId && rec.id !== selectedClientId) return false;
      return true;
    });

    recs = recs.slice().sort((a, b) => {
      const wdA = fWedding ? (a.getCellValue(fWedding) as string | null) : null;
      const wdB = fWedding ? (b.getCellValue(fWedding) as string | null) : null;
      if (wdA && !wdB) return -1;
      if (!wdA && wdB) return 1;
      if (wdA && wdB) {
        const diff = new Date(wdA).getTime() - new Date(wdB).getTime();
        if (diff !== 0) return diff;
      }
      const nameA = fName ? (a.getCellValueAsString(fName) ?? '') : '';
      const nameB = fName ? (b.getCellValueAsString(fName) ?? '') : '';
      return nameA.localeCompare(nameB);
    });

    return recs;
  }, [allRecords, fields, calligraphyFilter, weddingDateFilter, selectedDueDate, selectedClientId]);

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
      {/* Header / Filter Bar */}
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
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  {r.getCellValueAsString(fields[FIELD_IDS.CLIENT_FULL_NAME]!) || '—'}
                </button>
              ))}
            </div>
          )}
        </div>
        <DatePicker label="Due Date" value={selectedDueDate} onChange={setSelectedDueDate} />
        <SingleToggleDropdown
          value={weddingDateFilter}
          onChange={v => setWeddingDateFilter(v as 'upcoming' | 'all')}
          options={[
            { value: 'upcoming', label: 'Upcoming Wedding Dates' },
            { value: 'all', label: 'All Wedding Dates' },
          ]}
        />
        <SingleToggleDropdown
          value={calligraphyFilter}
          onChange={v => setCalligraphyFilter(v as 'pending' | 'done')}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'done', label: 'Done' },
          ]}
          align="right"
        />
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-6 pb-4 flex flex-col">
        <div className="bg-white dark:bg-[#242220] border border-[#E5E1DA] dark:border-[#34312C] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1e1d1b]">
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="px-3 py-2.5 w-[36px]"></th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[160px]">Client</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[120px]">Due Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[180px]">Items Sold</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[160px]">Gown</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[120px]">Wedding Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No clients match the current filters.</td>
                  </tr>
                ) : filteredRecords.map(rec => {
                  const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
                  const fDue = fields[FIELD_IDS.CLIENT_DUE_DATE];
                  const fItems = fields[FIELD_IDS.CLIENT_ITEMS_SOLD];
                  const fGown = fields[FIELD_IDS.CLIENT_GOWN_NAME];
                  const fWedding = fields[FIELD_IDS.CLIENT_WEDDING_DATE];
                  const fSent = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_SENT];

                  const name = fName ? (rec.getCellValueAsString(fName) ?? '') : '';
                  const dueStr = fDue ? (rec.getCellValue(fDue) as string | null) : null;
                  const itemsStr = fItems ? (rec.getCellValueAsString(fItems) ?? '') : '';
                  const gownStr = fGown ? (rec.getCellValueAsString(fGown) ?? '') : '';
                  const weddingStr = fWedding ? (rec.getCellValue(fWedding) as string | null) : null;
                  const sent = fSent ? !!rec.getCellValue(fSent) : false;

                  return (
                    <tr key={rec.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={sent}
                          disabled={!canWrite}
                          hasError={!!updateErrors[rec.id]}
                          onChange={() => handleToggleCalligraphyCard(rec.id, sent)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-[#F5F3EF]">{name || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDate(dueStr)}</td>
                      <td className="px-3 py-2.5">{renderPills(itemsStr)}</td>
                      <td className="px-3 py-2.5">{renderPills(gownStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDate(weddingStr)}</td>
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

initializeBlock({ interface: () => <CalligraphyCardsApp /> });

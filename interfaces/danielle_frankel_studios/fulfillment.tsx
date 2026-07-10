import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  CellRenderer,
} from '@airtable/blocks/interface/ui';
import type { Field, Table, Record as AirtableRecord } from '@airtable/blocks/interface/models';
import {
  CaretDown as CaretDownIcon,
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CalendarBlank as CalendarBlankIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  MapPin as MapPinIcon,
  Package as PackageIcon,
  Truck as TruckIcon,
  X as XIcon,
  CheckCircle as CheckCircleIcon,
  WarningCircle as WarningCircleIcon,
  ArrowLeft as ArrowLeftIcon,
  Plus as PlusIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@phosphor-icons/react';

// ─── Dark mode ────────────────────────────────────────────────────────────────
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
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  }, [theme]);
  return theme;
}

// ─── Constants — DF Clients ───────────────────────────────────────────────────
const FIELD_IDS = {
  FULL_NAME:            'fldB3Wyam01D3wR5Q',
  PHONE:                'fldZrxF4bR6QBUwVK',
  EMAIL:                'fld5f3IVZoX0QZZ8R',
  STAGE:                'fldLcxVZvI1rigBlh',
  SALES_ASSOCIATE_NAME: 'fldH8lJJHPUjPnyHZ',
  FULFILLMENT_METHOD:   'fldjwCFnGqOToCRnN',
  FULFILLMENT_NOTES:    'fld4dnGW0td7H1dRX',
  PICKED:               'fldh9IWe29cCm2WKg',
  WAREHOUSE:            'fldDwLPMhkptv8SSK',
  STUDIO_NAME:          'fldIenJoxseeHmfIv', // rollup studio name
  ACUITY_ADDRESS:       'fldkpfulLIk0jq34d',
  SHOPIFY_ADDRESS:      'fldxFbYURZvlZ0tA1',
  OTHER_ADDRESS:        'fld5uRLRmAXqAH0nu',
  CLIENT_NOTIFIED:      'fldxumxeRnrDQ3CIk',
  NOTIFIED_DATE:        'fldpKBaezlXf8XLWv',
  ADDRESS_CONFIRMED:    'fldksvLd6ZQabAoY1',
  TRACKING_NUMERAL:     'fldY0SvbuYeHUZa15',
  THREE_PL:             'fldSxZrcIbBlyJO6R',
  HOLD_SHIPMENT_DATE:   'fldVsDeVp6R6ytqlb',
  WEDDING_DATE:         'fldbgknumKGS5W5WU',
  ITEMS_SOLD:           'fldEStULoGtNIjxPO',
  SHOPIFY_ORDERS:       'fldWSGqQW9czYdams',
  PICKED_ROLLUP:        'fldkF1OvClIjPj9o7', // rollup avg picked % across orders
  DELIVERY_STATUS:      'fldElapbI1R2uyF5p', // rollup delivery status from orders
} as const;

// ─── Constants — Orders_Shopify ───────────────────────────────────────────────
const ORDER_TABLE_ID = 'tblHFGbijtvZcRPkE';
const ORDER_FIELD_IDS = {
  SHOPIFY_ORDER_NUMBER: 'fldWiKEXjId411DQc',
  AM_ORDER_NUMBER:      'fldBvuNZDqzOx6azb',
  PAYMENT_STATUS:       'fldFI488S8GPaVgCt',
  DELIVERY_STATUS:      'fldoL5pdUvlz76mkZ',
  DELIVERY_METHOD:      'fldFATO0oJUQjPEzr',
  SUBTOTAL:             'fld9CtuMBLprH0SA1',
  SHIPPING:             'fldkorfpXkwh0TWfs',
  TAXES:                'fld2chJ0ME8MA3OWq',
  TOTAL:                'fldkIMTeKdneKABS4',
  TRACKING_NUMBER:      'fldCfwwMFNkVKJApj',
  CARRIER:              'fld3JafhFWzW6Knuw',
  CLIENT_NOTIFIED:      'fldve9YvP16XtrHN2',
  PICKED_STATUS:        'fldqhI6Aq9zIhFsFW',
  STORE:                'fldGW9ECCrIEZnNQ5',
  ORDER_ADJUSTMENTS:    'fldI1GmVHGcZcEJab',
  ADJUSTED_TOTAL:       'fldK8iVktZl5Vg24Q',
} as const;

// ─── Constants — order_adjustments ───────────────────────────────────────────
const ADJ_TABLE_ID = 'tbly4tfEDJdB6kYkg';
const ADJ_FIELD_IDS = {
  ORDER_ID:      'fldd3QKQPMmr4v1gF',
  CHANGE_TYPE:   'fldz0a13Pm8gwawI4',
  DIRECTION:     'fldIQTMAPV5R8qUCq',
  AMOUNT:        'fldktWDl4IbZx9mdn',
  NOTES:         'fldJ9wZ9WAcTABgRT',
  ORDER:         'fld263uqHkqln4QsB',
  SIGNED_AMOUNT: 'fldddI1MumdkDZMSV',
} as const;

const CHANGE_TYPE_OPTIONS = [
  'Shipping Add', 'Shipping Remove', 'Additional Purchase',
  'Tax Adjustment', 'Alterations', 'M2M Fee', 'Rush Fee', 'Other',
];
const DIRECTION_OPTIONS = ['Charge', 'Credit', 'Unknown'];

// ─── Reference tables ─────────────────────────────────────────────────────────
const STUDIOS_TABLE_ID = 'tblYM02GzeYdYk23v';
const STUDIOS_FIELD_IDS = { NAME: 'fldA1F8Hx7cOyI6lu', IS_ACTIVE: 'fldFyn3fKsxajrvsy' } as const;

// ─── US States ────────────────────────────────────────────────────────────────
const US_STATES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
  MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  DC:'District of Columbia',
};
const STATE_NAME_PAIRS: Array<[string, string]> = Object.entries(US_STATES)
  .map(([code, name]) => [name.toUpperCase(), code] as [string, string])
  .sort((a, b) => b[0].length - a[0].length);

function extractStateFromAddress(address: string | null): string | null {
  if (!address) return null;
  const abbrs = new Set(Object.keys(US_STATES));
  const upper = address.toUpperCase();
  const zipMatch = upper.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (zipMatch?.[1] && abbrs.has(zipMatch[1])) return zipMatch[1];
  const commaMatch = upper.match(/,\s*([A-Z]{2})(?:\s+\d{5}|\s*,|\s*$)/);
  if (commaMatch?.[1] && abbrs.has(commaMatch[1])) return commaMatch[1];
  const cleaned = upper.replace(/,?\s*UNITED STATES( OF AMERICA)?$/i, '').trim();
  for (const [stateName, code] of STATE_NAME_PAIRS) {
    if (new RegExp(`\\b${stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(cleaned)) return code;
  }
  return null;
}

function formatDate(val: string | null): string {
  if (!val) return '—';
  try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(val)); }
  catch { return '—'; }
}
function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

// ─── Calendar utilities ───────────────────────────────────────────────────────
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_EN   = ['MO','TU','WE','TH','FR','SA','SU'];

function getCalendarDays(year: number, month: number): Array<{ date: Date; currentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const lastDay  = new Date(year, month + 1, 0);
  const cells: Array<{ date: Date; currentMonth: boolean }> = [];
  for (let i = startDow - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), currentMonth: false });
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push({ date: new Date(year, month, d), currentMonth: true });
  let next = 1;
  while (cells.length < 42) cells.push({ date: new Date(year, month + 1, next++), currentMonth: false });
  return cells;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── CalendarPopup ────────────────────────────────────────────────────────────
function CalendarPopup({ selectedDate, onSelect, onClose, align = 'left', openUp = false }: {
  selectedDate: Date | null; onSelect: (d: Date | null) => void; onClose: () => void;
  align?: 'left' | 'right'; openUp?: boolean;
}) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(selectedDate ? selectedDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate ? selectedDate.getMonth()    : today.getMonth());
  const cells = getCalendarDays(viewYear, viewMonth);
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };
  return (
    <div className={`absolute z-[100] bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-xl p-3 w-[272px] ${align === 'right' ? 'right-0' : 'left-0'} ${openUp ? 'bottom-full mb-1' : 'mt-1'}`}
      style={{ top: openUp ? undefined : '100%', bottom: openUp ? '100%' : undefined }}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"><CaretLeftIcon size={13} /></button>
        <span className="text-sm font-semibold text-gray-900 dark:text-[#F5F3EF]">{MONTHS_EN[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"><CaretRightIcon size={13} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">{DAYS_EN.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, currentMonth }, i) => {
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isToday    = isSameDay(date, today);
          return (
            <button key={i} type="button" onClick={() => { onSelect(date); onClose(); }}
              className={['h-8 w-full flex items-center justify-center rounded-full text-xs transition-colors',
                isSelected ? 'bg-blue-600 text-white font-semibold' :
                isToday ? 'border border-blue-400 text-blue-600 dark:text-blue-400 font-medium' :
                currentMonth ? 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10' :
                'text-gray-300 dark:text-gray-600'].join(' ')}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-white/5">
        <button type="button" onClick={() => { onSelect(null); onClose(); }} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline underline-offset-2 transition-colors">Clear</button>
        <button type="button" onClick={() => { onSelect(new Date()); onClose(); }} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors">Today</button>
      </div>
    </div>
  );
}

// ─── DatePicker ───────────────────────────────────────────────────────────────
function DatePicker({ value, onChange, placeholder = 'Select date…', className = '', align = 'left', openUp = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  className?: string; align?: 'left' | 'right'; openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selectedDate = value ? new Date(value + 'T12:00:00') : null;
  const displayText  = selectedDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(selectedDate) : '';
  const handleSelect = (d: Date | null) => {
    if (d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); onChange(`${y}-${m}-${dd}`); }
    else onChange('');
  };
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={['w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors outline-none',
          'bg-white dark:bg-[#1e1d1b] border-gray-200 dark:border-white/10',
          'hover:border-gray-300 dark:hover:border-white/20',
          open ? 'border-blue-400 ring-1 ring-blue-400' : ''].join(' ')}>
        <span className={displayText ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>{displayText || placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && <span role="button" onClick={e => { e.stopPropagation(); onChange(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5 rounded"><XIcon size={12} /></span>}
          <CalendarBlankIcon size={13} className="text-gray-400" />
        </div>
      </button>
      {open && <CalendarPopup selectedDate={selectedDate} onSelect={handleSelect} onClose={() => setOpen(false)} align={align} openUp={openUp} />}
    </div>
  );
}

// ─── Write queue ──────────────────────────────────────────────────────────────
let _writeQueue = Promise.resolve();
function queueWrite(fn: () => Promise<void>) {
  const next = _writeQueue.then(fn);
  _writeQueue = next.then(() => {}, () => {});
  return next;
}

// ─── Custom properties ────────────────────────────────────────────────────────
function getCustomProperties(base: ReturnType<typeof useBase>) {
  return [{
    key: 'clientsTable',
    label: 'DF Clients Table',
    type: 'table' as const,
    defaultValue: base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c') ?? base.tables[0],
  }];
}

// ─── FilterDropdown ───────────────────────────────────────────────────────────
interface FilterDropdownProps { label: string; values: string[]; options: string[]; onChange: (v: string[]) => void; align?: 'left' | 'right'; }
function FilterDropdown({ label, values, options, onChange, align = 'left' }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const display = values.length === 0 ? 'All' : values.length === 1 ? (values[0] ?? 'All') : `${values.length} selected`;
  const toggle = (o: string) => onChange(values.includes(o) ? values.filter(v => v !== o) : [...values, o]);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-medium whitespace-nowrap dark:text-gray-400">{label}</span>
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#242220] border border-gray-300 dark:border-[#34312C] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 outline-none transition-colors">
          <span className="truncate">{display}</span>
          <CaretDownIcon size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 z-50 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-lg max-h-[260px] overflow-y-auto w-[240px] py-1`}>
            <button type="button" onClick={() => { onChange([]); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${values.length === 0 ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'}`}>All</button>
            {options.map(o => (
              <button key={o} type="button" onClick={() => toggle(o)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${values.includes(o) ? 'bg-blue-600 text-white font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'}`}>{o}</button>
            ))}
          </div>
        )}
      </div>
      {values.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:underline underline-offset-2 transition-colors">Clear</button>}
    </div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────
function ProgressBar({ percentage }: { percentage: number }) {
  const pct = Math.round(percentage * 100);
  const barColor = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
type PillVariant = 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'orange';
function Pill({ children, variant }: { children: React.ReactNode; variant: PillVariant }) {
  const cls: Record<PillVariant, string> = {
    green:  'bg-green-50  dark:bg-green-500/15  text-green-700  dark:text-green-300  border-green-200  dark:border-green-500/30',
    red:    'bg-red-50    dark:bg-red-500/15    text-red-600    dark:text-red-300    border-red-200    dark:border-red-500/30',
    yellow: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30',
    blue:   'bg-blue-50   dark:bg-blue-500/15   text-blue-700   dark:text-blue-300   border-blue-200   dark:border-blue-500/30',
    purple: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
    gray:   'bg-gray-100  dark:bg-white/10      text-gray-600   dark:text-gray-300   border-transparent',
    orange: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
  };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls[variant]}`}>{children}</span>;
}

// ─── ToggleButton ─────────────────────────────────────────────────────────────
function ToggleButton({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
        checked ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/40 shadow-sm'
                : 'bg-white dark:bg-[#1e1d1b] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 shadow-sm hover:border-gray-300 dark:hover:border-white/20'}`}>
      {checked && <CheckCircleIcon size={13} />}{label}
    </button>
  );
}

// ─── SingleSelectDropdown ─────────────────────────────────────────────────────
function SingleSelectDropdown({ value, options, onChange, placeholder = '—' }: {
  value: string; options: string[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full inline-flex items-center justify-between gap-2 bg-white dark:bg-[#1e1d1b] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 hover:border-gray-300 dark:hover:border-white/20 transition-colors">
        <span className={value ? '' : 'text-gray-400 dark:text-gray-500'}>{value || placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && <span role="button" onClick={e => { e.stopPropagation(); onChange(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5 rounded"><XIcon size={12} /></span>}
          <CaretDownIcon size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-lg w-full max-h-[220px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1">
          {options.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${o === value ? 'bg-blue-600 text-white font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'}`}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MiniTable ────────────────────────────────────────────────────────────────
function MiniTable({ headers, rows, onRowClick }: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  onRowClick?: (i: number) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">None</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(i)}
              className={`border-b border-gray-100 dark:border-white/5 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors' : ''}`}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── AddAdjustmentModal ───────────────────────────────────────────────────────
function AddAdjustmentModal({ adjTable, orderRecord, onClose, onSaved }: {
  adjTable: Table; orderRecord: AirtableRecord; onClose: () => void;
  onSaved: (newRecord: { changeType: string; direction: string; amount: number; notes: string; signedAmount: number }) => void;
}) {
  const [changeType, setChangeType] = useState('');
  const [direction,  setDirection]  = useState('');
  const [amount,     setAmount]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const showDirection = changeType === 'Tax Adjustment' || changeType === 'Other';

  const computeSigned = (ct: string, dir: string, amt: number): number => {
    if (['Shipping Add', 'Additional Purchase', 'Alterations', 'M2M Fee', 'Rush Fee'].includes(ct)) return amt;
    if (ct === 'Shipping Remove') return -amt;
    if (ct === 'Tax Adjustment' || ct === 'Other') return dir === 'Credit' ? -amt : amt;
    return amt;
  };

  const handleSave = async () => {
    if (!changeType || !amount) { setError('Change Type and Amount are required.'); return; }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) { setError('Amount must be a positive number.'); return; }
    setSaving(true); setError('');
    try {
      const orderField = adjTable.getFieldIfExists(ADJ_FIELD_IDS.ORDER);
      const ctField    = adjTable.getFieldIfExists(ADJ_FIELD_IDS.CHANGE_TYPE);
      const dirField   = adjTable.getFieldIfExists(ADJ_FIELD_IDS.DIRECTION);
      const amtField   = adjTable.getFieldIfExists(ADJ_FIELD_IDS.AMOUNT);
      const notesField = adjTable.getFieldIfExists(ADJ_FIELD_IDS.NOTES);
      if (!orderField || !ctField || !amtField) { setError('Required fields missing in schema.'); return; }
      const fields: Record<string, unknown> = {
        [orderField.id]: [{ id: orderRecord.id }],
        [ctField.id]:    { name: changeType },
        [amtField.id]:   amtNum,
      };
      if (dirField && direction) fields[dirField.id] = { name: direction };
      if (notesField && notes)   fields[notesField.id] = notes;
      await adjTable.createRecordAsync(fields);
      onSaved({ changeType, direction, amount: amtNum, notes, signedAmount: computeSigned(changeType, direction, amtNum) });
      onClose();
    } catch (e) { console.error(e); setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const lbl = 'text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium block mb-1.5';
  const inp = 'w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors';

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[480px] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Order Adjustment</p>
            <p className="text-base font-semibold text-gray-900 dark:text-[#F5F3EF]">New Adjustment</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <XIcon size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={lbl}>Change Type <span className="text-red-400">*</span></span>
              <SingleSelectDropdown value={changeType} options={CHANGE_TYPE_OPTIONS} placeholder="Select type…" onChange={v => { setChangeType(v); setDirection(''); }} />
            </div>
            {showDirection && (
              <div>
                <span className={lbl}>Direction <span className="text-red-400">*</span></span>
                <SingleSelectDropdown value={direction} options={DIRECTION_OPTIONS} placeholder="Charge / Credit" onChange={setDirection} />
              </div>
            )}
          </div>
          <div>
            <span className={lbl}>Amount <span className="text-red-400">*</span></span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
              <input type="number" min={0} step="0.01" className={`${inp} pl-7`}
                value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <span className={lbl}>Notes</span>
            <input type="text" className={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context…" />
          </div>
          {changeType && amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Signed amount</span>
              <span className={`text-sm font-semibold ${computeSigned(changeType, direction, parseFloat(amount)) < 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {computeSigned(changeType, direction, parseFloat(amount)) >= 0 ? '+' : ''}{formatCurrency(computeSigned(changeType, direction, parseFloat(amount)))}
              </span>
            </div>
          )}
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex items-center gap-3">
          <button type="button" onClick={handleSave} disabled={saving || !changeType || !amount}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Saving…' : 'Save Adjustment'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AdjustmentDetailModal ────────────────────────────────────────────────────
function AdjustmentDetailModal({ record, adjTable, onClose }: {
  record: AirtableRecord; adjTable: Table; onClose: () => void;
}) {
  const getStr = (fid: string): string => { try { return record.getCellValueAsString(adjTable.getFieldIfExists(fid)!) ?? ''; } catch { return ''; } };
  const getNum = (fid: string): number | null => { try { const f = adjTable.getFieldIfExists(fid); if (!f) return null; return record.getCellValue(f) as number | null; } catch { return null; } };
  const getSel = (fid: string): string => { try { const f = adjTable.getFieldIfExists(fid); if (!f) return ''; const v = record.getCellValue(f) as { name: string } | null; return v?.name ?? ''; } catch { return ''; } };

  const [changeType, setChangeType] = useState(() => getSel(ADJ_FIELD_IDS.CHANGE_TYPE));
  const [direction,  setDirection]  = useState(() => getSel(ADJ_FIELD_IDS.DIRECTION));
  const [amount,     setAmount]     = useState(() => { const v = getNum(ADJ_FIELD_IDS.AMOUNT); return v !== null ? String(v) : ''; });
  const [notes,      setNotes]      = useState(() => getStr(ADJ_FIELD_IDS.NOTES));
  const orderId      = getStr(ADJ_FIELD_IDS.ORDER_ID);
  const signedAmount = getNum(ADJ_FIELD_IDS.SIGNED_AMOUNT);

  const save = useCallback((fid: string, value: unknown) => {
    const f = adjTable.getFieldIfExists(fid); if (!f) return;
    queueWrite(() => adjTable.updateRecordAsync(record, { [f.id]: value }).catch(console.error));
  }, [adjTable, record]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const showDirection = changeType === 'Tax Adjustment' || changeType === 'Other';
  const lbl = 'text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1';
  const inp = 'w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors';
  const signedVariant: PillVariant = signedAmount === null ? 'gray' : signedAmount >= 0 ? 'orange' : 'green';
  const signedLabel = signedAmount === null ? '—' : signedAmount >= 0 ? `+${formatCurrency(signedAmount)}` : formatCurrency(signedAmount);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[520px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"><ArrowLeftIcon size={16} /></button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Adjustment</p>
            <p className="text-base font-semibold text-gray-900 dark:text-[#F5F3EF] truncate">{orderId || 'Adjustment Detail'}</p>
          </div>
          <Pill variant={signedVariant}>{signedLabel}</Pill>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={lbl}>Change Type</span>
              <SingleSelectDropdown value={changeType} options={CHANGE_TYPE_OPTIONS} placeholder="Select type…"
                onChange={v => { setChangeType(v); save(ADJ_FIELD_IDS.CHANGE_TYPE, v ? { name: v } : null); }} />
            </div>
            {showDirection && (
              <div>
                <span className={lbl}>Direction</span>
                <SingleSelectDropdown value={direction} options={DIRECTION_OPTIONS} placeholder="Charge / Credit"
                  onChange={v => { setDirection(v); save(ADJ_FIELD_IDS.DIRECTION, v ? { name: v } : null); }} />
              </div>
            )}
          </div>
          <div>
            <span className={lbl}>Amount</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input type="number" min={0} step="0.01" className={`${inp} pl-7`} value={amount}
                onChange={e => setAmount(e.target.value)}
                onBlur={() => { const v = parseFloat(amount); if (!isNaN(v)) save(ADJ_FIELD_IDS.AMOUNT, v); }}
                placeholder="0.00" />
            </div>
          </div>
          <div>
            <span className={lbl}>Notes</span>
            <textarea className={`${inp} resize-none min-h-[80px]`} rows={3}
              value={notes} onChange={e => setNotes(e.target.value)}
              onBlur={() => save(ADJ_FIELD_IDS.NOTES, notes)}
              placeholder="Add context for this adjustment…" />
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Signed amount (computed)</span>
            <span className={`text-sm font-semibold ${signedAmount !== null && signedAmount < 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>{signedLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OrderDetailModal ─────────────────────────────────────────────────────────
function OrderDetailModal({ record, orderTable, adjTable, adjRecords, onClose }: {
  record: AirtableRecord; orderTable: Table;
  adjTable: Table | null; adjRecords: AirtableRecord[]; onClose: () => void;
}) {
  const [selectedAdjId,   setSelectedAdjId]   = useState<string | null>(null);
  const [showAddModal,    setShowAddModal]     = useState(false);
  const [localAdjs, setLocalAdjs] = useState<AirtableRecord[]>([]);
  const [optimisticAdjs, setOptimisticAdjs] = useState<Array<{
    id: string; changeType: string; direction: string; amount: number; notes: string; signedAmount: number;
  }>>([]);

  const getStr = (fid: string): string => { try { return record.getCellValueAsString(orderTable.getFieldIfExists(fid)!) ?? ''; } catch { return ''; } };
  const getNum = (fid: string): number | null => { try { const f = orderTable.getFieldIfExists(fid); if (!f) return null; return record.getCellValue(f) as number | null; } catch { return null; } };
  const getSel = (fid: string): string => { try { const f = orderTable.getFieldIfExists(fid); if (!f) return ''; const v = record.getCellValue(f) as { name: string } | null; return v?.name ?? ''; } catch { return ''; } };

  const [trackingNum,  setTrackingNum]  = useState(() => getStr(ORDER_FIELD_IDS.TRACKING_NUMBER));
  const [carrier,      setCarrier]      = useState(() => getSel(ORDER_FIELD_IDS.CARRIER));
  const [delivMethod,  setDelivMethod]  = useState(() => getSel(ORDER_FIELD_IDS.DELIVERY_METHOD));
  const [delivStatus,  setDelivStatus]  = useState(() => getSel(ORDER_FIELD_IDS.DELIVERY_STATUS));
  const [pickedStatus, setPickedStatus] = useState(() => getSel(ORDER_FIELD_IDS.PICKED_STATUS));
  const [notified,     setNotified]     = useState(() => {
    try { const f = orderTable.getFieldIfExists(ORDER_FIELD_IDS.CLIENT_NOTIFIED); if (!f) return false; return !!(record.getCellValue(f) as boolean | null); } catch { return false; }
  });

  const orderNumber = getNum(ORDER_FIELD_IDS.SHOPIFY_ORDER_NUMBER);
  const amOrderNum  = getNum(ORDER_FIELD_IDS.AM_ORDER_NUMBER);
  const subtotal    = getNum(ORDER_FIELD_IDS.SUBTOTAL);
  const shipping    = getNum(ORDER_FIELD_IDS.SHIPPING);
  const taxes       = getNum(ORDER_FIELD_IDS.TAXES);
  const total       = getNum(ORDER_FIELD_IDS.TOTAL);
  const adjTotalField = getNum(ORDER_FIELD_IDS.ADJUSTED_TOTAL);
  const payStatus   = getSel(ORDER_FIELD_IDS.PAYMENT_STATUS);
  const store       = getSel(ORDER_FIELD_IDS.STORE);

  const isShip = delivMethod.toLowerCase().includes('ship');

  const save = useCallback((fid: string, value: unknown) => {
    const f = orderTable.getFieldIfExists(fid); if (!f) return;
    queueWrite(() => orderTable.updateRecordAsync(record, { [f.id]: value }).catch(console.error));
  }, [orderTable, record]);

  const delivMethodOpts  = useMemo(() => { const f = orderTable.getFieldIfExists(ORDER_FIELD_IDS.DELIVERY_METHOD); return f?.options?.choices?.map((c: { name: string }) => c.name) ?? ['Pick Up in Store', 'Ship']; }, [orderTable]);
  const delivStatusOpts  = useMemo(() => { const f = orderTable.getFieldIfExists(ORDER_FIELD_IDS.DELIVERY_STATUS); return f?.options?.choices?.map((c: { name: string }) => c.name) ?? []; }, [orderTable]);
  const pickedStatusOpts = useMemo(() => { const f = orderTable.getFieldIfExists(ORDER_FIELD_IDS.PICKED_STATUS);   return f?.options?.choices?.map((c: { name: string }) => c.name) ?? []; }, [orderTable]);
  const carrierOpts      = ['UPS', 'FedEx', 'DHL', 'INTERJUMBO'];

  const linkedAdjIds = useMemo(() => {
    try {
      const f = orderTable.getFieldIfExists(ORDER_FIELD_IDS.ORDER_ADJUSTMENTS); if (!f) return new Set<string>();
      const links = record.getCellValue(f) as Array<{ id: string }> | null;
      return new Set((links ?? []).map(l => l.id));
    } catch { return new Set<string>(); }
  }, [record, orderTable]);

  const linkedAdjs = useMemo(() => adjRecords.filter(r => linkedAdjIds.has(r.id)), [adjRecords, linkedAdjIds]);

  useEffect(() => {
    setLocalAdjs(linkedAdjs);
    setOptimisticAdjs([]);
  }, [linkedAdjs.length]);

  const getAdjNum = (r: AirtableRecord, fid: string): number | null => {
    if (!adjTable) return null;
    try { const f = adjTable.getFieldIfExists(fid); if (!f) return null; return r.getCellValue(f) as number | null; } catch { return null; }
  };
  const getAdjSel = (r: AirtableRecord, fid: string): string => {
    if (!adjTable) return '—';
    try { const f = adjTable.getFieldIfExists(fid); if (!f) return '—'; const v = r.getCellValue(f) as { name: string } | null; return v?.name ?? '—'; } catch { return '—'; }
  };

  const realAdjTotal = useMemo(() => localAdjs.reduce((sum, r) => sum + (getAdjNum(r, ADJ_FIELD_IDS.SIGNED_AMOUNT) ?? 0), 0), [localAdjs]);
  const optimisticTotal = optimisticAdjs.reduce((sum, o) => sum + o.signedAmount, 0);
  const totalAdjustments = realAdjTotal + optimisticTotal;

  const selectedAdj = useMemo(() => selectedAdjId ? localAdjs.find(r => r.id === selectedAdjId) ?? null : null, [selectedAdjId, localAdjs]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !selectedAdj && !showAddModal) onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose, selectedAdj, showAddModal]);

  const lbl = 'text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1';
  const inp = 'w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors';

  const allAdjDirs: string[] = [
    ...localAdjs.map(r => getAdjSel(r, ADJ_FIELD_IDS.DIRECTION)),
    ...optimisticAdjs.map(o => o.direction),
  ];
  const hasDirection = allAdjDirs.some(d => d && d !== 'Unknown' && d !== '—');

  const adjRows: Array<Array<React.ReactNode>> = [
    ...localAdjs.map(r => {
      const ct  = getAdjSel(r, ADJ_FIELD_IDS.CHANGE_TYPE);
      const dir = getAdjSel(r, ADJ_FIELD_IDS.DIRECTION);
      const amt = getAdjNum(r, ADJ_FIELD_IDS.SIGNED_AMOUNT);
      const amtDisplay = amt === null ? '—' : (amt >= 0
        ? <span className="text-orange-600 dark:text-orange-400 font-medium">+{formatCurrency(amt)}</span>
        : <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(amt)}</span>);
      const row: React.ReactNode[] = [ct || '—'];
      if (hasDirection) row.push(dir && dir !== 'Unknown' ? <Pill variant={dir === 'Charge' ? 'orange' : 'green'}>{dir}</Pill> : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>);
      row.push(amtDisplay);
      return row;
    }),
    ...optimisticAdjs.map(o => {
      const amtDisplay = o.signedAmount >= 0
        ? <span className="text-orange-600 dark:text-orange-400 font-medium">+{formatCurrency(o.signedAmount)}</span>
        : <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(o.signedAmount)}</span>;
      const row: React.ReactNode[] = [<span className="text-gray-400 dark:text-gray-500 italic">{o.changeType}</span>];
      if (hasDirection) row.push(o.direction && o.direction !== 'Unknown'
        ? <Pill variant={o.direction === 'Charge' ? 'orange' : 'green'}>{o.direction}</Pill>
        : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>);
      row.push(<span className="opacity-60">{amtDisplay}</span>);
      return row;
    }),
  ];

  const handleAdjRowClick = (i: number) => {
    if (i < localAdjs.length) setSelectedAdjId(localAdjs[i]?.id ?? null);
  };

  if (selectedAdj && adjTable) {
    return <AdjustmentDetailModal record={selectedAdj} adjTable={adjTable} onClose={() => setSelectedAdjId(null)} />;
  }

  return (
    <>
      {showAddModal && adjTable && (
        <AddAdjustmentModal
          adjTable={adjTable}
          orderRecord={record}
          onClose={() => setShowAddModal(false)}
          onSaved={newAdj => {
            setOptimisticAdjs(prev => [...prev, { ...newAdj, id: `optimistic-${Date.now()}` }]);
          }}
        />
      )}
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(3px)' }}
        onClick={e => { if (e.target === e.currentTarget && !showAddModal) onClose(); }}>
        <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[620px] max-h-[88vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"><ArrowLeftIcon size={16} /></button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Order</p>
              <p className="text-base font-semibold text-gray-900 dark:text-[#F5F3EF]">
                {orderNumber ? `#${orderNumber}` : '—'}{amOrderNum ? ` · AM ${amOrderNum}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {store && <Pill variant="gray">{store}</Pill>}
              {payStatus && <Pill variant={payStatus === 'Paid' ? 'green' : payStatus.includes('Partial') ? 'yellow' : 'red'}>{payStatus}</Pill>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <section>
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium block mb-3">Financials</span>
              <div className="grid grid-cols-4 gap-3">
                {([['Subtotal', subtotal], ['Shipping', shipping], ['Taxes', taxes], ['Total', total]] as [string, number | null][]).map(([label, val]) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(val)}</p>
                  </div>
                ))}
              </div>
              {adjTotalField !== null && (
                <div className="mt-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-blue-700 dark:text-blue-300">Adjusted Total</span>
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{formatCurrency(adjTotalField)}</span>
                </div>
              )}
            </section>
            <div className="border-t border-gray-100 dark:border-white/5" />
            <section>
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium block mb-3">Fulfillment</span>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={lbl}>Delivery Method</span>
                    <SingleSelectDropdown value={delivMethod} options={delivMethodOpts} placeholder="—"
                      onChange={v => { setDelivMethod(v); save(ORDER_FIELD_IDS.DELIVERY_METHOD, v ? { name: v } : null); }} />
                  </div>
                  <div>
                    <span className={lbl}>Client Notified</span>
                    <ToggleButton checked={notified} label={notified ? 'Notified' : 'Not Notified'}
                      onChange={v => { setNotified(v); save(ORDER_FIELD_IDS.CLIENT_NOTIFIED, v); }} />
                  </div>
                </div>
                {isShip && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className={lbl}>Tracking Number</span>
                      <input className={inp} value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
                        onBlur={() => save(ORDER_FIELD_IDS.TRACKING_NUMBER, trackingNum)} placeholder="Tracking #" />
                    </div>
                    <div>
                      <span className={lbl}>Carrier</span>
                      <SingleSelectDropdown value={carrier} options={carrierOpts} placeholder="—"
                        onChange={v => { setCarrier(v); save(ORDER_FIELD_IDS.CARRIER, v ? { name: v } : null); }} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={lbl}>Delivery Status</span>
                    <SingleSelectDropdown value={delivStatus} options={delivStatusOpts} placeholder="—"
                      onChange={v => { setDelivStatus(v); save(ORDER_FIELD_IDS.DELIVERY_STATUS, v ? { name: v } : null); }} />
                  </div>
                  <div>
                    <span className={lbl}>Picked Status</span>
                    <SingleSelectDropdown value={pickedStatus} options={pickedStatusOpts} placeholder="—"
                      onChange={v => { setPickedStatus(v); save(ORDER_FIELD_IDS.PICKED_STATUS, v ? { name: v } : null); }} />
                  </div>
                </div>
              </div>
            </section>
            <div className="border-t border-gray-100 dark:border-white/5" />
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Order Adjustments</span>
                  {(localAdjs.length + optimisticAdjs.length) > 0 && (
                    <span className={`text-xs font-semibold ${totalAdjustments >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                      {totalAdjustments >= 0 ? '+' : ''}{formatCurrency(totalAdjustments)} net
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                  <PlusIcon size={12} />Add Adjustment
                </button>
              </div>
              <MiniTable
                headers={hasDirection ? ['Type', 'Direction', 'Amount'] : ['Type', 'Amount']}
                rows={adjRows}
                onRowClick={handleAdjRowClick}
              />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── DetailModal (Client) ─────────────────────────────────────────────────────
interface ModalProps {
  record: AirtableRecord; fields: Record<string, Field | null>;
  clientsTable: Table | null; onClose: () => void;
  orderTable: Table | null; adjTable: Table | null;
  adjRecords: AirtableRecord[]; orderRecords: AirtableRecord[];
}
function DetailModal({ record, fields, clientsTable, onClose, orderTable, adjTable, adjRecords, orderRecords }: ModalProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const get = useCallback(<T,>(fid: string): T | null => {
    const f = fields[fid] ?? null; if (!f) return null;
    try { return record.getCellValue(f) as T | null; } catch { return null; }
  }, [record, fields]);
  const getStr = useCallback((fid: string): string => {
    const f = fields[fid] ?? null; if (!f) return '';
    try { return record.getCellValueAsString(f) ?? ''; } catch { return ''; }
  }, [record, fields]);
  const save = useCallback((fid: string, value: unknown) => {
    if (!clientsTable) return; const f = fields[fid]; if (!f) return;
    queueWrite(() => clientsTable.updateRecordAsync(record, { [f.id]: value }).catch(console.error));
  }, [clientsTable, fields, record]);

  const [fullName,      setFullName]      = useState(() => getStr(FIELD_IDS.FULL_NAME));
  const [phone,         setPhone]         = useState(() => getStr(FIELD_IDS.PHONE));
  const [email,         setEmail]         = useState(() => getStr(FIELD_IDS.EMAIL));
  const [weddingDate,   setWeddingDate]   = useState(() => get<string>(FIELD_IDS.WEDDING_DATE) ?? '');
  const [notes,         setNotes]         = useState(() => get<string>(FIELD_IDS.FULFILLMENT_NOTES) ?? '');
  const [otherAddr,     setOtherAddr]     = useState(() => getStr(FIELD_IDS.OTHER_ADDRESS));
  const [addrConfirmed, setAddrConfirmed] = useState(() => !!(get<boolean>(FIELD_IDS.ADDRESS_CONFIRMED)));
  const [holdDate,      setHoldDate]      = useState(() => get<string>(FIELD_IDS.HOLD_SHIPMENT_DATE) ?? '');

  const saName      = getStr(FIELD_IDS.SALES_ASSOCIATE_NAME);
  const studioName  = getStr(FIELD_IDS.STUDIO_NAME); // rollup fldIenJoxseeHmfIv
  const acuityAddr  = getStr(FIELD_IDS.ACUITY_ADDRESS);
  const shopifyAddr = getStr(FIELD_IDS.SHOPIFY_ADDRESS);

  const linkedOrderIds = useMemo(() => {
    try {
      const f = fields[FIELD_IDS.SHOPIFY_ORDERS]; if (!f) return new Set<string>();
      const links = record.getCellValue(f) as Array<{ id: string }> | null;
      return new Set((links ?? []).map(l => l.id));
    } catch { return new Set<string>(); }
  }, [record, fields]);
  const linkedOrders = useMemo(() => orderRecords.filter(r => linkedOrderIds.has(r.id)), [orderRecords, linkedOrderIds]);

  const getOrderNum = useCallback((r: AirtableRecord, fid: string): number | null => {
    if (!orderTable) return null;
    try { const f = orderTable.getFieldIfExists(fid); if (!f) return null; return r.getCellValue(f) as number | null; } catch { return null; }
  }, [orderTable]);
  const getOrderSel = useCallback((r: AirtableRecord, fid: string): string => {
    if (!orderTable) return '—';
    try { const f = orderTable.getFieldIfExists(fid); if (!f) return '—'; const v = r.getCellValue(f) as { name: string } | null; return v?.name ?? '—'; } catch { return '—'; }
  }, [orderTable]);

  const hasAnyAdjustedTotal = useMemo(() =>
    linkedOrders.some(r => getOrderNum(r, ORDER_FIELD_IDS.ADJUSTED_TOTAL) !== null),
    [linkedOrders]
  );

  const totalSum    = useMemo(() => linkedOrders.reduce((s, r) => s + (getOrderNum(r, ORDER_FIELD_IDS.TOTAL)          ?? 0), 0), [linkedOrders]);
  const adjTotalSum = useMemo(() => linkedOrders.reduce((s, r) => s + (getOrderNum(r, ORDER_FIELD_IDS.ADJUSTED_TOTAL) ?? 0), 0), [linkedOrders]);

  const orderRows = linkedOrders.map(r => {
    const num         = getOrderNum(r, ORDER_FIELD_IDS.SHOPIFY_ORDER_NUMBER);
    const total       = getOrderNum(r, ORDER_FIELD_IDS.TOTAL);
    const adjTotal    = getOrderNum(r, ORDER_FIELD_IDS.ADJUSTED_TOTAL);
    const pay         = getOrderSel(r, ORDER_FIELD_IDS.PAYMENT_STATUS);
    const delivMethod = getOrderSel(r, ORDER_FIELD_IDS.DELIVERY_METHOD);
    const picked      = getOrderSel(r, ORDER_FIELD_IDS.PICKED_STATUS);
    const payV: PillVariant = pay === 'Paid' ? 'green' : pay.includes('Partial') ? 'yellow' : 'red';
    const row: React.ReactNode[] = [
      <span className="font-medium">{num ? `#${num}` : '—'}</span>,
      <Pill variant={payV}>{pay || '—'}</Pill>,
      <span className="text-gray-500 dark:text-gray-400">{delivMethod || '—'}</span>,
      <span className="text-gray-500 dark:text-gray-400">{picked || '—'}</span>,
      formatCurrency(total),
    ];
    if (hasAnyAdjustedTotal) {
      row.push(adjTotal !== null
        ? <span className="text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(adjTotal)}</span>
        : <span className="text-gray-300 dark:text-gray-600">—</span>);
    }
    return row;
  });

  const selectedOrder = useMemo(() => selectedOrderId ? linkedOrders.find(r => r.id === selectedOrderId) ?? null : null, [selectedOrderId, linkedOrders]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !selectedOrder) onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose, selectedOrder]);

  if (selectedOrder && orderTable) {
    return (
      <OrderDetailModal
        record={selectedOrder} orderTable={orderTable}
        adjTable={adjTable} adjRecords={adjRecords}
        onClose={() => setSelectedOrderId(null)}
      />
    );
  }

  const lbl = 'text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1';
  const inp = 'w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors';
  const readOnly = 'w-full text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5';
  const div = <div className="border-t border-gray-100 dark:border-white/5" />;
  const hasHold = !!holdDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <input className="text-xl font-bold text-gray-900 dark:text-[#F5F3EF] bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-white/10 focus:border-blue-400 outline-none w-full transition-colors pb-0.5"
              value={fullName} onChange={e => setFullName(e.target.value)} onBlur={() => save(FIELD_IDS.FULL_NAME, fullName)} />
            {/* Studio badge — sourced from studio_name rollup (fldIenJoxseeHmfIv) */}
            {studioName ? (
              <div className="mt-1 mb-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10">{studioName}</span>
              </div>
            ) : (
              <div className="mb-3" />
            )}
            <div className="grid grid-cols-4 gap-x-4">
              <div className="min-w-0">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">Phone</span>
                <input className="text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors w-full"
                  value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => save(FIELD_IDS.PHONE, phone)} placeholder="—" />
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">Email</span>
                <input className="text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors w-full"
                  value={email} onChange={e => setEmail(e.target.value)} onBlur={() => save(FIELD_IDS.EMAIL, email)} placeholder="—" />
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">Sales Associate</span>
                <span className="text-sm text-gray-700 dark:text-gray-200 block truncate py-1">{saName || '—'}</span>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">Wedding Date</span>
                <DatePicker value={weddingDate ? weddingDate.slice(0, 10) : ''} onChange={v => { setWeddingDate(v); save(FIELD_IDS.WEDDING_DATE, v || null); }} placeholder="—" align="right" />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"><XIcon size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* 1. Shopify Orders */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCartIcon size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Shopify Orders</span>
              {linkedOrders.length > 0 && <span className="text-xs text-gray-400 dark:text-gray-500">({linkedOrders.length})</span>}
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                    {(hasAnyAdjustedTotal
                      ? ['Order #', 'Payment', 'Delivery', 'Picked', 'Total', 'Adjusted Total']
                      : ['Order #', 'Payment', 'Delivery', 'Picked', 'Total']
                    ).map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linkedOrders.length === 0 ? (
                    <tr><td colSpan={hasAnyAdjustedTotal ? 6 : 5} className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">None</td></tr>
                  ) : orderRows.map((row, i) => (
                    <tr key={i}
                      onClick={() => setSelectedOrderId(linkedOrders[i]?.id ?? null)}
                      className="border-b border-gray-100 dark:border-white/5 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {linkedOrders.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                      <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</td>
                      <td className="px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(totalSum)}</td>
                      {hasAnyAdjustedTotal && (
                        <td className="px-3 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(adjTotalSum)}</td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {div}

          {/* 2. Addresses */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MapPinIcon size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Address</span>
            </div>
            <div className="space-y-3">
              <div>
                <span className={lbl}>Shopify Address</span>
                <p className={readOnly}>{shopifyAddr || <span className="text-gray-400 dark:text-gray-600">—</span>}</p>
              </div>
              <div>
                <span className={lbl}>Acuity Address</span>
                <p className={readOnly}>{acuityAddr || <span className="text-gray-400 dark:text-gray-600">—</span>}</p>
              </div>
              <div>
                <span className={lbl}>Other Address</span>
                <input className={inp} value={otherAddr} onChange={e => setOtherAddr(e.target.value)}
                  onBlur={() => save(FIELD_IDS.OTHER_ADDRESS, otherAddr)} placeholder="Other address" />
              </div>
            </div>

            {/* Address confirmed + Hold — same row */}
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Address Confirmed</span>
                <ToggleButton checked={addrConfirmed} label={addrConfirmed ? 'Confirmed' : 'Not Confirmed'}
                  onChange={v => { setAddrConfirmed(v); save(FIELD_IDS.ADDRESS_CONFIRMED, v); }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Hold Until</span>
                <DatePicker value={holdDate ? holdDate.slice(0, 10) : ''}
                  onChange={v => { setHoldDate(v); save(FIELD_IDS.HOLD_SHIPMENT_DATE, v || null); }}
                  className="w-[180px]" placeholder="No hold" openUp />
              </div>
              {hasHold && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
                  <WarningCircleIcon size={13} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">On Hold · {formatDate(holdDate)}</span>
                </div>
              )}
            </div>
          </section>

          {div}

          {/* 3. Fulfillment Notes */}
          <section>
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium block mb-3">Fulfillment Notes</span>
            <textarea className={`${inp} resize-none min-h-[80px]`} rows={3}
              value={notes} onChange={e => setNotes(e.target.value)}
              onBlur={() => save(FIELD_IDS.FULFILLMENT_NOTES, notes)} placeholder="Add notes…" />
          </section>

        </div>
      </div>
    </div>
  );
}

// ─── FulfillmentApp ───────────────────────────────────────────────────────────
function FulfillmentApp(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchQuery,      setSearchQuery]       = useState('');
  const [showPickUp,       setShowPickUp]        = useState(false);
  const [showShip,         setShowShip]          = useState(false);
  const [showOnHold,       setShowOnHold]        = useState(false);
  const [studioFilter,     setStudioFilter]      = useState<string[]>([]);
  const [associateFilter,  setAssociateFilter]   = useState<string[]>([]);
  const [methodFilter,     setMethodFilter]      = useState<string[]>([]);

  const clientsTable = customPropertyValueByKey.clientsTable as Table | undefined ?? null;
  const studiosTable = base.getTableByIdIfExists(STUDIOS_TABLE_ID);
  const orderTable   = base.getTableByIdIfExists(ORDER_TABLE_ID);
  const adjTable     = base.getTableByIdIfExists(ADJ_TABLE_ID);

  const fields = useMemo<Record<string, Field | null>>(() => {
    if (!clientsTable) return {};
    return Object.fromEntries(Object.entries(FIELD_IDS).map(([, id]) => [id, clientsTable.getFieldIfExists(id)]));
  }, [clientsTable]);

  const allRecords     = useRecords(clientsTable ?? null);
  const studiosRecords = useRecords(studiosTable ?? null);
  const orderRecords   = useRecords(orderTable ?? null);
  const adjRecords     = useRecords(adjTable ?? null);

  const getSel = useCallback((rec: NonNullable<typeof allRecords>[number], fid: string): { name: string } | null => {
    const f = fields[fid] ?? null; if (!f) return null;
    try { return rec.getCellValue(f) as { name: string } | null; } catch { return null; }
  }, [fields]);
  const getStr = useCallback((rec: NonNullable<typeof allRecords>[number], fid: string): string => {
    const f = fields[fid] ?? null; if (!f) return '';
    try { return rec.getCellValueAsString(f) ?? ''; } catch { return ''; }
  }, [fields]);
  const getNum = useCallback((rec: NonNullable<typeof allRecords>[number], fid: string): number | null => {
    const f = fields[fid] ?? null; if (!f) return null;
    try { return rec.getCellValue(f) as number | null; } catch { return null; }
  }, [fields]);

  const fulfillmentRecords = useMemo(() => {
    if (!allRecords) return [];
    return allRecords.filter(r => getSel(r, FIELD_IDS.STAGE)?.name === 'In Fulfillment');
  }, [allRecords, getSel]);

  const uniqueStudios = useMemo(() => {
    if (!studiosRecords || !studiosTable) return [];
    const nameField   = studiosTable.getFieldIfExists(STUDIOS_FIELD_IDS.NAME);
    const activeField = studiosTable.getFieldIfExists(STUDIOS_FIELD_IDS.IS_ACTIVE);
    return studiosRecords
      .filter(r => !activeField || !!(r.getCellValue(activeField) as boolean | null))
      .map(r => nameField ? (r.getCellValue(nameField) as string | null) ?? r.name : r.name)
      .filter(Boolean).sort() as string[];
  }, [studiosRecords, studiosTable]);

  const uniqueAssociates = useMemo(() => {
    const s = new Set<string>();
    fulfillmentRecords.forEach(r => {
      const f = fields[FIELD_IDS.SALES_ASSOCIATE_NAME]; if (!f) return;
      const val = r.getCellValue(f);
      if (Array.isArray(val)) val.forEach((item: { value?: string } | string) => {
        const v = typeof item === 'object' && item !== null && 'value' in item ? item.value : String(item);
        if (v) s.add(v);
      });
      else if (typeof val === 'string' && val) s.add(val);
    });
    return Array.from(s).sort();
  }, [fulfillmentRecords, fields]);

  const filteredRecords = useMemo(() => {
    let recs = fulfillmentRecords;
    if (studioFilter.length) recs = recs.filter(r => studioFilter.includes(getStr(r, FIELD_IDS.STUDIO_NAME)));
    if (associateFilter.length) recs = recs.filter(r => {
      const f = fields[FIELD_IDS.SALES_ASSOCIATE_NAME]; if (!f) return false;
      const val = r.getCellValue(f);
      const assoc = Array.isArray(val)
        ? val.map((x: { value?: string } | string) => typeof x === 'object' && x !== null && 'value' in x ? x.value : String(x)).join(', ')
        : typeof val === 'string' ? val : '';
      return associateFilter.some(a => assoc.toLowerCase().includes(a.toLowerCase()));
    });
    if (methodFilter.length) recs = recs.filter(r => {
      const m = getSel(r, FIELD_IDS.FULFILLMENT_METHOD)?.name?.toLowerCase() ?? '';
      return methodFilter.some(mf => mf === 'Pick Up' ? m.includes('pick up') : m.includes('ship'));
    });
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      recs = recs.filter(r => {
        const saF = fields[FIELD_IDS.SALES_ASSOCIATE_NAME];
        return getStr(r, FIELD_IDS.FULL_NAME).toLowerCase().includes(q)
          || getStr(r, FIELD_IDS.EMAIL).toLowerCase().includes(q)
          || getStr(r, FIELD_IDS.PHONE).toLowerCase().includes(q)
          || (saF ? (r.getCellValueAsString(saF) ?? '').toLowerCase().includes(q) : false);
      });
    }
    if (showPickUp || showShip || showOnHold) {
      recs = recs.filter(r => {
        const m  = getSel(r, FIELD_IDS.FULFILLMENT_METHOD)?.name?.toLowerCase() ?? '';
        const hd = fields[FIELD_IDS.HOLD_SHIPMENT_DATE] ? r.getCellValue(fields[FIELD_IDS.HOLD_SHIPMENT_DATE]!) : null;
        return (showPickUp && m.includes('pick up')) || (showShip && m.includes('ship')) || (showOnHold && !!hd);
      });
    }
    return [...recs].sort((a, b) => {
      const wa = fields[FIELD_IDS.WEDDING_DATE] ? (a.getCellValue(fields[FIELD_IDS.WEDDING_DATE]!) as string | null) : null;
      const wb = fields[FIELD_IDS.WEDDING_DATE] ? (b.getCellValue(fields[FIELD_IDS.WEDDING_DATE]!) as string | null) : null;
      if (!wa && !wb) return 0; if (!wa) return 1; if (!wb) return -1;
      return new Date(wa).getTime() - new Date(wb).getTime();
    });
  }, [fulfillmentRecords, studioFilter, associateFilter, methodFilter, searchQuery, showPickUp, showShip, showOnHold, getSel, getStr, fields]);

  const summaryStats = useMemo(() => {
    let pickup = 0, ship = 0, hold = 0;
    fulfillmentRecords.forEach(r => {
      const m  = getSel(r, FIELD_IDS.FULFILLMENT_METHOD)?.name?.toLowerCase() ?? '';
      const hd = fields[FIELD_IDS.HOLD_SHIPMENT_DATE] ? r.getCellValue(fields[FIELD_IDS.HOLD_SHIPMENT_DATE]!) : null;
      if (m.includes('pick up')) pickup++;
      if (m.includes('ship'))   ship++;
      if (hd)                   hold++;
    });
    return { pickup, ship, hold };
  }, [fulfillmentRecords, getSel, fields]);

  const toggleFlagFilter = useCallback((flag: 'pickup' | 'ship' | 'hold') => {
    const np = flag === 'pickup' ? !showPickUp : showPickUp;
    const ns = flag === 'ship'   ? !showShip   : showShip;
    const nh = flag === 'hold'   ? !showOnHold : showOnHold;
    if (np && ns && nh) { setShowPickUp(false); setShowShip(false); setShowOnHold(false); }
    else { setShowPickUp(np); setShowShip(ns); setShowOnHold(nh); }
  }, [showPickUp, showShip, showOnHold]);

  const selectedRecord = useMemo(
    () => selectedRecordId ? (allRecords?.find(r => r.id === selectedRecordId) ?? null) : null,
    [selectedRecordId, allRecords]
  );

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
  if (!fields[FIELD_IDS.FULL_NAME] || !fields[FIELD_IDS.STAGE]) return (
    <div className="h-screen flex items-center justify-center bg-[#F6F4F0] dark:bg-[#1A1917]">
      <div className="text-center p-8">
        <WarningCircleIcon size={40} className="text-red-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-red-600">Required fields missing — contact administrator</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans antialiased bg-[#F6F4F0] dark:bg-[#1A1917]">

      {selectedRecord && (
        <DetailModal
          record={selectedRecord} fields={fields} clientsTable={clientsTable}
          onClose={() => setSelectedRecordId(null)}
          orderTable={orderTable} adjTable={adjTable}
          adjRecords={adjRecords ?? []} orderRecords={orderRecords ?? []}
        />
      )}

      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => toggleFlagFilter('pickup')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all border-2 ${
              showPickUp ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 border-purple-600 dark:border-purple-400'
                         : 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-300 border-purple-300 dark:border-purple-700'}`}>
            <PackageIcon size={14} />Pick Up: {summaryStats.pickup}
          </button>
          <button onClick={() => toggleFlagFilter('ship')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all border-2 ${
              showShip ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-blue-600 dark:border-blue-400'
                       : 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700'}`}>
            <TruckIcon size={14} />Ship: {summaryStats.ship}
          </button>
          <button onClick={() => toggleFlagFilter('hold')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all border-2 ${
              showOnHold ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 border-red-600 dark:border-red-400'
                         : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-300 border-red-300 dark:border-red-700'}`}>
            <WarningCircleIcon size={14} />On Hold: {summaryStats.hold}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search clients…"
              className="pl-9 pr-7 py-1.5 text-sm bg-white dark:bg-[#242220] border border-gray-300 dark:border-[#34312C] rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors w-[180px]" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <XIcon size={13} />
              </button>
            )}
          </div>
          <FilterDropdown label="Studio"    values={studioFilter}    options={uniqueStudios}       onChange={setStudioFilter} />
          <FilterDropdown label="Associate" values={associateFilter} options={uniqueAssociates}    onChange={setAssociateFilter} />
          <FilterDropdown label="Method"    values={methodFilter}    options={['Pick Up', 'Ship']} onChange={setMethodFilter} align="right" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-6 pb-4 flex flex-col">
        <div className="bg-white dark:bg-[#242220] border border-[#E5E1DA] dark:border-[#34312C] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[960px] border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1e1d1b]">
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[130px]">Client</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[120px]">Wedding Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[130px]">Phone</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[180px]">Email</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[130px]">Sales Associate</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[100px]">Delivery</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[160px]">Items</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[110px]">% Picked</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[160px]">Shipping Address</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[70px]">Hold</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[140px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(rec => {
                  const name         = getStr(rec, FIELD_IDS.FULL_NAME);
                  const wdVal        = fields[FIELD_IDS.WEDDING_DATE] ? (rec.getCellValue(fields[FIELD_IDS.WEDDING_DATE]!) as string | null) : null;
                  const wdDisplay    = wdVal ? new Date(wdVal).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                  const pickedRollup = getNum(rec, FIELD_IDS.PICKED_ROLLUP);
                  const delivStatus  = getSel(rec, FIELD_IDS.DELIVERY_STATUS);
                  const holdDate     = fields[FIELD_IDS.HOLD_SHIPMENT_DATE] ? rec.getCellValue(fields[FIELD_IDS.HOLD_SHIPMENT_DATE]!) as string | null : null;
                  const acuity       = getStr(rec, FIELD_IDS.ACUITY_ADDRESS);
                  const shopify      = getStr(rec, FIELD_IDS.SHOPIFY_ADDRESS);
                  const other        = getStr(rec, FIELD_IDS.OTHER_ADDRESS);
                  const addr         = acuity || shopify || other || '';
                  const pct          = Math.round((pickedRollup ?? 0) * 100);
                  const hasHold      = !!holdDate;
                  const delivVariant: PillVariant =
                    delivStatus === 'Fulfilled'         ? 'green' :
                    delivStatus.includes('Partial')     ? 'yellow' :
                    delivStatus === 'Unfulfilled'       ? 'red' : 'gray';
                  let statusVariant: PillVariant = 'yellow';
                  let statusText = `${pct}% Picked`;
                  if (hasHold)         { statusVariant = 'red';   statusText = 'On Hold'; }
                  else if (pct >= 100) { statusVariant = 'green'; statusText = '100% Picked — Ready'; }
                  const fPhone = fields[FIELD_IDS.PHONE];
                  const fEmail = fields[FIELD_IDS.EMAIL];
                  const fSA    = fields[FIELD_IDS.SALES_ASSOCIATE_NAME];
                  const fItems = fields[FIELD_IDS.ITEMS_SOLD];
                  return (
                    <tr key={rec.id} onClick={() => setSelectedRecordId(rec.id)}
                      className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-[#F5F3EF]">{name || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{wdDisplay}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fPhone ? <CellRenderer record={rec} field={fPhone} /> : '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fEmail ? <CellRenderer record={rec} field={fEmail} /> : '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fSA    ? <CellRenderer record={rec} field={fSA}    /> : '—'}</td>
                      <td className="px-3 py-2.5">
                        {delivStatus
                          ? <Pill variant={delivVariant}>{delivStatus}</Pill>
                          : <span className="text-sm text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fItems ? <CellRenderer record={rec} field={fItems} /> : '—'}</td>
                      <td className="px-3 py-2.5"><ProgressBar percentage={pickedRollup ?? 0} /></td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                        {addr ? (
                          <div className="flex items-center gap-1">
                            <MapPinIcon size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-[140px] block">{addr}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5"><Pill variant={hasHold ? 'red' : 'green'}>{hasHold ? 'Yes' : 'No'}</Pill></td>
                      <td className="px-3 py-2.5"><Pill variant={statusVariant}>{statusText}</Pill></td>
                    </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                      No fulfillment records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

initializeBlock({ interface: () => <FulfillmentApp /> });
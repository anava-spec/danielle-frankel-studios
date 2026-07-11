import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
} from '@airtable/blocks/interface/ui';
import {
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  X as XIcon,
  Phone as PhoneIcon,
  Envelope as EnvelopeIcon,
  Circle as CircleIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
} from '@phosphor-icons/react';

// ─── Field IDs ──────────────────────────────────────────────────────────────
const FIELD_IDS = {
  // Orders_Shopify (tblHFGbijtvZcRPkE)
  SHOPIFY_ORDER_NUMBER: 'fldWiKEXjId411DQc',
  AM_ORDER_NUMBER:      'fldBvuNZDqzOx6azb',
  ORDER_DATE:           'fldP8MRiCZYBhjBpG',
  ITEMS:                'fldZHRtwkWdIWCrpF',
  SUBTOTAL:             'fld9CtuMBLprH0SA1',
  SHIPPING:             'fldkorfpXkwh0TWfs',
  TAXES:                'fld2chJ0ME8MA3OWq',
  DISCOUNT_AMOUNT:      'fld1ax2cDXZcy2nVg',
  ALTERATIONS:          'flduADqJdYLj8KHBk',
  M2M:                  'fld1ZVJdMYVS8t53a',
  RUSH_FEE:             'fldBIyZZpv3JAhPqk',
  REFUNDED_AMOUNT:      'fldmoFnYixGsH7vND',
  TOTAL:                'fldkIMTeKdneKABS4',
  CLIENT_LINK:          'fldeVnAInz9d1jpY5',   // multipleRecordLinks → DF_Clients
  CLIENT_PHONE:         'flden7s2Be6miTBmA',   // lookup
  CLIENT_STAGE:         'fldxhlu6v6EnpzZk1',   // lookup
  CLIENT_EMAIL:         'fldjsFvUeHMSgqbSZ',   // lookup
  SALES_ASSOCIATE:      'fldHciJNFQSMgTqJK',   // lookup (via Client → staff.full_name)
  WEDDING_DATE:         'fldt3rLJYYmIKThgj',   // lookup
  STORE_LINK:           'fldyXDoP77bLMTsuM',   // multipleRecordLinks → studios
  // DF_Clients (tblLLUlDgJ4ktzF7c)
  CLIENT_FULL_NAME:     'fldB3Wyam01D3wR5Q',
  // studios (tblYM02GzeYdYk23v)
  STUDIO_SHORT_NAME:    'fldYDMiitEk9QiQ6j',
  STUDIO_IS_ACTIVE:     'fldFyn3fKsxajrvsy',
  // DF_Styles (tbl0hWIRBbcB4UkVC)
  STYLE_NAME:           'fldEs3chQAeplPc1w',
} as const;

// ─── Theme (auto-detects OS/Airtable color scheme) ─────────────────────────────
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

// ─── Utilities ───────────────────────────────────────────────────────────────

// Ordinal suffix helper — returns "1st", "2nd", "3rd", "4th", etc.
function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// Parses an Airtable date cell value (ISO string from getCellValue) and
// formats it as "May 4th, 2026". Uses noon UTC to prevent off-by-one from
// timezone shifts on date-only ISO strings ("2026-05-04" → "2026-05-04T12:00:00Z").
function formatDateOrdinal(v: unknown): string {
  if (!v) return '—';
  let raw: string | null = null;
  if (typeof v === 'string') raw = v;
  else if (Array.isArray(v) && typeof v[0] === 'string') raw = v[0] as string;
  if (!raw) return '—';

  // Normalise: date-only strings have no time component — pin to noon UTC
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T12:00:00Z' : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';

  const month = new Intl.DateTimeFormat('en-US', { month: 'long',  timeZone: 'UTC' }).format(d);
  const day   = Number(new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(d));
  const year  = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' }).format(d);
  return `${month} ${ordinal(day)}, ${year}`;
}

// Generic date formatter (used for wedding date in modal header)
function formatDate(v: unknown): string {
  if (!v) return '—';
  let raw: string | null = null;
  if (typeof v === 'string') raw = v;
  else if (Array.isArray(v) && typeof v[0] === 'string') raw = v[0] as string;
  if (!raw) return '—';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T12:00:00Z' : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function fmt$(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function getStageColor(s: string | null | undefined): string {
  switch (s) {
    case 'Sold':           return 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30';
    case 'In Alterations': return 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30';
    case 'In Fulfillment':
    case 'Shipped':
    case 'Picked Up':      return 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30';
    case 'Deliberating':   return 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30';
    default:               return 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10';
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return (p[0]?.substring(0, 2) ?? '??').toUpperCase();
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase();
}

function getLookupString(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const first = v[0];
    if (!first) return '';
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      if ('name' in first) return String((first as { name: unknown }).name ?? '');
      if ('value' in first) return String((first as { value: unknown }).value ?? '');
    }
  }
  return '';
}

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────
function MultiSelectDropdown({
  label, selected, options, onChange, onClear,
}: {
  label: string;
  selected: Set<string>;
  options: string[];
  onChange: (opt: string, checked: boolean) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const hasSelection = selected.size > 0;
  const displayText = hasSelection ? `${selected.size} selected` : label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center justify-between gap-2 min-w-[150px] bg-white dark:bg-[#25211A] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
          hasSelection
            ? 'border-[#D97706] dark:border-[#FBBF24] text-[#D97706] dark:text-[#FBBF24] font-medium'
            : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:dark:border-gray-500 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]'
        }`}
      >
        <span className="truncate">{displayText}</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {hasSelection && (
            <XIcon
              size={14}
              className="text-[#D97706] dark:text-[#FBBF24] hover:opacity-70 transition-opacity"
              onClick={e => { e.stopPropagation(); onClear(); }}
            />
          )}
          <CaretDownIcon size={13} className={`text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg py-1 min-w-[150px]">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt, !selected.has(opt))}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                selected.has(opt)
                  ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SearchInput ──────────────────────────────────────────────────────────────
function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center">
      <MagnifyingGlassIcon size={14} className="absolute left-2.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
      <input
        type="text"
        placeholder="Search by client, Shopify #, Apparel ID…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-8 pr-7 py-1.5 bg-white dark:bg-[#25211A] border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-400 hover:dark:border-gray-500 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors w-72"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-300 transition-colors"
        >
          <XIcon size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
type ModalData = {
  clientName:  string;
  stage:       string | null;
  phone:       string;
  email:       string;
  studioName:  string;
  saName:      string;
  weddingDate: unknown;
  shopifyNum:  string;
  amNum:       string | null;
  orderDateRaw: unknown;   // raw ISO value for formatting
  itemNames:   string[];
  subtotal:    number | null;
  shipping:    number | null;
  taxes:       number | null;
  discount:    number | null;
  alterations: number | null;
  m2m:         number | null;
  rushFee:     number | null;
  refunded:    number | null;
  total:       number | null;
};

function OrderModal({ data, onClose }: { data: ModalData; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const FinRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center py-1.5 text-sm border-b border-gray-50 dark:border-white/5 last:border-0">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-800 dark:text-[#F3EFE6] font-medium">{value}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[720px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FEF3C7] dark:bg-[#3A2E12] flex items-center justify-center text-[#D97706] dark:text-[#FBBF24] font-semibold text-sm flex-shrink-0">
              {getInitials(data.clientName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-[#F3EFE6]">{data.clientName || '—'}</h2>
                {data.stage && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border ${getStageColor(data.stage)}`}>
                    {data.stage}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {[data.studioName, data.weddingDate ? `Wedding ${formatDate(data.weddingDate)}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-300 transition-colors ml-4">
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="px-6 py-5 grid grid-cols-2 gap-6">
            {/* Left */}
            <div className="space-y-5">
              <div>
                <span className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 block">Contact</span>
                <div className="space-y-1.5">
                  {data.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <PhoneIcon size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span>{data.phone}</span>
                    </div>
                  )}
                  {data.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <EnvelopeIcon size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span className="truncate">{data.email}</span>
                    </div>
                  )}
                  {!data.phone && !data.email && <span className="text-sm text-gray-400 dark:text-gray-500">—</span>}
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 block">Sales Associate</span>
                <p className="text-sm text-gray-800 dark:text-[#F3EFE6]">{data.saName || '—'}</p>
              </div>

              <div>
                <span className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 block">Order</span>
                <div className="space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                  <div>Shopify <span className="font-medium">{data.shopifyNum || '—'}</span></div>
                  <div>
                    Apparel ID{' '}
                    <span className={`font-medium ${data.amNum ? 'text-[#D97706] dark:text-[#FBBF24]' : 'text-gray-400 dark:text-gray-500'}`}>
                      {data.amNum ? `AM-${data.amNum}` : '—'}
                    </span>
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">{formatDateOrdinal(data.orderDateRaw)}</div>
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 block">Items Sold</span>
                {data.itemNames.length > 0 ? (
                  <div className="space-y-1">
                    {data.itemNames.map((name, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <CircleIcon size={7} className="text-[#FBBF24] flex-shrink-0" weight="fill" />
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                )}
              </div>
            </div>

            {/* Right: Financials */}
            <div>
              <span className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 block">Financials</span>
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
                <FinRow label="Subtotal"        value={fmt$(data.subtotal)} />
                <FinRow label="Shipping"        value={fmt$(data.shipping)} />
                <FinRow label="Taxes"           value={fmt$(data.taxes)} />
                <FinRow label="Discount"        value={fmt$(data.discount)} />
                <FinRow label="Alterations"     value={fmt$(data.alterations)} />
                <FinRow label="Made-to-Measure" value={data.m2m && data.m2m > 0 ? fmt$(data.m2m) : '—'} />
                <FinRow label="Rush Fee"        value={fmt$(data.rushFee)} />
                <FinRow label="Refunded Amount" value={fmt$(data.refunded)} />
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200 dark:border-white/10">
                  <span className="text-sm font-semibold text-gray-900 dark:text-[#F3EFE6]">Total</span>
                  <span className="text-base font-semibold text-[#D97706] dark:text-[#FBBF24]">{fmt$(data.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function SoldApp(): React.ReactElement {
  useTheme();
  const base = useBase();

  const ordersTable  = base.getTableByIdIfExists('tblHFGbijtvZcRPkE');
  const clientsTable = base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c');
  const stylesTable  = base.getTableByIdIfExists('tbl0hWIRBbcB4UkVC');
  const studiosTable = base.getTableByIdIfExists('tblYM02GzeYdYk23v');

  const [modalData, setModalData]         = useState<ModalData | null>(null);
  const [selectedSA, setSelectedSA]       = useState<Set<string>>(new Set());
  const [selectedStore, setSelectedStore] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery]     = useState('');
  const [sortColumn, setSortColumn]       = useState<string | null>(null);
  const [sortDir, setSortDir]             = useState<'asc' | 'desc' | null>(null);

  const orderRecords  = useRecords(ordersTable);
  const clientRecords = useRecords(clientsTable);
  const styleRecords  = useRecords(stylesTable);
  const studioRecords = useRecords(studiosTable);

  const clientNameMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!clientRecords || !clientsTable) return m;
    const f = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_FULL_NAME);
    if (!f) return m;
    for (const c of clientRecords) m.set(c.id, c.getCellValueAsString(f));
    return m;
  }, [clientRecords, clientsTable]);

  const styleNameMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!styleRecords || !stylesTable) return m;
    const f = stylesTable.getFieldIfExists(FIELD_IDS.STYLE_NAME);
    if (!f) return m;
    for (const s of styleRecords) m.set(s.id, s.getCellValueAsString(f));
    return m;
  }, [styleRecords, stylesTable]);

  const activeStudios = useMemo(() => {
    if (!studioRecords || !studiosTable) return [];
    const fActive = studiosTable.getFieldIfExists(FIELD_IDS.STUDIO_IS_ACTIVE);
    const fShort  = studiosTable.getFieldIfExists(FIELD_IDS.STUDIO_SHORT_NAME);
    if (!fShort) return [];
    return studioRecords
      .filter(s => !fActive || s.getCellValue(fActive))
      .map(s => ({ id: s.id, shortName: s.getCellValueAsString(fShort) }))
      .filter(s => s.shortName);
  }, [studioRecords, studiosTable]);

  type OrderRowData = {
    id:           string;
    clientName:   string;
    stage:        string | null;
    phone:        string;
    email:        string;
    studioName:   string;
    studioId:     string;
    saName:       string;
    weddingDate:  unknown;
    shopifyNum:   string;
    amNum:        string | null;
    orderDateRaw: unknown;   // raw getCellValue — ISO string
    itemNames:    string[];
    total:        number | null;
    subtotal:     number | null;
    shipping:     number | null;
    taxes:        number | null;
    discount:     number | null;
    alterations:  number | null;
    m2m:          number | null;
    rushFee:      number | null;
    refunded:     number | null;
  };

  const orderRows = useMemo((): OrderRowData[] => {
    if (!orderRecords || !ordersTable) return [];

    const fShopifyNum  = ordersTable.getFieldIfExists(FIELD_IDS.SHOPIFY_ORDER_NUMBER);
    const fAMNum       = ordersTable.getFieldIfExists(FIELD_IDS.AM_ORDER_NUMBER);
    const fDate        = ordersTable.getFieldIfExists(FIELD_IDS.ORDER_DATE);
    const fItems       = ordersTable.getFieldIfExists(FIELD_IDS.ITEMS);
    const fClientLink  = ordersTable.getFieldIfExists(FIELD_IDS.CLIENT_LINK);
    const fClientPhone = ordersTable.getFieldIfExists(FIELD_IDS.CLIENT_PHONE);
    const fClientStage = ordersTable.getFieldIfExists(FIELD_IDS.CLIENT_STAGE);
    const fClientEmail = ordersTable.getFieldIfExists(FIELD_IDS.CLIENT_EMAIL);
    const fSA          = ordersTable.getFieldIfExists(FIELD_IDS.SALES_ASSOCIATE);
    const fWedding     = ordersTable.getFieldIfExists(FIELD_IDS.WEDDING_DATE);
    const fStoreLink   = ordersTable.getFieldIfExists(FIELD_IDS.STORE_LINK);
    const fTotal       = ordersTable.getFieldIfExists(FIELD_IDS.TOTAL);
    const fSubtotal    = ordersTable.getFieldIfExists(FIELD_IDS.SUBTOTAL);
    const fShipping    = ordersTable.getFieldIfExists(FIELD_IDS.SHIPPING);
    const fTaxes       = ordersTable.getFieldIfExists(FIELD_IDS.TAXES);
    const fDiscount    = ordersTable.getFieldIfExists(FIELD_IDS.DISCOUNT_AMOUNT);
    const fAlts        = ordersTable.getFieldIfExists(FIELD_IDS.ALTERATIONS);
    const fM2M         = ordersTable.getFieldIfExists(FIELD_IDS.M2M);
    const fRush        = ordersTable.getFieldIfExists(FIELD_IDS.RUSH_FEE);
    const fRefunded    = ordersTable.getFieldIfExists(FIELD_IDS.REFUNDED_AMOUNT);

    // Debug: log field resolution + first record sample values
    console.group('[SoldApp] Field resolution check');
    console.log('fDate (ORDER_DATE):', fDate?.name ?? 'NOT FOUND', '| type:', fDate?.type ?? '—');
    console.log('fSA   (SALES_ASSOCIATE):', fSA?.name ?? 'NOT FOUND', '| type:', fSA?.type ?? '—');
    if (orderRecords[0]) {
      const s = orderRecords[0];
      console.log('record[0] orderDate getCellValue:', fDate ? s.getCellValue(fDate) : 'field missing');
      console.log('record[0] SA getCellValue:', fSA ? s.getCellValue(fSA) : 'field missing');
      console.log('record[0] SA getCellValueAsString:', fSA ? s.getCellValueAsString(fSA) : 'field missing');
    }
    console.groupEnd();

    return orderRecords.map(order => {
      const clientLinks = fClientLink ? order.getCellValue(fClientLink) as Array<{ id: string }> | null : null;
      const clientName  = clientLinks?.[0] ? (clientNameMap.get(clientLinks[0].id) ?? '') : '';

      const stage = fClientStage ? getLookupString(order.getCellValue(fClientStage)) || null : null;
      const phone = fClientPhone ? getLookupString(order.getCellValue(fClientPhone)) : '';
      const email = fClientEmail ? getLookupString(order.getCellValue(fClientEmail)) : '';

      // SA is a lookup field — getCellValueAsString is the reliable path
      const saName = fSA
        ? (order.getCellValueAsString(fSA) || getLookupString(order.getCellValue(fSA)))
        : '';

      const storeLinks = fStoreLink ? order.getCellValue(fStoreLink) as Array<{ id: string }> | null : null;
      const storeId    = storeLinks?.[0]?.id ?? '';
      const studioObj  = storeId ? activeStudios.find(s => s.id === storeId) : undefined;
      const studioName = studioObj?.shortName ?? '';

      const weddingDate = fWedding ? order.getCellValue(fWedding) : null;

      const shopifyNumRaw = fShopifyNum ? order.getCellValue(fShopifyNum) as number | null : null;
      const shopifyNum    = shopifyNumRaw ? `#${shopifyNumRaw}` : '';
      const amNumRaw      = fAMNum ? order.getCellValue(fAMNum) as number | null : null;
      const amNum         = amNumRaw ? String(amNumRaw) : null;

      // Store raw ISO value — formatDateOrdinal handles parsing
      const orderDateRaw = fDate ? order.getCellValue(fDate) : null;

      const itemLinks = fItems ? order.getCellValue(fItems) as Array<{ id: string }> | null : null;
      const itemNames = itemLinks ? itemLinks.map(l => styleNameMap.get(l.id) ?? 'Unknown item') : [];

      const getNum = (f: ReturnType<typeof ordersTable.getFieldIfExists>): number | null =>
        f ? order.getCellValue(f) as number | null : null;

      return {
        id: order.id,
        clientName,
        stage,
        phone,
        email,
        studioName,
        studioId:     storeId,
        saName,
        weddingDate,
        shopifyNum,
        amNum,
        orderDateRaw,
        itemNames,
        total:       getNum(fTotal),
        subtotal:    getNum(fSubtotal),
        shipping:    getNum(fShipping),
        taxes:       getNum(fTaxes),
        discount:    getNum(fDiscount),
        alterations: getNum(fAlts),
        m2m:         getNum(fM2M),
        rushFee:     getNum(fRush),
        refunded:    getNum(fRefunded),
      };
    });
  }, [orderRecords, ordersTable, clientNameMap, styleNameMap, activeStudios]);

  const saOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of orderRows) { if (r.saName) s.add(r.saName); }
    return Array.from(s).sort();
  }, [orderRows]);

  const storeOptions = useMemo(() => {
    return activeStudios.map(s => s.shortName).filter(Boolean).sort();
  }, [activeStudios]);

  const filteredRows = useMemo(() => {
    return orderRows.filter(r => {
      const okSA    = selectedSA.size === 0    || selectedSA.has(r.saName);
      const okStore = selectedStore.size === 0 || selectedStore.has(r.studioName);
      const q = searchQuery.toLowerCase();
      const okSearch = !q
        || r.clientName.toLowerCase().includes(q)
        || r.shopifyNum.toLowerCase().includes(q)
        || (r.amNum ? `am-${r.amNum}`.includes(q) || r.amNum.includes(q) : false);
      return okSA && okStore && okSearch;
    });
  }, [orderRows, selectedSA, selectedStore, searchQuery]);

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDir) return filteredRows;
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortColumn) {
        case 'clientName':   aVal = a.clientName;              bVal = b.clientName;              break;
        case 'shopifyNum':   aVal = a.shopifyNum;              bVal = b.shopifyNum;              break;
        case 'amNum':        aVal = a.amNum ?? '';             bVal = b.amNum ?? '';             break;
        case 'orderDateRaw': aVal = String(a.orderDateRaw ?? ''); bVal = String(b.orderDateRaw ?? ''); break;
        case 'itemNames':    aVal = a.itemNames.join(', ');    bVal = b.itemNames.join(', ');    break;
        case 'total':        aVal = a.total ?? 0;              bVal = b.total ?? 0;              break;
        case 'saName':       aVal = a.saName;                  bVal = b.saName;                  break;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number')
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      return sortDir === 'desc'
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });
    return sorted;
  }, [filteredRows, sortColumn, sortDir]);

  const handleColumnClick = useCallback((col: string) => {
    if (sortColumn === col) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortColumn(null); setSortDir(null); }
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  }, [sortColumn, sortDir]);

  const handleRowClick = useCallback((row: OrderRowData) => {
    setModalData({
      clientName:   row.clientName,
      stage:        row.stage,
      phone:        row.phone,
      email:        row.email,
      studioName:   row.studioName,
      saName:       row.saName,
      weddingDate:  row.weddingDate,
      shopifyNum:   row.shopifyNum,
      amNum:        row.amNum,
      orderDateRaw: row.orderDateRaw,
      itemNames:    row.itemNames,
      subtotal:     row.subtotal,
      shipping:     row.shipping,
      taxes:        row.taxes,
      discount:     row.discount,
      alterations:  row.alterations,
      m2m:          row.m2m,
      rushFee:      row.rushFee,
      refunded:     row.refunded,
      total:        row.total,
    });
  }, []);

  const ColHeader = ({ label, colKey }: { label: string; colKey: string }) => {
    const active = sortColumn === colKey;
    return (
      <button
        onClick={() => handleColumnClick(colKey)}
        className="inline-flex items-center gap-1 hover:text-gray-800 hover:dark:text-gray-200 transition-colors"
      >
        {label}
        {active && sortDir === 'desc' && <CaretDownIcon size={11} />}
        {active && sortDir === 'asc'  && <CaretUpIcon   size={11} />}
      </button>
    );
  };

  if (!ordersTable || !clientsTable || !stylesTable || !studiosTable) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8F5EE] dark:bg-[#1B1813]">
        <div className="text-center">
          <p className="text-base font-semibold text-gray-900 dark:text-[#F3EFE6]">Configuration Required</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please configure the required tables in the properties panel.</p>
        </div>
      </div>
    );
  }

  // 7 columns: Client | Shopify # | Apparel ID | Date Sold | Items Purchased | Total | SA
  return (
    <div className="font-sans antialiased flex flex-col h-screen overflow-hidden bg-[#F8F5EE] dark:bg-[#1B1813]">
      {/* Header — filters flush left, no box */}
      <div className="flex-shrink-0 px-6 py-3 flex items-center gap-5">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
        <MultiSelectDropdown
          label="Sales Associate"
          selected={selectedSA}
          options={saOptions}
          onChange={(opt, checked) => {
            const s = new Set(selectedSA);
            if (checked) s.add(opt); else s.delete(opt);
            setSelectedSA(s);
          }}
          onClear={() => setSelectedSA(new Set())}
        />
        <MultiSelectDropdown
          label="Store"
          selected={selectedStore}
          options={storeOptions}
          onChange={(opt, checked) => {
            const s = new Set(selectedStore);
            if (checked) s.add(opt); else s.delete(opt);
            setSelectedStore(s);
          }}
          onClear={() => setSelectedStore(new Set())}
        />
      </div>

      {/* Table container */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="bg-white dark:bg-[#25211A] border border-[#E9E0CE] dark:border-[#38322A] rounded-xl h-full flex flex-col overflow-hidden">
          {/* Sticky header */}
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%'  }} />
              </colgroup>
              <thead>
                <tr>
                  {([
                    ['Client',          'clientName'],
                    ['Shopify #',       'shopifyNum'],
                    ['Apparel ID',      'amNum'],
                    ['Date Sold',       'orderDateRaw'],
                    ['Items Purchased', 'itemNames'],
                    ['Total',           'total'],
                    ['SA',              'saName'],
                  ] as [string, string][]).map(([label, key]) => (
                    <th key={key} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      <ColHeader label={label} colKey={key} />
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable body */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {sortedRows.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-gray-400 dark:text-gray-500">No orders match the current filters.</p>
              </div>
            ) : (
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%'  }} />
                </colgroup>
                <tbody>
                  {sortedRows.map(row => (
                    <tr
                      key={row.id}
                      onClick={() => handleRowClick(row)}
                      className="border-b border-gray-100 dark:border-white/5 hover:bg-[#FEF3C7] hover:dark:bg-[#3A2E12] cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium text-gray-800 dark:text-[#F3EFE6] truncate">{row.clientName || '—'}</div>
                        {row.stage && (
                          <span className={`mt-0.5 inline-flex items-center px-2 py-0 rounded-full text-xs font-medium border ${getStageColor(row.stage)}`}>
                            {row.stage}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">{row.shopifyNum || '—'}</td>
                      <td className="px-3 py-2.5 text-sm">
                        {row.amNum
                          ? <span className="text-[#D97706] dark:text-[#FBBF24] font-medium">AM-{row.amNum}</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/30">Missing</span>
                        }
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">{formatDateOrdinal(row.orderDateRaw)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 truncate">{row.itemNames.join(', ') || '—'}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-[#F3EFE6]">{fmt$(row.total)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 truncate">{row.saName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalData && (
        <OrderModal data={modalData} onClose={() => setModalData(null)} />
      )}
    </div>
  );
}

initializeBlock({ interface: () => <SoldApp /> });
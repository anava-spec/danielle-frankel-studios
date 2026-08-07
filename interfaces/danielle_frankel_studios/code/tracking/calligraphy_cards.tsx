import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table, Field, Record as AirtableRecord } from '@airtable/blocks/interface/models';
import {
  CaretDown as CaretDownIcon,
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CalendarBlank as CalendarBlankIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  X as XIcon,
  Check as CheckIcon,
  WarningCircle as WarningCircleIcon,
  ChatCircleText as ChatCircleTextIcon,
  Paperclip as PaperclipIcon,
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
  // Items Sold and Gown are both lookups (via shopify_order) of Orders -
  // Shopify's "Items" field, which is itself a multipleRecordLinks field —
  // not text. Their raw cell values are nested link structures, so they
  // must go through unwrapLinkedNames() below, not getCellValueAsString().
  CLIENT_ITEM_CATEGORY:         'fldE4AX5gz8pwah4j', // lookup chain terminating in a singleSelect — getCellValueAsString works directly
  CLIENT_DRESS_CREATION_YEAR:   'fldwgDZDs2CNEqPsQ', // number, precision 0 — created in sandbox appMmEE4zyHMGhkkd
  CLIENT_WEDDING_DATE:          'fldbgknumKGS5W5WU',
  CLIENT_CALLIGRAPHY_CARD_SENT: 'fldsBLLXkKPgqlN2e',
  CLIENT_CALLIGRAPHY_CARD_COMMENTS: 'fldfrtzC0BxWggmoU', // long text, created in sandbox appMmEE4zyHMGhkkd — Margo's name-variation notes for the card
} as const;

// ─── Feedback (table tbluy7JS31NwCoeIi) ──────────────────────────────────────
const FEEDBACK_TABLE_ID = 'tbluy7JS31NwCoeIi';
const FEEDBACK_FIELD_IDS = {
  FEEDBACK_TYPE:  'fldMQDSnEDDzqom2A',
  SCOPE:          'fldUpqoPn3ZM8mLck',
  INTERFACE_NAME: 'fldJZKIEJIRPOLIcW',
  PAGE_REPORTED:  'fldJJ7V9ANM7vQZhm',
  DESCRIPTION:    'fld6i3lCiI7ewp4BV',
  ATTACHMENTS:    'fldy05nKrbYFuglld',
  // title/general_name/specific_interface_name are formulas/AI fields, submitted_by/submitted_at
  // are native Created by/Created time — none of these are ever written from here.
} as const;
const FEEDBACK_TYPE_OPTIONS = ['Suggestion', 'Bug Report', 'Question', 'Praise'];
const FEEDBACK_SCOPE_OPTIONS = ['General', 'Specific Interface'];
// Interface/Page are linked records to interface_inventory (self-referential: a "Page" record
// links back to its parent "Interface" record via the interface_inventory `interface` field).
const INTERFACE_INVENTORY_TABLE_ID = 'tblG92AI3ddzlolhz';
const INTERFACE_INVENTORY_FIELD_IDS = {
  NAME:           'flddp1ncA7BD0tacw',
  LEVEL:          'fldYFoQFVFLC1z7EW', // singleSelect: "Interface" | "Page" — compared case-insensitively
  INTERFACE_LINK: 'fldNDPWTrcNzSD5zS', // on a "Page" record, links to its parent "Interface" record
} as const;

let _feedbackWriteQueue = Promise.resolve();
function queueFeedbackWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = _feedbackWriteQueue.then(fn);
  _feedbackWriteQueue = next.then(() => {}, () => {});
  return next;
}

function FeedbackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="fixed bottom-4 right-20 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#D97706] hover:bg-[#B45309] dark:bg-[#FBBF24] dark:hover:bg-[#F59E0B] text-white dark:text-[#1B1813] shadow-2xl transition-colors"
      style={{ zIndex: 9600 }}>
      <ChatCircleTextIcon size={16} /> Feedback
    </button>
  );
}

function FeedbackSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: Array<{ id: string; name: string }>; placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);
  const selected = options.find(o => o.id === value);
  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setIsOpen(v => !v)}
        className="w-full inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#1e1d1b] hover:border-gray-400 dark:hover:border-white/20 transition-colors">
        <span className={selected ? "text-gray-700 dark:text-gray-200 truncate" : "text-gray-400 dark:text-gray-500 truncate"}>
          {selected ? selected.name : (placeholder ?? "Select…")}
        </span>
        <CaretDownIcon size={13} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg shadow-lg z-50">
          <div className="max-h-60 overflow-y-auto py-1" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
            {options.map(o => (
              <button key={o.id} type="button" onClick={() => { onChange(o.id); setIsOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors truncate ${
                  o.id === value ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300" : "hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200"
                }`}>
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackModal({ base, onClose }: { base: ReturnType<typeof useBase>; onClose: () => void }) {
  const [feedbackType, setFeedbackType] = useState('');
  const [scope, setScope] = useState('');
  const [interfaceId, setInterfaceId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<Array<{ url: string; filename: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const interfaceInventoryTable = base.getTableByIdIfExists(INTERFACE_INVENTORY_TABLE_ID);
  const interfaceInventoryRecords = useRecords(interfaceInventoryTable ?? undefined);
  const inventoryNameField  = interfaceInventoryTable?.getFieldIfExists(INTERFACE_INVENTORY_FIELD_IDS.NAME) ?? null;
  const inventoryLevelField = interfaceInventoryTable?.getFieldIfExists(INTERFACE_INVENTORY_FIELD_IDS.LEVEL) ?? null;
  const inventoryInterfaceLinkField = interfaceInventoryTable?.getFieldIfExists(INTERFACE_INVENTORY_FIELD_IDS.INTERFACE_LINK) ?? null;

  const interfaceOptions = useMemo(() => {
    if (!inventoryNameField || !inventoryLevelField) return [];
    return (interfaceInventoryRecords ?? [])
      .filter(r => ((r.getCellValue(inventoryLevelField) as { name: string } | null)?.name ?? '').toLowerCase() === 'interface')
      .map(r => ({ id: r.id, name: (r.getCellValue(inventoryNameField) as string | null) ?? '(untitled)' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [interfaceInventoryRecords, inventoryNameField, inventoryLevelField]);

  const pageOptions = useMemo(() => {
    if (!inventoryNameField || !inventoryLevelField || !inventoryInterfaceLinkField || !interfaceId) return [];
    return (interfaceInventoryRecords ?? [])
      .filter(r => {
        const isPage = ((r.getCellValue(inventoryLevelField) as { name: string } | null)?.name ?? '').toLowerCase() === 'page';
        if (!isPage) return false;
        const links = r.getCellValue(inventoryInterfaceLinkField) as Array<{ id: string }> | null;
        return !!links?.some(l => l.id === interfaceId);
      })
      .map(r => ({ id: r.id, name: (r.getCellValue(inventoryNameField) as string | null) ?? '(untitled)' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [interfaceInventoryRecords, inventoryNameField, inventoryLevelField, inventoryInterfaceLinkField, interfaceId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const missingRequired = !feedbackType || !scope || !description.trim() ||
    (scope === 'Specific Interface' && (!interfaceId || !pageId));

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setFiles(prev => [...prev, { url: reader.result as string, filename: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (missingRequired) return;
    const feedbackTable = base.getTableByIdIfExists(FEEDBACK_TABLE_ID);
    if (!feedbackTable) { setError('Feedback table not found'); return; }
    setError(null); setSubmitting(true);
    try {
      const fields: Record<string, unknown> = {
        [FEEDBACK_FIELD_IDS.FEEDBACK_TYPE]: { name: feedbackType },
        [FEEDBACK_FIELD_IDS.SCOPE]: { name: scope },
        [FEEDBACK_FIELD_IDS.DESCRIPTION]: description.trim(),
      };
      if (scope === 'Specific Interface') {
        fields[FEEDBACK_FIELD_IDS.INTERFACE_NAME] = interfaceId ? [{ id: interfaceId }] : [];
        fields[FEEDBACK_FIELD_IDS.PAGE_REPORTED] = pageId ? [{ id: pageId }] : [];
      }
      if (files.length) fields[FEEDBACK_FIELD_IDS.ATTACHMENTS] = files;
      await queueFeedbackWrite(() => feedbackTable.createRecordAsync(fields));
      onClose();
    } catch (e: unknown) {
      console.error('Failed to submit feedback', e);
      setError(e instanceof Error ? e.message : 'Failed to submit feedback');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 9700 }} onClick={onClose}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200 dark:border-[#34312C]"
        style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-[#34312C] flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-[#F5F3EF]">Feedback</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Flag an issue or share an idea.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Feedback Type <span className="text-red-400">*</span></label>
              <FeedbackSelect value={feedbackType} onChange={setFeedbackType}
                options={FEEDBACK_TYPE_OPTIONS.map(o => ({ id: o, name: o }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Scope <span className="text-red-400">*</span></label>
              <FeedbackSelect value={scope} onChange={v => { setScope(v); setInterfaceId(null); setPageId(null); }}
                options={FEEDBACK_SCOPE_OPTIONS.map(o => ({ id: o, name: o }))} />
            </div>
          </div>
          {scope === 'Specific Interface' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Interface <span className="text-red-400">*</span></label>
                <FeedbackSelect value={interfaceId ?? ''} onChange={v => { setInterfaceId(v || null); setPageId(null); }}
                  options={interfaceOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Page <span className="text-red-400">*</span></label>
                <FeedbackSelect value={pageId ?? ''} onChange={v => setPageId(v || null)}
                  options={pageOptions} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description <span className="text-red-400">*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 2000))} rows={6}
              className="w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none resize-none transition-colors"
              placeholder="Please provide detailed feedback…" />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">{description.length}/2000</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Attachments</label>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full border border-dashed border-gray-300 dark:border-[#34312C] rounded-lg px-3 py-4 text-sm text-gray-500 dark:text-gray-400 hover:border-[#D97706] hover:text-[#D97706] dark:hover:border-[#FBBF24] dark:hover:text-[#FBBF24] transition-colors flex items-center justify-center gap-1.5">
              <PaperclipIcon size={14} /> Choose images or videos
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
              onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-sm text-gray-600 dark:text-gray-300">
                    {f.filename}
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-500 transition-colors"><XIcon size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#34312C] flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || missingRequired}
            className={[
              'px-4 py-2 text-sm rounded-lg bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] font-medium transition-colors disabled:cursor-not-allowed',
              (submitting || missingRequired) ? 'opacity-50' : 'hover:bg-[#B45309] dark:hover:bg-[#F59E0B]',
            ].join(' ')}>
            {submitting ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

// ─── Qualification floor (always-on, not a UI toggle) ──────────────────────────
// A client only ever belongs on this list if Item Category (fldE4AX5gz8pwah4j)
// contains at least one category that is NOT shoes or veil. Approved
// deviation from the original AC, since the physical card is generated by a
// separate process and this page only tracks status for clients who
// actually have a qualifying item.
// An EMPTY Item Category (no orders at all, so nothing to categorize) is
// NOT excluded here — that's controlled by the visible "Items Sold" filter
// below instead (default: hidden), so the user can choose to see those
// clients rather than have them silently disappear from this hard floor.
const EXCLUDED_ONLY_ITEM_CATEGORIES = ['shoes', 'veil'];
function qualifiesNotOnlyShoesOrVeil(categoryNames: string[]): boolean {
  if (categoryNames.length === 0) return true;
  return categoryNames.some(name => !EXCLUDED_ONLY_ITEM_CATEGORIES.includes(name.trim().toLowerCase()));
}

// ─── Nested-lookup unwrapping ──────────────────────────────────────────────────
// Items Sold and Gown are lookups of a multipleRecordLinks field ("Items" on
// Orders - Shopify), not a text/formula field — their raw cell value is an
// array of per-linked-record entries, each of which may itself be a plain
// string, or an object shaped like { linkedRecordId, value } whose `value` is
// the resolved linked-record name(s) (or another nested array/object, for a
// lookup chain more than one hop deep). getCellValueAsString does not reliably
// flatten this in this runtime (same underlying quirk BRANDING.md §9 and
// did_not_convert.tsx's unwrapLookupString document) — recurse and collect
// every `name`/string found instead of assuming a fixed shape.
function unwrapLinkedNames(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(unwrapLinkedNames);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name.trim() ? [obj.name.trim()] : [];
    if ('value' in obj) return unwrapLinkedNames(obj.value);
    return Object.values(obj).flatMap(unwrapLinkedNames);
  }
  return [];
}
function getLinkedNamesDisplay(value: unknown): string {
  return unwrapLinkedNames(value).join(', ');
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
        className={`inline-flex items-center justify-between gap-2 min-w-[170px] bg-white dark:bg-[#242220] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
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

// ─── Airtable select-color resolution ──────────────────────────────────────────
// All four Airtable intensity tiers (base/Bright/Light1/Light2) resolve to the
// same high-contrast bg-100/text-800 formula per hue, matching this project's
// established pattern (see appointments.tsx) for turning real field-choice
// colors into pill classes instead of a hardcoded per-value map.
const AIRTABLE_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  blueBright: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  blueLight1: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  blueLight2: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  cyanBright: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  cyanLight1: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  cyanLight2: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  green: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  greenBright: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  greenLight1: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  greenLight2: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  gray: 'bg-gray-200 dark:bg-white/15 text-gray-800 dark:text-[#F3EFE6] border-gray-300 dark:border-white/15',
  grayBright: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#38322A]',
  grayLight1: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#38322A]',
  grayLight2: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#38322A]',
};
const DEFAULT_STATUS_PILL_CLASSES = 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#38322A]';

// Resolves a singleSelect field's real Airtable choices (name + color, in the
// field's own schema order) so both the available options AND their colors
// stay in sync with whatever is configured on the field in Airtable — never
// hardcode a status list or a status→color map (per BRANDING.md §9). Schema
// order matters here specifically because the Calligraphy Status flow is
// sequential (Pending → Production Approved → Sent to Calligrapher →
// Received from Calligrapher) and the "advance to next step" button below
// relies on this order, not a hardcoded array.
function getFieldChoices(field: Field | null | undefined): Array<{ name: string; color: string }> {
  if (!field) return [];
  const opts = field.options as unknown as { choices?: Array<{ name: string; color?: string }> } | undefined;
  return (opts?.choices ?? []).filter(c => !!c?.name).map(c => ({ name: c.name, color: c.color ?? '' }));
}
function getFieldChoiceColorMap(field: Field | null | undefined): Map<string, string> {
  return new Map(getFieldChoices(field).map(c => [c.name, c.color]));
}

// ─── StatusPillDropdown ─────────────────────────────────────────────────────────
// Clicking the pill opens a small options panel (BRANDING.md §5 dropdown
// pattern — surface/border/shadow, click-outside-to-close) instead of
// toggling the value directly, so the user picks the next status explicitly
// rather than the click silently flipping it to whatever the "other" value
// happens to be.
interface StatusPillDropdownProps {
  value: string | null;
  colorMap: Map<string, string>;
  options: string[];
  onSelect: (next: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}
function StatusPillDropdown({ value, colorMap, options, onSelect, disabled = false, hasError = false }: StatusPillDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  function pillClasses(forValue: string | null): string {
    if (hasError) return 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border-red-300 dark:border-red-500/40';
    const colorName = forValue ? colorMap.get(forValue) : null;
    return colorName ? (AIRTABLE_COLOR_MAP[colorName] ?? DEFAULT_STATUS_PILL_CLASSES) : DEFAULT_STATUS_PILL_CLASSES;
  }

  return (
    <div ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button type="button" disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${pillClasses(value)} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-95'}`}>
        {value || '—'}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-lg w-[140px] py-1">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onSelect(opt); setOpen(false); }}
              className={`w-full flex items-center px-3 py-1.5 transition-colors ${
                opt === value ? 'bg-amber-50 dark:bg-amber-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${pillClasses(opt)}`}>
                {opt}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CommentsCell ───────────────────────────────────────────────────────────────
// Free-text long-text field for Margo to jot name-variation notes for the
// calligraphy card (e.g. nicknames, hyphenation, "goes by middle name"). Local
// state so typing doesn't fight the record's live value on every keystroke;
// only writes on blur, matching the borderless-editable-cell convention
// (BRANDING.md §10b) rather than a boxed input that reads as a separate control.
interface CommentsCellProps {
  value: string;
  disabled: boolean;
  hasError: boolean;
  onSave: (next: string) => void;
}
function CommentsCell({ value, disabled, hasError, onSave }: CommentsCellProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setDraft(value); }, [value]);
  // Fills whatever vertical space is left in its flex parent by default (via
  // flex-1 below — this is what "compensates" the blank space left over when
  // the popup is resized, 2026-08-04), and only grows taller than that when
  // its own content actually needs more room than the flex-allocated space —
  // clearing the inline height first lets the flex box re-claim its normal
  // fill-the-remaining-space size, then scrollHeight vs. clientHeight tells
  // us whether the content overflows that size and needs to push taller.
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '';
    const flexHeight = el.clientHeight;
    if (el.scrollHeight > flexHeight) {
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);
  useEffect(() => { resize(); }, [draft, resize]);
  // Re-measure on window resize too — the popup's own height is a percentage
  // of the window height, so resizing the window changes how much space is
  // actually left for Comments to fill.
  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);
  return (
    <textarea
      ref={ref}
      value={draft}
      disabled={disabled}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft); }}
      placeholder={disabled ? '—' : 'Name variations for the card…'}
      rows={2}
      className={`w-full flex-1 min-h-0 resize-none overflow-hidden bg-white dark:bg-[#1e1d1b] text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 outline-none rounded-lg border px-3 py-2 transition-colors ${
        hasError ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-[#34312C] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-400'} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
  );
}

// ─── Airtable color → real hex (for progressive dot/line coloring) ────────────
// AIRTABLE_COLOR_MAP above gives Tailwind classes for flat pills; the stepper
// needs actual hex values so the connecting line between two steps can
// gradient from one step's color into the next's. Light1/Light2/Bright tiers
// escalate to the same color family's Dark1 (same convention BRANDING.md §9
// and pipeline.tsx's StagePipeline already use, for contrast on a cream bg).
const AIRTABLE_HEX: Record<string, string> = {
  blue: '#2D7FF9', blueDark1: '#2750AE', blueLight1: '#9CC7FF', blueLight2: '#CBDEFF', blueBright: '#2D7FF9',
  cyan: '#18BFFF', cyanDark1: '#0B76A6', cyanLight1: '#96D7FF', cyanLight2: '#BFEEFF', cyanBright: '#18BFFF',
  teal: '#20D9D2', tealDark1: '#06A09B', tealLight1: '#A1EEE3', tealLight2: '#CBF6EF', tealBright: '#20D9D2',
  green: '#20C933', greenDark1: '#338A17', greenLight1: '#93E88B', greenLight2: '#C7FFC4', greenBright: '#20C933',
  yellow: '#FCAB00', yellowDark1: '#B87503', yellowLight1: '#FFE281', yellowLight2: '#FFEEA9', yellowBright: '#FCAB00',
  orange: '#FF6F2C', orangeDark1: '#D74D26', orangeLight1: '#FEC190', orangeLight2: '#FFDAB9', orangeBright: '#FF6F2C',
  red: '#F82B60', redDark1: '#BA1E45', redLight1: '#FF9EAB', redLight2: '#FFDCE5', redBright: '#F82B60',
  pink: '#FF08C2', pinkDark1: '#C22890', pinkLight1: '#FCB8EE', pinkLight2: '#FEDAF6', pinkBright: '#FF08C2',
  purple: '#8B46FF', purpleDark1: '#6B1FBB', purpleLight1: '#C2A0FA', purpleLight2: '#DEC9FD', purpleBright: '#8B46FF',
  gray: '#9AA0A6', grayDark1: '#6C7177', grayLight1: '#D1D5D9', grayLight2: '#E9EBED', grayBright: '#9AA0A6',
};
function resolveStatusHex(colorName: string): string {
  const base = colorName.replace(/Light[12]$/, '').replace(/Bright$/, '');
  return AIRTABLE_HEX[base + 'Dark1'] ?? AIRTABLE_HEX[colorName] ?? AIRTABLE_HEX[base] ?? '#9CA3AF';
}

// ─── StatusStepper ──────────────────────────────────────────────────────────────
// Horizontal dots-and-line progress indicator, same visual language as
// pipeline.tsx's "Stage in pipeline" component on the Full Client Profile —
// colored from the field's own real Airtable choice colors (via
// getFieldChoices), never hardcoded. The line between two already-passed
// steps is solid; the segment leading into the current step gradients from
// the previous step's color into the current one's, so the whole line reads
// as a progressive fill rather than an abrupt on/off switch.
interface StatusStepperProps { choices: Array<{ name: string; color: string }>; currentValue: string | null; }
function StatusStepper({ choices, currentValue }: StatusStepperProps) {
  const currentIndex = currentValue ? choices.findIndex(c => c.name === currentValue) : -1;
  return (
    <div className="flex items-start">
      {choices.map((choice, index) => {
        const isCurrent = index === currentIndex;
        const isPast = currentIndex >= 0 && index < currentIndex;
        const hex = resolveStatusHex(choice.color);
        return (
          <React.Fragment key={choice.name}>
            <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
              {isPast ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: hex }}>
                  <CheckIcon size={12} weight="bold" color="white" />
                </div>
              ) : isCurrent ? (
                <div className="w-6 h-6 rounded-full border-2 bg-white dark:bg-[#242220] flex items-center justify-center" style={{ borderColor: hex }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-white/10 bg-white dark:bg-[#242220]" />
              )}
              <span className={`text-sm mt-2 text-center whitespace-nowrap ${isCurrent ? 'font-semibold text-gray-900 dark:text-[#F5F3EF]' : 'text-gray-500 dark:text-gray-400'}`}>
                {choice.name}
              </span>
            </div>
            {index < choices.length - 1 && (() => {
              const isFullyPassed = index < currentIndex - 1;
              const isEnteringCurrent = index === currentIndex - 1;
              const background = isFullyPassed ? hex
                : isEnteringCurrent ? `linear-gradient(to right, ${hex}, ${resolveStatusHex(choices[index + 1].color)})`
                : undefined;
              return (
                <div className="flex-1 h-0.5 mt-3 mx-1 bg-gray-300 dark:bg-white/10" style={background ? { background } : undefined} />
              );
            })()}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── AdvanceConfirmPopover ──────────────────────────────────────────────────────
// A small popover anchored under the "Move to next step" button (2026-08-03
// correction — previously a full-screen dim+blur modal). No backdrop at all,
// deliberately by request: a short line of text and a single "Continue"
// action, still the only way to dismiss it (no X, no Cancel, no
// outside-click) — same intentional deviation from every other modal in this
// project as before, just relocated from center-screen to inline.
interface AdvanceConfirmPopoverProps { nextStatus: string; onContinue: () => void; }
function AdvanceConfirmPopover({ nextStatus, onContinue }: AdvanceConfirmPopoverProps) {
  return (
    <div className="absolute right-0 top-full mt-2 z-20 w-64 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl shadow-xl p-4">
      <p className="text-sm text-gray-800 dark:text-gray-200 mb-3">Mark as "{nextStatus}"?</p>
      <button type="button" onClick={onContinue}
        className="w-full px-3 py-2 rounded-md bg-amber-600 dark:bg-amber-400 text-white dark:text-[#25211A] text-sm font-medium hover:bg-amber-700 dark:hover:bg-amber-300 transition-colors">
        Continue
      </button>
    </div>
  );
}

// ─── Detail page building blocks (BRANDING.md-style FieldRow/DetailRow) ────────
// No section wrapper/header (2026-08-03 — the whole body is one box, only the
// title bar is separate). Field titles (not section headers) carry the
// larger font size per that same request.
// Column count varies by row (4 fields in the top row, single-field rows for
// Items Sold / Comments below) — not a fixed 3-per-row grid.
function FieldRow({ cols = 3, children }: { cols?: number; children: React.ReactNode }) {
  const gridCols = cols === 4 ? 'grid-cols-4' : cols === 2 ? 'grid-cols-2' : cols === 1 ? 'grid-cols-1' : 'grid-cols-3';
  return <div className={`grid ${gridCols} gap-4`}>{children}</div>;
}
function DetailRow({ label, value, tooltip }: { label: string; value: React.ReactNode; tooltip?: string }) {
  return (
    <div>
      <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide" title={tooltip}>
        {label}
      </div>
      <div className="text-sm text-gray-800 dark:text-gray-200 font-medium mt-0.5 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

// ─── ClientDetailModal ──────────────────────────────────────────────────────────
// A popup, not a full page (2026-07-30 correction) — fade+scale in/out per
// BRANDING.md §12, 720px-class modal width, no "Go back" (there's nowhere to
// navigate back to). Closes via backdrop click or Escape only — no X (removed
// 2026-08-03). The client name and the "Move to next step" action both live
// in the title bar; its own advance-confirmation is a small popover anchored
// under the button (see AdvanceConfirmPopover), not a separate full modal.
interface ClientDetailModalProps {
  record: AirtableRecord;
  fields: Record<string, Field | null>;
  statusChoices: Array<{ name: string; color: string }>;
  canWrite: boolean;
  hasStatusError: boolean;
  hasCommentError: boolean;
  onAdvanceRequest: (nextStatus: string) => void;
  onSaveComments: (next: string) => void;
  onClose: () => void;
}
function ClientDetailModal({
  record, fields, statusChoices, canWrite, hasStatusError, hasCommentError,
  onAdvanceRequest, onSaveComments, onClose,
}: ClientDetailModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [confirmingAdvance, setConfirmingAdvance] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
  const fDue = fields[FIELD_IDS.CLIENT_DUE_DATE];
  const fItems = fields[FIELD_IDS.CLIENT_ITEMS_SOLD];
  const fGown = fields[FIELD_IDS.CLIENT_GOWN_NAME];
  const fDressYear = fields[FIELD_IDS.CLIENT_DRESS_CREATION_YEAR];
  const fWedding = fields[FIELD_IDS.CLIENT_WEDDING_DATE];
  const fSent = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_SENT];
  const fComments = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_COMMENTS];

  const name = fName ? (record.getCellValueAsString(fName) ?? '') : '';
  const dueStr = fDue ? (record.getCellValue(fDue) as string | null) : null;
  // Items Sold is now plain comma-joined text here, not pills — per request.
  const itemsStr = fItems ? getLinkedNamesDisplay(record.getCellValue(fItems)) : '';
  const gownStr = fGown ? getLinkedNamesDisplay(record.getCellValue(fGown)) : '';
  const dressYearStr = fDressYear ? (record.getCellValueAsString(fDressYear) ?? '') : '';
  const weddingStr = fWedding ? (record.getCellValue(fWedding) as string | null) : null;
  const statusValue = fSent ? (record.getCellValue(fSent) as { name: string } | null)?.name ?? null : null;
  const commentsStr = fComments ? (record.getCellValueAsString(fComments) ?? '') : '';

  const currentIndex = statusValue ? statusChoices.findIndex(c => c.name === statusValue) : -1;
  const nextChoice = currentIndex >= 0 && currentIndex < statusChoices.length - 1 ? statusChoices[currentIndex + 1] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible ? 1 : 0 }}
      onClick={requestClose}
    >
      <div
        className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[720px] h-[60vh] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'scale(1)' : 'scale(0.96)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar — client name + Move to next step (no close button, per request) */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-[#34312C]">
          <div className="text-xl font-bold text-gray-900 dark:text-[#F5F3EF] truncate">{name || 'Unknown Client'}</div>
          {canWrite && nextChoice && (
            <div className="relative flex-shrink-0">
              <button type="button" onClick={() => setConfirmingAdvance(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  hasStatusError ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-500/40'
                                 : 'bg-amber-600 dark:bg-amber-400 text-white dark:text-[#25211A] hover:bg-amber-700 dark:hover:bg-amber-300'}`}>
                Move to next step
              </button>
              {confirmingAdvance && (
                <AdvanceConfirmPopover
                  nextStatus={nextChoice.name}
                  onContinue={() => { onAdvanceRequest(nextChoice.name); setConfirmingAdvance(false); }}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          <div className="flex-shrink-0 space-y-4">
            <StatusStepper choices={statusChoices} currentValue={statusValue} />

            <FieldRow cols={4}>
              <DetailRow label="Wedding Date" value={formatDate(weddingStr)} />
              <DetailRow label="Due Date" value={formatDate(dueStr)} tooltip="3 months before the wedding date — target date to have the card ready" />
              <DetailRow label="Gown" value={gownStr || '—'} />
              <DetailRow label="Dress Year" value={dressYearStr || '—'} />
            </FieldRow>
            <FieldRow cols={1}>
              <DetailRow label="Items Sold" value={itemsStr || '—'} />
            </FieldRow>
          </div>

          {/* Fills whatever vertical space is left below the fields, instead
              of leaving it blank — see CommentsCell's own comment. */}
          <div className="flex-1 min-h-0 flex flex-col mt-4">
            <div className="flex-shrink-0 text-sm text-gray-400 dark:text-gray-500 tracking-wide mb-0.5">Comments</div>
            <CommentsCell
              value={commentsStr}
              disabled={!canWrite}
              hasError={hasCommentError}
              onSave={onSaveComments}
            />
          </div>
        </div>
      </div>
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

// ─── CalligraphyCardsApp ────────────────────────────────────────────────────────
function CalligraphyCardsApp(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
  const clientsTable = (customPropertyValueByKey.clientsTable as Table | undefined) ?? null;

  const [calligraphyFilter, setCalligraphyFilter] = useState<string | null>('Pending');
  const [weddingDateFilter, setWeddingDateFilter] = useState<'upcoming' | 'past' | null>('upcoming');
  // Visible filter — default hides clients with a blank Items Sold (no
  // orders at all). Not clearable to "off"; it's always one of these two
  // states, so a plain two-way toggle rather than the clearable
  // SingleSelectDropdown pattern used for the other filters.
  const [itemsSoldFilter, setItemsSoldFilter] = useState<'hideEmpty' | 'showAll'>('hideEmpty');
  const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [updateErrors, setUpdateErrors] = useState<Record<string, boolean>>({});
  // Detail page navigation — separate from selectedClientId (which is a
  // search-driven table filter, not a page). Clicking a row opens the detail
  // page; clicking the Status pill inside a row must not (it stops
  // propagation itself in StatusPillDropdown).
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const fields = useMemo(() => {
    if (!clientsTable) return {};
    return Object.fromEntries(
      Object.entries(FIELD_IDS).map(([, id]) => [id, clientsTable.getFieldIfExists(id)])
    );
  }, [clientsTable]);

  const allRecords = useRecords(clientsTable ?? null);
  const canWrite = clientsTable ? clientsTable.hasPermissionToUpdateRecords() : false;

  // Read straight from the field's own schema — never hardcode the status
  // list (2026-07-30 request), since it's still expected to keep changing.
  // Schema order is what makes the sequential "advance to next" flow work.
  const statusChoices = useMemo(
    () => getFieldChoices(fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_SENT]),
    [fields]
  );

  const handleSetCalligraphyCard = useCallback(async (recordId: string, nextValue: string) => {
    const field = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_SENT];
    if (!clientsTable || !field) return;
    setUpdateErrors(prev => ({ ...prev, [recordId]: false }));
    try {
      await clientsTable.updateRecordAsync(recordId, { [field.id]: { name: nextValue } });
    } catch (err) {
      console.error('Failed to update calligraphy_card_sent', err);
      setUpdateErrors(prev => ({ ...prev, [recordId]: true }));
    }
  }, [clientsTable, fields]);

  const [commentErrors, setCommentErrors] = useState<Record<string, boolean>>({});
  const handleSetComments = useCallback(async (recordId: string, nextValue: string) => {
    const field = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_COMMENTS];
    if (!clientsTable || !field) return;
    setCommentErrors(prev => ({ ...prev, [recordId]: false }));
    try {
      await clientsTable.updateRecordAsync(recordId, { [field.id]: nextValue || null });
    } catch (err) {
      console.error('Failed to update calligraphy_card_comments', err);
      setCommentErrors(prev => ({ ...prev, [recordId]: true }));
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
    const fItemCategory = fields[FIELD_IDS.CLIENT_ITEM_CATEGORY];
    const fItems = fields[FIELD_IDS.CLIENT_ITEMS_SOLD];
    const today = getTodayLocalString();
    const selectedDueStr = selectedDueDate ? getLocalDateString(selectedDueDate) : null;

    let recs = allRecords.filter(rec => {
      // Qualification floor — always applied, not a user-facing filter.
      // Item Category is ALSO a lookup through a link field (shopify_order),
      // same nested-structure quirk as Items Sold/Gown — getCellValueAsString
      // returns blank for it too, so it must go through the same raw-value
      // unwrap as the other two lookup columns, not a plain string read.
      const itemCategoryNames = fItemCategory ? unwrapLinkedNames(rec.getCellValue(fItemCategory)) : [];
      if (!qualifiesNotOnlyShoesOrVeil(itemCategoryNames)) return false;
      // Visible Items Sold filter — replaces the old hard exclusion of
      // empty-category (i.e. no-orders) clients; now the user chooses.
      if (itemsSoldFilter === 'hideEmpty' && fItems) {
        const itemsStr = getLinkedNamesDisplay(rec.getCellValue(fItems));
        if (!itemsStr.trim()) return false;
      }
      if (calligraphyFilter && fSent) {
        const statusName = (rec.getCellValue(fSent) as { name: string } | null)?.name ?? null;
        if (statusName !== calligraphyFilter) return false;
      }
      if (weddingDateFilter && fWedding) {
        const wd = rec.getCellValue(fWedding) as string | null;
        if (!wd) return false;
        const wdLocal = getLocalDateString(new Date(wd));
        if (weddingDateFilter === 'upcoming' && wdLocal < today) return false;
        if (weddingDateFilter === 'past' && wdLocal >= today) return false;
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
  }, [allRecords, fields, calligraphyFilter, weddingDateFilter, selectedDueDate, selectedClientId, itemsSoldFilter]);

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

  const openRecord = openRecordId ? (allRecords?.find(r => r.id === openRecordId) ?? null) : null;

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
        <SingleSelectDropdown
          label="Wedding Date"
          value={weddingDateFilter}
          onChange={v => setWeddingDateFilter(v as 'upcoming' | 'past' | null)}
          options={[
            { value: 'upcoming', label: 'Upcoming Wedding Dates' },
            { value: 'past', label: 'Past Wedding Dates' },
          ]}
        />
        <SingleSelectDropdown
          label="Calligraphy Status"
          value={calligraphyFilter}
          onChange={setCalligraphyFilter}
          options={statusChoices.map(c => ({ value: c.name, label: c.name }))}
          align="right"
        />
        {/* Not a clearable filter (unlike the dropdowns above) — always one of
            two states, so a plain toggle button rather than SingleSelectDropdown. */}
        <button type="button"
          onClick={() => setItemsSoldFilter(f => f === 'hideEmpty' ? 'showAll' : 'hideEmpty')}
          title={itemsSoldFilter === 'hideEmpty' ? 'Clients with blank Items Sold are hidden — click to show them' : 'Showing all clients, including blank Items Sold — click to hide them'}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap ${
            itemsSoldFilter === 'hideEmpty'
              ? 'border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300 bg-white dark:bg-[#242220]'
              : 'border-gray-300 dark:border-[#34312C] text-gray-500 dark:text-gray-400 bg-white dark:bg-[#242220] hover:border-gray-400 dark:hover:border-gray-500'}`}>
          {itemsSoldFilter === 'hideEmpty' ? 'Hiding Empty Items Sold' : 'Showing All (Items Sold)'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-6 pb-4 flex flex-col">
        <div className="bg-white dark:bg-[#242220] border border-[#E5E1DA] dark:border-[#34312C] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1e1d1b]">
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[90px]">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[160px]">Client</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[120px]">Due Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[180px]">Items Sold</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[160px]">Gown</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[100px]">Dress Year</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[120px]">Wedding Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No clients match the current filters.</td>
                  </tr>
                ) : filteredRecords.map(rec => {
                  const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
                  const fDue = fields[FIELD_IDS.CLIENT_DUE_DATE];
                  const fItems = fields[FIELD_IDS.CLIENT_ITEMS_SOLD];
                  const fGown = fields[FIELD_IDS.CLIENT_GOWN_NAME];
                  const fDressYear = fields[FIELD_IDS.CLIENT_DRESS_CREATION_YEAR];
                  const fWedding = fields[FIELD_IDS.CLIENT_WEDDING_DATE];
                  const fSent = fields[FIELD_IDS.CLIENT_CALLIGRAPHY_CARD_SENT];

                  const name = fName ? (rec.getCellValueAsString(fName) ?? '') : '';
                  const dueStr = fDue ? (rec.getCellValue(fDue) as string | null) : null;
                  const itemsStr = fItems ? getLinkedNamesDisplay(rec.getCellValue(fItems)) : '';
                  const gownStr = fGown ? getLinkedNamesDisplay(rec.getCellValue(fGown)) : '';
                  const dressYearStr = fDressYear ? (rec.getCellValueAsString(fDressYear) ?? '') : '';
                  const weddingStr = fWedding ? (rec.getCellValue(fWedding) as string | null) : null;
                  const statusValue = fSent ? (rec.getCellValue(fSent) as { name: string } | null)?.name ?? null : null;
                  const statusColorMap = getFieldChoiceColorMap(fSent);

                  return (
                    <tr key={rec.id} onClick={() => setOpenRecordId(rec.id)}
                      className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                      <td className="px-3 py-2.5">
                        <StatusPillDropdown
                          value={statusValue}
                          colorMap={statusColorMap}
                          options={statusChoices.map(c => c.name)}
                          disabled={!canWrite}
                          hasError={!!updateErrors[rec.id]}
                          onSelect={next => handleSetCalligraphyCard(rec.id, next)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-[#F5F3EF]">{name || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDate(dueStr)}</td>
                      <td className="px-3 py-2.5">{renderPills(itemsStr)}</td>
                      <td className="px-3 py-2.5">{renderPills(gownStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{dressYearStr || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDate(weddingStr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openRecord && (
        <ClientDetailModal
          key={openRecord.id}
          record={openRecord}
          fields={fields}
          statusChoices={statusChoices}
          canWrite={canWrite}
          hasStatusError={!!updateErrors[openRecord.id]}
          hasCommentError={!!commentErrors[openRecord.id]}
          onAdvanceRequest={nextStatus => handleSetCalligraphyCard(openRecord.id, nextStatus)}
          onSaveComments={next => handleSetComments(openRecord.id, next)}
          onClose={() => setOpenRecordId(null)}
        />
      )}

      <FeedbackButton onClick={() => setShowFeedbackModal(true)} />
      {showFeedbackModal && <FeedbackModal base={base} onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}

initializeBlock({ interface: () => <CalligraphyCardsApp /> });

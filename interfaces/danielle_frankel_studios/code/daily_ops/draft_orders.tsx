import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  CellRenderer,
  useColorScheme,
  useSession,
} from '@airtable/blocks/interface/ui';
import type { Table, Field, Record as AirtableRecord } from '@airtable/blocks/interface/models';
import {
  Plus as PlusIcon,
  X as XIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ArrowLeft as ArrowLeftIcon,
  CaretDown as CaretDownIcon,
  CurrencyDollar as CurrencyDollarIcon,
  Percent as PercentIcon,
  ChatCircleText as ChatCircleTextIcon,
  Paperclip as PaperclipIcon,
} from '@phosphor-icons/react';

const FIELD_IDS = {
  DRAFT_ID: 'fldXiofTxlsl3NSro',
  DRAFT_CLIENT: 'fldV0tUFndHpPYqDD',
  DRAFT_STYLE: 'fld6rRHCKAlANOviR',
  DRAFT_CUSTOMIZATIONS: 'fldN97WQmsI1M5J0g',
  DRAFT_RUSH_FEE: 'fldWXGAL7RkCbfQ5h',
  DRAFT_SHIPPING: 'fldcItXhwxpimLdyR',
  DRAFT_TAXES: 'fldLzzEF6NIoYdKMF',
  // Discount can be entered as a flat dollar amount or a percentage — only
  // one of these two fields is ever meant to hold a value at a time.
  DRAFT_DISCOUNT_CURRENCY: 'fldjyvFWtv5cr05nV',
  DRAFT_DISCOUNT_PERCENTAGE: 'fldMFPOvXbdRwLIlt',
  DRAFT_SHIPPING_NOTES: 'fld8I8RAeCknwwOJQ',
  DRAFT_TAXES_NOTES: 'fldcfJOub8fF9ZOPM',
  DRAFT_DISCOUNT_NOTES: 'fld8nhM0InrdrqXWh',
  DRAFT_TOTAL: 'fldt5xLGU8aMFKfed',
  DRAFT_CREATED_AT: 'fldDN6BShO586Ac6V',
  DRAFT_LAST_MODIFIED: 'fldLDr7uFKCK9cuAQ',
  DRAFT_LOCKED: 'fldTcFzPYNKajZepk',
  DRAFT_STYLE_SUBTOTAL: 'fldnENW1asIEONjHh',
  DRAFT_CUSTOMIZATION_SUBTOTAL: 'fldjXCXIQn24kpwMD',
  DRAFT_GRAND_TOTAL: 'fldpqxb0FPd5vH0tI',
  DRAFT_WEDDING_DATE: 'fldmKmFUAqaS0FYQD',
  DRAFT_DUE_DATE: 'fldEIrZxfSsTz3FmA',
  DRAFT_LEAD_TIME: 'fldJM7YjyoCN20xac',
  // Shipping address selected for this draft order (an existing client
  // address, or a freehand new one) — created 2026-07-30, singleLineText.
  DRAFT_ADDRESS: 'fldZY2glO0rB19Eho',

  // Shopify Draft Order Creation story (2026-08-11) — singleSelect:
  // Not Started / Endpoint Call Ongoing / Completed / Failed.
  DRAFT_SHOPIFY_STATUS: 'fldsQlDqjhvTodXgR',
  DRAFT_SYNC_ERROR_MESSAGE: 'fldvexiG5evwmjnaw',
  DRAFT_INITIATED_BY_EMAIL: 'fldCapGqxZZo1b9o4',

  CLIENT_FULL_NAME: 'fldB3Wyam01D3wR5Q',
  // The three existing-address sources a client can have on file — the
  // address selector searches across all three (none is authoritative over
  // the others; a client may have any subset populated).
  CLIENT_SHOPIFY_ADDRESS: 'fldxFbYURZvlZ0tA1',
  CLIENT_ACUITY_ADDRESS: 'fldkpfulLIk0jq34d',
  CLIENT_OTHER_ADDRESS: 'fld5uRLRmAXqAH0nu',
  CLIENT_STAGE: 'fldLcxVZvI1rigBlh',
  CLIENT_DUE_DATE: 'flddDJKkZDsOoCOzE',
  CLIENT_WEDDING_DATE: 'fldbgknumKGS5W5WU',
  // wedding_date_display formula — Wedding Date (Formatted), falling back to
  // Wedding Date (If Not Set) when empty. Used only by ClientMiniPanel's
  // read-only "Wedding Date" row (see its comment) — CLIENT_WEDDING_DATE
  // above stays as-is for every other use in this file.
  CLIENT_WEDDING_DATE_DISPLAY: 'fldfDHXcCEbFHEX4a',
  CLIENT_DRAFT_ORDERS: 'fldynmy5OIWDVcgIn',
  CLIENT_FAVORITE_STYLES_ACUITY: 'fldZzNR0g5VEJ5RmX',
  CLIENT_FAVORITE_STYLES_APPOINTMENT: 'fldVw8wCgPKvxN1jD',
  CLIENT_SALES_ASSOCIATE: 'fldBTKBaw8YvNAlwK',
  CLIENT_SALES_ASSOCIATE_NAME: 'fldH8lJJHPUjPnyHZ', // lookup
  CLIENT_EMAIL: 'fld5f3IVZoX0QZZ8R',
  CLIENT_PHONE: 'fldZrxF4bR6QBUwVK',
  CLIENT_READY_TO_WEAR_SIZE: 'fldEEH4CK3Qqp0g0C',

  STAFF_FULL_NAME: 'fldc8INBZmwC3xeH7',
  STAFF_IS_ACTIVE: 'fldB6rPTjxATp7uMf',

  STYLE_NAME: 'fldEs3chQAeplPc1w',
  STYLE_PRICE: 'flduZuxPxxMqXzNxD',
  STYLE_PHOTO: 'fldall9IlP5wEMb2W',
  STYLE_CATEGORY: 'fld0eUrQtGo5zFrbe',

  CUSTOMIZATION_ID: 'fldl9cIcV80nYEDwe',
  CUSTOMIZATION_CLIENT: 'fldOeL4VVcXaKwwlN',
  CUSTOMIZATION_CUSTOMIZED_STYLE: 'fldCaKP1d4C0aohQE',
  CUSTOMIZATION_DETAIL: 'fldg1hEoZe9MFQj02',
  // internal_approval_status
  CUSTOMIZATION_APPROVAL_STATUS: 'fldEfOYgxOhyDiMEH',
  // client_approval_status
  CUSTOMIZATION_CLIENT_APPROVAL_STATUS: 'fldwE1BTp4G5eF2jR',
  CUSTOMIZATION_APPROVED_PRICING: 'fldFRRjwVlCgHhPdA',
  CUSTOMIZATION_PROPOSED_TOTAL: 'fldtF37zwwAPb5hjS',
  CUSTOMIZATION_EFFECTIVE_PRICE: 'fldFjHCKBNcWz6z0V',
  // customization_type: singleSelect — "Hybrid" | "Regular".
  CUSTOMIZATION_TYPE: 'fld1stC4sHuPT4pT4',

  // state_costs: single linked record on Draft Orders that Shipping (lookup)
  // and Taxes (formula) are calculated from.
  DRAFT_STATE_COSTS: 'fldtrW4LVfozdSTqK',
  STATE_COST_NAME: 'fldsKpV6cPlPA767U',
  STATE_COST_SHIPPING_FEE: 'fldz4DHNqBy8RMtlo',
  STATE_COST_TAX_RATE: 'fld3we9X0lJ1X8jMc',

  RUSH_RULE_WEEKS: 'fldQXdvm2BiegkSeM',
  RUSH_RULE_NON_CUSTOMIZED_PCT: 'flds560NGzla4hbfu',
} as const;

// TODO: populate once Julia confirms terminal stage values
const TERMINAL_STAGES: string[] = [];

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

type ViewState =
  | { layer: 1 }
  | { layer: 3; clientId: string }
  | { layer: 2; clientId: string | null; fromLayer: 1 | 3 }
  | { layer: 4; draftId: string; clientId: string };

interface LinkedRecord {
  id: string;
  name?: string;
}

const COLORS = {
  LIGHT: {
    bg: '#FFFBF7',
    bgCard: '#FFFFFF',
    bgHover: '#FFF8F0',
    border: '#E8DDD4',
    borderLight: '#F0E8E0',
    text: '#1A1A1A',
    textSecondary: '#6B5B4F',
    textMuted: '#9A8B7F',
    accent: '#D97706',
    accentSoft: '#FEF3C7',
    accentHover: '#B8964F',
    success: '#4A7C59',
    successBg: '#E8F5E9',
    neutral: '#6B5B4F',
    neutralBg: '#F5F0EB',
    danger: '#C94C4C',
    dangerBg: '#FEE2E2',
  },
  DARK: {
    bg: '#1A1715',
    bgCard: '#252220',
    bgHover: '#302D28',
    border: '#3D3831',
    borderLight: '#2E2A25',
    text: '#F5F0EB',
    textSecondary: '#B8ADA2',
    textMuted: '#7A6F64',
    accent: '#FBBF24',
    accentSoft: '#3A2E12',
    accentHover: '#D4B87D',
    success: '#6B9B7A',
    successBg: '#1E3A2A',
    neutral: '#B8ADA2',
    neutralBg: '#302D28',
    danger: '#E57373',
    dangerBg: '#3D2020',
  },
};

function useTheme() {
  // Reads Airtable's own light/dark preference, not the OS/browser setting.
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? COLORS.DARK : COLORS.LIGHT;
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(dateStr: string | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

// wedding_date_display returns either a real MM/DD/YYYY date (Formatted is
// set) or free placeholder text (e.g. "Spring 2027", Formatted is empty) —
// never ISO. Parses the real-date case first and formats it exactly like
// formatDate above; any other non-empty text is returned as-is. Placeholder
// text is never handed to `new Date()`, so a stray month/year token inside
// it can't get silently misparsed into a fabricated date. Used only by
// ClientMiniPanel's "Wedding Date" row.
//
// Builds the Date from explicit Y/M/D components (new Date(y, m, d)) instead
// of routing through formatDate/parseDate's `new Date(isoString)` — a
// date-only ISO string is parsed as UTC midnight, which Intl.DateTimeFormat
// then renders in the viewer's LOCAL timezone, showing the day before for
// anyone west of UTC (e.g. "2026-10-10" rendering as "Oct 9, 2026"). The
// Y/M/D constructor uses local components throughout, so there's no
// timezone boundary to cross and no off-by-one risk — same fix pattern as
// formatFriendlyDate/formatWeddingDateDisplay in the other Wedding Date
// fixes (Fulfillment, Alterations, Sold Orders, Appointments).
function formatWeddingDateDisplay(val: string | null | undefined): string {
  if (!val) return '';
  const mdy = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdy) {
    const [, mm, dd, yyyy] = mdy;
    const monthIdx = parseInt(mm!, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      const d = new Date(parseInt(yyyy!, 10), monthIdx, parseInt(dd!, 10));
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
      }
    }
  }
  return val;
}

// Shipping is a multipleLookupValues field — its cell value is an array (one
// entry per linked record), even though the state_costs link only ever holds
// one. This interface's runtime has previously (see BRANDING.md §9's
// lookup-color note) returned lookup entries as `{ linkedRecordId, value }`
// rather than the raw primitive, so unwrap recursively instead of assuming
// either shape.
function unwrapLookupNumber(value: unknown): number | null {
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (Array.isArray(value)) return value.length > 0 ? unwrapLookupNumber(value[0]) : null;
  if (value && typeof value === 'object' && 'value' in value) {
    return unwrapLookupNumber((value as { value: unknown }).value);
  }
  return null;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// Business rationale for the Rush Fee row's Notes cell — explains *why* the
// fee applies and at what rate, not just the due date it's based on.
function getRushFeeExplanation(
  standaloneStyleCount: number,
  weeksRemaining: number,
  dueDate: Date,
  rushFeeRuleRecords: AirtableRecord[],
  rushRuleWeeksField: Field | null,
  rushRuleNonCustomizedPctField: Field | null,
): string {
  if (standaloneStyleCount === 0) return '';

  const matchingRule = rushFeeRuleRecords
    .filter(rule => {
      const ruleWeeks = rushRuleWeeksField ? (rule.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
      return ruleWeeks >= weeksRemaining;
    })
    .sort((a, b) => {
      const weeksA = rushRuleWeeksField ? (a.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
      const weeksB = rushRuleWeeksField ? (b.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
      return weeksA - weeksB;
    })[0];

  if (!matchingRule) return '';

  const rushPct = rushRuleNonCustomizedPctField
    ? (matchingRule.getCellValue(rushRuleNonCustomizedPctField) as number | null) ?? 0
    : 0;
  const pctLabel = `${Math.round(rushPct * 100)}%`;

  // weeksRemaining can be zero or negative (the due date is already this
  // week or has passed) — spell that out in words instead of a signed
  // number like "-4 weeks left", which reads like a typo, not a countdown.
  const weeksLabel = weeksRemaining <= 0
    ? `Less than ${Math.abs(weeksRemaining) || 1} week${Math.abs(weeksRemaining) === 1 ? '' : 's'} left`
    : `${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'} left`;

  return `${pctLabel} rush fee on ${standaloneStyleCount} non-customized style${standaloneStyleCount === 1 ? '' : 's'}. ${weeksLabel} until the due date on ${formatDate(dueDate.toISOString())}.`;
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Percent fields store a fraction (0.1 = 10%) — parse a typed "10" into 0.1,
// and format the stored fraction back into a "10%" display string.
function parsePercentInput(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed / 100;
}

function formatPercentDisplay(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

// A customization is only usable on a draft order once it's actually
// approved: internal sign-off happened, and the client hasn't rejected it.
function isCustomizationApproved(
  customization: AirtableRecord,
  internalApprovalStatusField: Field | null,
  clientApprovalStatusField: Field | null,
): boolean {
  const internalStatus = internalApprovalStatusField ? customization.getCellValueAsString(internalApprovalStatusField) : '';
  const clientStatus = clientApprovalStatusField ? customization.getCellValueAsString(clientApprovalStatusField) : '';
  return internalStatus === 'Approved' && clientStatus !== 'Denied' && clientStatus !== 'Denied • Counter-Proposal';
}

// Borderless currency/percent icon toggle for the Discount row — no border so
// it sits flush inside the table cell, matching the row's own transparent inputs.
function DiscountModeToggle({
  mode,
  onChange,
  theme,
  disabled,
}: {
  mode: 'currency' | 'percentage';
  onChange: (mode: 'currency' | 'percentage') => void;
  theme: typeof COLORS.LIGHT;
  disabled?: boolean;
}) {
  const iconButtonStyle = (active: boolean): React.CSSProperties => ({
    color: active ? theme.text : theme.textMuted,
    backgroundColor: active ? theme.bgHover : 'transparent',
  });
  return (
    <div className="flex items-center gap-0.5 rounded-md p-0.5">
      <button
        type="button"
        onClick={() => onChange('currency')}
        disabled={disabled}
        title="Dollar amount"
        className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
        style={iconButtonStyle(mode === 'currency')}
      >
        <CurrencyDollarIcon size={14} />
      </button>
      <button
        type="button"
        onClick={() => onChange('percentage')}
        disabled={disabled}
        title="Percentage"
        className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
        style={iconButtonStyle(mode === 'percentage')}
      >
        <PercentIcon size={14} />
      </button>
    </div>
  );
}

// Shopify Draft Order Creation story (2026-08-11) — shared write queue for
// the client mini panel's ready_to_wear_size edit, guarding against
// concurrent-write races the same way the rest of this file's per-field
// blur handlers avoid clobbering each other.
let _shopifyWriteQueue = Promise.resolve();
function queueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = _shopifyWriteQueue.then(fn);
  _shopifyWriteQueue = next.then(() => {}, () => {});
  return next;
}

function ShopifyStatusPill({ status }: { status: string }) {
  const theme = useTheme();
  let bgColor = theme.neutralBg;
  let textColor = theme.neutral;
  let dot: string | null = null;
  if (status === 'Completed') {
    bgColor = theme.successBg; textColor = theme.success;
  } else if (status === 'Failed') {
    bgColor = theme.dangerBg; textColor = theme.danger;
  } else if (status === 'Endpoint Call Ongoing') {
    bgColor = theme.accentSoft; textColor = theme.accent; dot = 'animate-pulse';
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {dot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} style={{ backgroundColor: textColor }} />}
      {status}
    </span>
  );
}

// Shared eligibility check for the "Create Shopify Draft Order" action —
// used both to decide whether the button is enabled and, on click, to block
// with a specific message before writing anything. Kept pure (no Airtable
// writes) so it's safe to call on every render.
function checkShopifyDraftOrderEligibility(params: {
  clientId: string | null;
  linkedStyleIds: string[];
  linkedCustomizations: AirtableRecord[];
  readyToWearSize: number | null;
  customizationTypeField: Field | null;
  customizedStyleField: Field | null;
  styleCategoryField: Field | null;
  getLinkedRecordIds: (record: AirtableRecord, field: Field | null) => string[];
  styleRecords: AirtableRecord[];
}): { eligible: boolean; reason: string } {
  const {
    clientId, linkedStyleIds, linkedCustomizations, readyToWearSize,
    customizationTypeField, customizedStyleField, styleCategoryField, getLinkedRecordIds, styleRecords,
  } = params;

  if (!clientId) {
    return { eligible: false, reason: 'No client linked to this draft order.' };
  }
  if (linkedStyleIds.length === 0 && linkedCustomizations.length === 0) {
    return { eligible: false, reason: 'At least one Style or Customization is required.' };
  }
  if (readyToWearSize === null || readyToWearSize === undefined) {
    return { eligible: false, reason: "Client's Ready to Wear size is missing. Update it from the client detail panel." };
  }

  const hybridCustomizations = linkedCustomizations.filter(
    c => (customizationTypeField ? c.getCellValueAsString(customizationTypeField) : '') === 'Hybrid'
  );
  if (hybridCustomizations.length > 1) {
    return { eligible: false, reason: 'Only one Hybrid customization can be active at a time.' };
  }
  if (hybridCustomizations.length === 1) {
    const hasCustomGownStyle = styleRecords.some(s => {
      if (!linkedStyleIds.includes(s.id)) return false;
      const category = styleCategoryField ? s.getCellValueAsString(styleCategoryField) : '';
      return category === 'CUSTOM';
    });
    if (!hasCustomGownStyle) {
      return { eligible: false, reason: 'A Custom Gown style is required when a Hybrid customization is selected.' };
    }
  }

  const regularCustomizations = linkedCustomizations.filter(
    c => (customizationTypeField ? c.getCellValueAsString(customizationTypeField) : '') === 'Regular'
  );
  const seenCustomizedStyleIds = new Set<string>();
  for (const c of regularCustomizations) {
    const customizedStyleIds = getLinkedRecordIds(c, customizedStyleField);
    if (customizedStyleIds.length === 0) {
      return { eligible: false, reason: `Customization ${c.id} requires its matching style to be selected.` };
    }
    for (const styleId of customizedStyleIds) {
      if (seenCustomizedStyleIds.has(styleId)) {
        return { eligible: false, reason: 'Only one customization per style is allowed.' };
      }
      seenCustomizedStyleIds.add(styleId);
    }
  }

  return { eligible: true, reason: '' };
}

function StatusPill({ label, variant }: { label: string; variant: 'locked' | 'unlocked' | 'tentative' }) {
  const theme = useTheme();
  let bgColor = theme.neutralBg;
  let textColor = theme.neutral;
  if (variant === 'unlocked') {
    bgColor = theme.successBg;
    textColor = theme.success;
  } else if (variant === 'tentative') {
    bgColor = theme.neutralBg;
    textColor = theme.neutral;
  }
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {label}
    </span>
  );
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  theme: typeof COLORS.LIGHT;
  minWidth?: number;
}

function FilterDropdown({ label, value, options, onChange, theme, minWidth = 160 }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = value !== '';
  const selectedOption = options.find(o => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:cursor-pointer"
        style={{
          backgroundColor: theme.bg,
          border: `1px solid ${isActive ? theme.accent : theme.border}`,
          color: isActive ? theme.accent : theme.text,
          fontWeight: isActive ? 600 : 400
        }}
      >
        <span className="whitespace-nowrap">{isActive ? selectedOption?.label ?? label : label}</span>
        {isActive ? (
          <XIcon size={14} onClick={(e) => { e.stopPropagation(); onChange(''); }} />
        ) : (
          <CaretDownIcon size={14} style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        )}
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 rounded-md shadow-lg overflow-y-auto"
          style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, minWidth, maxHeight: 252 }}
        >
          {options.map(opt => {
            const checked = value === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: checked ? theme.accentSoft : 'transparent',
                  color: checked ? theme.accent : theme.text,
                  fontWeight: checked ? 600 : 400
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Client mini detail panel — opens from the draft order header's "View
// Client" action. Read-only fields per the locked AC (stage, wedding date,
// email, phone, sales associate name); ready_to_wear_size is the one
// editable field, written directly to DF Clients via queueWrite() to avoid
// a concurrent-write race if the user edits it from two tabs.
function ClientMiniPanel({
  theme,
  clientRecord,
  clientsTable,
  getField,
  onClose,
}: {
  theme: typeof COLORS.LIGHT;
  clientRecord: AirtableRecord;
  clientsTable: Table;
  getField: (table: Table, fieldId: string) => Field | null;
  onClose: () => void;
}) {
  const stageField = getField(clientsTable, FIELD_IDS.CLIENT_STAGE);
  const weddingDateDisplayField = getField(clientsTable, FIELD_IDS.CLIENT_WEDDING_DATE_DISPLAY);
  const emailField = getField(clientsTable, FIELD_IDS.CLIENT_EMAIL);
  const phoneField = getField(clientsTable, FIELD_IDS.CLIENT_PHONE);
  const salesAssociateNameField = getField(clientsTable, FIELD_IDS.CLIENT_SALES_ASSOCIATE_NAME);
  const readyToWearSizeField = getField(clientsTable, FIELD_IDS.CLIENT_READY_TO_WEAR_SIZE);

  const currentSize = readyToWearSizeField ? (clientRecord.getCellValue(readyToWearSizeField) as number | null) : null;
  const [sizeInput, setSizeInput] = useState(currentSize !== null && currentSize !== undefined ? String(currentSize) : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const canUpdate = clientsTable.hasPermissionToUpdateRecords();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSizeBlur = () => {
    if (!canUpdate || !readyToWearSizeField) return;
    const trimmed = sizeInput.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && (isNaN(parsed as number))) {
      setSaveError('Ready to Wear size must be a number.');
      return;
    }
    if (parsed === currentSize) return;
    setSaving(true);
    setSaveError(null);
    queueWrite(() => clientsTable.updateRecordAsync(clientRecord.id, { [readyToWearSizeField.id]: parsed }))
      .catch(error => {
        console.error('Failed to update ready_to_wear_size:', error);
        setSaveError('Failed to save.');
      })
      .finally(() => setSaving(false));
  };

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: theme.borderLight }}>
      <span className="text-sm" style={{ color: theme.textSecondary }}>{label}</span>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.38)' }} onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl overflow-hidden"
        style={{ backgroundColor: theme.bgCard, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-base font-semibold">Client Details</h2>
          <button onClick={onClose} className="hover:cursor-pointer" style={{ color: theme.textMuted }}><XIcon size={18} /></button>
        </div>
        <div className="px-6 py-4">
          {row('Stage', stageField ? clientRecord.getCellValueAsString(stageField) : '')}
          {row('Wedding Date', weddingDateDisplayField ? formatWeddingDateDisplay(clientRecord.getCellValueAsString(weddingDateDisplayField)) : '')}
          {row('Email', emailField ? clientRecord.getCellValueAsString(emailField) : '')}
          {row('Phone', phoneField ? clientRecord.getCellValueAsString(phoneField) : '')}
          {row('Sales Associate', salesAssociateNameField ? clientRecord.getCellValueAsString(salesAssociateNameField) : '')}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: theme.textSecondary }}>Ready to Wear Size</span>
            <input
              type="text"
              inputMode="numeric"
              value={sizeInput}
              onChange={e => setSizeInput(e.target.value)}
              onBlur={handleSizeBlur}
              disabled={!canUpdate}
              placeholder="—"
              className="w-20 text-sm text-right px-2 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
            />
          </div>
          {saving && <p className="text-xs mt-1" style={{ color: theme.textMuted }}>Saving…</p>}
          {saveError && <p className="text-xs mt-1" style={{ color: theme.danger }}>{saveError}</p>}
        </div>
      </div>
    </div>
  );
}

function getCustomProperties(base: ReturnType<typeof useBase>) {
  const draftOrdersTable = base.getTableByIdIfExists('tblp7foUmlN9823WW');
  const clientsTable = base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c');
  const customizationsTable = base.getTableByIdIfExists('tbl7HUWDI7IRjWY92');

  return [
    { key: 'draftOrdersTable', label: 'Draft orders', type: 'table' as const, defaultValue: draftOrdersTable },
    { key: 'clientsTable', label: 'Clients', type: 'table' as const, defaultValue: clientsTable },
    { key: 'stylesTable', label: 'Styles', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbl0hWIRBbcB4UkVC') },
    { key: 'customizationsTable', label: 'Customizations', type: 'table' as const, defaultValue: customizationsTable },
    { key: 'stateCostsTable', label: 'State costs', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblMnPV8Z00QePma9') },
    { key: 'rushFeeRulesTable', label: 'Rush fee rules', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbldXhthsHZJhMfDm') },
    { key: 'staffTable', label: 'Staff', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblbYk88xJ8FQrLS4') },

    // Shopify Draft Order Creation story (2026-08-11) — fields must be
    // explicitly declared as 'field' custom properties (not just their
    // parent table) for the Interface Designer to grant this page access
    // to them; a hardcoded field ID alone is not enough. defaultValue
    // pre-fills the mapping so no admin action is required unless the
    // field ID ever changes.
    ...(draftOrdersTable ? [
      { key: 'draftShopifyStatusField', label: 'Draft: Shopify status', type: 'field' as const, table: draftOrdersTable, defaultValue: draftOrdersTable.getFieldByIdIfExists(FIELD_IDS.DRAFT_SHOPIFY_STATUS) ?? undefined },
      { key: 'draftSyncErrorMessageField', label: 'Draft: sync error message', type: 'field' as const, table: draftOrdersTable, defaultValue: draftOrdersTable.getFieldByIdIfExists(FIELD_IDS.DRAFT_SYNC_ERROR_MESSAGE) ?? undefined },
      { key: 'draftInitiatedByEmailField', label: 'Draft: initiated by email', type: 'field' as const, table: draftOrdersTable, defaultValue: draftOrdersTable.getFieldByIdIfExists(FIELD_IDS.DRAFT_INITIATED_BY_EMAIL) ?? undefined },
    ] : []),
    ...(clientsTable ? [
      { key: 'clientReadyToWearSizeField', label: 'Client: Ready to Wear size', type: 'field' as const, table: clientsTable, defaultValue: clientsTable.getFieldByIdIfExists(FIELD_IDS.CLIENT_READY_TO_WEAR_SIZE) ?? undefined },
      { key: 'clientEmailField', label: 'Client: Email', type: 'field' as const, table: clientsTable, defaultValue: clientsTable.getFieldByIdIfExists(FIELD_IDS.CLIENT_EMAIL) ?? undefined },
      { key: 'clientPhoneField', label: 'Client: Phone', type: 'field' as const, table: clientsTable, defaultValue: clientsTable.getFieldByIdIfExists(FIELD_IDS.CLIENT_PHONE) ?? undefined },
      { key: 'clientSalesAssociateNameField', label: 'Client: Sales associate name', type: 'field' as const, table: clientsTable, defaultValue: clientsTable.getFieldByIdIfExists(FIELD_IDS.CLIENT_SALES_ASSOCIATE_NAME) ?? undefined },
    ] : []),
    ...(customizationsTable ? [
      { key: 'customizationTypeField', label: 'Customization: type', type: 'field' as const, table: customizationsTable, defaultValue: customizationsTable.getFieldByIdIfExists(FIELD_IDS.CUSTOMIZATION_TYPE) ?? undefined },
    ] : []),
  ];
}

function DraftOrdersApp() {
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
  const theme = useTheme();

  const draftOrdersTable = customPropertyValueByKey.draftOrdersTable as Table | undefined;
  const clientsTable = customPropertyValueByKey.clientsTable as Table | undefined;
  const stylesTable = customPropertyValueByKey.stylesTable as Table | undefined;
  const customizationsTable = customPropertyValueByKey.customizationsTable as Table | undefined;
  const stateCostsTable = customPropertyValueByKey.stateCostsTable as Table | undefined;
  const rushFeeRulesTable = customPropertyValueByKey.rushFeeRulesTable as Table | undefined;
  const staffTable = customPropertyValueByKey.staffTable as Table | undefined;

  const draftRecords = useRecords(draftOrdersTable ?? null);
  const clientRecords = useRecords(clientsTable ?? null);
  const styleRecords = useRecords(stylesTable ?? null);
  const customizationRecords = useRecords(customizationsTable ?? null);
  const stateCostRecords = useRecords(stateCostsTable ?? null);
  const rushFeeRuleRecords = useRecords(rushFeeRulesTable ?? null);
  const staffRecords = useRecords(staffTable ?? null);

  const [viewState, setViewState] = useState<ViewState>({ layer: 1 });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  if (errorState) {
    return (
      <div className="h-screen flex items-center justify-center p-8" style={{ backgroundColor: theme.bg }}>
        <div className="text-center" style={{ color: theme.danger }}>
          <p className="text-lg font-semibold">Error loading configuration</p>
          <p className="text-sm mt-2">{String(errorState)}</p>
        </div>
      </div>
    );
  }

  if (!draftOrdersTable || !clientsTable || !stylesTable || !customizationsTable || !stateCostsTable || !rushFeeRulesTable) {
    return (
      <div className="h-screen flex items-center justify-center p-8" style={{ backgroundColor: theme.bg }}>
        <div className="text-center" style={{ color: theme.textSecondary }}>
          <p className="text-lg font-semibold">Configuration Required</p>
          <p className="text-sm mt-2">Please configure all required tables in the properties panel.</p>
        </div>
      </div>
    );
  }

  const getField = (table: Table, fieldId: string): Field | null => {
    return table.getFieldIfExists(fieldId);
  };

  const getLinkedRecordIds = (record: AirtableRecord, field: Field | null): string[] => {
    if (!field) return [];
    const value = record.getCellValue(field) as LinkedRecord[] | null;
    return value?.map(r => r.id) ?? [];
  };

  const getClientName = (clientId: string): string => {
    const client = clientRecords?.find(c => c.id === clientId);
    if (!client) return 'Unknown Client';
    const nameField = getField(clientsTable, FIELD_IDS.CLIENT_FULL_NAME);
    return nameField ? (client.getCellValueAsString(nameField) || 'Unknown Client') : 'Unknown Client';
  };

  const getClientWeddingDate = (clientId: string): Date | null => {
    const client = clientRecords?.find(c => c.id === clientId);
    if (!client) return null;
    const weddingDateField = getField(clientsTable, FIELD_IDS.CLIENT_WEDDING_DATE);
    if (!weddingDateField) return null;
    return parseDate(client.getCellValueAsString(weddingDateField));
  };

  const getDraftsForClient = (clientId: string): AirtableRecord[] => {
    if (!draftRecords) return [];
    const clientField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CLIENT);
    return draftRecords
      .filter(draft => {
        const linkedClients = getLinkedRecordIds(draft, clientField);
        return linkedClients.includes(clientId);
      })
      .sort((a, b) => {
        const createdAtField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CREATED_AT);
        if (!createdAtField) return 0;
        const dateA = a.getCellValue(createdAtField) as string | null;
        const dateB = b.getCellValue(createdAtField) as string | null;
        return new Date(dateB ?? 0).getTime() - new Date(dateA ?? 0).getTime();
      });
  };

  const getMostRecentDraft = (clientId: string): AirtableRecord | null => {
    const drafts = getDraftsForClient(clientId);
    return drafts[0] ?? null;
  };

  const showLayer3 = viewState.layer === 3 || (viewState.layer === 2 && viewState.fromLayer === 3);
  const layer3ClientId = viewState.layer === 3 ? viewState.clientId : (viewState.layer === 2 ? viewState.clientId : null);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {viewState.layer === 4 ? (
        <Layer4
          theme={theme}
          draftId={viewState.draftId}
          clientId={viewState.clientId}
          draftRecords={draftRecords ?? []}
          styleRecords={styleRecords ?? []}
          customizationRecords={customizationRecords ?? []}
          stateCostRecords={stateCostRecords ?? []}
          rushFeeRuleRecords={rushFeeRuleRecords ?? []}
          clientRecords={clientRecords ?? []}
          draftOrdersTable={draftOrdersTable}
          stylesTable={stylesTable}
          customizationsTable={customizationsTable}
          stateCostsTable={stateCostsTable}
          rushFeeRulesTable={rushFeeRulesTable}
          clientsTable={clientsTable}
          getField={getField}
          getLinkedRecordIds={getLinkedRecordIds}
          getMostRecentDraft={getMostRecentDraft}
          getClientName={getClientName}
          onBack={() => setViewState({ layer: 3, clientId: viewState.clientId })}
        />
      ) : (
        <>
          <Layer1
            theme={theme}
            clientRecords={clientRecords ?? []}
            draftRecords={draftRecords ?? []}
            staffRecords={staffRecords ?? []}
            draftOrdersTable={draftOrdersTable}
            clientsTable={clientsTable}
            staffTable={staffTable ?? null}
            getField={getField}
            getLinkedRecordIds={getLinkedRecordIds}
            getMostRecentDraft={getMostRecentDraft}
            onClientClick={(clientId) => setViewState({ layer: 3, clientId })}
            onNewDraft={() => setViewState({ layer: 2, clientId: null, fromLayer: 1 })}
          />
          {showLayer3 && layer3ClientId && (
            <Layer3
              theme={theme}
              clientId={layer3ClientId}
              clientName={getClientName(layer3ClientId)}
              clientWeddingDate={getClientWeddingDate(layer3ClientId)}
              drafts={getDraftsForClient(layer3ClientId)}
              draftOrdersTable={draftOrdersTable}
              getField={getField}
              onClose={() => setViewState({ layer: 1 })}
              onDraftClick={(draftId) => setViewState({ layer: 4, draftId, clientId: layer3ClientId })}
              onNewDraft={() => setViewState({ layer: 2, clientId: layer3ClientId, fromLayer: 3 })}
            />
          )}
          {viewState.layer === 2 && (
            <Layer2
              theme={theme}
              clientId={viewState.clientId}
              clientRecords={clientRecords ?? []}
              styleRecords={styleRecords ?? []}
              customizationRecords={customizationRecords ?? []}
              stateCostRecords={stateCostRecords ?? []}
              rushFeeRuleRecords={rushFeeRuleRecords ?? []}
              draftOrdersTable={draftOrdersTable}
              clientsTable={clientsTable}
              stylesTable={stylesTable}
              customizationsTable={customizationsTable}
              stateCostsTable={stateCostsTable}
              rushFeeRulesTable={rushFeeRulesTable}
              getField={getField}
              getLinkedRecordIds={getLinkedRecordIds}
              getClientName={getClientName}
              onClose={() => setViewState(viewState.fromLayer === 3 && viewState.clientId ? { layer: 3, clientId: viewState.clientId } : { layer: 1 })}
              onSave={(newDraftId: string) => {
                if (viewState.clientId) {
                  setViewState({ layer: 4, draftId: newDraftId, clientId: viewState.clientId });
                } else {
                  setViewState({ layer: 1 });
                }
              }}
              onClientSelect={(clientId) => setViewState({ ...viewState, clientId })}
            />
          )}
        </>
      )}
      <FeedbackButton onClick={() => setShowFeedbackModal(true)} />
      {showFeedbackModal && <FeedbackModal base={base} onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}

interface Layer1Props {
  theme: typeof COLORS.LIGHT;
  clientRecords: AirtableRecord[];
  draftRecords: AirtableRecord[];
  staffRecords: AirtableRecord[];
  draftOrdersTable: Table;
  clientsTable: Table;
  staffTable: Table | null;
  getField: (table: Table, fieldId: string) => Field | null;
  getLinkedRecordIds: (record: AirtableRecord, field: Field | null) => string[];
  getMostRecentDraft: (clientId: string) => AirtableRecord | null;
  onClientClick: (clientId: string) => void;
  onNewDraft: () => void;
}

function Layer1({
  theme,
  clientRecords,
  draftRecords,
  staffRecords,
  draftOrdersTable,
  clientsTable,
  staffTable,
  getField,
  getLinkedRecordIds,
  getMostRecentDraft,
  onClientClick,
  onNewDraft,
}: Layer1Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [salesAssociateFilter, setSalesAssociateFilter] = useState('');

  const activeClients = useMemo(() => {
    const draftOrdersField = getField(clientsTable, FIELD_IDS.CLIENT_DRAFT_ORDERS);
    const stageField = getField(clientsTable, FIELD_IDS.CLIENT_STAGE);

    return clientRecords.filter(client => {
      const linkedDrafts = getLinkedRecordIds(client, draftOrdersField);
      if (linkedDrafts.length === 0) return false;

      if (TERMINAL_STAGES.length > 0 && stageField) {
        const stage = client.getCellValueAsString(stageField);
        if (TERMINAL_STAGES.includes(stage)) return false;
      }

      return true;
    });
  }, [clientRecords, clientsTable, getField, getLinkedRecordIds]);

  const nameField = getField(clientsTable, FIELD_IDS.CLIENT_FULL_NAME);
  const draftOrdersField = getField(clientsTable, FIELD_IDS.CLIENT_DRAFT_ORDERS);
  const clientSalesAssociateField = getField(clientsTable, FIELD_IDS.CLIENT_SALES_ASSOCIATE);
  const grandTotalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_GRAND_TOTAL);
  const createdAtField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CREATED_AT);
  const staffNameField = staffTable ? getField(staffTable, FIELD_IDS.STAFF_FULL_NAME) : null;
  const staffIsActiveField = staffTable ? getField(staffTable, FIELD_IDS.STAFF_IS_ACTIVE) : null;

  const activeStaff = useMemo(() => {
    return staffRecords
      .filter(staff => (staffIsActiveField ? !!staff.getCellValue(staffIsActiveField) : false))
      .sort((a, b) => {
        const nameA = staffNameField ? a.getCellValueAsString(staffNameField) : '';
        const nameB = staffNameField ? b.getCellValueAsString(staffNameField) : '';
        return nameA.localeCompare(nameB);
      });
  }, [staffRecords, staffIsActiveField, staffNameField]);

  const filteredClients = useMemo(() => {
    return activeClients.filter(client => {
      if (salesAssociateFilter) {
        const linkedSalesAssociates = getLinkedRecordIds(client, clientSalesAssociateField);
        if (!linkedSalesAssociates.includes(salesAssociateFilter)) return false;
      }
      if (searchQuery.trim()) {
        const name = nameField ? client.getCellValueAsString(nameField).toLowerCase() : '';
        if (!name.includes(searchQuery.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [activeClients, searchQuery, salesAssociateFilter, nameField, clientSalesAssociateField, getLinkedRecordIds]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-[10%] py-4 border-b" style={{ borderColor: theme.border }}>
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: theme.textMuted }}
          />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md text-sm"
            style={{
              backgroundColor: theme.bg,
              border: `1px solid ${theme.border}`,
              color: theme.text
            }}
          />
        </div>
        <FilterDropdown
          label="Sales Associates"
          value={salesAssociateFilter}
          onChange={setSalesAssociateFilter}
          theme={theme}
          minWidth={180}
          options={activeStaff.map(staff => ({
            id: staff.id,
            label: staffNameField ? staff.getCellValueAsString(staffNameField) : 'Unknown'
          }))}
        />
        <div className="flex-1" />
        <button
          onClick={onNewDraft}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm font-medium"
          style={{ backgroundColor: theme.accent, color: '#FFFFFF' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.accentHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.accent; }}
        >
          <PlusIcon size={16} weight="bold" />
          New Draft
        </button>
      </div>

      <div className="flex-1 overflow-auto px-[10%] py-6">
        {filteredClients.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: theme.textSecondary }}>
              {activeClients.length === 0 ? 'No active clients with draft orders yet.' : 'No clients match your search.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredClients.map(client => {
              const clientName = nameField ? client.getCellValueAsString(nameField) : 'Unknown';
              const draftCount = getLinkedRecordIds(client, draftOrdersField).length;
              const mostRecentDraft = getMostRecentDraft(client.id);
              const grandTotal = mostRecentDraft && grandTotalField
                ? (mostRecentDraft.getCellValue(grandTotalField) as number | null)
                : null;
              const createdAt = mostRecentDraft && createdAtField
                ? (mostRecentDraft.getCellValue(createdAtField) as string | null)
                : null;

              return (
                <div
                  key={client.id}
                  onClick={() => onClientClick(client.id)}
                  className="flex flex-col gap-2 p-4 rounded-lg cursor-pointer transition-colors"
                  style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.bgCard; }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{clientName}</p>
                    <span className="text-sm" style={{ color: theme.textSecondary }}>
                      {draftCount} draft{draftCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm" style={{ color: theme.textSecondary }}>Latest draft order:</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(grandTotal)} · {formatDate(createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface Layer3Props {
  theme: typeof COLORS.LIGHT;
  clientId: string;
  clientName: string;
  clientWeddingDate: Date | null;
  drafts: AirtableRecord[];
  draftOrdersTable: Table;
  getField: (table: Table, fieldId: string) => Field | null;
  onClose: () => void;
  onDraftClick: (draftId: string) => void;
  onNewDraft: () => void;
}

function Layer3({
  theme,
  clientId,
  clientName,
  clientWeddingDate,
  drafts,
  draftOrdersTable,
  getField,
  onClose,
  onDraftClick,
  onNewDraft,
}: Layer3Props) {
  const createdAtField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CREATED_AT);
  const grandTotalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_GRAND_TOTAL);
  const lockedField = getField(draftOrdersTable, FIELD_IDS.DRAFT_LOCKED);
  const shopifyStatusField = getField(draftOrdersTable, FIELD_IDS.DRAFT_SHOPIFY_STATUS);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const requestClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      onClick={requestClose}
    >
      <div
        className="absolute inset-0 transition-opacity duration-200 ease-out"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible ? 1 : 0 }}
      />
      <div
        className="relative w-full h-[380px] flex flex-col rounded-xl overflow-hidden transition-all duration-200 ease-out"
        style={{
          backgroundColor: theme.bgCard,
          maxWidth: '560px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.96)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-8 py-4 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-lg font-semibold">{clientName}</h2>
          {clientWeddingDate && (
            <span className="text-sm" style={{ color: theme.textSecondary }}>
              Wedding Date: {formatDate(clientWeddingDate.toISOString())}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={onNewDraft}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm font-medium"
            style={{ backgroundColor: theme.accent, color: '#FFFFFF' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.accent; }}
          >
            <PlusIcon size={16} weight="bold" />
            New Draft
          </button>
        </div>

        <div className="flex-1 overflow-auto px-8 py-4">
          {drafts.length === 0 ? (
            <p className="text-center py-8" style={{ color: theme.textSecondary }}>No drafts yet.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map(draft => {
                const createdAt = createdAtField ? (draft.getCellValue(createdAtField) as string | null) : null;
                const grandTotal = grandTotalField ? (draft.getCellValue(grandTotalField) as number | null) : null;
                const isLocked = lockedField ? !!draft.getCellValue(lockedField) : false;
                const shopifyStatus = shopifyStatusField ? draft.getCellValueAsString(shopifyStatusField) : '';

                return (
                  <div
                    key={draft.id}
                    onClick={() => onDraftClick(draft.id)}
                    className="flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors"
                    style={{ backgroundColor: theme.bg, border: `1px solid ${theme.borderLight}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.bg; }}
                  >
                    <p className="font-medium">{formatDate(createdAt)}</p>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(grandTotal)}</span>
                      <StatusPill label={isLocked ? 'Locked' : 'Unlocked'} variant={isLocked ? 'locked' : 'unlocked'} />
                      {shopifyStatus && <ShopifyStatusPill status={shopifyStatus} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Single-select linked-record combobox for state_costs (Shipping/Taxes are
// calculated from whichever state is linked here) — same search/dropdown/
// keyboard-nav pattern as the Client/Style/Customization pickers in this
// file, but replaces the selection instead of toggling into an array.
function StateCostPicker({
  theme,
  records,
  nameField,
  selectedId,
  onSelect,
  disabled,
  placeholder = 'Search state...',
}: {
  theme: typeof COLORS.LIGHT;
  records: AirtableRecord[];
  nameField: Field | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedRecord = selectedId ? records.find(r => r.id === selectedId) ?? null : null;
  const selectedLabel = selectedRecord && nameField ? selectedRecord.getCellValueAsString(nameField) : '';

  const filtered = useMemo(() => {
    if (!query.trim()) return records.slice(0, 60);
    const q = query.toLowerCase();
    return records.filter(r => (nameField ? r.getCellValueAsString(nameField).toLowerCase() : '').includes(q)).slice(0, 60);
  }, [records, query, nameField]);

  return (
    <div ref={containerRef} className="relative w-64">
      <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
      <input
        type="text"
        placeholder={placeholder}
        value={open ? query : selectedLabel}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIndex(-1);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setHighlightIndex(-1);
        }}
        onKeyDown={e => {
          if (!open || filtered.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(i => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(i => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && highlightIndex >= 0) {
            e.preventDefault();
            onSelect(filtered[highlightIndex].id);
            setOpen(false);
            setQuery('');
          }
        }}
        disabled={disabled}
        className={`w-full pl-9 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed ${selectedId ? 'pr-9' : 'pr-3'}`}
        style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
      />
      {selectedId && !open && (
        <button
          onClick={() => onSelect(null)}
          className="absolute right-3 top-1/2 -translate-y-1/2 hover:cursor-pointer"
          style={{ color: theme.textMuted }}
        >
          <XIcon size={16} />
        </button>
      )}
      {open && (
        <div
          className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
          style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm" style={{ color: theme.textSecondary }}>No matches.</p>
          ) : (
            filtered.map((r, index) => {
              const isSelected = r.id === selectedId;
              const isHighlighted = index === highlightIndex;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    onSelect(r.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer"
                  style={{
                    color: theme.text,
                    backgroundColor: isHighlighted ? theme.bgHover : (isSelected ? theme.accentSoft : 'transparent')
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <span className={isSelected ? 'font-medium' : ''}>{nameField ? r.getCellValueAsString(nameField) : 'Unknown'}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

interface Layer2Props {
  theme: typeof COLORS.LIGHT;
  clientId: string | null;
  clientRecords: AirtableRecord[];
  styleRecords: AirtableRecord[];
  customizationRecords: AirtableRecord[];
  stateCostRecords: AirtableRecord[];
  rushFeeRuleRecords: AirtableRecord[];
  draftOrdersTable: Table;
  clientsTable: Table;
  stylesTable: Table;
  customizationsTable: Table;
  stateCostsTable: Table;
  rushFeeRulesTable: Table;
  getField: (table: Table, fieldId: string) => Field | null;
  getLinkedRecordIds: (record: AirtableRecord, field: Field | null) => string[];
  getClientName: (clientId: string) => string;
  onClose: () => void;
  onSave: (newDraftId: string) => void;
  onClientSelect: (clientId: string | null) => void;
}

function Layer2({
  theme,
  clientId,
  clientRecords,
  styleRecords,
  customizationRecords,
  stateCostRecords,
  rushFeeRuleRecords,
  draftOrdersTable,
  clientsTable,
  stylesTable,
  customizationsTable,
  stateCostsTable,
  rushFeeRulesTable,
  getField,
  getLinkedRecordIds,
  getClientName,
  onClose,
  onSave,
  onClientSelect,
}: Layer2Props) {
  const isClientPresetRef = useRef(clientId !== null);
  const isClientPreset = isClientPresetRef.current;

  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [selectedCustomizationIds, setSelectedCustomizationIds] = useState<string[]>([]);
  const [discount, setDiscount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountMode, setDiscountMode] = useState<'currency' | 'percentage'>('currency');
  const [discountNotes, setDiscountNotes] = useState('');
  const [address, setAddress] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);

  // The client's existing addresses on file, searched across all three
  // source fields — none is authoritative, a client may have any subset
  // populated. Only non-empty ones are offered; picking one, or typing a new
  // one directly, both just set `address` the same way.
  const clientAddressOptions = useMemo(() => {
    if (!clientId) return [];
    const client = clientRecords.find(c => c.id === clientId);
    if (!client) return [];
    const shopifyField = getField(clientsTable, FIELD_IDS.CLIENT_SHOPIFY_ADDRESS);
    const acuityField = getField(clientsTable, FIELD_IDS.CLIENT_ACUITY_ADDRESS);
    const otherField = getField(clientsTable, FIELD_IDS.CLIENT_OTHER_ADDRESS);
    return [
      { label: 'Shopify Address', value: shopifyField ? client.getCellValueAsString(shopifyField) : '' },
      { label: 'Acuity Address', value: acuityField ? client.getCellValueAsString(acuityField) : '' },
      { label: 'Other Address', value: otherField ? client.getCellValueAsString(otherField) : '' },
    ].filter(o => o.value.trim() !== '');
  }, [clientId, clientRecords, clientsTable, getField]);
  const [clientHighlightIndex, setClientHighlightIndex] = useState(-1);
  const [styleSearchQuery, setStyleSearchQuery] = useState('');
  const [showStyleSearch, setShowStyleSearch] = useState(false);
  const [styleHighlightIndex, setStyleHighlightIndex] = useState(-1);
  const [customizationSearchQuery, setCustomizationSearchQuery] = useState('');
  const [showCustomizationSearch, setShowCustomizationSearch] = useState(false);
  const [customizationHighlightIndex, setCustomizationHighlightIndex] = useState(-1);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDiscardVisible, setIsDiscardVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showDiscardConfirm) {
      const timer = setTimeout(() => setIsDiscardVisible(true), 10);
      return () => clearTimeout(timer);
    }
    setIsDiscardVisible(false);
  }, [showDiscardConfirm]);

  const requestClose = (callback: () => void) => {
    setIsVisible(false);
    setTimeout(callback, 200);
  };

  const clientSearchRef = useRef<HTMLDivElement>(null);
  const styleSearchRef = useRef<HTMLDivElement>(null);
  const customizationSearchRef = useRef<HTMLDivElement>(null);

  const canCreate = draftOrdersTable.hasPermissionToCreateRecords();

  const clientNameField = getField(clientsTable, FIELD_IDS.CLIENT_FULL_NAME);
  const clientDueDateField = getField(clientsTable, FIELD_IDS.CLIENT_DUE_DATE);
  const clientWeddingDateField = getField(clientsTable, FIELD_IDS.CLIENT_WEDDING_DATE);
  const styleNameField = getField(stylesTable, FIELD_IDS.STYLE_NAME);
  const stylePriceField = getField(stylesTable, FIELD_IDS.STYLE_PRICE);
  const customizationIdField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_ID);
  const customizationClientField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CLIENT);
  const customizationDetailField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_DETAIL);
  const customizationEffectivePriceField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_EFFECTIVE_PRICE);
  const customizationCustomizedStyleField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CUSTOMIZED_STYLE);
  const customizationApprovalStatusField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_APPROVAL_STATUS);
  const customizationClientApprovalStatusField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CLIENT_APPROVAL_STATUS);
  const stateCostNameField = getField(stateCostsTable, FIELD_IDS.STATE_COST_NAME);
  const stateCostShippingFeeField = getField(stateCostsTable, FIELD_IDS.STATE_COST_SHIPPING_FEE);
  const stateCostTaxRateField = getField(stateCostsTable, FIELD_IDS.STATE_COST_TAX_RATE);
  const rushRuleWeeksField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_WEEKS);
  const rushRuleNonCustomizedPctField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_NON_CUSTOMIZED_PCT);
  const clientFavoriteStylesAcuityField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_ACUITY);
  const clientFavoriteStylesAppointmentField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_APPOINTMENT);

  const hasUnsavedChanges = selectedStyleIds.length > 0
    || selectedCustomizationIds.length > 0
    || address.trim() !== ''
    || discount.trim() !== ''
    || discountPercent.trim() !== '';

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      requestClose(onClose);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseAttempt();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientSearch(false);
      }
      if (styleSearchRef.current && !styleSearchRef.current.contains(e.target as Node)) {
        setShowStyleSearch(false);
      }
      if (customizationSearchRef.current && !customizationSearchRef.current.contains(e.target as Node)) {
        setShowCustomizationSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientRecords.slice(0, 20);
    const query = clientSearchQuery.toLowerCase();
    return clientRecords.filter(client => {
      const name = clientNameField ? client.getCellValueAsString(clientNameField).toLowerCase() : '';
      return name.includes(query);
    }).slice(0, 20);
  }, [clientRecords, clientSearchQuery, clientNameField]);

  // No client-based restriction on which styles are selectable — per Julia
  // (2026-07-30), any style should always be selectable, regardless of the
  // client's customization requests or Acuity/appointment favorite styles.
  // All non-"customized" styles, alphabetical, no cap — "- customized" styles
  // are internal variants (e.g. "Ada - Customized" alongside the real "Ada")
  // that should never be directly selectable here.
  const selectableStyles = useMemo(() => {
    return styleRecords
      .filter(style => {
        const name = styleNameField ? style.getCellValueAsString(styleNameField) : '';
        return !/customized/i.test(name);
      })
      .sort((a, b) => {
        const nameA = styleNameField ? a.getCellValueAsString(styleNameField) : '';
        const nameB = styleNameField ? b.getCellValueAsString(styleNameField) : '';
        return nameA.localeCompare(nameB);
      });
  }, [styleRecords, styleNameField]);

  const filteredStyles = useMemo(() => {
    if (!styleSearchQuery.trim()) return selectableStyles;
    const query = styleSearchQuery.toLowerCase();
    return selectableStyles.filter(style => {
      const name = styleNameField ? style.getCellValueAsString(styleNameField).toLowerCase() : '';
      return name.includes(query);
    });
  }, [selectableStyles, styleSearchQuery, styleNameField]);

  // All of the client's customizations, regardless of style/approval — used
  // only to detect "client has customizations, but none are usable yet" so we
  // can show the approval-needed banner instead of just hiding the section.
  const clientCustomizationsUnfiltered = useMemo(() => {
    if (!clientId) return [];
    return customizationRecords.filter(customization => {
      const linkedClients = getLinkedRecordIds(customization, customizationClientField);
      return linkedClients.includes(clientId);
    });
  }, [customizationRecords, clientId, customizationClientField, getLinkedRecordIds]);

  // Approved-only, regardless of style — used to tell "no approved
  // customizations at all" apart from "approved, but not for this style".
  const clientApprovedCustomizations = useMemo(() => {
    return clientCustomizationsUnfiltered.filter(c =>
      isCustomizationApproved(c, customizationApprovalStatusField, customizationClientApprovalStatusField)
    );
  }, [clientCustomizationsUnfiltered, customizationApprovalStatusField, customizationClientApprovalStatusField]);

  // Only customizations linked to the client AND to one of the currently
  // selected styles AND approved — a customization tied to a style that isn't
  // in this draft, or that hasn't cleared approval, has nothing to do with it.
  const clientCustomizations = useMemo(() => {
    if (selectedStyleIds.length === 0) return [];
    return clientApprovedCustomizations.filter(customization => {
      const linkedStyles = getLinkedRecordIds(customization, customizationCustomizedStyleField);
      return linkedStyles.some(id => selectedStyleIds.includes(id));
    });
  }, [clientApprovedCustomizations, customizationCustomizedStyleField, selectedStyleIds, getLinkedRecordIds]);

  // Every one of the client's customizations that hasn't cleared internal
  // approval yet — client-wide, NOT scoped to the currently selected
  // style(s) (2026-07-30 correction: this must show as soon as a client with
  // a pending request is selected, before any style is picked, not only
  // once a matching style happens to be selected).
  const pendingCustomizations = useMemo(() => {
    return clientCustomizationsUnfiltered.filter(customization =>
      !isCustomizationApproved(customization, customizationApprovalStatusField, customizationClientApprovalStatusField)
    );
  }, [clientCustomizationsUnfiltered, customizationApprovalStatusField, customizationClientApprovalStatusField]);

  // Per-style breakdown of the above, for the combined pending-approval
  // banner — "{Style}: {count} pending approval(s)" for every style that has
  // at least one pending request, regardless of whether that style is
  // currently on this draft.
  const pendingCountsByStyle = useMemo(() => {
    const counts = new Map<string, number>();
    const order: string[] = [];
    for (const customization of pendingCustomizations) {
      const linkedStyles = getLinkedRecordIds(customization, customizationCustomizedStyleField);
      for (const id of linkedStyles) {
        if (!counts.has(id)) order.push(id);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return order.map(id => {
      const styleRec = styleRecords.find(s => s.id === id);
      const name = styleRec && styleNameField ? styleRec.getCellValueAsString(styleNameField) : 'Unknown style';
      return { id, name, count: counts.get(id) ?? 0 };
    });
  }, [pendingCustomizations, customizationCustomizedStyleField, styleRecords, styleNameField, getLinkedRecordIds]);

  const filteredCustomizations = useMemo(() => {
    if (!customizationSearchQuery.trim()) return clientCustomizations.slice(0, 20);
    const query = customizationSearchQuery.toLowerCase();
    return clientCustomizations.filter(customization => {
      const id = customizationIdField ? customization.getCellValueAsString(customizationIdField).toLowerCase() : '';
      const detail = customizationDetailField ? customization.getCellValueAsString(customizationDetailField).toLowerCase() : '';
      return id.includes(query) || detail.includes(query);
    }).slice(0, 20);
  }, [clientCustomizations, customizationSearchQuery, customizationIdField, customizationDetailField]);

  const selectedStyles = useMemo(() => {
    return styleRecords.filter(s => selectedStyleIds.includes(s.id));
  }, [styleRecords, selectedStyleIds]);

  const selectedCustomizations = useMemo(() => {
    return customizationRecords.filter(c => selectedCustomizationIds.includes(c.id));
  }, [customizationRecords, selectedCustomizationIds]);

  // If a style gets deselected, drop any selected customization that was only
  // tied to that style — it's no longer eligible for this draft.
  useEffect(() => {
    setSelectedCustomizationIds(prev => prev.filter(id => clientCustomizations.some(c => c.id === id)));
  }, [clientCustomizations]);

  const styleSubtotal = useMemo(() => {
    return selectedStyles.reduce((sum, style) => {
      const price = stylePriceField ? (style.getCellValue(stylePriceField) as number | null) ?? 0 : 0;
      return sum + price;
    }, 0);
  }, [selectedStyles, stylePriceField]);

  const customizationSubtotal = useMemo(() => {
    return selectedCustomizations.reduce((sum, customization) => {
      const price = customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) ?? 0 : 0;
      return sum + price;
    }, 0);
  }, [selectedCustomizations, customizationEffectivePriceField]);

  // Shipping and Taxes are no longer calculated in Airtable at all — removed
  // 2026-07-30 along with the State Costs selector, per Julia: Shopify will
  // calculate both automatically from the selected shipping address instead.
  const clientDueDate = useMemo(() => {
    if (!clientId) return null;
    const client = clientRecords.find(c => c.id === clientId);
    if (!client || !clientDueDateField) return null;
    return parseDate(client.getCellValueAsString(clientDueDateField));
  }, [clientId, clientRecords, clientDueDateField]);

  const clientWeddingDate = useMemo(() => {
    if (!clientId) return null;
    const client = clientRecords.find(c => c.id === clientId);
    if (!client || !clientWeddingDateField) return null;
    return parseDate(client.getCellValueAsString(clientWeddingDateField));
  }, [clientId, clientRecords, clientWeddingDateField]);

  const weeksUntilDueDate = useMemo(() => {
    if (!clientDueDate) return null;
    const today = new Date();
    return Math.floor((clientDueDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }, [clientDueDate]);

  const rushFee = useMemo(() => {
    if (!clientDueDate || weeksUntilDueDate === null) return 0;

    const customizedStyleIds = new Set(
      selectedCustomizations.flatMap(c => {
        const linkedStyles = getLinkedRecordIds(c, customizationCustomizedStyleField);
        return linkedStyles;
      })
    );

    const standaloneStyles = selectedStyles.filter(s => !customizedStyleIds.has(s.id));

    if (standaloneStyles.length === 0) return 0;

    const weeksRemaining = weeksUntilDueDate;

    // Tiers are buckets keyed by their upper bound: the applicable tier is the
    // smallest "# of Weeks" threshold that is >= weeksRemaining (e.g. 17-20 weeks
    // remaining uses the 20-week tier; <=4 weeks remaining uses the 4-week tier).
    const matchingRule = rushFeeRuleRecords
      .filter(rule => {
        const ruleWeeks = rushRuleWeeksField ? (rule.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        return ruleWeeks >= weeksRemaining;
      })
      .sort((a, b) => {
        const weeksA = rushRuleWeeksField ? (a.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        const weeksB = rushRuleWeeksField ? (b.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        return weeksA - weeksB;
      })[0];

    if (!matchingRule) return 0;
    
    const rushPct = rushRuleNonCustomizedPctField 
      ? (matchingRule.getCellValue(rushRuleNonCustomizedPctField) as number | null) ?? 0 
      : 0;
    
    return standaloneStyles.reduce((sum, style) => {
      const price = stylePriceField ? (style.getCellValue(stylePriceField) as number | null) ?? 0 : 0;
      return sum + (price * rushPct);
    }, 0);
  }, [selectedStyles, selectedCustomizations, clientDueDate, weeksUntilDueDate, rushFeeRuleRecords, stylePriceField, rushRuleWeeksField, rushRuleNonCustomizedPctField, customizationCustomizedStyleField, getLinkedRecordIds]);

  const rushFeeExplanation = useMemo(() => {
    if (!clientDueDate || weeksUntilDueDate === null) return '';
    const customizedStyleIds = new Set(
      selectedCustomizations.flatMap(c => getLinkedRecordIds(c, customizationCustomizedStyleField))
    );
    const standaloneCount = selectedStyles.filter(s => !customizedStyleIds.has(s.id)).length;
    return getRushFeeExplanation(standaloneCount, weeksUntilDueDate, clientDueDate, rushFeeRuleRecords, rushRuleWeeksField, rushRuleNonCustomizedPctField);
  }, [selectedStyles, selectedCustomizations, clientDueDate, weeksUntilDueDate, rushFeeRuleRecords, rushRuleWeeksField, rushRuleNonCustomizedPctField, customizationCustomizedStyleField, getLinkedRecordIds]);

  const discountAmount = useMemo(() => {
    const orderSubtotal = styleSubtotal + customizationSubtotal;
    if (discountMode === 'percentage') {
      const pct = Math.min(Math.max(parsePercentInput(discountPercent), 0), 1);
      return orderSubtotal * pct;
    }
    return Math.min(Math.max(parseCurrency(discount), 0), orderSubtotal);
  }, [discountMode, discount, discountPercent, styleSubtotal, customizationSubtotal]);

  // Reformats and clamps the visible value once the user leaves the field —
  // currency can't exceed the order's subtotal, percentage can't exceed 100%.
  const handleDiscountBlur = () => {
    const orderSubtotal = styleSubtotal + customizationSubtotal;
    if (discountMode === 'percentage') {
      if (discountPercent.trim() === '') return;
      const raw = parseFloat(discountPercent.replace(/[^0-9.-]/g, '')) || 0;
      const clamped = Math.min(Math.max(raw, 0), 100);
      setDiscountPercent(`${clamped}%`);
    } else {
      if (discount.trim() === '') return;
      const clamped = Math.min(Math.max(parseCurrency(discount), 0), orderSubtotal);
      setDiscount(formatCurrency(clamped));
    }
  };

  const total = useMemo(() => {
    return rushFee - discountAmount;
  }, [rushFee, discountAmount]);

  const grandTotal = useMemo(() => {
    return styleSubtotal + customizationSubtotal + total;
  }, [styleSubtotal, customizationSubtotal, total]);

  const canSave = canCreate && !!clientId && selectedStyleIds.length > 0;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const clientFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_CLIENT);
      const styleFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_STYLE);
      const customizationsFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_CUSTOMIZATIONS);
      const rushFeeFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_RUSH_FEE);
      const discountCurrencyFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_CURRENCY);
      const discountPercentageFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_PERCENTAGE);
      const discountNotesFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_NOTES);
      const addressFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_ADDRESS);

      const fields: Record<string, unknown> = {};

      if (clientFieldObj) fields[clientFieldObj.id] = [{ id: clientId }];
      if (styleFieldObj) fields[styleFieldObj.id] = selectedStyleIds.map(id => ({ id }));
      if (customizationsFieldObj) fields[customizationsFieldObj.id] = selectedCustomizationIds.map(id => ({ id }));
      if (rushFeeFieldObj) fields[rushFeeFieldObj.id] = rushFee;
      // Discount is entered as either a dollar amount or a percentage — only
      // write to whichever field matches the selected mode.
      if (discountMode === 'percentage') {
        if (discountPercentageFieldObj) fields[discountPercentageFieldObj.id] = parsePercentInput(discountPercent);
      } else {
        if (discountCurrencyFieldObj) fields[discountCurrencyFieldObj.id] = parseCurrency(discount);
      }
      if (discountNotesFieldObj && discountNotes.trim()) fields[discountNotesFieldObj.id] = discountNotes.trim();
      if (addressFieldObj && address.trim()) fields[addressFieldObj.id] = address.trim();

      const newDraftId = await draftOrdersTable.createRecordAsync(fields);
      onSave(newDraftId);
    } catch (error) {
      console.error('Failed to save draft:', error);
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(`Failed to save draft: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleCloseAttempt}
    >
      <div
        className="absolute inset-0 transition-opacity duration-200 ease-out"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible ? 1 : 0 }}
      />
      <div
        className="relative w-full max-h-[90vh] flex flex-col rounded-xl overflow-hidden transition-all duration-200 ease-out"
        style={{
          backgroundColor: theme.bgCard,
          maxWidth: '960px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.96)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-lg font-semibold">New Draft Order</h2>
          {isClientPreset && clientId && (
            <p className="text-sm mt-0.5" style={{ color: theme.textSecondary }}>{getClientName(clientId)}</p>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="flex gap-6 items-start">
            <div className="w-[60%] min-w-0 space-y-4">
              {!isClientPreset && (
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Client</h2>
                <div ref={clientSearchRef} className="relative w-64">
                  <MagnifyingGlassIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: theme.textMuted }}
                  />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchQuery}
                    onChange={e => {
                      const value = e.target.value;
                      setClientSearchQuery(value);
                      setShowClientSearch(value.trim() !== '');
                      setClientHighlightIndex(-1);
                    }}
                    onFocus={() => {
                      if (clientId) {
                        setShowClientSearch(true);
                        setClientHighlightIndex(-1);
                      }
                    }}
                    onKeyDown={e => {
                      if (!showClientSearch || filteredClients.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setClientHighlightIndex(i => Math.min(i + 1, filteredClients.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setClientHighlightIndex(i => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter' && clientHighlightIndex >= 0) {
                        e.preventDefault();
                        const client = filteredClients[clientHighlightIndex];
                        onClientSelect(client.id);
                        setShowClientSearch(false);
                        setClientSearchQuery(clientNameField ? client.getCellValueAsString(clientNameField) : '');
                      }
                    }}
                    className={`w-full pl-9 py-2 rounded-md text-sm ${clientId ? 'pr-9' : 'pr-3'}`}
                    style={{
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      color: theme.text
                    }}
                  />
                  {clientId && (
                    <button
                      onClick={() => {
                        onClientSelect(null);
                        setClientSearchQuery('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:cursor-pointer"
                      style={{ color: theme.textMuted }}
                    >
                      <XIcon size={16} />
                    </button>
                  )}
                  {showClientSearch && (clientId || clientSearchQuery.trim() !== '') && (
                    <div
                      className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
                      style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                    >
                      {filteredClients.map((client, index) => (
                        <button
                          key={client.id}
                          onClick={() => {
                            onClientSelect(client.id);
                            setShowClientSearch(false);
                            setClientSearchQuery(clientNameField ? client.getCellValueAsString(clientNameField) : '');
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer"
                          style={{ color: theme.text, backgroundColor: index === clientHighlightIndex ? theme.bgHover : 'transparent' }}
                          onMouseEnter={() => setClientHighlightIndex(index)}
                        >
                          {clientNameField ? client.getCellValueAsString(clientNameField) : 'Unknown'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Address</h2>
                <div className="w-64">
                  <AddressSelector
                    value={address}
                    onChange={setAddress}
                    options={clientAddressOptions}
                    disabled={!clientId}
                    theme={theme}
                    bordered
                  />
                </div>
              </div>

              <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h2 className="text-base font-semibold">Styles</h2>
                    <div ref={styleSearchRef} className="relative w-64">
                      <MagnifyingGlassIcon
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: theme.textMuted }}
                      />
                      <input
                        type="text"
                        placeholder={clientId ? 'Search styles...' : 'Select a client first'}
                        value={styleSearchQuery}
                        onChange={e => {
                          const value = e.target.value;
                          setStyleSearchQuery(value);
                          setShowStyleSearch(true);
                          setStyleHighlightIndex(-1);
                        }}
                        onFocus={() => {
                          if (clientId) {
                            setShowStyleSearch(true);
                            setStyleHighlightIndex(-1);
                          }
                        }}
                        onKeyDown={e => {
                          if (!showStyleSearch || filteredStyles.length === 0) return;
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setStyleHighlightIndex(i => Math.min(i + 1, filteredStyles.length - 1));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setStyleHighlightIndex(i => Math.max(i - 1, 0));
                          } else if (e.key === 'Enter' && styleHighlightIndex >= 0) {
                            e.preventDefault();
                            const style = filteredStyles[styleHighlightIndex];
                            const isSelected = selectedStyleIds.includes(style.id);
                            setSelectedStyleIds(
                              isSelected
                                ? selectedStyleIds.filter(id => id !== style.id)
                                : [...selectedStyleIds, style.id]
                            );
                            setStyleSearchQuery('');
                          }
                        }}
                        disabled={!clientId}
                        className="w-full pl-9 pr-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: theme.bg,
                          border: `1px solid ${theme.border}`,
                          color: theme.text
                        }}
                      />
                      {showStyleSearch && clientId && (
                        <div
                          className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
                          style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                        >
                          {filteredStyles.length === 0 ? (
                            <p className="px-3 py-2 text-sm" style={{ color: theme.textSecondary }}>
                              No styles match your search.
                            </p>
                          ) : (
                            filteredStyles.map((style, index) => {
                              const isSelected = selectedStyleIds.includes(style.id);
                              const isHighlighted = index === styleHighlightIndex;
                              return (
                                <button
                                  key={style.id}
                                  onClick={() => {
                                    setSelectedStyleIds(
                                      isSelected
                                        ? selectedStyleIds.filter(id => id !== style.id)
                                        : [...selectedStyleIds, style.id]
                                    );
                                    setStyleSearchQuery('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer flex justify-between gap-2"
                                  style={{
                                    color: theme.text,
                                    backgroundColor: isHighlighted ? theme.bgHover : (isSelected ? theme.accentSoft : 'transparent')
                                  }}
                                  onMouseEnter={() => setStyleHighlightIndex(index)}
                                >
                                  <span className={`truncate ${isSelected ? 'font-medium' : ''}`}>{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</span>
                                  <span className="whitespace-nowrap" style={{ color: theme.textSecondary }}>
                                    {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedStyles.length === 0 ? (
                    <p className="text-sm" style={{ color: theme.textSecondary }}>No styles selected.</p>
                  ) : (
                    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr style={{ backgroundColor: theme.bgHover }}>
                          <th className="w-10 pl-4 py-3"></th>
                          <th className="text-left py-3 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Name</th>
                          <th className="text-right py-3 pr-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStyles.map(style => (
                          <tr key={style.id} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                            <td className="py-3 pl-4">
                              <button
                                onClick={() => setSelectedStyleIds(selectedStyleIds.filter(id => id !== style.id))}
                                className="hover:cursor-pointer"
                                style={{ color: theme.textMuted }}
                              >
                                <XIcon size={14} />
                              </button>
                            </td>
                            <td className="py-3 pr-3">{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</td>
                            <td className="py-3 pr-4 text-right whitespace-nowrap">
                              {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: `1px solid ${theme.border}` }}>
                          <td className="py-3 pl-4"></td>
                          <td className="py-3 font-medium">Subtotal</td>
                          <td className="py-3 pr-4 text-right font-medium whitespace-nowrap">{formatCurrency(styleSubtotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  )}
              </div>

              {clientId && clientCustomizationsUnfiltered.length > 0 && (
                <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-base font-semibold">Customizations</h2>
                      {clientApprovedCustomizations.length > 0 && (
                      <div ref={customizationSearchRef} className="relative w-64">
                        <MagnifyingGlassIcon
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2"
                          style={{ color: theme.textMuted }}
                        />
                        <input
                          type="text"
                          placeholder="Search customizations..."
                          value={customizationSearchQuery}
                          onChange={e => {
                            setCustomizationSearchQuery(e.target.value);
                            setCustomizationHighlightIndex(-1);
                          }}
                          onFocus={() => {
                            setShowCustomizationSearch(true);
                            setCustomizationHighlightIndex(-1);
                          }}
                          onKeyDown={e => {
                            if (!showCustomizationSearch || filteredCustomizations.length === 0) return;
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setCustomizationHighlightIndex(i => Math.min(i + 1, filteredCustomizations.length - 1));
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setCustomizationHighlightIndex(i => Math.max(i - 1, 0));
                            } else if (e.key === 'Enter' && customizationHighlightIndex >= 0) {
                              e.preventDefault();
                              const customization = filteredCustomizations[customizationHighlightIndex];
                              const isSelected = selectedCustomizationIds.includes(customization.id);
                              setSelectedCustomizationIds(
                                isSelected
                                  ? selectedCustomizationIds.filter(id => id !== customization.id)
                                  : [...selectedCustomizationIds, customization.id]
                              );
                              setCustomizationSearchQuery('');
                            }
                          }}
                          className="w-full pl-9 pr-3 py-2 rounded-md text-sm"
                          style={{
                            backgroundColor: theme.bg,
                            border: `1px solid ${theme.border}`,
                            color: theme.text
                          }}
                        />
                        {showCustomizationSearch && (
                          <div
                            className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
                            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                          >
                            {filteredCustomizations.map((customization, index) => {
                              const isSelected = selectedCustomizationIds.includes(customization.id);
                              const isHighlighted = index === customizationHighlightIndex;
                              return (
                                <button
                                  key={customization.id}
                                  onClick={() => {
                                    setSelectedCustomizationIds(
                                      isSelected
                                        ? selectedCustomizationIds.filter(id => id !== customization.id)
                                        : [...selectedCustomizationIds, customization.id]
                                    );
                                    setCustomizationSearchQuery('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer"
                                  style={{
                                    color: theme.text,
                                    backgroundColor: isHighlighted ? theme.bgHover : (isSelected ? theme.accentSoft : 'transparent')
                                  }}
                                  onMouseEnter={() => setCustomizationHighlightIndex(index)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`truncate ${isSelected ? 'font-medium' : ''}`}>{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</span>
                                    <span className="whitespace-nowrap" style={{ color: theme.textSecondary }}>
                                      {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                    {pendingCountsByStyle.length > 0 && (
                      <div className="rounded-lg px-4 py-3 text-sm mb-3" style={{ backgroundColor: theme.neutralBg, color: theme.textSecondary }}>
                        <p>This client has customization requests waiting for internal review, which need to be approved before they can be added.</p>
                        <ul className="list-disc pl-5 mt-1">
                          {pendingCountsByStyle.map(s => (
                            <li key={s.id}>{s.name}: {s.count} pending approval{s.count === 1 ? '' : 's'}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedCustomizations.length === 0 ? (
                      pendingCountsByStyle.length === 0 && (
                        <p className="text-sm" style={{ color: theme.textSecondary }}>No customizations selected.</p>
                      )
                    ) : (
                      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ backgroundColor: theme.bgHover }}>
                            <th className="w-10 pl-4 py-3"></th>
                            <th className="text-left py-3 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Name</th>
                            <th className="text-right py-3 pr-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCustomizations.map(customization => (
                            <tr key={customization.id} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                              <td className="py-3 pl-4 align-top">
                                <button
                                  onClick={() => setSelectedCustomizationIds(selectedCustomizationIds.filter(id => id !== customization.id))}
                                  className="hover:cursor-pointer"
                                  style={{ color: theme.textMuted }}
                                >
                                  <XIcon size={14} />
                                </button>
                              </td>
                              <td className="py-3 pr-3 align-top">
                                <div>{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</div>
                                {customizationDetailField && customization.getCellValueAsString(customizationDetailField) && (
                                  <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                    {customization.getCellValueAsString(customizationDetailField)}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 pr-4 text-right align-top whitespace-nowrap">
                                {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: `1px solid ${theme.border}` }}>
                            <td className="py-3 pl-4"></td>
                            <td className="py-3 font-medium">Subtotal</td>
                            <td className="py-3 pr-4 text-right font-medium whitespace-nowrap">{formatCurrency(customizationSubtotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                      </div>
                    )}
                </div>
              )}

              <div>
                  <h2 className="text-base font-semibold mb-3">Additional Charges</h2>
                  {!clientDueDate && clientId && (
                    <p className="text-xs mb-2" style={{ color: theme.textSecondary }}>
                      Rush fee requires a wedding date on file.
                    </p>
                  )}
                  <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                  <table className="w-full text-sm border-collapse table-fixed">
                    <colgroup>
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '50%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ backgroundColor: theme.bgHover }}>
                        <th className="text-left py-3 pl-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Charge</th>
                        <th className="text-right py-3 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Price</th>
                        <th className="text-left py-3 pl-3 pr-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                        <td className="py-3 pl-4" style={{ backgroundColor: theme.neutralBg }}>Rush Fee</td>
                        <td className="py-3 pr-2 text-right whitespace-nowrap" style={{ backgroundColor: theme.neutralBg }}>{formatCurrency(rushFee)}</td>
                        <td className="py-3 pl-3 pr-4 text-xs" style={{ color: theme.textMuted, backgroundColor: theme.neutralBg }}>
                          {rushFeeExplanation}
                        </td>
                      </tr>
                      <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                        <td className="py-3 pl-4">
                          <div className="flex items-center gap-2">
                            <span>Discount</span>
                            <DiscountModeToggle mode={discountMode} onChange={setDiscountMode} theme={theme} disabled={!clientId} />
                          </div>
                        </td>
                        <td className="py-3">
                          <input
                            type="text"
                            placeholder={discountMode === 'percentage' ? '0%' : '$0.00'}
                            value={discountMode === 'percentage' ? discountPercent : discount}
                            onChange={e => discountMode === 'percentage' ? setDiscountPercent(e.target.value) : setDiscount(e.target.value)}
                            onBlur={handleDiscountBlur}
                            disabled={!clientId}
                            className="w-full px-2 py-1 text-sm text-right disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: 'transparent', border: 'none', color: theme.text }}
                          />
                        </td>
                        <td className="py-3 pl-3 pr-4">
                          <input
                            type="text"
                            placeholder="Notes..."
                            value={discountNotes}
                            onChange={e => setDiscountNotes(e.target.value)}
                            disabled={!clientId}
                            className="w-full px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: 'transparent', border: 'none', color: theme.text }}
                          />
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${theme.border}` }}>
                        <td className="py-3 pl-4 font-medium">Total</td>
                        <td className="py-3 font-medium text-right whitespace-nowrap">{formatCurrency(total)}</td>
                        <td className="py-3 pl-3 pr-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
              </div>
            </div>

            <div className="w-[40%] shrink-0 sticky top-0">
              <div className="p-4 rounded-lg space-y-4 text-base" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
                <h2 className="text-base font-semibold mb-1">Summary</h2>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  Saves automatically once you click Save Draft
                </p>
                {styleSubtotal !== 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: theme.textSecondary }}>Style Subtotal</span>
                    <span>{formatCurrency(styleSubtotal)}</span>
                  </div>
                )}
                {customizationSubtotal !== 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: theme.textSecondary }}>Customization Subtotal</span>
                    <span>{formatCurrency(customizationSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Rush Fee</span>
                  <span>{formatCurrency(rushFee)}</span>
                </div>
                {discountAmount !== 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: theme.textSecondary }}>Discount</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {total !== 0 && (
                  <div className="flex justify-between pt-3 border-t" style={{ borderColor: theme.borderLight }}>
                    <span style={{ color: theme.textSecondary }}>Total (fees - discount)</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                )}
                {grandTotal !== 0 && (
                  <div className="flex justify-between pt-3 border-t font-semibold" style={{ borderColor: theme.borderLight }}>
                    <span>Grand Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: theme.border }}>
          <div>
            {saveError && <p className="text-sm" style={{ color: theme.danger }}>{saveError}</p>}
            {!canCreate && <p className="text-sm" style={{ color: theme.danger }}>You don't have permission to create drafts.</p>}
            {canCreate && (!clientId || selectedStyleIds.length === 0) && (
              <p className="text-sm" style={{ color: theme.textSecondary }}>Client and at least one Style are required.</p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accent, color: '#FFFFFF' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.accent; }}
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </div>
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => { setIsDiscardVisible(false); setTimeout(() => setShowDiscardConfirm(false), 150); }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-150 ease-out"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isDiscardVisible ? 1 : 0 }}
          />
          <div
            className="relative w-full rounded-xl overflow-hidden transition-all duration-150 ease-out"
            style={{
              backgroundColor: theme.bgCard,
              maxWidth: '480px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              border: `1px solid ${theme.border}`,
              opacity: isDiscardVisible ? 1 : 0,
              transform: isDiscardVisible ? 'scale(1)' : 'scale(0.96)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-base font-semibold mb-2">Discard this draft?</h3>
              <p className="text-sm" style={{ color: theme.textSecondary }}>
                You have unsaved changes. If you close now, they'll be lost.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: theme.border }}>
              <button
                onClick={() => { setIsDiscardVisible(false); setTimeout(() => setShowDiscardConfirm(false), 150); }}
                className="px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm"
                style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
              >
                Keep Editing
              </button>
              <button
                onClick={() => { setIsDiscardVisible(false); requestClose(onClose); }}
                className="px-3 py-1.5 rounded-md hover:cursor-pointer text-sm font-medium"
                style={{ backgroundColor: 'transparent', color: theme.danger }}
              >
                Discard Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Layer4Props {
  theme: typeof COLORS.LIGHT;
  draftId: string;
  clientId: string;
  draftRecords: AirtableRecord[];
  styleRecords: AirtableRecord[];
  customizationRecords: AirtableRecord[];
  stateCostRecords: AirtableRecord[];
  rushFeeRuleRecords: AirtableRecord[];
  clientRecords: AirtableRecord[];
  draftOrdersTable: Table;
  stylesTable: Table;
  customizationsTable: Table;
  stateCostsTable: Table;
  rushFeeRulesTable: Table;
  clientsTable: Table;
  getField: (table: Table, fieldId: string) => Field | null;
  getLinkedRecordIds: (record: AirtableRecord, field: Field | null) => string[];
  getMostRecentDraft: (clientId: string) => AirtableRecord | null;
  getClientName: (clientId: string) => string;
  onBack: () => void;
}

function Layer4({
  theme,
  draftId,
  clientId,
  draftRecords,
  styleRecords,
  customizationRecords,
  stateCostRecords,
  rushFeeRuleRecords,
  clientRecords,
  draftOrdersTable,
  stylesTable,
  customizationsTable,
  stateCostsTable,
  rushFeeRulesTable,
  clientsTable,
  getField,
  getLinkedRecordIds,
  getMostRecentDraft,
  getClientName,
  onBack,
}: Layer4Props) {
  const draft = draftRecords.find(d => d.id === draftId);
  const canUpdate = draftOrdersTable.hasPermissionToUpdateRecords();

  const createdAtField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CREATED_AT);
  const lockedField = getField(draftOrdersTable, FIELD_IDS.DRAFT_LOCKED);
  const styleField = getField(draftOrdersTable, FIELD_IDS.DRAFT_STYLE);
  const customizationsField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CUSTOMIZATIONS);
  const stateCostsField = getField(draftOrdersTable, FIELD_IDS.DRAFT_STATE_COSTS);
  const stateCostNameField = getField(stateCostsTable, FIELD_IDS.STATE_COST_NAME);
  const rushFeeField = getField(draftOrdersTable, FIELD_IDS.DRAFT_RUSH_FEE);
  const shippingField = getField(draftOrdersTable, FIELD_IDS.DRAFT_SHIPPING);
  const taxesField = getField(draftOrdersTable, FIELD_IDS.DRAFT_TAXES);
  const discountField = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_CURRENCY);
  const discountPercentageField = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_PERCENTAGE);
  const discountNotesField = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_NOTES);
  const addressField = getField(draftOrdersTable, FIELD_IDS.DRAFT_ADDRESS);
  const styleSubtotalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_STYLE_SUBTOTAL);
  const customizationSubtotalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CUSTOMIZATION_SUBTOTAL);
  const totalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_TOTAL);
  const grandTotalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_GRAND_TOTAL);
  const weddingDateField = getField(draftOrdersTable, FIELD_IDS.DRAFT_WEDDING_DATE);
  const dueDateField = getField(draftOrdersTable, FIELD_IDS.DRAFT_DUE_DATE);
  const leadTimeField = getField(draftOrdersTable, FIELD_IDS.DRAFT_LEAD_TIME);

  const styleNameField = getField(stylesTable, FIELD_IDS.STYLE_NAME);
  const stylePriceField = getField(stylesTable, FIELD_IDS.STYLE_PRICE);
  const customizationIdField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_ID);
  const customizationDetailField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_DETAIL);
  const customizationEffectivePriceField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_EFFECTIVE_PRICE);
  const customizationClientField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CLIENT);
  const customizationCustomizedStyleField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CUSTOMIZED_STYLE);
  const customizationApprovalStatusField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_APPROVAL_STATUS);
  const customizationClientApprovalStatusField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CLIENT_APPROVAL_STATUS);
  const clientDueDateField = getField(clientsTable, FIELD_IDS.CLIENT_DUE_DATE);
  const rushRuleWeeksField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_WEEKS);
  const rushRuleNonCustomizedPctField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_NON_CUSTOMIZED_PCT);
  const clientFavoriteStylesAcuityField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_ACUITY);
  const clientFavoriteStylesAppointmentField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_APPOINTMENT);
  const clientShopifyAddressField = getField(clientsTable, FIELD_IDS.CLIENT_SHOPIFY_ADDRESS);
  const clientAcuityAddressField = getField(clientsTable, FIELD_IDS.CLIENT_ACUITY_ADDRESS);
  const clientOtherAddressField = getField(clientsTable, FIELD_IDS.CLIENT_OTHER_ADDRESS);
  const clientReadyToWearSizeField = getField(clientsTable, FIELD_IDS.CLIENT_READY_TO_WEAR_SIZE);

  // Shopify Draft Order Creation story (2026-08-11)
  const shopifyStatusField = getField(draftOrdersTable, FIELD_IDS.DRAFT_SHOPIFY_STATUS);
  const syncErrorMessageField = getField(draftOrdersTable, FIELD_IDS.DRAFT_SYNC_ERROR_MESSAGE);
  const initiatedByEmailField = getField(draftOrdersTable, FIELD_IDS.DRAFT_INITIATED_BY_EMAIL);
  const customizationTypeField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_TYPE);
  const styleCategoryField = getField(stylesTable, FIELD_IDS.STYLE_CATEGORY);
  const session = useSession();
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [creatingShopifyDraftOrder, setCreatingShopifyDraftOrder] = useState(false);
  const [shopifyActionError, setShopifyActionError] = useState<string | null>(null);
  const [showShopifyConfirm, setShowShopifyConfirm] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addressLocal, setAddressLocal] = useState('');
  const [discountMode, setDiscountMode] = useState<'currency' | 'percentage'>('currency');
  const [styleSearchQuery, setStyleSearchQuery] = useState('');
  const [showStyleSearch, setShowStyleSearch] = useState(false);
  const [styleHighlightIndex, setStyleHighlightIndex] = useState(-1);
  const [customizationSearchQuery, setCustomizationSearchQuery] = useState('');
  const [showCustomizationSearch, setShowCustomizationSearch] = useState(false);
  const [customizationHighlightIndex, setCustomizationHighlightIndex] = useState(-1);

  const styleSearchRef = useRef<HTMLDivElement>(null);
  const customizationSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (styleSearchRef.current && !styleSearchRef.current.contains(e.target as Node)) {
        setShowStyleSearch(false);
      }
      if (customizationSearchRef.current && !customizationSearchRef.current.contains(e.target as Node)) {
        setShowCustomizationSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // All of the client's customizations, regardless of approval — used only
  // to detect the pending-per-style case below (see the matching comment in
  // Layer2's clientCustomizationsUnfiltered).
  const clientCustomizationsUnfiltered = useMemo(() => {
    return customizationRecords.filter(customization =>
      getLinkedRecordIds(customization, customizationClientField).includes(clientId)
    );
  }, [customizationRecords, clientId, customizationClientField, getLinkedRecordIds]);

  const clientCustomizations = useMemo(() => {
    return clientCustomizationsUnfiltered.filter(customization =>
      isCustomizationApproved(customization, customizationApprovalStatusField, customizationClientApprovalStatusField)
    );
  }, [clientCustomizationsUnfiltered, customizationApprovalStatusField, customizationClientApprovalStatusField]);

  // No client-based restriction on which styles are selectable — see the
  // matching comment in Layer2.
  // All non-"customized" styles, alphabetical, no cap — "- customized" styles
  // are internal variants (e.g. "Ada - Customized" alongside the real "Ada")
  // that should never be directly selectable here.
  const selectableStyles = useMemo(() => {
    return styleRecords
      .filter(style => {
        const name = styleNameField ? style.getCellValueAsString(styleNameField) : '';
        return !/customized/i.test(name);
      })
      .sort((a, b) => {
        const nameA = styleNameField ? a.getCellValueAsString(styleNameField) : '';
        const nameB = styleNameField ? b.getCellValueAsString(styleNameField) : '';
        return nameA.localeCompare(nameB);
      });
  }, [styleRecords, styleNameField]);

  const filteredStyles = useMemo(() => {
    if (!styleSearchQuery.trim()) return selectableStyles;
    const query = styleSearchQuery.toLowerCase();
    return selectableStyles.filter(style => {
      const name = styleNameField ? style.getCellValueAsString(styleNameField).toLowerCase() : '';
      return name.includes(query);
    });
  }, [selectableStyles, styleSearchQuery, styleNameField]);

  const filteredCustomizations = useMemo(() => {
    if (!customizationSearchQuery.trim()) return clientCustomizations.slice(0, 20);
    const query = customizationSearchQuery.toLowerCase();
    return clientCustomizations.filter(customization => {
      const id = customizationIdField ? customization.getCellValueAsString(customizationIdField).toLowerCase() : '';
      const detail = customizationDetailField ? customization.getCellValueAsString(customizationDetailField).toLowerCase() : '';
      return id.includes(query) || detail.includes(query);
    }).slice(0, 20);
  }, [clientCustomizations, customizationSearchQuery, customizationIdField, customizationDetailField]);

  const clientDueDate = useMemo(() => {
    const client = clientRecords.find(c => c.id === clientId);
    if (!client || !clientDueDateField) return null;
    return parseDate(client.getCellValueAsString(clientDueDateField));
  }, [clientId, clientRecords, clientDueDateField]);

  const weddingDate = useMemo(() => {
    if (!draft || !weddingDateField) return null;
    return parseDate(draft.getCellValueAsString(weddingDateField));
  }, [draft, weddingDateField]);

  const dueDate = useMemo(() => {
    if (!draft || !dueDateField) return null;
    return parseDate(draft.getCellValueAsString(dueDateField));
  }, [draft, dueDateField]);

  const weeksUntilDueDate = useMemo(() => {
    if (!dueDate) return null;
    const today = new Date();
    return Math.floor((dueDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }, [dueDate]);

  // Must run unconditionally (guarding on `draft` internally) — this used to
  // sit after the `if (!draft)` early return further down, which skipped the
  // hook on some renders and not others (e.g. right after creating a draft,
  // before draftRecords syncs), triggering React error #310.
  const rushFeeExplanation = useMemo(() => {
    if (!draft || !dueDate || weeksUntilDueDate === null) return '';
    const styleIds = getLinkedRecordIds(draft, styleField);
    const customizationIds = getLinkedRecordIds(draft, customizationsField);
    const styles = styleRecords.filter(s => styleIds.includes(s.id));
    const customizations = customizationRecords.filter(c => customizationIds.includes(c.id));
    const customizedStyleIds = new Set(
      customizations.flatMap(c => getLinkedRecordIds(c, customizationCustomizedStyleField))
    );
    const standaloneCount = styles.filter(s => !customizedStyleIds.has(s.id)).length;
    return getRushFeeExplanation(standaloneCount, weeksUntilDueDate, dueDate, rushFeeRuleRecords, rushRuleWeeksField, rushRuleNonCustomizedPctField);
  }, [draft, dueDate, weeksUntilDueDate, styleField, customizationsField, styleRecords, customizationRecords, customizationCustomizedStyleField, rushFeeRuleRecords, rushRuleWeeksField, rushRuleNonCustomizedPctField, getLinkedRecordIds]);

  const computeRushFee = (styleIds: string[], customizationIds: string[]): number => {
    if (!clientDueDate) return 0;

    const stylesSel = styleRecords.filter(s => styleIds.includes(s.id));
    const customizationsSel = customizationRecords.filter(c => customizationIds.includes(c.id));

    const customizedStyleIds = new Set(
      customizationsSel.flatMap(c => getLinkedRecordIds(c, customizationCustomizedStyleField))
    );
    const standaloneStyles = stylesSel.filter(s => !customizedStyleIds.has(s.id));
    if (standaloneStyles.length === 0) return 0;

    const today = new Date();
    const weeksRemaining = Math.floor((clientDueDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

    const matchingRule = rushFeeRuleRecords
      .filter(rule => {
        const ruleWeeks = rushRuleWeeksField ? (rule.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        return ruleWeeks >= weeksRemaining;
      })
      .sort((a, b) => {
        const weeksA = rushRuleWeeksField ? (a.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        const weeksB = rushRuleWeeksField ? (b.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        return weeksA - weeksB;
      })[0];

    if (!matchingRule) return 0;

    const rushPct = rushRuleNonCustomizedPctField
      ? (matchingRule.getCellValue(rushRuleNonCustomizedPctField) as number | null) ?? 0
      : 0;

    return standaloneStyles.reduce((sum, style) => {
      const price = stylePriceField ? (style.getCellValue(stylePriceField) as number | null) ?? 0 : 0;
      return sum + (price * rushPct);
    }, 0);
  };

  useEffect(() => {
    if (!draft || !rushFeeField || !canUpdate) return;
    const locked = lockedField ? !!draft.getCellValue(lockedField) : false;
    if (locked) return;
    const mostRecent = getMostRecentDraft(clientId);
    if (mostRecent?.id !== draftId) return;

    const currentStyleIds = getLinkedRecordIds(draft, styleField);
    const currentCustomizationIds = getLinkedRecordIds(draft, customizationsField);
    const freshRushFee = computeRushFee(currentStyleIds, currentCustomizationIds);
    const storedRushFee = (draft.getCellValue(rushFeeField) as number | null) ?? 0;

    if (Math.abs(freshRushFee - storedRushFee) > 0.005) {
      draftOrdersTable.updateRecordAsync(draftId, { [rushFeeField.id]: freshRushFee }).catch(error => {
        console.error('Failed to self-heal rush fee:', error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, clientDueDate, canUpdate]);

  const [showNotFound, setShowNotFound] = useState(false);
  useEffect(() => {
    if (draft) {
      setShowNotFound(false);
      return;
    }
    const timer = setTimeout(() => setShowNotFound(true), 3000);
    return () => clearTimeout(timer);
  }, [draft]);

  // Default the toggle to whichever of the two discount fields actually has a
  // value for this draft, once per draft loaded. Must run unconditionally
  // (guarding on `draft` internally) — it used to sit after the `if (!draft)`
  // early return below, which skipped this hook on some renders and not
  // others (e.g. right after creating a draft, before draftRecords syncs),
  // triggering React error #310 (hook count mismatch between renders).
  useEffect(() => {
    if (!draft) return;
    const discountVal = discountField ? (draft.getCellValue(discountField) as number | null) ?? 0 : 0;
    const discountPctVal = discountPercentageField ? (draft.getCellValue(discountPercentageField) as number | null) ?? 0 : 0;
    setDiscountMode(discountPctVal > 0 && discountVal === 0 ? 'percentage' : 'currency');
  }, [draft, draftId, discountField, discountPercentageField]);

  // Must run unconditionally (guarding on `draft` internally) — this used to
  // sit after the `if (!draft)` early return below (compute `address` inline
  // there and effect off of it), which skipped the hook on some renders and
  // not others (e.g. right after creating a brand-new draft, before
  // draftRecords syncs), triggering React error #310, same root cause as the
  // two hooks directly above.
  useEffect(() => {
    if (!draft) return;
    setAddressLocal(addressField ? draft.getCellValueAsString(addressField) ?? '' : '');
  }, [draft, addressField]);

  // Must run unconditionally too — this used to sit after the `if (!draft)`
  // early return below, same root cause (and same fix) as the two hooks
  // directly above: skipped on some renders (e.g. right after creating a
  // brand-new draft, before draftRecords syncs) and not others, triggering
  // React error #310.
  const clientAddressOptions = useMemo(() => {
    const client = clientRecords.find(c => c.id === clientId);
    if (!client) return [];
    return [
      { label: 'Shopify Address', value: clientShopifyAddressField ? client.getCellValueAsString(clientShopifyAddressField) : '' },
      { label: 'Acuity Address', value: clientAcuityAddressField ? client.getCellValueAsString(clientAcuityAddressField) : '' },
      { label: 'Other Address', value: clientOtherAddressField ? client.getCellValueAsString(clientOtherAddressField) : '' },
    ].filter(o => o.value.trim() !== '');
  }, [clientId, clientRecords, clientShopifyAddressField, clientAcuityAddressField, clientOtherAddressField]);

  if (!draft) {
    return (
      <div className="h-screen flex items-center justify-center">
        {showNotFound ? (
          <p style={{ color: theme.textSecondary }}>Draft not found.</p>
        ) : (
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: `2px solid ${theme.border}`, borderTopColor: theme.accent }}
          />
        )}
      </div>
    );
  }

  const createdAt = createdAtField ? (draft.getCellValue(createdAtField) as string | null) : null;
  const isLocked = lockedField ? !!draft.getCellValue(lockedField) : false;
  const linkedStyleIds = getLinkedRecordIds(draft, styleField);
  // Every one of the client's customizations that hasn't cleared internal
  // approval yet — client-wide, NOT scoped to the styles linked to this
  // draft — see the matching comment in Layer2's pendingCustomizations.
  // Plain derivation (not useMemo), matching this component's existing
  // pattern of computing per-record values inline from `draft` rather than
  // memoizing them.
  const pendingCustomizations = clientCustomizationsUnfiltered.filter(customization =>
    !isCustomizationApproved(customization, customizationApprovalStatusField, customizationClientApprovalStatusField)
  );
  // Per-style breakdown for the combined banner — see Layer2's
  // pendingCountsByStyle for the matching comment.
  const pendingCountsByStyle = (() => {
    const counts = new Map<string, number>();
    const order: string[] = [];
    for (const customization of pendingCustomizations) {
      const styles = getLinkedRecordIds(customization, customizationCustomizedStyleField);
      for (const id of styles) {
        if (!counts.has(id)) order.push(id);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return order.map(id => {
      const styleRec = styleRecords.find(s => s.id === id);
      const name = styleRec && styleNameField ? styleRec.getCellValueAsString(styleNameField) : 'Unknown style';
      return { id, name, count: counts.get(id) ?? 0 };
    });
  })();
  const linkedCustomizationIds = getLinkedRecordIds(draft, customizationsField);
  const stateCostId = getLinkedRecordIds(draft, stateCostsField)[0] ?? null;
  const stateCostRecord = stateCostId ? stateCostRecords.find(r => r.id === stateCostId) ?? null : null;
  const stateCostName = stateCostRecord && stateCostNameField ? stateCostRecord.getCellValueAsString(stateCostNameField) : '';
  const rushFee = rushFeeField ? (draft.getCellValue(rushFeeField) as number | null) ?? 0 : 0;
  const shipping = shippingField ? unwrapLookupNumber(draft.getCellValue(shippingField)) ?? 0 : 0;
  const taxes = taxesField ? (draft.getCellValue(taxesField) as number | null) ?? 0 : 0;
  const discount = discountField ? (draft.getCellValue(discountField) as number | null) ?? 0 : 0;
  const discountPercentage = discountPercentageField ? (draft.getCellValue(discountPercentageField) as number | null) ?? 0 : 0;
  const discountNotes = discountNotesField ? draft.getCellValueAsString(discountNotesField) : '';
  const styleSubtotal = styleSubtotalField ? (draft.getCellValue(styleSubtotalField) as number | null) ?? 0 : 0;
  const customizationSubtotal = customizationSubtotalField ? (draft.getCellValue(customizationSubtotalField) as number | null) ?? 0 : 0;
  const total = totalField ? (draft.getCellValue(totalField) as number | null) ?? 0 : 0;
  const grandTotal = grandTotalField ? (draft.getCellValue(grandTotalField) as number | null) ?? 0 : 0;
  const leadTime = leadTimeField ? (draft.getCellValue(leadTimeField) as number | null) : null;

  const isEditable = !isLocked && canUpdate;

  let readOnlyReason = '';
  if (!canUpdate) {
    readOnlyReason = 'You don\'t have permission to edit.';
  } else if (isLocked) {
    readOnlyReason = 'This draft is locked.';
  }

  const linkedStyles = styleRecords.filter(s => linkedStyleIds.includes(s.id));
  const linkedCustomizations = customizationRecords.filter(c => linkedCustomizationIds.includes(c.id));

  const clientRecord = clientRecords.find(c => c.id === clientId) ?? null;
  const clientReadyToWearSize = clientRecord && clientReadyToWearSizeField
    ? (clientRecord.getCellValue(clientReadyToWearSizeField) as number | null)
    : null;
  const shopifyStatus = shopifyStatusField ? draft.getCellValueAsString(shopifyStatusField) : '';
  const syncErrorMessage = syncErrorMessageField ? draft.getCellValueAsString(syncErrorMessageField) : '';

  // Button is disabled/hidden when locked, or when a Shopify sync is already
  // ongoing or already succeeded — re-running would either double-submit or
  // is simply unnecessary. "Not Started"/"Failed"/blank all allow a (re)try.
  const shopifyButtonHidden = isLocked || shopifyStatus === 'Endpoint Call Ongoing' || shopifyStatus === 'Completed';
  const shopifyEligibility = checkShopifyDraftOrderEligibility({
    clientId,
    linkedStyleIds,
    linkedCustomizations,
    readyToWearSize: clientReadyToWearSize,
    customizationTypeField,
    customizedStyleField: customizationCustomizedStyleField,
    styleCategoryField,
    getLinkedRecordIds,
    styleRecords,
  });

  // Click handler for the button itself — re-checks eligibility immediately
  // and, if it passes, opens the confirmation dialog instead of writing
  // anything yet. Nothing is created until the user confirms in that dialog.
  const handleCreateShopifyDraftOrderClick = () => {
    if (!canUpdate || !lockedField || !shopifyStatusField) return;
    if (!shopifyEligibility.eligible) {
      setShopifyActionError(shopifyEligibility.reason);
      return;
    }
    setShopifyActionError(null);
    setShowShopifyConfirm(true);
  };

  // Runs only after the user explicitly confirms in the dialog — re-checks
  // eligibility one more time (data can change while the dialog is open)
  // before actually locking the record and kicking off the Cobalt call.
  const handleConfirmCreateShopifyDraftOrder = async () => {
    setShowShopifyConfirm(false);
    if (!canUpdate || !lockedField || !shopifyStatusField) return;
    if (!shopifyEligibility.eligible) {
      setShopifyActionError(shopifyEligibility.reason);
      return;
    }
    setShopifyActionError(null);
    setCreatingShopifyDraftOrder(true);
    try {
      const userEmail = session.currentUser?.email ?? '';
      await draftOrdersTable.updateRecordAsync(draftId, {
        ...(initiatedByEmailField ? { [initiatedByEmailField.id]: userEmail } : {}),
        [lockedField.id]: true,
        [shopifyStatusField.id]: { name: 'Endpoint Call Ongoing' },
      });
      // Optimistic UI: the record write above already disables the button
      // via shopifyButtonHidden once draft re-renders from the new record
      // data, but creatingShopifyDraftOrder covers the gap before that sync.
    } catch (error) {
      console.error('Failed to start Shopify draft order creation:', error);
      setShopifyActionError('Failed to start the Shopify draft order creation. Please try again.');
      setCreatingShopifyDraftOrder(false);
    }
  };

  const handleToggleLock = async () => {
    if (!canUpdate || !lockedField) return;
    try {
      await draftOrdersTable.updateRecordAsync(draftId, {
        [lockedField.id]: !isLocked,
      });
    } catch (error) {
      console.error('Failed to toggle lock:', error);
    }
  };

  const handleAddStyle = async (styleId: string) => {
    if (!isEditable || !styleField) return;
    try {
      const newStyleIds = [...linkedStyleIds, styleId];
      await draftOrdersTable.updateRecordAsync(draftId, {
        [styleField.id]: newStyleIds.map(id => ({ id })),
      });
      setShowStyleSearch(false);
      setStyleSearchQuery('');
      await recalculateRushFee(newStyleIds, linkedCustomizationIds);
    } catch (error) {
      console.error('Failed to add style:', error);
      setFieldErrors({ ...fieldErrors, styles: 'Failed to add style.' });
    }
  };

  const handleRemoveStyle = async (styleId: string) => {
    if (!isEditable || !styleField) return;
    try {
      const newStyleIds = linkedStyleIds.filter(id => id !== styleId);
      await draftOrdersTable.updateRecordAsync(draftId, {
        [styleField.id]: newStyleIds.map(id => ({ id })),
      });
      await recalculateRushFee(newStyleIds, linkedCustomizationIds);
    } catch (error) {
      console.error('Failed to remove style:', error);
      setFieldErrors({ ...fieldErrors, styles: 'Failed to remove style.' });
    }
  };

  const handleAddCustomization = async (customizationId: string) => {
    if (!isEditable || !customizationsField) return;
    try {
      const newCustomizationIds = [...linkedCustomizationIds, customizationId];
      await draftOrdersTable.updateRecordAsync(draftId, {
        [customizationsField.id]: newCustomizationIds.map(id => ({ id })),
      });
      setShowCustomizationSearch(false);
      setCustomizationSearchQuery('');
      await recalculateRushFee(linkedStyleIds, newCustomizationIds);
    } catch (error) {
      console.error('Failed to add customization:', error);
      setFieldErrors({ ...fieldErrors, customizations: 'Failed to add customization.' });
    }
  };

  const handleRemoveCustomization = async (customizationId: string) => {
    if (!isEditable || !customizationsField) return;
    try {
      const newCustomizationIds = linkedCustomizationIds.filter(id => id !== customizationId);
      await draftOrdersTable.updateRecordAsync(draftId, {
        [customizationsField.id]: newCustomizationIds.map(id => ({ id })),
      });
      await recalculateRushFee(linkedStyleIds, newCustomizationIds);
    } catch (error) {
      console.error('Failed to remove customization:', error);
      setFieldErrors({ ...fieldErrors, customizations: 'Failed to remove customization.' });
    }
  };

  const recalculateRushFee = async (newStyleIds: string[], newCustomizationIds: string[]) => {
    if (!rushFeeField) return;
    
    const selectedStyles = styleRecords.filter(s => newStyleIds.includes(s.id));
    const selectedCustomizations = customizationRecords.filter(c => newCustomizationIds.includes(c.id));

    if (!clientDueDate) {
      await draftOrdersTable.updateRecordAsync(draftId, { [rushFeeField.id]: 0 });
      return;
    }

    const customizedStyleIds = new Set(
      selectedCustomizations.flatMap(c => {
        const linkedStyles = getLinkedRecordIds(c, customizationCustomizedStyleField);
        return linkedStyles;
      })
    );

    const standaloneStyles = selectedStyles.filter(s => !customizedStyleIds.has(s.id));

    if (standaloneStyles.length === 0) {
      await draftOrdersTable.updateRecordAsync(draftId, { [rushFeeField.id]: 0 });
      return;
    }

    const today = new Date();
    const weeksRemaining = Math.floor((clientDueDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Tiers are buckets keyed by their upper bound: the applicable tier is the
    // smallest "# of Weeks" threshold that is >= weeksRemaining (e.g. 17-20 weeks
    // remaining uses the 20-week tier; <=4 weeks remaining uses the 4-week tier).
    const matchingRule = rushFeeRuleRecords
      .filter(rule => {
        const ruleWeeks = rushRuleWeeksField ? (rule.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        return ruleWeeks >= weeksRemaining;
      })
      .sort((a, b) => {
        const weeksA = rushRuleWeeksField ? (a.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        const weeksB = rushRuleWeeksField ? (b.getCellValue(rushRuleWeeksField) as number | null) ?? 0 : 0;
        return weeksA - weeksB;
      })[0];

    if (!matchingRule) {
      await draftOrdersTable.updateRecordAsync(draftId, { [rushFeeField.id]: 0 });
      return;
    }

    const rushPct = rushRuleNonCustomizedPctField 
      ? (matchingRule.getCellValue(rushRuleNonCustomizedPctField) as number | null) ?? 0 
      : 0;

    const newRushFee = standaloneStyles.reduce((sum, style) => {
      const price = stylePriceField ? (style.getCellValue(stylePriceField) as number | null) ?? 0 : 0;
      return sum + (price * rushPct);
    }, 0);

    try {
      await draftOrdersTable.updateRecordAsync(draftId, { [rushFeeField.id]: newRushFee });
    } catch (error) {
      console.error('Failed to update rush fee:', error);
    }
  };

  const handleCurrencyBlur = async (field: Field | null, value: string, fieldKey: string) => {
    if (!isEditable || !field) return;
    // Discount (currency) can't exceed the order's own subtotal.
    const orderSubtotal = styleSubtotal + customizationSubtotal;
    const numValue = Math.min(Math.max(parseCurrency(value), 0), orderSubtotal);
    try {
      await draftOrdersTable.updateRecordAsync(draftId, {
        [field.id]: numValue,
      });
      setFieldErrors({ ...fieldErrors, [fieldKey]: '' });
    } catch (error) {
      console.error(`Failed to update ${fieldKey}:`, error);
      setFieldErrors({ ...fieldErrors, [fieldKey]: `Failed to update ${fieldKey}.` });
    }
  };

  const handlePercentBlur = async (field: Field | null, value: string, fieldKey: string) => {
    if (!isEditable || !field) return;
    // Discount (percentage) can't exceed 100%.
    const numValue = Math.min(Math.max(parsePercentInput(value), 0), 1);
    try {
      await draftOrdersTable.updateRecordAsync(draftId, {
        [field.id]: numValue,
      });
      setFieldErrors({ ...fieldErrors, [fieldKey]: '' });
    } catch (error) {
      console.error(`Failed to update ${fieldKey}:`, error);
      setFieldErrors({ ...fieldErrors, [fieldKey]: `Failed to update ${fieldKey}.` });
    }
  };

  const handleNotesBlur = async (field: Field | null, value: string, fieldKey: string) => {
    if (!isEditable || !field) return;
    try {
      await draftOrdersTable.updateRecordAsync(draftId, {
        [field.id]: value,
      });
      setFieldErrors({ ...fieldErrors, [fieldKey]: '' });
    } catch (error) {
      console.error(`Failed to update ${fieldKey}:`, error);
      setFieldErrors({ ...fieldErrors, [fieldKey]: `Failed to update ${fieldKey}.` });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-[15%] py-4 border-b" style={{ borderColor: theme.border }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm hover:cursor-pointer"
          style={{ color: theme.textSecondary }}
        >
          <ArrowLeftIcon size={16} />
          Back
        </button>
        <h1 className="text-lg font-bold">{getClientName(clientId)}</h1>
        <button
          onClick={() => setShowClientPanel(true)}
          className="text-sm underline hover:cursor-pointer"
          style={{ color: theme.textSecondary }}
        >
          View Client
        </button>
        <span className="text-sm" style={{ color: theme.textSecondary }}>{formatDate(createdAt)}</span>
        <StatusPill label={isLocked ? 'Locked' : 'Unlocked'} variant={isLocked ? 'locked' : 'unlocked'} />
        {shopifyStatus && <ShopifyStatusPill status={shopifyStatus} />}
        <div className="flex-1" />
        {/* TEMP: hidden until this ships to Prod — flip back to `canUpdate && !shopifyButtonHidden` to re-enable. */}
        {false && canUpdate && !shopifyButtonHidden && (
          <button
            onClick={handleCreateShopifyDraftOrderClick}
            disabled={creatingShopifyDraftOrder}
            title={!shopifyEligibility.eligible ? shopifyEligibility.reason : undefined}
            className="px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accent, color: '#FFFFFF' }}
          >
            {creatingShopifyDraftOrder ? 'Starting…' : 'Create Shopify Draft Order'}
          </button>
        )}
        {canUpdate && (
          <button
            onClick={handleToggleLock}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm"
            style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
          >
            {isLocked ? <LockOpenIcon size={16} /> : <LockIcon size={16} />}
            {isLocked ? 'Unlock' : 'Lock'}
          </button>
        )}
      </div>

      {shopifyActionError && (
        <div className="px-[15%] py-3" style={{ backgroundColor: theme.dangerBg }}>
          <p className="text-sm" style={{ color: theme.danger }}>{shopifyActionError}</p>
        </div>
      )}

      {shopifyStatus === 'Failed' && syncErrorMessage && (
        <div className="px-[15%] py-3" style={{ backgroundColor: theme.dangerBg }}>
          <p className="text-sm" style={{ color: theme.danger }}>Shopify draft order creation failed — {syncErrorMessage}</p>
        </div>
      )}

      {showClientPanel && clientRecord && (
        <ClientMiniPanel
          theme={theme}
          clientRecord={clientRecord}
          clientsTable={clientsTable}
          getField={getField}
          onClose={() => setShowClientPanel(false)}
        />
      )}

      {showShopifyConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowShopifyConfirm(false)}
        >
          <div
            className="w-full rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.bgCard, maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-base font-semibold mb-2">Create Shopify draft order?</h3>
              <p className="text-sm" style={{ color: theme.textSecondary }}>
                This will lock this draft and start creating a real Shopify draft order.
              </p>
              <p className="text-sm mt-2" style={{ color: theme.textSecondary }}>
                This can't be easily undone — make sure the pricing and items below are correct before continuing.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: theme.border }}>
              <button
                onClick={() => setShowShopifyConfirm(false)}
                className="px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm"
                style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateShopifyDraftOrder}
                className="px-3 py-1.5 rounded-md hover:shadow-sm hover:cursor-pointer text-sm font-medium"
                style={{ backgroundColor: theme.accent, color: '#FFFFFF' }}
              >
                Create Draft Order
              </button>
            </div>
          </div>
        </div>
      )}

      {!isEditable && (
        <div className="px-[15%] py-3" style={{ backgroundColor: theme.neutralBg }}>
          <p className="text-sm" style={{ color: theme.textSecondary }}>
            This draft is read-only — {readOnlyReason}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto px-[15%] py-6">
        <div className="flex gap-6 items-start">
          <div className="w-[60%] min-w-0 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-base font-semibold">Styles</h2>
                {isEditable && (
                <div ref={styleSearchRef} className="relative w-64">
                  <MagnifyingGlassIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: theme.textMuted }}
                  />
                  <input
                    type="text"
                    placeholder="Add style..."
                    value={styleSearchQuery}
                    onChange={e => {
                      const value = e.target.value;
                      setStyleSearchQuery(value);
                      setShowStyleSearch(true);
                      setStyleHighlightIndex(-1);
                    }}
                    onFocus={() => {
                      setShowStyleSearch(true);
                      setStyleHighlightIndex(-1);
                    }}
                    onKeyDown={e => {
                      if (!showStyleSearch) return;
                      const addableStyles = filteredStyles.filter(s => !linkedStyleIds.includes(s.id));
                      if (addableStyles.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setStyleHighlightIndex(i => Math.min(i + 1, addableStyles.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setStyleHighlightIndex(i => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter' && styleHighlightIndex >= 0) {
                        e.preventDefault();
                        handleAddStyle(addableStyles[styleHighlightIndex].id);
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-md text-sm"
                    style={{
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      color: theme.text
                    }}
                  />
                  {showStyleSearch && (
                    <div
                      className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
                      style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                    >
                      {filteredStyles.filter(s => !linkedStyleIds.includes(s.id)).length === 0 ? (
                        <p className="px-3 py-2 text-sm" style={{ color: theme.textSecondary }}>
                          No styles match your search.
                        </p>
                      ) : (
                        filteredStyles
                          .filter(s => !linkedStyleIds.includes(s.id))
                          .map((style, index) => (
                            <button
                              key={style.id}
                              onClick={() => handleAddStyle(style.id)}
                              className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer flex justify-between gap-2"
                              style={{ color: theme.text, backgroundColor: index === styleHighlightIndex ? theme.bgHover : 'transparent' }}
                              onMouseEnter={() => setStyleHighlightIndex(index)}
                            >
                              <span className="truncate">{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</span>
                              <span className="whitespace-nowrap" style={{ color: theme.textSecondary }}>
                                {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                              </span>
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
              {fieldErrors.styles && <p className="text-xs mb-2" style={{ color: theme.danger }}>{fieldErrors.styles}</p>}
              {linkedStyles.length === 0 ? (
                <p className="text-sm" style={{ color: theme.textSecondary }}>No styles selected.</p>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: theme.bgHover }}>
                      <th className="w-10 pl-4 py-3"></th>
                      <th className="text-left py-3 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Name</th>
                      <th className="text-right py-3 pr-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedStyles.map(style => (
                      <tr key={style.id} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                        <td className="py-3 pl-4">
                          {isEditable && (
                            <button
                              onClick={() => handleRemoveStyle(style.id)}
                              className="hover:cursor-pointer"
                              style={{ color: theme.textMuted }}
                            >
                              <XIcon size={14} />
                            </button>
                          )}
                        </td>
                        <td className="py-3 pr-3">{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `1px solid ${theme.border}` }}>
                      <td className="py-3 pl-4"></td>
                      <td className="py-3 font-medium">Subtotal</td>
                      <td className="py-3 pr-4 text-right font-medium whitespace-nowrap">{formatCurrency(styleSubtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              )}
          </div>

          {(clientCustomizations.length > 0 || pendingCustomizations.length > 0) && (
            <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-base font-semibold">Customizations</h2>
                  {isEditable && (
                  <div ref={customizationSearchRef} className="relative w-64">
                    <MagnifyingGlassIcon
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: theme.textMuted }}
                    />
                    <input
                      type="text"
                      placeholder="Add customization..."
                      value={customizationSearchQuery}
                      onChange={e => {
                        setCustomizationSearchQuery(e.target.value);
                        setCustomizationHighlightIndex(-1);
                      }}
                      onFocus={() => {
                        setShowCustomizationSearch(true);
                        setCustomizationHighlightIndex(-1);
                      }}
                      onKeyDown={e => {
                        if (!showCustomizationSearch) return;
                        const addableCustomizations = filteredCustomizations.filter(c => !linkedCustomizationIds.includes(c.id));
                        if (addableCustomizations.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setCustomizationHighlightIndex(i => Math.min(i + 1, addableCustomizations.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setCustomizationHighlightIndex(i => Math.max(i - 1, 0));
                        } else if (e.key === 'Enter' && customizationHighlightIndex >= 0) {
                          e.preventDefault();
                          handleAddCustomization(addableCustomizations[customizationHighlightIndex].id);
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-md text-sm"
                      style={{
                        backgroundColor: theme.bg,
                        border: `1px solid ${theme.border}`,
                        color: theme.text
                      }}
                    />
                    {showCustomizationSearch && (
                      <div
                        className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
                        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                      >
                        {filteredCustomizations
                          .filter(c => !linkedCustomizationIds.includes(c.id))
                          .map((customization, index) => (
                            <button
                              key={customization.id}
                              onClick={() => handleAddCustomization(customization.id)}
                              className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer"
                              style={{ color: theme.text, backgroundColor: index === customizationHighlightIndex ? theme.bgHover : 'transparent' }}
                              onMouseEnter={() => setCustomizationHighlightIndex(index)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</span>
                                <span className="whitespace-nowrap" style={{ color: theme.textSecondary }}>
                                  {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                                </span>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
                {fieldErrors.customizations && <p className="text-xs mb-2" style={{ color: theme.danger }}>{fieldErrors.customizations}</p>}
                {pendingCountsByStyle.length > 0 && (
                  <div className="rounded-lg px-4 py-3 text-sm mb-3" style={{ backgroundColor: theme.neutralBg, color: theme.textSecondary }}>
                    <p>This client has customization requests waiting for internal review, which need to be approved before they can be added.</p>
                    <ul className="list-disc pl-5 mt-1">
                      {pendingCountsByStyle.map(s => (
                        <li key={s.id}>{s.name}: {s.count} pending approval{s.count === 1 ? '' : 's'}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {linkedCustomizations.length === 0 ? (
                  pendingCountsByStyle.length === 0 && (
                    <p className="text-sm" style={{ color: theme.textSecondary }}>No customizations selected.</p>
                  )
                ) : (
                  <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: theme.bgHover }}>
                        <th className="w-10 pl-4 py-3"></th>
                        <th className="text-left py-3 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Name</th>
                        <th className="text-right py-3 pr-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedCustomizations.map(customization => (
                        <tr key={customization.id} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                          <td className="py-3 pl-4 align-top">
                            {isEditable && (
                              <button
                                onClick={() => handleRemoveCustomization(customization.id)}
                                className="hover:cursor-pointer"
                                style={{ color: theme.textMuted }}
                              >
                                <XIcon size={14} />
                              </button>
                            )}
                          </td>
                          <td className="py-3 pr-3 align-top">
                            <div>{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</div>
                            {customizationDetailField && customization.getCellValueAsString(customizationDetailField) && (
                              <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                {customization.getCellValueAsString(customizationDetailField)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right align-top whitespace-nowrap">
                            {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${theme.border}` }}>
                        <td className="py-3 pl-4"></td>
                        <td className="py-3 font-medium">Subtotal</td>
                        <td className="py-3 pr-4 text-right font-medium whitespace-nowrap">{formatCurrency(customizationSubtotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Address</h2>
            {isEditable ? (
              <div className="w-64">
                <AddressSelector
                  value={addressLocal}
                  onChange={setAddressLocal}
                  onCommit={v => handleNotesBlur(addressField, v, 'address')}
                  options={clientAddressOptions}
                  theme={theme}
                  bordered
                />
              </div>
            ) : (
              <span className="text-sm" style={{ color: theme.textMuted }}>{addressLocal || '—'}</span>
            )}
          </div>

          <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-base font-semibold">Additional Charges</h2>
              </div>
              {!clientDueDate && (
                <p className="text-xs mb-2" style={{ color: theme.textSecondary }}>
                  Rush fee requires a wedding date on file.
                </p>
              )}
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '50%' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: theme.bgHover }}>
                    <th className="text-left py-3 pl-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Charge</th>
                    <th className="text-right py-3 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Price</th>
                    <th className="text-left py-3 pl-3 pr-4 text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                    <td className="py-3 pl-4" style={{ backgroundColor: theme.neutralBg }}>Rush Fee</td>
                    <td className="py-3 pr-2 text-right whitespace-nowrap" style={{ backgroundColor: theme.neutralBg }}>{formatCurrency(rushFee)}</td>
                    <td className="py-3 pl-3 pr-4 text-xs" style={{ color: theme.textMuted, backgroundColor: theme.neutralBg }}>
                      {rushFeeExplanation}
                    </td>
                  </tr>
                  <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <span>Discount</span>
                        {isEditable && (
                          <DiscountModeToggle mode={discountMode} onChange={setDiscountMode} theme={theme} />
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      {isEditable ? (
                        discountMode === 'percentage' ? (
                          <PercentInput label="Discount" value={discountPercentage} field={discountPercentageField} fieldKey="discountPercentage" error={fieldErrors.discountPercentage} theme={theme} onBlur={handlePercentBlur} hideLabel borderless />
                        ) : (
                          <CurrencyInput label="Discount" value={discount} field={discountField} fieldKey="discount" error={fieldErrors.discount} theme={theme} onBlur={handleCurrencyBlur} hideLabel borderless />
                        )
                      ) : (
                        <span className="block text-right">
                          {discountMode === 'percentage' ? `-${formatPercentDisplay(discountPercentage)}` : `-${formatCurrency(discount)}`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      {isEditable ? (
                        <NotesInput value={discountNotes} field={discountNotesField} fieldKey="discountNotes" theme={theme} onBlur={handleNotesBlur} borderless />
                      ) : (
                        <span className="text-xs" style={{ color: theme.textMuted }}>{discountNotes}</span>
                      )}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td className="py-3 pl-4 font-medium">Total</td>
                    <td className="py-3 font-medium text-right whitespace-nowrap">{formatCurrency(total)}</td>
                    <td className="py-3 pl-3 pr-4"></td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </div>

          <div className="w-[40%] shrink-0 sticky top-0">
            <div className="p-4 rounded-lg space-y-4 text-base" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <h2 className="text-base font-semibold mb-1">Summary</h2>
              {styleSubtotal !== 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Style Subtotal</span>
                  <span>{formatCurrency(styleSubtotal)}</span>
                </div>
              )}
              {customizationSubtotal !== 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Customization Subtotal</span>
                  <span>{formatCurrency(customizationSubtotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ color: theme.textSecondary }}>Rush Fee</span>
                <span>{formatCurrency(rushFee)}</span>
              </div>
              {shipping !== 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Shipping</span>
                  <span>{formatCurrency(shipping)}</span>
                </div>
              )}
              {taxes !== 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Taxes</span>
                  <span>{formatCurrency(taxes)}</span>
                </div>
              )}
              {discount !== 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Discount</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              {total !== 0 && (
                <div className="flex justify-between pt-3 border-t" style={{ borderColor: theme.borderLight }}>
                  <span style={{ color: theme.textSecondary }}>Total (fees − discount)</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              )}
              {grandTotal !== 0 && (
                <div className="flex justify-between pt-3 border-t font-semibold" style={{ borderColor: theme.borderLight }}>
                  <span>Grand Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CurrencyInputProps {
  label: string;
  value: number;
  field: Field | null;
  fieldKey: string;
  error?: string;
  theme: typeof COLORS.LIGHT;
  onBlur: (field: Field | null, value: string, fieldKey: string) => Promise<void>;
  hideLabel?: boolean;
  borderless?: boolean;
}

function CurrencyInput({ label, value, field, fieldKey, error, theme, onBlur, hideLabel, borderless }: CurrencyInputProps) {
  const [localValue, setLocalValue] = useState(formatCurrency(value));

  useEffect(() => {
    setLocalValue(formatCurrency(value));
  }, [value]);

  return (
    <div>
      {!hideLabel && <label className="block text-xs mb-1" style={{ color: theme.textSecondary }}>{label}</label>}
      <input
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => onBlur(field, localValue, fieldKey)}
        className={borderless ? 'w-full px-2 py-1 text-sm text-right' : 'w-full px-3 py-2 rounded-md text-sm'}
        style={borderless ? { backgroundColor: 'transparent', border: 'none', color: theme.text } : {
          backgroundColor: theme.bg,
          border: `1px solid ${error ? theme.danger : theme.border}`,
          color: theme.text
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: theme.danger }}>{error}</p>}
    </div>
  );
}

interface PercentInputProps {
  label: string;
  value: number;
  field: Field | null;
  fieldKey: string;
  error?: string;
  theme: typeof COLORS.LIGHT;
  onBlur: (field: Field | null, value: string, fieldKey: string) => Promise<void>;
  hideLabel?: boolean;
  borderless?: boolean;
}

function PercentInput({ label, value, field, fieldKey, error, theme, onBlur, hideLabel, borderless }: PercentInputProps) {
  const [localValue, setLocalValue] = useState(formatPercentDisplay(value));

  useEffect(() => {
    setLocalValue(formatPercentDisplay(value));
  }, [value]);

  return (
    <div>
      {!hideLabel && <label className="block text-xs mb-1" style={{ color: theme.textSecondary }}>{label}</label>}
      <input
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => onBlur(field, localValue, fieldKey)}
        className={borderless ? 'w-full px-2 py-1 text-sm text-right' : 'w-full px-3 py-2 rounded-md text-sm'}
        style={borderless ? { backgroundColor: 'transparent', border: 'none', color: theme.text } : {
          backgroundColor: theme.bg,
          border: `1px solid ${error ? theme.danger : theme.border}`,
          color: theme.text
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: theme.danger }}>{error}</p>}
    </div>
  );
}

interface NotesInputProps {
  value: string;
  field: Field | null;
  fieldKey: string;
  theme: typeof COLORS.LIGHT;
  onBlur: (field: Field | null, value: string, fieldKey: string) => Promise<void>;
  borderless?: boolean;
}

function NotesInput({ value, field, fieldKey, theme, onBlur, borderless }: NotesInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <input
      type="text"
      placeholder="Notes..."
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={() => onBlur(field, localValue, fieldKey)}
      className={borderless ? 'w-full px-2 py-1 text-xs' : 'w-full px-2 py-1 rounded-md text-xs'}
      style={borderless ? { backgroundColor: 'transparent', border: 'none', color: theme.text } : { backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
    />
  );
}

// ─── AddressSelector ──────────────────────────────────────────────────────────
// Free-text input that also offers the client's existing addresses (Shopify/
// Acuity/Other) as quick-pick suggestions — picking one just fills the same
// input the same way typing a brand-new address would, so there's no
// separate "existing vs. new" mode to toggle.
interface AddressOption { label: string; value: string; }
interface AddressSelectorProps {
  value: string;
  onChange: (v: string) => void;
  options: AddressOption[];
  disabled?: boolean;
  theme: typeof COLORS.LIGHT;
  // Only used in edit mode (Layer4), where each field autosaves independently
  // on blur — passed the just-committed value. Layer2 (create) omits this;
  // its address is saved once, along with everything else, on final Save.
  onCommit?: (v: string) => void;
  // Standalone form field (e.g. Create Draft's top-level Address section)
  // vs. borderless-in-a-table-cell (e.g. Draft Detail's Additional Charges
  // row) — same borderless/bordered split as NotesInput's `borderless` prop.
  bordered?: boolean;
}
function AddressSelector({ value, onChange, options, disabled, theme, onCommit, bordered }: AddressSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="Select an existing address, or type a new one..."
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => onCommit?.(value)}
        disabled={disabled}
        className={bordered ? 'w-full px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed' : 'w-full px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed'}
        style={bordered
          ? { backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }
          : { backgroundColor: 'transparent', border: 'none', color: theme.text }}
      />
      {open && options.length > 0 && (
        <div
          className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
          style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
        >
          {options.map(o => (
            <button
              key={o.label}
              type="button"
              onClick={() => { onChange(o.value); onCommit?.(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:cursor-pointer"
              style={{ color: theme.text }}
            >
              <div style={{ color: theme.textMuted }}>{o.label}</div>
              <div className="truncate">{o.value}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

initializeBlock({ interface: () => <DraftOrdersApp /> });
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  expandRecord,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table, Field, Record } from '@airtable/blocks/interface/models';
import {
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  X as XIcon,
  Calendar as CalendarIcon,
  Phone as PhoneIcon,
  EnvelopeSimple as EnvelopeSimpleIcon,
  ChatCircleText as ChatCircleTextIcon,
  Paperclip as PaperclipIcon,
  ArrowLeft as ArrowLeftIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
} from '@phosphor-icons/react';

// ─────────────────────────────────────────────────────────────────────────────
// CHAMPAGNE COLOR SYSTEM (reference — encoded as Tailwind arbitrary-value
// classes with dark: variants throughout, matching the pattern used across
// the other interface files in this directory)
// ─────────────────────────────────────────────────────────────────────────────
const LIGHT = {
  app_bg: '#F8F5EE', surface: '#FFFFFF', border: '#E9E0CE',
  text_primary: '#1A1612', text_secondary: '#6B6357',
  accent: '#D97706', accent_soft: '#FEF3C7',
};
const DARK = {
  app_bg: '#1B1813', surface: '#25211A', border: '#38322A',
  text_primary: '#F3EFE6', text_secondary: '#B8AF9F',
  accent: '#FBBF24', accent_soft: '#3A2E12',
};

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

// CSS to hide scrollbars while maintaining functionality
const GLOBAL_STYLES = `
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

const FIELD_IDS = {
  APPT_TIME: 'fldL7kYvgkmyhGniX',
  APPT_TYPE: 'fldky9XlBM97luBf1',
  ROOM_LINK: 'fldKVUlPm7Gq3EUF9',
  CLIENT_LINK: 'fldcVVGhEsnYRsbyR',
  STATUS: 'fldZTkJdTBhmcchTb',
  CHECK_IN: 'fldarspmpxD4OFpnX',
  CLEARED: 'fldE1Ke90UVdyUFL1',
  PICKED_UP: 'fldaT5YwVqB87h8Ia',
  SA_NAME: 'fldAopgXS7Zw42ZgV',
  ALT_LEAD_LINK: 'fldErMecJ5hzy8n42',
  STUDIO_NAME: 'fldelULQNcaGnAv5K',
  STUDIO_SHORT_NAME: 'fldpA301QrlWlhZRJ',
  SAMPLES_NOT_IN_NY: 'fldfNygc1E6FTgNDN',
  FAV_STYLES: 'fldCPhdJ885D7ytOf',
  FULL_NAME_ACUITY: 'fld1Vwhb8wvxNaGKX',
  APPT_CATEGORY: 'fldZ45u0N2GzukwO4',
  STUDIO_ADDRESS: 'fldthP6CLGo6w7MWJ',
  PRE_APPT_NOTES: 'fld3nCe9MAo4dKavc',
  APPT_END_TIME: 'fldFwFIBNtC76v0Y7',
  // The appointment_type field to use — a lookup of a singleSelect. A
  // similarly-named field also exists on this table and will be removed soon;
  // this is the correct one for the displayed value (its color comes from
  // TABLE_IDS.APPOINTMENT_TYPES / APPT_TYPE_CHOICE instead — see there).
  APPT_NAME: 'fldZO3rF3KOGxG0S5',
  // Source singleSelect on the appointment_types reference table that
  // FIELD_IDS.APPT_NAME looks up — confirmed via debug tooltip to be the only
  // reliable source for this field's real Airtable choice colors.
  APPT_TYPE_CHOICE: 'fld5M3HgiIOycZfKJ',
  IS_FIRST_VISIT: 'fldkBeg39sl9VSgzF',
  CUSTOMIZATION_LOOKUP: 'fldACtVEk2jHSpTDC',

  // Client table fields
  CLIENT_STAGE: 'fldLcxVZvI1rigBlh',
  CLIENT_FULL_NAME: 'fldB3Wyam01D3wR5Q',
  CLIENT_FIRST_NAME: 'fldFWlAODUcuroeXK',
  CLIENT_LAST_NAME: 'fldQzSPiUvOid1nXo',
  CLIENT_EMAIL: 'fld5f3IVZoX0QZZ8R',
  CLIENT_PHONE: 'fldZrxF4bR6QBUwVK',
  CLIENT_WEDDING: 'fldbgknumKGS5W5WU',
  CLIENT_WEDDING_IF_NOT_SET: 'fldqwfmMczvLhiqk1',
  CLIENT_WEDDING_DISPLAY: 'fldfDHXcCEbFHEX4a', // wedding_date_display formula — Formatted, falling back to If Not Set; read-only, informational
  CLIENT_STUDIO: 'fldIenJoxseeHmfIv',
  CLIENT_SA_LINK: 'fldBTKBaw8YvNAlwK',
  CLIENT_STYLISTS: 'fld2jVE1qluvlhV7D',
  CLIENT_RTW_SIZE: 'fldvV2CiEx4RQN4mO', // "Size from Acuity Intake" — customer self-report, reference-only, never written here
  CLIENT_RTW_SIZE_MANUAL: 'fldEEH4CK3Qqp0g0C', // "ready_to_wear_size_manual" — SA-confirmed size, the only field this page writes
  CLIENT_RTW_SIZE_DISPLAY: 'fldSwfR25uvynWKI5', // "ready_to_wear_size" formula — manual if set, else falls back to Acuity; read-only view shows THIS
  CLIENT_NEXT_APPT: 'fldTe2cyBmicx9Ple',
  CLIENT_LAST_APPT: 'fldd01OccObkG9sGe',
  CLIENT_APPT_RECORDS: 'fldYb8G67izm3qelZ',
  CLIENT_FAV_STYLES_ACUITY: 'fldZzNR0g5VEJ5RmX',
  CLIENT_PERSONAL_NOTES: 'fldQiGCx5hRQ0Am1Z',
  CLIENT_WEDDING_LOC: 'fldikRqj41XYiIDBk',
  // Issue #54 — DF Clients -> Orders - Shopify link, same field fulfillment.tsx reads.
  CLIENT_SHOPIFY_ORDERS: 'fldWSGqQW9czYdams',
  CLIENT_WEDDING_PLANNER: 'fldISwHPviwGQBHFJ',
  CLIENT_MEASUREMENTS: 'fldcWwbKOc9nkgzzV',
  CLIENT_APPT_PHOTOS: 'fldWti8XzHbnGcjz9',
  CLIENT_INTEREST_ALTS: 'fldibh40zShnDmLfj',
  CLIENT_INTEREST_M2M: 'fld3YweLOIcpr7xvL',
  CLIENT_APPT_NOTES: 'fldwHp8zC3GykAuO1',
  CLIENT_IS_RUSH: 'fldclGeKUXGI2e9O7',
  CLIENT_FOLLOW_UP_SENT: 'fldmjiS7lHEn9qZHN',

  // Appointments fields for Fit/Pick Up
  APPT_MEASUREMENTS_BUST: 'fldiCV13D0ym7Yirh',
  APPT_MEASUREMENTS_WAIST: 'fldShyIHilro7fYol',
  APPT_MEASUREMENTS_HIPS: 'fldx7dNHA3SZYC11C',
  APPT_MEASUREMENTS_HEIGHT: 'fldTAlnT0Wk3LKPsb',
  APPT_PHOTOS: 'fldBEBwDmZd29rjkK',
  APPT_FOLLOW_UP: 'fldX0ymLcTeOMpBw7',

  // Appointments fields for Alterations
  APPT_ALT_NOTES: 'fldBhpBTj0gGmV5mc',

  // Room table fields
  ROOM_NAME: 'fldHV4qThmPBVZM7B',
  ROOM_STUDIO_SHORT_NAME: 'fld5GWMLhJtgI8VcV',

  // Studio table fields
  STUDIO_TABLE_SHORT_NAME: 'fldYDMiitEk9QiQ6j',

  // Staff table fields
  STAFF_NAME: 'fldB3Wyam01D3wR5Q',
  STAFF_IS_ACTIVE: 'fldB6rPTjxATp7uMf',
  STAFF_DEPARTMENT: 'fldjGZ7oHD6wsTReZ',

  // Appointment-level editable notes field
  APPT_NOTES: 'fld3nCe9MAo4dKavc',
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

// #42 — External field sources for read-only locking and dot indicators
// Maps field ID → source system.
type FieldSource = 'acuity' | 'shopify' | 'apparel_magic';
const FIELD_SOURCE: Record<string, FieldSource> = {
  // DF Appointments — sourced from Acuity
  [FIELD_IDS.APPT_TIME]: 'acuity',
  [FIELD_IDS.APPT_TYPE]: 'acuity',
  [FIELD_IDS.CLIENT_LINK]: 'acuity',
  [FIELD_IDS.STUDIO_ADDRESS]: 'acuity',
  [FIELD_IDS.FULL_NAME_ACUITY]: 'acuity',
  // DF Clients — sourced from Acuity
  [FIELD_IDS.CLIENT_FULL_NAME]: 'acuity',
  [FIELD_IDS.CLIENT_FIRST_NAME]: 'acuity',
  [FIELD_IDS.CLIENT_LAST_NAME]: 'acuity',
  [FIELD_IDS.CLIENT_PHONE]: 'acuity',
  [FIELD_IDS.CLIENT_WEDDING]: 'acuity',
  [FIELD_IDS.CLIENT_WEDDING_IF_NOT_SET]: 'acuity',
  [FIELD_IDS.CLIENT_WEDDING_LOC]: 'acuity',
  [FIELD_IDS.CLIENT_WEDDING_PLANNER]: 'acuity',
  [FIELD_IDS.CLIENT_PERSONAL_NOTES]: 'acuity',
  [FIELD_IDS.CLIENT_RTW_SIZE]: 'acuity',
  [FIELD_IDS.CLIENT_FAV_STYLES_ACUITY]: 'acuity',
  // DF Clients — sourced from Shopify
  [FIELD_IDS.CLIENT_EMAIL]: 'shopify',
};

function isFieldReadOnlyBySource(fieldId?: string): boolean {
  return fieldId !== undefined && fieldId in FIELD_SOURCE;
}

const TABLE_IDS = {
  APPOINTMENTS: 'tblvV7uKTCaFFekoR',
  CLIENTS: 'tblLLUlDgJ4ktzF7c',
  ROOMS: 'tblI8GIUpyxyWNpPa',
  STAFF: 'tblbYk88xJ8FQrLS4',
  STUDIOS: 'tblYM02GzeYdYk23v',
  // Reference table for Acuity appointment types. Confirmed via a debug
  // tooltip that the appointment_type lookup on Appointments (FIELD_IDS.APPT_NAME)
  // reports 0 choices loaded at runtime — a lookup field doesn't expose the
  // source field's option colors here — so the color has to come from this
  // table's own singleSelect field instead (FIELD_IDS.APPT_TYPE_CHOICE).
  APPOINTMENT_TYPES: 'tblhU6FD6innd2VUZ',
  // Issue #54 — Pick Up appointments show the client's orders. Same table
  // fulfillment.tsx/pipeline.tsx already read from; read-only here for now.
  ORDERS_SHOPIFY: 'tblHFGbijtvZcRPkE',
} as const;

// Issue #54 — mirrors fulfillment.tsx's ORDER_FIELD_IDS. Read-only usage
// here (no writes yet) — see docs/appointments_pickup_orders_plan.md for
// why the write/close/Slack side is still pending Cobalt confirmation.
const ORDER_FIELD_IDS = {
  SHOPIFY_ORDER_NUMBER: 'fldWiKEXjId411DQc',
  AM_ORDER_NUMBER:      'fldBvuNZDqzOx6azb',
  PAYMENT_STATUS:       'fldFI488S8GPaVgCt',
  DELIVERY_METHOD:      'fldFATO0oJUQjPEzr', // 'Pick Up in Store' / 'Ship'
  PICKED_STATUS:        'fldqhI6Aq9zIhFsFW', // None / Partial / Full
  TOTAL:                'fldkIMTeKdneKABS4',
  ORDER_STATUS:         'fldYq3JxRSWQUUHm6', // Open / Closed / Cancelled
  SUBTOTAL:             'fld9CtuMBLprH0SA1',
  SHIPPING:             'fldkorfpXkwh0TWfs',
  TAXES:                'fld2chJ0ME8MA3OWq',
  ADJUSTED_TOTAL:       'fldK8iVktZl5Vg24Q',
  STORE:                'fldGW9ECCrIEZnNQ5',
  TRACKING_NUMBER:      'fldCfwwMFNkVKJApj',
  CARRIER:              'fld3JafhFWzW6Knuw',
  TAX_CONFIRMED:                    'fld8mrCQUnWlA7cgk',
  CLIENT_ADDRESS_CONFIRMED:        'fldNJLMMdJvhWCCUn', // lookup — DF Clients.address_confirmed via client link
  CLIENT_HOLD_RELEASED:            'fldDRkCyTlbqy83Te', // lookup — DF Clients.hold_released via client link
  PICKUP_RELEASED:                 'fldsFJgAKIlMP8Feu',
  FULFILLMENT_PROGRESS_PERCENTAGE: 'fldKDT2x7wmZ2Suui',
  HOLD_REASON:                     'fld2MAllXcFTSIOVZ', // lookup — DF Clients.hold_reason via client link
  HOLD_SHIPMENT_DATE:              'fldsJ8LJdNHBKJhC0', // lookup — DF Clients.hold_shipment_date via client link
  ORDER_ADJUSTMENTS:               'fldI1GmVHGcZcEJab',
  ORDER_SYNC_CHANGELOG:            'fldq0X1wdBJlOYVn8',
} as const;

// Issue #54 — order_adjustments (read-only here, no "Add Adjustment" capability
// per scope — that stays a Fulfillment-only action).
const ADJ_TABLE_ID = 'tbly4tfEDJdB6kYkg';
const ADJ_FIELD_IDS = {
  CHANGE_TYPE:   'fldz0a13Pm8gwawI4',
  DIRECTION:     'fldIQTMAPV5R8qUCq',
  SIGNED_AMOUNT: 'fldddI1MumdkDZMSV',
} as const;

// Issue #54 — order_items. Data synced from Apparel Magic — read only, same
// as fulfillment.tsx.
const ORDER_ITEMS_TABLE_ID = 'tblWOBS5nX0GZokaU';
const ORDER_ITEMS_FIELD_IDS = {
  AM_ORDER_ITEM_ID:    'fldi7F9rPeWLNfarJ',
  ORDER:               'fldXrdBFm5SeGCTvq',
  STYLE:               'fldL9rj7ZeDnjnXiY',
  STYLE_PHOTO:         'fldWORLRjBw3oMZOb', // lookup — attachment from DF Styles via style link
  ATTR_2:              'fldk3kg4OLToNqDbK',
  ATTR_3:              'fld5KHXDv1MekJp5U',
  SIZE:                'fldqihfODfR9L9Uxt',
  AMOUNT:              'fldLT05tO5ep0WkyP',
  QUANTITY:            'fldLZ0kD0QwzEA1J6',
  QUANTITY_ALLOCATED:  'fldktKHqf8C5oL9OA',
  QUANTITY_PICKED:     'fldNmj9AMDG3gvlEc',
  QUANTITY_SHIPPED:    'fldhapPEGU3CVjVye',
  QUANTITY_OPEN:       'fldvU2sU8b6V0wTlG',
  DUE_DATE:            'fld2Rp7eQXoPnOZNo',
  DESCRIPTION:         'fldEoDIghGigaujp0',
  NAME_IF_NO_STYLE:    'fld2Hzmni4fGcKAgh',
  ORDER_DATE:          'fld7jjtQvCDZQlDNL',
} as const;

// Issue #54 — order sync change log. Read-only, populated by the Shopify/AM
// sync automation, not staff.
const SYNC_LOG_TABLE_ID = 'tblOCgG5WDP51FB2n';
const SYNC_LOG_FIELD_IDS = {
  FIELD_CHANGED:  'fldhvCRFHDiWrtR53',
  PREVIOUS_VALUE: 'fldCk1aXfztfWsnLs',
  NEW_VALUE:      'fldeKvrtoczn1b3a2',
  REASON:         'fldy5nEQjWEd6cTBW',
  CHANGED_AT:     'fldI2iA0qIJLsvmoY',
} as const;

const VIEW_IDS = {
  ROOMS_ACTIVE: 'viwv04qJDVSJWbzZ4',
  STAFF_SA: 'viwv10z7bp9EUqa5t',
  STAFF_ALT_LEAD: 'viwkbvcHBfbPqx3jm',
} as const;

const APPOINTMENT_RECORD_FIELDS = [
  FIELD_IDS.APPT_TIME,
  FIELD_IDS.APPT_TYPE,
  FIELD_IDS.ROOM_LINK,
  FIELD_IDS.CLIENT_LINK,
  FIELD_IDS.STATUS,
  FIELD_IDS.CHECK_IN,
  FIELD_IDS.CLEARED,
  FIELD_IDS.PICKED_UP,
  FIELD_IDS.SA_NAME,
  FIELD_IDS.ALT_LEAD_LINK,
  FIELD_IDS.STUDIO_NAME,
  FIELD_IDS.STUDIO_SHORT_NAME,
  FIELD_IDS.SAMPLES_NOT_IN_NY,
  FIELD_IDS.FAV_STYLES,
  FIELD_IDS.FULL_NAME_ACUITY,
  FIELD_IDS.APPT_CATEGORY,
  FIELD_IDS.STUDIO_ADDRESS,
  FIELD_IDS.PRE_APPT_NOTES,
  FIELD_IDS.APPT_END_TIME,
  FIELD_IDS.APPT_NAME,
  FIELD_IDS.IS_FIRST_VISIT,
  FIELD_IDS.CUSTOMIZATION_LOOKUP,
  FIELD_IDS.APPT_MEASUREMENTS_BUST,
  FIELD_IDS.APPT_MEASUREMENTS_WAIST,
  FIELD_IDS.APPT_MEASUREMENTS_HIPS,
  FIELD_IDS.APPT_MEASUREMENTS_HEIGHT,
  FIELD_IDS.APPT_PHOTOS,
  FIELD_IDS.APPT_FOLLOW_UP,
  FIELD_IDS.APPT_ALT_NOTES,
  // APPT_NOTES = same field as PRE_APPT_NOTES (fld3nCe9MAo4dKavc), already loaded above
] as const;

const CLIENT_RECORD_FIELDS = [
  FIELD_IDS.CLIENT_STAGE,
  FIELD_IDS.CLIENT_FULL_NAME,
  FIELD_IDS.CLIENT_FIRST_NAME,
  FIELD_IDS.CLIENT_LAST_NAME,
  FIELD_IDS.CLIENT_EMAIL,
  FIELD_IDS.CLIENT_PHONE,
  FIELD_IDS.CLIENT_WEDDING,
  FIELD_IDS.CLIENT_WEDDING_IF_NOT_SET,
  FIELD_IDS.CLIENT_STYLISTS,
  FIELD_IDS.CLIENT_RTW_SIZE,
  FIELD_IDS.CLIENT_NEXT_APPT,
  FIELD_IDS.CLIENT_LAST_APPT,
  FIELD_IDS.CLIENT_APPT_RECORDS,
  FIELD_IDS.CLIENT_FAV_STYLES_ACUITY,
  FIELD_IDS.CLIENT_PERSONAL_NOTES,
  FIELD_IDS.CLIENT_WEDDING_LOC,
  FIELD_IDS.CLIENT_WEDDING_PLANNER,
  FIELD_IDS.CLIENT_MEASUREMENTS,
  FIELD_IDS.CLIENT_APPT_PHOTOS,
  FIELD_IDS.CLIENT_INTEREST_ALTS,
  FIELD_IDS.CLIENT_INTEREST_M2M,
  FIELD_IDS.CLIENT_APPT_NOTES,
  FIELD_IDS.CLIENT_IS_RUSH,
  FIELD_IDS.CLIENT_SA_LINK,
  FIELD_IDS.CLIENT_FOLLOW_UP_SENT,
] as const;

const ROOM_RECORD_FIELDS = [
  FIELD_IDS.ROOM_NAME,
  FIELD_IDS.ROOM_STUDIO_SHORT_NAME,
] as const;

function getExistingFields(table: Table | undefined, fieldIds: readonly string[]): Field[] {
  if (!table) return [];
  return fieldIds
    .map((fieldId) => table.getFieldIfExists(fieldId))
    .filter((field): field is Field => Boolean(field));
}

function getCustomProperties(base: ReturnType<typeof useBase>) {
  return [
    {
      key: 'appointmentsTable',
      label: 'Appointments',
      type: 'table' as const,
      defaultValue: base.tables.find((t) => t.id === TABLE_IDS.APPOINTMENTS),
    },
    {
      key: 'clientsTable',
      label: 'Clients',
      type: 'table' as const,
      defaultValue: base.tables.find((t) => t.id === TABLE_IDS.CLIENTS),
    },
  ];
}

function formatDateForComparison(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// LA-studio appointments (studio short_name "LA") display in Pacific time;
// every other studio (NY and anything else) keeps the original Eastern time.
function getTimeZoneForStudioShort(studioShort: string | null | undefined): string {
  return (studioShort ?? '').trim().toUpperCase() === 'LA' ? 'America/Los_Angeles' : 'America/New_York';
}

function renderTimeCell(timeValue: string, timeZone: string = 'America/New_York'): React.ReactElement {
  const date = new Date(timeValue);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(date);

  const hour = parts.find(p => p.type === 'hour')?.value ?? '0';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  const dayPeriod = (parts.find(p => p.type === 'dayPeriod')?.value ?? '').toLowerCase();
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? '';

  const timePart = `${hour}:${minute}${dayPeriod}`;

  return (
    <span className="whitespace-nowrap">
      <span className="text-gray-600 dark:text-gray-400">{timePart}</span>
      {tzName && (
        <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{tzName}</span>
      )}
    </span>
  );
}

function formatNYTime(date: Date, timeZone: string = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const hour = parts.find(p => p.type === 'hour')?.value ?? '0';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  const dayPeriod = (parts.find(p => p.type === 'dayPeriod')?.value ?? '').toLowerCase();

  return `${hour}:${minute}${dayPeriod}`;
}

function isWithin30MinBefore(targetTime: Date | null): boolean {
  if (!targetTime || isNaN(targetTime.getTime())) return false;
  return Date.now() >= targetTime.getTime() - 30 * 60 * 1000;
}

function getShortTypeLabel(fullLabel: string): string {
  return fullLabel
    .replace(/^(NY\s*-\s*(260|TRIBECA)\s*-\s*|LA\s*-\s*)/i, '')
    .replace(/\s*-\s*\d+\s*Minutes?\s*$/i, '')
    .trim();
}

type PillSize = 'sm' | 'md' | 'xl';

function getAppointmentTypePillClasses(typeLabel: string, size: PillSize = 'sm'): string {
  const sizeClasses: Record<PillSize, string> = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-base px-2.5 py-0.5',
    xl: 'text-2xl px-5 py-2',
  };
  const base = `inline-flex items-center ${sizeClasses[size]} rounded-full font-medium whitespace-nowrap border`;
  const lower = typeLabel.toLowerCase();

  if (lower.includes('final fitting')) return `${base} bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200 border-violet-200 dark:border-violet-700`;
  if (lower.includes('fit assessment & pick up')) return `${base} bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-200 border-teal-200 dark:border-teal-700`;
  if (lower.includes('fit assessment & ship')) return `${base} bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700`;
  if (lower.includes('fit assessment')) return `${base} bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-700`;
  if (lower.includes('alterations')) return `${base} bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 border-orange-200 dark:border-orange-700`;
  if (lower.includes('accessories consultation')) return `${base} bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700`;
  if (lower.includes('consultation')) return `${base} bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200 border-green-200 dark:border-green-700`;
  if (lower.includes('measurements')) return `${base} bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-200 border-sky-200 dark:border-sky-700`;
  if (lower.includes('pick up')) return `${base} bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-200 border-pink-200 dark:border-pink-700`;
  if (lower.includes('shipping')) return `${base} bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 border-purple-200 dark:border-purple-700`;
  return `${base} bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]`;
}

type AppointmentCategory = 'pick-up-only' | 'combined-pick-up' | 'standard';

function getAppointmentCategory(typeLabel: string): AppointmentCategory {
  const short = getShortTypeLabel(typeLabel).toLowerCase().trim();
  if (short === 'pick up') return 'pick-up-only';
  if (short.includes('& pick up')) return 'combined-pick-up';
  return 'standard';
}

// All four Airtable intensity tiers (base/Bright/Light1/Light2) resolve to the
// same high-contrast bg-100/text-800 formula per hue — the tier distinctions
// in Airtable's own palette aren't meaningfully different for a small chip,
// and a light chip needs a dark same-hue text (not the pale text-500/600
// this used to have) to actually be readable.
const AIRTABLE_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-200 dark:bg-blue-800/50 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-600',
  blueBright: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  blueLight1: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  blueLight2: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  cyan: 'bg-cyan-200 dark:bg-cyan-800/50 text-cyan-900 dark:text-cyan-100 border-cyan-300 dark:border-cyan-600',
  cyanBright: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  cyanLight1: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  cyanLight2: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  teal: 'bg-teal-200 dark:bg-teal-800/50 text-teal-900 dark:text-teal-100 border-teal-300 dark:border-teal-600',
  tealBright: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700',
  tealLight1: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700',
  tealLight2: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700',
  green: 'bg-green-200 dark:bg-green-800/50 text-green-900 dark:text-green-100 border-green-300 dark:border-green-600',
  greenBright: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  greenLight1: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  greenLight2: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  yellow: 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-600',
  yellowBright: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
  yellowLight1: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
  yellowLight2: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
  orange: 'bg-orange-200 dark:bg-orange-800/50 text-orange-900 dark:text-orange-100 border-orange-300 dark:border-orange-600',
  orangeBright: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
  orangeLight1: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
  orangeLight2: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
  red: 'bg-red-200 dark:bg-red-800/50 text-red-900 dark:text-red-100 border-red-300 dark:border-red-600',
  redBright: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
  redLight1: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
  redLight2: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
  pink: 'bg-pink-200 dark:bg-pink-800/50 text-pink-900 dark:text-pink-100 border-pink-300 dark:border-pink-600',
  pinkBright: 'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-700',
  pinkLight1: 'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-700',
  pinkLight2: 'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-700',
  purple: 'bg-purple-200 dark:bg-purple-800/50 text-purple-900 dark:text-purple-100 border-purple-300 dark:border-purple-600',
  purpleBright: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
  purpleLight1: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
  purpleLight2: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
  gray: 'bg-gray-200 dark:bg-white/15 text-gray-800 dark:text-[#F3EFE6] border-gray-300 dark:border-white/15',
  grayBright: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#38322A]',
  grayLight1: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#38322A]',
  grayLight2: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#38322A]',
};

function getAirtableSelectPillClasses(colorName: string | null | undefined): string {
  const colorClasses = colorName
    ? (AIRTABLE_COLOR_MAP[colorName] ?? 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]')
    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]';
  return `inline-flex items-center text-base px-2.5 py-0.5 rounded-full font-medium border whitespace-nowrap ${colorClasses}`;
}

// Resolves the actual Airtable option color for a field's choices — used
// instead of hardcoded per-value maps so pill colors stay in sync with
// whatever colors are set on the field in Airtable. Works for a direct
// singleSelect field (`field.options.choices`) and for a lookup-of-singleSelect
// field, whose choices live nested under `field.options.result.options.choices`
// (confirmed shape via get_table_schema for fldZO3rF3KOGxG0S5).
function getFieldChoiceColorMap(field: Field | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!field) return map;
  const opts = field.options as unknown as {
    choices?: Array<{ name: string; color?: string }>;
    result?: { options?: { choices?: Array<{ name: string; color?: string }> } };
  } | undefined;
  const choices = opts?.choices ?? opts?.result?.options?.choices ?? [];
  for (const choice of choices) {
    if (choice?.name) map.set(choice.name, choice.color ?? '');
  }
  return map;
}

const DEFAULT_PILL_COLOR_CLASSES = 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#38322A]';

function getCompactPillClassesForColor(colorName: string | null | undefined): string {
  const colorClasses = colorName ? (AIRTABLE_COLOR_MAP[colorName] ?? DEFAULT_PILL_COLOR_CLASSES) : DEFAULT_PILL_COLOR_CLASSES;
  return `inline-flex items-center justify-center w-full text-center px-1.5 py-0.5 rounded-full font-medium border whitespace-nowrap leading-tight text-xs ${colorClasses}`;
}

// Table-cell-sized pill using the field's real Airtable choice color — for
// the List layout's Stage/Type columns (Calendar's chips use the compact variant above).
function getListPillClassesForColor(colorName: string | null | undefined): string {
  const colorClasses = colorName ? (AIRTABLE_COLOR_MAP[colorName] ?? DEFAULT_PILL_COLOR_CLASSES) : DEFAULT_PILL_COLOR_CLASSES;
  return `inline-flex items-center text-[13px] px-2.5 py-0.5 rounded-full font-medium border whitespace-nowrap ${colorClasses}`;
}

// Issue #32/#45 — abbreviated slash-joined format ("Missing Room/SA/AL")
// instead of a full grammatical sentence, so the flag reads as a compact
// tag rather than a sentence-length warning.
function formatMissingFieldsMessage(labels: string[]): string {
  if (labels.length === 0) return '';
  return `Missing ${labels.join('/')}`;
}

// A multipleLookupValues cell (this is one — a lookup of a singleSelect,
// through a link field) doesn't hand back a flat `{name, color}` object per
// linked record here. Confirmed directly against this field's actual cell
// data (via the Missing Data hover tooltip added below): this interface's
// runtime returns it as `[{ linkedRecordId: string, value: string }]` — an
// array of one entry per linked record, where `value` is the PLAIN STRING
// choice name, not a nested `{name,color}` object. Two earlier fixes here
// each assumed a different wrong shape (a flat `{name,color}`, and a
// `{value:{...}}` object-nested-in-object — the shape used by *other*
// lookups elsewhere in this codebase, e.g. extractFirstLookupString in
// pipeline.tsx/recap.tsx) and neither matched. Also handles a
// `{linkedRecordIds, valuesByLinkedRecordId}` shape seen in an earlier
// probe, kept in case a different lookup surfaces it.
function unwrapSelectLike(value: unknown): { name: string; color?: string } | null {
  if (typeof value === 'string') return value.length > 0 ? { name: value } : null;
  if (!value || typeof value !== 'object') return null;
  if ('name' in value) return value as { name: string; color?: string };
  if ('value' in value) return unwrapSelectLike((value as { value: unknown }).value);
  if ('linkedRecordIds' in value && 'valuesByLinkedRecordId' in value) {
    const v = value as { linkedRecordIds: string[]; valuesByLinkedRecordId: Record<string, unknown> };
    const firstId = v.linkedRecordIds?.[0];
    if (!firstId) return null;
    const valuesForLink = v.valuesByLinkedRecordId?.[firstId];
    const firstValue = Array.isArray(valuesForLink) ? valuesForLink[0] : valuesForLink;
    return unwrapSelectLike(firstValue);
  }
  return null;
}
function extractSelectValue(rawValue: unknown): { name: string; color: string | null } | null {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'string') return rawValue.length > 0 ? { name: rawValue, color: null } : null;
  if (Array.isArray(rawValue) && rawValue.length > 0) {
    const first = rawValue[0];
    if (typeof first === 'string') return { name: first, color: null };
    const obj = unwrapSelectLike(first);
    if (obj) return { name: obj.name, color: obj.color ?? null };
    return null;
  }
  const obj = unwrapSelectLike(rawValue);
  if (obj) return { name: obj.name, color: obj.color ?? null };
  return null;
}

// Issue #32/#45 — "Missing Data" used to be a single hardcoded red pill
// everywhere, regardless of which field was missing or whether the missing
// field actually blocks anything. Two severities now: `hard` (red) is
// reserved for Client — the one case that's genuinely impossible to check in
// without; `soft` (amber) is everything else (Room/Sales Associate/
// Alterations Lead) — informational, doesn't block Check In. `label` names
// the specific field instead of the generic word "Data". Plain colored text,
// no chip/pill background — so it doesn't compete visually with the actual
// Stage/Type pills in the same row.
//
// Wording (new feedback item, 2026-08-26): a `soft` flag reads just "Must
// Assign" — no field name — instead of "Missing {label}". This component is
// only ever used for `soft` inside the List layout's own table cells, where
// the column header (Room / Sales Associate / Alteration Lead) already names
// the field; repeating it in the cell itself is redundant, especially for
// the two long labels ("Sales Associate", "Alterations Lead"). "Missing"
// also implied a data-entry gap blocking the appointment, when in practice
// these three fields never block Check In — "Must Assign" names the actual
// outstanding action instead. `hard` (Client) keeps "Missing {label}" — that
// one genuinely is missing data, not an assignment task, and isn't sitting
// under a column header that already names it.
function MissingDataPill({ label = 'Data', severity = 'hard', reason }: { label?: string; severity?: 'hard' | 'soft'; reason?: string | null } = {}): React.ReactElement {
  const colorClasses = severity === 'hard' ? 'text-red-600' : 'text-orange-600';
  const text = severity === 'soft' ? 'Must Assign' : `Missing ${label}`;
  return (
    <span
      title={reason ?? undefined}
      className={`text-[13px] font-medium whitespace-nowrap ${colorClasses} ${reason ? 'cursor-help' : ''}`}
    >
      {text}
    </span>
  );
}

function isBlockTime(record: Record, clientLinkField: Field | null | undefined): boolean {
  if (!clientLinkField) return false;
  const linked = record.getCellValue(clientLinkField) as Array<{ id: string }> | null;
  return linked == null || linked.length === 0;
}

function BlockTimePill(): React.ReactElement {
  return (
    <span className="inline-flex items-center text-base px-2.5 py-0.5 rounded-full font-medium border bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A] whitespace-nowrap">
      Block Time
    </span>
  );
}

const STAGE_PILL_CLASSES: Record<string, string> = {
  'Pre-Appointment': 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  'Deliberating': 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'Sold': 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  'In Alterations': 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  'In Fulfillment': 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  'Did Not Convert': 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#38322A]',
};

function StagePill({ stage, size = 'sm', color }: { stage: string | null; size?: 'sm' | 'lg'; color?: string | null }): React.ReactElement {
  if (!stage) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  // Prefers the real Airtable choice color (passed by the caller from the
  // Stage field's own options) over the old hardcoded per-value map, so this
  // stays correct if the field's colors are ever changed in Airtable.
  const colorClasses = color !== undefined
    ? (color ? (AIRTABLE_COLOR_MAP[color] ?? 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]') : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]')
    : (STAGE_PILL_CLASSES[stage] ?? 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]');
  const sizeClass = size === 'lg'
    ? 'inline-flex items-center text-sm px-3 py-1.5 rounded-full font-medium border whitespace-nowrap'
    : 'inline-flex items-center text-[13px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap';
  return (
    <span className={`${sizeClass} ${colorClasses}`}>
      {stage}
    </span>
  );
}

// #42 — Dot colors per source system
const SOURCE_DOT_COLOR: Record<FieldSource, string> = {
  acuity: 'bg-purple-500',
  shopify: 'bg-green-500',
  apparel_magic: 'bg-amber-500',
};

interface DetailRowProps {
  label: React.ReactNode;
  fieldId?: string;
  children: React.ReactNode;
}

function DetailRow({ label, fieldId, children }: DetailRowProps): React.ReactElement {
  const source = fieldId !== undefined ? FIELD_SOURCE[fieldId] : undefined;
  return (
    <div>
      {/* Capitalized, not uppercase, per Axel 2026-08-24 — applies to every
          field label in this detail drawer, since they all render through
          this one shared component. */}
      <div className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide mb-1 flex items-center gap-1">
        <span>{label}</span>
        {source && (
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${SOURCE_DOT_COLOR[source]}`}
            title={`Sourced from ${source}`}
          />
        )}
      </div>
      {children}
    </div>
  );
}

// Part of the base-wide RTW Size convention — see docs/CROSS_CUTTING.md
// ("RTW Size convention"). Editable view writes only to
// ready_to_wear_size_manual; the Acuity self-report is shown only as a
// non-editable reference on the label, never as its own editable field —
// "Acuity Size: N" in the value gray when present, "Acuity Size: Missing
// Value" in the label's muted gray when absent. Same helper (adapted to
// this file's DetailRow-based layout) as pipeline.tsx/recap.tsx.
function rtwSizeLabelWithAcuity(baseLabel: string, acuityValue: number | null): React.ReactNode {
  const hasValue = acuityValue != null;
  return (
    <>
      {baseLabel}
      <span className="text-gray-300 dark:text-gray-600 normal-case"> | </span>
      <span className={`normal-case tracking-normal font-normal ${hasValue ? 'text-gray-800 dark:text-[#F3EFE6]' : 'text-gray-400 dark:text-gray-500'}`}>
        {hasValue ? `Acuity Size: ${acuityValue}` : 'Acuity Size: Missing Value'}
      </span>
      {hasValue && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-purple-500 ml-1"
          title="Sourced from Acuity"
        />
      )}
    </>
  );
}

// Editable Ready to Wear Size — writes to CLIENT_RTW_SIZE_MANUAL, falls back
// to a read-only display of CLIENT_RTW_SIZE_DISPLAY (the manual/Acuity
// fallback formula) when the viewer can't edit DF Clients. Mirrors the
// editable/read-only split used in pipeline.tsx's client modal, adapted to
// this file's local blur-to-save convention (see handleSaveRoom/handleSaveSA
// above) rather than a shared EditableNumber component.
function RtwSizeField({
  manualValue, formulaDisplay, acuityValue, fieldRef, recordId, clientsTable, canEdit,
}: {
  manualValue: number | null;
  formulaDisplay: string | null;
  acuityValue: number | null;
  fieldRef: Field | null | undefined;
  recordId: string;
  clientsTable: Table;
  canEdit: boolean;
}) {
  const label = rtwSizeLabelWithAcuity('Ready to wear size', acuityValue);
  const [localValue, setLocalValue] = useState(manualValue !== null ? String(manualValue) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLocalValue(manualValue !== null ? String(manualValue) : ''); }, [manualValue]);

  if (!canEdit || !fieldRef) {
    return (
      <DetailRow label={label}>
        <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{formulaDisplay || '—'}</div>
      </DetailRow>
    );
  }

  const handleBlur = async () => {
    const trimmed = localValue.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && isNaN(parsed as number)) {
      setError('Must be a number');
      setLocalValue(manualValue !== null ? String(manualValue) : '');
      return;
    }
    if (parsed === manualValue) return;
    setSaving(true);
    setError(null);
    try {
      await clientsTable.updateRecordAsync(recordId, { [fieldRef.id]: parsed });
    } catch (e) {
      console.error('Failed to update ready_to_wear_size_manual:', e);
      setError('Save failed');
      setLocalValue(manualValue !== null ? String(manualValue) : '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailRow label={label}>
      <input
        type="number"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        disabled={saving}
        min={0}
        max={20}
        step={0.5}
        placeholder="e.g. 8"
        className="w-full text-sm text-gray-800 dark:text-[#F3EFE6] bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-md px-3 py-2 focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ MozAppearance: 'textfield' } as React.CSSProperties}
      />
      {error && <span className="text-xs text-red-500 dark:text-red-400 mt-1 block">{error}</span>}
    </DetailRow>
  );
}

function formatFriendlyDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = isoMatch
    ? new Date(parseInt(isoMatch[1]!, 10), parseInt(isoMatch[2]!, 10) - 1, parseInt(isoMatch[3]!, 10))
    : new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  const day = date.getDate();
  const year = date.getFullYear();

  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const ordinal = s[(v - 20) % 10] || s[v] || s[0];

  return `${month} ${day}${ordinal}, ${year}`;
}

// wedding_date_display (Formatted, falling back to If Not Set) always returns
// either a real MM/DD/YYYY date or free placeholder text (e.g. "Spring 2027",
// "TBD") — never ISO. Parses the real-date case first and formats it exactly
// like formatFriendlyDate above; any other non-empty text is returned as-is
// (never handed to `new Date()`, which would silently misparse a stray
// month/year token inside placeholder text into a fabricated date).
function formatWeddingDateDisplay(val: string | null): { text: string; isRealDate: boolean } {
  if (!val) return { text: '', isRealDate: false };
  const mdy = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdy) {
    const [, mm, dd, yyyy] = mdy;
    const monthIdx = parseInt(mm!, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      const d = new Date(parseInt(yyyy!, 10), monthIdx, parseInt(dd!, 10));
      return { text: formatFriendlyDate(fmtDateKeyLocal(d)), isRealDate: true };
    }
  }
  return { text: val, isRealDate: false };
}
function fmtDateKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface MiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

function MiniCalendar({ selectedDate, onSelectDate, onClose }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7; // Monday-start week
  const totalDays = lastDay.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push(d);
  }

  const today = new Date();
  const todayStr = formatDateForComparison(today);
  const selectedStr = formatDateForComparison(selectedDate);

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day: number) => {
    onSelectDate(new Date(year, month, day));
    onClose();
  };

  const handleGoToToday = () => {
    onSelectDate(today);
    onClose();
  };

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate);

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-3 w-[272px]"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
        >
          <CaretLeftIcon size={16} className="text-gray-600 dark:text-gray-400" />
        </button>
        <span className="text-sm font-medium text-gray-800 dark:text-[#F3EFE6]">{monthLabel}</span>
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
        >
          <CaretRightIcon size={16} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="py-1" />;
          }
          const dateStr = formatDateForComparison(new Date(year, month, day));
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedStr;

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={`w-8 h-8 mx-auto flex items-center justify-center text-sm rounded-full transition-colors ${
                isSelected
                  ? 'bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#25211A] font-semibold'
                  : isToday
                  ? 'border border-[#D97706] dark:border-[#FBBF24] text-[#D97706] dark:text-[#FBBF24] font-medium hover:bg-[#FEF3C7] dark:hover:bg-[#3A2E12]'
                  : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-800 dark:text-[#F3EFE6]'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      {selectedStr !== todayStr && (
        <button
          onClick={handleGoToToday}
          className="mt-2 w-full text-xs text-[#D97706] dark:text-[#FBBF24] hover:underline"
        >
          Go to Today
        </button>
      )}
    </div>
  );
}

interface FilterDropdownProps {
  label: string;
  values: string[];
  options: string[];
  onChange: (vals: string[]) => void;
}

function FilterDropdown({ label, values, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handle = (e: MouseEvent) => { 
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); 
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);
  
  const hasValue = values.length > 0;
  const displayText = values.length === 0 ? label : values.length === 1 ? values[0]! : `${values.length} selected`;

  const toggleOption = (opt: string) => {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  };

  const sortedOptions = [...options].sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex items-center gap-2">
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#25211A] border rounded-lg px-3 py-1.5 text-sm hover:border-gray-400 dark:hover:border-white/20 focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors ${
            hasValue
              ? 'border-[#D97706] dark:border-[#FBBF24] text-[#B45F04] dark:text-[#FBBF24] font-medium'
              : 'border-gray-300 dark:border-white/15 text-gray-500 dark:text-gray-400 focus:border-[#D97706] dark:focus:border-[#FBBF24]'
          }`}
        >
          <span className="truncate">{displayText}</span>
          <span className="flex items-center gap-1 flex-shrink-0">
            {hasValue && (
              <XIcon
                size={14}
                className="text-[#B45F04] dark:text-[#FBBF24] hover:opacity-70 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
              />
            )}
            <CaretDownIcon size={14} className={`text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg max-h-[260px] overflow-y-auto w-[240px] py-1 no-scrollbar" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <button 
              type="button" 
              onClick={() => { onChange([]); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${values.length === 0 ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#B45F04] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
            >
              All
            </button>
            {sortedOptions.map(opt => {
              const sel = values.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${sel ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#B45F04] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface StudioDropdownProps {
  value: string;
  options: string[];
  onChange: (studio: string) => void;
}

// Standard-length single-select dropdown (matches FilterDropdown's min-w-[160px] sizing)
function StudioDropdown({ value, options, onChange }: StudioDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} className="relative min-w-[160px]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#25211A] border border-gray-300 dark:border-white/15 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/20 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors"
      >
        <span className="truncate">{value || 'Studio'}</span>
        <CaretDownIcon size={14} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg max-h-[260px] overflow-y-auto w-[240px] py-1 no-scrollbar" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {options.map(studio => {
            const sel = studio === value;
            return (
              <button
                key={studio}
                type="button"
                onClick={() => { onChange(studio); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors truncate ${sel ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#B45F04] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                title={studio}
              >
                {studio}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface NotificationModalProps {
  content: React.ReactNode;
  onClose: () => void;
}

function NotificationModal({ content, onClose }: NotificationModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [requestClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible?1:0 }}
      onClick={requestClose}
    >
      <div
        className="bg-white dark:bg-[#25211A] rounded-xl p-8 max-w-[480px] w-full mx-4 transition-[opacity,transform] duration-200 ease-out"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)', opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-gray-800 dark:text-[#F3EFE6] mb-6 leading-relaxed">{content}</p>
        <div className="flex justify-center">
          <button
            onClick={requestClose}
            className="px-8 py-2 rounded-full bg-gray-900 dark:bg-[#F3EFE6] text-white dark:text-[#1B1813] text-sm font-medium hover:bg-gray-700 dark:hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionButtonsProps {
  record: Record;
  appointmentsTable: Table;
  checkInField: Field | null;
  clearedField: Field | null;
  pickedUpField: Field | null;
  isClearingByRecord: { [key: string]: boolean };
  clearErrorByRecord: { [key: string]: string };
  onCheckIn: (record: Record) => void;
  onClear: (record: Record) => void;
  onPickUp: (record: Record) => void;
  apptTypeLabel: string;
  hasRequiredData: boolean;
  showCheckInButton: boolean;
  showClearButton: boolean;
}

function ActionButtons({
  record,
  appointmentsTable,
  checkInField,
  clearedField,
  pickedUpField,
  isClearingByRecord,
  clearErrorByRecord,
  onCheckIn,
  onClear,
  onPickUp,
  apptTypeLabel,
  hasRequiredData,
  showCheckInButton,
  showClearButton,
}: ActionButtonsProps) {
  const canUpdate = appointmentsTable.hasPermissionToUpdateRecords();

  const checkInValue = checkInField
    ? (record.getCellValue(checkInField) as boolean | null) ?? false
    : false;
  const clearedValue = clearedField
    ? (record.getCellValue(clearedField) as boolean | null) ?? false
    : false;
  const pickedUpValue = pickedUpField
    ? (record.getCellValue(pickedUpField) as boolean | null) ?? false
    : false;
  const showCleared = clearedValue || !!isClearingByRecord[record.id];
  const errorMsg = clearErrorByRecord[record.id];

  const category = getAppointmentCategory(apptTypeLabel);

  const handleCheckInClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canUpdate || !checkInField || checkInValue) return;
    try {
      await appointmentsTable.updateRecordAsync(record.id, { [checkInField.id]: true });
      onCheckIn(record);
    } catch (err) {
      console.error('Check in failed:', err);
    }
  };

  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!checkInValue || showCleared) return;
    onClear(record);
  };

  const handlePickUpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPickUp(record);
  };

  const btn = 'text-sm font-medium border rounded-lg transition-colors whitespace-nowrap w-[132px] px-3 py-1 text-center';
  const btnDefault = `${btn} border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#25211A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer`;
  const btnDisabled = `${btn} opacity-50 cursor-not-allowed border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#25211A] text-gray-700 dark:text-gray-300`;
  const btnGreen = `${btn} border-green-200 bg-green-100 text-green-700 cursor-default`;

  const pillRed = 'inline-flex items-center justify-center w-[132px] px-2 py-1 rounded-full text-sm font-medium border bg-red-50 text-red-600 border-red-200 whitespace-nowrap';
  const pillYellow = 'inline-flex items-center justify-center w-[132px] px-2 py-1 rounded-full text-sm font-medium border bg-orange-50 text-orange-600 border-orange-200 whitespace-nowrap';

  const wrapper = 'flex flex-col items-center gap-1 w-full';
  const row = 'flex items-center justify-center gap-2 flex-wrap';

  if (category === 'pick-up-only') {
    if (pickedUpValue) {
      return (
        <div className={wrapper}>
          <div className={row}>
            <button disabled className={btnGreen}>Picked Up</button>
          </div>
        </div>
      );
    }

    if (!showCheckInButton) {
      if (!hasRequiredData) {
        return (
          <div className={wrapper}>
            <div className={row}>
              <span className={pillRed}>Missing Client</span>
            </div>
          </div>
        );
      }
      return <div className={wrapper} />;
    }

    if (checkInValue) {
      return (
        <div className={wrapper}>
          <div className={row}>
            <button disabled className={btnGreen}>Checked In</button>
            <button
              onClick={handlePickUpClick}
              disabled={!canUpdate}
              className={canUpdate ? btnDefault : btnDisabled}
            >
              Pick Up
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={wrapper}>
        <div className={row}>
          {hasRequiredData ? (
            <button
              onClick={handleCheckInClick}
              disabled={!canUpdate}
              className={canUpdate ? btnDefault : btnDisabled}
            >
              Check In
            </button>
          ) : (
            <span className={pillRed}>Missing Client</span>
          )}
          <span className={pillYellow}>Pending Pick Up</span>
        </div>
      </div>
    );
  }

  if (category === 'standard') {
    const showAnySlot1 = checkInValue || showCheckInButton;
    if (!showAnySlot1) {
      if (!hasRequiredData) {
        return (
          <div className={wrapper}>
            <div className={row}>
              <span className={pillRed}>Missing Client</span>
            </div>
          </div>
        );
      }
      return <div className={wrapper} />;
    }

    return (
      <div className={wrapper}>
        <div className={row}>
          {checkInValue ? (
            <button disabled className={btnGreen}>Checked In</button>
          ) : showCheckInButton ? (
            hasRequiredData ? (
              <button
                onClick={handleCheckInClick}
                disabled={!canUpdate}
                className={canUpdate ? btnDefault : btnDisabled}
              >
                Check In
              </button>
            ) : (
              <span className={pillRed}>Missing Client</span>
            )
          ) : null}

          {checkInValue && (
            showCleared ? (
              <button disabled className={btnGreen}>Cleared</button>
            ) : showClearButton ? (
              <button
                onClick={handleClearClick}
                disabled={!canUpdate}
                className={canUpdate ? btnDefault : btnDisabled}
              >
                Clear
              </button>
            ) : null
          )}
        </div>
        {errorMsg && <span className="text-xs text-red-600 text-center">{errorMsg}</span>}
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <div className={row}>
        {checkInValue ? (
          <button disabled className={btnGreen}>Checked In</button>
        ) : showCheckInButton ? (
          hasRequiredData ? (
            <button
              onClick={handleCheckInClick}
              disabled={!canUpdate}
              className={canUpdate ? btnDefault : btnDisabled}
            >
              Check In
            </button>
          ) : (
            <span className={pillRed}>Missing Client</span>
          )
        ) : !hasRequiredData ? (
          <span className={pillRed}>Missing Client</span>
        ) : null}

        {checkInValue && (
          showCleared ? (
            <button disabled className={btnGreen}>Cleared</button>
          ) : showClearButton ? (
            <button
              onClick={handleClearClick}
              disabled={!canUpdate}
              className={canUpdate ? btnDefault : btnDisabled}
            >
              Clear
            </button>
          ) : null
        )}

        {showCleared ? (
          <button onClick={handlePickUpClick} className={btnDefault}>Pick Up</button>
        ) : (
          <span className={pillYellow}>Pending Pick Up</span>
        )}
      </div>
      {errorMsg && <span className="text-xs text-red-600 text-center">{errorMsg}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// LIST/CALENDAR TOGGLE — PILL SWITCH
// ─────────────────────────────────────────────
const LAYOUT_OPTIONS = ['list', 'calendar'] as const;

function LayoutToggle({
  value,
  onChange,
}: {
  value: 'list' | 'calendar';
  onChange: (layout: 'list' | 'calendar') => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const layoutLabel = (layout: 'list' | 'calendar') => (layout === 'list' ? 'List' : 'Calendar');

  return (
    <div ref={containerRef} className="relative min-w-[160px]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#25211A] border border-gray-300 dark:border-white/15 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/20 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors"
      >
        <span className="truncate">{layoutLabel(value)}</span>
        <CaretDownIcon size={14} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg max-h-[260px] overflow-y-auto w-[240px] py-1 no-scrollbar" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {LAYOUT_OPTIONS.map((layout) => {
            const sel = layout === value;
            return (
              <button
                key={layout}
                type="button"
                onClick={() => { onChange(layout); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors truncate ${sel ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#B45F04] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
              >
                {layoutLabel(layout)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CALENDAR ACTION BUTTONS (inline text variant for cards)
// ─────────────────────────────────────────────
interface CalendarActionButtonsProps {
  record: Record;
  appointmentsTable: Table;
  checkInField: Field | null;
  clearedField: Field | null;
  pickedUpField: Field | null;
  isClearingByRecord: { [key: string]: boolean };
  clearErrorByRecord: { [key: string]: string };
  onCheckIn: (record: Record) => void;
  onClear: (record: Record) => void;
  onPickUp: (record: Record) => void;
  apptTypeLabel: string;
  hasRequiredData: boolean;
  missingDataMessage: string;
  showCheckInButton: boolean;
  showClearButton: boolean;
}

function CalendarActionButtons({
  record,
  appointmentsTable,
  checkInField,
  clearedField,
  pickedUpField,
  isClearingByRecord,
  clearErrorByRecord,
  onCheckIn,
  onClear,
  onPickUp,
  apptTypeLabel,
  hasRequiredData,
  missingDataMessage,
  showCheckInButton,
  showClearButton,
}: CalendarActionButtonsProps) {
  const canUpdate = appointmentsTable.hasPermissionToUpdateRecords();
  const checkInValue = checkInField ? (record.getCellValue(checkInField) as boolean | null) ?? false : false;
  const clearedValue = clearedField ? (record.getCellValue(clearedField) as boolean | null) ?? false : false;
  const pickedUpValue = pickedUpField ? (record.getCellValue(pickedUpField) as boolean | null) ?? false : false;
  const showCleared = clearedValue || !!isClearingByRecord[record.id];
  const errorMsg = clearErrorByRecord[record.id];
  const category = getAppointmentCategory(apptTypeLabel);

  const handleCheckInClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canUpdate || !checkInField || checkInValue) return;
    try {
      await appointmentsTable.updateRecordAsync(record.id, { [checkInField.id]: true });
      onCheckIn(record);
    } catch (err) { console.error('Check in failed:', err); }
  };
  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!checkInValue || showCleared) return;
    onClear(record);
  };
  const handlePickUpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPickUp(record);
  };

  // Same button styling as the List layout's ActionButtons — just smaller.
  const btn = 'text-[11px] font-medium border rounded-md transition-colors whitespace-nowrap px-2 py-0.5 text-center';
  const btnDefault = `${btn} border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#25211A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer`;
  const btnDisabled = `${btn} opacity-50 cursor-not-allowed border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#25211A] text-gray-700 dark:text-gray-300`;
  const btnGreen = `${btn} border-green-200 bg-green-100 text-green-700 cursor-default`;
  const pillRed = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-600 border-red-200 whitespace-nowrap';
  const pillYellow = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-50 text-orange-600 border-orange-200 whitespace-nowrap';

  const items: React.ReactNode[] = [];

  if (checkInValue) {
    items.push(<button key="ci" disabled className={btnGreen}>Checked In</button>);
  } else if (showCheckInButton) {
    if (hasRequiredData) {
      items.push(
        <button key="ci" onClick={handleCheckInClick} disabled={!canUpdate}
          className={canUpdate ? btnDefault : btnDisabled}>Check In</button>
      );
    } else {
      items.push(<span key="ci" className={pillRed}>{missingDataMessage || 'Missing Data'}</span>);
    }
  }

  if (checkInValue) {
    if (showCleared) {
      items.push(<button key="cl" disabled className={btnGreen}>Cleared</button>);
    } else if (showClearButton) {
      items.push(
        <button key="cl" onClick={handleClearClick} disabled={!canUpdate}
          className={canUpdate ? btnDefault : btnDisabled}>Clear</button>
      );
    }
  }

  if (category === 'pick-up-only' || category === 'combined-pick-up') {
    if (pickedUpValue) {
      items.push(<button key="pu" disabled className={btnGreen}>Picked Up</button>);
    } else if (showCleared || category === 'pick-up-only') {
      items.push(
        <button key="pu" onClick={handlePickUpClick} className={btnDefault}>Pick Up</button>
      );
    } else {
      items.push(<span key="pu" className={pillYellow}>Pending Pick Up</span>);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2"
      onClick={(e) => e.stopPropagation()}>
      {items}
      {errorMsg && <span className="w-full text-[11px] text-red-500 mt-0.5">{errorMsg}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// PIVOT TABLE CALENDAR COMPONENT
// ─────────────────────────────────────────────
interface CalendarPivotProps {
  records: Record[];
  appointmentFields: {
    timeField: Field | undefined;
    clientField: Field | undefined;
    typeField: Field | undefined;
    saNameField: Field | undefined;
    altLeadLinkField: Field | undefined;
    roomLinkField: Field | undefined;
    endTimeField: Field | undefined;
    apptNameField: Field | undefined;
  };
  clientNameById: Map<string, string>;
  clientStageById: Map<string, string>;
  stageColorByName: Map<string, string>;
  apptTypeColorByName: Map<string, string>;
  studioFilteredRoomOptions: Array<{ id: string; name: string }>;
  selectedDate: Date;
  appointmentsTable: Table;
  onSelectRecord: (recordId: string) => void;
  onRoomChange: (recordId: string, roomId: string | null) => Promise<void>;
  checkInField: Field | null;
  clearedField: Field | null;
  pickedUpField: Field | null;
  isClearingByRecord: { [key: string]: boolean };
  clearErrorByRecord: { [key: string]: string };
  onCheckIn: (record: Record) => void;
  onClear: (record: Record) => void;
  onPickUp: (record: Record) => void;
}

const UNCATEGORIZED_ID = '__uncategorized__';

function CalendarPivot({
  records,
  appointmentFields,
  clientNameById,
  clientStageById,
  stageColorByName,
  apptTypeColorByName,
  studioFilteredRoomOptions,
  selectedDate,
  appointmentsTable,
  onSelectRecord,
  onRoomChange,
  checkInField,
  clearedField,
  pickedUpField,
  isClearingByRecord,
  clearErrorByRecord,
  onCheckIn,
  onClear,
  onPickUp,
}: CalendarPivotProps) {
  const dateStr = formatDateForComparison(selectedDate);

  const dayRecords = records.filter((r) => {
    const timeField = appointmentFields.timeField;
    if (!timeField) return false;
    const tv = r.getCellValue(timeField) as string | null;
    if (!tv) return false;
    return formatDateForComparison(new Date(tv)) === dateStr;
  });

  // Collect filled hours
  const hours = new Set<number>();
  dayRecords.forEach((r) => {
    const timeField = appointmentFields.timeField;
    if (timeField) {
      const tv = r.getCellValue(timeField) as string | null;
      if (tv) hours.add(new Date(tv).getHours());
    }
  });
  const sortedHours = Array.from(hours).sort((a, b) => a - b);

  // Check if any day records are missing a room assignment
  const hasUncategorizedRecords = dayRecords.some((r) => {
    const roomLinkField = appointmentFields.roomLinkField;
    if (!roomLinkField) return true;
    const roomLinked = r.getCellValue(roomLinkField) as Array<{ id: string }> | null;
    return !roomLinked || roomLinked.length === 0;
  });

  // Columns = studio-filtered rooms + Uncategorized (only if needed)
  const displayColumns: Array<{ id: string; name: string }> = [
    ...studioFilteredRoomOptions,
    ...(hasUncategorizedRecords ? [{ id: UNCATEGORIZED_ID, name: 'Uncategorized' }] : []),
  ];

  // Build pivot: hour → columnId → Record[]
  const pivot = new Map<number, Map<string, Record[]>>();
  dayRecords.forEach((r) => {
    const timeField = appointmentFields.timeField;
    const roomLinkField = appointmentFields.roomLinkField;
    if (!timeField) return;
    const tv = r.getCellValue(timeField) as string | null;
    if (!tv) return;
    const hour = new Date(tv).getHours();
    const roomLinked = roomLinkField
      ? (r.getCellValue(roomLinkField) as Array<{ id: string }> | null)
      : null;
    const roomId = roomLinked?.[0]?.id ?? UNCATEGORIZED_ID;
    if (!pivot.has(hour)) pivot.set(hour, new Map());
    const hourMap = pivot.get(hour)!;
    if (!hourMap.has(roomId)) hourMap.set(roomId, []);
    hourMap.get(roomId)!.push(r);
  });

  const [draggedRecordId, setDraggedRecordId] = useState<string | null>(null);

  const handleDrop = async (toRoomId: string) => {
    if (!draggedRecordId) return;
    try {
      await onRoomChange(draggedRecordId, toRoomId === UNCATEGORIZED_ID ? null : toRoomId);
    } catch (err) { console.error('Room drop failed:', err); }
    finally { setDraggedRecordId(null); }
  };

  return (
    <div className="overflow-auto h-full">
      <table className="border-collapse w-full">
        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-white/5">
          <tr>
            <th className="border border-gray-200 dark:border-[#38322A] px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide w-20 bg-gray-50 dark:bg-white/5">
              Time
            </th>
            {displayColumns.map((col) => (
              <th key={col.id}
                className="border border-gray-200 dark:border-[#38322A] px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide min-w-[280px] bg-gray-50 dark:bg-white/5">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedHours.map((hour) => (
            <tr key={hour}>
              <td className="border border-gray-200 dark:border-[#38322A] px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium align-top whitespace-nowrap bg-gray-50 dark:bg-white/5">
                {String(hour).padStart(2, '0')}:00
              </td>
              {displayColumns.map((col) => {
                const colRecords = pivot.get(hour)?.get(col.id) ?? [];
                return (
                  <td key={`${hour}-${col.id}`}
                    className="border border-gray-200 dark:border-[#38322A] p-2 align-top min-w-[280px]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(col.id)}
                  >
                    <div className="flex flex-col gap-2">
                      {colRecords.map((record) => {
                        // Issue #32/#45 — Room/SA no longer block Check In; only
                        // a missing Client does (nothing to check in otherwise).
                        const hasRequiredData = !!(
                          appointmentFields.clientField && record.getCellValueAsString(appointmentFields.clientField)
                        );
                        const timeValue = appointmentFields.timeField
                          ? (record.getCellValue(appointmentFields.timeField) as string | null)
                          : null;
                        const endTimeValue = appointmentFields.endTimeField
                          ? (record.getCellValue(appointmentFields.endTimeField) as string | null)
                          : null;
                        const startTime = timeValue ? new Date(timeValue) : null;
                        const endTime = endTimeValue ? new Date(endTimeValue) : null;
                        const showCheckInButton = isWithin30MinBefore(startTime);
                        const showClearButton = isWithin30MinBefore(endTime);

                        return (
                          <CalendarCardCompact
                            key={record.id}
                            record={record}
                            clientNameById={clientNameById}
                            clientStageById={clientStageById}
                            stageColorByName={stageColorByName}
                            apptTypeColorByName={apptTypeColorByName}
                            appointmentFields={appointmentFields}
                            appointmentsTable={appointmentsTable}
                            checkInField={checkInField}
                            clearedField={clearedField}
                            pickedUpField={pickedUpField}
                            isClearingByRecord={isClearingByRecord}
                            clearErrorByRecord={clearErrorByRecord}
                            hasRequiredData={hasRequiredData}
                            showCheckInButton={showCheckInButton}
                            showClearButton={showClearButton}
                            onSelectRecord={onSelectRecord}
                            onDragStart={(id) => setDraggedRecordId(id)}
                            onCheckIn={onCheckIn}
                            onClear={onClear}
                            onPickUp={onPickUp}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CalendarCardCompactProps {
  record: Record;
  clientNameById: Map<string, string>;
  clientStageById: Map<string, string>;
  stageColorByName: Map<string, string>;
  apptTypeColorByName: Map<string, string>;
  appointmentFields: {
    timeField: Field | undefined;
    clientField: Field | undefined;
    typeField: Field | undefined;
    saNameField: Field | undefined;
    altLeadLinkField: Field | undefined;
    roomLinkField: Field | undefined;
    apptNameField: Field | undefined;
  };
  appointmentsTable: Table;
  checkInField: Field | null;
  clearedField: Field | null;
  pickedUpField: Field | null;
  isClearingByRecord: { [key: string]: boolean };
  clearErrorByRecord: { [key: string]: string };
  hasRequiredData: boolean;
  showCheckInButton: boolean;
  showClearButton: boolean;
  onSelectRecord: (recordId: string) => void;
  onDragStart: (recordId: string) => void;
  onCheckIn: (record: Record) => void;
  onClear: (record: Record) => void;
  onPickUp: (record: Record) => void;
}

function CalendarCardCompact({
  record,
  clientNameById,
  clientStageById,
  stageColorByName,
  apptTypeColorByName,
  appointmentFields,
  appointmentsTable,
  checkInField,
  clearedField,
  pickedUpField,
  isClearingByRecord,
  clearErrorByRecord,
  hasRequiredData,
  showCheckInButton,
  showClearButton,
  onSelectRecord,
  onDragStart,
  onCheckIn,
  onClear,
  onPickUp,
}: CalendarCardCompactProps) {
  const isBlock = isBlockTime(record, appointmentFields.clientField);
  const clientLinked = appointmentFields.clientField
    ? (record.getCellValue(appointmentFields.clientField) as Array<{ id: string }> | null)
    : null;
  const clientId = clientLinked?.[0]?.id;
  const clientName = clientId ? clientNameById.get(clientId) : '—';
  const clientStage = clientId ? clientStageById.get(clientId) : null;

  const typeValue = appointmentFields.typeField
    ? record.getCellValueAsString(appointmentFields.typeField)
    : '';
  const saValue = appointmentFields.saNameField
    ? record.getCellValueAsString(appointmentFields.saNameField)
    : null;
  const altLeadValue = appointmentFields.altLeadLinkField
    ? record.getCellValueAsString(appointmentFields.altLeadLinkField)
    : null;
  const roomValue = appointmentFields.roomLinkField
    ? record.getCellValueAsString(appointmentFields.roomLinkField)
    : null;
  const apptNameRaw = appointmentFields.apptNameField
    ? record.getCellValue(appointmentFields.apptNameField)
    : null;
  const apptNameEntry = extractSelectValue(apptNameRaw);

  const shortType = getShortTypeLabel(typeValue);
  // #27 — Alterations Lead shown only when the appointment_type Type
  // (fldZO3rF3KOGxG0S5) is literally "Alterations" — not a substring match
  // on the compound type label, which would also match e.g. a category
  // bucket grouping "Final Fitting & Pick Up" under Alterations.
  const isAlterationsAppt = apptNameEntry?.name === 'Alterations';
  const showAltLead = isAlterationsAppt;

  // Pill colors resolved from the actual Airtable field options — no hardcoded per-value maps.
  const stageColorName = clientStage ? stageColorByName.get(clientStage) : undefined;
  const apptTypeColorName = apptNameEntry ? apptTypeColorByName.get(apptNameEntry.name) : undefined;
  const stagePillClasses = getCompactPillClassesForColor(stageColorName);
  const apptTypePillClasses = getCompactPillClassesForColor(apptTypeColorName);
  // Debug tooltips (temporary) — hover a chip to see exactly what color name
  // was resolved and from which field/value, to verify against Airtable.
  const stageColorDebug = `value: "${clientStage ?? ''}" | field: DF Clients.stage (fldLcxVZvI1rigBlh) | resolved color: ${stageColorName || 'none (falls back to gray)'} | choices loaded: ${stageColorByName.size}`;
  const apptTypeColorDebug = `value: "${apptNameEntry?.name ?? ''}" | color source: appointment_types.type field (fld5M3HgiIOycZfKJ) | resolved color: ${apptTypeColorName || 'none (falls back to gray)'} | choices loaded: ${apptTypeColorByName.size}`;

  // Issue #32/#45 — only a missing Client blocks Check In now; Room/SA/AL
  // are soft flags shown inline on the card body instead.
  const missingFieldLabels: string[] = [];
  if (!clientId) missingFieldLabels.push('Client');
  const missingDataMessage = formatMissingFieldsMessage(missingFieldLabels);

  if (isBlock) {
    return (
      <div
        draggable
        onDragStart={() => onDragStart(record.id)}
        onClick={() => onSelectRecord(record.id)}
        className="bg-[#F8F5EE] dark:bg-[#1B1813] border border-gray-300 dark:border-[#38322A] rounded-lg p-3 cursor-move transition-shadow relative min-h-[120px] flex flex-col items-center justify-center"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
      >
        <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 text-center">Blocked Time</div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(record.id)}
      onClick={() => onSelectRecord(record.id)}
      className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-3 cursor-move transition-shadow relative min-h-[120px] flex flex-col"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
    >
      {/* Stage / Appointment Type pills: top-right, stacked. A single-column
          grid auto-sizes to the widest label/pill across both, so the
          narrower chip stretches to match rather than clipping the wider one. */}
      <div className="absolute top-2.5 right-2.5 inline-grid grid-cols-1 gap-1.5 max-w-[60%]">
        {clientStage && (
          <div className="grid grid-cols-1 gap-0.5" title={stageColorDebug}>
            <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Stage:</span>
            <span className={stagePillClasses}>{clientStage}</span>
          </div>
        )}
        {apptNameEntry && (
          <div className="grid grid-cols-1 gap-0.5" title={apptTypeColorDebug}>
            <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Appointment Type:</span>
            <span className={apptTypePillClasses}>{apptNameEntry.name}</span>
          </div>
        )}
      </div>

      {/* Client name */}
      <div className="text-sm font-semibold text-gray-800 dark:text-[#F3EFE6] mb-1.5 pr-28">{clientName}</div>

      {/* Fields */}
      <div className="space-y-0.5">
        {saValue ? (
          <div className="text-xs text-gray-600 dark:text-gray-400">Sales Associate: {saValue}</div>
        ) : (
          <div className="text-xs text-gray-600 dark:text-gray-400">Sales Associate: <span className="text-[13px] font-medium text-orange-600 dark:text-orange-400">Must Assign</span></div>
        )}
        {showAltLead && (
          altLeadValue ? (
            <div className="text-xs text-gray-600 dark:text-gray-400">Alterations Lead: {altLeadValue}</div>
          ) : (
            <div className="text-xs text-gray-600 dark:text-gray-400">Alterations Lead: <span className="text-[13px] font-medium text-orange-600 dark:text-orange-400">Must Assign</span></div>
          )
        )}
        {roomValue ? (
          <div className="text-xs text-gray-600 dark:text-gray-400">Room: {roomValue}</div>
        ) : (
          <div className="text-xs text-gray-600 dark:text-gray-400">Room: <span className="text-[13px] font-medium text-orange-600 dark:text-orange-400">Must Assign</span></div>
        )}
      </div>

      <CalendarActionButtons
        record={record}
        appointmentsTable={appointmentsTable}
        checkInField={checkInField}
        clearedField={clearedField}
        pickedUpField={pickedUpField}
        isClearingByRecord={isClearingByRecord}
        clearErrorByRecord={clearErrorByRecord}
        onCheckIn={onCheckIn}
        onClear={onClear}
        onPickUp={onPickUp}
        apptTypeLabel={typeValue}
        hasRequiredData={hasRequiredData}
        missingDataMessage={missingDataMessage}
        showCheckInButton={showCheckInButton}
        showClearButton={showClearButton}
      />
    </div>
  );
}

interface EditableCellProps {
  value: string | null;
  onSave: (newValue: string) => Promise<void>;
  isSaving?: boolean;
  canEdit: boolean;
  fieldId?: string;
  readOnly?: boolean;
}

function EditableCell({ value, onSave, isSaving, canEdit, fieldId, readOnly }: EditableCellProps) {
  const effectiveReadOnly = readOnly || isFieldReadOnlyBySource(fieldId);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      console.error('Edit failed:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="text-sm px-2 py-1 border border-[#D97706] rounded outline-none w-full bg-[#FEF3C7] dark:bg-[#3A2E12]"
      />
    );
  }

  return (
    <div 
      onClick={() => !effectiveReadOnly && canEdit && setIsEditing(true)}
      className={`text-gray-600 dark:text-gray-400 ${!effectiveReadOnly && canEdit ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 px-2 py-1 rounded' : ''}`}
    >
      {value || '—'}
    </div>
  );
}

interface EditableLinkedRecordProps {
  value: string | null;
  recordId: string | null;
  onSave: (recordId: string | null, recordName: string) => Promise<void>;
  options: Array<{ id: string; name: string }>;
  canEdit: boolean;
  fieldId?: string;
  readOnly?: boolean;
}

function EditableLinkedRecord({
  value,
  recordId,
  onSave,
  options,
  canEdit,
  fieldId,
  readOnly,
}: EditableLinkedRecordProps) {
  const effectiveReadOnly = readOnly || isFieldReadOnlyBySource(fieldId);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsEditing(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (isEditing && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isEditing]);

  const handleSelect = async (id: string | null, name: string) => {
    try {
      await onSave(id, name);
      setIsEditing(false);
      setSearch('');
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const sortedOptions = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const filteredOptions = search.trim()
    ? sortedOptions.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    : sortedOptions;

  if (isEditing) {
    return (
      <div ref={containerRef} className="relative">
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg w-[240px] no-scrollbar" style={{ overflow: 'visible', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full text-sm px-2 py-1 border border-gray-200 dark:border-[#38322A] rounded outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]"
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto py-1 no-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No results</div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id, opt.name)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    recordId === opt.id ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#B45F04] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  {opt.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => !effectiveReadOnly && canEdit && setIsEditing(true)}
      className={`px-3 py-2 rounded-md border transition-colors ${
        !effectiveReadOnly && canEdit 
          ? 'border-gray-300 dark:border-white/15 bg-white dark:bg-[#25211A] hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer' 
          : 'border-gray-200 dark:border-[#38322A] bg-gray-50 dark:bg-white/5'
      } text-gray-600 dark:text-gray-400`}
    >
      {value || '—'}
    </div>
  );
}

interface DetailDrawerProps {
  record: Record;
  appointmentsTable: Table;
  clientsTable: Table;
  clientById: Map<string, Record>;
  allAppointmentRecords: Record[]; // #28 — for counting consultations/alterations
  roomOptions: Array<{ id: string; name: string }>;
  roomRecords: Record[] | null;
  roomsTable: Table | undefined;
  saOptions: Array<{ id: string; name: string }>;
  altLeadOptions: Array<{ id: string; name: string }>;
  onClose: () => void;
  clearErrorByRecord: { [key: string]: string };
  roomLinkField: Field | null;
  studioNameField: Field | null;
  altLeadLinkField: Field | null;
  clientStageById: Map<string, string>;
  stageColorByName: Map<string, string>;
  ordersTable: Table | undefined;
  orderRecords: Record[] | null;
  adjTable: Table | undefined;
  adjRecords: Record[];
  itemsTable: Table | undefined;
  itemsRecords: Record[];
  syncLogTable: Table | undefined;
  syncLogRecords: Record[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #54 — Order detail page helpers, ported from fulfillment.tsx. IMPORTANT:
// this Order detail page (PickUpOrdersTable + OrderDetailModal + OrderItemDetailModal
// below) is meant to stay semi-identical to fulfillment.tsx's own Order detail
// page, within the scope agreed for Appointments (Pickup Readiness fully
// editable; Fulfillment section: Delivery Method read-only — changed via the
// table's own Order Status action instead — Tax Confirmed editable, Tracking
// Number/Carrier read-only, Client Notified/Delivery Status/Picked Status
// hidden entirely; Order Items read-only; Order Adjustments read-only with no
// "Add Adjustment" capability; Financials and Sync Change Log read-only). If
// you change one file's version, check whether the same change applies to
// the other's — they intentionally do not share imports (project convention),
// so this is a manual sync, not automatic.

let _writeQueue = Promise.resolve();
function queueWrite(fn: () => Promise<void>) {
  const next = _writeQueue.then(fn);
  _writeQueue = next.then(() => {}, () => {});
  return next;
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}
function formatOrderDate(val: string | null): string {
  if (!val) return '—';
  try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(val)); }
  catch { return '—'; }
}
function formatDateTime(val: string | null): string {
  if (!val) return '—';
  try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(val)); }
  catch { return '—'; }
}

type OrderPillVariant = 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'orange';
function OrderPill({ children, variant }: { children: React.ReactNode; variant: OrderPillVariant }) {
  const cls: Record<OrderPillVariant, string> = {
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

function ToggleButton({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
        disabled && !checked ? 'opacity-50' : ''} ${disabled ? 'cursor-not-allowed' : ''} ${
        checked ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/40 shadow-sm'
                : 'bg-white dark:bg-[#1e1d1b] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 shadow-sm hover:border-gray-300 dark:hover:border-white/20'}`}>
      {checked && <CheckCircleIcon size={13} />}{label}
    </button>
  );
}

// Pickup Readiness Gate — data-resolution helpers, distinguishing "field
// legitimately false" from "could not be read" (missing field, unreachable
// record, or — for lookups through the client link — an empty lookup array
// caused by a broken/missing linked record). Same as fulfillment.tsx.
type Resolved<T> = { value: T; resolved: boolean };
function resolveLookupBool(raw: unknown): Resolved<boolean> {
  if (Array.isArray(raw)) return raw.length === 0 ? { value: false, resolved: false } : { value: !!raw[0], resolved: true };
  return { value: !!raw, resolved: true };
}
function resolveLookupNum(raw: unknown): Resolved<number> {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return { value: 0, resolved: false };
    const v = raw[0]; return { value: typeof v === 'number' ? v : 0, resolved: true };
  }
  return { value: typeof raw === 'number' ? raw : 0, resolved: true };
}

type ReadinessSeverity = 'green' | 'yellow' | 'red' | 'unavailable';
function getReadinessSeverity(checksResolved: boolean, checksPassed: boolean, progressResolved: boolean, progress: number): ReadinessSeverity {
  if (!checksResolved) return 'unavailable';
  if (checksPassed) return 'green';
  if (!progressResolved) return 'unavailable';
  return progress > 0 ? 'red' : 'yellow';
}
const READINESS_UNAVAILABLE_TOOLTIP = 'Unavailable — could not load — client or order record not found. Refresh or contact support.';

function ReadinessDot({ severity, label }: { severity: ReadinessSeverity; label: string }) {
  const cls: Record<ReadinessSeverity, string> = {
    green:  'bg-green-500',
    yellow: 'bg-yellow-400',
    red:    'bg-red-500',
    unavailable: 'bg-gray-400 dark:bg-gray-500',
  };
  return (
    <span className="inline-flex items-center" title={label} aria-label={label} role="img">
      <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls[severity]}`} />
    </span>
  );
}

function OrderMiniTable({ headers, rows, onRowClick, emptyText = 'None' }: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  onRowClick?: (i: number) => void;
  emptyText?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">{emptyText}</td></tr>
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

function OrderConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onCancel, 200); }, [onCancel]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [requestClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible?1:0 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[480px] shadow-2xl overflow-hidden transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
        onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <p className="text-base font-semibold text-gray-900 dark:text-[#F5F3EF] mb-1.5">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
          <button type="button" onClick={requestClose}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Issue #54 — read-only detail page for a single order_item (AM-synced,
// never editable). Ported from fulfillment.tsx's OrderItemDetailModal.
function OrderItemDetailModal({ record, itemsTable, onClose }: {
  record: Record; itemsTable: Table; onClose: () => void;
}) {
  const getStr = (fid: string): string => { try { return record.getCellValueAsString(itemsTable.getFieldIfExists(fid)!) ?? ''; } catch { return ''; } };
  const getNum = (fid: string): number | null => { try { const f = itemsTable.getFieldIfExists(fid); if (!f) return null; return record.getCellValue(f) as number | null; } catch { return null; } };
  const getDate = (fid: string): string | null => { try { const f = itemsTable.getFieldIfExists(fid); if (!f) return null; return record.getCellValue(f) as string | null; } catch { return null; } };
  const getAttachmentUrl = (fid: string): string | null => {
    const f = itemsTable.getFieldIfExists(fid); if (!f) return null;
    try {
      const raw = record.getCellValue(f);
      const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const item of arr) {
        const candidate = Array.isArray(item) ? item[0] : item;
        if (candidate && typeof candidate === 'object' && 'url' in candidate) return (candidate as { url: string }).url;
      }
      return null;
    } catch { return null; }
  };

  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [requestClose]);

  const amId          = getStr(ORDER_ITEMS_FIELD_IDS.AM_ORDER_ITEM_ID);
  const styleName     = getStr(ORDER_ITEMS_FIELD_IDS.STYLE);
  const nameIfNoStyle = getStr(ORDER_ITEMS_FIELD_IDS.NAME_IF_NO_STYLE);
  const displayStyle  = styleName || nameIfNoStyle || '—';
  const amount        = getNum(ORDER_ITEMS_FIELD_IDS.AMOUNT);
  const quantity       = getNum(ORDER_ITEMS_FIELD_IDS.QUANTITY);
  const qtyAllocated   = getNum(ORDER_ITEMS_FIELD_IDS.QUANTITY_ALLOCATED);
  const qtyPicked      = getNum(ORDER_ITEMS_FIELD_IDS.QUANTITY_PICKED);
  const qtyShipped     = getNum(ORDER_ITEMS_FIELD_IDS.QUANTITY_SHIPPED);
  const qtyOpen        = getNum(ORDER_ITEMS_FIELD_IDS.QUANTITY_OPEN);
  const stylePhotoUrl  = getAttachmentUrl(ORDER_ITEMS_FIELD_IDS.STYLE_PHOTO);

  const fieldsToShow: Array<[string, React.ReactNode]> = [
    ['AM Order Item ID', amId || '—'],
    ['Style', displayStyle],
    ['Style Photo (from DF Styles)', stylePhotoUrl
      ? <img src={stylePhotoUrl} alt={displayStyle} className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-white/10" />
      : <span className="text-gray-400 dark:text-gray-500">—</span>],
    ['Attr 2', getStr(ORDER_ITEMS_FIELD_IDS.ATTR_2) || '—'],
    ['Attr 3', getStr(ORDER_ITEMS_FIELD_IDS.ATTR_3) || '—'],
    ['Size', getStr(ORDER_ITEMS_FIELD_IDS.SIZE) || '—'],
    ['Amount', formatCurrency(amount)],
    ['Quantity', quantity ?? '—'],
    ['Quantity Allocated', qtyAllocated ?? '—'],
    ['Quantity Picked', qtyPicked ?? '—'],
    ['Quantity Shipped', qtyShipped ?? '—'],
    ['Quantity Open', qtyOpen ?? '—'],
    ['Due Date', formatOrderDate(getDate(ORDER_ITEMS_FIELD_IDS.DUE_DATE))],
    ['Description', getStr(ORDER_ITEMS_FIELD_IDS.DESCRIPTION) || '—'],
    ['Order Date', formatOrderDate(getDate(ORDER_ITEMS_FIELD_IDS.ORDER_DATE))],
  ];

  const lbl = 'text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible?1:0 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <button onClick={requestClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"><ArrowLeftIcon size={16} /></button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide mb-0.5">Order Item</p>
            <p className="text-base font-semibold text-gray-900 dark:text-[#F3EFE6] truncate">{amId || 'Item Detail'}</p>
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex items-center gap-2">
          <InfoIcon size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Data synced from Apparel Magic — read only.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-4">
            {fieldsToShow.map(([label, value]) => (
              <div key={label}>
                <span className={lbl}>{label}</span>
                <p className="text-sm text-gray-700 dark:text-gray-200">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Issue #54 — the Order detail page, opened by clicking a row in
// PickUpOrdersTable below. Scoped per Axel's spec (see the sync-comment
// above): Pickup Readiness fully editable; Fulfillment section shows
// Delivery Method/Tracking Number/Carrier read-only, Tax Confirmed editable,
// Client Notified/Delivery Status/Picked Status hidden; Order Items and
// Order Adjustments read-only (no Add Adjustment); Financials and Sync
// Change Log read-only. Ported from fulfillment.tsx's OrderDetailModal —
// keep the two in sync.
function OrderDetailModal({ record, orderTable, adjTable, adjRecords, itemsTable, itemsRecords, syncLogTable, syncLogRecords, onClose }: {
  record: Record; orderTable: Table;
  adjTable: Table | undefined; adjRecords: Record[]; itemsTable: Table | undefined; itemsRecords: Record[];
  syncLogTable: Table | undefined; syncLogRecords: Record[]; onClose: () => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  const getStr = (fid: string): string => { try { return record.getCellValueAsString(orderTable.getFieldIfExists(fid)!) ?? ''; } catch { return ''; } };
  const getNum = (fid: string): number | null => { try { const f = orderTable.getFieldIfExists(fid); if (!f) return null; return record.getCellValue(f) as number | null; } catch { return null; } };
  const getSel = (fid: string): string => { try { const f = orderTable.getFieldIfExists(fid); if (!f) return ''; const v = record.getCellValue(f) as { name: string } | null; return v?.name ?? ''; } catch { return ''; } };
  const getBool = (fid: string): boolean => { try { const f = orderTable.getFieldIfExists(fid); if (!f) return false; return !!(record.getCellValue(f) as boolean | null); } catch { return false; } };
  const getBoolOrError = (fid: string): Resolved<boolean> => {
    const f = orderTable.getFieldIfExists(fid); if (!f) return { value: false, resolved: false };
    try { return resolveLookupBool(record.getCellValue(f)); } catch { return { value: false, resolved: false }; }
  };
  const getNumOrError = (fid: string): Resolved<number> => {
    const f = orderTable.getFieldIfExists(fid); if (!f) return { value: 0, resolved: false };
    try { return resolveLookupNum(record.getCellValue(f)); } catch { return { value: 0, resolved: false }; }
  };
  const getSelOrError = (fid: string): Resolved<string> => {
    const f = orderTable.getFieldIfExists(fid); if (!f) return { value: '', resolved: false };
    try { const v = record.getCellValue(f) as { name: string } | null; return { value: v?.name ?? '', resolved: true }; }
    catch { return { value: '', resolved: false }; }
  };

  const delivMethod = getSel(ORDER_FIELD_IDS.DELIVERY_METHOD);
  const trackingNum = getStr(ORDER_FIELD_IDS.TRACKING_NUMBER);
  const carrier     = getSel(ORDER_FIELD_IDS.CARRIER);
  const [pickupReleased, setPickupReleased] = useState(() => getBool(ORDER_FIELD_IDS.PICKUP_RELEASED));
  const [releaseError,   setReleaseError]   = useState('');
  const [taxConfirmed,   setTaxConfirmed]   = useState(() => getBool(ORDER_FIELD_IDS.TAX_CONFIRMED));
  const [showTaxConfirmPrompt, setShowTaxConfirmPrompt] = useState(false);

  // Pickup Readiness Gate — this order's own three checks + progress
  const taxConfirmedRes           = getBoolOrError(ORDER_FIELD_IDS.TAX_CONFIRMED);
  const clientAddressConfirmedRes = getBoolOrError(ORDER_FIELD_IDS.CLIENT_ADDRESS_CONFIRMED);
  const clientHoldReleasedRes     = getBoolOrError(ORDER_FIELD_IDS.CLIENT_HOLD_RELEASED);
  const fulfillmentProgressRes    = getNumOrError(ORDER_FIELD_IDS.FULFILLMENT_PROGRESS_PERCENTAGE);
  const clientAddressConfirmed = clientAddressConfirmedRes.value;
  const clientHoldReleased     = clientHoldReleasedRes.value;
  const fulfillmentProgress    = fulfillmentProgressRes.value;

  const orderNumber = getNum(ORDER_FIELD_IDS.SHOPIFY_ORDER_NUMBER);
  const amOrderNum  = getNum(ORDER_FIELD_IDS.AM_ORDER_NUMBER);
  const subtotal    = getNum(ORDER_FIELD_IDS.SUBTOTAL);
  const shipping    = getNum(ORDER_FIELD_IDS.SHIPPING);
  const taxes       = getNum(ORDER_FIELD_IDS.TAXES);
  const total       = getNum(ORDER_FIELD_IDS.TOTAL);
  const adjTotalField = getNum(ORDER_FIELD_IDS.ADJUSTED_TOTAL);
  const payStatusRes = getSelOrError(ORDER_FIELD_IDS.PAYMENT_STATUS);
  const store       = getSel(ORDER_FIELD_IDS.STORE);
  const holdReason     = getStr(ORDER_FIELD_IDS.HOLD_REASON);
  const holdShipDate   = getStr(ORDER_FIELD_IDS.HOLD_SHIPMENT_DATE);

  const isShip = delivMethod.toLowerCase().includes('ship');

  const saveTracked = useCallback((fid: string, value: unknown): Promise<void> => {
    const f = orderTable.getFieldIfExists(fid);
    if (!f) return Promise.reject(new Error(`Field ${fid} not found`));
    return queueWrite(() => orderTable.updateRecordAsync(record, { [f.id]: value }));
  }, [orderTable, record]);

  const requiredChecksResolved = taxConfirmedRes.resolved && clientAddressConfirmedRes.resolved && clientHoldReleasedRes.resolved && payStatusRes.resolved;
  const unmetReleaseReasons: string[] = [];
  if (!requiredChecksResolved) unmetReleaseReasons.push('Cannot verify readiness — data unavailable');
  if (taxConfirmedRes.resolved && !taxConfirmed) unmetReleaseReasons.push('Tax not confirmed');
  if (clientAddressConfirmedRes.resolved && !clientAddressConfirmed) unmetReleaseReasons.push('Address not confirmed');
  if (clientHoldReleasedRes.resolved && !clientHoldReleased) unmetReleaseReasons.push('Client is on hold');
  if (payStatusRes.resolved && payStatusRes.value === 'Unpaid') unmetReleaseReasons.push('Payment Status is Unpaid');
  const canRelease = unmetReleaseReasons.length === 0;

  const handleTogglePickupReleased = (v: boolean) => {
    if (v && !canRelease) { setReleaseError(`Cannot release pickup — ${unmetReleaseReasons.join(', ')}.`); return; }
    setReleaseError('');
    const prior = pickupReleased;
    setPickupReleased(v);
    saveTracked(ORDER_FIELD_IDS.PICKUP_RELEASED, v)
      .then(() => setReleaseError(''))
      .catch(() => {
        setPickupReleased(prior);
        setReleaseError(`Could not save — pickup was not ${v ? 'released' : 'unreleased'}. Try again.`);
      });
  };

  // Once confirmed, tax_confirmed is locked — the toggle itself is disabled when checked.
  const handleToggleTaxConfirmed = (v: boolean) => {
    if (taxConfirmed) return;
    if (v) { setShowTaxConfirmPrompt(true); return; }
    const prior = taxConfirmed;
    setTaxConfirmed(v);
    saveTracked(ORDER_FIELD_IDS.TAX_CONFIRMED, v)
      .then(() => setReleaseError(''))
      .catch(() => {
        setTaxConfirmed(prior);
        setReleaseError('Could not save — tax confirmation was not saved. Try again.');
      });
  };
  const confirmTaxConfirmed = () => {
    setShowTaxConfirmPrompt(false);
    setTaxConfirmed(true);
    saveTracked(ORDER_FIELD_IDS.TAX_CONFIRMED, true)
      .then(() => setReleaseError(''))
      .catch(() => {
        setTaxConfirmed(false);
        setReleaseError('Could not save — tax was not confirmed. Try again.');
      });
  };

  const linkedAdjIds = useMemo(() => {
    try {
      const f = orderTable.getFieldIfExists(ORDER_FIELD_IDS.ORDER_ADJUSTMENTS); if (!f) return new Set<string>();
      const links = record.getCellValue(f) as Array<{ id: string }> | null;
      return new Set((links ?? []).map(l => l.id));
    } catch { return new Set<string>(); }
  }, [record, orderTable]);
  const linkedAdjs = useMemo(() => adjRecords.filter(r => linkedAdjIds.has(r.id)), [adjRecords, linkedAdjIds]);

  const linkedSyncLogIds = useMemo(() => {
    try {
      const f = orderTable.getFieldIfExists(ORDER_FIELD_IDS.ORDER_SYNC_CHANGELOG); if (!f) return new Set<string>();
      const links = record.getCellValue(f) as Array<{ id: string }> | null;
      return new Set((links ?? []).map(l => l.id));
    } catch { return new Set<string>(); }
  }, [record, orderTable]);
  const linkedSyncLogs = useMemo(() => {
    const getChangedAt = (r: Record): string => {
      if (!syncLogTable) return '';
      try { const f = syncLogTable.getFieldIfExists(SYNC_LOG_FIELD_IDS.CHANGED_AT); if (!f) return ''; return (r.getCellValue(f) as string | null) ?? ''; } catch { return ''; }
    };
    return syncLogRecords
      .filter(r => linkedSyncLogIds.has(r.id))
      .sort((a, b) => getChangedAt(b).localeCompare(getChangedAt(a)));
  }, [syncLogRecords, linkedSyncLogIds, syncLogTable]);

  const getSyncLogStr = (r: Record, fid: string): string => {
    if (!syncLogTable) return '';
    try { return r.getCellValueAsString(syncLogTable.getFieldIfExists(fid)!) ?? ''; } catch { return ''; }
  };
  const getSyncLogNum = (r: Record, fid: string): number | null => {
    if (!syncLogTable) return null;
    try { const f = syncLogTable.getFieldIfExists(fid); if (!f) return null; return r.getCellValue(f) as number | null; } catch { return null; }
  };

  const getAdjNum = (r: Record, fid: string): number | null => {
    if (!adjTable) return null;
    try { const f = adjTable.getFieldIfExists(fid); if (!f) return null; return r.getCellValue(f) as number | null; } catch { return null; }
  };
  const getAdjSel = (r: Record, fid: string): string => {
    if (!adjTable) return '—';
    try { const f = adjTable.getFieldIfExists(fid); if (!f) return '—'; const v = r.getCellValue(f) as { name: string } | null; return v?.name ?? '—'; } catch { return '—'; }
  };

  const selectedItem = useMemo(() => selectedItemId ? itemsRecords.find(r => r.id === selectedItemId) ?? null : null, [selectedItemId, itemsRecords]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !selectedItem) requestClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [requestClose, selectedItem]);

  const lbl = 'text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide block mb-1';

  const linkedItems = useMemo(() => {
    if (!itemsTable) return [];
    const f = itemsTable.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.ORDER); if (!f) return [];
    return itemsRecords.filter(r => {
      try { const links = r.getCellValue(f) as Array<{ id: string }> | null; return (links ?? []).some(l => l.id === record.id); }
      catch { return false; }
    });
  }, [itemsRecords, itemsTable, record]);

  const getItemStr = (r: Record, fid: string): string => {
    if (!itemsTable) return '';
    try { return r.getCellValueAsString(itemsTable.getFieldIfExists(fid)!) ?? ''; } catch { return ''; }
  };
  const getItemNum = (r: Record, fid: string): number | null => {
    if (!itemsTable) return null;
    try { const f = itemsTable.getFieldIfExists(fid); if (!f) return null; return r.getCellValue(f) as number | null; } catch { return null; }
  };

  const itemRows: Array<Array<React.ReactNode>> = linkedItems.map(r => {
    const amId          = getItemStr(r, ORDER_ITEMS_FIELD_IDS.AM_ORDER_ITEM_ID);
    const styleName     = getItemStr(r, ORDER_ITEMS_FIELD_IDS.STYLE);
    const nameIfNoStyle = getItemStr(r, ORDER_ITEMS_FIELD_IDS.NAME_IF_NO_STYLE);
    const displayStyle  = styleName || nameIfNoStyle || '—';
    const amount        = getItemNum(r, ORDER_ITEMS_FIELD_IDS.AMOUNT);
    const quantity       = getItemNum(r, ORDER_ITEMS_FIELD_IDS.QUANTITY);
    const qtyPicked      = getItemNum(r, ORDER_ITEMS_FIELD_IDS.QUANTITY_PICKED);
    const qtyShipped     = getItemNum(r, ORDER_ITEMS_FIELD_IDS.QUANTITY_SHIPPED);
    const qtyOpen        = getItemNum(r, ORDER_ITEMS_FIELD_IDS.QUANTITY_OPEN);
    const isFulfilled = qtyOpen !== null
      ? qtyOpen === 0
      : ((quantity ?? 0) > 0 && (qtyPicked ?? 0) + (qtyShipped ?? 0) >= (quantity ?? 0));
    return [
      amId || '—',
      displayStyle,
      formatCurrency(amount),
      quantity ?? '—',
      <OrderPill variant={isFulfilled ? 'green' : 'yellow'}>{isFulfilled ? 'Fulfilled' : 'Pending'}</OrderPill>,
    ];
  });
  const handleItemRowClick = (i: number) => setSelectedItemId(linkedItems[i]?.id ?? null);

  const adjRows: Array<Array<React.ReactNode>> = linkedAdjs.map(r => {
    const ct  = getAdjSel(r, ADJ_FIELD_IDS.CHANGE_TYPE);
    const dir = getAdjSel(r, ADJ_FIELD_IDS.DIRECTION);
    const amt = getAdjNum(r, ADJ_FIELD_IDS.SIGNED_AMOUNT);
    const amtDisplay = amt === null ? '—' : (amt >= 0
      ? <span className="text-orange-600 dark:text-orange-400 font-medium">+{formatCurrency(amt)}</span>
      : <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(amt)}</span>);
    return [ct === '—' ? '—' : ct, dir && dir !== '—' ? <OrderPill variant={dir === 'Charge' ? 'orange' : 'green'}>{dir}</OrderPill> : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>, amtDisplay];
  });

  const syncLogRows: Array<Array<React.ReactNode>> = linkedSyncLogs.map(r => {
    const fieldChanged = getSyncLogStr(r, SYNC_LOG_FIELD_IDS.FIELD_CHANGED);
    const prevVal      = getSyncLogNum(r, SYNC_LOG_FIELD_IDS.PREVIOUS_VALUE);
    const newVal       = getSyncLogNum(r, SYNC_LOG_FIELD_IDS.NEW_VALUE);
    const reason       = getSyncLogStr(r, SYNC_LOG_FIELD_IDS.REASON);
    const changedAt    = getSyncLogStr(r, SYNC_LOG_FIELD_IDS.CHANGED_AT);
    return [
      fieldChanged || '—',
      formatCurrency(prevVal),
      formatCurrency(newVal),
      reason ? <span className="text-gray-500 dark:text-gray-400">{reason}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>,
      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(changedAt)}</span>,
    ];
  });

  if (selectedItem && itemsTable) {
    return <OrderItemDetailModal record={selectedItem} itemsTable={itemsTable} onClose={() => setSelectedItemId(null)} />;
  }

  return (
    <>
      {showTaxConfirmPrompt && (
        <OrderConfirmDialog
          title="Confirm Tax"
          message="Confirm tax for this order? This cannot be undone."
          confirmLabel="Confirm"
          onConfirm={confirmTaxConfirmed}
          onCancel={() => setShowTaxConfirmPrompt(false)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 transition-opacity duration-200 ease-out"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible?1:0 }}
        onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
        <div className="bg-white dark:bg-[#242220] rounded-2xl w-full max-w-[720px] max-h-[88vh] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out"
          style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
          onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
            <button onClick={requestClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"><ArrowLeftIcon size={16} /></button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide mb-0.5">Order</p>
              <p className="text-base font-semibold text-gray-900 dark:text-[#F3EFE6]">
                {orderNumber ? `#${orderNumber}` : '—'}{amOrderNum ? ` · AM ${amOrderNum}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {store && <OrderPill variant="gray">{store}</OrderPill>}
              {!payStatusRes.resolved && <OrderPill variant="gray">Unavailable</OrderPill>}
              {payStatusRes.resolved && payStatusRes.value && (
                <OrderPill variant={payStatusRes.value === 'Paid' ? 'green' : payStatusRes.value.includes('Partial') ? 'yellow' : 'red'}>{payStatusRes.value}</OrderPill>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <section>
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium block mb-3">Pickup Readiness</span>
              <div className="flex items-center gap-4 flex-wrap">
                {([
                  ['Tax', taxConfirmed, taxConfirmedRes.resolved],
                  ['Address', clientAddressConfirmed, clientAddressConfirmedRes.resolved],
                  ['Hold', clientHoldReleased, clientHoldReleasedRes.resolved],
                ] as [string, boolean, boolean][]).map(([label, passed, checkResolved]) => {
                  const severity = getReadinessSeverity(checkResolved, passed, fulfillmentProgressRes.resolved, fulfillmentProgress);
                  const dotLabel = severity === 'unavailable' ? `${label}: ${READINESS_UNAVAILABLE_TOOLTIP}` : `${label}: ${passed ? 'Passed' : 'Failed'}`;
                  return (
                    <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <ReadinessDot severity={severity} label={dotLabel} />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide">Pickup Released</span>
                  <ToggleButton checked={pickupReleased} disabled={!canRelease && !pickupReleased}
                    label={pickupReleased ? 'Released' : 'Not Released'}
                    onChange={handleTogglePickupReleased} />
                </div>
              </div>
              {!canRelease && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5">Blocked: {unmetReleaseReasons.join(', ')}.</p>
              )}
              {releaseError && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{releaseError}</p>}
              {clientHoldReleasedRes.resolved && !clientHoldReleased && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <OrderPill variant="red">On hold until {holdShipDate ? formatOrderDate(holdShipDate) : '—'}</OrderPill>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{holdReason || 'No reason provided'}</span>
                </div>
              )}
            </section>
            <div className="border-t border-gray-100 dark:border-white/5" />
            <section>
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium block mb-3">Fulfillment</span>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className={lbl}>Delivery Method</span>
                    <p className="text-sm text-gray-700 dark:text-gray-200 px-3 py-1.5">{delivMethod || '—'}</p>
                  </div>
                  <div>
                    <span className={lbl}>Tax Confirmed</span>
                    <ToggleButton checked={taxConfirmed} disabled={taxConfirmed}
                      label={taxConfirmed ? 'Confirmed' : 'Not Confirmed'}
                      onChange={handleToggleTaxConfirmed} />
                    {releaseError && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{releaseError}</p>}
                  </div>
                </div>
                {isShip && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className={lbl}>Tracking Number</span>
                      <p className="text-sm text-gray-700 dark:text-gray-200 px-3 py-1.5">{trackingNum || '—'}</p>
                    </div>
                    <div>
                      <span className={lbl}>Carrier</span>
                      <p className="text-sm text-gray-700 dark:text-gray-200 px-3 py-1.5">{carrier || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <div className="border-t border-gray-100 dark:border-white/5" />
            <section>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium">Order Items</span>
                {linkedItems.length > 0 && <span className="text-xs text-gray-400 dark:text-gray-500">({linkedItems.length})</span>}
              </div>
              <OrderMiniTable
                headers={['AM ID', 'Style', 'Amount', 'Quantity', 'Picked/Shipped']}
                rows={itemRows}
                onRowClick={handleItemRowClick}
              />
            </section>
            <div className="border-t border-gray-100 dark:border-white/5" />
            <section>
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium block mb-3">Order Adjustments</span>
              <OrderMiniTable
                headers={['Type', 'Direction', 'Amount']}
                rows={adjRows}
              />
            </section>
            <div className="border-t border-gray-100 dark:border-white/5" />
            <section>
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium block mb-3">Financials</span>
              <div className="grid grid-cols-4 gap-3">
                {([['Subtotal', subtotal], ['Shipping', shipping], ['Taxes', taxes], ['Total', total]] as [string, number | null][]).map(([label, val]) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(val)}</p>
                  </div>
                ))}
              </div>
              {adjTotalField !== null && (
                <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-amber-700 dark:text-amber-300">Adjusted Total</span>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(adjTotalField)}</span>
                </div>
              )}
            </section>
            <div className="border-t border-gray-100 dark:border-white/5" />
            <section>
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium block mb-3">Sync Change Log</span>
              <OrderMiniTable
                headers={['Field', 'Previous', 'New', 'Reason', 'Changed At']}
                rows={syncLogRows}
                emptyText="No synced price changes yet"
              />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

// Issue #54 — read-only Orders table for Pick Up appointments. Layout
// mirrors fulfillment.tsx's Shopify Orders inline table (border/rounded
// container, same column set minus Adjusted Total, which this page has no
// use for). Row click opens the shared OrderDetailModal above (semi-identical
// to fulfillment.tsx's, see the sync-comment on OrderDetailModal). The Order
// Status dropdown/confirm flow + Delivery Method change + Slack notification
// on the *table row itself* are still pending Cobalt's answers, see
// docs/appointments_pickup_orders_plan.md. Sort: pending pickup first,
// already-picked-up next, Ship orders last (informational either way).
function PickUpOrdersTable({
  clientsTable,
  linkedClientRecord,
  orderRecords,
  ordersTable,
  adjTable,
  adjRecords,
  itemsTable,
  itemsRecords,
  syncLogTable,
  syncLogRecords,
}: {
  clientsTable: Table;
  linkedClientRecord: Record;
  orderRecords: Record[] | null;
  ordersTable: Table | undefined;
  adjTable: Table | undefined;
  adjRecords: Record[];
  itemsTable: Table | undefined;
  itemsRecords: Record[];
  syncLogTable: Table | undefined;
  syncLogRecords: Record[];
}): React.ReactElement {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const clientOrdersField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_SHOPIFY_ORDERS);

  const clientOrders = useMemo(() => {
    if (!orderRecords || !clientOrdersField) return [];
    const linked = linkedClientRecord.getCellValue(clientOrdersField) as Array<{ id: string }> | null;
    const linkedIds = new Set((linked ?? []).map((l) => l.id));
    return orderRecords.filter((o) => linkedIds.has(o.id));
  }, [orderRecords, clientOrdersField, linkedClientRecord]);

  const rank = (o: Record): number => {
    const delivery = o.getCellValueAsString(ORDER_FIELD_IDS.DELIVERY_METHOD);
    const picked = o.getCellValueAsString(ORDER_FIELD_IDS.PICKED_STATUS);
    if (delivery === 'Ship') return 2;
    return picked === 'Full' ? 1 : 0; // pending pickup, then already picked up
  };
  const sortedOrders = [...clientOrders].sort((a, b) => rank(a) - rank(b));

  const selectedOrder = useMemo(
    () => selectedOrderId ? sortedOrders.find((o) => o.id === selectedOrderId) ?? null : null,
    [selectedOrderId, sortedOrders]
  );

  const payVariant = (pay: string): string => {
    if (pay === 'Paid') return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    if (pay.includes('Partial')) return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
  };
  const statusVariant = (s: string): string => {
    if (s === 'Closed') return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    if (s === 'Cancelled') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10';
  };
  const pillCls = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap';

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Orders</span>
        {sortedOrders.length > 0 && <span className="text-xs text-gray-400 dark:text-gray-500">({sortedOrders.length})</span>}
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              {['Order #', 'Payment', 'Delivery', 'Readiness', 'Total', 'Order Status'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedOrders.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">None</td></tr>
            ) : sortedOrders.map((o) => {
              const num = o.getCellValueAsString(ORDER_FIELD_IDS.SHOPIFY_ORDER_NUMBER);
              const pay = o.getCellValueAsString(ORDER_FIELD_IDS.PAYMENT_STATUS);
              const delivery = o.getCellValueAsString(ORDER_FIELD_IDS.DELIVERY_METHOD);
              const readiness = o.getCellValueAsString(ORDER_FIELD_IDS.PICKED_STATUS);
              const total = o.getCellValueAsString(ORDER_FIELD_IDS.TOTAL);
              const orderStatus = o.getCellValueAsString(ORDER_FIELD_IDS.ORDER_STATUS);
              return (
                <tr key={o.id} onClick={() => setSelectedOrderId(o.id)}
                  className="border-b border-gray-100 dark:border-white/5 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-[#F3EFE6]">{num ? `#${num}` : '—'}</td>
                  <td className="px-3 py-2.5"><span className={`${pillCls} ${payVariant(pay)}`}>{pay || '—'}</span></td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{delivery || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{readiness || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{total || '—'}</td>
                  <td className="px-3 py-2.5"><span className={`${pillCls} ${statusVariant(orderStatus)}`}>{orderStatus || '—'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">
        Changing Order Status/Delivery Method from here is coming soon — pending confirmation with Cobalt (see docs/appointments_pickup_orders_plan.md). Click a row to view its full detail page.
      </div>
      {selectedOrder && ordersTable && (
        <OrderDetailModal
          record={selectedOrder}
          orderTable={ordersTable}
          adjTable={adjTable}
          adjRecords={adjRecords}
          itemsTable={itemsTable}
          itemsRecords={itemsRecords}
          syncLogTable={syncLogTable}
          syncLogRecords={syncLogRecords}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}

function DetailDrawer({
  record,
  appointmentsTable,
  clientsTable,
  clientById,
  allAppointmentRecords,
  roomOptions,
  roomRecords,
  roomsTable,
  saOptions,
  altLeadOptions,
  onClose,
  clearErrorByRecord,
  roomLinkField,
  studioNameField,
  altLeadLinkField,
  clientStageById,
  stageColorByName,
  ordersTable,
  orderRecords,
  adjTable,
  adjRecords,
  itemsTable,
  itemsRecords,
  syncLogTable,
  syncLogRecords,
}: DetailDrawerProps) {
  const apptTypeField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_TYPE);
  const apptTimeField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_TIME);
  const saNameField = appointmentsTable.getFieldIfExists(FIELD_IDS.SA_NAME);
  const clientLinkField = appointmentsTable.getFieldIfExists(FIELD_IDS.CLIENT_LINK);
  const fullNameAcuityField = appointmentsTable.getFieldIfExists(FIELD_IDS.FULL_NAME_ACUITY);
  const favStylesField = appointmentsTable.getFieldIfExists(FIELD_IDS.FAV_STYLES);
  const samplesNotInNyField = appointmentsTable.getFieldIfExists(FIELD_IDS.SAMPLES_NOT_IN_NY);
  const apptStudioShortField = appointmentsTable.getFieldIfExists(FIELD_IDS.STUDIO_SHORT_NAME);

  const clientFirstNameField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_FIRST_NAME);
  const clientLastNameField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_LAST_NAME);
  const clientFullNameField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_FULL_NAME);
  const clientEmailField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_EMAIL);
  const clientPhoneField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_PHONE);
  const clientWeddingDisplayField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_WEDDING_DISPLAY);

  const typeLabel = apptTypeField ? record.getCellValueAsString(apptTypeField) : '';
  const pillClasses = getAppointmentTypePillClasses(typeLabel, 'md');
  const shortTypeLabel = getShortTypeLabel(typeLabel);

  const linkedClients = clientLinkField
    ? (record.getCellValue(clientLinkField) as Array<{ id: string }> | null)
    : null;
  const linkedClientId = linkedClients?.[0]?.id ?? null;
  const linkedClientRecord = linkedClientId ? clientById.get(linkedClientId) ?? null : null;

  const fullNameAcuity = fullNameAcuityField ? record.getCellValueAsString(fullNameAcuityField) : null;

  let displayName = 'Unknown Client';
  let firstName: string | null = null;
  let lastName: string | null = null;
  const studioName = studioNameField ? record.getCellValueAsString(studioNameField) : null;
  let email: string | null = null;
  let phone: string | null = null;
  let weddingDisplay = 'Wedding: —';

  if (linkedClientRecord) {
    firstName = clientFirstNameField ? linkedClientRecord.getCellValueAsString(clientFirstNameField) : null;
    lastName = clientLastNameField ? linkedClientRecord.getCellValueAsString(clientLastNameField) : null;
    const fullName = clientFullNameField ? linkedClientRecord.getCellValueAsString(clientFullNameField) : null;
    displayName = fullName || fullNameAcuity || 'Unknown Client';

    email = clientEmailField ? linkedClientRecord.getCellValueAsString(clientEmailField) : null;
    phone = clientPhoneField ? linkedClientRecord.getCellValueAsString(clientPhoneField) : null;

    const weddingDisplayRaw = clientWeddingDisplayField
      ? linkedClientRecord.getCellValueAsString(clientWeddingDisplayField)
      : null;
    const { text: weddingText, isRealDate } = formatWeddingDateDisplay(weddingDisplayRaw);

    if (weddingText) {
      weddingDisplay = isRealDate ? `Wedding: ${weddingText}` : `Wedding: ${weddingText} (approx.)`;
    }
  } else if (fullNameAcuity) {
    displayName = fullNameAcuity;
  }

  const apptTime = apptTimeField ? (record.getCellValue(apptTimeField) as string | null) : null;
  const studioShortValue = apptStudioShortField ? record.getCellValueAsString(apptStudioShortField) : null;
  const apptTimeZone = getTimeZoneForStudioShort(studioShortValue);
  let timeDisplay = '—';
  if (apptTime) {
    const startDate = new Date(apptTime);
    const durationMatch = typeLabel.match(/-\s*(\d+)\s*Minutes?\s*$/i);
    const durationMinutes = durationMatch ? parseInt(durationMatch[1] ?? '0', 10) : null;

    if (durationMinutes) {
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      timeDisplay = `${formatNYTime(startDate, apptTimeZone)} – ${formatNYTime(endDate, apptTimeZone)}`;
    } else {
      timeDisplay = formatNYTime(startDate, apptTimeZone);
    }
  }

  const roomValue = roomLinkField ? record.getCellValueAsString(roomLinkField) : null;
  const roomRecordId = roomLinkField ? (record.getCellValue(roomLinkField) as Array<{ id: string }> | null)?.[0]?.id ?? null : null;
  const saValue = saNameField ? record.getCellValueAsString(saNameField) : null;
  const altLeadValue = altLeadLinkField ? record.getCellValueAsString(altLeadLinkField) : null;
  const altLeadRecordId = altLeadLinkField ? (record.getCellValue(altLeadLinkField) as Array<{ id: string }> | null)?.[0]?.id ?? null : null;

  const clientSaLinkFieldRef = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_SA_LINK) ?? null;
  const saRecordId = linkedClientRecord && clientSaLinkFieldRef
    ? (linkedClientRecord.getCellValue(clientSaLinkFieldRef) as Array<{ id: string }> | null)?.[0]?.id ?? null
    : null;

  const canUpdate = appointmentsTable.hasPermissionToUpdateRecords();

  const handleSaveRoom = async (id: string | null, _name: string) => {
    if (!roomLinkField) return;
    await appointmentsTable.updateRecordAsync(record.id, {
      [roomLinkField.id]: id ? [{ id }] : null,
    });
  };

  const handleSaveSA = async (id: string | null, _name: string) => {
    if (!linkedClientRecord || !clientSaLinkFieldRef || !clientsTable?.hasPermissionToUpdateRecords()) return;
    await clientsTable.updateRecordAsync(linkedClientRecord.id, {
      [clientSaLinkFieldRef.id]: id ? [{ id }] : null,
    });
  };

  const handleSaveAltLead = async (id: string | null, _name: string) => {
    if (!altLeadLinkField) return;
    await appointmentsTable.updateRecordAsync(record.id, {
      [altLeadLinkField.id]: id ? [{ id }] : null,
    });
  };
  const favStylesValue = favStylesField ? record.getCellValueAsString(favStylesField) : null;
  const samplesNotInNyValue = samplesNotInNyField ? record.getCellValueAsString(samplesNotInNyField) : null;

  const canExpand = appointmentsTable.hasPermissionToExpandRecords();
  const errorMsg = clearErrorByRecord[record.id];
  const isNyStudio = studioName?.toLowerCase().includes('new york') || studioName?.toLowerCase().includes('tribeca');

  // Get fields needed for conditional rendering
  const isFirstVisitField = appointmentsTable.getFieldIfExists(FIELD_IDS.IS_FIRST_VISIT);
  const apptNameFieldDetail = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_NAME);
  const customizationField = appointmentsTable.getFieldIfExists(FIELD_IDS.CUSTOMIZATION_LOOKUP);
  const altNotesField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_ALT_NOTES);
  const apptPhotosField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_PHOTOS);
  const followUpField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_FOLLOW_UP);
  const bustField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_MEASUREMENTS_BUST);
  const waistField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_MEASUREMENTS_WAIST);
  const hipsField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_MEASUREMENTS_HIPS);
  const heightField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_MEASUREMENTS_HEIGHT);

  const clientStylistsField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_STYLISTS);
  const clientRtwSizeField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_RTW_SIZE);
  const clientRtwSizeManualField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_RTW_SIZE_MANUAL) ?? null;
  const clientRtwSizeDisplayField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_RTW_SIZE_DISPLAY) ?? null;
  const clientNextApptField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_NEXT_APPT);
  const clientLastApptField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_LAST_APPT);
  const clientApptRecordsField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_APPT_RECORDS);
  const clientFavStylesAcuityField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_FAV_STYLES_ACUITY);
  const clientPersonalNotesField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_PERSONAL_NOTES);
  const clientWeddingLocField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_WEDDING_LOC);
  const clientWeddingPlannerField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_WEDDING_PLANNER);
  const clientMeasurementsField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_MEASUREMENTS);
  const clientApptPhotosField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_APPT_PHOTOS);
  const clientInterestAltsField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_INTEREST_ALTS);
  const clientInterestM2mField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_INTEREST_M2M);
  const clientApptNotesField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_APPT_NOTES);
  const clientIsRushField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_IS_RUSH);

  // Determine scenario
  const isFirstVisit = isFirstVisitField ? record.getCellValue(isFirstVisitField) === true : false;
  const apptNameDetail = apptNameFieldDetail ? record.getCellValueAsString(apptNameFieldDetail) : '';
  const isFitPickUp = apptNameDetail?.includes('Fit Assessment & Pick Up') || apptNameDetail?.includes('Fit Assessment') || apptNameDetail?.includes('Pick Up');
  const isAlterations = apptNameDetail?.includes('Alterations') && !isFitPickUp;
  // Issue #54 — the Orders table is scoped to the same condition already
  // gating the Pick Up button (category, not the broader isFitPickUp match,
  // which also covers plain Fit Assessment appointments with no pickup).
  const apptCategory = getAppointmentCategory(typeLabel);
  const isPickUpAppt = apptCategory === 'pick-up-only' || apptCategory === 'combined-pick-up';

  // Determine if we should show Alterations Lead
  const clientStage = linkedClientId ? clientStageById.get(linkedClientId) : null;
  const showAltLeadField = isAlterations;

  // #28 — Appointment counts for this client (excluding current record)
  const apptCountsForClient = useMemo(() => {
    if (!linkedClientId || !allAppointmentRecords) return { consultations: 0, alterations: 0 };
    const clientLinkFieldRef = appointmentsTable.getFieldIfExists(FIELD_IDS.CLIENT_LINK);
    const apptNameFieldRef = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_NAME);
    let consultations = 0;
    let alterations = 0;
    allAppointmentRecords.forEach((r) => {
      if (r.id === record.id) return; // exclude current
      if (!clientLinkFieldRef) return;
      const linked = r.getCellValue(clientLinkFieldRef) as Array<{ id: string }> | null;
      if (linked?.[0]?.id !== linkedClientId) return;
      const name = apptNameFieldRef ? r.getCellValueAsString(apptNameFieldRef).toLowerCase() : '';
      if (name.includes('consultation')) consultations++;
      else if (name.includes('alterations')) alterations++;
    });
    return { consultations, alterations };
  }, [linkedClientId, allAppointmentRecords, record.id, appointmentsTable]);

  // #29 — Notes field state
  const apptNotesField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_NOTES);
  const [apptNotesValue, setApptNotesValue] = useState<string>(
    apptNotesField ? record.getCellValueAsString(apptNotesField) : ''
  );
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const handleSaveNotes = async (value: string) => {
    if (!apptNotesField || !appointmentsTable.hasPermissionToUpdateRecords()) return;
    setIsSavingNotes(true);
    try {
      await appointmentsTable.updateRecordAsync(record.id, { [apptNotesField.id]: value });
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Filter room options by studio_short_name matching
  const filteredRoomOptions = useMemo(() => {
    if (!roomRecords || !roomRecords.length) return roomOptions;
    if (!roomsTable || !roomOptions.length) return roomOptions;
    
    const apptStudioShortField = appointmentsTable.getFieldIfExists(FIELD_IDS.STUDIO_SHORT_NAME);
    const roomStudioShortField = roomsTable.getFieldIfExists(FIELD_IDS.ROOM_STUDIO_SHORT_NAME);
    
    if (!apptStudioShortField || !roomStudioShortField) return roomOptions;
    
    const apptStudioShort = record.getCellValueAsString(apptStudioShortField);
    if (!apptStudioShort) return roomOptions;
    
    return roomOptions
      .filter(option => {
        const roomRecord = roomRecords.find(r => r.id === option.id);
        if (!roomRecord) return false;
        const roomStudioShort = roomRecord.getCellValueAsString(roomStudioShortField);
        return roomStudioShort === apptStudioShort;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roomOptions, roomRecords, roomsTable, appointmentsTable, record]);

  const isBlock = isBlockTime(record, clientLinkField);

  if (isBlock) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#25211A]">
        <style>{GLOBAL_STYLES}</style>
        <div className="p-5 border-b border-gray-200 dark:border-[#38322A]">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <BlockTimePill />
                {studioName && <span className="text-[13px] text-gray-500 dark:text-gray-400">{studioName}</span>}
              </div>
            </div>
          </div>
          {errorMsg && <div className="mt-2 text-sm text-red-600">{errorMsg}</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 mt-2">
            Appointment details
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <DetailRow label="Time" fieldId={FIELD_IDS.APPT_TIME}>
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6] font-medium">{timeDisplay}</div>
            </DetailRow>
            <DetailRow label="Room">
              <EditableLinkedRecord
                value={roomValue}
                recordId={roomRecordId}
                onSave={handleSaveRoom}
                options={filteredRoomOptions}
                canEdit={canUpdate}
              />
            </DetailRow>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#25211A]">
      <style>{GLOBAL_STYLES}</style>
      <div className="p-5 border-b border-gray-200 dark:border-[#38322A]">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Row 1: Name + Studio + Stage pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[16px] font-semibold text-gray-800 dark:text-[#F3EFE6]">{displayName}</span>
              {studioName && <span className="text-[13px] text-gray-500 dark:text-gray-400">{studioName}</span>}
              {clientStage && <StagePill stage={clientStage} size="lg" color={stageColorByName.get(clientStage)} />}
            </div>

            {/* Row 2: Phone · Email · Wedding · SA inline */}
            {linkedClientRecord && (
              <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {phone && (
                  <span className="flex items-center gap-1">
                    <PhoneIcon size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <a href={`tel:${phone}`} className="text-sm text-[#D97706] dark:text-[#FBBF24] hover:underline">{phone}</a>
                  </span>
                )}
                {email && (
                  <span className="flex items-center gap-1">
                    <EnvelopeSimpleIcon size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <a href={`mailto:${email}`} className="text-sm text-[#D97706] dark:text-[#FBBF24] hover:underline">{email}</a>
                  </span>
                )}
                <span className="text-sm text-gray-600 dark:text-gray-400">{weddingDisplay}</span>
                {saValue && <span className="text-sm text-gray-600 dark:text-gray-400">SA: {saValue}</span>}
              </div>
            )}

          </div>
        </div>

        {errorMsg && <div className="mt-2 text-sm text-red-600">{errorMsg}</div>}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 mt-2">
          Appointment details
        </div>

        {/* #28 — Appointment counts */}
        {linkedClientId && (apptCountsForClient.consultations > 0 || apptCountsForClient.alterations > 0) && (
          <div className="flex items-center gap-3 mb-4">
            {apptCountsForClient.consultations > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                <span className="font-semibold">{apptCountsForClient.consultations}</span> consultation{apptCountsForClient.consultations !== 1 ? 's' : ''}
              </span>
            )}
            {apptCountsForClient.alterations > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                <span className="font-semibold">{apptCountsForClient.alterations}</span> alteration{apptCountsForClient.alterations !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <DetailRow label="Time" fieldId={FIELD_IDS.APPT_TIME}>
            <div className="text-sm text-gray-800 dark:text-[#F3EFE6] font-medium">{timeDisplay}</div>
          </DetailRow>
          <DetailRow label="Room">
            <EditableLinkedRecord
              value={roomValue}
              recordId={roomRecordId}
              onSave={handleSaveRoom}
              options={filteredRoomOptions}
              canEdit={canUpdate}
            />
          </DetailRow>
          <DetailRow label="Sales associate">
            <EditableLinkedRecord
              value={saValue}
              recordId={saRecordId}
              onSave={handleSaveSA}
              options={saOptions}
              canEdit={canUpdate && !!linkedClientRecord}
            />
          </DetailRow>
          {showAltLeadField && (
            <DetailRow label="Alteration lead">
              <EditableLinkedRecord
                value={altLeadValue}
                recordId={altLeadRecordId}
                onSave={handleSaveAltLead}
                options={altLeadOptions}
                canEdit={canUpdate}
              />
            </DetailRow>
          )}
        </div>

        {/* #29 — Appointment Notes (editable, all types) */}
        <div className="mt-5">
          <div className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide mb-1 flex items-center gap-1"><span>Appointment notes</span></div>
          <textarea
            value={apptNotesValue}
            onChange={(e) => setApptNotesValue(e.target.value)}
            onBlur={() => handleSaveNotes(apptNotesValue)}
            disabled={isSavingNotes || !appointmentsTable.hasPermissionToUpdateRecords()}
            rows={3}
            placeholder="Team notes (e.g. bride is running late)…"
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-[#38322A] rounded-md bg-white dark:bg-[#25211A] text-gray-700 dark:text-gray-300 placeholder-gray-300 focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] resize-none transition-colors"
          />
        </div>

        {/* Conditional rendering based on appointment type */}
        {isFirstVisit && linkedClientRecord && (
          <div className="mt-6 space-y-5">
            <DetailRow label="Preferred stylist">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientStylistsField ? linkedClientRecord.getCellValueAsString(clientStylistsField) : '—'}</div>
            </DetailRow>
            {/* Part of the base-wide RTW Size convention — see
                docs/CROSS_CUTTING.md ("RTW Size convention"). Editable,
                2026-08-24 (per Axel: Ready to Wear Size must be editable
                here too, same as Pipeline/Recap/Customization). */}
            <RtwSizeField
              manualValue={clientRtwSizeManualField ? (linkedClientRecord.getCellValue(clientRtwSizeManualField) as number | null) : null}
              formulaDisplay={clientRtwSizeDisplayField ? linkedClientRecord.getCellValueAsString(clientRtwSizeDisplayField) : null}
              acuityValue={(() => {
                const raw = clientRtwSizeField ? linkedClientRecord.getCellValueAsString(clientRtwSizeField) : '';
                const n = parseFloat(raw);
                return Number.isFinite(n) ? n : null;
              })()}
              fieldRef={clientRtwSizeManualField}
              recordId={linkedClientRecord.id}
              clientsTable={clientsTable!}
              canEdit={!!clientsTable?.hasPermissionToUpdateRecords()}
            />
            <DetailRow label="Next appointment">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientNextApptField ? linkedClientRecord.getCellValueAsString(clientNextApptField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Previous appointments">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientApptRecordsField ? linkedClientRecord.getCellValueAsString(clientApptRecordsField) : '—'}</div>
            </DetailRow>
            {clientFavStylesAcuityField && linkedClientRecord.getCellValueAsString(clientFavStylesAcuityField) && (
              <DetailRow label="Favorite styles" fieldId={FIELD_IDS.CLIENT_FAV_STYLES_ACUITY}>
                <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{linkedClientRecord.getCellValueAsString(clientFavStylesAcuityField)}</div>
              </DetailRow>
            )}
            <DetailRow label="Personal style notes" fieldId={FIELD_IDS.CLIENT_PERSONAL_NOTES}>
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientPersonalNotesField ? linkedClientRecord.getCellValueAsString(clientPersonalNotesField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Wedding location" fieldId={FIELD_IDS.CLIENT_WEDDING_LOC}>
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientWeddingLocField ? linkedClientRecord.getCellValueAsString(clientWeddingLocField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Wedding planner" fieldId={FIELD_IDS.CLIENT_WEDDING_PLANNER}>
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientWeddingPlannerField ? linkedClientRecord.getCellValueAsString(clientWeddingPlannerField) : '—'}</div>
            </DetailRow>
          </div>
        )}

        {isFitPickUp && linkedClientRecord && (
          <div className="mt-6 space-y-5">
            <DetailRow label="Last appointment">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientLastApptField ? linkedClientRecord.getCellValueAsString(clientLastApptField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Next appointment">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientNextApptField ? linkedClientRecord.getCellValueAsString(clientNextApptField) : '—'}</div>
            </DetailRow>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <DetailRow label="Bust">
                <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{bustField ? record.getCellValueAsString(bustField) : '—'}</div>
              </DetailRow>
              <DetailRow label="Waist">
                <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{waistField ? record.getCellValueAsString(waistField) : '—'}</div>
              </DetailRow>
              <DetailRow label="Hips">
                <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{hipsField ? record.getCellValueAsString(hipsField) : '—'}</div>
              </DetailRow>
              <DetailRow label="Height">
                <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{heightField ? record.getCellValueAsString(heightField) : '—'}</div>
              </DetailRow>
            </div>
            <DetailRow label="Measurement photos">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientMeasurementsField ? linkedClientRecord.getCellValueAsString(clientMeasurementsField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Photos from appointment">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{apptPhotosField ? record.getCellValueAsString(apptPhotosField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Follow-up">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{followUpField ? record.getCellValueAsString(followUpField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Interest in alterations">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientInterestAltsField ? linkedClientRecord.getCellValueAsString(clientInterestAltsField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Interest in made to measure">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientInterestM2mField ? linkedClientRecord.getCellValueAsString(clientInterestM2mField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Rush order">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientIsRushField ? linkedClientRecord.getCellValueAsString(clientIsRushField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Private appointment notes">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{clientApptNotesField ? linkedClientRecord.getCellValueAsString(clientApptNotesField) : '—'}</div>
            </DetailRow>
          </div>
        )}

        {isPickUpAppt && linkedClientRecord && (
          <PickUpOrdersTable
            clientsTable={clientsTable}
            linkedClientRecord={linkedClientRecord}
            orderRecords={orderRecords}
            ordersTable={ordersTable}
            adjTable={adjTable}
            adjRecords={adjRecords}
            itemsTable={itemsTable}
            itemsRecords={itemsRecords}
            syncLogTable={syncLogTable}
            syncLogRecords={syncLogRecords}
          />
        )}

        {isAlterations && (
          <div className="mt-6 space-y-5">
            <DetailRow label="Alterations notes">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{altNotesField ? record.getCellValueAsString(altNotesField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Customizations">
              <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{customizationField ? record.getCellValueAsString(customizationField) : '—'}</div>
            </DetailRow>
            <div className="text-sm text-gray-600 dark:text-gray-400 italic">Flags (veil/shoes purchased) pending confirmation with Julia</div>
          </div>
        )}

        {!isFirstVisit && !isFitPickUp && !isAlterations && (
          <>
            {favStylesValue && (
              <div className="mt-5">
                <DetailRow label="Favorite styles">
                  <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{favStylesValue}</div>
                </DetailRow>
              </div>
            )}

            {isNyStudio && samplesNotInNyValue && (
              <div className="mt-5">
                <DetailRow label="Samples not in NY">
                  <div className="text-sm text-gray-800 dark:text-[#F3EFE6]">{samplesNotInNyValue}</div>
                </DetailRow>
              </div>
            )}
          </>
        )}
      </div>

      {canExpand && (
        <div className="p-5 border-t border-gray-200 dark:border-[#38322A]">
          <button
            onClick={() => expandRecord(record)}
            className="w-full px-4 py-2.5 rounded-md bg-gray-900 dark:bg-[#F3EFE6] text-white dark:text-[#1B1813] text-sm font-medium hover:bg-gray-700 dark:hover:bg-white/20 transition-colors"
          >
            Open Full Record
          </button>
        </div>
      )}
    </div>
  );
}

type SortState = { column?: string; direction?: 'asc' | 'desc' };

function AppointmentsApp(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);

  const appointmentsTable = customPropertyValueByKey.appointmentsTable as Table | undefined;
  const clientsTable = customPropertyValueByKey.clientsTable as Table | undefined;

  const roomsTable = base.getTableByIdIfExists(TABLE_IDS.ROOMS) ?? undefined;
  const staffTable = base.getTableByIdIfExists(TABLE_IDS.STAFF) ?? undefined;
  const studiosTable = base.getTableByIdIfExists(TABLE_IDS.STUDIOS) ?? undefined;
  const appointmentTypesTable = base.getTableByIdIfExists(TABLE_IDS.APPOINTMENT_TYPES) ?? undefined;
  // Issue #54 — Orders table for the Pick Up appointment detail modal.
  // Read-only for now; if this table isn't declared accessible on this
  // interface page, getTableByIdIfExists still returns it (unlike a direct
  // base.getTable() crash), but useRecords below may then throw — same
  // failure class as the earlier order_items/Pipeline issue. If orders
  // never load, check the page's declared tables in the Airtable UI first.
  const ordersTable = base.getTableByIdIfExists(TABLE_IDS.ORDERS_SHOPIFY) ?? undefined;
  // Issue #54 — Order detail page tables (adjustments/items/sync log). Same
  // failure-class warning as ordersTable above applies to each of these.
  const adjTable = base.getTableByIdIfExists(ADJ_TABLE_ID) ?? undefined;
  const itemsTable = base.getTableByIdIfExists(ORDER_ITEMS_TABLE_ID) ?? undefined;
  const syncLogTable = base.getTableByIdIfExists(SYNC_LOG_TABLE_ID) ?? undefined;
  const appointmentFieldsToLoad = useMemo(
    () => getExistingFields(appointmentsTable, APPOINTMENT_RECORD_FIELDS),
    [appointmentsTable]
  );
  const clientFieldsToLoad = useMemo(
    () => getExistingFields(clientsTable, CLIENT_RECORD_FIELDS),
    [clientsTable]
  );
  const roomFieldsToLoad = useMemo(
    () => getExistingFields(roomsTable, ROOM_RECORD_FIELDS),
    [roomsTable]
  );

  // Issue #54 — full field list, since the Order detail page (not just the
  // row-summary table) reads from this same orderRecords set.
  const orderFieldsToLoad = useMemo(
    () => getExistingFields(ordersTable, Object.values(ORDER_FIELD_IDS)),
    [ordersTable]
  );

  const staffFieldsToLoad = useMemo(() => {
    if (!staffTable) return [];
    const fields = staffTable.primaryField ? [staffTable.primaryField] : [];
    const isActiveField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_IS_ACTIVE);
    const departmentField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_DEPARTMENT);
    if (isActiveField) fields.push(isActiveField);
    if (departmentField) fields.push(departmentField);
    return fields;
  }, [staffTable]);
  
  const appointmentRecords = useRecords(appointmentsTable ?? null, {
    fields: appointmentFieldsToLoad,
  });
  const clientRecords = useRecords(clientsTable ?? null, {
    fields: clientFieldsToLoad,
  });
  const roomRecords = useRecords(roomsTable ?? null, {
    fields: roomFieldsToLoad,
  });

  const orderRecords = useRecords(ordersTable ?? null, {
    fields: orderFieldsToLoad,
  });
  // Issue #54 — no field filter, matching fulfillment.tsx's own convention
  // for these smaller secondary tables (order_adjustments/order_items/sync log).
  const adjRecords = useRecords(adjTable ?? null);
  const itemsRecords = useRecords(itemsTable ?? null);
  const syncLogRecords = useRecords(syncLogTable ?? null);

  const saStaffRecords = useRecords(staffTable ?? null, {
    fields: staffFieldsToLoad,
  });
  const altLeadStaffRecords = useRecords(staffTable ?? null, {
    fields: staffFieldsToLoad,
  });

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedSA, setSelectedSA] = useState<string[]>([]);
  const [selectedStudio, setSelectedStudio] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  // Open/close transition for the record detail overlay below — drawerVisible
  // lags selectedRecordId by the fade duration on close so the overlay stays
  // mounted (and fades out) instead of vanishing the instant it's dismissed.
  const [drawerVisible, setDrawerVisible] = useState(false);
  useEffect(() => {
    if (selectedRecordId) { const t = setTimeout(() => setDrawerVisible(true), 10); return () => clearTimeout(t); }
    setDrawerVisible(false);
  }, [selectedRecordId]);
  const requestCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
    setTimeout(() => setSelectedRecordId(null), 200);
  }, []);
  const [sortState, setSortState] = useState<SortState>({});
  const [layoutMode, setLayoutMode] = useState<'list' | 'calendar'>('list');

  const [isClearingByRecord, setIsClearingByRecord] = useState<{ [key: string]: boolean }>({});
  const [clearErrorByRecord, setClearErrorByRecord] = useState<{ [key: string]: string }>({});

  const dateStepperRef = useRef<HTMLDivElement>(null);

  const [modal, setModal] = useState<{ content: React.ReactNode } | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const clientNameById = useMemo(() => {
    if (!clientRecords || !clientsTable) return new Map<string, string>();
    const clientFullNameField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_FULL_NAME);
    const map = new Map<string, string>();
    clientRecords.forEach((r) => {
      const name = clientFullNameField ? r.getCellValueAsString(clientFullNameField) : r.name;
      if (name) map.set(r.id, name);
    });
    return map;
  }, [clientRecords, clientsTable]);

  const clientById = useMemo(() => {
    const map = new Map<string, Record>();
    clientRecords?.forEach((r) => {
      map.set(r.id, r);
    });
    return map;
  }, [clientRecords]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') requestCloseDrawer(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [requestCloseDrawer]);

  const apptTimeField = appointmentsTable?.getFieldIfExists(FIELD_IDS.APPT_TIME) ?? null;
  const apptTypeField = appointmentsTable?.getFieldIfExists(FIELD_IDS.APPT_TYPE) ?? null;
  const apptStudioShortField = appointmentsTable?.getFieldIfExists(FIELD_IDS.STUDIO_SHORT_NAME) ?? null;
  const roomLinkField = appointmentsTable?.getFieldIfExists(FIELD_IDS.ROOM_LINK) ?? null;
  const clientLinkField = appointmentsTable?.getFieldIfExists(FIELD_IDS.CLIENT_LINK) ?? null;
  const saNameField = appointmentsTable?.getFieldIfExists(FIELD_IDS.SA_NAME) ?? null;
  const altLeadLinkField = appointmentsTable?.getFieldIfExists(FIELD_IDS.ALT_LEAD_LINK) ?? null;
  const studioNameField = appointmentsTable?.getFieldIfExists(FIELD_IDS.STUDIO_NAME) ?? null;
  const checkInField = appointmentsTable?.getFieldIfExists(FIELD_IDS.CHECK_IN) ?? null;
  const clearedField = appointmentsTable?.getFieldIfExists(FIELD_IDS.CLEARED) ?? null;
  const pickedUpField = appointmentsTable?.getFieldIfExists(FIELD_IDS.PICKED_UP) ?? null;
  const statusField = appointmentsTable?.getFieldIfExists(FIELD_IDS.STATUS) ?? null;
  const apptNameField = appointmentsTable?.getFieldIfExists(FIELD_IDS.APPT_NAME) ?? null;
  const apptCategoryField = appointmentsTable?.getFieldIfExists(FIELD_IDS.APPT_CATEGORY) ?? null;
  const apptEndTimeField = appointmentsTable?.getFieldIfExists(FIELD_IDS.APPT_END_TIME) ?? null;

  const clientStageField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_STAGE) ?? null;
  const apptTypeChoiceField = appointmentTypesTable?.getFieldIfExists(FIELD_IDS.APPT_TYPE_CHOICE) ?? null;

  const stageColorByName = useMemo(() => getFieldChoiceColorMap(clientStageField), [clientStageField]);
  const apptTypeColorByName = useMemo(() => getFieldChoiceColorMap(apptTypeChoiceField), [apptTypeChoiceField]);

  const clientStageById = useMemo(() => {
    if (!clientRecords || !clientStageField) return new Map<string, string>();
    const map = new Map<string, string>();
    clientRecords.forEach((r) => {
      const stage = r.getCellValueAsString(clientStageField);
      if (stage) map.set(r.id, stage);
    });
    return map;
  }, [clientRecords, clientStageField]);

  const saOptions = useMemo(() => {
    if (!appointmentRecords || !saNameField) return [];
    const values = new Set<string>();
    appointmentRecords.forEach((r) => {
      const val = r.getCellValueAsString(saNameField);
      if (val) values.add(val);
    });
    return Array.from(values).sort();
  }, [appointmentRecords, saNameField]);

  const studioOptions = useMemo(() => {
    if (!appointmentRecords || !studioNameField) return [];
    const values = new Set<string>();
    appointmentRecords.forEach((r) => {
      const val = r.getCellValueAsString(studioNameField);
      if (val) values.add(val);
    });
    // New York Studio is the default and always appears first in the dropdown.
    return Array.from(values).sort((a, b) => {
      const aIsNY = a.toLowerCase().includes('new york');
      const bIsNY = b.toLowerCase().includes('new york');
      if (aIsNY && !bIsNY) return -1;
      if (bIsNY && !aIsNY) return 1;
      return a.localeCompare(b);
    });
  }, [appointmentRecords, studioNameField]);

  const categoryOptions = ['Sales', 'Alterations', 'Fulfillment'];

  const roomOptions = useMemo(() => {
    if (!roomRecords) return [];
    const roomNameField = roomsTable?.getFieldIfExists(FIELD_IDS.ROOM_NAME);
    return roomRecords.map(r => ({
      id: r.id,
      name: (roomNameField ? r.getCellValueAsString(roomNameField) : r.getCellValueAsString(roomsTable?.primaryField ?? null)) || 'Unknown'
    }));
  }, [roomRecords, roomsTable]);

  // Rooms filtered to the currently-selected studio.
  // Derives the studio short_name from the appointments table's own STUDIO_SHORT_NAME
  // lookup field (fldpA301QrlWlhZRJ), which is guaranteed to match the room's
  // ROOM_STUDIO_SHORT_NAME field (fld5GWMLhJtgI8VcV).
  const studioFilteredRoomOptions = useMemo(() => {
    if (!roomRecords || !roomsTable || !appointmentRecords || !appointmentsTable) {
      return roomOptions;
    }
    const roomStudioShortField = roomsTable.getFieldIfExists(FIELD_IDS.ROOM_STUDIO_SHORT_NAME);
    const roomNameField = roomsTable.getFieldIfExists(FIELD_IDS.ROOM_NAME);
    if (!roomStudioShortField) return roomOptions;

    // Pick up the studio short_name from any appointment assigned to the selected studio.
    // STUDIO_SHORT_NAME (fldpA301QrlWlhZRJ) is a lookup on the appointments table
    // that resolves to the same value stored in rooms.
    const apptStudioShortField = appointmentsTable.getFieldIfExists(FIELD_IDS.STUDIO_SHORT_NAME);
    if (!apptStudioShortField) return roomOptions;

    const referenceAppt = appointmentRecords.find(r => {
      if (!studioNameField) return false;
      return r.getCellValueAsString(studioNameField) === selectedStudio;
    });
    if (!referenceAppt) return roomOptions;

    const studioShortName = referenceAppt.getCellValueAsString(apptStudioShortField);
    if (!studioShortName) return roomOptions;

    return roomRecords
      .filter(r => r.getCellValueAsString(roomStudioShortField) === studioShortName)
      .map(r => ({
        id: r.id,
        name: (roomNameField ? r.getCellValueAsString(roomNameField) : r.name) || 'Unknown',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    roomRecords,
    roomsTable,
    appointmentRecords,
    appointmentsTable,
    selectedStudio,
    studioNameField,
    roomOptions,
  ]);

  const saStaffOptions = useMemo(() => {
    if (!saStaffRecords || !staffTable) return [];
    const isActiveField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_IS_ACTIVE);
    const departmentField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_DEPARTMENT);
    return saStaffRecords
      .filter(r => {
        if (isActiveField && !r.getCellValue(isActiveField)) return false;
        if (departmentField) {
          const dept = r.getCellValueAsString(departmentField).toLowerCase();
          if (!dept.includes('sales')) return false;
        }
        return !!r.getCellValueAsString(staffTable.primaryField ?? null);
      })
      .map(r => ({
        id: r.id,
        name: r.getCellValueAsString(staffTable.primaryField ?? null) || 'Unknown',
      }));
  }, [saStaffRecords, staffTable]);

  const altLeadStaffOptions = useMemo(() => {
    if (!altLeadStaffRecords || !staffTable) return [];
    const isActiveField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_IS_ACTIVE);
    const departmentField = staffTable.getFieldIfExists(FIELD_IDS.STAFF_DEPARTMENT);
    return altLeadStaffRecords
      .filter(r => {
        if (isActiveField && !r.getCellValue(isActiveField)) return false;
        if (departmentField) {
          const dept = r.getCellValueAsString(departmentField).toLowerCase();
          if (!dept.includes('alterations')) return false;
        }
        return !!r.getCellValueAsString(staffTable.primaryField ?? null);
      })
      .map(r => ({
        id: r.id,
        name: r.getCellValueAsString(staffTable.primaryField ?? null) || 'Unknown',
      }));
  }, [altLeadStaffRecords, staffTable]);

  useEffect(() => {
    if (!selectedStudio && studioOptions.length > 0) {
      setSelectedStudio(studioOptions[0]!);
    }
  }, [studioOptions, selectedStudio]);

  const filteredRecords = useMemo(() => {
    if (!appointmentRecords || !apptTimeField) return [];
    const dateStr = formatDateForComparison(selectedDate);

    return appointmentRecords
      .filter((r) => {
        const t = r.getCellValue(apptTimeField) as string | null;
        if (!t) return false;
        return formatDateForComparison(new Date(t)) === dateStr;
      })
      .filter((r) => {
        if (!selectedSA.length || !saNameField) return true;
        return selectedSA.includes(r.getCellValueAsString(saNameField));
      })
      .filter((r) => {
        if (!selectedStudio || !studioNameField) return true;
        return r.getCellValueAsString(studioNameField) === selectedStudio;
      })
      .filter((r) => {
        if (!selectedCategory.length || !apptCategoryField) return true;
        return selectedCategory.includes(r.getCellValueAsString(apptCategoryField));
      })
      .sort((a, b) => {
        const ta = a.getCellValue(apptTimeField) as string | null;
        const tb = b.getCellValue(apptTimeField) as string | null;
        if (!ta) return 1;
        if (!tb) return -1;
        const timeCompare = new Date(ta).getTime() - new Date(tb).getTime();
        
        if (!sortState.column) return timeCompare;
        
        let fieldA: string | null = null;
        let fieldB: string | null = null;
        
        if (sortState.column === 'client') {
          fieldA = clientLinkField ? a.getCellValueAsString(clientLinkField) : null;
          fieldB = clientLinkField ? b.getCellValueAsString(clientLinkField) : null;
        } else if (sortState.column === 'stage') {
          const linkedClientsA = clientLinkField ? (a.getCellValue(clientLinkField) as Array<{ id: string }> | null) : null;
          const linkedClientIdA = linkedClientsA?.[0]?.id ?? null;
          const linkedClientsB = clientLinkField ? (b.getCellValue(clientLinkField) as Array<{ id: string }> | null) : null;
          const linkedClientIdB = linkedClientsB?.[0]?.id ?? null;
          fieldA = linkedClientIdA ? (clientStageById.get(linkedClientIdA) ?? null) : null;
          fieldB = linkedClientIdB ? (clientStageById.get(linkedClientIdB) ?? null) : null;
        } else if (sortState.column === 'type') {
          fieldA = apptTypeField ? a.getCellValueAsString(apptTypeField) : null;
          fieldB = apptTypeField ? b.getCellValueAsString(apptTypeField) : null;
        } else if (sortState.column === 'room') {
          fieldA = roomLinkField ? a.getCellValueAsString(roomLinkField) : null;
          fieldB = roomLinkField ? b.getCellValueAsString(roomLinkField) : null;
        } else if (sortState.column === 'sa') {
          fieldA = saNameField ? a.getCellValueAsString(saNameField) : null;
          fieldB = saNameField ? b.getCellValueAsString(saNameField) : null;
        } else if (sortState.column === 'altlead') {
          fieldA = altLeadLinkField ? a.getCellValueAsString(altLeadLinkField) : null;
          fieldB = altLeadLinkField ? b.getCellValueAsString(altLeadLinkField) : null;
        }
        
        if (!fieldA && !fieldB) return 0;
        if (!fieldA) return sortState.direction === 'desc' ? -1 : 1;
        if (!fieldB) return sortState.direction === 'desc' ? 1 : -1;
        
        const cmp = fieldA.localeCompare(fieldB);
        return sortState.direction === 'desc' ? -cmp : cmp;
      });
  }, [
    appointmentRecords,
    selectedDate,
    selectedSA,
    selectedStudio,
    selectedCategory,
    apptTimeField,
    saNameField,
    studioNameField,
    apptCategoryField,
    clientLinkField,
    clientStageById,
    apptTypeField,
    roomLinkField,
    altLeadLinkField,
    sortState,
  ]);

  const selectedRecord = selectedRecordId ? filteredRecords.find((r) => r.id === selectedRecordId) ?? null : null;

  const handleCheckIn = useCallback((record: Record) => {
    const apptName = apptNameField ? record.getCellValueAsString(apptNameField) : '';
    const isAlterationsAppt = apptName.toLowerCase().includes('alterations');
    const notifyName = isAlterationsAppt
      ? (altLeadLinkField ? record.getCellValueAsString(altLeadLinkField) : '—')
      : (saNameField ? record.getCellValueAsString(saNameField) : '—');
    const notifyRole = isAlterationsAppt ? 'Alterations lead' : 'Sales associate';
    const client = clientLinkField ? record.getCellValueAsString(clientLinkField) : '—';
    const room = roomLinkField ? record.getCellValueAsString(roomLinkField) : '—';
    setModal({
      content: (
        <>
          <strong>{notifyName}</strong> has been notified through Slack that{' '}
          <strong>{client}</strong> is here and they will be in <strong>{room}</strong>.
        </>
      ),
    });
  }, [apptNameField, altLeadLinkField, saNameField, clientLinkField, roomLinkField]);

  const handlePickUp = useCallback(
    async (appointmentRecord: Record) => {
      if (pickedUpField && appointmentsTable?.hasPermissionToUpdateRecords()) {
        try {
          await appointmentsTable.updateRecordAsync(appointmentRecord.id, {
            [pickedUpField.id]: true,
          });
        } catch (err) {
          console.error('Pick up write failed:', err);
        }
      }
      const saName = saNameField ? appointmentRecord.getCellValueAsString(saNameField) : '—';
      const client = clientLinkField ? appointmentRecord.getCellValueAsString(clientLinkField) : '—';
      setModal({
        content: (
          <>
            <strong>{saName}</strong> has been notified through Slack that{' '}
            <strong>{client}</strong> is here for her pickup.
          </>
        ),
      });
    },
    [appointmentsTable, pickedUpField, saNameField, clientLinkField]
  );

  const handleClear = useCallback(
    async (appointmentRecord: Record) => {
      if (!appointmentsTable?.hasPermissionToUpdateRecords()) return;
      if (!clearedField) return;

      const alreadyCleared = (appointmentRecord.getCellValue(clearedField) as boolean | null) ?? false;
      if (alreadyCleared) return;

      setIsClearingByRecord((prev) => ({ ...prev, [appointmentRecord.id]: true }));
      setClearErrorByRecord((prev) => {
        const next = { ...prev };
        delete next[appointmentRecord.id];
        return next;
      });

      try {
        await appointmentsTable.updateRecordAsync(appointmentRecord.id, {
          [clearedField.id]: true,
        });

        const room = roomLinkField ? appointmentRecord.getCellValueAsString(roomLinkField) : '—';
        setModal({
          content: (
            <>
              The team has been notified that <strong>{room}</strong> has been cleared
              and is ready for the next appointment.
            </>
          ),
        });

        if (!clientLinkField || !clientsTable || !clientStageField) return;

        const linkedClients = appointmentRecord.getCellValue(clientLinkField) as Array<{ id: string }> | null;
        if (!linkedClients || linkedClients.length === 0) {
          return;
        }

        const linkedClientId = linkedClients[0]?.id;
        if (!linkedClientId) return;

        const clientRecord = clientById.get(linkedClientId);
        if (!clientRecord) {
          setClearErrorByRecord((prev) => ({
            ...prev,
            [appointmentRecord.id]: 'Could not load the linked client. Refresh and try again.',
          }));
          return;
        }

        if (statusField) {
          const apptStatus = appointmentRecord.getCellValueAsString(statusField);
          if (apptStatus === 'Cancelled') return;
        }

        const currentStage = clientRecord.getCellValueAsString(clientStageField);
        if (currentStage !== 'Pre-Appointment') return;

        if (!clientsTable.hasPermissionToUpdateRecords()) {
          setClearErrorByRecord((prev) => ({
            ...prev,
            [appointmentRecord.id]: 'No permission to update client stage.',
          }));
          return;
        }

        await clientsTable.updateRecordAsync(linkedClientId, {
          [clientStageField.id]: { name: 'Deliberating' },
        });
      } catch (err) {
        console.error('handleClear failed:', err);
        setClearErrorByRecord((prev) => ({
          ...prev,
          [appointmentRecord.id]: 'Something went wrong. Refresh and try again.',
        }));
      } finally {
        setIsClearingByRecord((prev) => {
          const next = { ...prev };
          delete next[appointmentRecord.id];
          return next;
        });
      }
    },
    [appointmentsTable, clientsTable, clientById, clearedField, clientLinkField, clientStageField, statusField, roomLinkField]
  );

  const handleRowClick = (recordId: string) => {
    if (selectedRecordId === recordId) {
      requestCloseDrawer();
    } else {
      setSelectedRecordId(recordId);
    }
  };

  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  const isNotToday = () => {
    const today = new Date();
    return formatDateForComparison(selectedDate) !== formatDateForComparison(today);
  };

  const handleSort = (column: string) => {
    setSortState((prev) => {
      if (prev.column !== column) {
        return { column, direction: 'desc' };
      }
      if (prev.direction === 'desc') {
        return { column, direction: 'asc' };
      }
      return {};
    });
  };

  const getSortArrow = (column: string) => {
    if (sortState.column !== column) return null;
    return sortState.direction === 'desc' ? (
      <CaretDownIcon size={14} className="text-gray-600 dark:text-gray-400 inline ml-1" />
    ) : (
      <CaretUpIcon size={14} className="text-gray-600 dark:text-gray-400 inline ml-1" />
    );
  };

  const columnHeader = (label: string, column?: string) => {
    const clickable = column && ['client', 'stage', 'type', 'room', 'sa', 'altlead'].includes(column);
    // Time stays left-aligned (matches its left-aligned body cells); every
    // other column's body content is now centered, so its header centers too.
    const align = label === 'Time' ? 'text-left' : 'text-center';
    return (
      <th
        className={`px-3 py-2 text-[11px] font-medium tracking-wide capitalize text-gray-500 dark:text-gray-400 whitespace-nowrap ${align} ${clickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10' : ''}`}
        onClick={() => column && clickable && handleSort(column)}
      >
        {label}
        {getSortArrow(column || '')}
      </th>
    );
  };

  const handleRoomChange = useCallback(
    async (recordId: string, roomId: string | null) => {
      if (!appointmentsTable?.hasPermissionToUpdateRecords() || !roomLinkField) return;
      try {
        await appointmentsTable.updateRecordAsync(recordId, {
          [roomLinkField.id]: roomId ? [{ id: roomId }] : null
        });
      } catch (err) {
        console.error('Room change failed:', err);
      }
    },
    [appointmentsTable, roomLinkField]
  );

  if (errorState) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F8F5EE] dark:bg-[#1B1813]">
        <p className="text-gray-500 dark:text-gray-400">Error loading configuration.</p>
      </div>
    );
  }

  if (!appointmentsTable || !clientsTable) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F8F5EE] dark:bg-[#1B1813]">
        <div className="text-center p-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-[#F3EFE6] mb-2">Configuration Required</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please set the Appointments and Clients tables in the properties panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden antialiased bg-[#F8F5EE] dark:bg-[#1B1813]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{GLOBAL_STYLES}</style>
      {modal && <NotificationModal content={modal.content} onClose={() => setModal(null)} />}

      <div className="px-6 pt-5 pb-3 flex flex-wrap items-center gap-4 bg-transparent">
        {/* Date Selector */}
        <div ref={dateStepperRef} className="relative flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
          >
            <CaretLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="px-2 py-1 text-base font-medium text-gray-800 dark:text-[#F3EFE6] hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
          >
            {formatDisplayDate(selectedDate)}
          </button>
          <button
            onClick={handleNextDay}
            className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
          >
            <CaretRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          {isNotToday() && (
            <button
              onClick={handleGoToToday}
              className="ml-2 text-sm px-2.5 py-1 rounded-md border border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#25211A] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium"
            >
              Today
            </button>
          )}

          {showCalendar && (
            <MiniCalendar
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setShowCalendar(false);
              }}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </div>

        {/* Sales Associate filter */}
        <FilterDropdown
          label="Sales Associate"
          values={selectedSA}
          options={saOptions}
          onChange={setSelectedSA}
        />

        {/* Category filter */}
        <FilterDropdown
          label="Category"
          values={selectedCategory}
          options={categoryOptions}
          onChange={setSelectedCategory}
        />

        {/* Studio Selector */}
        {studioOptions.length > 0 && (
          <StudioDropdown
            value={selectedStudio}
            options={studioOptions}
            onChange={setSelectedStudio}
          />
        )}

        {/* Layout Selector */}
        <LayoutToggle value={layoutMode} onChange={setLayoutMode} />
      </div>

      <div className="relative flex-1 mx-6 mb-6 bg-white dark:bg-[#25211A] border border-[#E9E0CE] dark:border-[#38322A] rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <CalendarIcon size={40} className="text-gray-300 dark:text-gray-600 mb-2" />
              <span className="text-sm">No appointments for {formatDisplayDate(selectedDate)}</span>
            </div>
          ) : layoutMode === 'list' ? (
            filteredRecords.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-[#38322A] sticky top-0">
                  <tr>
                    {columnHeader('Time')}
                    {columnHeader('Client', 'client')}
                    {columnHeader('Stage', 'stage')}
                    {columnHeader('Type', 'type')}
                    {columnHeader('Room', 'room')}
                    {columnHeader('Sales associate', 'sa')}
                    {columnHeader('Alteration lead', 'altlead')}
                    {columnHeader('Actions')}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const isSelected = record.id === selectedRecordId;
                    const timeValue = apptTimeField ? (record.getCellValue(apptTimeField) as string | null) : null;
                    const studioShortValue = apptStudioShortField ? record.getCellValueAsString(apptStudioShortField) : null;
                    const apptTimeZone = getTimeZoneForStudioShort(studioShortValue);
                    const typeValue = apptTypeField ? record.getCellValueAsString(apptTypeField) : '';
                    // Type must reflect the appointment_type field
                    // (fldZO3rF3KOGxG0S5) only — no silent fallback to the
                    // separate compound Appointment Type field (typeValue),
                    // so what's shown here always matches what's in that
                    // column, and a genuine parse failure isn't masked.
                    const apptNameRaw = apptNameField ? record.getCellValue(apptNameField) : null;
                    const apptNameEntry = extractSelectValue(apptNameRaw);
                    const apptNameMissingReason = apptNameEntry ? null
                      : !apptNameField ? 'appointment_type field not found on this table.'
                      : (apptNameRaw === null || apptNameRaw === undefined) ? 'appointment_type is empty for this appointment.'
                      : `appointment_type has a value but could not be parsed — raw: ${JSON.stringify(apptNameRaw).slice(0, 200)}`;
                    // AL only applies when the Type shown in this row is
                    // literally "Alterations" — the broader apptCategory
                    // bucket (fldZ45u0N2GzukwO4) also groups things like
                    // "Final Fitting & Pick Up" under "Alterations", which
                    // isn't what this flag means.
                    const isAlterationsAppt = apptNameEntry?.name === 'Alterations';
                    
                    const linkedClients = clientLinkField
                      ? (record.getCellValue(clientLinkField) as Array<{ id: string }> | null)
                      : null;
                    const linkedClientId = linkedClients?.[0]?.id ?? null;
                    const clientStage = linkedClientId ? (clientStageById.get(linkedClientId) ?? null) : null;
                    const isBlock = isBlockTime(record, clientLinkField);

                    // Issue #32/#45 — Room/SA no longer block Check In; only
                    // a missing Client does (nothing to check in otherwise).
                    const hasRequiredData = !!(clientLinkField && record.getCellValueAsString(clientLinkField));

                    const startTime = timeValue ? new Date(timeValue) : null;
                    const endTimeRaw = apptEndTimeField
                      ? (record.getCellValue(apptEndTimeField) as string | null)
                      : null;
                    const endTime = endTimeRaw ? new Date(endTimeRaw) : null;
                    const showCheckInButton = isWithin30MinBefore(startTime);
                    const showClearButton = isWithin30MinBefore(endTime);

                    const roomValue = roomLinkField ? record.getCellValueAsString(roomLinkField) : null;
                    const saValue = saNameField ? record.getCellValueAsString(saNameField) : null;
                    const altLeadValue = altLeadLinkField ? record.getCellValueAsString(altLeadLinkField) : null;

                    if (isBlock) {
                      return (
                        <tr
                          key={record.id}
                          onClick={() => handleRowClick(record.id)}
                          className={`border-b border-gray-100 dark:border-white/5 cursor-pointer transition-colors bg-[#FCFAF4] dark:bg-[#211D17] hover:bg-gray-100 dark:hover:bg-white/5 ${
                            isSelected ? 'bg-[#FEF3C7] dark:bg-[#3A2E12]' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 text-[13px] whitespace-nowrap text-gray-600 dark:text-gray-400">
                            {timeValue ? renderTimeCell(timeValue, apptTimeZone) : '—'}
                          </td>
                          <td colSpan={7} className="px-3 py-2.5 text-sm font-semibold text-center text-gray-600 dark:text-gray-400">
                            Blocked Time
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={record.id}
                        onClick={() => handleRowClick(record.id)}
                        className={`border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#FEF3C7] dark:bg-[#3A2E12]' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 text-[13px] whitespace-nowrap">
                          {timeValue ? renderTimeCell(timeValue, apptTimeZone) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap text-center text-[#1A1612] dark:text-[#F3EFE6]">
                          {clientLinkField && record.getCellValueAsString(clientLinkField)
                            ? record.getCellValueAsString(clientLinkField)
                            : <MissingDataPill label="Client" severity="hard" />}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {clientStage
                            ? <span
                                className={getListPillClassesForColor(stageColorByName.get(clientStage))}
                                title={`value: "${clientStage}" | field: DF Clients.stage (fldLcxVZvI1rigBlh) | resolved color: ${stageColorByName.get(clientStage) || 'none (falls back to gray)'} | choices loaded: ${stageColorByName.size}`}
                              >{clientStage}</span>
                            : <span className="text-gray-400 dark:text-gray-500">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {apptNameEntry
                            ? <span
                                className={getListPillClassesForColor(apptTypeColorByName.get(apptNameEntry.name))}
                                title={`value: "${apptNameEntry.name}" | color source: appointment_types.type field (fld5M3HgiIOycZfKJ) | resolved color: ${apptTypeColorByName.get(apptNameEntry.name) || 'none (falls back to gray)'} | choices loaded: ${apptTypeColorByName.size}`}
                              >{apptNameEntry.name}</span>
                            : <MissingDataPill reason={apptNameMissingReason} />}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] whitespace-nowrap text-center">
                          {roomValue ? <span className="text-gray-600 dark:text-gray-400">{roomValue}</span> : <MissingDataPill label="Room" severity="soft" />}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] whitespace-nowrap text-center">
                          {saValue ? <span className="text-gray-600 dark:text-gray-400">{saValue}</span> : <MissingDataPill label="Sales Associate" severity="soft" />}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] whitespace-nowrap text-center">
                          {altLeadValue
                            ? <span className="text-gray-600 dark:text-gray-400">{altLeadValue}</span>
                            : isAlterationsAppt ? <MissingDataPill label="Alterations Lead" severity="soft" /> : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <ActionButtons
                            record={record}
                            appointmentsTable={appointmentsTable}
                            checkInField={checkInField}
                            clearedField={clearedField}
                            pickedUpField={pickedUpField}
                            isClearingByRecord={isClearingByRecord}
                            clearErrorByRecord={clearErrorByRecord}
                            onCheckIn={handleCheckIn}
                            onClear={handleClear}
                            onPickUp={handlePickUp}
                            apptTypeLabel={typeValue}
                            hasRequiredData={hasRequiredData}
                            showCheckInButton={showCheckInButton}
                            showClearButton={showClearButton}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null
          ) : layoutMode === 'calendar' ? (
            <CalendarPivot
              records={filteredRecords}
              appointmentFields={{
                timeField: apptTimeField,
                clientField: clientLinkField,
                typeField: apptTypeField,
                saNameField: saNameField,
                altLeadLinkField: altLeadLinkField,
                roomLinkField: roomLinkField,
                endTimeField: apptEndTimeField,
                apptNameField: apptNameField,
              }}
              clientNameById={clientNameById}
              clientStageById={clientStageById}
              stageColorByName={stageColorByName}
              apptTypeColorByName={apptTypeColorByName}
              studioFilteredRoomOptions={studioFilteredRoomOptions}
              selectedDate={selectedDate}
              appointmentsTable={appointmentsTable}
              onSelectRecord={setSelectedRecordId}
              onRoomChange={handleRoomChange}
              checkInField={checkInField}
              clearedField={clearedField}
              pickedUpField={pickedUpField}
              isClearingByRecord={isClearingByRecord}
              clearErrorByRecord={clearErrorByRecord}
              onCheckIn={handleCheckIn}
              onClear={handleClear}
              onPickUp={handlePickUp}
            />
          ) : null}
        </div>
      </div>

      {selectedRecordId && selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ease-out"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: drawerVisible?1:0 }}
          onClick={requestCloseDrawer}
        >
          <div
            className="bg-white dark:bg-[#25211A] rounded-xl w-full max-w-[720px] max-h-[70vh] overflow-hidden flex flex-col mx-4 transition-[opacity,transform] duration-200 ease-out"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)', opacity: drawerVisible?1:0, transform: drawerVisible?'scale(1)':'scale(0.96)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <DetailDrawer
              record={selectedRecord}
              appointmentsTable={appointmentsTable}
              clientsTable={clientsTable}
              clientById={clientById}
              allAppointmentRecords={appointmentRecords ?? []}
              roomOptions={roomOptions}
              roomRecords={roomRecords}
              roomsTable={roomsTable}
              saOptions={saStaffOptions}
              altLeadOptions={altLeadStaffOptions}
              onClose={requestCloseDrawer}
              clearErrorByRecord={clearErrorByRecord}
              roomLinkField={roomLinkField}
              studioNameField={studioNameField}
              altLeadLinkField={altLeadLinkField}
              clientStageById={clientStageById}
              stageColorByName={stageColorByName}
              ordersTable={ordersTable}
              orderRecords={orderRecords}
              adjTable={adjTable}
              adjRecords={adjRecords}
              itemsTable={itemsTable}
              itemsRecords={itemsRecords}
              syncLogTable={syncLogTable}
              syncLogRecords={syncLogRecords}
            />
          </div>
        </div>
      )}

      <FeedbackButton onClick={() => setShowFeedbackModal(true)} />
      {showFeedbackModal && <FeedbackModal base={base} onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}

initializeBlock({ interface: () => <AppointmentsApp /> });
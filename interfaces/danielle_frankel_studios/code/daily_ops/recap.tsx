import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table, Record as AirtableRecord } from '@airtable/blocks/interface/models';
import {
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CaretDown as CaretDownIcon,
  Calendar as CalendarIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Upload as UploadIcon,
  X as XIcon,
  Check as CheckIcon,
  ArrowLeft as ArrowLeftIcon,
  Lightning as LightningIcon,
  Printer as PrinterIcon,
  FileText as FileTextIcon,
  Plus as PlusIcon,
  ChatCircleText as ChatCircleTextIcon,
  Paperclip as PaperclipIcon,
} from '@phosphor-icons/react';

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
    <div className="no-print">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <button type="button" onClick={onClick}
        className="fixed bottom-4 right-20 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#D97706] hover:bg-[#B45309] dark:bg-[#FBBF24] dark:hover:bg-[#F59E0B] text-white dark:text-[#1B1813] shadow-2xl transition-colors"
        style={{ zIndex: 9600 }}>
        <ChatCircleTextIcon size={16} /> Feedback
      </button>
    </div>
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
    <div className="fixed inset-0 flex items-center justify-center no-print" style={{ backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 9700 }} onClick={onClose}>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
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

// ─── Dark mode ────────────────────────────────────────────────────────────────
function useTheme(): 'light' | 'dark' {
  // Reads Airtable's own light/dark preference, not the OS/browser setting.
  const { colorScheme } = useColorScheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorScheme === 'dark');
  }, [colorScheme]);
  return colorScheme;
}

// ─── Click-triggered (not hover-triggered) tooltip ─────────────────────────────
// Native `title` attributes only ever show on hover — for a disabled-looking
// button where the explanation should only appear once the user actually
// clicks it (2026-08-05, per Julia, for the Recap Doc Generate/Upload
// buttons), that has to be hand-rolled: no `disabled` attribute (a real
// disabled button doesn't fire onClick at all in most browsers, so there'd
// be nothing to react to), just disabled-looking styling plus an onClick
// that shows a transient message instead of running the real action.
function useClickTooltip(durationMs = 2500) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  const trigger = useCallback(() => {
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), durationMs);
  }, [durationMs]);
  return { visible, trigger };
}

// ─── Write queue ──────────────────────────────────────────────────────────────
let _writeQueue = Promise.resolve();
function queueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = _writeQueue.then(fn);
  _writeQueue = next.then(() => {}, () => {});
  return next;
}

// ─── Table / field IDs ────────────────────────────────────────────────────────
const TABLE_IDS = {
  APPOINTMENTS:         'tblvV7uKTCaFFekoR',
  CLIENTS:              'tblLLUlDgJ4ktzF7c',
  STYLES:               'tbl0hWIRBbcB4UkVC',
  CUSTOMIZATIONS:       'tbl7HUWDI7IRjWY92',
  CUSTOMIZATION_PRICING:'tblccTHYe8BCqutyD',
  VENDORS:              'tblZzMdXOlBDJC0BS',
  ATTACHMENTS:          'tbli57E9YzWb5Qmku',
  STAFF:                'tblbYk88xJ8FQrLS4',
  PROPOSALS:            'tblP7tVuCuXMzI4ir',
  RESOURCES:            'tblFa56lQwVacMXto',
} as const;

// resources table (tblFa56lQwVacMXto) — small shared-asset table (2026-08-04),
// currently just the Recap Doc footer wordmark. Read live via the Blocks SDK
// rather than baked into source, because Airtable attachment URLs
// (v5.airtableusercontent.com/...) are signed and expire — hardcoding one
// would silently break later.
const RESOURCES = {
  ATTACHMENT: 'fldQdW61aiBsn9Gnt',
  // Plain URL field (2026-08-05) — holds the attachments form link, which
  // differs between sandbox and production (same page ID, different base
  // ID). Regular Airtable records aren't synced between sandbox/production
  // copies of a base, so this can hold the sandbox URL in sandbox and the
  // production URL in production, and the code just reads whichever this
  // environment's copy has — same idea as the two hardcoded logo record
  // IDs above, but via a value instead of two different record IDs.
  URL: 'fldMDIAqAjpwUvtWF',
} as const;
// The resources record this attachments-form URL lives on. Originally
// found live as "attachments_form" (2026-08-05); Julia renamed it to
// "attachments_form_url" the same day to read more clearly next to
// "attachment_url" (SDK). Matching the current, renamed value.
const ATTACHMENT_FORM_RESOURCE_NAME = 'attachments_form_url';
// Same base's resources table has a different record per environment — this
// interface's code is shared between sandbox and production, so it tries
// the sandbox record ID first and falls back to the production one if that
// record isn't found (i.e. this copy is actually running in production).
const RECAP_LOGO_RESOURCE_RECORD_ID_SANDBOX    = 'recwjGACdvPt0Chmh';
const RECAP_LOGO_RESOURCE_RECORD_ID_PRODUCTION = 'recnPL7vUoa7FQ8a4';

const APPT = {
  TIME:           'fldL7kYvgkmyhGniX',
  TYPE:           'fldZO3rF3KOGxG0S5',
  ROOM_LINK:      'fldKVUlPm7Gq3EUF9',
  CLIENT_LINK:    'fldcVVGhEsnYRsbyR',
  STATUS:         'fldZTkJdTBhmcchTb',
  CHECK_IN:       'fldarspmpxD4OFpnX',
  CLEARED:        'fldE1Ke90UVdyUFL1',
  PICKED_UP:      'fldaT5YwVqB87h8Ia',
  SA_NAME:        'fldAopgXS7Zw42ZgV',
  STUDIO_NAME:    'fldelULQNcaGnAv5K',
  APPT_END_TIME:  'fldFwFIBNtC76v0Y7',
  MEASUREMENTS:   'fldbXhNAVDZq9fl2u',
  APPT_PHOTOS:    'fldBEBwDmZd29rjkK',
  FOLLOW_UP:      'fldX0ymLcTeOMpBw7',
  // Main-list Wedding Date / Favorite Styles columns — all three are lookups
  // (via CLIENT_LINK) onto Clients, not plain fields on Appointments itself.
  WEDDING_DATE_LOOKUP:        'fldvXj43cLOX8tqXW', // lookup of Clients.WEDDING_IF_NOT_SET (text) — result is a per-linked-record array, needs unwrapping
  FAV_STYLES_ACUITY_LOOKUP:   'fldCPhdJ885D7ytOf', // lookup of Clients.FAV_STYLES_ACUITY, itself a link field — nested structure, needs unwrapLinkedNames
  FAV_STYLES_APPT_LOOKUP:     'fldDqAwOc2t1gkjeW', // lookup of Clients.FAV_STYLES_APPT, itself a link field — same nested-structure quirk
  // Recap Doc — created 2026-08-03 for "Recap Doc automático al cierre de la
  // primera cita de consulta". Both live directly on the Appointment record
  // (not on Clients), since a Recap Doc is scoped to one specific appointment.
  RECAP_DOC:              'fldNlAu1xqmTEtNZI', // multipleAttachments
  RECAP_STAGE_COMPLETED:  'fldJmciXBeZjMCXY1', // checkbox — set true only by attachment_router.js once recap_doc is linked
} as const;

const CLIENT = {
  FULL_NAME:          'fldB3Wyam01D3wR5Q',
  FIRST_NAME:         'fldFWlAODUcuroeXK',
  LAST_NAME:          'fldQzSPiUvOid1nXo',
  STAGE:              'fldLcxVZvI1rigBlh',
  EMAIL:              'fld5f3IVZoX0QZZ8R',
  PHONE:              'fldZrxF4bR6QBUwVK',
  WEDDING:            'fldbgknumKGS5W5WU',
  WEDDING_IF_NOT_SET: 'fldqwfmMczvLhiqk1',
  WEDDING_DISPLAY:    'fldfDHXcCEbFHEX4a', // wedding_date_display formula — Formatted with fallback to If Not Set; read-only display only, never the editable field
  WEDDING_CONFIRMED:  'fldOZTDVcR1qwU6U2',
  WEDDING_LOCATION:   'fldikRqj41XYiIDBk',
  WEDDING_PLANNER:    'fldISwHPviwGQBHFJ',
  STUDIO_FORMULA:     'fldNQuys5CFap0drj',
  STUDIO_SHORT_NAME:  'fld1AWRrVteCUmVto',
  SA_NAME:            'fldH8lJJHPUjPnyHZ',
  SA_PHONE:           'fldl5vP5mpQrHsTsm',
  SA_EMAIL:           'fldiGcxcshWvxTKKf',
  APPT_COUNT:         'fldrnDWDgDx5IF5gz',
  NEXT_APPT:          'fldTe2cyBmicx9Ple',
  LAST_APPT:          'fldd01OccObkG9sGe',
  NEXT_APPT_ROOM:     'fldfQUSkQRooZi8sr',
  NEXT_APPT_ALT_LEAD: 'flddN7YHMuymJKbv9',
  LATEST_ALTS_APPT:   'fldoF7SPEjWNi5JQF',
  COUNTRY:            'flduQb1j7LceNZuC8',
  STYLISTS:           'fld2jVE1qluvlhV7D',
  RTW_SIZE:           'fldEEH4CK3Qqp0g0C',
  FAV_STYLES_ACUITY:  'fldZzNR0g5VEJ5RmX',
  SAMPLES_NOT_NEEDED: 'fldVPJWXThfyGuh6d',
  PERSONAL_NOTES:     'fldQiGCx5hRQ0Am1Z',
  MEAS_PHOTO:         'fldcWwbKOc9nkgzzV',
  APPT_PHOTO:         'fldWti8XzHbnGcjz9',
  MEAS_BUST:          'fldiCV13D0ym7Yirh',
  MEAS_WAIST:         'fldShyIHilro7fYol',
  MEAS_HIPS:          'fldx7dNHA3SZYC11C',
  MEAS_HEIGHT:        'fldTAlnT0Wk3LKPsb',
  MEAS_UNDER_BUST:    'fldjpZwsalPCU58B6',
  MEAS_HIGH_HIP:      'fldxSCXFJbpFZSjT4',
  MEAS_HOLLOW_HEM:    'fldTjlDvwQujNQq2Q',
  MEAS_SHOULDER_W:    'fldumkBChIto7hK3o',
  MEAS_ARM_LENGTH:    'fldgEc2qr3qjjSX00',
  MEAS_NOTES:         'fld66sFiCbMxKwtiB',
  FOLLOW_UP_SENT:     'fldmjiS7lHEn9qZHN',
  INTEREST_CUSTOM:    'fldTrFh5dMYvkl0F4',
  INTEREST_ALTS:      'fldibh40zShnDmLfj',
  INTEREST_M2M:       'fld3YweLOIcpr7xvL',
  APPT_NOTES:         'fldwHp8zC3GykAuO1',
  FAV_STYLES_APPT:    'fldVw8wCgPKvxN1jD',
  CUSTOMIZATION_LINK: 'fldlbAPEaoTwfFPTv',
  SIZE:               'fld2i9hJrfxTUuh1N', // "Size" — Shopify-sourced, read-only here (see FIELD_SOURCE); not shown on this page's size row anymore
  SIZE_ACUITY_INTAKE: 'fldvV2CiEx4RQN4mO', // "Size from Acuity Intake", singleLineText — the size field actually shown/editable on this page (2026-08-07)
  ATTACHMENTS:        'fldu3dTdfLaN5immv',
  // Added 2026-08-05, per Julia — resolves the Recap Doc's target
  // appointment (the client's first non-cancelled consultation) via a
  // manually-linked "Appointment Records" field (fldYb8G67izm3qelZ) rather
  // than the appointment record currently open in this modal, so the
  // upload form's prefill_appointment is correct even if that ever
  // diverges. Both are LOOKUPS (through that same link field) — always
  // arrays even when conceptually single-valued, so read them with
  // firstLookupValue(), never getCellValueAsString() directly.
  CONSULTATION_APPT_TIME:      'fldLQRhGqANVci6BM', // multipleLookupValues → dateTime
  // Recreated 2026-08-05 (Julia had deleted it, then re-added it) — new
  // field ID, same underlying link field + record_id formula target.
  CONSULTATION_APPT_RECORD_ID: 'fldDStVqmJpDDNWMP', // multipleLookupValues → record_id formula (text)
} as const;

const CUSTOM = {
  ID_FORMULA:            'fldl9cIcV80nYEDwe',
  DATE_OF_REQUEST:       'fldQdHAp256vsImBt',
  STATUS:                'fld5qkNKygBkRYF4v',
  CUSTOMIZED_STYLE:      'fldCaKP1d4C0aohQE',
  CUSTOMIZATION_PRICING: 'fldJY7GklAVZ7lsjw',
  CUSTOMIZATION_DETAIL:  'fldg1hEoZe9MFQj02',
  EMBROIDERY_AMOUNT:     'fldfryrwA8fipol7v',
  M2M:                   'fldonK9Rd5lOXeH8F',
  ALTERATIONS:           'fldM72sjV0aAwbX2D',
  RUSH:                  'fldt92ponsfyKqDS1',
  CLIENT:                'fldOeL4VVcXaKwwlN',
  SEND_TO_SLACK:         'fldG6tV91xqwh36P8',
  BASE_PRICE:            'fldLBXbdD3SUfXSgL',
  WEDDING_DATE:          'fldO0Lalw1SkwAf4D',
  // Hybrid customizations (two styles combined into one request) — as of the
  // 2026-07-26 rework, Hybrid is a single record with two direct Styles
  // links: customized_style (Style A, same field Regular uses) and
  // additional_customized_style (Style B). No more self-link to 2 structural
  // child records.
  IS_HYBRID:             'fld1stC4sHuPT4pT4',
  ADDITIONAL_CUSTOMIZED_STYLE: 'fldFGUnQBWnfiGwkE',
  ADDITIONAL_SELF_USAGE: 'fldSO6qbpDzk0wUJD', // lookup — Style B's own Self Usage, matches self_usage's edit-mode-authoritative role
  HYBRID_STYLE_NAMES:    'fldEGgSq6Tohw9Xvz', // formula — "Style A & Style B", built off customized_style + additional_customized_style directly
  // Added 2026-08-03 for the Recap Doc — lookups through customized_style /
  // additional_customized_style onto the Styles table's own Style Photo
  // (fldall9IlP5wEMb2W), Price (flduZuxPxxMqXzNxD), and Notes/description
  // (fldvF8u5jMhimDV3a). Also the CR's own internal_approval_status — the
  // Recap Doc only shows a customization request once it reaches "Approved".
  INTERNAL_APPROVAL_STATUS:      'fldEfOYgxOhyDiMEH',
  CUSTOMIZED_STYLE_PHOTO:        'fldk9mGhKVqFSqEHj',
  CUSTOMIZED_STYLE_PRICE:        'fldP96DELHa3L3Q5p',
  CUSTOMIZED_STYLE_NOTES:        'fldHFdzy0yhofTRq1',
  ADDITIONAL_CUSTOMIZED_STYLE_PHOTO: 'fldm8YULRQaMmj0tZ',
  ADDITIONAL_CUSTOMIZED_STYLE_PRICE: 'flddMBFbLRzBOsvnx',
  ADDITIONAL_CUSTOMIZED_STYLE_NOTES: 'fldJVW0TxKH0vRVvj',
} as const;

const PRICING = {
  TYPE:      'fld4XT7jm39PR6l1V',
  IS_ACTIVE: 'fldWqVqCtMi5MVq9T',
  PRICE:     'fldoFj5qMu6IRX53d',
  PERCENT:   'fldzVvl1ZMSfEGQdQ',
  MULTIPLE:  'fldEKZTpnJ5Y1gjOw',
  // Whether this specific customization/pricing row needs an Embroidery
  // Amount to compute its formula — Embroidery Amount only shows on the
  // request form when at least one selected row has this checked.
  IS_EMBROIDERY: 'fldXgmTz2GNW969Mw',
} as const;

// Proposals table — created in the sandbox base for "Customization Proposal
// Document Generation" (JuliMigLui37089). Field IDs are hardcoded (not
// discovered via getFieldIfExists by name) since this table was created
// directly via the Airtable API for this feature.
const PROPOSAL = {
  CLIENT:                     'fldlZNjszbY9gI1PT',
  SALES_ASSOCIATE:            'fld3JGsN4n496CT0q',
  SOURCE_CUSTOMIZATION:       'fldeXnhSr8r6rw78k',
  SNAPSHOT_STYLE:             'fldU3ODl61opCWqex',
  SNAPSHOT_CUSTOMIZATIONS:    'fldxLnC3GcflnLix2',
  SNAPSHOT_EMBROIDERY_AMOUNT: 'fldnTacwv9Ie43ySX',
  SNAPSHOT_PRICING:           'fldh80zFrkHTPZ8T8',
  UNSIGNED_DOCUMENT:          'fldlUFhODjgDyeOFg',
  SIGNED_DOCUMENT:            'fld1Z37faYGD7jDia',
  STATUS:                     'fldW0GbVWnhZGUAtv',
  GENERATED_AT:               'fldHoui3whPBjKs5x',
} as const;

// ─── External field source map ─────────────────────────────────────────────────
type FieldSource = 'acuity' | 'shopify' | 'apparel_magic';

const FIELD_SOURCE: Record<string, FieldSource> = {
  // Acuity — DF Clients
  [CLIENT.FULL_NAME]:          'acuity',
  [CLIENT.FIRST_NAME]:         'acuity',
  [CLIENT.LAST_NAME]:          'acuity',
  [CLIENT.PHONE]:              'acuity',
  [CLIENT.WEDDING]:            'acuity',
  [CLIENT.WEDDING_IF_NOT_SET]: 'acuity',
  [CLIENT.WEDDING_LOCATION]:   'acuity',
  [CLIENT.WEDDING_PLANNER]:    'acuity',
  [CLIENT.FAV_STYLES_ACUITY]:  'acuity',
  [CLIENT.PERSONAL_NOTES]:     'acuity',
  // Shopify — DF Clients
  [CLIENT.EMAIL]:              'shopify',
  [CLIENT.SIZE]:               'shopify',
  // Acuity — DF Appointments
  [APPT.TIME]:                 'acuity',
  [APPT.CLIENT_LINK]:          'acuity',
  [APPT.ROOM_LINK]:            'acuity',
  [APPT.STATUS]:               'acuity',
} as const;

function isFieldReadOnlyBySource(fieldId?: string): boolean {
  return !!fieldId && fieldId in FIELD_SOURCE;
}

// ─── Attachment form URL ───────────────────────────────────────────────────
// FALLBACK ONLY (2026-08-05) — the real, environment-correct URL now comes
// from the resources table's "attachments_form" record (RESOURCES.URL,
// resolved live in RecapApp as attachmentFormUrl and threaded down as a
// prop), since sandbox and production need genuinely different URLs
// (different base ID, same page ID) and a hardcoded string can only ever
// be right for one of them. This constant only matters if that resources
// record can't be found yet (e.g. it doesn't exist in some environment) —
// same defensive role RECAP_FOOTER_LOGO_DATA_URI plays for the logo.
// Confirmed live (2026-08-05): this hardcoded value's base ID
// (appUC2NFAlURayLx9) does NOT match the sandbox resources record's own
// URL (appMmEE4zyHMGhkkd — the actual sandbox base this interface runs
// against). Left as-is rather than silently "corrected" — flag to Julia
// if this was ever actually a different, intentional shared base.
const ATTACHMENT_FORM_URL_FALLBACK = 'https://airtable.com/appUC2NFAlURayLx9/pagRXpKT2IMcjQwqo/form';

// Used for both the unsigned copy (right after "Generate Proposal") and the
// signed copy (from the Proposals list) — same form, different `type` value.
// The automations/danielle_frankel_studios/attachment_router.js automation
// reads customization_proposal (a direct link to this exact Proposal
// record) + type to route the attachment onto the right field. `hide_*`
// (paired with `prefill_*`) makes Airtable
// hide that field on the form entirely, leaving only the file picker visible.
type ProposalAttachmentType = 'Customization Proposal' | 'Signed Proposal';
// attachments.customization_proposal links directly to the Proposals table
// (not to Customizations) — proposalId here is a Proposals record ID.
// baseUrl is the resolved (or fallback) form URL — see
// ATTACHMENT_FORM_URL_FALLBACK's comment above for why this isn't just a
// module constant anymore.
function buildProposalAttachmentFormUrl(baseUrl: string, clientId: string, proposalId: string, type: ProposalAttachmentType): string {
  const url = new URL(baseUrl);
  url.searchParams.set('prefill_client', clientId);
  url.searchParams.set('hide_client', 'true');
  url.searchParams.set('prefill_customization_proposal', proposalId);
  url.searchParams.set('hide_customization_proposal', 'true');
  url.searchParams.set('prefill_type', type);
  url.searchParams.set('hide_type', 'true');
  return url.toString();
}

// Recap Doc uses the exact same form + hidden-field mechanism as
// Customization Proposal/Signed Proposal above, but links to the specific
// Appointment record instead of a Proposal (attachments.appointment, a new
// direct link field — see attachment_router.js v1.3.0). DEVIATION (same
// class as ProposalPreviewModal's): the Interface Extensions SDK can't push
// a local File into an attachment field, so this is a two-step handoff too —
// "Generate Recap Doc" only produces the printed PDF, "Upload"/"Add Recap
// Doc" is what actually reaches this form.
//
// appointmentId is the target Appointment's record ID. NOTE (2026-08-05):
// an earlier version of this comment claimed link-field prefill has to
// match the linked table's primary-field display text instead of a record
// ID — that theory was wrong. The Attachments record's `appointment` field
// was coming back empty because the "appointment" field had simply never
// been added to the upload form itself; once it was added, prefilling by
// record ID worked as expected. Left this note so the same wrong theory
// doesn't get "rediscovered" later.
function buildRecapDocAttachmentFormUrl(baseUrl: string, clientId: string, appointmentId: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('prefill_client', clientId);
  url.searchParams.set('hide_client', 'true');
  url.searchParams.set('prefill_customization_proposal', '');
  url.searchParams.set('hide_customization_proposal', 'true');
  url.searchParams.set('prefill_type', 'Recap Doc');
  url.searchParams.set('hide_type', 'true');
  url.searchParams.set('prefill_appointment', appointmentId);
  url.searchParams.set('hide_appointment', 'true');
  return url.toString();
}

// ─── Customization status steps ───────────────────────────────────────────────
const CUSTOM_STATUS_STEPS = [
  'Sent to Production',
  'Pattern Making',
  'Ready to Cut',
  'Making at DF',
  'At Factory',
  'Need Info',
  'Complete',
] as const;

// ─── Rich text helper ─────────────────────────────────────────────────────────
// Airtable richText fields require an object with a `markdown` key when writing.
function toRichText(plain: string): { markdown: string } {
  return { markdown: plain };
}
function fromRichText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'markdown' in val) {
    return (val as { markdown: string }).markdown ?? '';
  }
  return '';
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDisplay(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(d);
}
function fmtNYTime(d: Date): string {
  const p = new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York', hour:'numeric', minute:'2-digit', hour12:true }).formatToParts(d);
  const hr = p.find(x=>x.type==='hour')?.value??'0';
  const mn = p.find(x=>x.type==='minute')?.value??'00';
  const ap = (p.find(x=>x.type==='dayPeriod')?.value??'').toLowerCase();
  return `${hr}:${mn}${ap}`;
}
function fmtFriendly(s: string|null|undefined): string {
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1]!, +m[2]!-1, +m[3]!) : new Date(s);
  if (isNaN(d.getTime())) return s;
  const month = new Intl.DateTimeFormat('en-US', { month:'long' }).format(d);
  const day = d.getDate();
  const v = day%100;
  const ord = (['th','st','nd','rd'][(v-20)%10]??['th','st','nd','rd'][v]??'th');
  return `${month} ${day}${ord}, ${d.getFullYear()}`;
}
// ─── Lookup unwrapping (main-list Wedding Date / Favorite Styles columns) ─────
// This runtime returns a multipleLookupValues cell as an array of one entry
// per linked record — either a plain value, or an object shaped like
// { linkedRecordId, value }, where `value` can itself be nested again for a
// lookup whose source is a link field (e.g. Favorite Styles, which links to
// Styles). Same underlying quirk documented in did_not_convert.tsx's
// unwrapLookupString and calligraphy_cards.tsx's unwrapLinkedNames — recurse
// and collect rather than assuming a fixed one-level shape.
function unwrapLookupString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const v of value) { const s = unwrapLookupString(v); if (s) return s; }
    return null;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name.trim() || null;
    if ('value' in obj) return unwrapLookupString(obj.value);
  }
  return null;
}
// Same nested-lookup quirk as unwrapLookupString, but generic (non-string)
// values — used for the Recap Doc's new customized_style_photo/price/notes
// lookups (attachment arrays, currency numbers, multiline text), which
// unwrapLookupString can't handle since it only ever returns strings.
// Returns the first genuinely present value found, unwrapping one level of
// { linkedRecordId, value } if present.
function firstLookupValue<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    for (const v of raw) {
      if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
        const inner = (v as Record<string, unknown>).value;
        if (inner != null) return inner as T;
      } else if (v != null) {
        return v as T;
      }
    }
    return null;
  }
  return raw as T;
}
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
// Same as fmtFriendly but without the ordinal suffix — "July 4, 2026".
function fmtUSDate(s: string|null|undefined): string {
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1]!, +m[2]!-1, +m[3]!) : new Date(s);
  if (isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat('en-US', { month:'long', day:'numeric', year:'numeric' }).format(d);
}
// "July 13, 2026 at 9:10pm" — date (no ordinal) + 12-hour time, lowercase am/pm.
function fmtUSDateTime12h(s: string|null|undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  const datePart = new Intl.DateTimeFormat('en-US', { month:'long', day:'numeric', year:'numeric' }).format(d);
  const parts = new Intl.DateTimeFormat('en-US', { hour:'numeric', minute:'2-digit', hour12:true }).formatToParts(d);
  const hour = parts.find(p=>p.type==='hour')?.value ?? '';
  const minute = parts.find(p=>p.type==='minute')?.value ?? '';
  const dayPeriod = (parts.find(p=>p.type==='dayPeriod')?.value ?? '').toLowerCase();
  return `${datePart} at ${hour}:${minute}${dayPeriod}`;
}
// "July 4th, 2026 11:55pm" — ordinal date (same suffix logic as fmtFriendly)
// + 12-hour time, no "at", lowercase am/pm, no space before it. Used only by
// the Recap Doc's Appointment field per the Figma spec.
// Formats a dateTime cell in the studio's own America/New_York timezone
// (matching fmtNYTime elsewhere in this file and the underlying Airtable
// field's own timeZone config), NOT the viewer's browser/OS timezone — the
// previous version omitted `timeZone` entirely, so this could show the wrong
// hour, or even the wrong day for an appointment near midnight, to anyone
// viewing the page from outside America/New_York (2026-08-07 fix).
function fmtRecapAppointmentDisplay(s: string|null|undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month:'long', day:'numeric', year:'numeric',
    hour:'numeric', minute:'2-digit', hour12:true,
  }).formatToParts(d);
  const get = (t:string) => parts.find(p=>p.type===t)?.value ?? '';
  const month = get('month');
  const day = +get('day');
  const year = get('year');
  const v = day%100;
  const ord = (['th','st','nd','rd'][(v-20)%10]??['th','st','nd','rd'][v]??'th');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod').toLowerCase();
  return `${month} ${day}${ord}, ${year} ${hour}:${minute}${dayPeriod}`;
}

// ─── Proposal filename ─────────────────────────────────────────────────────
// client_style_date_time, all snake_case — used both as the suggested
// filename for Print → Save as PDF (via document.title, the only lever a
// web page has over that dialog's default filename) and as the `download`
// attribute on the Unsigned/Signed Proposal Download links.
function toSnakeCase(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
function buildProposalFilename(clientName: string, styleName: string, date: Date): string {
  const datePart = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  const timePart = `${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;
  return [toSnakeCase(clientName), toSnakeCase(styleName), datePart, timePart].filter(Boolean).join('_');
}
function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx) : '';
}

// This interface runs inside an iframe (Airtable Interface Extension), and
// that iframe is cross-origin from the airtable.com tab — confirmed by
// testing: attempting window.top.document.title throws (blocked by the
// browser's same-origin policy), so the "Save as PDF" dialog's suggested
// filename (read from the TOP-level document's title, not the iframe's)
// can NEVER be set from code running in here. There is no further
// JavaScript-side lever for this — document.title is kept purely for
// same-origin/non-iframe contexts where it happens to work, but in the
// actual deployment this print dialog will keep showing the browser tab's
// own title. Users who need a specific filename must rename the saved PDF
// themselves; the Download buttons for already-uploaded documents (see
// ProposalAttachmentField) are the only place this app can truly control
// the filename, via the `download` attribute.
function setPrintDocumentTitle(name: string): void {
  document.title = name;
}
function restorePrintDocumentTitle(name: string): void {
  document.title = name;
}
function parseFlexDate(s: string): Date|null {
  if (!s.trim()) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) { const d = new Date(+iso[1]!,+iso[2]!-1,+iso[3]!); return isNaN(d.getTime())?null:d; }
  const d = new Date(s);
  return isNaN(d.getTime())?null:d;
}
function weeksUntil(weddingIso: string|null|undefined): number|null {
  if (!weddingIso) return null;
  const d = parseFlexDate(weddingIso);
  if (!d) return null;
  const diff = d.getTime() - Date.now();
  return Math.floor(diff / (1000*60*60*24*7));
}
// Styles table (tbl0hWIRBbcB4UkVC) — Style Photo, used by the Recap Doc's
// per-style thumbnail. Not part of the STYLES const elsewhere in this file
// (there isn't one — Styles fields are referenced ad hoc via
// stylesBasePriceField/stylesSelfUsageField props), so this is its own
// hardcoded ID, verified live against the sandbox base.
const STYLES_PHOTO_FIELD_ID = 'fldall9IlP5wEMb2W';
// Styles.Category — used to exclude Alterations-category "styles" (they
// aren't real gown/dress favorites) from the Favorite Styles selector.
const STYLES_CATEGORY_FIELD_ID = 'fld0eUrQtGo5zFrbe';
// TEMPORARY (2026-08-05, per Axel/Julia) — Styles.description formula
// field, hardcoded to the same lorem-ipsum placeholder for every style
// while the web team ("Cobalt") builds the real sync from the site's own
// style descriptions into Airtable. The Recap Doc's per-style description
// reads this field directly instead of the CUSTOMIZED_STYLE_NOTES/
// ADDITIONAL_CUSTOMIZED_STYLE_NOTES lookups (which point at Styles.Notes,
// fldvF8u5jMhimDV3a — the pre-Cobalt field) purely so we can see real
// pagination/layout with placeholder text before that sync exists. Swap
// this back to the lookups (or to whatever field Cobalt's sync lands in)
// once real descriptions are available.
const STYLES_DESCRIPTION_PLACEHOLDER_FIELD_ID = 'fldjBgzkomQ26lSzV';
function isConsultation(label: string): boolean {
  return label.toLowerCase().includes('consultation');
}
function shortTypeLabel(full: string): string {
  return full.replace(/^(NY\s*-\s*(260|TRIBECA)\s*-\s*|LA\s*-\s*)/i,'').replace(/\s*-\s*\d+\s*Minutes?\s*$/i,'').trim();
}

// ─── Safe cell helpers ────────────────────────────────────────────────────────
function getStr(rec: AirtableRecord, fieldId: string): string {
  try {
    const tbl = rec as any;
    const field = tbl._table?.getFieldIfExists(fieldId);
    if (!field) return '';
    return rec.getCellValueAsString(field) ?? '';
  } catch { return ''; }
}
function getVal<T>(rec: AirtableRecord, fieldId: string): T|null {
  try {
    const tbl = rec as any;
    const field = tbl._table?.getFieldIfExists(fieldId);
    if (!field) return null;
    return rec.getCellValue(field) as T|null;
  } catch { return null; }
}

// ─── Pricing math ──────────────────────────────────────────────────────────────
// A Customization Pricing row prices itself one of three ways, in priority
// order: a flat dollar amount, a percentage of `basisAmount` (stored as a 0–1
// fraction), or a "multiple" fee scaled by multiplierFactor (Self Usage × the
// Amount-of-Embroidery/Paint/Lace tier — see computeMultiplierFactor below).
// Mirrors the same rule used in the Customizations detail interface, so a
// percent- or multiplier-based item prices identically in both places.
function resolvePricingRowAmount(
  r: AirtableRecord,
  priceField: ReturnType<Table['getFieldIfExists']>,
  percentField: ReturnType<Table['getFieldIfExists']>,
  multipleField: ReturnType<Table['getFieldIfExists']>,
  basisAmount: number,
  multiplierFactor: number
): { amount: number; label: string | null; needsAmount: boolean } {
  if (priceField) {
    const p = r.getCellValue(priceField);
    if (typeof p === 'number' && p > 0) return { amount: p, label: null, needsAmount: false };
  }
  if (percentField) {
    const p = r.getCellValue(percentField);
    // A percent-based row's dollar amount is derived, not stored — surface the
    // rate itself (e.g. "20% base cost") next to the name.
    if (typeof p === 'number' && p > 0) return { amount: basisAmount * p, label: `${Math.round(p * 100)}% base cost`, needsAmount: false };
  }
  if (multipleField) {
    const raw = r.getCellValue(multipleField);
    // The stored Multiple Fee is a base rate, not the final price — the real
    // formula scales it by Self Usage and the embroidery/paint/lace tier.
    // Surface the raw rate and the scaling factor as a label (e.g.
    // "$1,500.00 x 0.67") since the Price column shows the scaled amount.
    if (typeof raw === 'number' && raw > 0) {
      // multiplierFactor is 0 exactly when Embroidery/Paint/Lace Amount isn't
      // selected yet (embroideryFactor is 0 only for a blank tier — Light/
      // Medium/Full always resolve non-zero) — this item's real price can't
      // be calculated until that's chosen.
      const needsAmount = multiplierFactor === 0;
      return { amount: raw * multiplierFactor, label: `${formatCurrency(raw)} x ${multiplierFactor.toFixed(2)}`, needsAmount };
    }
  }
  return { amount: 0, label: null, needsAmount: false };
}

// IF({Customization - Multiple Fee}, {Customization - Multiple Fee}, 0)
//   * IF({Self Usage}, {Self Usage}, 1)
//   * SWITCH(LOWER({Amount of Embroidery/Paint/Lace} & ""), "light", 0.33, "medium", 0.67, "full", 1, 0)
// The raw Multiple Fee term is applied where it's read, in
// resolvePricingRowAmount above — this only covers the Self Usage ×
// embroidery-tier portion, constant across every multiplier-priced line item
// on the same request.
function computeMultiplierFactor(selfUsage: number, embroidery: string | null): number {
  const selfUsageFactor = selfUsage && selfUsage !== 0 ? selfUsage : 1;
  const embroideryFactor = embroidery === 'Light' ? 0.33 : embroidery === 'Medium' ? 0.67 : embroidery === 'Full' ? 1 : 0;
  return selfUsageFactor * embroideryFactor;
}

function formatCurrency(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A lookup/rollup field's raw getCellValue() can be a wrapped object rather
// than a plain number (a bare `as number` cast silently carries that object
// through — formatCurrency on it then reads as blank/garbage rather than the
// real price). getCellValueAsString() already renders it correctly, so parse
// the number back out of that formatted string instead of trusting the raw
// cell shape. Same fix as the Customizations detail interface's Base Price.
//
// The base's number format can be US-style (1,990.00) or EU/LatAm-style
// (1.990,00) — whichever of "." or "," appears LAST is the real decimal
// separator only if followed by 1–2 digits (currency cents); everything
// before it is a thousands-grouping mark and gets stripped. If the trailing
// run is 3+ digits (or there's no separator), there is no decimal part.
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

// Matches a field/choice name against a concept keyword, normalized (lowercase,
// non-alphanumeric stripped) so naming drift doesn't silently break the match.
function normalizedIncludes(value: string, keyword: string): boolean {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').includes(keyword);
}

function getSingleSelectName(cell: unknown): string {
  if (!cell) return '';
  if (typeof cell === 'object' && 'name' in (cell as object)) return (cell as { name: string }).name ?? '';
  return String(cell);
}

// Airtable color token → saturated accent hex, same mapping used in the
// Customizations detail interface so Pre-Approval pills read identically
// across both interfaces.
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

function ApprovalPill({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  if (!status) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
  const hex = colorMap[status] ?? '#9CA3AF';
  return (
    <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{ backgroundColor: hex + '20', color: hex, borderColor: hex + '55' }}>
      {status}
    </span>
  );
}

// ─── Source dot + FieldLabel ──────────────────────────────────────────────────
const SOURCE_DOT_COLOR: Record<FieldSource, string> = {
  acuity:        'bg-purple-500',
  shopify:       'bg-green-500',
  apparel_magic: 'bg-amber-500',
};

function FieldLabel({ label, fieldId, className }: { label: string; fieldId?: string; className?: string }) {
  const source = fieldId ? FIELD_SOURCE[fieldId] : undefined;
  return (
    <div className={`flex items-center gap-1.5 mb-1.5 ${className ?? ''}`}>
      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium">{label}</span>
      {source && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SOURCE_DOT_COLOR[source]}`} />}
    </div>
  );
}

// ─── Editable field wrappers ──────────────────────────────────────────────────
// Each wrapper checks isFieldReadOnlyBySource(fieldId) and falls back to a
// plain read-only display whenever the field comes from an external integration.
const _inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1B1813] text-gray-900 dark:text-[#F3EFE6] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]';

interface EditableTextProps {
  label: string; fieldId?: string; readOnly?: boolean;
  value: string; onChange?: (v: string) => void; onBlur?: () => void;
  placeholder?: string; className?: string;
}
function EditableText({ label, fieldId, readOnly, value, onChange, onBlur, placeholder, className }: EditableTextProps) {
  const effectiveRO = readOnly || isFieldReadOnlyBySource(fieldId);
  return (
    <div className={className}>
      <FieldLabel label={label} fieldId={fieldId} />
      {effectiveRO
        ? <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5 min-h-[38px] flex items-center">{value || '—'}</div>
        : <input value={value} onChange={e => onChange?.(e.target.value)} onBlur={onBlur}
            placeholder={placeholder} className={_inputCls} />
      }
    </div>
  );
}

interface EditableTextareaProps {
  label: string; fieldId?: string; readOnly?: boolean;
  value: string; onChange?: (v: string) => void; onBlur?: () => void;
  placeholder?: string; rows?: number;
}
function EditableTextarea({ label, fieldId, readOnly, value, onChange, onBlur, placeholder, rows = 3 }: EditableTextareaProps) {
  const effectiveRO = readOnly || isFieldReadOnlyBySource(fieldId);
  return (
    <div>
      <FieldLabel label={label} fieldId={fieldId} />
      {effectiveRO
        ? <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5 whitespace-pre-wrap">{value || '—'}</div>
        : <textarea value={value} onChange={e => onChange?.(e.target.value)} onBlur={onBlur}
            placeholder={placeholder} rows={rows} className={`${_inputCls} resize-none`} />
      }
    </div>
  );
}

interface EditableNumberProps {
  label: string; fieldId?: string; readOnly?: boolean;
  value: string; onChange?: (v: string) => void; onBlur?: () => void; placeholder?: string;
}
function EditableNumber({ label, fieldId, readOnly, value, onChange, onBlur, placeholder }: EditableNumberProps) {
  const effectiveRO = readOnly || isFieldReadOnlyBySource(fieldId);
  return (
    <div>
      <FieldLabel label={label} fieldId={fieldId} />
      {effectiveRO
        ? <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5 min-h-[38px] flex items-center">{value || '—'}</div>
        : <input type="number" value={value} onChange={e => onChange?.(e.target.value)} onBlur={onBlur}
            placeholder={placeholder}
            className={`${_inputCls} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            style={{ MozAppearance: 'textfield' } as React.CSSProperties} />
      }
    </div>
  );
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────
interface MiniCalProps { selected: Date; onSelect: (d:Date)=>void; onClose: ()=>void; }
function MiniCalendar({ selected, onSelect, onClose }: MiniCalProps) {
  const [view, setView] = useState(new Date(selected));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e:MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return ()=>document.removeEventListener('mousedown', h);
  }, [onClose]);
  const y=view.getFullYear(), m=view.getMonth();
  const start = (new Date(y,m,1).getDay() + 6) % 7;
  const total = new Date(y,m+1,0).getDate();
  const days: (number|null)[] = [];
  for (let i=0;i<start;i++) days.push(null);
  for (let d=1;d<=total;d++) days.push(d);
  const todayStr = fmtDateKey(new Date());
  const selStr = fmtDateKey(selected);
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <button onClick={()=>setView(new Date(y,m-1,1))} className="p-1 hover:bg-gray-100 hover:dark:bg-white/10 rounded"><CaretLeftIcon size={14} className="text-gray-600 dark:text-gray-400"/></button>
        <span className="text-sm font-semibold text-gray-800 dark:text-[#F3EFE6]">{new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(view)}</span>
        <button onClick={()=>setView(new Date(y,m+1,1))} className="p-1 hover:bg-gray-100 hover:dark:bg-white/10 rounded"><CaretRightIcon size={14} className="text-gray-600 dark:text-gray-400"/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 dark:text-gray-500 mb-1">
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day,i) => {
          if (!day) return <div key={`e${i}`} className="py-1"/>;
          const ds = fmtDateKey(new Date(y,m,day));
          return <button key={day} onClick={()=>{onSelect(new Date(y,m,day));onClose();}}
            className={`py-1 text-xs rounded-full transition-colors ${ds===selStr?'bg-[#D97706] dark:bg-[#FBBF24] text-white':ds===todayStr?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24]':'hover:bg-gray-100 hover:dark:bg-white/10 text-gray-800 dark:text-[#F3EFE6]'}`}>{day}</button>;
        })}
      </div>
      <button onClick={()=>{onSelect(new Date());onClose();}} className="mt-2 w-full text-xs text-[#D97706] dark:text-[#FBBF24] hover:underline">Today</button>
    </div>
  );
}

// ─── FilterDropdown ───────────────────────────────────────────────────────────
interface FilterDropdownProps { label:string; values:string[]; options:string[]; onChange:(v:string[])=>void; }
function FilterDropdown({ label, values, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const hasValue = values.length>0;
  const display = hasValue ? (values.length===1?(values[0]??label):`${values.length} selected`) : label;
  const toggle = (o:string) => onChange(values.includes(o)?values.filter(v=>v!==o):[...values,o]);
  return (
    <div className="flex items-center gap-2">
      <div ref={ref} className="relative">
        <button type="button" onClick={()=>setOpen(o=>!o)}
          className={`inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#25211A] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${hasValue?'border-[#D97706] dark:border-[#FBBF24] text-[#D97706] dark:text-[#FBBF24]':'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:dark:border-gray-500'}`}>
          <span className="truncate">{display}</span>
          {hasValue
            ? <XIcon size={14} className="flex-shrink-0 hover:text-red-600 hover:dark:text-red-300"
                onClick={(e)=>{ e.stopPropagation(); onChange([]); }}/>
            : <CaretDownIcon size={14} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open?'rotate-180':''}`}/>
          }
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg max-h-[260px] overflow-y-auto w-[240px] py-1">
            <button type="button" onClick={()=>{onChange([]);setOpen(false);}}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${values.length===0?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium':'text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'}`}>All</button>
            {options.map(o=>(
              <label key={o} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={values.includes(o)} onChange={()=>toggle(o)} className="accent-[#D97706] dark:accent-[#FBBF24]"/>
                <span className="truncate">{o}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StylesDropdown ───────────────────────────────────────────────────────────
interface StylesDropdownProps { selected:string[]; available:string[]; onToggle:(s:string)=>void; }
function StylesDropdown({ selected, available, onToggle }: StylesDropdownProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const filtered = useMemo(()=>q.trim()?available.filter(s=>s.toLowerCase().includes(q.toLowerCase())):available,[available,q]);
  // Dropdown width sized to the longest available style name (+ padding),
  // not a fixed full-width box — "corto pero que quepa el nombre más largo".
  const widthCh = useMemo(()=>Math.max(14, ...available.map(s=>s.length)) + 3, [available]);

  return (
    <div ref={ref} className="relative inline-block">
      {/* No checkbox/border chip chrome here — selected styles are plain
          highlighted text, one size tier up from the dropdown list rows.
          The "+" (25% smaller than the standard compact attachment button)
          always sits right after the last selected style, opening the
          dropdown — it's not a separate "click anywhere" box anymore. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {selected.map(s=>(
          <span key={s} className="group inline-flex items-center gap-1 text-[#D97706] dark:text-[#FBBF24] bg-[#FEF3C7] dark:bg-[#3A2E12] rounded-md text-sm font-semibold px-2 py-1">
            {s}
            <button type="button" onClick={()=>onToggle(s)} className="text-[#D97706]/50 dark:text-[#FBBF24]/50 hover:text-[#D97706] hover:dark:text-[#FBBF24]">
              <XIcon size={12}/>
            </button>
          </span>
        ))}
        <button type="button" onClick={()=>setOpen(o=>!o)} title="Add style"
          className="w-[27px] h-[27px] flex items-center justify-center text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors flex-shrink-0">
          <PlusIcon size={12}/>
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-[260px] overflow-hidden flex flex-col" style={{ width: `${widthCh}ch` }}>
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <input type="text" placeholder="Search styles…" value={q} onChange={e=>setQ(e.target.value)} autoFocus
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24]"/>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(s=>{
              const isSel = selected.includes(s);
              return (
                <button key={s} type="button" onClick={()=>onToggle(s)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${isSel?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium':'text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'}`}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AttachmentSection ────────────────────────────────────────────────────────
interface AttachSectionProps {
  label: string;
  type: 'Measurements'|'Appointment Photo';
  existing: Array<{id:string;url:string;filename:string;thumbnails?:{small?:{url:string}}}> | null;
  clientId: string | null;
  // Resolved (or fallback) attachments form URL — see
  // ATTACHMENT_FORM_URL_FALLBACK's comment for why this is a prop instead
  // of a module constant.
  formBaseUrl: string;
  // Square, icon-only "+" button instead of the icon+label pill — used where
  // this section shares a row with other equally-sized attachment fields
  // (Measurement Photo / Appointment Photo / Recap Doc row).
  compact?: boolean;
}
function AttachmentSection({ label, type, existing, clientId, formBaseUrl, compact }: AttachSectionProps) {
  const hasExisting = existing && existing.length > 0;
  const openForm = () => {
    const url = new URL(formBaseUrl);
    if (clientId) url.searchParams.set('prefill_client', clientId);
    url.searchParams.set('prefill_type', type);
    // Hidden even though this form/route doesn't use it — matches the Recap
    // Doc/Proposal upload forms' convention of hiding every field but the
    // file picker.
    url.searchParams.set('hide_customization_proposal', 'true');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };
  if (compact) {
    return (
      <div>
        {hasExisting && (
          <div className="flex gap-2 flex-wrap mb-2">
            {existing!.map(a=>(
              <div key={a.id} onClick={()=>window.open(a.url,'_blank','noopener,noreferrer')}
                className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0">
                <img src={a.thumbnails?.small?.url??a.url} alt={a.filename} className="w-full h-full object-cover"/>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={openForm} disabled={!clientId} title={label}
          className="w-[27px] h-[27px] flex items-center justify-center text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <PlusIcon size={12}/>
        </button>
      </div>
    );
  }
  return (
    <div>
      {hasExisting && (
        <div className="flex gap-2 flex-wrap mb-3">
          {existing!.map(a=>(
            <div key={a.id} onClick={()=>window.open(a.url,'_blank','noopener,noreferrer')}
              className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0">
              <img src={a.thumbnails?.small?.url??a.url} alt={a.filename} className="w-full h-full object-cover"/>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={openForm} disabled={!clientId}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <UploadIcon size={14} className="text-gray-500 dark:text-gray-400"/>{hasExisting?'Add More':label}
      </button>
    </div>
  );
}

// ─── Hybrid customizations ─────────────────────────────────────────────────────
// A Hybrid request is a single Customization record combining two styles —
// customized_style (Style A) + additional_customized_style (Style B), both
// direct links to Styles (2026-07-26 rework, replacing the old parent + 2
// structural child records model). Customizations, Embroidery/Paint/Lace
// Amount, and Additional Details all live once, on this same record, priced
// against whichever of the two styles has the higher Base Price — same
// fields Regular uses (per Julia, 2026-07-24: "the only difference between
// hybrid and regular is that hybrid is a merge of two styles"). The Grand
// Total is the 85% merge surcharge over the higher Base Price, plus that
// Customization Total.
interface HybridCustomizationValue {
  pricingIds: string[];
  embroidery: string | null;
  detail: string;
}
function emptyHybridCustomization(): HybridCustomizationValue {
  return { pricingIds: [], embroidery: null, detail: '' };
}

// Lives in the parent (PostAppointmentModal), not CustomizationModal itself
// — so dismissing the "add" modal (outside click, Escape, closing and
// reopening) doesn't lose whatever the user already entered. Only resets on
// a successful submit; a page refresh or navigating away clears it
// naturally, since it's still just in-memory React state (per Julia,
// 2026-07-27). Not used at all in "edit" mode — that already autosaves
// straight to the record on every change, so there's nothing to lose.
interface CustomizationAddDraft {
  kind: 'Hybrid' | 'Regular' | null;
  styleId: string | null;
  pricingIds: string[];
  detail: string;
  embroidery: string | null;
  hybridStyleIds: [string | null, string | null];
  hybridCustomization: HybridCustomizationValue;
}
function emptyCustomizationAddDraft(): CustomizationAddDraft {
  return {
    kind: null, styleId: null, pricingIds: [], detail: '', embroidery: null,
    hybridStyleIds: [null, null], hybridCustomization: emptyHybridCustomization(),
  };
}
// The 85%-over-the-higher-style rule, applied to a pair of Base Prices.
function computeHybridCombinedTotal(basePrice1: number, basePrice2: number): number {
  return Math.max(basePrice1, basePrice2) * 1.85;
}

// ─── CustomizationStagePipeline ───────────────────────────────────────────────
interface CStagePipelineProps { currentStatus: string; onChange: (s:string)=>void; }
function CustomizationStagePipeline({ currentStatus, onChange }: CStagePipelineProps) {
  const idx = CUSTOM_STATUS_STEPS.indexOf(currentStatus as any);
  return (
    <div className="mb-5">
      <div className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-3">Stage</div>
      <div className="flex items-start overflow-x-auto pb-1">
        {CUSTOM_STATUS_STEPS.map((step, i) => {
          const isCurrent = i === idx;
          const isPast = i < idx;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center cursor-pointer min-w-0" onClick={()=>onChange(step)}>
                {isPast && (
                  <div className="w-6 h-6 rounded-full bg-emerald-700 dark:bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <CheckIcon size={12} weight="bold" className="text-white"/>
                  </div>
                )}
                {isCurrent && (
                  <div className="w-6 h-6 rounded-full border-2 border-emerald-700 dark:border-emerald-500 bg-white dark:bg-[#25211A] flex items-center justify-center flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-700 dark:bg-emerald-500"/>
                  </div>
                )}
                {!isPast && !isCurrent && (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#25211A] flex-shrink-0 hover:border-gray-400 hover:dark:border-gray-500 transition-colors"/>
                )}
                <span className={`text-[10px] mt-1.5 text-center leading-tight max-w-[60px] ${isCurrent?'text-emerald-700 dark:text-emerald-400 font-semibold':'text-gray-400 dark:text-gray-500'}`}>
                  {step}
                </span>
              </div>
              {i < CUSTOM_STATUS_STEPS.length-1 && (
                <div className={`flex-1 h-0.5 mt-3 mx-1 min-w-[8px] ${i<idx?'bg-emerald-700 dark:bg-emerald-500':'bg-gray-200 dark:bg-white/10'}`}/>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── PricingLineItemsTable ─────────────────────────────────────────────────────
// Invoice-style, searchable breakdown table for the main Customizations
// picker — replaces the old multi-select dropdown. Search adds a row; the
// total row is always shown, even at $0.00 with no line items. (M2M and
// Alterations no longer use this — they're plain checkboxes now, see
// CustomizationModal.)
interface PricingLineItemsTableProps {
  selected: string[];
  pricingRecords: AirtableRecord[] | null;
  pricingTable: Table | null;
  onChange: (ids: string[]) => void;
  preApprovalField: ReturnType<Table['getFieldIfExists']>;
  preApprovalColorMap: Record<string, string>;
  percentField: ReturnType<Table['getFieldIfExists']>;
  multipleField: ReturnType<Table['getFieldIfExists']>;
  basisAmount: number;
  multiplierFactor: number;
}
function PricingLineItemsTable({
  selected, pricingRecords, pricingTable, onChange,
  preApprovalField, preApprovalColorMap, percentField, multipleField, basisAmount, multiplierFactor,
}: PricingLineItemsTableProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      if (ref.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);

  // Rendered via a portal (below) so the panel isn't clipped by the modal's
  // own scrollable body — position tracked in viewport coordinates and kept
  // in sync while open, using the tallest height the viewport allows below
  // the search bar rather than a fixed max-height.
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

  const typeField     = pricingTable?.getFieldIfExists(PRICING.TYPE) ?? null;
  const priceField    = pricingTable?.getFieldIfExists(PRICING.PRICE) ?? null;
  const activeField   = pricingTable?.getFieldIfExists(PRICING.IS_ACTIVE) ?? null;
  // percentField and multipleField come in as props (custom-property bound),
  // not a fixed FIELD_IDS lookup like the rest — see getCustomProperties for
  // why: this interface's connection to the Customization Pricing table
  // doesn't expose either field by their hardcoded IDs (same field IDs DO
  // resolve fine in the Customizations detail interface — Omni's field
  // exposure is per-interface-page-connection, not per-base).

  const selectedItems = useMemo(() => {
    if (!pricingRecords || !typeField) return [];
    return selected.map(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return null;
      const { amount, label, needsAmount } = resolvePricingRowAmount(r, priceField, percentField, multipleField, basisAmount, multiplierFactor);
      return {
        id: r.id,
        name: r.getCellValueAsString(typeField),
        label,
        amount,
        needsAmount,
        approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '',
      };
    }).filter((x): x is { id: string; name: string; label: string | null; amount: number; needsAmount: boolean; approval: string } => x !== null);
  }, [selected, pricingRecords, typeField, priceField, percentField, multipleField, basisAmount, multiplierFactor, preApprovalField]);

  const suggestions = useMemo(() => {
    if (!pricingRecords || !typeField) return [];
    return pricingRecords
      .filter(r => !selected.includes(r.id))
      .filter(r => !activeField || r.getCellValue(activeField) === true)
      .map(r => {
        const { amount, label } = resolvePricingRowAmount(r, priceField, percentField, multipleField, basisAmount, multiplierFactor);
        return { id: r.id, name: r.getCellValueAsString(typeField), label, amount };
      });
  }, [pricingRecords, selected, typeField, activeField, priceField, percentField, multipleField, basisAmount, multiplierFactor]);

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions
      .filter(s => s.name !== 'Other')
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suggestions, query]);

  const totalAmount = useMemo(() => selectedItems.reduce((sum, i) => sum + i.amount, 0), [selectedItems]);

  const addAndClear = (id: string) => { onChange([...selected, id]); setQuery(''); setOpen(false); };
  const remove = (id: string) => onChange(selected.filter(x => x !== id));

  return (
    <div>
      <div ref={ref} className="relative mb-2">
        <div className="relative">
          <MagnifyingGlassIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"/>
          <input type="text" placeholder="Search customizations to add…" value={query}
            onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] transition-colors bg-white dark:bg-[#1B1813] text-gray-900 dark:text-[#F3EFE6]"/>
        </div>
        {open && dropdownPos && createPortal(
          <div ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: dropdownPos.maxHeight }}
            className="z-[60] bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filteredSuggestions.map(s=>(
              <button key={s.id} type="button" onClick={()=>addAndClear(s.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#FEF3C7] dark:hover:bg-[#3A2E12] transition-colors border-b border-gray-50 dark:border-white/5 last:border-0">
                <span>{s.name}{s.label && <span className="text-xs font-medium text-gray-400 dark:text-gray-500"> ({s.label})</span>}</span>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{formatCurrency(s.amount)}</span>
              </button>
            ))}
            {filteredSuggestions.length===0 && <div className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">No matching customizations</div>}
          </div>,
          document.body
        )}
      </div>
      {/* Nothing selected yet — a customization isn't always needed (e.g. a
          Hybrid request that's simply combining two styles), so don't show
          an empty invoice table; just the search bar above is enough. Body
          scrolls internally with a max-height once it grows past a handful
          of rows, so the whole modal doesn't have to be scrolled instead. */}
      {selectedItems.length > 0 && (
        <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 w-8 bg-gray-50 dark:bg-white/5" />
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left bg-gray-50 dark:bg-white/5">Customization</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left bg-gray-50 dark:bg-white/5">Rate</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-center bg-gray-50 dark:bg-white/5">Pre-Approval</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-right bg-gray-50 dark:bg-white/5">Price</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map(item=>(
                  <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 last:border-0">
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={()=>remove(item.id)} aria-label={`Remove ${item.name}`} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors">
                        <XIcon size={13}/>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-[#F3EFE6]">{item.name}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {item.needsAmount ? (
                        <span className="inline-flex items-center gap-1" title="Select the Embroidery, Paint, or Lace Amount to calculate this value.">
                          <span>amount</span>
                          <span className="text-red-500">*</span>
                        </span>
                      ) : (item.label ?? '—')}
                    </td>
                    <td className="px-3 py-2.5 text-center"><ApprovalPill status={item.approval} colorMap={preApprovalColorMap}/></td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200 dark:border-white/10">
                  <td className="px-3 py-2.5"/>
                  <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-[#F3EFE6]">Customization Total</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-[#F3EFE6] text-right">{formatCurrency(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StyleSelectSingle ────────────────────────────────────────────────────────
interface StyleSelectSingleProps { value:string|null; options:Array<{id:string;label:string}>; placeholder:string; onChange:(id:string|null)=>void; }
function StyleSelectSingle({ value, options, placeholder, onChange }: StyleSelectSingleProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      if (ref.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false); setQ('');
    };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);

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

  const filtered = useMemo(()=>q.trim()?options.filter(o=>o.label.toLowerCase().includes(q.toLowerCase())):options,[options,q]);
  const sel = options.find(o=>o.id===value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center justify-between gap-2 bg-white dark:bg-[#25211A] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-left outline-none hover:border-gray-400 hover:dark:border-gray-500 transition-colors">
        <span className={sel?'text-gray-900 dark:text-[#F3EFE6]':'text-gray-400 dark:text-gray-500'}>{sel?.label??placeholder}</span>
        <CaretDownIcon size={13} className={`text-gray-400 dark:text-gray-500 transition-transform ${open?'rotate-180':''}`}/>
      </button>
      {open && dropdownPos && createPortal(
        <div ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: dropdownPos.maxHeight }}
          className="z-[60] bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <div className="relative">
              <MagnifyingGlassIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"/>
              <input type="text" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24]"/>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(o=>(
              <button key={o.id} type="button" onClick={()=>{onChange(o.id);setOpen(false);setQ('');}}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${o.id===value?'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium':'text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5'}`}>{o.label}</button>
            ))}
            {filtered.length===0 && <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">No matches</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── HybridSectionFields ───────────────────────────────────────────────────────
interface HybridSectionFieldsProps {
  title?: string;
  value: HybridCustomizationValue & { styleId?: string | null };
  onChange: (patch: Partial<HybridCustomizationValue & { styleId: string | null }>) => void;
  onDetailBlur?: () => void;
  styleOptions: { id: string; label: string }[];
  pricingRecords: AirtableRecord[] | null;
  pricingTable: Table | null;
  preApprovalField: ReturnType<Table['getFieldIfExists']>;
  preApprovalColorMap: Record<string, string>;
  pricingPercentField: ReturnType<Table['getFieldIfExists']>;
  pricingMultipleField: ReturnType<Table['getFieldIfExists']>;
  basePriceNumber: number;
  multiplierFactor: number;
  showCustomizations?: boolean;
  // False for Hybrid's shared Customizations block — Style A/B are picked
  // separately, inline, above this (2026-07-26 rework).
  showStyle?: boolean;
  // Only meaningful when showCustomizations is true: Embroidery Amount
  // itself only shows once at least one selected customization/pricing row
  // needs it (Pricing table's own is_embroidery checkbox).
  embroideryApplicable?: boolean;
}
// Every field a Regular customization request asks for — Style,
// Customizations, Embroidery Amount (last, only when applicable),
// Additional Details. Also reused for Hybrid's shared Customizations block
// (showStyle=false — Style A/B are picked separately, above), so the two
// flows can never visually drift apart.
function HybridSectionFields({
  title, value, onChange, onDetailBlur,
  styleOptions, pricingRecords, pricingTable, preApprovalField, preApprovalColorMap,
  pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor,
  showCustomizations = true, showStyle = true, embroideryApplicable = false,
}: HybridSectionFieldsProps) {
  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1B1813] text-gray-900 dark:text-[#F3EFE6] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]';
  const embroideryOptions = [{ id: 'Light', label: 'Light' }, { id: 'Medium', label: 'Medium' }, { id: 'Full', label: 'Full' }];
  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-4">
      {title && <div className="font-semibold text-base text-gray-900 dark:text-[#F3EFE6]">{title}</div>}

      {showStyle && (
        <div>
          <span className={labelCls}>Style</span>
          <StyleSelectSingle value={value.styleId ?? null} options={styleOptions} placeholder="Select a style…" onChange={id => onChange({ styleId: id })} />
        </div>
      )}

      {showCustomizations && (
        <div>
          <span className={labelCls}>Customizations</span>
          <PricingLineItemsTable
            selected={value.pricingIds}
            pricingRecords={pricingRecords}
            pricingTable={pricingTable}
            onChange={ids => onChange({ pricingIds: ids })}
            preApprovalField={preApprovalField}
            preApprovalColorMap={preApprovalColorMap}
            percentField={pricingPercentField}
            multipleField={pricingMultipleField}
            basisAmount={basePriceNumber}
            multiplierFactor={multiplierFactor}
          />
        </div>
      )}

      {/* Always shown below Customizations, per Julia — not gated on whether
          any selected line item happens to be flagged is_embroidery
          (embroideryApplicable still feeds proposalMissing's requiredness
          check below, unchanged). */}
      {showCustomizations && (
        <div>
          <span className={labelCls}>Embroidery, Paint, or Lace Amount</span>
          <StyleSelectSingle value={value.embroidery} options={embroideryOptions} placeholder="Select…" onChange={id => onChange({ embroidery: id })} />
        </div>
      )}

      <div>
        <span className={labelCls}>Additional Details</span>
        <textarea value={value.detail} onChange={e => onChange({ detail: e.target.value })} onBlur={onDetailBlur}
          placeholder="Describe the specific customization — e.g., 'Spaghetti → wide straps, deep V-neck to scoop, champagne colorway'"
          rows={3} className={`${inputCls} resize-none`} />
      </div>
    </div>
  );
}

// ─── CustomizationModal ───────────────────────────────────────────────────────
interface CustomizationModalProps {
  mode: 'add'|'edit';
  existingRecord: AirtableRecord | null;
  customizationsTable: Table | null;
  pricingTable: Table | null;
  pricingRecords: AirtableRecord[] | null;
  stylesRecords: AirtableRecord[] | null;
  stylesBasePriceField: ReturnType<Table['getFieldIfExists']>;
  pricingPercentField: ReturnType<Table['getFieldIfExists']>;
  pricingMultipleField: ReturnType<Table['getFieldIfExists']>;
  selfUsageField: ReturnType<Table['getFieldIfExists']>;
  stylesSelfUsageField: ReturnType<Table['getFieldIfExists']>;
  rushFeeProposedField: ReturnType<Table['getFieldIfExists']>;
  rushFeePercentField: ReturnType<Table['getFieldIfExists']>;
  leadtimeWeeksField: ReturnType<Table['getFieldIfExists']>;
  linkedClientId: string | null;
  clientWeddingIso: string | null;
  clientName: string;
  saName: string;
  saRecordId: string | null;
  proposalsTable: Table | null;
  proposalRecords: AirtableRecord[] | null;
  // All Customizations records (base-wide) — needed only to resolve a Hybrid
  // parent's two linked child records by id (see hybrid_customization).
  allCustomizationRecords: AirtableRecord[] | null;
  // Resolved (or fallback) attachments form URL — threaded down to
  // ProposalPreviewModal/ProposalDetailModal, both rendered from here. See
  // ATTACHMENT_FORM_URL_FALLBACK's comment for why this is a prop instead
  // of a module constant.
  attachmentFormUrl: string;
  base: ReturnType<typeof useBase>;
  onClose: () => void;
  // Only meaningful in "add" mode — see CustomizationAddDraft.
  addDraft: CustomizationAddDraft;
  onAddDraftChange: (patch: Partial<CustomizationAddDraft>) => void;
}

function CustomizationModal({
  mode, existingRecord, customizationsTable, pricingTable, pricingRecords, stylesRecords,
  stylesBasePriceField, pricingPercentField, pricingMultipleField, selfUsageField, stylesSelfUsageField,
  rushFeeProposedField, rushFeePercentField, leadtimeWeeksField,
  linkedClientId, clientWeddingIso,
  clientName, saName, saRecordId, proposalsTable, proposalRecords, allCustomizationRecords,
  attachmentFormUrl, base, onClose, addDraft, onAddDraftChange
}: CustomizationModalProps) {
  // ── Open/close transition — fade + scale, matches the brand modal spec ────
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  const custTable = customizationsTable ?? base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATIONS);

  // ── Field refs ────────────────────────────────────────────────────────────
  const fStatus     = custTable?.getFieldIfExists(CUSTOM.STATUS)                ?? null;
  const fStyled     = custTable?.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE)      ?? null;
  const fPricing    = custTable?.getFieldIfExists(CUSTOM.CUSTOMIZATION_PRICING) ?? null;
  const fDetail     = custTable?.getFieldIfExists(CUSTOM.CUSTOMIZATION_DETAIL)  ?? null;
  const fEmbroidery = custTable?.getFieldIfExists(CUSTOM.EMBROIDERY_AMOUNT)     ?? null;
  const fClient     = custTable?.getFieldIfExists(CUSTOM.CLIENT)                ?? null;
  const fSlack      = custTable?.getFieldIfExists(CUSTOM.SEND_TO_SLACK)         ?? null;
  const fIsHybrid   = custTable?.getFieldIfExists(CUSTOM.IS_HYBRID)            ?? null;
  const fAdditionalStyled = custTable?.getFieldIfExists(CUSTOM.ADDITIONAL_CUSTOMIZED_STYLE) ?? null;
  const fAdditionalSelfUsage = custTable?.getFieldIfExists(CUSTOM.ADDITIONAL_SELF_USAGE) ?? null;

  // ── Hybrid ────────────────────────────────────────────────────────────────
  // Hybrid is a single record now (2026-07-26 rework) — Style A lives on
  // customized_style (same field Regular uses), Style B on
  // additional_customized_style, and Customizations/Embroidery/Additional
  // Details are the same shared fields Regular uses too. No more child
  // records to fetch or auto-save into separately.
  const existingIsHybrid = !!(existingRecord && fIsHybrid && existingRecord.getCellValueAsString(fIsHybrid) === 'Hybrid');

  const initAdditionalStyle = () => {
    if (!existingRecord || !fAdditionalStyled) return null;
    const v = existingRecord.getCellValue(fAdditionalStyled) as Array<{ id: string }> | null;
    return v?.[0]?.id ?? null;
  };

  // "add" mode: backed by the parent's lifted addDraft (see
  // CustomizationAddDraft) instead of local state, so dismissing/reopening
  // this modal keeps whatever the user already entered.
  const addKind = addDraft.kind;
  const setAddKind = (v: 'Hybrid' | 'Regular' | null) => onAddDraftChange({ kind: v });
  const hybridAddStyleIds = addDraft.hybridStyleIds;
  const hybridAddCustomization = addDraft.hybridCustomization;
  const updateHybridAddStyleId = (idx: 0 | 1, id: string | null) => {
    onAddDraftChange({ hybridStyleIds: idx === 0 ? [id, addDraft.hybridStyleIds[1]] : [addDraft.hybridStyleIds[0], id] });
  };
  const updateHybridAddCustomization = (patch: Partial<HybridCustomizationValue>) => {
    onAddDraftChange({ hybridCustomization: { ...addDraft.hybridCustomization, ...patch } });
  };

  const isHybridMode = (mode === 'add' && addKind === 'Hybrid') || (mode === 'edit' && existingIsHybrid);
  const isRegularBody = (mode === 'add' && addKind === 'Regular') || (mode === 'edit' && !existingIsHybrid);
  const showHybridChooser = mode === 'add' && addKind === null;

  const [hybridSaving, setHybridSaving] = useState(false);
  const handleHybridSave = async () => {
    if (!custTable || mode !== 'add') return;
    setHybridSaving(true);
    try {
      const fields: Record<string, unknown> = {};
      if (fStatus) fields[CUSTOM.STATUS] = { name: 'Sent to Production' };
      if (fIsHybrid) fields[CUSTOM.IS_HYBRID] = { name: 'Hybrid' };
      if (fStyled && hybridAddStyleIds[0]) fields[CUSTOM.CUSTOMIZED_STYLE] = [{ id: hybridAddStyleIds[0] }];
      if (fAdditionalStyled && hybridAddStyleIds[1]) fields[CUSTOM.ADDITIONAL_CUSTOMIZED_STYLE] = [{ id: hybridAddStyleIds[1] }];
      if (fPricing && hybridAddCustomization.pricingIds.length) fields[CUSTOM.CUSTOMIZATION_PRICING] = hybridAddCustomization.pricingIds.map(id => ({ id }));
      if (fDetail) fields[CUSTOM.CUSTOMIZATION_DETAIL] = hybridAddCustomization.detail || null;
      if (fEmbroidery && hybridAddCustomization.embroidery) fields[CUSTOM.EMBROIDERY_AMOUNT] = { name: hybridAddCustomization.embroidery };
      if (fClient && linkedClientId) fields[CUSTOM.CLIENT] = [{ id: linkedClientId }];
      if (fSlack) fields[CUSTOM.SEND_TO_SLACK] = true;
      await queueWrite(() => custTable!.createRecordAsync(fields));
      onAddDraftChange(emptyCustomizationAddDraft());
      requestClose();
    } catch (err) { console.error('Failed to add hybrid customization:', err); }
    finally { setHybridSaving(false); }
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const initStyle = () => {
    if (!existingRecord || !fStyled) return null;
    const v = existingRecord.getCellValue(fStyled) as Array<{id:string}>|null;
    return v?.[0]?.id ?? null;
  };
  const initPricing = () => {
    if (!existingRecord || !fPricing) return [];
    const v = existingRecord.getCellValue(fPricing) as Array<{id:string}>|null;
    return v?.map(x=>x.id) ?? [];
  };
  const initStatus = () => {
    if (!existingRecord || !fStatus) return 'Sent to Production';
    return existingRecord.getCellValueAsString(fStatus) || 'Sent to Production';
  };

  const [status,      setStatus]      = useState(initStatus());
  // Regular's own Style/Customizations/Details/Embroidery — in "edit" mode
  // these are local state that autosaves straight to existingRecord (see
  // autoSave below); in "add" mode they're backed by the parent's lifted
  // addDraft instead, so dismissing/reopening the modal keeps whatever the
  // user already entered (2026-07-27).
  const [localStyleId,    setLocalStyleId]    = useState<string|null>(initStyle());
  const [localPricingIds, setLocalPricingIds] = useState<string[]>(initPricing());
  const [localDetail,     setLocalDetail]     = useState(existingRecord && fDetail ? existingRecord.getCellValueAsString(fDetail) : '');
  const [localEmbroidery, setLocalEmbroidery] = useState<string|null>(existingRecord && fEmbroidery ? existingRecord.getCellValueAsString(fEmbroidery)||null : null);
  const styleId    = mode === 'add' ? addDraft.styleId    : localStyleId;
  const pricingIds = mode === 'add' ? addDraft.pricingIds : localPricingIds;
  const detail      = mode === 'add' ? addDraft.detail     : localDetail;
  const embroidery  = mode === 'add' ? addDraft.embroidery  : localEmbroidery;
  const setStyleId    = mode === 'add' ? (v: string|null) => onAddDraftChange({ styleId: v })    : setLocalStyleId;
  const setPricingIds = mode === 'add' ? (v: string[])     => onAddDraftChange({ pricingIds: v }) : setLocalPricingIds;
  const setDetail      = mode === 'add' ? (v: string)        => onAddDraftChange({ detail: v })     : setLocalDetail;
  const setEmbroidery  = mode === 'add' ? (v: string|null)   => onAddDraftChange({ embroidery: v })  : setLocalEmbroidery;
  // Hybrid Style B (edit mode) — additional_customized_style, same record as
  // Style A (2026-07-26 rework).
  const [additionalStyleId, setAdditionalStyleId] = useState<string|null>(initAdditionalStyle());
  const [saving, setSaving] = useState(false);

  // Pre-Approval has no fixed field ID — matched by normalized name, same as
  // the Customizations detail interface.
  const preApprovalField = useMemo(
    () => pricingTable?.fields.find(f => normalizedIncludes(f.name, 'preapproval')) ?? null,
    [pricingTable]
  );
  const preApprovalColorMap = useMemo(() => getChoiceColorMap(preApprovalField), [preApprovalField]);

  // ── Base price from selected style ────────────────────────────────────────
  const basePrice = useMemo(()=>{
    if (!styleId || !stylesRecords || !stylesBasePriceField) return null;
    const rec = stylesRecords.find(r=>r.id===styleId);
    if (!rec) return null;
    return parseCurrencyString(rec.getCellValueAsString(stylesBasePriceField));
  }, [styleId, stylesRecords, stylesBasePriceField]);
  const basePriceNumber = basePrice ?? 0;

  // Self Usage (Customizations table) is a lookup off the Customized Style
  // link, so it's only readable once a Customizations record actually
  // exists — fine in "edit" mode, but "add" mode has no record yet. There,
  // fall back to reading the underlying number straight off the selected
  // Styles record (stylesSelfUsageField), the same way Base Price already
  // works pre-save — a best-effort preview, not the authoritative value.
  const selfUsageValue = useMemo(()=>{
    if (mode === 'edit' && existingRecord && selfUsageField) {
      return parseCurrencyString(existingRecord.getCellValueAsString(selfUsageField));
    }
    if (styleId && stylesRecords && stylesSelfUsageField) {
      const rec = stylesRecords.find(r=>r.id===styleId);
      if (rec) return parseCurrencyString(rec.getCellValueAsString(stylesSelfUsageField));
    }
    return 0;
  }, [mode, existingRecord, selfUsageField, styleId, stylesRecords, stylesSelfUsageField]);
  const multiplierFactor = useMemo(
    () => computeMultiplierFactor(selfUsageValue, embroidery),
    [selfUsageValue, embroidery]
  );

  // ── Order summary — Grand Total combines every section below ─────────────
  const pPriceField = pricingTable?.getFieldIfExists(PRICING.PRICE) ?? null;
  // pricingMultipleField comes in as a prop (custom-property bound), not a
  // fixed FIELD_IDS lookup — see getCustomProperties for why.
  const sumPricingIds = useCallback((ids: string[]) => {
    if (!pricingRecords) return 0;
    return ids.reduce((sum, id) => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return sum;
      return sum + resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor).amount;
    }, 0);
  }, [pricingRecords, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor]);

  const customizationTotal = useMemo(() => sumPricingIds(pricingIds), [sumPricingIds, pricingIds]);

  const grandTotal = basePriceNumber + customizationTotal;

  // Embroidery Amount only matters — and only shows on the form — when at
  // least one currently-selected customization/pricing row needs it (Pricing
  // table's own is_embroidery checkbox; see PRICING.IS_EMBROIDERY).
  const pIsEmbroideryField = pricingTable?.getFieldIfExists(PRICING.IS_EMBROIDERY) ?? null;
  const embroideryApplicable = useMemo(() => {
    if (!pIsEmbroideryField || !pricingRecords) return false;
    return pricingIds.some(id => {
      const r = pricingRecords.find(pr => pr.id === id);
      return r ? !!(r.getCellValue(pIsEmbroideryField) as boolean | null) : false;
    });
  }, [pIsEmbroideryField, pricingRecords, pricingIds]);

  // ── Generate Proposal ─────────────────────────────────────────────────────
  const [showProposalPreview, setShowProposalPreview] = useState(false);
  const [viewProposalId, setViewProposalId]           = useState<string|null>(null);
  const pTypeField = pricingTable?.getFieldIfExists(PRICING.TYPE) ?? null;

  const styleName = useMemo(
    () => (styleId ? (stylesRecords?.find(r=>r.id===styleId)?.name ?? '') : ''),
    [styleId, stylesRecords]
  );

  const proposalMissing = useMemo(() => {
    if (mode !== 'edit') return [];
    const missing: string[] = [];
    if (!styleName) missing.push('Style');
    if (pricingIds.length === 0) missing.push('at least one selected customization');
    if (embroideryApplicable && !embroidery) missing.push('Amount of Embroidery/Paint/Lace');
    if (grandTotal <= 0) missing.push('a calculated price greater than $0');
    if (!linkedClientId) missing.push('client');
    if (!saName) missing.push('sales associate');
    return missing;
  }, [mode, styleName, pricingIds, embroideryApplicable, embroidery, grandTotal, linkedClientId, saName]);
  const canGenerateProposal = mode === 'edit' && !!existingRecord && proposalMissing.length === 0;

  // Same values already shown in this modal's own Order Summary — the printed
  // proposal is guaranteed to match what's on screen because it's built from
  // these, not re-derived from the record. Computed unconditionally (not
  // gated on canGenerateProposal) so it also works as the display source for
  // ProposalDetailModal, viewing any of this customization's already-saved
  // proposals — that's just viewing, not generating, so it shouldn't be
  // blocked by the same validation that gates the Generate button below.
  const liveDisplaySnapshot = useMemo<ProposalSnapshot>(() => {
    const lineItems: ProposalLineItem[] = pTypeField
      ? pricingIds
        .map(id => {
          const r = pricingRecords?.find(pr=>pr.id===id);
          if (!r) return null;
          const { amount, label } = resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor);
          return {
            id: r.id,
            name: r.getCellValueAsString(pTypeField),
            label,
            amount,
            approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '',
          };
        })
        .filter((x): x is ProposalLineItem => x !== null)
      : [];
    return {
      styleName,
      lineItems,
      basePriceNumber,
      customizationTotal,
      embroideryAmount: embroidery ?? '',
      grandTotal,
    };
  }, [pTypeField, pricingIds, pricingRecords, pPriceField, pricingPercentField, pricingMultipleField,
      basePriceNumber, multiplierFactor, preApprovalField, styleName, customizationTotal, embroidery, grandTotal]);
  const proposalSnapshot = canGenerateProposal ? liveDisplaySnapshot : null;

  // ── Hybrid pricing ─────────────────────────────────────────────────────────
  // Style A/B and shared Customizations/Embroidery/Detail — edit mode reads
  // the same top-level state Regular already uses (styleId/pricingIds/
  // embroidery/detail live on this same record for Hybrid too), add mode
  // uses its own local-only state until the record is created.
  const hybridStyleIds: [string | null, string | null] = mode === 'edit' ? [styleId, additionalStyleId] : hybridAddStyleIds;
  const hybridCustomization: HybridCustomizationValue = mode === 'edit' ? { pricingIds, embroidery, detail } : hybridAddCustomization;

  // Base Price/Self Usage read straight off the chosen Styles records (same
  // pre-save fallback Regular's own basePrice/selfUsageValue already use),
  // uniformly for both add and edit — no lookup fields needed on the
  // Customizations record itself for Style B.
  const hybridBaseA = useMemo(() => {
    if (!hybridStyleIds[0] || !stylesRecords || !stylesBasePriceField) return 0;
    const rec = stylesRecords.find(r => r.id === hybridStyleIds[0]);
    return rec ? parseCurrencyString(rec.getCellValueAsString(stylesBasePriceField)) : 0;
  }, [hybridStyleIds[0], stylesRecords, stylesBasePriceField]);
  const hybridBaseB = useMemo(() => {
    if (!hybridStyleIds[1] || !stylesRecords || !stylesBasePriceField) return 0;
    const rec = stylesRecords.find(r => r.id === hybridStyleIds[1]);
    return rec ? parseCurrencyString(rec.getCellValueAsString(stylesBasePriceField)) : 0;
  }, [hybridStyleIds[1], stylesRecords, stylesBasePriceField]);
  // Self Usage — in edit mode, prefer THIS record's own lookup (self_usage
  // for Style A, additional_self_usage for Style B), same authoritative
  // source Regular's own selfUsageValue uses; only fall back to reading the
  // Styles record directly in add mode (no Customizations record yet).
  // Reading straight off Styles in edit mode too (as this used to) diverged
  // from Regular's own value for the same style whenever the two disagreed,
  // producing a visibly wrong Rate multiplier (2026-07-27).
  const hybridSelfUsageA = useMemo(() => {
    if (mode === 'edit' && existingRecord && selfUsageField) {
      return parseCurrencyString(existingRecord.getCellValueAsString(selfUsageField));
    }
    if (hybridStyleIds[0] && stylesRecords && stylesSelfUsageField) {
      const rec = stylesRecords.find(r => r.id === hybridStyleIds[0]);
      if (rec) return parseCurrencyString(rec.getCellValueAsString(stylesSelfUsageField));
    }
    return 0;
  }, [mode, existingRecord, selfUsageField, hybridStyleIds[0], stylesRecords, stylesSelfUsageField]);
  const hybridSelfUsageB = useMemo(() => {
    if (mode === 'edit' && existingRecord && fAdditionalSelfUsage) {
      return parseCurrencyString(existingRecord.getCellValueAsString(fAdditionalSelfUsage));
    }
    if (hybridStyleIds[1] && stylesRecords && stylesSelfUsageField) {
      const rec = stylesRecords.find(r => r.id === hybridStyleIds[1]);
      if (rec) return parseCurrencyString(rec.getCellValueAsString(stylesSelfUsageField));
    }
    return 0;
  }, [mode, existingRecord, fAdditionalSelfUsage, hybridStyleIds[1], stylesRecords, stylesSelfUsageField]);

  // Combined Hybrid total: 85% surcharge on top of the higher-priced style's
  // Base Price (per Julia, 2026-07-20 demo feedback), plus whatever
  // Customizations/Embroidery were added on top (2026-07-26 rework) —
  // computed against that same higher-priced style.
  const hybridCombinedTotal = computeHybridCombinedTotal(hybridBaseA, hybridBaseB);
  const hybridHigherBasePrice = Math.max(hybridBaseA, hybridBaseB);
  const hybridEffectiveSelfUsage = hybridBaseA >= hybridBaseB ? hybridSelfUsageA : hybridSelfUsageB;
  const hybridMultiplierFactor = computeMultiplierFactor(hybridEffectiveSelfUsage, hybridCustomization.embroidery);
  const hybridCustomizationTotal = useMemo(() => {
    if (!pricingRecords) return 0;
    return hybridCustomization.pricingIds.reduce((sum, id) => {
      const r = pricingRecords.find(pr => pr.id === id);
      if (!r) return sum;
      return sum + resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, hybridHigherBasePrice, hybridMultiplierFactor).amount;
    }, 0);
  }, [hybridCustomization.pricingIds, pricingRecords, pPriceField, pricingPercentField, pricingMultipleField, hybridHigherBasePrice, hybridMultiplierFactor]);
  const hybridGrandTotal = hybridCombinedTotal + hybridCustomizationTotal;

  // Style dropdown for Hybrid — unfiltered (per Julia, 2026-07-24: the
  // Favorite-Styles filter never made sense for a merge of two styles).
  const hybridStyleOptions = useMemo(() => {
    return (stylesRecords ?? []).map(r => {
      const price = stylesBasePriceField ? parseCurrencyString(r.getCellValueAsString(stylesBasePriceField)) : 0;
      return { id: r.id, label: `${r.name} — ${formatCurrency(price)}` };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [stylesRecords, stylesBasePriceField]);

  // ── Hybrid Generate Proposal ──────────────────────────────────────────────
  // One combined proposal for the whole Hybrid request, sourced from this
  // same record — including its real Customizations line items now that
  // they live on the parent (2026-07-26 rework), not a synthetic $0 like
  // the old per-child model had.
  const hybridProposalMissing = useMemo(() => {
    if (mode !== 'edit' || !isHybridMode) return [];
    const missing: string[] = [];
    const style1Name = hybridStyleIds[0] ? (stylesRecords?.find(r => r.id === hybridStyleIds[0])?.name ?? '') : '';
    const style2Name = hybridStyleIds[1] ? (stylesRecords?.find(r => r.id === hybridStyleIds[1])?.name ?? '') : '';
    if (!style1Name) missing.push('Style 1');
    if (!style2Name) missing.push('Style 2');
    if (hybridGrandTotal <= 0) missing.push('a calculated price greater than $0');
    if (!linkedClientId) missing.push('client');
    if (!saName) missing.push('sales associate');
    return missing;
  }, [mode, isHybridMode, hybridGrandTotal, hybridStyleIds, stylesRecords, linkedClientId, saName]);
  const hybridCanGenerateProposal = mode === 'edit' && !!existingRecord && isHybridMode && hybridProposalMissing.length === 0;

  const hybridLiveDisplaySnapshot = useMemo<ProposalSnapshot>(() => {
    const style1Name = hybridStyleIds[0] ? (stylesRecords?.find(r => r.id === hybridStyleIds[0])?.name ?? '') : '';
    const style2Name = hybridStyleIds[1] ? (stylesRecords?.find(r => r.id === hybridStyleIds[1])?.name ?? '') : '';
    const lineItems: ProposalLineItem[] = pTypeField
      ? hybridCustomization.pricingIds
        .map(id => {
          const r = pricingRecords?.find(pr => pr.id === id);
          if (!r) return null;
          const { amount, label } = resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, hybridHigherBasePrice, hybridMultiplierFactor);
          return {
            id: r.id,
            name: r.getCellValueAsString(pTypeField),
            label,
            amount,
            approval: preApprovalField ? getSingleSelectName(r.getCellValue(preApprovalField)) : '',
          };
        })
        .filter((x): x is ProposalLineItem => x !== null)
      : [];

    return {
      styleName: [style1Name, style2Name].filter(Boolean).join(' + ') || 'Hybrid',
      lineItems,
      basePriceNumber: hybridBaseA + hybridBaseB,
      customizationTotal: hybridCustomizationTotal,
      embroideryAmount: hybridCustomization.embroidery ?? '',
      grandTotal: hybridGrandTotal,
      hybridBreakdown: {
        style1: { styleName: style1Name || 'Style TBD', basePriceNumber: hybridBaseA },
        style2: { styleName: style2Name || 'Style TBD', basePriceNumber: hybridBaseB },
      },
    };
  }, [hybridStyleIds, stylesRecords, pTypeField, hybridCustomization, pricingRecords, pPriceField, pricingPercentField,
      pricingMultipleField, hybridHigherBasePrice, hybridMultiplierFactor, preApprovalField,
      hybridBaseA, hybridBaseB, hybridCustomizationTotal, hybridGrandTotal]);
  const hybridProposalSnapshot = hybridCanGenerateProposal ? hybridLiveDisplaySnapshot : null;

  // Whichever the modal is actually showing right now, Regular or Hybrid —
  // everything downstream (header button, missing-fields banner, Proposals
  // table, ProposalPreviewModal/ProposalDetailModal) reads only these.
  const effectiveCanGenerateProposal = isHybridMode ? hybridCanGenerateProposal : canGenerateProposal;
  const effectiveProposalMissing = isHybridMode ? hybridProposalMissing : proposalMissing;
  const effectiveProposalSnapshot = isHybridMode ? hybridProposalSnapshot : proposalSnapshot;
  const effectiveLiveDisplaySnapshot = isHybridMode ? hybridLiveDisplaySnapshot : liveDisplaySnapshot;

  const customizationProposals = useMemo(() => {
    if (!proposalRecords || !existingRecord || !proposalsTable) return [];
    const fSourceP = proposalsTable.getFieldIfExists(PROPOSAL.SOURCE_CUSTOMIZATION);
    const fGeneratedAtP = proposalsTable.getFieldIfExists(PROPOSAL.GENERATED_AT);
    if (!fSourceP) return [];
    return proposalRecords
      .filter(r => {
        const lnk = r.getCellValue(fSourceP) as Array<{id:string}>|null;
        return lnk?.some(l=>l.id===existingRecord.id) ?? false;
      })
      .sort((a, b) => {
        if (!fGeneratedAtP) return 0;
        const aTime = new Date((a.getCellValue(fGeneratedAtP) as string|null) ?? 0).getTime();
        const bTime = new Date((b.getCellValue(fGeneratedAtP) as string|null) ?? 0).getTime();
        return bTime - aTime; // latest first
      });
  }, [proposalRecords, proposalsTable, existingRecord]);

  // ── Auto-save for edit mode ───────────────────────────────────────────────
  const autoSave = useCallback((patch: Record<string,unknown>) => {
    if (mode !== 'edit' || !custTable || !existingRecord) return;
    queueWrite(()=>custTable!.updateRecordAsync(existingRecord.id, patch))
      .catch(err=>console.error('Customization auto-save failed:', err));
  }, [mode, custTable, existingRecord]);

  const handleStatus     = (s:string) => { setStatus(s); autoSave({ [CUSTOM.STATUS]: { name: s } }); };
  const handleStyleId    = (id:string|null) => { setStyleId(id); if (fStyled) autoSave({ [fStyled.id]: id ? [{id}] : null }); };
  const handleAdditionalStyleId = (id:string|null) => { setAdditionalStyleId(id); if (fAdditionalStyled) autoSave({ [fAdditionalStyled.id]: id ? [{id}] : null }); };
  const updateHybridStyleId = (idx: 0 | 1, id: string | null) => {
    if (mode === 'edit') { if (idx === 0) handleStyleId(id); else handleAdditionalStyleId(id); }
    else updateHybridAddStyleId(idx, id);
  };
  const updateHybridCustomization = (patch: Partial<HybridCustomizationValue>) => {
    if (mode === 'edit') {
      if ('pricingIds' in patch) handlePricing(patch.pricingIds ?? []);
      if ('embroidery' in patch) handleEmbroidery(patch.embroidery ?? null);
      if ('detail' in patch) setDetail(patch.detail ?? '');
    } else {
      updateHybridAddCustomization(patch);
    }
  };
  const handleHybridDetailBlur = () => { if (mode === 'edit') handleDetail(); };
  const handlePricing    = (ids:string[]) => { setPricingIds(ids); if (fPricing) autoSave({ [fPricing.id]: ids.map(id=>({id})) }); };
  const handleDetail     = () => { if (fDetail) autoSave({ [fDetail.id]: detail || null }); };
  const handleEmbroidery = (v:string|null) => { setEmbroidery(v); if (fEmbroidery) autoSave({ [fEmbroidery.id]: v ? { name: v } : null }); };

  const handleSave = async () => {
    if (!custTable || mode !== 'add') return;
    setSaving(true);
    try {
      const fields: Record<string,unknown> = {};
      if (fStatus)   fields[CUSTOM.STATUS]    = { name: 'Sent to Production' };
      if (fStyled && styleId) fields[CUSTOM.CUSTOMIZED_STYLE] = [{ id: styleId }];
      if (fPricing && pricingIds.length) fields[CUSTOM.CUSTOMIZATION_PRICING] = pricingIds.map(id=>({id}));
      if (fDetail)   fields[CUSTOM.CUSTOMIZATION_DETAIL] = detail || null;
      if (fEmbroidery && embroidery) fields[CUSTOM.EMBROIDERY_AMOUNT] = { name: embroidery };
      if (fClient && linkedClientId) fields[CUSTOM.CLIENT] = [{ id: linkedClientId }];
      if (fSlack)    fields[CUSTOM.SEND_TO_SLACK] = true;
      await queueWrite(()=>custTable!.createRecordAsync(fields));
      onAddDraftChange(emptyCustomizationAddDraft());
      requestClose();
    } catch (err) { console.error('Failed to add customization:', err); }
    finally { setSaving(false); }
  };

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') requestClose(); };
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[requestClose]);

  // Style dropdown — every style in the base, unfiltered (per Julia,
  // 2026-07-27: no Favorite-Styles-in-Acuity scoping for Regular or Hybrid).
  const styleOptions = useMemo(()=>{
    // Base Price is folded into the option label itself (both the closed/
    // selected view and each dropdown row use `label` as-is) so the price
    // shows inside the Style picker instead of as a separate column.
    return (stylesRecords ?? []).map(r=>{
      const price = stylesBasePriceField ? parseCurrencyString(r.getCellValueAsString(stylesBasePriceField)) : 0;
      return { id:r.id, label:`${r.name} — ${formatCurrency(price)}` };
    }).sort((a,b)=>a.label.localeCompare(b.label));
  },[stylesRecords, stylesBasePriceField]);

  // BRANDING.md §2: section/field labels are 14px (text-sm), not 12px (text-xs).
  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1B1813] text-gray-900 dark:text-[#F3EFE6] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]';

  // Past the chooser, clicking outside or the back arrow returns to the
  // chooser instead of closing the modal — only the chooser step itself
  // closes on dismiss (per Julia's 2026-07-20 feedback; matches customization_requests.tsx).
  const handleDismiss = () => {
    if (mode === 'add' && addKind !== null) setAddKind(null);
    else requestClose();
  };

  const modalTitle = mode === 'add'
    ? (addKind === 'Hybrid' ? 'New Hybrid Customization' : addKind === 'Regular' ? 'New Regular Customization' : 'New Customization Request')
    : (existingIsHybrid ? 'Edit Hybrid Customization' : 'Edit Customization');

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backgroundColor:'rgba(0,0,0,0.18)', backdropFilter:'blur(1px)', opacity: isVisible?1:0 }}
      onClick={e=>{ if (e.target===e.currentTarget) handleDismiss(); }}>
      {/* Both Regular and Hybrid now share the same fields-left/summary-right
          layout, so both use the wider width — Regular at 680px looked
          cramped once it adopted the same two-column split. The chooser step
          itself uses a much narrower width — same value as
          customization_requests.tsx's chooser — since it has nothing that
          needs the wide two-column layout. */}
      {/* max-width is NOT in the transitioned properties — animating a
          container resize at the same moment its content swaps entirely
          (chooser -> form) reads as a glitch, not a smooth transition. The
          width change snaps instantly; only the modal's own open/close
          (opacity + scale) animates, per BRANDING.md's modal spec. */}
      <div className={`bg-white dark:bg-[#25211A] rounded-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out`}
        style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)', maxWidth: showHybridChooser ? '480px' : '960px' }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="border-b border-gray-100 dark:border-white/5">
          <div className="p-5 flex items-center gap-3">
            <button onClick={handleDismiss} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 hover:dark:text-gray-300 transition-colors">
              <ArrowLeftIcon size={18}/>
            </button>
            <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] flex-1">
              {modalTitle}
            </div>
            {mode === 'edit' && (
              <button type="button" disabled={!effectiveCanGenerateProposal} onClick={()=>setShowProposalPreview(true)}
                title={effectiveCanGenerateProposal ? 'Generate Proposal' : `Missing: ${effectiveProposalMissing.join(', ')}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white dark:text-[#1B1813] bg-[#D97706] dark:bg-[#FBBF24] rounded-lg hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                <FileTextIcon size={14}/>Generate Proposal
              </button>
            )}
          </div>
          {mode === 'edit' && !effectiveCanGenerateProposal && (
            <div className="px-5 pb-3 -mt-2 text-[11px] text-red-500 dark:text-red-400">
              Missing for proposal: {effectiveProposalMissing.join(', ')}
            </div>
          )}
        </div>

        {showHybridChooser ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="text-[13px] text-gray-500 dark:text-gray-400 mb-4">Is this a Regular or Hybrid customization?</div>
            <div className="space-y-3">
              <button type="button" onClick={()=>setAddKind('Regular')}
                className="w-full text-left border border-gray-200 dark:border-white/10 rounded-xl p-4 hover:border-[#D97706] hover:dark:border-[#FBBF24] transition-colors">
                <div className="font-bold text-gray-900 dark:text-[#F3EFE6] mb-0.5">Regular</div>
                <div className="text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">A single style, customized as usual.</div>
              </button>
              <button type="button" onClick={()=>setAddKind('Hybrid')}
                className="w-full text-left border border-gray-200 dark:border-white/10 rounded-xl p-4 hover:border-[#D97706] hover:dark:border-[#FBBF24] transition-colors">
                <div className="font-bold text-gray-900 dark:text-[#F3EFE6] mb-0.5">Hybrid</div>
                <div className="text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">Two styles combined into one request.</div>
              </button>
            </div>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stage pipeline — edit mode only */}
          {mode === 'edit' && (
            <CustomizationStagePipeline currentStatus={status} onChange={handleStatus}/>
          )}

          {/* Proposals generated from this customization request — invoice-
              style inline table (latest first). For a Hybrid request these
              are sourced from the parent record, same as any other. */}
          {mode === 'edit' && proposalsTable && customizationProposals.length > 0 && (
            <div>
              <span className={labelCls}>Proposals</span>
              <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Generated At</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Unsigned Proposal</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Signed Proposal</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-right">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customizationProposals.map(p=>{
                      const fGeneratedAtP = proposalsTable.getFieldIfExists(PROPOSAL.GENERATED_AT);
                      const fUnsignedP    = proposalsTable.getFieldIfExists(PROPOSAL.UNSIGNED_DOCUMENT);
                      const fSignedP      = proposalsTable.getFieldIfExists(PROPOSAL.SIGNED_DOCUMENT);
                      const fPricingP     = proposalsTable.getFieldIfExists(PROPOSAL.SNAPSHOT_PRICING);
                      const generatedAtStr = fGeneratedAtP ? (p.getCellValue(fGeneratedAtP) as string|null) : null;
                      const unsignedFiles  = fUnsignedP ? ((p.getCellValue(fUnsignedP) as ProposalFile[]|null) ?? []) : [];
                      const signedFiles    = fSignedP   ? ((p.getCellValue(fSignedP)   as ProposalFile[]|null) ?? []) : [];
                      const grandTotalVal  = fPricingP ? ((p.getCellValue(fPricingP) as number|null) ?? 0) : 0;
                      const thumb = (files: ProposalFile[]) => files[0] ? (
                        <div onClick={e=>{ e.stopPropagation(); window.open(files[0]!.url, '_blank', 'noopener,noreferrer'); }}
                          className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:opacity-75 transition-opacity">
                          <img src={files[0]!.thumbnails?.small?.url ?? files[0]!.url} alt={files[0]!.filename} className="w-full h-full object-cover"/>
                        </div>
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>;
                      return (
                        <tr key={p.id} onClick={()=>setViewProposalId(p.id)}
                          className="border-b border-gray-100 dark:border-white/5 last:border-0 cursor-pointer hover:bg-[#FEF3C7] hover:dark:bg-[#3A2E12] transition-colors">
                          <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtUSDateTime12h(generatedAtStr)}</td>
                          <td className="px-3 py-2.5">{thumb(unsignedFiles)}</td>
                          <td className="px-3 py-2.5">{thumb(signedFiles)}</td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-[#F3EFE6] text-right">{formatCurrency(grandTotalVal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isRegularBody && (
            <div className="flex gap-6 items-stretch">
              <div className="w-[60%] min-w-0">
                <HybridSectionFields
                  value={{ styleId, pricingIds, embroidery, detail }}
                  onChange={patch => {
                    if ('styleId' in patch) handleStyleId(patch.styleId ?? null);
                    if ('embroidery' in patch) handleEmbroidery(patch.embroidery ?? null);
                    if ('pricingIds' in patch) handlePricing(patch.pricingIds ?? []);
                    if ('detail' in patch) setDetail(patch.detail ?? '');
                  }}
                  onDetailBlur={handleDetail}
                  styleOptions={styleOptions}
                  pricingRecords={pricingRecords}
                  pricingTable={pricingTable}
                  preApprovalField={preApprovalField}
                  preApprovalColorMap={preApprovalColorMap}
                  pricingPercentField={pricingPercentField}
                  pricingMultipleField={pricingMultipleField}
                  basePriceNumber={basePriceNumber}
                  multiplierFactor={multiplierFactor}
                  embroideryApplicable={embroideryApplicable}
                />
              </div>

              {/* Summary — sticky, stays in place while the fields column
                  scrolls. items-stretch on the row above (not items-start)
                  is required for this: sticky only has room to "stick"
                  while its containing block is taller than its own content,
                  which only happens once this column stretches to match
                  the fields column's height. Row text bumped to text-base
                  per Julia's live font-size feedback (2026-07-20 demo). */}
              <div className="w-[40%] shrink-0">
                <div className="sticky top-0 p-4 rounded-lg space-y-1.5 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  <span className={labelCls}>Summary</span>
                  {([
                    { label: 'Base Price',          amount: basePriceNumber },
                    { label: 'Customization Total', amount: customizationTotal },
                  ]).map(({ label, amount }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                      <span className="text-base text-gray-600 dark:text-gray-400">{label}</span>
                      <span className="text-base text-gray-900 dark:text-[#F3EFE6]">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center font-bold text-gray-900 dark:text-[#F3EFE6] border-t border-gray-300 dark:border-gray-600 pt-1.5 mt-1">
                    <span className="text-lg">Grand Total</span>
                    <span className="text-lg">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isHybridMode && (() => {
            const higherIsStyle1 = hybridBaseA >= hybridBaseB;
            return (
              <div className="flex gap-6 items-stretch">
                <div className="w-[60%] min-w-0 space-y-4">
                  {/* Two styles, inline horizontal — not stacked cards. No
                      Favorite-Styles filter (2026-07-24: doesn't make sense
                      for a merge of two styles). */}
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <span className={labelCls}>Style 1</span>
                      <StyleSelectSingle value={hybridStyleIds[0]} options={hybridStyleOptions} placeholder="Select a style…"
                        onChange={id => updateHybridStyleId(0, id)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={labelCls}>Style 2</span>
                      <StyleSelectSingle value={hybridStyleIds[1]} options={hybridStyleOptions} placeholder="Select a style…"
                        onChange={id => updateHybridStyleId(1, id)} />
                    </div>
                  </div>
                  <HybridSectionFields
                    value={hybridCustomization}
                    onChange={patch => updateHybridCustomization(patch)}
                    onDetailBlur={handleHybridDetailBlur}
                    styleOptions={hybridStyleOptions}
                    pricingRecords={pricingRecords}
                    pricingTable={pricingTable}
                    preApprovalField={preApprovalField}
                    preApprovalColorMap={preApprovalColorMap}
                    pricingPercentField={pricingPercentField}
                    pricingMultipleField={pricingMultipleField}
                    basePriceNumber={hybridHigherBasePrice}
                    multiplierFactor={hybridMultiplierFactor}
                    showStyle={false}
                  />
                </div>

                {/* Summary — one panel, Style 1 / Style 2 / Customizations /
                    Hybrid stacked vertically inside it. Sticky lives on the
                    inner card, not this wrapper — see the Regular block
                    above for why. */}
                <div className="w-[40%] shrink-0">
                  <div className="sticky top-0 p-4 rounded-lg space-y-1.5 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                    <span className={labelCls}>Summary</span>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                      <span className="text-base text-gray-600 dark:text-gray-400">Style 1 Base Price{higherIsStyle1 && ' (higher)'}</span>
                      <span className="text-base text-gray-900 dark:text-[#F3EFE6]">{formatCurrency(hybridBaseA)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                      <span className="text-base text-gray-600 dark:text-gray-400">Style 2 Base Price{!higherIsStyle1 && ' (higher)'}</span>
                      <span className="text-base text-gray-900 dark:text-[#F3EFE6]">{formatCurrency(hybridBaseB)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                      <span className="text-base text-gray-600 dark:text-gray-400">+85% Surcharge</span>
                      <span className="text-base text-gray-900 dark:text-[#F3EFE6]">{formatCurrency(Math.max(hybridBaseA, hybridBaseB) * 0.85)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-white/5">
                      <span className="text-base text-gray-600 dark:text-gray-400">Customization Total</span>
                      <span className="text-base text-gray-900 dark:text-[#F3EFE6]">{formatCurrency(hybridCustomizationTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-gray-900 dark:text-[#F3EFE6] border-t border-gray-300 dark:border-gray-600 pt-1.5 mt-1">
                      <span className="text-lg">Grand Total</span>
                      <span className="text-lg">{formatCurrency(hybridGrandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        )}

        {/* Footer */}
        {!showHybridChooser && (
        <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end items-center">
          {mode==='add' && addKind==='Regular' && (
            <button onClick={handleSave} disabled={saving || !styleId}
              className="bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] rounded-lg px-5 py-2 text-sm font-semibold hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-50">
              {saving?'Adding…':'Add Customization'}
            </button>
          )}
          {mode==='add' && addKind==='Hybrid' && (
            <button onClick={handleHybridSave} disabled={hybridSaving || !hybridAddStyleIds[0] || !hybridAddStyleIds[1]}
              className="bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] rounded-lg px-5 py-2 text-sm font-semibold hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-50">
              {hybridSaving?'Adding…':'Add Hybrid Customization'}
            </button>
          )}
        </div>
        )}
      </div>
    </div>

      {showProposalPreview && effectiveProposalSnapshot && linkedClientId && existingRecord && (
        <ProposalPreviewModal
          snapshot={effectiveProposalSnapshot}
          clientName={clientName}
          clientId={linkedClientId}
          saName={saName}
          saRecordId={saRecordId}
          customizationId={existingRecord.id}
          proposalsTable={proposalsTable}
          attachmentFormUrl={attachmentFormUrl}
          onClose={()=>setShowProposalPreview(false)}
        />
      )}

      {viewProposalId && proposalsTable && (() => {
        const rec = proposalRecords?.find(r=>r.id===viewProposalId) ?? null;
        if (!rec) return null;
        return (
          <ProposalDetailModal
            proposalRecord={rec}
            proposalsTable={proposalsTable}
            clientName={clientName}
            saName={saName}
            snapshot={effectiveLiveDisplaySnapshot}
            attachmentFormUrl={attachmentFormUrl}
            onClose={()=>setViewProposalId(null)}
          />
        );
      })()}
    </>
  );
}

// ─── Proposal snapshot ─────────────────────────────────────────────────────────
// Built directly from CustomizationModal's own already-computed values (see
// its "Generate Proposal" section) — not re-derived from scratch — so the
// numbers and line items on the printed document are guaranteed to match
// exactly what that modal displays. Copied into the Proposal record verbatim
// at save time, so a later edit to the source Customization can't silently
// change an already-generated proposal.
interface ProposalLineItem {
  id: string;
  name: string;
  label: string | null;
  amount: number;
  approval: string;
}
interface ProposalSnapshot {
  styleName: string;
  lineItems: ProposalLineItem[];
  basePriceNumber: number;
  customizationTotal: number;
  embroideryAmount: string;
  grandTotal: number;
  // Only set for a Hybrid request's snapshot — lets ProposalDocument render
  // Style 1 and Style 2 as two clearly separate, vertically stacked
  // sections, each ending in its own weighted summary, with one final
  // combined Grand Total at the end of the whole document. The flat fields
  // above stay populated too (combined totals, prefixed line items) so
  // anything reading this snapshot without hybrid-awareness still works.
  hybridBreakdown?: {
    style1: ProposalStyleSection;
    style2: ProposalStyleSection;
  };
}
// Hybrid no longer has Customizations, Embroidery, or a per-style weight —
// each style section is just its name and Base Price (per Julia, 2026-07-20
// demo feedback). The combined Grand Total (85% over the higher Base Price)
// is computed once, from both sections, at the document level.
interface ProposalStyleSection {
  styleName: string;
  basePriceNumber: number;
}

// ─── ProposalDocument ───────────────────────────────────────────────────────
// The actual proposal document — shared verbatim between ProposalPreviewModal
// (generating a new one) and ProposalDetailModal (viewing an existing one),
// so both look and print identically. Only `.proposal-print-area` survives
// `@media print` (each modal defines that rule itself, since it also governs
// whether the surrounding modal chrome is hidden).
interface ProposalDocumentProps {
  clientName: string;
  saName: string;
  snapshot: ProposalSnapshot;
  generatedAt: Date;
}
function ProposalDocument({ clientName, saName, snapshot, generatedAt }: ProposalDocumentProps) {
  // Zero-amount rows add no information on a client-facing proposal — skip
  // them. Rush/M2M/Alterations fees no longer appear here at all (per Julia,
  // 2026-07-20 demo feedback) — those fees now live only on the Draft Order.
  const orderSummaryRows: Array<{ label: string; amount: number; sub: string | null }> = [
    { label: 'Base Price',          amount: snapshot.basePriceNumber,  sub: null },
    { label: 'Customization Total', amount: snapshot.customizationTotal, sub: null },
  ].filter(row => row.amount !== 0);

  const hb = snapshot.hybridBreakdown;

  return (
    <div className="proposal-print-area bg-[#F8F5EE] text-[#111111] rounded-xl border border-gray-200 dark:border-white/10 p-6">
      <div className="text-2xl font-bold mb-1">Danielle Frankel Studios</div>
      <div className="text-sm text-gray-500 mb-4">Customization Proposal</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-sm"><span className="capitalize text-gray-500">Client: </span><span className="font-medium">{clientName}</span></div>
        <div className="text-sm"><span className="capitalize text-gray-500">Sales Associate: </span><span className="font-medium">{saName || '—'}</span></div>
        {!hb && (
          <>
            <div className="text-sm"><span className="capitalize text-gray-500">Style: </span><span className="font-medium">{snapshot.styleName}</span></div>
            <div className="text-sm"><span className="capitalize text-gray-500">Amount of Embroidery/Paint/Lace: </span><span className="font-medium">{snapshot.embroideryAmount}</span></div>
          </>
        )}
      </div>

      {hb ? (
        <>
          {/* Hybrid — Style 1 and Style 2 as two clearly separate, stacked
              sections (just name + Base Price now — no Customizations,
              Embroidery, or per-style weight; per Julia, 2026-07-20 demo
              feedback), followed by the 85%-over-the-higher-price surcharge
              and the combined Grand Total ending the document. Compact by
              construction — easily fits on one printed page. */}
          {([{ label: 'Style 1', s: hb.style1 }, { label: 'Style 2', s: hb.style2 }] as const).map(({ label, s }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 mb-2">
              <span className="text-base font-bold">{label}: {s.styleName}</span>
              <span className="text-base text-gray-900">{formatCurrency(s.basePriceNumber)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-2 border-b border-gray-100 mb-2">
            <span className="text-sm text-gray-600">+85% Surcharge (on the higher Base Price)</span>
            <span className="text-sm text-gray-900">{formatCurrency(Math.max(hb.style1.basePriceNumber, hb.style2.basePriceNumber) * 0.85)}</span>
          </div>
          {/* Customizations now live on the Hybrid record itself (2026-07-26
              rework), priced against the higher of the two styles — only
              shown when non-zero, same rule Regular's own Order Summary uses. */}
          {snapshot.customizationTotal !== 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100 mb-2">
              <span className="text-sm text-gray-600">Customization Total</span>
              <span className="text-sm text-gray-900">{formatCurrency(snapshot.customizationTotal)}</span>
            </div>
          )}

          {/* The combined total ends the whole document */}
          <div className="flex justify-between items-center font-bold text-gray-900 border-t-2 border-gray-400 pt-2 mb-4">
            <span className="text-base">Grand Total</span>
            <span className="text-base">{formatCurrency(snapshot.grandTotal)}</span>
          </div>
        </>
      ) : (
        <>
          {/* Customizations — invoice-style table, headers included */}
          <div className="mb-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 capitalize tracking-wider text-left">Customization</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 capitalize tracking-wider text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.lineItems.map(item=>(
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2.5 text-sm text-gray-900">{item.name}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  {snapshot.lineItems.length===0 && (
                    <tr><td colSpan={2} className="px-3 py-5 text-center text-gray-400 text-sm">No customizations added.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary — flags (M2M/Alterations/Rush) only appear here, as rows */}
          <div className="mb-6">
            <div className="text-xs capitalize tracking-wide text-gray-400 mb-2">Order Summary</div>
            {orderSummaryRows.map(({ label, amount, sub }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  {label}
                  {sub && <span className="text-xs font-medium text-gray-400"> ({sub})</span>}
                </span>
                <span className="text-sm text-gray-900">{formatCurrency(amount)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center font-bold text-gray-900 border-t border-gray-300 pt-2">
              <span className="text-sm">Grand Total</span>
              <span className="text-sm">{formatCurrency(snapshot.grandTotal)}</span>
            </div>
          </div>
        </>
      )}

      <div className="text-xs text-gray-400">Generated {fmtDisplay(generatedAt)}</div>
    </div>
  );
}

// ─── ProposalPreviewModal ─────────────────────────────────────────────────────
// Opened from "Generate Proposal". Print → Confirm & Save creates the Proposal
// record (client/sales associate/source customization links + snapshot
// values, status "Generated"). The record is created WITHOUT
// unsigned_document: the Interface Extensions SDK only accepts attachment
// cell values shaped as { url, filename } — it can't take a local File
// directly (confirmed by Airtable's own write-time validation error) — so
// there is no way to push a file living only on the user's disk into an
// attachment field from this code. Once the record exists, the last step
// hands off to Airtable's own record page (which has no such restriction) so
// the user drops the printed PDF onto unsigned_document there directly —
// same reasoning as AttachmentSection's external-form handoff elsewhere in
// this file, just targeting the record we just created instead of a form.
//
// The Close countdown only guards against closing before the document has
// even been seen — once Confirm & Save succeeds, closing is immediate and
// unconditional.
const PROPOSAL_CLOSE_COUNTDOWN_SECONDS = 8;

interface ProposalPreviewModalProps {
  snapshot: ProposalSnapshot;
  clientName: string;
  clientId: string;
  saName: string;
  saRecordId: string | null;
  customizationId: string;
  proposalsTable: Table | null;
  attachmentFormUrl: string;
  onClose: () => void;
}
function ProposalPreviewModal({
  snapshot, clientName, clientId, saName, saRecordId, customizationId, proposalsTable, attachmentFormUrl, onClose,
}: ProposalPreviewModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  const [countdown, setCountdown]     = useState(PROPOSAL_CLOSE_COUNTDOWN_SECONDS);
  // Not just set synchronously on click — the print dialog itself is async and
  // OS-native, so the only signal this page actually gets that printing (or a
  // "Save as PDF") really happened is the browser's own `afterprint` event.
  // There's no way to know from here whether the user actually saved a file
  // vs. cancelled the dialog — no browser API exposes that — but requiring
  // `afterprint` is strictly closer to "a file was produced" than assuming it
  // the instant Print is clicked.
  const [printed, setPrinted]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string|null>(null);
  const [createdRecordId, setCreatedRecordId] = useState<string|null>(null);
  const [generatedAt]                 = useState(() => new Date());

  const success = !!createdRecordId;
  const closeEnabled = countdown <= 0 || success;

  // Single interval started on mount, ticking down to 0 — not restarted per
  // render, so it can't drift or reset while the user interacts with the modal.
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // See setPrintDocumentTitle — set right before printing, restored once
  // the dialog closes.
  const originalTitleRef = useRef(document.title);
  useEffect(() => {
    const h = () => { setPrinted(true); restorePrintDocumentTitle(originalTitleRef.current); };
    window.addEventListener('afterprint', h);
    return () => window.removeEventListener('afterprint', h);
  }, []);
  const handlePrint = () => {
    setPrintDocumentTitle(buildProposalFilename(clientName, snapshot.styleName, generatedAt));
    window.print();
  };

  // Escape is intercepted (not just ignored) while the countdown runs, same as
  // the click-outside guard below — neither can close the modal early.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && closeEnabled) requestClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [closeEnabled, requestClose]);

  const handleConfirmSave = async () => {
    if (!proposalsTable || saving || success) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const customizationsSummary = snapshot.lineItems.length
        ? `Selections: ${snapshot.lineItems.map(i => `${i.name}${i.label ? ` (${i.label})` : ''} — ${formatCurrency(i.amount)}`).join('; ')}`
        : '—';

      const fields: Record<string, unknown> = {
        [PROPOSAL.CLIENT]:                     [{ id: clientId }],
        [PROPOSAL.SOURCE_CUSTOMIZATION]:        [{ id: customizationId }],
        [PROPOSAL.SNAPSHOT_STYLE]:              snapshot.styleName,
        [PROPOSAL.SNAPSHOT_CUSTOMIZATIONS]:     customizationsSummary,
        [PROPOSAL.SNAPSHOT_EMBROIDERY_AMOUNT]:  { name: snapshot.embroideryAmount },
        [PROPOSAL.SNAPSHOT_PRICING]:            snapshot.grandTotal,
        [PROPOSAL.STATUS]:                      { name: 'Generated' },
      };
      if (saRecordId) fields[PROPOSAL.SALES_ASSOCIATE] = [{ id: saRecordId }];
      const newId = await queueWrite(() => proposalsTable!.createRecordAsync(fields));
      setCreatedRecordId(newId);
    } catch (err) {
      console.error('Failed to save proposal:', err);
      setErrorMsg('Failed to save the proposal. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Users generally don't have direct Airtable access, so instead of linking
  // to the record itself, hand off to the same attachments form already used
  // for Measurements/Appointment Photos — prefilled so the only thing left
  // visible/actionable is the file picker. A sandbox-side automation (see
  // automations/danielle_frankel_studios/proposal_attachment_router.js)
  // copies the uploaded file onto this Proposal's unsigned_document.
  const openAttachmentForm = () => {
    if (!createdRecordId) return;
    window.open(buildProposalAttachmentFormUrl(attachmentFormUrl, clientId, createdRecordId, 'Customization Proposal'), '_blank', 'noopener,noreferrer');
  };

  return (
    // Blur only — no dark dim — behind this popup.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 proposal-modal-chrome transition-opacity duration-200 ease-out"
      style={{ backdropFilter:'blur(4px)', opacity: isVisible?1:0 }}
      onClick={e=>{ if (e.target===e.currentTarget && closeEnabled) requestClose(); }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .proposal-print-area, .proposal-print-area * { visibility: visible !important; }
          .proposal-print-area {
            position: absolute; top: 0; left: 0; width: 100%; padding: 32px;
            background: #ffffff !important; color: #111111 !important;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-white/10 transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] flex-1">Generate Proposal</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Document — the only thing that survives @media print. On-screen it
              uses the app's own background tint; print forces plain white
              paper regardless (see @media print above). */}
          <ProposalDocument clientName={clientName} saName={saName} snapshot={snapshot} generatedAt={generatedAt}/>

          {!printed && (
            <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-white/5">
              Print (or save as PDF) to unlock saving the proposal.
            </div>
          )}

          {printed && !success && errorMsg && (
            <div className="text-sm text-red-600 dark:text-red-400 pt-2 border-t border-gray-100 dark:border-white/5">{errorMsg}</div>
          )}

        </div>

        {/* Footer — Close/Print/Confirm & Save while pending; once saved,
            those three disappear and only Upload Generated Proposal remains. */}
        <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end items-center gap-3">
          {success ? (
            <button type="button" onClick={openAttachmentForm}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white dark:text-[#1B1813] bg-[#D97706] dark:bg-[#FBBF24] rounded-lg hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors">
              <UploadIcon size={14}/>Upload Generated Proposal
            </button>
          ) : (
            <>
              <button type="button" onClick={()=>{ if (closeEnabled) requestClose(); }} disabled={!closeEnabled}
                className="px-5 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {closeEnabled ? 'Close' : `Close (${countdown})`}
              </button>
              <button type="button" onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-700 hover:dark:bg-gray-200 transition-colors">
                <PrinterIcon size={14}/>Print
              </button>
              {printed && (
                <button type="button" onClick={handleConfirmSave} disabled={saving}
                  className="bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] rounded-lg px-5 py-2 text-sm font-semibold hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : errorMsg ? 'Retry' : 'Confirm & Save'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ProposalAttachmentField ────────────────────────────────────────────────
// One row inside ProposalDetailModal: either an "Upload" button (attachment
// not present yet) or a thumbnail + Download once it is. Shared between the
// unsigned and signed sections since both behave identically — only the
// label, files, and upload handler differ.
type ProposalFile = { id: string; url: string; filename: string; thumbnails?: { small?: { url: string }; large?: { url: string } } };
interface ProposalAttachmentFieldProps {
  label: string;
  files: ProposalFile[];
  onUpload: () => void;
  uploadDisabledReason?: string;
  // Suggested filename (without extension) — client_style_date_time,
  // snake_case. Falls back to the attachment's own filename if omitted.
  downloadBaseName?: string;
}
function ProposalAttachmentField({ label, files, onUpload, uploadDisabledReason, downloadBaseName }: ProposalAttachmentFieldProps) {
  const labelCls = 'text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';
  const file = files[0];
  const downloadName = file ? (downloadBaseName ? `${downloadBaseName}${fileExtension(file.filename)}` : file.filename) : '';
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {file ? (
        <div className="flex items-center gap-3">
          <div onClick={()=>window.open(file.url, '_blank', 'noopener,noreferrer')}
            className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0">
            <img src={file.thumbnails?.large?.url ?? file.thumbnails?.small?.url ?? file.url} alt={file.filename} className="w-full h-full object-cover"/>
          </div>
          <a href={file.url} download={downloadName} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            <UploadIcon size={14} className="text-gray-500 dark:text-gray-400 rotate-180"/>Download
          </a>
        </div>
      ) : (
        <div>
          <button type="button" onClick={onUpload} disabled={!!uploadDisabledReason}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white dark:text-[#1B1813] bg-[#D97706] dark:bg-[#FBBF24] rounded-lg hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F] transition-colors disabled:opacity-50">
            <UploadIcon size={14}/>Upload {label}
          </button>
          {uploadDisabledReason && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{uploadDisabledReason}</div>}
        </div>
      )}
    </div>
  );
}

// ─── ProposalDetailModal ────────────────────────────────────────────────────
// Opened by clicking a Proposal chip (from CustomizationModal's Proposals
// list or the Customization Requests table). Reuses the same document layout
// as ProposalPreviewModal's preview, but reads from the persisted snapshot_*
// fields on an already-saved record rather than live in-progress values —
// there's no structured line-items array stored on the record, only the
// flattened snapshot_customizations text, so this shows that text block
// instead of rebuilding a line-items table. Also owns both attachment slots
// (unsigned/signed): the Interface Extensions SDK can't push a local File
// into an attachment field, so uploading either one hands off to the same
// attachments form, prefilled with this exact Proposal record — the
// attachment_router automation matches it back and (for signed) sets status
// to "Signed" itself. A signed copy can't be uploaded before the unsigned
// one exists.
interface ProposalDetailModalProps {
  proposalRecord: AirtableRecord;
  proposalsTable: Table;
  clientName: string;
  saName: string;
  // Live-recomputed from the source Customization (see CustomizationModal's
  // liveDisplaySnapshot) — not read from the persisted snapshot_* fields, so
  // this uses the exact same ProposalDocument component/markup as
  // ProposalPreviewModal, headers and all, instead of a simplified text view.
  snapshot: ProposalSnapshot;
  attachmentFormUrl: string;
  onClose: () => void;
}
function ProposalDetailModal({ proposalRecord, proposalsTable, clientName, saName, snapshot, attachmentFormUrl, onClose }: ProposalDetailModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') requestClose(); };
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[requestClose]);

  const fUnsigned    = proposalsTable.getFieldIfExists(PROPOSAL.UNSIGNED_DOCUMENT);
  const fSigned      = proposalsTable.getFieldIfExists(PROPOSAL.SIGNED_DOCUMENT);
  const fClientP     = proposalsTable.getFieldIfExists(PROPOSAL.CLIENT);
  const fGeneratedAt = proposalsTable.getFieldIfExists(PROPOSAL.GENERATED_AT);

  const clientId         = fClientP ? ((proposalRecord.getCellValue(fClientP) as Array<{id:string}>|null)?.[0]?.id ?? null) : null;
  const generatedAtRaw   = fGeneratedAt ? (proposalRecord.getCellValue(fGeneratedAt) as string|null) : null;
  const generatedAt      = generatedAtRaw ? new Date(generatedAtRaw) : new Date();
  const downloadBaseName = buildProposalFilename(clientName, snapshot.styleName, generatedAt);

  const unsigned = fUnsigned ? ((proposalRecord.getCellValue(fUnsigned) as ProposalFile[]|null) ?? []) : [];
  const signed   = fSigned   ? ((proposalRecord.getCellValue(fSigned)   as ProposalFile[]|null) ?? []) : [];
  const hasUnsigned = unsigned.length > 0;

  // See setPrintDocumentTitle — set right before printing, restored once
  // the dialog closes.
  const originalTitleRef = useRef(document.title);
  useEffect(() => {
    const h = () => { restorePrintDocumentTitle(originalTitleRef.current); };
    window.addEventListener('afterprint', h);
    return () => window.removeEventListener('afterprint', h);
  }, []);
  const handlePrint = () => {
    setPrintDocumentTitle(downloadBaseName);
    window.print();
  };

  const openUnsignedUploadForm = () => {
    if (!clientId) return;
    window.open(buildProposalAttachmentFormUrl(attachmentFormUrl, clientId, proposalRecord.id, 'Customization Proposal'), '_blank', 'noopener,noreferrer');
  };
  const openSignedUploadForm = () => {
    if (!clientId || !hasUnsigned) return;
    window.open(buildProposalAttachmentFormUrl(attachmentFormUrl, clientId, proposalRecord.id, 'Signed Proposal'), '_blank', 'noopener,noreferrer');
  };

  return (
    // Blur only — no dark dim — behind this popup.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backdropFilter:'blur(4px)', opacity: isVisible?1:0 }}
      onClick={e=>{ if (e.target===e.currentTarget) requestClose(); }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .proposal-print-area, .proposal-print-area * { visibility: visible !important; }
          .proposal-print-area {
            position: absolute; top: 0; left: 0; width: 100%; padding: 32px;
            background: #ffffff !important; color: #111111 !important;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-white/10 transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
        onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <button onClick={requestClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 hover:dark:text-gray-300 transition-colors">
            <ArrowLeftIcon size={18}/>
          </button>
          <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] flex-1">{proposalRecord.name || 'Proposal'}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <ProposalDocument clientName={clientName} saName={saName} snapshot={snapshot} generatedAt={generatedAt}/>

          {/* While unsigned isn't attached yet, offer Print here too — same
              document, in case it wasn't printed/saved during generation. */}
          {!hasUnsigned && (
            <button type="button" onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-700 hover:dark:bg-gray-200 transition-colors">
              <PrinterIcon size={14}/>Print
            </button>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ProposalAttachmentField label="Unsigned Proposal" files={unsigned} onUpload={openUnsignedUploadForm} downloadBaseName={downloadBaseName}/>
            <ProposalAttachmentField label="Signed Proposal" files={signed} onUpload={openSignedUploadForm} downloadBaseName={downloadBaseName}
              uploadDisabledReason={!hasUnsigned ? 'Attach the unsigned proposal first' : undefined}/>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RecapDocument ──────────────────────────────────────────────────────────
// The Recap Doc PDF — follows the Figma "Appointment Recap Template" export.
// Pagination is chunk-based, not measured: styles are split into fixed-size
// pages via RECAP_STYLES_PER_PAGE, each page break enforced with CSS
// `break-after: page` (there is no existing precedent in this codebase for
// DOM-measured pagination — see attachment_router README note — so a bounded
// chunk size is the deterministic alternative). The photo disclaimer + 3x3
// grid render exactly once, appended to the LAST page produced (whether
// that's the only page or the final overflow page), per the AC.
// Physical page geometry — US Letter at the standard 96px/in used for
// on-screen CSS length conversions. Padding measured directly off the
// Figma export (2026-08-04, "Recap — Page 4.pdf"/.svg, 816x2112px = two
// 816x1056 pages at this same 96px/in scale): every text run's left edge
// sits at x=72 and every price's right edge sits at x=744 (816-72) on
// both pages, so the page's inner padding is 72px on all sides — NOT
// Tailwind's `p-8` (32px) as previously assumed before the Figma file was
// available to measure against.
const RECAP_PX_PER_IN = 96;
const RECAP_PAGE_HEIGHT_PX = 11 * RECAP_PX_PER_IN;
const RECAP_PAGE_WIDTH_PX = 8.5 * RECAP_PX_PER_IN;
const RECAP_PAGE_PADDING_PX = 72;
const RECAP_PHOTO_DISCLAIMER = 'As outlined in your appointment agreement, please do not post any imagery from your visit on social media.';

// Typography — filled in by Julia (2026-08-03) via recap_doc_typography.xlsx,
// one row per placeholder. NOTE: this only sets font-family — it does not
// load the font files. Canela Text and Abhaya Libre must already be
// available to this page (installed system font, @font-face elsewhere in
// the Airtable interface, or a Google Fonts/webfont link) or the browser
// will silently fall back to its default serif/sans-serif. Footer wordmark
// is still pending — Julia's sending a PNG for it, currently plain text.
// 'Canela Text' is kept FIRST in the stack in case it's ever actually
// licensed/loaded some other way (installed system font, a real Typekit
// embed, etc.) — it would then take priority automatically with no code
// change here. Until then, 'Fraunces' (loaded below) is the effective
// stand-in: Canela Text is a commercial font (Colophon Foundry) not
// available on Google Fonts, and per Axel/Julia (2026-08-05) a visually
// similar free serif is preferable to the generic Georgia fallback while
// the real license situation gets sorted.
const RECAP_BODY_FONT_FAMILY = "'Canela Text', 'Fraunces', Georgia, serif";
const RECAP_NUMBER_FONT_FAMILY = "'Abhaya Libre', serif";

// Neither font was actually being loaded anywhere (2026-08-05 — confirmed
// this is why both were silently falling back to Georgia/serif): nothing
// in this Interface Extension, nor anywhere else in the Airtable base,
// injects a @font-face or webfont <link> for them, so the fallback in the
// family list above was ALWAYS what rendered, on every machine, sandbox or
// production. Interface Extension code blocks can load external CSS/font
// requests fine (this base already fetches attachment/thumbnail URLs from
// Airtable's own CDN), so a <link> injected into <head> works the same way
// a real page's <head> would.
//
// Abhaya Libre and Fraunces are both free, open-license Google Fonts —
// safe to self-load from Google's CDN, done once below via
// ensureRecapWebFontsLoaded(). Fraunces is a temporary stand-in for Canela
// Text (see the comment above RECAP_BODY_FONT_FAMILY) — swap it out once
// Canela Text has a real licensed source: either the actual .woff2 files
// to self-host via @font-face, or an Adobe Fonts/Typekit project ID if
// Danielle Frankel's own site already serves it that way (check the
// production site's <head> for a `use.typekit.net/xxxxxxx.js` script tag
// — that ID would work here too).
let recapWebFontsInjected = false;
function ensureRecapWebFontsLoaded() {
  if (recapWebFontsInjected || typeof document === 'undefined') return;
  recapWebFontsInjected = true;
  if (document.getElementById('recap-doc-webfonts')) return;
  const link = document.createElement('link');
  link.id = 'recap-doc-webfonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@400;600;700&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&display=swap';
  document.head.appendChild(link);
}

// "Phone" / "Style Price" — Julia's typography sheet called every number
// row "identical spec", but measuring the actual Figma export (2026-08-04)
// showed phone value at 10.5px vs. style price at 13px. The Figma file is
// the more exact source (it's the literal design, not a hand-filled
// sheet), so this is two styles instead of one shared one. (A third,
// Custom Pricing at 11px, existed briefly for the CR "Custom Pricing" row
// — removed 2026-08-05 per Julia, along with that row entirely; see
// RecapDocHybridEntry's comment.)
const RECAP_NUMBER_FONT_STYLE: React.CSSProperties = {
  fontFamily: RECAP_NUMBER_FONT_FAMILY,
  fontWeight: 600,
  fontSize: '13px',
  lineHeight: '100%',
  letterSpacing: '0%',
  textAlign: 'right',
};
const RECAP_PHONE_VALUE_STYLE: React.CSSProperties = {
  ...RECAP_NUMBER_FONT_STYLE,
  fontSize: '10.5px',
};
// "APPOINTMENT RECAP" / "STYLES" section labels
const RECAP_SECTION_LABEL_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontSize: '9px', lineHeight: 1, letterSpacing: '2px', textAlign: 'left',
};
// "Email:" / "Phone:" / "Wedding Date:" / "Appointment:" / "Client Specialist:" labels
const RECAP_FIELD_LABEL_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontSize: '7.5px', lineHeight: '11px', letterSpacing: '1.2px', textAlign: 'left',
};
// Email / Wedding Date / Appointment / Client Specialist values (Phone uses
// RECAP_NUMBER_FONT_STYLE instead, per the sheet)
const RECAP_FIELD_VALUE_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontSize: '10.5px', lineHeight: '13px', letterSpacing: '0%', textAlign: 'left',
};
// Client Name (e.g. "JULIA SHAO COLLINS")
const RECAP_CLIENT_NAME_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontSize: '26px', lineHeight: 1, letterSpacing: '5px', textAlign: 'left',
};
// Style name (e.g. "EFFIE")
const RECAP_STYLE_NAME_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontSize: '13px', lineHeight: 1, letterSpacing: '3px', textAlign: 'left',
};
// Free-text note under a style (description / CR notes body text)
const RECAP_STYLE_NOTES_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontSize: '10.5px', lineHeight: '15px', letterSpacing: '0%', textAlign: 'left',
};
// "NOTES" small caps label
const RECAP_SMALL_LABEL_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontSize: '7.5px', lineHeight: 1, letterSpacing: '1.2px', textAlign: 'left',
};
// Photo disclaimer italic line
const RECAP_DISCLAIMER_STYLE: React.CSSProperties = {
  fontFamily: RECAP_BODY_FONT_FAMILY, fontWeight: 100, fontStyle: 'italic', fontSize: '10.5px', lineHeight: '15px', letterSpacing: '0%', textAlign: 'left',
};

// Footer wordmark PNG — provided directly (2026-08-03), since the Figma
// design file itself needs authentication no available connector in this
// session can provide. Original asset is 4096x245px (~16.71:1 aspect,
// matching the source SVG's 184x11 box) — sized via CSS height with
// width:auto to preserve that ratio at whatever footer size is used.
const RECAP_FOOTER_LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAEAAAAAD1CAYAAADQIjBzAAAQAElEQVR4AeydBZxtVfm/hz/dXWKACoqoKHb8VBTsxu4WC1uxUFFUbDHB7i5ExUYxsBMUEQRBurv9P1+4c5l738ycfXacs+Ph831Z55y94n2fuXNmx1rv+n8z/icBCUhAAhKQgAQkIAEJSEACEpBA3wkYnwQkIAEJSEACEpCABCQgAQlIQAL9J2CEEpCABCQgAQlIQAISkIAEJCABCfSfgBFKQAISkIAEJCABCUhAAhKQgAQk0H8CMyYAGMAP2RAlIAEJSEACEpCABCQgAQlIYOgEjF8CEpCABCQgAQlIQAISkIAEJCCB/hMwQglIQAISkIAEJCABCUhAAhKQgAT6T8AIJSABCUhAAhKQgAQkIAEJSEACEug/gRkTAAzhh2yMEpCABCQgAQlIQAISkIAEJDBwAoYvAQlIQAISkIAEJCABCUhAAhKQQP8JGKEEJCABCUhAAhKQgAQkIAEJSEAC/SdghBKQgAQkIAEJSEACEpCABCQgAQn0n0AiNAFAKGgSkIAEJCABCUhAAhKQgAQkIIH+EjAyCUhAAhKQgAQkIAEJSEACEpCABPpPwAglIAEJSEACEpCABCQgAQlIQAIS6D8BI5SABCQgAQlIQAISkIAEJCABCUig/wSujrBqAoC16WYTbNMldhPKHbAdsbstsV0pH4w9fIntTvls7HnY6+bYW3n9/nnsi3y2mH2A47Pt3svrt2Dp96WUz8GehD0C2xm7K3YjbCNsNUxJQAISkIAEJCABCUhAAhKQgAT6TcDoJCABCUhAAhKQgAQkIAEJSEAC/SdghBKQgAQkIAEJSEACEpCABCQgAQn0n4ARSkACEpCABCQgAQlIQAISkIAEJNB/AkYoAQlIQAISkIAEJCABCUhAAhLoP4ElES6fACCL9Q/lWFH7IXW/M8e+wOvPY5/FDlhiWaD/bl6/fYllcf5refxq7AVzLEkBnsr75S2L9xezp8zr8zRe/9dr9x8+/mfsHdg7sf1w/pQVJRQlIAEJSEACEpCABCQgAQlIQAJ9J2AEEpCABCQgAQlIQAISkIAEJCABCVQlYD4JSEACEpCABCQgAQlIQAISkIAEJCABCQxHwLklIAEJSEACEpCABCQgAQlIQAISkIAEJCCBIQi4AMAQsMwqAQlIQAISkIAEJCABCUhAAhKQgAQkIAEJSEACEpCABCQgAQlIQAISkIAEJDCEwP8HAAD//8oIVZAAAAAGSURBVAMAy0M1BQtY6TQAAAAASUVORK5CYII=";

// A style shown with no matching customization request — just a name/price/
// photo chip pulled straight from Favorite Styles from Appointment.
interface RecapDocFavoriteEntry {
  kind: 'favorite';
  id: string;
  name: string;
  price: number;
  photoUrl: string | null;
}
// A single-style customization request that's reached internal approval.
// Price to the right of the name is the style's BASE price (not the grand
// total) — description comes from the Style's own Notes field, the CR's own
// free-text notes render below that, and Custom Pricing (the CR's
// grandTotal, base + customizations) is last.
interface RecapDocRegularEntry {
  kind: 'regular';
  id: string;
  name: string;
  price: number;
  photoUrl: string | null;
  description: string;
  crNotes: string;
}
// A two-style Hybrid customization request. Two style blocks (each name +
// description + base price), the CR's own notes below both. No Custom
// Pricing here — removed 2026-08-05 per Julia: the recap only ever shows
// each style's own base price (never the ×1.85-etc. computed total); the
// actual custom price lives exclusively in the separate Customization
// Proposal document, where the multiplier math stays hidden from the
// client.
interface RecapDocHybridEntry {
  kind: 'hybrid';
  id: string;
  style1: { name: string; price: number; photoUrl: string | null; description: string };
  style2: { name: string; price: number; photoUrl: string | null; description: string };
  crNotes: string;
}
type RecapDocEntry = RecapDocFavoriteEntry | RecapDocRegularEntry | RecapDocHybridEntry;

interface RecapDocSnapshot {
  clientName: string;
  email: string;
  phone: string;
  weddingDateDisplay: string;
  appointmentDisplay: string;
  clientSpecialist: string;
  entries: RecapDocEntry[];
  photos: Array<{ id: string; url: string; thumbnails?: { small?: { url: string }; large?: { url: string } } }>;
  logoUrl: string;
}

// ─── Shared render pieces ──────────────────────────────────────────────────
// Used both by the real visible/print pages AND the hidden measurement pass
// below, so whatever height gets measured is guaranteed to be the height
// that actually prints — no risk of the two drifting apart.
// isLast controls the bottom border explicitly — this used to rely on the
// Tailwind `last:` pseudo-class, but that only matches when the element is
// the actual last DOM child of its parent, and these rows share their
// parent with the header/footer/grid (rendered as siblings, not wrapped in
// their own list container), so `last:border-0` never matched and every
// row — including the true last one — kept its bottom border.
function RecapEntryRow({ entry, isLast }: { entry: RecapDocEntry; isLast?: boolean }) {
  const borderCls = isLast ? '' : 'border-b border-gray-200';
  if (entry.kind === 'hybrid') {
    return (
      <div className={`py-4 ${borderCls}`}>
        <div className="grid grid-cols-2 gap-4">
          {([entry.style1, entry.style2] as const).map((s, i) => (
            <div key={i} className="flex gap-6">
              <div className="w-[84px] h-[118px] rounded bg-[#D8D0BC] overflow-hidden flex-shrink-0">
                {s.photoUrl && <img src={s.photoUrl} alt="" className="w-full h-full object-cover"/>}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-baseline">
                  <span style={RECAP_STYLE_NAME_STYLE}>{s.name.toUpperCase()}</span>
                  <span style={RECAP_NUMBER_FONT_STYLE}>{formatCurrency(s.price)}</span>
                </div>
                {s.description && <div className="mt-1 text-gray-700" style={RECAP_STYLE_NOTES_STYLE}>{s.description}</div>}
              </div>
            </div>
          ))}
        </div>
        {entry.crNotes && (
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-gray-500" style={RECAP_SMALL_LABEL_STYLE}>NOTES</span>
            <span className="text-gray-700" style={RECAP_STYLE_NOTES_STYLE}>{entry.crNotes}</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={`flex gap-6 py-4 ${borderCls}`}>
      <div className="w-[84px] h-[118px] rounded bg-[#D8D0BC] overflow-hidden flex-shrink-0">
        {entry.photoUrl && <img src={entry.photoUrl} alt="" className="w-full h-full object-cover"/>}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline">
          <span style={RECAP_STYLE_NAME_STYLE}>{entry.name.toUpperCase()}</span>
          <span style={RECAP_NUMBER_FONT_STYLE}>{formatCurrency(entry.price)}</span>
        </div>
        {entry.kind === 'regular' && entry.description && (
          <div className="mt-1 text-gray-700" style={RECAP_STYLE_NOTES_STYLE}>{entry.description}</div>
        )}
        {entry.kind === 'regular' && entry.crNotes && (
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-gray-500" style={RECAP_SMALL_LABEL_STYLE}>NOTES</span>
            <span className="text-gray-700" style={RECAP_STYLE_NOTES_STYLE}>{entry.crNotes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
function RecapFirstPageHeader({ snapshot }: { snapshot: RecapDocSnapshot }) {
  return (
    <>
      <div className="text-gray-500 mb-1" style={RECAP_SECTION_LABEL_STYLE}>APPOINTMENT RECAP</div>
      <div className="mb-4" style={RECAP_CLIENT_NAME_STYLE}>{snapshot.clientName.toUpperCase()}</div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6">
        {/* Uppercase per Julia (2026-08-05) — also matches the Figma export,
            which has no literal colon either (just label/value side by
            side); kept the colon since only casing was called out. */}
        <div><span className="text-gray-500" style={RECAP_FIELD_LABEL_STYLE}>EMAIL: </span><span style={RECAP_FIELD_VALUE_STYLE}>{snapshot.email || '—'}</span></div>
        <div><span className="text-gray-500" style={RECAP_FIELD_LABEL_STYLE}>PHONE: </span><span style={RECAP_PHONE_VALUE_STYLE}>{snapshot.phone || '—'}</span></div>
        <div><span className="text-gray-500" style={RECAP_FIELD_LABEL_STYLE}>WEDDING DATE: </span><span style={RECAP_FIELD_VALUE_STYLE}>{snapshot.weddingDateDisplay || '—'}</span></div>
        <div><span className="text-gray-500" style={RECAP_FIELD_LABEL_STYLE}>APPOINTMENT: </span><span style={RECAP_FIELD_VALUE_STYLE}>{snapshot.appointmentDisplay || '—'}</span></div>
        <div><span className="text-gray-500" style={RECAP_FIELD_LABEL_STYLE}>CLIENT SPECIALIST: </span><span style={RECAP_FIELD_VALUE_STYLE}>{snapshot.clientSpecialist || '—'}</span></div>
      </div>
      <div className="text-gray-500 mb-3" style={RECAP_SECTION_LABEL_STYLE}>STYLES</div>
    </>
  );
}
// Continuation pages (n+1): header is APPOINTMENT RECAP + the photo
// disclaimer, on every one of them — not just the last — per Julia
// (2026-08-03).
function RecapContinuationHeader() {
  return (
    <>
      <div className="text-gray-500 mb-1" style={RECAP_SECTION_LABEL_STYLE}>APPOINTMENT RECAP</div>
      <div className="text-gray-500 mb-4" style={RECAP_DISCLAIMER_STYLE}>{RECAP_PHOTO_DISCLAIMER}</div>
    </>
  );
}
// Used only in the single-page case (first page is also the last) — its
// header is the client-info block, not the disclaimer, so the disclaimer
// still needs to appear once, right before the photo grid.
function RecapSingleDisclaimerLine() {
  return <div className="text-gray-500 mt-6 mb-4" style={RECAP_DISCLAIMER_STYLE}>{RECAP_PHOTO_DISCLAIMER}</div>;
}
function RecapPhotoGrid({ photos, topMargin }: { photos: RecapDocSnapshot['photos']; topMargin: boolean }) {
  if (photos.length === 0) return null;
  return (
    <div className={`grid grid-cols-3 gap-3 ${topMargin ? 'mt-6' : ''}`}>
      {photos.map(photo => (
        <div key={photo.id} className="aspect-[3/4] rounded bg-[#D8D0BC] overflow-hidden">
          <img src={photo.thumbnails?.large?.url ?? photo.url} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}
// Single row: logo centered, page number (just the number, per Julia's
// Figma reference — not "N / total") right-aligned on the same baseline.
// pageNumber/totalPages are optional so the measurement pass (which has
// neither — it measures the footer once, in isolation) reports the same
// height a real single-page document's footer would use; the page-number
// only ever appears when there's more than one page anyway, per Julia
// (2026-08-03), so leaving it out of that one measurement doesn't matter —
// it occupies the same single line as the logo, not an extra line.
// Flattened (2026-08-04): this used to be position:relative with an
// absolutely-positioned page-number child — nested inside an already
// absolutely-positioned .recap-doc-page-section, i.e. absolute-inside-
// relative-inside-absolute. That's a real possible reason the page number
// (and this whole footer, logo included) wasn't showing up in print at
// all — three levels of positioning context is a lot to assume any given
// print pipeline fully supports, and this one has already shown gaps
// (forced page-break, @page nested in @media, possibly cross-page
// background inheritance). A plain flex row with two equal spacer
// columns achieves the same "logo centered, page number flush right"
// layout with zero position:absolute anywhere in this component.
function RecapFooter({ logoUrl, pageNumber, totalPages }: { logoUrl: string; pageNumber?: number; totalPages?: number }) {
  const showPageNumber = totalPages != null && totalPages > 1;
  return (
    <div className="flex items-center mt-8">
      <div style={{ flex: '1 1 0' }} />
      <img src={logoUrl} alt="Danielle Frankel" style={{ height: '11px', width: 'auto' }}/>
      <div style={{ flex: '1 1 0', textAlign: 'right' }}>
        {showPageNumber && (
          <span className="text-gray-400" style={{ fontFamily: RECAP_BODY_FONT_FAMILY, fontSize: '11px' }}>{pageNumber}</span>
        )}
      </div>
    </div>
  );
}

// ─── DOM-measured pagination ────────────────────────────────────────────────
// Replaces the earlier fixed-entries-per-page guess (which repeatedly either
// wasted a page's worth of blank space or overflowed/clipped, depending on
// how wrong the guess was for that mix of entries/notes). Instead, every
// header/footer/entry/grid variant renders once, off-screen but still fully
// laid out (position:fixed far off the visible canvas, visibility:hidden —
// NOT display:none, which would report zero height), real pixel heights are
// read via getBoundingClientRect, and entries are packed into pages against
// the real US-Letter page height. This runs once per RecapDocument instance
// (the on-screen preview and the print portal copy each measure
// independently) via useLayoutEffect, so it's committed before the browser
// paints — no visible flash of an unpaginated document.
interface RecapPageGroup {
  entries: RecapDocEntry[];
  isFirstPage: boolean;
  showGrid: boolean;
}
// Fixed pixels held back from every page's usable budget as headroom for
// measurement/render discrepancies (subpixel rounding, fallback-font metric
// differences between the hidden measurement pass and the real print
// render, etc.) — without this, a page whose entries measured just barely
// under budget could still overflow past its absolutely-positioned
// section's 11in boundary once actually printed, bleeding into the next
// physical page's territory (where it can end up hidden behind that page's
// own background, or otherwise visually displaced) instead of being caught
// before it happens. Bumped from 24 → 64 (2026-08-04) after exactly that
// kind of displacement showed up in real output despite passing this
// margin previously.
const RECAP_PAGE_SAFETY_MARGIN_PX = 64;

// DELIBERATE EXPERIMENT (2026-08-04, per Julia): the previous version kept a
// second, permanently-present "scratch" copy of the whole document
// off-screen (position:fixed + visibility:hidden) purely to measure it,
// alongside the real visible/print copy. `position: fixed` is specified by
// CSS to repeat on every physical printed page — if visibility:hidden
// didn't fully suppress that in Chrome's print engine (a known
// cross-browser inconsistency), that scratch copy would print on every
// page and explain the scrambled pagination. Rather than patch around that
// with another display:none escape hatch, this version removes the
// parallel copy AND every position:fixed entirely: there is only ever ONE
// copy of the content in the DOM. On first mount (groups === null) it
// renders unpaginated, in normal document flow, purely so its real height
// can be measured. useLayoutEffect measures it and calls setGroups
// synchronously, BEFORE the browser paints anything — React re-renders with
// the real paginated pages before that first paint ever reaches the
// screen, so the unpaginated version is never actually visible to the user
// or to the print engine. No fixed positioning, no hidden clone, no
// display:none workaround — nothing that could repeat across pages.
function useRecapPageGroups(snapshot: RecapDocSnapshot): { groups: RecapPageGroup[] | null; measuringContent: React.ReactNode } {
  const [groups, setGroups] = useState<RecapPageGroup[] | null>(null);
  const firstHeaderRef = useRef<HTMLDivElement>(null);
  const contHeaderRef = useRef<HTMLDivElement>(null);
  const singleDisclaimerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Depend on a content fingerprint, not `snapshot`'s object identity —
  // recapDocSnapshot upstream is memoized, but if any of its own deps
  // (e.g. existingApptPhotos, computed inline via getVal() on every
  // PostAppointmentModal render) aren't themselves stable, useMemo still
  // recreates a new snapshot object every render even when the actual
  // content hasn't changed, which would otherwise re-trigger measurement
  // every render (an infinite update loop — React error #185).
  const snapshotKey = JSON.stringify(snapshot);

  // When the actual content changes, drop back to the unpaginated
  // measuring render so the layout effect below has fresh refs to measure
  // against (the paginated render doesn't include these ref'd elements).
  useEffect(() => {
    setGroups(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey]);

  useLayoutEffect(() => {
    if (groups !== null) return; // already paginated for this content
    // The footer (logo + page number) renders on every page — its height
    // must be reserved on every page's budget, same as the header, or
    // entries pack right up to the page edge and push the footer past the
    // physical sheet.
    const footerH = footerRef.current?.getBoundingClientRect().height ?? 0;
    const usable = RECAP_PAGE_HEIGHT_PX - RECAP_PAGE_PADDING_PX * 2 - footerH - RECAP_PAGE_SAFETY_MARGIN_PX;
    const firstHeaderH = firstHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const contHeaderH  = contHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const singleDisclaimerH = singleDisclaimerRef.current?.getBoundingClientRect().height ?? 0;
    const gridH = snapshot.photos.length > 0 ? (gridRef.current?.getBoundingClientRect().height ?? 0) : 0;
    const entryHeights = snapshot.entries.map((_, i) => entryRefs.current[i]?.getBoundingClientRect().height ?? 0);

    const out: RecapPageGroup[] = [];
    let current: RecapDocEntry[] = [];
    let isFirst = true;
    let remaining = usable - firstHeaderH;
    for (let i = 0; i < snapshot.entries.length; i++) {
      const h = entryHeights[i];
      if (current.length > 0 && remaining < h) {
        out.push({ entries: current, isFirstPage: isFirst, showGrid: false });
        current = [];
        isFirst = false;
        remaining = usable - contHeaderH;
      }
      current.push(snapshot.entries[i]);
      remaining -= h;
    }
    const extraForGrid = (isFirst ? singleDisclaimerH : 0) + gridH;
    if (remaining >= extraForGrid) {
      out.push({ entries: current, isFirstPage: isFirst, showGrid: true });
    } else {
      out.push({ entries: current, isFirstPage: isFirst, showGrid: false });
      out.push({ entries: [], isFirstPage: false, showGrid: true });
    }
    setGroups(out);
  }, [groups, snapshot]);

  // Rendered ONLY while groups === null — i.e. never at the same time as
  // the paginated pages, and never printed, since by the time anything
  // paints (on-screen or via window.print()) groups is already set. Plain
  // normal-flow div, no position:fixed anywhere.
  const measuringContent = groups === null ? (
    <div aria-hidden style={{
      width: `${RECAP_PAGE_WIDTH_PX}px`, padding: `${RECAP_PAGE_PADDING_PX}px`,
      boxSizing: 'border-box', fontFamily: RECAP_BODY_FONT_FAMILY,
    }}>
      <div ref={firstHeaderRef}><RecapFirstPageHeader snapshot={snapshot}/></div>
      <div ref={contHeaderRef}><RecapContinuationHeader/></div>
      <div ref={singleDisclaimerRef}><RecapSingleDisclaimerLine/></div>
      {/* Measured WITH the page-number line present (pageNumber/totalPages
          set) so footerH always reserves room for it — the real doc might
          end up single-page (no number shown) or multi-page (number
          shown), but reserving the larger height defensively is safer than
          under-reserving. Uses the embedded base64 logo, NOT
          snapshot.logoUrl (a live network attachment URL) — the img has an
          explicit height so its layout footprint doesn't actually depend on
          whether the image data has loaded, but avoiding an async network
          fetch in this synchronous measurement pass removes any chance of
          a load-timing race affecting the measured height. */}
      <div ref={footerRef}><RecapFooter logoUrl={RECAP_FOOTER_LOGO_DATA_URI} pageNumber={1} totalPages={2}/></div>
      {snapshot.photos.length > 0 && <div ref={gridRef}><RecapPhotoGrid photos={snapshot.photos} topMargin={false}/></div>}
      {snapshot.entries.map((entry, i) => (
        <div key={entry.id} ref={el => { entryRefs.current[i] = el; }}>
          <RecapEntryRow entry={entry}/>
        </div>
      ))}
    </div>
  ) : null;

  return { groups, measuringContent };
}

interface RecapDocumentProps {
  snapshot: RecapDocSnapshot;
}
function RecapDocument({ snapshot }: RecapDocumentProps) {
  const { groups, measuringContent } = useRecapPageGroups(snapshot);

  // REVERTED experiment #2 (2026-08-04, per Julia): the "one sheet, N
  // position:absolute page sections stacked inside it" approach ("sobres")
  // regressed pagination back to rendering as a single page — exactly the
  // bug we'd already fixed once by moving @page out of @media print. The
  // version that DID produce two real, mostly-correct physical pages (right
  // after that @page fix, before "sobres" existed) was simpler: N normal
  // block-level SIBLINGS, no position:absolute anywhere, each fixed at
  // exactly 11in tall via plain CSS height and stacked back-to-back with
  // zero margin — @page{size:letter} cuts the resulting tall flow every
  // 11in on its own, with nothing telling it to and nothing overriding its
  // positioning model. Reverting to that, keeping every other fix made
  // since (live logo lookup, flattened footer, explicit last-entry border,
  // larger safety margin).
  return (
    <div className="recap-print-area" style={{ fontFamily: RECAP_BODY_FONT_FAMILY }}>
      {groups === null ? (
        measuringContent
      ) : groups.map((group, pageIdx) => (
        // display:flex/flexDirection:column + the flex:1 wrapper below pins
        // the footer (logo + page count) to the true bottom of the fixed
        // 11in page, regardless of how much content is above it. Previously
        // the footer was just the next block-level sibling after the last
        // style row, so its vertical position drifted with content height
        // instead of sitting flush at the bottom — fixed 2026-08-05 per
        // Julia.
        <div key={pageIdx} className="recap-doc-page-section bg-[#F8F5EE] text-[#1A1612]" style={{ width: `${RECAP_PAGE_WIDTH_PX}px`, height: `${RECAP_PAGE_HEIGHT_PX}px`, padding: `${RECAP_PAGE_PADDING_PX}px`, boxSizing: 'border-box', margin: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: '1 1 auto', minHeight: 0 }}>
            {group.isFirstPage ? <RecapFirstPageHeader snapshot={snapshot}/> : <RecapContinuationHeader/>}
            {group.entries.map((entry, i) => <RecapEntryRow key={entry.id} entry={entry} isLast={i === group.entries.length - 1}/>)}
            {group.entries.length === 0 && group.isFirstPage && (
              <div className="text-sm text-gray-400 py-6 text-center">No styles selected for this appointment.</div>
            )}
            {group.showGrid && (
              <>
                {group.isFirstPage && <RecapSingleDisclaimerLine/>}
                <RecapPhotoGrid photos={snapshot.photos} topMargin={!group.isFirstPage}/>
              </>
            )}
          </div>
          <RecapFooter logoUrl={snapshot.logoUrl} pageNumber={pageIdx + 1} totalPages={groups.length}/>
        </div>
      ))}
    </div>
  );
}

// ─── RecapDocPreviewModal ───────────────────────────────────────────────────
// Opened from "Generate Recap Doc" (title bar). This step ONLY produces the
// printed PDF — same two-step deviation as ProposalPreviewModal (the
// Interface Extensions SDK can't push a local File into an attachment
// field). There is no intermediate record to create here (unlike Proposals):
// the Recap Doc attaches straight onto the existing Appointment record, so
// the second step is the separate "Upload" button living on the Recap Doc
// field itself (see PostAppointmentModal), not a button in this modal.
interface RecapDocPreviewModalProps {
  snapshot: RecapDocSnapshot;
  onClose: () => void;
}
function RecapDocPreviewModal({ snapshot, onClose }: RecapDocPreviewModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  const originalTitleRef = useRef(document.title);
  useEffect(() => {
    const h = () => restorePrintDocumentTitle(originalTitleRef.current);
    window.addEventListener('afterprint', h);
    return () => window.removeEventListener('afterprint', h);
  }, []);
  // Closes this preview automatically once Generate is clicked (2026-08-05,
  // per Julia) — leaves just the print dialog and the client detail page
  // (PostAppointmentModal) underneath, instead of stacking the print dialog
  // on top of this modal on top of that page. Safe to close right away:
  // the actual print content is a SEPARATE portal mounted straight onto
  // document.body (see the comment on #recap-print-portal below), so it
  // isn't affected by this modal unmounting.
  const handlePrint = () => {
    setPrintDocumentTitle(`${toSnakeCase(snapshot.clientName)}_recap_doc`);
    window.print();
    requestClose();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [requestClose]);

  // The previous approach hid everything via `body * { visibility: hidden }`
  // and absolutely-positioned .recap-print-area over it — but any ancestor
  // between <body> and .recap-print-area that caps height/overflow (this
  // modal's max-h-[90vh] overflow-hidden/overflow-y-auto chrome) still
  // clipped it during print, and the modal's flex centering could still
  // offset it, which is what produced the blank space above the content and
  // the overflow silently spilling onto a near-empty "page 2". Portaling a
  // second, print-only copy of the document straight onto <body> sidesteps
  // every ancestor in one move: nothing sits between it and <body>, so
  // nothing can clip or reposition it.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backdropFilter: 'blur(4px)', opacity: isVisible ? 1 : 0 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      {createPortal(
        <div id="recap-print-portal">
          <style>{`
            /* @page MUST be a top-level rule, not nested inside @media print
               — confirmed live (2026-08-04) via the block's own devtools
               console: nesting it inside @media print produced ZERO
               registered CSSPageRule instances in the document's
               stylesheets, meaning Chrome never applied it at all. That's
               exactly why pagination silently fell back to "one page as
               tall as the content" regardless of how correctly the pages
               were split in the DOM (both .recap-doc-page divs measured
               exactly 1056px/11in, as expected — the DOM/JS side was never
               the problem). @page rules only ever take effect during
               print/pagination anyway, so there was never a reason to gate
               it behind @media print to begin with. */
            @page { margin: 0; size: letter; }
            /* THE REAL BUG (found 2026-08-04, per Julia's question — "is
               what prints actually what the preview shows, or something
               else?"): it was something else. This portal renders its OWN
               separate <RecapDocument> instance — a second, independent
               copy from the one visible in the modal body, with its own
               useRecapPageGroups measurement pass. That measurement runs on
               mount, as soon as the modal opens, NOT when Print is clicked.
               But this portal was display:none by default (only flipped to
               display:block inside @media print) — and display:none
               removes an element from layout ENTIRELY, so
               getBoundingClientRect() on anything inside it — including
               this portal's own internal measuring pass — always returns
               all-zero dimensions while display:none is in effect. Every
               entry's measured height came back as 0, so the packing loop
               ("remaining < h" never true for h=0) piled every single entry
               onto page 1 and produced exactly one page — regardless of
               what the OTHER, correctly-measured instance visibly showed in
               the on-screen preview the whole time. Fixed by keeping this
               portal genuinely laid out (position:fixed, off-screen) at all
               times instead of display:none, the same lesson already
               applied to the smaller measuring-only scratch div inside
               useRecapPageGroups — just missed here, on the portal itself. */
            #recap-print-portal { position: fixed; top: 0; left: -99999px; }
            @media print {
              body > *:not(#recap-print-portal) { display: none !important; }
              #recap-print-portal { position: static !important; left: auto !important; }
              /* Chrome/most browsers strip background colors on print by
                 default — without this, the page tint and every placeholder
                 swatch/photo box disappear, leaving what looks like a
                 near-empty page even when content is present. Keep the same
                 colors shown in the on-screen preview. */
              #recap-print-portal, #recap-print-portal * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              /* No page-break-after/break-inside/@page-cutting instruction
                 relied on anywhere — each .recap-doc-page-section is a
                 plain, normal-flow block-level sibling (no
                 position:absolute), fixed at exactly 11in tall, stacked
                 back-to-back with zero margin. @page{size:letter} above
                 cuts the resulting tall flow every 11in on its own — this
                 is the version that actually produced two real, correctly
                 split physical pages; a later "one sheet, absolutely
                 positioned sections inside it" experiment regressed
                 pagination back to rendering as a single page and was
                 reverted (see the note above RecapDocument's return). */
              .recap-doc-page-section {
                margin: 0 !important;
                width: 8.5in !important;
                height: 11in !important;
                box-sizing: border-box !important;
              }
            }
          `}</style>
          <RecapDocument snapshot={snapshot} />
        </div>,
        document.body
      )}
      <div className="bg-white dark:bg-[#25211A] rounded-2xl w-fit max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-white/10 transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'scale(1)' : 'scale(0.96)' }}
        onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 dark:border-white/5">
          <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6]">Generate Recap Doc</div>
          {/* One tier up from the old text-xs footnote (now text-sm), and
              moved up here under the title per Julia (2026-08-05) — reads
              as an instruction before the preview instead of a footnote
              after it. Reworded to match what's actually on-screen: the
              Recap Doc field's attach control is an icon-only "+" button,
              not a labeled "Upload" button. */}
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate the Recap Doc below, then attach it using the + button on the Recap Doc field.
          </div>
        </div>
        {/* No horizontal scroll: the modal sizes to the document's fixed
            8.5in (816px) width (w-fit on the container above) instead of
            being capped narrower and forcing overflow-x-auto here. */}
        <div className="flex-1 overflow-y-auto p-5">
          <RecapDocument snapshot={snapshot} />
        </div>
        {/* Close removed (2026-08-05, per Julia) — Generate is now the only
            action; clicking outside the modal or Escape still dismiss it. */}
        <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end items-center gap-3">
          <button type="button" onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-700 hover:dark:bg-gray-200 transition-colors">
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PostAppointmentModal ─────────────────────────────────────────────────────
interface PostApptModalProps {
  record: AirtableRecord;
  apptTable: Table;
  clientsTable: Table;
  clientRecords: AirtableRecord[] | null;
  stylesTable: Table | null;
  stylesRecords: AirtableRecord[] | null;
  customizationsTable: Table | null;
  customizationRecords: AirtableRecord[] | null;
  pricingTable: Table | null;
  pricingRecords: AirtableRecord[] | null;
  stylesBasePriceField: ReturnType<Table['getFieldIfExists']>;
  pricingPercentField: ReturnType<Table['getFieldIfExists']>;
  pricingMultipleField: ReturnType<Table['getFieldIfExists']>;
  selfUsageField: ReturnType<Table['getFieldIfExists']>;
  stylesSelfUsageField: ReturnType<Table['getFieldIfExists']>;
  rushFeeProposedField: ReturnType<Table['getFieldIfExists']>;
  rushFeePercentField: ReturnType<Table['getFieldIfExists']>;
  leadtimeWeeksField: ReturnType<Table['getFieldIfExists']>;
  favoriteStylesApptField: ReturnType<Table['getFieldIfExists']>;
  staffTable: Table | null;
  staffRecords: AirtableRecord[] | null;
  proposalsTable: Table | null;
  proposalRecords: AirtableRecord[] | null;
  recapLogoUrl: string;
  // Resolved (or fallback) attachments form URL — see
  // ATTACHMENT_FORM_URL_FALLBACK's comment for why this is threaded as a
  // prop (resolved once in RecapApp) instead of a module constant.
  attachmentFormUrl: string;
  base: ReturnType<typeof useBase>;
  onClose: () => void;
}

function PostAppointmentModal({
  record, apptTable, clientsTable, clientRecords,
  stylesTable, stylesRecords, customizationsTable, customizationRecords,
  pricingTable, pricingRecords,
  stylesBasePriceField, pricingPercentField, pricingMultipleField, selfUsageField, stylesSelfUsageField,
  rushFeeProposedField, rushFeePercentField, leadtimeWeeksField, favoriteStylesApptField,
  staffTable, staffRecords, proposalsTable, proposalRecords, recapLogoUrl, attachmentFormUrl,
  base, onClose
}: PostApptModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  const [openCustomizationAdd, setOpenCustomizationAdd] = useState(false);
  // Lives here, not inside CustomizationModal, so dismissing the "add" modal
  // doesn't lose whatever the user already typed — only a successful submit
  // resets it (see CustomizationModal's handleSave/handleHybridSave).
  const [customizationAddDraft, setCustomizationAddDraft] = useState<CustomizationAddDraft>(emptyCustomizationAddDraft());
  const [editCustomizationId, setEditCustomizationId]   = useState<string|null>(null);

  const fClientLink = apptTable.getFieldIfExists(APPT.CLIENT_LINK);
  const fTypeField  = apptTable.getFieldIfExists(APPT.TYPE);
  const typeLabel   = fTypeField ? record.getCellValueAsString(fTypeField) : '';
  const shortType   = shortTypeLabel(typeLabel);
  const clientName  = fClientLink ? record.getCellValueAsString(fClientLink) : 'Unknown Client';
  const linked      = fClientLink ? (record.getCellValue(fClientLink) as Array<{id:string}>|null) : null;
  const clientId    = linked?.[0]?.id ?? null;
  const clientRec   = clientId ? (clientRecords?.find(c=>c.id===clientId)??null) : null;

  const cStr  = useCallback((fid:string)=>clientRec ? getStr(clientRec,fid) : '',[clientRec]);
  const cNum  = useCallback((fid:string)=>clientRec ? getVal<number>(clientRec,fid) : null,[clientRec]);
  const cBool = useCallback((fid:string)=>clientRec ? !!(getVal<boolean>(clientRec,fid)??false) : false,[clientRec]);

  // The client's designated first-consultation appointment (2026-08-05, per
  // Julia) — resolved via two LOOKUP fields, not the plain-field helpers
  // above. getVal() on a lookup returns the raw array Airtable always uses
  // for multipleLookupValues (even when conceptually single-valued), so
  // this unwraps with firstLookupValue() instead of reading it directly —
  // reading it with cStr/getVal would silently return an array-shaped
  // value or stringify it wrong. Used to prefill the Recap Doc upload
  // form's appointment link (see openRecapDocUploadForm below) instead of
  // this modal's own `record`, since the eligibility rule ("first
  // non-cancelled consultation") is enforced by how this link field gets
  // populated, not by whichever appointment happens to be open here.
  const consultationApptTimeRaw = clientRec
    ? firstLookupValue<string>(getVal<unknown>(clientRec, CLIENT.CONSULTATION_APPT_TIME))
    : null;
  // Prefill target for the Recap Doc upload form's appointment link — see
  // openRecapDocUploadForm below. Back to using the record ID (2026-08-05):
  // an earlier round blamed record-ID prefill itself for the Attachments
  // record's `appointment` field coming back empty and switched to
  // matching by primary-field display text instead — but the actual cause
  // was simpler: the "appointment" field had never been added to the form
  // at all, so nothing could have prefilled it regardless of which value
  // was sent. With the field added AND this lookup recreated (Julia had
  // deleted the original), record-ID prefill is the more precise match —
  // no ambiguity if two appointments ever share the same displayed time.
  const consultationApptRecordId = clientRec
    ? firstLookupValue<string>(getVal<unknown>(clientRec, CLIENT.CONSULTATION_APPT_RECORD_ID))
    : null;

  // Wedding date
  const existingWeddingIso = clientRec ? (getVal<string>(clientRec, CLIENT.WEDDING)??'') : '';
  const [weddingDisplay, setWeddingDisplay] = useState(existingWeddingIso ? fmtFriendly(existingWeddingIso) : '');
  const [weddingIso, setWeddingIso]         = useState(existingWeddingIso);
  // Read-only fallback (2026-08-21): CLIENT.WEDDING is unconditionally in
  // FIELD_SOURCE (see below), so isFieldReadOnlyBySource(CLIENT.WEDDING) is
  // always true and the editable input a few hundred lines down is never
  // actually reached in production — this field is display-only here. The
  // plain `weddingDisplay` above only reflects Wedding Date (Formatted), so
  // a client with just a manual placeholder in Wedding Date (If Not Set)
  // showed blank. This resolves the same Formatted/If-Not-Set fallback
  // wedding_date_display already computes, for the read-only view and the
  // printed Recap Doc only — it never overwrites weddingDisplay itself.
  const weddingDisplayFallback = useMemo(() => {
    const raw = clientRec ? getStr(clientRec, CLIENT.WEDDING_DISPLAY) : '';
    return raw ? fmtFriendly(raw) : '';
  }, [clientRec]);
  const [weddingConfirmed, setWeddingConfirmed] = useState(cBool(CLIENT.WEDDING_CONFIRMED));
  const [showCalendar, setShowCalendar]     = useState(false);

  // measurement_notes is richText — read via fromRichText
  const [measNotes,  setMeasNotes]  = useState(fromRichText(getVal<unknown>(clientRec!, CLIENT.MEAS_NOTES)));
  // Size from Acuity Intake — editable per request (2026-08-07); not added to
  // FIELD_SOURCE, unlike other Acuity-sourced fields, since this one is meant
  // to be correctable here rather than mirrored strictly from Acuity.
  const [sizeAcuityIntake, setSizeAcuityIntake] = useState(cStr(CLIENT.SIZE_ACUITY_INTAKE));
  const [rtwSize,    setRtwSize]    = useState(cNum(CLIENT.RTW_SIZE)?.toString()??'');

  // Prefer the custom-property-bound field (see getCustomProperties) so the
  // style-filter feature and this editor always read the exact same field;
  // falls back to the hardcoded ID if the property somehow doesn't resolve.
  const existingFavStyles = clientRec
    ? ((favoriteStylesApptField
        ? (clientRec.getCellValue(favoriteStylesApptField) as Array<{id:string;name:string}>|null)
        : getVal<Array<{id:string;name:string}>>(clientRec, CLIENT.FAV_STYLES_APPT)) ?? [])
    : [];
  const [favStyles, setFavStyles] = useState<string[]>(existingFavStyles.map(s=>s.name));
  const [notes,     setNotes]     = useState(cStr(CLIENT.APPT_NOTES));

  const existingMeasPhotos = clientRec ? getVal<Array<{id:string;url:string;filename:string;thumbnails?:{small?:{url:string}}}>>(clientRec, CLIENT.MEAS_PHOTO) : null;
  const existingApptPhotos = clientRec ? getVal<Array<{id:string;url:string;filename:string;thumbnails?:{small?:{url:string}}}>>(clientRec, CLIENT.APPT_PHOTO) : null;

  // Customizations — computed reactively from live records, not clientRec linked field
  const linkedCustomizations = useMemo(() => {
    if (!customizationRecords || !clientId || !customizationsTable) return [];
    const clientField = customizationsTable.getFieldIfExists(CUSTOM.CLIENT);
    const styleField  = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE);
    if (!clientField || !styleField) return [];
    return customizationRecords
      .filter(r => {
        const lnk = r.getCellValue(clientField) as Array<{id:string}>|null;
        return lnk?.some(l=>l.id===clientId) ?? false;
      })
      .map(r => ({ id: r.id, name: r.getCellValueAsString(styleField) || 'Customization' }));
  }, [customizationRecords, customizationsTable, clientId]);

  const clientWeddingIso = weddingIso || null;

  // Line-item view of this client's Customization Requests — same grand-total
  // math as CustomizationModal's own Order Summary, so the Total Price column
  // here always agrees with what that modal shows for the same record.
  interface CustomizationRow {
    id: string;
    styleName: string;
    dateRequested: string;
    isHybrid: boolean;
    proposals: AirtableRecord[];
    grandTotal: number;
    // Recap Doc fields — internal_approval_status gate + per-style
    // photo/price/description (Styles.Notes), plus the CR's own free-text
    // notes. style2* only populated for Hybrid rows.
    internalApprovalStatus: string;
    crNotes: string;
    style1Name: string;
    style1PhotoUrl: string | null;
    style1Price: number;
    style1Description: string;
    style2Name: string | null;
    style2PhotoUrl: string | null;
    style2Price: number | null;
    style2Description: string | null;
  }
  const customizationRows = useMemo<CustomizationRow[]>(() => {
    if (!customizationsTable) return [];
    const fStyled     = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE);
    const fAdditionalStyled = customizationsTable.getFieldIfExists(CUSTOM.ADDITIONAL_CUSTOMIZED_STYLE);
    const fPricing    = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZATION_PRICING);
    const fDateReq    = customizationsTable.getFieldIfExists(CUSTOM.DATE_OF_REQUEST);
    const fIsHybrid   = customizationsTable.getFieldIfExists(CUSTOM.IS_HYBRID);
    const fHybridStyleNames = customizationsTable.getFieldIfExists(CUSTOM.HYBRID_STYLE_NAMES);
    const fEmbroideryField = customizationsTable.getFieldIfExists(CUSTOM.EMBROIDERY_AMOUNT);
    const fAdditionalSelfUsage = customizationsTable.getFieldIfExists(CUSTOM.ADDITIONAL_SELF_USAGE);
    const fSourceP    = proposalsTable?.getFieldIfExists(PROPOSAL.SOURCE_CUSTOMIZATION) ?? null;
    const pPriceField = pricingTable?.getFieldIfExists(PRICING.PRICE) ?? null;
    const fApprovalStatus = customizationsTable.getFieldIfExists(CUSTOM.INTERNAL_APPROVAL_STATUS);
    const fCrNotes    = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZATION_DETAIL);
    const fStyle1Photo = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE_PHOTO);
    const fStyle1PriceLookup = customizationsTable.getFieldIfExists(CUSTOM.CUSTOMIZED_STYLE_PRICE);
    const fStyle2Photo = customizationsTable.getFieldIfExists(CUSTOM.ADDITIONAL_CUSTOMIZED_STYLE_PHOTO);
    const fStyle2PriceLookup = customizationsTable.getFieldIfExists(CUSTOM.ADDITIONAL_CUSTOMIZED_STYLE_PRICE);
    // TEMPORARY placeholder source for style description — see the comment
    // above STYLES_DESCRIPTION_PLACEHOLDER_FIELD_ID. Reads straight off the
    // already-resolved Styles record (styleRec/styleRec1/styleRec2 below)
    // instead of the CUSTOMIZED_STYLE_NOTES/ADDITIONAL_CUSTOMIZED_STYLE_NOTES
    // lookup fields, which still point at the pre-Cobalt Styles.Notes field.
    const fStylesDescription = stylesTable?.getFieldIfExists(STYLES_DESCRIPTION_PLACEHOLDER_FIELD_ID) ?? null;

    // A style link's own Base Price, resolved via stylesRecords — same
    // lookup Regular's own basePriceNumber below uses, just reusable for
    // Hybrid's two direct style links (customized_style +
    // additional_customized_style, 2026-07-26 rework — no more child records).
    const styleBasePrice = (styleLinkField: ReturnType<Table['getFieldIfExists']>, rec: AirtableRecord): number => {
      const styleId = styleLinkField ? ((rec.getCellValue(styleLinkField) as Array<{ id: string }> | null)?.[0]?.id ?? null) : null;
      const styleRec = styleId ? (stylesRecords?.find(r => r.id === styleId) ?? null) : null;
      return styleRec && stylesBasePriceField ? parseCurrencyString(styleRec.getCellValueAsString(stylesBasePriceField)) : 0;
    };

    return linkedCustomizations
      .map((c): CustomizationRow | null => {
        const rec = customizationRecords?.find(r=>r.id===c.id);
        if (!rec) return null;

        const isHybrid = fIsHybrid ? rec.getCellValueAsString(fIsHybrid) === 'Hybrid' : false;
        const styleId  = fStyled ? ((rec.getCellValue(fStyled) as Array<{id:string}>|null)?.[0]?.id ?? null) : null;
        const styleRec = styleId ? (stylesRecords?.find(r=>r.id===styleId) ?? null) : null;
        const styleName = isHybrid
          ? (fHybridStyleNames ? (rec.getCellValueAsString(fHybridStyleNames) || 'Hybrid') : 'Hybrid')
          : (styleRec?.name ?? c.name);

        // Raw getCellValue (ISO) instead of getCellValueAsString — the latter
        // renders using the field's configured display format (locale-
        // dependent), which produced inconsistent-looking dates here for the
        // same reason Appointment Time did elsewhere in this file.
        const dateRequested = fDateReq ? ((rec.getCellValue(fDateReq) as string | null) ?? '') : '';

        const proposals = (fSourceP && proposalRecords)
          ? proposalRecords.filter(p => {
              const link = p.getCellValue(fSourceP) as Array<{id:string}>|null;
              return link?.some(l=>l.id===rec.id) ?? false;
            })
          : [];

        if (isHybrid) {
          // Style A/B live directly on this record now (2026-07-26 rework,
          // no more child records) — priced against whichever is higher,
          // same rule CustomizationModal's own Order Summary uses.
          const base1 = styleBasePrice(fStyled, rec);
          const base2 = styleBasePrice(fAdditionalStyled, rec);
          const higherBasePrice = Math.max(base1, base2);
          // Self Usage read straight off THIS record's own lookups (self_usage
          // for Style A, additional_self_usage for Style B) — every row here
          // is an already-saved record, so there's no "add mode" fallback
          // needed (matching CustomizationModal's own edit-mode preference).
          const selfUsageA = selfUsageField ? parseCurrencyString(rec.getCellValueAsString(selfUsageField)) : 0;
          const selfUsageB = fAdditionalSelfUsage ? parseCurrencyString(rec.getCellValueAsString(fAdditionalSelfUsage)) : 0;
          const effectiveSelfUsage = base1 >= base2 ? selfUsageA : selfUsageB;
          const embroideryStr = fEmbroideryField ? (rec.getCellValueAsString(fEmbroideryField) || '') : '';
          const multiplierFactor = computeMultiplierFactor(effectiveSelfUsage, embroideryStr || null);
          const pricingIds = fPricing ? ((rec.getCellValue(fPricing) as Array<{id:string}>|null)?.map(x=>x.id) ?? []) : [];
          const customizationTotal = pricingIds.reduce((sum, id) => {
            const r = pricingRecords?.find(pr => pr.id === id);
            if (!r) return sum;
            return sum + resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, higherBasePrice, multiplierFactor).amount;
          }, 0);
          const grandTotal = computeHybridCombinedTotal(base1, base2) + customizationTotal;
          const styleRec1 = fStyled ? (stylesRecords?.find(r => r.id === ((rec.getCellValue(fStyled) as Array<{id:string}>|null)?.[0]?.id)) ?? null) : null;
          const styleRec2 = fAdditionalStyled ? (stylesRecords?.find(r => r.id === ((rec.getCellValue(fAdditionalStyled) as Array<{id:string}>|null)?.[0]?.id)) ?? null) : null;
          return {
            id: c.id, styleName, dateRequested, isHybrid, proposals, grandTotal,
            internalApprovalStatus: fApprovalStatus ? (rec.getCellValueAsString(fApprovalStatus) || '') : '',
            crNotes: fCrNotes ? (rec.getCellValueAsString(fCrNotes) || '') : '',
            style1Name: styleRec1?.name ?? '',
            style1PhotoUrl: firstLookupValue<{url:string;thumbnails?:{large?:{url:string}}}>(fStyle1Photo ? rec.getCellValue(fStyle1Photo) : null)?.url ?? null,
            style1Price: firstLookupValue<number>(fStyle1PriceLookup ? rec.getCellValue(fStyle1PriceLookup) : null) ?? base1,
            style1Description: (styleRec1 && fStylesDescription) ? (styleRec1.getCellValueAsString(fStylesDescription) || '') : '',
            style2Name: styleRec2?.name ?? '',
            style2PhotoUrl: firstLookupValue<{url:string;thumbnails?:{large?:{url:string}}}>(fStyle2Photo ? rec.getCellValue(fStyle2Photo) : null)?.url ?? null,
            style2Price: firstLookupValue<number>(fStyle2PriceLookup ? rec.getCellValue(fStyle2PriceLookup) : null) ?? base2,
            style2Description: (styleRec2 && fStylesDescription) ? (styleRec2.getCellValueAsString(fStylesDescription) || '') : '',
          };
        }

        const basePriceNumber = (styleRec && stylesBasePriceField)
          ? parseCurrencyString(styleRec.getCellValueAsString(stylesBasePriceField))
          : 0;
        const embroideryStr = customizationsTable.getFieldIfExists(CUSTOM.EMBROIDERY_AMOUNT)
          ? (rec.getCellValueAsString(customizationsTable.getFieldIfExists(CUSTOM.EMBROIDERY_AMOUNT)!) || '')
          : '';
        const selfUsageValue = selfUsageField ? parseCurrencyString(rec.getCellValueAsString(selfUsageField)) : 0;
        const multiplierFactor = computeMultiplierFactor(selfUsageValue, embroideryStr || null);
        const pricingIds = fPricing ? ((rec.getCellValue(fPricing) as Array<{id:string}>|null)?.map(x=>x.id) ?? []) : [];
        const customizationTotal = pricingIds.reduce((sum, id) => {
          const r = pricingRecords?.find(pr => pr.id === id);
          if (!r) return sum;
          return sum + resolvePricingRowAmount(r, pPriceField, pricingPercentField, pricingMultipleField, basePriceNumber, multiplierFactor).amount;
        }, 0);
        const grandTotal = basePriceNumber + customizationTotal;

        return {
          id: c.id, styleName, dateRequested, isHybrid, proposals, grandTotal,
          internalApprovalStatus: fApprovalStatus ? (rec.getCellValueAsString(fApprovalStatus) || '') : '',
          crNotes: fCrNotes ? (rec.getCellValueAsString(fCrNotes) || '') : '',
          style1Name: styleName,
          style1PhotoUrl: firstLookupValue<{url:string;thumbnails?:{large?:{url:string}}}>(fStyle1Photo ? rec.getCellValue(fStyle1Photo) : null)?.url ?? null,
          style1Price: firstLookupValue<number>(fStyle1PriceLookup ? rec.getCellValue(fStyle1PriceLookup) : null) ?? basePriceNumber,
          style1Description: (styleRec && fStylesDescription) ? (styleRec.getCellValueAsString(fStylesDescription) || '') : '',
          style2Name: null,
          style2PhotoUrl: null,
          style2Price: null,
          style2Description: null,
        };
      })
      .filter((r): r is CustomizationRow => r !== null)
      .sort((a, b) => {
        if (!a.dateRequested) return 1;
        if (!b.dateRequested) return -1;
        return new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime(); // most recent first
      });
  }, [linkedCustomizations, customizationRecords, customizationsTable, stylesRecords, pricingRecords, pricingTable,
      stylesBasePriceField, stylesSelfUsageField, pricingPercentField, pricingMultipleField, selfUsageField,
      proposalsTable, proposalRecords]);

  // Sales associate has no linked Staff record anywhere else in this file — it's
  // a plain name field on both Appointments and Clients. Resolved against the
  // Staff table here (by name match) only so it can be linked on the Proposal;
  // passed down to CustomizationModal, which owns the actual Generate Proposal
  // action (see its title-bar button).
  const fApptSaName = apptTable.getFieldIfExists(APPT.SA_NAME);
  const saName = cStr(CLIENT.SA_NAME) || (fApptSaName ? record.getCellValueAsString(fApptSaName) : '');
  const saRecord = useMemo(
    () => (saName && staffRecords) ? (staffRecords.find(r=>r.name===saName) ?? null) : null,
    [saName, staffRecords]
  );

  // ─── Recap Doc ──────────────────────────────────────────────────────────
  // Eligibility reuses the exact same isConsultation() substring check the
  // main day-list/search filters already use to decide which appointments
  // are Recap-eligible in the first place (see filterAndSort in
  // RecapApp) — not reimplemented from the schema. Per the AC: no
  // Recap Doc for second/follow-up appointments, and if the data needed to
  // tell first-consultation apart from follow-up is missing (empty type),
  // don't offer generation — flag for manual review instead of guessing.
  const needsRecapEligibilityReview = !typeLabel.trim();
  const isConsultationAppt          = !needsRecapEligibilityReview && isConsultation(typeLabel);

  const fRecapDoc          = apptTable.getFieldIfExists(APPT.RECAP_DOC);
  const existingRecapDoc   = fRecapDoc ? ((record.getCellValue(fRecapDoc) as ProposalFile[]|null) ?? []) : [];
  const hasRecapDoc        = existingRecapDoc.length > 0;
  // "Generate Recap Doc" (title bar) is now ALWAYS visible (2026-08-05, per
  // Julia) — previously it just disappeared entirely whenever any
  // condition below failed, giving no clue why. Now it always renders;
  // recapDocDisabledReason (null when eligible) drives whether it's the
  // normal amber button or a grayed-out one with a hover tooltip
  // explaining the specific blocker, in priority order: already has a doc
  // (also the UI-level duplicate-upload guard — attachment_router.js has
  // its own defensive backstop for the same rule) > appointment type
  // missing (can't tell first-consultation from follow-up) > not a
  // first-consultation appointment > nothing to put in the document (no
  // Favorite Styles, no Customization Requests logged for this client).
  const hasAnyRecapDocContent = favStyles.length > 0 || customizationRows.length > 0;
  const recapDocDisabledReason: string | null = hasRecapDoc
    ? 'A Recap Doc has already been generated for this appointment.'
    : needsRecapEligibilityReview
    ? 'Appointment type is missing — can\'t confirm this is a first consultation.'
    : !isConsultationAppt
    ? 'Only available for first-consultation appointments.'
    : !hasAnyRecapDocContent
    ? 'No Favorite Styles or Customization Requests to include yet.'
    : null;

  const [showRecapDocPreview, setShowRecapDocPreview] = useState(false);
  // Click-triggered blocked-reason tooltips for the Generate button and the
  // Recap Doc field's own "+" upload button — see useClickTooltip's
  // comment. Independent instances since both buttons can be visible and
  // independently clicked at the same time.
  const generateBlockedTip = useClickTooltip();
  const uploadBlockedTip   = useClickTooltip();

  const fApptTime = apptTable.getFieldIfExists(APPT.TIME);
  // Raw getCellValue (ISO) instead of getCellValueAsString — the latter
  // renders using the field's own configured display format (e.g.
  // "3/4/2026 11:55pm"), which `new Date(...)` can't reliably re-parse, so
  // fmtRecapAppointmentDisplay was silently falling back to that raw string
  // instead of producing "July 4th, 2026 11:55pm". Same fix already applied
  // to Date of Request elsewhere in this file for the same reason.
  const appointmentDisplay = fApptTime ? fmtRecapAppointmentDisplay(record.getCellValue(fApptTime) as string | null) : '';

  const recapDocSnapshot = useMemo<RecapDocSnapshot>(() => {
    // Not filtering by internal_approval_status for now — per Julia (2026-08-03),
    // unclear whether only-Approved is actually required, and separately the
    // config-doctor audit found internal_approval_status (and all six new
    // customized_style_*/additional_customized_style_* lookups) aren't
    // exposed to this page's block yet (Data > customization_requests >
    // Fields), so the field always reads empty here regardless — that's why
    // no CR ever showed up before. Showing every CR unblocks this
    // immediately; reinstate a `row.internalApprovalStatus === 'Approved'`
    // filter here once that's confirmed AND the fields are exposed.
    const approvedRows = customizationRows;

    const hybridEntries: RecapDocHybridEntry[] = approvedRows
      .filter(row => row.isHybrid)
      .map(row => ({
        kind: 'hybrid',
        id: row.id,
        style1: { name: row.style1Name, price: row.style1Price, photoUrl: row.style1PhotoUrl, description: row.style1Description },
        style2: { name: row.style2Name ?? '', price: row.style2Price ?? 0, photoUrl: row.style2PhotoUrl, description: row.style2Description ?? '' },
        crNotes: row.crNotes,
        // No customPricing here — removed 2026-08-05 per Julia. row.grandTotal
        // (base price ± multiplier) is still computed above for the separate
        // Customization Proposal document; the Recap Doc just never reads it.
      }));

    const regularEntries: RecapDocRegularEntry[] = approvedRows
      .filter(row => !row.isHybrid)
      .map(row => ({
        kind: 'regular',
        id: row.id,
        name: row.style1Name || row.styleName,
        price: row.style1Price,
        photoUrl: row.style1PhotoUrl,
        description: row.style1Description,
        crNotes: row.crNotes,
        // No customPricing here — see the note in hybridEntries above.
      }));

    // A favorite style already represented by an approved Regular CR (by
    // name) or as one of an approved Hybrid CR's two styles doesn't get a
    // second, plainer chip — the fuller CR entry replaces it.
    const namesCoveredByApprovedCR = new Set<string>([
      ...regularEntries.map(e => e.name),
      ...hybridEntries.flatMap(e => [e.style1.name, e.style2.name]),
    ]);
    const fStylePhoto = stylesTable?.getFieldIfExists(STYLES_PHOTO_FIELD_ID) ?? null;
    const favoriteEntries: RecapDocFavoriteEntry[] = favStyles
      .filter(name => !namesCoveredByApprovedCR.has(name))
      .map(name => {
        const styleRec = stylesRecords?.find(r => r.name === name) ?? null;
        const basePrice = (styleRec && stylesBasePriceField)
          ? parseCurrencyString(styleRec.getCellValueAsString(stylesBasePriceField))
          : 0;
        const photoAttachments = (styleRec && fStylePhoto)
          ? (styleRec.getCellValue(fStylePhoto) as Array<{url:string; thumbnails?:{large?:{url:string}}}>|null)
          : null;
        return {
          kind: 'favorite',
          id: styleRec?.id ?? name,
          name,
          price: basePrice,
          photoUrl: photoAttachments?.[0] ? (photoAttachments[0].thumbnails?.large?.url ?? photoAttachments[0].url) : null,
        };
      });

    return {
      clientName: clientName || 'Unknown Client',
      email: cStr(CLIENT.EMAIL),
      phone: cStr(CLIENT.PHONE),
      weddingDateDisplay: weddingDisplayFallback || weddingDisplay,
      appointmentDisplay,
      clientSpecialist: saName,
      entries: [...hybridEntries, ...regularEntries, ...favoriteEntries],
      photos: existingApptPhotos ?? [],
      logoUrl: recapLogoUrl,
    };
  }, [clientName, cStr, weddingDisplay, weddingDisplayFallback, appointmentDisplay, saName, favStyles, stylesRecords, stylesBasePriceField, stylesTable, customizationRows, existingApptPhotos, recapLogoUrl]);

  const openRecapDocUploadForm = () => {
    if (!clientId) return;
    // Prefer the client's designated first-consultation appointment
    // (consultationApptRecordId) over this modal's own `record` — see the
    // comment above consultationApptRecordId's definition. Falls back to
    // `record.id` only if that lookup isn't populated yet (e.g.
    // "Appointment Records" hasn't been linked for this client), so upload
    // isn't blocked entirely while that's being set up.
    const targetAppointmentId = consultationApptRecordId || record.id;
    window.open(buildRecapDocAttachmentFormUrl(attachmentFormUrl, clientId, targetAppointmentId), '_blank', 'noopener,noreferrer');
  };

  // Save helper
  const saveClientField = useCallback((fieldId:string, value:unknown) => {
    if (!clientId) return;
    const t = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
    if (!t?.hasPermissionToUpdateRecords()) return;
    queueWrite(()=>t!.updateRecordAsync(clientId, { [fieldId]: value }))
      .catch(err=>console.error('Client save failed:', err));
  }, [clientId, base]);

  // Handlers
  const handleWeddingBlur = () => {
    if (!weddingDisplay.trim()) { setWeddingIso(''); saveClientField(CLIENT.WEDDING, null); return; }
    const d = parseFlexDate(weddingDisplay);
    if (d) {
      const iso = fmtDateKey(d);
      setWeddingIso(iso);
      setWeddingDisplay(fmtFriendly(iso));
      saveClientField(CLIENT.WEDDING, iso);
    }
  };
  const handleWeddingCalPick = (d:Date) => {
    const iso = fmtDateKey(d);
    setWeddingIso(iso);
    setWeddingDisplay(fmtFriendly(iso));
    saveClientField(CLIENT.WEDDING, iso);
    setShowCalendar(false);
  };
  const handleConfirmed    = (v:boolean) => { setWeddingConfirmed(v); saveClientField(CLIENT.WEDDING_CONFIRMED, v); };
  const handleNotesBlur    = () => saveClientField(CLIENT.APPT_NOTES, notes);
  // measurement_notes is richText — write as {markdown: value}
  const handleMeasNotesBlur = () => saveClientField(CLIENT.MEAS_NOTES, measNotes ? toRichText(measNotes) : null);
  const handleSizeBlur     = () => saveClientField(CLIENT.SIZE_ACUITY_INTAKE, sizeAcuityIntake||null);
  const handleRtwBlur      = () => saveClientField(CLIENT.RTW_SIZE, rtwSize?parseFloat(rtwSize)||null:null);
  const handleStyleToggle  = (s:string) => {
    const updated = favStyles.includes(s)?favStyles.filter(x=>x!==s):[...favStyles,s];
    setFavStyles(updated);
    if (stylesRecords && clientId) {
      const ids = updated.map(name=>stylesRecords.find(r=>r.name===name)?.id).filter((id):id is string=>!!id).map(id=>({id}));
      const t = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
      // Write to the SAME field the read path resolved (favoriteStylesApptField
      // custom property), not the hardcoded CLIENT.FAV_STYLES_APPT constant —
      // if that field isn't exposed to this page's block config, the custom
      // property's fuzzy-name fallback can resolve to a DIFFERENT field
      // (e.g. favorite_styles_from_acuity also matches "favoritestyle").
      // Writing to the hardcoded field while reading from the fallback field
      // is exactly why selections looked like they weren't saving — the
      // write landed on a field nothing else ever reads back from.
      const fFav = favoriteStylesApptField ?? t?.getFieldIfExists(CLIENT.FAV_STYLES_APPT) ?? null;
      if (t && fFav) queueWrite(()=>t.updateRecordAsync(clientId, { [fFav.id]: ids.length>0?ids:null })).catch(console.error);
    }
  };
  // "- customized" styles are per-request variants generated off a base
  // style, and Alterations-category rows aren't gown/dress favorites either
  // — both excluded from the Favorite Styles from Appointment selector.
  const availableStyleNames = useMemo(() => {
    const fCategory = stylesTable?.getFieldIfExists(STYLES_CATEGORY_FIELD_ID) ?? null;
    return (stylesRecords??[])
      .filter(r => !fCategory || r.getCellValueAsString(fCategory) !== 'ALTERATIONS')
      .map(r=>r.name)
      .filter(Boolean)
      .filter(n=>!n.toLowerCase().includes('- customized'))
      .sort();
  }, [stylesRecords, stylesTable]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') requestClose(); };
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[requestClose]);

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1B1813] text-gray-900 dark:text-[#F3EFE6] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]';
  // BRANDING.md §2: section/field labels are 14px (text-sm), not 12px (text-xs).
  const labelCls = 'text-sm text-gray-400 dark:text-gray-500 capitalize tracking-wide font-medium mb-1.5 block';

  const clientStage        = cStr(CLIENT.STAGE);
  const showPreApptFields  = clientStage === 'Pre-Appointment';
  const showDelibFields    = clientStage === 'Deliberating';
  const showSidebarFields  = showPreApptFields || showDelibFields;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
        style={{ backgroundColor:'rgba(0,0,0,0.18)', backdropFilter:'blur(1px)', opacity: isVisible?1:0 }}
        onClick={e=>{ if(e.target===e.currentTarget) requestClose(); }}>
        {/* +20% over the previous 680px */}
        <div className="bg-white dark:bg-[#25211A] rounded-2xl w-full max-w-[816px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transition-[opacity,transform] duration-200 ease-out"
          style={{ opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
          onClick={e=>e.stopPropagation()}>

          {/* Header */}
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-start gap-6 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="min-w-0">
                  <div className="font-bold text-xl text-gray-900 dark:text-[#F3EFE6] truncate">{clientName || 'Unknown Client'}</div>
                  <div className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{shortType}</div>
                </div>
              </div>
              {/* Rendered whenever no Recap Doc exists yet (2026-08-05, per
                  Julia) — grayed out, explaining the specific blocker for
                  every OTHER reason (type missing, not a consultation, no
                  content yet) via a tooltip that only appears on CLICK, not
                  hover (useClickTooltip) — no `disabled` attribute, since a
                  truly disabled button doesn't fire onClick at all. Once a
                  Recap Doc has actually been generated and uploaded, this
                  button disappears entirely — the inline thumbnail(s) next
                  to the Recap Doc field below are the only affordance at
                  that point, there's nothing left to generate. */}
              {!hasRecapDoc && (
                <div className="relative ml-auto flex-shrink-0">
                  <button type="button"
                    onClick={()=>{ if (recapDocDisabledReason) generateBlockedTip.trigger(); else setShowRecapDocPreview(true); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      recapDocDisabledReason
                        ? 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'text-white dark:text-[#1B1813] bg-[#D97706] dark:bg-[#FBBF24] hover:bg-[#C2670A] dark:hover:bg-[#E2AC1F]'
                    }`}>
                    <FileTextIcon size={14}/>Generate Recap Doc
                  </button>
                  {generateBlockedTip.visible && recapDocDisabledReason && (
                    <div className="absolute right-0 top-full mt-2 z-10 w-64 px-3 py-2 rounded-lg bg-gray-900 dark:bg-black text-white text-xs shadow-lg">
                      {recapDocDisabledReason}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Sync source color coding — first row, above Styles */}
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                Acuity
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                Shopify
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                Apparel Magic
              </span>
            </div>

            {/* Favorite Styles */}
            <div>
              <span className={labelCls}>Favorite Styles from Appointment</span>
              <StylesDropdown selected={favStyles} available={availableStyleNames} onToggle={handleStyleToggle}/>
            </div>

            {/* Wedding Date / Date Confirmation / RTW Size / Size (Acuity Intake) — one row, 1/4 each */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <FieldLabel label="Wedding Date" fieldId={CLIENT.WEDDING} />
                {isFieldReadOnlyBySource(CLIENT.WEDDING) ? (
                  <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5">{weddingDisplayFallback || weddingDisplay || '—'}</div>
                ) : (
                  <div className="relative">
                    <input type="text" value={weddingDisplay} onChange={e=>setWeddingDisplay(e.target.value)}
                      onBlur={handleWeddingBlur} placeholder="e.g. May 26, 2027"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-9 text-sm outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24]"/>
                    <button type="button" onClick={()=>setShowCalendar(o=>!o)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-400">
                      <CalendarIcon size={15}/>
                    </button>
                    {showCalendar && <MiniCalendar selected={weddingIso?new Date(weddingIso+'T00:00:00'):new Date()} onSelect={handleWeddingCalPick} onClose={()=>setShowCalendar(false)}/>}
                  </div>
                )}
              </div>
              <div>
                <span className={labelCls}>Date Confirmation</span>
                <button type="button" onClick={()=>handleConfirmed(!weddingConfirmed)}
                  className={`w-full px-3 py-2 text-sm font-semibold rounded-lg border transition-colors ${weddingConfirmed
                    ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] border-[#FDE68A] dark:border-[#4A3B18]'
                    : 'bg-white dark:bg-[#1B1813] text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
                  {weddingConfirmed ? 'Confirmed' : 'Pending'}
                </button>
              </div>
              <EditableNumber
                label="Ready-to-Wear Size"
                value={rtwSize}
                onChange={setRtwSize}
                onBlur={handleRtwBlur}
                placeholder="e.g. 8"
              />
              <EditableText
                label="Size (Acuity Intake)"
                fieldId={CLIENT.SIZE_ACUITY_INTAKE}
                value={sizeAcuityIntake}
                onChange={setSizeAcuityIntake}
                onBlur={handleSizeBlur}
                placeholder="e.g. 6"
              />
            </div>

            {/* Sales Associate / Appointment Time — added 2026-08-07 (were
                computed already, for the printed Recap Doc/proposal snapshot,
                but never actually shown on this live page). Both read-only:
                Sales Associate is a lookup (Clients.SA_NAME, itself a lookup
                through the linked Appointment record, falling back to this
                appointment's own APPT.SA_NAME lookup — see saName above);
                Appointment Time is this appointment record's own dateTime
                field, formatted in the studio's fixed America/New_York
                timezone via fmtRecapAppointmentDisplay (fixed the same day —
                it previously used the viewer's local timezone instead). */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className={labelCls}>Sales Associate</span>
                <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5">{saName || '—'}</div>
              </div>
              <div>
                <span className={labelCls}>Appointment Time</span>
                <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5">{appointmentDisplay || '—'}</div>
              </div>
            </div>

            {/* Consultation Appointment — read-only, from the two lookups
                Julia added (2026-08-05) through Clients' "Appointment
                Records" link. Shown here so it's easy to confirm which
                appointment the Recap Doc upload below will actually attach
                to before clicking it. */}
            <div>
              <span className={labelCls}>Consultation Appointment</span>
              <div className="text-sm text-gray-700 dark:text-gray-300 py-1.5">{fmtRecapAppointmentDisplay(consultationApptTimeRaw)}</div>
            </div>

            {/* Measurement Photo / Appointment Photo / Recap Doc — one row, no section header, 1/3 each */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className={labelCls}>Measurement Photo</span>
                <AttachmentSection label="Upload Measurement Photo" type="Measurements" existing={existingMeasPhotos} clientId={clientId} formBaseUrl={attachmentFormUrl} compact/>
              </div>
              <div>
                <span className={labelCls}>Appointment Photo</span>
                <AttachmentSection label="Upload Appointment Photo" type="Appointment Photo" existing={existingApptPhotos} clientId={clientId} formBaseUrl={attachmentFormUrl} compact/>
              </div>
              <div>
                <span className={labelCls}>Recap Doc</span>
                {hasRecapDoc ? (
                  <div className="flex gap-2 flex-wrap">
                    {existingRecapDoc.map(a=>(
                      <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                        className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-center hover:opacity-75 transition-opacity flex-shrink-0">
                        <FileTextIcon size={20} className="text-gray-400 dark:text-gray-500"/>
                      </a>
                    ))}
                  </div>
                ) : (
                  // Same gray-out behavior as the title-bar Generate button
                  // (2026-08-05, per Julia) — reuses the exact same
                  // recapDocDisabledReason (this button only ever renders
                  // while !hasRecapDoc anyway, so the "already generated"
                  // reason never applies here), shown via a click-triggered
                  // tooltip (useClickTooltip), not on hover. No `disabled`
                  // attribute for the same reason as Generate's — a real
                  // disabled button never fires onClick.
                  <div className="relative inline-block">
                    <button type="button"
                      onClick={()=>{ if (!clientId) return; if (recapDocDisabledReason) uploadBlockedTip.trigger(); else openRecapDocUploadForm(); }}
                      className={`w-[27px] h-[27px] flex items-center justify-center rounded-lg border transition-colors ${
                        recapDocDisabledReason
                          ? 'text-gray-400 dark:text-gray-500 border-gray-200 dark:border-white/10 cursor-not-allowed'
                          : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 hover:dark:bg-white/5'
                      }`}>
                      <PlusIcon size={12}/>
                    </button>
                    {uploadBlockedTip.visible && recapDocDisabledReason && (
                      <div className="absolute left-0 top-full mt-2 z-10 w-56 px-3 py-2 rounded-lg bg-gray-900 dark:bg-black text-white text-xs shadow-lg">
                        {recapDocDisabledReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Measurements Notes / Post-Appointment Notes — one row, 50/50 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className={labelCls}>Measurements Notes</span>
                <textarea value={measNotes} onChange={e=>setMeasNotes(e.target.value)} onBlur={handleMeasNotesBlur}
                  placeholder="Any posture notes, concerns, or alterations flags…" rows={4}
                  className={`${inputCls} resize-none`}/>
              </div>
              <div>
                <span className={labelCls}>Post-Appointment Notes</span>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={handleNotesBlur}
                  placeholder="Any additional notes about the appointment…" rows={4}
                  className={`${inputCls} resize-none`}/>
              </div>
            </div>

            {/* Customization Requests — invoice-style line-item table (stays last) */}
            <div>
              <span className={labelCls}>Customization Requests</span>
              <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden mb-3">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left w-64">Style</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Date of Request</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-left">Proposals</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize tracking-wider text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customizationRows.map(row=>{
                      return (
                        <tr key={row.id} onClick={()=>setEditCustomizationId(row.id)}
                          className="border-b border-gray-100 dark:border-white/5 last:border-0 cursor-pointer hover:bg-[#FEF3C7] hover:dark:bg-[#3A2E12] transition-colors">
                          <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-[#F3EFE6] w-64">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{row.styleName}</span>
                              {/* M2M/Alterations/Rush flags were removed from
                                  customization requests entirely (per Julia,
                                  2026-07-20 demo feedback — those now live
                                  only on the Draft Order). Hybrid is no
                                  longer its own Flags column — it's shown
                                  inline next to the style name, only when
                                  the request is actually Hybrid. */}
                              {row.isHybrid && (
                                <span className="bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/30 border rounded-full text-xs font-medium px-2 py-0.5 flex-shrink-0">Hybrid</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.dateRequested ? fmtUSDate(row.dateRequested) : '—'}</td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">{row.proposals.length > 0 ? row.proposals.length : '—'}</td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-[#F3EFE6] text-right">{formatCurrency(row.grandTotal)}</td>
                        </tr>
                      );
                    })}
                    {customizationRows.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-5 text-center text-gray-400 dark:text-gray-500 text-sm">No customization requests yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={()=>setOpenCustomizationAdd(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
                <UploadIcon size={14} className="text-gray-500 dark:text-gray-400"/>Add Customization Request
              </button>
            </div>

            {/* Stage-specific sidebar fields */}
            {showSidebarFields && (
              <div className="border-t border-gray-100 dark:border-white/5 pt-5 space-y-4">
                <div className="text-xs text-gray-400 dark:text-gray-500 capitalize tracking-wide font-semibold">
                  {showPreApptFields ? 'Pre-Appointment Info' : 'Client Context'}
                </div>

                {showPreApptFields && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Country</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.COUNTRY)||'—'}</div></div>
                      <div><div className={labelCls}>Next Appointment</div><div className="text-sm text-gray-700 dark:text-gray-300">{fmtFriendly(cStr(CLIENT.NEXT_APPT))||'—'}</div></div>
                      <div><div className={labelCls}>Total Appointments</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.APPT_COUNT)||'—'}</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Studio</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.STUDIO_SHORT_NAME)||'—'}</div></div>
                      <div><div className={labelCls}>RTW Size (0–20)</div>
                        <input value={rtwSize} onChange={e=>setRtwSize(e.target.value)} onBlur={handleRtwBlur} placeholder="8" type="number"
                          className={`${inputCls} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                          style={{ MozAppearance:'textfield' } as React.CSSProperties}/>
                      </div>
                      <div/>
                    </div>
                    <div><FieldLabel label="Favorite Styles (Acuity)" fieldId={CLIENT.FAV_STYLES_ACUITY} /><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.FAV_STYLES_ACUITY)||'—'}</div></div>
                    <div><div className={labelCls}>Samples Not Where Needed</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.SAMPLES_NOT_NEEDED)||'—'}</div></div>
                    <EditableTextarea
                      label="Personal Style Notes"
                      fieldId={CLIENT.PERSONAL_NOTES}
                      value={cStr(CLIENT.PERSONAL_NOTES)}
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <EditableText
                        label="Wedding Location"
                        fieldId={CLIENT.WEDDING_LOCATION}
                        value={cStr(CLIENT.WEDDING_LOCATION)}
                      />
                      <EditableText
                        label="Wedding Planner"
                        fieldId={CLIENT.WEDDING_PLANNER}
                        value={cStr(CLIENT.WEDDING_PLANNER)}
                      />
                    </div>
                  </>
                )}

                {showDelibFields && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Country</div><div className="text-sm text-gray-700 dark:text-gray-300">{cStr(CLIENT.COUNTRY)||'—'}</div></div>
                      <div><div className={labelCls}>Last Appointment</div><div className="text-sm text-gray-700 dark:text-gray-300">{fmtFriendly(cStr(CLIENT.LAST_APPT))||'—'}</div></div>
                      <div><div className={labelCls}>Next Appointment</div><div className="text-sm text-gray-700 dark:text-gray-300">{fmtFriendly(cStr(CLIENT.NEXT_APPT))||'—'}</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className={labelCls}>Customization Requests</div><div className="text-sm text-gray-700 dark:text-gray-300">{linkedCustomizations.length>0?String(linkedCustomizations.length):'—'}</div></div>
                      <div><div className={labelCls}>Interest in Alterations</div>
                        <button type="button" onClick={()=>saveClientField(CLIENT.INTEREST_ALTS, !cBool(CLIENT.INTEREST_ALTS))}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${cBool(CLIENT.INTEREST_ALTS)?'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30':'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10'}`}>
                          {cBool(CLIENT.INTEREST_ALTS)?<CheckIcon size={11} weight="bold"/>:<XIcon size={11}/>}
                          {cBool(CLIENT.INTEREST_ALTS)?'Yes':'No'}
                        </button>
                      </div>
                      <div><div className={labelCls}>Interest in M2M</div>
                        <button type="button" onClick={()=>saveClientField(CLIENT.INTEREST_M2M, !cBool(CLIENT.INTEREST_M2M))}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${cBool(CLIENT.INTEREST_M2M)?'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30':'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10'}`}>
                          {cBool(CLIENT.INTEREST_M2M)?<CheckIcon size={11} weight="bold"/>:<XIcon size={11}/>}
                          {cBool(CLIENT.INTEREST_M2M)?'Yes':'No'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className={labelCls}>Appointment Notes</span>
                      <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={handleNotesBlur} rows={3} className={`${inputCls} resize-none`}/>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {openCustomizationAdd && (
        <CustomizationModal
          mode="add"
          existingRecord={null}
          customizationsTable={customizationsTable}
          pricingTable={pricingTable}
          pricingRecords={pricingRecords}
          stylesRecords={stylesRecords}
          stylesBasePriceField={stylesBasePriceField}
          pricingPercentField={pricingPercentField}
          pricingMultipleField={pricingMultipleField}
          selfUsageField={selfUsageField}
          stylesSelfUsageField={stylesSelfUsageField}
          rushFeeProposedField={rushFeeProposedField}
          rushFeePercentField={rushFeePercentField}
          leadtimeWeeksField={leadtimeWeeksField}
          linkedClientId={clientId}
          clientWeddingIso={clientWeddingIso}
          clientName={clientName || 'Unknown Client'}
          saName={saName}
          saRecordId={saRecord?.id ?? null}
          proposalsTable={proposalsTable}
          proposalRecords={proposalRecords}
          allCustomizationRecords={customizationRecords}
          attachmentFormUrl={attachmentFormUrl}
          base={base}
          onClose={()=>setOpenCustomizationAdd(false)}
          addDraft={customizationAddDraft}
          onAddDraftChange={patch => setCustomizationAddDraft(prev => ({ ...prev, ...patch }))}
        />
      )}

      {editCustomizationId && (
        <CustomizationModal
          mode="edit"
          existingRecord={customizationRecords?.find(r=>r.id===editCustomizationId)??null}
          customizationsTable={customizationsTable}
          pricingTable={pricingTable}
          pricingRecords={pricingRecords}
          stylesRecords={stylesRecords}
          stylesBasePriceField={stylesBasePriceField}
          pricingPercentField={pricingPercentField}
          pricingMultipleField={pricingMultipleField}
          selfUsageField={selfUsageField}
          stylesSelfUsageField={stylesSelfUsageField}
          rushFeeProposedField={rushFeeProposedField}
          rushFeePercentField={rushFeePercentField}
          leadtimeWeeksField={leadtimeWeeksField}
          linkedClientId={clientId}
          clientWeddingIso={clientWeddingIso}
          clientName={clientName || 'Unknown Client'}
          saName={saName}
          saRecordId={saRecord?.id ?? null}
          proposalsTable={proposalsTable}
          proposalRecords={proposalRecords}
          allCustomizationRecords={customizationRecords}
          attachmentFormUrl={attachmentFormUrl}
          base={base}
          onClose={()=>setEditCustomizationId(null)}
          addDraft={customizationAddDraft}
          onAddDraftChange={patch => setCustomizationAddDraft(prev => ({ ...prev, ...patch }))}
        />
      )}

      {showRecapDocPreview && (
        <RecapDocPreviewModal snapshot={recapDocSnapshot} onClose={()=>setShowRecapDocPreview(false)}/>
      )}
    </>
  );
}

// ─── Custom properties ────────────────────────────────────────────────────────
// Base Price (Styles) and Percent (Customization Pricing) are referenced by a
// hardcoded field ID elsewhere in this file, same as every other field here —
// but unlike those, these two aren't resolving (base price shows $0.00, the
// percent-based line items show nothing). Rather than keep guessing at IDs
// with no way to verify them, expose both as custom properties: this gives a
// panel entry to see what's actually available and bind the real field by
// hand, and doubles as a diagnostic — if a property shows no matching field
// at all, that field isn't exposed to this interface's data source, and no
// amount of guessing the right ID would have fixed it in code.
function getCustomProperties(base: ReturnType<typeof useBase>) {
  const stylesTable         = base.getTableByIdIfExists(TABLE_IDS.STYLES);
  const pricingTable        = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATION_PRICING);
  const customizationsTable = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATIONS);
  const clientsTable        = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
  return [
    { key:'appointmentsTable', label:'Appointments', type:'table' as const, defaultValue: base.tables.find(t=>t.id===TABLE_IDS.APPOINTMENTS) },
    { key:'clientsTable',      label:'Clients',      type:'table' as const, defaultValue: base.tables.find(t=>t.id===TABLE_IDS.CLIENTS) },
    // Favorite Styles in Appointment — used to scope the Style dropdown to
    // the client's own favorites. The hardcoded CLIENT.FAV_STYLES_APPT ID
    // already works for the favorites editor elsewhere in this file, so it's
    // used as the default here too — exposed as a property mainly so it can
    // be independently verified/rebound if the style filter itself needs a
    // different field than the editor does.
    clientsTable && {
      key: 'favoriteStylesApptField',
      label: 'Favorite Styles in Appointment field (Clients)',
      type: 'field' as const,
      table: clientsTable,
      defaultValue: clientsTable.getFieldIfExists(CLIENT.FAV_STYLES_APPT)
        ?? clientsTable.fields.find(f => normalizedIncludes(f.name, 'favoritestyle')),
    },
    stylesTable && {
      key: 'stylesBasePriceField',
      label: 'Base Price field (Styles)',
      type: 'field' as const,
      table: stylesTable,
      defaultValue: stylesTable.getFieldIfExists('flduZuxPxxMqXzNxD') ?? stylesTable.fields.find(f => normalizedIncludes(f.name, 'baseprice')),
    },
    pricingTable && {
      key: 'pricingPercentField',
      label: 'Percent field (Customization Pricing)',
      type: 'field' as const,
      table: pricingTable,
      defaultValue: pricingTable.getFieldIfExists(PRICING.PERCENT) ?? pricingTable.fields.find(f => normalizedIncludes(f.name, 'percent')),
    },
    // Multiple Fee has a known field ID (fldEKZTpnJ5Y1gjOw, same as the
    // Customizations detail interface), but this interface's connection to
    // the Customization Pricing table doesn't expose it by that ID — the
    // same "not every field ID resolves in every interface page" gap that
    // Percent hit above. Bound as a custom property for the same reason.
    pricingTable && {
      key: 'pricingMultipleField',
      label: 'Multiple Fee field (Customization Pricing)',
      type: 'field' as const,
      table: pricingTable,
      defaultValue: pricingTable.getFieldIfExists(PRICING.MULTIPLE) ?? pricingTable.fields.find(f => normalizedIncludes(f.name, 'multiple')),
    },
    // Self Usage (Customizations table) and its Styles-table counterpart are
    // no longer custom properties — hardcoded directly in RecapApp as
    // of 2026-07-27 (real field IDs are known now), after a fuzzy name match
    // silently resolved to the wrong field more than once.
    // Rush Fee with Proposed Custom Price / Rush Fee % / Leadtime (Weeks)
    // have no known field ID — added to the Customizations table after this
    // interface was first scoped, same reasoning as the other custom
    // properties here.
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
      key: 'leadtimeWeeksField',
      label: 'Leadtime (Weeks) field (Customizations)',
      type: 'field' as const,
      table: customizationsTable,
      defaultValue: customizationsTable.fields.find(f => normalizedIncludes(f.name, 'leadtimeweeks'))
        ?? customizationsTable.fields.find(f => normalizedIncludes(f.name, 'leadtime')),
    },
  ].filter(Boolean);
}

// ─── RecapApp ──────────────────────────────────────────────────────────
function RecapApp(): React.ReactElement {
  useTheme();
  // Loads the free Abhaya Libre webfont once, so it's already available by
  // the time any Recap Doc preview opens (see the comment above
  // ensureRecapWebFontsLoaded). Canela Text still needs a licensed source —
  // see the same comment.
  useEffect(() => { ensureRecapWebFontsLoaded(); }, []);
  const base = useBase();
  const { errorState, customPropertyValueByKey } = useCustomProperties(getCustomProperties);
  const stylesBasePriceField = (customPropertyValueByKey?.stylesBasePriceField as ReturnType<Table['getFieldIfExists']>) ?? null;
  const pricingPercentField  = (customPropertyValueByKey?.pricingPercentField  as ReturnType<Table['getFieldIfExists']>) ?? null;
  const pricingMultipleField = (customPropertyValueByKey?.pricingMultipleField as ReturnType<Table['getFieldIfExists']>) ?? null;
  const rushFeeProposedField = (customPropertyValueByKey?.rushFeeProposedField as ReturnType<Table['getFieldIfExists']>) ?? null;
  const rushFeePercentField  = (customPropertyValueByKey?.rushFeePercentField  as ReturnType<Table['getFieldIfExists']>) ?? null;
  const leadtimeWeeksField   = (customPropertyValueByKey?.leadtimeWeeksField   as ReturnType<Table['getFieldIfExists']>) ?? null;
  const favoriteStylesApptField = (customPropertyValueByKey?.favoriteStylesApptField as ReturnType<Table['getFieldIfExists']>) ?? null;

  const appointmentsTable   = base.getTableByIdIfExists(TABLE_IDS.APPOINTMENTS);
  const clientsTable        = base.getTableByIdIfExists(TABLE_IDS.CLIENTS);
  const stylesTable         = base.getTableByIdIfExists(TABLE_IDS.STYLES);
  const customizationsTable = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATIONS);
  const pricingTable        = base.getTableByIdIfExists(TABLE_IDS.CUSTOMIZATION_PRICING);
  const staffTable          = base.getTableByIdIfExists(TABLE_IDS.STAFF);
  // Hardcoded (2026-07-27) — was a fuzzy name-matched custom property
  // ('includes selfusage'), which could resolve to the wrong field once a
  // same-table field with a similar name existed (additional_self_usage on
  // Customizations; an unconfirmed lookalike on Styles) — surfaced as a
  // wildly-off Rate multiplier ("$1,500.00 x 7.00" instead of the expected
  // tier alone). A hardcoded ID can't collide with anything, ever.
  const selfUsageField       = customizationsTable?.getFieldIfExists('fldAhZaX0VHwZz3fW') ?? null;
  const stylesSelfUsageField = stylesTable?.getFieldIfExists('fld5Id6iAWLhueqQ8') ?? null;
  const proposalsTable      = base.getTableByIdIfExists(TABLE_IDS.PROPOSALS);
  const resourcesTable      = base.getTableByIdIfExists(TABLE_IDS.RESOURCES);

  // useRecords — fall back to appointmentsTable to keep hook count stable
  const appointmentRecords = useRecords(appointmentsTable ?? null);
  const clientRecords      = useRecords(clientsTable ?? null);
  const _stylesRaw         = useRecords(stylesTable ?? appointmentsTable ?? null);
  const stylesRecords      = stylesTable ? _stylesRaw : null;
  const _customRaw         = useRecords(customizationsTable ?? appointmentsTable ?? null);
  const customizationRecords = customizationsTable ? _customRaw : null;
  const _pricingRaw        = useRecords(pricingTable ?? appointmentsTable ?? null);
  const pricingRecords     = pricingTable ? _pricingRaw : null;
  const _staffRaw          = useRecords(staffTable ?? appointmentsTable ?? null);
  const staffRecords       = staffTable ? _staffRaw : null;
  const _proposalsRaw      = useRecords(proposalsTable ?? appointmentsTable ?? null);
  const proposalRecords    = proposalsTable ? _proposalsRaw : null;
  const _resourcesRaw      = useRecords(resourcesTable ?? appointmentsTable ?? null);
  const resourcesRecords   = resourcesTable ? _resourcesRaw : null;

  // Recap Doc footer logo — sandbox record ID first, falls back to the
  // production record ID (same code, different base). Attachment URLs are
  // signed/expiring, so this is read live every render, never cached in
  // source.
  const recapLogoRecord = resourcesRecords?.find(r => r.id === RECAP_LOGO_RESOURCE_RECORD_ID_SANDBOX)
    ?? resourcesRecords?.find(r => r.id === RECAP_LOGO_RESOURCE_RECORD_ID_PRODUCTION)
    ?? null;
  const fResourcesAttachment = resourcesTable?.getFieldIfExists(RESOURCES.ATTACHMENT) ?? null;
  const recapLogoAttachment = (recapLogoRecord && fResourcesAttachment)
    ? ((recapLogoRecord.getCellValue(fResourcesAttachment) as ProposalFile[] | null)?.[0] ?? null)
    : null;
  // Falls back to the embedded base64 PNG (see RECAP_FOOTER_LOGO_DATA_URI)
  // if the resources record can't be found in either base — e.g. local/
  // draft preview before that record exists there yet.
  const recapLogoUrl = recapLogoAttachment?.thumbnails?.large?.url ?? recapLogoAttachment?.url ?? RECAP_FOOTER_LOGO_DATA_URI;

  // Attachments form URL (2026-08-05, per Julia) — resolved by NAME, not by
  // a hardcoded per-environment record ID like the logo above, since Julia
  // set this up as one shared "attachments_form" record whose URL field she
  // edits directly per environment (sandbox records aren't synced to
  // production, so the same record name can hold a different URL value in
  // each copy of the base). Falls back to ATTACHMENT_FORM_URL_FALLBACK if
  // that record can't be found yet.
  const attachmentFormResource = resourcesRecords?.find(r => r.name === ATTACHMENT_FORM_RESOURCE_NAME) ?? null;
  const fResourcesUrl = resourcesTable?.getFieldIfExists(RESOURCES.URL) ?? null;
  const attachmentFormUrl = (attachmentFormResource && fResourcesUrl)
    ? (attachmentFormResource.getCellValueAsString(fResourcesUrl) || ATTACHMENT_FORM_URL_FALLBACK)
    : ATTACHMENT_FORM_URL_FALLBACK;

  const [selectedDate, setSelectedDate]        = useState(new Date());
  const [showCalendar, setShowCalendar]         = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedSA, setSelectedSA]             = useState<string[]>([]);
  const [selectedStudio, setSelectedStudio]     = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string|null>(null);
  const [clientSearch, setClientSearch]         = useState('');
  const [searchResults, setSearchResults]       = useState<AirtableRecord[]>([]);
  const [showSearchDrop, setShowSearchDrop]     = useState(false);
  const [searchHighlight, setSearchHighlight]   = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(searchRef.current&&!searchRef.current.contains(e.target as Node)) setShowSearchDrop(false); };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);

  const fTime       = appointmentsTable?.getFieldIfExists(APPT.TIME)        ?? null;
  const fType       = appointmentsTable?.getFieldIfExists(APPT.TYPE)        ?? null;
  const fClient     = appointmentsTable?.getFieldIfExists(APPT.CLIENT_LINK) ?? null;
  const fSA         = appointmentsTable?.getFieldIfExists(APPT.SA_NAME)     ?? null;
  const fStudio     = appointmentsTable?.getFieldIfExists(APPT.STUDIO_NAME) ?? null;
  const fStatus     = appointmentsTable?.getFieldIfExists(APPT.STATUS)      ?? null;
  const fFavAcuityLookup  = appointmentsTable?.getFieldIfExists(APPT.FAV_STYLES_ACUITY_LOOKUP) ?? null;
  const fFavApptLookup    = appointmentsTable?.getFieldIfExists(APPT.FAV_STYLES_APPT_LOOKUP)   ?? null;

  // Client id -> record map, so the main list can read Wedding Date straight
  // off the live Clients.WEDDING field (fldbgknumKGS5W5WU) — the exact same
  // field PostAppointmentModal's detail page reads/edits. Replaces the old
  // Appointments-level WEDDING_DATE_LOOKUP (a lookup of Clients.WEDDING_IF_NOT_SET,
  // fldqwfmMczvLhiqk1 — a plain singleLineText field an automation writes a
  // fallback into, NOT a live formula) which could silently drift out of sync
  // with the real WEDDING date once it's set/corrected on the client record,
  // making the summary list show a stale date the individual/detail page had
  // already moved past (2026-08-07 fix).
  const clientById = useMemo(() => {
    const m = new Map<string, AirtableRecord>();
    (clientRecords ?? []).forEach(c => m.set(c.id, c));
    return m;
  }, [clientRecords]);

  useEffect(()=>{
    if (!clientSearch.trim()||!appointmentRecords||!fClient) { setSearchResults([]); setShowSearchDrop(false); return; }
    const q = clientSearch.toLowerCase();
    // Same hidden filters as filterAndSort below (Consultation only, not
    // Cancelled, must have a linked client) — otherwise a name search could
    // surface fittings/pickups or cancelled appointments the rest of this
    // interface never shows.
    const m = appointmentRecords.filter(r=>{
      if (!r.getCellValueAsString(fClient!).toLowerCase().includes(q)) return false;
      if (fStatus && r.getCellValueAsString(fStatus!)==='Cancelled') return false;
      const type = fType ? r.getCellValueAsString(fType!) : '';
      if (!isConsultation(type)) return false;
      return true;
    }).sort((a,b)=>{
      if (!fTime) return 0;
      const ta = a.getCellValue(fTime) as string|null;
      const tb = b.getCellValue(fTime) as string|null;
      if (!ta) return 1; if (!tb) return -1;
      return new Date(tb).getTime()-new Date(ta).getTime(); // most recent first
    });
    setSearchResults(m);
    setShowSearchDrop(m.length>0);
    setSearchHighlight(m.length>0 ? 0 : -1);
  },[clientSearch, appointmentRecords, fClient, fStatus, fType, fTime]);

  const today    = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const todayStr = fmtDateKey(today);
  const isToday  = useMemo(()=>fmtDateKey(selectedDate)===todayStr,[selectedDate, todayStr]);

  const saOptions = useMemo(()=>{
    if (!appointmentRecords||!fSA) return [];
    const s=new Set<string>();
    appointmentRecords.forEach(r=>{ const v=r.getCellValueAsString(fSA!); if(v) s.add(v); });
    return Array.from(s).sort();
  },[appointmentRecords, fSA]);

  const studioOptions = useMemo(()=>{
    if (!appointmentRecords||!fStudio) return [];
    const s=new Set<string>();
    appointmentRecords.forEach(r=>{ const v=r.getCellValueAsString(fStudio!); if(v) s.add(v); });
    return Array.from(s).sort();
  },[appointmentRecords, fStudio]);

  const filterAndSort = useCallback((records: AirtableRecord[], dateStr: string)=>{
    if (!fTime) return [];
    return records.filter(r=>{
      const t = r.getCellValue(fTime!) as string|null;
      if (!t||fmtDateKey(new Date(t))!==dateStr) return false;
      if (fClient && !(r.getCellValue(fClient!) as Array<{id:string}>|null)?.length) return false;
      if (fStatus && r.getCellValueAsString(fStatus!)==='Cancelled') return false;
      const type = fType ? r.getCellValueAsString(fType!) : '';
      if (!isConsultation(type)) return false;
      if (selectedSA.length && fSA && !selectedSA.includes(r.getCellValueAsString(fSA!))) return false;
      if (selectedStudio.length && fStudio && !selectedStudio.includes(r.getCellValueAsString(fStudio!))) return false;
      return true;
    }).sort((a,b)=>{
      const ta=a.getCellValue(fTime!) as string|null;
      const tb=b.getCellValue(fTime!) as string|null;
      if (!ta) return 1; if (!tb) return -1;
      return new Date(ta).getTime()-new Date(tb).getTime();
    });
  },[fTime, fStatus, fType, fSA, fStudio, selectedSA, selectedStudio]);

  const filteredRecs  = useMemo(()=>filterAndSort(appointmentRecords??[], fmtDateKey(selectedDate)),[appointmentRecords, selectedDate, filterAndSort]);
  const selectedRecord= useMemo(()=>selectedRecordId?(appointmentRecords?.find(r=>r.id===selectedRecordId)??null):null,[selectedRecordId, appointmentRecords]);

  if (errorState) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 dark:text-gray-400">Error loading configuration.</p></div>;
  if (!appointmentsTable || !clientsTable) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center p-8">
        <p className="text-lg font-semibold text-gray-800 dark:text-[#F3EFE6] mb-2">Configuration Required</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Set Appointments and Clients tables in the properties panel.</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans antialiased bg-[#F8F5EE] dark:bg-[#1B1813]">
      <style>{`::-webkit-scrollbar-button{display:none;height:0;width:0}`}</style>
      {selectedRecord && (
        <PostAppointmentModal
          record={selectedRecord}
          apptTable={appointmentsTable}
          clientsTable={clientsTable}
          clientRecords={clientRecords}
          stylesTable={stylesTable}
          stylesRecords={stylesRecords}
          customizationsTable={customizationsTable}
          customizationRecords={customizationRecords}
          pricingTable={pricingTable}
          pricingRecords={pricingRecords}
          stylesBasePriceField={stylesBasePriceField}
          pricingPercentField={pricingPercentField}
          pricingMultipleField={pricingMultipleField}
          selfUsageField={selfUsageField}
          stylesSelfUsageField={stylesSelfUsageField}
          rushFeeProposedField={rushFeeProposedField}
          rushFeePercentField={rushFeePercentField}
          leadtimeWeeksField={leadtimeWeeksField}
          favoriteStylesApptField={favoriteStylesApptField}
          staffTable={staffTable}
          staffRecords={staffRecords}
          proposalsTable={proposalsTable}
          proposalRecords={proposalRecords}
          recapLogoUrl={recapLogoUrl}
          attachmentFormUrl={attachmentFormUrl}
          base={base}
          onClose={()=>setSelectedRecordId(null)}
        />
      )}

      {/* Header */}
      <div className="px-7 pt-5 pb-4 flex-shrink-0 flex items-center gap-3">
        <button onClick={()=>{ const d=new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }}
          className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
          <CaretLeftIcon size={14}/>
        </button>
        <div className="relative">
          <button onClick={()=>setShowCalendar(!showCalendar)}
            className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 cursor-pointer text-sm font-semibold text-gray-900 dark:text-[#F3EFE6] flex items-center gap-2 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            <CalendarIcon size={13} className="text-gray-500 dark:text-gray-400"/>{fmtDisplay(selectedDate)}
          </button>
          {showCalendar && <MiniCalendar selected={selectedDate} onSelect={(d)=>setSelectedDate(d)} onClose={()=>setShowCalendar(false)}/>}
        </div>
        <button onClick={()=>{ const d=new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }}
          className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
          <CaretRightIcon size={14}/>
        </button>
        {!isToday && (
          <button onClick={()=>setSelectedDate(new Date())}
            className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-white/5 transition-colors">
            Today
          </button>
        )}
        <div className="h-6 w-px bg-gray-200 dark:bg-white/10"/>
        {/* Search */}
        <div ref={searchRef} className="relative">
          <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10 pointer-events-none"/>
          <input type="text" placeholder="Search by client name…" value={clientSearch}
            onChange={e=>setClientSearch(e.target.value)}
            onFocus={()=>{ if(searchResults.length>0) setShowSearchDrop(true); }}
            onKeyDown={e=>{
              if (!showSearchDrop || searchResults.length===0) return;
              if (e.key==='ArrowDown') { e.preventDefault(); setSearchHighlight(i=>(i+1)%searchResults.length); }
              else if (e.key==='ArrowUp') { e.preventDefault(); setSearchHighlight(i=>(i-1+searchResults.length)%searchResults.length); }
              else if (e.key==='Enter') {
                e.preventDefault();
                const rec = searchResults[searchHighlight] ?? searchResults[0];
                if (rec) { setSelectedRecordId(rec.id); setShowSearchDrop(false); setClientSearch(''); }
              } else if (e.key==='Escape') { setShowSearchDrop(false); }
            }}
            className="pl-9 pr-8 py-1.5 text-sm bg-white dark:bg-[#25211A] border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] w-[300px]"/>
          {clientSearch && (
            <button type="button" onClick={()=>{setClientSearch('');setShowSearchDrop(false);}}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-400">
              <XIcon size={14}/>
            </button>
          )}
          {showSearchDrop && searchResults.length>0 && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg w-[280px] max-h-[300px] overflow-y-auto">
              {searchResults.map((rec,i)=>{
                const name = fClient ? rec.getCellValueAsString(fClient!) : '';
                const t = fTime ? (rec.getCellValue(fTime!) as string|null) : null;
                return (
                  <button key={rec.id} onClick={()=>{setSelectedRecordId(rec.id);setShowSearchDrop(false);setClientSearch('');}}
                    onMouseEnter={()=>setSearchHighlight(i)}
                    className={`w-full text-left px-4 py-2 transition-colors border-b border-gray-100 dark:border-white/5 last:border-b-0 ${i===searchHighlight?'bg-[#FEF3C7] dark:bg-[#3A2E12]':'hover:bg-[#FEF3C7] hover:dark:bg-[#3A2E12]'}`}>
                    <div className="text-sm text-gray-900 dark:text-[#F3EFE6] font-medium">{name || '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t?`${fmtDisplay(new Date(t))} at ${fmtNYTime(new Date(t))}`:''}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <FilterDropdown label="Studio" values={selectedStudio} options={studioOptions} onChange={setSelectedStudio}/>
        <FilterDropdown label="Sales Associate" values={selectedSA} options={saOptions} onChange={setSelectedSA}/>
      </div>

      {/* Table */}
      <div className="px-7 pb-5 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-white/10 w-full flex-1 min-h-0">
          <table className="w-full border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                {['Time','Client','Studio','Wedding Date','Sales Associate','Favorite Styles from Acuity','Favorite Styles from Appointment'].map(h=>(
                  <th key={h} className="text-left px-3 py-2 text-xs text-gray-400 dark:text-gray-500 font-bold tracking-wider capitalize whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecs.length===0
                ? <tr><td colSpan={7} className="px-8 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">No consultation appointments for {fmtDisplay(selectedDate)}.</td></tr>
                : filteredRecs.map((rec,idx)=>{
                    const t      = fTime   ? (rec.getCellValue(fTime!)  as string|null) : null;
                    const name   = fClient ? rec.getCellValueAsString(fClient!) : '';
                    const studio = fStudio ? rec.getCellValueAsString(fStudio!) : '';
                    const sa     = fSA     ? rec.getCellValueAsString(fSA!)    : '';
                    // Favorite Styles still come from Appointments-level lookups (via
                    // CLIENT_LINK) — needs the unwrap helper above since this runtime
                    // returns lookup cells as a per-linked-record array, not a plain
                    // value. Wedding Date, however, is read straight off the linked
                    // Clients record's own WEDDING_DISPLAY field (see clientById
                    // above) — NOT an Appointments-level lookup, so it always matches
                    // the detail page, and it's the wedding_date_display formula
                    // (fixed 2026-08-21), not Formatted alone, so a client with only
                    // a manual placeholder date still shows something instead of '—'.
                    const linkedClientIds = fClient ? (rec.getCellValue(fClient) as Array<{ id: string }> | null) : null;
                    const weddingClientRec = linkedClientIds?.[0] ? clientById.get(linkedClientIds[0].id) ?? null : null;
                    const weddingDisplay   = weddingClientRec ? getStr(weddingClientRec, CLIENT.WEDDING_DISPLAY) : '';
                    const favAcuityNames = fFavAcuityLookup ? unwrapLinkedNames(rec.getCellValue(fFavAcuityLookup)) : [];
                    const favApptNames   = fFavApptLookup   ? unwrapLinkedNames(rec.getCellValue(fFavApptLookup))   : [];
                    return (
                      <tr key={rec.id} onClick={()=>setSelectedRecordId(rec.id)}
                        className={`border-b border-gray-100 dark:border-white/5 cursor-pointer transition-colors ${idx%2===0?'bg-white dark:bg-[#25211A]':'bg-gray-50 dark:bg-white/5'} hover:bg-[#FEF3C7] dark:bg-[#3A2E12]`}>
                        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap tabular-nums">{t?fmtNYTime(new Date(t)):'—'}</td>
                        <td className="px-3 py-3"><div className="font-semibold text-sm text-gray-900 dark:text-[#F3EFE6]">{name||'Unknown'}</div></td>
                        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{studio||'—'}</td>
                        <td className="px-3 py-3">
                          <div className="text-sm text-gray-700 dark:text-gray-300">{weddingDisplay?fmtFriendly(weddingDisplay):'—'}</div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{sa||'—'}</td>
                        <td className="px-3 py-3">
                          {favAcuityNames.length>0
                            ? <div className="flex flex-wrap gap-1">{favAcuityNames.slice(0,2).map((n,i)=><span key={i} className="bg-gray-100 dark:bg-white/10 rounded px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">{n}</span>)}{favAcuityNames.length>2&&<span className="text-xs text-gray-400 dark:text-gray-500">+{favAcuityNames.length-2}</span>}</div>
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          {favApptNames.length>0
                            ? <div className="flex flex-wrap gap-1">{favApptNames.slice(0,2).map((n,i)=><span key={i} className="bg-gray-100 dark:bg-white/10 rounded px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">{n}</span>)}{favApptNames.length>2&&<span className="text-xs text-gray-400 dark:text-gray-500">+{favApptNames.length-2}</span>}</div>
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      <FeedbackButton onClick={() => setShowFeedbackModal(true)} />
      {showFeedbackModal && <FeedbackModal base={base} onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}

initializeBlock({ interface: () => <RecapApp /> });
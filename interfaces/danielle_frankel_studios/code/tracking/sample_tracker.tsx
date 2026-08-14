import {
  initializeBlock,
  useBase,
  useRecords,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table, Record, Field } from '@airtable/blocks/interface/models';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CaretDown as CaretDownIcon,
  Check as CheckIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  X as XIcon,
  ChatCircleText as ChatCircleTextIcon,
  Paperclip as PaperclipIcon,
  Plus as PlusIcon,
  MagnifyingGlassPlus as MagnifyingGlassPlusIcon,
  MagnifyingGlassMinus as MagnifyingGlassMinusIcon,
  DownloadSimple as DownloadSimpleIcon,
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  ArrowsOut as ArrowsOutIcon,
} from '@phosphor-icons/react';

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
  // Reads Airtable's own light/dark preference, not the OS/browser setting.
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}

// ─── FIELD / TABLE IDS ────────────────────────────────────────────────────────
const FIELD_IDS = {
  SAMPLE: {
    LABEL:      'fldY8RGD6wRe673Lh', // formula: ParentStyleName||StyleNameLegacy - S - Size (read-only)
    STYLE_NAME_LEGACY: 'fldey0Dj1iCDrk9iz', // singleLineText — renamed from "Style Name"; fallback/legacy-only, not used for new samples
    PARENT_STYLE:      'fldFWWLHDvxG0gtkH', // multipleRecordLinks → DF Styles (tbl0hWIRBbcB4UkVC) — THE way new samples get their style
    PARENT_STYLE_NAME: 'fldX5HLW1J4bRoZY0', // lookup (read-only) — linked DF Styles record's Style Name; use for display
    SIZE:      'fldWEXxkqlC7EHCpL', // singleSelect
    LOCATION:  'fldPHYcHjncDy3JTG', // singleSelect
    TYPE:      'fld00hfqAy5lUGote', // singleSelect: Garment, Shoes, Accessories
    NOTES:     'fldDOwmisGyOOKN7O', // multilineText
    LOCATION_BUCKET: 'fldjLf5XSWEwsmdYh', // formula: In Studio / Trunk Show / Away — displayed as the "Location" badge
    STATUS:    'fldGUFM9bxpEGrwtj', // singleSelect — real Status field, editable (also doubles as the Retire flag: Active/Retired)
    PHOTO:     'fld6QCh4Mhb5ayf3H', // multipleAttachments
    // NOTE: fldZ7FUzHZ6KwVeNF ("Condition (Legacy - Unused)") is DEAD — never read or written anymore.
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
    // Source of truth for RTW size matching — formula: falls back to Size from
    // Acuity Intake when ready_to_wear_size_manual is blank (manual entry is
    // rare). Read this field for matching; never read READY_TO_WEAR_SIZE_MANUAL
    // directly.
    READY_TO_WEAR_SIZE: 'fldSwfR25uvynWKI5', // formula
    READY_TO_WEAR_SIZE_MANUAL: 'fldEEH4CK3Qqp0g0C', // number — raw manual entry, superseded by READY_TO_WEAR_SIZE above
    FAVORITE_STYLES:  'fldZzNR0g5VEJ5RmX', // multipleRecordLinks → DF Styles — same field the Champion Match automation watches
    CHAMPION_SAMPLES: 'fldEDcL6wGGmUt6ni', // multipleRecordLinks → Sample Log — written by the Champion Match automation
  },
  DF_STYLES: {
    STYLE_NAME: 'fldEs3chQAeplPc1w', // singleLineText
    IS_PARENT_STYLE: 'fldahgBBH19TcIPzi', // checkbox — only parent styles are selectable in the parent_style picker
  },
  CONDITION_HISTORY: {
    SAMPLE_LINK: 'fldg7B8fEq7qwWhGU', // multipleRecordLinks → Sample Log
    CONDITION:   'fldfhYBhOYkx1vDno', // singleSelect: Good Condition / Damaged / Needing Repair
    PHOTO:       'fldmMmH2plMFThEWk', // multipleAttachments
    NOTES:       'fldtXZ0o9qVpSAkPG', // multilineText
    LOGGED_AT:   'fldzrWV01dC1upKmu', // formula: CREATED_TIME() — sort by this, most recent first
  },
} as const;

const TABLE_IDS = {
  SAMPLE_LOG:        'tbloFb2w2SANfkDQy',
  APPOINTMENTS:      'tblvV7uKTCaFFekoR',
  CLIENTS:           'tblLLUlDgJ4ktzF7c',
  DF_STYLES:         'tbl0hWIRBbcB4UkVC',
  CONDITION_HISTORY: 'tblCeawyDvoWBj2hQ',
  RESOURCES:         'tblFa56lQwVacMXto',
} as const;

// resources table (tblFa56lQwVacMXto) — small shared-asset table, read live via
// the Blocks SDK rather than baked into source, because sandbox and production
// are different Airtable bases with independently-editable resources records
// holding different URLs for the same logical resource (same pattern as
// recap.tsx's attachments_form_url).
const RESOURCES_FIELD_IDS = {
  URL: 'fldMDIAqAjpwUvtWF', // plain url field
} as const;
// The resources record holding the Sample Condition History Form's share URL —
// resolved by NAME (not a hardcoded per-environment record ID), since this is
// one shared record whose URL field gets edited directly per environment.
const CONDITION_FORM_RESOURCE_NAME = 'sample_condition_entry_form';

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
const CONDITION_OPTIONS = ['Good Condition', 'Damaged', 'Needing Repair'];
const ALERT_TYPE_OPTIONS = ['Style not in studio', 'Client size missing', 'No styles on file'];

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

function FeedbackButton({ onClick, tok }: { onClick: () => void; tok: Tok }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'fixed', bottom: '16px', right: '80px', zIndex: 9600,
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '10px 16px', fontSize: '13px', fontWeight: 600,
        borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: tok.accent, color: tok === DARK ? '#1B1813' : '#FFFFFF',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
    >
      <ChatCircleTextIcon size={16} /> Feedback
    </button>
  );
}

function FeedbackModal({ base, onClose, tok }: { base: ReturnType<typeof useBase>; onClose: () => void; tok: Tok }) {
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
  const interfaceInventoryRecords = useRecords(interfaceInventoryTable ?? null);
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

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: tok.text_muted, letterSpacing: '0.07em', marginBottom: '5px',
  };
  const inputBoxStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '8px',
    border: `1px solid ${tok.input_border}`, background: tok.surface, color: tok.text_primary,
    fontSize: '13px', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9700,
        background: tok.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: tok.surface, border: `1px solid ${tok.border}`, borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '460px', maxWidth: 'calc(100vw - 32px)',
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${tok.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: tok.text_primary }}>Feedback</div>
          <div style={{ fontSize: '12px', color: tok.text_secondary, marginTop: '2px' }}>Flag an issue or share an idea.</div>
        </div>

        <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={fieldLabelStyle}>Feedback Type *</div>
              <InlineSelect value={feedbackType || null} options={FEEDBACK_TYPE_OPTIONS} onChange={setFeedbackType} tok={tok} escapeModal />
            </div>
            <div>
              <div style={fieldLabelStyle}>Scope *</div>
              <InlineSelect
                value={scope || null}
                options={FEEDBACK_SCOPE_OPTIONS}
                onChange={v => { setScope(v); setInterfaceId(null); setPageId(null); }}
                tok={tok}
                escapeModal
              />
            </div>
          </div>

          {scope === 'Specific Interface' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={fieldLabelStyle}>Interface *</div>
                <InlineSelect
                  value={interfaceOptions.find(o => o.id === interfaceId)?.name ?? null}
                  options={interfaceOptions.map(o => o.name)}
                  onChange={name => { setInterfaceId(interfaceOptions.find(o => o.name === name)?.id ?? null); setPageId(null); }}
                  tok={tok}
                  escapeModal
                />
              </div>
              <div>
                <div style={fieldLabelStyle}>Page *</div>
                <InlineSelect
                  value={pageOptions.find(o => o.id === pageId)?.name ?? null}
                  options={pageOptions.map(o => o.name)}
                  onChange={name => setPageId(pageOptions.find(o => o.name === name)?.id ?? null)}
                  tok={tok}
                  escapeModal
                />
              </div>
            </div>
          )}

          <div>
            <div style={fieldLabelStyle}>Description *</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 2000))}
              rows={6}
              placeholder="Please provide detailed feedback…"
              style={{ ...inputBoxStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
            <div style={{ fontSize: '11px', color: tok.text_muted, marginTop: '3px', textAlign: 'right' }}>{description.length}/2000</div>
          </div>

          <div>
            <div style={fieldLabelStyle}>Attachments</div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px', borderRadius: '8px', border: `1px dashed ${tok.input_border}`,
                background: 'transparent', color: tok.text_muted, fontSize: '13px', cursor: 'pointer',
              }}
            >
              <PaperclipIcon size={14} /> Choose images or videos
            </button>
            <input
              ref={fileInputRef} type="file" multiple accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
            />
            {files.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {files.map((f, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px',
                      borderRadius: '999px', background: tok.surface_alt, fontSize: '12px', color: tok.text_secondary,
                    }}
                  >
                    {f.filename}
                    <XIcon
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: '12px', color: '#EF4444' }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 18px', borderTop: `1px solid ${tok.border}`, display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px', fontSize: '13px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: tok.text_secondary, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || missingRequired}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none',
              background: tok.accent, color: tok === DARK ? '#1B1813' : '#FFFFFF',
              cursor: (submitting || missingRequired) ? 'not-allowed' : 'pointer',
              opacity: (submitting || missingRequired) ? 0.5 : 1,
            }}
          >
            {submitting ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RECORD SELECT (InlineSelect variant for {id,label} options w/ typeahead) ──
interface RecordOption { id: string; label: string; }
interface RecordSelectProps {
  value: string | null; // selected record id
  options: RecordOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  tok: Tok;
  escapeModal?: boolean;
}
function RecordSelect({ value, options, onChange, placeholder = 'Select…', tok, escapeModal = false }: RecordSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const ITEM_HEIGHT = 34;
  const MAX_VISIBLE = 8;

  const selected = options.find(o => o.id === value) ?? null;
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const handleOpen = () => {
    if (escapeModal && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const idealHeight = Math.min(filtered.length || 1, MAX_VISIBLE) * ITEM_HEIGHT + 40;
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 3,
        left: rect.left,
        width: rect.width,
        zIndex: 60,
        maxHeight: Math.min(idealHeight, spaceBelow),
        overflowY: 'auto',
      });
    }
    setQuery('');
    setOpen(o => !o);
  };

  const baseListStyle = {
    background: tok.surface, border: `1px solid ${tok.border}`,
    borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '3px 0',
  };
  const listStyle: React.CSSProperties = escapeModal
    ? { ...dropdownStyle, ...baseListStyle, display: 'flex', flexDirection: 'column' }
    : {
        position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 20,
        maxHeight: `${MAX_VISIBLE * ITEM_HEIGHT + 46}px`, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
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
          color: selected ? tok.text_primary : tok.text_muted,
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label ?? placeholder}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div style={listStyle}>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="Type to filter…"
            style={{
              margin: '4px 6px 4px', boxSizing: 'border-box',
              padding: '6px 8px', borderRadius: '6px',
              border: `1px solid ${tok.input_border}`, background: tok.surface,
              color: tok.text_primary, fontSize: '12px', outline: 'none', fontFamily: 'inherit',
              flexShrink: 0,
            }}
          />
          <div style={{ overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: '12px', color: tok.text_muted }}>No matches</div>
            )}
            {filtered.map(opt => {
              const isSel = opt.id === value;
              return (
                <div
                  key={opt.id}
                  onClick={() => { onChange(opt.id); setOpen(false); }}
                  style={{
                    padding: '7px 10px', cursor: 'pointer', fontSize: '13px',
                    background: isSel ? tok.accent_subtle : 'transparent',
                    color: isSel ? tok.accent : tok.text_primary, fontWeight: isSel ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = tok.surface_alt; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSel ? tok.accent_subtle : 'transparent'; }}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADD SAMPLE MODAL ─────────────────────────────────────────────────────────
interface AddSampleModalProps {
  base: ReturnType<typeof useBase>;
  sampleTable: Table;
  onClose: () => void;
  tok: Tok;
}
function AddSampleModal({ base, sampleTable, onClose, tok }: AddSampleModalProps) {
  const dfStylesTable = base.getTableByIdIfExists(TABLE_IDS.DF_STYLES);
  const dfStylesRecords = useRecords(dfStylesTable ?? null);
  // Parent-style constraint: only records with is_parent_style checked are
  // selectable here — variants (e.g. "-customized") are excluded.
  const styleOptions: RecordOption[] = useMemo(() => {
    if (!dfStylesRecords) return [];
    return dfStylesRecords
      .filter(r => r.getCellValue(FIELD_IDS.DF_STYLES.IS_PARENT_STYLE) === true)
      .map(r => ({ id: r.id, label: r.getCellValueAsString(FIELD_IDS.DF_STYLES.STYLE_NAME) || '(untitled)' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [dfStylesRecords]);

  const [parentStyleId, setParentStyleId] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ parentStyle?: string; size?: string; type?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    const errs: { parentStyle?: string; size?: string; type?: string } = {};
    if (!parentStyleId) errs.parentStyle = 'Parent Style is required';
    if (!size) errs.size = 'Size is required';
    if (!type) errs.type = 'Type is required';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setError(null);
    setSubmitting(true);
    const fields: Record<string, unknown> = {
      [FIELD_IDS.SAMPLE.PARENT_STYLE]: [{ id: parentStyleId }],
      [FIELD_IDS.SAMPLE.SIZE]: { name: size },
      [FIELD_IDS.SAMPLE.TYPE]: { name: type },
      [FIELD_IDS.SAMPLE.STATUS]: { name: 'Active' },
    };
    if (location) fields[FIELD_IDS.SAMPLE.LOCATION] = { name: location };
    if (notes.trim()) fields[FIELD_IDS.SAMPLE.NOTES] = notes.trim();

    try {
      await queueWrite(() => sampleTable.createRecordAsync(fields));
      onClose();
    } catch (e: unknown) {
      console.error('Failed to create sample', e);
      setError(e instanceof Error ? e.message : 'Failed to save sample');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: tok.text_muted, letterSpacing: '0.07em', marginBottom: '5px',
  };
  const inputBoxStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '8px',
    border: `1px solid ${tok.input_border}`, background: tok.surface, color: tok.text_primary,
    fontSize: '13px', outline: 'none', fontFamily: 'inherit',
  };
  const errorTextStyle: React.CSSProperties = { fontSize: '11px', color: '#EF4444', marginTop: '4px' };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9700,
        background: tok.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: tok.surface, border: `1px solid ${tok.border}`, borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '460px', maxWidth: 'calc(100vw - 32px)',
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${tok.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: tok.text_primary }}>Add Sample</div>
          <div style={{ fontSize: '12px', color: tok.text_secondary, marginTop: '2px' }}>New samples are added as Active.</div>
        </div>

        <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={fieldLabelStyle}>Parent Style *</div>
            <RecordSelect
              value={parentStyleId}
              options={styleOptions}
              onChange={setParentStyleId}
              placeholder="Select a style…"
              tok={tok}
              escapeModal
            />
            {fieldErrors.parentStyle && <div style={errorTextStyle}>{fieldErrors.parentStyle}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={fieldLabelStyle}>Size *</div>
              <InlineSelect value={size} options={SIZE_OPTIONS} onChange={setSize} tok={tok} escapeModal />
              {fieldErrors.size && <div style={errorTextStyle}>{fieldErrors.size}</div>}
            </div>
            <div>
              <div style={fieldLabelStyle}>Type *</div>
              <InlineSelect value={type} options={TYPE_OPTIONS} onChange={setType} tok={tok} escapeModal />
              {fieldErrors.type && <div style={errorTextStyle}>{fieldErrors.type}</div>}
            </div>
          </div>

          <div>
            <div style={fieldLabelStyle}>Location</div>
            <InlineSelect value={location} options={LOCATION_OPTIONS} onChange={setLocation} tok={tok} escapeModal />
          </div>

          <div>
            <div style={fieldLabelStyle}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes…"
              style={{ ...inputBoxStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {error && <div style={{ fontSize: '12px', color: '#EF4444' }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 18px', borderTop: `1px solid ${tok.border}`, display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px', fontSize: '13px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: tok.text_secondary, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none',
              background: tok.accent, color: tok === DARK ? '#1B1813' : '#FFFFFF',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Save sample'}
          </button>
        </div>
      </div>
    </div>
  );
}

type LocationStatus = 'in-studio' | 'at trunk show' | 'away';
type TimePeriod = 'today' | '7' | '14' | '30' | 'all';

// Close-size matching state per requested style — 'exact' and 'close' are not
// mutually exclusive in what's collected (both arrays are always populated),
// but matchState reflects the best available state for the summary badge.
// An exact match, when present, must remain visible even if close alternatives
// also exist — see StyleMatch rendering in RiskCard.
type MatchState = 'exact' | 'close' | 'none';
interface StyleMatch {
  styleId: string;
  style: string; // DF Styles record's Style Name — display label
  matchState: MatchState;
  exactMatches: Record[];  // distance === 0, in-studio first
  closeMatches: Record[];  // 0 < distance <= CLOSE_SIZE_THRESHOLD, in-studio first
  bestSample: Record | null; // exactMatches[0] ?? closeMatches[0] — used to open the detail modal
  anySample: Record | null;  // any linked sample (any status/distance) — modal fallback when there's no stock
  inStudio: boolean; // true if bestSample is in-studio (kept for the existing "not in studio" summary line)
  distance: number | null; // distance of bestSample, if any
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
// Size → numeric position on the matching axis. European sizes are their own
// axis (35–42) and never cross-match against the US/letter axis.
const SIZE_ORDER: Record<string, number> = {
  'OS': 0, 'XS': 0, '0': 0,
  '2': 2,
  '4': 4, 'S': 4,
  '6': 6,
  '8': 8, 'M': 8,
  '10': 10,
  '12': 12, 'L': 12,
  '14': 14, 'XL': 14,
  '16': 16, 'XXL': 16,
  '35': 35, '36': 36, '37': 37, '38': 38, '38.5': 38.5,
  '39': 39, '39.5': 39.5, '40': 40, '41': 41, '42': 42,
};
const CLOSE_SIZE_THRESHOLD = 1; // ±1 step on the numeric axis
function sizeToNumber(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  if (t in SIZE_ORDER) return SIZE_ORDER[t];
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
function getLocationValue(r: Record): string | null {
  const v = r.getCellValue(FIELD_IDS.SAMPLE.LOCATION);
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'name' in (v as object)) return (v as any).name;
  return null;
}
// Effective style name for search/sort/display/alert-matching — mirrors the
// LABEL formula's own precedence (Parent Style Name, falling back to Style
// Name Legacy). Samples created via the Parent Style picker never populate
// Style Name Legacy, so any code that read that field directly would treat
// every new sample as nameless/unmatched. Use this everywhere instead of
// reading FIELD_IDS.SAMPLE.STYLE_NAME_LEGACY on its own.
function getEffectiveStyleName(r: Record): string {
  return r.getCellValueAsString(FIELD_IDS.SAMPLE.PARENT_STYLE_NAME) || r.getCellValueAsString(FIELD_IDS.SAMPLE.STYLE_NAME_LEGACY);
}
// Status choice names/colors are read live from the field itself (not
// hardcoded), so they stay correct if choices are added/recolored later.
// The SELECTED chip shows the choice's real Airtable color; the open
// dropdown list itself is always brand-colored, regardless of choice.
const AIRTABLE_COLOR_HEX: Record<string, string> = {
  blueBright: '#2D7FF9',   blueLight1: '#2D7FF9',   blueLight2: '#2D7FF9',   blueDark1: '#1D4FBC',
  cyanBright: '#18BFFF',   cyanLight1: '#18BFFF',   cyanLight2: '#18BFFF',   cyanDark1: '#0D8EBD',
  tealBright: '#06A09B',   tealLight1: '#06A09B',   tealLight2: '#06A09B',   tealDark1: '#06A09B',
  greenBright: '#0B7D2C',  greenLight1: '#0B7D2C',  greenLight2: '#0B7D2C',  greenDark1: '#0B7D2C',
  yellowBright: '#B87503', yellowLight1: '#B87503', yellowLight2: '#B87503', yellowDark1: '#B87503',
  orangeBright: '#CC3D00', orangeLight1: '#CC3D00', orangeLight2: '#CC3D00', orangeDark1: '#CC3D00',
  redBright: '#BA1E45',    redLight1: '#BA1E45',    redLight2: '#BA1E45',    redDark1: '#BA1E45',
  pinkBright: '#B2158B',   pinkLight1: '#B2158B',   pinkLight2: '#B2158B',   pinkDark1: '#B2158B',
  purpleBright: '#6B1FBF', purpleLight1: '#6B1FBF', purpleLight2: '#6B1FBF', purpleDark1: '#6B1FBF',
  grayBright: '#444466',   grayLight1: '#444466',   grayLight2: '#444466',   grayDark1: '#444466',
};
function getFieldChoices(field: Field | null | undefined): Array<{ name: string; color?: string }> {
  if (!field) return [];
  try {
    return ((field as unknown as { options?: { choices?: Array<{ name: string; color?: string }> } })
      .options?.choices ?? []);
  } catch { return []; }
}
function getChoiceColorMap(field: Field | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of getFieldChoices(field)) map[c.name] = c.color ? (AIRTABLE_COLOR_HEX[c.color] ?? '#9CA3AF') : '#9CA3AF';
  return map;
}
function getChoiceNames(field: Field | null | undefined): string[] {
  return getFieldChoices(field).map(c => c.name);
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
function alertTypeLabel(alert: RiskAlert): string {
  if (alert.missingData === 'no-styles') return 'No styles on file';
  if (alert.missingData === 'no-size') return 'Client size missing';
  return 'Style not in studio';
}

// ─── CHEVRON / CHECK ICONS ────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <CaretDownIcon
      size={14}
      style={{ flexShrink: 0, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
    />
  );
}
function Checkmark({ color }: { color: string }) {
  return <CheckIcon size={14} color={color} />;
}

// ─── FILTER DROPDOWN (multi-select, matches reference interface style) ─────────
interface FilterDropdownProps {
  label: string;
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  tok: Tok;
  minWidth?: number;
  accentOnActive?: boolean; // false keeps the trigger neutral-colored even when a value is applied
}
const FILTER_MIN_WIDTH = 140; // uniform width for every filter dropdown (except the search box)
function FilterDropdown({ label, values, options, onChange, tok, minWidth = FILTER_MIN_WIDTH, accentOnActive = true }: FilterDropdownProps) {
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

  const display = values.length === 1 ? values[0] : `${values.length} selected`;

  const isActive = values.length > 0;
  const showAccent = isActive && accentOnActive;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div ref={ref} style={{ position: 'relative' }}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
            minWidth, background: tok.surface,
            border: `1px solid ${showAccent ? tok.accent : tok.border}`,
            borderRadius: '8px', padding: '5px 10px',
            fontSize: '12px', color: showAccent ? tok.accent : tok.text_muted,
            fontWeight: showAccent ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'border-color 0.15s',
          }}
        >
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
            color: showAccent ? tok.accent : tok.text_muted,
          }}>
            {isActive ? display : label}
          </span>
          {isActive && (
            <XIcon
              size={14}
              onClick={e => { e.stopPropagation(); onChange([]); }}
              style={{ flexShrink: 0, cursor: 'pointer' }}
            />
          )}
          <Chevron open={open} />
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: Math.max(minWidth, 160), padding: '4px 0',
          }}>
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
  baselineKey?: string; // key that represents "no filter applied" (shows label as placeholder)
  accentOnActive?: boolean; // false keeps the trigger neutral-colored even when a value is applied
}
function SingleSelectDropdown({ label, value, options, onChange, tok, minWidth = FILTER_MIN_WIDTH, baselineKey, accentOnActive = true }: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.key === value);
  const display = selected?.label ?? 'All';
  const isActive = baselineKey !== undefined && value !== baselineKey;
  const showAccent = isActive && accentOnActive;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
            minWidth, background: tok.surface,
            border: `1px solid ${showAccent ? tok.accent : tok.border}`,
            borderRadius: '8px', padding: '5px 10px',
            fontSize: '12px', color: showAccent ? tok.accent : tok.text_primary,
            fontWeight: showAccent ? 600 : 400,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'border-color 0.15s',
          }}
        >
          <span style={{ color: showAccent ? tok.accent : tok.text_muted }}>
            {baselineKey !== undefined && !isActive ? label : display}
          </span>
          {isActive && baselineKey !== undefined && (
            <XIcon
              size={14}
              onClick={e => { e.stopPropagation(); onChange(baselineKey); }}
              style={{ flexShrink: 0, cursor: 'pointer' }}
            />
          )}
          <Chevron open={open} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
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
        zIndex: 60,
        maxHeight: Math.min(idealHeight, spaceBelow),
        overflowY: 'auto',
      });
    }
    setOpen(o => !o);
  };

  const baseListStyle = {
    background: tok.surface, border: `1px solid ${tok.border}`,
    borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '3px 0',
  };
  const listStyle: React.CSSProperties = escapeModal
    ? { ...dropdownStyle, ...baseListStyle }
    : {
        position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 20,
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

// ─── STATUS CHIP (table) — editable. The SELECTED chip uses the choice's
// real Airtable color; the open dropdown list itself is always brand-colored
// (text only, no color dots) regardless of each choice's Airtable color ─────
function StatusChip({ value, options, colorMap, canWrite, onChange, tok }: {
  value: string | null; options: string[]; colorMap: Record<string, string>;
  canWrite: boolean; onChange: (v: string) => void; tok: Tok;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const hex = value ? (colorMap[value] ?? '#9CA3AF') : null;
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
      <span
        onClick={() => canWrite && setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '999px',
          background: hex ? hex + '20' : tok.badge_away, color: hex ?? tok.badge_away_text,
          fontSize: '11px', fontWeight: 600, border: `1px solid ${hex ? hex + '55' : 'transparent'}`,
          cursor: canWrite ? 'pointer' : 'default',
        }}
      >
        {value || '—'}
      </span>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30,
          background: tok.surface, border: `1px solid ${tok.border}`, borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: '120px',
        }}>
          {options.map(opt => {
            const isSel = opt === value;
            return (
              <div key={opt} onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  color: tok.accent, background: isSel ? tok.accent + '20' : 'transparent',
                  margin: '2px 6px', borderRadius: '6px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = tok.accent + '20'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSel ? tok.accent + '20' : 'transparent'; }}
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

// ─── STATUS FILLED SELECT (detail page) — same box style as other fields.
// The SELECTED value uses the choice's real Airtable color; the open
// dropdown list itself is always brand-colored, regardless of choice ────────
function StatusFilledSelect({ value, options, colorMap, onChange, tok }: {
  value: string | null; options: string[]; colorMap: Record<string, string>;
  onChange: (v: string) => void; tok: Tok;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const hex = value ? (colorMap[value] ?? '#9CA3AF') : null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
          width: '100%', padding: '7px 10px', cursor: 'pointer',
          background: hex ? hex + '20' : tok.surface,
          border: `1px solid ${hex ? hex + '55' : tok.input_border}`,
          borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          color: hex ?? tok.text_muted,
          transition: 'border-color 0.15s',
        }}
      >
        <span>{value ?? 'Select…'}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 20,
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '3px 0',
        }}>
          {options.map(opt => {
            const isSel = opt === value;
            return (
              <div key={opt} onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  padding: '7px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  color: tok.accent, background: isSel ? tok.accent + '20' : 'transparent',
                  margin: '2px 6px', borderRadius: '6px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = tok.accent + '20'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSel ? tok.accent + '20' : 'transparent'; }}
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
      border: `1px solid ${s.color}20`,
    }}>
      {s.label}
    </span>
  );
}

// ─── CONDITION BADGE (Sample Condition History) ──────────────────────────────
const CONDITION_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Good Condition':  { bg: '#D1FAE5', text: '#065F46' },
  'Damaged':         { bg: '#FEE2E2', text: '#991B1B' },
  'Needing Repair':  { bg: '#FEF3C7', text: '#92400E' },
};
// ─── IMAGE LIGHTBOX (in-app full-size preview, zoom/download/cycle) ───────────
// No delete action here, by design — Condition History is an append-only
// audit log (staff shouldn't be able to remove condition-check evidence
// from in-app), so this viewer only ever downloads/zooms/navigates.
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
interface ZoomableImageProps { src: string; alt?: string; }
function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => { setScale(1); setTx(0); setTy(0); }, [src]);

  // Pan with window-level listeners so movement stays 1:1 and never drops
  // frames when the pointer leaves the image while dragging.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      setTx(start.current.tx + (e.clientX - start.current.x));
      setTy(start.current.ty + (e.clientY - start.current.y));
    };
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging]);

  const clamp = (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
  const setZoom = (next: number) => {
    const ns = clamp(next);
    setScale(ns);
    if (ns === 1) { setTx(0); setTy(0); }
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Only zoom with Ctrl/Cmd held (trackpad pinch also reports ctrlKey) —
    // plain scroll should still scroll the page/modal, not hijack zoom.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(scale + (e.deltaY < 0 ? 0.35 : -0.35));
  };
  const onDoubleClick = () => setZoom(scale > 1 ? 1 : 2.5);
  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (scale <= 1) return;
    e.preventDefault();
    start.current = { x: e.clientX, y: e.clientY, tx, ty };
    setDragging(true);
  };

  const ctrlBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent',
    color: 'rgba(255,255,255,0.9)', cursor: 'pointer',
  };
  const zoomed = scale > 1;
  const SQUARE = 'min(90vw, 80vh)';

  return (
    <div
      onClick={e => e.stopPropagation()}
      onWheel={onWheel}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: '10px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', touchAction: 'none',
        display: zoomed ? 'flex' : 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...(zoomed ? { width: SQUARE, height: SQUARE } : {}),
      }}
    >
      <img
        src={src}
        alt={alt ?? ''}
        draggable={false}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        style={{
          display: 'block', objectFit: 'contain', userSelect: 'none',
          maxWidth: zoomed ? '100%' : 'min(90vw, 1200px)', maxHeight: zoomed ? '100%' : '80vh',
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: 'center center',
          cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
          transition: dragging ? 'none' : 'transform 0.12s ease-out',
        }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '2px', padding: '2px',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', borderRadius: '9px',
        }}
      >
        <button type="button" onClick={() => setZoom(scale - 0.5)} disabled={scale <= ZOOM_MIN} aria-label="Zoom out" style={{ ...ctrlBtnStyle, opacity: scale <= ZOOM_MIN ? 0.3 : 1 }}>
          <MagnifyingGlassMinusIcon size={16} />
        </button>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: 600, width: '42px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button type="button" onClick={() => setZoom(scale + 0.5)} disabled={scale >= ZOOM_MAX} aria-label="Zoom in" style={{ ...ctrlBtnStyle, opacity: scale >= ZOOM_MAX ? 0.3 : 1 }}>
          <MagnifyingGlassPlusIcon size={16} />
        </button>
        <button type="button" onClick={() => setZoom(1)} disabled={scale === 1} aria-label="Reset zoom" style={{ ...ctrlBtnStyle, opacity: scale === 1 ? 0.3 : 1 }}>
          <ArrowsOutIcon size={15} />
        </button>
      </div>
    </div>
  );
}

interface ImageLightboxImage { url: string; filename?: string; }
interface ImageLightboxProps {
  images: ImageLightboxImage[];
  startIndex: number;
  onClose: () => void;
  tok: Tok;
}
function ImageLightbox({ images, startIndex, onClose, tok }: ImageLightboxProps) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(images.length - 1, 0)));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) setIndex(i => i - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) setIndex(i => i + 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, index, images.length]);

  if (images.length === 0) return null;
  const current = images[index];

  const iconButtonStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: '8px 12px', borderRadius: '8px', border: 'none',
    background: 'rgba(255,255,255,0.12)', color: '#F5F0E8', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none',
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9800, padding: '16px',
        background: tok.overlay, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}
    >
      <button type="button" onClick={onClose} aria-label="Close" style={{ ...iconButtonStyle, position: 'absolute', top: '16px', right: '16px', padding: '8px' }}>
        <XIcon size={18} />
      </button>

      {index > 0 && (
        <button
          type="button"
          onClick={() => setIndex(i => i - 1)}
          aria-label="Previous"
          style={{ ...iconButtonStyle, position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', padding: '10px', borderRadius: '999px' }}
        >
          <CaretLeftIcon size={18} />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          type="button"
          onClick={() => setIndex(i => i + 1)}
          aria-label="Next"
          style={{ ...iconButtonStyle, position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', padding: '10px', borderRadius: '999px' }}
        >
          <CaretRightIcon size={18} />
        </button>
      )}

      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', maxWidth: '100%', maxHeight: '100%' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#F5F0E8', opacity: 0.9, maxWidth: '80vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {current.filename ?? 'Photo'}{images.length > 1 ? <span style={{ opacity: 0.6 }}> · {index + 1}/{images.length}</span> : null}
        </p>
        <ZoomableImage src={current.url} alt={current.filename ?? ''} />
        <a href={current.url} download={current.filename ?? 'photo'} style={{ ...iconButtonStyle, background: 'rgba(255,255,255,0.15)' }}>
          <DownloadSimpleIcon size={16} /> Download
        </a>
      </div>
    </div>
  );
}

function ConditionBadge({ value, tok }: { value: string | null; tok: Tok }) {
  const c = value ? (CONDITION_BADGE_COLORS[value] ?? { bg: tok.badge_away, text: tok.badge_away_text }) : null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '999px',
      background: c ? c.bg : tok.badge_away, color: c ? c.text : tok.badge_away_text,
      fontSize: '11px', fontWeight: 600,
    }}>
      {value || '—'}
    </span>
  );
}

// ─── SAMPLE DETAIL MODAL (editable per AC) ────────────────────────────────────
interface SampleDetailModalProps {
  base: ReturnType<typeof useBase>;
  record: Record;
  sampleTable: Table;
  statusFieldOptions: string[];
  statusColorMap: Record<string, string>;
  conditionFormUrl: string | null;
  onClose: () => void;
  tok: Tok;
}
function SampleDetailModal({ base, record, sampleTable, statusFieldOptions, statusColorMap, conditionFormUrl, onClose, tok }: SampleDetailModalProps) {
  // ── Read initial values ──
  const getStr = (fid: string) => record.getCellValueAsString(fid) || '';
  const getSingleSelectName = (fid: string): string | null => {
    const v = record.getCellValue(fid);
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && 'name' in (v as object)) return (v as any).name;
    return null;
  };

  const label      = getStr(FIELD_IDS.SAMPLE.LABEL) || getStr(FIELD_IDS.SAMPLE.PARENT_STYLE_NAME) || getStr(FIELD_IDS.SAMPLE.STYLE_NAME_LEGACY);
  const getRecordLinkId = (fid: string): string | null => {
    const v = record.getCellValue(fid) as Array<{ id: string }> | null;
    return v && v.length > 0 ? v[0].id : null;
  };
  const [parentStyleId, setParentStyleId] = useState<string | null>(getRecordLinkId(FIELD_IDS.SAMPLE.PARENT_STYLE));
  const [size,      setSize]      = useState<string | null>(getSingleSelectName(FIELD_IDS.SAMPLE.SIZE));
  const [type,      setType]      = useState<string | null>(getSingleSelectName(FIELD_IDS.SAMPLE.TYPE));
  const [locVal,    setLocVal]    = useState<string | null>(getLocationValue(record));
  const [notes,     setNotes]     = useState(getStr(FIELD_IDS.SAMPLE.NOTES));
  const [statusVal, setStatusVal] = useState<string | null>(getSingleSelectName(FIELD_IDS.SAMPLE.STATUS));

  const canWrite = sampleTable.hasPermissionToUpdateRecords?.() ?? true;

  // ── Parent Style options (DF Styles) — same source/pattern as AddSampleModal.
  // Constrained to is_parent_style records, except the sample's own currently-linked
  // style is always kept in the list (even if not a parent) so an existing link
  // never renders blank/unlabeled when reopening this modal. ──
  const dfStylesTable = base.getTableByIdIfExists(TABLE_IDS.DF_STYLES);
  const dfStylesRecords = useRecords(dfStylesTable ?? null);
  const styleOptions: RecordOption[] = useMemo(() => {
    if (!dfStylesRecords) return [];
    return dfStylesRecords
      .filter(r => r.getCellValue(FIELD_IDS.DF_STYLES.IS_PARENT_STYLE) === true || r.id === parentStyleId)
      .map(r => ({ id: r.id, label: r.getCellValueAsString(FIELD_IDS.DF_STYLES.STYLE_NAME) || '(untitled)' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [dfStylesRecords, parentStyleId]);

  // ── Condition History (authoritative "current condition" — computed here
  // from Sample Condition History sorted by Logged At, NOT from the rollup) ──
  const conditionHistoryTable = base.getTableByIdIfExists(TABLE_IDS.CONDITION_HISTORY);
  const conditionHistoryRecords = useRecords(conditionHistoryTable ?? null);
  const conditionHistory = useMemo(() => {
    if (!conditionHistoryRecords) return [];
    return conditionHistoryRecords
      .filter(r => {
        const links = r.getCellValue(FIELD_IDS.CONDITION_HISTORY.SAMPLE_LINK) as Array<{ id: string }> | null;
        return !!links?.some(l => l.id === record.id);
      })
      .sort((a, b) => {
        const aT = (a.getCellValue(FIELD_IDS.CONDITION_HISTORY.LOGGED_AT) as string) ?? '';
        const bT = (b.getCellValue(FIELD_IDS.CONDITION_HISTORY.LOGGED_AT) as string) ?? '';
        return bT.localeCompare(aT); // most recent first
      });
  }, [conditionHistoryRecords, record.id]);

  // ── Lightbox state — clicking a Condition History attachment thumbnail
  // opens the in-app preview instead of a new browser tab ──
  const [lightboxImages, setLightboxImages] = useState<{ images: Array<{ url: string; filename?: string }>; startIndex: number } | null>(null);

  // Airtable Form prefill query params are keyed by the field's live display
  // name (e.g. `prefill_sample`), not its field ID — read it from the field
  // itself rather than hardcoding "Sample"/"sample", so a future rename of
  // this field doesn't silently break the prefill link.
  const conditionHistorySampleField = conditionHistoryTable?.getFieldIfExists(FIELD_IDS.CONDITION_HISTORY.SAMPLE_LINK) ?? null;
  const conditionHistorySampleFieldName = conditionHistorySampleField?.name ?? 'sample';
  const conditionFormFullUrl = conditionFormUrl
    ? `${conditionFormUrl}?prefill_${encodeURIComponent(conditionHistorySampleFieldName)}=${record.id}&hide_${encodeURIComponent(conditionHistorySampleFieldName)}=true`
    : null;

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
  const handleStatus = (val: string) => {
    setStatusVal(val);
    save({ [FIELD_IDS.SAMPLE.STATUS]: { name: val } });
  };
  const handleParentStyle = (id: string) => {
    setParentStyleId(id);
    save({ [FIELD_IDS.SAMPLE.PARENT_STYLE]: [{ id }] });
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
      fontSize: '11px', fontWeight: 700, color: tok.text_muted,
      letterSpacing: '0.07em', marginBottom: '5px',
    }}>
      {children}
    </div>
  );

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: tok.overlay, backdropFilter: 'blur(3px)',
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
            fontSize: '11px', fontWeight: 700, color: tok.text_muted,
            letterSpacing: '0.07em', marginBottom: '6px',
          }}>
            Sample
          </div>
          {/* Title + status chip inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: tok.text_primary, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {label}
            </div>
            <LocationBadge status={status} tok={tok} />
            <button
              type="button"
              onClick={() => { if (conditionFormFullUrl) window.open(conditionFormFullUrl, '_blank'); }}
              disabled={!conditionFormFullUrl}
              style={{
                marginLeft: 'auto', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                borderRadius: '999px', cursor: conditionFormFullUrl ? 'pointer' : 'not-allowed',
                border: `1px solid ${tok.border}`, background: 'transparent', color: tok.text_secondary,
                opacity: conditionFormFullUrl ? 1 : 0.5,
              }}
            >
              Register Condition
            </button>
          </div>
          {!conditionFormFullUrl && (
            <div style={{ fontSize: '11px', color: tok.text_muted, marginTop: '6px' }}>
              Condition form link not configured yet.
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Parent Style — full-width row (record picker over DF Styles; the
              legacy free-text Style Name field is no longer shown/editable here) */}
          <div>
            <FieldLabel>Parent Style</FieldLabel>
            {canWrite ? (
              <RecordSelect
                value={parentStyleId}
                options={styleOptions}
                onChange={handleParentStyle}
                placeholder="Select a style…"
                tok={tok}
                escapeModal
              />
            ) : (
              <div style={{ fontSize: '13px', color: tok.text_primary }}>
                {styleOptions.find(o => o.id === parentStyleId)?.label ?? '—'}
              </div>
            )}
          </div>

          {/* Status + Location — row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <FieldLabel>Status</FieldLabel>
              {canWrite
                ? <StatusFilledSelect value={statusVal} options={statusFieldOptions} colorMap={statusColorMap} onChange={handleStatus} tok={tok} />
                : <div style={{ fontSize: '13px', color: tok.text_primary }}>{statusVal ?? '—'}</div>
              }
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: tok.text_muted, letterSpacing: '0.07em' }}>Location</div>
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

          {/* Condition History — computed from Sample Condition History, sorted
              by Logged At; the rollup on Sample Log is best-effort only and
              NOT used here as the source of truth ── */}
          <div>
            <FieldLabel>Condition History</FieldLabel>
            {conditionHistory.length === 0 ? (
              <div style={{ fontSize: '12px', color: tok.text_muted, fontStyle: 'italic' }}>
                No condition history yet.
              </div>
            ) : (
              <div style={{ border: `1px solid ${tok.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '92px 1fr 1.4fr 48px',
                  padding: '6px 10px', background: tok.surface_alt,
                  fontSize: '10px', fontWeight: 700, color: tok.text_muted, letterSpacing: '0.06em',
                }}>
                  <div>DATE</div>
                  <div>CONDITION</div>
                  <div>NOTES</div>
                  <div>PHOTO</div>
                </div>
                {conditionHistory.map((h, idx) => {
                  const photos = (h.getCellValue(FIELD_IDS.CONDITION_HISTORY.PHOTO) as Array<{ id?: string; url: string; filename: string }> | null) ?? [];
                  const noteStr = h.getCellValueAsString(FIELD_IDS.CONDITION_HISTORY.NOTES);
                  return (
                    <div
                      key={h.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '92px 1fr 1.4fr 48px',
                        alignItems: 'center', gap: '4px', padding: '8px 10px',
                        borderTop: idx === 0 ? 'none' : `1px solid ${tok.border}`,
                        background: idx === 0 ? tok.row_hover : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: tok.text_secondary }}>
                        {fmtDate((h.getCellValue(FIELD_IDS.CONDITION_HISTORY.LOGGED_AT) as string) ?? '')}
                      </div>
                      <div>
                        <ConditionBadge value={h.getCellValueAsString(FIELD_IDS.CONDITION_HISTORY.CONDITION) || null} tok={tok} />
                      </div>
                      <div style={{ fontSize: '11px', color: noteStr ? tok.text_secondary : tok.text_muted }}>
                        {noteStr ? truncate(noteStr, 60) : '—'}
                      </div>
                      <div>
                        {photos.length > 0 ? (
                          <img
                            src={photos[0].url}
                            alt={photos[0].filename}
                            onClick={() => setLightboxImages({
                              images: photos.map(p => ({ url: p.url, filename: p.filename })),
                              startIndex: 0,
                            })}
                            style={{
                              width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover',
                              border: `1px solid ${tok.border}`, cursor: 'pointer',
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '13px', color: tok.text_muted }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
      {lightboxImages && (
        <ImageLightbox
          images={lightboxImages.images}
          startIndex={lightboxImages.startIndex}
          onClose={() => setLightboxImages(null)}
          tok={tok}
        />
      )}
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
  const dfStylesTable = base.getTableByIdIfExists(TABLE_IDS.DF_STYLES);
  const resourcesTable = base.getTableByIdIfExists(TABLE_IDS.RESOURCES);

  const sampleRecords = useRecords(sampleTable ?? null);
  const apptRecords   = useRecords(apptTable ?? null);
  const clientRecords = useRecords(clientTable ?? null);
  const dfStylesRecords = useRecords(dfStylesTable ?? null);
  // useRecords — fall back to sampleTable to keep hook count stable
  const _resourcesRaw    = useRecords(resourcesTable ?? sampleTable ?? null);
  const resourcesRecords = resourcesTable ? _resourcesRaw : null;

  // Condition Form URL (Sample Condition History) — resolved by resource
  // record NAME, live, since sandbox/production hold different URL values
  // on the same-named record. No hardcoded fallback: if the record isn't
  // found yet, or its URL field is blank, this is null and the "Register
  // Condition" button disables itself rather than opening a broken link.
  const conditionFormResource = resourcesRecords?.find(r => r.name === CONDITION_FORM_RESOURCE_NAME) ?? null;
  const fResourcesUrl = resourcesTable?.getFieldIfExists(RESOURCES_FIELD_IDS.URL) ?? null;
  const conditionFormUrl = (conditionFormResource && fResourcesUrl)
    ? (conditionFormResource.getCellValueAsString(fResourcesUrl) || null)
    : null;

  // ── Status field (real singleSelect) — options/colors read live so the
  // selected chip stays correct if choices are added/recolored later ──
  const statusField = useMemo(() => sampleTable ? sampleTable.getFieldIfExists(FIELD_IDS.SAMPLE.STATUS) : null, [sampleTable]);
  const statusFieldOptions = useMemo(() => getChoiceNames(statusField), [statusField]);
  const statusColorMap = useMemo(() => getChoiceColorMap(statusField), [statusField]);
  const canWriteTable = sampleTable?.hasPermissionToUpdateRecords?.() ?? true;
  const handleStatusChange = useCallback((record: Record, val: string) => {
    if (!sampleTable) return;
    queueWrite(() => sampleTable.updateRecordAsync(record.id, { [FIELD_IDS.SAMPLE.STATUS]: { name: val } }))
      .catch(err => console.error('[SampleTracker] status update error:', err));
  }, [sampleTable]);

  // ── Filter state ──
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [typeFilter,     setTypeFilter]     = useState<string[]>([]);
  const [sampleStatusFilter, setSampleStatusFilter] = useState<string[]>(['Active']);
  const [search,         setSearch]         = useState('');
  const [timePeriod,     setTimePeriod]     = useState<TimePeriod>('7');
  const [saFilter,       setSaFilter]       = useState<string[]>([]);
  const [alertTypeFilter, setAlertTypeFilter] = useState<string[]>([]);
  const [selectedSample, setSelectedSample] = useState<Record | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAddSampleModal, setShowAddSampleModal] = useState(false);

  // ── Inventory filter options — "Location" filters the derived
  // In Studio / Trunk Show / Away bucket (same field the badge reads) ──
  const locationOptions = useMemo(() => {
    if (!sampleRecords) return [];
    const s = new Set<string>();
    for (const r of sampleRecords) {
      const v = r.getCellValueAsString(FIELD_IDS.SAMPLE.LOCATION_BUCKET);
      if (v) s.add(v);
    }
    return Array.from(s).sort();
  }, [sampleRecords]);

  const typeOptions = useMemo(() => {
    if (!sampleRecords) return [];
    const s = new Set<string>();
    for (const r of sampleRecords) { const v = r.getCellValueAsString(FIELD_IDS.SAMPLE.TYPE); if (v) s.add(v); }
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
    { key: 'today', label: 'Today' },
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
        const locVal      = getLocationValue(r);
        const locationVal = r.getCellValueAsString(FIELD_IDS.SAMPLE.LOCATION_BUCKET);
        const typeVal     = r.getCellValueAsString(FIELD_IDS.SAMPLE.TYPE);
        const styleName   = getEffectiveStyleName(r);

        if (locationFilter.length > 0 && !locationFilter.includes(locationVal)) return false;
        if (typeFilter.length > 0 && !typeFilter.includes(typeVal)) return false;
        if (sampleStatusFilter.length > 0) {
          const statusVal = r.getCellValueAsString(FIELD_IDS.SAMPLE.STATUS);
          if (!sampleStatusFilter.includes(statusVal)) return false;
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
        return getEffectiveStyleName(a).localeCompare(getEffectiveStyleName(b));
      });
  }, [sampleRecords, locationFilter, typeFilter, sampleStatusFilter, search]);

  // ── Pre-index samples by their linked parent_style (DF Styles) record id —
  // avoids O(N²) scans and is the same link the Champion Match automation
  // reads. A sample with no parent_style link is excluded from both maps
  // (never a valid match candidate). ──
  const { activeSamplesByStyleId, anySamplesByStyleId } = useMemo(() => {
    const active = new Map<string, Record[]>();
    const any = new Map<string, Record[]>();
    if (!sampleRecords) return { activeSamplesByStyleId: active, anySamplesByStyleId: any };
    for (const sample of sampleRecords) {
      const links = sample.getCellValue(FIELD_IDS.SAMPLE.PARENT_STYLE) as Array<{ id: string }> | null;
      if (!links || links.length === 0) continue; // rule 6 — no parent-style link, not a candidate
      const styleId = links[0].id;
      if (!any.has(styleId)) any.set(styleId, []);
      any.get(styleId)!.push(sample);
      if (sample.getCellValueAsString(FIELD_IDS.SAMPLE.STATUS) === 'Active') {
        if (!active.has(styleId)) active.set(styleId, []);
        active.get(styleId)!.push(sample);
      }
    }
    return { activeSamplesByStyleId: active, anySamplesByStyleId: any };
  }, [sampleRecords]);

  // ── Risk alerts (future appointments, one per client) ──
  const { allAlerts, unevaluatedCount } = useMemo((): { allAlerts: RiskAlert[]; unevaluatedCount: number } => {
    if (!apptRecords || !clientRecords || !sampleRecords || !dfStylesRecords) return { allAlerts: [], unevaluatedCount: 0 };
    const today = todayStr();
    const clientMap = new Map<string, Record>();
    for (const c of clientRecords) clientMap.set(c.id, c);
    const styleNameById = new Map<string, string>();
    for (const s of dfStylesRecords) styleNameById.set(s.id, s.getCellValueAsString(FIELD_IDS.DF_STYLES.STYLE_NAME) || '(untitled)');

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

      // Favorite styles come from the client's real DF Styles link (same field
      // the Champion Match automation watches), not the appointment's text
      // lookup — so matching below is by record id, never by name substring.
      const favStyleLinks = clientRec
        ? (clientRec.getCellValue(FIELD_IDS.CLIENT.FAVORITE_STYLES) as Array<{ id: string }> | null)
        : null;
      const favStyleIds = favStyleLinks ? favStyleLinks.map(l => l.id) : [];

      // #3 — No styles on file: surface as incomplete-data alert
      if (favStyleIds.length === 0) {
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

      // Close-size matching per style: exact match (distance 0) always shown
      // when present; close alternatives (0 < distance <= CLOSE_SIZE_THRESHOLD)
      // shown alongside/instead; otherwise no-stock. Tiebreak: in-studio first.
      const styleMatches: StyleMatch[] = favStyleIds.map(styleId => {
        const styleName = styleNameById.get(styleId) ?? '(untitled)';
        const candidates = activeSamplesByStyleId.get(styleId) ?? [];
        const anySample = (anySamplesByStyleId.get(styleId) ?? [])[0] ?? null;

        const scored = candidates
          .map(sample => {
            const sSize = sizeToNumber(sample.getCellValueAsString(FIELD_IDS.SAMPLE.SIZE));
            const dist = (!sizeIsMissing && clientSize !== null && sSize !== null) ? Math.abs(clientSize - sSize) : null;
            const inStudioSample = deriveLocationStatus(getLocationValue(sample)) === 'in-studio';
            return { sample, dist, inStudioSample };
          })
          .sort((a, b) => {
            if (a.inStudioSample !== b.inStudioSample) return a.inStudioSample ? -1 : 1; // rule 8 tiebreak
            return 0;
          });

        const exactMatches = scored.filter(s => s.dist === 0).map(s => s.sample);
        const closeMatches = scored.filter(s => s.dist !== null && s.dist > 0 && s.dist <= CLOSE_SIZE_THRESHOLD).map(s => s.sample);

        const bestSample = exactMatches[0] ?? closeMatches[0] ?? null;
        const matchState: MatchState = exactMatches.length > 0 ? 'exact' : closeMatches.length > 0 ? 'close' : 'none';
        const bestScored = scored.find(s => s.sample === bestSample);

        return {
          styleId,
          style: styleName,
          matchState,
          exactMatches,
          closeMatches,
          bestSample,
          anySample: bestSample ?? anySample,
          inStudio: bestScored?.inStudioSample ?? false,
          distance: bestScored?.dist ?? null,
        };
      });

      if (!styleMatches.some(m => m.matchState === 'none') && !sizeIsMissing) continue;

      // If every style has stock (exact or close) but size is missing, still surface as incomplete
      if (!styleMatches.some(m => m.matchState === 'none') && sizeIsMissing) {
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
  }, [apptRecords, clientRecords, sampleRecords, dfStylesRecords, activeSamplesByStyleId, anySamplesByStyleId]);

  // ── Apply time period + SA filter ──
  const visibleAlerts = useMemo(() => {
    let filtered = allAlerts;

    // Time period
    if (timePeriod === 'today') {
      filtered = filtered.filter(a => a.daysUntil === 0);
    } else if (timePeriod !== 'all') {
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

    // Alert type filter
    if (alertTypeFilter.length > 0) {
      filtered = filtered.filter(a => alertTypeFilter.includes(alertTypeLabel(a)));
    }

    return filtered;
  }, [allAlerts, timePeriod, saFilter, alertTypeFilter]);

  const inputStyle: React.CSSProperties = {
    paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px',
    borderRadius: '8px', border: `1px solid ${search ? tok.accent : tok.border}`,
    background: tok.surface, color: tok.text_primary,
    fontSize: '12px', width: '221px', outline: 'none',
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
            <MagnifyingGlassIcon
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: tok.text_muted, pointerEvents: 'none' }}
            />
            <input
              type="text" placeholder="Search by style, location…" value={search}
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

          <FilterDropdown label="Location" values={locationFilter}     options={locationOptions}     onChange={setLocationFilter}     tok={tok} />
          <FilterDropdown label="Status"   values={sampleStatusFilter} options={statusFieldOptions}  onChange={setSampleStatusFilter} tok={tok} />
          <FilterDropdown label="Type"     values={typeFilter}         options={typeOptions}         onChange={setTypeFilter}         tok={tok} />

          {canWriteTable && sampleTable && (
            <button
              type="button"
              onClick={() => setShowAddSampleModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px',
                border: 'none', cursor: 'pointer',
                background: tok.accent, color: tok === DARK ? '#1B1813' : '#FFFFFF',
              }}
            >
              <PlusIcon size={13} weight="bold" /> Add Sample
            </button>
          )}
        </div>

        {/* Right 30%: alert filters — aligned with Sample Alerts panel */}
        <div style={{ width: '30%', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <FilterDropdown       label="Sales Associate" values={saFilter}        options={saOptions}         onChange={setSaFilter}        tok={tok} accentOnActive={false} />
          <FilterDropdown       label="Alert Type"       values={alertTypeFilter} options={ALERT_TYPE_OPTIONS} onChange={setAlertTypeFilter} tok={tok} accentOnActive={false} />
          <SingleSelectDropdown label="Period"            value={timePeriod}      options={TIME_OPTIONS}       onChange={v => setTimePeriod(v as TimePeriod)} tok={tok} baselineKey="all" accentOnActive={false} />
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: tok.text_muted, letterSpacing: '0.07em' }}>
              Sample Inventory
            </span>
            <span style={{ fontSize: '11px', color: tok.text_muted }}>·</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: tok.text_muted }}>{filteredSamples.length}</span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: tok.surface_alt, position: 'sticky', top: 0, zIndex: 10 }}>
                  {['Style', 'Location', 'Size', 'Type', 'Status', 'Notes'].map(col => (
                    <th key={col} style={{
                      padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px',
                      color: tok.text_muted, letterSpacing: '0.05em',
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
                        {truncate(getEffectiveStyleName(record), 28)}
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
                      <td style={{ padding: '7px 12px' }}>
                        <StatusChip
                          value={record.getCellValueAsString(FIELD_IDS.SAMPLE.STATUS) || null}
                          options={statusFieldOptions}
                          colorMap={statusColorMap}
                          canWrite={canWriteTable}
                          onChange={val => handleStatusChange(record, val)}
                          tok={tok}
                        />
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: tok.text_muted, letterSpacing: '0.07em' }}>
              Sample Alerts
            </span>
            <span style={{ fontSize: '11px', color: tok.text_muted }}>·</span>
            <span style={{
              fontSize: '11px', fontWeight: 600,
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
          base={base}
          record={selectedSample}
          sampleTable={sampleTable}
          statusFieldOptions={statusFieldOptions}
          statusColorMap={statusColorMap}
          conditionFormUrl={conditionFormUrl}
          onClose={() => setSelectedSample(null)}
          tok={tok}
        />
      )}

      {showAddSampleModal && sampleTable && (
        <AddSampleModal base={base} sampleTable={sampleTable} onClose={() => setShowAddSampleModal(false)} tok={tok} />
      )}

      <FeedbackButton onClick={() => setShowFeedbackModal(true)} tok={tok} />
      {showFeedbackModal && <FeedbackModal base={base} onClose={() => setShowFeedbackModal(false)} tok={tok} />}
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
              {alert.styleMatches.filter(m => m.matchState === 'none').length} style(s) with no suitable sample in stock
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
          <div style={{ fontSize: '11px', fontWeight: 700, color: tok.text_muted, letterSpacing: '0.05em', marginBottom: '5px' }}>
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
            // Exact match must remain visible even when close alternatives also
            // exist (rule 3). Alternates never claim the exact requested size
            // is available (rule 7) — labeled "Close size", not "In Studio".
            const alternates = m.matchState === 'exact' ? m.closeMatches : (m.matchState === 'close' ? m.closeMatches.slice(1) : []);
            const rowSample = m.bestSample ?? m.anySample;
            const isClickable = !!rowSample;
            const badge = m.matchState === 'exact'
              ? { text: 'Exact match', color: tok.badge_in_studio_text, bg: tok.badge_in_studio, border: 'transparent' }
              : m.matchState === 'close'
                ? { text: 'Close size', color: tok.badge_trunk_text, bg: tok.badge_trunk, border: 'transparent' }
                : { text: 'No stock', color: tok.risk_text, bg: tok.risk_bg, border: tok.risk_border };
            return (
              <div key={m.styleId} style={{ padding: '5px 0', borderBottom: `1px solid ${tok.border}` }}>
                <div
                  onClick={() => { if (rowSample) onSelectSample(rowSample); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isClickable ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = tok.surface_alt; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '12px', color: tok.text_primary, flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.style}{rowSample ? ` — ${rowSample.getCellValueAsString(FIELD_IDS.SAMPLE.SIZE) || '—'}` : ''}
                  </span>
                  <span
                    style={{
                      color: badge.color, background: badge.bg, padding: '1px 7px', borderRadius: '999px',
                      fontSize: '11px', fontWeight: 600, flexShrink: 0,
                      border: badge.border !== 'transparent' ? `1px solid ${badge.border}` : 'none',
                    }}
                  >
                    {badge.text}
                  </span>
                </div>
                {alternates.length > 0 && (
                  <div style={{ marginTop: '3px', paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {alternates.map(alt => (
                      <div
                        key={alt.id}
                        onClick={() => onSelectSample(alt)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = tok.surface_alt; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: '11px', color: tok.text_secondary }}>
                          Alt size {alt.getCellValueAsString(FIELD_IDS.SAMPLE.SIZE) || '—'}
                        </span>
                        <span style={{ color: tok.badge_trunk_text, background: tok.badge_trunk, padding: '1px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 600 }}>
                          Close size
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

initializeBlock({ interface: () => <SampleTracker /> });
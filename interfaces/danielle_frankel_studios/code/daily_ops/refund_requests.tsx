import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
  CellRenderer,
} from '@airtable/blocks/interface/ui';
import type { Table, Record as AirtableRecord, Field } from '@airtable/blocks/interface/models';
import {
  CaretDown as CaretDownIcon,
  CaretLeft as CaretLeftIcon,
  X as XIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Plus as PlusIcon,
  Warning as WarningIcon,
  ChatCircleText as ChatCircleTextIcon,
  Funnel as FunnelIcon,
} from '@phosphor-icons/react';

// ─── Champagne color system (BRANDING.md §1) ─────────────────────────────────
const LIGHT = {
  app_bg: '#F8F5EE',
  surface: '#FFFFFF',
  border: '#E9E0CE',
  border_light: '#F1ECDF',
  text_primary: '#1A1612',
  text_secondary: '#6B6357',
  text_muted: '#9A9184',
  accent: '#D97706',
  accent_soft: '#FEF3C7',
  hover_bg: '#F8F5EE',
  // A visibly different tone from app_bg (which hover_bg matches exactly in
  // light mode) — kept for any future sandy-toned panel need, but per Axel's
  // 2026-09-02 follow-up the Detail Page's stage/info panel no longer uses
  // this: it now matches draft_orders.tsx's actual Summary/Refund Case panel
  // treatment (a `surface`/white card with a border), not this flat sandy
  // tone. See `surface` usage in DetailPage below.
  panel_bg: '#F5F0EB',
  // Table header/zebra-row tint (Axel, 2026-09-02): reuses
  // customization_requests.tsx's own header tone family (Tailwind
  // gray-50/gray-100 range) one notch darker (gray-100) so a zebra stripe at
  // customization's original gray-50 value has visible room to sit strictly
  // between the header and a plain white row — header > zebra > white.
  // Applied to refund_requests.tsx only for now; other files get this in a
  // later bulk pass per Axel.
  table_header: '#F3F4F6',
  table_zebra: '#F9FAFB',
};

const DARK = {
  app_bg: '#1B1813',
  surface: '#25211A',
  border: '#38322A',
  border_light: '#2E2A22',
  text_primary: '#F3EFE6',
  text_secondary: '#B8AF9F',
  text_muted: '#7E7566',
  accent: '#FBBF24',
  accent_soft: '#3A2E12',
  hover_bg: '#2E2A22',
  panel_bg: '#302D28',
  // Same header>zebra>white ordering as LIGHT, expressed as alpha-over-dark
  // (matches customization_requests.tsx's `dark:bg-white/5` header idiom) —
  // header at white/8, zebra at half that, white rows fall through to
  // `surface` underneath with no overlay.
  table_header: 'rgba(255,255,255,0.08)',
  table_zebra: 'rgba(255,255,255,0.04)',
};

type Tokens = typeof LIGHT;

const SEMANTIC = {
  danger: {
    bg: 'bg-red-50 dark:bg-red-500/15',
    text: 'text-red-600 dark:text-red-300',
    border: 'border-red-200 dark:border-red-500/30',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-500/15',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-500/30',
  },
};

function useTheme(): 'light' | 'dark' {
  const { colorScheme } = useColorScheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorScheme === 'dark');
  }, [colorScheme]);
  return colorScheme;
}

function useTokens(): Tokens {
  const theme = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}

// ─── Field IDs (refund_requests, tbl1A5lbdJxUREOPO) ──────────────────────────
const FIELD_IDS = {
  CASE_NAME: 'fldliFXL9ZpsM6TgG',
  CLIENT: 'fldH0VFOEMWk7ly6l',
  ORDER: 'fldPJ9JwERMtCG0zq',
  ORDER_ITEMS: 'fldPUFTmSZ01vwHfp',
  REFUND_REASON: 'fldcrNKuzj4wbulVQ',
  REFUND_CATEGORY: 'fldjtOVzR8t0imXfy',
  RESOLUTION_TYPE_PROPOSED: 'fldVSbEmBpvZ1SEUE',
  RESOLUTION_TYPE_APPROVED: 'fldUnYp7Kv8vjYnk3',
  REQUEST_STAGE: 'fldtRq5M9XstW1FC1',
  SETTLEMENT_STAGE: 'fldkTiBPnBEygcwJ2',
  APPLIED_TO_DRAFT_ORDER: 'fldFZZQn2GYi1KQPb',
  CLIENT_EMAIL_SENT: 'fldSabMjiRSpNzufy',
  IS_PRODUCT_SPECIFIC: 'fldd0ROfwMvB1YIyq',
} as const;

const CATEGORY_FIELD_IDS = {
  CATEGORY_NAME: 'fldmp5TGQkMTMWHcN',
  ACTIVE: 'fldwB5zkVXjdS65VL',
} as const;

const ORDERS_TABLE_ID = 'tblHFGbijtvZcRPkE';
const ORDER_ITEMS_TABLE_ID = 'tblWOBS5nX0GZokaU';
const CLIENTS_TABLE_ID = 'tblLLUlDgJ4ktzF7c';
const DRAFT_ORDERS_TABLE_ID = 'tblp7foUmlN9823WW';

const ORDERS_FIELD_IDS = {
  CLIENT: 'fldeVnAInz9d1jpY5',
  SHOPIFY_ORDER_NUMBER: 'fldWiKEXjId411DQc',
  // Direct "Items" link on Orders - Shopify itself — distinct from the
  // order_items child table. Only used as a fallback label when an order has
  // no order_items records at all (per Axel, 2026-09-01).
  ITEMS: 'fldZHRtwkWdIWCrpF',
  // Rollup (unique values of order_items' `style`) living directly on the
  // order — replaces the old per-order .filter() over the whole order_items
  // table (which was O(orders×items), ~39M getCellValue calls, and hung the
  // page on every "New Refund Case" click / record open). Per Axel,
  // 2026-09-01: this field already returns only unique style names, so it's
  // now the sole source for the order label's item text — O(1) per order.
  ORDER_ITEMS_STYLE: 'fld38iuxvuEVYOhZ6',
  // Client's own pipeline `stage` (Clients table, tblLLUlDgJ4ktzF7c), looked
  // up here for readability — see CLIENTS_FIELD_IDS.STAGE for the real field.
} as const;

// An order_item's own primary field ("AM Order Item ID") is an internal
// numeric ID, not a display name — the product name lives on `style` (a link
// to DF Styles), falling back to `name_if_no_style` for style-less items like
// alterations charges (per Axel, 2026-09-01). Used per-row in the Order Items
// table (ID/Style/Amount) — the order-level label itself now reads the
// order_items_style rollup directly instead of scanning order_items.
function getOrderItemLabel(oi: AirtableRecord, styleField: Field | null, nameIfNoStyleField: Field | null): string {
  const styleLinked = styleField ? (oi.getCellValue(styleField) as Array<{ id: string; name?: string }> | null) : null;
  const styleNames = styleLinked?.map((l) => l.name ?? '').filter(Boolean).join(', ') ?? '';
  if (styleNames) return styleNames;
  return nameIfNoStyleField ? oi.getCellValueAsString(nameIfNoStyleField) : '';
}

// Order display label: "#<Shopify Order Number> — <item style names>", read
// straight off the order_items_style rollup (already unique-value text, no
// child-table scan needed) and falling back to the order's own "Items" link
// only when that rollup is empty (per Axel, 2026-09-01). Used everywhere an
// order is shown — the plain table/detail-page display and every Order picker.
function buildOrderLabel(
  order: AirtableRecord,
  shopifyNumberField: Field | null,
  itemsField: Field | null,
  orderItemsStyleField: Field | null
): string {
  const num = shopifyNumberField ? (order.getCellValue(shopifyNumberField) as number | null) : null;
  if (!num) return '—';
  const styleText = orderItemsStyleField ? order.getCellValueAsString(orderItemsStyleField) : '';
  const itemsText = styleText || (itemsField ? order.getCellValueAsString(itemsField) : '');
  return itemsText ? `#${num} — ${itemsText}` : `#${num}`;
}

// Rainbow chip palette for the `refund_category` linked-record field — there's
// no live Airtable choice color to read (it's a link, not a select), so per
// Axel's ask each active category cycles through Airtable's own real choice
// colors instead of a synthetic evenly-spread HSL hue — same
// background/font-color pairing as Airtable's native chips (BRANDING §9).
// Uses the Light1 tier (the picker's second row of tones, per Axel,
// 2026-09-01) — was Bright tier before that. Reused verbatim in
// draft_orders.tsx and sold_orders.tsx's read-only Refund Case panels.
const RAINBOW_PALETTE = [
  '#9CC7FF', // blueLight1
  '#71DCF5', // cyanLight1
  '#63E6D3', // tealLight1
  '#8AE28A', // greenLight1
  '#FFE07A', // yellowLight1
  '#FFC582', // orangeLight1
  '#FF9AA6', // redLight1
  '#FF9DEB', // pinkLight1
  '#C99BF5', // purpleLight1
  '#C6CBD1', // grayLight1
] as const;

function getRainbowHex(index: number): string {
  return RAINBOW_PALETTE[index % RAINBOW_PALETTE.length];
}

const ORDER_ITEMS_FIELD_IDS = {
  ORDER: 'fldXrdBFm5SeGCTvq',
  STYLE: 'fldL9rj7ZeDnjnXiY',
  NAME_IF_NO_STYLE: 'fld2Hzmni4fGcKAgh',
  AMOUNT: 'fldLT05tO5ep0WkyP',
} as const;

const CLIENTS_FIELD_IDS = {
  FULL_NAME: 'fldB3Wyam01D3wR5Q',
  // Client pipeline stage (Pre-Appointment...Fulfilled). Per Axel,
  // 2026-09-01: exclude clients whose stage is the terminal "Fulfilled"
  // choice from the New Refund Case / client-edit pickers — Axel confirmed
  // "Did Not Convert" should stay selectable. He also expects to rename this
  // choice's label from "Fulfilled" to "Closed" next week; matched by
  // CLIENT_STAGE_FULFILLED_CHOICE_ID (the choice's stable id) rather than its
  // display name so that rename doesn't silently break this filter.
  // Per Axel, 2026-09-02: reversed course — "Did Not Convert" clients must
  // ALSO be excluded from the client picker now. Matched by
  // CLIENT_STAGE_DID_NOT_CONVERT_CHOICE_ID (the choice's stable id) for the
  // same rename-proofing reason.
  STAGE: 'fldLcxVZvI1rigBlh',
} as const;

// The "Fulfilled" choice on Clients' `stage` field — Axel plans to rename its
// label to "Closed" next week, but its id survives a label rename (see
// CLIENTS_FIELD_IDS.STAGE comment above).
const CLIENT_STAGE_FULFILLED_CHOICE_ID = 'sel9gJfBcN2v0VLTc';

// The "Did Not Convert" choice on Clients' `stage` field — per Axel,
// 2026-09-02, clients in this stage must also be excluded from the client
// picker (previously only "Fulfilled" was excluded). Matched by stable id
// rather than display name so a future label rename doesn't silently break
// this filter (see CLIENTS_FIELD_IDS.STAGE comment above).
const CLIENT_STAGE_DID_NOT_CONVERT_CHOICE_ID = 'seljgOGavG7lL15Sl';

// ─── Feedback (table tbluy7JS31NwCoeIi) — same subsystem as draft_orders.tsx,
// minus Attachments (no attachment field/UI in this instance, per scope). ────
const FEEDBACK_TABLE_ID = 'tbluy7JS31NwCoeIi';
const FEEDBACK_FIELD_IDS = {
  FEEDBACK_TYPE: 'fldMQDSnEDDzqom2A',
  SCOPE: 'fldUpqoPn3ZM8mLck',
  INTERFACE_NAME: 'fldJZKIEJIRPOLIcW',
  PAGE_REPORTED: 'fldJJ7V9ANM7vQZhm',
  DESCRIPTION: 'fld6i3lCiI7ewp4BV',
} as const;
const FEEDBACK_TYPE_OPTIONS = ['Suggestion', 'Bug Report', 'Question', 'Praise'];
const FEEDBACK_SCOPE_OPTIONS = ['General', 'Specific Interface'];
const INTERFACE_INVENTORY_TABLE_ID = 'tblG92AI3ddzlolhz';
const INTERFACE_INVENTORY_FIELD_IDS = {
  NAME: 'flddp1ncA7BD0tacw',
  LEVEL: 'fldYFoQFVFLC1z7EW',
  INTERFACE_LINK: 'fldNDPWTrcNzSD5zS',
} as const;

let _feedbackWriteQueue = Promise.resolve();
function queueFeedbackWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = _feedbackWriteQueue.then(fn);
  _feedbackWriteQueue = next.then(() => {}, () => {});
  return next;
}

function FeedbackButton({ onClick, tok }: { onClick: () => void; tok: Tokens }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-4 right-20 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg text-white shadow-2xl transition-colors"
      style={{ zIndex: 9600, backgroundColor: tok.accent }}
    >
      <ChatCircleTextIcon size={16} /> Feedback
    </button>
  );
}

function FeedbackSelect({
  value,
  onChange,
  options,
  placeholder,
  tok,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; name: string }>;
  placeholder?: string;
  tok: Tokens;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);
  const selected = options.find((o) => o.id === value);
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full inline-flex items-center justify-between gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors"
        style={{ border: `1px solid ${tok.border}`, backgroundColor: tok.surface, color: selected ? tok.text_primary : tok.text_muted }}
      >
        <span className="truncate">{selected ? selected.name : placeholder ?? 'Select…'}</span>
        <CaretDownIcon size={14} className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: tok.text_muted }} />
      </button>
      {isOpen && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden"
          style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 20 }}
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm transition-colors truncate"
                style={
                  o.id === value
                    ? { backgroundColor: tok.accent_soft, color: tok.accent, fontWeight: 500 }
                    : { color: tok.text_primary }
                }
                onMouseEnter={(e) => { if (o.id !== value) e.currentTarget.style.backgroundColor = tok.hover_bg; }}
                onMouseLeave={(e) => { if (o.id !== value) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackModal({ base, onClose, tok }: { base: ReturnType<typeof useBase>; onClose: () => void; tok: Tokens }) {
  const [feedbackType, setFeedbackType] = useState('');
  const [scope, setScope] = useState('');
  const [interfaceId, setInterfaceId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const requestClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const interfaceInventoryTable = base.getTableByIdIfExists(INTERFACE_INVENTORY_TABLE_ID);
  const interfaceInventoryRecordsRaw = useRecords(interfaceInventoryTable ?? base.tables[0]);
  const interfaceInventoryRecords = interfaceInventoryTable ? interfaceInventoryRecordsRaw : [];
  const inventoryNameField = interfaceInventoryTable?.getFieldIfExists(INTERFACE_INVENTORY_FIELD_IDS.NAME) ?? null;
  const inventoryLevelField = interfaceInventoryTable?.getFieldIfExists(INTERFACE_INVENTORY_FIELD_IDS.LEVEL) ?? null;
  const inventoryInterfaceLinkField = interfaceInventoryTable?.getFieldIfExists(INTERFACE_INVENTORY_FIELD_IDS.INTERFACE_LINK) ?? null;

  const interfaceOptions = useMemo(() => {
    if (!inventoryNameField || !inventoryLevelField) return [];
    return (interfaceInventoryRecords ?? [])
      .filter((r) => ((r.getCellValue(inventoryLevelField) as { name: string } | null)?.name ?? '').toLowerCase() === 'interface')
      .map((r) => ({ id: r.id, name: (r.getCellValue(inventoryNameField) as string | null) ?? '(untitled)' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [interfaceInventoryRecords, inventoryNameField, inventoryLevelField]);

  const pageOptions = useMemo(() => {
    if (!inventoryNameField || !inventoryLevelField || !inventoryInterfaceLinkField || !interfaceId) return [];
    return (interfaceInventoryRecords ?? [])
      .filter((r) => {
        const isPage = ((r.getCellValue(inventoryLevelField) as { name: string } | null)?.name ?? '').toLowerCase() === 'page';
        if (!isPage) return false;
        const links = r.getCellValue(inventoryInterfaceLinkField) as Array<{ id: string }> | null;
        return !!links?.some((l) => l.id === interfaceId);
      })
      .map((r) => ({ id: r.id, name: (r.getCellValue(inventoryNameField) as string | null) ?? '(untitled)' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [interfaceInventoryRecords, inventoryNameField, inventoryLevelField, inventoryInterfaceLinkField, interfaceId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [requestClose]);

  const missingRequired =
    !feedbackType || !scope || !description.trim() || (scope === 'Specific Interface' && (!interfaceId || !pageId));

  const handleSubmit = async () => {
    if (missingRequired) return;
    const feedbackTable = base.getTableByIdIfExists(FEEDBACK_TABLE_ID);
    if (!feedbackTable) {
      setError('Feedback table not found');
      return;
    }
    setError(null);
    setSubmitting(true);
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
      await queueFeedbackWrite(() => feedbackTable.createRecordAsync(fields));
      requestClose();
    } catch (e: unknown) {
      console.error('Failed to submit feedback', e);
      setError(e instanceof Error ? e.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 9700, opacity: isVisible ? 1 : 0 }}
      onClick={requestClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden transition-[opacity,transform] duration-200 ease-out"
        style={{
          backgroundColor: tok.surface,
          border: `1px solid ${tok.border}`,
          maxWidth: '560px',
          maxHeight: '90vh',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.96)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: `1px solid ${tok.border}` }}>
          <h2 className="text-base font-semibold" style={{ color: tok.text_primary }}>
            Feedback
          </h2>
          <p className="text-sm mt-0.5" style={{ color: tok.text_secondary }}>
            Flag an issue or share an idea.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium capitalize tracking-wide mb-1" style={{ color: tok.text_secondary }}>
                Feedback Type <span className="text-red-400">*</span>
              </label>
              <FeedbackSelect value={feedbackType} onChange={setFeedbackType} options={FEEDBACK_TYPE_OPTIONS.map((o) => ({ id: o, name: o }))} tok={tok} />
            </div>
            <div>
              <label className="block text-[11px] font-medium capitalize tracking-wide mb-1" style={{ color: tok.text_secondary }}>
                Scope <span className="text-red-400">*</span>
              </label>
              <FeedbackSelect
                value={scope}
                onChange={(v) => {
                  setScope(v);
                  setInterfaceId(null);
                  setPageId(null);
                }}
                options={FEEDBACK_SCOPE_OPTIONS.map((o) => ({ id: o, name: o }))}
                tok={tok}
              />
            </div>
          </div>
          {scope === 'Specific Interface' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium capitalize tracking-wide mb-1" style={{ color: tok.text_secondary }}>
                  Interface <span className="text-red-400">*</span>
                </label>
                <FeedbackSelect
                  value={interfaceId ?? ''}
                  onChange={(v) => {
                    setInterfaceId(v || null);
                    setPageId(null);
                  }}
                  options={interfaceOptions}
                  tok={tok}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium capitalize tracking-wide mb-1" style={{ color: tok.text_secondary }}>
                  Page <span className="text-red-400">*</span>
                </label>
                <FeedbackSelect value={pageId ?? ''} onChange={(v) => setPageId(v || null)} options={pageOptions} tok={tok} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium capitalize tracking-wide mb-1" style={{ color: tok.text_secondary }}>
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              rows={6}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none transition-colors"
              style={{ border: `1px solid ${tok.border}`, backgroundColor: tok.surface, color: tok.text_primary }}
              placeholder="Please provide detailed feedback…"
            />
            <p className="text-[11px] mt-1 text-right" style={{ color: tok.text_muted }}>
              {description.length}/2000
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${tok.border}` }}>
          <button type="button" onClick={requestClose} className="px-3 py-1.5 rounded-lg text-sm transition-colors" style={{ color: tok.text_secondary }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={missingRequired || submitting}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:cursor-not-allowed"
            style={{ backgroundColor: missingRequired || submitting ? tok.text_muted : tok.accent }}
          >
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────
type ViewState =
  | { layer: 1; layout: 'requests' | 'review' }
  | { layer: 2; recordId: string; sourceLayout: 'requests' | 'review' };

interface NewCaseDraft {
  clientId: string | null;
  orderId: string | null;
  orderItemIds: string[];
  isProductSpecific: boolean;
  refundReason: string;
  categoryId: string | null;
  resolutionTypeProposed: string | null;
}

const emptyDraft: NewCaseDraft = {
  clientId: null,
  orderId: null,
  orderItemIds: [],
  isProductSpecific: false,
  refundReason: '',
  categoryId: null,
  resolutionTypeProposed: null,
};

function getCustomPropertiesConfig(base: ReturnType<typeof useBase>) {
  return [
    {
      key: 'refundRequestsTable',
      label: 'Refund requests',
      type: 'table' as const,
      defaultValue: base.getTableByIdIfExists('tbl1A5lbdJxUREOPO') ?? undefined,
    },
    {
      key: 'refundCategoriesTable',
      label: 'Refund categories',
      type: 'table' as const,
      defaultValue: base.getTableByIdIfExists('tblhbjY8Jh8KjqRf6') ?? undefined,
    },
  ];
}

function getFieldChoices(field: Field | null): Array<{ id: string; name: string; color?: string }> {
  if (!field) return [];
  const config = field.config;
  if (config.type === 'singleSelect' && config.options?.choices) {
    return config.options.choices.map((c: { id: string; name: string; color?: string }) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }));
  }
  return [];
}

// Airtable single-select choice-color name → hex. Resolved dynamically from the
// live field's own choices (never a hardcoded status→color map) per BRANDING §9.
// Full Airtable single-select color enum (Light2/Light1/Bright/Dark1 per hue) —
// the previous map only covered Light2+Dark1, so any field using a Light1 or
// Bright choice color (as request_stage/settlement_stage/resolution_type all
// do, live) silently fell through to the gray fallback. Complete map fixes it.
function getChoiceColorHex(color: string | undefined): string {
  const colorMap: Record<string, string> = {
    blueLight2: '#D1E2FF', blueLight1: '#9CC7FF', blueBright: '#2D7FF9', blueDark1: '#0B5FCC',
    cyanLight2: '#C6F0F9', cyanLight1: '#71DCF5', cyanBright: '#18BFFF', cyanDark1: '#0A94CC',
    tealLight2: '#C0F5E9', tealLight1: '#63E6D3', tealBright: '#00D2C4', tealDark1: '#00A99A',
    greenLight2: '#D3F5D3', greenLight1: '#8AE28A', greenBright: '#20C933', greenDark1: '#0E8A1F',
    yellowLight2: '#FEF3C7', yellowLight1: '#FFE07A', yellowBright: '#F6BE00', yellowDark1: '#B98900',
    orangeLight2: '#FEE4CC', orangeLight1: '#FFC582', orangeBright: '#FF9D00', orangeDark1: '#C77400',
    redLight2: '#FFDCE0', redLight1: '#FF9AA6', redBright: '#F94343', redDark1: '#C22B2B',
    pinkLight2: '#FEDDF6', pinkLight1: '#FF9DEB', pinkBright: '#FF08C2', pinkDark1: '#B90792',
    purpleLight2: '#EEE0FD', purpleLight1: '#C99BF5', purpleBright: '#8B46FF', purpleDark1: '#5C2CB0',
    grayLight2: '#EBEDF0', grayLight1: '#C6CBD1', grayBright: '#6B7280', grayDark1: '#41454D',
  };
  return colorMap[color ?? ''] ?? '#9CA3AF';
}

// ─── Shared Dropdown (BRANDING §5) ───────────────────────────────────────────
// One trigger behavior for filters and data fields alike: placeholder-as-name
// when empty, value + inline X-to-clear when set, accent border/text when active.
function Dropdown({
  placeholder,
  value,
  options,
  onChange,
  tok,
  clearable = true,
  triggerWidth,
}: {
  placeholder: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onChange: (val: string | null) => void;
  tok: Tokens;
  clearable?: boolean;
  triggerWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? null;
  const isActive = !!value;

  return (
    <div ref={ref} className="relative" style={{ width: triggerWidth ?? '160px' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{
          border: `1px solid ${isActive ? tok.accent : tok.border}`,
          backgroundColor: tok.surface,
          color: isActive ? tok.accent : tok.text_secondary,
        }}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        {isActive && clearable ? (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="flex-shrink-0"
          >
            <XIcon size={14} />
          </span>
        ) : (
          <CaretDownIcon size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-[240px] max-h-[260px] overflow-y-auto rounded-lg"
          style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={value === opt.value ? { color: tok.accent, backgroundColor: tok.accent_soft, fontWeight: 500 } : { color: tok.text_primary }}
              onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.backgroundColor = tok.hover_bg; }}
              onMouseLeave={(e) => { if (value !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Responsive filter grouping (matches pipeline.tsx's reference
// implementation, revised 2026-09-01 per Axel) ───────────────────────────────
interface FilterSpec {
  key: string;
  label: string; // also the group-panel row label and the sort key
  node: React.ReactNode;
  isActive: boolean;
}

// Studio always first, Wedding Date always last (not applicable here — no
// such filters exist yet — kept for parity with pipeline.tsx), everything
// else sorted by label length ascending.
function sortFiltersForDisplay(filters: FilterSpec[]): FilterSpec[] {
  const studio = filters.filter((f) => f.label === 'Studio');
  const weddingDate = filters.filter((f) => f.label === 'Wedding Date');
  const rest = filters
    .filter((f) => f.label !== 'Studio' && f.label !== 'Wedding Date')
    .sort((a, b) => a.label.length - b.label.length);
  return [...studio, ...rest, ...weddingDate];
}

const FILTER_BOX_WIDTH = 160;
const FILTER_GAP = 8;
const FILTER_GROUP_BUTTON_WIDTH = 36;

function useResponsiveFilterCount(totalItems: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(totalItems);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const compute = () => {
      const available = el.clientWidth;
      const allFit = totalItems * FILTER_BOX_WIDTH + Math.max(0, totalItems - 1) * FILTER_GAP;
      if (allFit <= available) {
        setVisibleCount(totalItems);
        return;
      }
      const forFilters = available - FILTER_GROUP_BUTTON_WIDTH - FILTER_GAP;
      const fit = Math.max(0, Math.floor((forFilters + FILTER_GAP) / (FILTER_BOX_WIDTH + FILTER_GAP)));
      setVisibleCount(Math.min(fit, totalItems));
    };
    compute();
    const ro = new ResizeObserver(() => requestAnimationFrame(compute));
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalItems]);

  return { containerRef, visibleCount };
}

// Every other control in this toolbar (search bar, filter Dropdowns, Show
// All, LayoutDropdown, New Refund Case) is `px-3 py-1.5 text-sm` with a 1px
// border, which renders at 34px tall. This button has no text baseline to
// pin that height by padding alone, so it's fixed to the same 34px directly
// instead (per Axel, 2026-09-01 — the whole toolbar row must share one
// height; this button must NOT be taller than the filters it groups).
// rounded-lg (matches the search bar's radius, not rounded-full); icon at
// 14px (one tier down from a standalone-icon's usual 16px); active state is
// a solid accent fill with a light icon — same pairing as the "New Refund
// Case" button, not an accent-tinted border+icon.
function FilterGroupButton({ filters, hasActive, tok }: { filters: FilterSpec[]; hasActive: boolean; tok: Tokens }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="More filters"
        className="flex items-center justify-center w-[34px] h-[34px] flex-shrink-0 rounded-lg transition-colors"
        style={
          hasActive
            ? { backgroundColor: tok.accent, border: 'none' }
            : { backgroundColor: tok.surface, border: `1px solid ${tok.border}` }
        }
      >
        <FunnelIcon
          size={14}
          weight={hasActive ? 'fill' : 'regular'}
          style={{ color: hasActive ? '#FFFFFF' : tok.text_secondary }}
        />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 right-0 rounded-lg"
          style={{ width: '280px', backgroundColor: tok.surface, border: `1px solid ${tok.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {/* No overflow-hidden here — same reason as ResponsiveFilterRow:
              each filter's own dropdown renders as a child popup, and
              clipping would cut those off too (per Axel, 2026-09-01). */}
          <div className="p-3 flex flex-col gap-3">
            {filters.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <span className="flex-shrink-0 text-sm" style={{ color: tok.text_secondary }}>
                  {f.label}
                </span>
                <div style={{ width: FILTER_BOX_WIDTH }}>{f.node}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResponsiveFilterRow({ filters, tok }: { filters: FilterSpec[]; tok: Tokens }) {
  const sorted = useMemo(() => sortFiltersForDisplay(filters), [filters]);
  const { containerRef, visibleCount } = useResponsiveFilterCount(sorted.length);
  const visible = sorted.slice(0, visibleCount);
  const grouped = sorted.slice(visibleCount);

  // No overflow-hidden here — visibleCount already guarantees rendered
  // content fits horizontally, and clipping would also cut off every
  // dropdown's popup (it renders as a child of this row).
  return (
    <div ref={containerRef} className="flex items-center gap-2 flex-1 min-w-0">
      {visible.map((f) => (
        <React.Fragment key={f.key}>{f.node}</React.Fragment>
      ))}
      {grouped.length > 0 && <FilterGroupButton filters={grouped} hasActive={grouped.some((f) => f.isActive)} tok={tok} />}
    </div>
  );
}

function LayoutDropdown({ value, onChange, tok }: { value: 'requests' | 'review'; onChange: (val: 'requests' | 'review') => void; tok: Tokens }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const labels: Record<'requests' | 'review', string> = { requests: 'Requests', review: 'Review' };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{ border: `1px solid ${tok.border}`, backgroundColor: tok.surface, color: tok.text_primary }}
      >
        <span>{labels[value]}</span>
        <CaretDownIcon size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: tok.text_muted }} />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 right-0 w-32 rounded-lg overflow-hidden"
          style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {(['requests', 'review'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="w-full text-center px-3 py-2 text-sm transition-colors"
              style={value === opt ? { color: tok.accent, backgroundColor: tok.accent_soft, fontWeight: 500 } : { color: tok.text_primary }}
            >
              {labels[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// StagePill — BRANDING §9 (revised 2026-09-01): solid bg = source field's own
// choice color, white text.
// `size` (Axel, 2026-09-02): the Detail Page's stage/info panel needs its
// chips one Tailwind tier larger than every other usage (table cells, the
// non-editable content column) — default stays `sm` (text-sm) everywhere
// that already existed; only the panel passes `size="lg"` (text-base).
function StagePill({ value, choices, size = 'sm' }: { value: string | null; choices: Array<{ name: string; color?: string }>; size?: 'sm' | 'lg' }) {
  const sizeCls = size === 'lg' ? 'text-base' : 'text-sm';
  if (!value) return <span className={sizeCls} style={{ color: '#9CA3AF' }}>—</span>;
  const choice = choices.find((c) => c.name === value);
  const hex = getChoiceColorHex(choice?.color);
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full ${sizeCls} font-medium text-[#1D1F25]`}
      style={{ backgroundColor: hex }}
    >
      {value}
    </span>
  );
}

// CategoryChip — refund_category is a linked record, not a select, so there's
// no live Airtable choice color to read. Per Axel's ask: hardcoded rainbow,
// spread evenly across however many active categories exist.
function CategoryChip({
  label,
  categoryId,
  orderedCategoryIds,
  size = 'sm',
}: {
  label: string | null;
  categoryId: string | null;
  orderedCategoryIds: string[];
  size?: 'sm' | 'lg';
}) {
  const sizeCls = size === 'lg' ? 'text-base' : 'text-sm';
  if (!label) return <span className={sizeCls} style={{ color: '#9CA3AF' }}>—</span>;
  const index = categoryId ? Math.max(0, orderedCategoryIds.indexOf(categoryId)) : 0;
  const hex = getRainbowHex(index);
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full ${sizeCls} font-medium text-[#1D1F25]`}
      style={{ backgroundColor: hex }}
    >
      {label}
    </span>
  );
}

function SearchablePicker({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  tok,
}: {
  label: string;
  placeholder: string;
  options: Array<{ id: string; label: string }>;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  tok: Tokens;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.id === value)?.label ?? null;
  const isActive = !!value;

  return (
    <div ref={ref} className="relative">
      <label className="text-[11px] capitalize tracking-wide font-medium mb-1.5 block" style={{ color: tok.text_secondary }}>
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center justify-between gap-1.5 rounded-lg px-3 py-2 text-sm text-left outline-none transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ border: `1px solid ${isActive ? tok.accent : tok.border}`, backgroundColor: tok.surface, color: isActive ? tok.text_primary : tok.text_muted }}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        {isActive ? (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="flex-shrink-0"
            style={{ color: tok.text_muted }}
          >
            <XIcon size={14} />
          </span>
        ) : (
          <CaretDownIcon size={14} className="flex-shrink-0" style={{ color: tok.text_muted }} />
        )}
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden max-h-60 flex flex-col"
          style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-3 py-2 text-sm outline-none bg-transparent"
            style={{ borderBottom: `1px solid ${tok.border}`, color: tok.text_primary }}
          />
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm" style={{ color: tok.text_muted }}>
                No results
              </div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full text-left px-3 py-2 text-sm transition-colors"
                style={value === opt.id ? { color: tok.accent, backgroundColor: tok.accent_soft, fontWeight: 500 } : { color: tok.text_primary }}
                onMouseEnter={(e) => { if (value !== opt.id) e.currentTarget.style.backgroundColor = tok.hover_bg; }}
                onMouseLeave={(e) => { if (value !== opt.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimplePicker({
  label,
  placeholder,
  options,
  value,
  onChange,
  tok,
}: {
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange: (val: string | null) => void;
  tok: Tokens;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? null;

  return (
    <div ref={ref} className="relative">
      <label className="text-[11px] capitalize tracking-wide font-medium mb-1.5 block" style={{ color: tok.text_secondary }}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-1.5 rounded-lg px-3 py-2 text-sm text-left outline-none transition-colors"
        style={{ border: `1px solid ${value ? tok.accent : tok.border}`, backgroundColor: tok.surface, color: value ? tok.text_primary : tok.text_muted }}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <CaretDownIcon size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: tok.text_muted }} />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden max-h-48"
          style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={value === opt.value ? { color: tok.accent, backgroundColor: tok.accent_soft, fontWeight: 500 } : { color: tok.text_primary }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCurrency(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// One row of the Order Items table below — id is the order_item record id
// (for add/remove), itemId is its own primary field ("AM Order Item ID",
// shown as-is since it's the only stable identifier customers/staff refer
// to), style is the same style-or-fallback text as getOrderItemLabel, amount
// is the order_item's own `amount` field (per Axel, 2026-09-01).
function buildOrderItemRow(
  oi: AirtableRecord,
  styleField: Field | null,
  nameIfNoStyleField: Field | null,
  amountField: Field | null
): { id: string; itemId: string; style: string; amount: number } {
  return {
    id: oi.id,
    itemId: oi.name ?? oi.id,
    style: getOrderItemLabel(oi, styleField, nameIfNoStyleField),
    amount: amountField ? ((oi.getCellValue(amountField) as number | null) ?? 0) : 0,
  };
}

// "This refund is product-specific" — still a plain checkbox field
// underneath (IS_PRODUCT_SPECIFIC), but rendered as a two-state toggle
// button per Axel's ask (2026-09-01): off reads "No, order-level", on reads
// "Yes, product-specific" — same accent-fill/light-icon pairing as every
// other active-state toggle in this file (BRANDING §9).
function ProductSpecificToggle({
  checked,
  onChange,
  disabled,
  tok,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  tok: Tokens;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={
        checked
          ? { backgroundColor: tok.accent, color: '#FFFFFF', border: 'none' }
          : { backgroundColor: tok.surface, color: tok.text_secondary, border: `1px solid ${tok.border}` }
      }
    >
      {checked ? 'Yes, product-specific' : 'No, order-level'}
    </button>
  );
}

// Search-to-add control for the Order Items table below. Per Axel
// (2026-09-01): never shows the current selection, just the "Select an
// order item" placeholder — already-selected items are excluded from the
// list so the same item can't be added twice.
function OrderItemSelectDropdown({
  options,
  onAdd,
  disabled,
  tok,
}: {
  options: Array<{ id: string; itemId: string; style: string }>;
  onAdd: (id: string) => void;
  disabled?: boolean;
  tok: Tokens;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return options.filter((o) => !s || o.style.toLowerCase().includes(s) || o.itemId.toLowerCase().includes(s));
  }, [options, search]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-1.5 rounded-lg px-3 py-1.5 text-sm text-left outline-none transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ border: `1px solid ${tok.border}`, backgroundColor: tok.surface, color: tok.text_muted }}
      >
        <span className="truncate">Select an order item</span>
        <CaretDownIcon size={14} className="flex-shrink-0" style={{ color: tok.text_muted }} />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden max-h-60 flex flex-col"
          style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-3 py-2 text-sm outline-none bg-transparent"
            style={{ borderBottom: `1px solid ${tok.border}`, color: tok.text_primary }}
          />
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm" style={{ color: tok.text_muted }}>
                No results
              </div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onAdd(opt.id);
                  setSearch('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm transition-colors"
                style={{ color: tok.text_primary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tok.hover_bg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* "# ID - style" format per Axel, 2026-09-02 */}
                {`#${opt.itemId}${opt.style ? ` - ${opt.style}` : ''}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Order Items breakdown table — same search-to-add-above/invoice-table-below
// pattern as customization_requests.tsx's LineItemsTable, but with this
// record's own columns (ID/Style/Amount) and the remove control as the LAST
// column instead of the first (per Axel, 2026-09-01). `disabled` hides the
// remove column entirely — used for the read-only detail view.
function OrderItemsTable({
  items,
  onRemove,
  disabled,
  tok,
}: {
  items: Array<{ id: string; itemId: string; style: string; amount: number }>;
  onRemove?: (id: string) => void;
  disabled?: boolean;
  tok: Tokens;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${tok.border}` }}>
      <table className="w-full">
        <thead style={{ backgroundColor: tok.table_header }}>
          <tr style={{ borderBottom: `1px solid ${tok.border}` }}>
            <th className="px-3 py-2 text-[11px] font-medium capitalize tracking-wide text-left" style={{ color: tok.text_secondary }}>ID</th>
            <th className="px-3 py-2 text-[11px] font-medium capitalize tracking-wide text-left" style={{ color: tok.text_secondary }}>Style</th>
            <th className="px-3 py-2 text-[11px] font-medium capitalize tracking-wide text-right" style={{ color: tok.text_secondary }}>Amount</th>
            {!disabled && <th className="px-3 py-2 w-8" />}
          </tr>
        </thead>
        <tbody>
          {/* Zebra striping (Axel, 2026-09-02): odd rows get `table_zebra`,
              even rows fall through to the container's white `surface` —
              header stays the darkest of the three tones (see tok.table_header
              above this row's background). */}
          {items.map((item, idx) => (
            <tr
              key={item.id}
              className="last:border-0"
              style={{ borderBottom: `1px solid ${tok.border_light}`, backgroundColor: idx % 2 === 1 ? tok.table_zebra : tok.surface }}
            >
              <td className="px-3 py-2.5 text-sm" style={{ color: tok.text_primary }}>{item.itemId}</td>
              <td className="px-3 py-2.5 text-sm" style={{ color: tok.text_primary }}>{item.style || '—'}</td>
              <td className="px-3 py-2.5 text-sm text-right" style={{ color: tok.text_secondary }}>{formatCurrency(item.amount)}</td>
              {!disabled && (
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onRemove?.(item.id)}
                    aria-label={`Remove ${item.itemId}`}
                    className="transition-colors"
                    style={{ color: tok.text_muted }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = tok.text_muted; }}
                  >
                    <XIcon size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── New Refund Case modal ────────────────────────────────────────────────────
function NewRefundCaseModal({
  draft,
  setDraft,
  onClose,
  onSubmit,
  clientsRecords,
  ordersRecords,
  orderItemsRecords,
  categoriesRecords,
  clientsTable,
  ordersTable,
  orderItemsTable,
  categoriesTable,
  resolutionTypeChoices,
  submitting,
  submitError,
  tok,
}: {
  draft: NewCaseDraft;
  setDraft: React.Dispatch<React.SetStateAction<NewCaseDraft>>;
  onClose: () => void;
  onSubmit: () => void;
  clientsRecords: readonly AirtableRecord[];
  ordersRecords: readonly AirtableRecord[];
  orderItemsRecords: readonly AirtableRecord[];
  categoriesRecords: readonly AirtableRecord[];
  clientsTable: Table | null;
  ordersTable: Table | null;
  orderItemsTable: Table | null;
  categoriesTable: Table | null;
  resolutionTypeChoices: Array<{ name: string }>;
  submitting: boolean;
  submitError: string | null;
  tok: Tokens;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const requestClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [requestClose]);

  const clientFullNameField = clientsTable?.getFieldIfExists(CLIENTS_FIELD_IDS.FULL_NAME);

  const ordersClientField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.CLIENT);
  const ordersShopifyNumberField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.SHOPIFY_ORDER_NUMBER) ?? null;
  const ordersItemsField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.ITEMS) ?? null;
  const ordersOrderItemsStyleField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.ORDER_ITEMS_STYLE) ?? null;
  const orderItemsOrderField = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.ORDER) ?? null;
  const orderItemsStyleField = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.STYLE) ?? null;
  const orderItemsNameIfNoStyleField = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.NAME_IF_NO_STYLE) ?? null;
  const orderItemsAmountField = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.AMOUNT) ?? null;

  // Only clients with at least one Shopify order, whose own pipeline stage
  // hasn't wrapped up, can start a refund case (per Axel, 2026-09-01).
  const clientIdsWithOrders = useMemo(() => {
    const set = new Set<string>();
    if (!ordersClientField) return set;
    for (const o of ordersRecords) {
      const linked = o.getCellValue(ordersClientField) as Array<{ id: string }> | null;
      linked?.forEach((l) => set.add(l.id));
    }
    return set;
  }, [ordersRecords, ordersClientField]);

  const clientStageField = clientsTable?.getFieldIfExists(CLIENTS_FIELD_IDS.STAGE) ?? null;

  const clientOptions = useMemo(() => {
    if (!clientFullNameField) return [];
    return clientsRecords
      .filter((r) => clientIdsWithOrders.has(r.id))
      .filter((r) => {
        if (!clientStageField) return true;
        const stageId = (r.getCellValue(clientStageField) as { id: string } | null)?.id ?? null;
        return stageId !== CLIENT_STAGE_FULFILLED_CHOICE_ID && stageId !== CLIENT_STAGE_DID_NOT_CONVERT_CHOICE_ID;
      })
      .map((r) => ({ id: r.id, label: (r.getCellValue(clientFullNameField) as string) ?? r.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clientsRecords, clientFullNameField, clientIdsWithOrders, clientStageField]);

  const orderOptions = useMemo(() => {
    if (!draft.clientId || !ordersClientField) return [];
    return ordersRecords
      .filter((r) => {
        const linked = r.getCellValue(ordersClientField) as Array<{ id: string }> | null;
        return linked?.some((l) => l.id === draft.clientId);
      })
      .map((r) => ({ id: r.id, label: buildOrderLabel(r, ordersShopifyNumberField, ordersItemsField, ordersOrderItemsStyleField) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ordersRecords, draft.clientId, ordersClientField, ordersShopifyNumberField, ordersItemsField, ordersOrderItemsStyleField]);

  const orderItemRows = useMemo(() => {
    if (!draft.orderId || !orderItemsOrderField) return [];
    return orderItemsRecords
      .filter((r) => {
        const linked = r.getCellValue(orderItemsOrderField) as Array<{ id: string }> | null;
        return linked?.some((l) => l.id === draft.orderId);
      })
      .map((r) => buildOrderItemRow(r, orderItemsStyleField, orderItemsNameIfNoStyleField, orderItemsAmountField));
  }, [orderItemsRecords, draft.orderId, orderItemsOrderField, orderItemsStyleField, orderItemsNameIfNoStyleField, orderItemsAmountField]);

  const orderItemDropdownOptions = useMemo(
    () =>
      orderItemRows
        .filter((r) => !draft.orderItemIds.includes(r.id))
        .sort((a, b) => a.style.localeCompare(b.style)),
    [orderItemRows, draft.orderItemIds]
  );
  const selectedOrderItemRows = useMemo(
    () => draft.orderItemIds.map((id) => orderItemRows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
    [draft.orderItemIds, orderItemRows]
  );

  // Whether the selected order has any order_items at all — if not, the
  // product-specific toggle has nothing to offer, so it's hidden entirely
  // in favor of a soft alert (per Axel, 2026-09-01).
  const selectedOrderHasItems = !draft.orderId || orderItemRows.length > 0;

  const categoryActiveField = categoriesTable?.getFieldIfExists(CATEGORY_FIELD_IDS.ACTIVE);

  const categoryOptions = useMemo(() => {
    return categoriesRecords
      .filter((r) => (categoryActiveField ? r.getCellValue(categoryActiveField) === true : true))
      .map((r) => ({ id: r.id, label: r.name ?? r.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesRecords, categoryActiveField]);

  const resolutionOptions = resolutionTypeChoices.map((c) => ({ value: c.name, label: c.name }));

  const canSubmit =
    draft.clientId &&
    draft.orderId &&
    draft.refundReason.trim() &&
    draft.categoryId &&
    draft.resolutionTypeProposed &&
    (!draft.isProductSpecific || draft.orderItemIds.length > 0);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 50, opacity: isVisible ? 1 : 0 }}
      onClick={requestClose}
    >
      <div
        className="rounded-2xl shadow-xl w-full mx-4 max-h-[90vh] overflow-y-auto transition-[opacity,transform] duration-200 ease-out"
        style={{
          backgroundColor: tok.surface,
          border: `1px solid ${tok.border}`,
          maxWidth: '560px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.96)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${tok.border}` }}>
          <h2 className="text-lg font-bold" style={{ color: tok.text_primary }}>
            New Refund Case
          </h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SearchablePicker
              label="Client"
              placeholder="Select a client..."
              options={clientOptions}
              value={draft.clientId}
              onChange={(id) => setDraft((d) => ({ ...d, clientId: id, orderId: null, orderItemIds: [], isProductSpecific: false }))}
              tok={tok}
            />
            <SearchablePicker
              label="Order"
              placeholder="Select an order..."
              options={orderOptions}
              value={draft.orderId}
              onChange={(id) => setDraft((d) => ({ ...d, orderId: id, orderItemIds: [], isProductSpecific: false }))}
              disabled={!draft.clientId}
              tok={tok}
            />
          </div>
          {selectedOrderHasItems ? (
            <>
              <div className="flex items-center gap-3">
                <ProductSpecificToggle
                  checked={draft.isProductSpecific}
                  onChange={(checked) => setDraft((d) => ({ ...d, isProductSpecific: checked, orderItemIds: checked ? d.orderItemIds : [] }))}
                  tok={tok}
                />
                {draft.isProductSpecific && (
                  <div className="flex-1">
                    <OrderItemSelectDropdown
                      options={orderItemDropdownOptions}
                      onAdd={(id) => setDraft((d) => ({ ...d, orderItemIds: [...d.orderItemIds, id] }))}
                      disabled={!draft.orderId}
                      tok={tok}
                    />
                  </div>
                )}
              </div>
              {draft.isProductSpecific && (
                <OrderItemsTable
                  items={selectedOrderItemRows}
                  onRemove={(id) => setDraft((d) => ({ ...d, orderItemIds: d.orderItemIds.filter((x) => x !== id) }))}
                  tok={tok}
                />
              )}
            </>
          ) : (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: tok.hover_bg, color: tok.text_secondary }}>
              This order has no item-level data on file — this refund will be treated as an order-level charge.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <SearchablePicker
              label="Refund Category"
              placeholder="Select a category..."
              options={categoryOptions}
              value={draft.categoryId}
              onChange={(id) => setDraft((d) => ({ ...d, categoryId: id }))}
              tok={tok}
            />
            <SimplePicker
              label="Proposed Resolution"
              placeholder="Select resolution type..."
              options={resolutionOptions}
              value={draft.resolutionTypeProposed}
              onChange={(val) => setDraft((d) => ({ ...d, resolutionTypeProposed: val }))}
              tok={tok}
            />
          </div>
          <div>
            <label className="text-[11px] capitalize tracking-wide font-medium mb-1.5 block" style={{ color: tok.text_secondary }}>
              Refund Details
            </label>
            <textarea
              value={draft.refundReason}
              onChange={(e) => setDraft((d) => ({ ...d, refundReason: e.target.value }))}
              placeholder="Enter refund details..."
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-colors"
              style={{ border: `1px solid ${tok.border}`, backgroundColor: tok.surface, color: tok.text_primary }}
            />
          </div>
          {submitError && <div className="text-sm text-red-500">{submitError}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: `1px solid ${tok.border}` }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:cursor-not-allowed"
            style={{ backgroundColor: canSubmit && !submitting ? tok.accent : tok.text_muted }}
          >
            {submitting ? 'Creating...' : 'Create Refund Case'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Small confirm dialog shared by Approve/Reject/Cancel/Mark as Closed — same
// fade+scale animation as every other floating modal (BRANDING §12).
function ConfirmDialog({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmColor,
  confirming,
  tok,
}: {
  title: string;
  children?: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor: string;
  confirming: boolean;
  tok: Tokens;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const requestClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 50, opacity: isVisible ? 1 : 0 }}
      onClick={requestClose}
    >
      <div
        className="rounded-2xl shadow-xl w-full mx-4 p-6 transition-[opacity,transform] duration-200 ease-out"
        style={{
          backgroundColor: tok.surface,
          border: `1px solid ${tok.border}`,
          maxWidth: '480px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.96)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: tok.text_primary }}>
          {title}
        </h3>
        {children}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={requestClose} className="px-3 py-1.5 rounded-lg text-sm transition-colors" style={{ color: tok.text_secondary }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:cursor-not-allowed"
            style={{ backgroundColor: confirming ? tok.text_muted : confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Page ──────────────────────────────────────────────────────────────
function DetailPage({
  record,
  refundRequestsTable,
  categoriesRecords,
  clientsRecords,
  ordersRecords,
  orderItemsRecords,
  clientsTable,
  ordersTable,
  orderItemsTable,
  categoriesTable,
  requestStageChoices,
  settlementStageChoices,
  resolutionTypeProposedChoices,
  resolutionTypeApprovedChoices,
  onGoBack,
  canUpdate,
  sourceLayout,
}: {
  record: AirtableRecord;
  refundRequestsTable: Table;
  categoriesRecords: readonly AirtableRecord[];
  clientsRecords: readonly AirtableRecord[];
  ordersRecords: readonly AirtableRecord[];
  orderItemsRecords: readonly AirtableRecord[];
  clientsTable: Table | null;
  ordersTable: Table | null;
  orderItemsTable: Table | null;
  categoriesTable: Table | null;
  requestStageChoices: Array<{ name: string; color?: string }>;
  settlementStageChoices: Array<{ name: string; color?: string }>;
  resolutionTypeProposedChoices: Array<{ name: string }>;
  resolutionTypeApprovedChoices: Array<{ name: string }>;
  onGoBack: () => void;
  canUpdate: boolean;
  sourceLayout: 'requests' | 'review';
}) {
  const tok = useTokens();

  const clientField = refundRequestsTable.getFieldIfExists(FIELD_IDS.CLIENT);
  const orderField = refundRequestsTable.getFieldIfExists(FIELD_IDS.ORDER);
  const orderItemsField = refundRequestsTable.getFieldIfExists(FIELD_IDS.ORDER_ITEMS);
  const refundReasonField = refundRequestsTable.getFieldIfExists(FIELD_IDS.REFUND_REASON);
  const categoryField = refundRequestsTable.getFieldIfExists(FIELD_IDS.REFUND_CATEGORY);
  const resolutionProposedField = refundRequestsTable.getFieldIfExists(FIELD_IDS.RESOLUTION_TYPE_PROPOSED);
  const resolutionApprovedField = refundRequestsTable.getFieldIfExists(FIELD_IDS.RESOLUTION_TYPE_APPROVED);
  const requestStageField = refundRequestsTable.getFieldIfExists(FIELD_IDS.REQUEST_STAGE);
  const settlementStageField = refundRequestsTable.getFieldIfExists(FIELD_IDS.SETTLEMENT_STAGE);
  const appliedToDraftOrderField = refundRequestsTable.getFieldIfExists(FIELD_IDS.APPLIED_TO_DRAFT_ORDER);
  const isProductSpecificField = refundRequestsTable.getFieldIfExists(FIELD_IDS.IS_PRODUCT_SPECIFIC);

  const requestStageValue = requestStageField ? (record.getCellValue(requestStageField) as { name: string } | null)?.name ?? null : null;
  const settlementStageValue = settlementStageField ? (record.getCellValue(settlementStageField) as { name: string } | null)?.name ?? null : null;
  const resolutionProposedValue = resolutionProposedField ? (record.getCellValue(resolutionProposedField) as { name: string } | null)?.name ?? null : null;
  const resolutionApprovedValue = resolutionApprovedField ? (record.getCellValue(resolutionApprovedField) as { name: string } | null)?.name ?? null : null;

  const clientLinked = clientField ? (record.getCellValue(clientField) as Array<{ id: string }> | null) : null;
  const clientFullNameField = clientsTable?.getFieldIfExists(CLIENTS_FIELD_IDS.FULL_NAME);
  const clientName = useMemo(() => {
    if (!clientLinked || clientLinked.length === 0 || !clientFullNameField) return 'Unknown Client';
    const clientRecord = clientsRecords.find((c) => c.id === clientLinked[0]?.id);
    return clientRecord ? (clientRecord.getCellValue(clientFullNameField) as string) ?? 'Unknown' : 'Unknown';
  }, [clientLinked, clientsRecords, clientFullNameField]);

  const orderLinkedTop = orderField ? (record.getCellValue(orderField) as Array<{ id: string }> | null) : null;
  const ordersShopifyNumberField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.SHOPIFY_ORDER_NUMBER) ?? null;
  const ordersItemsFieldTop = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.ITEMS) ?? null;
  const ordersOrderItemsStyleFieldTop = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.ORDER_ITEMS_STYLE) ?? null;
  const orderItemsStyleFieldTop = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.STYLE) ?? null;
  const orderItemsNameIfNoStyleFieldTop = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.NAME_IF_NO_STYLE) ?? null;
  const orderItemsAmountFieldTop = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.AMOUNT) ?? null;
  const orderLabel = useMemo(() => {
    if (!orderLinkedTop || orderLinkedTop.length === 0) return '—';
    const orderRecord = ordersRecords.find((o) => o.id === orderLinkedTop[0]?.id);
    if (!orderRecord) return '—';
    return buildOrderLabel(orderRecord, ordersShopifyNumberField, ordersItemsFieldTop, ordersOrderItemsStyleFieldTop);
  }, [orderLinkedTop, ordersRecords, ordersShopifyNumberField, ordersItemsFieldTop, ordersOrderItemsStyleFieldTop]);

  const categoryActiveFieldTop = categoriesTable?.getFieldIfExists(CATEGORY_FIELD_IDS.ACTIVE);
  const orderedCategoryIds = useMemo(() => {
    return categoriesRecords
      .filter((r) => (categoryActiveFieldTop ? r.getCellValue(categoryActiveFieldTop) === true : true))
      .map((r) => r.id)
      .sort((a, b) => {
        const an = categoriesRecords.find((r) => r.id === a)?.name ?? '';
        const bn = categoriesRecords.find((r) => r.id === b)?.name ?? '';
        return an.localeCompare(bn);
      });
  }, [categoriesRecords, categoryActiveFieldTop]);
  const categoryLinkedTop = categoryField ? (record.getCellValue(categoryField) as Array<{ id: string }> | null) : null;
  const categoryLabelTop = categoryLinkedTop?.[0] ? categoriesRecords.find((c) => c.id === categoryLinkedTop[0]?.id)?.name ?? null : null;

  const isEditable = requestStageValue === 'Requested' || requestStageValue === 'Under Review';
  const isApproved = requestStageValue === 'Approved';
  const isSettlementPending = isApproved && (settlementStageValue === 'Refund Pending' || settlementStageValue === 'Discount Pending');

  const [localReason, setLocalReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [approveResolution, setApproveResolution] = useState<string | null>(resolutionProposedValue);

  const initialHashRef = useRef<string | null>(null);
  const [concurrentEditWarning, setConcurrentEditWarning] = useState(false);

  const computeHash = useCallback(() => {
    const values = [
      requestStageValue,
      settlementStageValue,
      resolutionProposedValue,
      resolutionApprovedValue,
      refundReasonField ? (record.getCellValue(refundReasonField) as string | null) : null,
    ];
    return JSON.stringify(values);
  }, [record, requestStageValue, settlementStageValue, resolutionProposedValue, resolutionApprovedValue, refundReasonField]);

  useEffect(() => {
    if (initialHashRef.current === null) {
      initialHashRef.current = computeHash();
      if (refundReasonField) setLocalReason((record.getCellValue(refundReasonField) as string) ?? '');
    } else {
      const currentHash = computeHash();
      if (currentHash !== initialHashRef.current) setConcurrentEditWarning(true);
    }
  }, [computeHash, record, refundReasonField]);

  const handleReload = () => {
    initialHashRef.current = computeHash();
    if (refundReasonField) setLocalReason((record.getCellValue(refundReasonField) as string) ?? '');
    setConcurrentEditWarning(false);
  };

  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const queueWrite = useCallback((fn: () => Promise<void>) => {
    writeQueueRef.current = writeQueueRef.current.then(fn).catch((err) => {
      console.error('Write failed:', err);
      setError('Failed to save changes.');
    });
  }, []);

  const saveReason = useCallback(() => {
    if (!refundReasonField || !canUpdate) return;
    queueWrite(async () => {
      setSaving(true);
      try {
        await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.REFUND_REASON]: localReason });
        initialHashRef.current = computeHash();
      } catch (err) {
        console.error('Save reason failed:', err);
        setError('Failed to save reason.');
      } finally {
        setSaving(false);
      }
    });
  }, [refundReasonField, canUpdate, queueWrite, refundRequestsTable, record.id, localReason, computeHash]);

  const handleMoveToUnderReview = useCallback(() => {
    if (!canUpdate) return;
    queueWrite(async () => {
      setSaving(true);
      try {
        await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.REQUEST_STAGE]: { name: 'Under Review' } });
        initialHashRef.current = null;
      } catch (err) {
        console.error('Move to Under Review failed:', err);
        setError('Failed to move to Under Review.');
      } finally {
        setSaving(false);
      }
    });
  }, [canUpdate, queueWrite, refundRequestsTable, record.id]);

  const handleApprove = useCallback(() => {
    if (!canUpdate || !approveResolution) return;
    const settlementStage = approveResolution === 'Direct Refund' ? 'Refund Pending' : 'Discount Pending';
    queueWrite(async () => {
      setSaving(true);
      try {
        await refundRequestsTable.updateRecordAsync(record.id, {
          [FIELD_IDS.REQUEST_STAGE]: { name: 'Approved' },
          [FIELD_IDS.RESOLUTION_TYPE_APPROVED]: { name: approveResolution },
          [FIELD_IDS.SETTLEMENT_STAGE]: { name: settlementStage },
        });
        initialHashRef.current = null;
        setShowApproveConfirm(false);
      } catch (err) {
        console.error('Approve failed:', err);
        setError('Failed to approve.');
      } finally {
        setSaving(false);
      }
    });
  }, [canUpdate, approveResolution, queueWrite, refundRequestsTable, record.id]);

  const handleReject = useCallback(() => {
    if (!canUpdate) return;
    queueWrite(async () => {
      setSaving(true);
      try {
        await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.REQUEST_STAGE]: { name: 'Rejected' } });
        initialHashRef.current = null;
        setShowRejectConfirm(false);
      } catch (err) {
        console.error('Reject failed:', err);
        setError('Failed to reject.');
      } finally {
        setSaving(false);
      }
    });
  }, [canUpdate, queueWrite, refundRequestsTable, record.id]);

  const handleCancel = useCallback(() => {
    if (!canUpdate) return;
    queueWrite(async () => {
      setSaving(true);
      try {
        await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.REQUEST_STAGE]: { name: 'Cancelled' } });
        initialHashRef.current = null;
        setShowCancelConfirm(false);
      } catch (err) {
        console.error('Cancel failed:', err);
        setError('Failed to cancel.');
      } finally {
        setSaving(false);
      }
    });
  }, [canUpdate, queueWrite, refundRequestsTable, record.id]);

  const handleMarkAsClosed = useCallback(() => {
    if (!canUpdate) return;
    queueWrite(async () => {
      setSaving(true);
      try {
        await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.SETTLEMENT_STAGE]: { name: 'Closed' } });
        initialHashRef.current = null;
        setShowCloseConfirm(false);
      } catch (err) {
        console.error('Mark as Closed failed:', err);
        setError('Failed to close.');
      } finally {
        setSaving(false);
      }
    });
  }, [canUpdate, queueWrite, refundRequestsTable, record.id]);

  const categoryActiveField = categoriesTable?.getFieldIfExists(CATEGORY_FIELD_IDS.ACTIVE);
  const categoryOptions = useMemo(() => {
    return categoriesRecords
      .filter((r) => (categoryActiveField ? r.getCellValue(categoryActiveField) === true : true))
      .map((r) => ({ id: r.id, label: r.name ?? r.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesRecords, categoryActiveField]);

  const clientFullNameFieldClients = clientsTable?.getFieldIfExists(CLIENTS_FIELD_IDS.FULL_NAME);
  const ordersClientField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.CLIENT);

  // Only clients with at least one Shopify order, whose own pipeline stage
  // hasn't wrapped up, can be picked here — same rule as the New Refund Case
  // modal (per Axel, 2026-09-01).
  const clientIdsWithOrders = useMemo(() => {
    const set = new Set<string>();
    if (!ordersClientField) return set;
    for (const o of ordersRecords) {
      const linked = o.getCellValue(ordersClientField) as Array<{ id: string }> | null;
      linked?.forEach((l) => set.add(l.id));
    }
    return set;
  }, [ordersRecords, ordersClientField]);

  const clientStageField = clientsTable?.getFieldIfExists(CLIENTS_FIELD_IDS.STAGE) ?? null;

  const currentClientId = clientLinked?.[0]?.id ?? null;

  // Same "has an order, stage not wrapped up" gate as the New Refund Case
  // modal (per Axel, 2026-09-01) — but the request's own already-linked
  // client is always kept in the list even if it no longer qualifies (e.g.
  // its stage moved to Fulfilled after this request was filed), so the
  // picker still shows the real name instead of silently blanking it out.
  const clientOptions = useMemo(() => {
    if (!clientFullNameFieldClients) return [];
    return clientsRecords
      .filter((r) => {
        if (r.id === currentClientId) return true;
        if (!clientIdsWithOrders.has(r.id)) return false;
        if (!clientStageField) return true;
        const stageId = (r.getCellValue(clientStageField) as { id: string } | null)?.id ?? null;
        return stageId !== CLIENT_STAGE_FULFILLED_CHOICE_ID && stageId !== CLIENT_STAGE_DID_NOT_CONVERT_CHOICE_ID;
      })
      .map((r) => ({ id: r.id, label: (r.getCellValue(clientFullNameFieldClients) as string) ?? r.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clientsRecords, clientFullNameFieldClients, clientIdsWithOrders, clientStageField, currentClientId]);

  const orderOptions = useMemo(() => {
    if (!currentClientId || !ordersClientField) return [];
    return ordersRecords
      .filter((r) => {
        const linked = r.getCellValue(ordersClientField) as Array<{ id: string }> | null;
        return linked?.some((l) => l.id === currentClientId);
      })
      .map((r) => ({ id: r.id, label: buildOrderLabel(r, ordersShopifyNumberField, ordersItemsFieldTop, ordersOrderItemsStyleFieldTop) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ordersRecords, currentClientId, ordersClientField, ordersShopifyNumberField, ordersItemsFieldTop, ordersOrderItemsStyleFieldTop]);

  const orderLinked = orderField ? (record.getCellValue(orderField) as Array<{ id: string }> | null) : null;
  const currentOrderId = orderLinked?.[0]?.id ?? null;

  const orderItemsOrderField = orderItemsTable?.getFieldIfExists(ORDER_ITEMS_FIELD_IDS.ORDER) ?? null;
  const orderItemRows = useMemo(() => {
    if (!currentOrderId || !orderItemsOrderField) return [];
    return orderItemsRecords
      .filter((r) => {
        const linked = r.getCellValue(orderItemsOrderField) as Array<{ id: string }> | null;
        return linked?.some((l) => l.id === currentOrderId);
      })
      .map((r) => buildOrderItemRow(r, orderItemsStyleFieldTop, orderItemsNameIfNoStyleFieldTop, orderItemsAmountFieldTop));
  }, [orderItemsRecords, currentOrderId, orderItemsOrderField, orderItemsStyleFieldTop, orderItemsNameIfNoStyleFieldTop, orderItemsAmountFieldTop]);

  // Same gate as the New Refund Case modal — no items on this order means
  // nothing for the product-specific toggle to offer.
  const currentOrderHasItems = !currentOrderId || orderItemRows.length > 0;

  const currentOrderItemsLinked = orderItemsField ? (record.getCellValue(orderItemsField) as Array<{ id: string }> | null) : null;
  const currentOrderItemIds = currentOrderItemsLinked?.map((l) => l.id) ?? [];

  const currentOrderItemDropdownOptions = useMemo(
    () =>
      orderItemRows
        .filter((r) => !currentOrderItemIds.includes(r.id))
        .sort((a, b) => a.style.localeCompare(b.style)),
    [orderItemRows, currentOrderItemIds]
  );
  const currentOrderItemTableRows = useMemo(
    () => currentOrderItemIds.map((id) => orderItemRows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
    [currentOrderItemIds, orderItemRows]
  );
  const currentCategoryLinked = categoryField ? (record.getCellValue(categoryField) as Array<{ id: string }> | null) : null;
  const currentCategoryId = currentCategoryLinked?.[0]?.id ?? null;
  const isProductSpecificValue = isProductSpecificField ? !!record.getCellValue(isProductSpecificField) : false;

  const handleClientChange = useCallback(
    (newClientId: string | null) => {
      if (!canUpdate || !clientField) return;
      queueWrite(async () => {
        setSaving(true);
        try {
          await refundRequestsTable.updateRecordAsync(record.id, {
            [FIELD_IDS.CLIENT]: newClientId ? [{ id: newClientId }] : [],
            [FIELD_IDS.ORDER]: [],
            [FIELD_IDS.ORDER_ITEMS]: [],
          });
          initialHashRef.current = null;
        } catch (err) {
          console.error('Client change failed:', err);
          setError('Failed to update client.');
        } finally {
          setSaving(false);
        }
      });
    },
    [canUpdate, clientField, queueWrite, refundRequestsTable, record.id]
  );

  const handleOrderChange = useCallback(
    (newOrderId: string | null) => {
      if (!canUpdate || !orderField) return;
      queueWrite(async () => {
        setSaving(true);
        try {
          await refundRequestsTable.updateRecordAsync(record.id, {
            [FIELD_IDS.ORDER]: newOrderId ? [{ id: newOrderId }] : [],
            [FIELD_IDS.ORDER_ITEMS]: [],
            [FIELD_IDS.IS_PRODUCT_SPECIFIC]: false,
          });
          initialHashRef.current = null;
        } catch (err) {
          console.error('Order change failed:', err);
          setError('Failed to update order.');
        } finally {
          setSaving(false);
        }
      });
    },
    [canUpdate, orderField, queueWrite, refundRequestsTable, record.id]
  );

  const handleOrderItemsChange = useCallback(
    (newIds: string[]) => {
      if (!canUpdate || !orderItemsField) return;
      queueWrite(async () => {
        setSaving(true);
        try {
          await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.ORDER_ITEMS]: newIds.map((id) => ({ id })) });
          initialHashRef.current = null;
        } catch (err) {
          console.error('Order items change failed:', err);
          setError('Failed to update order items.');
        } finally {
          setSaving(false);
        }
      });
    },
    [canUpdate, orderItemsField, queueWrite, refundRequestsTable, record.id]
  );

  const handleProductSpecificChange = useCallback(
    (checked: boolean) => {
      if (!canUpdate || !isProductSpecificField) return;
      queueWrite(async () => {
        setSaving(true);
        try {
          const patch: Record<string, unknown> = { [FIELD_IDS.IS_PRODUCT_SPECIFIC]: checked };
          if (!checked) patch[FIELD_IDS.ORDER_ITEMS] = [];
          await refundRequestsTable.updateRecordAsync(record.id, patch);
          initialHashRef.current = null;
        } catch (err) {
          console.error('Product-specific change failed:', err);
          setError('Failed to update.');
        } finally {
          setSaving(false);
        }
      });
    },
    [canUpdate, isProductSpecificField, queueWrite, refundRequestsTable, record.id]
  );

  const handleCategoryChange = useCallback(
    (newCategoryId: string | null) => {
      if (!canUpdate || !categoryField) return;
      queueWrite(async () => {
        setSaving(true);
        try {
          await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.REFUND_CATEGORY]: newCategoryId ? [{ id: newCategoryId }] : [] });
          initialHashRef.current = null;
        } catch (err) {
          console.error('Category change failed:', err);
          setError('Failed to update category.');
        } finally {
          setSaving(false);
        }
      });
    },
    [canUpdate, categoryField, queueWrite, refundRequestsTable, record.id]
  );

  const handleResolutionProposedChange = useCallback(
    (newVal: string | null) => {
      if (!canUpdate || !resolutionProposedField) return;
      queueWrite(async () => {
        setSaving(true);
        try {
          await refundRequestsTable.updateRecordAsync(record.id, { [FIELD_IDS.RESOLUTION_TYPE_PROPOSED]: newVal ? { name: newVal } : null });
          initialHashRef.current = null;
        } catch (err) {
          console.error('Resolution proposed change failed:', err);
          setError('Failed to update resolution type.');
        } finally {
          setSaving(false);
        }
      });
    },
    [canUpdate, resolutionProposedField, queueWrite, refundRequestsTable, record.id]
  );

  const appliedToDraftOrderValue = appliedToDraftOrderField ? (record.getCellValue(appliedToDraftOrderField) as Array<{ id: string }> | null) : null;
  const hasAppliedDraftOrder = appliedToDraftOrderValue && appliedToDraftOrderValue.length > 0;

  const fieldLabelCls = 'text-[11px] capitalize tracking-wide font-medium mb-1.5 block';

  return (
    <div className="min-h-screen" style={{ backgroundColor: tok.app_bg }}>
      {/* Header row wrapped in the same max-w-4xl the content grid below uses
          (Axel, 2026-09-02) so the "Go back" button's left edge lines up
          with the content's left edge, per pipeline.tsx's reference layout —
          previously this row spanned the full width via bare px-6, so it sat
          further left than the centered content underneath it. */}
      <div className="px-6 py-4" style={{ borderBottom: `1px solid ${tok.border}`, backgroundColor: tok.surface }}>
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* "Go back" button style (Axel, 2026-09-02): matches
              pipeline.tsx's reference treatment exactly — surface/white
              card, 1px border, §4's "resting card" shadow — standardized
              across every daily_ops page's page-level back button. */}
          <button
            type="button"
            onClick={onGoBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex-shrink-0"
            style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}`, color: tok.text_secondary, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <CaretLeftIcon size={16} />
            Go back
          </button>
          <h1 className="text-lg font-bold truncate" style={{ color: tok.text_primary }}>
            {clientName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-sm" style={{ color: tok.text_muted }}>
              Saving...
            </span>
          )}
          {/* Move to Under Review / Approve / Reject / Cancel only ever show when the page
              was opened from the Review layout (Margo's queue) — same rule as
              customization_requests.tsx gating internal Approve/Deny by sourceLayout.
              A Sales Associate opening a case from the Requests layout never sees these. */}
          {sourceLayout === 'review' && requestStageValue === 'Requested' && canUpdate && (
            <button
              type="button"
              onClick={handleMoveToUnderReview}
              className="w-[172px] text-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
              style={{ border: `1px solid ${tok.border}`, color: tok.text_primary }}
            >
              Move to Under Review
            </button>
          )}
          {sourceLayout === 'review' && requestStageValue === 'Under Review' && canUpdate && (
            <>
              <button
                type="button"
                onClick={() => {
                  setApproveResolution(resolutionProposedValue);
                  setShowApproveConfirm(true);
                }}
                className="w-[172px] text-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setShowRejectConfirm(true)}
                className="w-[172px] text-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="w-[172px] text-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                style={{ border: `1px solid ${tok.border}`, color: tok.text_primary }}
              >
                Cancel
              </button>
            </>
          )}
          {isSettlementPending && canUpdate && (
            <button
              type="button"
              onClick={() => setShowCloseConfirm(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: tok.accent }}
            >
              Mark as Closed
            </button>
          )}
        </div>
      </div>
      </div>

      {concurrentEditWarning && (
        <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between ${SEMANTIC.danger.bg} ${SEMANTIC.danger.border} border`}>
          <div className={`flex items-center gap-2 text-sm ${SEMANTIC.danger.text}`}>
            <WarningIcon size={16} />
            This refund case was updated by another user while you had it open.
          </div>
          <button type="button" onClick={handleReload} className={`text-sm underline hover:no-underline ${SEMANTIC.danger.text}`}>
            Reload
          </button>
        </div>
      )}

      {error && (
        <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${SEMANTIC.danger.bg} ${SEMANTIC.danger.border} border ${SEMANTIC.danger.text}`}>
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="px-6 py-6">
        <div className="max-w-4xl mx-auto grid grid-cols-5 gap-6">
          <div className="col-span-3 space-y-4">
            {isEditable && canUpdate ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <SearchablePicker label="Client" placeholder="Select a client..." options={clientOptions} value={currentClientId} onChange={handleClientChange} tok={tok} />
                  <SearchablePicker
                    label="Order"
                    placeholder="Select an order..."
                    options={orderOptions}
                    value={currentOrderId}
                    onChange={handleOrderChange}
                    disabled={!currentClientId}
                    tok={tok}
                  />
                </div>
                {currentOrderHasItems ? (
                  <>
                    <div className="flex items-center gap-3">
                      <ProductSpecificToggle
                        checked={isProductSpecificValue}
                        onChange={handleProductSpecificChange}
                        tok={tok}
                      />
                      {isProductSpecificValue && (
                        <div className="flex-1">
                          <OrderItemSelectDropdown
                            options={currentOrderItemDropdownOptions}
                            onAdd={(id) => handleOrderItemsChange([...currentOrderItemIds, id])}
                            disabled={!currentOrderId}
                            tok={tok}
                          />
                        </div>
                      )}
                    </div>
                    {isProductSpecificValue && (
                      <OrderItemsTable
                        items={currentOrderItemTableRows}
                        onRemove={(id) => handleOrderItemsChange(currentOrderItemIds.filter((x) => x !== id))}
                        tok={tok}
                      />
                    )}
                  </>
                ) : (
                  <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: tok.hover_bg, color: tok.text_secondary }}>
                    This order has no item-level data on file — this refund will be treated as an order-level charge.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <SearchablePicker
                    label="Refund Category"
                    placeholder="Select a category..."
                    options={categoryOptions}
                    value={currentCategoryId}
                    onChange={handleCategoryChange}
                    tok={tok}
                  />
                  <SimplePicker
                    label="Proposed Resolution"
                    placeholder="Select resolution type..."
                    options={resolutionTypeProposedChoices.map((c) => ({ value: c.name, label: c.name }))}
                    value={resolutionProposedValue}
                    onChange={handleResolutionProposedChange}
                    tok={tok}
                  />
                </div>
                <div>
                  <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                    Refund Details
                  </label>
                  <textarea
                    value={localReason}
                    onChange={(e) => setLocalReason(e.target.value)}
                    onBlur={saveReason}
                    placeholder="Enter refund details..."
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-colors"
                    style={{ border: `1px solid ${tok.border}`, backgroundColor: tok.surface, color: tok.text_primary }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                      Client
                    </label>
                    <div className="p-2 rounded-lg text-sm" style={{ backgroundColor: tok.hover_bg, color: tok.text_primary }}>
                      {clientName}
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                      Order
                    </label>
                    <div className="p-2 rounded-lg text-sm" style={{ backgroundColor: tok.hover_bg, color: tok.text_primary }}>
                      {orderLabel}
                    </div>
                  </div>
                </div>
                {isProductSpecificValue && (
                  <div>
                    <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                      Order Items
                    </label>
                    <OrderItemsTable items={currentOrderItemTableRows} disabled tok={tok} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                      Refund Category
                    </label>
                    <div className="p-2 rounded-lg">
                      <CategoryChip label={categoryLabelTop} categoryId={categoryLinkedTop?.[0]?.id ?? null} orderedCategoryIds={orderedCategoryIds} />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                      Proposed Resolution
                    </label>
                    <div className="p-2 rounded-lg">
                      <StagePill value={resolutionProposedValue} choices={resolutionTypeProposedChoices} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                    Refund Details
                  </label>
                  <div className="p-2 rounded-lg text-sm whitespace-pre-wrap" style={{ backgroundColor: tok.hover_bg, color: tok.text_primary }}>
                    {refundReasonField ? (record.getCellValue(refundReasonField) as string) ?? '—' : '—'}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="col-span-2">
            {/* Stage/info panel (Axel, 2026-09-02): now a `surface`/white card
                with a border — matching draft_orders.tsx's actual Summary /
                Refund Case panel treatment (screenshot 1) — instead of the
                flat sandy `panel_bg` tone this used before. Each label+chip
                pair is inline on one row (draft_orders.tsx's
                `flex justify-between items-center` pattern) rather than
                stacked, and both are bumped one Tailwind tier from before:
                label was text-[11px] -> now text-lg; chip was text-sm -> now
                text-base (via StagePill/CategoryChip's `size="lg"`) — label
                still ends up exactly one tier above the chip, per Axel's ask. */}
            <div className="sticky top-4 rounded-lg p-4 space-y-3" style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}` }}>
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium capitalize tracking-wide" style={{ color: tok.text_secondary }}>
                  Refund Category
                </span>
                <CategoryChip label={categoryLabelTop} categoryId={categoryLinkedTop?.[0]?.id ?? null} orderedCategoryIds={orderedCategoryIds} size="lg" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium capitalize tracking-wide" style={{ color: tok.text_secondary }}>
                  Request Stage
                </span>
                <StagePill value={requestStageValue} choices={requestStageChoices} size="lg" />
              </div>
              {resolutionApprovedValue && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium capitalize tracking-wide" style={{ color: tok.text_secondary }}>
                    Approved Resolution
                  </span>
                  <StagePill value={resolutionApprovedValue} choices={resolutionTypeApprovedChoices} size="lg" />
                </div>
              )}
              {settlementStageValue && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium capitalize tracking-wide" style={{ color: tok.text_secondary }}>
                    Settlement Stage
                  </span>
                  <StagePill value={settlementStageValue} choices={settlementStageChoices} size="lg" />
                </div>
              )}
              {hasAppliedDraftOrder && appliedToDraftOrderField && (
                <div>
                  <label className={fieldLabelCls} style={{ color: tok.text_secondary }}>
                    Applied to Draft Order
                  </label>
                  <div className="text-sm" style={{ color: tok.text_primary }}>
                    <CellRenderer record={record} field={appliedToDraftOrderField} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showApproveConfirm && (
        <ConfirmDialog
          title="Approve Refund Case"
          onClose={() => setShowApproveConfirm(false)}
          onConfirm={handleApprove}
          confirmLabel={saving ? 'Approving...' : 'Confirm Approve'}
          confirmColor="#16A34A"
          confirming={saving || !approveResolution}
          tok={tok}
        >
          <SimplePicker
            label="Resolution Type"
            placeholder="Select resolution type..."
            options={resolutionTypeApprovedChoices.map((c) => ({ value: c.name, label: c.name }))}
            value={approveResolution}
            onChange={setApproveResolution}
            tok={tok}
          />
        </ConfirmDialog>
      )}

      {showRejectConfirm && (
        <ConfirmDialog
          title="Reject Refund Case"
          onClose={() => setShowRejectConfirm(false)}
          onConfirm={handleReject}
          confirmLabel={saving ? 'Rejecting...' : 'Confirm Reject'}
          confirmColor="#DC2626"
          confirming={saving}
          tok={tok}
        >
          <p className="text-sm" style={{ color: tok.text_secondary }}>
            Are you sure you want to reject this refund case? This action cannot be undone.
          </p>
        </ConfirmDialog>
      )}

      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel Refund Case"
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={handleCancel}
          confirmLabel={saving ? 'Cancelling...' : 'Confirm Cancel'}
          confirmColor={tok.text_secondary}
          confirming={saving}
          tok={tok}
        >
          <p className="text-sm" style={{ color: tok.text_secondary }}>
            Are you sure you want to cancel this refund case?
          </p>
        </ConfirmDialog>
      )}

      {showCloseConfirm && (
        <ConfirmDialog
          title="Mark as Closed"
          onClose={() => setShowCloseConfirm(false)}
          onConfirm={handleMarkAsClosed}
          confirmLabel={saving ? 'Closing...' : 'Confirm Close'}
          confirmColor={tok.accent}
          confirming={saving}
          tok={tok}
        >
          <p className="text-sm" style={{ color: tok.text_secondary }}>
            Are you sure you want to mark this refund case as closed?
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function RefundRequestsApp(): React.ReactElement {
  const tok = useTokens();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomPropertiesConfig);

  const refundRequestsTable = customPropertyValueByKey.refundRequestsTable as Table | undefined;
  const refundCategoriesTable = customPropertyValueByKey.refundCategoriesTable as Table | undefined;

  const ordersTable = base.getTableByIdIfExists(ORDERS_TABLE_ID);
  const orderItemsTable = base.getTableByIdIfExists(ORDER_ITEMS_TABLE_ID);
  const clientsTable = base.getTableByIdIfExists(CLIENTS_TABLE_ID);

  // useRecords() dereferences `table.id` with no null-check internally — it
  // throws immediately if called with null/undefined. refundRequestsTable and
  // refundCategoriesTable come from custom properties, which can genuinely
  // resolve to undefined until Airtable's Interface Designer has picked them
  // up for this page. Falling back to base.tables[0] (always present) keeps
  // every hook call itself safe; the real records are discarded below
  // whenever the intended table isn't actually available yet.
  const refundRequestsRecordsRaw = useRecords(refundRequestsTable ?? base.tables[0]);
  const categoriesRecordsRaw = useRecords(refundCategoriesTable ?? base.tables[0]);
  const ordersRecordsRaw = useRecords(ordersTable ?? base.tables[0]);
  const orderItemsRecordsRaw = useRecords(orderItemsTable ?? base.tables[0]);
  const refundRequestsRecords = refundRequestsTable ? refundRequestsRecordsRaw : undefined;
  const categoriesRecords = refundCategoriesTable ? categoriesRecordsRaw : undefined;
  const ordersRecords = ordersTable ? ordersRecordsRaw : [];
  const orderItemsRecords = orderItemsTable ? orderItemsRecordsRaw : [];
  const clientsRecordsRaw = useRecords(clientsTable ?? base.tables[0]);
  const clientsRecords = clientsTable ? clientsRecordsRaw : [];

  const [viewState, setViewState] = useState<ViewState>({ layer: 1, layout: 'requests' });
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [resolutionTypeFilter, setResolutionTypeFilter] = useState<string | null>(null);
  const [settlementStageFilter, setSettlementStageFilter] = useState<string | null>(null);
  // Default view hides Approved+Closed cases; "Show All" lets staff see them again.
  const [showAllRecords, setShowAllRecords] = useState(false);

  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseDraft, setNewCaseDraft] = useState<NewCaseDraft>(emptyDraft);
  const [submittingNewCase, setSubmittingNewCase] = useState(false);
  const [newCaseError, setNewCaseError] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [draggedRecordId, setDraggedRecordId] = useState<string | null>(null);

  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    if (deepLinkHandledRef.current || !refundRequestsRecords) return;
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get('record');
    if (recordId) {
      const record = refundRequestsRecords.find((r) => r.id === recordId);
      if (record) {
        const requestStageField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.REQUEST_STAGE);
        const stageValue = requestStageField ? (record.getCellValue(requestStageField) as { name: string } | null)?.name : null;
        const sourceLayout = stageValue === 'Requested' || stageValue === 'Under Review' ? 'review' : 'requests';
        setViewState({ layer: 2, recordId, sourceLayout });
        deepLinkHandledRef.current = true;
      }
    }
  }, [refundRequestsRecords, refundRequestsTable]);

  const requestStageField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.REQUEST_STAGE) ?? null;
  const settlementStageField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.SETTLEMENT_STAGE) ?? null;
  const categoryField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.REFUND_CATEGORY) ?? null;
  const clientField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.CLIENT) ?? null;
  const orderField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.ORDER) ?? null;
  const resolutionProposedField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.RESOLUTION_TYPE_PROPOSED) ?? null;
  const resolutionApprovedField = refundRequestsTable?.getFieldIfExists(FIELD_IDS.RESOLUTION_TYPE_APPROVED) ?? null;

  const requestStageChoices = useMemo(() => getFieldChoices(requestStageField), [requestStageField]);
  const settlementStageChoices = useMemo(() => getFieldChoices(settlementStageField), [settlementStageField]);
  const resolutionProposedChoices = useMemo(() => getFieldChoices(resolutionProposedField), [resolutionProposedField]);
  const resolutionApprovedChoices = useMemo(() => getFieldChoices(resolutionApprovedField), [resolutionApprovedField]);

  const categoryActiveField = refundCategoriesTable?.getFieldIfExists(CATEGORY_FIELD_IDS.ACTIVE) ?? null;
  const activeCategoriesRecords = useMemo(() => {
    if (!categoryActiveField) return categoriesRecords ?? [];
    return (categoriesRecords ?? []).filter((r) => r.getCellValue(categoryActiveField) === true);
  }, [categoriesRecords, categoryActiveField]);

  const categoryFilterOptions = useMemo(
    () =>
      activeCategoriesRecords
        .map((r) => ({ value: r.id, label: r.name ?? r.id }))
        .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)),
    [activeCategoriesRecords]
  );
  const stageFilterOptions = useMemo(() => requestStageChoices.map((c) => ({ value: c.name, label: c.name })), [requestStageChoices]);
  const resolutionFilterOptions = useMemo(() => resolutionApprovedChoices.map((c) => ({ value: c.name, label: c.name })), [resolutionApprovedChoices]);
  const settlementStageFilterOptions = useMemo(() => settlementStageChoices.map((c) => ({ value: c.name, label: c.name })), [settlementStageChoices]);

  // Stable rainbow ordering for CategoryChip — sorted by name so a category's
  // hue doesn't shift around as unrelated records load/unload.
  const orderedCategoryIds = useMemo(
    () => [...activeCategoriesRecords].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((r) => r.id),
    [activeCategoriesRecords]
  );
  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of categoriesRecords ?? []) m.set(r.id, r.name ?? r.id);
    return m;
  }, [categoriesRecords]);

  const clientFullNameField = clientsTable?.getFieldIfExists(CLIENTS_FIELD_IDS.FULL_NAME) ?? null;
  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    if (!clientFullNameField) return m;
    for (const r of clientsRecords ?? []) m.set(r.id, (r.getCellValue(clientFullNameField) as string) ?? r.id);
    return m;
  }, [clientsRecords, clientFullNameField]);

  const ordersShopifyNumberField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.SHOPIFY_ORDER_NUMBER) ?? null;
  const ordersItemsField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.ITEMS) ?? null;
  // order_items_style rollup already lives on the order itself (unique style
  // values, no child-table scan needed) — reading it directly here is what
  // fixed the O(orders × items) scan (~39M getCellValue calls through the
  // SDK) that hung the page on every click that re-rendered this table
  // (per Axel, 2026-09-01).
  const ordersOrderItemsStyleField = ordersTable?.getFieldIfExists(ORDERS_FIELD_IDS.ORDER_ITEMS_STYLE) ?? null;
  const orderLabelById = useMemo(() => {
    const m = new Map<string, string>();
    if (!ordersShopifyNumberField) return m;
    for (const r of ordersRecords ?? []) {
      m.set(r.id, buildOrderLabel(r, ordersShopifyNumberField, ordersItemsField, ordersOrderItemsStyleField));
    }
    return m;
  }, [ordersRecords, ordersShopifyNumberField, ordersItemsField, ordersOrderItemsStyleField]);

  const filteredRecords = useMemo(() => {
    if (!refundRequestsRecords) return [];
    let result = [...refundRequestsRecords];

    if (!showAllRecords) {
      result = result.filter((r) => {
        if (!requestStageField || !settlementStageField) return true;
        const stage = (r.getCellValue(requestStageField) as { name: string } | null)?.name;
        const settlement = (r.getCellValue(settlementStageField) as { name: string } | null)?.name;
        return !(stage === 'Approved' && settlement === 'Closed');
      });
    }

    if (searchText.trim() && clientField && clientFullNameField) {
      const s = searchText.toLowerCase();
      result = result.filter((r) => {
        const linked = r.getCellValue(clientField) as Array<{ id: string }> | null;
        if (!linked || linked.length === 0) return false;
        const clientRecord = clientsRecords?.find((c) => c.id === linked[0]?.id);
        if (!clientRecord) return false;
        const name = (clientRecord.getCellValue(clientFullNameField) as string) ?? '';
        return name.toLowerCase().includes(s);
      });
    }

    if (categoryFilter && categoryField) {
      result = result.filter((r) => {
        const linked = r.getCellValue(categoryField) as Array<{ id: string }> | null;
        return linked?.some((l) => l.id === categoryFilter);
      });
    }

    if (stageFilter && requestStageField) {
      result = result.filter((r) => {
        const stage = (r.getCellValue(requestStageField) as { name: string } | null)?.name;
        return stage === stageFilter;
      });
    }

    if (resolutionTypeFilter && resolutionApprovedField) {
      result = result.filter((r) => {
        const res = (r.getCellValue(resolutionApprovedField) as { name: string } | null)?.name;
        return res === resolutionTypeFilter;
      });
    }

    if (settlementStageFilter && settlementStageField) {
      result = result.filter((r) => {
        const settlement = (r.getCellValue(settlementStageField) as { name: string } | null)?.name;
        return settlement === settlementStageFilter;
      });
    }

    // Sort by Request Stage, then Settlement Stage — using each field's own
    // defined choice order (its workflow sequence), not alphabetical.
    const requestStageOrder = new Map(requestStageChoices.map((c, i) => [c.name, i]));
    const settlementStageOrder = new Map(settlementStageChoices.map((c, i) => [c.name, i]));
    result.sort((a, b) => {
      const aStage = requestStageField ? (a.getCellValue(requestStageField) as { name: string } | null)?.name : undefined;
      const bStage = requestStageField ? (b.getCellValue(requestStageField) as { name: string } | null)?.name : undefined;
      const aStageIdx = aStage ? requestStageOrder.get(aStage) ?? 999 : 999;
      const bStageIdx = bStage ? requestStageOrder.get(bStage) ?? 999 : 999;
      if (aStageIdx !== bStageIdx) return aStageIdx - bStageIdx;

      const aSettlement = settlementStageField ? (a.getCellValue(settlementStageField) as { name: string } | null)?.name : undefined;
      const bSettlement = settlementStageField ? (b.getCellValue(settlementStageField) as { name: string } | null)?.name : undefined;
      const aSettlementIdx = aSettlement ? settlementStageOrder.get(aSettlement) ?? 999 : 999;
      const bSettlementIdx = bSettlement ? settlementStageOrder.get(bSettlement) ?? 999 : 999;
      return aSettlementIdx - bSettlementIdx;
    });

    return result;
  }, [
    refundRequestsRecords,
    showAllRecords,
    searchText,
    categoryFilter,
    stageFilter,
    resolutionTypeFilter,
    settlementStageFilter,
    requestStageField,
    settlementStageField,
    categoryField,
    clientField,
    clientFullNameField,
    clientsRecords,
    resolutionApprovedField,
    requestStageChoices,
    settlementStageChoices,
  ]);

  const requestedRecords = useMemo(() => {
    if (!requestStageField) return [];
    return (refundRequestsRecords ?? []).filter((r) => (r.getCellValue(requestStageField) as { name: string } | null)?.name === 'Requested');
  }, [refundRequestsRecords, requestStageField]);

  const underReviewRecords = useMemo(() => {
    if (!requestStageField) return [];
    return (refundRequestsRecords ?? []).filter((r) => (r.getCellValue(requestStageField) as { name: string } | null)?.name === 'Under Review');
  }, [refundRequestsRecords, requestStageField]);

  const handleDropToUnderReview = useCallback(() => {
    if (!draggedRecordId || !refundRequestsTable) {
      setDraggedRecordId(null);
      return;
    }
    const id = draggedRecordId;
    setDraggedRecordId(null);
    refundRequestsTable
      .updateRecordAsync(id, { [FIELD_IDS.REQUEST_STAGE]: { name: 'Under Review' } })
      .catch((err) => console.error('Request stage drag-update failed:', err));
  }, [draggedRecordId, refundRequestsTable]);

  const handleNewCaseSubmit = useCallback(async () => {
    if (!refundRequestsTable || !newCaseDraft.clientId || !newCaseDraft.orderId || !newCaseDraft.categoryId || !newCaseDraft.resolutionTypeProposed) return;

    setSubmittingNewCase(true);
    setNewCaseError(null);

    try {
      const clientRecord = clientsRecords?.find((c) => c.id === newCaseDraft.clientId);
      const clientName = clientFullNameField && clientRecord ? (clientRecord.getCellValue(clientFullNameField) as string) ?? 'Unknown' : 'Unknown';
      const categoryRecord = categoriesRecords?.find((c) => c.id === newCaseDraft.categoryId);
      const categoryName = categoryRecord?.name ?? 'Unknown';
      const caseName = `${clientName} — ${categoryName} — ${new Date().toLocaleDateString()}`;

      const fields: Record<string, unknown> = {
        [FIELD_IDS.CASE_NAME]: caseName,
        [FIELD_IDS.CLIENT]: [{ id: newCaseDraft.clientId }],
        [FIELD_IDS.ORDER]: [{ id: newCaseDraft.orderId }],
        [FIELD_IDS.REFUND_REASON]: newCaseDraft.refundReason,
        [FIELD_IDS.REFUND_CATEGORY]: [{ id: newCaseDraft.categoryId }],
        [FIELD_IDS.RESOLUTION_TYPE_PROPOSED]: { name: newCaseDraft.resolutionTypeProposed },
        [FIELD_IDS.REQUEST_STAGE]: { name: 'Requested' },
        [FIELD_IDS.CLIENT_EMAIL_SENT]: false,
        [FIELD_IDS.IS_PRODUCT_SPECIFIC]: newCaseDraft.isProductSpecific,
      };

      if (newCaseDraft.isProductSpecific && newCaseDraft.orderItemIds.length > 0) {
        fields[FIELD_IDS.ORDER_ITEMS] = newCaseDraft.orderItemIds.map((id) => ({ id }));
      }

      const newRecordId = await refundRequestsTable.createRecordAsync(fields);
      setShowNewCaseModal(false);
      setNewCaseDraft(emptyDraft);
      setViewState({ layer: 2, recordId: newRecordId, sourceLayout: 'requests' });
    } catch (err) {
      console.error('Create new case failed:', err);
      setNewCaseError('Failed to create refund case. Please try again.');
    } finally {
      setSubmittingNewCase(false);
    }
  }, [refundRequestsTable, newCaseDraft, clientsRecords, categoriesRecords, clientFullNameField]);

  const canUpdate = refundRequestsTable?.hasPermissionToUpdateRecords() ?? false;

  if (errorState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: tok.app_bg }}>
        <div className="text-center text-red-500 dark:text-red-400">
          <p className="text-lg font-medium">Error loading configuration</p>
          <p className="text-sm mt-2">{errorState.error.message}</p>
        </div>
      </div>
    );
  }

  if (!refundRequestsTable || !refundCategoriesTable) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: tok.app_bg }}>
        <div className="text-center" style={{ color: tok.text_secondary }}>
          <p className="text-lg font-medium">Configuration Required</p>
          <p className="text-sm mt-2">Ensure the Refund Requests and Refund Categories tables are available.</p>
        </div>
      </div>
    );
  }

  if (!refundRequestsRecords || !categoriesRecords) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: tok.app_bg }}>
        <div className="text-center" style={{ color: tok.text_secondary }}>
          <p className="text-lg font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (viewState.layer === 2) {
    const record = refundRequestsRecords.find((r) => r.id === viewState.recordId);
    if (!record) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: tok.app_bg }}>
          <div className="text-center" style={{ color: tok.text_secondary }}>
            <p className="text-lg font-medium">Refund case not found</p>
            <button
              type="button"
              onClick={() => setViewState({ layer: 1, layout: viewState.sourceLayout })}
              className="mt-4 underline hover:no-underline"
              style={{ color: tok.accent }}
            >
              Go back
            </button>
          </div>
        </div>
      );
    }

    return (
      <DetailPage
        record={record}
        refundRequestsTable={refundRequestsTable}
        categoriesRecords={categoriesRecords}
        clientsRecords={clientsRecords ?? []}
        ordersRecords={ordersRecords ?? []}
        orderItemsRecords={orderItemsRecords ?? []}
        clientsTable={clientsTable}
        ordersTable={ordersTable}
        orderItemsTable={orderItemsTable}
        categoriesTable={refundCategoriesTable}
        requestStageChoices={requestStageChoices}
        settlementStageChoices={settlementStageChoices}
        resolutionTypeProposedChoices={resolutionProposedChoices}
        resolutionTypeApprovedChoices={resolutionApprovedChoices}
        onGoBack={() => setViewState({ layer: 1, layout: viewState.sourceLayout })}
        canUpdate={canUpdate}
        sourceLayout={viewState.sourceLayout}
      />
    );
  }

  const currentLayout = viewState.layout;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tok.app_bg }}>
      <div className="px-6 py-3 flex items-center gap-4" style={{ borderBottom: `1px solid ${tok.border}`, backgroundColor: tok.surface }}>
        <div className="relative flex-shrink-0">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: tok.text_muted }} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by client..."
            className="pl-9 pr-3 py-1.5 w-72 rounded-lg text-sm outline-none transition-colors"
            style={{ border: `1px solid ${tok.border}`, backgroundColor: tok.surface, color: tok.text_primary }}
          />
        </div>
        {currentLayout === 'requests' && (
          <>
            <ResponsiveFilterRow
              tok={tok}
              filters={[
                { key: 'category', label: 'Category', isActive: !!categoryFilter, node: <Dropdown placeholder="Category" value={categoryFilter} options={categoryFilterOptions} onChange={setCategoryFilter} tok={tok} /> },
                { key: 'requestStage', label: 'Request Stage', isActive: !!stageFilter, node: <Dropdown placeholder="Request Stage" value={stageFilter} options={stageFilterOptions} onChange={setStageFilter} tok={tok} /> },
                { key: 'resolutionType', label: 'Resolution Type', isActive: !!resolutionTypeFilter, node: <Dropdown placeholder="Resolution Type" value={resolutionTypeFilter} options={resolutionFilterOptions} onChange={setResolutionTypeFilter} tok={tok} /> },
                { key: 'settlementStage', label: 'Settlement Stage', isActive: !!settlementStageFilter, node: <Dropdown placeholder="Settlement Stage" value={settlementStageFilter} options={settlementStageFilterOptions} onChange={setSettlementStageFilter} tok={tok} /> },
              ]}
            />
            <button
              type="button"
              onClick={() => setShowAllRecords((v) => !v)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={
                showAllRecords
                  ? { border: `1px solid ${tok.accent}`, color: tok.accent, backgroundColor: tok.accent_soft }
                  : { border: `1px solid ${tok.border}`, color: tok.text_secondary, backgroundColor: tok.surface }
              }
            >
              {showAllRecords ? 'Showing All' : 'Show All'}
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <LayoutDropdown value={currentLayout} onChange={(val) => setViewState({ layer: 1, layout: val })} tok={tok} />
          <button
            type="button"
            onClick={() => setShowNewCaseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: tok.accent }}
          >
            <PlusIcon size={16} />
            New Refund Case
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {currentLayout === 'requests' ? (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: tok.surface, border: `1px solid ${tok.border}` }}>
            <table className="w-full">
              <thead style={{ backgroundColor: tok.table_header }}>
                <tr style={{ borderBottom: `1px solid ${tok.border}` }}>
                  {['Client', 'Order', 'Category', 'Request Stage', 'Proposed Resolution', 'Approved Resolution', 'Settlement Stage'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium capitalize tracking-wide" style={{ color: tok.text_secondary }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: tok.text_secondary }}>
                      No refund cases found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, idx) => {
                    const reqStage = requestStageField ? (record.getCellValue(requestStageField) as { name: string } | null)?.name ?? null : null;
                    const settStage = settlementStageField ? (record.getCellValue(settlementStageField) as { name: string } | null)?.name ?? null : null;
                    const resApproved = resolutionApprovedField ? (record.getCellValue(resolutionApprovedField) as { name: string } | null)?.name ?? null : null;
                    const resProposed = resolutionProposedField ? (record.getCellValue(resolutionProposedField) as { name: string } | null)?.name ?? null : null;
                    const clientLinked = clientField ? (record.getCellValue(clientField) as Array<{ id: string }> | null) : null;
                    const orderLinked = orderField ? (record.getCellValue(orderField) as Array<{ id: string }> | null) : null;
                    const categoryLinked = categoryField ? (record.getCellValue(categoryField) as Array<{ id: string }> | null) : null;
                    const categoryId = categoryLinked?.[0]?.id ?? null;
                    // Zebra base (Axel, 2026-09-02) — hover still overrides via
                    // tok.hover_bg on enter, then restores this row's own zebra
                    // tone (not 'transparent') on leave.
                    const rowBg = idx % 2 === 1 ? tok.table_zebra : tok.surface;

                    return (
                      <tr
                        key={record.id}
                        onClick={() => setViewState({ layer: 2, recordId: record.id, sourceLayout: 'requests' })}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: `1px solid ${tok.border_light}`, backgroundColor: rowBg }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = tok.hover_bg)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowBg)}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: tok.text_primary }}>
                          {clientLinked?.[0] ? clientNameById.get(clientLinked[0].id) ?? '—' : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: tok.text_primary }}>
                          {orderLinked?.[0] ? orderLabelById.get(orderLinked[0].id) ?? '—' : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <CategoryChip label={categoryId ? categoryNameById.get(categoryId) ?? null : null} categoryId={categoryId} orderedCategoryIds={orderedCategoryIds} />
                        </td>
                        <td className="px-4 py-3">
                          <StagePill value={reqStage} choices={requestStageChoices} />
                        </td>
                        <td className="px-4 py-3">
                          <StagePill value={resProposed} choices={resolutionProposedChoices} />
                        </td>
                        <td className="px-4 py-3">
                          <StagePill value={resApproved} choices={resolutionApprovedChoices} />
                        </td>
                        <td className="px-4 py-3">
                          <StagePill value={settStage} choices={settlementStageChoices} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 h-full">
            {(
              [
                { title: 'New Requests', records: requestedRecords, draggable: true, empty: 'No new requests.' },
                { title: 'Under Review', records: underReviewRecords, draggable: false, empty: 'No cases under review.' },
              ] as const
            ).map((col) => (
              <div className="flex flex-col" key={col.title}>
                <h2 className="text-base font-semibold mb-3" style={{ color: tok.text_primary }}>
                  {col.title} <span style={{ color: tok.text_muted, fontWeight: 400 }}>({col.records.length})</span>
                </h2>
                <div
                  onDragOver={col.draggable ? undefined : (e) => e.preventDefault()}
                  onDrop={col.draggable ? undefined : handleDropToUnderReview}
                  className="rounded-xl overflow-hidden flex-1 overflow-y-auto transition-colors"
                  style={{
                    backgroundColor: tok.surface,
                    border: `1px solid ${!col.draggable && draggedRecordId ? tok.accent : tok.border}`,
                    boxShadow: !col.draggable && draggedRecordId ? `0 0 0 2px ${tok.accent}4D` : undefined,
                  }}
                >
                  <table className="w-full">
                    <thead style={{ backgroundColor: tok.table_header }}>
                      <tr style={{ borderBottom: `1px solid ${tok.border}` }}>
                        {['Client', 'Category'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-medium capitalize tracking-wide" style={{ color: tok.text_secondary }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {col.records.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-sm" style={{ color: tok.text_secondary }}>
                            {col.empty}
                          </td>
                        </tr>
                      ) : (
                        col.records.map((record, idx) => {
                          const clientLinked = clientField ? (record.getCellValue(clientField) as Array<{ id: string }> | null) : null;
                          const categoryLinked = categoryField ? (record.getCellValue(categoryField) as Array<{ id: string }> | null) : null;
                          const categoryId = categoryLinked?.[0]?.id ?? null;
                          // Zebra base (Axel, 2026-09-02) — see the main
                          // "requests" table above for the same pattern.
                          const rowBg = idx % 2 === 1 ? tok.table_zebra : tok.surface;
                          return (
                            <tr
                              key={record.id}
                              draggable={col.draggable}
                              onDragStart={col.draggable ? () => setDraggedRecordId(record.id) : undefined}
                              onDragEnd={col.draggable ? () => setDraggedRecordId(null) : undefined}
                              onClick={() => setViewState({ layer: 2, recordId: record.id, sourceLayout: 'review' })}
                              className={`transition-colors ${col.draggable ? 'cursor-move' : 'cursor-pointer'}`}
                              style={{ borderBottom: `1px solid ${tok.border_light}`, backgroundColor: rowBg }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = tok.hover_bg)}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowBg)}
                            >
                              <td className="px-4 py-3 text-sm" style={{ color: tok.text_primary }}>
                                {clientLinked?.[0] ? clientNameById.get(clientLinked[0].id) ?? '—' : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <CategoryChip label={categoryId ? categoryNameById.get(categoryId) ?? null : null} categoryId={categoryId} orderedCategoryIds={orderedCategoryIds} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewCaseModal && (
        <NewRefundCaseModal
          draft={newCaseDraft}
          setDraft={setNewCaseDraft}
          onClose={() => setShowNewCaseModal(false)}
          onSubmit={handleNewCaseSubmit}
          clientsRecords={clientsRecords ?? []}
          ordersRecords={ordersRecords ?? []}
          orderItemsRecords={orderItemsRecords ?? []}
          categoriesRecords={categoriesRecords}
          clientsTable={clientsTable}
          ordersTable={ordersTable}
          orderItemsTable={orderItemsTable}
          categoriesTable={refundCategoriesTable}
          resolutionTypeChoices={resolutionProposedChoices}
          submitting={submittingNewCase}
          submitError={newCaseError}
          tok={tok}
        />
      )}

      <FeedbackButton onClick={() => setShowFeedbackModal(true)} tok={tok} />
      {showFeedbackModal && <FeedbackModal base={base} onClose={() => setShowFeedbackModal(false)} tok={tok} />}
    </div>
  );
}

initializeBlock({ interface: () => <RefundRequestsApp /> });

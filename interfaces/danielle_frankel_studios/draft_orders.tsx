import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  CellRenderer,
} from '@airtable/blocks/interface/ui';
import type { Table, Field, Record as AirtableRecord } from '@airtable/blocks/interface/models';
import {
  Plus as PlusIcon,
  X as XIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ArrowLeft as ArrowLeftIcon,
} from '@phosphor-icons/react';

const FIELD_IDS = {
  DRAFT_ID: 'fldXiofTxlsl3NSro',
  DRAFT_CLIENT: 'fldV0tUFndHpPYqDD',
  DRAFT_STYLE: 'fld6rRHCKAlANOviR',
  DRAFT_CUSTOMIZATIONS: 'fldN97WQmsI1M5J0g',
  DRAFT_RUSH_FEE: 'fldWXGAL7RkCbfQ5h',
  DRAFT_SHIPPING: 'fldcItXhwxpimLdyR',
  DRAFT_TAXES: 'fldLzzEF6NIoYdKMF',
  DRAFT_DISCOUNT: 'fldjyvFWtv5cr05nV',
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

  CLIENT_FULL_NAME: 'fldB3Wyam01D3wR5Q',
  CLIENT_STAGE: 'fldLcxVZvI1rigBlh',
  CLIENT_DUE_DATE: 'flddDJKkZDsOoCOzE',
  CLIENT_WEDDING_DATE: 'fldbgknumKGS5W5WU',
  CLIENT_DRAFT_ORDERS: 'fldynmy5OIWDVcgIn',
  CLIENT_FAVORITE_STYLES_ACUITY: 'fldZzNR0g5VEJ5RmX',
  CLIENT_FAVORITE_STYLES_APPOINTMENT: 'fldVw8wCgPKvxN1jD',

  STYLE_NAME: 'fldEs3chQAeplPc1w',
  STYLE_PRICE: 'flduZuxPxxMqXzNxD',
  STYLE_PHOTO: 'fldall9IlP5wEMb2W',
  STYLE_CATEGORY: 'fld0eUrQtGo5zFrbe',

  CUSTOMIZATION_ID: 'fldl9cIcV80nYEDwe',
  CUSTOMIZATION_CLIENT: 'fldOeL4VVcXaKwwlN',
  CUSTOMIZATION_CUSTOMIZED_STYLE: 'fldCaKP1d4C0aohQE',
  CUSTOMIZATION_DETAIL: 'fldg1hEoZe9MFQj02',
  CUSTOMIZATION_APPROVAL_STATUS: 'fldEfOYgxOhyDiMEH',
  CUSTOMIZATION_APPROVED_PRICING: 'fldFRRjwVlCgHhPdA',
  CUSTOMIZATION_PROPOSED_TOTAL: 'fldtF37zwwAPb5hjS',
  CUSTOMIZATION_EFFECTIVE_PRICE: 'fldFjHCKBNcWz6z0V',

  RUSH_RULE_WEEKS: 'fldQXdvm2BiegkSeM',
  RUSH_RULE_NON_CUSTOMIZED_PCT: 'flds560NGzla4hbfu',
} as const;

// TODO: populate once Julia confirms terminal stage values
const TERMINAL_STAGES: string[] = [];

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
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  return isDark ? COLORS.DARK : COLORS.LIGHT;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
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

function getCustomProperties(base: ReturnType<typeof useBase>) {
  return [
    { key: 'draftOrdersTable', label: 'Draft orders', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblp7foUmlN9823WW') },
    { key: 'clientsTable', label: 'Clients', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c') },
    { key: 'stylesTable', label: 'Styles', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbl0hWIRBbcB4UkVC') },
    { key: 'customizationsTable', label: 'Customizations', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbl7HUWDI7IRjWY92') },
    { key: 'rushFeeRulesTable', label: 'Rush fee rules', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbldXhthsHZJhMfDm') },
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
  const rushFeeRulesTable = customPropertyValueByKey.rushFeeRulesTable as Table | undefined;

  const draftRecords = useRecords(draftOrdersTable ?? null);
  const clientRecords = useRecords(clientsTable ?? null);
  const styleRecords = useRecords(stylesTable ?? null);
  const customizationRecords = useRecords(customizationsTable ?? null);
  const rushFeeRuleRecords = useRecords(rushFeeRulesTable ?? null);

  const [viewState, setViewState] = useState<ViewState>({ layer: 1 });

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

  if (!draftOrdersTable || !clientsTable || !stylesTable || !customizationsTable || !rushFeeRulesTable) {
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

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {viewState.layer === 1 && (
        <Layer1
          theme={theme}
          clientRecords={clientRecords ?? []}
          draftRecords={draftRecords ?? []}
          draftOrdersTable={draftOrdersTable}
          clientsTable={clientsTable}
          getField={getField}
          getLinkedRecordIds={getLinkedRecordIds}
          getMostRecentDraft={getMostRecentDraft}
          onClientClick={(clientId) => setViewState({ layer: 3, clientId })}
          onNewDraft={() => setViewState({ layer: 2, clientId: null, fromLayer: 1 })}
        />
      )}
      {viewState.layer === 3 && (
        <Layer3
          theme={theme}
          clientId={viewState.clientId}
          clientName={getClientName(viewState.clientId)}
          drafts={getDraftsForClient(viewState.clientId)}
          draftOrdersTable={draftOrdersTable}
          getField={getField}
          onClose={() => setViewState({ layer: 1 })}
          onDraftClick={(draftId) => setViewState({ layer: 4, draftId, clientId: viewState.clientId })}
          onNewDraft={() => setViewState({ layer: 2, clientId: viewState.clientId, fromLayer: 3 })}
        />
      )}
      {viewState.layer === 2 && (
        <Layer2
          theme={theme}
          clientId={viewState.clientId}
          clientRecords={clientRecords ?? []}
          styleRecords={styleRecords ?? []}
          customizationRecords={customizationRecords ?? []}
          rushFeeRuleRecords={rushFeeRuleRecords ?? []}
          draftOrdersTable={draftOrdersTable}
          clientsTable={clientsTable}
          stylesTable={stylesTable}
          customizationsTable={customizationsTable}
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
      {viewState.layer === 4 && (
        <Layer4
          theme={theme}
          draftId={viewState.draftId}
          clientId={viewState.clientId}
          draftRecords={draftRecords ?? []}
          styleRecords={styleRecords ?? []}
          customizationRecords={customizationRecords ?? []}
          rushFeeRuleRecords={rushFeeRuleRecords ?? []}
          clientRecords={clientRecords ?? []}
          draftOrdersTable={draftOrdersTable}
          stylesTable={stylesTable}
          customizationsTable={customizationsTable}
          rushFeeRulesTable={rushFeeRulesTable}
          clientsTable={clientsTable}
          getField={getField}
          getLinkedRecordIds={getLinkedRecordIds}
          getMostRecentDraft={getMostRecentDraft}
          getClientName={getClientName}
          onBack={() => setViewState({ layer: 3, clientId: viewState.clientId })}
        />
      )}
    </div>
  );
}

interface Layer1Props {
  theme: typeof COLORS.LIGHT;
  clientRecords: AirtableRecord[];
  draftRecords: AirtableRecord[];
  draftOrdersTable: Table;
  clientsTable: Table;
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
  draftOrdersTable,
  clientsTable,
  getField,
  getLinkedRecordIds,
  getMostRecentDraft,
  onClientClick,
  onNewDraft,
}: Layer1Props) {
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
  const grandTotalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_GRAND_TOTAL);
  const lockedField = getField(draftOrdersTable, FIELD_IDS.DRAFT_LOCKED);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.border }}>
        <h1 className="text-lg font-bold">Draft Orders</h1>
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

      <div className="flex-1 overflow-auto p-6">
        {activeClients.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: theme.textSecondary }}>No active clients with draft orders yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeClients.map(client => {
              const clientName = nameField ? client.getCellValueAsString(nameField) : 'Unknown';
              const draftCount = getLinkedRecordIds(client, draftOrdersField).length;
              const mostRecentDraft = getMostRecentDraft(client.id);
              const grandTotal = mostRecentDraft && grandTotalField 
                ? (mostRecentDraft.getCellValue(grandTotalField) as number | null)
                : null;
              const isLocked = mostRecentDraft && lockedField
                ? !!mostRecentDraft.getCellValue(lockedField)
                : false;

              return (
                <div
                  key={client.id}
                  onClick={() => onClientClick(client.id)}
                  className="flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors"
                  style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.bgCard; }}
                >
                  <div className="flex-1">
                    <p className="font-medium">{clientName}</p>
                    <p className="text-sm" style={{ color: theme.textSecondary }}>
                      {draftCount} draft{draftCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{formatCurrency(grandTotal)}</span>
                    <StatusPill label={isLocked ? 'Locked' : 'Unlocked'} variant={isLocked ? 'locked' : 'unlocked'} />
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
  drafts,
  draftOrdersTable,
  getField,
  onClose,
  onDraftClick,
  onNewDraft,
}: Layer3Props) {
  const labelField = getField(draftOrdersTable, FIELD_IDS.DRAFT_ID);
  const createdAtField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CREATED_AT);
  const grandTotalField = getField(draftOrdersTable, FIELD_IDS.DRAFT_GRAND_TOTAL);
  const lockedField = getField(draftOrdersTable, FIELD_IDS.DRAFT_LOCKED);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
      <div
        className="relative w-full max-h-[80vh] flex flex-col rounded-xl overflow-hidden"
        style={{ backgroundColor: theme.bgCard, maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-lg font-semibold">{clientName}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:cursor-pointer"
            style={{ color: theme.textSecondary }}
          >
            <XIcon size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {drafts.length === 0 ? (
            <p className="text-center py-8" style={{ color: theme.textSecondary }}>No drafts yet.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map(draft => {
                const label = labelField ? draft.getCellValueAsString(labelField) : 'Untitled';
                const createdAt = createdAtField ? (draft.getCellValue(createdAtField) as string | null) : null;
                const grandTotal = grandTotalField ? (draft.getCellValue(grandTotalField) as number | null) : null;
                const isLocked = lockedField ? !!draft.getCellValue(lockedField) : false;

                return (
                  <div
                    key={draft.id}
                    onClick={() => onDraftClick(draft.id)}
                    className="flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors"
                    style={{ backgroundColor: theme.bg, border: `1px solid ${theme.borderLight}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.bg; }}
                  >
                    <div>
                      <p className="font-medium">{label || 'Untitled Draft'}</p>
                      <p className="text-sm" style={{ color: theme.textSecondary }}>{formatDate(createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(grandTotal)}</span>
                      <StatusPill label={isLocked ? 'Locked' : 'Unlocked'} variant={isLocked ? 'locked' : 'unlocked'} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t" style={{ borderColor: theme.border }}>
          <button
            onClick={onNewDraft}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm font-medium"
            style={{ backgroundColor: theme.accent, color: '#FFFFFF' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.accent; }}
          >
            <PlusIcon size={16} weight="bold" />
            New Draft
          </button>
        </div>
      </div>
    </div>
  );
}

interface Layer2Props {
  theme: typeof COLORS.LIGHT;
  clientId: string | null;
  clientRecords: AirtableRecord[];
  styleRecords: AirtableRecord[];
  customizationRecords: AirtableRecord[];
  rushFeeRuleRecords: AirtableRecord[];
  draftOrdersTable: Table;
  clientsTable: Table;
  stylesTable: Table;
  customizationsTable: Table;
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
  rushFeeRuleRecords,
  draftOrdersTable,
  clientsTable,
  stylesTable,
  customizationsTable,
  rushFeeRulesTable,
  getField,
  getLinkedRecordIds,
  getClientName,
  onClose,
  onSave,
  onClientSelect,
}: Layer2Props) {
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [selectedCustomizationIds, setSelectedCustomizationIds] = useState<string[]>([]);
  const [shipping, setShipping] = useState('');
  const [taxes, setTaxes] = useState('');
  const [discount, setDiscount] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [styleSearchQuery, setStyleSearchQuery] = useState('');
  const [showStyleSearch, setShowStyleSearch] = useState(false);
  const [customizationSearchQuery, setCustomizationSearchQuery] = useState('');
  const [showCustomizationSearch, setShowCustomizationSearch] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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
  const customizationApprovalStatusField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_APPROVAL_STATUS);
  const customizationCustomizedStyleField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CUSTOMIZED_STYLE);
  const rushRuleWeeksField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_WEEKS);
  const rushRuleNonCustomizedPctField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_NON_CUSTOMIZED_PCT);
  const clientFavoriteStylesAcuityField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_ACUITY);
  const clientFavoriteStylesAppointmentField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_APPOINTMENT);

  const hasUnsavedChanges = selectedStyleIds.length > 0
    || selectedCustomizationIds.length > 0
    || [shipping, taxes, discount].some(v => v.trim() !== '');

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
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

  const eligibleStyleIds = useMemo(() => {
    if (!clientId) return [];
    const client = clientRecords.find(c => c.id === clientId);
    if (!client) return [];
    const idsFromAcuity = getLinkedRecordIds(client, clientFavoriteStylesAcuityField);
    const idsFromAppointment = getLinkedRecordIds(client, clientFavoriteStylesAppointmentField);
    return Array.from(new Set([...idsFromAcuity, ...idsFromAppointment]));
  }, [clientId, clientRecords, clientFavoriteStylesAcuityField, clientFavoriteStylesAppointmentField, getLinkedRecordIds]);

  const eligibleStyles = useMemo(() => {
    if (eligibleStyleIds.length === 0) return styleRecords;
    return styleRecords.filter(s => eligibleStyleIds.includes(s.id));
  }, [styleRecords, eligibleStyleIds]);

  const filteredStyles = useMemo(() => {
    if (!styleSearchQuery.trim()) return eligibleStyles.slice(0, 20);
    const query = styleSearchQuery.toLowerCase();
    return eligibleStyles.filter(style => {
      const name = styleNameField ? style.getCellValueAsString(styleNameField).toLowerCase() : '';
      return name.includes(query);
    }).slice(0, 20);
  }, [eligibleStyles, styleSearchQuery, styleNameField]);

  const clientCustomizations = useMemo(() => {
    if (!clientId) return [];
    return customizationRecords.filter(customization => {
      const linkedClients = getLinkedRecordIds(customization, customizationClientField);
      return linkedClients.includes(clientId);
    });
  }, [customizationRecords, clientId, customizationClientField, getLinkedRecordIds]);

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

  const clientDueDate = useMemo(() => {
    if (!clientId) return null;
    const client = clientRecords.find(c => c.id === clientId);
    if (!client || !clientDueDateField) return null;
    const dueDateStr = client.getCellValueAsString(clientDueDateField);
    return dueDateStr ? new Date(dueDateStr) : null;
  }, [clientId, clientRecords, clientDueDateField]);

  const clientWeddingDate = useMemo(() => {
    if (!clientId) return null;
    const client = clientRecords.find(c => c.id === clientId);
    if (!client || !clientWeddingDateField) return null;
    const weddingDateStr = client.getCellValueAsString(clientWeddingDateField);
    return weddingDateStr ? new Date(weddingDateStr) : null;
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

  const total = useMemo(() => {
    const ship = parseCurrency(shipping);
    const tax = parseCurrency(taxes);
    const disc = parseCurrency(discount);
    return rushFee + ship + tax - disc;
  }, [rushFee, shipping, taxes, discount]);

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
      const shippingFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_SHIPPING);
      const taxesFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_TAXES);
      const discountFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT);

      const fields: Record<string, unknown> = {};

      if (clientFieldObj) fields[clientFieldObj.id] = [{ id: clientId }];
      if (styleFieldObj) fields[styleFieldObj.id] = selectedStyleIds.map(id => ({ id }));
      if (customizationsFieldObj) fields[customizationsFieldObj.id] = selectedCustomizationIds.map(id => ({ id }));
      if (rushFeeFieldObj) fields[rushFeeFieldObj.id] = rushFee;
      if (shippingFieldObj) fields[shippingFieldObj.id] = parseCurrency(shipping);
      if (taxesFieldObj) fields[taxesFieldObj.id] = parseCurrency(taxes);
      if (discountFieldObj) fields[discountFieldObj.id] = parseCurrency(discount);

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
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
      <div
        className="relative w-full max-h-[90vh] flex flex-col rounded-xl overflow-hidden"
        style={{ backgroundColor: theme.bgCard, maxWidth: '720px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-lg font-semibold">New Draft Order</h2>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div ref={clientSearchRef} className="relative">
            <label className="block text-sm font-medium mb-2">Client</label>
            <div className="relative">
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
                }}
                readOnly={!!clientId}
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
            </div>
            {showClientSearch && !clientId && clientSearchQuery.trim() !== '' && (
              <div
                className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg"
                style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
              >
                {filteredClients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => {
                      onClientSelect(client.id);
                      setShowClientSearch(false);
                      setClientSearchQuery(clientNameField ? client.getCellValueAsString(clientNameField) : '');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer"
                    style={{ color: theme.text }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {clientNameField ? client.getCellValueAsString(clientNameField) : 'Unknown'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Styles</label>
            <div ref={styleSearchRef} className="relative mb-2">
              <MagnifyingGlassIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: theme.textMuted }}
              />
              <input
                type="text"
                placeholder={clientId ? 'Search styles...' : 'Select a client first'}
                value={styleSearchQuery}
                onChange={e => setStyleSearchQuery(e.target.value)}
                onFocus={() => { if (clientId) setShowStyleSearch(true); }}
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
                  {filteredStyles.map(style => {
                    const isSelected = selectedStyleIds.includes(style.id);
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
                        className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer flex justify-between"
                        style={{ color: theme.text, backgroundColor: isSelected ? theme.accentSoft : 'transparent' }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = theme.bgHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? theme.accentSoft : 'transparent'; }}
                      >
                        <span className={isSelected ? 'font-medium' : ''}>{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</span>
                        <span style={{ color: theme.textSecondary }}>
                          {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedStyles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedStyles.map(style => (
                  <div
                    key={style.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: theme.bg, border: `1px solid ${theme.borderLight}` }}
                  >
                    <span className="text-sm whitespace-nowrap">{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</span>
                    <span className="text-sm whitespace-nowrap" style={{ color: theme.textSecondary }}>
                      {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                    </span>
                    <button
                      onClick={() => setSelectedStyleIds(selectedStyleIds.filter(id => id !== style.id))}
                      className="p-0.5 rounded hover:cursor-pointer"
                      style={{ color: theme.textMuted }}
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {clientId && clientCustomizations.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Customizations</label>
                  <div ref={customizationSearchRef} className="relative mb-2">
                    <MagnifyingGlassIcon 
                      size={16} 
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: theme.textMuted }}
                    />
                    <input
                      type="text"
                      placeholder="Search customizations..."
                      value={customizationSearchQuery}
                      onChange={e => setCustomizationSearchQuery(e.target.value)}
                      onFocus={() => setShowCustomizationSearch(true)}
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
                        {filteredCustomizations.map(customization => {
                          const isSelected = selectedCustomizationIds.includes(customization.id);
                          const approvalStatus = customizationApprovalStatusField
                            ? customization.getCellValueAsString(customizationApprovalStatusField)
                            : '';
                          const isTentative = approvalStatus !== 'Approved by Client';
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
                              style={{ color: theme.text, backgroundColor: isSelected ? theme.accentSoft : 'transparent' }}
                              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = theme.bgHover; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? theme.accentSoft : 'transparent'; }}
                            >
                              <div className="flex items-center justify-between">
                                <span className={isSelected ? 'font-medium' : ''}>{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</span>
                                <div className="flex items-center gap-2">
                                  {isTentative && <StatusPill label="Tentative" variant="tentative" />}
                                  <span style={{ color: theme.textSecondary }}>
                                    {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {selectedCustomizations.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomizations.map(customization => (
                        <div
                          key={customization.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                          style={{ backgroundColor: theme.bg, border: `1px solid ${theme.borderLight}` }}
                        >
                          <span className="text-sm whitespace-nowrap">{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</span>
                          <span className="text-sm whitespace-nowrap" style={{ color: theme.textSecondary }}>
                            {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                          </span>
                          <button
                            onClick={() => setSelectedCustomizationIds(selectedCustomizationIds.filter(id => id !== customization.id))}
                            className="p-0.5 rounded hover:cursor-pointer"
                            style={{ color: theme.textMuted }}
                          >
                            <XIcon size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          )}

          <div className="pt-4 border-t" style={{ borderColor: theme.borderLight }}>
            <h3 className="text-sm font-semibold mb-3">Additional Charges</h3>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm">Rush Fee</span>
                <span className="text-xs ml-2" style={{ color: theme.textMuted }}>(auto-calculated)</span>
              </div>
              <span className="text-sm font-medium">{formatCurrency(rushFee)}</span>
            </div>
            {clientDueDate && clientWeddingDate && (
              <p className="text-xs mb-2" style={{ color: theme.textSecondary }}>
                Wedding Date: {formatDate(clientWeddingDate.toISOString())} · Due Date: {formatDate(clientDueDate.toISOString())} · {weeksUntilDueDate} weeks until due date
              </p>
            )}
            {!clientDueDate && clientId && (
              <p className="text-xs mb-2" style={{ color: theme.textSecondary }}>
                Rush fee requires a wedding date on file.
              </p>
            )}
            
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: theme.textSecondary }}>Shipping</label>
                <input
                  type="text"
                  placeholder="$0.00"
                  value={shipping}
                  onChange={e => setShipping(e.target.value)}
                  disabled={!clientId}
                  className="w-full px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    color: theme.text
                  }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: theme.textSecondary }}>Taxes</label>
                <input
                  type="text"
                  placeholder="$0.00"
                  value={taxes}
                  onChange={e => setTaxes(e.target.value)}
                  disabled={!clientId}
                  className="w-full px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    color: theme.text
                  }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: theme.textSecondary }}>Discount</label>
                <input
                  type="text"
                  placeholder="$0.00"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  disabled={!clientId}
                  className="w-full px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    color: theme.text
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t" style={{ borderColor: theme.borderLight }}>
            <h3 className="text-sm font-semibold mb-3">Preview</h3>
            <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
              Saves automatically once you click Save Draft
            </p>
            <div className="space-y-2 text-sm">
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
              {total !== 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Total (fees - discount)</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              )}
              {grandTotal !== 0 && (
                <div className="flex justify-between pt-2 border-t font-semibold" style={{ borderColor: theme.borderLight }}>
                  <span>Grand Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              )}
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
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
          <div
            className="relative w-full rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.bgCard, maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${theme.border}` }}
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
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 rounded-md shadow-xs hover:shadow-sm hover:cursor-pointer text-sm"
                style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
              >
                Keep Editing
              </button>
              <button
                onClick={onClose}
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
  rushFeeRuleRecords: AirtableRecord[];
  clientRecords: AirtableRecord[];
  draftOrdersTable: Table;
  stylesTable: Table;
  customizationsTable: Table;
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
  rushFeeRuleRecords,
  clientRecords,
  draftOrdersTable,
  stylesTable,
  customizationsTable,
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

  const labelField = getField(draftOrdersTable, FIELD_IDS.DRAFT_ID);
  const createdAtField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CREATED_AT);
  const lockedField = getField(draftOrdersTable, FIELD_IDS.DRAFT_LOCKED);
  const styleField = getField(draftOrdersTable, FIELD_IDS.DRAFT_STYLE);
  const customizationsField = getField(draftOrdersTable, FIELD_IDS.DRAFT_CUSTOMIZATIONS);
  const rushFeeField = getField(draftOrdersTable, FIELD_IDS.DRAFT_RUSH_FEE);
  const shippingField = getField(draftOrdersTable, FIELD_IDS.DRAFT_SHIPPING);
  const taxesField = getField(draftOrdersTable, FIELD_IDS.DRAFT_TAXES);
  const discountField = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT);
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
  const customizationApprovalStatusField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_APPROVAL_STATUS);
  const customizationClientField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CLIENT);
  const customizationCustomizedStyleField = getField(customizationsTable, FIELD_IDS.CUSTOMIZATION_CUSTOMIZED_STYLE);
  const clientDueDateField = getField(clientsTable, FIELD_IDS.CLIENT_DUE_DATE);
  const rushRuleWeeksField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_WEEKS);
  const rushRuleNonCustomizedPctField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_NON_CUSTOMIZED_PCT);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [styleSearchQuery, setStyleSearchQuery] = useState('');
  const [showStyleSearch, setShowStyleSearch] = useState(false);
  const [customizationSearchQuery, setCustomizationSearchQuery] = useState('');
  const [showCustomizationSearch, setShowCustomizationSearch] = useState(false);

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

  const clientCustomizations = useMemo(() => {
    return customizationRecords.filter(customization => {
      const linkedClients = getLinkedRecordIds(customization, customizationClientField);
      return linkedClients.includes(clientId);
    });
  }, [customizationRecords, clientId, customizationClientField, getLinkedRecordIds]);

  const filteredStyles = useMemo(() => {
    if (!styleSearchQuery.trim()) return styleRecords.slice(0, 20);
    const query = styleSearchQuery.toLowerCase();
    return styleRecords.filter(style => {
      const name = styleNameField ? style.getCellValueAsString(styleNameField).toLowerCase() : '';
      return name.includes(query);
    }).slice(0, 20);
  }, [styleRecords, styleSearchQuery, styleNameField]);

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
    const dueDateStr = client.getCellValueAsString(clientDueDateField);
    return dueDateStr ? new Date(dueDateStr) : null;
  }, [clientId, clientRecords, clientDueDateField]);

  const weddingDate = useMemo(() => {
    if (!draft || !weddingDateField) return null;
    const dateStr = draft.getCellValueAsString(weddingDateField);
    return dateStr ? new Date(dateStr) : null;
  }, [draft, weddingDateField]);

  const dueDate = useMemo(() => {
    if (!draft || !dueDateField) return null;
    const dateStr = draft.getCellValueAsString(dueDateField);
    return dateStr ? new Date(dateStr) : null;
  }, [draft, dueDateField]);

  const weeksUntilDueDate = useMemo(() => {
    if (!dueDate) return null;
    const today = new Date();
    return Math.floor((dueDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }, [dueDate]);

  if (!draft) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p style={{ color: theme.textSecondary }}>Draft not found.</p>
      </div>
    );
  }

  const label = labelField ? draft.getCellValueAsString(labelField) : 'Untitled';
  const createdAt = createdAtField ? (draft.getCellValue(createdAtField) as string | null) : null;
  const isLocked = lockedField ? !!draft.getCellValue(lockedField) : false;
  const linkedStyleIds = getLinkedRecordIds(draft, styleField);
  const linkedCustomizationIds = getLinkedRecordIds(draft, customizationsField);
  const rushFee = rushFeeField ? (draft.getCellValue(rushFeeField) as number | null) ?? 0 : 0;
  const shipping = shippingField ? (draft.getCellValue(shippingField) as number | null) ?? 0 : 0;
  const taxes = taxesField ? (draft.getCellValue(taxesField) as number | null) ?? 0 : 0;
  const discount = discountField ? (draft.getCellValue(discountField) as number | null) ?? 0 : 0;
  const styleSubtotal = styleSubtotalField ? (draft.getCellValue(styleSubtotalField) as number | null) ?? 0 : 0;
  const customizationSubtotal = customizationSubtotalField ? (draft.getCellValue(customizationSubtotalField) as number | null) ?? 0 : 0;
  const total = totalField ? (draft.getCellValue(totalField) as number | null) ?? 0 : 0;
  const grandTotal = grandTotalField ? (draft.getCellValue(grandTotalField) as number | null) ?? 0 : 0;
  const leadTime = leadTimeField ? (draft.getCellValue(leadTimeField) as number | null) : null;

  const mostRecentDraft = getMostRecentDraft(clientId);
  const isMostRecent = mostRecentDraft?.id === draftId;
  const isEditable = isMostRecent && !isLocked && canUpdate;

  let readOnlyReason = '';
  if (!canUpdate) {
    readOnlyReason = 'You don\'t have permission to edit.';
  } else if (!isMostRecent) {
    readOnlyReason = 'A newer draft exists for this client.';
  } else if (isLocked) {
    readOnlyReason = 'This draft is locked.';
  }

  const linkedStyles = styleRecords.filter(s => linkedStyleIds.includes(s.id));
  const linkedCustomizations = customizationRecords.filter(c => linkedCustomizationIds.includes(c.id));

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
    const numValue = parseCurrency(value);
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm hover:cursor-pointer"
            style={{ color: theme.textSecondary }}
          >
            <ArrowLeftIcon size={16} />
            Back
          </button>
          <div>
            <h1 className="text-lg font-bold">{label || 'Untitled Draft'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm" style={{ color: theme.textSecondary }}>{formatDate(createdAt)}</span>
              <StatusPill label={isLocked ? 'Locked' : 'Unlocked'} variant={isLocked ? 'locked' : 'unlocked'} />
            </div>
          </div>
        </div>
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

      {!isEditable && (
        <div className="px-6 py-3" style={{ backgroundColor: theme.neutralBg }}>
          <p className="text-sm" style={{ color: theme.textSecondary }}>
            This draft is read-only — {readOnlyReason}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <h2 className="text-sm font-semibold mb-3">Client</h2>
          <p className="text-base">{getClientName(clientId)}</p>
        </div>

        <div className="p-4 rounded-lg" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <h2 className="text-sm font-semibold mb-3">Styles</h2>
          {isEditable && (
            <div ref={styleSearchRef} className="relative mb-3">
              <MagnifyingGlassIcon 
                size={16} 
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: theme.textMuted }}
              />
              <input
                type="text"
                placeholder="Add style..."
                value={styleSearchQuery}
                onChange={e => setStyleSearchQuery(e.target.value)}
                onFocus={() => setShowStyleSearch(true)}
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
                  {filteredStyles
                    .filter(s => !linkedStyleIds.includes(s.id))
                    .map(style => (
                      <button
                        key={style.id}
                        onClick={() => handleAddStyle(style.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer flex justify-between"
                        style={{ color: theme.text }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span>{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</span>
                        <span style={{ color: theme.textSecondary }}>
                          {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
          {fieldErrors.styles && <p className="text-xs mb-2" style={{ color: theme.danger }}>{fieldErrors.styles}</p>}
          {linkedStyles.length === 0 ? (
            <p className="text-sm" style={{ color: theme.textSecondary }}>No styles selected.</p>
          ) : (
            <div className="space-y-1">
              {linkedStyles.map(style => (
                <div 
                  key={style.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md"
                  style={{ backgroundColor: theme.bg, border: `1px solid ${theme.borderLight}` }}
                >
                  <span className="text-sm">{styleNameField ? style.getCellValueAsString(styleNameField) : 'Unknown'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: theme.textSecondary }}>
                      {formatCurrency(stylePriceField ? (style.getCellValue(stylePriceField) as number | null) : null)}
                    </span>
                    {isEditable && (
                      <button
                        onClick={() => handleRemoveStyle(style.id)}
                        className="p-0.5 rounded hover:cursor-pointer"
                        style={{ color: theme.textMuted }}
                      >
                        <XIcon size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between mt-3 pt-3 border-t" style={{ borderColor: theme.borderLight }}>
            <span className="text-sm font-medium">Style Subtotal</span>
            <span className="text-sm font-medium">{formatCurrency(styleSubtotal)}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <h2 className="text-sm font-semibold mb-3">Customizations</h2>
          {isEditable && clientCustomizations.length > 0 && (
            <div ref={customizationSearchRef} className="relative mb-3">
              <MagnifyingGlassIcon 
                size={16} 
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: theme.textMuted }}
              />
              <input
                type="text"
                placeholder="Add customization..."
                value={customizationSearchQuery}
                onChange={e => setCustomizationSearchQuery(e.target.value)}
                onFocus={() => setShowCustomizationSearch(true)}
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
                    .map(customization => {
                      const approvalStatus = customizationApprovalStatusField 
                        ? customization.getCellValueAsString(customizationApprovalStatusField) 
                        : '';
                      const isTentative = approvalStatus !== 'Approved by Client';
                      return (
                        <button
                          key={customization.id}
                          onClick={() => handleAddCustomization(customization.id)}
                          className="w-full text-left px-3 py-2 text-sm hover:cursor-pointer"
                          style={{ color: theme.text }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div className="flex items-center justify-between">
                            <span>{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</span>
                            <div className="flex items-center gap-2">
                              {isTentative && <StatusPill label="Tentative" variant="tentative" />}
                              <span style={{ color: theme.textSecondary }}>
                                {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}
          {fieldErrors.customizations && <p className="text-xs mb-2" style={{ color: theme.danger }}>{fieldErrors.customizations}</p>}
          {clientCustomizations.length === 0 ? (
            <p className="text-sm" style={{ color: theme.textSecondary }}>No customizations for this client.</p>
          ) : linkedCustomizations.length === 0 ? (
            <p className="text-sm" style={{ color: theme.textSecondary }}>No customizations selected.</p>
          ) : (
            <div className="space-y-1">
              {linkedCustomizations.map(customization => {
                const approvalStatus = customizationApprovalStatusField 
                  ? customization.getCellValueAsString(customizationApprovalStatusField) 
                  : '';
                const isTentative = approvalStatus !== 'Approved by Client';
                return (
                  <div 
                    key={customization.id}
                    className="px-3 py-2 rounded-md"
                    style={{ backgroundColor: theme.bg, border: `1px solid ${theme.borderLight}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{customizationIdField ? customization.getCellValueAsString(customizationIdField) : 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        {isTentative && <StatusPill label="Tentative" variant="tentative" />}
                        <span className="text-sm" style={{ color: theme.textSecondary }}>
                          {formatCurrency(customizationEffectivePriceField ? (customization.getCellValue(customizationEffectivePriceField) as number | null) : null)}
                        </span>
                        {isEditable && (
                          <button
                            onClick={() => handleRemoveCustomization(customization.id)}
                            className="p-0.5 rounded hover:cursor-pointer"
                            style={{ color: theme.textMuted }}
                          >
                            <XIcon size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                      {customizationDetailField ? customization.getCellValueAsString(customizationDetailField) : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between mt-3 pt-3 border-t" style={{ borderColor: theme.borderLight }}>
            <span className="text-sm font-medium">Customization Subtotal</span>
            <span className="text-sm font-medium">{formatCurrency(customizationSubtotal)}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <h2 className="text-sm font-semibold mb-3">Additional Charges</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm">Rush Fee</span>
                <span className="text-xs ml-2" style={{ color: theme.textMuted }}>(auto-calculated)</span>
              </div>
              <span className="text-sm font-medium">{formatCurrency(rushFee)}</span>
            </div>
            {weddingDate && dueDate && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                Wedding Date: {formatDate(weddingDate.toISOString())} · Due Date: {formatDate(dueDate.toISOString())} · {weeksUntilDueDate} weeks until due date
                {leadTime !== null && ` · Lead Time: ${leadTime} weeks`}
              </p>
            )}
            {!clientDueDate && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                Rush fee requires a wedding date on file.
              </p>
            )}

            {isEditable ? (
              <div className="grid grid-cols-3 gap-3">
                <CurrencyInput
                  label="Shipping"
                  value={shipping}
                  field={shippingField}
                  fieldKey="shipping"
                  error={fieldErrors.shipping}
                  theme={theme}
                  onBlur={handleCurrencyBlur}
                />
                <CurrencyInput
                  label="Taxes"
                  value={taxes}
                  field={taxesField}
                  fieldKey="taxes"
                  error={fieldErrors.taxes}
                  theme={theme}
                  onBlur={handleCurrencyBlur}
                />
                <CurrencyInput
                  label="Discount"
                  value={discount}
                  field={discountField}
                  fieldKey="discount"
                  error={fieldErrors.discount}
                  theme={theme}
                  onBlur={handleCurrencyBlur}
                />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Shipping</span>
                  <span>{formatCurrency(shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Taxes</span>
                  <span>{formatCurrency(taxes)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Discount</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-3 border-t" style={{ borderColor: theme.borderLight }}>
              <span className="text-sm font-medium">Total (fees − discount)</span>
              <span className="text-sm font-medium">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg" style={{ backgroundColor: theme.accentSoft, border: `1px solid ${theme.accent}` }}>
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold">Grand Total</span>
            <span className="text-xl font-bold">{formatCurrency(grandTotal)}</span>
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
}

function CurrencyInput({ label, value, field, fieldKey, error, theme, onBlur }: CurrencyInputProps) {
  const [localValue, setLocalValue] = useState(formatCurrency(value));
  
  useEffect(() => {
    setLocalValue(formatCurrency(value));
  }, [value]);

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: theme.textSecondary }}>{label}</label>
      <input
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => onBlur(field, localValue, fieldKey)}
        className="w-full px-3 py-2 rounded-md text-sm"
        style={{ 
          backgroundColor: theme.bg, 
          border: `1px solid ${error ? theme.danger : theme.border}`,
          color: theme.text 
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: theme.danger }}>{error}</p>}
    </div>
  );
}

initializeBlock({ interface: () => <DraftOrdersApp /> });
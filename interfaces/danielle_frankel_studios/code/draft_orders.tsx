import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  CellRenderer,
  useColorScheme,
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

  CLIENT_FULL_NAME: 'fldB3Wyam01D3wR5Q',
  CLIENT_STAGE: 'fldLcxVZvI1rigBlh',
  CLIENT_DUE_DATE: 'flddDJKkZDsOoCOzE',
  CLIENT_WEDDING_DATE: 'fldbgknumKGS5W5WU',
  CLIENT_DRAFT_ORDERS: 'fldynmy5OIWDVcgIn',
  CLIENT_FAVORITE_STYLES_ACUITY: 'fldZzNR0g5VEJ5RmX',
  CLIENT_FAVORITE_STYLES_APPOINTMENT: 'fldVw8wCgPKvxN1jD',
  CLIENT_SALES_ASSOCIATE: 'fldBTKBaw8YvNAlwK',

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
  CUSTOMIZATION_APPROVAL_STATUS: 'fldEfOYgxOhyDiMEH',
  CUSTOMIZATION_APPROVED_PRICING: 'fldFRRjwVlCgHhPdA',
  CUSTOMIZATION_PROPOSED_TOTAL: 'fldtF37zwwAPb5hjS',
  CUSTOMIZATION_EFFECTIVE_PRICE: 'fldFjHCKBNcWz6z0V',

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

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return '$0.00';
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

function getCustomProperties(base: ReturnType<typeof useBase>) {
  return [
    { key: 'draftOrdersTable', label: 'Draft orders', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblp7foUmlN9823WW') },
    { key: 'clientsTable', label: 'Clients', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c') },
    { key: 'stylesTable', label: 'Styles', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbl0hWIRBbcB4UkVC') },
    { key: 'customizationsTable', label: 'Customizations', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbl7HUWDI7IRjWY92') },
    { key: 'stateCostsTable', label: 'State costs', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblMnPV8Z00QePma9') },
    { key: 'rushFeeRulesTable', label: 'Rush fee rules', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tbldXhthsHZJhMfDm') },
    { key: 'staffTable', label: 'Staff', type: 'table' as const, defaultValue: base.getTableByIdIfExists('tblbYk88xJ8FQrLS4') },
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
  const [selectedStateCostId, setSelectedStateCostId] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [taxesNotes, setTaxesNotes] = useState('');
  const [discountNotes, setDiscountNotes] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
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
  const stateCostNameField = getField(stateCostsTable, FIELD_IDS.STATE_COST_NAME);
  const stateCostShippingFeeField = getField(stateCostsTable, FIELD_IDS.STATE_COST_SHIPPING_FEE);
  const stateCostTaxRateField = getField(stateCostsTable, FIELD_IDS.STATE_COST_TAX_RATE);
  const rushRuleWeeksField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_WEEKS);
  const rushRuleNonCustomizedPctField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_NON_CUSTOMIZED_PCT);
  const clientFavoriteStylesAcuityField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_ACUITY);
  const clientFavoriteStylesAppointmentField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_APPOINTMENT);

  const hasUnsavedChanges = selectedStyleIds.length > 0
    || selectedCustomizationIds.length > 0
    || !!selectedStateCostId
    || discount.trim() !== '';

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

  // Only customizations linked to the client AND to one of the currently
  // selected styles — a customization tied to a style that isn't in this
  // draft has nothing to do with it.
  const clientCustomizations = useMemo(() => {
    if (!clientId || selectedStyleIds.length === 0) return [];
    return customizationRecords.filter(customization => {
      const linkedClients = getLinkedRecordIds(customization, customizationClientField);
      if (!linkedClients.includes(clientId)) return false;
      const linkedStyles = getLinkedRecordIds(customization, customizationCustomizedStyleField);
      return linkedStyles.some(id => selectedStyleIds.includes(id));
    });
  }, [customizationRecords, clientId, customizationClientField, customizationCustomizedStyleField, selectedStyleIds, getLinkedRecordIds]);

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

  const selectedStateCost = useMemo(() => {
    return selectedStateCostId ? stateCostRecords.find(r => r.id === selectedStateCostId) ?? null : null;
  }, [stateCostRecords, selectedStateCostId]);

  // Live preview of Shipping (lookup) and Taxes (formula), computed here since
  // Airtable can't calculate either until the draft is actually saved with a
  // linked state_costs record.
  const previewShipping = useMemo(() => {
    if (!selectedStateCost || !stateCostShippingFeeField) return 0;
    return (selectedStateCost.getCellValue(stateCostShippingFeeField) as number | null) ?? 0;
  }, [selectedStateCost, stateCostShippingFeeField]);

  const previewTaxes = useMemo(() => {
    if (!selectedStateCost || !stateCostTaxRateField) return 0;
    const rate = (selectedStateCost.getCellValue(stateCostTaxRateField) as number | null) ?? 0;
    return (styleSubtotal + customizationSubtotal) * rate;
  }, [selectedStateCost, stateCostTaxRateField, styleSubtotal, customizationSubtotal]);

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

  const total = useMemo(() => {
    const disc = parseCurrency(discount);
    return rushFee + previewShipping + previewTaxes - disc;
  }, [rushFee, previewShipping, previewTaxes, discount]);

  const grandTotal = useMemo(() => {
    return styleSubtotal + customizationSubtotal + total;
  }, [styleSubtotal, customizationSubtotal, total]);

  const canSave = canCreate && !!clientId && selectedStyleIds.length > 0 && !!selectedStateCostId;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const clientFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_CLIENT);
      const styleFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_STYLE);
      const customizationsFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_CUSTOMIZATIONS);
      const stateCostsFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_STATE_COSTS);
      const rushFeeFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_RUSH_FEE);
      const discountFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT);
      const shippingNotesFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_SHIPPING_NOTES);
      const taxesNotesFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_TAXES_NOTES);
      const discountNotesFieldObj = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_NOTES);

      const fields: Record<string, unknown> = {};

      if (clientFieldObj) fields[clientFieldObj.id] = [{ id: clientId }];
      if (styleFieldObj) fields[styleFieldObj.id] = selectedStyleIds.map(id => ({ id }));
      if (customizationsFieldObj) fields[customizationsFieldObj.id] = selectedCustomizationIds.map(id => ({ id }));
      if (stateCostsFieldObj && selectedStateCostId) fields[stateCostsFieldObj.id] = [{ id: selectedStateCostId }];
      if (rushFeeFieldObj) fields[rushFeeFieldObj.id] = rushFee;
      // Shipping/Taxes are no longer writable — shipping is a lookup and taxes
      // a formula, both derived from state_costs, so they aren't in this payload.
      if (discountFieldObj) fields[discountFieldObj.id] = parseCurrency(discount);
      if (shippingNotesFieldObj && shippingNotes.trim()) fields[shippingNotesFieldObj.id] = shippingNotes.trim();
      if (taxesNotesFieldObj && taxesNotes.trim()) fields[taxesNotesFieldObj.id] = taxesNotes.trim();
      if (discountNotesFieldObj && discountNotes.trim()) fields[discountNotesFieldObj.id] = discountNotes.trim();

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
                <h2 className="text-base font-semibold">
                  State Costs<span style={{ color: theme.danger }}> *</span>
                </h2>
                <StateCostPicker
                  theme={theme}
                  records={stateCostRecords}
                  nameField={stateCostNameField}
                  selectedId={selectedStateCostId}
                  onSelect={setSelectedStateCostId}
                />
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
                          if (!showStyleSearch || eligibleStyleIds.length === 0 && styleSearchQuery.trim() === '') return;
                          if (filteredStyles.length === 0) return;
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
                          {eligibleStyleIds.length === 0 && styleSearchQuery.trim() === '' ? (
                            <p className="px-3 py-2 text-sm" style={{ color: theme.textSecondary }}>
                              This client doesn't have pre-selected styles. Start typing to search styles.
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

              {clientId && clientCustomizations.length > 0 && (
                <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-base font-semibold">Customizations</h2>
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
                    </div>
                    {selectedCustomizations.length === 0 ? (
                      <p className="text-sm" style={{ color: theme.textSecondary }}>No customizations selected.</p>
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
                      {rushFee !== 0 && (
                        <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                          <td className="py-3 pl-4" style={{ backgroundColor: theme.neutralBg }}>Rush Fee</td>
                          <td className="py-3 pr-2 text-right whitespace-nowrap" style={{ backgroundColor: theme.neutralBg }}>{formatCurrency(rushFee)}</td>
                          <td className="py-3 pl-3 pr-4 text-xs" style={{ color: theme.textMuted, backgroundColor: theme.neutralBg }}>
                            {clientDueDate && weeksUntilDueDate !== null &&
                              `Due date to have the styles ready is in ${weeksUntilDueDate} week${weeksUntilDueDate === 1 ? '' : 's'}, on ${formatDate(clientDueDate.toISOString())}.`}
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                        <td className="py-3 pl-4">Shipping</td>
                        <td className="py-3 pr-2 text-right">{formatCurrency(previewShipping)}</td>
                        <td className="py-3 pl-3 pr-4">
                          <input
                            type="text"
                            placeholder="Notes..."
                            value={shippingNotes}
                            onChange={e => setShippingNotes(e.target.value)}
                            disabled={!clientId}
                            className="w-full px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: 'transparent', border: 'none', color: theme.text }}
                          />
                        </td>
                      </tr>
                      <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                        <td className="py-3 pl-4">Taxes</td>
                        <td className="py-3 pr-2 text-right">{formatCurrency(previewTaxes)}</td>
                        <td className="py-3 pl-3 pr-4">
                          <input
                            type="text"
                            placeholder="Notes..."
                            value={taxesNotes}
                            onChange={e => setTaxesNotes(e.target.value)}
                            disabled={!clientId}
                            className="w-full px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: 'transparent', border: 'none', color: theme.text }}
                          />
                        </td>
                      </tr>
                      <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                        <td className="py-3 pl-4">Discount</td>
                        <td className="py-3">
                          <input
                            type="text"
                            placeholder="$0.00"
                            value={discount}
                            onChange={e => setDiscount(e.target.value)}
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
                {rushFee !== 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: theme.textSecondary }}>Rush Fee</span>
                    <span>{formatCurrency(rushFee)}</span>
                  </div>
                )}
                {previewShipping !== 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: theme.textSecondary }}>Shipping</span>
                    <span>{formatCurrency(previewShipping)}</span>
                  </div>
                )}
                {previewTaxes !== 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: theme.textSecondary }}>Taxes</span>
                    <span>{formatCurrency(previewTaxes)}</span>
                  </div>
                )}
                {parseCurrency(discount) !== 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: theme.textSecondary }}>Discount</span>
                    <span>-{formatCurrency(parseCurrency(discount))}</span>
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
              <p className="text-sm" style={{ color: theme.textSecondary }}>Client, at least one Style, and State Costs are required.</p>
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
  const discountField = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT);
  const shippingNotesField = getField(draftOrdersTable, FIELD_IDS.DRAFT_SHIPPING_NOTES);
  const taxesNotesField = getField(draftOrdersTable, FIELD_IDS.DRAFT_TAXES_NOTES);
  const discountNotesField = getField(draftOrdersTable, FIELD_IDS.DRAFT_DISCOUNT_NOTES);
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
  const clientDueDateField = getField(clientsTable, FIELD_IDS.CLIENT_DUE_DATE);
  const rushRuleWeeksField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_WEEKS);
  const rushRuleNonCustomizedPctField = getField(rushFeeRulesTable, FIELD_IDS.RUSH_RULE_NON_CUSTOMIZED_PCT);
  const clientFavoriteStylesAcuityField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_ACUITY);
  const clientFavoriteStylesAppointmentField = getField(clientsTable, FIELD_IDS.CLIENT_FAVORITE_STYLES_APPOINTMENT);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  const clientCustomizations = useMemo(() => {
    return customizationRecords.filter(customization => {
      const linkedClients = getLinkedRecordIds(customization, customizationClientField);
      return linkedClients.includes(clientId);
    });
  }, [customizationRecords, clientId, customizationClientField, getLinkedRecordIds]);

  const eligibleStyleIds = useMemo(() => {
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
  const linkedCustomizationIds = getLinkedRecordIds(draft, customizationsField);
  const stateCostId = getLinkedRecordIds(draft, stateCostsField)[0] ?? null;
  const stateCostRecord = stateCostId ? stateCostRecords.find(r => r.id === stateCostId) ?? null : null;
  const stateCostName = stateCostRecord && stateCostNameField ? stateCostRecord.getCellValueAsString(stateCostNameField) : '';
  const rushFee = rushFeeField ? (draft.getCellValue(rushFeeField) as number | null) ?? 0 : 0;
  const shipping = shippingField ? (draft.getCellValue(shippingField) as number | null) ?? 0 : 0;
  const taxes = taxesField ? (draft.getCellValue(taxesField) as number | null) ?? 0 : 0;
  const discount = discountField ? (draft.getCellValue(discountField) as number | null) ?? 0 : 0;
  const shippingNotes = shippingNotesField ? draft.getCellValueAsString(shippingNotesField) : '';
  const taxesNotes = taxesNotesField ? draft.getCellValueAsString(taxesNotesField) : '';
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

  const handleStateCostChange = async (id: string | null) => {
    if (!isEditable || !stateCostsField) return;
    try {
      await draftOrdersTable.updateRecordAsync(draftId, {
        [stateCostsField.id]: id ? [{ id }] : null,
      });
    } catch (error) {
      console.error('Failed to update state costs:', error);
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
        <span className="text-sm" style={{ color: theme.textSecondary }}>{formatDate(createdAt)}</span>
        <StatusPill label={isLocked ? 'Locked' : 'Unlocked'} variant={isLocked ? 'locked' : 'unlocked'} />
        <div className="flex-1" />
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
                      {eligibleStyleIds.length === 0 && styleSearchQuery.trim() === '' ? (
                        <p className="px-3 py-2 text-sm" style={{ color: theme.textSecondary }}>
                          This client doesn't have pre-selected styles. Start typing to search styles.
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

          {clientCustomizations.length > 0 && (
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
                {linkedCustomizations.length === 0 ? (
                  <p className="text-sm" style={{ color: theme.textSecondary }}>No customizations selected.</p>
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

          <div>
              <h2 className="text-base font-semibold mb-3">Additional Charges</h2>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-base font-semibold">
                  State Costs<span style={{ color: theme.danger }}> *</span>
                </h2>
                {isEditable ? (
                  <StateCostPicker
                    theme={theme}
                    records={stateCostRecords}
                    nameField={stateCostNameField}
                    selectedId={stateCostId}
                    onSelect={handleStateCostChange}
                    placeholder="Select a state..."
                  />
                ) : (
                  <span className="text-sm">{stateCostName || '—'}</span>
                )}
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
                  {rushFee !== 0 && (
                    <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                      <td className="py-3 pl-4" style={{ backgroundColor: theme.neutralBg }}>Rush Fee</td>
                      <td className="py-3 pr-2 text-right whitespace-nowrap" style={{ backgroundColor: theme.neutralBg }}>{formatCurrency(rushFee)}</td>
                      <td className="py-3 pl-3 pr-4 text-xs" style={{ color: theme.textMuted, backgroundColor: theme.neutralBg }}>
                        {dueDate && weeksUntilDueDate !== null &&
                          `Due date to have the styles ready is in ${weeksUntilDueDate} week${weeksUntilDueDate === 1 ? '' : 's'}, on ${formatDate(dueDate.toISOString())}.`}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                    <td className="py-3 pl-4">Shipping</td>
                    {/* Shipping is now a lookup off state_costs — always read-only, regardless of isEditable. */}
                    <td className="py-3 pr-2 text-right">{formatCurrency(shipping)}</td>
                    <td className="py-3 pl-3 pr-4">
                      {isEditable ? (
                        <NotesInput value={shippingNotes} field={shippingNotesField} fieldKey="shippingNotes" theme={theme} onBlur={handleNotesBlur} borderless />
                      ) : (
                        <span className="text-xs" style={{ color: theme.textMuted }}>{shippingNotes}</span>
                      )}
                    </td>
                  </tr>
                  <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                    <td className="py-3 pl-4">Taxes</td>
                    {/* Taxes is now a formula off state_costs — always read-only, regardless of isEditable. */}
                    <td className="py-3 pr-2 text-right">{formatCurrency(taxes)}</td>
                    <td className="py-3 pl-3 pr-4">
                      {isEditable ? (
                        <NotesInput value={taxesNotes} field={taxesNotesField} fieldKey="taxesNotes" theme={theme} onBlur={handleNotesBlur} borderless />
                      ) : (
                        <span className="text-xs" style={{ color: theme.textMuted }}>{taxesNotes}</span>
                      )}
                    </td>
                  </tr>
                  <tr style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                    <td className="py-3 pl-4">Discount</td>
                    <td className="py-3">
                      {isEditable ? (
                        <CurrencyInput label="Discount" value={discount} field={discountField} fieldKey="discount" error={fieldErrors.discount} theme={theme} onBlur={handleCurrencyBlur} hideLabel borderless />
                      ) : <span className="block text-right">{`-${formatCurrency(discount)}`}</span>}
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
              {rushFee !== 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.textSecondary }}>Rush Fee</span>
                  <span>{formatCurrency(rushFee)}</span>
                </div>
              )}
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

initializeBlock({ interface: () => <DraftOrdersApp /> });
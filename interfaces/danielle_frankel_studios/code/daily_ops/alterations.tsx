import React, { useMemo, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table, Record as AirtableRecord, Field } from '@airtable/blocks/interface/models';
import { WarningCircle as WarningCircleIcon } from '@phosphor-icons/react';

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
  CLIENT_FULL_NAME:                 'fldB3Wyam01D3wR5Q',
  CLIENT_STAGE:                     'fldLcxVZvI1rigBlh',  // singleSelect — used only to filter to "In Alterations"
  CLIENT_ITEMS_SOLD:                'fldEStULoGtNIjxPO',  // pending * — placeholder for Gown/Garment being altered
  CLIENT_ALTERATIONS_LEAD:          'fldWxPkO98xA8OF8y',  // most_recent_alterations_lead — lookup of linked record names
  CLIENT_FIRST_ALTERATIONS_APPT:    'fldRS6ctrPGlEPqlR',  // first_alterations_appointment — lookup, dateTime
  CLIENT_NEXT_ALTERATIONS_APPT:     'fldGiXSJ9p6dGFhLY',  // next_alterations_appointment — lookup, dateTime
  CLIENT_WEDDING_DATE:              'fldbgknumKGS5W5WU',  // Wedding Date (Formatted)
  CLIENT_PICK_UP:                   'fldwqYAsQ3Iasi8QT',  // pending * — checkbox
} as const;

// Duplicated from pipeline.tsx — every interface file here is a fully
// self-contained bundle (no cross-file imports), so shared constants like
// this one are copied per-file rather than imported from a shared module.
const STAGE_ORDER = [
  'Pre-Appointment',
  'Deliberating',
  'Sold',
  'Order Ready',
  'In Alterations',
  'In Fulfillment',
] as const;

const ALTERATIONS_STAGE: (typeof STAGE_ORDER)[number] = 'In Alterations';

// ─── Pending-field tooltip ──────────────────────────────────────────────────────
const PENDING_TOOLTIP = 'This page is under construction — this data is pending confirmation and may change.';
function PendingAsterisk() {
  return (
    <span title={PENDING_TOOLTIP} aria-label={PENDING_TOOLTIP}
      className="text-amber-600 dark:text-amber-400 cursor-help font-semibold">*</span>
  );
}

// ─── Date helpers ──────────────────────────────────────────────────────────────
// Reads the raw cell value (ISO 8601 for date/dateTime lookups) instead of
// getCellValueAsString, which renders using the field's configured display
// format and can silently swap day/month for ambiguous dates depending on
// the viewer's locale — same rationale as this file's prior version.
function extractFirstLookupDate(record: AirtableRecord, field: Field | null | undefined): string | null {
  if (!field) return null;
  try {
    const raw = record.getCellValue(field);
    if (Array.isArray(raw)) {
      if (raw.length === 0) return null;
      const first = raw[0];
      if (first === null || first === undefined) return null;
      if (typeof first === 'string') return first;
      if (first instanceof Date) return first.toISOString();
      if (typeof first === 'object') {
        const obj = first as Record<string, unknown>;
        if (typeof obj.value === 'string') return obj.value;
      }
      return null;
    }
    if (typeof raw === 'string') return raw;
    if (raw instanceof Date) return raw.toISOString();
    return null;
  } catch { return null; }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return (
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
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
    <div className="flex flex-wrap items-center gap-1">
      {parts.map((p, i) => <Pill key={i}>{p}</Pill>)}
      <PendingAsterisk />
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

// ─── AlterationsApp ─────────────────────────────────────────────────────────────
function AlterationsApp(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
  const clientsTable = (customPropertyValueByKey.clientsTable as Table | undefined) ?? null;

  const fields = useMemo(() => {
    if (!clientsTable) return {};
    return Object.fromEntries(
      Object.entries(FIELD_IDS).map(([, id]) => [id, clientsTable.getFieldIfExists(id)])
    );
  }, [clientsTable]);

  const allRecords = useRecords(clientsTable ?? null);

  const alterationsRecords = useMemo(() => {
    if (!allRecords) return [];
    const fStage = fields[FIELD_IDS.CLIENT_STAGE];
    const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
    const fNextAppt = fields[FIELD_IDS.CLIENT_NEXT_ALTERATIONS_APPT];

    const recs = allRecords.filter(rec => {
      if (!fStage) return false;
      const stage = (rec.getCellValue(fStage) as { name: string } | null)?.name ?? null;
      return stage === ALTERATIONS_STAGE;
    });

    return recs.slice().sort((a, b) => {
      const nextA = fNextAppt ? extractFirstLookupDate(a, fNextAppt) : null;
      const nextB = fNextAppt ? extractFirstLookupDate(b, fNextAppt) : null;
      if (nextA && !nextB) return -1;
      if (!nextA && nextB) return 1;
      if (nextA && nextB) {
        const diff = new Date(nextA).getTime() - new Date(nextB).getTime();
        if (diff !== 0) return diff;
      }
      const nameA = fName ? (a.getCellValueAsString(fName) ?? '') : '';
      const nameB = fName ? (b.getCellValueAsString(fName) ?? '') : '';
      return nameA.localeCompare(nameB);
    });
  }, [allRecords, fields]);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden antialiased bg-[#F6F4F0] dark:bg-[#1A1917]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="px-6 pt-5 pb-4 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900 dark:text-[#F5F3EF]">Alterations</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Clients currently in the alterations stage.</p>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-4 flex flex-col">
        <div className="bg-white dark:bg-[#242220] border border-[#E5E1DA] dark:border-[#34312C] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1e1d1b]">
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[160px]">Client</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[200px]">
                    Gown/Garment <PendingAsterisk />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[150px]">Alterationist(s)</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[150px]">First Alts Appointment</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[150px]">Next Alts Appointment</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[120px]">Wedding Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize tracking-wider w-[90px]">
                    Pick Up <PendingAsterisk />
                  </th>
                </tr>
              </thead>
              <tbody>
                {alterationsRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No clients currently in alterations.</td>
                  </tr>
                ) : alterationsRecords.map(rec => {
                  const fName = fields[FIELD_IDS.CLIENT_FULL_NAME];
                  const fItems = fields[FIELD_IDS.CLIENT_ITEMS_SOLD];
                  const fLead = fields[FIELD_IDS.CLIENT_ALTERATIONS_LEAD];
                  const fFirstAppt = fields[FIELD_IDS.CLIENT_FIRST_ALTERATIONS_APPT];
                  const fNextAppt = fields[FIELD_IDS.CLIENT_NEXT_ALTERATIONS_APPT];
                  const fWedding = fields[FIELD_IDS.CLIENT_WEDDING_DATE];
                  const fPickUp = fields[FIELD_IDS.CLIENT_PICK_UP];

                  const name = fName ? (rec.getCellValueAsString(fName) ?? '') : '';
                  const itemsStr = fItems ? (rec.getCellValueAsString(fItems) ?? '') : '';
                  const leadStr = fLead ? (rec.getCellValueAsString(fLead) ?? '') : '';
                  const firstApptStr = extractFirstLookupDate(rec, fFirstAppt);
                  const nextApptStr = extractFirstLookupDate(rec, fNextAppt);
                  const weddingStr = fWedding ? (rec.getCellValue(fWedding) as string | null) : null;
                  const pickedUp = fPickUp ? !!rec.getCellValue(fPickUp) : false;

                  return (
                    <tr key={rec.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-[#F5F3EF]">{name || '—'}</td>
                      <td className="px-3 py-2.5">{renderPills(itemsStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{leadStr || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(firstApptStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(nextApptStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatDate(weddingStr)}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1">
                          {pickedUp ? '✓' : '—'}
                          <PendingAsterisk />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

initializeBlock({ interface: () => <AlterationsApp /> });

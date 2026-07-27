import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
} from '@airtable/blocks/interface/ui';
import {
  X as XIcon,
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  CaretLeft as CaretLeftIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
} from '@phosphor-icons/react';

// ─── Field IDs ────────────────────────────────────────────────────────────────
// The DETAIL_* fields below are read-only here even where pipeline.tsx (the
// source of the full-page detail this reuses) has an editable counterpart —
// this page never writes to a client record.
const FIELD_IDS = {
  FULL_NAME:                   'fldB3Wyam01D3wR5Q',
  STAGE:                       'fldLcxVZvI1rigBlh',
  SALES_ASSOCIATE:             'fldBTKBaw8YvNAlwK',
  FAVORITE_STYLES_FROM_ACUITY: 'fldZzNR0g5VEJ5RmX',
  LAST_APPOINTMENT:            'fldd01OccObkG9sGe',
  APPOINTMENT_COUNT:           'fldrnDWDgDx5IF5gz',
  WEDDING_DATE_FORMATTED:      'fldbgknumKGS5W5WU',
  PERSONAL_STYLE_NOTES:        'fldQiGCx5hRQ0Am1Z',
  STYLE_NAME:                  'fldEs3chQAeplPc1w',

  // Header / contact
  DETAIL_EMAIL:                     'fld5f3IVZoX0QZZ8R',
  DETAIL_PHONE:                     'fldZrxF4bR6QBUwVK',
  DETAIL_STUDIO:                    'fldIenJoxseeHmfIv',
  DETAIL_SA_PHONE:                  'fldl5vP5mpQrHsTsm',
  DETAIL_NEXT_APPOINTMENT:          'fldTe2cyBmicx9Ple',
  DETAIL_NEXT_APPT_ROOM:            'fldfQUSkQRooZi8sr',
  DETAIL_COUNTRY_OF_RESIDENCE:      'flduQb1j7LceNZuC8',

  // Pre-Appointment
  DETAIL_WEDDING_LOCATION:          'fldikRqj41XYiIDBk',
  DETAIL_WEDDING_PLANNER:           'fldISwHPviwGQBHFJ',
  DETAIL_PREFERRED_STYLIST:         'fld2jVE1qluvlhV7D',
  DETAIL_RTW_SIZE:                  'fldvV2CiEx4RQN4mO',
  DETAIL_SAMPLES_NOT_WHERE_NEEDED:  'fldVPJWXThfyGuh6d',

  // Deliberating
  DETAIL_FAV_STYLES_IN_APPT:        'fldVw8wCgPKvxN1jD',
  DETAIL_CUSTOMIZATION_LINK:        'fldlbAPEaoTwfFPTv',
  DETAIL_IS_RUSH:                   'fldzLjMjNfNn6KEI3',
  DETAIL_MEAS_BUST:                 'fldiCV13D0ym7Yirh',
  DETAIL_MEAS_WAIST:                'fldShyIHilro7fYol',
  DETAIL_MEAS_HIPS:                 'fldx7dNHA3SZYC11C',
  DETAIL_MEASUREMENTS:              'fldcWwbKOc9nkgzzV',
  DETAIL_APPT_PHOTOS:               'fldWti8XzHbnGcjz9',
  DETAIL_FOLLOW_UP_SENT:            'fldmjiS7lHEn9qZHN',
  DETAIL_APPT_NOTES:                'fldwHp8zC3GykAuO1',
  DETAIL_SALES_NOTES:               'fldsVYhG5tZAccxdK',

  // Sold
  DETAIL_SHOPIFY_ADDRESS:           'fldxFbYURZvlZ0tA1',
  DETAIL_TOTAL_SPEND:               'fldasxslBOCb7GXnd',
  DETAIL_DISCOUNT:                  'fldRcaPZSWB7ve24D',
  DETAIL_QTY_ITEMS_SOLD:            'flda47cFuR4yMHqpu',
  DETAIL_M2M:                       'fldJovDgD9pPRx7Yp',
  DETAIL_ALTERATIONS_PAYMENT_STATUS: 'fldlEohtKV3LGF1tC',
  DETAIL_SHOPIFY_ORDER_NUMBER:      'fldWSGqQW9czYdams',
  DETAIL_APPAREL_MAGIC_ORDER:       'fldwMsegG6ImCHWxM',
  DETAIL_ORDER_READY:               'fldCAak4Hy5RmvXWT',
  DETAIL_DUE_DATE:                  'flddDJKkZDsOoCOzE',

  // Order Ready
  DETAIL_ITEMS_SOLD:                'fldEStULoGtNIjxPO',
  DETAIL_CUSTOMIZATION_NOTES:       'fld6C6SKaa1pWbTf6',
  DETAIL_CONTACTED_FOR_ALTERATIONS: 'fldmiD8TdERvJJT0j',
  DETAIL_SHIP:                      'fldQjLmwDokAkYPEt',
  DETAIL_PICK_UP:                   'fldwqYAsQ3Iasi8QT',
  DETAIL_CLIENT_NOTIFIED_FULFILLMENT: 'fldxumxeRnrDQ3CIk',

  // In Alterations
  DETAIL_LATEST_ALTERATIONS_APPT:  'fldoF7SPEjWNi5JQF',
  DETAIL_ALTERATION_NOTES:         'fldBhpBTj0gGmV5mc',

  // In Fulfillment
  DETAIL_FULFILLMENT_NOTES:        'fld4dnGW0td7H1dRX',
  DETAIL_PICKED_PERCENT:           'fldh9IWe29cCm2WKg',
  DETAIL_FULFILLMENT_METHOD:       'fldjwCFnGqOToCRnN',
  DETAIL_ACUITY_ADDRESS:           'fldkpfulLIk0jq34d',
  DETAIL_OTHER_ADDRESS:            'fld5uRLRmAXqAH0nu',
  DETAIL_ADDRESS_CONFIRMED:        'fldksvLd6ZQabAoY1',
  DETAIL_TRACKING_NUMBER:          'fldY0SvbuYeHUZa15',
  DETAIL_3PL:                      'fldSxZrcIbBlyJO6R',
  DETAIL_HOLD_SHIPMENT_DATE:       'fldVsDeVp6R6ytqlb',
  DETAIL_TAXES:                    'fld1Hki2fjZifmFHg',
  DETAIL_SHIPPING_COST:            'fldYcTq6s04xZiy2S',

  // Interests
  DETAIL_INTEREST_CUSTOM:          'fldTrFh5dMYvkl0F4',
  DETAIL_INTEREST_ALTS:            'fldibh40zShnDmLfj',
  DETAIL_INTEREST_M2M:             'fld3YweLOIcpr7xvL',
} as const;

// ─── Utilities ────────────────────────────────────────────────────────────────
type AnyRecord = { id: string; getCellValue: (f: string) => unknown; getCellValueAsString: (f: string) => string };

// LAST_APPOINTMENT is a lookup field. This interface's runtime returns lookup
// cell values as an array of one entry per linked record — either a plain
// string, or (per BRANDING.md §9's lookup-color note, same underlying
// runtime quirk) an object of the shape { linkedRecordId, value }. The
// previous version of this file only checked for a plain string first
// element, so it silently rendered "—" for every lookup-shaped value.
function unwrapLookupString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.length > 0 ? unwrapLookupString(value[0]) : null;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === 'string') return obj.value;
    if (obj.value instanceof Date) return (obj.value as Date).toISOString();
    if (typeof obj.name === 'string') return obj.name;
  }
  return null;
}

function formatDate(value: unknown, opts: Intl.DateTimeFormatOptions): string {
  const s = unwrapLookupString(value);
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

function getSAName(record: AnyRecord): string {
  const v = record.getCellValue(FIELD_IDS.SALES_ASSOCIATE);
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const f = v[0];
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object' && 'name' in f) return (f as { name: string }).name;
  }
  return '';
}

function getLastApptTimestamp(record: AnyRecord): number {
  const s = unwrapLookupString(record.getCellValue(FIELD_IDS.LAST_APPOINTMENT));
  if (!s) return 0;
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function getAppointmentCount(record: AnyRecord): number {
  const v = record.getCellValue(FIELD_IDS.APPOINTMENT_COUNT);
  return typeof v === 'number' ? v : 0;
}

// ─── Read-only detail-page helpers ────────────────────────────────────────────
// Everything here is display-only — no EditableX components, no write calls —
// matching pipeline.tsx's `readOnly` branch of each FullProfileModal section.
function str(record: AnyRecord, fieldId: string): string {
  return record.getCellValueAsString(fieldId) || '';
}

function getBool(record: AnyRecord, fieldId: string): boolean {
  return record.getCellValue(fieldId) === true;
}

function getNumber(record: AnyRecord, fieldId: string): number | null {
  const v = record.getCellValue(fieldId);
  return typeof v === 'number' ? v : null;
}

function getLinkCount(record: AnyRecord, fieldId: string): number {
  const v = record.getCellValue(fieldId);
  return Array.isArray(v) ? v.length : 0;
}

function getDateDisplay(record: AnyRecord, fieldId: string, opts: Intl.DateTimeFormatOptions): string {
  return formatDate(record.getCellValue(fieldId), opts);
}

function formatMoney(v: number | null): string {
  return v != null ? `$${v.toLocaleString()}` : '—';
}

function formatPercent(v: number | null): string {
  return v != null ? `${Math.round(v * 100)}%` : '—';
}

function yesNo(v: boolean): string {
  return v ? 'Yes' : 'No';
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400 tracking-wide">{label}</div>
      <div className="text-sm text-gray-800 font-medium mt-0.5 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-xs text-gray-400 tracking-wide mb-3">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─── SearchInput ──────────────────────────────────────────────────────────────
function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        placeholder="Search client..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-8 pr-7 py-1.5 w-64 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <XIcon size={13} />
        </button>
      )}
    </div>
  );
}

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────
function MultiSelectDropdown({
  label, options, selected, onChange, isOpen, setIsOpen,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (v: Set<string>) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setIsOpen]);

  const displayText = selected.size === 0 ? label : `${label}: ${selected.size}`;

  return (
    <div ref={containerRef} className="flex items-center gap-1.5">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          <span className="text-gray-700">{displayText}</span>
          <CaretDownIcon size={13} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div
              className="max-h-60 overflow-y-auto py-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    const next = new Set(selected);
                    next.has(opt) ? next.delete(opt) : next.add(opt);
                    onChange(next);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                    selected.has(opt) ? 'bg-amber-50 text-amber-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── SortButton ───────────────────────────────────────────────────────────────
function SortButton({
  label, colKey, sortState, onClick,
}: {
  label: string;
  colKey: string;
  sortState: Record<string, 'asc' | 'desc' | 'none'>;
  onClick: () => void;
}) {
  const dir = sortState[colKey];
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-800">
      {label}
      {dir === 'desc' && <CaretDownIcon size={11} />}
      {dir === 'asc' && <CaretUpIcon size={11} />}
    </button>
  );
}

// ─── Client Detail Page ───────────────────────────────────────────────────────
// Read-only port of pipeline.tsx's FullProfileModal: same section layout and
// full-page (not drawer) presentation, but every field is a plain DetailRow —
// no Editable* components, since nothing here is ever written back. Personal
// Style Notes is surfaced first (ahead of the header card), per request.
// A "Did Not Convert" client isn't part of pipeline.tsx's STAGE_STEPS funnel,
// so instead of a stage-stepper gating which section is editable, every
// stage's section is always shown.
function ClientDetailPage({ record, getStyleNames, onBack }: {
  record: AnyRecord;
  getStyleNames: (record: AnyRecord) => string[];
  onBack: () => void;
}) {
  const fullName = str(record, FIELD_IDS.FULL_NAME) || 'Unknown Client';
  const saName = getSAName(record) || '—';
  const saPhone = str(record, FIELD_IDS.DETAIL_SA_PHONE);
  const email = str(record, FIELD_IDS.DETAIL_EMAIL);
  const phone = str(record, FIELD_IDS.DETAIL_PHONE);
  const studio = str(record, FIELD_IDS.DETAIL_STUDIO) || '—';
  const weddingDisplay = formatDate(record.getCellValue(FIELD_IDS.WEDDING_DATE_FORMATTED), { month: 'long', day: 'numeric', year: 'numeric' });
  const notes = str(record, FIELD_IDS.PERSONAL_STYLE_NOTES);
  const styleNames = getStyleNames(record);

  const nextAppointment = getDateDisplay(record, FIELD_IDS.DETAIL_NEXT_APPOINTMENT, { month: 'short', day: 'numeric', year: 'numeric' });
  const lastAppointment = getDateDisplay(record, FIELD_IDS.LAST_APPOINTMENT, { month: 'short', day: 'numeric', year: 'numeric' });
  const nextApptRoom = str(record, FIELD_IDS.DETAIL_NEXT_APPT_ROOM);
  const appointmentCount = getAppointmentCount(record);
  const hasMeasurements = getLinkCount(record, FIELD_IDS.DETAIL_MEASUREMENTS) > 0 || getBool(record, FIELD_IDS.DETAIL_MEASUREMENTS);
  const noPhotos = getBool(record, FIELD_IDS.DETAIL_APPT_PHOTOS);
  const followUp = getBool(record, FIELD_IDS.DETAIL_FOLLOW_UP_SENT);
  const apptNotes = str(record, FIELD_IDS.DETAIL_APPT_NOTES);

  const taxes = getNumber(record, FIELD_IDS.DETAIL_TAXES);
  const shippingCost = getNumber(record, FIELD_IDS.DETAIL_SHIPPING_COST);
  const totalSpend = getNumber(record, FIELD_IDS.DETAIL_TOTAL_SPEND);
  const holdShipmentDate = record.getCellValue(FIELD_IDS.DETAIL_HOLD_SHIPMENT_DATE);
  const holdShipmentDisplay = getDateDisplay(record, FIELD_IDS.DETAIL_HOLD_SHIPMENT_DATE, { month: 'long', day: 'numeric', year: 'numeric' });
  const holdShipmentIsFuture = (() => {
    const s = unwrapLookupString(holdShipmentDate);
    if (!s) return false;
    const d = new Date(s);
    return !isNaN(d.getTime()) && d > new Date();
  })();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="max-w-[1200px] mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white transition-colors"
          >
            <CaretLeftIcon size={16} />
            Go back
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-6 space-y-4">

        {/* Personal Style Notes — surfaced first, per request */}
        <DetailSection title="Personal Style Notes">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes || 'No notes yet.'}</p>
        </DetailSection>

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start gap-6 flex-wrap">
            <div className="min-w-0">
              <div className="text-2xl font-semibold text-gray-900">{fullName}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500 border border-gray-200">
                  Did Not Convert
                </span>
                <span className="text-base text-gray-500">{studio}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailRow label="Wedding Date" value={weddingDisplay} />
            <div>
              <div className="text-xs text-gray-400 tracking-wide">Sales Associate</div>
              <div className="text-sm text-gray-800 font-medium mt-0.5">{saName}</div>
              {saPhone && <a href={`tel:${saPhone}`} className="text-sm text-[#D97706] block">{saPhone}</a>}
            </div>
            <div>
              <div className="text-xs text-gray-400 tracking-wide">Email</div>
              {email
                ? <a href={`mailto:${email}`} className="text-sm text-[#D97706] font-medium mt-0.5 block truncate">{email}</a>
                : <div className="text-sm text-gray-400 mt-0.5">—</div>}
            </div>
            <div>
              <div className="text-xs text-gray-400 tracking-wide">Phone</div>
              {phone
                ? <a href={`tel:${phone}`} className="text-sm text-[#D97706] font-medium mt-0.5 block">{phone}</a>
                : <div className="text-sm text-gray-400 mt-0.5">—</div>}
            </div>
          </div>
        </div>

        {/* Appointment details */}
        <DetailSection title="Appointment details">
          <FieldRow>
            <DetailRow label="Next Appointment" value={nextAppointment} />
            <DetailRow label="Last Appointment" value={lastAppointment} />
            <DetailRow label="Room" value={nextApptRoom || '—'} />
            <DetailRow label="Total Appointments" value={appointmentCount} />
          </FieldRow>
          <FieldRow>
            <DetailRow label="Measurements" value={hasMeasurements ? 'Complete' : 'Missing'} />
            <DetailRow label="Appt Photos" value={noPhotos ? 'Missing' : 'Complete'} />
            <DetailRow label="Follow-Up" value={followUp ? 'Sent' : 'Pending'} />
          </FieldRow>
        </DetailSection>

        {/* Favorite styles */}
        <DetailSection title="Favorite Styles">
          {styleNames.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {styleNames.map((name, i) => (
                <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </DetailSection>

        {/* Interests */}
        <DetailSection title="Interests">
          <FieldRow>
            <DetailRow label="Interest in Custom" value={yesNo(getBool(record, FIELD_IDS.DETAIL_INTEREST_CUSTOM))} />
            <DetailRow label="Interest in Alts" value={yesNo(getBool(record, FIELD_IDS.DETAIL_INTEREST_ALTS))} />
            <DetailRow label="Interest in M2M" value={yesNo(getBool(record, FIELD_IDS.DETAIL_INTEREST_M2M))} />
          </FieldRow>
        </DetailSection>

        {/* Post-appointment notes */}
        <DetailSection title="Post-appointment notes">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{apptNotes || 'No notes yet.'}</p>
        </DetailSection>

        {/* Pre-Appointment */}
        <DetailSection title="Pre-Appointment">
          <FieldRow>
            <DetailRow label="Country of Residence" value={str(record, FIELD_IDS.DETAIL_COUNTRY_OF_RESIDENCE) || '—'} />
            <DetailRow label="Wedding Location" value={str(record, FIELD_IDS.DETAIL_WEDDING_LOCATION) || '—'} />
            <DetailRow label="Wedding Planner" value={str(record, FIELD_IDS.DETAIL_WEDDING_PLANNER) || '—'} />
          </FieldRow>
          <FieldRow>
            <DetailRow label="Bridal Stylist" value={str(record, FIELD_IDS.DETAIL_PREFERRED_STYLIST) || '—'} />
            <DetailRow label="RTW Size" value={getNumber(record, FIELD_IDS.DETAIL_RTW_SIZE) ?? '—'} />
            <DetailRow label="Samples Not Where Needed" value={str(record, FIELD_IDS.DETAIL_SAMPLES_NOT_WHERE_NEEDED) || '—'} />
          </FieldRow>
        </DetailSection>

        {/* Deliberating */}
        <DetailSection title="Deliberating">
          <FieldRow>
            <DetailRow label="Favorite Styles in Appt" value={str(record, FIELD_IDS.DETAIL_FAV_STYLES_IN_APPT) || '—'} />
            <DetailRow label="Customization Requests" value={getLinkCount(record, FIELD_IDS.DETAIL_CUSTOMIZATION_LINK) || '—'} />
            <DetailRow label="Rush" value={getBool(record, FIELD_IDS.DETAIL_IS_RUSH) ? '🚨 Yes' : 'No'} />
          </FieldRow>
          <FieldRow>
            <DetailRow label="Bust" value={getNumber(record, FIELD_IDS.DETAIL_MEAS_BUST) ?? '—'} />
            <DetailRow label="Waist" value={getNumber(record, FIELD_IDS.DETAIL_MEAS_WAIST) ?? '—'} />
            <DetailRow label="Hips" value={getNumber(record, FIELD_IDS.DETAIL_MEAS_HIPS) ?? '—'} />
          </FieldRow>
          <DetailRow label="Sales Notes" value={str(record, FIELD_IDS.DETAIL_SALES_NOTES) || '—'} />
        </DetailSection>

        {/* Sold */}
        <DetailSection title="Sold">
          <DetailRow label="Address" value={str(record, FIELD_IDS.DETAIL_SHOPIFY_ADDRESS) || '—'} />
          <FieldRow>
            <DetailRow label="Total Spend" value={formatMoney(totalSpend)} />
            <DetailRow label="Discount" value={formatMoney(getNumber(record, FIELD_IDS.DETAIL_DISCOUNT))} />
            <DetailRow label="Qty" value={getNumber(record, FIELD_IDS.DETAIL_QTY_ITEMS_SOLD) ?? '—'} />
          </FieldRow>
          <FieldRow>
            <DetailRow label="M2M" value={yesNo(getBool(record, FIELD_IDS.DETAIL_M2M))} />
            <DetailRow label="Alterations Payment" value={str(record, FIELD_IDS.DETAIL_ALTERATIONS_PAYMENT_STATUS) || '—'} />
            <DetailRow label="Order Ready" value={yesNo(getBool(record, FIELD_IDS.DETAIL_ORDER_READY))} />
          </FieldRow>
          <FieldRow>
            <DetailRow label="Shopify #" value={str(record, FIELD_IDS.DETAIL_SHOPIFY_ORDER_NUMBER) || '—'} />
            <DetailRow label="AM #" value={str(record, FIELD_IDS.DETAIL_APPAREL_MAGIC_ORDER) || '—'} />
            <DetailRow label="Due Date" value={getDateDisplay(record, FIELD_IDS.DETAIL_DUE_DATE, { month: 'long', day: 'numeric', year: 'numeric' })} />
          </FieldRow>
        </DetailSection>

        {/* Order Ready */}
        <DetailSection title="Order Ready">
          <FieldRow>
            <DetailRow label="Items Sold" value={str(record, FIELD_IDS.DETAIL_ITEMS_SOLD) || '—'} />
            <DetailRow label="Alterations" value={yesNo(getBool(record, FIELD_IDS.DETAIL_CONTACTED_FOR_ALTERATIONS))} />
            <DetailRow label="Client Notified" value={yesNo(getBool(record, FIELD_IDS.DETAIL_CLIENT_NOTIFIED_FULFILLMENT))} />
          </FieldRow>
          <FieldRow>
            <DetailRow label="Shipping" value={yesNo(getBool(record, FIELD_IDS.DETAIL_SHIP))} />
            <DetailRow label="Pick Up" value={yesNo(getBool(record, FIELD_IDS.DETAIL_PICK_UP))} />
            <div />
          </FieldRow>
          <DetailRow label="Customization Notes" value={str(record, FIELD_IDS.DETAIL_CUSTOMIZATION_NOTES) || '—'} />
        </DetailSection>

        {/* In Alterations */}
        <DetailSection title="In Alterations">
          <FieldRow>
            <DetailRow label="Last Alterations Appt" value={getDateDisplay(record, FIELD_IDS.DETAIL_LATEST_ALTERATIONS_APPT, { month: 'short', day: 'numeric', year: 'numeric' })} />
            <DetailRow label="SA" value={saName} />
            <DetailRow label="Total Spend" value={formatMoney(totalSpend)} />
          </FieldRow>
          <DetailRow label="Alteration Notes" value={str(record, FIELD_IDS.DETAIL_ALTERATION_NOTES) || '—'} />
        </DetailSection>

        {/* In Fulfillment */}
        <DetailSection title="In Fulfillment">
          <DetailRow label="Fulfillment Notes" value={str(record, FIELD_IDS.DETAIL_FULFILLMENT_NOTES) || '—'} />
          <FieldRow>
            <DetailRow label="% Picked" value={formatPercent(getNumber(record, FIELD_IDS.DETAIL_PICKED_PERCENT))} />
            <DetailRow label="Fulfillment Method" value={str(record, FIELD_IDS.DETAIL_FULFILLMENT_METHOD) || '—'} />
            <DetailRow label="Tax + Shipping" value={`${formatMoney(taxes)} / ${formatMoney(shippingCost)}`} />
          </FieldRow>
          <DetailRow label="Acuity Address" value={str(record, FIELD_IDS.DETAIL_ACUITY_ADDRESS) || '—'} />
          <DetailRow label="Other Address" value={str(record, FIELD_IDS.DETAIL_OTHER_ADDRESS) || '—'} />
          <FieldRow>
            <DetailRow label="Address Confirmed" value={yesNo(getBool(record, FIELD_IDS.DETAIL_ADDRESS_CONFIRMED))} />
            <DetailRow label="Tracking #" value={str(record, FIELD_IDS.DETAIL_TRACKING_NUMBER) || '—'} />
            <DetailRow label="3PL" value={str(record, FIELD_IDS.DETAIL_3PL) || '—'} />
          </FieldRow>
          <DetailRow label="Do Not Ship Until" value={holdShipmentDisplay} />
          {holdShipmentIsFuture && (
            <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200">
              <span className="text-sm font-semibold text-red-700">🚨 Do not ship until {holdShipmentDisplay}</span>
            </div>
          )}
          <FieldRow>
            <DetailRow label="Total Spend" value={formatMoney(totalSpend)} />
            <DetailRow label="Taxes" value={formatMoney(taxes)} />
            <DetailRow label="Shipping Cost" value={formatMoney(shippingCost)} />
          </FieldRow>
        </DetailSection>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function DidNotConvertApp(): React.ReactElement {
  const base = useBase();

  const clientsTable = base.getTableByIdIfExists('tblLLUlDgJ4ktzF7c');
  const stylesTable  = base.getTableByIdIfExists('tbl0hWIRBbcB4UkVC');

  // Hooks must be called unconditionally
  const allClientRecords = useRecords(clientsTable ?? null) as AnyRecord[] | null;
  const styleRecords     = useRecords(stylesTable ?? null) as AnyRecord[] | null;

  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedSAs, setSelectedSAs]       = useState(new Set<string>());
  const [saOpen, setSaOpen]                 = useState(false);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [sortState, setSortState]           = useState<Record<string, 'asc' | 'desc' | 'none'>>({
    clientName: 'none',
    salesAssociate: 'none',
    favoriteStyles: 'none',
    lastAppointmentDate: 'none',
    appointmentCount: 'none',
    weddingDate: 'none',
    notes: 'none',
  });

  // Guard — rendered after hooks
  if (!clientsTable || !stylesTable) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-red-500">Required tables not found. Check table IDs.</p>
      </div>
    );
  }

  // Style name map
  const styleNameMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!styleRecords) return m;
    for (const r of styleRecords) {
      const n = r.getCellValue(FIELD_IDS.STYLE_NAME);
      if (typeof n === 'string') m.set(r.id, n);
    }
    return m;
  }, [styleRecords]);

  // DNC records only
  const dncRecords = useMemo((): AnyRecord[] => {
    if (!allClientRecords) return [];
    return allClientRecords.filter(r => {
      const s = r.getCellValue(FIELD_IDS.STAGE);
      const name = s && typeof s === 'object' && 'name' in s ? (s as { name: string }).name : '';
      return name === 'Did Not Convert';
    });
  }, [allClientRecords]);

  // SA filter options
  const saOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of dncRecords) {
      const v = getSAName(r);
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  }, [dncRecords]);

  // Linked style names helper
  const getStyleNames = (record: AnyRecord): string[] => {
    const v = record.getCellValue(FIELD_IDS.FAVORITE_STYLES_FROM_ACUITY);
    if (!v || !Array.isArray(v)) return [];
    return v
      .map(l => l && typeof l === 'object' && 'id' in l ? styleNameMap.get((l as { id: string }).id) ?? '' : '')
      .filter(Boolean);
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return dncRecords.filter(r => {
      const name = r.getCellValueAsString(FIELD_IDS.FULL_NAME).toLowerCase();
      const sa   = getSAName(r);
      const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase());
      const matchSA     = selectedSAs.size === 0 || selectedSAs.has(sa);
      return matchSearch && matchSA;
    });
  }, [dncRecords, searchQuery, selectedSAs]);

  // Sorted records
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    const key = Object.keys(sortState).find(k => sortState[k] !== 'none');
    if (!key) return sorted;
    const dir = sortState[key];
    sorted.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (key) {
        case 'clientName':
          av = a.getCellValueAsString(FIELD_IDS.FULL_NAME).toLowerCase();
          bv = b.getCellValueAsString(FIELD_IDS.FULL_NAME).toLowerCase();
          break;
        case 'salesAssociate':
          av = getSAName(a).toLowerCase();
          bv = getSAName(b).toLowerCase();
          break;
        case 'lastAppointmentDate':
          av = getLastApptTimestamp(a);
          bv = getLastApptTimestamp(b);
          break;
        case 'appointmentCount':
          av = getAppointmentCount(a);
          bv = getAppointmentCount(b);
          break;
        case 'weddingDate':
          av = formatDate(a.getCellValue(FIELD_IDS.WEDDING_DATE_FORMATTED), { month: 'short', year: 'numeric' });
          bv = formatDate(b.getCellValue(FIELD_IDS.WEDDING_DATE_FORMATTED), { month: 'short', year: 'numeric' });
          break;
        case 'notes':
          av = a.getCellValueAsString(FIELD_IDS.PERSONAL_STYLE_NOTES).toLowerCase();
          bv = b.getCellValueAsString(FIELD_IDS.PERSONAL_STYLE_NOTES).toLowerCase();
          break;
        case 'favoriteStyles':
          av = getStyleNames(a).join(',').toLowerCase();
          bv = getStyleNames(b).join(',').toLowerCase();
          break;
      }
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return dir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [filteredRecords, sortState]);

  function cycleSort(col: string) {
    setSortState(prev => {
      const cur = prev[col];
      const next = cur === 'none' ? 'desc' : cur === 'desc' ? 'asc' : 'none';
      const reset = Object.fromEntries(Object.keys(prev).map(k => [k, 'none' as const]));
      return { ...reset, [col]: next };
    });
  }

  const columns: [string, string | null][] = [
    ['Client name',            'clientName'],
    ['Sales associate',        'salesAssociate'],
    ['Favorite styles',        'favoriteStyles'],
    ['Last appointment date',  'lastAppointmentDate'],
    ['Appointment count',      'appointmentCount'],
    ['Wedding date',           'weddingDate'],
    ['Notes',                  'notes'],
  ];

  const colWidths = ['16%', '16%', '20%', '14%', '10%', '12%', '12%'];

  const selectedRecord = selectedId ? dncRecords.find(r => r.id === selectedId) ?? null : null;

  if (selectedRecord) {
    return (
      <div className="font-sans antialiased flex flex-col" style={{ backgroundColor: '#F8F5EE', height: '100vh', overflow: 'hidden' }}>
        <ClientDetailPage
          record={selectedRecord}
          getStyleNames={getStyleNames}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  return (
    <div className="font-sans antialiased flex flex-col" style={{ backgroundColor: '#F8F5EE', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-3 flex items-center gap-4 flex-wrap">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
        <MultiSelectDropdown
          label="Sales associate"
          options={saOptions}
          selected={selectedSAs}
          onChange={setSelectedSAs}
          isOpen={saOpen}
          setIsOpen={setSaOpen}
        />
      </div>

      {/* Table container */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="bg-white border border-[#E9E0CE] rounded-xl h-full flex flex-col overflow-hidden">

          {/* Sticky header */}
          <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
            <table className="w-full table-fixed">
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr>
                  {columns.map(([label, key]) => (
                    <th key={label} className="px-4 py-2.5 text-left">
                      {key
                        ? <SortButton label={label} colKey={key} sortState={sortState} onClick={() => cycleSort(key)} />
                        : <span className="text-xs font-semibold text-gray-600">{label}</span>
                      }
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
            {sortedRecords.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-gray-400">No clients match the current filters.</p>
              </div>
            ) : (
              <table className="w-full table-fixed">
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <tbody>
                  {sortedRecords.map(record => {
                    const fullName       = record.getCellValueAsString(FIELD_IDS.FULL_NAME) || '—';
                    const saName         = getSAName(record) || '—';
                    const styleNames     = getStyleNames(record);
                    const lastAppt       = formatDate(record.getCellValue(FIELD_IDS.LAST_APPOINTMENT), { month: 'short', day: 'numeric', year: 'numeric' });
                    const appointmentCount = getAppointmentCount(record);
                    const weddingDate    = formatDate(record.getCellValue(FIELD_IDS.WEDDING_DATE_FORMATTED), { month: 'short', year: 'numeric' });
                    const notes          = record.getCellValueAsString(FIELD_IDS.PERSONAL_STYLE_NOTES);

                    return (
                      <tr
                        key={record.id}
                        onClick={() => setSelectedId(record.id)}
                        className="border-b border-gray-100 hover:bg-amber-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{fullName}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{saName}</td>
                        <td className="px-4 py-2.5">
                          {styleNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {styleNames.map((name, i) => (
                                <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{lastAppt}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{appointmentCount}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{weddingDate}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700 truncate">{notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

initializeBlock({ interface: () => <DidNotConvertApp /> });
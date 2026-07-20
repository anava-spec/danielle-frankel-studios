import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Table, Record as AirtableRecord, Field } from '@airtable/blocks/interface/models';
import {
  CaretLeft as CaretLeftIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Phone as PhoneIcon,
  EnvelopeSimple as EnvelopeSimpleIcon,
  CaretDown as CaretDownIcon,
  X as XIcon,
  Check as CheckIcon,
  FloppyDisk as FloppyDiskIcon,
} from '@phosphor-icons/react';

// ─────────────────────────────────────────────────────────────────────────────
// CHAMPAGNE COLOR SYSTEM (reference — encoded as Tailwind arbitrary-value
// classes with dark: variants throughout, matching the dark:bg-[#hex] pattern
// used across the sibling interfaces rather than runtime theme branching)
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

// ─────────────────────────────────────────────────────────────────────────────
// FIELD ID CONSTANTS
// All field access uses hardcoded IDs — never field names.
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_IDS = {
  // Identity
  CLIENT_FULL_NAME:                    'fldB3Wyam01D3wR5Q',
  CLIENT_FIRST_NAME:                   'fldFWlAODUcuroeXK',
  CLIENT_LAST_NAME:                    'fldQzSPiUvOid1nXo',
  CLIENT_STAGE:                        'fldLcxVZvI1rigBlh',  // singleSelect — formula-driven, not editable
  CLIENT_EMAIL:                        'fld5f3IVZoX0QZZ8R',  // email — editable
  CLIENT_PHONE:                        'fldZrxF4bR6QBUwVK',  // phone — editable
  // Wedding
  CLIENT_WEDDING:                      'fldbgknumKGS5W5WU',  // date — editable
  CLIENT_WEDDING_IF_NOT_SET:           'fldqwfmMczvLhiqk1',  // text — editable
  CLIENT_WEDDING_LOCATION:             'fldikRqj41XYiIDBk',  // text — editable
  CLIENT_WEDDING_PLANNER:              'fldISwHPviwGQBHFJ',  // text — editable
  // Studio / SA
  CLIENT_STUDIO_NAME_ROLLUP:           'fldIenJoxseeHmfIv',  // rollup — readonly — sole source for Studio
  CLIENT_SALES_ASSOCIATE_LINK:         'fldBTKBaw8YvNAlwK',  // linked record — editable — sole source for Sales Associate
  CLIENT_SALES_ASSOCIATE_PHONE:        'fldl5vP5mpQrHsTsm',  // lookup — readonly
  CLIENT_SALES_ASSOCIATE_EMAIL:        'fldiGcxcshWvxTKKf',  // lookup — readonly
  // Appointments
  CLIENT_APPOINTMENT_COUNT:            'fldrnDWDgDx5IF5gz',  // rollup — readonly
  CLIENT_NEXT_APPOINTMENT:             'fldTe2cyBmicx9Ple',  // lookup — readonly
  CLIENT_LAST_APPOINTMENT:             'fldd01OccObkG9sGe',  // lookup — readonly
  CLIENT_NEXT_APPT_ALT_LEAD:           'flddN7YHMuymJKbv9',  // lookup — readonly
  CLIENT_NEXT_APPT_ROOM:               'fldfQUSkQRooZi8sr',  // lookup — readonly
  CLIENT_LATEST_ALTERATIONS_APPT:      'fldoF7SPEjWNi5JQF',  // lookup — readonly
  // Intake / Pre-Appt
  CLIENT_COUNTRY_OF_RESIDENCE:         'flduQb1j7LceNZuC8',  // text — editable
  CLIENT_PREFERRED_STYLIST:            'fld2jVE1qluvlhV7D',  // text — editable
  CLIENT_RTW_SIZE:                     'fldvV2CiEx4RQN4mO',  // text — editable
  CLIENT_FAV_STYLES_ACUITY:            'fldZzNR0g5VEJ5RmX',  // multipleLookupValues — readonly
  CLIENT_SAMPLES_NOT_WHERE_NEEDED:     'fldVPJWXThfyGuh6d',  // text/checkbox — editable (text fallback)
  CLIENT_PERSONAL_STYLE_NOTES:         'fldQiGCx5hRQ0Am1Z',  // multilineText — editable
  // Measurements
  CLIENT_MEASUREMENTS:                 'fldcWwbKOc9nkgzzV',  // attachment — readonly
  CLIENT_MEAS_BUST:                    'fldiCV13D0ym7Yirh',  // number — editable
  CLIENT_MEAS_WAIST:                   'fldShyIHilro7fYol',  // number — editable
  CLIENT_MEAS_HIPS:                    'fldx7dNHA3SZYC11C',  // number — editable
  CLIENT_MEAS_HEIGHT:                  'fldTAlnT0Wk3LKPsb',  // number — editable
  CLIENT_APPT_PHOTOS:                  'fldWti8XzHbnGcjz9',  // attachment — readonly
  // Follow-up / Interest
  CLIENT_FOLLOW_UP_SENT:               'fldmjiS7lHEn9qZHN',  // checkbox — editable
  CLIENT_INTEREST_CUSTOM:              'fldTrFh5dMYvkl0F4',  // checkbox — editable
  CLIENT_INTEREST_ALTS:                'fldibh40zShnDmLfj',  // checkbox — editable
  CLIENT_INTEREST_M2M:                 'fld3YweLOIcpr7xvL',  // checkbox — editable
  CLIENT_APPT_NOTES:                   'fldwHp8zC3GykAuO1',  // multilineText — editable
  // Customizations
  CLIENT_CUSTOMIZATION_LINK:           'fldlbAPEaoTwfFPTv',  // multipleRecordLinks — readonly (managed elsewhere)
  CLIENT_CUSTOMIZATION_IS_RUSH:        'fldzLjMjNfNn6KEI3',  // multipleLookupValues — readonly
  // Order / Sold
  CLIENT_ITEMS_SOLD:                   'fldEStULoGtNIjxPO',  // lookup — readonly
  CLIENT_FAV_STYLES_IN_APPT:           'fldVw8wCgPKvxN1jD',  // linked record — readonly
  CLIENT_TOTAL_SPEND:                  'fldasxslBOCb7GXnd',  // rollup — readonly
  CLIENT_SHOPIFY_ADDRESS:              'fldxFbYURZvlZ0tA1',  // text — editable
  CLIENT_DISCOUNT:                     'fldRcaPZSWB7ve24D',  // currency rollup — readonly
  CLIENT_ALTERATIONS_PAYMENT_STATUS:   'fldlEohtKV3LGF1tC',  // singleSelect — editable
  CLIENT_M2M:                          'fldJovDgD9pPRx7Yp',  // checkbox — editable
  CLIENT_QTY_ITEMS_SOLD:               'flda47cFuR4yMHqpu',  // number rollup — readonly
  CLIENT_APPAREL_MAGIC_ORDER:          'fldwMsegG6ImCHWxM',  // lookup — readonly
  CLIENT_SHOPIFY_ORDER_NUMBER:         'fldWSGqQW9czYdams',  // lookup — readonly
  // Fulfillment flags
  CLIENT_SHIP:                         'fldQjLmwDokAkYPEt',  // checkbox — editable
  CLIENT_PICK_UP:                      'fldwqYAsQ3Iasi8QT',  // checkbox — editable
  CLIENT_ORDER_READY:                  'fldCAak4Hy5RmvXWT',  // checkbox — editable
  CLIENT_PICKED_PERCENT:               'fldh9IWe29cCm2WKg',  // percent — editable
  CLIENT_CONTACTED_FOR_ALTERATIONS:    'fldmiD8TdERvJJT0j',  // checkbox — editable
  CLIENT_FULFILLMENT_METHOD:           'fldjwCFnGqOToCRnN',  // singleSelect — editable
  CLIENT_FULFILLMENT_NOTES:            'fld4dnGW0td7H1dRX',  // multilineText — editable
  CLIENT_TRACKING_NUMBER:              'fldY0SvbuYeHUZa15',  // text — editable
  CLIENT_3PL:                          'fldSxZrcIbBlyJO6R',  // singleSelect — editable
  CLIENT_HOLD_SHIPMENT_DATE:           'fldVsDeVp6R6ytqlb',  // date — editable
  CLIENT_CLIENT_NOTIFIED_FULFILLMENT:  'fldxumxeRnrDQ3CIk',  // checkbox — editable
  CLIENT_ADDRESS_CONFIRMED:            'fldksvLd6ZQabAoY1',  // checkbox — editable
  // Alterations
  CLIENT_ALTERATION_NOTES:             'fldBhpBTj0gGmV5mc',  // multilineText — editable
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// STAGE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_ORDER = [
  'Pre-Appointment',
  'Deliberating',
  'Sold',
  'In Production',
  'In Alterations',
  'In Fulfillment',
] as const;
type StageName = (typeof STAGE_ORDER)[number];

const STAGE_LABELS: Record<string, string> = {
  'Pre-Appointment': 'PRE-APPOINTMENT',
  'Deliberating':    'DELIBERATING',
  'Sold':            'SOLD',
  'In Production':   'ORDER READY',
  'In Alterations':  'ALTERATIONS',
  'In Fulfillment':  'FULFILLMENT',
};

const TIMELINE_OPTIONS = [
  'Past', 'This week', 'Next 3 months', '3–6 months', '6–12 months', '12+ months', 'Date not set',
];

const SALES_ASSOCIATE_OTHER = 'Other';

const AIRTABLE_COLORS: Record<string, { bg: string; fg: string }> = {
  blueLight2:   { bg: '#d1e2ff', fg: '#0d52ac' },
  blueDark1:    { bg: '#0d52ac', fg: '#ffffff' },
  blue:         { bg: '#166ee1', fg: '#ffffff' },
  cyanLight2:   { bg: '#c4ecff', fg: '#0f68a2' },
  cyan:         { bg: '#39caff', fg: '#0f68a2' },
  greenLight2:  { bg: '#cff5d1', fg: '#006400' },
  green:        { bg: '#048a0e', fg: '#ffffff' },
  yellowLight2: { bg: '#ffeab6', fg: '#af6002' },
  yellow:       { bg: '#ffba05', fg: '#af6002' },
  orangeLight2: { bg: '#ffe0cc', fg: '#aa2d00' },
  orange:       { bg: '#d54401', fg: '#ffffff' },
  redLight2:    { bg: '#ffd4e0', fg: '#b10f41' },
  red:          { bg: '#dc043b', fg: '#ffffff' },
  pinkLight2:   { bg: '#fad2fc', fg: '#ab0a83' },
  pink:         { bg: '#dd04a8', fg: '#ffffff' },
  purpleLight2: { bg: '#e0dafd', fg: '#6231ae' },
  purple:       { bg: '#7c37ef', fg: '#ffffff' },
  grayLight2:   { bg: '#dadee6', fg: '#41454d' },
  gray:         { bg: '#616670', fg: '#ffffff' },
  tealLight2:   { bg: '#c1f5f0', fg: '#17726e' },
  teal:         { bg: '#01ddd5', fg: '#17726e' },
};

const EMPTY_FLAG_LABELS: string[] = [];
const DEFAULT_STAGE_COLORS = { bg: '#f3f4f6', fg: '#4b5563' };

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
function getStageColors(colorName: string | undefined): { bg: string; fg: string } {
  if (!colorName) return DEFAULT_STAGE_COLORS;
  return AIRTABLE_COLORS[colorName] ?? DEFAULT_STAGE_COLORS;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return phone;
}

function parseDateFlexible(str: string | null | undefined): Date | null {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const iso = new Date(str);
    if (!isNaN(iso.getTime())) return iso;
  }
  const dmyMatch = str.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?\s*$/i);
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1]!, 10);
    const second = parseInt(dmyMatch[2]!, 10);
    const year = parseInt(dmyMatch[3]!, 10);
    let day: number, month: number;
    if (first > 12) { day = first; month = second - 1; }
    else if (second > 12) { day = second; month = first - 1; }
    else { day = first; month = second - 1; }
    let hour = dmyMatch[4] ? parseInt(dmyMatch[4]!, 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5]!, 10) : 0;
    const ampm = dmyMatch[7]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    const d = new Date(year, month, day, hour, minute);
    if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function formatFullDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseDateFlexible(date) : date;
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseDateFlexible(date) : date;
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatAppointmentDateTime(str: string | null | undefined): string {
  if (!str) return '—';
  const d = parseDateFlexible(str);
  if (!d || isNaN(d.getTime())) return str;
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  );
}

function formatStageCount(count: number): string {
  if (count > 100) return `${Math.floor(count / 100) * 100}+`;
  return String(count);
}

function extractFirstLookupString(record: AirtableRecord, field: Field | null | undefined): string | null {
  if (!field) return null;
  try {
    // Prefer the raw cell value (ISO 8601 for date/dateTime lookups) over
    // getCellValueAsString — the latter renders using the field's configured
    // display format (often "local", i.e. the viewer's locale), which for
    // ambiguous day/month dates like 6/12 vs 12/6 can silently swap day and
    // month depending on whose browser renders it. Raw ISO values sidestep
    // that ambiguity entirely.
    const raw = record.getCellValue(field);
    if (raw !== null && raw !== undefined) {
      if (Array.isArray(raw)) {
        if (raw.length > 0) {
          const first = raw[0];
          if (first !== null && first !== undefined) {
            if (typeof first === 'string') return first;
            if (first instanceof Date) return first.toISOString();
            if (typeof first === 'object') {
              const obj = first as Record<string, unknown>;
              if (typeof obj.value === 'string') return obj.value;
              if (obj.value instanceof Date) return (obj.value as Date).toISOString();
              if (typeof obj.name === 'string') return obj.name;
            }
            return String(first);
          }
        }
      } else if (typeof raw === 'string') return raw;
      else if (raw instanceof Date) return raw.toISOString();
      else return String(raw);
    }
    const str = record.getCellValueAsString(field);
    return str && str.trim() ? str.trim() : null;
  } catch { return null; }
}

function getTimelineBucket(weddingDate: string | null | undefined): string {
  if (!weddingDate) return 'Date not set';
  const d = parseDateFlexible(weddingDate);
  if (!d) return 'Date not set';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  if (d >= startOfWeek && d <= endOfWeek) return 'This week';
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'Past';
  if (diffDays <= 90) return 'Next 3 months';
  if (diffDays <= 180) return '3–6 months';
  if (diffDays <= 365) return '6–12 months';
  return '12+ months';
}

function splitMultiValue(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

function getCellValueSafe<T>(record: AirtableRecord, field: Field | null | undefined): T | null {
  if (!field) return null;
  try { return record.getCellValue(field) as T; } catch { return null; }
}

function getCellValueAsStringSafe(record: AirtableRecord, field: Field | null | undefined): string {
  if (!field) return '';
  try { return record.getCellValueAsString(field) ?? ''; } catch { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT DATA INTERFACE
// ─────────────────────────────────────────────────────────────────────────────
interface ClientData {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  stage: string;
  email: string;
  phone: string;
  formattedPhone: string;
  weddingDate: string | null;
  weddingDateIfNotSet: string;
  weddingLocation: string;
  weddingPlanner: string;
  studio: string;
  salesAssociateName: string;
  salesAssociatePhone: string;
  formattedSAPhone: string;
  salesAssociateEmail: string;
  appointmentCount: number;
  nextAppointment: string | null;
  lastAppointment: string | null;
  latestAlterationsAppt: string | null;
  nextAppointmentAltLead: string;
  nextAppointmentRoom: string;
  // Intake
  countryOfResidence: string;
  preferredStylist: string;
  rtwSize: string;
  favStylesAcuity: string;
  samplesNotWhereNeeded: string;
  personalStyleNotes: string;
  // Measurements
  measBust: number | null;
  measWaist: number | null;
  measHips: number | null;
  measHeight: number | null;
  hasMeasurementPhotos: boolean;
  // Follow-up / interest
  followUpSent: boolean;
  interestCustom: boolean;
  interestAlts: boolean;
  interestM2M: boolean;
  apptNotes: string;
  // Customizations
  customizationCount: number;
  isRush: boolean;
  // Items / order
  itemsSold: string[];
  favStylesInAppt: string[];
  totalSpend: number | null;
  totalSpendFormatted: string;
  shopifyAddress: string;
  discount: number | null;
  alterationsPaymentStatus: string;
  m2m: boolean;
  qtyItemsSold: number | null;
  apparelMagicOrder: string;
  shopifyOrderNumber: string;
  // Fulfillment
  ship: boolean;
  pickUp: boolean;
  orderReady: boolean;
  pickedPercent: number | null;
  contactedForAlterations: boolean;
  fulfillmentMethod: string;
  fulfillmentLabel: string;
  fulfillmentNotes: string;
  trackingNumber: string;
  threePL: string;
  holdShipmentDate: string | null;
  clientNotifiedFulfillment: boolean;
  addressConfirmed: boolean;
  taxShippingDisplay: string;
  // Alterations
  alterationNotes: string;
  // Flags
  flagFollowUp: boolean;
  flagNoMeasurements: boolean;
  flagNoPhotos: boolean;
  flagCount: number;
  activeFlagLabels: string[];
  // Meta
  displayName: string;
  weddingDisplay: string;
  isOnBoard: boolean;
  timelineBucket: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SELECT DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const MultiSelectDropdown = React.memo(function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayText = selected.length === 0 ? label : selected.length === 1 ? (selected[0] ?? label) : `${selected.length} selected`;
  const toggleOption = (option: string) => {
    onChange(selected.includes(option) ? selected.filter(s => s !== option) : [...selected, option]);
  };

  const isActive = selected.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#25211A] border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
          isActive
            ? 'border-[#D97706] dark:border-[#FBBF24] text-[#D97706] dark:text-[#FBBF24] font-medium'
            : 'border-gray-300 dark:border-[#38322A] text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
        }`}>
        <span className="truncate">{displayText}</span>
        {isActive ? (
          <XIcon
            size={14}
            className="text-[#D97706] dark:text-[#FBBF24] hover:opacity-70 transition-opacity flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
          />
        ) : (
          <CaretDownIcon size={14} className={`text-gray-400 dark:text-gray-500 transition-transform duration-150 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg max-h-[260px] overflow-y-auto w-[240px] py-1"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {options.map(option => (
            <button key={option} type="button" onClick={() => toggleOption(option)}
              className={`flex items-center w-full px-3 py-2 text-sm text-left cursor-pointer transition-colors ${selected.includes(option) ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-[#FEF3C7] dark:hover:bg-[#3A2E12]'}`}>
              <span className="truncate">{option}</span>
            </button>
          ))}
          {options.length === 0 && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No options</div>}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT CARD (kanban)
// ─────────────────────────────────────────────────────────────────────────────
interface ClientCardProps {
  client: ClientData;
  stageColors: { bg: string; fg: string };
  onCardClick: (clientId: string) => void;
}

const ClientCard = React.memo(function ClientCard({ client, stageColors, onCardClick }: ClientCardProps) {
  return (
    <div onClick={() => onCardClick(client.id)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
      className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-3 cursor-pointer transition-colors space-y-2"
      style={{ borderLeftColor: stageColors.bg, borderLeftWidth: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{client.displayName}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{client.weddingDisplay}</div>
      {client.salesAssociateName && <div className="text-xs text-gray-600 dark:text-gray-400">SA: {client.salesAssociateName}</div>}
      {client.nextAppointmentAltLead && <div className="text-xs text-gray-600 dark:text-gray-400">AL: {client.nextAppointmentAltLead}</div>}
      {client.flagCount > 0 && (
        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
          {client.flagCount} flag{client.flagCount === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL ROW — read-only display
// ─────────────────────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{value || '—'}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITABLE FIELD COMPONENTS
// All persist on blur. Checkbox persists on toggle.
// ─────────────────────────────────────────────────────────────────────────────
interface EditableTextProps {
  label: string;
  value: string;
  fieldId: string;
  recordId: string;
  table: Table;
  multiline?: boolean;
}

function EditableText({ label, value, fieldId, recordId, table, multiline = false }: EditableTextProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleBlur = async () => {
    if (localValue === value) return;
    setSaving(true);
    setError(null);
    try {
      await table.updateRecordAsync(recordId, { [fieldId]: localValue || null });
    } catch (e: any) {
      setError('Save failed');
      console.error(`EditableText save error [${fieldId}]:`, e);
      setLocalValue(value); // revert
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1">
        {label}
        {saving && <span className="text-[#D97706] dark:text-[#FBBF24] text-xs">saving…</span>}
        {error && <span className="text-red-500 dark:text-red-400 text-xs">{error}</span>}
      </div>
      {multiline ? (
        <textarea
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          className="mt-0.5 w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1B1813] border border-gray-200 dark:border-[#38322A] rounded px-2 py-1 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none resize-none transition-colors"
        />
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className="mt-0.5 w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1B1813] border border-gray-200 dark:border-[#38322A] rounded px-2 py-1 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors"
        />
      )}
    </div>
  );
}

interface EditableNumberProps {
  label: string;
  value: number | null;
  fieldId: string;
  recordId: string;
  table: Table;
  suffix?: string;
  isPercent?: boolean;
}

function EditableNumber({ label, value, fieldId, recordId, table, suffix, isPercent }: EditableNumberProps) {
  // percent fields: Airtable stores 0.0–1.0, display as 0–100
  const displayValue = value !== null ? (isPercent ? String(Math.round(value * 100)) : String(value)) : '';
  const [localValue, setLocalValue] = useState(displayValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(value !== null ? (isPercent ? String(Math.round(value * 100)) : String(value)) : '');
  }, [value, isPercent]);

  const handleBlur = async () => {
    const parsed = localValue === '' ? null : parseFloat(localValue);
    const stored = parsed !== null && isPercent ? parsed / 100 : parsed;
    if (stored === value) return;
    setSaving(true);
    setError(null);
    try {
      await table.updateRecordAsync(recordId, { [fieldId]: stored });
    } catch (e: any) {
      setError('Save failed');
      console.error(`EditableNumber save error [${fieldId}]:`, e);
      setLocalValue(displayValue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1">
        {label}
        {saving && <span className="text-[#D97706] dark:text-[#FBBF24] text-xs">saving…</span>}
        {error && <span className="text-red-500 dark:text-red-400 text-xs">{error}</span>}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className="mt-0.5 w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1B1813] border border-gray-200 dark:border-[#38322A] rounded px-2 py-1 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors"
        />
        {suffix && <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

interface EditableCheckboxProps {
  label: string;
  value: boolean;
  fieldId: string;
  recordId: string;
  table: Table;
}

function EditableCheckbox({ label, value, fieldId, recordId, table }: EditableCheckboxProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleToggle = async () => {
    const next = !localValue;
    setLocalValue(next);
    setSaving(true);
    setError(null);
    try {
      await table.updateRecordAsync(recordId, { [fieldId]: next });
    } catch (e: any) {
      setError('Save failed');
      console.error(`EditableCheckbox save error [${fieldId}]:`, e);
      setLocalValue(localValue); // revert
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1">
        {label}
        {saving && <span className="text-[#D97706] dark:text-[#FBBF24] text-xs">saving…</span>}
        {error && <span className="text-red-500 dark:text-red-400 text-xs">{error}</span>}
      </div>
      <button type="button" onClick={handleToggle}
        className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
          localValue
            ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30'
            : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#38322A] hover:border-gray-300 dark:hover:border-gray-600'
        }`}>
        {localValue ? <CheckIcon size={12} weight="bold" /> : <XIcon size={12} />}
        {localValue ? 'Yes' : 'No'}
      </button>
    </div>
  );
}

interface EditableDateProps {
  label: string;
  value: string | null;
  fieldId: string;
  recordId: string;
  table: Table;
}

function EditableDate({ label, value, fieldId, recordId, table }: EditableDateProps) {
  // Airtable date fields return YYYY-MM-DD
  const toInputValue = (v: string | null) => {
    if (!v) return '';
    const d = parseDateFlexible(v);
    if (!d || isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0]!;
  };
  const [localValue, setLocalValue] = useState(toInputValue(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setLocalValue(toInputValue(value)); }, [value]);

  const handleBlur = async () => {
    if (localValue === toInputValue(value)) return;
    setSaving(true);
    setError(null);
    try {
      await table.updateRecordAsync(recordId, { [fieldId]: localValue || null });
    } catch (e: any) {
      setError('Save failed');
      console.error(`EditableDate save error [${fieldId}]:`, e);
      setLocalValue(toInputValue(value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1">
        {label}
        {saving && <span className="text-[#D97706] dark:text-[#FBBF24] text-xs">saving…</span>}
        {error && <span className="text-red-500 dark:text-red-400 text-xs">{error}</span>}
      </div>
      <input
        type="date"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className="mt-0.5 w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1B1813] border border-gray-200 dark:border-[#38322A] rounded px-2 py-1 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors"
      />
    </div>
  );
}

interface EditableSelectProps {
  label: string;
  value: string;
  options: string[];
  fieldId: string;
  recordId: string;
  table: Table;
}

function EditableSelect({ label, value, options, fieldId, recordId, table }: EditableSelectProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = async (next: string) => {
    setLocalValue(next);
    setSaving(true);
    setError(null);
    try {
      await table.updateRecordAsync(recordId, { [fieldId]: next ? { name: next } : null });
    } catch (e: any) {
      setError('Save failed');
      console.error(`EditableSelect save error [${fieldId}]:`, e);
      setLocalValue(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1">
        {label}
        {saving && <span className="text-[#D97706] dark:text-[#FBBF24] text-xs">saving…</span>}
        {error && <span className="text-red-500 dark:text-red-400 text-xs">{error}</span>}
      </div>
      <select
        value={localValue}
        onChange={e => handleChange(e.target.value)}
        className="mt-0.5 w-full text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#38322A] rounded px-2 py-1 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none bg-white dark:bg-[#1B1813] transition-colors"
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY PROFILE MODAL
// ─────────────────────────────────────────────────────────────────────────────
interface SummaryProfileModalProps {
  client: ClientData;
  stageColors: { bg: string; fg: string };
  clientsTable: Table;
  onClose: () => void;
  onViewFullProfile: () => void;
}

const FULFILLMENT_METHOD_OPTIONS = [
  'Pick Up - New York',
  'Pick Up - Melrose',
  'Ship (Shopify Address)',
  'Ship (Acuity Address)',
  'Ship (Other Address)',
];

const ALTERATIONS_PAYMENT_OPTIONS = [
  'Pending',
  'Paid',
  'Waived',
];

const SummaryProfileModal = React.memo(function SummaryProfileModal({
  client, stageColors, clientsTable, onClose, onViewFullProfile,
}: SummaryProfileModalProps) {
  const stage = client.stage;
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setIsVisible(true), 10); return () => clearTimeout(t); }, []);
  const requestClose = useCallback(() => { setIsVisible(false); setTimeout(onClose, 200); }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 transition-opacity duration-200 ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', opacity: isVisible?1:0 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <div
        className="bg-white dark:bg-[#25211A] rounded-xl w-full max-w-[720px] p-6 max-h-[90vh] overflow-y-auto transition-[opacity,transform] duration-200 ease-out"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)', opacity: isVisible?1:0, transform: isVisible?'scale(1)':'scale(0.96)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{client.displayName}</div>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium"
                style={{ backgroundColor: stageColors.bg, color: stageColors.fg }}>
                {client.stage}
              </span>
              <span className="text-base text-gray-500 dark:text-gray-400">{client.studio || '—'}</span>
            </div>
          </div>
        </div>

        {/* Flags — Deliberating only */}
        {stage === 'Deliberating' && client.flagCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {client.activeFlagLabels.map(label => (
              <span key={label} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Contact */}
        <div className="space-y-2 mt-4">
          {client.formattedPhone && (
            <div className="flex items-center gap-2">
              <PhoneIcon size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <a href={`tel:${client.phone}`} className="text-sm text-[#D97706] dark:text-[#FBBF24]">{client.formattedPhone}</a>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2">
              <EnvelopeSimpleIcon size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <a href={`mailto:${client.email}`} className="text-sm text-[#D97706] dark:text-[#FBBF24] truncate">{client.email}</a>
            </div>
          )}
        </div>

        <hr className="my-4 border-gray-200 dark:border-[#38322A]" />

        {/* Stage-specific fields */}
        <div className="space-y-4">

          {/* ── PRE-APPOINTMENT ── */}
          {stage === 'Pre-Appointment' && (
            <>
              <DetailRow label="Country of Residence" value={client.countryOfResidence} />
              <DetailRow label="Next Appointment" value={formatAppointmentDateTime(client.nextAppointment)} />
              <DetailRow label="Previous Appointments" value={String(client.appointmentCount)} />
              <DetailRow label="Studio" value={client.studio} />
              <EditableText label="Preferred Stylist" value={client.preferredStylist} fieldId={FIELD_IDS.CLIENT_PREFERRED_STYLIST} recordId={client.id} table={clientsTable} />
              <EditableText label="RTW Size" value={client.rtwSize} fieldId={FIELD_IDS.CLIENT_RTW_SIZE} recordId={client.id} table={clientsTable} />
              <DetailRow label="Favorite Styles (Acuity)" value={client.favStylesAcuity || '—'} />
              <EditableText label="Samples Not Where Needed" value={client.samplesNotWhereNeeded} fieldId={FIELD_IDS.CLIENT_SAMPLES_NOT_WHERE_NEEDED} recordId={client.id} table={clientsTable} />
              <EditableText label="Personal Style Notes" value={client.personalStyleNotes} fieldId={FIELD_IDS.CLIENT_PERSONAL_STYLE_NOTES} recordId={client.id} table={clientsTable} multiline />
              <EditableText label="Wedding Location" value={client.weddingLocation} fieldId={FIELD_IDS.CLIENT_WEDDING_LOCATION} recordId={client.id} table={clientsTable} />
              <EditableText label="Wedding Planner" value={client.weddingPlanner} fieldId={FIELD_IDS.CLIENT_WEDDING_PLANNER} recordId={client.id} table={clientsTable} />
            </>
          )}

          {/* ── DELIBERATING ── */}
          {stage === 'Deliberating' && (
            <>
              <DetailRow label="Country of Residence" value={client.countryOfResidence} />
              <DetailRow label="Last Appointment" value={formatAppointmentDateTime(client.lastAppointment)} />
              <DetailRow label="Next Appointment" value={formatAppointmentDateTime(client.nextAppointment)} />
              <DetailRow label="Favorite Styles" value={client.favStylesInAppt.join(', ') || '—'} />
              <DetailRow label="Customization Requests" value={client.customizationCount > 0 ? String(client.customizationCount) : '—'} />
              <DetailRow label="Measurements" value={
                [client.measBust, client.measWaist, client.measHips, client.measHeight].some(v => v !== null)
                  ? `B: ${client.measBust ?? '—'} / W: ${client.measWaist ?? '—'} / H: ${client.measHips ?? '—'} / Ht: ${client.measHeight ?? '—'}`
                  : '—'
              } />
              <DetailRow label="Measurement Photos" value={client.hasMeasurementPhotos ? 'Present' : 'Missing'} />
              <DetailRow label="Appt Photos" value={client.flagNoPhotos ? 'Missing' : 'Present'} />
              <EditableCheckbox label="Interest in Alts" value={client.interestAlts} fieldId={FIELD_IDS.CLIENT_INTEREST_ALTS} recordId={client.id} table={clientsTable} />
              <EditableCheckbox label="Interest in M2M" value={client.interestM2M} fieldId={FIELD_IDS.CLIENT_INTEREST_M2M} recordId={client.id} table={clientsTable} />
              <DetailRow label="Rush" value={client.isRush ? '🚨 Yes' : 'No'} />
              <EditableText label="Appointment Notes" value={client.apptNotes} fieldId={FIELD_IDS.CLIENT_APPT_NOTES} recordId={client.id} table={clientsTable} multiline />
            </>
          )}

          {/* ── SOLD ── */}
          {stage === 'Sold' && (
            <>
              <EditableText label="Address" value={client.shopifyAddress} fieldId={FIELD_IDS.CLIENT_SHOPIFY_ADDRESS} recordId={client.id} table={clientsTable} />
              <DetailRow label="Country" value={client.countryOfResidence} />
              <DetailRow label="Customizations" value={client.customizationCount > 0 ? String(client.customizationCount) : '—'} />
              <DetailRow label="Total Spend" value={client.totalSpendFormatted} />
              <DetailRow label="Discount" value={client.discount != null ? `$${client.discount.toLocaleString()}` : '—'} />
              <EditableSelect
                label="Alterations Payment"
                value={client.alterationsPaymentStatus}
                options={ALTERATIONS_PAYMENT_OPTIONS}
                fieldId={FIELD_IDS.CLIENT_ALTERATIONS_PAYMENT_STATUS}
                recordId={client.id}
                table={clientsTable}
              />
              {client.alterationsPaymentStatus?.toLowerCase() === 'paid' && (
                <DetailRow label="Alterations" value="Yes — Paid" />
              )}
              <EditableCheckbox label="M2M" value={client.m2m} fieldId={FIELD_IDS.CLIENT_M2M} recordId={client.id} table={clientsTable} />
              <DetailRow label="Qty" value={client.qtyItemsSold != null ? String(client.qtyItemsSold) : '—'} />
              <DetailRow label="Shopify #" value={client.shopifyOrderNumber || '—'} />
              <DetailRow label="AM #" value={client.apparelMagicOrder || '—'} />
            </>
          )}

          {/* ── IN PRODUCTION (ORDER READY) ── */}
          {stage === 'In Production' && (
            <>
              <EditableNumber label="% Picked" value={client.pickedPercent} fieldId={FIELD_IDS.CLIENT_PICKED_PERCENT} recordId={client.id} table={clientsTable} suffix="%" isPercent />
              <EditableCheckbox label="Order Ready" value={client.orderReady} fieldId={FIELD_IDS.CLIENT_ORDER_READY} recordId={client.id} table={clientsTable} />
              <DetailRow label="Items Sold" value={client.itemsSold.join(', ') || '—'} />
              <DetailRow label="Address" value={client.shopifyAddress} />
              <DetailRow label="Country" value={client.countryOfResidence} />
              <EditableCheckbox label="Alterations" value={client.contactedForAlterations} fieldId={FIELD_IDS.CLIENT_CONTACTED_FOR_ALTERATIONS} recordId={client.id} table={clientsTable} />
              <EditableCheckbox label="Shipping" value={client.ship} fieldId={FIELD_IDS.CLIENT_SHIP} recordId={client.id} table={clientsTable} />
              <EditableCheckbox label="Pick Up" value={client.pickUp} fieldId={FIELD_IDS.CLIENT_PICK_UP} recordId={client.id} table={clientsTable} />
              <EditableCheckbox label="Client Notified" value={client.clientNotifiedFulfillment} fieldId={FIELD_IDS.CLIENT_CLIENT_NOTIFIED_FULFILLMENT} recordId={client.id} table={clientsTable} />
            </>
          )}

          {/* ── IN ALTERATIONS ── */}
          {stage === 'In Alterations' && (
            <>
              <DetailRow label="Next Alterations Appt" value={formatAppointmentDateTime(client.latestAlterationsAppt)} />
              <EditableText label="Alteration Notes" value={client.alterationNotes} fieldId={FIELD_IDS.CLIENT_ALTERATION_NOTES} recordId={client.id} table={clientsTable} multiline />
            </>
          )}

          {/* ── IN FULFILLMENT ── */}
          {stage === 'In Fulfillment' && (
            <>
              <EditableText label="Fulfillment Notes" value={client.fulfillmentNotes} fieldId={FIELD_IDS.CLIENT_FULFILLMENT_NOTES} recordId={client.id} table={clientsTable} multiline />
              <EditableNumber label="% Picked" value={client.pickedPercent} fieldId={FIELD_IDS.CLIENT_PICKED_PERCENT} recordId={client.id} table={clientsTable} suffix="%" isPercent />
              <EditableSelect
                label="Fulfillment Method"
                value={client.fulfillmentMethod}
                options={FULFILLMENT_METHOD_OPTIONS}
                fieldId={FIELD_IDS.CLIENT_FULFILLMENT_METHOD}
                recordId={client.id}
                table={clientsTable}
              />
              <EditableText label="Shipping Address" value={client.shopifyAddress} fieldId={FIELD_IDS.CLIENT_SHOPIFY_ADDRESS} recordId={client.id} table={clientsTable} />
              <EditableCheckbox label="Client Notified" value={client.clientNotifiedFulfillment} fieldId={FIELD_IDS.CLIENT_CLIENT_NOTIFIED_FULFILLMENT} recordId={client.id} table={clientsTable} />
              <EditableCheckbox label="Address Confirmed" value={client.addressConfirmed} fieldId={FIELD_IDS.CLIENT_ADDRESS_CONFIRMED} recordId={client.id} table={clientsTable} />
              <EditableText label="Tracking #" value={client.trackingNumber} fieldId={FIELD_IDS.CLIENT_TRACKING_NUMBER} recordId={client.id} table={clientsTable} />
              <DetailRow label="3PL" value={client.threePL || '—'} />
              <EditableDate label="Hold — Do Not Ship Until" value={client.holdShipmentDate} fieldId={FIELD_IDS.CLIENT_HOLD_SHIPMENT_DATE} recordId={client.id} table={clientsTable} />
              {client.holdShipmentDate && new Date(client.holdShipmentDate) > new Date() && (
                <div className="px-3 py-2 rounded-md bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30">
                  <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                    🚨 Do not ship until {formatFullDate(client.holdShipmentDate)}
                  </span>
                </div>
              )}
              <DetailRow label="Tax + Shipping" value={client.taxShippingDisplay} />
            </>
          )}

        </div>

        <button type="button" onClick={onViewFullProfile}
          className="w-full mt-6 px-4 py-2.5 rounded-lg bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] text-sm font-semibold hover:bg-[#C26605] dark:hover:bg-[#E8AC1F] transition-colors">
          View Full Profile
        </button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FULL PROFILE MODAL
// ─────────────────────────────────────────────────────────────────────────────
interface FullProfileModalProps {
  client: ClientData;
  stageColors: { bg: string; fg: string };
  stageChoices: Array<{ name: string; color?: string }>;
  clientsTable: Table;
  onClose: () => void;
}

const STAGE_STEPS: string[] = [
  'Pre-Appointment', 'Deliberating', 'Sold', 'In Production', 'In Alterations', 'In Fulfillment',
];

const FullProfileModal = React.memo(function FullProfileModal({ client, stageColors, stageChoices, clientsTable, onClose }: FullProfileModalProps) {
  const currentStageIndex = STAGE_STEPS.indexOf(client.stage);

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F5EE] dark:bg-[#1B1813] overflow-y-auto">
      <div className="max-w-[1200px] mx-auto p-6 space-y-4">
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-2 text-base text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-[#38322A] rounded-lg px-4 py-2 bg-white dark:bg-[#25211A] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors mb-4">
          <CaretLeftIcon size={16} />
          Go back
        </button>

        {/* Header card */}
        <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-5">
          <div className="flex items-start gap-6 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{client.displayName}</div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium"
                    style={{ backgroundColor: stageColors.bg, color: stageColors.fg }}>
                    {client.stage}
                  </span>
                  <span className="text-base text-gray-500 dark:text-gray-400">{client.studio || '—'}</span>
                </div>
              </div>
            </div>
            {client.flagCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {client.activeFlagLabels.map(label => (
                  <span key={label} className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide">Wedding Date</div>
              <div className="text-base text-gray-900 dark:text-gray-100 font-medium mt-1">{client.weddingDisplay}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide">Sales Associate</div>
              <div className="text-base text-gray-900 dark:text-gray-100 font-medium mt-1">{client.salesAssociateName || '—'}</div>
              {client.formattedSAPhone && (
                <a href={`tel:${client.salesAssociatePhone}`} className="text-base text-[#D97706] dark:text-[#FBBF24] block">{client.formattedSAPhone}</a>
              )}
            </div>
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide">Email</div>
              {client.email
                ? <a href={`mailto:${client.email}`} className="text-base text-[#D97706] dark:text-[#FBBF24] font-medium mt-1 block truncate">{client.email}</a>
                : <div className="text-base text-gray-400 dark:text-gray-500 mt-1">—</div>}
            </div>
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wide">Phone</div>
              {client.formattedPhone
                ? <a href={`tel:${client.phone}`} className="text-base text-[#D97706] dark:text-[#FBBF24] font-medium mt-1 block">{client.formattedPhone}</a>
                : <div className="text-base text-gray-400 dark:text-gray-500 mt-1">—</div>}
            </div>
          </div>
        </div>

        {/* Stage progress */}
        <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-5">
          <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">STAGE IN PIPELINE</div>
          <div className="flex items-start">
            {STAGE_STEPS.map((step, index) => {
              const isCurrent = index === currentStageIndex;
              const isPast = index < currentStageIndex;
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
                    {isPast && (
                      <div className="w-6 h-6 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center">
                        <CheckIcon size={14} weight="bold" className="text-white" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="w-6 h-6 rounded-full border-2 border-green-600 dark:border-green-500 bg-white dark:bg-[#25211A] flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-600 dark:bg-green-500" />
                      </div>
                    )}
                    {!isPast && !isCurrent && (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-[#38322A] bg-white dark:bg-[#25211A]" />
                    )}
                    <span className={`text-xs mt-2 text-center ${isCurrent ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {STAGE_LABELS[step] ?? step}
                    </span>
                  </div>
                  {index < STAGE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mt-3 mx-1 ${index < currentStageIndex ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-300 dark:bg-[#38322A]'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Appointment details */}
        <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-5">
          <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">APPOINTMENT DETAILS</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Next Appointment</div>
              <div className="text-sm text-gray-900 dark:text-gray-100 font-medium mt-1">{client.nextAppointment ? formatShortDate(client.nextAppointment) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Last Appointment</div>
              <div className="text-sm text-gray-900 dark:text-gray-100 font-medium mt-1">{client.lastAppointment ? formatShortDate(client.lastAppointment) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Room</div>
              <div className="text-sm text-gray-900 dark:text-gray-100 font-medium mt-1">{client.nextAppointmentRoom || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Total Appointments</div>
              <div className="text-sm text-[#D97706] dark:text-[#FBBF24] font-medium mt-1">{client.appointmentCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {[
              { label: 'Measurements', flag: client.flagNoMeasurements, yes: 'Complete', no: 'Missing' },
              { label: 'Appt Photos',  flag: client.flagNoPhotos,        yes: 'Complete', no: 'Missing' },
              { label: 'Follow-Up',    flag: client.flagFollowUp,         yes: 'Pending',  no: 'Sent' },
            ].map(({ label, flag, yes, no }) => (
              <div key={label}>
                <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</div>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${flag ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30' : 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30'}`}>
                    {flag ? yes : no}
                  </span>
                </div>
              </div>
            ))}
            <div />
          </div>
        </div>

        {/* Interests */}
        <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-5">
          <div className="flex gap-8">
            {[
              { label: 'Interest in Custom', value: client.interestCustom },
              { label: 'Interest in Alts',   value: client.interestAlts },
              { label: 'Interest in M2M',    value: client.interestM2M },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</div>
                <div className={`text-sm font-medium ${value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{value ? 'Yes' : 'No'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg p-5">
          <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">POST-APPOINTMENT NOTES</div>
          {client.apptNotes
            ? <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{client.apptNotes}</p>
            : <p className="text-sm text-gray-400 dark:text-gray-500">No notes yet.</p>}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PROPERTIES
// ─────────────────────────────────────────────────────────────────────────────
function getCustomProperties(base: ReturnType<typeof useBase>) {
  return [{
    key: 'clientsTable',
    label: 'Clients',
    type: 'table' as const,
    defaultValue: base.tables.find(t => t.id === 'tblLLUlDgJ4ktzF7c'),
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function Pipeline(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
  const clientsTable = customPropertyValueByKey?.clientsTable as Table | undefined;

  const usedFields = useMemo(
    () => clientsTable
      ? Object.values(FIELD_IDS).map(id => clientsTable.getFieldIfExists(id)).filter((f): f is NonNullable<typeof f> => f !== null)
      : [],
    [clientsTable],
  );

  const clientRecords = useRecords(clientsTable ?? null, { fields: usedFields });

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 150);
  const [studioFilter, setStudioFilter] = useState<string[]>([]);
  const [salespersonFilter, setSalespersonFilter] = useState<string[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<string[]>(['This week']);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);

  const stageField = clientsTable?.getFieldIfExists(FIELD_IDS.CLIENT_STAGE);
  const stageChoices = useMemo(() => {
    if (!stageField) return [];
    const config = stageField.config;
    if (config?.type === 'singleSelect' && config.options?.choices) {
      return config.options.choices as Array<{ name: string; color?: string }>;
    }
    return [];
  }, [stageField]);

  const stageColorsByStage = useMemo(() => {
    const map = new Map<string, { bg: string; fg: string }>();
    for (const stage of STAGE_ORDER) {
      const choice = stageChoices.find(c => c.name === stage);
      map.set(stage, getStageColors(choice?.color));
    }
    return map;
  }, [stageChoices]);

  const fields = useMemo(() => {
    if (!clientsTable) return null;
    const f = (id: string) => clientsTable.getFieldIfExists(id);
    return {
      fullName:                   f(FIELD_IDS.CLIENT_FULL_NAME),
      firstName:                  f(FIELD_IDS.CLIENT_FIRST_NAME),
      lastName:                   f(FIELD_IDS.CLIENT_LAST_NAME),
      stage:                      f(FIELD_IDS.CLIENT_STAGE),
      email:                      f(FIELD_IDS.CLIENT_EMAIL),
      phone:                      f(FIELD_IDS.CLIENT_PHONE),
      wedding:                    f(FIELD_IDS.CLIENT_WEDDING),
      weddingIfNotSet:            f(FIELD_IDS.CLIENT_WEDDING_IF_NOT_SET),
      weddingLocation:            f(FIELD_IDS.CLIENT_WEDDING_LOCATION),
      weddingPlanner:             f(FIELD_IDS.CLIENT_WEDDING_PLANNER),
      studioNameRollup:           f(FIELD_IDS.CLIENT_STUDIO_NAME_ROLLUP),
      salesAssociateLink:         f(FIELD_IDS.CLIENT_SALES_ASSOCIATE_LINK),
      salesAssociatePhone:        f(FIELD_IDS.CLIENT_SALES_ASSOCIATE_PHONE),
      salesAssociateEmail:        f(FIELD_IDS.CLIENT_SALES_ASSOCIATE_EMAIL),
      appointmentCount:           f(FIELD_IDS.CLIENT_APPOINTMENT_COUNT),
      apptPhotos:                 f(FIELD_IDS.CLIENT_APPT_PHOTOS),
      measurements:               f(FIELD_IDS.CLIENT_MEASUREMENTS),
      measBust:                   f(FIELD_IDS.CLIENT_MEAS_BUST),
      measWaist:                  f(FIELD_IDS.CLIENT_MEAS_WAIST),
      measHips:                   f(FIELD_IDS.CLIENT_MEAS_HIPS),
      measHeight:                 f(FIELD_IDS.CLIENT_MEAS_HEIGHT),
      followUpSent:               f(FIELD_IDS.CLIENT_FOLLOW_UP_SENT),
      itemsSold:                  f(FIELD_IDS.CLIENT_ITEMS_SOLD),
      favStylesInAppt:            f(FIELD_IDS.CLIENT_FAV_STYLES_IN_APPT),
      totalSpend:                 f(FIELD_IDS.CLIENT_TOTAL_SPEND),
      ship:                       f(FIELD_IDS.CLIENT_SHIP),
      pickUp:                     f(FIELD_IDS.CLIENT_PICK_UP),
      orderReady:                 f(FIELD_IDS.CLIENT_ORDER_READY),
      pickedPercent:              f(FIELD_IDS.CLIENT_PICKED_PERCENT),
      contactedForAlterations:    f(FIELD_IDS.CLIENT_CONTACTED_FOR_ALTERATIONS),
      interestCustom:             f(FIELD_IDS.CLIENT_INTEREST_CUSTOM),
      interestAlts:               f(FIELD_IDS.CLIENT_INTEREST_ALTS),
      interestM2M:                f(FIELD_IDS.CLIENT_INTEREST_M2M),
      fulfillmentMethod:          f(FIELD_IDS.CLIENT_FULFILLMENT_METHOD),
      fulfillmentNotes:           f(FIELD_IDS.CLIENT_FULFILLMENT_NOTES),
      trackingNumber:             f(FIELD_IDS.CLIENT_TRACKING_NUMBER),
      threePL:                    f(FIELD_IDS.CLIENT_3PL),
      holdShipmentDate:           f(FIELD_IDS.CLIENT_HOLD_SHIPMENT_DATE),
      clientNotifiedFulfillment:  f(FIELD_IDS.CLIENT_CLIENT_NOTIFIED_FULFILLMENT),
      addressConfirmed:           f(FIELD_IDS.CLIENT_ADDRESS_CONFIRMED),
      apptNotes:                  f(FIELD_IDS.CLIENT_APPT_NOTES),
      nextAppointment:            f(FIELD_IDS.CLIENT_NEXT_APPOINTMENT),
      lastAppointment:            f(FIELD_IDS.CLIENT_LAST_APPOINTMENT),
      latestAlterationsAppt:      f(FIELD_IDS.CLIENT_LATEST_ALTERATIONS_APPT),
      nextAppointmentAltLead:     f(FIELD_IDS.CLIENT_NEXT_APPT_ALT_LEAD),
      nextAppointmentRoom:        f(FIELD_IDS.CLIENT_NEXT_APPT_ROOM),
      countryOfResidence:         f(FIELD_IDS.CLIENT_COUNTRY_OF_RESIDENCE),
      preferredStylist:           f(FIELD_IDS.CLIENT_PREFERRED_STYLIST),
      rtwSize:                    f(FIELD_IDS.CLIENT_RTW_SIZE),
      favStylesAcuity:            f(FIELD_IDS.CLIENT_FAV_STYLES_ACUITY),
      samplesNotWhereNeeded:      f(FIELD_IDS.CLIENT_SAMPLES_NOT_WHERE_NEEDED),
      personalStyleNotes:         f(FIELD_IDS.CLIENT_PERSONAL_STYLE_NOTES),
      customizationLink:          f(FIELD_IDS.CLIENT_CUSTOMIZATION_LINK),
      customizationIsRush:        f(FIELD_IDS.CLIENT_CUSTOMIZATION_IS_RUSH),
      shopifyAddress:             f(FIELD_IDS.CLIENT_SHOPIFY_ADDRESS),
      discount:                   f(FIELD_IDS.CLIENT_DISCOUNT),
      alterationsPaymentStatus:   f(FIELD_IDS.CLIENT_ALTERATIONS_PAYMENT_STATUS),
      m2m:                        f(FIELD_IDS.CLIENT_M2M),
      qtyItemsSold:               f(FIELD_IDS.CLIENT_QTY_ITEMS_SOLD),
      apparelMagicOrder:          f(FIELD_IDS.CLIENT_APPAREL_MAGIC_ORDER),
      shopifyOrderNumber:         f(FIELD_IDS.CLIENT_SHOPIFY_ORDER_NUMBER),
      alterationNotes:            f(FIELD_IDS.CLIENT_ALTERATION_NOTES),
    };
  }, [clientsTable]);

  const clientsData = useMemo((): ClientData[] => {
    if (!clientRecords || !fields) return [];
    return clientRecords.map(record => {
      const fullName              = getCellValueAsStringSafe(record, fields.fullName);
      const firstName             = getCellValueAsStringSafe(record, fields.firstName);
      const lastName              = getCellValueAsStringSafe(record, fields.lastName);
      const stage                 = getCellValueAsStringSafe(record, fields.stage);
      const email                 = getCellValueAsStringSafe(record, fields.email);
      const phone                 = getCellValueAsStringSafe(record, fields.phone);
      const weddingDate           = getCellValueAsStringSafe(record, fields.wedding) || null;
      const weddingDateIfNotSet   = getCellValueAsStringSafe(record, fields.weddingIfNotSet);
      const weddingLocation       = getCellValueAsStringSafe(record, fields.weddingLocation);
      const weddingPlanner        = getCellValueAsStringSafe(record, fields.weddingPlanner);
      const studio                = getCellValueAsStringSafe(record, fields.studioNameRollup);
      const salesAssociateName    = getCellValueAsStringSafe(record, fields.salesAssociateLink);
      const salesAssociatePhone   = getCellValueAsStringSafe(record, fields.salesAssociatePhone);
      const salesAssociateEmail   = getCellValueAsStringSafe(record, fields.salesAssociateEmail);
      const appointmentCount      = getCellValueSafe<number>(record, fields.appointmentCount) ?? 0;
      const apptPhotos            = getCellValueSafe<unknown[]>(record, fields.apptPhotos);
      const measurements          = getCellValueSafe<unknown[]>(record, fields.measurements);
      const measBust              = getCellValueSafe<number>(record, fields.measBust) ?? null;
      const measWaist             = getCellValueSafe<number>(record, fields.measWaist) ?? null;
      const measHips              = getCellValueSafe<number>(record, fields.measHips) ?? null;
      const measHeight            = getCellValueSafe<number>(record, fields.measHeight) ?? null;
      const followUpSentRaw       = !!getCellValueSafe<boolean>(record, fields.followUpSent);
      const favStylesLinks        = getCellValueSafe<Array<{ id: string; name?: string }>>(record, fields.favStylesInAppt);
      const itemsSoldRaw          = getCellValueSafe<Array<{ id?: string; name?: string } | string>>(record, fields.itemsSold);
      const totalSpend            = getCellValueSafe<number>(record, fields.totalSpend);
      const ship                  = !!getCellValueSafe<boolean>(record, fields.ship);
      const pickUp                = !!getCellValueSafe<boolean>(record, fields.pickUp);
      const orderReady            = !!getCellValueSafe<boolean>(record, fields.orderReady);
      const pickedPercent         = getCellValueSafe<number>(record, fields.pickedPercent);
      const contactedForAlterations = !!getCellValueSafe<boolean>(record, fields.contactedForAlterations);
      const interestCustom        = !!getCellValueSafe<boolean>(record, fields.interestCustom);
      const interestAlts          = !!getCellValueSafe<boolean>(record, fields.interestAlts);
      const interestM2M           = !!getCellValueSafe<boolean>(record, fields.interestM2M);
      const fulfillmentMethod     = getCellValueAsStringSafe(record, fields.fulfillmentMethod);
      const fulfillmentNotes      = getCellValueAsStringSafe(record, fields.fulfillmentNotes);
      const trackingNumber        = getCellValueAsStringSafe(record, fields.trackingNumber);
      const threePL               = getCellValueAsStringSafe(record, fields.threePL);
      const holdShipmentDate      = getCellValueAsStringSafe(record, fields.holdShipmentDate) || null;
      const clientNotifiedFulfillment = !!getCellValueSafe<boolean>(record, fields.clientNotifiedFulfillment);
      const addressConfirmed      = !!getCellValueSafe<boolean>(record, fields.addressConfirmed);
      const apptNotes             = getCellValueAsStringSafe(record, fields.apptNotes);
      const nextAppointment       = extractFirstLookupString(record, fields.nextAppointment);
      const lastAppointment       = extractFirstLookupString(record, fields.lastAppointment);
      const latestAlterationsAppt = extractFirstLookupString(record, fields.latestAlterationsAppt);
      const nextAppointmentAltLead = extractFirstLookupString(record, fields.nextAppointmentAltLead) ?? '';
      const nextAppointmentRoom   = extractFirstLookupString(record, fields.nextAppointmentRoom) ?? '';
      const countryOfResidence    = getCellValueAsStringSafe(record, fields.countryOfResidence);
      const preferredStylist      = getCellValueAsStringSafe(record, fields.preferredStylist);
      const rtwSize               = getCellValueAsStringSafe(record, fields.rtwSize);
      const favStylesAcuityRaw    = getCellValueSafe<Array<{ id: string; name?: string }>>(record, fields.favStylesAcuity);
      const favStylesAcuity       = favStylesAcuityRaw?.map(s => s.name).filter((n): n is string => !!n).join(', ') ?? '';
      const samplesNotWhereNeeded = getCellValueAsStringSafe(record, fields.samplesNotWhereNeeded);
      const personalStyleNotes    = getCellValueAsStringSafe(record, fields.personalStyleNotes);
      const customizationLinks    = getCellValueSafe<Array<{ id: string }>>(record, fields.customizationLink);
      const customizationCount    = customizationLinks?.length ?? 0;
      const customizationIsRushRaw = getCellValueSafe<boolean[] | boolean>(record, fields.customizationIsRush);
      const isRush                = Array.isArray(customizationIsRushRaw)
        ? customizationIsRushRaw.some(v => v === true)
        : !!customizationIsRushRaw;
      const shopifyAddress        = getCellValueAsStringSafe(record, fields.shopifyAddress);
      const discount              = getCellValueSafe<number>(record, fields.discount);
      const alterationsPaymentStatus = getCellValueAsStringSafe(record, fields.alterationsPaymentStatus);
      const m2m                   = !!getCellValueSafe<boolean>(record, fields.m2m);
      const qtyItemsSold          = getCellValueSafe<number>(record, fields.qtyItemsSold);
      const apparelMagicOrder     = getCellValueAsStringSafe(record, fields.apparelMagicOrder);
      const shopifyOrderNumber    = getCellValueAsStringSafe(record, fields.shopifyOrderNumber);
      const alterationNotes       = getCellValueAsStringSafe(record, fields.alterationNotes);

      const hasMeasurementPhotos  = !!(apptPhotos && apptPhotos.length > 0);
      const favStylesInAppt       = favStylesLinks?.map(s => s.name).filter((n): n is string => !!n) ?? [];
      const itemsSold             = itemsSoldRaw?.map(item => typeof item === 'string' ? item : item?.name).filter((n): n is string => !!n) ?? [];

      // Flags
      const flagFollowUp          = !followUpSentRaw;
      const flagNoMeasurements    = measBust === null && measWaist === null && measHips === null && measHeight === null && (!measurements || measurements.length === 0);
      const flagNoPhotos          = !apptPhotos || apptPhotos.length === 0;
      let flagCount = 0;
      if (flagFollowUp) flagCount++;
      if (flagNoMeasurements) flagCount++;
      if (flagNoPhotos) flagCount++;
      const activeFlagLabels: string[] = flagCount === 0 ? EMPTY_FLAG_LABELS : (() => {
        const arr: string[] = [];
        if (flagFollowUp) arr.push('Follow-up not sent');
        if (flagNoMeasurements) arr.push('No measurements');
        if (flagNoPhotos) arr.push('No appt photos');
        return arr;
      })();

      // Computed
      const displayName           = fullName || `${firstName} ${lastName}`.trim() || '—';
      const weddingDisplay        = weddingDate ? formatFullDate(weddingDate) : weddingDateIfNotSet || '—';
      const formattedPhone        = formatPhone(phone);
      const formattedSAPhone      = formatPhone(salesAssociatePhone);
      const totalSpendFormatted   = totalSpend != null ? `$${totalSpend.toLocaleString()}` : '';
      const fmLower               = fulfillmentMethod.toLowerCase();
      const fulfillmentLabel      = fmLower.includes('pick') ? 'Pick Up' : fmLower.includes('ship') ? 'Ship' : fulfillmentMethod || '—';
      const taxShippingDisplay    =
        fulfillmentMethod === 'Pick Up - New York' ? 'NY Sales Tax applies' :
        fulfillmentMethod === 'Pick Up - Melrose'  ? 'CA Sales Tax applies' :
        fmLower.includes('ship')                   ? 'Destination state tax + $150 shipping fee' : '—';
      const isOnBoard             = STAGE_ORDER.includes(stage as StageName);
      const timelineBucket        = getTimelineBucket(weddingDate);

      return {
        id: record.id, fullName, firstName, lastName, stage, email, phone,
        formattedPhone, weddingDate, weddingDateIfNotSet, weddingLocation, weddingPlanner,
        studio, salesAssociateName, salesAssociatePhone, formattedSAPhone,
        salesAssociateEmail, appointmentCount, nextAppointment, lastAppointment,
        latestAlterationsAppt, nextAppointmentAltLead, nextAppointmentRoom,
        countryOfResidence, preferredStylist, rtwSize, favStylesAcuity, samplesNotWhereNeeded,
        personalStyleNotes, measBust, measWaist, measHips, measHeight, hasMeasurementPhotos,
        followUpSent: followUpSentRaw, interestCustom, interestAlts, interestM2M, apptNotes,
        customizationCount, isRush, itemsSold, favStylesInAppt, totalSpend, totalSpendFormatted,
        shopifyAddress, discount, alterationsPaymentStatus, m2m, qtyItemsSold, apparelMagicOrder,
        shopifyOrderNumber, ship, pickUp, orderReady, pickedPercent, contactedForAlterations,
        fulfillmentMethod, fulfillmentLabel, fulfillmentNotes, trackingNumber, threePL,
        holdShipmentDate, clientNotifiedFulfillment, addressConfirmed, taxShippingDisplay,
        alterationNotes, flagFollowUp, flagNoMeasurements, flagNoPhotos, flagCount,
        activeFlagLabels, displayName, weddingDisplay, isOnBoard, timelineBucket,
      };
    });
  }, [clientRecords, fields]);

  const studioOptions = useMemo(() => {
    const s = new Set<string>();
    clientsData.forEach(c => splitMultiValue(c.studio).forEach(v => s.add(v)));
    return Array.from(s).sort();
  }, [clientsData]);

  const salespersonOptions = useMemo(() => {
    const s = new Set<string>();
    let hasUnassigned = false;
    clientsData.forEach(c => {
      const tokens = splitMultiValue(c.salesAssociateName);
      if (tokens.length === 0) hasUnassigned = true;
      tokens.forEach(v => s.add(v));
    });
    const options = Array.from(s).sort();
    if (hasUnassigned) options.push(SALES_ASSOCIATE_OTHER);
    return options;
  }, [clientsData]);

  const filteredClients = useMemo(() => {
    const searchLower  = debouncedSearch.toLowerCase();
    const searchDigits = searchLower.replace(/\D/g, '');
    const studioSet    = studioFilter.length > 0 ? new Set(studioFilter) : null;
    const salesSet     = salespersonFilter.length > 0 ? new Set(salespersonFilter) : null;
    const timelineSet  = timelineFilter.length > 0 ? new Set(timelineFilter) : null;
    return clientsData.filter(c => {
      if (!c.isOnBoard) return false;
      if (searchLower) {
        const matchesName  = c.fullName.toLowerCase().includes(searchLower);
        const matchesPhone = !!searchDigits && c.phone.replace(/\D/g, '').includes(searchDigits);
        const matchesEmail = c.email.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesPhone && !matchesEmail) return false;
      }
      if (studioSet && !splitMultiValue(c.studio).some(v => studioSet.has(v))) return false;
      if (salesSet) {
        const salesTokens = splitMultiValue(c.salesAssociateName);
        const matchesAssigned = salesTokens.some(v => salesSet.has(v));
        const matchesOther = salesTokens.length === 0 && salesSet.has(SALES_ASSOCIATE_OTHER);
        if (!matchesAssigned && !matchesOther) return false;
      }
      if (timelineSet && !timelineSet.has(c.timelineBucket)) return false;
      return true;
    });
  }, [clientsData, debouncedSearch, studioFilter, salespersonFilter, timelineFilter]);

  const clientsByStage = useMemo(() => {
    const map: Record<string, ClientData[]> = {};
    STAGE_ORDER.forEach(s => { map[s] = []; });
    filteredClients.forEach(c => { map[c.stage]?.push(c); });
    STAGE_ORDER.forEach(stage => {
      map[stage]!.sort((a, b) => {
        const aT = a.weddingDate ? (parseDateFlexible(a.weddingDate)?.getTime() ?? Infinity) : Infinity;
        const bT = b.weddingDate ? (parseDateFlexible(b.weddingDate)?.getTime() ?? Infinity) : Infinity;
        return aT !== bT ? aT - bT : a.fullName.localeCompare(b.fullName);
      });
    });
    return map;
  }, [filteredClients]);

  const selectedClient = useMemo(() => clientsData.find(c => c.id === selectedClientId) ?? null, [clientsData, selectedClientId]);
  const selectedClientStageColors = useMemo(() => selectedClient ? (stageColorsByStage.get(selectedClient.stage) ?? DEFAULT_STAGE_COLORS) : DEFAULT_STAGE_COLORS, [selectedClient, stageColorsByStage]);

  useEffect(() => {
    if (selectedClientId && !selectedClient) { setSelectedClientId(null); setFullProfileOpen(false); }
  }, [selectedClientId, selectedClient]);

  const handleCardClick      = useCallback((id: string) => { setSelectedClientId(id); setFullProfileOpen(false); }, []);
  const handleCloseSummary   = useCallback(() => setSelectedClientId(null), []);
  const handleOpenFullProfile = useCallback(() => setFullProfileOpen(true), []);
  const handleCloseFullProfile = useCallback(() => setFullProfileOpen(false), []);
  const clearAllFilters      = useCallback(() => { setSearchQuery(''); setStudioFilter([]); setSalespersonFilter([]); setTimelineFilter([]); }, []);

  const hasActiveFilters  = !!debouncedSearch || studioFilter.length > 0 || salespersonFilter.length > 0 || timelineFilter.length > 0;
  const noMatchingClients = filteredClients.length === 0 && hasActiveFilters;

  if (errorState) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1B1813] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Error loading configuration</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please check the properties panel.</p>
        </div>
      </div>
    );
  }

  if (!clientsTable || !fields?.stage) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1B1813] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configuration Required</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This Pipeline interface requires the Clients table. Configure it in the properties panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#1B1813]">
      {/* Filter row */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#1B1813] flex-shrink-0">
        <div className="relative w-64">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone…"
            className="w-full border border-gray-300 dark:border-[#38322A] bg-white dark:bg-[#25211A] rounded-lg pl-9 pr-8 py-1.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] transition-colors"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <XIcon size={14} />
            </button>
          )}
        </div>
        <MultiSelectDropdown label="Studio"      options={studioOptions}      selected={studioFilter}      onChange={setStudioFilter} />
        <MultiSelectDropdown label="Sales Associate" options={salespersonOptions} selected={salespersonFilter} onChange={setSalespersonFilter} />
        <MultiSelectDropdown label="Timeline"    options={TIMELINE_OPTIONS}   selected={timelineFilter}    onChange={setTimelineFilter} />
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters} aria-label="Clear all filters"
            className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-[#D97706] dark:hover:text-[#FBBF24] hover:bg-[#FEF3C7] dark:hover:bg-[#3A2E12] transition-colors flex-shrink-0">
            <XIcon size={14} />
          </button>
        )}
      </div>

      {noMatchingClients && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-shrink-0">
          <span>No clients match the current filters.</span>
        </div>
      )}

      {/* Kanban board */}
      <div className="flex-1 min-h-0 overflow-hidden flex gap-3 px-4 py-3 bg-[#F8F5EE] dark:bg-[#1B1813]">
        {STAGE_ORDER.map(stage => {
          const clients     = clientsByStage[stage] ?? [];
          const stageColors = stageColorsByStage.get(stage) ?? DEFAULT_STAGE_COLORS;
          const stageLabel  = STAGE_LABELS[stage] ?? stage;
          return (
            <div key={stage} className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-[#38322A]">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{stageLabel}</span>
                <span className="inline-flex items-center justify-center min-w-[28px] h-[22px] px-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: stageColors.bg, color: stageColors.fg }}>
                  {formatStageCount(clients.length)}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {clients.length === 0
                  ? <div className="py-12 text-center text-xs text-gray-400 dark:text-gray-500">No clients in this stage</div>
                  : clients.map(client => (
                      <ClientCard key={client.id} client={client} stageColors={stageColors} onCardClick={handleCardClick} />
                    ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary modal */}
      {selectedClient && !fullProfileOpen && (
        <SummaryProfileModal
          client={selectedClient}
          stageColors={selectedClientStageColors}
          clientsTable={clientsTable}
          onClose={handleCloseSummary}
          onViewFullProfile={handleOpenFullProfile}
        />
      )}

      {/* Full profile modal */}
      {selectedClient && fullProfileOpen && (
        <FullProfileModal
          client={selectedClient}
          stageColors={selectedClientStageColors}
          stageChoices={stageChoices}
          clientsTable={clientsTable}
          onClose={handleCloseFullProfile}
        />
      )}
    </div>
  );
}

initializeBlock({ interface: () => <Pipeline /> });
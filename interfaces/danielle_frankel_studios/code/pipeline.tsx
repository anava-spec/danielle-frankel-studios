import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  useColorScheme,
} from '@airtable/blocks/interface/ui';
import type { Base, Table, Record as AirtableRecord, Field } from '@airtable/blocks/interface/models';
import {
  CaretLeft as CaretLeftIcon,
  MagnifyingGlass as MagnifyingGlassIcon,
  Phone as PhoneIcon,
  EnvelopeSimple as EnvelopeSimpleIcon,
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  X as XIcon,
  Check as CheckIcon,
  FloppyDisk as FloppyDiskIcon,
  CalendarBlank as CalendarIcon,
} from '@phosphor-icons/react';

// ─────────────────────────────────────────────────────────────────────────────
// FIELD ID CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
// #2 — Pre-Appointment 6-month reset: implemented as Airtable formula field (no React logic needed)
const FIELD_IDS = {
  CLIENT_FULL_NAME:                    'fldB3Wyam01D3wR5Q',
  CLIENT_FIRST_NAME:                   'fldFWlAODUcuroeXK',
  CLIENT_LAST_NAME:                    'fldQzSPiUvOid1nXo',
  CLIENT_STAGE:                        'fldLcxVZvI1rigBlh',
  CLIENT_EMAIL:                        'fld5f3IVZoX0QZZ8R',
  CLIENT_PHONE:                        'fldZrxF4bR6QBUwVK',
  CLIENT_WEDDING:                      'fldbgknumKGS5W5WU',
  CLIENT_WEDDING_IF_NOT_SET:           'fldqwfmMczvLhiqk1',
  CLIENT_WEDDING_LOCATION:             'fldikRqj41XYiIDBk',
  CLIENT_WEDDING_PLANNER:              'fldISwHPviwGQBHFJ',
  CLIENT_STUDIO_FORMULA:               'fldNQuys5CFap0drj',
  CLIENT_STUDIO_NAME_ROLLUP:           'fldIenJoxseeHmfIv',
  CLIENT_STUDIO_SHORT_NAME:            'fld1AWRrVteCUmVto',
  CLIENT_SALES_ASSOCIATE_LINK:         'fldBTKBaw8YvNAlwK',
  CLIENT_SALES_ASSOCIATE_NAME:         'fldH8lJJHPUjPnyHZ',
  CLIENT_SALES_ASSOCIATE_PHONE:        'fldl5vP5mpQrHsTsm',
  CLIENT_SALES_ASSOCIATE_EMAIL:        'fldiGcxcshWvxTKKf',
  CLIENT_APPOINTMENT_COUNT:            'fldrnDWDgDx5IF5gz',
  CLIENT_NEXT_APPOINTMENT:             'fldTe2cyBmicx9Ple',
  CLIENT_LAST_APPOINTMENT:             'fldd01OccObkG9sGe',
  CLIENT_NEXT_APPT_ALT_LEAD:           'flddN7YHMuymJKbv9',
  CLIENT_NEXT_APPT_ROOM:               'fldfQUSkQRooZi8sr',
  CLIENT_LATEST_ALTERATIONS_APPT:      'fldoF7SPEjWNi5JQF',
  CLIENT_COUNTRY_OF_RESIDENCE:         'flduQb1j7LceNZuC8',
  CLIENT_PREFERRED_STYLIST:            'fld2jVE1qluvlhV7D',
  CLIENT_RTW_SIZE:                     'fldvV2CiEx4RQN4mO',
  CLIENT_FAV_STYLES_ACUITY:            'fldZzNR0g5VEJ5RmX',
  CLIENT_SAMPLES_NOT_WHERE_NEEDED:     'fldVPJWXThfyGuh6d',
  CLIENT_PERSONAL_STYLE_NOTES:         'fldQiGCx5hRQ0Am1Z',
  CLIENT_MEASUREMENTS:                 'fldcWwbKOc9nkgzzV',
  CLIENT_MEAS_BUST:                    'fldiCV13D0ym7Yirh',
  CLIENT_MEAS_WAIST:                   'fldShyIHilro7fYol',
  CLIENT_MEAS_HIPS:                    'fldx7dNHA3SZYC11C',
  CLIENT_MEAS_HEIGHT:                  'fldTAlnT0Wk3LKPsb',
  CLIENT_APPT_PHOTOS:                  'fldWti8XzHbnGcjz9',
  CLIENT_FOLLOW_UP_SENT:               'fldmjiS7lHEn9qZHN',
  CLIENT_INTEREST_CUSTOM:              'fldTrFh5dMYvkl0F4',
  CLIENT_INTEREST_ALTS:                'fldibh40zShnDmLfj',
  CLIENT_INTEREST_M2M:                 'fld3YweLOIcpr7xvL',
  CLIENT_APPT_NOTES:                   'fldwHp8zC3GykAuO1',
  CLIENT_CUSTOMIZATION_LINK:           'fldlbAPEaoTwfFPTv',
  CLIENT_CUSTOMIZATION_IS_RUSH:        'fldzLjMjNfNn6KEI3',
  CLIENT_ITEMS_SOLD:                   'fldEStULoGtNIjxPO',
  CLIENT_FAV_STYLES_IN_APPT:           'fldVw8wCgPKvxN1jD',
  CLIENT_TOTAL_SPEND:                  'fldasxslBOCb7GXnd',
  CLIENT_SHOPIFY_ADDRESS:              'fldxFbYURZvlZ0tA1',
  CLIENT_DISCOUNT:                     'fldRcaPZSWB7ve24D',
  CLIENT_ALTERATIONS_PAYMENT_STATUS:   'fldlEohtKV3LGF1tC',
  CLIENT_M2M:                          'fldJovDgD9pPRx7Yp',
  CLIENT_QTY_ITEMS_SOLD:               'flda47cFuR4yMHqpu',
  CLIENT_APPAREL_MAGIC_ORDER:          'fldwMsegG6ImCHWxM',
  CLIENT_SHOPIFY_ORDER_NUMBER:         'fldWSGqQW9czYdams',
  APPAREL_MAGIC_ORDER_NUMBER:          'fldIl66OVv22gVVx7',
  CLIENT_SHIP:                         'fldQjLmwDokAkYPEt',
  CLIENT_PICK_UP:                      'fldwqYAsQ3Iasi8QT',
  CLIENT_ORDER_READY:                  'fldCAak4Hy5RmvXWT',
  CLIENT_PICKED_PERCENT:               'fldh9IWe29cCm2WKg',
  CLIENT_CONTACTED_FOR_ALTERATIONS:    'fldmiD8TdERvJJT0j',
  CLIENT_FULFILLMENT_METHOD:           'fldjwCFnGqOToCRnN',
  CLIENT_FULFILLMENT_NOTES:            'fld4dnGW0td7H1dRX',
  CLIENT_TRACKING_NUMBER:              'fldY0SvbuYeHUZa15',
  CLIENT_3PL:                          'fldSxZrcIbBlyJO6R',
  CLIENT_HOLD_SHIPMENT_DATE:           'fldVsDeVp6R6ytqlb',
  CLIENT_CLIENT_NOTIFIED_FULFILLMENT:  'fldxumxeRnrDQ3CIk',
  CLIENT_ADDRESS_CONFIRMED:            'fldksvLd6ZQabAoY1',
  CLIENT_ALTERATION_NOTES:             'fldBhpBTj0gGmV5mc',
  CLIENT_SALES_NOTES:                  'fldsVYhG5tZAccxdK',
  CLIENT_DUE_DATE:                     'flddDJKkZDsOoCOzE',
  CLIENT_CUSTOMIZATION_NOTES:          'fld6C6SKaa1pWbTf6',
  CLIENT_FIRST_ALTERATIONS_APPT:       'fldRS6ctrPGlEPqlR',
  CLIENT_TAXES:                        'fld1Hki2fjZifmFHg',
  CLIENT_SHIPPING_COST:                'fldYcTq6s04xZiy2S',
  CLIENT_LAST_PHASE_CHANGE:            'fldRvvSBhl6vSEnCw',
  CLIENT_OTHER_ADDRESS:                'fld5uRLRmAXqAH0nu',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// VENDORS TABLE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const VENDORS_TABLE_ID       = 'tblZzMdXOlBDJC0BS';
const VENDORS_FIELD_FULL_NAME  = 'fldWtUw9VVy8RnEYf';
const VENDORS_FIELD_TYPE       = 'fldzhQEPHUoft8B3K';
const VENDORS_FIELD_CLIENTS    = 'fldYiu4zItke9Qzun';

const STAFF_TABLE_ID          = 'tblbYk88xJ8FQrLS4';
const STAFF_FIELD_FULL_NAME   = 'fldc8INBZmwC3xeH7';
const STAFF_FIELD_IS_ACTIVE   = 'fldB6rPTjxATp7uMf';

const THREE_PL_OPTIONS = ['UPS', 'FedEx', 'DHL', 'INTERJUMBO'];

// ─────────────────────────────────────────────────────────────────────────────
// CHAMPAGNE COLOR SYSTEM (reference — this file encodes these as Tailwind
// arbitrary-value classes with dark: variants, matching the existing pattern
// of dark:bg-[#hex] used throughout rather than runtime theme branching)
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

// ─────────────────────────────────────────────────────────────────────────────
// WRITE QUEUE
// ─────────────────────────────────────────────────────────────────────────────
let _writeQueue: Promise<void> = Promise.resolve();
function queueWrite(fn: () => Promise<unknown>): Promise<unknown> {
  const next = _writeQueue.then(fn);
  _writeQueue = next.then(() => {}, () => {});
  return next;
}

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
// STAGE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_ORDER = [
  'Pre-Appointment',
  'Deliberating',
  'Sold',
  'Order Ready',
  'In Alterations',
  'In Fulfillment',
] as const;
type StageName = (typeof STAGE_ORDER)[number];

const STAGE_DISPLAY_LABELS: Record<string, string> = {
  'Pre-Appointment': 'Pre-Appointment',
  'Deliberating': 'Deliberating',
  'Sold': 'Sold',
  'Order Ready': 'Order Ready',
  'In Alterations': 'In Alterations',
  'In Fulfillment': 'In Fulfillment',
};

const TIMELINE_OPTIONS = [
  'Last 7 days', 'Last 30 days', 'Last 6 months',
];

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
// EXTERNAL FIELD SOURCE METADATA (Change #5)
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_SOURCE: Record<string, 'acuity' | 'shopify' | 'apparel_magic'> = {
  [FIELD_IDS.CLIENT_FULL_NAME]: 'acuity',
  [FIELD_IDS.CLIENT_FIRST_NAME]: 'acuity',
  [FIELD_IDS.CLIENT_LAST_NAME]: 'acuity',
  [FIELD_IDS.CLIENT_PHONE]: 'acuity',
  'fldkpfulLIk0jq34d': 'acuity',
  [FIELD_IDS.CLIENT_FAV_STYLES_ACUITY]: 'acuity',
  'fldOuybCrGRI1i5OQ': 'acuity',
  'fldkaQLubMBSHG8M2': 'acuity',
  'fldAjRmzHSrLbtCTR': 'acuity',
  [FIELD_IDS.CLIENT_WEDDING]: 'acuity',
  [FIELD_IDS.CLIENT_WEDDING_LOCATION]: 'acuity',
  [FIELD_IDS.CLIENT_WEDDING_PLANNER]: 'acuity',
  'fldxS8Lt0Fsf2UsQ4': 'acuity',
  [FIELD_IDS.CLIENT_PERSONAL_STYLE_NOTES]: 'acuity',
  [FIELD_IDS.CLIENT_WEDDING_IF_NOT_SET]: 'acuity',
  [FIELD_IDS.CLIENT_EMAIL]: 'shopify',
  [FIELD_IDS.CLIENT_SHOPIFY_ADDRESS]: 'shopify',
  [FIELD_IDS.CLIENT_SHOPIFY_ORDER_NUMBER]: 'shopify',
  'fldZ6MaXJObTTHLvG': 'shopify',
  'fldXa3IVbHJBozo8S': 'shopify',
  'fldZben3noSEIejS9': 'shopify',
  'fldSwkWi8C573UKXZ': 'apparel_magic',
  'fldg3zEnPPIiDHvio': 'apparel_magic',
  'fldfIvsmkJm20sv3q': 'apparel_magic',
  [FIELD_IDS.CLIENT_APPAREL_MAGIC_ORDER]: 'apparel_magic',
  'fldIl66OVv22gVVx7': 'apparel_magic',
  'fld1oKqi5yzcznmXm': 'apparel_magic',
  'fldDwLPMhkptv8SSK': 'apparel_magic',
  'fldD408qPVFKE0nQ7': 'apparel_magic',
  'fldyFOe1R45tutNTI': 'apparel_magic',
  'fld0pWIKEVGkDD515': 'apparel_magic',
  'fld6uiHCW1Ff6z1D4': 'apparel_magic',
  'fldhYnN4DZHGPxeMK': 'apparel_magic',
  'fldSxZrcIbBlyJO6R': 'apparel_magic',
};

const FIELD_SOURCE_EXCEPTIONS = new Set([
  FIELD_IDS.CLIENT_APPT_PHOTOS,
  FIELD_IDS.CLIENT_MEASUREMENTS,
  FIELD_IDS.CLIENT_FOLLOW_UP_SENT,
  FIELD_IDS.CLIENT_INTEREST_ALTS,
  FIELD_IDS.CLIENT_INTEREST_M2M,
  FIELD_IDS.CLIENT_INTEREST_CUSTOM,
  FIELD_IDS.CLIENT_M2M,
  FIELD_IDS.CLIENT_FULFILLMENT_METHOD,
  FIELD_IDS.CLIENT_PICK_UP,
  FIELD_IDS.CLIENT_SHIP,
  'fldNjcDXIaGPGY1E6',
  'fld2i9hJrfxTUuh1N',
  'fldOxNmdqgB6JtOza',
  'fldlbAPEaoTwfFPTv',
  'fld6C6SKaa1pWbTf6',
  'flddDJKkZDsOoCOzE',
  'fldsVYhG5tZAccxdK',
  'fldRS6ctrPGlEPqlR',
]);

function getFieldSource(fieldId: string): 'acuity' | 'shopify' | 'apparel_magic' | null {
  return FIELD_SOURCE[fieldId] ?? null;
}

function isFieldReadOnlyBySource(fieldId: string): boolean {
  const source = getFieldSource(fieldId);
  if (!source) return false;
  if (FIELD_SOURCE_EXCEPTIONS.has(fieldId)) return false;
  return true;
}

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

function parseDateFromLookup(raw: unknown): Date | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : [raw];
  const first = arr[0];
  if (!first) return null;
  const str = typeof first === 'string' ? first : (first as any)?.value ?? String(first);
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
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

function getTimelineBucket(lastPhaseChange: string | null | undefined): string {
  if (!lastPhaseChange) return 'All Time';
  const d = parseDateFlexible(lastPhaseChange);
  if (!d) return 'All Time';
  const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7)   return 'Last 7 days';
  if (diffDays <= 30)  return 'Last 30 days';
  if (diffDays <= 180) return 'Last 6 months';
  return 'All Time';
}

function getCellValueSafe<T>(record: AirtableRecord, field: Field | null | undefined): T | null {
  if (!field) return null;
  try { return record.getCellValue(field) as T; } catch { return null; }
}

function getCellValueAsStringSafe(record: AirtableRecord, field: Field | null | undefined): string {
  if (!field) return '';
  try { return record.getCellValueAsString(field) ?? ''; } catch { return ''; }
}

function isFutureStage(currentStage: string, sectionStage: string): boolean {
  const currentIdx = STAGE_ORDER.indexOf(currentStage as StageName);
  const sectionIdx = STAGE_ORDER.indexOf(sectionStage as StageName);
  if (currentIdx === -1 || sectionIdx === -1) return false;
  return sectionIdx > currentIdx;
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
  studioShortName: string;
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
  countryOfResidence: string;
  preferredStylist: string;
  preferredStylistIds: string[];
  rtwSize: number | null;
  favStylesAcuity: string;
  samplesNotWhereNeeded: string;
  personalStyleNotes: string;
  measBust: number | null;
  measWaist: number | null;
  measHips: number | null;
  measHeight: number | null;
  hasMeasurementPhotos: boolean;
  followUpSent: boolean;
  interestCustom: boolean;
  interestAlts: boolean;
  interestM2M: boolean;
  apptNotes: string;
  customizationCount: number;
  isRush: boolean;
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
  amOrderStr: string;
  amOrderNumber: string;
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
  alterationNotes: string;
  flagFollowUp: boolean;
  flagNoMeasurements: boolean;
  flagNoPhotos: boolean;
  flagCount: number;
  activeFlagLabels: string[];
  displayName: string;
  weddingDisplay: string;
  isOnBoard: boolean;
  timelineBucket: string;
  salesNotes: string;
  dueDate: string | null;
  customizationNotes: string;
  firstAlterationsAppt: string | null;
  taxes: number | null;
  shippingCost: number | null;
  taxesFormatted: string;
  shippingCostFormatted: string;
  lastPhaseChange: string | null;
  studioName: string;
  acuityAddress: string;
  otherAddress: string;
  alterationsApptCount: number;
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

  const hasSelection = selected.length > 0;
  const displayText = selected.length === 0 ? label : selected.length === 1 ? (selected[0] ?? label) : `${label}: ${selected.length}`;
  const toggleOption = (option: string) => {
    onChange(selected.includes(option) ? selected.filter(s => s !== option) : [...selected, option]);
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={containerRef} className="relative">
        <button type="button" onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#242220] border border-gray-300 dark:border-[#34312C] rounded-lg px-3 py-1.5 text-sm hover:border-gray-400 dark:hover:border-gray-500 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors ${hasSelection ? 'text-gray-900 dark:text-[#F5F3EF] font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          <span className="truncate">{displayText}</span>
          {hasSelection ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange([]); } }}
              className="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <XIcon size={14} />
            </span>
          ) : (
            <CaretDownIcon size={14} className={`flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
        {isOpen && (
          <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg max-h-[260px] overflow-y-auto w-[240px] py-1">
            {options.map(option => (
              <button key={option} type="button" onClick={() => toggleOption(option)}
                className={`flex items-center w-full px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${selected.includes(option) ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                <span className="truncate">{option}</span>
              </button>
            ))}
            {options.length === 0 && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No options</div>}
          </div>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE-SELECT DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
interface SingleSelectDropdownProps {
  label: string;
  options: string[];
  selected: string | null;
  onChange: (selected: string | null) => void;
}

const SingleSelectDropdown = React.memo(function SingleSelectDropdown({ label, options, selected, onChange }: SingleSelectDropdownProps) {
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

  const hasSelection = selected !== null;
  const displayText = selected ?? label;

  const handleSelect = (option: string) => {
    onChange(selected === option ? null : option);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={containerRef} className="relative">
        <button type="button" onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center justify-between gap-2 min-w-[160px] bg-white dark:bg-[#242220] border border-gray-300 dark:border-[#34312C] rounded-lg px-3 py-1.5 text-sm hover:border-gray-400 dark:hover:border-gray-500 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors ${hasSelection ? 'text-gray-900 dark:text-[#F5F3EF] font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          <span className="truncate">{displayText}</span>
          {hasSelection ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(null); } }}
              className="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <XIcon size={14} />
            </span>
          ) : (
            <CaretDownIcon size={14} className={`flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
        {isOpen && (
          <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg max-h-[260px] overflow-y-auto w-[200px] py-1">
            {options.map(option => (
              <button key={option} type="button" onClick={() => handleSelect(option)}
                className={`flex items-center w-full px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${selected === option ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                <span className="truncate">{option}</span>
              </button>
            ))}
            {options.length === 0 && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No options</div>}
          </div>
        )}
      </div>
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
    <div
      onClick={() => onCardClick(client.id)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
      className="relative bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-3 cursor-pointer transition-colors space-y-1"
      style={{ borderLeftColor: stageColors.bg, borderLeftWidth: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {/* Flag badge: absolute top-right */}
      {client.flagCount > 0 && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
            {client.flagCount} flag{client.flagCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Client name — add pr-10 to avoid overlap with flag badge */}
      <div className="text-sm font-semibold text-gray-900 dark:text-[#F5F3EF] truncate pr-10">{client.displayName}</div>

      {client.lastPhaseChange && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Last Phase Change: {new Date(client.lastPhaseChange).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}
      {client.salesAssociateName && (
        <div className="text-xs text-gray-600 dark:text-gray-400">SA: {client.salesAssociateName}</div>
      )}
      {client.nextAppointmentAltLead && (
        <div className="text-xs text-gray-600 dark:text-gray-400">AL: {client.nextAppointmentAltLead}</div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL ROW — read-only display
// ─────────────────────────────────────────────────────────────────────────────
const SOURCE_COLORS = { acuity: '#7C3AED', shopify: '#059669', apparel_magic: '#D97706' } as const;
const SOURCE_LABELS = { acuity: 'Acuity', shopify: 'Shopify', apparel_magic: 'Apparel Magic' } as const;

function DetailRow({ label, value, fieldId }: { label: string; value: string | null | undefined; fieldId?: string }) {
  const source = fieldId ? getFieldSource(fieldId) : null;
  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 tracking-wide font-medium flex items-center gap-1">
        {label}
        {source && (
          <span
            title={`Sourced from ${SOURCE_LABELS[source]}`}
            style={{ backgroundColor: SOURCE_COLORS[source] }}
            className="inline-block w-1.5 h-1.5 rounded-full ml-0.5 flex-shrink-0"
          />
        )}
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{value || '—'}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITABLE FIELD COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children, saving, error, fieldId }: { children: React.ReactNode; saving?: boolean; error?: string | null; fieldId?: string }) {
  const source = fieldId ? getFieldSource(fieldId) : null;
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
      {children}
      {source && (
        <span style={{ color: SOURCE_COLORS[source] }} className="text-xs font-medium">
          · {SOURCE_LABELS[source]}
        </span>
      )}
      {saving && <span className="text-xs text-[#D97706] dark:text-[#FBBF24] animate-pulse">saving…</span>}
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}
    </label>
  );
}

interface EditableTextProps {
  label: string;
  value: string;
  fieldId: string;
  recordId: string;
  base: Base;
  tableId?: string;
  multiline?: boolean;
  readOnly?: boolean;
}

function EditableText({ label, value, fieldId, recordId, base, tableId = 'tblLLUlDgJ4ktzF7c', multiline = false, readOnly }: EditableTextProps) {
  const effectiveReadOnly = readOnly || isFieldReadOnlyBySource(fieldId);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLocalValue(value); }, [value]);

  if (effectiveReadOnly) {
    return <DetailRow label={label} value={value || '—'} fieldId={fieldId} />;
  }

  const handleBlur = async () => {
    if (localValue === value) return;
    setSaving(true); setError(null);
    try {
      const t = base.getTableByIdIfExists(tableId);
      if (!t) throw new Error('Table not found');
      await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: localValue || null }));
    } catch (e: any) {
      setError('Save failed'); console.error(`EditableText [${fieldId}]:`, e); setLocalValue(value);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <FieldLabel saving={saving} error={error} fieldId={fieldId}>{label}</FieldLabel>
      {multiline
        ? <textarea value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={handleBlur} rows={3}
            className="w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none resize-none transition-colors" />
        : <input type="text" value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={handleBlur}
            className="w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors" />
      }
    </div>
  );
}

interface EditableNumberProps {
  label: string;
  value: number | null;
  fieldId: string;
  recordId: string;
  base: Base;
  tableId?: string;
  suffix?: string;
  isPercent?: boolean;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
}

function EditableNumber({ label, value, fieldId, recordId, base, tableId = 'tblLLUlDgJ4ktzF7c', suffix, isPercent, min, max, step = 1, readOnly }: EditableNumberProps) {
  const effectiveReadOnly = readOnly || isFieldReadOnlyBySource(fieldId);
  const toDisplay = (v: number | null) => v !== null ? (isPercent ? String(Math.round(v * 100)) : String(v)) : '';
  const [localValue, setLocalValue] = useState(toDisplay(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLocalValue(toDisplay(value)); }, [value, isPercent]);

  if (effectiveReadOnly) {
    const displayVal = value !== null ? (isPercent ? `${Math.round(value * 100)}${suffix ?? '%'}` : `${value}${suffix ?? ''}`) : '—';
    return <DetailRow label={label} value={displayVal} fieldId={fieldId} />;
  }

  const handleBlur = async () => {
    const parsed = localValue === '' ? null : parseFloat(localValue);
    if (parsed !== null && !isNaN(parsed)) {
      if (min !== undefined && parsed < min) { setError(`Min ${min}`); setLocalValue(toDisplay(value)); return; }
      if (max !== undefined && parsed > max) { setError(`Max ${max}`); setLocalValue(toDisplay(value)); return; }
    }
    const stored = parsed !== null && !isNaN(parsed) ? (isPercent ? parsed / 100 : parsed) : null;
    if (stored === value) return;
    setSaving(true); setError(null);
    try {
      const t = base.getTableByIdIfExists(tableId);
      if (!t) throw new Error('Table not found');
      await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: stored }));
    } catch (e: any) {
      setError('Save failed'); console.error(`EditableNumber [${fieldId}]:`, e); setLocalValue(toDisplay(value));
    } finally { setSaving(false); }
  };

  return (
    <div>
      <FieldLabel saving={saving} error={error} fieldId={fieldId}>{label}</FieldLabel>
      <div className="flex items-center gap-1">
        <input type="number" value={localValue} min={min} max={max} step={step}
          onChange={e => setLocalValue(e.target.value)} onBlur={handleBlur}
          className="w-full text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          style={{ MozAppearance: 'textfield' } as React.CSSProperties} />
        {suffix && <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

interface EditableCheckboxProps {
  label: string;
  value: boolean;
  fieldId: string;
  recordId: string;
  base: Base;
  tableId?: string;
  readOnly?: boolean;
}

function EditableCheckbox({ label, value, fieldId, recordId, base, tableId = 'tblLLUlDgJ4ktzF7c', readOnly }: EditableCheckboxProps) {
  const effectiveReadOnly = readOnly || isFieldReadOnlyBySource(fieldId);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLocalValue(value); }, [value]);

  if (effectiveReadOnly) {
    return <DetailRow label={label} value={value ? 'Yes' : 'No'} fieldId={fieldId} />;
  }

  const handleToggle = async () => {
    const next = !localValue;
    setLocalValue(next); setSaving(true); setError(null);
    try {
      const t = base.getTableByIdIfExists(tableId);
      if (!t) throw new Error('Table not found');
      await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: next }));
    } catch (e: any) {
      setError('Save failed'); console.error(`EditableCheckbox [${fieldId}]:`, e); setLocalValue(localValue);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <FieldLabel saving={saving} error={error} fieldId={fieldId}>{label}</FieldLabel>
      <button type="button" onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
          localValue ? 'bg-emerald-50 dark:bg-green-500/15 text-emerald-700 dark:text-green-300 border-emerald-200 dark:border-green-500/30' : 'bg-gray-50 dark:bg-white/10 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
        }`}>
        {localValue ? <CheckIcon size={12} weight="bold" /> : <XIcon size={12} />}
        {localValue ? 'Yes' : 'No'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED POPUP
// ─────────────────────────────────────────────────────────────────────────────
interface FixedPopupProps {
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  width?: number;
  noStyle?: boolean;
  children: React.ReactNode;
}

function FixedPopup({ anchorRef, onClose, width, noStyle, children }: FixedPopupProps) {
  const POPUP_HEIGHT_ESTIMATE = noStyle ? 320 : 220;
  const MARGIN = 8;

  const [coords, setCoords] = useState<{
    left: number; width: number;
    top?: number; bottom?: number;
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateCoords = () => {
      if (!anchorRef.current) return;
      const rect   = anchorRef.current.getBoundingClientRect();
      const vpH    = window.innerHeight;
      const popupW = width ?? rect.width;
      const spaceBelow = vpH - rect.bottom;
      const spaceAbove = rect.top;
      const flipUp = spaceBelow < POPUP_HEIGHT_ESTIMATE && spaceAbove > spaceBelow;
      // Note: position is 'fixed', so coordinates are already viewport-relative —
      // do NOT add window.scrollX/scrollY here, that would offset the popup away
      // from its trigger as soon as the page is scrolled.
      setCoords(
        flipUp
          ? { bottom: vpH - rect.top + MARGIN, left: rect.left, width: popupW }
          : { top: rect.bottom + MARGIN, left: rect.left, width: popupW }
      );
    };
    updateCoords();
    // Keep the popup glued to its trigger as the page (or any scrollable
    // ancestor, e.g. the modal body) scrolls, instead of staying fixed
    // relative to the viewport while the field moves underneath it.
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [width]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!coords) return null;

  return (
    <div ref={popupRef} style={{ position: 'fixed', top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width, zIndex: 20 }}>
      {noStyle ? children : (
        <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg py-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR UTILITIES + POPUP
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS_EN = ['MO','TU','WE','TH','FR','SA','SU'];

function getCalendarDays(year: number, month: number): Array<{ date: Date; currentMonth: boolean }> {
  const firstDay  = new Date(year, month, 1);
  const startDow  = (firstDay.getDay() + 6) % 7;
  const lastDay   = new Date(year, month + 1, 0);
  const cells: Array<{ date: Date; currentMonth: boolean }> = [];
  for (let i = startDow - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), currentMonth: false });
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push({ date: new Date(year, month, d), currentMonth: true });
  let next = 1;
  while (cells.length < 42) cells.push({ date: new Date(year, month + 1, next++), currentMonth: false });
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface CalendarPopupProps {
  selectedDate: Date | null;
  onSelect: (d: Date | null) => void;
  onClose: () => void;
}

const CalendarPopup = React.memo(function CalendarPopup({ selectedDate, onSelect, onClose }: CalendarPopupProps) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(selectedDate?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth()     ?? today.getMonth());
  const cells = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else { setViewMonth(m => m - 1); }
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else { setViewMonth(m => m + 1); }
  };

  return (
    <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-xl p-3" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center border border-gray-300 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <CaretDownIcon size={13} className="rotate-90" />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-[#F5F3EF]">{MONTHS_EN[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center border border-gray-300 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <CaretDownIcon size={13} className="-rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_EN.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ date, currentMonth }, i) => {
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isToday    = isSameDay(date, today);
          return (
            <button key={i} type="button" onClick={() => { onSelect(date); onClose(); }}
              className={[
                'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs transition-colors',
                isSelected ? 'bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] font-semibold'
                  : isToday ? 'border border-[#D97706] dark:border-[#FBBF24] text-[#D97706] dark:text-[#FBBF24] font-medium hover:bg-[#FEF3C7] dark:hover:bg-[#3A2E12]'
                  : currentMonth ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                  : 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-white/5',
              ].join(' ')}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-white/5">
        <button type="button" onClick={() => { onSelect(null); onClose(); }}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Clear</button>
        <button type="button" onClick={() => { onSelect(new Date()); onClose(); }}
          className="text-xs text-[#D97706] dark:text-[#FBBF24] hover:text-[#B45F04] dark:hover:text-[#FCD34D] font-medium transition-colors">Today</button>
      </div>
    </div>
  );
});

interface EditableDateProps {
  label: string;
  value: string | null;
  fieldId: string;
  recordId: string;
  base: Base;
  tableId?: string;
  readOnly?: boolean;
}

function EditableDate({ label, value, fieldId, recordId, base, tableId = 'tblLLUlDgJ4ktzF7c', readOnly }: EditableDateProps) {
  const effectiveReadOnly = readOnly || isFieldReadOnlyBySource(fieldId);
  const toDate = (v: string | null): Date | null => {
    if (!v) return null;
    const d = parseDateFlexible(v);
    return d && !isNaN(d.getTime()) ? d : null;
  };
  const toIso = (d: Date | null): string =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  const toDisplay = (d: Date | null): string =>
    d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  const [selectedDate, setSelectedDate] = useState<Date | null>(toDate(value));
  const [inputText,    setInputText]    = useState(toDisplay(toDate(value)));
  const [open,         setOpen]         = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = toDate(value);
    setSelectedDate(d);
    setInputText(toDisplay(d));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (effectiveReadOnly) {
    return <DetailRow label={label} value={value ? formatFullDate(value) : '—'} fieldId={fieldId} />;
  }

  const persist = async (d: Date | null) => {
    const iso = toIso(d);
    const prevIso = toIso(toDate(value));
    if (iso === prevIso) return;
    setSaving(true); setError(null);
    try {
      const t = base.getTableByIdIfExists(tableId);
      if (!t) throw new Error('Table not found');
      await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: iso || null }));
    } catch (e: any) {
      setError('Save failed'); console.error(`EditableDate [${fieldId}]:`, e);
      const prev = toDate(value);
      setSelectedDate(prev);
      setInputText(toDisplay(prev));
    } finally { setSaving(false); }
  };

  const handleCalendarSelect = (d: Date | null) => {
    setSelectedDate(d);
    setInputText(toDisplay(d));
    persist(d);
  };

  const handleInputBlur = () => {
    if (!inputText.trim()) { handleCalendarSelect(null); return; }
    const parsed = parseDateFlexible(inputText);
    if (parsed && !isNaN(parsed.getTime())) {
      setSelectedDate(parsed);
      setInputText(toDisplay(parsed));
      persist(parsed);
    } else {
      setInputText(toDisplay(selectedDate));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <FieldLabel saving={saving} error={error} fieldId={fieldId}>{label}</FieldLabel>
      <div className="flex items-center gap-1">
        <input type="text" value={inputText} placeholder="Select date…"
          onChange={e => setInputText(e.target.value)}
          onBlur={handleInputBlur}
          onFocus={() => setOpen(true)}
          className="flex-1 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1e1d1b] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors" />
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-white/10 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-400 dark:hover:border-white/20 transition-colors">
          <CalendarIcon size={14} />
        </button>
      </div>
      {open && (
        <FixedPopup anchorRef={containerRef} onClose={() => setOpen(false)} width={270} noStyle>
          <CalendarPopup selectedDate={selectedDate} onSelect={handleCalendarSelect} onClose={() => setOpen(false)} />
        </FixedPopup>
      )}
    </div>
  );
}

interface EditableSelectProps {
  label: string;
  value: string;
  options: string[];
  fieldId: string;
  recordId: string;
  base: Base;
  tableId?: string;
  readOnly?: boolean;
}

function EditableSelect({ label, value, options, fieldId, recordId, base, tableId = 'tblLLUlDgJ4ktzF7c', readOnly }: EditableSelectProps) {
  const effectiveReadOnly = readOnly || isFieldReadOnlyBySource(fieldId);
  const [localValue, setLocalValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (effectiveReadOnly) {
    return <DetailRow label={label} value={value || '—'} fieldId={fieldId} />;
  }

  const handleSelect = async (next: string) => {
    setOpen(false);
    if (next === localValue) return;
    setLocalValue(next); setSaving(true); setError(null);
    try {
      const t = base.getTableByIdIfExists(tableId);
      if (!t) throw new Error('Table not found');
      await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: next ? { name: next } : null }));
    } catch (e: any) {
      setError('Save failed'); console.error(`EditableSelect [${fieldId}]:`, e); setLocalValue(value);
    } finally { setSaving(false); }
  };

  return (
    <div ref={containerRef} className="relative">
      <FieldLabel saving={saving} error={error} fieldId={fieldId}>{label}</FieldLabel>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full inline-flex items-center justify-between gap-2 bg-white dark:bg-[#1e1d1b] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-white/20 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors">
        <span className="truncate text-left">{localValue || '—'}</span>
        <CaretDownIcon size={12} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <FixedPopup anchorRef={containerRef} onClose={() => setOpen(false)}>
          <button type="button" onClick={() => handleSelect('')}
            className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${!localValue ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
            —
          </button>
          {options.map(o => (
            <button key={o} type="button" onClick={() => handleSelect(o)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors ${localValue === o ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              {localValue === o && <CheckIcon size={12} weight="bold" className="flex-shrink-0" />}
              {localValue !== o && <span className="w-3 flex-shrink-0" />}
              <span className="truncate">{o}</span>
            </button>
          ))}
        </FixedPopup>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LINKED RECORD PICKER — Preferred Stylist
// ─────────────────────────────────────────────────────────────────────────────
interface StylePickerProps {
  label: string;
  currentIds: string[];
  currentNames: string;
  fieldId: string;
  recordId: string;
  base: Base;
  tableId?: string;
  vendorRecords: AirtableRecord[] | null;
  vendorNameField: Field | null;
  vendorTypeField: Field | null;
}

function StylePicker({ label, currentIds, currentNames, fieldId, recordId, base, tableId = 'tblLLUlDgJ4ktzF7c', vendorRecords, vendorNameField, vendorTypeField }: StylePickerProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelectedIds(currentIds); }, [currentIds.join(',')]);

  const options = useMemo(() => {
    if (!vendorRecords || !vendorNameField) return [];
    return vendorRecords
      .map(r => {
        const name = vendorNameField ? (r.getCellValue(vendorNameField) as string | null) ?? '' : '';
        return { id: r.id, name: name || r.id };
      })
      .filter(o => o.name && (!search || o.name.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [vendorRecords, vendorNameField, search]);

  const selectedNames = useMemo(() => {
    if (!vendorRecords || !vendorNameField || selectedIds.length === 0) return currentNames || '—';
    return vendorRecords
      .filter(r => selectedIds.includes(r.id))
      .map(r => (vendorNameField ? (r.getCellValue(vendorNameField) as string | null) ?? r.id : r.id))
      .join(', ') || '—';
  }, [vendorRecords, vendorNameField, selectedIds, currentNames]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleId = async (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    setSelectedIds(next);
    setSaving(true); setError(null);
    try {
      const t = base.getTableByIdIfExists(tableId);
      if (!t) throw new Error('Table not found');
      await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: next.map(x => ({ id: x })) }));
    } catch (e: any) {
      setError('Save failed'); console.error(`StylePicker [${fieldId}]:`, e); setSelectedIds(selectedIds);
    } finally { setSaving(false); }
  };

  return (
    <div ref={containerRef} className="relative">
      <FieldLabel saving={saving} error={error}>{label}</FieldLabel>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full text-left text-sm text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 bg-white dark:bg-[#1e1d1b] hover:border-gray-400 dark:hover:border-white/20 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none flex items-center gap-2 transition-colors">
        <span className="truncate flex-1">{selectedNames}</span>
        {selectedIds.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={async (e) => {
              e.stopPropagation();
              setSelectedIds([]);
              setSaving(true);
              try {
                const t = base.getTableByIdIfExists(tableId);
                if (t) await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: [] }));
              } catch (err) { console.error(err); } finally { setSaving(false); }
            }}
            className="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <XIcon size={12} />
          </span>
        )}
        <CaretDownIcon size={12} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <FixedPopup anchorRef={containerRef} onClose={() => setOpen(false)} width={260}>
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} autoFocus
              className="w-full text-sm bg-white dark:bg-[#1e1d1b] text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] transition-colors" />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '168px', scrollbarWidth: 'none' }}>
            <style>{`.style-picker-list::-webkit-scrollbar{display:none}`}</style>
            <div className="style-picker-list">
              {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">{search ? 'No match' : 'No stylists found'}</div>
              )}
              {options.map(o => (
                <button key={o.id} type="button" onClick={() => toggleId(o.id)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors ${selectedIds.includes(o.id) ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                  {selectedIds.includes(o.id) && <CheckIcon size={12} weight="bold" className="flex-shrink-0" />}
                  {!selectedIds.includes(o.id) && <span className="w-3 flex-shrink-0" />}
                  <span className="truncate">{o.name}</span>
                </button>
              ))}
            </div>
          </div>

        </FixedPopup>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEASUREMENT INPUTS
// ─────────────────────────────────────────────────────────────────────────────
interface MeasurementInputsProps {
  measBust: number | null;
  measWaist: number | null;
  measHips: number | null;
  measHeight: number | null;
  recordId: string;
  base: Base;
}

function MeasurementInputs({ measBust, measWaist, measHips, measHeight, recordId, base }: MeasurementInputsProps) {
  const measurements = [
    { label: 'Bust', value: measBust, fieldId: FIELD_IDS.CLIENT_MEAS_BUST },
    { label: 'Waist', value: measWaist, fieldId: FIELD_IDS.CLIENT_MEAS_WAIST },
    { label: 'Hips', value: measHips, fieldId: FIELD_IDS.CLIENT_MEAS_HIPS },
    { label: 'Height', value: measHeight, fieldId: FIELD_IDS.CLIENT_MEAS_HEIGHT },
  ];
  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 tracking-wide font-medium mb-1">Measurements</div>
      <div className="grid grid-cols-4 gap-2">
        {measurements.map(m => (
          <EditableNumber key={m.label} label={m.label} value={m.value} fieldId={m.fieldId} recordId={recordId} base={base} />
        ))}
      </div>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}
function FieldRow4({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-4 gap-2">{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE LIST VIEW (Change #3)
// ─────────────────────────────────────────────────────────────────────────────
const LIST_PAGE_SIZE = 50;

type SortCol = 'name'|'stage'|'lastAppt'|'nextAppt'|'weddingDate'|'studio'|'sa'|'am'|'flags';
type SortEntry = { col: SortCol; dir: 'asc'|'desc' };

function getSortValue(col: SortCol, c: ClientData): string | number {
  switch (col) {
    case 'name':        return c.fullName;
    case 'stage':       return c.stage;
    case 'lastAppt':    return c.lastAppointment ?? '9999';
    case 'nextAppt':    return c.nextAppointment ?? '9999';
    case 'weddingDate': return c.weddingDate ?? '9999';
    case 'studio':      return c.studio;
    case 'sa':          return c.salesAssociateName;
    case 'am':          return c.amOrderStr ?? '';
    case 'flags':       return c.flagCount;
  }
}

function PipelineListView({ clients, onSelectClient, suppressEmptyMessage }: { clients: ClientData[]; onSelectClient: (c: ClientData) => void; suppressEmptyMessage?: boolean }) {
  const [sortEntries, setSortEntries] = useState<SortEntry[]>([{ col: 'weddingDate', dir: 'asc' }]);
  const [page, setPage] = useState(0);

  // Click cycle per column: not sorted → asc → desc → removed.
  // Clicking a column not yet in the list appends it, so multi-sort order
  // follows the order columns were clicked in.
  function toggleSort(col: SortCol) {
    setSortEntries(prev => {
      const idx = prev.findIndex(e => e.col === col);
      if (idx === -1) return [...prev, { col, dir: 'asc' }];
      if (prev[idx]!.dir === 'asc') return prev.map((e, i) => i === idx ? { ...e, dir: 'desc' } : e);
      return prev.filter((_, i) => i !== idx);
    });
  }

  const sorted = [...clients].sort((a, b) => {
    for (const { col, dir } of sortEntries) {
      const va = getSortValue(col, a);
      const vb = getSortValue(col, b);
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });

  useEffect(() => { setPage(0); }, [clients]);

  const totalPages   = Math.max(1, Math.ceil(sorted.length / LIST_PAGE_SIZE));
  const pagedClients = sorted.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const SortIcon = ({ col }: { col: SortCol }) => {
    const idx = sortEntries.findIndex(e => e.col === col);
    const entry = idx === -1 ? null : sortEntries[idx];
    if (!entry) return null;
    return (
      <span className="ml-1 inline-flex items-center gap-1">
        {entry.dir === 'asc' ? <CaretUpIcon size={12} weight="bold" /> : <CaretDownIcon size={12} weight="bold" />}
        {sortEntries.length > 1 && (
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#D97706] dark:bg-[#FBBF24] text-white dark:text-[#1B1813] text-[9px] font-semibold leading-none">
            {idx + 1}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
    <div className="overflow-auto flex-1 px-4 pb-4">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-white dark:bg-[#1A1917] border-b border-gray-200 dark:border-white/10 z-10">
          <tr>
            {[
              { col: 'name', label: 'Client' },
              { col: 'stage', label: 'Stage' },
              { col: 'weddingDate', label: 'Wedding Date' },
              { col: 'lastAppt', label: 'Last Appt' },
              { col: 'nextAppt', label: 'Next Appt' },
              { col: 'studio', label: 'Studio' },
              { col: 'sa', label: 'Sales Associate' },
              { col: 'am', label: 'AM Order #' },
              { col: 'flags', label: 'Flags' },
            ].map(({ col, label }) => (
              <th
                key={col}
                onClick={() => toggleSort(col as SortCol)}
                className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide cursor-pointer hover:text-gray-900 dark:hover:text-[#F5F3EF] select-none"
              >
                <span className="inline-flex items-center">{label}<SortIcon col={col as SortCol} /></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagedClients.map(client => (
            <tr key={client.id} onClick={() => onSelectClient(client)}
              className="border-b border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
              <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-[#F5F3EF]">{client.displayName}</td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                  {client.stage}
                </span>
              </td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{client.weddingDisplay || '—'}</td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{client.lastAppointment ? formatAppointmentDateTime(client.lastAppointment) : '—'}</td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{client.nextAppointment ? formatAppointmentDateTime(client.nextAppointment) : '—'}</td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{client.studio || '—'}</td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{client.salesAssociateName || '—'}</td>
              <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs">{client.amOrderStr || client.amOrderNumber || '—'}</td>
              <td className="px-3 py-2.5">
                {client.flagCount > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                    {client.flagCount} flag{client.flagCount === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && !suppressEmptyMessage && (
            <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">No clients match the current filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
    {sorted.length > LIST_PAGE_SIZE && (
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#242220]">
        <button
          type="button"
          onClick={() => setPage(p => p - 1)}
          disabled={!canPrev}
          className="text-xs font-medium px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-default transition-colors"
        >← Prev</button>
        <span className="text-xs text-gray-400 dark:text-gray-500">{page + 1} / {totalPages}</span>
        <button
          type="button"
          onClick={() => setPage(p => p + 1)}
          disabled={!canNext}
          className="text-xs font-medium px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-default transition-colors"
        >Next →</button>
      </div>
    )}
    </div>
  );
}

function BooleanDropdown({
  label, value, fieldId, recordId, base, tableId = 'tblLLUlDgJ4ktzF7c',
}: { label: string; value: boolean; fieldId: string; recordId: string; base: Base; tableId?: string }) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState<boolean | null>(value ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalValue(value ?? null); }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const OPTIONS: Array<{ label: string; value: boolean | null }> = [
    { label: '—', value: null },
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];

  const displayLabel = localValue === true ? 'Yes' : localValue === false ? 'No' : '—';

  const handleSelect = async (newVal: boolean | null) => {
    setOpen(false);
    setLocalValue(newVal);
    setSaving(true);
    setError(null);
    try {
      const t = base.getTableByIdIfExists(tableId);
      if (!t) throw new Error('Table not found');
      await queueWrite(() => t!.updateRecordAsync(recordId, { [fieldId]: newVal === true }));
    } catch (e) {
      setError('Save failed'); console.error(`BooleanDropdown [${fieldId}]:`, e); setLocalValue(value ?? null);
    } finally { setSaving(false); }
  };

  const isReadOnly = isFieldReadOnlyBySource(fieldId);
  if (isReadOnly) return <DetailRow label={label} value={displayLabel} fieldId={fieldId} />;

  return (
    <div ref={containerRef} className="relative">
      <FieldLabel saving={saving} error={error} fieldId={fieldId}>{label}</FieldLabel>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left text-sm text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 bg-white dark:bg-[#1e1d1b] hover:border-gray-400 dark:hover:border-white/20 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none flex items-center justify-between gap-2 transition-colors"
      >
        <span>{displayLabel}</span>
        <CaretDownIcon size={12} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <FixedPopup anchorRef={containerRef} onClose={() => setOpen(false)} width={160}>
          <div className="py-1">
            {OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors ${
                  localValue === opt.value ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {localValue === opt.value && <CheckIcon size={12} weight="bold" className="flex-shrink-0" />}
                {localValue !== opt.value && <span className="w-3 flex-shrink-0" />}
                {opt.label}
              </button>
            ))}
          </div>
        </FixedPopup>
      )}
    </div>
  );
}

const FULFILLMENT_METHOD_OPTIONS = [
  'Pick Up - New York',
  'Pick Up - Melrose',
  'Ship (Shopify Address)',
  'Ship (Acuity Address)',
  'Ship (Other Address)',
];

const ALTERATIONS_PAYMENT_OPTIONS = [
  'Paid',
  'Unpaid',
];

// ─────────────────────────────────────────────────────────────────────────────
// FULL PROFILE MODAL
// ─────────────────────────────────────────────────────────────────────────────
interface FullProfileModalProps {
  client: ClientData;
  stageColors: { bg: string; fg: string };
  stageChoices: Array<{ name: string; color?: string }>;
  base: Base;
  vendorRecords: AirtableRecord[] | null;
  vendorNameField: Field | null;
  vendorTypeField: Field | null;
  onClose: () => void;
}

const STAGE_STEPS: string[] = [
  'Pre-Appointment', 'Deliberating', 'Sold', 'Order Ready', 'In Alterations', 'In Fulfillment',
];

const FullProfileModal = React.memo(function FullProfileModal({
  client, stageColors, stageChoices, base, vendorRecords, vendorNameField, vendorTypeField, onClose,
}: FullProfileModalProps) {
  const currentStageIndex = STAGE_STEPS.indexOf(client.stage);
  const stageIsKnown = STAGE_ORDER.includes(client.stage as StageName);
  const [showAllFields, setShowAllFields] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 220);
  }, [onClose]);

  function renderStageSection(sectionStage: string, readOnly: boolean) {
    switch (sectionStage) {
      case 'Pre-Appointment':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Country of Residence" value={client.countryOfResidence} />
              <DetailRow label="Next Appointment" value={formatAppointmentDateTime(client.nextAppointment)} />
            </div>
            {/* Wedding Location & Planner — always DetailRow per Step 5 */}
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Wedding Location" value={client.weddingLocation || '—'} fieldId={FIELD_IDS.CLIENT_WEDDING_LOCATION} />
              <DetailRow label="Wedding Planner" value={client.weddingPlanner || '—'} fieldId={FIELD_IDS.CLIENT_WEDDING_PLANNER} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {readOnly
                ? <DetailRow label="Bridal Stylist" value={client.preferredStylist || '—'} />
                : <StylePicker label="Bridal Stylist" currentIds={client.preferredStylistIds} currentNames={client.preferredStylist} fieldId={FIELD_IDS.CLIENT_PREFERRED_STYLIST} recordId={client.id} base={base} vendorRecords={vendorRecords} vendorNameField={vendorNameField} vendorTypeField={vendorTypeField} />
              }
              {readOnly
                ? <DetailRow label="RTW Size" value={client.rtwSize != null ? String(client.rtwSize) : '—'} />
                : <EditableNumber label="RTW Size (0–20)" value={client.rtwSize} fieldId={FIELD_IDS.CLIENT_RTW_SIZE} recordId={client.id} base={base} min={0} max={20} step={0.5} />
              }
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Favorite Styles" value={client.favStylesAcuity || '—'} />
              <DetailRow label="Samples Not Where Needed" value={client.samplesNotWhereNeeded || '—'} />
            </div>
            {/* Personal Style Notes — always DetailRow per Step 5 */}
            <DetailRow label="Personal Style Notes" value={client.personalStyleNotes || '—'} fieldId={FIELD_IDS.CLIENT_PERSONAL_STYLE_NOTES} />
          </div>
        );
      case 'Deliberating':
        return (
          <div className="space-y-3">
            <FieldRow>
              <DetailRow label="Country of Residence" value={client.countryOfResidence} />
              <DetailRow label="Last Appointment" value={formatAppointmentDateTime(client.lastAppointment)} />
              <DetailRow label="Next Appointment" value={formatAppointmentDateTime(client.nextAppointment)} />
            </FieldRow>
            <FieldRow>
              <DetailRow label="Favorite Styles" value={client.favStylesInAppt.join(', ') || '—'} />
              <DetailRow label="Customization Requests" value={client.customizationCount > 0 ? String(client.customizationCount) : '—'} />
              <DetailRow label="Rush" value={client.isRush ? '🚨 Yes' : 'No'} />
            </FieldRow>
            {readOnly ? (
              <FieldRow>
                <DetailRow label="Bust" value={client.measBust != null ? String(client.measBust) : '—'} />
                <DetailRow label="Waist" value={client.measWaist != null ? String(client.measWaist) : '—'} />
                <DetailRow label="Hips" value={client.measHips != null ? String(client.measHips) : '—'} />
              </FieldRow>
            ) : (
              <MeasurementInputs measBust={client.measBust} measWaist={client.measWaist} measHips={client.measHips} measHeight={client.measHeight} recordId={client.id} base={base} />
            )}
            <FieldRow>
              <DetailRow label="Measurement Photos" value={client.hasMeasurementPhotos ? 'Present' : 'Missing'} />
              <DetailRow label="Appt Photos" value={client.flagNoPhotos ? 'Missing' : 'Present'} />
              <div />
            </FieldRow>
            {readOnly
              ? <DetailRow label="Appointment Notes" value={client.apptNotes || '—'} />
              : <EditableText label="Appointment Notes" value={client.apptNotes} fieldId={FIELD_IDS.CLIENT_APPT_NOTES} recordId={client.id} base={base} multiline />
            }
            {readOnly
              ? <DetailRow label="Sales Notes" value={client.salesNotes || '—'} />
              : <EditableText label="Sales Notes" value={client.salesNotes} fieldId="fldsVYhG5tZAccxdK" recordId={client.id} base={base} multiline />
            }
          </div>
        );
      case 'Sold':
        return (
          <div className="space-y-3">
            {/* Shopify Address — always DetailRow per Step 5 */}
            <DetailRow label="Address" value={client.shopifyAddress || '—'} fieldId={FIELD_IDS.CLIENT_SHOPIFY_ADDRESS} />
            <FieldRow>
              {readOnly
                ? <DetailRow label="Country" value={client.countryOfResidence} />
                : <EditableText label="Country" value={client.countryOfResidence} fieldId={FIELD_IDS.CLIENT_COUNTRY_OF_RESIDENCE} recordId={client.id} base={base} />
              }
              <DetailRow label="Total Spend" value={client.totalSpendFormatted} />
              <DetailRow label="Discount" value={client.discount != null ? `$${client.discount.toLocaleString()}` : '—'} />
            </FieldRow>
            <FieldRow>
              <DetailRow label="Customizations" value={client.customizationCount > 0 ? String(client.customizationCount) : '—'} />
              <DetailRow label="Qty" value={client.qtyItemsSold != null ? String(client.qtyItemsSold) : '—'} />
              {readOnly
                ? <DetailRow label="M2M" value={client.m2m ? 'Yes' : 'No'} />
                : <EditableCheckbox label="M2M" value={client.m2m} fieldId={FIELD_IDS.CLIENT_M2M} recordId={client.id} base={base} />
              }
            </FieldRow>
            <FieldRow>
              {readOnly
                ? <DetailRow label="Alterations Payment" value={client.alterationsPaymentStatus || '—'} />
                : <EditableSelect label="Alterations Payment" value={client.alterationsPaymentStatus} options={ALTERATIONS_PAYMENT_OPTIONS} fieldId={FIELD_IDS.CLIENT_ALTERATIONS_PAYMENT_STATUS} recordId={client.id} base={base} />
              }
              <DetailRow label="Shopify #" value={client.shopifyOrderNumber || '—'} />
              <DetailRow label="AM #" value={client.apparelMagicOrder || '—'} />
            </FieldRow>
            <FieldRow>
              {readOnly
                ? <DetailRow label="Order Ready" value={client.orderReady ? 'Yes' : 'No'} />
                : <BooleanDropdown label="Order Ready" value={client.orderReady} fieldId={FIELD_IDS.CLIENT_ORDER_READY} recordId={client.id} base={base} />
              }
              <div /><div />
            </FieldRow>
            <DetailRow label="Due Date (3 mo. before wedding)" value={client.dueDate ? formatFullDate(client.dueDate) : '—'} />
            {client.alterationsPaymentStatus?.toLowerCase() === 'paid' && (
              <DetailRow label="Alterations" value="Yes — Paid" />
            )}
          </div>
        );
      case 'Order Ready':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {readOnly
                ? <DetailRow label="Order Ready" value={client.orderReady ? 'Yes' : 'No'} />
                : <BooleanDropdown label="Order Ready" value={client.orderReady} fieldId={FIELD_IDS.CLIENT_ORDER_READY} recordId={client.id} base={base} />
              }
              <DetailRow label="Items Sold" value={client.itemsSold.join(', ') || '—'} />
            </div>
            <DetailRow label="Customization Notes" value={client.customizationNotes || '—'} />
            <FieldRow>
              {readOnly ? (
                <>
                  <DetailRow label="Alterations" value={client.contactedForAlterations ? 'Yes' : 'No'} />
                  <DetailRow label="Shipping" value={client.ship ? 'Yes' : 'No'} />
                  <DetailRow label="Pick Up" value={client.pickUp ? 'Yes' : 'No'} />
                </>
              ) : (
                <>
                  <BooleanDropdown label="Alterations" value={client.contactedForAlterations} fieldId={FIELD_IDS.CLIENT_CONTACTED_FOR_ALTERATIONS} recordId={client.id} base={base} />
                  <BooleanDropdown label="Shipping" value={client.ship} fieldId={FIELD_IDS.CLIENT_SHIP} recordId={client.id} base={base} />
                  <BooleanDropdown label="Pick Up" value={client.pickUp} fieldId={FIELD_IDS.CLIENT_PICK_UP} recordId={client.id} base={base} />
                </>
              )}
            </FieldRow>
            {readOnly
              ? <DetailRow label="Client Notified" value={client.clientNotifiedFulfillment ? 'Yes' : 'No'} />
              : <BooleanDropdown label="Client Notified" value={client.clientNotifiedFulfillment} fieldId={FIELD_IDS.CLIENT_CLIENT_NOTIFIED_FULFILLMENT} recordId={client.id} base={base} />
            }
          </div>
        );
      case 'In Alterations':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Last Alterations Appt" value={formatAppointmentDateTime(client.latestAlterationsAppt)} />
              <DetailRow label="Alterations Appts Held" value={String(client.alterationsApptCount || '—')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Next Appt" value={formatAppointmentDateTime(client.nextAppointment)} />
              <DetailRow label="SA" value={client.salesAssociateName || '—'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Items Sold" value={client.itemsSold.join(', ') || '—'} />
              <DetailRow label="Total Spend" value={client.totalSpend ? `$${Number(client.totalSpend).toLocaleString()}` : '—'} />
            </div>
            {readOnly
              ? <DetailRow label="Alteration Notes" value={client.alterationNotes || '—'} />
              : <EditableText label="Alteration Notes" value={client.alterationNotes} fieldId={FIELD_IDS.CLIENT_ALTERATION_NOTES} recordId={client.id} base={base} multiline />
            }
          </div>
        );
      case 'In Fulfillment':
        return (
          <div className="space-y-3">
            {readOnly
              ? <DetailRow label="Fulfillment Notes" value={client.fulfillmentNotes || '—'} />
              : <EditableText label="Fulfillment Notes" value={client.fulfillmentNotes} fieldId={FIELD_IDS.CLIENT_FULFILLMENT_NOTES} recordId={client.id} base={base} multiline />
            }
            <FieldRow>
              {readOnly
                ? <DetailRow label="% Picked" value={client.pickedPercent != null ? `${Math.round(client.pickedPercent * 100)}%` : '—'} />
                : <EditableNumber label="% Picked" value={client.pickedPercent} fieldId={FIELD_IDS.CLIENT_PICKED_PERCENT} recordId={client.id} base={base} suffix="%" isPercent />
              }
              {readOnly
                ? <DetailRow label="Fulfillment Method" value={client.fulfillmentMethod || '—'} />
                : <EditableSelect label="Fulfillment Method" value={client.fulfillmentMethod} options={FULFILLMENT_METHOD_OPTIONS} fieldId={FIELD_IDS.CLIENT_FULFILLMENT_METHOD} recordId={client.id} base={base} />
              }
              <DetailRow label="Tax + Shipping" value={client.taxShippingDisplay} />
            </FieldRow>
            {/* Shopify Address — always DetailRow per Step 5 */}
            <DetailRow label="Shopify Address" value={client.shopifyAddress || '—'} fieldId={FIELD_IDS.CLIENT_SHOPIFY_ADDRESS} />
            <DetailRow label="Acuity Address" value={client.acuityAddress || '—'} fieldId="fldkpfulLIk0jq34d" />
            {readOnly
              ? <DetailRow label="Other Address" value={client.otherAddress || '—'} />
              : <EditableText label="Other Address" value={client.otherAddress} fieldId={FIELD_IDS.CLIENT_OTHER_ADDRESS} recordId={client.id} base={base} />
            }
            <FieldRow>
              {readOnly ? (
                <>
                  <DetailRow label="Client Notified" value={client.clientNotifiedFulfillment ? 'Yes' : 'No'} />
                  <DetailRow label="Address Confirmed" value={client.addressConfirmed ? 'Yes' : 'No'} />
                  <div />
                </>
              ) : (
                <>
                  <EditableCheckbox label="Client Notified" value={client.clientNotifiedFulfillment} fieldId={FIELD_IDS.CLIENT_CLIENT_NOTIFIED_FULFILLMENT} recordId={client.id} base={base} />
                  <EditableCheckbox label="Address Confirmed" value={client.addressConfirmed} fieldId={FIELD_IDS.CLIENT_ADDRESS_CONFIRMED} recordId={client.id} base={base} />
                  <div />
                </>
              )}
            </FieldRow>
            <FieldRow>
              {readOnly
                ? <DetailRow label="Tracking #" value={client.trackingNumber || '—'} />
                : <EditableText label="Tracking #" value={client.trackingNumber} fieldId={FIELD_IDS.CLIENT_TRACKING_NUMBER} recordId={client.id} base={base} />
              }
              {/* 3PL — always DetailRow per Step 5 */}
              <DetailRow label="3PL" value={client.threePL || '—'} fieldId={FIELD_IDS.CLIENT_3PL} />
              {readOnly
                ? <DetailRow label="Do Not Ship Until" value={client.holdShipmentDate ? formatFullDate(client.holdShipmentDate) : '—'} />
                : <EditableDate label="Do Not Ship Until" value={client.holdShipmentDate} fieldId={FIELD_IDS.CLIENT_HOLD_SHIPMENT_DATE} recordId={client.id} base={base} />
              }
            </FieldRow>
            {client.holdShipmentDate && new Date(client.holdShipmentDate) > new Date() && (
              <div className="px-3 py-2 rounded-md bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30">
                <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                  🚨 Do not ship until {formatFullDate(client.holdShipmentDate)}
                </span>
              </div>
            )}
            <FieldRow>
              <DetailRow label="Total Spend" value={client.totalSpendFormatted || '—'} />
              <DetailRow label="Taxes" value={client.taxesFormatted} />
              <DetailRow label="Shipping Cost" value={client.shippingCostFormatted} />
            </FieldRow>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="bg-gray-50 dark:bg-[#1A1917]"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        overflowY: 'auto',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateX(32px)',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
      }}
    >
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1A1917] border-b border-gray-200 dark:border-white/10 px-6 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center gap-3">
          <button type="button" onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 bg-white dark:bg-[#242220] transition-colors">
            <CaretLeftIcon size={16} />
            Go back
          </button>
          <button
            onClick={() => setShowAllFields(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-[#D97706] text-white hover:bg-[#B45F04] dark:bg-[#FBBF24] dark:text-[#1B1813] dark:hover:bg-[#F59E0B] transition-colors"
          >
            {showAllFields ? 'Show current stage' : 'Show all stages'}
          </button>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto p-6 space-y-4">

        {/* Header card */}
        <div className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-5">
          <div className="flex items-start gap-6 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-gray-900 dark:text-[#F5F3EF]">{client.displayName}</div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-lg font-medium"
                    style={{ backgroundColor: stageColors.bg, color: stageColors.fg }}>
                    {client.stage}
                  </span>
                  <span className="text-lg text-gray-500 dark:text-gray-400">{client.studio || '—'}</span>
                </div>
              </div>
            </div>
            {client.flagCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {client.activeFlagLabels.map(label => (
                  <span key={label} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-base text-gray-400 dark:text-gray-500 tracking-wide">Wedding Date</div>
              <div className="text-lg text-gray-900 dark:text-[#F5F3EF] font-medium mt-1">{client.weddingDisplay}</div>
            </div>
            <div>
              <div className="text-base text-gray-400 dark:text-gray-500 tracking-wide">Sales Associate</div>
              <div className="text-lg text-gray-900 dark:text-[#F5F3EF] font-medium mt-1">{client.salesAssociateName || '—'}</div>
              {client.formattedSAPhone && (
                <a href={`tel:${client.salesAssociatePhone}`} className="text-lg text-[#D97706] dark:text-[#FBBF24] block">{client.formattedSAPhone}</a>
              )}
            </div>
            <div>
              <div className="text-base text-gray-400 dark:text-gray-500 tracking-wide">Email</div>
              {client.email
                ? <a href={`mailto:${client.email}`} className="text-lg text-[#D97706] dark:text-[#FBBF24] font-medium mt-1 block truncate">{client.email}</a>
                : <div className="text-lg text-gray-400 dark:text-gray-500 mt-1">—</div>}
            </div>
            <div>
              <div className="text-base text-gray-400 dark:text-gray-500 tracking-wide">Phone</div>
              {client.formattedPhone
                ? <a href={`tel:${client.phone}`} className="text-lg text-[#D97706] dark:text-[#FBBF24] font-medium mt-1 block">{client.formattedPhone}</a>
                : <div className="text-lg text-gray-400 dark:text-gray-500 mt-1">—</div>}
            </div>
          </div>
        </div>

        {/* Stage progress */}
        <div className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-5">
          <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide mb-4">Stage in pipeline</div>
          <div className="flex items-start">
            {STAGE_STEPS.map((step, index) => {
              const isCurrent = index === currentStageIndex;
              const isPast = index < currentStageIndex;
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
                    {isPast && (
                      <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center">
                        <CheckIcon size={14} weight="bold" className="text-white" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="w-6 h-6 rounded-full border-2 border-emerald-700 bg-white dark:bg-[#242220] flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                      </div>
                    )}
                    {!isPast && !isCurrent && (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-white/10 bg-white dark:bg-[#242220]" />
                    )}
                    <span className={`text-sm mt-2 text-center ${isCurrent ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {STAGE_DISPLAY_LABELS[step] ?? step}
                    </span>
                  </div>
                  {index < STAGE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mt-3 mx-1 ${index < currentStageIndex ? 'bg-emerald-700' : 'bg-gray-300 dark:bg-white/10'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Appointment details — always shown */}
        <div className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-5">
          <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide mb-4">Appointment details</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide">Next Appointment</div>
              <div className="text-base text-gray-900 dark:text-[#F5F3EF] font-medium mt-1">{client.nextAppointment ? formatShortDate(client.nextAppointment) : '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide">Last Appointment</div>
              <div className="text-base text-gray-900 dark:text-[#F5F3EF] font-medium mt-1">{client.lastAppointment ? formatShortDate(client.lastAppointment) : '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide">Room</div>
              <div className="text-base text-gray-900 dark:text-[#F5F3EF] font-medium mt-1">{client.nextAppointmentRoom || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide">Total Appointments</div>
              <div className="text-base text-[#D97706] dark:text-[#FBBF24] font-medium mt-1">{client.appointmentCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {[
              { label: 'Measurements', flag: client.flagNoMeasurements, yes: 'Complete', no: 'Missing' },
              { label: 'Appt Photos',  flag: client.flagNoPhotos,        yes: 'Complete', no: 'Missing' },
              { label: 'Follow-Up',    flag: client.flagFollowUp,         yes: 'Pending',  no: 'Sent' },
            ].map(({ label, flag, yes, no }) => (
              <div key={label}>
                <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide">{label}</div>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${flag ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30' : 'bg-emerald-50 dark:bg-green-500/15 text-emerald-700 dark:text-green-300 border border-emerald-200 dark:border-green-500/30'}`}>
                    {flag ? yes : no}
                  </span>
                </div>
              </div>
            ))}
            <div />
          </div>
        </div>

        {/* Interests — always shown */}
        <div className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-5">
          <div className="flex gap-8">
            <div className="w-40">
              <BooleanDropdown label="Interest in Custom" value={client.interestCustom} fieldId={FIELD_IDS.CLIENT_INTEREST_CUSTOM} recordId={client.id} base={base} />
            </div>
            <div className="w-40">
              <BooleanDropdown label="Interest in Alts" value={client.interestAlts} fieldId={FIELD_IDS.CLIENT_INTEREST_ALTS} recordId={client.id} base={base} />
            </div>
            <div className="w-40">
              <BooleanDropdown label="Interest in M2M" value={client.interestM2M} fieldId={FIELD_IDS.CLIENT_INTEREST_M2M} recordId={client.id} base={base} />
            </div>
          </div>
        </div>

        {/* Notes — always shown */}
        <div className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-5">
          <div className="text-sm text-gray-400 dark:text-gray-500 tracking-wide mb-2">Post-appointment notes</div>
          {client.apptNotes
            ? <p className="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{client.apptNotes}</p>
            : <p className="text-base text-gray-400 dark:text-gray-500">No notes yet.</p>}
        </div>

        {/* Stage-specific section(s) */}
        {showAllFields ? (
          <div className="space-y-6">
            {STAGE_STEPS.map(sectionStage => {
              // Step 6: if client.stage is not a known stage, force all sections read-only
              const forceReadOnly = !stageIsKnown;
              const readOnly = forceReadOnly || isFutureStage(client.stage, sectionStage);
              return (
                <div key={sectionStage} className={`bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-5 ${readOnly ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-wider">{STAGE_DISPLAY_LABELS[sectionStage] ?? sectionStage}</h3>
                    {readOnly && <span className="text-sm text-gray-400 dark:text-gray-500 italic">{forceReadOnly ? 'read only' : 'future stage — read only'}</span>}
                  </div>
                  <div className={readOnly ? 'pointer-events-none' : ''}>
                    {renderStageSection(sectionStage, readOnly)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          stageIsKnown ? (
            <div className="bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-wider">{STAGE_DISPLAY_LABELS[client.stage] ?? client.stage}</h3>
              </div>
              {renderStageSection(client.stage, false)}
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-500/15 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-5 flex items-center gap-2">
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Unrecognized stage "{client.stage || '—'}" — no stage details to show. Switch to All Stages to view everything read-only.
              </span>
            </div>
          )
        )}

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
// SEARCH DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
function SearchDropdown({ clientsData, onSelect, stageColorsByStage }: {
  clientsData: ClientData[];
  onSelect: (id: string) => void;
  stageColorsByStage: Map<string, { bg: string; fg: string }>;
}) {
  const [query, setQuery]       = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as ClientData[];
    const lower  = q.toLowerCase();
    const digits = lower.replace(/\D/g, '');
    return clientsData
      .filter(c => {
        if (!c.isOnBoard) return false;
        const matchName  = c.fullName.toLowerCase().includes(lower);
        const matchPhone = !!digits && c.phone.replace(/\D/g, '').includes(digits);
        const matchEmail = c.email.toLowerCase().includes(lower);
        const matchAM    = c.amOrderStr?.toLowerCase().includes(lower) || c.amOrderNumber?.includes(lower);
        return matchName || matchPhone || matchEmail || matchAM;
      })
      .slice(0, 10);
  }, [query, clientsData]);

  const open = query.trim().length > 0;

  useEffect(() => { setActiveIdx(0); }, [results]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[activeIdx];
      if (hit) { onSelect(hit.id); setQuery(''); inputRef.current?.blur(); }
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  }

  function handleSelect(id: string) {
    onSelect(id);
    setQuery('');
    inputRef.current?.blur();
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search by name, phone, email, AM order…"
        className="w-full bg-white dark:bg-[#242220] border border-gray-300 dark:border-[#34312C] rounded-lg pl-9 pr-8 py-1.5 text-sm text-gray-900 dark:text-[#F5F3EF] outline-none focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] placeholder:text-gray-400 dark:placeholder:text-gray-500"
      />
      {query && (
        <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <XIcon size={14} />
        </button>
      )}
      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full mt-1 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg z-20 overflow-y-auto"
          style={{ width: 440, maxHeight: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No matches found.</div>
          ) : results.map((c, i) => {
            const stageColors = stageColorsByStage.get(c.stage) ?? DEFAULT_STAGE_COLORS;
            return (
            <div
              key={c.id}
              data-active={i === activeIdx ? 'true' : 'false'}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => handleSelect(c.id)}
              className={`px-4 py-2.5 cursor-pointer border-b border-gray-100 dark:border-white/10 last:border-b-0 transition-colors ${i === activeIdx ? 'bg-[#FEF3C7] dark:bg-[#3A2E12]' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-gray-900 dark:text-[#F5F3EF] text-sm truncate">{c.displayName}</span>
                  {c.amOrderStr && <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">AM: {c.amOrderStr}</span>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stageColors.bg, color: stageColors.fg }}>
                  {c.stage}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                {c.formattedPhone && <span>{c.formattedPhone}</span>}
                {c.email         && <span className="truncate max-w-[160px]">{c.email}</span>}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
const VIEW_OPTIONS = ['kanban', 'list'] as const;
const VIEW_LABELS: Record<typeof VIEW_OPTIONS[number], string> = { kanban: 'Kanban', list: 'List' };

function ViewDropdown({ value, onChange }: { value: 'kanban'|'list'; onChange: (v: 'kanban'|'list') => void }) {
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

  const handleSelect = (option: typeof VIEW_OPTIONS[number]) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={containerRef} className="relative">
        <button type="button" onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center w-[110px] bg-white dark:bg-[#242220] border border-gray-300 dark:border-[#34312C] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors">
          <span className="truncate text-center">{VIEW_LABELS[value]}</span>
        </button>
        {isOpen && (
          <div style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} className="absolute top-full right-0 mt-1 z-20 bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg max-h-[260px] overflow-y-auto w-[110px] py-1">
            {VIEW_OPTIONS.map(option => (
              <button key={option} type="button" onClick={() => handleSelect(option)}
                className={`flex items-center w-full px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${value === option ? 'bg-[#FEF3C7] dark:bg-[#3A2E12] text-[#D97706] dark:text-[#FBBF24] font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                <span className="truncate">{VIEW_LABELS[option]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const KANBAN_PAGE_SIZE = 12;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function Pipeline(): React.ReactElement {
  useTheme();
  const base = useBase();
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
  const clientsTable = customPropertyValueByKey?.clientsTable as Table | undefined;

  // Only subscribe to fields that drive kanban cards, filters, and search.
  // Detail-panel-only fields (orders, measurements, notes, etc.) are still read
  // from records at render time but don't trigger re-renders on their own,
  // which dramatically cuts down how often Airtable fires updates.
  const KANBAN_FIELD_IDS = [
    FIELD_IDS.CLIENT_FULL_NAME,
    FIELD_IDS.CLIENT_FIRST_NAME,
    FIELD_IDS.CLIENT_LAST_NAME,
    FIELD_IDS.CLIENT_STAGE,
    FIELD_IDS.CLIENT_EMAIL,
    FIELD_IDS.CLIENT_PHONE,
    FIELD_IDS.CLIENT_WEDDING,
    FIELD_IDS.CLIENT_STUDIO_FORMULA,
    FIELD_IDS.CLIENT_STUDIO_SHORT_NAME,
    FIELD_IDS.CLIENT_STUDIO_NAME_ROLLUP,
    FIELD_IDS.CLIENT_SALES_ASSOCIATE_NAME,
    FIELD_IDS.CLIENT_NEXT_APPT_ALT_LEAD,
    FIELD_IDS.CLIENT_LAST_PHASE_CHANGE,
    FIELD_IDS.CLIENT_APPT_PHOTOS,
    FIELD_IDS.CLIENT_MEASUREMENTS,
    FIELD_IDS.CLIENT_FOLLOW_UP_SENT,
    FIELD_IDS.CLIENT_APPAREL_MAGIC_ORDER,
    FIELD_IDS.APPAREL_MAGIC_ORDER_NUMBER,
  ] as const;

  const usedFields = useMemo(
    () => clientsTable
      ? KANBAN_FIELD_IDS.map(id => clientsTable.getFieldIfExists(id)).filter((f): f is NonNullable<typeof f> => f !== null)
      : [],
    [clientsTable],
  );

  const clientRecords = useRecords(clientsTable ?? null, { fields: usedFields });

  const vendorsTable = base.getTableByIdIfExists(VENDORS_TABLE_ID);
  const vendorNameField = useMemo(
    () => vendorsTable?.getFieldIfExists(VENDORS_FIELD_FULL_NAME) ?? null,
    [vendorsTable],
  );
  const vendorTypeField = useMemo(
    () => vendorsTable?.getFieldIfExists(VENDORS_FIELD_TYPE) ?? null,
    [vendorsTable],
  );
  const vendorFields = useMemo(() => {
    const f: Field[] = [];
    if (vendorNameField) f.push(vendorNameField);
    if (vendorTypeField) f.push(vendorTypeField);
    return f;
  }, [vendorNameField, vendorTypeField]);
  const vendorRecords = useRecords(
    vendorsTable ?? null,
    vendorFields.length > 0 ? { fields: vendorFields } : undefined,
  );

  const staffTable = base.getTableByIdIfExists(STAFF_TABLE_ID);
  const staffFullNameField = useMemo(() => staffTable?.getFieldIfExists(STAFF_FIELD_FULL_NAME) ?? null, [staffTable]);
  const staffIsActiveField = useMemo(() => staffTable?.getFieldIfExists(STAFF_FIELD_IS_ACTIVE) ?? null, [staffTable]);
  const staffFields = useMemo(() => {
    const f: Field[] = [];
    if (staffFullNameField) f.push(staffFullNameField);
    if (staffIsActiveField) f.push(staffIsActiveField);
    return f;
  }, [staffFullNameField, staffIsActiveField]);
  const staffRecords = useRecords(staffTable ?? null, staffFields.length > 0 ? { fields: staffFields } : undefined);

  const activeStaffNames = useMemo((): Set<string> => {
    if (!staffRecords || !staffFullNameField || !staffIsActiveField) return new Set();
    const names = new Set<string>();
    for (const r of staffRecords) {
      const isActive = r.getCellValue(staffIsActiveField);
      if (isActive) {
        const name = getCellValueAsStringSafe(r, staffFullNameField);
        if (name) names.add(name);
      }
    }
    return names;
  }, [staffRecords, staffFullNameField, staffIsActiveField]);

  const [studioFilter, setStudioFilter] = useState<string[]>([]);
  const [salespersonFilter, setSalespersonFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<string | null>('Last 7 days');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [stagePage, setStagePage] = useState<Record<string, number>>({});

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
      studioFormula:              f(FIELD_IDS.CLIENT_STUDIO_FORMULA),
      studioShortName:            f(FIELD_IDS.CLIENT_STUDIO_SHORT_NAME),
      salesAssociateName:         f(FIELD_IDS.CLIENT_SALES_ASSOCIATE_NAME),
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
      // Change #2 — AM order number field
      apparelMagicOrderNumber:    f(FIELD_IDS.APPAREL_MAGIC_ORDER_NUMBER),
      salesNotes:                 f(FIELD_IDS.CLIENT_SALES_NOTES),
      dueDate:                    f(FIELD_IDS.CLIENT_DUE_DATE),
      customizationNotes:         f(FIELD_IDS.CLIENT_CUSTOMIZATION_NOTES),
      firstAlterationsAppt:       f(FIELD_IDS.CLIENT_FIRST_ALTERATIONS_APPT),
      taxes:                      f(FIELD_IDS.CLIENT_TAXES),
      shippingCost:               f(FIELD_IDS.CLIENT_SHIPPING_COST),
      lastPhaseChange:            f(FIELD_IDS.CLIENT_LAST_PHASE_CHANGE),
      studioNameRollup:           f(FIELD_IDS.CLIENT_STUDIO_NAME_ROLLUP),
      acuityAddress:              f('fldkpfulLIk0jq34d'),
      otherAddress:               f('fld5uRLRmAXqAH0nu'),
    };
  }, [clientsTable]);

  const clientsData = useMemo((): ClientData[] => {
    if (!clientRecords || !fields) return [];
    return clientRecords.flatMap(record => {
      const stage = getCellValueAsStringSafe(record, fields.stage);
      // Skip full processing for records not in the active pipeline — they never display
      if (!STAGE_ORDER.includes(stage as StageName)) return [];
      const fullName              = getCellValueAsStringSafe(record, fields.fullName);
      const firstName             = getCellValueAsStringSafe(record, fields.firstName);
      const lastName              = getCellValueAsStringSafe(record, fields.lastName);
      const email                 = getCellValueAsStringSafe(record, fields.email);
      const phone                 = getCellValueAsStringSafe(record, fields.phone);
      const weddingDate           = getCellValueAsStringSafe(record, fields.wedding) || null;
      const weddingDateIfNotSet   = getCellValueAsStringSafe(record, fields.weddingIfNotSet);
      const weddingLocation       = getCellValueAsStringSafe(record, fields.weddingLocation);
      const weddingPlanner        = getCellValueAsStringSafe(record, fields.weddingPlanner);
      const studio                = getCellValueAsStringSafe(record, fields.studioFormula);
      const studioShortName       = getCellValueAsStringSafe(record, fields.studioShortName);
      const salesAssociateName    = getCellValueAsStringSafe(record, fields.salesAssociateName);
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
      const preferredStylistRaw   = getCellValueSafe<Array<{ id: string; name?: string }>>(record, fields.preferredStylist);
      const preferredStylistIds   = preferredStylistRaw?.map(s => s.id) ?? [];
      const preferredStylist      = preferredStylistRaw?.map(s => s.name).filter((n): n is string => !!n).join(', ') ?? '';
      const rtwSize               = getCellValueSafe<number>(record, fields.rtwSize) ?? null;
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
      const salesNotes            = getCellValueAsStringSafe(record, fields.salesNotes);
      const dueDateRaw            = extractFirstLookupString(record, fields.dueDate);
      const dueDate               = dueDateRaw || getCellValueAsStringSafe(record, fields.dueDate) || null;
      const customizationNotesRaw = getCellValueSafe<unknown>(record, fields.customizationNotes ?? { id: 'fld6C6SKaa1pWbTf6' } as any);
      const customizationNotes = (() => {
        if (!customizationNotesRaw) return '';
        const arr = Array.isArray(customizationNotesRaw) ? customizationNotesRaw : [customizationNotesRaw];
        return arr.map((x: any): string => {
          if (typeof x === 'string') return x;
          const v = x?.value ?? x?.name ?? x?.text;
          return v !== undefined ? String(v) : '';
        }).filter(Boolean).join(' | ');
      })();
      const firstAlterationsAppt  = extractFirstLookupString(record, fields.firstAlterationsAppt);
      const taxes                 = getCellValueSafe<number>(record, fields.taxes);
      const shippingCost          = getCellValueSafe<number>(record, fields.shippingCost);
      const taxesFormatted        = taxes != null ? `$${taxes.toLocaleString()}` : '—';
      const shippingCostFormatted = shippingCost != null ? `$${shippingCost.toLocaleString()}` : '—';

      // Change #2 — AM order search fields
      const amOrderRaw = getCellValueSafe<Array<{value?: string|number}>>(record, fields.apparelMagicOrder) ?? [];
      const amOrderStr = Array.isArray(amOrderRaw)
        ? amOrderRaw.map(v => String((v as any)?.value ?? '')).join(' ')
        : apparelMagicOrder;
      const amOrderNumber = String(getCellValueSafe<number>(record, fields.apparelMagicOrderNumber) ?? '');

      const hasMeasurementPhotos  = !!(apptPhotos && apptPhotos.length > 0);
      const favStylesInAppt       = favStylesLinks?.map(s => s.name).filter((n): n is string => !!n) ?? [];
      // Use getCellValueAsString — Airtable SDK handles lookup/rollup formatting for us
      const itemsSoldStr = getCellValueAsStringSafe(record, fields.itemsSold);
      const itemsSold = itemsSoldStr
        ? itemsSoldStr.split(',').map(s => s.trim()).filter(Boolean)
        : [];

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

      // Change #1 — suppress flags for Pre-Appointment clients
      const effectiveFlagCount = stage === 'Pre-Appointment' ? 0 : flagCount;
      const effectiveFlagLabels = stage === 'Pre-Appointment' ? [] : activeFlagLabels;

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
      const isOnBoard             = true; // guaranteed by early-exit above

      const lastPhaseChange = getCellValueSafe<string>(record, fields.lastPhaseChange) || getCellValueAsStringSafe(record, fields.lastPhaseChange) || null;
      const timelineBucket = getTimelineBucket(lastPhaseChange);
      const studioName = getCellValueAsStringSafe(record, fields.studioNameRollup) || studio || '';
      const acuityAddress = getCellValueAsStringSafe(record, fields.acuityAddress) || '';
      const otherAddress = getCellValueAsStringSafe(record, fields.otherAddress) || '';
      const alterationsApptCount = (() => {
        const raw = getCellValueSafe<unknown[]>(record, fields.latestAlterationsAppt);
        return Array.isArray(raw) ? raw.length : 0;
      })();

      return {
        id: record.id, fullName, firstName, lastName, stage, email, phone,
        formattedPhone, weddingDate, weddingDateIfNotSet, weddingLocation, weddingPlanner,
        studio, studioShortName, salesAssociateName, salesAssociatePhone, formattedSAPhone,
        salesAssociateEmail, appointmentCount, nextAppointment, lastAppointment,
        latestAlterationsAppt, nextAppointmentAltLead, nextAppointmentRoom,
        countryOfResidence, preferredStylist, preferredStylistIds, rtwSize, favStylesAcuity, samplesNotWhereNeeded,
        personalStyleNotes, measBust, measWaist, measHips, measHeight, hasMeasurementPhotos,
        followUpSent: followUpSentRaw, interestCustom, interestAlts, interestM2M, apptNotes,
        customizationCount, isRush, itemsSold, favStylesInAppt, totalSpend, totalSpendFormatted,
        shopifyAddress, discount, alterationsPaymentStatus, m2m, qtyItemsSold, apparelMagicOrder,
        shopifyOrderNumber, amOrderStr, amOrderNumber,
        ship, pickUp, orderReady, pickedPercent, contactedForAlterations,
        fulfillmentMethod, fulfillmentLabel, fulfillmentNotes, trackingNumber, threePL,
        holdShipmentDate, clientNotifiedFulfillment, addressConfirmed, taxShippingDisplay,
        alterationNotes, flagFollowUp, flagNoMeasurements, flagNoPhotos,
        flagCount: effectiveFlagCount,
        activeFlagLabels: effectiveFlagLabels,
        displayName, weddingDisplay, isOnBoard, timelineBucket,
        salesNotes, dueDate, customizationNotes, firstAlterationsAppt,
        taxes, shippingCost, taxesFormatted, shippingCostFormatted,
        lastPhaseChange, studioName, acuityAddress, otherAddress, alterationsApptCount,
      };
    });
  }, [clientRecords, fields]);

  const stageOptions = useMemo(() => STAGE_ORDER.map(s => STAGE_DISPLAY_LABELS[s] ?? s), []);

  const studioOptions = useMemo(() => {
    const s = new Set<string>();
    clientsData.forEach(c => { if (c.studio) s.add(c.studio); });
    return Array.from(s).sort();
  }, [clientsData]);

  const salespersonOptions = useMemo(() => {
    const inPipeline = new Set<string>();
    clientsData.forEach(c => { if (c.salesAssociateName) inPipeline.add(c.salesAssociateName); });
    // Filter to active SAs only when staff data is loaded; fall back to all otherwise
    if (activeStaffNames.size > 0) {
      return Array.from(inPipeline).filter(name => activeStaffNames.has(name)).sort();
    }
    return Array.from(inPipeline).sort();
  }, [clientsData, activeStaffNames]);

  // Stage filter only applies to List view (Kanban already groups by stage via its
  // own columns), but the selection itself persists across view switches.
  const filteredClients = useMemo(() => {
    const studioSet = studioFilter.length > 0 ? new Set(studioFilter) : null;
    const salesSet  = salespersonFilter.length > 0 ? new Set(salespersonFilter) : null;
    return clientsData.filter(c => {
      if (!c.isOnBoard) return false;
      if (studioSet && !studioSet.has(c.studio)) return false;
      if (salesSet && !salesSet.has(c.salesAssociateName)) return false;
      if (timelineFilter !== null && c.timelineBucket !== timelineFilter) return false;
      return true;
    });
  }, [clientsData, studioFilter, salespersonFilter, timelineFilter]);

  const listFilteredClients = useMemo(() => {
    const stageSet = stageFilter.length > 0 ? new Set(stageFilter) : null;
    if (!stageSet) return filteredClients;
    return filteredClients.filter(c => stageSet.has(STAGE_DISPLAY_LABELS[c.stage] ?? c.stage));
  }, [filteredClients, stageFilter]);

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

  useEffect(() => { setStagePage({}); }, [studioFilter, salespersonFilter, stageFilter, timelineFilter]);

  const handleCardClick = useCallback((id: string) => {
    setSelectedClientId(id);
    setFullProfileOpen(true);
  }, []);
  const handleSearchSelect  = useCallback((id: string) => { setSelectedClientId(id); setFullProfileOpen(true); }, []);
  const handleCloseFullProfile = useCallback(() => { setSelectedClientId(null); setFullProfileOpen(false); }, []);
  const clearAllFilters        = useCallback(() => { setStudioFilter([]); setSalespersonFilter([]); setStageFilter([]); setTimelineFilter(null); }, []);

  const hasActiveFilters  = studioFilter.length > 0 || salespersonFilter.length > 0 || timelineFilter !== null
    || (viewMode === 'list' && stageFilter.length > 0);
  const visibleClients    = viewMode === 'list' ? listFilteredClients : filteredClients;
  const noMatchingClients = visibleClients.length === 0 && hasActiveFilters;

  if (errorState) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1A1917] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-[#F5F3EF]">Error loading configuration</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please check the properties panel.</p>
        </div>
      </div>
    );
  }

  if (!clientsTable || !fields?.stage) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1A1917] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-[#F5F3EF]">Configuration Required</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This Pipeline interface requires the Clients table. Configure it in the properties panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans bg-[#F6F4F0] dark:bg-[#1A1917]">
      {/* Filter row */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#242220] flex-shrink-0">
        <SearchDropdown clientsData={clientsData} onSelect={handleSearchSelect} stageColorsByStage={stageColorsByStage} />
        <MultiSelectDropdown label="Studio"      options={studioOptions}      selected={studioFilter}      onChange={setStudioFilter} />
        <MultiSelectDropdown label="Sales Associate" options={salespersonOptions} selected={salespersonFilter} onChange={setSalespersonFilter} />
        <SingleSelectDropdown label="Timeline"    options={TIMELINE_OPTIONS}   selected={timelineFilter}    onChange={setTimelineFilter} />
        {viewMode === 'list' && (
          <MultiSelectDropdown label="Stage" options={stageOptions} selected={stageFilter} onChange={setStageFilter} />
        )}

        {/* View mode toggle */}
        <div className="ml-auto">
          <ViewDropdown value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {noMatchingClients && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-shrink-0">
          <span>No clients match the current filters.</span>
          <button type="button" onClick={clearAllFilters} aria-label="Clear all filters"
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <XIcon size={14} />
          </button>
        </div>
      )}

      {/* Main content — Kanban or List */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 min-h-0 overflow-hidden flex gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1A1917]">
          {STAGE_ORDER.map(stage => {
            const clients     = clientsByStage[stage] ?? [];
            const stageColors = stageColorsByStage.get(stage) ?? DEFAULT_STAGE_COLORS;
            const stageLabel  = STAGE_DISPLAY_LABELS[stage] ?? stage;
            const page        = stagePage[stage] ?? 0;
            const totalPages  = Math.max(1, Math.ceil(clients.length / KANBAN_PAGE_SIZE));
            const pagedClients = clients.slice(page * KANBAN_PAGE_SIZE, (page + 1) * KANBAN_PAGE_SIZE);
            const canPrev     = page > 0;
            const canNext     = page < totalPages - 1;
            return (
              <div key={stage} className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#242220] border border-gray-200 dark:border-[#34312C] rounded-lg overflow-hidden">
                <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-white/10">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 tracking-wide">{stageLabel}</span>
                  <span className="inline-flex items-center justify-center min-w-[28px] h-[22px] px-1.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: stageColors.bg, color: stageColors.fg }}>
                    {formatStageCount(clients.length)}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {clients.length === 0
                    ? <div className="py-12 text-center text-xs text-gray-400 dark:text-gray-500">No clients in this stage</div>
                    : pagedClients.map(client => (
                        <ClientCard key={client.id} client={client} stageColors={stageColors} onCardClick={handleCardClick} />
                      ))}
                </div>
                {clients.length > KANBAN_PAGE_SIZE && (
                  <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-[#1A1917]">
                    <button
                      type="button"
                      onClick={() => setStagePage(p => ({ ...p, [stage]: page - 1 }))}
                      disabled={!canPrev}
                      className="text-xs font-medium px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-default transition-colors"
                    >← Prev</button>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{page + 1} / {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setStagePage(p => ({ ...p, [stage]: page + 1 }))}
                      disabled={!canNext}
                      className="text-xs font-medium px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-default transition-colors"
                    >Next →</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-[#242220] pt-3">
          <PipelineListView
            clients={listFilteredClients}
            suppressEmptyMessage={noMatchingClients}
            onSelectClient={(c) => {
              setSelectedClientId(c.id);
              setFullProfileOpen(true);
            }}
          />
        </div>
      )}

      {/* Full profile modal */}
      {selectedClient && fullProfileOpen && (
        <FullProfileModal
          client={selectedClient}
          stageColors={selectedClientStageColors}
          stageChoices={stageChoices}
          base={base}
          vendorRecords={vendorRecords}
          vendorNameField={vendorNameField}
          vendorTypeField={vendorTypeField}
          onClose={handleCloseFullProfile}
        />
      )}
    </div>
  );
}

initializeBlock({ interface: () => <Pipeline /> });
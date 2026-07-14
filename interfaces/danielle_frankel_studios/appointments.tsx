import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  initializeBlock,
  useBase,
  useRecords,
  useCustomProperties,
  expandRecord,
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  }, [theme]);
  return theme;
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
  .pill-switch {
    position: relative;
    display: inline-flex;
    background: #FFFFFF;
    border: 1px solid #E9E0CE;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  .dark .pill-switch {
    background: #25211A;
    border-color: #38322A;
  }
  .pill-switch-track {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: #D97706;
    border-radius: 0.5rem;
    transition: transform 0.2s ease;
    pointer-events: none;
  }
  .dark .pill-switch-track {
    background: #FBBF24;
  }
  .pill-switch-btn {
    position: relative;
    z-index: 1;
    cursor: pointer;
    padding: 0.375rem 0;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    border: none;
    background: transparent;
    transition: color 0.15s ease;
    white-space: nowrap;
    text-align: center;
  }
  .pill-switch-btn.active {
    color: #FFFFFF;
  }
  .dark .pill-switch-btn.active {
    color: #1B1813;
  }
  .pill-switch-btn.inactive {
    color: #6B6357;
  }
  .dark .pill-switch-btn.inactive {
    color: #B8AF9F;
  }
  .pill-switch-btn.inactive:hover {
    color: #1A1612;
  }
  .dark .pill-switch-btn.inactive:hover {
    color: #F3EFE6;
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
  APPT_NAME: 'fldZO3rF3KOGxG0S5',
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
  CLIENT_STUDIO: 'fldIenJoxseeHmfIv',
  CLIENT_SA_LINK: 'fldBTKBaw8YvNAlwK',
  CLIENT_STYLISTS: 'fld2jVE1qluvlhV7D',
  CLIENT_RTW_SIZE: 'fldvV2CiEx4RQN4mO',
  CLIENT_NEXT_APPT: 'fldTe2cyBmicx9Ple',
  CLIENT_LAST_APPT: 'fldd01OccObkG9sGe',
  CLIENT_APPT_RECORDS: 'fldYb8G67izm3qelZ',
  CLIENT_FAV_STYLES_ACUITY: 'fldZzNR0g5VEJ5RmX',
  CLIENT_PERSONAL_NOTES: 'fldQiGCx5hRQ0Am1Z',
  CLIENT_WEDDING_LOC: 'fldikRqj41XYiIDBk',
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

function renderTimeCell(timeValue: string): React.ReactElement {
  const date = new Date(timeValue);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
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

function formatNYTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
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

const AIRTABLE_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-200 dark:bg-blue-800/50 text-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-600',
  blueBright: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  blueLight1: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-800',
  blueLight2: 'bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 border-blue-100 dark:border-blue-800',
  cyan: 'bg-cyan-200 dark:bg-cyan-800/50 text-cyan-800 dark:text-cyan-100 border-cyan-300 dark:border-cyan-600',
  cyanBright: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  cyanLight1: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800',
  cyanLight2: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-500 dark:text-cyan-400 border-cyan-100 dark:border-cyan-800',
  teal: 'bg-teal-200 dark:bg-teal-800/50 text-teal-800 dark:text-teal-100 border-teal-300 dark:border-teal-600',
  tealBright: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-200 border-teal-200 dark:border-teal-700',
  tealLight1: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-300 border-teal-100 dark:border-teal-800',
  tealLight2: 'bg-teal-50 dark:bg-teal-950/30 text-teal-500 dark:text-teal-400 border-teal-100 dark:border-teal-800',
  green: 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-100 border-green-300 dark:border-green-600',
  greenBright: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200 border-green-200 dark:border-green-700',
  greenLight1: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-300 border-green-100 dark:border-green-800',
  greenLight2: 'bg-green-50 dark:bg-green-950/30 text-green-500 dark:text-green-400 border-green-100 dark:border-green-800',
  yellow: 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-600',
  yellowBright: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
  yellowLight1: 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-300 border-yellow-100 dark:border-yellow-800',
  yellowLight2: 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-500 dark:text-yellow-400 border-yellow-100 dark:border-yellow-800',
  orange: 'bg-orange-200 dark:bg-orange-800/50 text-orange-800 dark:text-orange-100 border-orange-300 dark:border-orange-600',
  orangeBright: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 border-orange-200 dark:border-orange-700',
  orangeLight1: 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-300 border-orange-100 dark:border-orange-800',
  orangeLight2: 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 dark:text-orange-400 border-orange-100 dark:border-orange-800',
  red: 'bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-100 border-red-300 dark:border-red-600',
  redBright: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 border-red-200 dark:border-red-700',
  redLight1: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border-red-100 dark:border-red-800',
  redLight2: 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 border-red-100 dark:border-red-800',
  pink: 'bg-pink-200 dark:bg-pink-800/50 text-pink-800 dark:text-pink-100 border-pink-300 dark:border-pink-600',
  pinkBright: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-200 border-pink-200 dark:border-pink-700',
  pinkLight1: 'bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-300 border-pink-100 dark:border-pink-800',
  pinkLight2: 'bg-pink-50 dark:bg-pink-950/30 text-pink-500 dark:text-pink-400 border-pink-100 dark:border-pink-800',
  purple: 'bg-purple-200 dark:bg-purple-800/50 text-purple-800 dark:text-purple-100 border-purple-300 dark:border-purple-600',
  purpleBright: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 border-purple-200 dark:border-purple-700',
  purpleLight1: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-800',
  purpleLight2: 'bg-purple-50 dark:bg-purple-950/30 text-purple-500 dark:text-purple-400 border-purple-100 dark:border-purple-800',
  gray: 'bg-gray-200 dark:bg-white/15 text-gray-800 dark:text-[#F3EFE6] border-gray-300 dark:border-white/15',
  grayBright: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]',
  grayLight1: 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-white/5',
  grayLight2: 'bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-white/5',
};

function getAirtableSelectPillClasses(colorName: string | null | undefined): string {
  const colorClasses = colorName
    ? (AIRTABLE_COLOR_MAP[colorName] ?? 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]')
    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]';
  return `inline-flex items-center text-base px-2.5 py-0.5 rounded-full font-medium border whitespace-nowrap ${colorClasses}`;
}

function extractSelectValue(rawValue: unknown): { name: string; color: string | null } | null {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'string') return rawValue.length > 0 ? { name: rawValue, color: null } : null;
  if (Array.isArray(rawValue) && rawValue.length > 0) {
    const first = rawValue[0];
    if (first && typeof first === 'object' && 'name' in first) {
      const obj = first as { name: string; color?: string };
      return { name: obj.name, color: obj.color ?? null };
    }
    if (typeof first === 'string') return { name: first, color: null };
    return null;
  }
  if (typeof rawValue === 'object' && !Array.isArray(rawValue) && 'name' in (rawValue as object)) {
    const obj = rawValue as { name: string; color?: string };
    return { name: obj.name, color: obj.color ?? null };
  }
  return null;
}

function MissingDataPill(): React.ReactElement {
  return (
    <span className="inline-flex items-center text-base px-2.5 py-0.5 rounded-full font-medium border bg-red-50 text-red-600 border-red-200 whitespace-nowrap">
      Missing Data
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

function StagePill({ stage, size = 'sm' }: { stage: string | null; size?: 'sm' | 'lg' }): React.ReactElement {
  if (!stage) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  const colorClasses = STAGE_PILL_CLASSES[stage] ?? 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#38322A]';
  const sizeClass = size === 'lg' 
    ? 'inline-flex items-center text-sm px-3 py-1.5 rounded-full font-medium border whitespace-nowrap'
    : 'inline-flex items-center text-base px-2 py-0.5 rounded-full font-medium border whitespace-nowrap';
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
  label: string;
  fieldId?: string;
  children: React.ReactNode;
}

function DetailRow({ label, fieldId, children }: DetailRowProps): React.ReactElement {
  const source = fieldId !== undefined ? FIELD_SOURCE[fieldId] : undefined;
  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
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

function getInitials(
  firstName: string | null,
  lastName: string | null,
  fullNameAcuity: string | null,
  displayName: string | null
): string {
  if (firstName && lastName) {
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }
  if (fullNameAcuity) {
    const parts = fullNameAcuity.trim().split(/\s+/);
    if (parts.length >= 2) {
      return ((parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase();
    }
    if (parts.length === 1 && parts[0]) {
      return parts[0].substring(0, 2).toUpperCase();
    }
  }
  if (displayName) {
    return displayName.substring(0, 2).toUpperCase();
  }
  return '??';
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

interface NotificationModalProps {
  content: React.ReactNode;
  onClose: () => void;
}

function NotificationModal({ content, onClose }: NotificationModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#25211A] rounded-xl p-8 max-w-[480px] w-full mx-4" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base text-gray-800 dark:text-[#F3EFE6] mb-6 leading-relaxed">{content}</p>
        <div className="flex justify-center">
          <button
            onClick={onClose}
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

  const btn = 'text-sm font-medium border rounded-lg transition-colors whitespace-nowrap min-w-[100px] px-4 py-1.5 text-center';
  const btnDefault = `${btn} border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#25211A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer`;
  const btnDisabled = `${btn} opacity-50 cursor-not-allowed border-gray-200 dark:border-[#38322A] bg-white dark:bg-[#25211A] text-gray-700 dark:text-gray-300`;
  const btnGreen = `${btn} border-green-200 bg-green-100 text-green-700 cursor-default`;

  const pillRed = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-base font-medium border bg-red-50 text-red-600 border-red-200 whitespace-nowrap';
  const pillYellow = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-base font-medium border bg-orange-50 text-orange-600 border-orange-200 whitespace-nowrap';

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
              <span className={pillRed}>Missing Appointment Data</span>
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
            <span className={pillRed}>Missing Appointment Data</span>
          )}
          <span className={pillYellow}>Pick Up Pending</span>
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
              <span className={pillRed}>Missing Appointment Data</span>
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
              <span className={pillRed}>Missing Appointment Data</span>
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
            <span className={pillRed}>Missing Appointment Data</span>
          )
        ) : !hasRequiredData ? (
          <span className={pillRed}>Missing Appointment Data</span>
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
          <span className={pillYellow}>Pick Up Pending</span>
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
  const btnWidth = 88; // px, sized to match other dropdown triggers

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const layoutLabel = (layout: 'list' | 'calendar') => (layout === 'list' ? 'List' : 'Calendar');
  const otherOptions = LAYOUT_OPTIONS.filter((layout) => layout !== value);

  return (
    <div ref={containerRef} className="relative" style={{ width: btnWidth }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full inline-flex items-center justify-center gap-2 bg-white dark:bg-[#25211A] border border-gray-300 dark:border-white/15 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/20 focus:border-[#D97706] dark:focus:border-[#FBBF24] focus:ring-1 focus:ring-[#D97706] dark:focus:ring-[#FBBF24] outline-none transition-colors"
      >
        <span className="text-center truncate">{layoutLabel(value)}</span>
        <CaretDownIcon size={14} className={`text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-20 bg-white dark:bg-[#25211A] border border-gray-200 dark:border-[#38322A] rounded-lg py-1 no-scrollbar" style={{ width: btnWidth, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {otherOptions.map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => { onChange(layout); setOpen(false); }}
              className="w-full text-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              {layoutLabel(layout)}
            </button>
          ))}
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

  const txtBase = 'text-xs font-medium transition-colors';
  const btnBlue = `${txtBase} text-[#D97706] dark:text-[#FBBF24] hover:text-[#B45F04] dark:text-[#FBBF24] cursor-pointer`;
  const btnDisabledCls = `${txtBase} opacity-40 cursor-not-allowed text-gray-400 dark:text-gray-500`;
  const btnGreenTxt = `${txtBase} text-green-600`;
  const sep = <span className="text-gray-300 dark:text-gray-600 text-xs select-none">·</span>;

  const items: React.ReactNode[] = [];

  if (checkInValue) {
    items.push(<span key="ci" className={btnGreenTxt}>Checked In</span>);
  } else if (showCheckInButton) {
    if (hasRequiredData) {
      items.push(
        <button key="ci" onClick={handleCheckInClick} disabled={!canUpdate}
          className={canUpdate ? btnBlue : btnDisabledCls}>Check In</button>
      );
    } else {
      items.push(<span key="ci" className="text-xs text-red-500">Missing Data</span>);
    }
  }

  if (checkInValue) {
    if (showCleared) {
      items.push(<span key="cl" className={btnGreenTxt}>Cleared</span>);
    } else if (showClearButton) {
      items.push(
        <button key="cl" onClick={handleClearClick} disabled={!canUpdate}
          className={canUpdate ? btnBlue : btnDisabledCls}>Clear</button>
      );
    }
  }

  if (category === 'pick-up-only' || category === 'combined-pick-up') {
    if (pickedUpValue) {
      items.push(<span key="pu" className={btnGreenTxt}>Picked Up</span>);
    } else if (showCleared || category === 'pick-up-only') {
      items.push(
        <button key="pu" onClick={handlePickUpClick} className={btnBlue}>Pick Up</button>
      );
    } else {
      items.push(<span key="pu" className="text-xs text-orange-500">Pick Up Pending</span>);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-2 pt-2 border-t border-gray-100 dark:border-white/5"
      onClick={(e) => e.stopPropagation()}>
      {items.reduce<React.ReactNode[]>((acc, item, i) => {
        if (i > 0) acc.push(<React.Fragment key={`sep-${i}`}>{sep}</React.Fragment>);
        acc.push(<React.Fragment key={i}>{item}</React.Fragment>);
        return acc;
      }, [])}
      {errorMsg && <span className="w-full text-xs text-red-500 mt-0.5">{errorMsg}</span>}
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
  };
  clientNameById: Map<string, string>;
  clientStageById: Map<string, string>;
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
                        const typeValue = appointmentFields.typeField
                          ? record.getCellValueAsString(appointmentFields.typeField)
                          : '';
                        const category = getAppointmentCategory(typeValue);
                        const hasRequiredData = !!(
                          appointmentFields.clientField && record.getCellValueAsString(appointmentFields.clientField) &&
                          appointmentFields.saNameField && record.getCellValueAsString(appointmentFields.saNameField) &&
                          (category === 'pick-up-only' || (appointmentFields.roomLinkField && record.getCellValueAsString(appointmentFields.roomLinkField)))
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
  appointmentFields: {
    timeField: Field | undefined;
    clientField: Field | undefined;
    typeField: Field | undefined;
    saNameField: Field | undefined;
    altLeadLinkField: Field | undefined;
    roomLinkField: Field | undefined;
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

  const shortType = getShortTypeLabel(typeValue);
  const isAlterationsAppt = shortType.toLowerCase().includes('alterations');
  // #27 — Alterations Lead shown only when appointment type is Alterations
  const showAltLead = isAlterationsAppt;

  // Stage pill color class
  const stagePillClasses = STAGE_PILL_CLASSES[clientStage ?? ''] ?? 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#38322A]';

  if (isBlock) {
    return (
      <div
        draggable
        onDragStart={() => onDragStart(record.id)}
        onClick={() => onSelectRecord(record.id)}
        className="bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-[#38322A] rounded-lg p-3 cursor-move transition-shadow relative min-h-[120px] flex flex-col items-center justify-center"
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
      {/* Stage pill: top-right */}
      {clientStage && (
        <span className={`absolute top-2.5 right-2.5 inline-flex items-center px-1.5 py-0.5 rounded-full font-medium border whitespace-nowrap leading-tight border text-[10px] ${stagePillClasses}`}>
          {clientStage}
        </span>
      )}

      {/* Client name */}
      <div className="text-sm font-semibold text-gray-800 dark:text-[#F3EFE6] mb-1 pr-24">{clientName}</div>

      {/* Appointment type — bold */}
      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">{shortType}</div>

      {/* Fields */}
      <div className="space-y-0.5">
        {saValue && <div className="text-xs text-gray-600 dark:text-gray-400">SA: {saValue}</div>}
        {showAltLead && (
          <div className={`text-xs ${altLeadValue ? 'text-gray-600 dark:text-gray-400' : 'text-red-500'}`}>
            Alt Lead: {altLeadValue || 'missing'}
          </div>
        )}
        {roomValue && <div className="text-xs text-gray-600 dark:text-gray-400">Room: {roomValue}</div>}
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
}: DetailDrawerProps) {
  const apptTypeField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_TYPE);
  const apptTimeField = appointmentsTable.getFieldIfExists(FIELD_IDS.APPT_TIME);
  const saNameField = appointmentsTable.getFieldIfExists(FIELD_IDS.SA_NAME);
  const clientLinkField = appointmentsTable.getFieldIfExists(FIELD_IDS.CLIENT_LINK);
  const fullNameAcuityField = appointmentsTable.getFieldIfExists(FIELD_IDS.FULL_NAME_ACUITY);
  const favStylesField = appointmentsTable.getFieldIfExists(FIELD_IDS.FAV_STYLES);
  const samplesNotInNyField = appointmentsTable.getFieldIfExists(FIELD_IDS.SAMPLES_NOT_IN_NY);

  const clientFirstNameField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_FIRST_NAME);
  const clientLastNameField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_LAST_NAME);
  const clientFullNameField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_FULL_NAME);
  const clientEmailField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_EMAIL);
  const clientPhoneField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_PHONE);
  const clientWeddingField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_WEDDING);
  const clientWeddingIfNotSetField = clientsTable.getFieldIfExists(FIELD_IDS.CLIENT_WEDDING_IF_NOT_SET);

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

    const formattedDate = clientWeddingField ? linkedClientRecord.getCellValueAsString(clientWeddingField) : null;
    const ifNotSet = clientWeddingIfNotSetField
      ? linkedClientRecord.getCellValueAsString(clientWeddingIfNotSetField)
      : null;

    if (formattedDate) {
      weddingDisplay = `Wedding: ${formatFriendlyDate(formattedDate)}`;
    } else if (ifNotSet) {
      weddingDisplay = `Wedding: ${ifNotSet} (approx.)`;
    }
  } else if (fullNameAcuity) {
    displayName = fullNameAcuity;
  }

  const initials = getInitials(firstName, lastName, fullNameAcuity, displayName);

  const apptTime = apptTimeField ? (record.getCellValue(apptTimeField) as string | null) : null;
  let timeDisplay = '—';
  if (apptTime) {
    const startDate = new Date(apptTime);
    const durationMatch = typeLabel.match(/-\s*(\d+)\s*Minutes?\s*$/i);
    const durationMinutes = durationMatch ? parseInt(durationMatch[1] ?? '0', 10) : null;

    if (durationMinutes) {
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      timeDisplay = `${formatNYTime(startDate)} – ${formatNYTime(endDate)}`;
    } else {
      timeDisplay = formatNYTime(startDate);
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
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-base font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
              —
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <BlockTimePill />
                {studioName && <span className="text-base text-gray-500 dark:text-gray-400">{studioName}</span>}
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
              <div className="text-base text-gray-800 dark:text-[#F3EFE6] font-medium">{timeDisplay}</div>
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
          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] dark:bg-[#3A2E12] flex items-center justify-center text-base font-semibold text-[#B45F04] dark:text-[#FBBF24] flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {/* Row 1: Name + Studio + Stage pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-semibold text-gray-800 dark:text-[#F3EFE6]">{displayName}</span>
              {studioName && <span className="text-base text-gray-500 dark:text-gray-400">{studioName}</span>}
              {clientStage && <StagePill stage={clientStage} size="lg" />}
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
            <div className="text-base text-gray-800 dark:text-[#F3EFE6] font-medium">{timeDisplay}</div>
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
          <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1"><span>Appointment notes</span></div>
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
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientStylistsField ? linkedClientRecord.getCellValueAsString(clientStylistsField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Ready to wear size" fieldId={FIELD_IDS.CLIENT_RTW_SIZE}>
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientRtwSizeField ? linkedClientRecord.getCellValueAsString(clientRtwSizeField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Next appointment">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientNextApptField ? linkedClientRecord.getCellValueAsString(clientNextApptField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Previous appointments">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientApptRecordsField ? linkedClientRecord.getCellValueAsString(clientApptRecordsField) : '—'}</div>
            </DetailRow>
            {clientFavStylesAcuityField && linkedClientRecord.getCellValueAsString(clientFavStylesAcuityField) && (
              <DetailRow label="Favorite styles" fieldId={FIELD_IDS.CLIENT_FAV_STYLES_ACUITY}>
                <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{linkedClientRecord.getCellValueAsString(clientFavStylesAcuityField)}</div>
              </DetailRow>
            )}
            <DetailRow label="Personal style notes" fieldId={FIELD_IDS.CLIENT_PERSONAL_NOTES}>
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientPersonalNotesField ? linkedClientRecord.getCellValueAsString(clientPersonalNotesField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Wedding location" fieldId={FIELD_IDS.CLIENT_WEDDING_LOC}>
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientWeddingLocField ? linkedClientRecord.getCellValueAsString(clientWeddingLocField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Wedding planner" fieldId={FIELD_IDS.CLIENT_WEDDING_PLANNER}>
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientWeddingPlannerField ? linkedClientRecord.getCellValueAsString(clientWeddingPlannerField) : '—'}</div>
            </DetailRow>
          </div>
        )}

        {isFitPickUp && linkedClientRecord && (
          <div className="mt-6 space-y-5">
            <DetailRow label="Last appointment">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientLastApptField ? linkedClientRecord.getCellValueAsString(clientLastApptField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Next appointment">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientNextApptField ? linkedClientRecord.getCellValueAsString(clientNextApptField) : '—'}</div>
            </DetailRow>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <DetailRow label="Bust">
                <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{bustField ? record.getCellValueAsString(bustField) : '—'}</div>
              </DetailRow>
              <DetailRow label="Waist">
                <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{waistField ? record.getCellValueAsString(waistField) : '—'}</div>
              </DetailRow>
              <DetailRow label="Hips">
                <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{hipsField ? record.getCellValueAsString(hipsField) : '—'}</div>
              </DetailRow>
              <DetailRow label="Height">
                <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{heightField ? record.getCellValueAsString(heightField) : '—'}</div>
              </DetailRow>
            </div>
            <DetailRow label="Measurement photos">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientMeasurementsField ? linkedClientRecord.getCellValueAsString(clientMeasurementsField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Photos from appointment">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{apptPhotosField ? record.getCellValueAsString(apptPhotosField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Follow-up">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{followUpField ? record.getCellValueAsString(followUpField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Interest in alterations">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientInterestAltsField ? linkedClientRecord.getCellValueAsString(clientInterestAltsField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Interest in made to measure">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientInterestM2mField ? linkedClientRecord.getCellValueAsString(clientInterestM2mField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Rush order">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientIsRushField ? linkedClientRecord.getCellValueAsString(clientIsRushField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Private appointment notes">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{clientApptNotesField ? linkedClientRecord.getCellValueAsString(clientApptNotesField) : '—'}</div>
            </DetailRow>
          </div>
        )}

        {isAlterations && (
          <div className="mt-6 space-y-5">
            <DetailRow label="Alterations notes">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{altNotesField ? record.getCellValueAsString(altNotesField) : '—'}</div>
            </DetailRow>
            <DetailRow label="Customizations">
              <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{customizationField ? record.getCellValueAsString(customizationField) : '—'}</div>
            </DetailRow>
            <div className="text-sm text-gray-600 dark:text-gray-400 italic">Flags (veil/shoes purchased) pending confirmation with Julia</div>
          </div>
        )}

        {!isFirstVisit && !isFitPickUp && !isAlterations && (
          <>
            {favStylesValue && (
              <div className="mt-5">
                <DetailRow label="Favorite styles">
                  <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{favStylesValue}</div>
                </DetailRow>
              </div>
            )}

            {isNyStudio && samplesNotInNyValue && (
              <div className="mt-5">
                <DetailRow label="Samples not in NY">
                  <div className="text-base text-gray-800 dark:text-[#F3EFE6]">{samplesNotInNyValue}</div>
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
  const [sortState, setSortState] = useState<SortState>({});
  const [layoutMode, setLayoutMode] = useState<'list' | 'calendar'>('list');

  const [isClearingByRecord, setIsClearingByRecord] = useState<{ [key: string]: boolean }>({});
  const [clearErrorByRecord, setClearErrorByRecord] = useState<{ [key: string]: string }>({});

  const dateStepperRef = useRef<HTMLDivElement>(null);

  const [modal, setModal] = useState<{ content: React.ReactNode } | null>(null);

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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedRecordId(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const apptTimeField = appointmentsTable?.getFieldIfExists(FIELD_IDS.APPT_TIME) ?? null;
  const apptTypeField = appointmentsTable?.getFieldIfExists(FIELD_IDS.APPT_TYPE) ?? null;
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
    return Array.from(values).sort();
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
      setSelectedRecordId(null);
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
    return (
      <th 
        className={`px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-left ${clickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10' : ''}`}
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
    <div className="h-screen flex flex-col overflow-hidden font-sans antialiased bg-[#F8F5EE] dark:bg-[#1B1813]">
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
        {studioOptions.length > 0 && (() => {
          const activeIdx = studioOptions.indexOf(selectedStudio);
          const btnW = 136; // px, equal for all studios
          return (
            <div className="pill-switch" style={{ width: btnW * studioOptions.length }}>
              <div
                className="pill-switch-track"
                style={{ width: btnW, transform: `translateX(${Math.max(0, activeIdx) * btnW}px)` }}
              />
              {studioOptions.map((studio) => (
                <button
                  key={studio}
                  onClick={() => setSelectedStudio(studio)}
                  className={`pill-switch-btn truncate ${selectedStudio === studio ? 'active' : 'inactive'}`}
                  style={{ width: btnW }}
                  title={studio}
                >
                  {studio}
                </button>
              ))}
            </div>
          );
        })()}

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
                    const typeValue = apptTypeField ? record.getCellValueAsString(apptTypeField) : '';
                    const apptCategory = apptCategoryField ? record.getCellValueAsString(apptCategoryField) : '';
                    const isAlterationsAppt = apptCategory.toLowerCase() === 'alterations';
                    const apptNameRaw = apptNameField ? record.getCellValue(apptNameField) : null;
                    const apptNameEntry = extractSelectValue(apptNameRaw)
                      ?? (typeValue ? { name: getShortTypeLabel(typeValue), color: null as null } : null);
                    
                    const linkedClients = clientLinkField
                      ? (record.getCellValue(clientLinkField) as Array<{ id: string }> | null)
                      : null;
                    const linkedClientId = linkedClients?.[0]?.id ?? null;
                    const clientStage = linkedClientId ? (clientStageById.get(linkedClientId) ?? null) : null;
                    const isBlock = isBlockTime(record, clientLinkField);

                    const category = getAppointmentCategory(typeValue);
                    const hasRequiredData = !!(
                      clientLinkField && record.getCellValueAsString(clientLinkField) &&
                      saNameField && record.getCellValueAsString(saNameField) &&
                      (category === 'pick-up-only' || (roomLinkField && record.getCellValueAsString(roomLinkField)))
                    );

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
                          className={`border-b border-gray-100 dark:border-white/5 cursor-pointer transition-colors bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 ${
                            isSelected ? 'bg-[#FEF3C7] dark:bg-[#3A2E12]' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 text-base whitespace-nowrap text-gray-600 dark:text-gray-400">
                            {timeValue ? renderTimeCell(timeValue) : '—'}
                          </td>
                          <td colSpan={6} className="px-3 py-2.5 text-base font-medium text-center text-gray-600 dark:text-gray-400">
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
                        <td className="px-3 py-2.5 text-base whitespace-nowrap">
                          {timeValue ? renderTimeCell(timeValue) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-base font-medium whitespace-nowrap text-[#1A1612] dark:text-[#F3EFE6]">
                          {clientLinkField && record.getCellValueAsString(clientLinkField)
                            ? record.getCellValueAsString(clientLinkField)
                            : <MissingDataPill />}
                        </td>
                        <td className="px-3 py-2.5">
                          <StagePill stage={clientStage} />
                        </td>
                        <td className="px-3 py-2.5">
                          {apptNameEntry
                            ? <span className={getAppointmentTypePillClasses(apptNameEntry.name, 'md')}>{apptNameEntry.name}</span>
                            : <MissingDataPill />}
                        </td>
                        <td className="px-3 py-2.5 text-base whitespace-nowrap">
                          {roomValue ? <span className="text-gray-600 dark:text-gray-400">{roomValue}</span> : <MissingDataPill />}
                        </td>
                        <td className="px-3 py-2.5 text-base whitespace-nowrap">
                          {saValue ? <span className="text-gray-600 dark:text-gray-400">{saValue}</span> : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-base whitespace-nowrap">
                          {altLeadValue
                            ? <span className="text-gray-600 dark:text-gray-400">{altLeadValue}</span>
                            : isAlterationsAppt ? <MissingDataPill /> : '—'}
                        </td>
                        <td className="px-3 py-2.5">
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
              }}
              clientNameById={clientNameById}
              clientStageById={clientStageById}
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
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => setSelectedRecordId(null)}
        >
          <div
            className="bg-white dark:bg-[#25211A] rounded-xl w-full max-w-[720px] max-h-[70vh] overflow-hidden flex flex-col mx-4" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
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
              onClose={() => setSelectedRecordId(null)}
              clearErrorByRecord={clearErrorByRecord}
              roomLinkField={roomLinkField}
              studioNameField={studioNameField}
              altLeadLinkField={altLeadLinkField}
              clientStageById={clientStageById}
            />
          </div>
        </div>
      )}
    </div>
  );
}

initializeBlock({ interface: () => <AppointmentsApp /> });
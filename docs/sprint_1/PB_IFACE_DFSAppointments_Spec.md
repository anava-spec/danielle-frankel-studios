# Appointments Interface

Interface Specification — Ops Central · Danielle Frankel Studio · Singular Agency · May 2026 · v1.0

| Document Type | Interface Specification |
| :---- | :---- |
| **Interface Name** | Ops Central — Appointments |
| **Base** | Danielle Frankel DTC Customers (appUC2NFAlURayLx9) |
| **Primary Table** | DF Appointments - Acuity (tblvV7uKTCaFFekoR) |
| **Secondary Table** | DF Clients (tblLLUlDgJ4ktzF7c) |
| **Target Persona** | Reception, Sales Associates, GM of Sales |
| **Total Pages** | 1 (Appointments) |
| **Access Group** | Ops Central interface — internal staff |
| **Linked Story** | DFS-1 — Advance Client to Deliberating |
| **Author** | Singular Agency — Will Hernández / Axel Nava |
| **Version** | 1.0 |
| **Date** | May 2026 |

## 01 — Interface Purpose

The Appointments interface is the primary operational surface for Reception at Danielle Frankel Studio. It gives reception a chronological view of every appointment scheduled for a given day, enables client check-in, room clear, and order pick-up actions, and surfaces missing-data warnings before any Slack notification or client stage transition fires.

This interface directly implements the client stage transition defined in Story DFS-1: when reception clicks Clear on an eligible appointment, the linked client record advances from Pre-Appointment to Deliberating in real time. It is the operational front-end for that workflow.

## 02 — Pages Overview

| Page | Primary Table | Purpose | Primary Persona |
| :---- | :---- | :---- | :---- |
| Appointments | DF Appointments - Acuity (tblvV7uKTCaFFekoR) | Daily appointment list with date navigation, multi-select filters, per-row action buttons, and a slide-in client detail drawer. | Reception |

## 03 — Page Detail — Appointments

### 03.1 — Date Navigation

The date stepper sits in the top-left of the header bar. It provides two methods of date selection:

- Arrow navigation: ← and → buttons move one day at a time. Clicking advances selectedDate state and re-filters all records.
- Calendar popover: clicking the date label opens a mini-calendar. Users can navigate by month and select any day. Click-outside dismisses the popover.
- Today button: a "Today" button to the right of the right arrow resets selectedDate to the current date in one click. Always visible.

### 03.2 — Filter Bar

Three multi-select filter dropdowns sit in the top-right of the header bar. Each dropdown renders a custom panel (not a native `<select>`) with checkboxes for each option. Multiple values may be selected simultaneously.

| Filter | Source Field | Field ID | Default | Behavior |
| :---- | :---- | :---- | :---- | :---- |
| Sales Associate | sales_associate_name (multipleLookupValues) | fldAopgXS7Zw42ZgV | All | Derived from records loaded for the day. Filters rows by exact SA name match. |
| Studio | studio_name (multipleLookupValues) | fldelULQNcaGnAv5K | All | Derived from loaded records. Options: New York, Melrose, Virtual. |
| Category | Appointment_Category (formula) | fldZ45u0N2GzukwO4 | All | Static options: Sales, Alterations, Fulfillment. |

When one or more values are selected in a dropdown, a "Clear" text link appears to the right of the trigger button. Clicking "Clear" resets that filter to empty (All). Filters compose — all three active simultaneously narrow the row set.

### 03.3 — Table Columns

Rows are sorted ascending by Appointment_Time and filtered to the selected date. Columns, in order:

| Column | Source Field | Field ID | Notes |
| :---- | :---- | :---- | :---- |
| TIME | Appointment_Time (dateTime) | fldL7kYvgkmyhGniX | Always displayed in the America/New_York timezone. Format: 9:00am EDT. |
| CLIENT | Client (multipleRecordLinks → DF Clients) | fldcVVGhEsnYRsbyR | Displays linked record display name as plain text. Shows "Missing Data" red pill if no linked client. |
| TYPE | Appointment_Type (singleSelect) | fldky9XlBM97luBf1 | Rendered as a colored pill using appointment-type color mapping. Shows "Missing Data" red pill if blank. |
| ROOM | room_link (multipleRecordLinks) | fldKVUlPm7Gq3EUF9 | Plain text value from linked Room record. Shows "Missing Data" red pill if blank. |
| SALES ASSOCIATE | sales_associate_name (multipleLookupValues) | fldAopgXS7Zw42ZgV | Plain text. Shows "Missing Data" red pill if blank. |
| ALTERATION LEAD | alterations_lead (multipleRecordLinks) | fldErMecJ5hzy8n42 | Plain text. Shows "—" if blank. |
| FAVORITE STYLES | Favorite_Styles_from_Acuity (multipleLookupValues) | fldCPhdJ885D7ytOf | Comma-separated plain text. Shows "—" if blank. |
| SAMPLES NOT IN NY | Samples_Not_in_NY (multipleLookupValues) | fldfNygc1E6FTgNDN | Comma-separated plain text. Shows "—" if blank. |
| ACTIONS | Derived from Check_In, Cleared, Picked_Up, Appointment_Type, Appointment_Time, Appointment_End_Time | (see 03.4) | Conditional buttons and status pills. |

### 03.4 — Missing Data Indicators

Four columns surface a red "Missing Data" pill when their value is empty: Client, Type, Room, and Sales Associate. These are the four fields required for a valid check-in. The pill gives reception an at-a-glance signal of which field needs to be filled before the appointment can proceed.

The same missing-data logic drives the Action column: if any of the four required fields is empty, the "Missing Data" pill appears in the Actions cell regardless of the appointment time, so reception always knows an action is needed even for future appointments.

### 03.5 — Action Buttons

> ⚠ Slack notification is deferred. All three action buttons (Check In, Clear, Pick Up) currently write only the corresponding Airtable checkbox field to TRUE. The Slack message flows described in the Engagement Brief (Sections 3.1) are tracked as a separate story and are NOT implemented in this interface version.

The Actions column renders differently based on three appointment categories:

| Category | Appointment Types | Logic |
| :---- | :---- | :---- |
| Standard | Consultation, Alterations, Re-see, Measurements, Fit Assessment, Shipping, and all others without "& Pick Up" | Check In and Clear buttons only. No Pick Up. |
| Combined Pick Up | Fit Assessment & Pick Up, Final Fitting & Pick Up | Check In, Clear, and Pick Up all apply. Pick Up Pending pill shows until the room is cleared. |
| Pick Up Only | Pick Up (standalone type only) | Only the Pick Up button is shown. No Check In or Clear. |

**30-Minute Time Gate**

Buttons only become interactive within 30 minutes of the relevant time anchor. This prevents accidental early check-ins during high-volume days.

| Button | Gate Field | Field ID | Appears when… |
| :---- | :---- | :---- | :---- |
| Check In | Appointment_Time | fldL7kYvgkmyhGniX | Current time ≥ appointment start time − 30 minutes |
| Pick Up (Pick Up Only) | Appointment_Time | fldL7kYvgkmyhGniX | Current time ≥ appointment start time − 30 minutes |
| Clear | Appointment_End_Time | fldFwFIBNtC76v0Y7 | Current time ≥ appointment end time − 30 minutes |
| Pick Up (Combined) | Appointment_End_Time | fldFwFIBNtC76v0Y7 | Replaces Pick Up Pending pill only after Clear is clicked (no time gate of its own) |

The interface auto-refreshes every 30 seconds so buttons appear without requiring a manual page reload.

**Button Behavior Detail**

| Button | Writes to Field | Field ID | Table | Also triggers | Reversible? |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Check In | Check_In (checkbox → TRUE) | fldarspmpxD4OFpnX | DF Appointments - Acuity | Notification modal to confirm action. Slack: deferred. | No — permanently disabled after first click |
| Clear | Cleared (checkbox → TRUE) | fldE1Ke90UVdyUFL1 | DF Appointments - Acuity | Client.stage → Deliberating (if eligible). Notification modal. Slack: deferred. | No — permanently disabled after first click |
| Pick Up | Picked_Up (checkbox → TRUE) [combined only] | fldaT5YwVqB87h8Ia | DF Appointments - Acuity | Notification modal. Slack: deferred. | Yes — can be clicked multiple times |

> ⚠ Clear is the only button that writes to a second table. On click, it reads the linked client record, checks that the appointment is not Cancelled and the client's current stage is Pre-Appointment, then writes Client.stage = Deliberating. If any guard condition fails, the Cleared checkbox is still set on the appointment but the client stage is not changed. Errors surface as a red message in the Actions cell.

### 03.6 — Client Stage Transition (DFS-1)

The Clear button is the primary implementation of Story DFS-1. The full transition logic:

- Guard 1: Appointment_Status ≠ Cancelled — field STATUS (fldZTkJdTBhmcchTb) on DF Appointments.
- Guard 2: Client.stage = "Pre-Appointment" — field stage (fldLcxVZvI1rigBlh) on DF Clients.
- Write: Client.stage = "Deliberating" via updateRecordAsync on DF Clients (tblLLUlDgJ4ktzF7c).
- System fields stage_set_at and stage_set_by auto-update via Airtable lastModifiedTime / lastModifiedBy — not written directly.
- Idempotency: the alreadyCleared guard on the appointment record prevents a second write from re-triggering the stage transition.
- Error handling: if the linked client record cannot be resolved, a red error message surfaces in the row's action area. The Cleared checkbox is still set on the appointment.

| Scenario | Clear writes Cleared checkbox? | Client stage advances? |
| :---- | :---- | :---- |
| Client in Pre-Appointment, appointment not Cancelled | YES | YES — to Deliberating |
| Client in Pre-Appointment, appointment Cancelled | YES | NO — Cancelled guard fires |
| Client already in Deliberating or later | YES | NO — stage guard fires (no regression) |
| No linked client record on the appointment | YES | NO — silently skipped |
| Linked client record not found in loaded records | YES | NO — error surfaced to receptionist |
| Clear clicked a second time (already Cleared) | NO (early return) | NO |

### 03.7 — Notification Modal

All three buttons trigger a centered modal overlay after their action completes. The modal:

- Dims the entire interface with a semi-transparent overlay (pointer events disabled behind it).
- Displays a confirmation message with key values in bold (SA name, client name, room).
- Closes on clicking the "Close" button, pressing Escape, or clicking outside the modal card.

| Trigger | Modal Message |
| :---- | :---- |
| Check In | [SA Name] has been notified through Slack that [Client Name] is here and they will be in [Room]. |
| Clear | The team has been notified that [Room] has been cleared and is ready for the next appointment. |
| Pick Up | The team has been notified that [Client Name] is here for pick up. |

> ⚠ These modal messages describe intended future Slack behavior. In the current implementation, no Slack message is actually sent. The modal is informational only.

### 03.8 — Client Detail Drawer

Clicking any table row opens a slide-in drawer anchored to the right side of the interface (30vw width). A semi-transparent overlay dims the table behind it. The drawer slides in from the right with a CSS transition (200ms ease-out). Clicking the same row again or clicking the overlay or the X button closes it.

| Drawer Section | Fields Shown | Source |
| :---- | :---- | :---- |
| Type pill | Appointment_Type (xl size pill) | DF Appointments - Acuity (fldky9XlBM97luBf1) |
| Client identity | Initials avatar, display name, studio name | DF Clients: full_name (fldB3Wyam01D3wR5Q), studio_name from appointment record (fldelULQNcaGnAv5K) |
| Contact strip | Phone (tel: link), Email (mailto: link), Wedding date | DF Clients: CLIENT_PHONE (fldZrxF4bR6QBUwVK), CLIENT_EMAIL (fld5f3IVZoX0QZZ8R), CLIENT_WEDDING (fldbgknumKGS5W5WU) + CLIENT_WEDDING_IF_NOT_SET (fldqwfmMczvLhiqk1) |
| Appointment details | Time range (start–end), Room, Sales Associate, Alteration Lead | DF Appointments - Acuity — time computed from Appointment_Time + duration in type label |
| Favorite Styles | Comma-separated list | DF Appointments - Acuity (fldCPhdJ885D7ytOf) |
| Samples Not in NY | Comma-separated list | DF Appointments - Acuity (fldfNygc1E6FTgNDN) |
| Open Full Record | Button — calls expandRecord() to open the native Airtable record view | N/A — permission-gated by hasPermissionToExpandRecords() |

Wedding date display: if Wedding_Date__Formatted is set, it renders in "Month Dth, YYYY" format (e.g. "May 4th, 2026"). If not set, falls back to Wedding_Date__If_Not_Set with "(approx.)" suffix. Date parsing uses local YYYY-MM-DD construction to avoid UTC offset shifting the displayed day.

## 04 — Access & Permissions

| Persona | Interface Access | Can Check In? | Can Clear? | Can Pick Up? | Notes |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Reception | Full access to Appointments page | Yes | Yes | Yes | Primary user of all three action buttons |
| Sales Associate | Read access — view appointments for the day | Yes | Yes | Yes | May use interface to review their own appointments |
| GM of Sales | Full access | Yes | Yes | Yes | Oversight; also takes appointments directly |
| Production / Fulfillment | No access to this page | — | — | — | This interface is scoped to front-of-house operations |

Button availability is gated by `appointmentsTable.hasPermissionToUpdateRecords()` and `clientsTable.hasPermissionToUpdateRecords()`. If the user lacks write permission, buttons render at 50% opacity and are non-interactive (cursor-not-allowed).

## 05 — UX Design Decisions

| Decision | Rationale |
| :---- | :---- |
| Missing Data pills instead of blank cells | Four columns (Client, Type, Room, SA) show a red "Missing Data" pill when empty rather than a dash. This gives reception an at-a-glance signal across the full row before they need to take action. |
| 30-minute time gate on buttons | Buttons only appear within 30 minutes of the relevant time anchor. This is an enhancement beyond DFS-1 scope. The gate prevents accidental early check-ins during high-volume back-to-back days. |
| Missing Data pill always visible in Actions | The "Missing Data" pill in the Actions column is deliberately time-independent. Reception needs to know about data gaps regardless of how far out an appointment is. |
| Optimistic UI for Clear | The isClearingByRecord state map shows "Cleared" immediately on click, before the server confirms the write. This prevents reception from double-clicking. |
| Pick Up Pending pill (combined-pick-up) | Appointments that include a pick-up component show a yellow "Pick Up Pending" pill from the moment the row is rendered. |
| Drawer overlay instead of side-by-side layout | The client detail drawer floats above the table rather than pushing it aside, keeping the full table readable while the drawer is open. |
| New York timezone (America/New_York) hardcoded | All appointment times display in ET regardless of the browser's local timezone. DF operates from New York and Los Angeles; the schedule is always managed in ET. |
| Multi-select filters | All three filter dropdowns support multiple selection with checkboxes. A single receptionist may need to filter by two Sales Associates simultaneously (e.g. covering for someone). |

## 06 — Out of Scope

| Feature | Status | Notes |
| :---- | :---- | :---- |
| Slack notifications (Check In, Clear, Pick Up) | Deferred | Buttons write checkbox only. Slack posts will be implemented in a separate story per the Engagement Brief Section 3.1. |
| Sidebar pop-out for shipping/tax/alterations payment status | Deferred | Requires developer scripting support per the Engagement Brief. |
| Order Pickup Slack channel (TBD) | Deferred | Channel name not confirmed. |
| Room cleared Slack notification | Deferred | The clear button currently only advances the client stage. |
| Appointment Recap Generation | Deferred | Not part of DFS-1 scope. |
| SA round-up emails (4 cadences) | Separate story | Automation spec required. |
| Stage automations (EOD move-to-Deliberating) | Separate story | The DFS-1 story covers the manual Clear trigger only. |
| Did Not Convert, Post-Appointment, Calendar, Customizations, Sold, Alterations, Fulfillment tabs | Separate interface pages | Each tab is a separate interface spec. |

Danielle Frankel Studio · Singular Agency · Appointments Interface Spec · v1.0 · May 2026



| DFS Custom Interfaces Interface Specification — Post-Appointments & Pipeline Danielle Frankel Studio · Singular Agency · May 2026 |
| :---- |

| Document Type | Interface Specification |
| :---- | :---- |
| **Interfaces** | Post-Appointments, Pipeline |
| **Base** | Danielle Frankel Studio (appUC2NFAlURayLx9) |
| **Primary Tables** | DF Appointments \- Acuity (tblvV7uKTCaFFekoR), DF Clients (tblLLUlDgJ4ktzF7c) |
| **Target Personas** | Sales Associates, GM of Sales, Reception |
| **Author** | Singular Agency — Axel Nava |
| **Version** | v1.0 — QA Review |
| **Date** | May 2026 |

**00 — PURPOSE**

**Why This Document Exists**

| This spec covers two custom Interface Extensions built for the Danielle Frankel Studio Airtable base. Post-Appointments is the daily data-entry surface for Sales Associates after each consultation. Pipeline is the operational Kanban giving the GM of Sales and SAs a real-time view of every active client by stage. Both interfaces are built as Airtable Interface Extensions (React \+ TypeScript, using @airtable/blocks/interface/ui). They are separate entries in the Airtable interface builder and are deployed to Sandbox (app10POKRBDLqbcNo) first, then promoted to Production (appUC2NFAlURayLx9). |
| :---- |

**01 — INTERFACE A**

**Post-Appointments**

**Purpose**

The Post-Appointments interface gives Sales Associates a structured, day-scoped view of consultations. It surfaces every appointment scheduled for a selected date, lets the SA click into any row to open a detail modal, and provides inline editing for all post-consultation data: wedding date, measurements, favorite styles, customization requests, and appointment notes.

**Primary Audience**

* Sales Associates — primary users; fill in post-appointment data.

* GM of Sales — read-only review of completeness flags.

* Reception — Today's Appointments card strip at the top of the page.

**Data Sources**

| Table | Table ID | Role |
| :---- | :---- | :---- |
| DF Appointments \- Acuity | tblvV7uKTCaFFekoR | Appointments data, row-level source |
| DF Clients (tblLLUlDgJ4ktzF7c) | tblLLUlDgJ4ktzF7c | Client detail, all editable fields |
| DF Styles | tbl0hWIRBbcB4UkVC | Styles lookup for Favorite Styles multi-select |
| Customizations | (name-based lookup) | Linked customization records per client |

**Page Layout**

The interface has two visual zones rendered on a single page — a horizontal card strip at the top and a full date-scoped table below.

**Zone A — Today's Appointments (card strip)**

A horizontally scrollable strip of TodayCard components, one per appointment scheduled for today (based on APPT\_TIME date match). Cards are filtered by Status ≠ Cancelled and the active SA/Studio filter. Each card shows:

* Time — formatted in America/New\_York timezone

* Client name — from CLIENT\_LINK lookup

* Appointment type — short label (studio prefix and duration stripped)

* Measurements status pill — green "Done" / red "Missing" based on bust/waist/hips/measurement photos

* "Needs data" badge — shown only on Consultation types when measurements OR photos are missing

* Photos status pill — green "Done" / red "Missing" based on FITTING\_PHOTOS attachment count

Clicking a card opens the Post-Appointment modal for that appointment record.

**Zone B — Date-Scoped Table**

A full-width table with a date stepper (prev/next arrows \+ MiniCalendar \+ Today button) that filters appointments by selected date. Columns:

| Column | Source | Field ID | Notes |
| :---- | :---- | :---- | :---- |
| Time | DF Appointments \- Acuity | fldL7kYvgkmyhGniX | EDT/EST formatted |
| Client | DF Appointments \- Acuity | fldcVVGhEsnYRsbyR | Name \+ email below |
| Studio | DF Appointments \- Acuity | fldelULQNcaGnAv5K |  |
| Wedding Date | DF Clients | fldbgknumKGS5W5WU | "Needs confirmation" badge if not confirmed |
| Sales Associate | DF Appointments \- Acuity | fldAopgXS7Zw42ZgV |  |
| Favorite Styles | DF Clients | fldVw8wCgPKvxN1jD | Pills, max 2 shown \+ count |
| Measurements | DF Appointments \- Acuity | fldbXhNAVDZq9fl2u | Complete / Missing pill |
| Photos | DF Appointments \- Acuity | fldBEBwDmZd29rjkK | Uploaded / Missing pill |
| Follow-Up | DF Appointments \- Acuity | fldX0ymLcTeOMpBw7 | Sent / Pending pill |
| Customization | DF Appointments \- Acuity | fldACtVEk2jHSpTDC | Pills, max 2 \+ count |

**Filters (top-right of page)**

* Client search — free-text, matches against CLIENT\_LINK display name. Dropdown shows up to 10 matches with appointment date/time. X icon clears.

* Studio — multi-select FilterDropdown, derived from STUDIO\_NAME values across all records.

* Sales Associate — multi-select FilterDropdown, derived from SA\_NAME values.

**Post-Appointment Modal**

Clicking any row or TodayCard opens a centered modal (max-w 680px, max-h 90vh, scrollable body). All edits auto-save via a module-level write queue (queueWrite) that serializes every updateRecordAsync call to prevent concurrent-write 422 conflicts.

| Section | Fields | Table | Save Trigger |
| :---- | :---- | :---- | :---- |
| Favorite Styles | CLIENT\_FAV\_STYLES\_IN\_APPT (fldVw8wCgPKvxN1jD) — linked records to DF Styles | DF Clients | On toggle |
| Wedding Date | CLIENT\_WEDDING (fldbgknumKGS5W5WU) — dateCLIENT\_WEDDING\_CONFIRMED (fldOZTDVcR1qwU6U2) — checkbox | DF Clients | On blur / calendar select / checkbox change |
| Measurements | Bust flddiCV13D0ym7Yirh, Waist fldShyIHilro7fYol, Hips fldx7dNHA3SZYC11C, Height fldTAlnT0Wk3LKPsb (all number) | DF Clients | On blur per field |
| Measurement Photos | CLIENT\_MEASUREMENTS (fldcWwbKOc9nkgzzV) — attachment | DF Clients | Via AttachmentSection (opens form) |
| Appointment Photo | CLIENT\_APPT\_PHOTO (fldWti8XzHbnGcjz9) — attachment | DF Clients | Via AttachmentSection (opens form) |
| Customizations | Linked Customizations records via fldlbAPEaoTwfFPTv | DF Clients | Add via mini-modal / edit on pill click |
| Notes | CLIENT\_APPT\_NOTES (fldwHp8zC3GykAuO1) — long text | DF Clients | On blur |

**AttachmentSection behavior**

Attachment fields cannot be written directly from Airtable Interface Extensions. The AttachmentSection component shows existing thumbnails (read from the linked client record) and renders an "Add \[type\]" button that opens a dedicated Airtable form in a new tab, pre-filled with the client record ID and attachment type. An automation on the Attachments table copies the upload to the correct client field on submission.

**Customization Mini-Modal**

Two modes — add (new record) and edit (existing record). Edit mode auto-saves each field change immediately through queueWrite. Add mode uses an explicit Save button.

| Field | Field ID | Type |
| :---- | :---- | :---- |
| Customized Style | fldCaKP1d4C0aohQE | Linked record → DF Styles |
| Embroidery Amount | fldfryrwA8fipol7v | Single select (Light / Medium / Full) |
| Notes | fldg1hEoZe9MFQj02 | Long text |
| Made to Measure | fldonK9Rd5lOXeH8F | Checkbox |
| Alterations | fldM72sjV0aAwbX2D | Checkbox |
| Rush | fldt92ponsfyKqDS1 | Checkbox |
| Client link | fldOeL4VVcXaKwwlN | Linked record → DF Clients |

**Write Queue**

| All writes to Airtable go through a module-level queueWrite() function. This prevents concurrent updateRecordAsync calls from colliding on the same record (HTTP 422 "conflicted with another change"). Every auto-save — measurement blur, wedding date, style toggle, customization edit, attachment write — is serialized through this queue. If a write fails, the error propagates to the caller (logged to console) but the queue moves forward so subsequent writes are not blocked. |
| :---- |

**Status & Flag Logic**

| Pill | Green condition | Red condition |
| :---- | :---- | :---- |
| Measurements | fldbXhNAVDZq9fl2u is non-zero / non-empty | Field is null, 0, empty string, or starts with "0 " |
| Photos | fldBEBwDmZd29rjkK is non-zero / non-empty | Same emptiness rule |
| Follow-Up | fldX0ymLcTeOMpBw7 \= true | Field is false or null |
| Needs data | — | Consultation type AND (no measurements AND no photos) |
| Wedding — Needs confirmation | — | wedding\_date\_confirmed is false and a date is present |

**02 — INTERFACE B**

**Pipeline**

**Purpose**

The Pipeline interface gives the GM of Sales and Sales Associates a Kanban board of every active client bucketed by lifecycle stage. It is a read-heavy, client-centric view — the Appointments table is never loaded. All appointment-derived information (next/last appointment dates, alterations lead, room) is surfaced through lookup and rollup fields on the DF Clients table.

**Primary Audience**

* GM of Sales — capacity and stage monitoring, SA-level filtering.

* Sales Associates — personal pipeline, client follow-up tracking.

**Data Source**

| Table | Table ID | Notes |
| :---- | :---- | :---- |
| DF Clients | tblLLUlDgJ4ktzF7c | Only table loaded. All appointment-derived fields are lookups/rollups on this table. |

**Kanban Columns (Stage Order)**

| Stage (field value) | Column label | Notes |
| :---- | :---- | :---- |
| Pre-Appointment | PRE-APPOINTMENT | Booked, not yet seen |
| Deliberating | DELIBERATING | Had consultation, no order attached |
| Sold | SOLD | At least one Shopify order attached |
| In Production | ORDER READY | Displayed as "Order Ready" in the UI |
| In Alterations | ALTERATIONS |  |
| In Fulfillment | FULFILLMENT |  |

Column count badges use formatStageCount: counts \> 100 are floored to the nearest 100 with a "+" suffix (e.g. 938 → "900+", 1213 → "1200+"). Column scrollbars are hidden; scrolling remains functional.

**Fields Read per Client Record**

| Field Name | Field ID | Type | Used in |
| :---- | :---- | :---- | :---- |
| full\_name | fldB3Wyam01D3wR5Q | Formula | Card, modals, search |
| first\_name | fldFWlAODUcuroeXK | Text | Initials |
| last\_name | fldQzSPiUvOid1nXo | Text | Initials |
| stage | fldLcxVZvI1rigBlh | Single select | Kanban column routing, stage pill |
| email | fld5f3IVZoX0QZZ8R | Email | Search, modals |
| phone | fldZrxF4bR6QBUwVK | Phone | Card, modals |
| wedding\_date | fldbgknumKGS5W5WU | Date | Timeline bucket, sort, wedding display |
| wedding\_date\_if\_not\_set | fldqwfmMczvLhiqk1 | Text | Fallback wedding display |
| wedding\_location | fldikRqj41XYiIDBk | Text | Full Profile modal |
| studio (formula) | fldNQuys5CFap0drj | Formula | Studio filter, card, modals |
| studio\_short\_name | fld1AWRrVteCUmVto | Text/formula | Pre-Appointment card line |
| sales\_associate\_name (lookup) | fldH8lJJHPUjPnyHZ | Lookup | SA filter, card, modals |
| sales\_associate\_phone (lookup) | fldl5vP5mpQrHsTsm | Lookup | Full Profile modal |
| sales\_associate\_email (lookup) | fldiGcxcshWvxTKKf | Lookup | Full Profile modal |
| appointment\_count | fldrnDWDgDx5IF5gz | Rollup/count | Full Profile — Appointment Details |
| appointment\_photos | fldWti8XzHbnGcjz9 | Attachment | flagNoPhotos check |
| measurements (attachment) | fldcWwbKOc9nkgzzV | Attachment | flagNoMeasurements (combined with numerics) |
| meas\_bust | fldiCV13D0ym7Yirh | Number | flagNoMeasurements |
| meas\_waist | fldShyIHilro7fYol | Number | flagNoMeasurements |
| meas\_hips | fldx7dNHA3SZYC11C | Number | flagNoMeasurements |
| meas\_height | fldTAlnT0Wk3LKPsb | Number | flagNoMeasurements |
| follow\_up\_sent | fldmjiS7lHEn9qZHN | Checkbox | flagFollowUp |
| items\_sold | fldEStULoGtNIjxPO | Linked/rollup | Sold & Fulfillment cards |
| fav\_styles\_in\_appt | fldVw8wCgPKvxN1jD | Linked records | Deliberating & Alterations cards |
| total\_spend | fldasxslBOCb7GXnd | Currency/rollup | Sold card |
| ship | fldQjLmwDokAkYPEt | Checkbox | Order Ready card |
| pick\_up | fldwqYAsQ3Iasi8QT | Checkbox | Order Ready card |
| order\_ready | fldCAak4Hy5RmvXWT | Checkbox | Order Ready card |
| contacted\_for\_alterations | fldmiD8TdERvJJT0j | Checkbox | Order Ready card |
| interest\_custom | fldTrFh5dMYvkl0F4 | Checkbox | Full Profile — Interest |
| interest\_alts | fldibh40zShnDmLfj | Checkbox | Full Profile — Interest |
| interest\_m2m | fld3YweLOIcpr7xvL | Checkbox | Full Profile — Interest |
| fulfillment\_method | fldjwCFnGqOToCRnN | Single select | Fulfillment card label |
| appt\_notes | fldwHp8zC3GykAuO1 | Long text | Full Profile — Notes |
| next\_appointment (lookup) | fldTe2cyBmicx9Ple | Lookup → Appt\_Time | Cards (Pre-Appointment, In Alterations), modal |
| last\_appointment (lookup) | fldd01OccObkG9sGe | Lookup → Appt\_Time | Cards (Deliberating, Sold), modal |
| next\_appt\_alt\_lead (lookup) | flddN7YHMuymJKbv9 | Lookup → alt lead | In Alterations card |
| next\_appt\_room (lookup) | fldfQUSkQRooZi8sr | Lookup → Room | Full Profile — Appointment Details |

| ⚠  next\_appointment and last\_appointment require Airtable-side setup: (1) Two rollups on DF Clients — next\_appt\_time (MIN of future Appointment\_Time) and last\_appt\_time (MAX of past Appointment\_Time). (2) Two lookup helpers on DF Appointments — client\_next\_appt\_time and client\_last\_appt\_time. (3) A next\_or\_last formula on DF Appointments comparing each appointment's time to the client's min/max. (4) The four lookup fields on DF Clients filtered by next\_or\_last \= "next" or "last". The interface uses extractFirstLookupString \+ parseDateFlexible to unwrap the SDK's wrapped-object format and parse DD/MM/YYYY date strings from the base locale. |
| :---- |

**Filters**

| Filter | Type | Behavior |
| :---- | :---- | :---- |
| Search | Text input with X-clear | Debounced 150ms. Matches against full\_name, phone digits, email. Live-filters across all stages. |
| Studio | MultiSelectDropdown | Derived from studio (formula) values. Multi-pick. Clear link resets. |
| Salesperson | MultiSelectDropdown | Derived from sales\_associate\_name values. Multi-pick. Clear link resets. |
| Timeline | MultiSelectDropdown | Buckets: Past / Next 3 months / 3–6 months / 6–12 months / 12+ months / Date not set. Default: "Next 3 months". Multi-pick. |

Timeline bucket logic

* wedding\_date is parsed with parseDateFlexible (handles ISO and DD/MM/YYYY).

* Diff from today (midnight): \< 0 → Past; ≤ 90 days → Next 3 months; ≤ 180 → 3–6 months; ≤ 365 → 6–12 months; \> 365 → 12+ months.

* No wedding\_date and no wedding\_date\_if\_not\_set → "Date not set".

**Per-Stage Card Content**

| Stage | Card lines (below name, wedding date, phone) |
| :---- | :---- |
| Pre-Appointment | Next appointment date (CalendarIcon) · Studio short name · Sales Associate name |
| Deliberating | Last appointment date (CalendarIcon) · Favorite styles (truncated) · Sales Associate name |
| Sold | Last appointment date (CalendarIcon) · Items sold (truncated) · Total spend (CurrencyDollarIcon) · Sales Associate name |
| In Production | "Ready: N" count (PackageIcon) · Fulfillment routing label (Alterations / Pick Up / Ship) · "Not notified" if not contacted |
| In Alterations | Alterations lead name (ScissorsIcon) · Favorite styles or items sold (truncated) · Next appointment date · Sales Associate name |
| In Fulfillment | Fulfillment label (PackageIcon) · Items sold (truncated) |

All cards show a red flag pill ("{N} flag(s)") at the bottom when flagCount \> 0\.

**Flag Computations**

| Flag | Condition | Label shown in modals |
| :---- | :---- | :---- |
| flagFollowUp | follow\_up\_sent \= false or null | "Follow-up not sent" |
| flagNoMeasurements | meas\_bust, waist, hips, height all null AND measurements attachment array is empty | "No measurements" |
| flagNoPhotos | appointment\_photos attachment array is empty | "No appt photos" |

**Summary Profile Modal (card click)**

Opens on card click. Centered, max-w 500px, blurred backdrop. Shows: initials avatar · client name · stage pill \+ studio inline · flag pills (individual, red, below identity) · phone, email, wedding date, sales associate, wedding location · Next Appointment date · "View Full Profile" button.

**Full Profile Modal ("View Full Profile" button)**

Full-screen overlay (z-60, bg-gray-50). Contains five cards in a scrollable max-w-1200px container:

* Identity card: initials avatar, name, stage pill \+ studio, flag pills adjacent, Wedding Date / SA / Email / Phone grid.

* Stage in Pipeline: Vercel-style horizontal stepper. Past stages → solid emerald circle with bold checkmark. Current stage → white-fill emerald-bordered circle with inner dot. Future stages → gray-bordered empty circle. Connector lines in emerald (past) or gray (future).

* Appointment Details: Next Appointment / Last Appointment / Room / Total Appointments, then Measurements / Appointment Photos / Follow-Up status pills (red \= problem, emerald \= OK).

* Interest flags: Interest in Custom / Alts / M2M, each Yes/No.

* Post-Appointment Notes: free text.

"Go back" button (top-left) closes the full profile and returns to the Summary modal.

**Date Parsing — parseDateFlexible**

| The DF Studio base stores dates in DD/MM/YYYY format (e.g. "14/4/2026 9:30am"). JavaScript's native Date() treats this as MM/DD/YYYY, producing wrong dates or Invalid Date. parseDateFlexible() resolves this: 1\. Tries ISO format first (2026-11-02 or similar) — unambiguous. 2\. Matches DD/MM/YYYY with optional time using a regex. When both numbers ≤ 12 (e.g. "2/11"), defaults to DD/MM (Day-first), matching the base locale. 3\. Falls back to native Date() for any other format. extractFirstLookupString() prefers getCellValueAsString() — which returns the display string ("14/4/2026 9:30am") rather than the wrapped SDK object — before falling back to getCellValue() unwrapping. |
| :---- |

**03 — ACCESS & PERMISSIONS**

**Access & Permissions**

| Interface | Personas with access | Write permissions |
| :---- | :---- | :---- |
| Post-Appointments | Sales Associates, GM of Sales, Reception | SAs write all editable fields. The interface checks hasPermissionToUpdateRecords() before every write. |
| Pipeline | Sales Associates, GM of Sales | Read-only in the current implementation. No writes originate from Pipeline. |

| ⚠  Confirm with Julia: should the default view in Post-Appointments be filtered to the logged-in SA's records (i.e., show only their appointments)? This would require Airtable's user field matching, which adds complexity. Currently the interface shows all appointments for the selected date. |
| :---- |

**04 — UX DESIGN DECISIONS**

**UX Design Decisions**

| Decision | Rationale |
| :---- | :---- |
| Write queue serialization | Airtable returns HTTP 422 "conflicted with another change" when two writes to the same record overlap. All writes go through queueWrite() to prevent this. |
| Appointments table not loaded in Pipeline | Loading both clients (\~4000+) and appointments (\~4000+) records caused noticeable slowness. Appointment-derived data is now surfaced through lookups on the Clients table, reducing useRecords calls to one. |
| Attachment uploads via form (not direct SDK write) | Airtable Interface Extensions cannot write data: URLs or blob URLs — the SDK's servers try to fetch the URL remotely and reject non-public URLs. The workaround is an Airtable form that writes directly to the base, with an automation copying the attachment to the correct field. |
| TodayCard strip separate from date-scoped table | Reception needs instant access to today's check-ins without having to navigate dates. The card strip always shows today regardless of the date the table is browsing. |
| Timeline default filter "Next 3 months" in Pipeline | The full client list (including past clients) made the initial render visually overwhelming and slow. Defaulting to the near-term bucket surfaces the operationally relevant clients first. |
| parseDateFlexible DD/MM-first | The base locale displays dates as Day/Month/Year. Without an explicit parser, JavaScript's Date() misreads "2/11/2026" as February 11 instead of November 2\. |

**05 — OUT OF SCOPE**

**Out of Scope**

| Item | Notes |
| :---- | :---- |
| Check In / Clear / Pick Up action buttons | These live in the separate Appointments/Reception interface (Document 5, in-progress). Not part of Post-Appointments or Pipeline. |
| Slack notifications | Fired by Airtable automations, not by these interfaces. |
| Calendar interface | Potentially merged with Appointments/Reception interface. TBD with Julia. |
| Pipeline write actions | Moving a client between stages from the Pipeline board is not implemented. Stage transitions are automation-driven. |
| Attachment direct upload | Direct SDK attachment upload is not supported. Form-based workaround is in place. |
| Per-SA default filtering (Post-Appointments) | Requires user field matching. Not implemented in v1. Confirm scope with Julia. |
Danielle Frankel Studio · Singular Agency · DFS Custom Interfaces Spec · v1.0 · May 2026
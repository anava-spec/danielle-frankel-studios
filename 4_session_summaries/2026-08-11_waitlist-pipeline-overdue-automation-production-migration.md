# Session Transcript — DFS-Brain — Waitlist in Pipeline, Overdue Automation, Production Migration
**Date:** 2026-08-11
**Repo:** `C:\Users\axel_\Documents\Work\Singular\Projects\DFS-Brain`
**Branch:** `main` (all work pushed directly, per standing preference — no feature branches)
**Bases:** `appMmEE4zyHMGhkkd` (sandbox) / `appUC2NFAlURayLx9` (production) — **discovered this session to be Airtable's actual "Base Sandbox" pairing**: identical table/field/automation IDs in both, record data kept separate per environment. Automations are literally shared objects between the two — creating/editing one via either base ID edits the same automation.

---

## Context

Continuation of prior session's Waitlist feature work (see `dfs-brain-session-transcript-2026-08-10.md`). At the start of this session: Waitlist table existed in sandbox with `resolution_status`, `earliest_date_requested` (already converted to a formula fed by an AI field `date_requested_parser`, done by the user between sessions), and two backend automations (`Waitlist - Match New DF Client`, `Waitlist - Alert Julia: Unresolved Within 5 Days`) already live. No UI existed for staff to see or manage Waitlist leads.

---

## What happened this session

### 1. Built Waitlist into the Pipeline custom interface (`pipeline.tsx`)
File: `danielle-frankel-studios/interfaces/danielle_frankel_studios/code/daily_ops/pipeline.tsx`

- Added Waitlist as a second table (custom property `waitlistTable`, alongside existing `clientsTable`), independent of `STAGE_ORDER`.
- **Kanban board**: new leftmost pseudo-column showing Active + unmatched Waitlist entries (`WaitlistCard`), sorted oldest `earliest_date_requested` first, blanks last. Clicking opens a new `WaitlistDetailModal` (not `FullProfileModal`).
- **List View**: Waitlist rows in a separate `<tbody>`, only Client/Stage/Wedding Date/Studio populated; `'Waitlist'` added to the Stage filter options.
- **FullProfileModal**: read-only "Waitlist" section for clients matched out of the Waitlist, shown only in "All Stages" view, positioned before Pre-Appointment.
- **`+ Waitlist` toolbar button** (same size as the layout-toggle dropdown, solid accent color) opens `WaitlistFormModal` (create).
- **`WaitlistFormModal`** (create): rows — (Bride Name, Studio) / (Dates Requested, Time Requested) / (Email, Phone, Wedding Date) / Notes. Only Bride Name + Studio + Dates Requested + Time Requested required. `earliest_date_requested` deliberately absent (formula field, AI-derived). No Cancel button (backdrop/Escape only). Title: "Add Client to Waitlist", no description.
- **`WaitlistDetailModal`** (view/edit existing Active entry): rebuilt as a **full-page slide-in view** (same shell as `FullProfileModal` — sticky header, "Go back", no close button) instead of a centered dialog, for visual consistency. Same field order as the form, with read-only `Earliest Date Requested` appended to end of row 2.
- **Studio field**: converted from a hardcoded `NY/LA/Virtual` text field to a genuine **linked record** pointing at the master Studio table (`tblYM02GzeYdYk23v`), filtered to `is_active = true` in the UI (new `LinkedRecordSelectBody` / `LinkedRecordSelect` / `EditableLinkedRecordSelect` components, fed by a new `activeStudioOptions` fetch in the main component).
- Iterative branding/layout fixes: stage color `#BFAEFC`, solid (not dashed) card border, equal-width form rows, field-title font size bumped one tier (`text-xs` → `text-sm`), removed an overflowing calendar-icon button from the Wedding Date field.

**Bugs found and fixed along the way:**
- `useRecords(studioTable, ...)` crashed (`Cannot read properties of null`) when the Studio table was accessed via `base.getTableByIdIfExists` directly — fixed by exposing it as a `getCustomProperties` table picker instead (matching the pattern that already worked for `waitlistTable`), then reverted back to direct access once the user manually declared the table's data connection in Airtable's interface builder (the real fix was on the Airtable-config side, not code).
- `resolution_status: 'Active'` (bare string) failed on create — Interface Extension `createRecordAsync` requires singleSelect writes as `{ name: 'Active' }`, unlike the MCP/REST API which tolerates bare strings via typecast. Fixed.

### 2. Waitlist Follow-Up (native, no-code Airtable page) — supporting schema/automations
The native page itself is being built by the user directly in Airtable, filtered to: `resolution_status = Active` AND `earliest_date_requested` on/before today (sorted oldest first). Claude's role was schema + automation support:

- Discussed and simplified the "exception" concept: originally planned as a separate `is_exception` checkbox field, but **replaced with a third choice ("Exception") on the existing `resolution_status` select field** — one field now drives Pipeline exclusion, both alert automations, and the Follow-Up page filter. `is_exception` field created then immediately marked deprecated (Airtable API has no `delete_field`; renamed to `is_exception (deprecated - delete me)` for manual cleanup).
- Decided **not** to build a separate "auto-resolve on manual match" automation (would set `resolved_at` when Julia links a client by hand) — user explicitly didn't want another automation for one timestamp field. Julia fills `resolved_at` herself in the same edit where she sets `resolution_status`/links the client. The automatic matching script (`waitlist_matching.js`) still stamps it for its own auto-matches.
- New automation: **`Waitlist - Notify Julia: Overdue & Unmatched`** (script + native Send Email, same pattern as the existing 5-day alert). New file: `danielle-frankel-studios/automations/danielle_frankel_studios/waitlist_overdue_alert.js`.
  - Trigger: `recordMatchesConditions` on Waitlist — Active, unmatched, `earliest_date_requested` not empty (script itself narrows to "today or past" + "not yet notified").
  - New field `overdue_notified` (checkbox) as the anti-spam guard — fires once per record (not on a rolling window, since the Follow-Up page is meant to be worked as a backlog).
  - **`customScript` nodes turned out to be fully read-only via the Airtable MCP toolkit — can't be created OR edited through the API**, only pasted manually in the Airtable UI. This automation was created via API as a trigger-only shell with a placeholder `findRecords` node; the user manually added the real Run Script / Conditional Logic / Send Email steps.
  - Later iteration: added a link to the record's Waitlist Follow-Up detail page in the email body. New `is_prod` script input picks between `CONFIG.DETAIL_PAGE_URL_SANDBOX` / `_PROD` (both bases share this one automation object, so the URL can't be inferred from the base ID at runtime). Bug found + fixed: `cfg.is_prod === true` silently stayed `false` because Airtable's input mapper sent the string `"true"` rather than a boolean — made the check tolerant of both.
  - `waitlist_alert_readiness.js` (the 5-day alert) was briefly given an `is_exception` guard clause, then **reverted** once `is_exception` was superseded by the `resolution_status` third choice — its existing `resolutionStatus !== 'Active'` check already covers "Exception" for free.

### 3. Discovered sandbox/production are a real Airtable "Base Sandbox" pair
While investigating why `useRecords` crashed and separately while preparing to migrate data, found that `appMmEE4zyHMGhkkd` and `appUC2NFAlURayLx9` share **identical table IDs, field IDs, and automation IDs** — confirmed by cross-querying both and by `list_automations` returning the exact same automations (including ones built this session) from both base IDs. This is Airtable's actual Base Sandbox product feature: schema and automations are shared; record data is not.

**Safety implication surfaced and handled:** before bulk-creating Waitlist records in "production," turned off both `Waitlist - Alert Julia: Unresolved Within 5 Days` and `Waitlist - Notify Julia: Overdue & Unmatched` (both were live) to avoid a mass-email blast, since many of the 95 records have historical (already-past) dates. Confirmed both were `undeployed` before proceeding. (Note: `recordEntersView`/`recordMatchesConditions` triggers only fire for records newly entering the matching set after the automation is turned on — existing matching records at activation time do *not* retroactively trigger — so reactivating later should be safe for this backlog.)

### 4. Migrated 95 Waitlist records from sandbox to production
- Confirmed production's `Waitlist` table was empty (0 records) with schema already identical to sandbox (including the AI field / formula conversion).
- Confirmed the master Studio table's record IDs are shared between environments (`recJelf2i9V3AuajH` = "New York Studio" in both) — no ID remapping needed for the `studio` link field.
- Excluded the one leftover dummy/test record (`recFRQNi2YAvyeWUR`, "Rachell Alvarado").
- Created all 95 real records in production, all `resolution_status = Active`, **not** carrying over sandbox's `resolved_by_df_clients_record` links (those pointed at sandbox-only DF Client test data) — user chose a clean reset over risking wrong links.

### 5. Backfilled DF Client matches in production
Since the `Match New DF Client` automation only fires on new DF Client creation (not retroactively), did a one-time manual backfill against production's ~7,797 existing DF Clients:
- Queried DF Clients by last-name `contains` (two batched OR-filter calls covering all 95 bride surnames) rather than pulling the full table (which exceeded response/file-size limits — the scratchpad disk was also completely full on this environment, unrelated to the session).
- Cross-referenced candidates by name + phone/email.
- **47 confident matches** applied: `resolved_by_df_clients_record` linked, `resolution_status = Resolved`, `resolved_at` stamped.
- **6 flagged as ambiguous**, left for the user to decide (not yet resolved as of end of session):
  1. Malloy McGreevy — name exact, phone differs
  2. Rachel Auld — name exact, phone differs in last 4 digits
  3. Annika Squires — name exact, phone differs
  4. Danielle Kestenbaum — Waitlist phone is 9 digits (already flagged incomplete in original import); matches DF Client's phone if one trailing digit were added
  5. Taylor Karidi + Taylor Caridi (alts client) — two separate Waitlist records, same phone, both plausibly the same DF Client (`Taylor Caridi`) with one name misspelled
  6. Beth Chapman (stylist) / Sarah Duffy — Waitlist bride_name is the referring stylist's name, not the actual bride; matches DF Client "Sarah Duffy" by email
- **1 additional borderline**, mentioned but not added to the flagged list: "Mirielle Williams" (Waitlist) vs. "Marielle Williams" (DF Client) — near-identical spelling, not exact.
- **41 records** had no plausible DF Client match found at all (genuinely new/unconverted leads, or names too different from any existing client to guess).

---

## Open items for next session

1. **Decide the 6 flagged ambiguous matches** (see list above) — link, skip, or investigate further.
2. **Delete deprecated fields manually** in Airtable UI (API has no `delete_field`): `studio (deprecated - delete me)` (old singleSelect, superseded by the linked-record version) and `is_exception (deprecated - delete me)` (superseded by the `resolution_status` "Exception" choice) — both on the Waitlist table.
3. **Finish building the native "Waitlist Follow-Up" page** — schema/filters/automation support are ready; the page itself is being built directly by the user in Airtable.
4. **Pipeline code follow-up** (mentioned earlier in the session, not yet done): exclude `resolution_status = Exception` records from the Waitlist Kanban column / List rows in `pipeline.tsx` (currently only filters on Active + unmatched, doesn't yet know about the Exception state).
5. **Mirror the finished Pipeline UI changes to production's interface** if not already auto-shared (interfaces are a separate concept from base schema/automations — confirm whether Pipeline's TSX needs a separate paste into production's copy of the interface, the way `customScript` automation nodes do).
6. Consider whether the 41 truly-unmatched Waitlist records need any staff follow-up (they're brides who never converted, or whose DF Client record doesn't exist under a matching name).

## Key IDs for quick reference

- Bases: sandbox `appMmEE4zyHMGhkkd` / production `appUC2NFAlURayLx9` (shared schema/automations, separate data)
- Waitlist table: `tblbm3hKDShEPNpoq` — key fields: `bride_name` fldI90ApFwjte8HBv, `dates_requested` fldDjo0WRAKvHdgR4, `time_requested` fldLuKMVvuzadx630, `earliest_date_requested` fld5s87GbT2G3C60e (formula, fed by AI field `date_requested_parser` fldzLakqPl4JDX7RC), `resolution_status` fldiEQbjks80y5xTi (Active `sel0phpRDgWbTZvTk` / Resolved `sela1kriIdxE3WCg1` / Exception `seltrJBAARGGqxHT4`), `resolved_at` fldi1u7Otn5dX5web, `resolved_by_df_clients_record` fldXI88jaK0MepaLn, `email` fld2cI0r58UEiinvC, `phone` fldrMkTOA2Y6DT8mC, `notes` fldsn4PKhpwnOx5gu, `last_alert_sent` flddV0or0cD3UHHbR, `studio` fldUrBNGSh5zRBe0i (linked record → Studio table), `overdue_notified` fldzl6UCfITyAGeRg
- Studio master table: `tblYM02GzeYdYk23v` — `name` fldA1F8Hx7cOyI6lu, `is_active` fldFyn3fKsxajrvsy. Known active studios: New York Studio (`recJelf2i9V3AuajH`), Melrose Studio (`recrYSmMqV0Fy9F8G`), Virtual (`recPOyXH94m1jb5XI`), Tribeca (`rec47nPX6NUO3qoO4`)
- DF Clients table: `tblLLUlDgJ4ktzF7c` (~7,797 records in production) — `first_name` fldFWlAODUcuroeXK, `last_name` fldQzSPiUvOid1nXo, `email` fld5f3IVZoX0QZZ8R, `phone` fldZrxF4bR6QBUwVK
- Automations: `Waitlist - Match New DF Client` (`wflPC6fOUORtGMzUT`, deployed), `Waitlist - Alert Julia: Unresolved Within 5 Days` (`wflYo3IaYJFq1Rn12`, **currently undeployed — was turned off before the migration**), `Waitlist - Notify Julia: Overdue & Unmatched` (`wflpbJ5gcsx8rV7Qx`, **currently undeployed — was turned off before the migration**)
- Scripts in repo: `danielle-frankel-studios/automations/danielle_frankel_studios/waitlist_matching.js`, `waitlist_alert_readiness.js`, `waitlist_overdue_alert.js` (new this session)
- Pipeline interface: `danielle-frankel-studios/interfaces/danielle_frankel_studios/code/daily_ops/pipeline.tsx`

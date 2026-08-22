# Alterations

Group: Daily Ops · File: `alterations.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give staff a single, simple list of clients currently in alterations — who's assigned as their alteration lead, when their fittings are, and whether they've paid for alterations yet — so it's usable at a glance instead of the old full pipeline-kanban clone this file used to be.

## Inputs

- Client records from `DF Clients` (`tblLLUlDgJ4ktzF7c`).
- Fields: `Full Name`, `Stage`, `Item Sold` (lookup), `most_recent_alterations_lead` (lookup of linked record names), `first_alterations_appointment` / `next_alterations_appointment` (lookups resolving to dateTime), `Wedding Date (Formatted)` (filters only), `wedding_date_display` (column display only — see Rules).
- Stakeholder: Julia Collins — "Can we just remove the top bar thing... it just can be a list. It's too confusing" (this file was a full duplicate of `pipeline.tsx`'s kanban board before this rebuild).

## Outputs

Read-only list — no write-backs. Every column (Item Sold, Alteration Lead, First/Next Alts Appointment, Wedding Date, Payment Status) is derived display, nothing here edits Airtable.

## Workflow

1. A client qualifies for this list if **any** of the following is true (OR, not AND): `Stage = "In Alterations"`, they have a first or next alterations appointment on file, or "Alterations" appears in their `Item Sold`.
2. A hidden, always-on filter excludes clients whose wedding date is already in the past (blank wedding dates are **not** excluded — most alterations clients don't have this field filled in yet, and those rows show a red "Missing Date" pill instead). An info icon at the right of the filter bar explains this on hover.
3. Visible filters: client search (non-narrowing typeahead — selecting a result narrows to that one client), a Wedding Date calendar filter (exact-date match), and a Payment Status filter (Paid/Unpaid).
4. Payment Status is derived, not a real Airtable field: "Paid" means `Item Sold` contains "Alterations"; "Unpaid" means it doesn't (client needs to pay before their alterations appointment). Same logic drives the column's `StatusPill` (green/red) and the filter.
5. Sort order: Next Alts Appointment ascending (blanks last), then Client name A→Z.
6. Client names render with a `capitalize` CSS class since some `Full Name` values are stored lowercase in Airtable — display-only, doesn't touch the underlying data.

## Rules

- Dark mode uses the canonical pattern (`fulfillment.tsx`'s approach): `useColorScheme()` toggles a `dark` class on `document.documentElement`, styling is plain Tailwind `dark:` classes — no bespoke token object.
- `first_alterations_appointment` / `next_alterations_appointment` are read via the raw cell value (first array element), not `getCellValueAsString` — the latter renders using the field's configured display format and can silently swap day/month for ambiguous dates depending on the viewer's locale.
- Payment Status intentionally does **not** hard-require `Item Sold` to contain "Alterations" — that would hide every "Unpaid" client, which defeats the point of having a Payment Status filter/pill in the first place. Confirmed with Axel (2026-07-27) to keep it a display+filter signal, not a list-eligibility gate.
- `STAGE_ORDER` is duplicated from `pipeline.tsx` — every interface file here is a fully self-contained bundle (no cross-file imports), so shared constants are copied per-file rather than imported from a shared module. Only `"In Alterations"` is actually used from it.
- Never include `import './style.css';` in this file.
- **Wedding Date audit (2026-08-21):** the two date filters (hidden past-date exclusion, and the visible Wedding Date calendar filter) stay on `Wedding Date (Formatted)` (`fldbgknumKGS5W5WU`) — they need a real comparable date, and `wedding_date_display` can return non-date placeholder text (e.g. `"Spring 2027"`). Only the read-only **column** was repointed to `wedding_date_display` (`fldfDHXcCEbFHEX4a`, new `CLIENT_WEDDING_DATE_DISPLAY` field ID) via `getCellValueAsString`, so the column now shows the manual placeholder date instead of a "Missing Date" pill when `Formatted` is empty but `Wedding Date (If Not Set)` has something — same fix pattern as Fulfillment. `formatDate()` (used only by this column and by the Wedding Date filter's own calendar label, which always feeds it a clean `YYYY-MM-DD` and is unaffected) gained the same `MM/DD/YYYY`-first parsing as Fulfillment/Sold Orders, plus a UTC anchor for ISO strings it didn't have before (previously `new Date(iso)` with no `timeZone: 'UTC'` in the formatter — a latent day-behind risk on pure `YYYY-MM-DD` values that this repoint mostly sidesteps anyway, since `wedding_date_display` returns `MM/DD/YYYY` text, not ISO). Non-date placeholder text now displays as-is instead of falling back to the "Missing Date" pill.

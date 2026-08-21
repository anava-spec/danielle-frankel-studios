# Pipeline

Group: Daily Ops · File: `pipeline.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give DFS staff a single working view of every bride as they move through the sales & production pipeline (lead through fulfillment), so staff can see stage, flags, and next actions at a glance without cross-referencing Acuity/Shopify manually. Functions as both a Kanban board and a sortable/filterable list, backed by a Universal Full Client Profile modal for deep editing.

## Inputs

- Client records from `DF Clients` (`tblLLUlDgJ4ktzF7c`), production base `appUC2NFAlURayLx9` / sandbox `app6Q4xMZ1ngJxiV8`
- Stage data synced via Cobalt from Acuity (appointments) and Shopify/ApparelMagic (orders)
- Stakeholders: Julia Collins (product owner, DFS); DFS front-of-house/production staff (daily users)

## Outputs

- Pipeline Board View (existing Kanban, unchanged by recent work) and Pipeline List View (new sortable/filterable table)
- Universal Full Client Profile (`FullProfileModal`) — read/write surface for client data across all stages
- No direct external write-backs; edits write to Airtable fields consumed downstream by other interfaces/automations

## Workflow

1. Staff land on Pipeline and can toggle between Board and List View — both share the exact same underlying filtered client set, so switching never silently changes what's being viewed.
2. List View defaults to sorting by **Wedding Date** (not last-modified), matching how staff naturally prioritize near-term brides. It supports Studio, Sales Associate, Timeline, and Stage filters — the Stage filter is scoped to List View only, since Board View's columns already function as a stage filter (avoids a redundant control). All these filters persist in memory for the duration of the tab session (not auto-cleared on view switch).
3. Search results render as a dropdown rather than live-filtering the full page (keeps things responsive with a large client base). Search covers name, phone, email, and AM Order Number (Apparel Magic order identifier — the field that satisfies the "search by production order" requirement).
4. Clicking a client opens `FullProfileModal` (Universal Profile) — either "Current Stage" view (default) or "All Stages" view (toggle button, labeled "All Stages" / "Current Stage", no caret icon, styled as a filled primary button distinct from the plain "Go back" button).
5. Staff edit fields inline; edits are permitted for the current stage and all **past** stages (fully, functionally editable in both view modes) — this lets staff correct earlier-stage data without moving a client backward through the pipeline. Only strictly **future** stages are read-only.
6. Interest checkboxes (Alterations / Made-to-Measure) live in an always-visible "Interests" card and are directly editable regardless of stage or view mode — separate from the gated Deliberating-section copies of the same fields.
7. If `client.stage` doesn't match any value in `STAGE_ORDER`, the default view shows an explicit warning banner instead of rendering blank; header/interests/notes/flags still render normally. (All-Stages view already forces read-only in this case, so there's no conflict between the two behaviors.)
8. On a failed field save, the field reverts to its last saved value, surfaces a "Save failed" message, and allows retry — closing the modal returns to Pipeline with all filters and view mode intact.

## Rules

- `STAGE_ORDER` / `STAGE_STEPS` must be defined locally in this file — Interface Extensions run isolated; no shared imports across files (platform constraint, not fixable — the in-app "Edit code" mode is the only edit path). `pipeline.tsx` and `alterations.tsx` both duplicate this array identically. Mitigation: inline comments pointing to `docs/PHASE_LOGIC.md`, the single source of truth for all 7 pipeline phases.
- Past-stage editability: `isFutureStage` flags only strictly-future stages as read-only.
- `isFieldReadOnlyBySource` is an **independent** gate based on data source (Acuity/Shopify/AM sync) — not stage-based; fields sourced this way stay read-only for **all** users regardless of stage, since they're owned by the upstream integration, not manual entry. Do not conflate with stage read-only logic.
- Dark mode canonical pattern: `fulfillment.tsx`'s `useTheme()` hook (toggles a `dark` class on `<html>` based on `prefers-color-scheme`) + Tailwind `dark:` utility classes — chosen over `sample_tracker.tsx`'s bespoke inline-style token approach for direct compatibility with Pipeline's existing className-based styling. Applied across `DetailRow`, `FieldLabel`, `Editable*`, `BooleanDropdown`, popups, `StylePicker`, `MeasurementInputs`, and all cards/badges/flags.
- `BooleanDropdown` failed-save handling: reverts `localValue` to last confirmed value, surfaces "Save failed" via `FieldLabel`, allows retry (matches `EditableText`/`EditableNumber` pattern).
- Access: any user with Editor or Viewer access to the interface. Editors can edit all permitted fields per the stage-based rules above; Viewers can browse/filter/search/open the profile modal, but edits are gated by the interface's own read-only handling for that permission level.
- Never include `import './style.css';` in this file (standing rule across all interface files).
- Fixed 2026-07-29: `CLIENT_PICKED_PERCENT` was pointing at the wrong field ("% Picked" showed a value different from what the Order Ready automation actually evaluates — see `fulfillment.README.md`). Corrected to the real Orders rollup field, and the field is now always read-only in this file (was `EditableNumber`, a rollup can't be hand-edited).
- Fixed 2026-08-21: RTW Size had the same shape of bug as the `CLIENT_PICKED_PERCENT` issue above — the modal's editable RTW Size field wrote directly to the customer's Acuity self-reported size (`Size from Acuity Intake`), so any SA correction silently overwrote the original source data instead of recording a separate confirmed value. DF Clients has three related fields: the raw Acuity value (reference-only, never written to), a manual SA-confirmed value (the only one this modal writes), and a formula field that shows the manual value when set and falls back to the Acuity value otherwise. The fix: the editable view now writes to the manual field only, with the Acuity value shown alongside the label for reference (e.g. "RTW Size (0–20) | from Acuity: 8"); the read-only view now reads the fallback formula field instead of the manual field alone, so it shows the Acuity value rather than going blank before a size has been confirmed. The same Acuity/manual/display three-field pattern exists elsewhere in the base (e.g. Wedding Date) — read-only surfaces should always read the fallback/display field, never the raw source-only field, or they'll render blank whenever the manual/primary value hasn't been set yet.
- Note (2026-08-21): the version of `pipeline.tsx` committed in this repo predates several changes now live in the Airtable interface (this RTW Size fix, plus separately an Order Ready per-order fulfillment table and a Client Notified % rollup added directly in Airtable) — this repo copy has not been kept in sync with edits made through Airtable's in-app code editor. Treat the live interface, not this repo file, as the source of truth until the repo is resynced.

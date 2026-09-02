# Alterations Tooltip Fix, Sprint 1 Drive Docs, DNC Branding, Calligraphy Cards Fixes — Session Log

Repo: `DFS-Brain` (parent) / `danielle-frankel-studios` (submodule) · Files: `alterations.tsx`, `pipeline.tsx`, `fulfillment.tsx`, `did_not_convert.tsx`, `calligraphy_cards.tsx`, `CHANGELOG.md`, `docs/sprint_1/*` (new), 4 READMEs, session summary

## 1. Alterations — tooltip positioning + eligibility scope

**Ask:** The hidden-filters tooltip on the Alterations list opened in the wrong place, and the baseline list scope needed to be an OR of three signals instead of stage alone.

**Delivered:**
- Tooltip positioning fixed in two passes: first moved from `absolute top-full right-0` (rendered off-screen right) to `right-full` (opens left of the icon), then from vertically-centered (`top-1/2 -translate-y-1/2`, which pushed half the box above the visible page) to `top-0` (anchored flush with the icon, expands downward).
- Eligibility scope changed from a hard AND (must be in "In Alterations" stage) to an OR: stage = "In Alterations", OR has an alterations appointment on file, OR "Alterations" appears in Item Sold. The wedding-date-past exclusion and the other filters (search, wedding date picker, payment status) still apply on top.
- Tooltip copy rewritten to describe the OR logic accurately.

## 2. Sprint 1 story documentation — imported from Google Drive

**Ask:** Pull all `PB_*`-named files from a specific Drive folder (confirmed as "documentación de las stories de sprint 1") into the repo.

**Delivered:**
- New `docs/sprint_1/` folder with 10 files: `PB_IFACE_DFSInterfaces_Spec.md`, `PB_FIELD_PostAppointmentMissingData_Spec.md`, `PB_AUTO_AutoAdvanceDeliberating_Spec.md`, `PB_IFACE_DFSAppointments_Spec.md`, `PB_TABLE_DFClients_StageAuditFields_Spec.md`, `PB_ARCH_DanielleFrankel_FieldAuditRefTables_Spec.md`, `PB_ARCH_DanielleFrankel_SelectOnceLinkedRefs_Spec.md`, `PB_ARCH_CanonicalStaffLinkMigration_Spec.md`, `PB_AUTO_DFStudio_AutomationAudit_Spec.md`, and `1_PB_ARCH_DanielleFrankel_AppFlow_Spec.md`.
- **Method correction mid-task:** the first attempt at transferring larger files manually round-tripped base64 through the Write tool — a single mistyped character in one file (`PB_IFACE_DFSAppointments_Spec.md`) desynced the entire remaining decode past ~line 188 into binary garbage, only detectable after the fact. Deleted and rewrote that file, and switched every remaining file to the Drive connector's `read_file_content` tool (clean plain text, no encode/decode step) — adopted as the standing method for any future Drive→file transfers.

## 3. % Picked field ID fix

**Ask (via a spec review Axel ran in a separate Claude Chat session):** the interfaces were reading the wrong field for "% Picked" — a different field than the one an Order Ready automation actually evaluates, and the interface version was editable when the underlying data is a rollup.

**Delivered:**
- Confirmed via grep across the repo that `pipeline.tsx`, `fulfillment.tsx`, and `did_not_convert.tsx` all pointed at the same field ID, distinct from the one the "Order Ready Evaluation" automation reads.
- Replaced the field ID in all three files with the correct Orders rollup field.
- `pipeline.tsx`'s "% Picked" was the only editable instance (`EditableNumber`) — changed to always render read-only (`DetailRow`), since a rollup can't be hand-edited. The other two files were already read-only.
- Separately confirmed with Axel that the "In Production" → "Order Ready" stage rename (flagged as a risk in the same spec review) had already been published, so no interface fallback-banner risk there.

## 4. Did Not Convert — moved to Tracking, branding + dark mode

**Ask:** Move DNC into the Tracking section, then implement full branding and dark mode.

**Delivered:**
- `git mv` from `daily_ops/did_not_convert.tsx` to `tracking/did_not_convert.tsx` — no other files referenced its old path.
- The file already matched BRANDING.md's Champagne palette in light mode; added the missing half — full dark mode using the exact `useTheme()`/`useColorScheme()` pattern already established in `pipeline.tsx`/`fulfillment.tsx` (reads Airtable's own theme setting, not the OS's), applied across the main list, the full client detail page, dropdowns, search, table, pills, and the "Do not ship" banner.

## 5. Calligraphy Cards — new fields, then two rounds of bug fixes

**Ask (via a pasted context block claiming a different repo/path):** add an always-on qualification floor and a new Dress Creation Year column. The pasted repo name (`danielle-frankel-studios-singular`) and file path didn't match this project's actual layout — flagged to Axel via AskUserQuestion before touching anything; confirmed to proceed in the real repo (`danielle-frankel-studios` / `DFS-Brain` submodule, `code/tracking/calligraphy_cards.tsx`).

**Round 1 — initial build:**
- Added a hard qualification floor to `filteredRecords` (not a UI toggle): originally implemented as "Items Sold contains at least one of gown/custom/top/skirt/pants/dress."
- Created `Dress Creation Year` (Number, precision 0) via the Airtable MCP `create_field` tool — first attempt blocked by an environment compliance restriction; resolved once Axel gave the *current* sandbox base ID (`appMmEE4zyHMGhkkd` — the previously-used sandbox, `app6Q4xMZ1ngJxiV8`, no longer exists). Field ID confirmed via `get_table_schema`: `fldwgDZDs2CNEqPsQ`. Added the "Dress Year" column between Gown and Wedding Date.

**Round 2 — Axel's correction + a parsing bug:**
- Qualification floor was wrong on two counts: (1) should key off `Item Category` (a real lookup-to-singleSelect field), not `Items Sold` (free-text, no clean per-category signal); (2) `Items Sold`/`Gown` were rendering blank in the UI.
- Root cause for the blank columns: both lookups resolve (via `shopify_order`) to Orders - Shopify's `Items` field, which is itself a `multipleRecordLinks` field — the raw cell value is a nested array of linked-record references, not text, so `getCellValueAsString` returned nothing. Fixed with a recursive `unwrapLinkedNames()`/`getLinkedNamesDisplay()` helper (same underlying quirk as `did_not_convert.tsx`'s `unwrapLookupString`).
- Switched the floor to `Item Category`, confirmed its real Airtable choices via `get_table_schema` (`GOWN, TOP, JEWELRY, ALTERATIONS, DRESS, SHOES, CUSTOM, PANT, SKIRT, VEIL, LOUNGE, JUMPSUIT, JACKET`).
- **Second bug, same class:** `Item Category` turned out to be *also* a lookup through the `shopify_order` link field — the floor was still calling `getCellValueAsString` on it, so it silently excluded every client. Fixed by routing it through the same `unwrapLinkedNames()` helper as Items Sold/Gown.
- **Business-rule correction (via AskUserQuestion):** Axel's live Airtable sanity check ("Item Category is not only shoes or veil," expecting 832 matches) was broader than the original narrow keyword allow-list, which wrongly excluded categories like JEWELRY/ALTERATIONS/LOUNGE/JUMPSUIT/JACKET. Confirmed with Axel and rewrote the floor as "qualifies if at least one category is not shoes/veil" instead of the positive keyword list.

**Round 3 — config, not code:** after all of the above, Axel reported the interface still showed zero results after pasting the updated code into Airtable. Ran the `airtable-interface-config-doctor` skill against a page-config JSON Axel collected from DevTools plus this file. The collector's JSON shape (`pagesById` wrapper) didn't match what `diagnose.py` expected (`page`/`pageId` at top level) — adapted the structure with a small Node script before the script would parse it correctly. Diagnosis found the real remaining cause: `Item Category` was declared in the code and correctly typed, but **not exposed to this page's block config** (Data → Fields, in the page's right sidebar) — a pure Airtable-config problem, invisible from reading the code. Axel enabled the field and published the interface (there were unpublished changes); a second config-doctor run confirmed the blocker cleared. Axel then confirmed the live count matched expectations.

**Round 4 — Status pill UX fix:** clicking the Status pill was silently toggling the value to whichever state wasn't currently showing (Pending↔Sent) rather than giving the user a choice. Replaced `StatusPill` with `StatusPillDropdown` — clicking opens a small options panel (BRANDING.md §5 dropdown pattern: surface/border/shadow, click-outside-to-close) listing both `Pending` and `Sent` as colored pills, and the user picks explicitly. The write handler (`handleSetCalligraphyCard`, renamed from `handleToggleCalligraphyCard`) now takes the chosen value directly instead of computing a toggle.

## 6. CHANGELOG.md — two new weeks added

- "Week of Jul 28–29, 2026": Alterations tooltip/scope fix and the % Picked correction.
- "Week of Jul 30, 2026": Did Not Convert moved to Tracking + dark mode; Calligraphy Cards qualification-rule fix, Items Sold/Gown blank-column fix, and the new Dress Year column. Both client-facing only (no field IDs, no repo-structure detail).

## Workflow notes

- Every change went through the same two-repo flow: commit + push in `danielle-frankel-studios`, then bump + commit + push the submodule pointer in `DFS-Brain`.
- Explicit user confirmation was required before the first two push cycles this session (auto-mode classifier blocked the first unconfirmed attempt); Axel then said "siempre commit y push" going forward for this repo, saved to memory.
- The base64-corruption incident (Sprint 1 docs) was self-diagnosed and self-corrected mid-task, not flagged by the user — worth keeping in mind for any future large binary/text transfer via Drive.
- A `git push` to `DFS-Brain` hung twice (2–5 min timeouts) mid-session with no error; the commit was already local and valid both times, and a subsequent retry succeeded and picked up the previously-stuck commit along with the new one. No data was lost, just a slow/flaky remote connection.
- `airtable-interface-config-doctor`'s bundled `diagnose.py` needed `python` (not the `python3` alias, which isn't registered on this machine) and `PYTHONIOENCODING=utf-8` (Windows terminal defaults to cp1252, which can't encode the arrow character in the script's own output) to run at all — worth remembering for the next time this skill runs in this environment.
- The pasted-context discrepancy in section 5 (wrong repo name/path) was caught before any file was touched, by comparing the claimed repo against `git remote -v` on the real one and checking whether the claimed path actually existed on disk — a useful pattern any time a context block arrives with repo/path specifics that weren't independently verified this session.

# Alterations Tooltip Fix, Sprint 1 Drive Docs, % Picked Field Fix — Session Log

Repo: `DFS-Brain` (parent) / `danielle-frankel-studios` (submodule) · Files: `alterations.tsx`, `pipeline.tsx`, `fulfillment.tsx`, `did_not_convert.tsx`, `CHANGELOG.md`, `docs/sprint_1/*` (new), session summary

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

## 4. CHANGELOG.md — new week added

Added a "Week of Jul 28–29, 2026" section covering the Alterations tooltip/scope fix and the % Picked correction, client-facing only (no field IDs, no repo-structure detail).

## Workflow notes

- Every change went through the same two-repo flow: commit + push in `danielle-frankel-studios`, then bump + commit + push the submodule pointer in `DFS-Brain`.
- Explicit user confirmation was required before both push cycles this session (auto-mode classifier blocked the first unconfirmed attempt).
- The base64-corruption incident was self-diagnosed and self-corrected mid-task, not flagged by the user — worth keeping in mind for any future large binary/text transfer via Drive.

# DFS Customization Requests — Session Log

Repo: `DFS-Brain` (parent) / `danielle-frankel-studios` (submodule) · File: `customization_requests.tsx` (+ small `recap.tsx` touch)

## 1. One-to-many counter-proposal redesign

**Ask:** Counter-proposals (CPs) were chained one-to-one (original → CP1 → CP2). User asked whether one-to-many (every CP links directly to the original) would be better, and requested full history, with the record shown always being the most recent, and Style/Customizations locked once any CP exists.

**Delivered:**
- Every CP now links `parent_customization_request` directly to the thread's **root**, reusing Airtable's auto-generated inverse link — no schema change.
- `RecordDetailPage` resolves `rootRecord`, `threadChildren`, `threadRecords` (chronological) and a `threadRecordsDisplay` (most-recent-first) for a new **Counter-Proposal History** section — collapsible, collapsed by default, inline table with Version / Created At / Status / Amount.
- **Style/Customizations lock to read-only** once any CP exists (`canEditStyleCustomizations = canEditFields && !isCounterProposal`), applied to both Regular and Hybrid (`HybridChildColumn`).
- Workdesk/Approval list views now hide every non-most-recent thread member (`nonLatestThreadIds`), so each thread shows exactly one row.
- History rows are clickable → opens that thread member in a new **read-only** view (`ViewState.readOnly`, `onOpenHistoryRecord`) with its own History section hidden; the record currently open and the thread's most-recent record are excluded from being clickable.

## 2. Counter-Proposed status restored + Type column

**Ask:** The `Counter-Proposed` status is still needed — Margo countering a request under review should hand it to the SA's queue (`Counter-Proposed`); the SA re-countering it hands back to Margo (`New Request`).

**Delivered:**
- `CounterProposalModal.handleSubmit` now sets the child's status based on who's countering: client → always `New Request`; internal → `Counter-Proposed` if parent was `Under Review`, else `New Request` (SA re-countering Margo's own counter).
- Fixed a race: `parentInternalStatus` was read *after* writing the parent's new status (a live SDK record), always landing on the wrong branch — now read before the write.
- Restored `canActInternally`'s second branch (`sourceLayout==='ops' && approvalStatus==='Counter-Proposed'`) so the SA can act from Workdesk.
- Added a derived **Type** column (`New Request` / `Counter-Proposal`, from `parent_customization_request` presence — not from status) to the Approval layout's New Requests / Under Review tables, rendered as a colored chip (gray / amber).
- Internal decision buttons now read **"SA Approve / SA Deny / SA Counter-Propose"** when it's the SA's turn (`sourceLayout==='ops'`), so they're not confused with the client-facing button set in the same header slot.

## 3. Detail Page layout pass

- **Approved Price** moved into the Summary panel, first and largest (`text-3xl`); **Counter-Proposed Price** (same field, pre-approval) now smaller (`text-lg`) and mutually exclusive with Approved Price.
- **Approved banner** moved to the top of the page (above both panels), reworded to *"Customization Request Approved - review with the client."*, one font tier smaller, width matched to the left column.
- **All status banners** (Approved, counter-proposal, Denied ×2, Client Approved) now live at the top by default, **grouped by color** into one box per color instead of stacking duplicates; banner group spacing tightened (space-y-3, ~40% less) and padding reduced (~30%).
- **Client Decision buttons** moved into the title bar (same slot as internal Approve/Deny/Counter-Propose), dropping the "Client Decision" label.
- New top row: **Created By / Internal Approval / Client Approval**, three equal-width columns (Client Approval renders blank, not collapsed, until it has a value); Style moved to its own full-width row below.
- Removed the internal status pill from the title bar (redundant with the new Internal Approval field).
- Workdesk table: **"Approval Status" → "Internal Status"**, added **"Client Status"** column, dropped **Wedding Date** to keep the row from feeling cramped (cleaned up the now-unused `formatWeddingDate`).

## 4. Bug fixes found during testing

- **`handleApprove` was overwriting a CP's negotiated price.** It always recomputed `internal_approved_pricing` from the record's own live `proposed_total_custom_price` — for a counter-proposal, that clobbered the actual negotiated ask. Fixed: only recompute for a plain (non-CP) request; a CP's already-set price is preserved, or (see below) copied in from the client's price the first time it's approved.
- **Root's Customization Total was wrong for CPs.** `rootMultiplierFactor` hardcoded Self Usage to `0` instead of reading the root record's own value, understating the multiplier (e.g. 1x shown instead of the real 3.3x). Fixed to read `rootRecord`'s own Self Usage.
- **Dark mode:** the four top-level screens set their background via an inline `style={{ backgroundColor: '#F8F5EE' }}`, which never responded to the `dark` class `useColorScheme` toggles — replaced with `bg-[#F8F5EE] dark:bg-[#1B1813]` Tailwind classes; added missing `dark:` text colors on the "Configuration Required" state.

## 5. Client counter-proposal price — new field

**Ask:** When the client makes a CP, the price input should say "Client Proposed Price" and use a dedicated field (`client_proposed_pricing`), not `internal_approved_pricing`, since it hasn't been internally reviewed yet.

**Delivered (after confirming the full-flow option with the user):**
- New Airtable field `client_proposed_pricing` (currency), created in **sandbox** only per the established Prod↔Sandbox mirroring workflow (user syncs to Production separately).
- Client-sourced CPs write to `client_proposed_pricing` instead of `internal_approved_pricing`; modal label reads "Client Proposed Price" for that flow.
- Summary panel / History fall back to `client_proposed_pricing` whenever `internal_approved_pricing` is still empty.
- `handleApprove` now copies `client_proposed_pricing` → `internal_approved_pricing` the moment Margo actually approves it (only if not already set, preserving the earlier fix).

## 6. Denial reason fields

**Ask:** Three new fields so Margo, the SA, or the Client must give a reason when denying — required before continuing, shown in the rejected CP's banner.

**Delivered:**
- Three new long-text fields (sandbox): `internal_denial_reason` (Margo), `sa_denial_reason` (SA denying Margo's own counter), `client_denial_reason`.
- `ApproveDenyConfirmModal` gained a required reason textarea for Deny actions; Confirm stays disabled until filled.
- The shared internal Deny handler routes the reason to the right field based on status at the moment of denial (`Under Review` → Margo's field, `Counter-Proposed` → SA's field).
- Denied banners now append the stored reason.

## 7. Approval Flow artifact (shareable diagram)

- Updated the existing **"Customization Request — Approval Flow"** artifact to show all **three decision-makers** (Production/Margo, Sales Associate, Client) as distinct color-coded lanes, each with its own Deny/Approve/Counter-Propose decision node, matching the current one-to-many + Type + denial-reason logic. Live at the same URL (redeployed in place).
- Wrote a **Claude Design prompt** (saved to `claude_design_prompt.txt` in scratch) so the user can generate a polished, non-technical version of the same diagram to share with Julia — three lanes, end-state color key, and a plain-language "How to read it" section, explicitly scoped to avoid technical field names.

## Workflow notes

- Every change went through the same two-repo flow: commit + push in `danielle-frankel-studios`, then bump + commit + push the submodule pointer in `DFS-Brain`.
- Balance-checked braces/parens/brackets before every commit via a Node one-liner.
- Airtable field creation (6 new fields total this session) went through the MCP Airtable connector, always in **sandbox**, only after explicit user confirmation on scope/base.
- Outstanding manual step throughout: the user still needs to paste the updated code into Airtable's live Interface Extension editor for each round of changes.

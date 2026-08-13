# Sample Tracker

Group: Tracking · File: `sample_tracker.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Track physical sample gowns across locations/status (studio, trunk shows, production, etc.), their condition, and timely alerts when samples are off-site or need attention — so samples aren't lost, damaged, or unavailable for a bride's appointment.

## Inputs

- Sample records with a location/status category field
- Stakeholders: Julia Collins; original combined 4-feature story was rejected by DoR Auditor and split per her/PM guidance

## Outputs

- Close-size Availability view (`JuliMigLui37088`)
- Add/Retire & Condition Tracking (`JuliMigLui37112`) — implemented DFS-4 (`recgZkZPKVA7jpxpX`), 2026-08-12
- Off-site/In-studio Alerts + Slack notifications (`JuliMigLui37116`)

## Workflow

1. Samples are logged/added or retired via Add/Retire tracking, with condition status recorded.
2. Close-size Availability view shows which close sizes are available for fitting purposes — style-name substring match, with a two-state badge (In Studio / Missing). Size-distance display was deliberately removed during the original build as a UX decision.
3. Alert automation watches location/status category and fires Slack alerts based on a sequencing threshold — this is the first work item to confirm for `JuliMigLui37116`, not yet finalized.
4. **Add Sample** — a "+ Add Sample" button (visible when the interface has write permission on Sample Log) opens a modal requiring a linked `parent_style` (record picker over the DF Styles table — searchable, matches on `style_name`), Size, and Type; Location, Notes, and photo are not part of creation (see Condition/Photo below). Required-field errors are shown inline; the Save button disables while the write is in flight to prevent duplicate submissions. New samples are created with `status = Active`.
5. **Retire** — an explicit two-step inline confirm (click "Retire" → "Confirm Retire?", auto-reverts after ~3s) in the sample detail modal writes `status = Retired`. The write is optimistic (UI flips immediately) with rollback + an inline error if the Airtable write fails. The default table filter is `status = Active`, so retired samples drop out of the main view but remain queryable/visible when that filter is cleared or when reopening the record directly.
6. **Condition + Photo** — recorded via a native Airtable Form (an Interface Form page, not a classic Grid-view form), not in-app: the code cannot reliably persist file uploads through the Blocks/Interface Extension SDK, so condition changes and photo evidence are captured entirely outside this file. The sample detail modal has a "Register Condition" button that opens that Form in a new tab with the `sample` field prefilled and hidden (`?prefill_sample=<recordId>&hide_sample=true`), and a read-only "Condition History" section below it (most-recent entry as a badge + all past entries as a compact timeline, sorted by `logged_at` descending) sourced from the `sample_condition_history` table, filtered to that sample. There is no in-app edit path for condition/photo by design.

## Rules

- Confirmed location/status category values: Studio NY, Studio LA, Trunk Show, Prespo, Production, Design, Damaged, Archived, Other.
- Damaged, Archived, and Other are explicitly **excluded** from alerting.
- Dark mode in this file uses a bespoke "champagne" `LIGHT`/`DARK` token object applied via inline `style={}` — evaluated against `fulfillment.tsx`'s pattern during the Pipeline dark-mode unification work and **not** selected as canonical, but this file was left as-is (out of scope for that work). Not yet decided whether Sample Tracker should eventually migrate to the canonical Tailwind `dark:` pattern.
- A separate "Sample Tracker — Future Enhancements" story (repair priority flagging, PR pool tracking) is distinct from and NOT covered by the Close-size Availability story.
- Original combined 4-feature story scored 57/100 on DoR Auditor (scope too broad + no UI designs) — this is why it was split into three stories; keep them separate going forward rather than re-merging.
- Planned follow-up (Sprint 7, "Sample Tracker — Alternate-Size Match Fix"): reintroduce within-2-sizes matching logic and add a third status state, "Alternate available," alongside In Studio / Missing, per Julia's original spec — both were cut during the initial build per that spec's own UX Decisions table and may need restoring; confirm with Julia before restoring, since her "this should be cleaner" feedback may be reacting to exactly this gap.
- Never include `import './style.css';` in this file.
- **Style name resolution (DFS-4, 2026-08-12):** Sample Log's `style_name` field was renamed to `style_name_legacy` and is now fallback-only. New samples link to a DF Styles record via `parent_style`, and `parent_style_name` (a lookup) reflects that linked record's `style_name` live. The formula field `label` (now Sample Log's primary field) prefers `parent_style_name`, falling back to `style_name_legacy`. Anywhere in code that displays/matches/sorts a sample's style name must go through `getEffectiveStyleName(record)`, not read `style_name_legacy` directly — that field is blank on every sample created after this change, and reading it directly silently drops those samples from search, sort, table display, and the close-size/alert-matching logic. `SampleDetailModal`'s own editable Style Name Legacy field is the one intentional exception (it's editing the legacy field itself, not deriving a display value).
- **`sample_condition_history` table** (`tblCeawyDvoWBj2hQ`) is the system of record for condition + photo, one row per check: `sample` (link → Sample Log), `condition` (Good Condition / Damaged / Needing Repair), `photo`, `notes`, `logged_at` (formula `CREATED_TIME()`, used for sorting). Sample Log also has `current_condition_rollup`, a rollup of linked `condition` values — this is Airtable-grid-only, **not** authoritative (rollup order isn't guaranteed chronological); the interface always computes "current condition" itself from `sample_condition_history` sorted by `logged_at`.
- **Condition Form URL is never hardcoded.** It's resolved live from the `resources` table (`tblFa56lQwVacMXto`) by matching `record.name === 'sample_condition_entry_form'` and reading its `url` field — same pattern `recap.tsx` uses for `attachments_form_url`, because sandbox and production are separate bases with independently-editable resource records holding different URLs for the same logical resource. If that resource record can't be found or its URL is blank, the "Register Condition" button disables itself with a "Condition form link not configured yet." note rather than opening a broken link. The prefill query param's field name (`sample`) is also read live off the field itself (`getFieldIfExists(...).name`), not hardcoded, so a future rename of that field doesn't silently break the link.
- Confirmed working end-to-end in Sandbox 2026-08-12: Register Condition opens the Form with `sample` prefilled/hidden, and a submitted entry appears in the sample's Condition History on return to the interface.

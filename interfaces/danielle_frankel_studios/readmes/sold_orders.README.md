# Sold Orders

Group: Daily Ops · File: `sold_orders.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give Sales Associates a working view of orders that have moved past Draft into a confirmed "Sold" state, defaulting to what's currently open/live so closed orders don't clutter the daily view.

## Inputs

- Orders - Shopify (`tblHFGbijtvZcRPkE`) records synced via Cobalt from Shopify/ApparelMagic
- Stakeholders: Julia Collins

## Outputs

- No write-backs of its own; default sort is client-side display behavior only (see Workflow)

## Workflow

1. The list defaults to sorting by Date Sold, most recent sale first (fixed 2026-08-21 — previously had no default sort, so order was whatever Airtable happened to return). Clicking any column header still overrides this the normal way (desc → asc → clear).

⚠️ The rest of the originally scoped improvement is still not built:

- **Planned** (Sprint 7, "Sold Interface Filter & Sort Defaults" — small standalone story, High priority / Low value per Julia's feedback log): default the interface to open/live orders only, with a toggle to show closed orders; add a customization yes/no flag to filter to customization orders specifically; make the list sortable by due date.

## Rules

- The default reverse-chronological sort (above) is confirmed built as of 2026-08-21. The open/live-orders default, closed-orders toggle, customization flag, and due-date sort from the same story are not — do not assume any of those are done without confirming in code first.
- **Wedding Date audit (2026-08-21):** the only place this interface shows wedding date is the order detail modal's subtitle (`Orders - Shopify:wedding_date`, a lookup already correctly pointed at `DF Clients:wedding_date_display`, confirmed against live schema, not just the repo comment). No code-side re-pointing needed. `formatDate()` — this file's date formatter used **only** for wedding date, not for `Date Sold` (that's `formatDateOrdinal()`, untouched) — did not parse the `MM/DD/YYYY` text `wedding_date_display`'s formula actually returns (see [fulfillment.README.md](fulfillment.README.md) for the formula and why this format was a surprise); it fell through to `new Date(raw)` parsed as local time then displayed in UTC, and returned `'—'` for genuinely non-date placeholder text. Added the same `MM/DD/YYYY`-first parsing used in Fulfillment, and changed the final fallback to return the raw string instead of `'—'` so a manual placeholder like `"Spring 2027"` still displays instead of being blanked.
- **Data-quality finding, not fixed here (2026-08-21):** while testing wedding date, found what looks like a duplicate `DF Clients` record — "Julia Collins" (`recdh1xhbml08B2Ip`, wedding date populated: 10/10/2026) vs. "Julia Shao Collins" (`recJyVeFK00iGG8UH` and `reckYKVXP59vmtmBj`, no wedding date fields set at all) — several Sold Orders records link to the "Shao" variant, which is why their modal shows a blank wedding date even though the code is reading correctly from empty underlying data. Flagged to Alonso; out of scope for this pass (non-billable time constraint) — do not attempt a dedup/merge without explicit sign-off.
- This interface is distinct from Draft Orders (pre-sale itemized pricing) and from Fulfillment (post-sale production/shipping tracking) — Sold Orders sits between the two, tracking confirmed sales that haven't yet entered Fulfillment.
- Onboarding/instructions content for this page (along with Pipeline, Sample Tracker, Change Log, etc.) was flagged as needing a content owner and timeline ahead of a joint launch — this is a content task, not a dev task.

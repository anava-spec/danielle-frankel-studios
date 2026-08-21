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
- This interface is distinct from Draft Orders (pre-sale itemized pricing) and from Fulfillment (post-sale production/shipping tracking) — Sold Orders sits between the two, tracking confirmed sales that haven't yet entered Fulfillment.
- Onboarding/instructions content for this page (along with Pipeline, Sample Tracker, Change Log, etc.) was flagged as needing a content owner and timeline ahead of a joint launch — this is a content task, not a dev task.

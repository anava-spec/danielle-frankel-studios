# Sold Orders

Group: Daily Ops · File: `sold_orders.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give Sales Associates a working view of orders that have moved past Draft into a confirmed "Sold" state, defaulting to what's currently open/live so closed orders don't clutter the daily view.

## Inputs

- Orders - Shopify (`tblHFGbijtvZcRPkE`) records synced via Cobalt from Shopify/ApparelMagic
- Stakeholders: Julia Collins

## Outputs

- No automations of its own beyond the default filter/sort behavior described below (planned, not yet confirmed built as of this writing)

## Workflow

⚠️ Current default behavior as of the last audit needs re-verification — a specific improvement was scoped but its build status is unconfirmed:

- **Planned** (Sprint 7, "Sold Interface Filter & Sort Defaults" — small standalone story, High priority / Low value per Julia's feedback log): default the interface to open/live orders only, with a toggle to show closed orders; add a customization yes/no flag to filter to customization orders specifically; make the list sortable by due date.

## Rules

- Until the above story is built, do not assume the interface currently defaults to open/live orders — confirm actual current behavior in code before documenting it as done.
- This interface is distinct from Draft Orders (pre-sale itemized pricing) and from Fulfillment (post-sale production/shipping tracking) — Sold Orders sits between the two, tracking confirmed sales that haven't yet entered Fulfillment.
- Onboarding/instructions content for this page (along with Pipeline, Sample Tracker, Change Log, etc.) was flagged as needing a content owner and timeline ahead of a joint launch — this is a content task, not a dev task.

# Fulfillment

Group: Daily Ops · File: `fulfillment.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Track orders through fulfillment: pricing change transparency, hold/shipping status, and pickup readiness — so staff can see exactly what changed on an order and whether it's cleared to ship/pick up.

## Inputs

- Orders - Shopify (`tblHFGbijtvZcRPkE`) records, including snapshot fields
- `order_sync_changelog` (`tblOCgG5WDP51FB2n`) — auto-logged by automations; separate from the existing manual `order_adjustments` table (which staff create by hand in the interface — do not conflate the two)
- Cobalt-synced Shopify/ApparelMagic price data; `order_items` table (Cobalt-owned, polling sync — see the Pick Ticket item in Rules)
- Stakeholders: Julia Collins; Cobalt (Nadiia/Cassidy) for sync-level questions (change reason / prior field value in the Shopify webhook — questions sent, still pending response as of last check)

## Outputs

- `OrderDetailModal`: read-only Sync Change Log section (see [Change Log](../../../docs/CROSS_CUTTING.md#interfaces-without-custom-code-in-this-repo))
- Hold reason + "On hold until [date]" display
- Three independent RYG (Red/Yellow/Green) Pickup Readiness flags: Tax, Address, Hold — deliberately not one combined "Readiness Checklist Passed" field, so staff can see exactly which check is unresolved
- `pickup_released`: always a manual staff checkbox, never auto-derived, so a later change to underlying checks can't silently un-release an order that already shipped
- Three automations (OOP pattern): init snapshot on create; compare-and-log on update; one-time backfill (already run, now deleted)

## Workflow

1. Order created in Shopify → synced to Orders - Shopify → init-snapshot automation fires, capturing baseline price fields.
2. On any Shopify/AM price update while the order is `In Fulfillment`, the compare-and-log automation diffs against the snapshot and writes a row to `order_sync_changelog`.
3. Staff view the read-only Sync Change Log in `OrderDetailModal`.
4. Staff see hold reason + hold-until date if the order is on hold.
5. Pickup Readiness Gate shows the three independent RYG flags across four surfaces consistently: master client table, Client Detail Modal title bar, Shopify Orders sub-table, and Order Detail Modal. Severity model: green = passed; yellow = failed with zero fulfillment progress; red = failed with progress already underway; gray = underlying data couldn't be resolved.
6. Item-level fulfillment status uses `quantity_open === 0` as the source of truth for "Fulfilled" (not a sum of `quantity_picked + quantity_shipped`), since `quantity_open` is the more direct signal already maintained by the ApparelMagic sync.
7. Save operations for `tax_confirmed` and `pickup_released` roll back the optimistic UI state and surface an inline error if the Airtable write fails — staff should never see a release reflected in the UI that didn't actually persist.
8. Staff manually toggle `pickup_released` once all checks pass and they've physically confirmed release.

## Rules

- `CONFIG.REQUIRED_STAGE` for the compare-and-log automation must be exactly `'In Fulfillment'` — not `'Fulfillment'`.
- `hold_shipment_date` is a manually-created lookup field (`fldS8LJdNHBKJhC0`) — Sandboxing on this base (`app6Q4xMZ1ngJxiV8`) blocks API field creation, so any new fields must be created manually in Airtable, never via automation/API.
- No dedicated "hold reason" field exists yet at client or order level — `fld2MAllXcFTSIOVZ` is a lookup, not a true editable hold-reason field. Open gap, not yet resolved.
- Cobalt questions about change reason / prior field value in the webhook payload are pending (Nadiia/Cassidy) — do not assume this data is available until confirmed; the questions sent were specifically: (1) whether Shopify sync includes any reason/event/metadata for a price-field change, and (2) whether the previous value is available at sync time or needs to be captured in Airtable right before it's overwritten.
- `tax_confirmed` is a **permanent lock** once set true — added during implementation, not in the original AC; pending Julia's formal confirmation. This exists to prevent accidental un-confirmation after downstream release decisions have already been made.
- Access: restricted to DFS Staff with existing Fulfillment page permissions — no new access group was introduced by the Pickup Readiness Gate work. Enforcement of who can see/edit is delegated to Airtable's own collaborator permissions, not implemented in interface code.
- Tax rate calculation and freight/shipping charge calculation logic are explicitly unchanged/out of scope for the Pickup Readiness Gate story — it only adds confirmation and gating around existing values; a future story is expected to source accurate state tax rates automatically.
- Order Ready threshold (feeds fulfillment eligibility upstream, built as its own automation on `DF Clients.stage`): gown item's `Category Lookup` (`fldSF1GXY5MgiAXdl` = `"GOWN"`) picked AND `picked_status_percentage` (`fldjC8M11Pis7eMxF`) > 75% — either condition qualifies, writing `stage = "Order Ready"`. The choice-field rename from the old internal value "In Production" has been published, so this is now consistent with `pipeline.tsx`'s `STAGE_ORDER`/`STAGE_STEPS`. Percent-formula fields return decimal fractions via the API (1.0 = 100%), so automations must compare against `1` with epsilon tolerance, never `100`.
- Fixed 2026-07-29: the `PICKED` field constant in this file (labeled "% Picked" on the client/order surfaces) was pointing at the wrong field entirely — a field distinct from `picked_status_percentage` above, and not the one the Order Ready automation actually evaluates. Corrected to the real Orders rollup field. The two "picked" fields are confirmed **not** interchangeable — don't assume they track the same underlying data.
- Known open bug (Julia, Jul 15, High priority): the "Order Ready" filter shows no results even though the implemented logic matches Julia's written rule — this is an **execution bug**, not a logic error; the rule itself (gown picked OR >75%) is correct per her most recent written confirmation, so don't "fix" the threshold itself, fix the filter execution.
- This page will need to incorporate Pick Ticket backend updates from Cobalt (`order_items` table: allocated/picked/shipped quantity + percentage formula fields, polled every 10 min for recent orders and daily at 4 AM for the last 6 months) — not yet scoped as a story. Open scoping question: does `picked_status_percentage` from `order_items` replace or complement the existing Order Ready threshold logic above? Known Cobalt-side data risk: some `order_items` records lack linked style records due to non-standardized style names between Shopify and ApparelMagic — this is a Cobalt data-quality issue, not a Singular edge case to design around.
- Cobalt owns Acuity/Shopify/AM pipelines and `Error Logs` — never write to Cobalt-managed tables from this interface.
- Fulfillment had 3 conflicting deployed phase-transition automations found during the 7-phase audit; "No Alts/Order Ready - Update Phase to In Fulfillment" was confirmed as champion and the other two were deleted — if you find more than one Fulfillment-stage automation in the base, treat this as a red flag and confirm which is authoritative before assuming both are intentional.
- Fixed 2026-07-22: `fulfillmentRecords` (the queue-membership filter) previously required, in addition to `Stage === 'In Fulfillment'`, a non-empty `Items Sold` AND a `Wedding Date` today-or-later — none of which is part of the phase-logic definition ("Clients who are in Order Ready and do not have Alterations as an order item" per `slack-files/recovered/AIRTABLE PHASE LOGIC.docx`, "Fulfillment" row). Since most `In Fulfillment` clients don't have those lookup fields populated on the `DF Clients` record, the extra conditions were silently dropping ~80% of legitimately-staged clients (only 3 of 27 were passing). The gate now checks `Stage` only. See `automations/danielle_frankel_studios/fulfillment_backfill.js` for the one-time backfill that advances clients who already qualified for `In Fulfillment` (per the same phase-logic rule) but never got the automation-driven stage update.
- **In Fulfillment close-out (2026-08-20, in progress):** `DF Clients.stage` (`fldLcxVZvI1rigBlh`) already has two terminal choices after `"In Fulfillment"` — `"Picked Up"` and `"Shipped"` — but nothing writes them yet. Design: close-out condition = `quantity_open_total == 0` (aggregated from `order_items.quantity_open`, `fldvU2sU8b6V0wTlG`, across an order) OR the new manual exception checkbox `SA Override - Mark Fulfilled` (`fldqHU9ryVXgpZOGe`, DF Clients). When either is true, target stage = `"Picked Up"` if `has_alterations_item` (`fldWaqPw2BO4XQIbX`) is true OR `tracking_number` (`fldCfwwMFNkVKJApj`, Orders - Shopify) is empty, else `"Shipped"`. This is also the fix for the historical "alterations line item registers as shipped instead of picked" bug — alterations are in-studio work and must never resolve to `"Shipped"`. AM-sourced shipping-label status was considered and deliberately dropped — Cobalt doesn't currently expose it, and a label being created doesn't mean the order actually left the building. `pipeline.tsx`/`alterations.tsx` `STAGE_ORDER` and `order_ready_evaluation.js`'s guard array were updated to include `"Picked Up"`/`"Shipped"` so the "never regress a stage" guards stay correct; Pipeline's Kanban intentionally renders a separate `KANBAN_STAGE_ORDER` (excludes both) so closed orders disappear from the board while still being reachable from the List view's Stage filter.
- Automation `Order Close Out - In Fulfillment to Picked Up-Shipped` (`wflndcP1aaQD2ORhK`, off/draft) was scaffolded with the trigger only (DF Clients updated, watching `stage` + `SA Override - Mark Fulfilled`) — the action node is a placeholder `findRecords` (inert, `customScript`/`noOp` aren't creatable via the Airtable MCP). **TODO:** replace that placeholder with a real Run-a-Script action implementing the condition above, then turn the automation on.
- Base ID correction: this doc and several automations refer to the sandbox as `app6Q4xMZ1ngJxiV8`; live verification on 2026-08-20 found the actual sandbox base (matching all table/field IDs referenced here) is `appMmEE4zyHMGhkkd`. Treat `app6Q4xMZ1ngJxiV8` in older comments as stale.

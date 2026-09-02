# Appointments — Pick Up Orders Table (Issue #54)

Planning doc, not yet built. Covers the new per-order Orders table inside
the Appointments detail modal for Pick Up-type appointments, and the two
possible architectures for "is this order fulfilled" depending on what
Cobalt confirms about `order_items` semantics (Axel raising with Cobalt —
see Gap 2.5 below).

## Business rule (Axel, 2026-08-27)

- Click a Pick Up appointment's row → modal shows an Orders table (same
  visual pattern as `fulfillment.tsx`'s Shopify Orders inline table) listing
  every order linked to that client, open or closed.
- Columns: `Order #` | `Payment` | `Delivery` | `Readiness` | `Total` |
  `Order Status` (renamed from "Action").
- Table sorted: pending pickups first, then already-picked-up, then Ship
  orders last. Ship/already-closed rows are informational only — no action
  control on them.
- `Order Status` is a dropdown, gated behind a confirm alert. Only two
  selectable actions:
  - **Closed** — marks the order done.
  - **Change Delivery Method** — frontend-only pseudo-option (never written
    to the real field as a value). Opens a second step in the same alert
    letting the user flip Delivery Method from "Pick Up in Store" to
    "Ship". Flow: select Ship → "Confirm to continue" button appears →
    click it → button relabels to "Change Delivery Method" → click again →
    alert closes, `Delivery Method` is written, `Order Status` stays Open.
  - `Open`/`Cancelled` are never manually selectable from this UI.
- Slack notification fires **only** when the Delivery Method change
  originates from this Appointments dropdown — not from edits made in
  Fulfillment. Requires a new field to mark origin (see below).
- Writing `Order Status`/`Delivery Method` should also propagate back to
  Shopify (not just Airtable) — pending Cobalt confirmation on whether
  that's possible and whether Order Status re-syncs continuously or only
  at order creation (Axel raising 2026-08-27).

## Confirmed live schema (no new fields needed for the base flow)

All on `Orders - Shopify` (`tblHFGbijtvZcRPkE`):

| Column | Field | Type / choices |
|---|---|---|
| Order # | `SHOPIFY_ORDER_NUMBER` (`fldWiKEXjId411DQc`) | number |
| Payment | `PAYMENT_STATUS` (`fldFI488S8GPaVgCt`) | singleSelect: Paid/Unpaid/Partially paid/Pending/Refunded/Partially refunded/Voided/Authorized |
| Delivery | `DELIVERY_METHOD` (`fldFATO0oJUQjPEzr`) | singleSelect: **Pick Up in Store / Ship** |
| Readiness | `PICKED_STATUS` (`fldqhI6Aq9zIhFsFW`) | singleSelect: None/Partial/Full |
| Total | `TOTAL` (`fldkIMTeKdneKABS4`) | currency |
| **Order Status** | `fldYq3JxRSWQUUHm6` | singleSelect: **Open / Closed / Cancelled** |

Join path (already exists, already used by `fulfillment.tsx`): Appointments
→ `CLIENT_LINK` (`fldcVVGhEsnYRsbyR`) → DF Clients → `SHOPIFY_ORDERS`
(`fldWSGqQW9czYdams`) → Orders - Shopify.

**One new field is required regardless of which scenario below applies**:
a checkbox on Orders-Shopify (working name `pickup_notify_source_appt`) that
the Appointments dropdown sets `TRUE` alongside the Delivery Method write,
so the new Slack automation can trigger only on that flag (and self-reset
it) rather than on every Delivery Method edit from any interface — per
Axel's explicit answer that Fulfillment-side edits should stay silent.

## Open items blocking final build (Axel raising with Cobalt, 2026-08-27)

1. **Can Airtable push `Order Status` back to Shopify?** Not yet — no
   existing automation/script writes to Shopify's order status. If Cobalt
   confirms it's possible, this needs a Cobalt endpoint + a
   `customScript` "Call Cobalt Endpoint" automation, the same pattern as
   `draft_order_shopify_creation.js` — a materially bigger lift than an
   Airtable-only automation.
2. **Does `Order Status` re-sync from Shopify after order creation, or only
   set once?** `Delivery Method` is confirmed set-once-at-creation (safe to
   edit manually — already done today in `fulfillment.tsx`). `Order Status`
   is unconfirmed. Axel's read: safe if Open→Closed (we set it, Shopify
   later also closes it — no conflict), risky if Open→Cancelled after we'd
   already set it Closed (silent mismatch with the real Shopify state).
3. **What do `order_items.quantity_open` / `quantity_shipped` actually
   mean?** Working assumption used throughout `fulfillment.tsx`,
   `order_close_out.js`, and this doc's Scenario A: `quantity_open` means
   "finished on the production side"; `quantity_shipped` means "shipped to
   the store" — **neither necessarily means "in the client's hands."**
   Axel is verifying this with Cobalt before either scenario is finalized.
   If confirmed wrong, `Delivery Status`/`Delivery Method` become the
   champions instead of `order_items`, which affects far more than this
   feature — see Scenario B and the blast-radius note below.

## Two build scenarios for "Order Status = Closed" / progress override

Both scenarios share the same UI (table, dropdown, confirm alert, Slack
trigger field). They differ only in what backs `fulfillment_progress_percentage`
(`fldKDT2x7wmZ2Suui`, currently a **formula**: `ROUND(picked_quantity_rollup /
total_quantity_rollup, 2)`, chained from `order_items` via
`Orders-Shopify.fld6d5ilxzsb9AMvd`) and what closing an order from this UI
is allowed to override.

### Scenario A — `order_items` stays the champion (current assumption holds)

Use if Cobalt confirms `quantity_open`/`quantity_shipped` already reliably
reflect client-hands delivery, or that gap 3 above is a non-issue.

1. Add checkbox `fulfillment_progress_override` on Orders-Shopify (new
   field) — set `TRUE` when staff clicks "Closed" from Appointments (or
   Fulfillment, if that flow later adopts the same "Closed" action).
2. Rewrite `fulfillment_progress_percentage`'s formula to
   `IF(fulfillment_progress_override, 1, ROUND(picked/total, 2))` —
   this is the field consumed by `fulfillment.tsx`'s `ProgressBar`,
   `ReadinessChip`, and (via the client-level rollup chain) the Readiness
   Gate.
3. Also set `fldYq3JxRSWQUUHm6` (Order Status) → `Closed` directly, since
   in this scenario the two signals (item-level override, order-level
   status) are independent facts that should both reflect the same reality.
4. `order_close_out.js` is untouched — it already reads `quantity_open_total`
   (a **separate** rollup chain), not this formula field, so this override
   doesn't change client-level stage transitions. Confirm with Axel whether
   it should (per his answer to Gap 3 in the earlier plan discussion:
   "sí debería ser un tercer camino de cierre" — pending, needs its own
   follow-up once this scenario is chosen).

**Risk**: if the semantics doubt in Gap 3 resolves as suspected (item-level
fields don't mean what we think), this override formula and the checkbox
become dead weight and need to be ripped out in favor of Scenario B.

### Scenario B — `Delivery Status`/`Delivery Method` become the champions

Use if Cobalt confirms `order_items.quantity_open`/`quantity_shipped` mean
production-side completion, not client-hands delivery — i.e. the semantics
doubt in Gap 3 is real.

This is a bigger rework, not scoped to just this feature:

1. `fulfillment_progress_percentage`'s formula source changes from the
   `order_items` rollup chain to a value derived from `DELIVERY_METHOD` +
   `PICKED_STATUS` (Pick Up path) or `Delivery Status`
   (`fldoL5pdUvlz76mkZ`: Unfulfilled/Partial/Fulfilled/Shipped/etc., Ship
   path) — i.e. "did the client actually receive it," read from the
   Shopify-sourced fields that track real-world delivery, not warehouse
   picking.
2. No override checkbox needed for *this* feature specifically — clicking
   "Closed" from Appointments would directly set `PICKED_STATUS = Full`
   (Pick Up path) which then naturally drives the new formula to 100%,
   since the formula's source of truth is the same field the button
   writes.
3. **Blast radius**: `fulfillment.tsx`'s Readiness Gate, `pipeline.tsx`'s
   reuse of the same `ORDER_FIELD_IDS`, `order_ready_evaluation.js`
   (currently reads `picked_status_percentage`/`gown_picked`), and
   `order_close_out.js` (`quantity_open_total` rollup) may all need their
   source fields re-pointed, not just this new Orders table. Tracker item
   #56 ("Fulfilment Progress Percentage — formula and Apparel Magic data
   problem") is very likely the same root issue — resolving Scenario B
   probably closes #56 as a side effect, but the implementation work
   spans multiple pages, not just Appointments.
4. `client_fulfillment_progress` on DF Clients (rollup of
   `fulfillment_progress_percentage` across a client's orders) keeps working
   unchanged, since it just aggregates whatever the per-order field says —
   it doesn't need its own rework, only its upstream source does.

**Recommendation**: don't build either scenario's override logic until
Cobalt answers Gap 3 — building Scenario A now and discovering Gap 3 is
real means throwing away the override field/formula and redoing it as
Scenario B. The UI/table/dropdown/confirm-alert layer (next section) is
identical either way and can be built now without waiting.

## What's being built now (no Cobalt dependency)

- Orders table inside the Appointments detail modal, scoped to
  `getAppointmentCategory() === 'pick-up-only' || 'combined-pick-up'`
  (the same condition already gating the old Pick Up button — not the
  broader `isFitPickUp` flag).
- Reads `Orders - Shopify` via the client-orders join above (net-new
  `TABLE_IDS.ORDERS_SHOPIFY` + `ORDER_FIELD_IDS` constants in
  `appointments.tsx`, mirrored from `fulfillment.tsx`).
- Renders the 6 requested columns, sorted (pending pickup → picked up →
  ship), using the existing `PICKED_STATUS`/`DELIVERY_METHOD`/`Order Status`
  fields exactly as they read today — **no writes yet**. The dropdown UI
  and confirm-alert flow are being built against this read-only data so
  the visual/UX piece is ready to wire up the moment Cobalt's answers land.

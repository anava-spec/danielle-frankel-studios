---
title: Phase Logic Rulebook — Danielle Frankel Studio
type: rulebook
tags: [rulebook, danielle-frankel, airtable, phase-logic, pipeline, source-of-truth]
priority: critical
related: [CROSS_CUTTING.md, ../2_interface_readmes/pipeline.README.md, ../2_interface_readmes/fulfillment.README.md, ../2_interface_readmes/alterations.README.md, ../2_interface_readmes/appointments.README.md]
last_updated: 2026-08-25 (rev. 2)
owner: Miguel Pérez
status: active — supersedes slack-files/recovered/AIRTABLE PHASE LOGIC.docx (2026-06-26, outdated)
---

# Phase Logic Rulebook — Danielle Frankel Studio

This is the single source of truth for how a bride moves through her customer journey — Waitlist through Closed — across the Pipeline, Appointments, Alterations, and Fulfillment interfaces. `pipeline.tsx` and `alterations.tsx` both hardcode a duplicated `STAGE_ORDER`/`STAGE_STEPS` array (an Interface Extension platform constraint — files run isolated, no cross-file imports) and point back to this document as the reason those arrays must match.

**⚠️ Maintenance rule: update this document every time a phase-transition rule changes** — a new automation, a rewritten trigger condition, a renamed stage choice, a Julia-confirmed logic change. Treat a code change to stage logic and a stale rulebook as the same bug. Axel committed to keeping this rulebook current as an explicit action item out of the Aug 21 DFS Review meeting with Julia — treat that commitment as standing, not one-time.

**Table below is business rules only** — what determines a bride's phase, in plain language. Technical implementation (field IDs, automation names, bug history, code file pointers) lives in **[Implementation Notes](#implementation-notes-technical)** further down, organized by the same phase names, so the table stays readable by non-engineers while nothing technical gets lost.

**Sources synthesized:**
- `slack-files/recovered/AIRTABLE PHASE LOGIC.docx` (Jun 26, 2026) — original phase-logic reference, now outdated in several places.
- Julia Collins, "Order ready + fulfillment — the full picture" email (Aug 20, 2026) — the most recent full rewrite of Order Ready/Alterations/Fulfillment logic.
- Julia Collins, "Feedback and Instructions — Next Two Weeks" (Aug OOO doc) — Order Ready entry-condition detail, Picked/Picked Up glossary.
- **"DFS - Review" meeting, Aug 21 2026** (Axel, Julia, Miguel, Laura, Mairene, Alonso — via Read.ai) — live confirmation with Julia of the exact Order Ready gown/50% test, the picked/allocated/shipped definitions, order-level (not client-level) workflow after Order Ready, and the triage-interface field list. This is the session where Axel committed to producing this rulebook.
- **"DFS - Cobalt x Singular" meeting, Aug 2026** (Axel, Julia, Nadiia, Cassidy, Rob, Nick — via Read.ai) — confirms the checklist/formula-driven stage model, the "shipped" choice being retired, and "Picked Up" being renamed (matches the live Fulfilled rename below).
- `pipeline.README.md`, `fulfillment.README.md`, `alterations.README.md`, `appointments.README.md`, and the Waitlist session summaries — as-built implementation notes.

Where sources conflict, **this document reflects what's actually live in Sandbox/Production today**, with confirmed-but-not-yet-built items called out explicitly as "Pending" so nobody mistakes a stated intention for a shipped rule.

---

## Phase Table

| Phase | Scope | Rules |
|---|---|---|
| **Waitlist** | Leads who asked for a specific studio date/time but haven't been booked into an appointment yet — not yet a client in the pipeline | • She's a lead the moment someone submits a date/time request; she stays "Active" until matched to a real client.<br>• A match — automatic (when a new client record is created with a matching name/email/phone) or manual by staff — resolves her and starts her real journey at Pre-Appointment; being on the Waitlist never counts as her first appointment.<br>• If she's flagged as an exception (duplicate entry, not a real lead), she's excluded from staff to-dos and from Pipeline entirely.<br>• Julia is alerted if a requested date is 5+ days out and still unresolved, and again if the requested date has already passed with nothing done. |
| **Pre-Appointment** | Brides who've scheduled an appointment but haven't come in yet — **or** who've never purchased and haven't been seen by the studio in 6+ months | • Client has a scheduled appointment and this is her first one (total appointment count = 1).<br>• Also includes brides who haven't purchased anything and whose last appointment was more than 6 months ago (see Known Gaps — this overlaps with Did Not Convert's own time-based rule and needs a precedence call from Julia).<br>• Never shows measurements, photos, or favorite-style flags — those only make sense once she's actually visited the studio. |
| **Deliberating** | Brides who've had a first appointment (including 2nd/3rd-visit returns) but haven't purchased yet | • By end of day, if her appointment wasn't cancelled — whether she checked in, was cleared, or was never checked in at all — she moves from Pre-Appointment into Deliberating automatically. |
| **Sold** | Brides who've purchased | • She has a completed order on her record. In Julia's own words: before this point, "not enough of her stuff is picked yet." |
| **Order Ready** | Brides whose order (or enough of it) is ready to move into triage — Alterations, or Fulfillment for shipping/pickup | • If she bought a gown, she qualifies as soon as that gown is picked (physically pulled and set aside for her) — the gown condition always wins over the percentage rule below.<br>• If she didn't buy a gown (separates/accessories only), she qualifies once more than half of her order is picked.<br>• She only qualifies while nothing on that order has shipped yet — picked resets to zero once something ships, so a fully-shipped order should never look Order Ready again.<br>• A bride shipping one item and picking up another can appear as two separate jobs, each tracked and closed on its own — one row per real next-step, not one row per bride.<br>• This is a **triage step, not a resting stage** — every order passes through it just long enough to be routed into exactly one of the two rows below (Alterations, or Fulfillment), then moves on. It has no logic of its own beyond that routing decision. |
| **Alterations** *(triage outcome — in-house route)* | Brides with a scheduled alterations appointment | • She enters this phase the moment her alterations appointment is **booked**, not when she checks in for it.<br>• She can't move into Alterations until she's actually paid — if she booked before paying, she's flagged "booked but didn't pay" and held until a Shopify order with Alterations on it comes through.<br>• If she pays for alterations in person in NY or LA, she must be charged that state's tax rate at the time. |
| **Fulfillment** *(triage outcome — ship/pickup route)* | Brides who are Order Ready but not doing in-house alterations — just waiting on shipping or pickup | • She's routed here once Order Ready and Alterations isn't part of her order.<br>• What happens next depends on her appointment: a Final Fitting & Pickup where she actually leaves with the gown skips this phase entirely (closed directly); if she doesn't leave with it, or she only booked a plain pickup, or she's shipping, she lands here and closes once pickup/tracking completes. |
| **Closed** | The order is fully wrapped up — nothing left to ship, pick up, or invoice | • Closes automatically once nothing is outstanding on her order(s), or a staff member manually marks her closed for edge cases.<br>• Longer-term goal (not yet built): driven by real Apparel Magic invoicing instead of the current automated check — each item's invoice closes that part of the order, and the whole order closes once every item is invoiced. This also properly handles partial shipments, which today's mechanism doesn't. |
| **Did Not Convert** | Brides who haven't purchased, haven't had an appointment in 4+ months, have nothing scheduled, and whose wedding is 5+ months away | • Last appointment more than 4 months ago, no purchase, wedding date still more than 5 months out.<br>• Includes a reason (e.g. "went with another designer") plus free-text notes, kept separate from the general Change Log. |

---

## Cross-cutting business rules (apply across every phase)

- **One phase, computed live, every time.** Phase is never something staff set directly — it's always derived from the underlying facts (appointments, orders, picked/shipped status) by an automation, per Julia: "the system needs to work out her phase from the current facts every time."
- **A bride is only ever on one operational screen at a time** — Order Ready, Alterations, or Fulfillment — never duplicated across two of the three. Multiple *rows* for one bride within Order Ready (split fulfillment methods on one order) are the one intentional exception.
- **After Order Ready, tracking moves to the order/product level, not just the client level** (confirmed with Julia, Aug 21) — a bride can have multiple orders in different states at once, so "her phase" alone stops being enough information once she's past Order Ready.
- **Stage movement isn't strictly one-directional.** Customer-service situations (an order gets amended, alterations get added after the fact) need a record to move backward or sideways, not just forward — the phase logic has to support that, plus a manual override for genuine edge cases.
- **Hold dates genuinely block, not just delay.** A gown that lands months before a hold date shouldn't sit as a live task the whole time — before the hold date passes, the row is visible but not actionable. *(Pending — not yet built as a hard block.)*
- **Address source-of-truth, once decided, sticks and syncs back to Apparel Magic.** When a shipping address is confirmed (Shopify vs. Acuity vs. manually typed), the chosen value is stored as its own field per order — not a pointer back to whichever system it came from — and gets sent to Apparel Magic; past confirmed addresses stay available as reusable options later. *(Confirmed direction with Julia, Aug 21; sync-back to Apparel Magic still pending Nadiia.)*
- **Tax validation, order adjustments, and refunds are deliberately out of scope for now** — Julia's direction (Aug 21): don't interpret or over-engineer tax differences between Shopify and Apparel Magic; hide this functionality until a later phase.
- **Glossary — exact meanings, confirmed by Julia (Aug OOO doc + Aug 21 meeting):**
  - **Picked:** a specific physical garment in inventory has been assigned to a specific client's order. Does **not** mean the client has collected it.
  - **Picked up:** the client has physically collected the garment. Different from "Picked."
  - **Allocated:** "calling dibs" on a garment before it's physically pulled — confirmed largely unused/not meaningful on its own; Picked is the field that matters operationally.
  - **Shipped:** indicates completion of that item — covers both an actual shipment **and** a client pickup. An order item counts as closed once its shipped quantity = 1.
  - **Order Ready:** the garments in the order are ready to be given to the client, whether via alterations, shipping, or pickup.
  - **Separates:** an order of two or more pieces instead of one gown (e.g. skirt + top) — why Order Ready's entry rule uses a percentage threshold rather than requiring the gown specifically when no gown was purchased.
- **Things deliberately not being built yet:** client-facing Order Ready emails staying manual (no automation); blocking Acuity alterations bookings for unpaid brides; closing Fulfillment on actual carrier-delivery confirmation instead of a timer/invoice signal.

---

## Known Gaps between "Rulebook" and Live System (flag before trusting either blindly)

- **Order Ready threshold:** live production still uses the older rule (gown picked **OR** overall >75% picked). The confirmed-with-Julia redesign in this table (gown picked **OR** >50% picked, gated by shipped% = 0%) is **not yet built**. Don't assume the 50% number is live.
- **Order Ready filter execution bug (open since Jul 15):** the "Order Ready" filter can show no results even when the underlying rule is correct — a filter-execution bug, not a logic error. Verify against raw field values when debugging, not the filtered view.
- **Pre-Appointment's new 6-month rule (added 2026-08-25) overlaps conceptually with Did Not Convert's 4-month rule** — both key off "time since last appointment" for a bride who hasn't purchased. Needs an explicit precedence decision from Julia (e.g., does she land in DNC first at 4 months and never re-enter Pre-Appointment, or is Pre-Appointment meant to re-surface her before DNC does at the 6-month mark for a different reason?) before this is built.
- **Fulfilled → Closed:** the live Airtable choice field is still literally named `"Fulfilled"` (renamed from `"Picked Up"` on 2026-08-20). This rulebook calls the phase "Closed" per the latest business-language direction; treat "Fulfilled" (system) and "Closed" (business/rulebook) as the same phase until the field itself is renamed — don't build against a `"Closed"` choice value that doesn't exist yet.
- **Closed's terminal logic has two different mechanisms in flight:** the live implementation closes via rollup math (`quantity_open_total = 0`) or a manual override checkbox; Julia's Aug 20 email and the Aug 21 meeting both ask for real Apparel Magic invoicing to drive this instead. These describe the same transition two different ways — reconcile with Julia/Nadiia before changing either without the other.
- **Waitlist's Exception state isn't fully wired into Pipeline yet** — as of the 2026-08-11 session, `pipeline.tsx`'s Waitlist Kanban column/List rows only filter on Active + unmatched, and don't yet exclude `resolution_status = Exception` records.
- No dedicated "hold reason" field exists yet at client or order level — the hard-block-on-hold-date rule can't be built until this exists.
- Tax rate calculation and freight/shipping charge calculation are explicitly out of scope for anything shipped so far — still using existing/unverified values, not sourced automatically per state.
- **Order Ready is reported to sometimes look "empty"** (Cobalt meeting): orders without alterations can move straight from Order Ready into Fulfillment fast enough that Order Ready never visibly holds them — being discussed as a nonlinear/condition-based stage model rather than a strictly linear one, so a bride can re-enter a stage (e.g. adding alterations after the fact) instead of only ever moving forward.

---

## Implementation Notes (technical)

Field IDs, automations, and fix history — organized by phase, kept out of the business table above so that table stays readable at a glance. See each interface's own README for full detail; this section is a pointer/summary, not the full record.

### Waitlist
- Lives in its own `Waitlist` table (`tblbm3hKDShEPNpoq`), not `DF Clients.stage` — matching is what connects a Waitlist record to a `DF Clients` record via `resolved_by_df_clients_record`.
- `resolution_status` (`fldiEQbjks80y5xTi`): Active / Resolved / Exception — one field drives Pipeline exclusion, both alert automations, and the native Follow-Up page filter (an earlier separate `is_exception` checkbox was superseded by this and marked deprecated for manual deletion).
- Automations: `Waitlist - Match New DF Client` (`wflPC6fOUORtGMzUT`), `Waitlist - Alert Julia: Unresolved Within 5 Days` (`wflYo3IaYJFq1Rn12`), `Waitlist - Notify Julia: Overdue & Unmatched` (`wflpbJ5gcsx8rV7Qx`) — see `waitlist_matching.js`, `waitlist_alert_readiness.js`, `waitlist_overdue_alert.js` in `automations/`.
- Surfaced in `pipeline.tsx`: leftmost Kanban pseudo-column (`WaitlistCard`, Active + unmatched only, oldest `earliest_date_requested` first), a separate List View `<tbody>`, and a read-only section in `FullProfileModal`'s All-Stages view, positioned before Pre-Appointment.
- 95 records migrated sandbox → production 2026-08-11; 47 auto-matched to existing DF Clients, 6 flagged ambiguous (unresolved as of that session), 41 with no plausible match. Full detail: `session_summaries/2026-08-11_waitlist-pipeline-overdue-automation-production-migration.md`.

### Pre-Appointment / Deliberating
- Deliberating's automatic transition is implemented as a Run-a-Script step on the **"NY Client Clears - Slack Message"** automation (moved out of `appointments.tsx`'s frontend `handleClear` — never re-add this logic to the frontend).
- The 6-month Pre-Appointment addition (2026-08-25) is not yet implemented in any automation — business rule only, pending build + the precedence decision flagged in Known Gaps.

### Sold
- Determined by a Shopify order being linked to the client record. No dedicated automation beyond the sync itself.

### Order Ready
- **Live automation** (writes `DF Clients.stage`): gown item's `Category Lookup` (`fldSF1GXY5MgiAXdl` = `"GOWN"`) picked **OR** `picked_status_percentage` (`fldjC8M11Pis7eMxF`) > 75%. Percent-formula fields return decimal fractions via API — compare against `1` with epsilon tolerance, never `100`.
- **Confirmed redesign (Julia, Aug 20 email + Aug 21 meeting, pending build):** Condition A (gown picked, OR >50% of order picked — gown always takes precedence) **AND** Condition B (order's shipped% = 0%, since invoicing resets picked% to 0% and sets shipped% to 100%, which would otherwise make a just-closed order look Order Ready again).
- Multi-row-per-bride (split fulfillment methods) needs `order_items`-level picked%/shipped% from Cobalt — not yet scoped as a story.
- Known open execution bug (Julia, Jul 15): "Order Ready" filter shows no results despite correct underlying logic — don't touch the threshold to fix this, fix the filter.

### Alterations
- Trigger point fix (Jul 15): must fire at scheduling, not check-in.
- Alterations-paid gate (Aug 20 email, pending): flag "booked but didn't pay," block entry to Alterations until a Shopify order with an Alterations line item exists.
- Tax correctness (Aug 20 email): NY 8.875%, CA 9.75% — auto-paid if pickup was selected in Shopify; additional payment needed if the bride changes her mind.
- `alterations.tsx`'s live list is read-only, sourced from `most_recent_alterations_lead` (`fldWxPkO98xA8OF8y`) after `next_appointment_alterations_lead`'s hidden Airtable-side filter caused a real-data gap (Zoia Kozakov case, fixed 2026-08-24 — see `pipeline.README.md`).

### Fulfillment
- Champion automation: `"No Alts/Order Ready - Update Phase to In Fulfillment"` — confirmed authoritative after a 7-phase audit found 3 conflicting automations; the other two were deleted. Gate checks `Stage` only (fixed 2026-07-22 — previously also required non-empty `Items Sold` + future `Wedding Date`, silently dropping ~80% of legitimate clients).
- Appointment-type routing table (Aug OOO doc): Final Fitting & Pick Up + `picked_up` ticked → Closed directly, never touches Fulfillment. Final Fitting & Pick Up without `picked_up` ticked → Order Ready's confirm-address flow → Fulfillment. Plain Pick Up → Fulfillment, closes on reception ticking "picked up." Confirmed shipping address → Fulfillment, closes on tracking number + invoicing.

### Closed (system field still named "Fulfilled")
- Renamed from `"Picked Up"` to `"Fulfilled"` on 2026-08-20 (choice ID `sel9gJfBcN2v0VLTc`) after confirming two other deployed automations targeting this field had zero production runs.
- **Live close-out (v3.0.0, 2026-08-20):** Path A — `quantity_open_total = 0` on `DF Clients`, a rollup chain from `order_items.quantity_open` filtered to exclude Alterations-category items. Path D — manual override checkbox `sa_override_fulfilled`. Paths B (appointment-confirmed pickup) and C (tracking#+100% shipped) were evaluated and dropped — C in particular ran through a field literally named `"Shipped (num, 0-1) (deprecated)"`, the wrong source of truth.
- Trigger: "record enters view" on `fulfillment_ready_to_close_out`, not `recordUpdated` (which re-fired on every intermediate change even when the record still didn't qualify).
- Pending: real Apparel Magic invoicing (per-item invoice closes that item; whole order closes once every item is invoiced) — see Known Gaps for why this coexists with the rollup-based Path A/D above rather than having replaced it yet.

### Did Not Convert
- Implemented as an automated stage transition (120-day / 4-month threshold) rather than a distinct interface file. Reason dropdown + free-text notes added Jul 15.

---

## Cross-References

- [`CROSS_CUTTING.md`](CROSS_CUTTING.md) — shared rules across all DFS interfaces (Cobalt boundary, dark mode, sandboxing).
- [`../2_interface_readmes/pipeline.README.md`](../2_interface_readmes/pipeline.README.md) — `pipeline.tsx` implementation detail, field IDs, fix history, Waitlist UI.
- [`../2_interface_readmes/fulfillment.README.md`](../2_interface_readmes/fulfillment.README.md) — Fulfillment/close-out implementation detail, field IDs, fix history.
- [`../2_interface_readmes/alterations.README.md`](../2_interface_readmes/alterations.README.md) — Alterations list implementation detail.
- [`../2_interface_readmes/appointments.README.md`](../2_interface_readmes/appointments.README.md) — Appointments/Slack automation implementation detail, incl. Deliberating-phase transition script.
- [`../session_summaries/2026-08-11_waitlist-pipeline-overdue-automation-production-migration.md`](../session_summaries/2026-08-11_waitlist-pipeline-overdue-automation-production-migration.md) — full Waitlist build session, key IDs.
- [`../../04-playbooks/interfaces.md`](../../04-playbooks/interfaces.md) — broader interface functional specs beyond just phase logic (columns, sidebars, per-interface scope).
- [`../../slack-files/recovered/AIRTABLE PHASE LOGIC.docx`](../../slack-files/recovered/AIRTABLE%20PHASE%20LOGIC.docx) — original source doc (Jun 26, 2026), now superseded by this rulebook.

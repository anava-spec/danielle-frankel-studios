---
title: Phase Logic Rulebook — Danielle Frankel Studio
type: rulebook
tags: [rulebook, danielle-frankel, airtable, phase-logic, pipeline, source-of-truth]
priority: critical
related: [CROSS_CUTTING.md, ../interfaces/danielle_frankel_studios/readmes/pipeline.README.md, ../interfaces/danielle_frankel_studios/readmes/fulfillment.README.md, ../interfaces/danielle_frankel_studios/readmes/alterations.README.md, ../interfaces/danielle_frankel_studios/readmes/appointments.README.md]
last_updated: 2026-08-25
owner: Miguel Pérez
status: active — supersedes slack-files/recovered/AIRTABLE PHASE LOGIC.docx (2026-06-26, outdated)
---

# Phase Logic Rulebook — Danielle Frankel Studio

This is the single source of truth for how a bride's client record moves through `DF Clients.stage` across the Pipeline, Appointments, Alterations, and Fulfillment interfaces. `pipeline.tsx` and `alterations.tsx` both hardcode a duplicated `STAGE_ORDER`/`STAGE_STEPS` array (an Interface Extension platform constraint — files run isolated, no cross-file imports) and point back to this document as the reason those arrays must match.

**⚠️ Maintenance rule: update this document every time a phase-transition rule changes** — a new automation, a rewritten trigger condition, a renamed stage choice, a Julia-confirmed logic change. Treat a code change to stage logic and a stale rulebook as the same bug. When you update a rule here, also check whether `pipeline.README.md` / `alterations.README.md` / `fulfillment.README.md` / `appointments.README.md` need the matching note in their own Rules sections — this doc is the *summary of record*, the READMEs carry the full implementation detail and file/field IDs.

**Sources synthesized:**
- `slack-files/recovered/AIRTABLE PHASE LOGIC.docx` (Jun 26, 2026) — original phase-logic reference, now outdated in several places (see inline notes below).
- Julia Collins, "Order ready + fulfillment — the full picture" email (Aug 20, 2026) — the most recent full rewrite of Order Ready/Alterations/Fulfillment logic; several pieces are **confirmed direction, not yet built**.
- Julia Collins, "Feedback and Instructions — Next Two Weeks" (Aug OOO doc) — Order Ready entry-condition detail (Condition A/B) and Picked/Picked Up glossary.
- `pipeline.README.md`, `fulfillment.README.md`, `alterations.README.md`, `appointments.README.md` — as-built implementation notes (field IDs, fixed bugs, live status).

Where sources conflict, **this document reflects what's actually live in Sandbox/Production today**, with Julia's Aug 20 email's not-yet-built items called out explicitly as "Pending" so nobody mistakes a stated intention for a shipped rule.

---

## Phase Table

| Phase | Scope | Rules |
|---|---|---|
| **Pre-Appointment** | Brides who've scheduled an appointment but haven't come in yet | • Client has a scheduled appointment and their total appointment count = 1.<br>• Should never show measurements/photos/favorite-styles flags — those only apply once a client has actually been to the studio. |
| **Deliberating** | Brides who've had a first appointment but haven't purchased (includes 2nd/3rd-visit brides) | • **Live rule:** by end of day, if an appointment was not cancelled — regardless of check-in/clear/no-show status — the client moves Pre-Appointment → Deliberating. Implemented as a Run-a-Script step on the **"NY Client Clears - Slack Message"** automation (moved out of `appointments.tsx`'s frontend `handleClear`; never re-add this to the frontend).<br>• Original brief's fallback ("1 hour after appointment end time if checked in but clearing wasn't logged") is superseded by the above — the automation no longer depends on the clearing step being logged. |
| **Sold** | Brides who've purchased | • Client has a Shopify order attached.<br>• Per Julia's Aug 20 email, plain-language meaning going forward: "not enough of her stuff is picked yet." |
| **Order Ready** | Brides whose order is ready to move to alterations, shipping, or pickup | • **As implemented today** (automation on `DF Clients.stage`): gown item's `Category Lookup` = `"GOWN"` picked **AND/OR** `picked_status_percentage` > **75%** — either condition alone qualifies. Percent-formula fields return decimal fractions via API (`1.0` = 100%), so compare against `1` with epsilon tolerance, never `100`.<br>• **Known execution bug (Julia, Jul 15, still open):** the "Order Ready" filter shows no results even though the underlying rule is confirmed correct — this is a filter-execution bug, not a logic error. Don't touch the threshold to "fix" this.<br>• **Pending redesign (Julia, Aug 20 + Aug OOO doc — not yet built):** two-condition entry test — **Condition A** (either the order contains a gown that's picked, OR **>50%** of the order is picked — note the threshold drop from 75%→50%) **AND Condition B** (order's shipped % = 0%, to stop a just-invoiced/completed order from re-appearing as Order Ready, since invoicing resets picked% to 0% and sets shipped% to 100%). This 75%→50% + shipped=0% redesign supersedes the live 75% rule above once built — do not treat both as simultaneously true.<br>• **Pending (Aug 20):** an order can produce **two rows** for one bride if she's shipping one item and picking up another (two distinct next-steps) — Nadiia/Cobalt need `order_items`-level picked%/shipped% to split fulfillment method per item, not just per client. |
| **Alterations** *(live choice: "In Alterations")* | Brides with a scheduled alterations appointment | • Client has an alterations appointment scheduled and hasn't picked up yet.<br>• **Trigger point corrected (Jul 15 feedback):** must fire **at scheduling**, not at appointment check-in.<br>• **Alterations paid gate (Aug 20, pending):** a bride can currently book an alterations appointment in Acuity without having paid. New rule: she is flagged "booked but didn't pay" and **cannot move into Alterations until a Shopify order comes through with Alterations as a line item.** (Longer-term idea, explicitly not urgent: block the Acuity booking itself unless already paid.)<br>• **Tax correctness (Aug 20):** if alterations payment/pickup happens in person in NY or LA, she must be charged that state's rate (NY 8.875%, CA 9.75%). Auto-paid if pickup was selected in Shopify; if the bride changes her mind, additional payment must be collected. |
| **Fulfillment** *(live choice: "In Fulfillment")* | Brides who are Order Ready but not doing in-house alterations | • Client is in Order Ready and does not have "Alterations" as an order item. Per `slack-files/recovered/AIRTABLE PHASE LOGIC.docx`'s "Fulfillment" row — confirmed 2026-07-22 as the correct definition after a bug where the gate wrongly also required non-empty `Items Sold` + a future `Wedding Date`, silently dropping ~80% of legitimate clients (fixed; gate now checks `Stage` only).<br>• **Champion automation:** `"No Alts/Order Ready - Update Phase to In Fulfillment"` — confirmed as the single authoritative Fulfillment-stage automation after a 7-phase audit found 3 conflicting deployed automations; the other two were deleted. Treat any second live Fulfillment-stage automation found in the base as a red flag.<br>• **Appointment-type routing (Aug OOO doc):** "Final Fitting & Pick Up" with `picked_up` ticked by reception → **Fulfilled** directly, never touches Fulfillment (she took it home from the fitting). "Final Fitting & Pick Up" with `picked_up` **not** ticked → routes through Order Ready's confirm-address flow → Fulfillment. A plain "Pick Up" appointment → Fulfillment (closes when reception ticks "picked up"). A confirmed shipping address → Fulfillment (closes when tracking number arrives + invoicing completes). |
| **Fulfilled** *(terminal; renamed from "Picked Up" on 2026-08-20)* | Order fully closed out | • **Close-out design (v3.0.0, live 2026-08-20):** two independent paths, either qualifies, both write `stage = "Fulfilled"`: **(A)** `quantity_open_total = 0` on `DF Clients` — a rollup chain (`order_items.quantity_open` → `Orders - Shopify.quantity_open_total`, filtered to exclude Alterations-category items → `DF Clients.quantity_open_total`); **(D)** manual override checkbox `sa_override_fulfilled` — a true override that doesn't require A.<br>• **Paths B (appointment-confirmed pickup) and C (tracking# + 100% shipped) were deliberately dropped** — B's lookups have no other meaningful dependents; C's `percent_shipped` chain runs through a field named `"Shipped (num, 0-1) (deprecated)"`, the wrong source of truth (shipped quantity should come from `order_items`/AM sync).<br>• **Trigger:** "record enters view" on `fulfillment_ready_to_close_out` (DF Clients), filtered to `stage = "In Fulfillment" AND (quantity_open_total = 0 OR sa_override_fulfilled)` — moved off `recordUpdated` because that trigger re-fires on every intermediate field change even when the record still doesn't qualify.<br>• **Pending redesign (Julia, Aug 20):** replace this with real Apparel Magic invoicing at the order level — once a bride has an invoice/invoice ID for part of her order, that part closes; once the invoice is complete, the whole order closes. This properly handles partial shipments, which a fixed one-week timer (Nadiia's current placeholder) does not. Invoicing itself: **auto-created** for shipping once there's a tracking number and shipped quantity = 1; **created manually** for pickups (owner to confirm with Sarah Shim/Dana). When an order is invoiced: shipped% → 100%, picked% resets to 0% (this reset is exactly why Order Ready's pending Condition B above requires shipped% = 0% for entry — otherwise a just-closed order looks Order-Ready again). |
| **Did Not Convert** | Brides who haven't purchased, haven't had an appointment in 4+ months, have nothing scheduled, and whose wedding is 5+ months away | • Last appointment >4 months ago, no Shopify order, wedding date still >5 months out.<br>• Jul 15 addition: reason dropdown (e.g. "went with another designer") + free-text notes, distinct from Change Log. |

---

## Cross-cutting rules (apply across every phase)

- **One phase, computed live, every time.** Per Julia's Aug 20 email: "the system needs to work out her phase from the current facts every time" — phase is never something staff set directly; it's always derived from the underlying data by an automation.
- **A bride is only ever on one operational screen at a time** — Order Ready, Alterations, or Fulfillment — never duplicated across two of the three (Aug 20 email). Multiple *rows* for one bride within Order Ready (split fulfillment methods) are the one intentional exception, tracked as **pending**, above.
- **Hold dates genuinely block, not just delay.** A gown that lands months before a hold date should not sit as a live task the whole time — before the hold date passes, the row is visible but not actionable. (Aug 20, pending — not yet built as a hard block.)
- **Address source-of-truth, once decided, sticks.** When a shipping address is confirmed (Shopify vs. Acuity vs. manually typed), the chosen value is stored as its own field, not a pointer back to whichever system it came from — so a later sync can't silently overwrite a human decision. (Aug 20, pending.)
- **Glossary — exact meanings, per Julia's Aug OOO doc:**
  - **Picked:** a specific physical garment in inventory has been assigned to a specific client's order. Does **not** mean the client has collected it.
  - **Picked up:** the client has physically collected the garment. Different from "Picked."
  - **Order Ready:** the garments in the order are ready to be given to the client, whether via alterations, shipping, or pickup.
  - **Separates:** an order of two or more pieces instead of one gown (e.g. skirt + top) — these also need alterations and are the reason Order Ready's entry condition uses a percentage threshold rather than requiring the gown specifically.
- **Things deliberately not being built yet (Aug 20, explicit non-scope):** client-facing Order Ready emails staying manual (no automation); blocking Acuity alterations bookings for unpaid brides; closing Fulfillment on actual carrier-delivery confirmation instead of a timer/invoice signal (asked about, not committed).

---

## Known gaps between "Rulebook" and Live System (flag before trusting either blindly)

- Order Ready's live threshold is still **75% picked**; Julia's Aug 20/OOO redesign specifies **50%** plus a shipped=0% guard. Not yet implemented — do not assume 50% is live.
- The "Order Ready" filter execution bug (Jul 15) means the *displayed* results may not reflect the correct rule even though the rule itself is right — verify against raw field values, not the filtered view, when debugging.
- Fulfillment's terminal close-out has moved off invoicing-based logic entirely in the live implementation (rollup-based Path A/D) while Julia's Aug 20 email asks for real Apparel Magic invoicing to drive close-out — these are two different mechanisms describing the same terminal transition; reconcile with Julia/Nadiia before changing either without the other.
- No dedicated "hold reason" field exists yet at client or order level (`fld2MAllXcFTSIOVZ` is a lookup, not editable) — the Aug 20 hard-block-on-hold-date rule can't be built until this exists.
- Tax rate calculation and freight/shipping charge calculation are explicitly out of scope for anything shipped so far — flagged repeatedly (Fulfillment README, Aug 20 email) as still using existing/unverified values, not sourced automatically per state.

---

## Cross-References

- [`CROSS_CUTTING.md`](CROSS_CUTTING.md) — shared rules across all DFS interfaces (Cobalt boundary, dark mode, sandboxing).
- [`../interfaces/danielle_frankel_studios/readmes/pipeline.README.md`](../interfaces/danielle_frankel_studios/readmes/pipeline.README.md) — `pipeline.tsx` implementation detail, field IDs, fix history.
- [`../interfaces/danielle_frankel_studios/readmes/fulfillment.README.md`](../interfaces/danielle_frankel_studios/readmes/fulfillment.README.md) — Fulfillment/close-out implementation detail, field IDs, fix history.
- [`../interfaces/danielle_frankel_studios/readmes/alterations.README.md`](../interfaces/danielle_frankel_studios/readmes/alterations.README.md) — Alterations list implementation detail.
- [`../interfaces/danielle_frankel_studios/readmes/appointments.README.md`](../interfaces/danielle_frankel_studios/readmes/appointments.README.md) — Appointments/Slack automation implementation detail, incl. Deliberating-phase transition script.
- [`../../04-playbooks/interfaces.md`](../../04-playbooks/interfaces.md) — broader interface functional specs beyond just phase logic (columns, sidebars, per-interface scope).
- [`../../slack-files/recovered/AIRTABLE PHASE LOGIC.docx`](../../slack-files/recovered/AIRTABLE%20PHASE%20LOGIC.docx) — original source doc (Jun 26, 2026), now superseded by this rulebook.

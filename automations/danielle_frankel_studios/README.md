# Danielle Frankel Studios — Airtable Automation Scripts

This folder holds the source-of-truth JS for every "Run a script" action used
by a Danielle Frankel Studios automation, plus a couple of one-time manual
backfill scripts. Airtable's automation UI has no version control of its own —
these files are what actually gets pasted into each automation's Script step,
and this README tracks what each one does, which automation it belongs to,
and which base it currently targets.

All scripts follow the same OOP/SOLID pattern: a configuration layer
(`TABLE_IDS` / `FIELDS_*` / `CONFIG`), a `Logger` class (A/B/C verbosity),
pure-logic helper classes, `*Repository` classes for all Airtable reads/writes,
a `*Service` orchestrator, and a single `input.config()` call at global scope
before one `try`/`catch` block. On error, the catch block re-throws so Airtable
marks the run FAILED and fires its native failure notification — errors are
never swallowed.

**Base note:** most scripts below target the sandbox base
(`app6Q4xMZ1ngJxiV8`) — mirror to production (`appUC2NFAlURayLx9`) once
verified. The Waitlist scripts target `appMmEE4zyHMGhkkd` — as of 2026-08-11,
confirmed to be Airtable's actual Base Sandbox pairing with
`appUC2NFAlURayLx9` (production): table/field/automation IDs are identical
across both, only record data differs, and automations are literally shared
objects between them (creating/editing one via either base ID edits the same
automation). Waitlist data has already been migrated/backfilled into
production — see `session_summaries/2026-08-11_waitlist-pipeline-overdue-automation-production-migration.md`.

---

## Recurring automations (Script step inside a live trigger)

### `decision_notification.js`
**Automation:** Decision Notification — Record Updated
**Trigger:** `customization_requests` updated (watching `internal_approval_status`, `client_approval_status`)
Whenever Margo, the SA, or the client makes an Approve/Deny decision, notifies
whoever didn't just act — reads `last_decision_by` (written by the interface
itself) to resolve who to notify, builds a Slack + Gmail message with pricing,
style, and denial-reason details, and computes Hybrid's real total from its
two Style-child records when no negotiated price exists yet.

### `new_request_notification.js`
**Automation:** New Request Notification — Record Created
**Trigger:** `customization_requests` created
Notifies Margo of a new customization request (Regular, Hybrid, or a
counter-proposal), skipping the notification entirely for a Regular request
whose every linked pricing item is already Pre-Approved (Hybrid is never
skipped). Excludes Hybrid child records from firing their own notification.

### `attachment_router.js`
**Automation:** Copy Attachment → DF Clients / Proposals — Record Created
**Trigger:** `Attachments` created (via the "Add Attachment" interface form)
**Base:** sandbox only — the Recap interface it serves isn't published to
production yet.
Routes an uploaded file to the right destination by `type`: Measurements /
Appointment Photos append to the linked DF Clients record; Customization
Proposal / Signed Proposal write onto the linked Proposals record (a Signed
Proposal requires the Proposal to already have its unsigned copy); Recap Doc
writes onto the linked Appointment (idempotent — discarded if `recap_doc` is
already set). The staging Attachments record is deleted once its files are
safely copied over.

### `order_ready_evaluation.js`
**Automation:** Order Ready Evaluation — Record Updated
**Trigger:** `Orders - Shopify` updated (watching `picked_status_percentage`, `gown_picked`)
Evaluates Julia's "Order Ready" rule per order — `gown_picked` = TRUE, or
`picked_status_percentage` > 75% — and advances the linked client's `stage`
to "Order Ready" only if they haven't already passed that point in
`STAGE_ORDER`. Never regresses a client who's moved further along.

---

## One-time manual backfills (no trigger — run ad hoc via a button/Run Script)

These exist to catch records that reached a qualifying state before the
matching live automation existed or was working correctly. Each supports a
`dryRun` input (default `true`) — run once to review `log_summary`, then
re-run with `dryRun=false` to actually write.

### `order_ready_backfill.js`
**Source:** `Orders - Shopify` → **Dest:** `DF Clients`
Advances any client to "Order Ready" whose order already qualifies
(`client_stage` not past that point, and `picked_status_percentage >= 75%` or
`gown_picked = TRUE`) but never got the update. Dedupes so a client with
multiple qualifying orders is only updated once.

### `fulfillment_backfill.js`
**Source/Dest:** `DF Clients`
Advances any client to "In Fulfillment" who already meets the live
"No Alts/Order Ready → In Fulfillment" automation's real condition
(`stage = "Order Ready"` AND `Alterations In House = FALSE` AND no linked
order item is category ALTERATIONS, via the client-level formula field
`has_alterations_item`) but never received it.

### `order_close_out.js`
**Automation:** Order Close Out - In Fulfillment to Fulfilled (`Order Close Out v2 - In Fulfillment to Fulfilled`, `wfl2t4lgiPEzMLa5w`)
**Trigger:** Record enters view `fulfillment_ready_to_close_out` on `DF Clients`
(filtered to `stage = "In Fulfillment" AND (quantity_open_total = 0 OR sa_override_fulfilled)`)
Closes a client out of `"In Fulfillment"` to `"Fulfilled"` if either path
qualifies: (A) `quantity_open_total == 0` (a chained rollup —
`order_items.quantity_open` → `Orders - Shopify.quantity_open_total` → `DF
Clients.quantity_open_total` — with ALTERATIONS items excluded via the
Orders-level rollup's own linked-record filter, the Issue 2 fix); (D) the
manual exception checkbox `sa_override_fulfilled` — a true override,
doesn't require A. Two other paths (appointment-confirmed pickup, and
tracking + 100% shipped) were designed and then dropped before shipping —
see `fulfillment.README.md` for the full history, including the three
absorbed/deleted legacy automations (all with zero production runs) and why
the API can't build a `recordMatchesConditions` trigger with nested OR-of-AND
logic (the view-based trigger above is the workaround, built by hand in the
Airtable UI).

### `deliberating_achieved.js`
**Automation:** `Deliberating Achieved - Consolidated` (`wflfSURIS1zTby6Zo`)
**Trigger:** Record enters view `stage_auto_advance` (`viwYWqT6ETnH5qkdP`) on
`DF Appointments - Acuity` (filter: `Cleared = TRUE` OR the 1hr-after-
appointment-end backup condition)
Part of the stage rework (`stage_rework_handoff.md`) — writes
`DF Clients.deliberating_achieved = TRUE` for the linked client, replacing two
separate live automations that each wrote `stage = Deliberating` directly:
`"NY Client Clears - Slack Message"` (kept — only its stage-writing script
node was removed, the Slack notification step is untouched) and
`"Auto-Advance to Deliberating Backup"` (deactivated, not deleted).

### `stage_rework_facts_backfill.js`
**Source/Dest:** `DF Clients` (one-time manual run, not a live automation)
Two phases. **Phase 1** backfills `order_ready_achieved`,
`deliberating_achieved`, `did_not_convert_achieved`, and
`alterations_scheduled_achieved` for clients who reached that milestone
before these checkboxes existed — inferred from their current `stage` value
against `STAGE_ORDER` (plus, for alterations, whether `Latest Alterations
Appointment` was already non-empty). **Phase 2** (v1.2.0, per Axel — he wants
to show Julia `stage` reconciled with `stage_formula_test` before converting
`stage` to a formula) directly corrects `stage` for exactly two confirmed-safe
mismatch classes: FROM `"In Alterations"` to whatever `stage_formula_test`
says (the Aug 20 incident's residue), and FROM `"In Fulfillment"` to
`"Fulfilled"` only (`Order Close Out v2`'s `recordEntersView` trigger never
re-fires for pre-existing matches). Every other mismatch class is deliberately
left alone for manual review. `DRY_RUN` defaults to `TRUE`; Phase 1 never
writes `FALSE`.

---

## Waitlist project (JuliMigLui37091) — base `appMmEE4zyHMGhkkd` (shared with production `appUC2NFAlURayLx9`)

Three scripts. All follow the same pattern: hand-write the Script step's logic
because Airtable's automation-builder API can't express what's needed
declaratively (can't concatenate two dynamic fields for a strict text-equals
filter, can't express "match only if both sides have a value," can't compute
business days or a rolling anti-spam window). **`customScript` nodes are fully
read-only through the Airtable MCP toolkit used to build these** — they can
only be pasted into the Script step by hand in the Airtable UI, never created
or edited via API. All three are wired and live as of 2026-08-11.

`resolution_status` (singleSelect) is the single source of truth for a
Waitlist record's state: **Active** / **Resolved** (matched to a DF Client) /
**Exception** (Julia has flagged it as never becoming a DF Client — a plain
select choice, not a separate field). Both alert scripts below key off this
one field.

### `waitlist_matching.js`
**Automation:** Waitlist - Match New DF Client
**Trigger:** `DF Clients` created
**Script input:** `dfClientRecordId` ← the trigger record's ID
When Acuity creates a new DF Clients record, checks every Active Waitlist
record for a match per spec 2.2, in order: (1) name — DF Clients First+Last
exactly equals `bride_name`, case-insensitive/trimmed, no fuzzy matching; (2)
email — only checked if both sides have one; (3) phone — only checked if both
sides have one, normalized to digits-only. On a confirmed match, sets
`resolution_status = Resolved`, stamps `resolved_at`, and links
`resolved_by_df_clients_record` to the new client. If more than one Active
record passes all three checks (spec 4.3 — duplicate bride entries), resolves
only the first by creation order and leaves the rest Active for the alert
script to catch later.
**Outputs:** `status`, `matchFound`, `resolvedRecordId`, `resolvedBrideName`,
`skippedDuplicateIds`, `error_message`, `log_summary`.

### `waitlist_alert_readiness.js`
**Automation:** Waitlist - Alert Julia: Unresolved Within 5 Days
**Trigger:** `Waitlist` matches conditions (Active + `resolved_by_df_clients_record`
empty + `earliest_date_requested` not empty)
**Script input:** `waitlistRecordId` ← the trigger record's ID
Decides whether the triggering record is due for Julia's review-alert email
right now — Active, unmatched, `earliest_date_requested` within the next 5
*business* days (Mon–Fri, computed properly rather than approximated as 5
calendar days), and not already alerted within the last 24 hours. If
eligible, stamps `last_alert_sent` itself (so a slow downstream node can't
double-send) and returns a ready-made subject/message. It never sends the
email — wire its `shouldSend` output into a Conditional Logic step gating the
automation's native Send Email action, reading `toEmail`/`subject`/`message`
from this script's outputs.
**Outputs:** `status`, `shouldSend`, `toEmail`, `subject`, `message`,
`error_message`, `log_summary`.

### `waitlist_overdue_alert.js`
**Automation:** Waitlist - Notify Julia: Overdue & Unmatched
**Trigger:** `Waitlist` matches conditions (Active + `resolved_by_df_clients_record`
empty + `earliest_date_requested` not empty)
**Script input:** `waitlistRecordId` ← the trigger record's ID; `is_prod` ←
literal `true` on production's copy of this step, `false` on sandbox's (the
automation object is shared between environments, so the script can't infer
this from the base ID it happens to run in)
The more urgent companion to the 5-day heads-up alert above: fires once
`earliest_date_requested` is **today or already in the past** and the record
still hasn't been marked `overdue_notified` (a checkbox anti-spam guard —
fires once per record, not on a rolling window, since this feeds a Follow-Up
page meant to be worked as a backlog rather than re-pinged). The email links
directly to the record's detail page in the Waitlist Follow-Up interface
(sandbox or production URL, picked by `is_prod`), so Julia can jump straight
to linking the client or marking it Exception.
**Outputs:** `status`, `shouldSend`, `subject`, `message`, `error_message`,
`log_summary`.

**Known data-model note:** `dates_requested` is free text (e.g. "before July
27th"), not a real date. `earliest_date_requested` is now a **formula field**
fed by an AI field (`date_requested_parser`) that parses `dates_requested`
automatically — no manual staff data entry required going forward (this
replaced the original plain Date field staff had to fill in by hand).

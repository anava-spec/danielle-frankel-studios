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
verified. The Waitlist scripts target the separate sandbox base used for that
project (`appMmEE4zyHMGhkkd`) — mirror to `appUC2NFAlURayLx9` (production,
same base as the rest) once verified.

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

---

## Waitlist project (JuliMigLui37091) — base `appMmEE4zyHMGhkkd`

Two scripts implementing `waitlist_definitions.md` sections 2–4. Both replace
declarative automation nodes that turned out to be inexpressible through
Airtable's automation-builder API: it can't concatenate two dynamic fields for
a strict text-equals filter, can't express a conditional "match only if both
sides have a value" rule, and can't compute business days or a rolling
anti-spam window. Both are currently unwired — drop them into their
automation's Script step and connect the inputs/outputs described below.

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

**Known data-model caveat:** `dates_requested` is free text (e.g. "before
July 27th"), not a real date, so the alert can't reason about it directly. A
companion real Date field, `earliest_date_requested`, was added to the
Waitlist table for this — it's populated for the original 9 imported Active
records except one ("before July 27th" has no earliest bound to parse), and
needs to be filled in by staff going forward for the alert to fire.

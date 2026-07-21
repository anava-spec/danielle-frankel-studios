# Appointments

Group: Daily Ops · File: `appointments.tsx`

> See [`docs/CROSS_CUTTING.md`](../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Manage and display bridal appointment scheduling (NY studio scope only — LA explicitly out of scope) with reliable Slack notifications for check-in and room-cleared events, and correct handling of no-client bookings (block time).

## Inputs

- Acuity-synced appointment data (via Cobalt) — no Acuity write-back fields or automations exist in the base (deprecated)
- `slack_id` field (manually created: `fldPBy4cPpVm8n1wp`, since Sandboxing blocks API field creation) for Slack notification targeting; a complete Staff Table with Slack IDs was a prerequisite for enabling notifications
- Stakeholders: Julia Collins (confirmed Acuity write-back fully deprecated, validated NY-only scope for room-cleared notifications), DFS NY studio staff

## Outputs

- Two Slack automations: "Client Arrival Slack" (check-in) and "NY Client Clears - Slack Message" (room-cleared) — both confirmed active
- No write-back to Acuity (fully deprecated, Julia-confirmed)

## Workflow

1. Appointments sync in from Acuity via Cobalt into the interface.
2. Staff view/manage appointments — including "Block Time" entries, which must render even when they have no linked client.
3. On check-in, "Client Arrival Slack" fires. On room-cleared (`Cleared = true`, field `fldE1Ke90UVdyUFL1`), "NY Client Clears - Slack Message" fires — this automation also now carries the Deliberating-phase stage-transition logic (moved here from a frontend hardcode; see Rules).
4. Same-day changes to room/SA/alteration lead are intended to sync back — this is dependent on a third-party update from Cobalt and was still pending as of the last review.

## Rules

- Block Time fix: removed a `filteredRecords` filter that was silently discarding all appointments with no linked client — Block Time records must display via an `isBlockTime()` helper across list view, calendar cards, and the detail drawer.
- Acuity write-back is fully deprecated — never write back to Acuity from this interface (Julia-confirmed; Julia will not use Acuity going forward).
- LA is explicitly out of scope; NY-only for room-cleared notifications specifically.
- `Error Logs` table is Cobalt-exclusive and not writable from this interface; Slack automation native logs are sufficient for failure tracking — no separate error-handling UI was built.
- `slack_id` values are populated post-story-closure (manual step, not automated) — as of the last known state, 17 of the ~31 DFS staff still lacked Airtable access/Slack IDs, so notification coverage may be incomplete until that catch-up is done.
- Deliberating-phase stage transition: previously hardcoded in `appointments.tsx`'s `handleClear`; now lives as a Run-a-Script step on the "NY Client Clears - Slack Message" automation. Do not re-add this logic to the frontend.
- Known open bug (as of Julia's Jul 15 feedback, not yet fixed): a day/month inversion in the Acuity date sync (e.g., 12 Jun showing as Dec 6) causes clients to appear stuck in "Sold" instead of "Alterations." This is a recurring Acuity formatting issue, not isolated to one record — flag any date-parsing work here as high priority.

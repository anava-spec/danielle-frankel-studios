# Appointments

Group: Daily Ops · File: `appointments.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

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
- **Wedding Date audit (2026-08-22):** the detail drawer's Wedding Date (opened by clicking an appointment row) now reads a single field, `DF Clients:wedding_date_display` (`fldfDHXcCEbFHEX4a`) — a formula that already falls back from `Wedding Date (Formatted)` to `Wedding Date (If Not Set)` — instead of reading both fields separately and building the fallback by hand. Same consolidation already applied to Fulfillment/Alterations/Sold Orders. `formatWeddingDateDisplay()` parses a real `MM/DD/YYYY` date first (formatting it like before, no `(approx.)` suffix); any other non-empty text is shown as-is with `(approx.)` appended, matching the previous UX exactly. Free placeholder text is never handed to `new Date()`, so a stray month/year token inside it (e.g. "early October 2026") can't get silently misparsed into a fabricated date.
- **Missing-Data flags soft/hard split (Issue #32/#45, 2026-08-24):** `hasRequiredData` (gates the Check In button, both list and calendar-card layouts) now checks only the linked Client — Room/Sales Associate/Alterations Lead no longer block Check In. `MissingDataPill` takes `label`/`severity` props: Client is `severity="hard"` (red); Room/Sales Associate/Alterations Lead are `severity="soft"` (amber), rendered inline in both layouts even when present-but-empty (previously silently omitted or, for Alterations Lead, shown as red "missing" text). Per Axel's follow-up feedback, `MissingDataPill` renders as plain colored text — no chip/pill background — so it doesn't visually compete with the real Stage/Type pills in the same row, and labels are spelled out in full ("Missing Sales Associate"/"Missing Alterations Lead", not "SA"/"AL"). The blocking pill text on the Check-In button itself changed from generic "Missing Appointment Data" to "Missing Client", since that's now the only thing it can mean. The list layout's Check In/Clear/Pick Up buttons and status pills also moved up one font-size tier and share a fixed width (`w-[132px]`) instead of a min-width, so every button state lines up at the same length; the "Pick Up Pending" status was renamed to "Pending Pick Up". The list table's column headers now center over their (also newly-centered) body content, except Time which stays left-aligned.
- **RTW Size made editable in the detail drawer (2026-08-24, per Axel — part of the base-wide RTW Size convention, see `docs/CROSS_CUTTING.md`):** the First Visit/Consultation section's "Ready to wear size" row previously read `Size from Acuity Intake` (the customer's own self-report) directly, with no manual/formula split. Replaced with a new `RtwSizeField` component: when the viewer can edit `DF Clients`, it's an editable number input writing only to `ready_to_wear_size_manual` (`fldEEH4CK3Qqp0g0C`); otherwise it falls back to a read-only display of `ready_to_wear_size` (`fldSwfR25uvynWKI5`, the manual-with-Acuity-fallback formula). In both cases the Acuity value shows only as a non-editable label reference — "Ready to wear size | Acuity Size: N" (or "Acuity Size: Missing Value" when absent) — via a new local `rtwSizeLabelWithAcuity()` helper, same convention as `pipeline.tsx`/`recap.tsx`. `DetailRow`'s `label` prop widened from `string` to `React.ReactNode` to support it.
- **Field labels in the detail drawer changed from uppercase to capitalized (2026-08-24, per Axel):** `DetailRow`'s label styling and the standalone "Appointment notes" label both switched from `uppercase` to `capitalize` — cosmetic only, no label text changed. Section headers ("Appointment details", etc.) were deliberately left uppercase, since the request was scoped to field labels.
- **Alterations Lead false-positive fix (2026-08-24):** `isAlterationsAppt` previously read the `apptCategory` formula field (`fldZ45u0N2GzukwO4`), a broader workflow bucket that also groups appointment types like "Final Fitting & Pick Up" under "Alterations" (its formula matches the word "fitting"). That caused the Missing Alterations Lead flag to fire on non-Alterations appointments. Fixed in both layouts to compare against the appointment's own Type value (`appointment_type`, `fldZO3rF3KOGxG0S5`) being literally `"Alterations"` instead.
- **"Client Arrival Slack" automation rework (2026-08-24, pending Axel wiring):** the check-in Slack message was a single hardcoded template assuming Room + SA were both always present. Per the flag change above, they no longer are. Replaced with `automations/danielle_frankel_studios/client_arrival_slack_message.js` — a script that builds the message from whichever of Room/SA/Alterations Lead (Alterations Lead only when the appointment's own type is Alterations) actually exist on the record. `customScript` automation steps can't be created via the Airtable API, so the live automation currently has only a placeholder `findRecords` step in its place — Axel still needs to delete that placeholder, add a real "Run a script" step pasting in this file, and re-point "Send to Slack"'s message field at the new step's `message` output (see the automation's own description in Airtable for the exact steps).

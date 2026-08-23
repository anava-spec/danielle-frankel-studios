# Changelog

Plain-language log of what changed for the client, grouped by week. Client-facing only — no repo/folder/tooling housekeeping, no internal dev process notes.

**How to add to this file (any session, any conversation):**
1. Add a new `## Week of <Month Day>` section at the **top** of the file (right below this instructions block), matching the natural work week — it doesn't need to be a strict Mon–Sun calendar week.
2. Under it, one short bullet per notable change, grouped by interface/area if there are several. Skip pure debug/typo/revert churn — summarize the net outcome instead.
3. Only include things the client would actually care about (new pages, new filters, fixed bugs, renamed/removed features). Leave out repo reorganization, README/doc housekeeping, and anything that's purely about how the code is structured.
4. Keep entries in plain English, present tense is fine either way ("Rebuild X" or "Rebuilt X"), just be consistent within a section.
5. Commit and push both the inner interface repo and the outer `DFS-Brain` submodule pointer, same as any other change.

---

## Week of Aug 21, 2026

**Fulfillment**
- Fixed the Wedding Date column in the main table showing a day earlier than the real date (e.g. a wedding on Oct 10 was showing Oct 9), and made it fall back to the manual placeholder date when no confirmed date is set yet, matching the rest of the app.

**Sold Orders**
- The order list now opens sorted with the most recent sale first, instead of no particular order. Clicking any column header still works exactly as before.
- Fixed the Wedding Date shown in an order's detail popup so a manual placeholder date (used before a real wedding date is confirmed) always displays instead of sometimes showing blank.

**Alterations**
- Fixed the Wedding Date column showing "Missing Date" for clients who have a manual placeholder wedding date on file but no confirmed date yet — it now shows that placeholder instead, matching the rest of the app. The two date filters (past-wedding exclusion and the calendar filter) are unaffected.

**Recap**
- Restored to the version from Friday, Aug 21, keeping the four improvements already delivered that day: the redesigned Feedback form dropdowns, the "Size (Acuity Intake)" field on the client detail page, the Sales Associate / Appointment Time fields now shown on that same page, and the Appointment Time display correctly using the studio's own timezone. Wedding Date on the main list resolved itself once this version was back in place — it reads through a lookup field that was already correctly connected to the manual-placeholder fallback, no script change needed.
- Fixed the Wedding Date on a client's detail page always showing blank when no confirmed Acuity date was on file — it now falls back to the manual placeholder date, matching the main list.
- Fixed the main list's Wedding Date column occasionally showing a made-up date (e.g. "January 1st, 2027") for clients with only a rough placeholder like "2027" on file — it now shows that placeholder text as entered instead of guessing a date from it.
- Ready-to-Wear Size: only the Sales Associate's own confirmed size is now editable on the client detail page. The customer's self-reported size from Acuity intake is shown for reference next to it when available, but is no longer directly editable there — so a size typed into Recap can no longer be mistaken for something the customer entered themselves.

**Appointments**
- Simplified how Wedding Date is shown in the appointment detail view (opened by clicking an appointment) to read from the same single, already-correct source the rest of the app uses, so it reliably shows the manual placeholder date when no confirmed wedding date is on file yet — same fix pattern as Fulfillment, Sold Orders, and Alterations.

**Draft Orders**
- Fixed the Wedding Date shown in the "Client Details" popup (View Client, from a draft order) — it was always showing blank, even for clients with a confirmed wedding date on file, and now shows correctly, falling back to the manual placeholder date when no confirmed date is set yet.

**Calligraphy Cards**
- Fixed Wedding Date (and Due Date) showing a day earlier than the real date, for anyone viewing from a timezone behind UTC — both the main list and the client detail popup now show the correct day.

**Did Not Convert**
- Fixed Wedding Date on the client detail page showing a day earlier than the real date, for anyone viewing from a timezone behind UTC.

## Week of Aug 17, 2026

**Pipeline**
- Fixed the sync bug that kept recently-scheduled alterations appointments from showing up in the Alterations column.
- Found and fixed a bigger underlying issue while investigating: because multiple automations could independently move a client's stage, one of them briefly moved a batch of already-further-along clients backward into "In Alterations." Corrected everyone affected, and started a deeper rework (in progress, not yet live) so a client's stage gets computed from a set of independent facts instead of being overwritten directly — so this class of bug becomes structurally impossible going forward. Julia will review the new logic before it replaces the current one.
- Fixed a second, related sync bug: the Fulfillment column also wasn't reflecting some clients' recent pickup appointments, because the automation that reads them was pointed at an old, deprecated appointment-type field and was missing a few valid pickup appointment types. Corrected the automation and caught up everyone affected who was already stuck waiting.
- In the Order Ready step, replaced the old manual "Shipping"/"Pick Up" yes/no flags (which could only reflect one order per bride) with a table showing every one of her orders, each with its fulfillment method and a progress bar for how much of it has actually been picked up or shipped.
- Also in Order Ready, "Client Notified" is no longer a manual checkbox — it's now a progress bar showing what percentage of the bride's orders the client has actually been notified for.
- Fixed the RTW Size field: Sales Associates now confirm the size in its own field instead of typing over the customer's original self-reported size from Acuity — that original value is preserved and still shown for reference right next to the confirmed size. If no size has been confirmed yet, the display now correctly falls back to showing the Acuity value instead of appearing blank.
- Fixed a bug where Wedding Date could show the day and month swapped (e.g. a December 5th wedding showing as May 12th).
- Fixed "Room" and "Alterations Lead" sometimes showing the literal text "[object Object]" instead of the actual name.

**Alterations**
- Fixed a bug where alterations line items could inflate an order's "% Picked," which could trigger the Order Ready phase too early — alterations items are now excluded from that calculation.
- Fixed the Alterations appointment times showing the wrong hour depending on the viewer's own timezone (a New York 1:30pm appointment could show as 11:30am to someone viewing from elsewhere) — appointment times now always show correctly in the studio's own timezone, regardless of where the appointment is or where it's being viewed from.
- The Alterations Lead now always shows, even when it's blank, instead of being hidden.
- "Alterations In House" is now a clear button showing "No Alterations" or "Alterations Needed," instead of a plain checkbox.
- Added a new "Alterations Status" field (starts at "Pending"), shown only once a bride actually has alterations work — its available options and colors are pulled live from Airtable, so adding or recoloring a status later shows up automatically with no extra work.

**Fulfillment**
- Orders now automatically close out to "Fulfilled" once everything on them is picked/shipped, instead of sitting in "In Fulfillment" indefinitely with no defined end state.
- Pending: still need to review with Julia whether the "Shipped" tracking fields (shipped status, shipped percentage) should be kept or removed — they aren't driving anything today.
- In the In Fulfillment step, replaced the bride-level Fulfillment Method, Client Notified, Tracking #, and 3PL fields (which could only reflect one order per bride) with a table showing every one of her orders, each with its own method, client-notified status, tracking number, 3PL, and a fulfillment progress bar.
- Fixed the fulfillment progress calculation, which was adding together two numbers that didn't actually belong together ("ready to hand off" and "already handed off") — it now reflects real progress.

**Recap**
- Fixed a bug where the Wedding Date shown on the main list could be out of sync with (and older than) the correct date shown on the individual client's page — the list now always reads the same, current value.
- The individual client page now shows Sales Associate and Appointment Time, which were missing.
- Fixed a bug where Appointment Time and Consultation Appointment could show the wrong hour (or even the wrong day) depending on the viewer's own timezone, instead of always showing studio time.
- The individual client page's size fields are now "Ready-to-Wear Size" and "Size (Acuity Intake)," both editable — replacing an "Order Size" field that looked editable but wasn't actually saving.

**Sample Tracker**
- The risk-alerts panel now only considers Consultation appointments, not fittings/pickups/other appointment types.
- Renamed the "Parent Style" field to "Style" throughout.

**Customization Requests**
- Renamed the "Workdesk" view to "Requests," to avoid reading as a near-duplicate of the "Approval" view next to it.

**Sold Orders**
- The order list now defaults to showing the most recently sold order first, instead of no particular order.

## Week of Aug 10, 2026

**Sample Tracker**
- Close-size matching is live: when checking stock for a client's favorite style, the system now shows an exact-size match if one's in stock, close-size alternatives (one size up or down) if not, or a clear "no stock" state if nothing's close — instead of just a plain "in studio / missing" flag. Ties between equally-close options favor whichever sample is actually in-studio over one that's away or at a trunk show.
- New "champion sample" automation: whenever a client's favorite styles change, the best-matching in-stock sample per style is automatically computed and saved to her record.
- Sample-to-style linking is now required for new samples to show up correctly in matching — an initial cleanup pass relinked hundreds of existing samples to their correct style; a full pass across the remaining catalog is planned as a follow-up.
- The Add Sample form's style picker now only shows actual parent styles, not customized variants, so staff can't accidentally attach a new sample to the wrong record.

**Waitlist**
- Milestone: the Waitlist is now a real, working part of the daily workflow instead of a spreadsheet-style list off to the side.
- Active Waitlist leads now show up right inside Pipeline, alongside the regular sales stages — staff can see who's waiting without switching screens.
- Staff can add a new bride to the Waitlist directly from Pipeline with a simple form, and open any Waitlist lead to view or update her details.
- If a Waitlist lead's requested dates are typed in free text (e.g. "before July 27th" or "5/16 through 5/21"), the system now figures out her earliest available date automatically — no one has to manually enter it anymore.
- New automatic email alert: if a Waitlist lead's requested date has already come and gone and she still hasn't been matched to a client, Julia gets notified right away with a direct link to review and act on it. This is in addition to the existing "coming up in the next 5 days" heads-up alert.
- Waitlist leads who will never become clients can now be marked as an exception, which quietly removes them from Pipeline and from future alerts without deleting their history.
- Once a Waitlist lead becomes an actual client, her original Waitlist details stay visible on her full profile, so that history isn't lost.
- The full historical Waitlist (95 leads) is now live in the production system, with everyone who's already a known client automatically linked to their client record.

## Week of Aug 3, 2026

**Recap Doc**
- Generate Recap Doc now reliably prints as multiple pages when the content doesn't fit on one page — previously it always came out as a single page no matter how much was on it.
- Adjusted spacing, photo sizing, and font sizes throughout the document to match the approved design.
- Removed the "Custom Pricing" line from the Recap Doc — it now only shows each style's base price; the full customized price still appears on the separate Customization Proposal document.
- Fixed the document's fonts, which weren't actually loading and were silently falling back to a generic font; the main body font is temporarily using a close substitute until the licensed font is set up.
- Client info labels (Email, Phone, Wedding Date, Appointment, Client Specialist) are now uppercase.
- The preview window: removed the Close button (clicking outside or pressing Escape still closes it), renamed "Print" to "Generate," and it no longer needs horizontal scrolling to see the full document.
- "Generate Recap Doc" now always shows in the title bar — it's grayed out with an explanation (shown on click) when it can't be used yet, and disappears entirely once a Recap Doc has already been generated for that appointment.
- Fixed the upload link so a Recap Doc reliably attaches to the client's actual first-consultation appointment.
- Clicking Generate now closes the preview automatically, leaving just the print dialog on screen.

**Calligraphy Cards**
- Stage names in the detail popup's status stepper no longer wrap to a second line.
- The popup's content now sits directly under the title bar, with no extra box, border, or padding around it.
- Removed the X close button from the popup — closes via clicking outside or pressing Escape.
- Renamed the advance button to "Move to next step," and its confirmation is now a small popup right under the button instead of a full-screen dimmed confirmation.
- Field titles (Wedding Date, Due Date, Gown, etc., and Comments) are now a bit larger and easier to read.
- The popup now defaults to 60% of the window's height.
- The Comments box now stretches to fill any leftover space in the popup instead of leaving a blank gap.

**Draft Orders**
- Reworded the pending-approval banner for clarity.
- Shortened and reworded the auto-generated Rush Fee note, and removed a stray negative number from it in favor of plain words (e.g. "Less than 4 weeks left" instead of "-4 weeks left").
- Renamed "Shipping Address" to "Address."
- Fixed another instance of the bug that could throw an error when opening or saving a brand-new draft order for the first time.

## Week of Jul 30, 2026

**Did Not Convert**
- Moved into the Tracking section, alongside Sample Tracker and Calligraphy Cards.
- Full dark mode support added.

**Calligraphy Cards**
- Fixed the qualifying-clients rule so it correctly shows anyone whose order isn't shoes/veil-only, instead of an overly narrow list that was hiding some valid clients.
- Fixed the Items Sold and Gown columns, which were showing blank for every row.
- Added a "Dress Year" column between Gown and Wedding Date.
- Clicking the Status pill now opens a dropdown to pick Pending or Sent explicitly, instead of silently flipping to the other value on click.
- Added a "Comments" column so Margo can note name variations to use on the physical card.
- Added a toggle to show or hide clients with blank Items Sold (hidden by default) — previously they were always hidden with no way to see them.

**Customization Requests**
- Hybrid customization requests always require Margo's approval, no exceptions.
- A Regular customization request whose items are all already pre-approved is now created as Pre-Approved and skips Margo's approval queue entirely, since there's nothing left for her to review.

**Recap**
- Fixed the main list's Customizations count, which showed blank for clients who actually had requests on file.
- Removed the Measurements, Photos, Follow-Up, and Customizations columns from the main appointments table.
- Renamed "Favorite Styles" to "Favorite Styles from Acuity" and added a new "Favorite Styles from Appointment" column; Wedding Date now pulls from the correct source field.
- Removed the "Needs confirmation" chip next to Wedding Date.
- Widened the client search bar.

**Draft Orders**
- Added a Shipping Address field, right up front in the form — pick from the client's existing addresses on file, or type a new one. Now laid out inline like every other field on the form.
- Any style can now be selected when building a draft (sorted alphabetically), instead of only styles tied to the client's existing customization requests. Internal "customized" style variants are hidden from this list.
- Removed the State/Tax cost selection — Shopify will calculate shipping and taxes automatically from the selected address going forward.
- Rush Fee now always shows, even when it's $0, instead of disappearing.
- If a client has any customization request still waiting on internal approval, the Sales Associate now sees a clear bulleted message showing exactly which style(s) have pending approvals — this now shows as soon as the client is selected, even before a style is picked, and no longer shows a confusing "No customizations selected" message alongside it.

**Calligraphy Cards**
- Each client now has a detail popup (click a row to open it) showing the full record, a visual status stepper with progressive coloring, and a "Comments" field for Margo to note name variations for the card.
- The "Comments" field was moved off the main table and into this new detail popup, to keep the main list scannable.
- The calligraphy card status now has 4 steps instead of 2: Pending, Production Approved, Sent to Calligrapher, Received from Calligrapher.
- In the popup, the status only ever moves one step forward at a time, with a quick confirmation before it saves.

## Week of Jul 28–29, 2026

**Alterations**
- Repositioned the filters-explainer tooltip so it no longer opens partly off-screen.
- Broadened the list to include anyone in the Alterations stage, with an alterations appointment on file, or with "Alterations" in Item Sold (previously required all three at once, which hid some brides who should have shown up).

**Pipeline / Fulfillment / Did Not Convert**
- Fixed "% Picked" showing incorrect values in a few cases — it now always reflects the real picked status pulled from Orders, and is no longer editable by hand (it was never meant to be).

## Week of Jul 22–27, 2026

**Alterations**
- Rebuilt from scratch as a simple list per Julia's feedback (was a full duplicate of Pipeline's kanban board with no dedicated Alterations view).
- Columns: Client, Item Sold, Alteration Lead, First/Next Alts Appointment, Wedding Date, Payment Status.
- Added client search (non-narrowing typeahead) and a Wedding Date calendar filter.
- Added a Payment Status filter/column ("Paid"/"Unpaid" pill, derived from Item Sold containing "Alterations") — replaces the old Pick Up/fulfillment-status column, which doesn't apply to in-studio alterations work.
- Baseline list scope is now an OR: stage = "In Alterations", OR has an alterations appointment on file, OR "Alterations" in Item Sold — plus a hidden filter excluding past wedding dates (with a hover tooltip explaining it), and blank wedding dates now show a "Missing Date" pill instead of being hidden.
- Client names display capitalized regardless of how they're stored.

**Calligraphy Cards** (new page)
- New Tracking-section interface: list of clients with the calligraphy card checkbox, Due Date, Items Sold, Gown, Wedding Date.
- Fixed the card-status field being treated as a checkbox when it's actually a single select (Pending/Sent) — now a real status pill with working filter logic.
- Wedding Date filter reworked to "Upcoming"/"Past" with a clear (X) affordance.

**Customization Requests / Recap**
- Removed Recap's fixed "Today's appointments" top bar per Julia: "it just can be a list, it's too confusing."
- Fixed a Rate/decimal bug across the Customization Requests detail view and Counter-Proposal flow; hardcoded Self Usage field IDs to close the last gap.
- Hybrid customizations reworked: replaced the old 2-child-records model with two direct Style links on one record.
- Client approval no longer auto-flips production_status to "Sent to Production."
- Hid "Denied • Counter-Proposal" statuses from the default filter (superseded by a newer counter-proposal, not a real outcome to act on).
- Style dropdown: removed the Favorite-Styles-in-Acuity filter entirely (Regular and Hybrid) — shows every style now, in a panel 30% shorter than before (still scrollable).
- Customization items missing their Embroidery/Paint/Lace Amount now show "amount *" (red asterisk, hover tooltip) in the Rate column instead of a misleading $0.00 — added to Recap too, which never had it.
- Recap dark mode fixes: the Customizations search box, its suggestions dropdown, and Additional Details (plus every other text input sharing the same style) had no background color set at all.
- New Request (Customization Requests) and Add Customization (Recap) forms now keep whatever was typed if the modal is dismissed by accident — only resets on a successful submit, not on outside-click/Escape/Cancel.
- Counter-Proposal: Embroidery/Paint/Lace Amount is now read-only (inherited from the parent) — nothing is editable once a request is past its first review. Original Total font size settled on a middle tier, consistent between Counter-Proposal and the detail page.
- Shortened the client-approve confirmation copy.

## Week of Jul 20–21, 2026

- Brought Customization Requests to visual/functional parity with Recap's redesign; added a creation flow + client search.
- Added an Approval layout (New Requests / Under Review split view with drag-and-drop).
- Added Hybrid customization support to both Recap's form and Customization Requests.
- Redesigned the printed proposal for Hybrid; fixed the sticky Summary panel; applied Julia's demo feedback (removed flags/weight fields, 85% hybrid pricing, repositioned embroidery).
- Added smooth fade+scale open/close transitions to every modal, project-wide.
- Renamed stage "In Production" to "Order Ready" across the base.

## Week of Jul 16, 2026

- Sample Tracker: added a Status field using Airtable's own field colors for theming; simplified the status chip/dropdown to brand-only color with a default "Active" filter.
- Added a delete button (5-second countdown confirm) to the customization detail page.

## Week of Jul 12–14, 2026

- Fulfillment: added the Pickup Readiness Gate (readiness chips, background filter, Needs Attention summary tile, Readiness Alert filter).
- Added a Generate Proposal flow to the appointment/customization detail modal — attachment routing, print/PDF filename handling, proposal detail view.
- Added the order sync change log and hold reason/until display to Fulfillment.
- Standardized the "All" option removal from filter dropdowns (X replaces caret when a filter is active) and added an info tooltip explaining background/hidden filters.
- Appointments: unlinked-client appointments now render as a distinct "Block Time" row/card instead of being filtered out.

## Week of Jul 9–11, 2026

- Unified the visual style (colors, typography, filter dropdowns) across all five interfaces so they look and behave consistently.
- Reworked the Full Client Profile page (toggle prominence, past-stage editability, dark mode) and added List view (pagination, Stage filter, multi-column sort).
- Added the Draft Orders interface: new-draft creation form, unsaved-changes guard, two-column detail layout with live pricing summary, rush fee tier logic.

## Week of Jul 6, 2026

- Launched the initial Pipeline interface.
- Replaced the full-page kanban search filter with a search dropdown; switched the Kanban/List toggle to a proper dropdown.

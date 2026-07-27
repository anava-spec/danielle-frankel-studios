# Changelog

Plain-language log of what changed in this project's Interface Extensions and automations, grouped by week. Meant to be skimmed by anyone (not just engineers) to see what shipped and when.

**How to add to this file (any session, any conversation):**
1. Add a new `## Week of <Month Day>` section at the **top** of the file (right below this instructions block), matching the natural work week — it doesn't need to be a strict Mon–Sun calendar week.
2. Under it, one short bullet per notable change, grouped by interface/area if there are several. Skip pure debug/typo/revert churn — summarize the net outcome instead.
3. Keep entries in plain English, present tense is fine either way ("Rebuild X" or "Rebuilt X"), just be consistent within a section.
4. Commit and push both the inner interface repo and the outer `DFS-Brain` submodule pointer, same as any other change.

---

## Week of Jul 22–27, 2026

**Alterations** (`daily_ops/alterations.tsx`)
- Rebuilt from scratch as a simple list per Julia's feedback (was a full duplicate of Pipeline's kanban board with no dedicated Alterations view).
- Columns: Client, Item Sold, Alteration Lead, First/Next Alts Appointment, Wedding Date, Payment Status.
- Added client search (non-narrowing typeahead) and a Wedding Date calendar filter.
- Added a Payment Status filter/column ("Paid"/"Unpaid" pill, derived from Item Sold containing "Alterations") — replaces the old Pick Up/fulfillment-status column, which doesn't apply to in-studio alterations work.
- Baseline list scope is now an OR: stage = "In Alterations", OR has an alterations appointment on file, OR "Alterations" in Item Sold — plus a hidden filter excluding past wedding dates (with a hover tooltip explaining it), and blank wedding dates now show a "Missing Date" pill instead of being hidden.
- Client names display capitalized regardless of how they're stored.

**Calligraphy Cards** (`tracking/calligraphy_cards.tsx`, new)
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

**Repo organization**
- Split `code/` into `daily_ops/` and `tracking/` subfolders.
- Added a `session_summaries/` folder for narrative session recaps.

## Week of Jul 20–21, 2026

- Brought Customization Requests to visual/functional parity with Recap's redesign; added a creation flow + client search.
- Added an Approval layout (New Requests / Under Review split view with drag-and-drop).
- Added Hybrid customization support to both Recap's form and Customization Requests.
- Redesigned the printed proposal for Hybrid; fixed the sticky Summary panel; applied Julia's demo feedback (removed flags/weight fields, 85% hybrid pricing, repositioned embroidery).
- Added smooth fade+scale open/close transitions to every modal, project-wide.
- Split interface `.tsx` code and README docs into separate folders; added per-interface READMEs and a cross-cutting rules reference doc.
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

- Established `BRANDING.md` — the project's design-system reference (Champagne color system, typography scale, filter dropdown conventions) — and applied it across all five existing interfaces.
- Reworked the Full Client Profile page (toggle prominence, past-stage editability, dark mode) and added List view (pagination, Stage filter, multi-column sort).
- Added the Draft Orders interface: new-draft creation form, unsaved-changes guard, two-column detail layout with live pricing summary, rush fee tier logic.

## Week of Jul 6, 2026

- Initial DFS Pipeline interface source added to the repo.
- Replaced the full-page kanban search filter with a search dropdown; switched the Kanban/List toggle to a proper dropdown.

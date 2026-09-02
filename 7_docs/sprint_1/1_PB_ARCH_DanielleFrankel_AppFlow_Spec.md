# Danielle Frankel Studio — App Flow Reference — v0 Prototype

Singular Agency · April 2026

| Document Type | App Flow Reference |
| :---- | :---- |
| **Source** | v0-danielle-frankel-preview.vercel.app |
| **Companion Brief** | Airtable Engagement Brief — Singular (Apr 24, 2026) |
| **Tabs Covered** | 8 (Pipeline, Appointments, Calendar, Post-Appointment, Customizations, Sold, Alterations, Fulfillment, Did Not Convert) |
| **Primary Persona** | Sales Associates, GM of Sales, Reception, Production, Fulfillment |
| **Author** | Singular Agency — Will Hernández |
| **Version** | v1.0 |
| **Date** | April 2026 |

## 00 — Purpose

**Why this document exists**

The PO shared a v0 prototype that visualizes how the Danielle Frankel Studio (DF) Airtable app should feel once built. This document walks through every tab in that prototype, describes the data and behavior behind each screen, and notes the gaps between the prototype and the Airtable Engagement Brief. The intent is that as we begin building, we use this as the reference to check progress — each tab below maps to an interface we owe in the final base.

> How to read this doc: each tab section follows the same structure — what the screen shows, what data it depends on, what actions it triggers, and any open questions or deltas vs. the engagement brief.

## 01 — Global Layout

**Shared structure across every tab**

Every tab in the prototype shares the same chrome: the "Danielle Frankel Studio" header, a horizontal nav with eight tabs (Pipeline, Appointments, Calendar, Post-Appointment, Customizations, Sold, Alterations, Fulfillment, Did Not Convert), and a consistent content area below. Tabs are ordered roughly along the client lifecycle: from first booking through fitting, fulfillment, and post-sale.

Persona-to-tab mapping:

| Persona | Primary Tabs | Use Case |
| :---- | :---- | :---- |
| Sales Associate (SA) | Pipeline · Appointments · Post-Appointment · Customizations | Day-to-day client management, follow-ups, and customization requests |
| GM of Sales | Pipeline · Calendar · Customizations | Capacity, room assignments, and customization approvals |
| Reception | Appointments | Client check-in, room assignment, Slack notifications |
| Production | Customizations | Pricing review, approval, full-custom escalation |
| Fulfillment / Operations | Sold · Alterations · Fulfillment | Order fulfillment, alterations payment tracking, shipping, and tax |
| Leadership | Did Not Convert | Loss analysis and follow-up opportunities |

## 02 — Pipeline

**Kanban view of every active bride**

Layout: Kanban with five columns — Pre-Appointment · Deliberating · Sold · Alterations · Fulfilled.

Each card shows: bride name, wedding date (or approximate range), Sales Associate, studio, and a flag count badge if there are open issues.

Filters:
- Studio: All / New York / LA
- Sales Associate: All / individual SAs (e.g. Emma Wilson, Mia Torres)
- Filters compose — when both are applied, a "Showing N clients" line appears with a Clear filters action
- Search: free-text client search in the top-right

Card click behavior: Clicking a card opens the Bride Detail page (see Section 03). Each card carries a flag pill ("3 flags", "1 flag") that signals open issues from the Post-Appointment health check.

Stages (must align with brief Section 4.2):

| Stage | Definition | Auto-advance trigger |
| :---- | :---- | :---- |
| Pre-Appointment | Booked but not yet seen | Acuity booking syncs into base |
| Deliberating | Saw appointment, not yet purchased | EOD after appointment date if not cancelled (regardless of check-in/clear/recap status) |
| Sold | At least one order attached | Shopify order links to client |
| Alterations | In fitting phase | First fitting scheduled or order ready for pickup |
| Fulfilled | Gown delivered, alts paid, taxes/shipping settled | All fulfillment flags clear (see Fulfillment tab) |

> ⚠ The brief flags that today's "move to Deliberating" automation depends on the recap clearing the client and fails frequently. The replacement logic must be: by EOD on appointment date, if not cancelled, move to Deliberating regardless of check-in/recap state.

## 03 — Bride Detail Page

**Single-bride deep-link from any card**

Triggered from Pipeline cards. Header shows: avatar, name, current stage badge, studio, and a flag panel (top-right) listing open issues — e.g. "Follow-up not sent · No measurements · No appt photos".

Sections on the page:
- Client info: Wedding Date, Sales Associate (with email + phone), Email, Phone
- Stage in Pipeline: visual horizontal stepper showing current stage
- Appointment Details: Next Appointment, Last Appointment, Room, Total Appointments, Measurements status, Appt Photos status, Follow-Up status
- Interest flags: Interest in Custom · Interest in Alts · Interest in M2M (Yes/No)
- Post-Appointment Notes (free text)

> Brief alignment: this is the consolidated client view the brief calls "Cobalt" in Section 5. The prototype shows the operational half (appointment, follow-up, interest); the full Cobalt view also needs the Apparel Magic order details (Shopify #, AM Order ID, items purchased, total spend) and production data (size, M2M, alterations in house, customization details). We need to extend this page to cover both halves.

Open question — should the bride detail page also be reachable from the other tabs (Appointments, Calendar, Post-Appointment, Customizations, Sold, Alterations, Fulfillment, Did Not Convert)? The PO noted this as a "nice feature" on every tab. Recommendation: yes, make the bride name a clickable link on every tab so the detail page is the universal destination.

## 04 — Appointments

**Today's schedule, reception's home base**

Layout: list view scoped to a single day. Date stepper at the top with prev/next arrows. Rows are ordered chronologically.

Visible columns: Time (with timezone tag like "EDT"), Client, Sales Associate, Room, Studio, Type (colored pill, e.g. "NY - 260 - Consultation", "NY - 260 - Final Fitting"), Favorite Styles, Samples Not in NY, Action: Check In button per row.

Filters: Sales Associate · Studio · Category (Consultation / Alterations).

Check-in flow: Reception clicks "Check In" on a row → confirmation dialog appears showing the Slack message preview: "Slack → #client-appointment-arrivals: 'Emma Wilson, Sofia Patel is here, you will be in Room C.'" Reception clicks "Aceptar" to confirm the post.

Brief alignment (Section 3.1):
- Check-in Slack message: implemented in prototype ✓
- Room cleared Slack message: not yet shown — need a "Clear Room" action per row
- Order pickup Slack message: not yet shown — TBD channel, separate flow
- Sidebar pop-out for shipping/tax/alts payment status: not in prototype, requires dev/script work per the brief

## 05 — Calendar

**Week view of all appointments**

Layout: weekly grid (Mon–Fri shown in prototype, likely Mon–Sun in production). Time slots stack vertically; appointments render as colored cards in their slot showing client name, time, room, and Sales Associate.

Color coding (assumption to confirm with PO): cards are tinted by Sales Associate or by appointment type. The two visible colors in the prototype (blue and purple) suggest SA-based tinting since both Mia Torres and Emma Wilson appear in distinct shades.

Filters: Sales Associate (All / Emma Wilson / Mia Torres). Date range navigates via Prev / Next.

Card click: should open Bride Detail (currently a "nice feature" gap). Recommend implementing as the universal destination.

## 06 — Post-Appointment

**Follow-up health check across all consultations**

Layout: list of every client whose appointment type contains "Consultation". Each row is a per-client health check across the post-appointment workflow.

Visible columns: Client (name + email), Studio, Wedding Date (handles both confirmed dates and approximate ranges), Sales Associate, Appts (count), Last Appt, Size, Measurements (Complete/Missing), Photos (Uploaded/Missing), Follow-Up (Sent/Pending), Interests (Custom/Alts/M2M/—), Post-Appt Notes (free text), Flags (pill count or "Clear" badge).

Filters: All Studios · All Associates.

> Flag logic: a record is flagged when any of measurements, wedding date, appointment photos, or follow-up are missing/incomplete. The badge count tells the SA at a glance how many things are open per client.

Brief alignment (Section 3.2): the prototype matches the brief's required fields. The Wedding Date column correctly handles both Wedding Date (Set) and Wedding Date (If Not Set), surfacing "(approx.)" for the unset case. Appointment Recap Generation is not yet visible — likely a row action to add.

## 07 — Customizations

**Per-dress, per-client à la carte requests**

Layout: dashboard with KPI counters at the top, a list of active requests below, and the customization workflow legend at the bottom.

KPI counters (top of page): Pending production review, Approved — awaiting client, Purchased, 3+ customizations — consider full custom gown (escalation flag).

Visible columns: Client (name + Sales Associate), Studio, Dress, Customizations Requested (bulleted list inline), Status (Pending Review/Approved/Purchased/Complete), Est. Price, Notes, Flag ("Custom gown?" pill when 3+ customizations), Action (Send proposal / Send to production / Complete).

Workflow legend (footer of page): SA submits request → Sent to production → Pricing approved → Proposal to client → Client confirms · 3+ customizations → flag for full custom gown review.

"+ New Customization" form (modal): Client selector and Dress selector at the top; customization categories (Straps · Neckline · Train · Color · Sleeves · Details · Fit) each surfacing tappable options as pills; free-text "Notes for Production" field; Submit action: Send to Production.

> ⚠ Brief alignment: the brief lists Production as lowest priority (Section 3.4) and describes it as "approved and sold customization requests, gowns due this week." The prototype goes further — full intake form with category pills. We should confirm with the PO whether the form is in scope for v1 or a later phase.

## 08 — Sold

**Every Shopify order, scoped to active fulfillment**

Layout: list of all Shopify sales not yet fulfilled. Once a row is fully delivered, it disappears from this view (assumed — confirm with PO).

Visible columns: Client (name + email), Shopify # (e.g. #1042), Apparel Magic ID (green link when present, red "Missing" pill when absent), Date Sold, Items Purchased, Total, Sales Associate, Size.

Filters: All Sales Associates · All Studios.

> Brief alignment (Section 3.3): matches the brief exactly — list all Shopify sales, flag missing Apparel Magic Order ID, filter by SA and Studio.

## 09 — Alterations

**Brides in fitting phase + payment status**

Layout: list of brides in the Sold phase who have alterations appointments scheduled. The prototype currently shows a single bride (Brittany Davis), with a red left-edge marker indicating an unpaid alterations bill.

Visible columns: Client (name + email), Wedding Date, Last Fitting, Next Fitting, Sales Associate, Size, Type (Made-to-Measure/Custom/Standard), Alts Payment (Due/Paid pill), Red left-edge flag when payment is Due.

> ⚠ Brief gap (Section 3.5): the brief asks for tabs within this interface for Appointment Photos, Appt/Customization Notes, First/Second/Third…/Final Fitting with photo upload, comment tagging, and progress visibility per fitting. The current prototype shows only the list/payment view — the photo+fitting tab structure is not yet built. This is a meaningful build chunk.

## 10 — Fulfillment

**Final-mile status: alts, shipping, tax, delivery**

Layout: list view showing the gate checks for every order between sold and fulfilled.

Visible columns: Client (name + email), Shopify #, Items, Wedding Date, Alts Paid (Yes/No), Shipping Paid (Yes/No), Tax Paid (Yes/No), Status (Sold/Alterations/Fulfilled).

Brief gaps (Section 3.6):
- Missing fields: Fulfillment Method, % Picked, % Allocated, Tracking Number, 3PL
- Missing sub-tab: Returns (line-item selection, return reason, QA approval, message to Margo)
- Tax check needs to validate against the correct delivery state — currently a binary Yes/No

## 11 — Did Not Convert

**Lost-opportunity tracking**

Layout: list of brides who had a consultation but did not purchase. Used by SAs and leadership to track loss reasons and follow-up opportunities.

Visible columns: Name, Appointment Date, Sales Associate, Type (Consultation pill), Wedding Date (handles approximate ranges), Notes (free text capturing loss reason).

> Brief alignment (Section 3.7): ✓ matches. The brief is short on this one — just a list view of brides who came in and did not purchase.

## 12 — Cross-Cutting Gaps vs. Brief

**What the prototype does NOT yet show**

| Gap | Brief Section | Where it lands |
| :---- | :---- | :---- |
| Room cleared Slack notification | 3.1 | Appointments tab — row action |
| Order pickup Slack notification | 3.1 | Appointments tab — row action |
| Reception sidebar pop-out (shipping/tax/alts) | 3.1 | Appointments tab — script work |
| Appointment Recap Generation | 3.2 | Post-Appointment tab — row action |
| Alterations photo+fitting tabs (1st…Final) | 3.5 | Alterations tab — sub-tab structure |
| Fulfillment fields (% Picked, % Allocated, 3PL) | 3.6 | Fulfillment tab — additional columns |
| Returns sub-tab | 3.6 | Fulfillment tab — sibling tab |
| "Brides Who Need Comms" follow-up interface | 3.8 | New tab or grouped list |
| SA round-up emails (4 cadences) | 4.1 | Automations |
| Phase Automation rewrite (EOD move-to-Deliberating) | 4.2 | Automations |
| Cobalt — full Apparel Magic single-page view | 5 | Bride Detail page extension |

## 13 — Open Questions for the PO

**Things to confirm before we build**

- Should the Bride Detail page be reachable from every tab (Appointments, Calendar, Post-Appointment, Customizations, Sold, Alterations, Fulfillment, Did Not Convert)? Recommendation: yes.
- Calendar card color coding — by Sales Associate, or by appointment type? Current prototype is ambiguous.
- Customizations form — full pill-based intake as shown, or simpler v1 (free text + link to dress)?
- Sold tab — confirm that records disappear from this view once Fulfillment status = Fulfilled.
- Alterations tab — is the photo+fitting sub-tab structure (per the brief) part of v1 scope or a later phase?
- Reception sidebar pop-out — confirm scope and whether it requires custom JS via Airtable's extensions/scripting.
- "Brides Who Need Comms" — is this a new tab in the nav, or a saved view inside Post-Appointment?

## 14 — How We'll Use This Doc

**Working agreement**

This document is the baseline reference for the Airtable build. As we work through each interface, we will:
- Open the corresponding section here and confirm we're building to spec
- Generate a dedicated Interface Spec doc (per the airtable-spec-docs standard) for each tab when we start it
- Track gaps from Section 12 as a punch list — close them tab-by-tab
- Resolve every Section 13 question with the PO before scoping the build

> Next step: walk through Sections 12 and 13 with the PO, lock the v1 scope, then generate the per-tab Interface Specs starting with Pipeline (highest-priority operational surface).

Danielle Frankel Studio · Singular Agency · App Flow Reference — v0 Prototype · v1.0 · April 2026

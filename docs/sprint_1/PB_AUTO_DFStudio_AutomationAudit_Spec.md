# Danielle Frankel Studio Automation Audit

Full Inventory & Verdict Report · Singular Agency · May 2026

| Document Type | Automation Audit |
| :---- | :---- |
| **Base** | Danielle Frankel DTC Customers (appUC2NFAlURayLx9) |
| **Automations Audited** | 28 across 6 sections (Sample Log, Reception, Stage Updates, Customization Requests, Automated Emails, More) |
| **Evidence Sources** | Automation Audit PDF (screenshots of each automation) · Airtable failure emails forwarded by Julia (May 13–18, 2026) |
| **Julia Approval** | Approved — verbal, Slack, May 19 2026 — no comments |
| **Author** | Singular Agency — Will Hernández (Axel Nava) |
| **Version** | v1.0 |
| **Date** | May 2026 |

## 01 — Audit Overview

**Scope & Methodology**

**Objective:** Audit all existing Airtable automations in the Danielle Frankel DTC Customers base, assign a verdict to each, document rationale, capture Julia's approval, and produce a clear action plan for the production cleanup sprint. The audit covered 28 automations across 6 sections using screenshot evidence and Airtable failure emails. Each automation was assigned one of five verdicts: Deprecate, Merge, Update, Further Discussion, or Keep as Is.

Methodology: each automation was reviewed for (1) run history and failure rate, (2) alignment with the current field architecture after the Sales Associate linked-record migration and orphan field cleanup, (3) alignment with the engagement brief workstreams, and (4) naming-standard compliance. Verdict was assigned, rationale written, and findings reviewed with Julia via Slack on May 19 2026.

## 02 — Verdict Summary

**Findings at a Glance**

| Verdict | Total | Done | Pending / N/A | Notes |
| :---- | :---- | :---- | :---- | :---- |
| 1. Deprecate | 8 | 7 | 1 — Pending EOD replacement | Sandbox-deprecated automations will be pushed to production in the next batch. |
| 2. Merge | 2 | 0 | 2 — Pending | Two automations share an identical trigger but write contradicting stages. Consolidate to Order is Shipped. |
| 3. Update | 7 | 0 | 7 — Pending | Automations needing a template repair, rename, or architectural review as other workstreams are completed. |
| 4. Further Discussion | 3 | 0 | 3 — Pending | Verdict blocked on a business decision. Julia input required before action can be assigned. |
| 5. Keep as Is | 8 | — | — | Confirmed healthy. No action required; some candidates for rename in the future naming-standard pass. |
| Total | 28 | 7 | 13 | |

> ⚠ One pending deprecation (When appointment is before today and not cancelled move client to deliberating) cannot be removed until the EOD replacement automation (Brief Workstream C.2) is live. See Section 03.

## 03 — Deprecations

**Automations Removed or Scheduled for Removal**

7 of 8 deprecations are complete in the sandbox and queued for the next production push. 1 deprecation (the "move to Deliberating" automation) is blocked — its replacement must be built before the old automation is removed.

| Automation Name | Table | Reason | Rationale | Status |
| :---- | :---- | :---- | :---- | :---- |
| **When appointment is before today and not cancelled move client to deliberating** | DF Appointments - Acuity | 100% failed runs | Hard fail — Update step uses Email from Acuity as Record ID instead of Airtable record ID; every run fails. This is the broken automation called out in Brief Workstream C.2. Julia forwarded Airtable failure emails on 13/5, 14/5, 15/5, 16/5, 17/5 2026 confirming ongoing daily failures. Do not delete until the EOD replacement automation is live. | **PENDING — Replacement EOD logic must be built first** |
| **Sales Associate > Sales Info** | DF Clients | Architecture cleanup (replaced by linked record + lookups) | Deep-Match-era cascade explicitly flagged as wrong pattern in the brief. Sales Associate migration to linked record + lookups now cascades SA Email/Phone natively — no automation needed. Update step references a deleted field ("Unknown field" error); most runs fail. Julia forwarded failure emails on 13/5 and 14/5 2026. | Done — Deprecated in sandbox |
| **Order Ready Email - Alterations Paid** | DF Clients | Deprecated field references | OFF, never run. Trigger condition references a deleted field (Order Ready Email, removed in orphan field cleanup). | Done — Deprecated in sandbox |
| **Order Ready Email - Alterations Paid copy** | DF Clients | Deprecated field references | Direct "copy" duplicate of the above with the same deleted-field reference. Remove together with the original. | Done — Deprecated in sandbox |
| **Customization Request Slack** | Customizations | Lack of runs — superseded by active version | OFF, never run. Superseded by Customization Request Slack Message (Section 6, automation 3), which is the active version with the Click-to-Approve button. | Done — Deprecated in sandbox |
| **Link Scan Account in Sample Scans Table copy** | Sample Log | Lack of runs — orphan copy | OFF "copy" duplicate living on Sample Log instead of Sample Scans (where the canonical automation lives). Never run; no documented distinct purpose. | Done — Deprecated in sandbox |
| **Automation 2** | Sample Log | Lack of runs — placeholder, no documented purpose | OFF, never run, placeholder name with no documentation or audit trail. If the underlying need surfaces later, rebuild with a descriptive name. | Done — Deprecated in sandbox |
| **Split Sale Check Mark** | DF Clients | No longer needed | Retired in the split-sale production push. Trigger field Other Seller (Split Sale) [deprecate after stand up] and action field Split Sale [deprecate after stand up] replaced by sales_associate_split_sale (linked record) + is_split_sale (formula). | Done — Deprecated in sandbox |

## 04 — Merges

**Contradicting Automations to Consolidate**

Both automations share the identical trigger (Tracking # not empty AND % Shipped = 100%) but write different stages. Order is Shipped is the canonical rule; Tracking Number - Update Phase to In Fulfillment should be deprecated and its logic absorbed.

| Automation Name | Table | Action | Rationale |
| :---- | :---- | :---- | :---- |
| **Tracking Number - Update Phase to In Fulfillment** | DF Clients | Absorb into Order is Shipped (canonical) | Identical trigger to Order is Shipped (Tracking # not empty AND % Shipped = 100%) but writes In Fulfillment instead of Shipped. The two automations directly contradict each other. Per the brief, 100% shipped should land the client in Shipped — deprecate this rule and keep the other. |
| **Order is Shipped** | DF Clients | Canonical — absorb Tracking Number duplicate, then debug 2 known failures | Same trigger as Tracking Number - Update Phase to In Fulfillment but writes Shipped — the correct target stage. Keep this rule as the canonical one. Debug the 2 failed runs (4/1/2026) before re-validating. |

## 05 — Updates

**Automations to Repair or Rename**

These automations are functional but require targeted fixes: broken field references in Slack templates, mismatched automation names, hardcoded values that won't scale, or a legacy field pattern now superseded by the linked-record architecture.

| Automation Name | Table | Action Required | Rationale |
| :---- | :---- | :---- | :---- |
| **Scan Log - Update Scanner** | Sample Log | Repair field-type mismatch in Update step | All known runs fail at the Update step with "Received invalid inputs". Almost certainly a field-type mismatch from the sample-log field migrations. Verify Last Scanned By and Scanner Lookup field types; repair or deprecate if scanning workflow is no longer prioritized. |
| **NY Client Clears - Slack Message** | DF Appointments - Acuity | Repair Room field reference in Slack message template | Trigger and Slack delivery work correctly. Message template contains [Invalid value] — almost certainly the Room field renamed/restructured in the appointments cleanup. Repair the field reference; trigger logic is fine. |
| **Client Arrival Slack** | DF Appointments - Acuity | Repair Room field reference in Slack message template | Same shape as NY Client Clears — [Invalid value] in message template (likely Room). One known failure (21/4/2026) with "Failed to construct value for Message". Repair the field reference; trigger logic is fine. |
| **No Alts/Order Ready - Update Phase to In Fulfillment copy** | DF Clients | Rename; validate against other In Fulfillment rules; test | "copy" suffix in name — never renamed after being cloned. Logic is reasonable (Alterations In House unchecked + Order Ready? checked → In Fulfillment) but has never run. Rename, verify no overlap with other In Fulfillment triggers, and run a test. |
| **Did Not Convert Phase Change - Last Appointment is >100 days ago** | DF Clients | Rename to reflect 180-day condition; confirm threshold with Julia | Automation name says >100 days but trigger condition is 180 days — rename for accuracy. Confirm with Julia that 180 days is the agreed Did Not Convert threshold (still an open question in the brief; JSC: "after wedding date passes they are not a client"). |
| **Update phase to pick up when clients pick up appointment is before today and** | DF Clients | Rename (name is truncated); generalize hardcoded appointment-type list | Automation name is truncated mid-sentence. Condition hardcodes specific appointment-type values — Tribeca/London pickup types will silently fall outside the rule as new studios open. Rename and switch condition to a category field or tag. |
| **Sales Associate Look up and Drop Down for Coloring Appts** | DF Appointments - Acuity | Confirm if legacy single-select still needed; deprecate if not | Writes the Sales Associate single-select from SA LOOKUP — a Deep-Match-era pattern. With the Sales Associate linked-record migration done, this cascade may be redundant. Confirm whether any downstream view or automation still reads the legacy single-select; if not, deprecate. |

## 06 — Further Discussion

**Automations Pending a Business Decision**

These three automations cannot be assigned a final verdict without Julia's input. Each is disabled or about to be superseded. A decision is needed before a Deprecate or Update action is assigned.

| Automation Name | Table | Open Question | Rationale |
| :---- | :---- | :---- | :---- |
| **Scan Purpose - Sample Log** | Sample Log | Keep OFF until scanning workflow is validated. Repair or deprecate together with Scan Log - Update Scanner? | Disabled; prior runs failed at the Update step. Tied to the same sample-scanning workflow as Scan Log - Update Scanner and Link Scan Account in Sample Scans Table. Recommend a single decision covering all three scanning automations. |
| **Send Request to Kitchen (6H)** | DF Appointments - Acuity | Is the kitchen-request workflow still in scope? If yes, repair Room + SA field references. If no, deprecate. | Disabled; message template has 2 [Invalid value] refs (likely Room and Sales Associate). Workflow not referenced in the current engagement brief. Julia to confirm whether this is still a live operational need. |
| **NY Client Clears - Update Phase to Deliberating** | DF Appointments - Acuity | Retire after EOD Deliberating rewrite, or keep as the live path until that replacement is built? | Moves clients to Deliberating on Cleared + Check In — the room-clear-dependency the brief explicitly calls out as fragile. Brief Workstream C.2 asks for an EOD-based replacement. This automation should be retired once that replacement is live, but should stay ON until then. |

## 07 — Keep As Is

**Automations Confirmed Healthy**

These 8 automations are working as intended with no structural issues. No immediate action is required. Several are candidates for a rename when the naming-standard pass is applied across all automations.

| Automation Name | Table | Notes |
| :---- | :---- | :---- |
| **Link Scan Account in Sample Scans Table** | Sample Scans | No failed runs. Hold until scanning rollout is validated. |
| **Alterations Scheduled - Update Phase to In Alterations** | DF Clients | Clean; many successful runs. Rename from "Phase" → "Stage" in naming-standard pass. |
| **Picked Up & Full Order Fulfilled - Update Phase to Picked Up** | DF Clients | Logic correct; no runs yet — conditions not yet met in production. |
| **Pick Up Scheduled - Update Phase to In Fulfillment** | DF Clients | Clean; many successful runs. |
| **Shopify Order - Update Phase to Sold** | DF Clients | Clean; many successful runs. Aligned with brief. |
| **Moves someone out of Did Not Convert if they book New Appt** | DF Clients | Clean; many successful runs. Counterpart to the 180-day Did Not Convert rule. |
| **Customization Request Slack Message** | Customizations | Active version of customization approval flow with Click-to-Approve. Repair [Invalid value] in title (likely SA field) in next template pass. |
| **LINK FAVORITE STYLES FROM ACUITY TO SAMPLES** | DF Appointments - Acuity | Scheduled daily 10:15pm CST. No failed runs. Re-evaluate when Sample Tracker / B.2 feature build begins. |

## 08 — Full Inventory

**All 28 Automations — Reference Index**

Complete list sorted by verdict. Use this as the primary reference index.

| Automation Name | Table | Verdict | Verdict Detail / Action | Status |
| :---- | :---- | :---- | :---- | :---- |
| When appointment is before today and not cancelled move client to deliberating | DF Appointments - Acuity | 1. Deprecate | 100% failed runs | Pending |
| Sales Associate > Sales Info | DF Clients | 1. Deprecate | Architecture cleanup (replaced by linked record + lookups) | Done |
| Order Ready Email - Alterations Paid | DF Clients | 1. Deprecate | Deprecated field references | Done |
| Order Ready Email - Alterations Paid copy | DF Clients | 1. Deprecate | Deprecated field references | Done |
| Customization Request Slack | Customizations | 1. Deprecate | Lack of runs — superseded by active version | Done |
| Link Scan Account in Sample Scans Table copy | Sample Log | 1. Deprecate | Lack of runs — orphan copy | Done |
| Automation 2 | Sample Log | 1. Deprecate | Lack of runs — placeholder, no documented purpose | Done |
| Split Sale Check Mark | DF Clients | 1. Deprecate | No longer needed | Done |
| Tracking Number - Update Phase to In Fulfillment | DF Clients | 2. Merge | Absorb into Order is Shipped (canonical) | Pending |
| Order is Shipped | DF Clients | 2. Merge | Canonical — absorb Tracking Number duplicate, then debug 2 known failures | Pending |
| Scan Log - Update Scanner | Sample Log | 3. Update | Repair field-type mismatch in Update step | Pending |
| NY Client Clears - Slack Message | DF Appointments - Acuity | 3. Update | Repair Room field reference in Slack message template | Pending |
| Client Arrival Slack | DF Appointments - Acuity | 3. Update | Repair Room field reference in Slack message template | Pending |
| No Alts/Order Ready - Update Phase to In Fulfillment copy | DF Clients | 3. Update | Rename; validate against other In Fulfillment rules; test | Pending |
| Did Not Convert Phase Change - Last Appointment is >100 days ago | DF Clients | 3. Update | Rename to reflect 180-day condition; confirm threshold with Julia | Pending |
| Update phase to pick up when clients pick up appointment is before today and | DF Clients | 3. Update | Rename (name is truncated); generalize hardcoded appointment-type list | Pending |
| Sales Associate Look up and Drop Down for Coloring Appts | DF Appointments - Acuity | 3. Update | Confirm if legacy single-select still needed; deprecate if not | Pending |
| Scan Purpose - Sample Log | Sample Log | 4. Further Discussion | Keep OFF until scanning workflow is validated. Repair or deprecate together with Scan Log - Update Scanner? | Pending |
| Send Request to Kitchen (6H) | DF Appointments - Acuity | 4. Further Discussion | Is the kitchen-request workflow still in scope? If yes, repair Room + SA field references. If no, deprecate. | Pending |
| NY Client Clears - Update Phase to Deliberating | DF Appointments - Acuity | 4. Further Discussion | Retire after EOD Deliberating rewrite, or keep as the live path until that replacement is built? | Pending |
| Link Scan Account in Sample Scans Table | Sample Scans | 5. Keep as Is | — | N/A |
| Alterations Scheduled - Update Phase to In Alterations | DF Clients | 5. Keep as Is | — | N/A |
| Picked Up & Full Order Fulfilled - Update Phase to Picked Up | DF Clients | 5. Keep as Is | — | N/A |
| Pick Up Scheduled - Update Phase to In Fulfillment | DF Clients | 5. Keep as Is | — | N/A |
| Shopify Order - Update Phase to Sold | DF Clients | 5. Keep as Is | — | N/A |
| Moves someone out of Did Not Convert if they book New Appt | DF Clients | 5. Keep as Is | — | N/A |
| Customization Request Slack Message | Customizations | 5. Keep as Is | — | N/A |
| LINK FAVORITE STYLES FROM ACUITY TO SAMPLES | DF Appointments - Acuity | 5. Keep as Is | — | N/A |

Danielle Frankel Studio · Singular Agency · Automation Audit · v1.0 · May 2026

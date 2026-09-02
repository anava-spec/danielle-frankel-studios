

| post\_appointment\_missing\_data Field Specification — Formula Field Danielle Frankel Studio · Singular Agency · May 2026 |
| :---- |

| Document Type | Field Specification |
| :---- | :---- |
| **Field Name** | post\_appointment\_missing\_data |
| **Field ID** | fld2Jl2LoCmWdegE7 |
| **Field Type** | Formula → Single-Select (formatted) |
| **Table** | DF Clients (tblLLUlDgJ4ktzF7c) |
| **Base** | Danielle Frankel Studio (appUC2NFAlURayLx9) |
| **Story** | \[DFS-1\] Post-Appointment Completeness Flag |
| **Schema Version** | v1.0 |
| **Author** | Singular Agency — Axel Nava |
| **Date** | May 2026 |

**01 — PURPOSE**

**Field Objective**

| This formula field flags whether a DF Clients record in the Deliberating stage is missing any of the four required post-appointment data points: Wedding Date, Measurements, Appointment Photos, and Follow-Up Sent. It is the single source of truth for post-appointment completeness and will drive filtering, sorting, and visual indicators in the Post-Appointment interface. |
| :---- |

The Post-Appointment interface surfaces all clients who have had a Consultation appointment. The SA's job after every appointment is to ensure all four data points are collected. This field makes the gap visible at a glance — without requiring the SA to open individual records.

The field is scoped to Deliberating stage records only, matching the operational context of the Post-Appointment interface.

**02 — OUTPUT VALUES**

**Single-Select Results**

| Output Value | Color | Meaning |
| :---- | :---- | :---- |
| Missing Post-Appointment Data | Red / Pink | One or more required fields are blank or unset. The record needs SA attention. |
| Complete Post-Appointment Data | Default | All four required fields have data. The record is post-appointment complete. |

| ⚠  The formula outputs one of exactly two predefined values. If the output does not match a predefined option, Airtable will display the fallback — check for field name or schema changes immediately. |
| :---- |

**03 — SOURCE FIELDS**

**Fields Evaluated by the Formula**

The formula evaluates the following five fields on the DF Clients record. All five must be present and correctly named in the base for the formula to evaluate correctly.

| Field Name | Field ID | Field Type | What Triggers Incomplete |
| :---- | :---- | :---- | :---- |
| stage | fldLcxVZvI1rigBlh | Single Select | Must equal "Deliberating" — formula is scoped to this stage only |
| Wedding Date (Formatted) | fldbgknumKGS5W5WU | Date | BLANK() \= missing wedding date |
| Measurements | fldcWwbKOc9nkgzzV | Attachments | BLANK() \= no measurement files uploaded |
| Follow Up Sent? | fldmjiS7lHEn9qZHN | Checkbox | BLANK() \= checkbox is unchecked or unset |
| Appointment Photos | fldWti8XzHbnGcjz9 | Attachments | BLANK() \= no appointment photos uploaded |

**04 — FORMULA**

**Implementation**

The formula is configured in Airtable with "Change formula output to single select options" enabled. The formula logic is:

| IF(   AND(     stage \= "Deliberating",     OR(       {Wedding Date (Formatted)} \= BLANK(),       Measurements \= BLANK(),       {Follow Up Sent?} \= BLANK(),       {Appointment Photos} \= BLANK()     )   ) \= TRUE(),   "Missing Post-Appointment Data",   "Complete Post-Appointment Data" ) |
| :---- |

**Logic walkthrough:**

* The outer AND() requires both conditions to be true for the incomplete branch to fire.

* Condition 1: stage must equal "Deliberating". Records in any other stage return "Complete Post-Appointment Data" regardless of missing fields.

* Condition 2: OR() evaluates to TRUE if any of the four required fields is BLANK(). A single missing field is sufficient to flag the record.

* If both conditions are true, the formula returns "Missing Post-Appointment Data". Otherwise it returns "Complete Post-Appointment Data".

* The formula is deterministic — the same record state always produces the same output.

**05 — EDGE CASES**

**Boundary Conditions & Failure Modes**

| Condition | Expected Behavior |
| :---- | :---- |
| Record is not in Deliberating stage | Returns "Complete Post-Appointment Data" — formula is scoped to Deliberating only; other stages are not evaluated. |
| Measurements or Appointment Photos attachment field is empty (no files) | BLANK() evaluates to TRUE on empty attachment fields — treated as missing. |
| Follow Up Sent? checkbox is unchecked | Checkbox returns BLANK() when unchecked — treated as missing. |
| Wedding Date (Formatted) has no date set | Date field returns BLANK() when empty — treated as missing. |
| Only some of the four fields are populated | OR() fires on the first missing field — record is flagged incomplete regardless of which fields are present. |
| Field renamed or removed from schema | Formula will return an error value, not a predefined option. Airtable will display the fallback (blank). Catch via interface QA. |
| Record has all four fields but stage is Pre-Appointment | Returns "Complete Post-Appointment Data" — stage gate prevents false flagging before the appointment occurs. |

**06 — INTERFACE USAGE**

**Post-Appointment Interface Integration**

| This field is the primary filter and sort key for the Post-Appointment interface tab. Interface behaviors driven by this field:   • Filter: show only Deliberating clients — "Complete Post-Appointment Data" records can be hidden or deprioritized.   • Sort: surface "Missing Post-Appointment Data" records at the top so SAs see open work first.   • Visual indicator: the red/pink single-select pill signals action needed without clicking into the record. The field must not be edited directly — it is read-only (formula output). |
| :---- |

**07 — DESIGN DECISIONS**

**Key Decisions Made During Build**

**Formula field with single-select formatting, not a native single-select field.**

Rationale: A native single-select requires a human or automation to set the value. A formula field is self-maintaining — no automation needed, no risk of stale data. Single-select formatting preserves interface filterability and color-coding.

Alternative considered: Native single-select updated by an automation on record change. Rejected: adds automation overhead and risk of stale state if the trigger is missed.

**Scoped to Deliberating stage only.**

Rationale: Post-Appointment completeness is only operationally meaningful for clients who have had a Consultation but have not yet purchased. Scoping to Deliberating prevents false flags on Pre-Appointment records (appointment not yet happened) and Sold records (post-purchase follow-up is a different workflow).

Alternative considered: Evaluate all records regardless of stage. Rejected: would surface false positives for Pre-Appointment clients where data collection has not yet occurred.

**Four required fields: Wedding Date, Measurements, Appointment Photos, Follow Up Sent?.**

Rationale: These four match the brief (Section 3.2 / B.3) and the story AC for DFS-1. They represent the minimum complete post-appointment record the SA must deliver.

Alternative considered: Including additional fields (e.g., Sales Associate, Size, Post-Appointment Notes). Rejected: those fields either auto-populate or are optional — including them would over-flag records and reduce signal quality.

**08 — OUT OF SCOPE**

**What This Field Does Not Do**

The following are explicitly not in scope for this field:

* Evaluation of records outside the Deliberating stage (Pre-Appointment, Sold, In Alterations, In Fulfillment, etc.).

* Tracking which specific field is missing — the field flags the record as incomplete but does not identify which of the four checks failed. The interface record view surfaces individual field states.

* Sending notifications or triggering automations — this field is a passive indicator. Automation triggering is a separate story.

* Evaluating Wedding Date (If Not Set) — the formula reads Wedding Date (Formatted) only. The unset-date field is not part of the completeness check.

* Writing back to source fields or modifying record data.

Danielle Frankel Studio · Singular Agency · Field Spec: post\_appointment\_missing\_data · v1.0 · May 2026
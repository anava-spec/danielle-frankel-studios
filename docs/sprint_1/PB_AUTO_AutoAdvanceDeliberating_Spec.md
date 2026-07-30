

| Auto-Advance to Deliberating Backup Automation Spec · \[DFS-1\] Danielle Frankel Studio · Singular Agency · May 2026 |
| :---- |

| Document Type | Automation Spec |
| :---- | :---- |
| **Airtable Name** | Auto-Advance to Deliberating Backup |
| **Canonical Name** | APPT | On View Entry — Advance to Deliberating |
| **Story** | \[DFS-1\] Auto-Advance Missed Appointment |
| **Base** | Danielle Frankel Studio (appUC2NFAlURayLx9) |
| **Primary Table** | DF Appointments \- Acuity (tblvV7uKTCaFFekoR) |
| **Reference Tables** | DF Clients (tblLLUlDgJ4ktzF7c) |
| **Trigger** | When record enters view → stage\_auto\_advance |
| **Script Version** | v1.0 — field IDs verified against live base (May 2026\) |
| **Author** | Singular Agency — Axel Nava |
| **Date** | May 2026 |

**01 — AUTOMATION NAMING**

**Naming Breakdown**

| Segment | Value | Notes |
| :---- | :---- | :---- |
| Table Prefix | APPT | DF Appointments \- Acuity |
| Trigger Type | On View Entry | Fires when record enters stage\_auto\_advance view |
| Action Description | Advance to Deliberating | Updates linked client stage field |
| Canonical Name | APPT | On View Entry — Advance to Deliberating | Per Singular naming standard |
| Airtable UI Name | Auto-Advance to Deliberating Backup | Label used in Airtable automation list |

**02 — SPEC OVERVIEW**

**Objective & Context**

| Objective: Advance a linked Client record from Pre-Appointment to Deliberating when the Clear action was missed. This automation fires 2+ hours after the appointment end time, provided the appointment was not cancelled and the client was checked in. It closes the most common failure mode in the stage transition pipeline without introducing any dependency on manual completion steps, AI-generated fields, or Appointment Recap Generation. |
| :---- |

| Aspect | Detail |
| :---- | :---- |
| Client stage before | Pre-Appointment |
| Client stage after | Deliberating |
| Trigger event | 2 hours after appointment end — appointment not cancelled, client checked in |
| Engagement Brief reference | Section 4.2 — Phase Automations |
| Primary path | Receptionist clicks Clear → client advances immediately to Deliberating |
| This automation | Backup path — 2-hour failsafe when Clear was missed or forgotten |
| Double-advance protection | Stage guard (Pre-Appointment) prevents re-firing if client was already advanced |

**03 — TRIGGER & GUARD CLAUSE**

**Trigger Configuration & View Filters**

**Trigger configuration**

| Property | Value |
| :---- | :---- |
| Trigger type | When record enters view |
| Table | DF Appointments \- Acuity (tblvV7uKTCaFFekoR) |
| View | stage\_auto\_advance |

**Guard conditions — view filters (all four must be TRUE for trigger to fire)**

| Field | Field ID | Condition | Value |
| :---- | :---- | :---- | :---- |
| stage\_auto\_advance\_ready | flduFxx5BvHwWTzA5 | is | TRUE |
| Status | fldZTkJdTBhmcchTb | is not | Cancelled |
| Check\_In | fldarspmpxD4OFpnX | is | TRUE (checked) |
| stage (lookup from Client) | fldB0OcUNXz7sKz58 | is exactly | Pre-Appointment |

**04 — GUARD EVALUATION LOGIC**

**Eligibility Formula & Time Computation**

The stage\_auto\_advance\_ready formula field computes whether the 2-hour window has passed since the appointment ended. It is the primary gate for view entry and is re-evaluated on every Airtable refresh. The view trigger fires once — when the field transitions from blank to TRUE.

| Formula — stage\_auto\_advance\_ready  (flduFxx5BvHwWTzA5): IF(   DATETIME\_DIFF(NOW(), appointment\_end\_time, 'hours') \> 2,   TRUE() ) |
| :---- |

| Component | Field | Field ID | Notes |
| :---- | :---- | :---- | :---- |
| Appointment end time | appointment\_end\_time | fldFwFIBNtC76v0Y7 | Formula: Appointment\_Time \+ duration in minutes |
| 2-hour threshold check | stage\_auto\_advance\_ready | flduFxx5BvHwWTzA5 | DATETIME\_DIFF(NOW(), end\_time, hours) \> 2 → TRUE |
| Appointment start time | Appointment\_Time | fldL7kYvgkmyhGniX | Source datetime for end\_time calculation |
| Duration (minutes) | appointment\_duration | fldwz75krazdSeIQq | Lookup from appointment\_types.default\_duration\_hrL_mm |

**05 — OUTPUT FIELDS**

**Fields Written When Automation Fires**

| Table | Field | Field ID | Type | Written Value |
| :---- | :---- | :---- | :---- | :---- |
| DF Clients | stage | fldLcxVZvI1rigBlh | singleSelect | Deliberating |
| DF Clients | stage\_set\_at | fldFxKWJzNb9ZqZFc | lastModifiedTime | Auto-updated when stage changes |
| DF Clients | stage\_set\_by | fldXxT4N1tZ5xOJ04 | lastModifiedBy | Automation system user |

Note: stage\_set\_at and stage\_set\_by are Airtable system field types (lastModifiedTime and lastModifiedBy) scoped to watch the stage field. They update automatically when stage is written — no explicit action node is required for these fields.

**06 — TECHNICAL IMPLEMENTATION**

**Architecture & Performance**

| Property | Detail |
| :---- | :---- |
| Automation pattern | No-code native Airtable automation — no Run a Script node |
| Trigger type | When record enters view (per-record, event-driven) |
| Action type | Update record in linked table |
| Per-record isolation | Each appointment record triggers independently; one record's outcome does not block others |
| Re-trigger protection | Once client advances past Pre-Appointment, the stage guard fails and the record exits the view |
| Cancellation safety | Status ≠ Cancelled guard prevents advance if appointment was cancelled after check-in |
| No-show safety | Check\_In \= TRUE guard ensures no-shows (never checked in) are not advanced |
| Audit trail | stage\_set\_at and stage\_set\_by update automatically via Airtable system field types |

**Scale note**

Danielle Frankel Studio runs approximately 20–50 appointments per day across all studios. The view-based trigger fires per record and does not loop or query any table in bulk. No performance concern at current or projected appointment volume.

**07 — NODE CONFIGURATION**

**Automation Node Map**

| Node | Type | Configuration |
| :---- | :---- | :---- |
| Trigger | When record enters view | Table: DF Appointments \- Acuity (tblvV7uKTCaFFekoR)  ·  View: stage\_auto\_advance |
| Action 1 | Update record | Table: DF Clients (tblLLUlDgJ4ktzF7c)  ·  Record ID: from Client linked record (fldcVVGhEsnYRsbyR)  ·  Field: stage (fldLcxVZvI1rigBlh) → Deliberating |

No Run a Script node is used. This automation requires no scripting.

**08 — OUT OF SCOPE**

**Explicit Exclusions**

* Does NOT advance clients whose appointment was cancelled — the Status guard blocks this.

* Does NOT fire for no-shows — clients who were never checked in fail the Check\_In guard.

* Does NOT depend on Appointment Recap Generation or any AI-generated field.

* Does NOT replace the primary Clear-button transition — this automation is a backup only.

* Does NOT write directly to stage\_set\_at or stage\_set\_by — these update automatically via Airtable system field types.

* Does NOT handle SA reassignment or any client field other than stage.

* Does NOT advance clients in any stage other than Pre-Appointment — the stage guard enforces this.
Danielle Frankel Studio · Singular Agency · Auto-Advance to Deliberating Backup · v1.0 · May 2026
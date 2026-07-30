# DF Clients — Stage Audit Fields

Schema Change Specification · Production · Danielle Frankel Studio · Singular Agency · May 2026

| Document Type | Schema Change Specification |
| :---- | :---- |
| **Story** | [DFS-1] Client Stage Audit Backfill |
| **Table** | DF Clients (tblLLUlDgJ4ktzF7c) |
| **Base** | DF Studio — Production (appUC2NFAlURayLx9) |
| **Fields Added** | stage_set_at · stage_set_by |
| **Schema Version** | Post-Backfill · May 2026 |
| **Author** | Singular Agency — Will Hernández |
| **Date** | May 2026 |

## 00 — Purpose

This document specifies the two stage audit fields added to the DF Clients table in Production, describes the analysis that led to the chosen implementation approach, and confirms the state of the data backfill across all 5,998 client records. It is intended as a QA handoff reference and a permanent record of the design decision so that future contributors understand why this pattern was chosen over a more complex alternative.

## 01 — Change Summary

Two native Airtable fields were added to the DF Clients table and pushed to Production. No existing fields were modified. No records were deleted.

| Field Name | Field ID | Type | Scope | Business Description |
| :---- | :---- | :---- | :---- | :---- |
| stage_set_at | fldFxKWJzNb9ZqZFc | Last Modified Time | stage field only | Records the timestamp of the most recent change to the stage field on a DF Clients record. Auto-updated by Airtable on every stage transition. Read-only — cannot be manually written. |
| stage_set_by | fldXxT4N1tZ5xOJ04 | Last Modified By | stage field only | Records the collaborator (name + Airtable user ID) who made the most recent change to the stage field. Auto-updated by Airtable on every stage transition. Read-only. |

## 02 — Analysis & Design Decisions

**The original story scope** called for adding two fields — Stage Set At and Stage Set By — and backfilling historical values where possible. During implementation, two approaches were evaluated.

**Option A — Last Modified Time / Last Modified By (Chosen)**

Native Airtable field types scoped to the stage field. Airtable auto-maintains these fields on every stage change with zero configuration beyond the initial field setup. They are read-only (Airtable owns the values) and cannot be manually written to.

**Option B — Stage History Log Table (Rejected)**

A dedicated child table storing one record per stage transition per client, written by an automation triggered on every stage change. Would provide a complete transition history per client — every move, timestamped and attributed.

**Comparison** — criteria evaluated against the approved story scope:

| Criterion | Last Mod Time/By (Chosen) | Stage Log Table (Rejected) | Notes | Weight |
| :---- | :---- | :---- | :---- | :---- |
| Story points | 6 SP (approved) | 13 SP (over budget) | The approved story cannot be re-scoped post-approval. | Hard constraint |
| Historical backfill | Null for all existing records (expected) | Null for all existing records (same) | Airtable has no API/script access to field-level change history. Neither approach recovers historical data across 5,998 records. | Tie — nulls either way |
| Forward tracking | Auto-updated on every stage change, zero maintenance | Requires an automation to write a new log record on each stage change | Log table adds a dependency on automation reliability. | Favors chosen |
| Granularity | Most recent change only — sufficient for use cases | Full transition history per client | Julia's brief explicitly states the goal is tracking "without making stages too granular." | Favors chosen |
| Schema complexity | Two native Airtable fields, no new tables | New table + automation + linked record pattern | Log table introduces referential integrity risk and extra build surface. | Favors chosen |
| Writability / backfill | Read-only (Airtable owns), cannot be manually written | Writable — could be backfilled if source data existed | Source data does not exist for either approach. Read-only is acceptable. | Neutral |
| Re-entry edge case | Resets on stage change — reflects current Deliberating entry | Preserves every historical entry, including re-entries | Re-entry to Deliberating after Sold is an edge case. Resetting the clock is operationally correct behavior. | Acceptable tradeoff |

**Decision:** Option A — Last Modified Time / Last Modified By was implemented. Three factors were determinative:

1. **Hard SP constraint.** The story was approved at 6 SP. The log table would require 13 SP and the story cannot be re-scoped post-approval.
2. **Backfill is impossible for either approach.** Airtable exposes no API or scripting interface for field-level change history. Neither option recovers historical stage transitions across 5,998 records. The AC correctly anticipates this with the rule: "If historical stage timing or actor data cannot be determined, the fields remain null." Existing records receive their first populated value when their stage next changes.
3. **Julia's brief explicitly opposes granularity.** The May 2026 Engagement Brief (Section 2.5) and the story TD both state the goal is trackability "without making stages too granular." A log table adds infrastructure-level granularity that contradicts this directive.

## 03 — Existing Field — Last Phase Change

> ⚠ The following field was NOT modified or deleted as part of this story. It is documented here because its relationship to the new fields must be understood before QA proceeds.

The DF Clients table contains a pre-existing field named Last Phase Change (fldRvvSBhl6vSEnCw, type: Last Modified Time). This field has been in the base since before the current engagement and likely tracks changes to a broader set of fields beyond stage alone — its exact scope configuration is unknown.

The field was not refactored because its scope configuration, consumer dependencies, and whether Cobalt (the parallel backend partner) references it by field ID are unknown. Renaming or deleting it without confirming Cobalt's usage could silently break backend data flows.

**Recommended follow-up:** Confirm with Cobalt whether fldRvvSBhl6vSEnCw is referenced in any backend integration. If unused by Cobalt, refactor or deprecate this field and consolidate onto stage_set_at in a follow-on story.

| Field | Field ID | Type | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| Last Phase Change | fldRvvSBhl6vSEnCw | Last Modified Time | Active — unmodified | Pre-existing. Scope unknown. Do not delete until Cobalt dependency is confirmed. |
| stage_set_at | fldFxKWJzNb9ZqZFc | Last Modified Time | New — scoped to stage field | Canonical stage-change timestamp going forward. |
| stage_set_by | fldXxT4N1tZ5xOJ04 | Last Modified By | New — scoped to stage field | Canonical stage-change actor going forward. |

## 04 — Backfill Results

Backfill completeness was verified against a CSV export of the DF Clients table (DF_Clients-singular_axl.csv, exported May 2026) containing all 5,998 production records.

**Result:** 5,997 of 5,998 records have stage_set_at and stage_set_by populated. The 1 record with null values has no stage set — null is the correct and expected behavior per the story AC ("If a client has no recoverable stage history, the new fields remain null").

Stage distribution across all records:

| Stage Value | Record Count | % of Total | Notes |
| :---- | :---- | :---- | :---- |
| Did Not Convert | 2,098 | 35.0% | |
| Sold | 1,203 | 20.1% | |
| Pre-Appointment | 925 | 15.4% | |
| Deliberating | 734 | 12.2% | Primary target for stage timing trackability. |
| Picked Up | 608 | 10.1% | |
| In Alterations | 360 | 6.0% | |
| In Fulfillment | 68 | 1.1% | |
| In Production | 1 | <0.1% | Legacy stage value — confirmed deprecated per May 2026 brief. Record retained but stage is inactive. |
| (No stage set) | 1 | <0.1% | Null per AC — stage_set_at and stage_set_by correctly remain null for this record. |
| **TOTAL** | **5,998** | **100%** | **5,997 records fully populated. 0 null values where the stage is set.** |

## 05 — Downstream Stories Unblocked

The following three stories were blocked on the stage audit fields existing in Production. All three can now proceed.

| Story | Dependency on This Work | How Unblocked |
| :---- | :---- | :---- |
| **Post-Appointment Completeness Flag** [DFS-1] | Requires a clean, stable stage field on the DF Clients table to scope the Post-Appointment interface correctly to Deliberating clients. | stage_set_at confirms the stage field is active and scoped. The interface can now filter by stage without risk of reading a stale or unscoped value. |
| **Daily Auto Advance to Deliberating** [DFS-1] | The automation AC explicitly requires: "Phase Set At = the last-modified phase-field timestamp, if confirmed to be phase-scoped." | stage_set_at (fldFxKWJzNb9ZqZFc) is now live, scoped to the stage field, and confirmed to be populated across 5,997 records. |
| **Advance Client to Deliberating (Clear Action)** [DFS-1] | The story AC states: "The Phase Set At and Phase Set By fields are updated when the client stage transition fires." | Both stage_set_at (fldFxKWJzNb9ZqZFc) and stage_set_by (fldXxT4N1tZ5xOJ04) are confirmed live in Production. The Clear action implementation can proceed without any schema prerequisite work. |

## 06 — Out of Scope

The following items were considered and explicitly excluded from this story:

- Full stage transition history per client (log table). Deferred — see Section 02 for rationale. Can be revisited as a standalone story if analytics requirements emerge.
- Refactoring or deleting the existing Last Phase Change field (fldRvvSBhl6vSEnCw). Blocked pending Cobalt dependency confirmation — see Section 03.
- Any changes to stage transition logic. This story adds audit metadata only. Stage transitions are governed by existing automations and the three downstream stories listed in Section 05.
- Historical backfill of pre-implementation stage change dates. Technically impossible — Airtable provides no field-level change history via API or scripting.

Danielle Frankel Studio · Singular Agency · DF Clients Stage Audit Fields · v1.0 · May 2026

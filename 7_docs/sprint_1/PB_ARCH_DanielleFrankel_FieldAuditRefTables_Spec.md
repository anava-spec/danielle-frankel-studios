# Redundant Field Audit & Reference Table Build-Out

Data Architecture Overview · Danielle Frankel Studio · Singular Agency · May 2026

| Document Type | Data Architecture Overview |
| :---- | :---- |
| **Story** | Redundant Phase & Sales Associate Field Audit |
| **Base** | DF Studio (appUC2NFAlURayLx9) |
| **Tables in Scope** | DF Clients · DF Appointments - Acuity · Orders - Shopify · Sample Log · staff · Vendors · studios · rooms · appointment_types |
| **Approver** | Julia Shao Collins |
| **Schema Version** | 2.0 — May 20 2026 |
| **Author** | Singular Agency — Axel Nava |
| **Date** | May 2026 |

## 01 — Story Context & Objective

**Story:** As a Client, I want redundant Phase and Sales Associate fields removed from all affected tables, so that the base is easier to maintain and the rewritten automations stay reliable.

This document records the field audit performed across all tables impacted by two completed rewrites:

- Sales Associate cascade rewrite — SA data now flows through a canonical staff linked record and lookup chain, replacing singleSelect and Deep Match patterns.
- Reference table build-out — Studios, Rooms, and Appointment Types reference tables were created to replace fragile singleSelect and formula fields across DF Clients, DF Appointments, Orders - Shopify, Sample Log, and staff.

Legacy fields remain in the base at time of writing. Removal is blocked until the Cobalt backend team updates their field references. This document serves as the approved audit log gating that final cleanup.

## 02 — Audit Scope & Approach

Only fields in the Phase and Sales Associate domains, and their direct replacement fields, are in scope for verdict assignment. Each field was reviewed against:

- Active automations (AUTO #7, #8, #9 checked for stage references; Cobalt backend confirmed for SA field references).
- Formula dependencies — any field referenced by a formula is marked KEEP until the formula is updated.
- Interface views — fields surfaced in active interface pages are retained until the interface is updated.
- Cobalt backend — Cobalt's app references fields by field ID. Any field Cobalt reads or writes is marked REMOVE (Cobalt pending) until they confirm the cutover is complete.

> ⚠ Phase Automation EOD rewrite is out of scope for this story and will be addressed in a dedicated follow-up. Smoke testing is deferred until Cobalt completes their backend changes and confirms the cutover.

## 03 — Field Audit Log — Phase Domain

Two fields fall in the Phase domain. Both are retained.

| Table | Field Name | Field ID | Type | Verdict | Reason |
| :---- | :---- | :---- | :---- | :---- | :---- |
| DF Clients | stage | fldLcxVZvI1rigBlh | singleSelect | **KEEP** | Canonical stage field. Renamed from Phase as part of naming standardization. Referenced by AUTO #7, #8, #9. |
| DF Appointments - Acuity | Phase (from Client) | fldB0OcUNXz7sKz58 | multipleLookupValues | **KEEP** | Derived lookup of DF Clients.stage. No action needed — reads from the canonical field. |

## 04 — Field Audit Log — Sales Associate Domain

The Sales Associate cascade rewrite replaced singleSelect and Deep Match patterns with a canonical staff linked record. The audit below covers all SA-domain fields across DF Clients, DF Appointments - Acuity, and staff.

| Table | Field Name | Field ID | Type | Verdict | Reason |
| :---- | :---- | :---- | :---- | :---- | :---- |
| DF Clients | sales_associate | fldBTKBaw8YvNAlwK | multipleRecordLinks | **KEEP** | Canonical SA linked record to staff table. Source of truth for all SA data. |
| DF Clients | sales_associate_email | fldiGcxcshWvxTKKf | multipleLookupValues | **KEEP** | Lookup from staff via sales_associate. Correct pattern. |
| DF Clients | sales_associate_phone | fldl5vP5mpQrHsTsm | multipleLookupValues | **KEEP** | Lookup from staff via sales_associate. Correct pattern. |
| DF Clients | sales_associate_name | fldH8lJJHPUjPnyHZ | multipleLookupValues | **KEEP** | Lookup from staff. Used by Cobalt backend. |
| DF Clients | sales_associate_first_name | fldOGdfymzJEtTI4m | multipleLookupValues | **KEEP** | Lookup of first_name from staff. Replaced the old formula that parsed the singleSelect string. |
| DF Clients | sales_associate_split_sale | fldwj04L3VnirTxaW | multipleRecordLinks | **KEEP** | Canonical split-sale SA linked record to staff. |
| DF Clients | is_split_sale | fldYsj8PmQWlohEYA | formula | **KEEP** | Formula flag replacing the deprecated Split Sale? checkbox. |
| DF Clients | Sales Associate [deprecate] | fld5r1g7KQ6aGV4Ry | singleSelect | **REMOVE — Cobalt pending** | Legacy singleSelect superseded by sales_associate linked record. Removal blocked until Cobalt updates backend references. |
| DF Clients | Other Seller (Split Sale) [deprecate] | fldQLsdmuNiVyDUDI | singleSelect | **REMOVE — Cobalt pending** | Superseded by sales_associate_split_sale linked record. |
| DF Clients | Split Sale [deprecate] | fldL4kAuZg85f4u68 | checkbox | **REMOVE — Cobalt pending** | Superseded by is_split_sale formula field. |
| DF Appointments - Acuity | sales_associate | flduEJfPPcxxvI5sj | multipleLookupValues | **KEEP** | Lookup from DF Clients.sales_associate (canonical SA chain). |
| DF Appointments - Acuity | sales_associate_name | fldAopgXS7Zw42ZgV | multipleLookupValues | **KEEP** | Lookup from staff via client. Used by Cobalt backend. |
| DF Appointments - Acuity | Sales Associate [deprecate] | fld72aTJdYmpF0VBj | singleSelect | **REMOVE — Cobalt pending** | Legacy singleSelect. No longer updated. Cobalt must stop referencing before removal. |
| DF Appointments - Acuity | SA LOOKUP [deprecate] | fldzWLQEsXG0W8edO | multipleLookupValues | **REMOVE — Cobalt pending** | Legacy lookup superseded by sales_associate and sales_associate_name lookups. |
| staff | role | flddlJfDl0cpBCJaO | multipleRecordLinks | **KEEP** | Canonical role linked record to role_catalog. |
| staff | title [deprecate after stand up] | fldiXF5zDzXVOdBOy | singleLineText | **REMOVE — Pending Julia** | Legacy title field. Superseded by role linked record. Pending Julia Shao Collins confirmation before removal. |

## 05 — Field Audit Log — Reference Table Domain

The reference table build-out replaced eight legacy singleSelect / formula fields with proper linked records and lookups. All eight are marked for removal pending Cobalt cutover.

| Table | Field Name | Field ID | Type | Verdict | Reason |
| :---- | :---- | :---- | :---- | :---- | :---- |
| DF Clients | Studio (formula) | fldNQuys5CFap0drj | formula | **REMOVE — Cobalt pending** | Formula derives studio from Acuity address parsing — fragile when new studios open. Replaced by studio_name / studio_short_name / studio_address rollups. |
| DF Appointments - Acuity | Studio Address | fldthP6CLGo6w7MWJ | singleLineText | **REMOVE — Cobalt pending** | Raw address string from Acuity. Replaced by studio_address lookup via appointment_type → studios. |
| DF Appointments - Acuity | Appointment Type | fldky9XlBM97luBf1 | singleSelect | **REMOVE — Cobalt pending** | Free-text singleSelect. Replaced by appointment_type linked record to appointment_types table. |
| DF Appointments - Acuity | Room | fldCaZ1NUP5W5S73T | singleSelect | **REMOVE — Cobalt pending** | Room singleSelect explodes as new studios open. Replaced by room_link linked record to rooms table. |
| Orders - Shopify | Store | fldGW9ECCrIEZnNQ5 | singleSelect | **REMOVE — Cobalt pending** | Shopify store singleSelect (NYC / LA). Replaced by store_link linked record to studios. |
| Sample Log | Location | fldPHYcHjncDy3JTG | singleSelect | **REMOVE — Cobalt pending** | Sample location singleSelect. Replaced by studio linked record. |
| Sample Log | Address [deprecate] | fldF8hvErPw01RMbw | singleSelect | **REMOVE — Cobalt pending** | Legacy address singleSelect. Renamed [deprecate]. Folded into studio linked records. |
| staff | Location | fldxrnC7r4q8ihENB | singleSelect | **REMOVE — Cobalt pending** | Staff home studio singleSelect. Replaced by location_link linked record to studios. |

## 06 — What Was Built

The following tables and fields were created in production (appUC2NFAlURayLx9) on May 20, 2026 as the implementation satisfying this story's acceptance criteria.

**New Reference Tables**

| Table Name | Table ID | Purpose |
| :---- | :---- | :---- |
| studios | tblYM02GzeYdYk23v | Reference table for all DF physical and virtual studio locations. Drives filtered room and appointment-type selection per studio. |
| rooms | tblI8GIUpyxyWNpPa | 5 records seeded (NY-A, NY-B, Alterations Room C, LA-Butter, LA-Pistachio). Each room is linked to its parent studio. |
| appointment_types | tblhU6FD6innd2VUZ | 17 records seeded from Acuity. type_label formula assembles full Acuity label from label_prefix + appointment_name + duration. |

**New Fields Added to Existing Tables**

| Table | Field Name | Field ID | Type | Links To | Notes |
| :---- | :---- | :---- | :---- | :---- | :---- |
| studios | studio_id | fld1MTPNa5UuMUdQI | singleLineText | — | Primary field. Renamed from studio_name. |
| studios | name | fldA1F8Hx7cOyI6lu | singleLineText | — | Full display name of the studio. |
| studios | short_name | fldYDMiitEk9QiQ6j | singleLineText | — | Short label for formulas (e.g. LA, NY - 260). |
| studios | address | fldYqzLISH0mHNnlK | singleLineText | — | Physical street address. |
| studios | is_active | fldFyn3fKsxajrvsy | checkbox | — | Inactive studios excluded from selection filters. |
| studios | rooms | fldDuTGBeUTPWqJ9z | multipleRecordLinks | rooms | Reciprocal of rooms.studio. |
| studios | appointment_types | fldZ34EZuop08yNac | multipleRecordLinks | appointment_types | Reciprocal of appointment_types.studio. |
| studios | orders_shopify | fldv3TmlagaSfGxKt | multipleRecordLinks | Orders-Shopify | Reciprocal of Orders-Shopify.store_link. |
| studios | sample_log | fldXFn13hiKlQQOtR | multipleRecordLinks | Sample Log | Reciprocal of Sample Log.studio. |
| studios | staff | fldjzZTIr7K0bXvJv | multipleRecordLinks | staff | Reciprocal of staff.location_link. |
| rooms | room_name | fldHV4qThmPBVZM7B | singleLineText | — | Primary. Matches Acuity notation (e.g. NY - A, LA - Butter). |
| rooms | studio | fldnbnNJ3rdwtuX5S | multipleRecordLinks | studios | Parent studio for this room. |
| rooms | is_active | fldtMe60stBqZbsm1 | checkbox | — | Retired rooms excluded from selection. |
| rooms | appointments | fldWp2SvdGSaPuPHN | multipleRecordLinks | DF Appointments | Reciprocal of DF Appointments.room_link. |
| appointment_types | type_label | fldzC7eIrUuH11GuD | formula | — | Primary. Assembled from label_prefix + appointment_name + duration. |
| appointment_types | appointment_name | fld5M3HgiIOycZfKJ | singleSelect | — | Middle segment of label (Consultation, Alterations, etc.). |
| appointment_types | acuity_id | fldISxMLTB85uJ2Xk | singleLineText | — | Acuity type ID — use for matching; names differ between Acuity and Airtable. |
| appointment_types | default_duration_min | fldt2WLHOcyZDQaGu | number | — | Duration in minutes from Acuity type name. |
| appointment_types | category | fldjrB1AZBwZrJB5u | singleSelect | — | Routing category: Sales, Alterations, Fulfillment. |
| appointment_types | studio | fld8v72lFFNXI9ndx | multipleRecordLinks | studios | Studio offering this appointment type. |
| appointment_types | studio_name | fldPrVI90dgd3L2q2 | multipleLookupValues | — | Lookup: studios.name. |
| appointment_types | studio_short_name | fld8CASIhk5y6Jk6p | multipleLookupValues | — | Lookup: studios.short_name. |
| appointment_types | studio_address | fldFWT8e2HNACkgjV | multipleLookupValues | — | Lookup: studios.address. |
| appointment_types | deposit_required | fldnvxTM44ebgjXUj | checkbox | — | |
| appointment_types | appointments | fldy3mYOEEye1YNo4 | multipleRecordLinks | DF Appointments | Reciprocal of DF Appointments.appointment_type. |
| Vendors | vendor_type | fldzhQEPHUoft8B3K | singleSelect | — | Options: 3PL, Bridal Stylist, Planner, Other. Enables filtered selection in interfaces. |
| DF Clients | studio_name | fldIenJoxseeHmfIv | rollup | — | Rollup of studios.name via Appointment Records. |
| DF Clients | studio_short_name | fld1AWRrVteCUmVto | rollup | — | Rollup of studios.short_name via Appointment Records. |
| DF Clients | studio_address | flddvZs323UJ3MUed | rollup | — | Rollup of studios.address via Appointment Records. |
| DF Appointments | appointment_type | fldxUFnY9hXz5New1 | multipleRecordLinks | appointment_types | Replaces Appointment Type singleSelect. |
| DF Appointments | room_link | fldKVUlPm7Gq3EUF9 | multipleRecordLinks | rooms | Replaces Room singleSelect. Named room_link (name conflict with existing Room field). |
| DF Appointments | studio_name | fldelULQNcaGnAv5K | multipleLookupValues | — | Lookup: studios.name via appointment_type → studio. |
| DF Appointments | studio_short_name | fldpA301QrlWlhZRJ | multipleLookupValues | — | Lookup: studios.short_name via appointment_type → studio. |
| DF Appointments | studio_address | fldsus51vNcmg20fa | multipleLookupValues | — | Lookup: studios.address via appointment_type → studio. |
| DF Appointments | virtual_appointment_link | fldicMNR2Z9ESNczt | url | — | Zoom / virtual meeting URL for virtual appointments. |
| Orders - Shopify | store_link | fldyXDoP77bLMTsuM | multipleRecordLinks | studios | Replaces Store singleSelect. Named store_link (name conflict with existing Store field). |
| Sample Log | studio | fldxDhnUj2ZzfxQE2 | multipleRecordLinks | studios | Replaces Location singleSelect. Renamed from location_link. |
| staff | location_link | fldOqZBW2hiioy6mt | multipleRecordLinks | studios | Replaces Location singleSelect. Named location_link (name conflict with existing Location field). |

## 07 — Pending Deprecations

The following fields are approved for removal but are blocked on Cobalt's backend cutover. No deletion will be executed until Cobalt confirms their references have been updated.

| Table | Field Name | Field ID | Blocked On |
| :---- | :---- | :---- | :---- |
| DF Clients | Sales Associate [deprecate] | fld5r1g7KQ6aGV4Ry | Cobalt backend cutover |
| DF Clients | Other Seller (Split Sale) [deprecate] | fldQLsdmuNiVyDUDI | Cobalt backend cutover |
| DF Clients | Split Sale [deprecate] | fldL4kAuZg85f4u68 | Cobalt backend cutover |
| DF Clients | Studio (formula) | fldNQuys5CFap0drj | Cobalt backend cutover |
| DF Appointments - Acuity | Sales Associate [deprecate] | fld72aTJdYmpF0VBj | Cobalt backend cutover |
| DF Appointments - Acuity | SA LOOKUP [deprecate] | fldzWLQEsXG0W8edO | Cobalt backend cutover |
| DF Appointments - Acuity | Studio Address | fldthP6CLGo6w7MWJ | Cobalt backend cutover |
| DF Appointments - Acuity | Appointment Type | fldky9XlBM97luBf1 | Cobalt backend cutover |
| DF Appointments - Acuity | Room | fldCaZ1NUP5W5S73T | Cobalt backend cutover |
| Orders - Shopify | Store | fldGW9ECCrIEZnNQ5 | Cobalt backend cutover |
| Sample Log | Location | fldPHYcHjncDy3JTG | Cobalt backend cutover |
| Sample Log | Address [deprecate] | fldF8hvErPw01RMbw | Cobalt backend cutover |
| staff | Location | fldxrnC7r4q8ihENB | Cobalt backend cutover |
| staff | title [deprecate after stand up] | fldiXF5zDzXVOdBOy | Julia Shao Collins confirmation |

## 08 — Out of Scope / Deferred

- Phase Automation EOD rewrite — the new Deliberating-by-EOD logic is a separate story. No staging or helper fields from the old recap-dependent logic were removed in this pass.
- Smoke testing — deferred until Cobalt completes their backend cutover and confirms field references are updated.
- 3PL linked record — third_party_logistics linked record fields were created and then removed in this session. The existing 3PL singleSelect on DF Clients and Orders - Shopify is retained; the field set is too constrained to justify a linked record.
- Warehouses table — on hold pending Julia Shao Collins confirmation on whether Warehouse is 1:1 with Studio.
- Base-wide deduplication — any redundant fields outside the Phase and Sales Associate domains are out of scope for this story.

Danielle Frankel Studio · Singular Agency · Redundant Field Audit & Reference Table Build-Out · v1.0 · May 2026

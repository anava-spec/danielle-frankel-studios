# Canonical Staff Link Migration

Data Architecture Overview — Staff Reference Data Normalization · Danielle Frankel · Singular Agency · v1.0 · May 2026

| Document Type | Data Architecture Overview |
| :---- | :---- |
| **Story** | Canonical Staff Link Migration |
| **Base** | Danielle Frankel — Production (appUC2NFAlURayLx9) |
| **Sandbox Ref** | app10POKRBDLqbcNo |
| **Tables Affected** | 6 (DF Clients, DF Appointments - Acuity, Orders - Shopify, Customizations, staff, role_catalog) |
| **Tables Created** | 1 (role_catalog) |
| **Tables Renamed** | 1 (Staff → staff) |
| **Author** | Singular Agency — Axel Nava |
| **Version** | v1.0 |
| **Date** | May 2026 |

## 01 — Migration Purpose

**Why this migration exists**

The Danielle Frankel base relied on single-select fields and Deep Match to associate Sales Associate information with clients, appointments, orders, and customizations. This pattern created multiple sources of truth for the same data, made staff updates expensive (touching every dependent record), and produced silent drift whenever a Sales Associate name was edited in one place but not others.

This migration normalizes Staff data into a canonical table and converts every dependent surface to a linked-record-plus-lookup pattern. Selecting a Staff record once now populates the related Email, Phone, Role, and Name attributes across all dependent tables through lookup fields, eliminating duplicate data and enabling role-based filtering across the base.

**Migration objective.** Replace the "Sales Associate single-select + Deep Match" pattern with a canonical staff table and linked-record references across DF Clients, DF Appointments - Acuity, Orders - Shopify, and Customizations. Establish role_catalog as the secondary reference table to enable role-based filtering on staff-typed fields.

## 02 — Architecture Overview

**The new canonical model**

The migration introduces a two-table reference layer (staff + role_catalog) and rewires every staff-typed field across the operational tables to consume from that layer. The data flow is unidirectional:

**role_catalog → staff → DF Clients → DF Appointments - Acuity / Orders - Shopify / Customizations**
(reference) (canonical) (source of SA) (consumers)

DF Clients holds the canonical link to staff (via sales_associate). Every downstream table looks up the Sales Associate for an appointment, order, or customization by traversing the Client linked record back to DF Clients, then reading the linked staff record. This pattern guarantees that changing a Sales Associate on a client propagates automatically to every related appointment, order, and customization.

## 03 — Tables Affected

**Catalog of every table touched by the migration**

| Table Name | Table ID | Role in Migration |
| :---- | :---- | :---- |
| DF Clients | tblLLUlDgJ4ktzF7c | Canonical owner of sales_associate link. Holds the staff relationship that all downstream tables look up through. |
| DF Appointments - Acuity | tblvV7uKTCaFFekoR | Consumes Sales Associate via lookup from Client. Adds alterations_lead linked record. |
| Orders - Shopify | tblHFGbijtvZcRPkE | Consumes Sales Associate via lookup from Client. SA single-select removed. |
| Customizations | tbl7HUWDI7IRjWY92 | Consumes Sales Associate via lookup from client. Pattern Maker repointed to use role-based filtering. |
| staff | tblbYk88xJ8FQrLS4 | Canonical Staff table. Renamed from Staff to staff. Orphan fields removed. New fields added: first_name, last_name, is_active, role, role_name. |
| role_catalog | tblixR44ZBSOpiWeh | NEW table. Reference data for Role. Drives selection limits on staff-typed fields by role. |

## 04 — New Relationships

**Linked records introduced by the migration**

| From Table | Field | Field ID | To Table | Type |
| :---- | :---- | :---- | :---- | :---- |
| DF Clients | sales_associate | fldBTKBaw8YvNAlwK | staff | many → 1 |
| DF Clients | sales_associate_split_sale | fldwj04L3VnirTxaW | staff | many → 1 |
| DF Appointments - Acuity | alterations_lead | fldErMecJ5hzy8n42 | staff | many → 1 |
| Customizations | pattern_maker | fldzrl0ckwnCBMWUX | staff | many → 1 |
| staff | role | flddlJfDl0cpBCJaO | role_catalog | many → 1 |
| role_catalog | Staff | fldWTiF7PF3xCt5vx | staff | 1 → many |
| staff | clients | fldUfGjENxiY5ASAe | DF Clients | 1 → many (reciprocal) |
| staff | clients_split_sale | fld2Z302YGfGELokv | DF Clients | 1 → many (reciprocal) |
| staff | alterations_lead_appointments | fldHwLE0uJbTooXeI | DF Appointments - Acuity | 1 → many (reciprocal) |

## 05 — Implementation Status

**What was pushed to Production, what is on hold, what is missing**

Status values: Done means the change is live in Production. On Hold means deferred pending Cobalt code changes (target EOW 5/22). Deviation means implemented differently than originally planned (rationale in Section 07).

**// DF Clients (tblLLUlDgJ4ktzF7c)**

| Field | Field ID | Planned Action | Status |
| :---- | :---- | :---- | :---- |
| Sales Associate (legacy singleSelect) | fld5r1g7KQ6aGV4Ry | Deprecate after backfill of Staff link. Rename Staff → Sales Associate. | On Hold — Cobalt |
| sales_associate (canonical link) | fldBTKBaw8YvNAlwK | Keep. Rename Staff → sales_associate. Remove Deep Match. Limit selection by Role. | Done |
| sales_associate_email | fldiGcxcshWvxTKKf | Keep lookup. Verify source = Staff link. | Done |
| sales_associate_phone | fldl5vP5mpQrHsTsm | Keep lookup. Verify source = Staff link. | Done |
| sales_associate_role | fldtXOO3SL1zADlkU | Keep lookup. Verify source = Staff link. | Done |
| Other Seller (Split Sale) [deprecate] | fldQLsdmuNiVyDUDI | Deprecate. Replace with linked record to staff. | Done |
| sales_associate_split_sale | fldwj04L3VnirTxaW | NEW. Linked record to staff for split sales. | Done |
| sales_associate_split_sale_name | fldzVNZ9aF9ybu6CN | NEW. Lookup of split sale staff name. | Done |
| sales_associate_first_name | fldOGdfymzJEtTI4m | Rewrite as lookup of first_name off staff link (was formula parsing single-select string). | Done |
| sales_associate_name | fldH8lJJHPUjPnyHZ | NEW. Lookup of full_name off staff link. | Done |
| is_split_sale | fldYsj8PmQWlohEYA | NEW. Formula replacing the legacy Split Sale automation. | Done |

**// DF Appointments - Acuity (tblvV7uKTCaFFekoR)**

| Field | Field ID | Planned Action | Status |
| :---- | :---- | :---- | :---- |
| Sales Associate (legacy singleSelect) | fld72aTJdYmpF0VBj | Deprecate. Keep only SA lookup with Client as source. | On Hold — Further Discussion |
| SA LOOKUP | fldzWLQEsXG0W8edO | Keep, source = Client link. Convert from multipleLookupValues to multipleRecordLinks. | Partially Done — Type change pending |
| sales_associate_name | fldAopgXS7Zw42ZgV | NEW. Lookup of Sales Associate name off Client link. | Done |
| Alterations Lead (legacy singleSelect) | fldg3yH59pAnmHzjG | Replace with linked record to staff. Limit selection by Role. | On Hold — Cobalt |
| alterations_lead (new link) | fldErMecJ5hzy8n42 | NEW. Linked record to staff. Coexists with legacy singleSelect until Cobalt updates. | Done |

**// Orders - Shopify (tblHFGbijtvZcRPkE)**

| Field | Field ID | Planned Action | Status |
| :---- | :---- | :---- | :---- |
| sales_associate | fldHciJNFQSMgTqJK | Keep lookup. Verify it traverses Client → staff. Repoint if needed. | Done |
| sales_associate_split_sale | fldgu6jPw3DCGEWCs | Keep lookup. Verify source. | Done |
| SA (legacy singleSelect) | fldDLwkln1qMy5Gff | Delete. Replaced by Client-derived sales_associate lookup. | Done — Deleted |

**// Customizations (tbl7HUWDI7IRjWY92)**

| Field | Field ID | Planned Action | Status |
| :---- | :---- | :---- | :---- |
| client | fldOeL4VVcXaKwwlN | Rename Client → client (snake_case standardization). | Done |
| Sales Associate (from Customization Client) | fldZ5towmwbgJho67 | Keep lookup. Verify source traverses Client → staff link. | Done |
| customization_approver | fldrW8SyjlCuFMjH2 | Keep lastModifiedBy. Rename to snake_case. | Done |
| pattern_maker | fldzrl0ckwnCBMWUX | Keep linked record. Limit selection by Role. Rename to snake_case. | Done — Filter uses text match (see Section 07) |

**// staff (tblbYk88xJ8FQrLS4)**

| Field | Field ID | Planned Action | Status |
| :---- | :---- | :---- | :---- |
| Table rename Staff → staff | — | Standardize table naming to snake_case. | Done |
| full_name | fldc8INBZmwC3xeH7 | Rename Name → full_name. Convert from singleLineText to formula concatenating first_name + last_name. | Done |
| first_name | fldLmC4fKuuC4NAI8 | NEW. Split from Name to enable clean lookup for Primary - Sales Associate First Name. | Done |
| last_name | fldPs6hza4rBJ3L7H | NEW. Split from Name. | Done |
| is_active | fldB6rPTjxATp7uMf | NEW. Checkbox to scope automations and filters to current staff. | Done |
| role | flddlJfDl0cpBCJaO | NEW. Linked record to role_catalog. Replaces Title. | Done |
| role_name | fld1P7ZjPabKLrlPG | NEW. Lookup of role_name from role link. | Done |
| title [deprecate after stand up] | fldiXF5zDzXVOdBOy | Deprecate Title after backfill of role. Pending Julia confirmation. | Done — Tagged |
| clients | fldUfGjENxiY5ASAe | NEW. Reciprocal link from DF Clients.sales_associate. | Done |
| clients_split_sale | fld2Z302YGfGELokv | NEW. Reciprocal link from DF Clients.sales_associate_split_sale. | Done |
| alterations_lead_appointments | fldHwLE0uJbTooXeI | NEW. Reciprocal link from DF Appointments - Acuity.alterations_lead. | Done |
| Sample Scans | fldH7zrpV6n57NEy6 | Audit and remove (orphan from earlier link attempts). | Done — Deleted |
| Sample Log | fldvDvBNXBohXnTcy | Audit and remove. | Done — Deleted |
| Sample Scans 2 | fldtOdsIq7RdKqP6D | Audit and remove. | Done — Deleted |
| Sample Scans 3 | fldTP7CZCIMWseM6R | Audit and remove. | Done — Deleted |
| Sample Scans 4 | fldDqZv1PJr52UnDW | Audit and remove. | On Hold |
| Sample Scans 5 | fldsPGYLrUQXxaCHy | Audit and remove. | Done — Deleted |
| DF Clients (orphan) | fldvmKtw0OagjLj1C | Audit and remove. | Done — Deleted |

**// role_catalog (tblixR44ZBSOpiWeh) — NEW TABLE**

| Field | Field ID | Planned Action | Status |
| :---- | :---- | :---- | :---- |
| role_id (primary) | fld2UHa1JXSPnMX7u | Primary field. Plan called for "role"; implemented as role_id formula. | Done |
| role_name | fld4s9IiRRz0UJevM | singleLineText holding the role label. | Done |
| location | fld3HX3NBAgIY8CMz | singleSelect. | Done |
| is_active | fld2KcnlBDJjVOIqY | checkbox. | Done |
| Staff | fldWTiF7PF3xCt5vx | Linked record to staff table. | Done |

## 06 — Deferred & On Hold

**Blocked items and their reason**

The following items are intentionally left in Production in their pre-migration state. They are blocked on Cobalt code changes (target EOW 5/22) or on resolution of an open product question. The legacy single-select fields coexist with their canonical replacements until Cobalt deploys the new functionality, at which point a follow-up push will retire the legacy fields.

> ⚠ Yellow-list fields from Cobalt: Nadiia has commented out the application code that reads from these fields to prevent breakage during the transition. Do NOT delete the legacy fields until Cobalt confirms the new code path is live.

| Table | Field | Reason for Hold | Owner |
| :---- | :---- | :---- | :---- |
| DF Clients | Sales Associate (singleSelect) | Cobalt commented out code path. Awaiting new functionality for staff-link based search/create. | Cobalt — Nadiia |
| DF Appointments - Acuity | Sales Associate (singleSelect) | Open product question: preserve historical SA for past appointments when SA changes on client? | Julia + Cobalt |
| DF Appointments - Acuity | Alterations Lead (singleSelect) | Cobalt commented out code path. Replacement alterations_lead linked record already live. | Cobalt — Nadiia |
| DF Appointments - Acuity | SA LOOKUP type change | Conversion from multipleLookupValues to multipleRecordLinks not yet executed. | Singular |
| staff | Sample Scans 4 | Orphan field flagged for removal, deferred pending verification. | Singular |
| staff | title [deprecate after stand up] | Awaiting Julia confirmation before final deletion. Role backfill completed. | Julia |

## 07 — Key Design Decisions

**Deviations from plan and architectural choices**

**Decision 1 — role_catalog primary field is role_id (formula), not role**

Rationale: A formula primary field generates a stable, deterministic identifier that does not collide when two roles share the same display name across studios. role_name (singleLineText) holds the human-readable label, while location (singleSelect) distinguishes role instances by studio. This protects against duplicate "Sales Associate" entries when the role exists in both New York and LA.

Alternative considered: Use role as a plain singleLineText primary field per the original CSV plan. Rejected because it allows duplicates and provides no protection against typos when Julia adds new roles through the Backoffice form.

**Decision 2 — pattern_maker filter uses text match, not linked record filter**

Rationale: Record IDs between Sandbox (app10POKRBDLqbcNo) and Production (appUC2NFAlURayLx9) do not match for the same logical staff records. Configuring pattern_maker to filter selection on a linked record reference would break the moment the configuration was pushed to Production because the referenced record IDs would not resolve. Filtering by text match on role_name is a temporary fallback that survives the push.

Resolution path: After all in-flight Sandbox-to-Production pushes complete, the current Sandbox will be deleted and recreated from Production to align record IDs. Once aligned, the pattern_maker filter (and any future similar filter) will be migrated to a proper linked-record-based filter.

**Decision 3 — Phased deprecation rather than immediate deletion**

Rationale: Cobalt has external code paths reading from the legacy singleSelect fields (DF Clients.Sales Associate, DF Appointments - Acuity.Sales Associate, DF Appointments - Acuity.Alterations Lead). Deleting these fields immediately would break the live application. The migration instead tags them with [deprecate after stand up] suffixes and leaves them in place until Cobalt confirms the replacement code path is live (target EOW 5/22).

**Decision 4 — Name split into first_name + last_name + full_name formula**

Rationale: The DF Clients.Primary - Sales Associate First Name field was originally a formula that parsed the first token of the singleSelect string. With the singleSelect deprecated, the parse breaks. Splitting Name on staff into first_name and last_name makes Primary - Sales Associate First Name a clean lookup instead of a string-parse, future-proofs personalization in automated emails, and gives the Backoffice form a discrete first-name field to capture.

Implementation note: last_name was added beyond the original CSV scope to complete the split symmetrically and enable the full_name formula (first_name + last_name).

## 08 — Naming Conventions

**Standards applied across the migration**

| Convention | Pattern | Examples |
| :---- | :---- | :---- |
| snake_case for all new fields | lowercase, underscore-separated | sales_associate, sales_associate_email, first_name, role_name |
| snake_case for renamed fields | apply on rename when touched | Pattern Maker → pattern_maker, Customization Approver → customization_approver |
| snake_case for table names | apply when migrating reference tables | Staff → staff, role_catalog |
| Deprecation suffix | append "[deprecate after stand up]" to field name | title [deprecate after stand up], Other Seller (Split Sale) [deprecate after stand up] |
| Lookup naming | <linked_field>_<attribute> | sales_associate_email, sales_associate_phone, sales_associate_first_name |
| Reciprocal link naming | plural noun representing the related collection | clients (in staff), clients_split_sale, alterations_lead_appointments |
| Boolean prefix | is_ for state, has_ for possession | is_active, is_split_sale |

Danielle Frankel · Singular Agency · Canonical Staff Link Migration · v1.0 · May 2026

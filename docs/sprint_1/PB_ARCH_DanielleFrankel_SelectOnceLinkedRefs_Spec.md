# Select-Once Linked References

Pattern Reference & Production Implementation Status · Danielle Frankel Studio · Singular Agency · May 2026

| Document Type | Pattern Reference / Data Architecture |
| :---- | :---- |
| **Pattern Name** | Select-Once Linked References |
| **Base** | Danielle Frankel Studio Production (appUC2NFAlURayLx9) |
| **Sandbox Counterpart** | app10POKRBDLqbcNo |
| **Related Migration** | Canonical Staff Link Migration |
| **Tables Affected** | 9 |
| **Status** | In progress — partial Production cutover |
| **Author** | Singular Agency — Axel Nava |
| **Version** | v1.0 |
| **Date** | May 2026 |

## 01 — Pattern Statement

**What this pattern is and why it exists**

The Select-Once Linked References pattern is the base-level standard for handling any field on a record that names a separately-managed entity (a person, a studio, a room, a vendor, an appointment type, etc.). Instead of duplicating the entity's attributes as a singleSelect option list — which drifts over time and forces ad-hoc scripts to keep email, phone, role, and other attributes in sync — the pattern resolves the reference once, through a single linked record, and exposes all dependent attributes as lookups off that link.

**Pattern rule:** Select once on the linked record. Populate many through lookups. Never duplicate reference attributes as parallel singleSelect fields.

The pattern delivers four operational benefits: (1) a single source of truth eliminates option-list drift; (2) all dependent attributes update for free when the source record changes; (3) downstream automations can filter and group by the linked entity natively; and (4) historical records remain intact when an entity is deactivated, because the link does not depend on the option list.

## 02 — Canonical Reference

**The Staff link is the template**

The Canonical Staff Link Migration story established the template for this pattern using the staff table as the source of truth for all internal personnel. Every other reference field on the base — Studio, Room, Appointment Type, Vendor, and so on — must follow the same shape that the Staff link established.

The canonical Staff implementation includes:

| Component | Concrete example | Field ID |
| :---- | :---- | :---- |
| Source-of-truth table | staff | tblbYk88xJ8FQrLS4 |
| Selection field (link) | DF Clients.sales_associate (multipleRecordLinks) | fldBTKBaw8YvNAlwK |
| Derived lookup — email | DF Clients.sales_associate_email | fldiGcxcshWvxTKKf |
| Derived lookup — phone | DF Clients.sales_associate_phone | fldl5vP5mpQrHsTsm |
| Derived lookup — name | DF Clients.sales_associate_name | fldH8lJJHPUjPnyHZ |
| Derived lookup — role | DF Clients.sales_associate_role | fldtXOO3SL1zADlkU |
| Reciprocal link | staff.clients (multipleRecordLinks) | fldUfGjENxiY5ASAe |
| Filter reference table | role_catalog (controls valid selections by role) | tblixR44ZBSOpiWeh |

The role_catalog table is a second-order piece of the pattern: it acts as the constraint layer that limits which staff records can populate a role-specific link (for example, pattern_maker on Customizations may only select staff whose role = Pattern Maker). Every linked-record selector that needs role-based filtering follows this two-table approach.

## 03 — Pattern Mechanics

**How to implement the pattern on any reference field**

Every application of the pattern follows the same five-step structure:

| Step | What to build | Naming rule |
| :---- | :---- | :---- |
| 1 | Reference table — single source of truth for the entity (e.g. staff, Studios, Rooms). | snake_case, plural for multi-record tables (e.g. staff, role_catalog, Rooms). |
| 2 | Selection field on the consuming table — multipleRecordLinks pointing at the reference table. | snake_case, singular for one-of-one fields (e.g. sales_associate, room). |
| 3 | Derived lookups — one multipleLookupValues field per dependent attribute (email, phone, address, etc.). | Prefixed with link name + underscore + attribute (e.g. sales_associate_email). |
| 4 | Reciprocal link on the reference table — auto-created by Airtable when step 2 is built. | snake_case, plural (e.g. clients, clients_split_sale, alterations_lead_appointments). |
| 5 | Role/type filter — for selection fields that restrict by category, point the link's record selection at a filtered view (using role_catalog for staff, or Vendor Type for Vendors). | Filter rule documented inline in the field configuration. |

**Deterministic resolution:** Lookups are evaluated by Airtable, not by an automation. The pattern is fully declarative; no script is needed to keep dependent attributes in sync. AI-assisted logic must never reshape the resolved values — orchestration and transformation only.

## 04 — Field Coverage Map

**Fields in scope for this pattern, grouped by reference target**

Scope tied to this story (excluding fields owned by the Canonical Staff Link Migration story):

| Source Table | Field | Field ID | Reference Target |
| :---- | :---- | :---- | :---- |
| DF Clients | Phase → stage (rename) | fldLcxVZvI1rigBlh | n/a — vocabulary rename |
| DF Clients | Studio | fldNQuys5CFap0drj | Studios (new) |
| DF Clients | 3PL | fldSxZrcIbBlyJO6R | Vendors (with Vendor Type) |
| DF Clients | Warehouse | fldDwLPMhkptv8SSK | TBD — pending Julia |
| DF Appointments - Acuity | Appointment Type | fldky9XlBM97luBf1 | Appointment Types (new) |
| DF Appointments - Acuity | Studio Address | fldthP6CLGo6w7MWJ | Studios (new) |
| DF Appointments - Acuity | DF Studio | fldwxeWXAeyhnua3J | Studios (drop formula) |
| DF Appointments - Acuity | Room | fldCaZ1NUP5W5S73T | Rooms (new, linked to Studios) |
| Orders - Shopify | Store | fldGW9ECCrIEZnNQ5 | Studios (new) |
| Orders - Shopify | Warehouse | flduLQhFMwXzBSSFe | TBD — pending Julia |
| Orders - Shopify | 3PL | fld4jzdVnIQ7JzU7U | Vendors (with Vendor Type) |
| Sample Log | Location | fldPHYcHjncDy3JTG | Studios (+ Away States flag) |
| Sample Log | Address | fldF8hvErPw01RMbw | Studios (drop after cutover) |
| staff | Location | fldxrnC7r4q8ihENB | Studios (new) |

## 05 — Production Implementation Status

**What is live, what is on hold, what is awaiting cutover**

**5.1 Completed in Production**

The following changes have been pushed to the Production base (appUC2NFAlURayLx9) and verified against the live schema:

| Source Table | Field | Field ID | Action |
| :---- | :---- | :---- | :---- |
| DF Clients | Phase → stage | fldLcxVZvI1rigBlh | Renamed |
| DF Clients | Template Email to Send | fldW1ci3tVrbYiUX3 | Deleted (low usage) |
| DF Clients | Order Ready Email | fldOgkxODIHZf6EpH | Deleted (low usage) |
| DF Clients | Sales - Shopify copy | fld8KBlpNo1a7kEHH | Deleted (orphan) |
| DF Clients | DF Appointments - Acuity copy | fldRmVsd76DZZ36XS | Deleted (orphan) |
| DF Clients | From field: DF Clients | fld4hx2GPTD1KV3Fw | Deleted (orphan) |
| DF Appointments - Acuity | Client copy | fldmCahFpKMhyDiC0 | Deleted (orphan) |
| DF Appointments - Acuity | Client copy 2 | fldi59tTVh3GA8HOL | Deleted (orphan) |
| DF Appointments - Acuity | DF Clients copy | fldBfciQgzy51DdGc | Deleted (orphan) |
| DF Appointments - Acuity | Field 33 | fldfU7PZ6lgSm3fIz | Deleted (orphan) |
| Orders - Shopify | DF Clients | fld9JpOp537IxoMu1 | Deleted (orphan) |
| Orders - Shopify | DF Clients 2 | fldas8YyNpwP7hyHP | Deleted (orphan) |
| Orders - Shopify | Table 5 | fldRoTfGOXFhGefvN | Deleted (orphan) |
| Orders - Shopify | Table 5 (2) | fldaJZVDMdWpX3LQp | Deleted (orphan) |
| Orders - Shopify | DF Styles copy | fld4YjX5gKjpkBh6A | Deleted (orphan) |
| Orders - Shopify | DF Clients copy | fldDfEchZGkkbur6q | Deleted (orphan) |
| Orders - Shopify | Full Name copy | fldAyA3smNFqpSoyM | Deleted (orphan) |
| Customizations | DF Clients | fldcXffLH5KsinVNw | Deleted (orphan) |
| Customizations | DF Clients 3 | fldzR5BhIAMn2tvcT | Deleted (orphan) |
| Customizations | DF Clients 4 | fldLTmNU3P12xSwuK | Deleted (orphan) |
| Customizations | DF Styles copy (x2) | fldU5pj96HYDt18qS, fldHrcjA9SIHyn7xz | Deleted (orphans) |
| Customizations | DF Clients copy | flddy2Guxj8hUHyt8 | Deleted (orphan) |
| Sample Log | DF Appointments - Acuity copy | fldGto40FHbEoQnXn | Deleted (orphan) |
| Sample Scans | DF Clients | fldfkKuJFC3DeT5Eb | Deleted (orphan) |
| DF Styles | DF Brides 2, DF Clients 4 | flddJ4QMZIMWIBOcY, fldPAkwWsoXATqE79 | Deleted (orphans) |
| DF Styles | Sales - Shopify copy, DF Brides copy | fldUUBW3uisAWmdtJ, fldfspw429P0rugzC | Deleted (orphans) |
| DF Styles | Customizations, Customizations 2 | fldLkcQB3V42r7xim, fldCSxP7YsGyKAlII | Deleted (orphans) |
| DF Styles | DF Clients copy (x3) | fldlZ10uhNH1MF3Qq, fldqg5HBw9OTySx7Z, fldoGqY8t9r4RwxY5 | Deleted (orphans) |

**5.2 On Hold — Pending New Reference Tables**

These changes are blocked behind the creation of new reference tables (Studios, Rooms, Appointment Types, Warehouses) or a Vendors-with-type extension. Implementation is deferred until those tables exist.

| Source Table | Field | Field ID | Blocking dependency |
| :---- | :---- | :---- | :---- |
| DF Clients | Studio (formula) | fldNQuys5CFap0drj | Studios table |
| DF Clients | 3PL | fldSxZrcIbBlyJO6R | Vendors + Vendor Type field |
| DF Clients | Warehouse | fldDwLPMhkptv8SSK | TBD — confirm with Julia (1:1 with Studio?) |
| DF Appointments - Acuity | Appointment Type | fldky9XlBM97luBf1 | Appointment Types table |
| DF Appointments - Acuity | Studio Address | fldthP6CLGo6w7MWJ | Studios table |
| DF Appointments - Acuity | DF Studio (formula) | fldwxeWXAeyhnua3J | Studios table (drop after cutover) |
| DF Appointments - Acuity | Room | fldCaZ1NUP5W5S73T | Rooms table (linked to Studios) |
| Orders - Shopify | Store | fldGW9ECCrIEZnNQ5 | Studios table |
| Orders - Shopify | Warehouse | flduLQhFMwXzBSSFe | TBD — confirm with Julia |
| Orders - Shopify | 3PL | fld4jzdVnIQ7JzU7U | Vendors + Vendor Type field |
| Sample Log | Location | fldPHYcHjncDy3JTG | Studios table + Away States flag |
| Sample Log | Address | fldF8hvErPw01RMbw | Studios table (drop after cutover) |
| Sample Log | Location - Google Sheet | fldfcWm3waiFA1Ycs | None — clean deprecation candidate |
| staff | Location | fldxrnC7r4q8ihENB | Studios table |

**5.3 Awaiting Cutover — Legacy Fields with Deprecation Markers**

These fields remain in Production but are flagged for removal once the new linked-record pattern is fully validated.

| Source Table | Field | Field ID | Owned by |
| :---- | :---- | :---- | :---- |
| DF Clients | Sales Associate (singleSelect) | fld5r1g7KQ6aGV4Ry | Canonical Staff Link Migration |
| DF Clients | Other Seller (Split Sale) [deprecate after stand up] | fldQLsdmuNiVyDUDI | Canonical Staff Link Migration |
| DF Clients | Split Sale [deprecate after stand up] | fldL4kAuZg85f4u68 | Canonical Staff Link Migration |
| DF Appointments - Acuity | Sales Associate (singleSelect) | fld72aTJdYmpF0VBj | Canonical Staff Link Migration |
| DF Appointments - Acuity | Alterations Lead (singleSelect) | fldg3yH59pAnmHzjG | Canonical Staff Link Migration |
| staff | title [deprecate after stand up] | fldiXF5zDzXVOdBOy | Canonical Staff Link Migration |

## 06 — Reference Tables Pending Creation

**Tables that must exist before the On Hold work can proceed**

| Reference Table | Records (initial) | Drives selection on |
| :---- | :---- | :---- |
| Studios | NY (260 W 39th), LA (Melrose), Tribeca (Oct 2026), London (2027) | DF Clients.Studio · DF Appointments.Studio Address · Orders.Store · Sample Log.Location · staff.Location |
| Rooms | A, B, C (NY) · Butter, Pistachio (LA) · Spruce, Elm, Oak, Cedar (Tribeca) | DF Appointments.Room — each Room linked to a Studio |
| Appointment Types | Consultation, Resee, Fit Assessment + Pickup, 1st Fitting, 2nd-6th Fitting, Final Fitting | DF Appointments.Appointment Type — carries duration, default room type, deposit |
| Vendors (extended) | Existing Vendors table + new Vendor Type field | DF Clients.3PL · Orders.3PL (filtered by Vendor Type = 3PL) |
| Warehouses (TBD) | Pending Julia confirmation on whether 1:1 with Studio | DF Clients.Warehouse · Orders.Warehouse |

> ⚠ Sandbox-to-Production record-ID mismatch: linked-record filter configurations cannot be moved directly from the Sandbox (app10POKRBDLqbcNo) to Production (appUC2NFAlURayLx9). Build new reference tables in Production first and configure filters there. Plan to refresh the Sandbox from Production once Production cutover is complete.

## 07 — Outstanding Gaps Detected in Production

**Audit findings against the live schema**

A schema audit of the Production base (appUC2NFAlURayLx9) on the date of this document surfaced the following discrepancies between expected state and live state. Each is filed against the migration story that owns it.

| Finding | Field ID | Status | Owning Story |
| :---- | :---- | :---- | :---- |
| DF Styles.Orders - Shopify copy still present in Production despite "Done" status in the change log | fldjzJJDR7huFCVUU | Re-execute deletion | This story |
| staff.Sample Scans 4 still present — flagged for "Audit and remove" in canonical Staff Link Migration | fldDqZv1PJr52UnDW | Investigate dependencies, then delete | Canonical Staff Link Migration |
| Orders - Shopify.Created By still singleSelect — canonical migration calls for Staff link conversion | fldcSrT1UlEijuT3c | Convert to Staff link or createdBy collaborator | Canonical Staff Link Migration |
| DF Styles has six multipleRecordLinks fields not yet audited (DF Clients, DF Clients 2, DF Brides, DF Clients 3, Customizations 3, Customizations 4) | Multiple (DF Styles) | Audit dependencies, deprecate orphans | This story — follow-on |

**How these tie together:** The Canonical Staff Link Migration owns the Staff link itself plus every legacy singleSelect that resolves to a person. This story owns every other reference field on the base plus the cross-cutting deprecation of orphan singleLineText fields. Findings that fall into the Staff migration scope are flagged in this audit but resolved against that story.

## 08 — Naming Convention

**snake_case is canonical for pattern fields**

All fields that are part of this pattern — link fields, lookup fields, reciprocal links, and the reference tables themselves — use snake_case. This is consistent with the staff/role_catalog naming and replaces the mixed-case legacy convention. Legacy fields awaiting cutover retain their original capitalization to preserve automation references until they are formally retired.

| Element | Convention | Example |
| :---- | :---- | :---- |
| Reference table | snake_case, plural for multi-record entities | staff, role_catalog, Rooms (capitalize when source table name is a pre-existing proper noun) |
| Selection field (link) | snake_case, singular for one-of-one references | sales_associate, alterations_lead, room, studio |
| Lookup field | link_name + underscore + attribute, snake_case | sales_associate_email, sales_associate_role, room_studio |
| Reciprocal link | snake_case, plural representing the consuming role | clients, clients_split_sale, alterations_lead_appointments |
| Deprecation marker | append "[deprecate after stand up]" to legacy field name | Other Seller (Split Sale) [deprecate after stand up] |

## 09 — Operational Rules & Edge Cases

**Constraints the pattern must honor**

- Inactive entities: the reference table carries an is_active checkbox (modeled on staff.is_active and role_catalog.is_active). Selection fields filter to is_active = true in the picker; historicals remain intact because the link does not depend on the option list.
- Reuse of the same reference: when multiple consuming records point to the same linked record, Airtable resolves the lookup once. No script-level caching is required; the pattern is bulk-safe by construction.
- Incomplete or inconsistent reference data: handle gracefully by leaving the lookup empty rather than substituting placeholder values. Surface the failure in the Error Logs table (tbl1jQ3z1IA0HgIcn) with enough context (record ID, field, expected vs actual) to investigate, without exposing sensitive attributes beyond what is needed for debugging.
- Filtered selection: where a link must restrict by category (e.g. pattern_maker only selects staff whose role = Pattern Maker), the filter is configured at the field level and uses the role_catalog (for staff) or the Vendor Type field (for Vendors). Filter rules are documented inline in the field configuration.
- Bulk-safety and performance: the pattern is fully declarative — lookups are evaluated by Airtable, not by per-record scripts. Bulk operations therefore degrade linearly with record count, not quadratically.
- Sandbox-to-Production divergence: linked-record filter configurations cannot move directly from Sandbox to Production because of record-ID mismatch between bases. Build new reference tables in Production first; refresh the Sandbox from Production once cutover is complete.

Danielle Frankel Studio · Singular Agency · Select-Once Linked References — Pattern Reference · v1.0 · May 2026

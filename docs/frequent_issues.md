# Frequent Issues & Known Fixes

A registry of the **conceptual bug classes** we keep re-discovering across the DFS base — not a list of one-off tickets, but the underlying patterns that produce them, so a new interface/automation/field can be checked against the *pattern* before it ships, instead of waiting to independently rediscover the same mistake in a new file.

**Two purposes, in order:**

1. **Diagnostic sweep.** Walk through each class below against the live base (Sandbox first) — for a given class, grep for the pattern across every interface/automation, not just the one place it was last found.
2. **Pre-launch gate.** Before shipping anything new to Production, check it against every class here that applies to the data/fields it touches. Most bugs we've hit were never really about the specific field involved — they were this codebase's Nth encounter with a pattern that was already known.

Each class below is written as: **what it looks like** → **why it actually happens** → **the rule to follow**. Concrete instances (which file, which fix, when) are logged in the table at the bottom for traceability, but the class itself is the reusable part — read that first.

---

## 1. Airtable's actual returned shape doesn't match what the code assumes

The single most common root cause in this codebase. Airtable's block SDK often returns a value whose real runtime shape differs from what its field-type name implies, and code written against the assumed shape either silently mis-renders or silently returns empty — never a crash, which is why it survives in production for a while before anyone notices.

**Concrete sub-patterns:**

- **Lookup/rollup fields render as raw arrays instead of a parsed value.** A "single" lookup still comes back as an array under the hood (`getCellValue()` on a `multipleLookupValues` field is always an array, even when the source is a single-select or single linked record). Code that expects a scalar and just interpolates the value directly ends up showing something like `Ada,` or `[object Object]`, or — if it only ever tested against a record with exactly one value — appears to work until a record with zero or multiple values hits it. **Rule:** for any lookup/rollup, check the field's `config.type` in the schema before writing display logic; use `getCellValueAsString()` when you want Airtable's own array-join formatting, or explicitly `Array.isArray()` + `.map()`/`[0]` when you need to control the shape yourself. Never assume a lookup is a scalar just because the source field is.
- **Linked-record cell values are `{id, name}` objects (or arrays of them), not strings.** Directly rendering or comparing a linked-record cell value against a string silently fails or shows `[object Object]`.
- **`useRecords(table, {fields: [...]})` field restriction.** Calling `getCellValue()`/`getCellValueAsString()` on a field not included in that array returns `null`/empty *even if the field genuinely has data* — indistinguishable from a real sync gap unless you check the load list first. (Concrete instance: Appointments' Pick Up Orders table read as empty because `CLIENT_SHOPIFY_ORDERS` wasn't in the client `useRecords` field list.)
- **Percent-formula fields return a decimal fraction (0–1), not 0–100.** Any comparison against "100%" written as `=== 100` silently never matches; must compare against `1` with epsilon tolerance.
- **Date fields can return a native Date object, an ISO string, or (rarely) an invalid value depending on how the field was populated** — undocumented, and not consistent even across records in the same field. See class 4 below.

**Rule of thumb:** whenever a value is about to be displayed, compared, or passed to a formula-like check, ask "what does `get_table_schema` actually say this field's `type`/`config` is, and what does one real record's raw value actually look like?" before writing the parsing logic — never infer the shape from the field's display name or from a single record that happened to look clean.

---

## 2. Cardinality mismatch — modeling "many" as "one"

A field is designed at the client/bride level when the real-world relationship is actually one-to-many (a bride can have multiple orders, multiple appointments, multiple recaps). The field works fine in testing (most test brides have exactly one order) and then breaks — showing the wrong order's data, or only ever reflecting the first/most-recent one — the moment a real bride with more than one order/appointment hits it.

**Concrete instances:** Fulfillment Method, Client Notified, Tracking #, 3PL, and Pick Up/Ship completion were all originally bride-level fields; each broke for multi-order brides and was replaced with an inline per-order table. Recap being tied to the client rather than to a specific appointment had the same shape (a client with two consultations couldn't get a second, distinct recap).

**Rule of thumb:** before adding a new field, ask "can this client legitimately have more than one of the thing this field describes?" If yes, the field belongs on the child record (order/appointment/recap), not the parent (client) — model it as a table/rollup from day one rather than retrofitting later.

---

## 3. Stale reference — schema evolved, the reader didn't

A field, appointment-type value, or automation trigger condition gets superseded (renamed, replaced by a cleaner field, given a controlled vocabulary), but something written against the old one is never updated. Nothing errors — the read just silently returns empty or takes the wrong branch — so this can sit broken for weeks before anyone connects the symptom to the actual cause.

**Concrete instances:** an `isPickUpAppt` check read the appointment-type field that carries studio/duration prefixes (`APPT_TYPE` / `typeLabel`) instead of the clean singleSelect field every sibling check already used (`APPT_NAME` / `apptNameDetail`); multiple Pipeline-stage automations kept reading a deprecated appointment-type field after a newer one was introduced; a "next appointment" lookup for Alterations Lead returned empty for any client whose alterations appointments didn't currently match its filter, even though the data existed on a different lookup with no such filter.

**Rule of thumb:** whenever a field is deprecated or a new canonical version is introduced, grep the *entire* repo for the old field's ID/name before assuming nothing else still depends on it — "nothing broke visibly" is not evidence nothing depends on it, since this bug class fails silently by design.

---

## 4. Date/time semantic category confusion

Airtable date values fall into distinct semantic categories (date-only vs. date-with-time, a fixed-format formula string, free text, ambiguous human-entered text), and treating one as another produces three distinct symptom families: a genuine month/day order mismatch, a ±1-day shift from converting a date-only value through a timezone-aware JS `Date`, or a filter/sort that silently misbehaves because it's comparing a formatted string against a raw date value as if they were the same type.

Full rulebook, semantic model, and the 22 normative rules: [`docs/date_handling_rulebook.md`](date_handling_rulebook.md). Treat any new date display, filter, or sort as needing to be checked against that doc rather than re-derived ad hoc.

---

## 5. Shared derived state with no single writer

A value (most notably Pipeline "Stage") is computed independently by several automations or code paths that can each write to it, instead of being derived once from a single set of underlying facts. Any two of those writers disagreeing — or firing in an unexpected order — silently moves a record to the wrong state, and because there's no single place the value is "supposed" to come from, the bug is hard to even localize.

**Concrete instance:** Pipeline Stage was being written directly by 8 uncoordinated automations, which briefly moved a batch of clients backward. Fix pattern: stage is now computed from independent one-way milestone facts (Gown Ready, Alterations Required, Alterations Completed, etc.) rather than being overwritten directly by whichever automation runs last — this makes the bug class structurally impossible rather than just patched.

A related, lower-severity version of this: Airtable Interface Extensions run isolated per file, so shared constants like `STAGE_ORDER`/`STAGE_STEPS` are duplicated by hand across `pipeline.tsx`, `alterations.tsx`, etc. ([`docs/phase_logic_rulebook.md`](phase_logic_rulebook.md) is the source of truth). A change made in one file does not propagate — there's no shared import to catch the drift, so it must be applied by hand everywhere, every time.

**Rule of thumb:** if a value can be set by more than one automation or interface, ask whether it should instead be a formula/rollup derived from underlying facts that only one place ever writes to.

---

## 6. Native browser control styling assumptions

A styled control (most often a `<select>`) is assumed to fully own its own rendering, but the browser's native chrome (the `<option>` popup list, focus rings) inherits CSS properties or ignores others in ways that only show up in specific themes or browsers.

**Concrete instance:** a `<select>`'s `color`/`background` cascaded into its native `<option>` popup, tinting every option the same hue as the current selection and reading as unreadable in dark mode; a focus ring built with `outline` ignored the element's `border-radius` and drew a square ring over a pill-shaped control (`outline` doesn't respect radius in most browsers; `box-shadow` does).

**Rule of thumb:** when styling a native form control, explicitly style its sub-parts (`option`, focus state) rather than assuming the parent's styles apply — test the actual native popup in both themes, not just the closed control.

---

## 7. Automation failure that isn't a logic bug

An automation "fails," but the actual cause is an external dependency silently going stale (a disconnected Slack account, an expired auth token) rather than anything wrong with the automation's own logic or script. These are easy to misdiagnose as code bugs because the symptom (automation failing) looks identical either way.

**Concrete instance:** "New Customization Request Notification" failed because the Slack account connected to it had been disconnected on Slack's side — the script and its conditions were all working correctly.

**Rule of thumb:** check an automation's actual Run History and the specific step that failed *before* assuming the fix is in the script — a "Send to Slack" or similar external-integration step failing with an auth/connection-style error is a reconnect, not a rewrite.

---

## 8. Cross-platform record linkage / ID collision

A record from one platform (Apparel Magic, Shopify) gets matched to the wrong Airtable client or order because the matching key isn't as unique as assumed across platforms — e.g., an AM order number that happens to collide with an unrelated Shopify order number, especially once wholesale orders (synced from a separate channel) are in the mix.

**Concrete instances:** an Apparel Magic order was pulled onto the wrong client's ("Rachel Besser" vs. "Warron Barron," a wholesale account) because of an order-number collision; wholesale orders leaking into Airtable at all despite an existing Shopify-side tag skip, because the equivalent skip didn't exist on the Apparel Magic side.

**Rule of thumb:** when matching records across Cobalt's source platforms, don't assume an ID/number is globally unique — check whether wholesale, multi-store, or legacy-sync records could produce a collision, and prefer matching on more than one field when the stakes are a wrong client record.

---

## Concrete instances log

For traceability back to when/where each pattern actually showed up. New entries go here; the class section above is what should actually get consulted day-to-day.

| Instance | Class | Status |
|---|---|---|
| Sample Log auto-link failing (matched by computed primary field instead of linked record) | §1 (shape mismatch — treating a formula field as a matchable name) | ✅ Fixed, backfilled |
| Appointments Pick Up Orders table empty | §1 (`useRecords` field-restriction) + §3 (stale `isPickUpAppt` field reference) | 🟡 Fixed in code, not yet verified live |
| Fulfillment Method / Client Notified / Tracking # / 3PL / Pick Up-Ship | §2 (cardinality mismatch) | ✅ Fixed — per-order tables |
| Recap tied to client instead of appointment | §2 (cardinality mismatch) | 🟡 Open — tracked separately |
| Alterations Lead showing empty (Zoia Kozakov) | §3 (stale/filtered lookup) | ✅ Fixed — fallback lookup |
| Pipeline Stage briefly reverting clients backward | §5 (shared derived state) | ✅ Fixed — one-way milestone facts |
| Alterations/Fulfillment columns not reflecting recent appointments | §3 (stale appointment-type field) | ✅ Fixed |
| Sold "% Picked" inflated by alterations line items | §2/§1 boundary (a count meant to be per-gown was summed across all item types) | ✅ Fixed — alterations excluded |
| Dropdowns unreadable / square focus ring in dark mode | §6 (native control styling) | ✅ Fixed |
| Singular Progress dashboard math not matching the source sheet | §1 (comparison logic missing a second real-world condition — `Owner = "Singular"`, not just Dev) | ✅ Fixed |
| Date parsing / month-day swap / ±1-day shift across ~11 interfaces | §4 (date semantic confusion) | 🟡 In progress — 2 of 11 pages fully evaluated |
| Wrong customer linked to an order (Rachel Besser / Warron Barron) | §8 (cross-platform ID collision) | ✅ Fixed |
| Wholesale orders leaking into Airtable | §8 (cross-platform ID collision, missing AM-side skip) | 🟡 Fixed, QA tag still pending |
| "New Customization Request Notification" automation failing | §7 (external dependency, not logic) | ✅ Fixed — reconnected |
| RTW size false "not ready" alerts on Sample Tracker | §1 (reading the manual-entry field instead of the Acuity-fallback formula field) | ✅ Fixed |

---

## How to run the diagnostic sweep

1. Pick one conceptual class above. Grep the whole repo for its pattern (a field ID, a `useRecords` call, a `<select>`, a date parse) — don't stop at the first interface where it's found; the same class tends to recur in every file that does something similar.
2. For anything found, check whether it's already logged in the concrete-instances table. If not, diagnose and fix, then add a row.
3. Before shipping something new: identify which classes above actually apply to the fields/data it touches (lookups/rollups it reads? per-client-or-per-order modeling? a value another automation also writes? dates?) and check it against each one explicitly, rather than only testing the happy path.

# DFS Date Handling Rulebook
## Source of Truth v1.0

**Project:** Danielle Frankel Studio / DFS
**Version:** 1.0
**Date:** 2026-08-26
**Status:** **APPROVED FOR NORMATIVE USE AS SOURCE OF TRUTH**
**Scope owner:** DFS interfaces / Airtable date handling

---

# 1. Executive decision

This document is the proposed **Source of Truth for how dates must be handled in the DFS project**.

It is safe to use as the normative rulebook for:

- reading date values from Airtable,
- distinguishing calendar dates from timestamps,
- parsing date values,
- comparing and sorting dates,
- displaying dates,
- handling free-text date fallbacks,
- handling ambiguous human-entered numeric dates,
- preventing `MM/DD` vs `DD/MM` swaps,
- preventing accidental `+/- 1 day` shifts caused by timezone conversion.

## Important boundary

This document is **not** an assertion that every existing DFS page already complies with these rules.

It defines:

> **How date handling must work going forward and the standard against which existing code should be evaluated.**

Current implementation compliance, page-by-page inventories, and known defects should be maintained separately.

This distinction allows the rulebook itself to remain stable even when individual interfaces or Airtable fields change.

---

# 2. Why this rulebook exists

Two related issues exposed different layers of the same problem family.

## 2.1 Previous issue: Wedding Date consistency

**Issue:** `Wedding date inconsistent between summary and client pages`

The previous work audited Wedding Date usage across Daily Ops and Tracking interfaces and standardized which source/fallback should be displayed.

The relevant design decision was:

- when a structured/formatted Wedding Date exists, display it;
- otherwise preserve the existing free-text Wedding Date fallback;
- do not modify source client data merely to make interfaces consistent.

This solved a **field/source consistency** problem.

It did not fully standardize how all pages parse, compare, or format dates.

## 2.2 Current issue: month/day swap

**Issue:** `Date parsing bug - month/day values swapped across interfaces`

This exposed a second layer:

- some code paths can consume locale-formatted strings,
- some code paths manually parse a known `MM/DD/YYYY` contract,
- some paths use `new Date(...)` on date-only values,
- some compare incompatible string formats,
- team members work across countries and browser timezones.

The key architectural question is therefore no longer only:

> Which Airtable field should this page display?

It is also:

> What semantic type is this value, what runtime representation reached the code, and what operations are valid on that representation?

---

# 3. Scope decision

## 3.1 In scope

This rulebook governs:

- date-only business values,
- date formulas and lookups,
- date display strings,
- free-text date fallbacks,
- date parsing,
- date filtering,
- date sorting,
- date comparison,
- date editing and round trips,
- month/day ambiguity,
- timezone-driven calendar-day drift.

## 3.2 Out of scope for the current cleanup

A broad refactor of appointment-time architecture is **not required** as part of the date bug.

Existing appointment-time behavior should be preserved where it is already intentional.

Based on current project direction:

- appointment datetimes should remain raw/canonical first,
- the relevant studio timezone should be applied afterward,
- NY/LA-specific handling should remain governed by the appointment/studio,
- a developer's own browser timezone must not silently redefine DFS appointment time.

This rulebook includes datetime rules because they are necessary to prevent misuse, but it does **not** require rewriting otherwise-correct appointment-time code.

---

# 4. Evidence hierarchy

Date conclusions must not be made from code appearance alone.

Use the following evidence order.

## Tier 1: Current Airtable schema

Verify:

- field type,
- formula,
- formula `result.type`,
- lookup/rollup source type,
- timezone configuration where relevant.

This is required to know what the field actually represents.

## Tier 2: Current source code

Verify:

- `getCellValue()` vs `getCellValueAsString()`,
- lookup unwrapping,
- parser used,
- formatter used,
- filter/sort/comparison path,
- write path.

A field's schema type alone does not determine whether downstream code is safe.

## Tier 3: Runtime / Production verification

Use visual or runtime checks to confirm:

- the actual displayed date,
- browser-timezone behavior,
- stored round-trip result,
- filtering and sorting behavior.

## Tier 4: Historical lineage documentation

Historical lineage files are useful context but do not override current schema or current code.

The Wedding Date lineage workbook supplied for this review was built for the previous Wedding Date display issue and may be slightly stale. It should be treated as:

> **Historical lineage snapshot. Context only. Not the current authority for date runtime behavior.**

## Tier 5: Exploratory inventories / agent maps

Inventories generated from code scanning are useful for locating date logic.

They are **not** authoritative risk classifications until the schema and actual read path are verified.

---

# 5. The canonical mental model

Every date path must be evaluated through this chain:

```text
BUSINESS SEMANTICS
        ↓
AIRTABLE FIELD TYPE
        ↓
READ METHOD
        ↓
RUNTIME REPRESENTATION
        ↓
PARSER / TRANSFORMATION
        ↓
COMPARISON / BUSINESS LOGIC
        ↓
DISPLAY
```

The most important correction to earlier analysis is:

> **A field being a genuine Airtable Date does not automatically make every downstream use safe.**

Example:

```text
Airtable field: date
        ↓
getCellValue()
        ↓
"2026-07-29"                 canonical
```

is different from:

```text
Airtable field: date
        ↓
getCellValueAsString()
        ↓
"7/29/2026"                  display string
        ↓
generic parser
```

Once a canonical date has been converted into a display string, downstream safety must be evaluated as a **string contract**, regardless of the original Airtable field type.

---

# 6. Canonical data classes

The project should use the following five semantic classes.

---

## Class A: Date-only business value

A calendar date whose meaning does not include a time of day.

Examples:

- Wedding Date
- Due Date
- Hold Until / Do Not Ship Until
- Waitlist Wedding Date
- other business deadlines represented as a day

Canonical representation:

```text
YYYY-MM-DD
```

Example:

```text
2026-07-29
```

### Core invariant

> **July 29 must remain July 29 regardless of the viewer's browser timezone.**

A date-only value is not an instant on the global timeline.

---

## Class B: Datetime / instant

A value where the time and timezone relationship are meaningful.

Examples:

- Appointment Time
- Appointment End Time
- Created At
- Changed At
- Generated At
- audit timestamps

Canonical representation:

```text
ISO 8601 datetime
```

Example:

```text
2026-07-29T18:30:00.000Z
```

### Core invariant

> The stored instant remains the same; display is converted into the intended business/studio timezone.

For appointments, existing NY/LA studio behavior should be preserved.

---

## Class C: Fixed-format text produced by a verified formula

A formula whose schema result is text and whose formula explicitly defines the output format.

Example:

```text
DATETIME_FORMAT(wedding_date, 'MM/DD/YYYY')
```

Output:

```text
07/29/2026
```

This is not a Date value. It is a text contract.

### Core invariant

> A strict parser matching the verified formula contract is valid. A generic parser or incompatible string comparison is not.

---

## Class D: Free-text date-like value

Text that may contain a date, season, placeholder, or approximate date.

Examples:

```text
Fall 2027
Spring 2028
TBD
Early June
```

### Core invariant

> Free text must never be silently coerced into a date.

It may be displayed or preserved as fallback text.

---

## Class E: Human-entered numeric date string

A user-entered value such as:

```text
4/5/2027
```

when the program has not yet converted it into canonical form.

### Core invariant

> Ambiguity must be governed by an explicit product convention, not described as technical inference.

DFS is a US-based system, so when free numeric date entry is intentionally supported:

```text
4/5/2027
```

may be defined by product contract as:

```text
April 5, 2027
```

This is a **US month-first convention**, not an objectively deduced answer.

Where possible, use DatePickers or structured input instead of accepting ambiguous text.

---

# 7. Airtable read rules

## R-01: Prefer `getCellValue()` for date logic

For genuine Date/DateTime fields, use the raw Airtable value when the value will be:

- parsed,
- sorted,
- filtered,
- compared,
- converted,
- written back,
- used in business logic.

Preferred:

```ts
record.getCellValue(field)
```

Avoid for logic:

```ts
record.getCellValueAsString(field)
```

when the returned string will later be interpreted as a date.

---

## R-02: `getCellValueAsString()` is a display boundary

`getCellValueAsString()` is allowed when the returned value is intentionally treated as terminal human-readable output.

Safe concept:

```text
getCellValueAsString()
→ display
```

Unsafe concept:

```text
getCellValueAsString()
→ new Date(...)
→ filter / sort / transform
```

or:

```text
getCellValueAsString()
→ parseDateFlexible(...)
→ write back
```

unless the display string's exact contract is independently known and intentionally supported.

---

## R-03: Verify lookup and rollup terminal types

A lookup is not automatically text and not automatically a Date.

Before implementing date logic, verify:

- the lookup source field type,
- the lookup's runtime shape,
- whether it returns arrays,
- whether the resulting value is Date/DateTime or text,
- how the current SDK exposes it.

The **terminal runtime representation** governs downstream handling.

---

# 8. Date-only rules

## R-04: Keep date-only values canonical

For logic, prefer:

```text
YYYY-MM-DD
```

Do not convert a date-only value to a human-readable string and then reparse it.

---

## R-05: Do not treat `YYYY-MM-DD` as a business instant

This pattern is dangerous for date-only display:

```ts
new Date("2026-07-29")
```

followed by local-time formatting/getters.

A JavaScript `Date` represents an instant. A date-only business value does not.

The resulting conversion can produce the previous calendar day in timezones behind UTC.

This is a **timezone shift bug**, not a month/day swap.

---

## R-06: Format date-only values deterministically

A valid implementation must preserve the calendar day independent of browser timezone.

Recommended helper shape:

```ts
function formatDateOnly(
  iso: string,
  locale = 'en-US'
): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;

  const [, year, month, day] = match;

  const value = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day)
    )
  );

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}
```

Equivalent implementations are valid if they preserve the same invariant.

A helper may also explicitly extract Y/M/D and construct local components if that is simpler in the existing codebase.

### Required behavior

```text
2026-07-29
```

must display as July 29 in:

- Mexico,
- New York,
- Los Angeles,
- London,
- any other browser timezone.

---

## R-07: Date-only sorting can use canonical ISO strings

For consistently normalized date-only values:

```ts
a.localeCompare(b)
```

is chronologically valid because `YYYY-MM-DD` sorts lexicographically.

Likewise:

```ts
a < b
```

is semantically valid only when both sides are known canonical ISO date-only strings.

---

## R-08: Never compare different date string formats directly

Invalid:

```ts
"07/29/2026" < "2026-08-26"
```

This is a text comparison, not a date comparison.

Before comparing, values must share a compatible canonical representation.

---

# 9. Datetime rules

## R-09: True ISO datetimes may be parsed with `new Date(...)`

For a true ISO datetime:

```text
2026-07-29T18:30:00.000Z
```

this is valid:

```ts
new Date(isoString)
```

This is not inherently a month/day swap risk.

---

## R-10: Datetime display must use the intended business timezone

Do not allow the developer's or user's browser timezone to silently determine appointment time when the business requires a specific studio timezone.

The intended pattern is:

```text
raw ISO datetime
        ↓
Date / instant
        ↓
studio timezone
        ↓
display
```

For DFS appointments, preserve the existing NY/LA-specific logic unless a confirmed defect requires adjustment.

Prefer IANA timezone identifiers such as:

```text
America/New_York
America/Los_Angeles
```

rather than fixed numeric UTC offsets.

---

## R-11: Date and datetime must not share one blind parser

A generic helper that accepts all of these:

```text
2026-07-29
2026-07-29T18:30:00Z
07/29/2026
29/07/2026
Fall 2027
```

and attempts to "figure it out" is not an acceptable project standard.

The semantic class must be known first.

---

# 10. Formula-text rules

## R-12: A strict parser may follow a verified formula contract

If Airtable explicitly guarantees:

```text
DATETIME_FORMAT(date, 'MM/DD/YYYY')
```

then code such as:

```ts
const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
const [, mm, dd, yyyy] = match;
```

is valid.

This is not guessing.

It is consuming a documented format contract.

---

## R-13: Formula parsers are coupled to the formula contract

If the Airtable formula changes from:

```text
MM/DD/YYYY
```

to:

```text
DD/MM/YYYY
```

the parser must change with it.

This coupling must be treated as a dependency.

Therefore:

- verify the actual formula before judging a parser,
- do not label every `MM/DD/YYYY` regex as a bug,
- do not change a parser without checking its source field contract.

---

## R-14: Mixed formula text must preserve fallback text

A field such as `wedding_date_display` may return:

```text
07/29/2026
```

or, through fallback:

```text
Fall 2027
```

A safe consumer must:

1. strictly recognize the contractual formatted-date branch,
2. parse only that branch,
3. return other values unchanged.

Do not force fallback text into `new Date(...)`.

---

## R-15: Final Airtable result type matters, but it is not the whole chain

A formula may contain a text-producing intermediate expression and still expose a final field whose `result.type` is Date/DateTime.

For downstream SDK consumption:

> If the terminal Airtable field is a genuine Date/DateTime and is read raw, handle it as canonical Date/DateTime.

However, this does **not** prove that every internal formula operation is intrinsically correct.

The formula itself still needs a valid, explicit contract.

---

# 11. Free-text rules

## R-16: Never fabricate a date from free text

Invalid:

```ts
new Date("Fall 2027")
```

or any generic fallback that turns non-date text into a plausible but invented calendar date.

If a free-text field exists to represent values such as:

```text
Fall 2027
Spring 2028
TBD
```

display it as text.

---

## R-17: Free-text fallbacks are presentation data unless explicitly normalized

`wedding_date_if_not_set` is a free-text fallback.

It must not become a canonical value merely because another display formula exposes it.

---

# 12. Human-input rules

## R-18: Prefer structured entry

Preferred:

```text
DatePicker
→ canonical YYYY-MM-DD
```

over:

```text
free text
→ heuristic parser
```

---

## R-19: If ambiguous numeric input is supported, the convention must be explicit

When both first and second components are <= 12:

```text
4/5/2027
```

there is no technical way to infer the user's intended order.

If DFS accepts this syntax, the rule is:

> **Ambiguous numeric date input is interpreted using US month-first order.**

This should be documented as a product convention.

---

## R-20: Heuristics must not be described as proof

A parser may correctly infer:

```text
17/4/2027
```

as day-first because 17 cannot be a month.

But:

```text
4/5/2027
```

is still ambiguous.

The fallback to month-first is a convention.

---

# 13. Display rules

## R-21: Prefer unambiguous visible date formats where scope permits

Recommended:

```text
Jul 29, 2026
```

instead of:

```text
07/29/2026
```

A textual month makes the UI easier for an international team to read.

This is a presentation recommendation, not a substitute for correct parsing.

If changing UI format would expand scope, retain the existing format and fix only the underlying handling.

---

## R-22: Display formatting must be terminal

Preferred:

```text
canonical value
→ business logic
→ display formatter
→ UI
```

Avoid:

```text
canonical value
→ display formatter
→ parser
→ business logic
```

---

# 14. Known DFS examples and decisions

## 14.1 `DF Clients.wedding_date`

Verified in the supplied current analysis as a genuine Airtable `date`.

Rule:

- read raw for logic,
- keep canonical ISO date-only semantics,
- do not let browser timezone shift the day.

---

## 14.2 `DF Clients.wedding_date_display`

Verified in the supplied current analysis as a text-producing formula with contract:

```text
IF(
  wedding_date,
  DATETIME_FORMAT(wedding_date, 'MM/DD/YYYY'),
  wedding_date_if_not_set
)
```

Therefore it is a **mixed display field**:

```text
strict MM/DD/YYYY
OR
free-text fallback
```

Rule:

- strict MM/DD parser is valid for the date branch,
- non-matching text must remain text,
- do not use the mixed field as canonical date logic unless explicitly normalized first.

---

## 14.3 Wedding Date parsers in Fulfillment, Alterations, Sold Orders

The previous exploration flagged the strict `MM/DD/YYYY` parser itself as suspicious.

The schema-aware review found that, for their `wedding_date_display` path, the parser matches the formula's verified `MM/DD/YYYY` contract.

Decision:

> **These Wedding Date parser paths are not month/day-swap bugs merely because they assume MM/DD.**

Do not generalize this conclusion to every date function in those files.

For example, a different `formatDate()` in the same file may still mishandle a genuine date-only ISO value through timezone conversion.

The correct unit of evaluation is the **specific field path**, not the entire file.

---

## 14.4 Waitlist `wedding_date`

The field itself is a genuine Airtable `date`.

However, current Pipeline code includes a read path using a string helper for Waitlist fields before `weddingDate` enters downstream logic.

Decision:

> A genuine Date field can re-enter risk territory if code converts it to a display string before logic.

This is one reason the rulebook is based on:

```text
field type + read method + runtime representation
```

rather than field type alone.

---

## 14.5 Pipeline `wedding_date`

The current Pipeline code contains an explicit fix replacing display-string reads with raw date reads for the main client Wedding Date path.

The code comment documents the exact failure class:

- local display string,
- ambiguous day/month,
- reparsing into the wrong date.

Decision:

> This raw-value pattern is the preferred model for canonical date logic.

---

## 14.6 Customization Requests known bug

Current code contains a production filter shaped like:

```ts
const todayStr = new Date().toISOString().slice(0, 10);
const weddingStr = resolveDateString(
  record.getCellValue(fields.weddingDate)
);

if (weddingStr && weddingStr < todayStr) return false;
```

The current schema-aware analysis identifies the source as a lookup of the textual Wedding Date display field.

That can produce:

```text
07/29/2026
```

while `todayStr` is:

```text
2026-08-26
```

The comparison is therefore between incompatible representations.

Decision:

> This is a confirmed example of violating R-08.

It is documented here as a known issue even if its implementation fix is out of the current task scope. **Tracked separately in the Feedback Tracker (Bug Report, Customization Requests) — see that record for prioritization status; do not treat inclusion in this rulebook as a scheduling commitment.**

---

# 15. Patterns explicitly prohibited

## Anti-pattern A: Date display string used as canonical data

```ts
const date = record.getCellValueAsString(field);
const parsed = new Date(date);
```

Do not use this for business date logic unless the exact string contract is verified and intentionally supported.

---

## Anti-pattern B: date-only ISO converted through local timezone

```ts
const date = new Date("2026-07-29");
return date.toLocaleDateString();
```

This may display the previous day depending on timezone.

---

## Anti-pattern C: blind generic parsing

```ts
new Date("03/04/2026")
```

when no explicit source contract defines the order.

---

## Anti-pattern D: incompatible string comparison

```ts
"07/29/2026" < "2026-08-26"
```

---

## Anti-pattern E: free text coercion

```ts
new Date("Fall 2027")
```

---

## Anti-pattern F: file-level safety declarations

Do not say:

> "Fulfillment is safe."

Say:

> "Fulfillment's Wedding Date display path using `wedding_date_display` and the verified MM/DD parser is safe for month/day ordering."

Risk is evaluated per path.

---

# 16. Preferred implementation strategy for the current bug

Because the issue should not absorb disproportionate effort, the preferred strategy is:

## Recommended: small shared date-only standard + surgical adoption

1. Preserve correct appointment datetime handling.
2. Fix confirmed date-only violations.
3. Use raw Airtable values for canonical Date logic.
4. Reuse or add one deterministic date-only helper where practical.
5. Preserve strict formula parsers where they match verified formula contracts.
6. Preserve free-text fallbacks.
7. Do not refactor unrelated date/time utilities just for architectural purity.
8. Document any confirmed out-of-scope defects separately.

### Not recommended for this issue

A full project-wide rewrite of:

- every formatter,
- every timestamp,
- every appointment timezone function,
- every date utility,
- every historical dead-code path.

The rulebook defines the long-term standard without requiring all technical debt to be removed in this story.

---

# 17. Code review decision tree

For every date-related code path, answer these questions in order.

## Step 1: What does the value mean?

- calendar date?
- instant/datetime?
- fixed-format display text?
- free text?
- human input?

## Step 2: What is the Airtable schema type?

- `date`
- `dateTime`
- `formula`
- `createdTime`
- `lastModifiedTime`
- lookup
- rollup
- text

## Step 3: What method reads it?

- `getCellValue()`
- `getCellValueAsString()`
- lookup unwrap helper
- local component state
- user input

## Step 4: What is the runtime shape?

Examples:

```text
2026-07-29
2026-07-29T18:30:00.000Z
07/29/2026
Fall 2027
[array lookup value]
```

## Step 5: Does the parser match that exact contract?

If no, stop.

## Step 6: Is it date-only or datetime?

Apply the appropriate rule set.

## Step 7: Are comparisons using compatible representations?

If no, normalize before comparison.

## Step 8: Does display happen only at the end?

If no, inspect for a display-string reparse boundary.

---

# 18. QA standard

A date fix should not be considered complete based only on visual inspection of one record.

## 18.1 Ambiguous month/day fixtures

Test at least:

```text
2026-03-04
2026-04-03
2026-06-07
2026-07-06
```

These reveal incorrect `MM/DD` vs `DD/MM` interpretation.

## 18.2 Non-ambiguous controls

Test:

```text
2026-03-17
2026-11-29
```

These help distinguish format ambiguity from general parser failure.

## 18.3 Browser timezone check for date-only fields

For a record such as:

```text
Wedding Date = 2026-07-29
```

verify the same calendar date under at least:

- Mexico timezone,
- New York timezone,
- Los Angeles timezone.

Expected result:

```text
Jul 29, 2026
```

everywhere.

## 18.4 Read/edit/write/read round trip

For editable Date fields:

1. load an existing date,
2. verify displayed value,
3. select a new date,
4. save,
5. inspect stored value,
6. reload,
7. verify the same calendar day returns.

## 18.5 Test logic separately from display

For every affected date path verify separately:

- display,
- exact-date filter,
- upcoming/past filter,
- sort order,
- eligibility/banner logic,
- write-back.

A correct display does not prove the underlying filter is correct.

---

# 19. Definition of Done for date fixes

A fix is compliant when all applicable conditions are true:

- [ ] Date-only values retain the same calendar day across browser timezones.
- [ ] Month/day values are not silently reversed.
- [ ] Date logic uses raw canonical Date values where available.
- [ ] `getCellValueAsString()` is not reparsed without a verified contract.
- [ ] Fixed-format formula text is parsed only according to its verified formula contract.
- [ ] Free-text fallbacks remain free text.
- [ ] Incompatible string formats are not compared directly.
- [ ] Date-only and datetime logic are not conflated.
- [ ] Existing NY/LA appointment-time behavior remains intact unless a separate defect requires change.
- [ ] Editable dates round-trip without mutation.
- [ ] QA includes an ambiguous month/day case.
- [ ] QA includes a timezone-change case for date-only values.
- [ ] Any confirmed but out-of-scope defect is documented separately.

---

# 20. Governance

## 20.1 What this document controls

This is the Source of Truth for:

- date-handling rules,
- parser expectations,
- representation boundaries,
- comparison rules,
- date-only vs datetime semantics,
- accepted date-input behavior.

If code contradicts this rulebook, the code should be treated as non-compliant unless the rulebook is explicitly revised.

## 20.2 What this document does not control

This document is not the authoritative inventory for:

- every date field currently in Airtable,
- every line number in every interface,
- every current bug,
- every current page's compliance status.

Those are implementation-state artifacts and can become stale quickly. **The Appendix below is the closest thing to that inventory as of 2026-08-26 — treat it the same way: a snapshot, not a live source.**

## 20.3 How to change the rulebook

A rule should change only when at least one of these changes:

- the business semantics change,
- Airtable SDK/runtime behavior changes,
- DFS intentionally changes its locale/date-entry contract,
- the appointment timezone model changes,
- a verified schema behavior invalidates an existing rule.

A single page using a different implementation is **not** sufficient evidence to change the rulebook. It may simply be non-compliant.

---

# 21. Evidence notes for v1.0

This consolidation was based on the supplied project evidence:

1. Schema-aware date casuistics analysis dated 2026-08-26, which reports direct Airtable schema verification and source-code review.
2. Current code snapshot ZIP containing:
   - `alterations.tsx`
   - `appointments.tsx`
   - `customization_requests.tsx`
   - `draft_orders.tsx`
   - `fulfillment.tsx`
   - `pipeline.tsx`
   - `recap.tsx`
   - `sold_orders.tsx`
3. Earlier Date Field Inventory used as a locator/coverage map, not as final risk truth.
4. Historical Wedding Date lineage workbook created for the prior display-consistency issue.
5. Current product direction that appointment hours should preserve raw data and apply the appropriate NY/LA timezone rather than the developer's local timezone.

## Reproducibility limitation

The attached current code snapshot does not contain every page referenced by the schema-aware analysis, and the raw Airtable schema export is not bundled as a standalone attachment.

**This gap is addressed by the Appendix below**, which embeds the actual field IDs, schema types, and formula text verified directly against the live base (`get_table_schema`, 2026-08-26) — so this document is self-auditable without depending on an external working file surviving in someone's Downloads folder.

---

# 22. Final project position

The DFS project should use this model:

```text
DATE-ONLY
raw canonical YYYY-MM-DD
        ↓
no business timezone conversion
        ↓
deterministic formatting
        ↓
display
```

```text
DATETIME
raw ISO instant
        ↓
intended studio/business timezone
        ↓
display
```

```text
FORMATTED TEXT
verified formula contract
        ↓
strict matching parser if needed
        ↓
otherwise preserve text
```

```text
FREE TEXT
preserve as text
```

```text
HUMAN NUMERIC INPUT
structured input preferred
        ↓
if ambiguous text is allowed:
explicit DFS US month-first convention
        ↓
canonicalize immediately
```

And across all categories:

> **Never let a human display format become canonical data by accident.**

> **Never allow browser timezone to change the calendar meaning of a date-only business value.**

> **Never infer safety from Airtable field type alone. Verify the read method and runtime representation.**

These are the governing rules for date handling in DFS.

---

# Appendix: Verified field evidence (2026-08-26)

Every entry below was confirmed directly against the live Airtable schema (`get_table_schema`, base `appUC2NFAlURayLx9`) and against the actual `.tsx` source of the interface listed — not inferred from an inventory alone. Field IDs are the permanent identifier; use them (not field names) to re-verify if this appendix goes stale.

## Class A — Date-only, genuine `date` type

| Field | Table:Field ID | Confirmed via |
|---|---|---|
| `DF Clients.wedding_date` | `fldbgknumKGS5W5WU` | schema: `type: "date"`, display `M/D/YYYY` |
| `DF Clients.hold_shipment_date` | `fldVsDeVp6R6ytqlb` | schema: `type: "date"`, display "friendly" |
| `Calligraphy Cards → DF Clients.due_date` | `fldnhs2n4z2EdZK9N` | schema: `formula` → `DATEADD({flddDJKkZDsOoCOzE},0,'days')`, **result type `date`** — the text intermediate is resolved internally by Airtable |
| `order_items.due_date` | `fld2Rp7eQXoPnOZNo` | schema: `type: "date"` |
| `Waitlist.wedding_date` | `fldUS6OAwOhngc71o` | schema: `type: "date"`, display `M/D/YYYY` |
| `Waitlist.earliest_date_requested` | `fld5s87GbT2G3C60e` | schema: `formula` → `IF(dates_requested, DATETIME_PARSE(dates_requested, 'MM/DD/YYYY'))`, result type `date` — `DATETIME_PARSE` with an explicit format is not ambiguous |
| `Draft Orders.due_date` | `fldEIrZxfSsTz3FmA` | schema: `formula` → `DATEADD({wedding_date lookup, text}, -3, 'months')`, result type `dateTime`, zone `utc` |

## Class B — Datetime/instant, genuine `dateTime` type (or lookup/formula of one)

| Field | Table:Field ID | Confirmed via |
|---|---|---|
| `DF Appointments - Acuity.appointment_time` | `fldL7kYvgkmyhGniX` | schema: `dateTime`, zone `America/New_York` |
| `DF Appointments - Acuity.appointment_end_time` | `fldFwFIBNtC76v0Y7` | schema: `formula` → `DATEADD(appointment_time, duration/60, 'minutes')`, result `dateTime`, zone NY |
| `DF Clients.next_appointment` (lookup) | `fldTe2cyBmicx9Ple` | schema: `multipleLookupValues` → `dateTime`, zone `client` |
| `DF Clients.last_appointment` (lookup) | `fldd01OccObkG9sGe` | schema: `multipleLookupValues` → `dateTime`, zone `client` |
| `DF Clients.latest_alterations_appointment` (lookup) | `fldoF7SPEjWNi5JQF` | schema: `multipleLookupValues` → `dateTime`, zone `America/New_York` |
| `DF Clients.next_alterations_appointment` (lookup) | `fldGiXSJ9p6dGFhLY` | schema: `multipleLookupValues` → `dateTime`, zone NY |
| `DF Clients.first_alterations_appointment` (lookup) | `fldRS6ctrPGlEPqlR` | schema: `multipleLookupValues` → `dateTime`, zone NY, "friendly" format |
| `DF Clients.consultation_appointment_time` (lookup) | `fldLQRhGqANVci6BM` | schema: `multipleLookupValues` → `dateTime`, zone NY |
| `Draft Orders.created_time` | `fldDN6BShO586Ac6V` | schema: `createdTime` native → `dateTime` |
| `Customizations.created_at` | `fldMAmHSS7Ose9zf0` | schema: `createdTime` native → `dateTime` |
| `Customizations.last_modified_at` | `fldCXmJotsUT9iexB` | schema: `lastModifiedTime` native → `dateTime` |
| `Customizations.date_of_request` | `fldQdHAp256vsImBt` | schema: `type: "date"`, display "local" |
| `DF Proposals.generated_at` | `fldHoui3whPBjKs5x` | schema: `createdTime` native → `dateTime` |
| `Sample Condition History.logged_at` | `fldzrWV01dC1upKmu` | schema: `createdTime` native → `dateTime` |
| `Orders_Shopify.order_date` | `fldP8MRiCZYBhjBpG` | schema: `dateTime`, zone `client` |
| `order_sync_changelog.changed_at` | `fldI2iA0qIJLsvmoY` | schema: `dateTime`, ISO display, zone `America/Mexico_City` |

## Class C — Fixed-format formula text (verified formula included)

| Field | Table:Field ID | Verified formula | Fallback |
|---|---|---|---|
| `DF Clients.wedding_date_display` | `fldfDHXcCEbFHEX4a` | `IF({wedding_date}, DATETIME_FORMAT({wedding_date}, 'MM/DD/YYYY'), {wedding_date_if_not_set})` | free text |
| `DF Clients."Due Date"` (`DETAIL_DUE_DATE`/`CLIENT_DUE_DATE`) | `flddDJKkZDsOoCOzE` | `IF({manual_rush_due_date}, DATETIME_FORMAT({manual_rush_due_date},'MM/DD/YYYY'), IF({wedding_date}, DATETIME_FORMAT(DATEADD({wedding_date},-3,'months'),'MM/DD/YYYY'), "Wedding date missing"))` | literal text `"Wedding date missing"` |
| `Customizations.due_date` (declared, **unused** in code) | `fldT2Kndwz0ZAMr4Y` | `IF(OR({wedding_date}=BLANK(), ISERROR(...)), "WEDDING DATE MISSING", DATETIME_FORMAT(DATEADD({wedding_date},-3,'months'),'M/DD/YYYY'))` | literal text `"WEDDING DATE MISSING"` |
| `Customizations.wedding_date` (lookup of `wedding_date_display`) | `fldO0Lalw1SkwAf4D` | inherits `wedding_date_display`'s formula | inherits its fallback |
| `Orders_Shopify.wedding_date` (lookup of `wedding_date_display`) | `fldt3rLJYYmIKThgj` | inherits `wedding_date_display`'s formula | inherits its fallback |

**Parsers confirmed to correctly match this Class C contract (mm-then-dd, per R-12):** `fulfillment.tsx`'s `formatWeddingDateDisplay()`, `alterations.tsx`'s `formatDate()`, `sold_orders.tsx`'s `formatDate()`. None of these three are month/day-swap bugs — see §14.3.

**Parser confirmed to VIOLATE R-08 against this same contract:** `customization_requests.tsx`'s production wedding-date exclusion filter (§14.6) — compares the Class C text string directly against an ISO string with `<`.

## Class D — Free text, genuine `singleLineText`

| Field | Table:Field ID |
|---|---|
| `DF Clients.wedding_date_if_not_set` | `fldqwfmMczvLhiqk1` |
| `Waitlist.dates_requested` | `fldDjo0WRAKvHdgR4` |

## Class E — Human-entered ambiguous input

Only one live example found: `Waitlist.wedding_date` (`fldUS6OAwOhngc71o`, a genuine Class A field once saved) is editable via `EditableDate`/`FormDateField` in `pipeline.tsx`, whose write path runs through `parseDateFlexible()` — the file's own disambiguation heuristic (day >12 on either side wins; else month-first, per an explicit 2026-08-21 fix comment). This is the only place in the audited code where R-19/R-20's "explicit convention" actually gets exercised against real ambiguous keystrokes.

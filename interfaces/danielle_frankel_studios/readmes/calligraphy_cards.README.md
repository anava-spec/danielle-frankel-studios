# Calligraphy Cards

Group: Tracking · File: `calligraphy_cards.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give the internal team a single list of every client's calligraphy card status, alongside due date, wedding date, and order info, so they can prioritize who's next. Internal-only, not client-facing.

## Inputs

- DF Clients table (`tblLLUlDgJ4ktzF7c`) — read directly, no separate Calligraphy Cards table exists.
- Fields used: `Full Name`, `Due Date` (formula), `Items Sold` (lookup), `gown_name` (lookup), `Wedding Date (Formatted)`, `calligraphy_card_sent` — a **singleSelect** with choices `Pending`/`Sent` (not a checkbox, despite the field's internal name).
- Generated via Omni from an Omni prompt spec, then rebuilt in-house for branding compliance and fixed once discovered to be the wrong field type (see Rules below).

## Outputs

- A list page in the Tracking section showing every client with a Status pill, Client, Due Date, Items Sold, Gown, and Wedding Date.
- Writes back only `calligraphy_card_sent`, toggling it between `Pending`/`Sent` — every other column is read-only display.

## Workflow

1. **Qualification floor (always-on, not a filter toggle):** a client only ever appears on this list if `Items Sold` contains at least one of `gown`, `custom`, `top`, `skirt`, `pants`, `dress` (case-insensitive substring match, same parsing pattern as `renderPills`). Clients whose `Items Sold` is shoes/veil-only, or empty, never qualify — this is a hard floor applied inside `filteredRecords`, before any of the interactive filters below run. Approved deviation from the original AC: "direct-to-consumer" isn't a separate flag on `DF Clients` yet, so for now this Items Sold floor is the only DTC-qualification signal.
2. Filter bar order: Search (long, always-expanded) → Due Date → Wedding Date → Calligraphy Status.
3. Search is a non-narrowing typeahead: typing never filters the visible list — it shows a dropdown of matching client names, and selecting one narrows the list to that single client.
4. Wedding Date filter: "Upcoming Wedding Dates" vs. "Past Wedding Dates" — clearable (X), no filter applied when cleared (shows every wedding date, including blanks).
5. Calligraphy Status filter: "Pending" (default) vs. "Sent" — also clearable.
6. Due Date filter is an exact-date match, compared as local `YYYY-MM-DD` strings (never UTC ISO).
7. All active filters compose with AND logic, on top of the qualification floor; sort is Wedding Date ascending (blanks last), then Client name A→Z.
8. Clicking the Status pill in a row toggles `calligraphy_card_sent` between `Pending`/`Sent` directly via `updateRecordAsync`; failures show a red border on that row's pill rather than silently reverting.

## Rules

- Dark mode uses the canonical pattern (`fulfillment.tsx`'s approach): plain Tailwind `dark:` utility classes driven by `useColorScheme()` toggling a `dark` class on `document.documentElement` — reads Airtable's own theme setting, not the OS/device theme. No bespoke token object.
- `calligraphy_card_sent` was originally built (and documented) as a checkbox — it's actually a **singleSelect** with real Airtable choices (`Pending`, `Sent`), confirmed via `get_table_schema`. The Status column renders a real `StatusPill` using the field's own choice colors (`getFieldChoiceColorMap`, per BRANDING.md §9 — never hardcode a status→color map when the value comes from an Airtable single-select), not a checkbox.
- Wedding Date and Calligraphy Status are `SingleSelectDropdown`s — one option or cleared, label acts as its own placeholder when empty (BRANDING.md §5). Clearing either removes that filter's effect entirely; there's no third "All" option baked into the choice list itself.
- Date picker reuses `fulfillment.tsx`'s exact `CalendarPopup`/`DatePicker` components (272px panel, Monday-start week, Clear/Today footer) rather than a native `<input type="date">`.
- Items Sold and Gown are plain lookup text values (not single-select-colored fields), so their pills use a neutral gray.
- Never include `import './style.css';` in this file.
- Omni's first-draft generated code used numerous non-existent Tailwind class names (e.g. `gray-gray100`, `blue-blueLight2`) that rendered with no working colors at all — every color class was rewritten against real Tailwind utilities and `fulfillment.tsx`'s hex-based `dark:` conventions before this file was committed.
- **Open item — Dress Creation Year column, not yet built:** approved to add a "Dress Year" column between Gown and Wedding Date, sourced from a new `Dress Creation Year` field on `DF Clients`. Recommended field type: `Number`, precision 0 (a whole year needs no decimals and should sort/filter numerically, not as free text). The field must be created via API in the **sandbox** base (`app6Q4xMZ1ngJxiV8` — API field creation is blocked in production, `appUC2NFAlURayLx9`); creating it and publishing it to production is still pending, blocked this session by an environment-level compliance restriction on the Airtable MCP tools (not an Airtable-side limitation). Once the field exists and its real field ID is confirmed via `get_table_schema` (never assume/invent it), add `CLIENT_DRESS_CREATION_YEAR` to `FIELD_IDS` and the column to the table, same display pattern as the other columns (value or `—` if blank).

# Calligraphy Cards

Group: Tracking · File: `calligraphy_cards.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give the internal team a single list of every client's calligraphy card status — whether their card has been sent — alongside due date, wedding date, and order info, so they can prioritize who's next. Internal-only, not client-facing.

## Inputs

- DF Clients table (`tblLLUlDgJ4ktzF7c`) — read directly, no separate Calligraphy Cards table exists.
- Fields used: `Full Name` (`fldB3Wyam01D3wR5Q`), `Due Date` (`fldnhs2n4z2EdZK9N`, formula), `Items Sold` (`fldEStULoGtNIjxPO`, lookup), `gown_name` (`fldJvr5mNgwmhfBlv`, lookup), `Wedding Date (Formatted)` (`fldbgknumKGS5W5WU`), `calligraphy_card_sent` (`fldsBLLXkKPgqlN2e`, checkbox).
- Generated via Omni from an Omni prompt spec, then rebuilt in-house for branding compliance (see Rules below).

## Outputs

- A list page in the Tracking section (alongside Sample Tracker, Did Not Convert, Change Log) showing every client with a leading checkbox, Client, Due Date, Items Sold, Gown, and Wedding Date.
- Writes back only `calligraphy_card_sent` — every other column is read-only display.

## Workflow

1. Filter bar order: Search (long, always-expanded) → Due Date → Wedding Date → Calligraphy Status.
2. Search is a non-narrowing typeahead: typing never filters the visible list — it shows a dropdown of matching client names, and selecting one narrows the list to that single client.
3. Wedding Date toggle: "Upcoming Wedding Dates" (default; excludes past and blank wedding dates) vs. "All Wedding Dates" (includes every client, including blanks).
4. Calligraphy Status toggle: "Pending" (default) vs. "Done", filtering on `calligraphy_card_sent`.
5. Due Date filter is an exact-date match against `Due Date`, compared as local `YYYY-MM-DD` strings (never UTC ISO).
6. All active filters compose with AND logic; sort is Wedding Date ascending (blanks last), then Client name A→Z.
7. Clicking the leading checkbox writes `calligraphy_card_sent` directly via `updateRecordAsync`; failures show a red border on that row's checkbox rather than silently reverting.

## Rules

- Dark mode uses the canonical pattern (`fulfillment.tsx`'s approach): plain Tailwind `dark:` utility classes driven by `useColorScheme()` toggling a `dark` class on `document.documentElement` — reads Airtable's own theme setting, not the OS/device theme. No bespoke token object.
- Wedding Date and Calligraphy Status are single-select, always-one-value-active toggles (not clearable filters with an empty state), so BRANDING.md §5's "never add an All option" rule doesn't apply the same way here — both are implemented as a `SingleToggleDropdown` that always shows the active value, no clear/X affordance.
- Date picker reuses `fulfillment.tsx`'s exact `CalendarPopup`/`DatePicker` components (272px panel, Monday-start week, Clear/Today footer) rather than a native `<input type="date">`.
- Items Sold and Gown are plain lookup text values (not single-select-colored fields), so their pills use a neutral gray — never hardcode a status→color map for fields that do carry real Airtable choice colors elsewhere in this project.
- Never include `import './style.css';` in this file.
- Omni's first-draft generated code used numerous non-existent Tailwind class names (e.g. `gray-gray100`, `blue-blueLight2`) that rendered with no working colors at all — every color class was rewritten against real Tailwind utilities and `fulfillment.tsx`'s hex-based `dark:` conventions before this file was committed.

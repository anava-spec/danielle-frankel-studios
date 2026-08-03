# Calligraphy Cards

Group: Tracking · File: `calligraphy_cards.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give the internal team a single list of every client's calligraphy card status, alongside due date, wedding date, and order info, so they can prioritize who's next, plus a detail page per client for the full record and for advancing the card through its production steps. Internal-only, not client-facing.

## Inputs

- DF Clients table (`tblLLUlDgJ4ktzF7c`) — read directly, no separate Calligraphy Cards table exists.
- Fields used: `Full Name`, `Due Date` (formula), `Items Sold` (lookup), `gown_name` (lookup), `Dress Creation Year`, `Wedding Date (Formatted)`, `calligraphy_card_sent` (singleSelect), `calligraphy_card_comments` (long text).
- Generated via Omni from an Omni prompt spec, then rebuilt in-house for branding compliance and fixed once discovered to be the wrong field type (see Rules below).

## Outputs

- A list page in the Tracking section showing every client with a Status pill, Client, Due Date, Items Sold, Gown, Dress Year, and Wedding Date. Clicking a row opens that client's detail page.
- The detail page shows the same fields (grouped 3-per-row) plus Comments, the full status flow as a horizontal stepper, and an "Advance to X" action.
- Writes back `calligraphy_card_sent` (from the list's Status pill, or the detail page's Advance button) and `calligraphy_card_comments` (detail page only) — every other field is read-only display.

## Workflow

1. **Qualification floor (always-on, not a filter toggle):** a client only ever appears on this list if `Item Category` (`fldE4AX5gz8pwah4j`) contains at least one category that is **not** shoes or veil, OR has no `Item Category` at all (no orders — see the visible Items Sold filter below, which now owns that case instead). A client whose `Item Category` is exclusively shoes/veil never qualifies. Approved deviation from the original AC: "direct-to-consumer" isn't a separate flag on `DF Clients` yet, so for now this is the only DTC-qualification signal. `Item Category` is itself a lookup through `shopify_order` (a link field) — same nested-structure quirk as Items Sold/Gown, resolved via `unwrapLinkedNames()`, never `getCellValueAsString()`.
2. Filter bar order: Search (long, always-expanded) → Due Date → Wedding Date → Calligraphy Status → Items Sold toggle.
   - **Items Sold toggle:** a plain two-state button (not a clearable dropdown) — "Hiding Empty Items Sold" (default) hides any client whose Items Sold is blank; "Showing All" shows them too.
   - **Calligraphy Status filter options are read live from the field's own Airtable choices** (`getFieldChoices`) — never hardcoded — so adding/renaming/reordering a choice in Airtable is reflected here automatically, no code change needed.
3. Search is a non-narrowing typeahead: typing never filters the visible list — it shows a dropdown of matching client names, and selecting one narrows the list to that single client.
4. Wedding Date filter: "Upcoming Wedding Dates" vs. "Past Wedding Dates" — clearable (X), no filter applied when cleared (shows every wedding date, including blanks).
5. Due Date filter is an exact-date match, compared as local `YYYY-MM-DD` strings (never UTC ISO).
6. All active filters compose with AND logic, on top of the qualification floor; sort is Wedding Date ascending (blanks last), then Client name A→Z.
7. Clicking anywhere on a row (other than the Status pill) opens that client's **detail page** (`ClientDetailPage`) — full-page navigation, not a modal, same pattern as `did_not_convert.tsx`'s client detail.
8. On the list, clicking the Status pill opens a small dropdown (`StatusPillDropdown`) listing every status as a colored pill option — the user picks the value explicitly. On the detail page, status only ever advances one step forward via the "Advance to X" button (see Rules) — the dropdown on the list is a faster path for correcting a status directly, the detail page enforces the sequential flow.

## Rules

- Dark mode uses the canonical pattern (`fulfillment.tsx`'s approach): plain Tailwind `dark:` utility classes driven by `useColorScheme()` toggling a `dark` class on `document.documentElement` — reads Airtable's own theme setting, not the OS/device theme. No bespoke token object.
- **Status choices and colors are never hardcoded (2026-07-30).** `getFieldChoices(field)` reads the field's real Airtable choices (name + color, in schema order) directly from `field.options.choices` — used for the list's Status pill dropdown, the Calligraphy Status filter, and the detail page's `StatusStepper`. `getFieldChoiceColorMap` is now derived from `getFieldChoices`. Schema order matters specifically because it drives the sequential "advance to next" flow below — don't reorder choices in Airtable without checking that the intended step order still holds.
- **Confirmed 4-step flow (2026-07-30 stand-up):** `Pending` → `Production Approved` → `Sent to Calligrapher` → `Received from Calligrapher`. Production approval (Margo signing off on the card content) is a distinct step from physically sending it; "received" tracks the card coming back from the calligrapher.
- **Detail page "Advance to X" button (`ClientDetailPage`):** only ever offers the *next* choice in schema order — there is no way to jump to an arbitrary status from the detail page (the list's `StatusPillDropdown` still allows picking any value directly, for corrections). Clicking it opens `AdvanceConfirmModal`, a deliberately minimal confirmation: one short line of text and a single "Continue" button — **no X, no Cancel, no backdrop-dismiss**, by explicit request. This is an intentional deviation from every other modal in this project (which all support backdrop/Escape/X dismissal) — don't "fix" it to match them.
- **`StatusStepper`** renders the full choice list as horizontal dots-and-connecting-line, same visual language as `pipeline.tsx`'s "Stage in pipeline" component on the Full Client Profile — but colored from each choice's real Airtable color (via `AIRTABLE_COLOR_MAP`) instead of a fixed emerald, since the status colors can change along with the choices.
- **Detail page layout:** BRANDING.md-style `DetailSection`/`FieldRow`/`DetailRow` (same shape as `did_not_convert.tsx`), with **exactly three fields per row**, by request. Currently: Due Date / Wedding Date / Dress Year, then Items Sold / Gown / (empty). Comments gets its own full-width section below, editable via `CommentsCell`.
- **Comments moved off the main list (2026-07-30):** `calligraphy_card_comments` (`fldfrtzC0BxWggmoU`, long text, snake_case) is edited only on the detail page now — it was on the main table briefly, but per request it belongs on the detail page instead, to keep the list scannable. Free-text notes for Margo to write name variations to use on the physical card (e.g. "Deanna sees Gemma & Gia Kennedy → card should say Gemma and Gia").
- **Dress Creation Year column:** "Dress Year" sits between Gown and Wedding Date, sourced from `Dress Creation Year` (`fldwgDZDs2CNEqPsQ`) on `DF Clients` — a `Number` field, precision 0. Created via API in the sandbox base (`appMmEE4zyHMGhkkd`). **Still pending: publishing this field from sandbox to production** so it actually has data for real clients.
- Wedding Date is a clearable `SingleSelectDropdown` (BRANDING.md §5) — label acts as its own placeholder when empty; clearing removes that filter's effect entirely, no third "All" option baked into the choice list.
- Date picker reuses `fulfillment.tsx`'s exact `CalendarPopup`/`DatePicker` components (272px panel, Monday-start week, Clear/Today footer) rather than a native `<input type="date">`.
- Items Sold and Gown are plain lookup text values displayed as neutral-gray pills — **but not from a text field**: both lookups (via `shopify_order`) resolve to Orders - Shopify's `Items` field, which is itself a `multipleRecordLinks` field. Their raw cell value is therefore a nested array of linked-record references, not plain strings — resolved via `unwrapLinkedNames()`/`getLinkedNamesDisplay()` (same underlying runtime quirk as `did_not_convert.tsx`'s `unwrapLookupString` and BRANDING.md §9's lookup-color note).
- Never include `import './style.css';` in this file.
- **Config-level cause of a past "zero results" bug (found via the `airtable-interface-config-doctor` skill, not by reading code):** `Item Category` wasn't exposed to this page's block config (Data → Fields in the page's right sidebar), so every cell read for it came back `undefined` regardless of code correctness. Fixed by enabling the field, then publishing. **Lesson for future "the code looks right but nothing shows up" reports on this or any other interface**: check the page's field-exposure config before re-debugging the code.

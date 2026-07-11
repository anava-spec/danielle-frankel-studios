# Danielle Frankel Studios — Interface Design System

Reference spec for building Airtable Custom Interface Extensions (TSX/React) for Danielle Frankel Studios. Paste this whole file into any Claude/AI conversation before generating or editing an interface so the output matches existing ones (Pipeline, Recap, Customization Requests, Fulfillment, Sample Tracker).

This is a **prescriptive standard**, not a description of the current code. The 5 reference files diverge from each other (three different color systems, duplicated components, inconsistent sizing) — this doc resolves those into one canonical system. When updating an old interface, migrate it toward this spec rather than copying its existing patterns.

Stack: React + TypeScript, Tailwind CSS utility classes (no CSS modules, no `styled-components`), `@phosphor-icons/react` for icons. No native `<select>`, no external date-picker library — dropdowns and calendars are hand-built components per the patterns below.

---

## 1. Color System — "Champagne"

Adopt the champagne/amber palette (from `sample_tracker.tsx`) as the single standard. Do not use the plain gray/blue system or introduce indigo.

Implement as a token object at the top of the file (or a shared import if the project grows a shared lib):

```ts
const LIGHT = {
  app_bg: '#F8F5EE',
  surface: '#FFFFFF',
  border: '#E9E0CE',
  text_primary: '#1A1612',
  text_secondary: '#6B6357',
  accent: '#D97706',      // amber-600
  accent_soft: '#FEF3C7', // amber-100, for chip/badge backgrounds
};

const DARK = {
  app_bg: '#1B1813',
  surface: '#25211A',
  border: '#38322A',
  text_primary: '#F3EFE6',
  text_secondary: '#B8AF9F',
  accent: '#FBBF24',      // amber-400
  accent_soft: '#3A2E12',
};
```

Rules:
- Every color reference goes through this token object — no ad hoc hex or Tailwind `blue-*`/`indigo-*`/`gray-*` for anything brand-colored (grays are fine for neutral text/borders if they match the token values above).
- Every component must support both `LIGHT` and `DARK` — no interface ships light-only (this was recap.tsx's mistake; fix, don't repeat).
- Detect theme via `prefers-color-scheme` and/or an explicit toggle if the project already has one; pick tokens with `const tok = isDark ? DARK : LIGHT`.

**Status/source colors** (external system indicator dots — keep these fixed, they're semantic not brand):
- Acuity: purple-500 `#A855F7`
- Shopify: green-500 `#22C55E`
- Apparel Magic: amber-500 `#F59E0B`

**Airtable field-choice colors**: when rendering a value that has an Airtable single-select color, resolve it dynamically from the field's actual choice color (via the Airtable SDK), not from a hardcoded JS map. If a bg/fg pair is needed, derive it from the same source — don't maintain a second competing color table.

**Alerts / flags / errors** — these are semantic, not brand colors, and stay fixed regardless of theme (only the dark-mode alpha/shade changes). All 5 reference files agree on this pattern already — keep it as-is, don't route it through the amber/champagne accent:

```ts
const SEMANTIC = {
  danger: {
    bg: 'bg-red-50 dark:bg-red-500/15',
    text: 'text-red-600 dark:text-red-300',
    border: 'border-red-200 dark:border-red-500/30',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-500/15',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-500/30',
  },
};
```

- **Danger (red)**: client/record flags (e.g. "3 flags" badge), "Needs data" / "Needs confirmation" pills, missing/pending states, save/validation errors, destructive icon-button hover (e.g. a remove "×" turns red on hover).
- **Success (green)**: "OK"/complete checks (e.g. measurements confirmed, photos on file) — always the paired opposite of a danger state for the same check (red when missing, green when satisfied), never used standalone as a generic "good" color elsewhere.
- No amber/yellow "warning" tier exists in the current interfaces — status is binary (red = needs attention, green = satisfied). If a future interface genuinely needs a middle "warning" state, use `amber-50/amber-600/amber-200` (light) and `amber-500/15 · amber-300 · amber-500/30` (dark) — same shape as `SEMANTIC` above — rather than inventing a new pattern.
- Keep danger/success on plain Tailwind red/green, not the champagne `accent` — the whole point is that they read as distinct from brand color and from each other at a glance.

---

## 2. Typography

- Font stack: `'Inter', system-ui, sans-serif` — declare this explicitly (inline `style={{ fontFamily: ... }}` on the root container, or a Tailwind `fontFamily` theme extension if the project has a config). Every file must declare it; don't rely on the browser default.
- Sizes (px, not Tailwind's rem-based scale, for consistency with the token approach): `11px` (meta/labels), `12px`–`13px` (table cells, default body), `14px` (emphasized body/section labels), `15px`–`16px` (headers within a panel), `18px`+ (page titles only).
- Weights: `400` body, `500` for labels/table headers, `600` for emphasized values and headers, `700` reserved for page-level titles only.
- Table headers: uppercase, `letter-spacing` wide (`0.05em`), `11px`, weight `500`, colored `text_secondary`.

---

## 3. Spacing, Sizing, Radius

- Control padding: `8px 12px` (px-3 py-2 equivalent) for inputs/dropdown triggers/buttons.
- Border radius: `8px` default (buttons, inputs, cards), `12px` for panels/modals, `999px` (full) for pills/badges/chips.
- Border width: `1px` standard everywhere; a `3px` left-accent border is the one allowed exception, for kanban/list-item status accents only.
- Modal widths: pick from a fixed scale — `480px` (confirm/simple form), `560px` (standard form), `720px` (detail/record view). Don't introduce one-off widths per modal.

---

## 4. Shadows

Use raw `rgba` box-shadows (matches `sample_tracker.tsx`, more control than Tailwind's fixed scale):
- Resting card: `0 1px 3px rgba(0,0,0,0.05)`
- Hover/raised: `0 4px 12px rgba(0,0,0,0.08)`
- Dropdown/popover: `0 8px 24px rgba(0,0,0,0.12)`
- Modal: `0 20px 60px rgba(0,0,0,0.25)`
- Modal overlay backdrop: `rgba(0,0,0,0.45)` with `backdrop-filter: blur(3px)` — use these exact values everywhere a modal overlay appears.

---

## 5. Dropdowns / Selects

Custom component, never a native `<select>`. One shared `Dropdown` pattern:
- Trigger: same control styling as inputs (padding/radius/border per §3), `CaretDown` icon from `@phosphor-icons/react` on the right, rotates 180° when open (`transition-transform`, ~150ms).
- **Trigger label swaps based on state — no separate label sits outside the control:**
  - **No filter applied**: trigger shows the filter's name (e.g. `Studio`, `Sales Associate`) in `text_secondary`, acting as its own placeholder/label. No filter name is ever shown as separate static text next to the control.
  - **Filter applied**: trigger shows the **selected value** (e.g. `Los Angeles`, `Last 7 days`) in `text_primary`/`accent`-tinted per the active-state rule below, and a small `X` icon (`@phosphor-icons/react`, `14px`) appears at the trigger's right edge (replacing or sitting just before the `CaretDown`) to clear that one filter directly — no separate "Clear" text link per filter.
  - When a filter is active, color the trigger's **border** as well as text/background with `accent` — not just background (this was sample_tracker.tsx's improvement over the others; keep it).
  - **Exception — filters attached to an already color-coded panel**: when a dropdown filters a panel that itself uses semantic color (e.g. a "Sample Alerts"/danger-styled list where each card already has a red/amber border per urgency), the accent-on-active treatment can visually compete with that panel's own coloring. In that case, the trigger may opt out of the accent border/text-on-active (stay neutral `border`/`text_muted` regardless of state) while keeping every other behavior identical — value display, the inline `X`-to-clear, and the placeholder-name-when-empty state. Implement this as an explicit opt-out prop on the shared component (e.g. `accentOnActive={false}`), not a one-off inline override, so it stays traceable as a deliberate exception rather than a missed migration.
- Panel: `surface` background, `1px` `border`, dropdown shadow (§4), `8px` radius, click-outside-to-close.
- Options: `8px 12px` padding, hover state = `accent_soft` background, selected state = `accent` text + checkmark.
- **Filter names are always spelled out in full** — no abbreviations (`Sales Associate`, not `SA`) — since the name is user-facing placeholder text now (per above), not an internal label a developer might be tempted to shorten.

---

## 6. Filters

- Layout: `flex items-center gap-2`; each filter is a single dropdown trigger only — **no external label** (per §5, the filter's name lives inside the trigger itself as a placeholder, replaced by the value once applied).
- **No global "Clear all" text link at the filter-bar level either** — each filter clears itself via its own inline `X` (§5). Only add a bar-level "Clear all" control if a screen has enough simultaneous filters that clearing them one by one would be genuinely tedious (4+), and even then style it as a small icon-button, not a text link.
- Search bar: text input with a `MagnifyingGlassIcon` absolutely positioned inside on the left, `~32px` left padding to clear the icon. Placeholder text always follows the pattern **"Search by `<field>`, `<field>`, …"** — enumerate the actual fields it searches (e.g. `Search by name, phone, email, AM order…`), never a bare "Search…" or "Search clients".
- Active filter chips (if used to summarize applied filters, separately from the dropdown triggers themselves): `accent_soft` background, `accent` text, `999px` radius, small `x` to remove.

---

## 5b. Layout Selector

The control that switches a page's view (e.g. List / Kanban / Calendar):
- Rendered as a `Dropdown` (per §5 pattern), not a row of toggle buttons or tabs — one trigger showing the current layout's name, opening a panel listing the other available layouts.
- Trigger text is **centered** (not left-aligned like filter/search triggers), since there's no placeholder state to swap — a layout is always selected, so the label never needs to reserve left-aligned space for a caret-only affordance.
- Positioned at the right end of the filter bar, per §10's established header layout (title + filters → primary action, layout selector rightmost).

---

## 7. Date Pickers

One shared `CalendarPopup` component, not per-file reimplementations:
- Week starts **Monday** (standardize on this; recap.tsx's Sunday-start is the exception to drop).
- Panel width: `272px`.
- Today = outlined circle in `accent`; selected = filled `accent` circle with `surface`-colored text.
- Include a "Clear" link in the footer.
- Trigger button matches standard dropdown trigger styling (§5).

---

## 8. Buttons

- Primary (save/submit/confirm): background `accent`, text white/`surface`, hover = darken ~10% (e.g. amber-600 → amber-700 equivalent). Use this for every primary action across every interface — no gray or blue primary buttons.
- Secondary: `1px` `border`, transparent/`surface` background, `text_primary`, hover = subtle `app_bg`-shade background.
- Tertiary/text button: no border/background, `text_secondary`, hover = `text_primary`.
- Icon-only buttons: `text_secondary` default, hover = `text_primary`, no visible border unless it's a toggle in the "active" state (then border + text in `accent`).
- Radius `8px`, padding `8px 12px` (icon-only: square, `8px` all sides).

---

## 9. Badges / Status Pills

One shared `StatusPill` component (replacing the four near-duplicates — `ApprovalPill`, `ApprovalStatusPill`, `Pill`, `LocationBadge`):
- Props: `label`, `color` (resolved from the Airtable field-choice color when the value comes from a single-select field; otherwise an explicit semantic color), optional `size` (`sm`/`md`).
- Rendering: background = `color + '20'` (20% alpha, hex suffix — standardize on this alpha, not `'55'` or `'22'` which appear in current code), text = the solid `color`, `999px` radius, `4px 10px` padding for `md`, `2px 8px` for `sm`.
- Never hardcode a status→color JS map when the value originates from an Airtable single-select — always resolve dynamically so it can't drift from schema changes. Hardcode only for statuses that don't come from Airtable (e.g. a computed/derived state).

---

## 10. Layout Patterns

- Root shell: `h-screen flex flex-col overflow-hidden` — always include `overflow-hidden` on the root (pipeline.tsx's omission was a bug, not a variant).
- Page structure: header bar (title + primary filters + primary action) → scrollable main content → optional footer/summary bar.
- Modals: `fixed inset-0` wrapper, overlay per §4, centered panel with header / scrollable body / footer (footer holds actions, right-aligned, primary button rightmost).
- Table headers: `app_bg`-tinted background, uppercase `11px` labels (per §2) — this convention was already shared between two files; keep it as the standard for every table.
- z-index scale — fix one scale and use only these values everywhere (replaces the current ad hoc `z-50/60/65/70/100/1000`):
  - `10`: sticky headers
  - `20`: dropdown/calendar panels
  - `50`: modal overlay + panel
  - `60`: toast/notification (above modals, rare)
- No responsive breakpoints — these are fixed-desktop-width internal tools; don't add mobile layouts unless a task explicitly asks for one.

---

## 11. Icons

- `@phosphor-icons/react` exclusively — no inline hand-rolled SVGs, no other icon package.
- Sizing: `14px` inline-with-text icons (dropdown carets, inline status), `16px` standalone/toolbar icons, `20px` for prominent header-level icons. Pick one size per context and stay consistent within a component.

---

## 12. Animation

- `transition-colors` (Tailwind default duration, ~150ms) on all hover states — buttons, dropdown options, table rows.
- `transition-transform` for the dropdown/accordion chevron rotation, same ~150ms.
- No modal open/close animation (instant mount/unmount) — matches all 5 reference files, don't introduce one.
- Avoid `transition-all` — it was only in one file and is unnecessary/imprecise; name the specific property.

---

## 13. Category Toggle Filters / Summary Stat Buttons

Some interfaces show a row of clickable "stat" buttons above the table that both **summarize a count** and **act as a filter toggle** — e.g. Fulfillment's `Pick Up: 6` / `Ship: 28` / `On Hold: 2` (`fulfillment.tsx:1314-1328`). These are distinct from `StatusPill` (§9): a pill is read-only and reflects one record's value; a category toggle is clickable, reflects an aggregate count, and has its own on/off visual state.

**Current implementation is hardcoded Tailwind (`purple`/`blue`/`red`)**, unrelated to any Airtable field color — this is fine to keep hardcoded (these are fixed business categories, not dynamic field choices), but standardize the palette and states so future interfaces don't invent new hues per category, and so the colors don't collide with §1's semantic red (danger/flags):

```ts
const CATEGORY_TOGGLE = {
  // ordered by first-used category → color; add new categories in this order
  slate:  { on: 'bg-slate-100  dark:bg-slate-900/40  text-slate-700  dark:text-slate-200  border-slate-600  dark:border-slate-400',
            off:'bg-slate-50   dark:bg-slate-950/20  text-slate-600  dark:text-slate-300  border-slate-300  dark:border-slate-700' },
  blue:   { on: 'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-200   border-blue-600   dark:border-blue-400',
            off:'bg-blue-50    dark:bg-blue-950/20   text-blue-600   dark:text-blue-300   border-blue-300   dark:border-blue-700' },
  purple: { on: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 border-purple-600 dark:border-purple-400',
            off:'bg-purple-50  dark:bg-purple-950/20 text-purple-600 dark:text-purple-300 border-purple-300 dark:border-purple-700' },
  amber:  { on: 'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-200  border-amber-600  dark:border-amber-400',
            off:'bg-amber-50   dark:bg-amber-950/20  text-amber-600  dark:text-amber-300  border-amber-300  dark:border-amber-700' },
};
```

Rules:
- **Never use `red` for a category toggle**, even one that sounds urgent (e.g. "On Hold", "Overdue", "Blocked"). Red is reserved exclusively for §1's `SEMANTIC.danger` (flags/errors/needs-attention pills). Reusing it here makes a merely-categorical count look like a system alert. Use `amber` for anything hold/pause/caution-flavored instead — e.g. Fulfillment's "On Hold" should be `amber`, not `red` (existing code should be migrated to this when that file is next touched).
- Assign one color per category, stable across the whole interface (don't reassign colors if categories are reordered or added to).
- Each button always shows both the label and a live count (`{label}: {count}`), plus a small icon from `@phosphor-icons/react` (§11) at `14px`.
- Toggle state: `on` = filter currently applied (darker fill, solid border), `off` = filter available but inactive (lighter fill, muted border) — both states always keep the same text/icon, only the fill/border shift, per the values above.
- Layout: these buttons sit left of the search bar in the filter row (§6), `gap-2` between them, same `8px` radius and padding as other controls (§3).

---

## 14. Component Checklist for New Interfaces

When building or refactoring an interface, confirm:
- [ ] Uses the `LIGHT`/`DARK` token object from §1, both themes fully implemented
- [ ] Font stack explicitly declared (§2)
- [ ] One shared `Dropdown`, `CalendarPopup`, `StatusPill` pattern — not a reimplementation
- [ ] Primary buttons use `accent`, never blue/gray/indigo
- [ ] z-index values only from the §10 scale
- [ ] Icons only from `@phosphor-icons/react`
- [ ] Root shell includes `overflow-hidden`
- [ ] Modal widths from the fixed scale in §3
- [ ] Category toggle filters (if any) never use red — red is reserved for danger/flags (§13)
- [ ] Filter dropdowns show the filter name as placeholder only when unapplied, the value + inline `X` when applied — no external label, no "Clear" text link (§5, §6)
- [ ] Search bar placeholder reads "Search by `<field>`, `<field>`…" (§6)
- [ ] Layout selector is a centered-text dropdown, not toggle buttons/tabs (§5b)

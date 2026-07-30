# Recap

Group: Daily Ops · File: `recap.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Give Sales Associates a daily list of consultation appointments and a place to record each one's outcome immediately after — style selected, customizations, embroidery/paint/lace amount, calculated pricing — so that recap becomes the single source of truth Customization Requests and Generate Proposal both read from, without re-entering anything.

## Inputs

- `Appointments`, `Clients`, `Styles`, `Customizations`, `Customization Pricing`, `Staff`, and `Proposals` tables.
- Fields captured per recap: Customized Style (or two styles for Hybrid), Customizations/pricing selections, Amount of Embroidery/Paint/Lace, Additional Details.
- Stakeholders: Julia Collins; Sales Associates (primary daily users).

## Outputs

- The completed recap record feeds Generate Proposal (reads style, customizations, embroidery amount, and calculated price directly) and the Customization Requests interface, which references the same underlying record for its own approval/decision workflow.

## Workflow

1. `AppointmentsApp` is the main page: a date-picker header (prev/next day, calendar, "Today" shortcut), a client-name search (typeahead with keyboard navigation), Studio/Sales Associate filters, and a table of that day's consultation appointments (Time, Client, Studio, Wedding Date, Sales Associate, Favorite Styles, Measurements, Photos, Follow-Up, Customizations count). Only Consultation-type, non-cancelled, client-linked appointments show.
2. Clicking a row opens `PostAppointmentModal`, where the SA edits wedding date/confirmation, measurement notes, RTW size, Favorite Styles, appointment notes, and uploads measurement/appointment photos.
3. Adding or editing a customization opens the nested `CustomizationModal`: pick a Style (or two, for Hybrid), Customizations/pricing, Amount of Embroidery/Paint/Lace (only shown when a selected pricing row needs it), Additional Details — with a live Order Summary (base price, line items, grand total) throughout.
4. "Generate Proposal" is only enabled once every required input is present (Style, at least one customization, Amount if applicable, a grand total above $0, client, sales associate); its disabled-state title always names exactly what's missing, never a generic error. It is never triggered automatically by saving/editing a recap.

## Rules

- Hybrid customizations are a single record with two direct Style links (`customized_style` + `additional_customized_style`), not the old parent+2-children model — reworked 2026-07-26. Pricing is `max(baseA, baseB) × 1.85` (the merge surcharge) plus the shared customization line-item total, both priced/Self-Usage'd against whichever style has the higher base price (per Julia, 2026-07-24: "the only difference between hybrid and regular is that hybrid is a merge of two styles").
- Rush Fee / M2M / Alterations checkboxes were removed from the Customizations UI entirely — those now live only on the Draft Order, not here (per Julia's 2026-07-20 demo feedback).
- A multiplier-priced customization line missing its Amount tier shows an "amount *" indicator (red asterisk, hover tooltip) in the Rate column instead of a misleading $0.00.
- `selfUsageField`/`stylesSelfUsageField` are hardcoded field IDs (not fuzzy name-matched) — a 2026-07-27 fix after the previous fuzzy match risked silently colliding with `additional_self_usage` and scaling a fee against the wrong style.
- `parseCurrencyString` handles both US (`1,990.00`) and EU/LatAm (`1.990,00`) number formats — don't assume US formatting when reading a rollup/lookup cell as a string.
- The in-progress "add customization" draft lives in the parent modal's state, not the child's, so dismissing the add modal by accident doesn't lose what was entered — only a successful submit clears it.
- Proposal generation must never occur automatically on recap save/edit — "Generate Proposal" is the only trigger, and must remain visible directly on the recap/customization detail view.
- Recap is functionally and structurally distinct from Customization Requests — don't merge their code paths; Customization Requests is its own page that references the same underlying data for its own approval workflow.
- Never include `import './style.css';` in this file.
- **Fixed 2026-07-30:** the main list's "Customizations" column showed `—`/blank for clients who actually had customization requests. Root cause: it read `CLIENT.CUSTOMIZATION_LINK` (`fldlbAPEaoTwfFPTv`) on the Clients record — a link field that isn't reliably kept in sync with real Customizations records. `PostApptModal`'s `linkedCustomizations` had already moved off this same field for the same reason (see its own inline comment), but the main-list count was never updated to match. Fixed by deriving the count from `customizationRecords` (already fetched) filtered by `CUSTOM.CLIENT` — the link field on the *Customizations* table pointing back to the client — via a memoized `custCountByClientId` map, the same source of truth the modal uses. Don't reintroduce a read of `CLIENT.CUSTOMIZATION_LINK` for this count; treat it as unreliable everywhere in this file.

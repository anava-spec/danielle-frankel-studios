# Recap

Group: Daily Ops · File: `recap.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Let Sales Associates record the outcome of a bridal appointment — selected style, customizations, embroidery/paint/lace amount, and calculated pricing — immediately after the appointment, and use that recap as the single source of truth that downstream features (like Customization Proposal generation) read from without re-entering data.

## Inputs

- `Customizations` table (`tbl7HUWDI7IRjWY92`) — the recap record itself
- Fields captured per recap: Customized Style (link), Amount of Embroidery/Paint/Lace (single select), Customization Pricing (link), Made-to-Measure (checkbox), Alterations (checkbox), Rush (checkbox)
- Stakeholders: Julia Collins; Sales Associates (primary daily users)

## Outputs

- The completed recap record feeds:
  - The "Generate Proposal" action (Customization Proposal Document Generation), which reads style, customizations, embroidery amount, and calculated price directly from the open recap
  - The Customization Requests interface (separate page), which references the same underlying customization/recap data for approval tracking

## Workflow

1. Sales Associate opens `PostAppointmentModal` (the Recap interface) via `CustomizationModal` for a given appointment/client.
2. SA records: customized style, which customization types apply (checkboxes), embroidery/paint/lace amount, and the calculated price.
3. Once complete, a "Generate Proposal" button becomes available if all required inputs are present (see Rules) — this is the entry point into proposal generation, but proposal creation is a separate, gated action, not automatic on recap save.
4. Recap data also flows into the Customization Requests interface as the source-of-truth customization record that gets its own approval/photo workflow there.

## Rules

- Proposal generation must NOT occur automatically on recap save or edit — the "Generate Proposal" button is the only trigger, and it must be visible directly on the Recap detail page.
- `canGenerateProposal` gates the button; when disabled, the button's title attribute must surface exactly which required inputs are missing (Customized Style, at least one selected customization, Embroidery amount, a calculated price greater than $0, client, sales associate) — no generic error message.
- Default filter on `CustomizationModal`: none — it reflects whatever customization record is currently open in edit mode.
- Recap is functionally and structurally distinct from the Customization Requests interface — do not merge their code paths; Customization Requests is its own page that happens to reference the same underlying data.
- Known open bug (Julia, Jul 15): "Unable to create a new customization request in the interface" — flagged High priority; verify whether this is a Recap-side or Customization-Requests-side failure before fixing.
- Never include `import './style.css';` in this file.

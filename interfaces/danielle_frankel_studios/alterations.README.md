# Alterations

Group: Daily Ops · File: `alterations.tsx`

> See [`docs/CROSS_CUTTING.md`](../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Track brides through the Alterations phase of the pipeline (post-sale, pre-fulfillment) — currently exists as a working page, but is flagged by Julia as unclear even to the developer, with a request to simplify it into a plain list. A fuller interface rebuild is identified as a needed future effort.

## Inputs

- Client records from `DF Clients`, filtered/scoped to clients in the Alterations stage
- Order item data reflecting paid/unpaid status, synced via Cobalt from Shopify
- Stakeholders: Julia Collins (requested simplification); Alterations Lead role (a Staff `role_catalog` entry, also referenced as a Slack notification target elsewhere in Appointments)

## Outputs

⚠️ **Still open** — no confirmed automations or write-backs specific to Alterations beyond the phase-transition logic shared with the rest of the pipeline (see Rules below). If Alterations gets automations of its own as part of the planned rebuild, document them here once built.

## Workflow

1. Clients whose stage is Alterations appear on this page, using the same `STAGE_ORDER`/`STAGE_STEPS` pattern duplicated locally in this file (identical to `pipeline.tsx`'s array, per the isolated-file platform constraint).
2. Staff currently navigate a page Julia herself finds unclear — pending simplification to a plain list view (not yet built as of this writing).

## Rules

- Phase-transition audit finding: Alterations was found **compliant, no changes needed** in the 7-phase audit (unlike Deliberating/Order Ready/Fulfillment, which needed fixes) — the phase-entry/exit logic itself is correct as of that audit.
- **However**, a separate, more recent bug was flagged by Julia (Jul 15, High priority): the client should move to the Alterations phase **when the appointment is scheduled**, not at check-in. This appears to contradict or refine the earlier "compliant" audit finding — resolve by checking `docs/PHASE_LOGIC.md` against this specific trigger before assuming either source is fully authoritative; treat Julia's most recent written feedback as taking precedence per the standing precedence rule.
- Known open bug (Julia, Jul 15, High priority): "Alterations item not marked paid" — an alterations item shows as unpaid in items sold even though it's paid in Shopify. This is a sync/display bug, not a business-logic change.
- Julia's simplification ask ("simplify Alterations page to a plain list") is Low priority in her feedback log — don't treat as blocking relative to the two High-priority bugs above.
- A full "Alterations interface rebuild" was identified as a large, not-yet-scoped effort during Sprint 4 feedback triage — treat the current page as a stopgap, not the final shape, when making architectural decisions here.
- Shares the `STAGE_ORDER`/`STAGE_STEPS` duplication constraint and `docs/PHASE_LOGIC.md` authority with Pipeline — see [pipeline.README.md](pipeline.README.md)'s Rules section for the platform-constraint explanation.

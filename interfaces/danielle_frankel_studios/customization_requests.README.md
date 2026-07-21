# Customization Requests

Group: Daily Ops · File: `customization_requests.tsx`

> See [`docs/CROSS_CUTTING.md`](../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Track a customization request through its approval lifecycle (Margo approval, then Production approval) with photo documentation at each stage, so approvals move faster and the Sales team knows exactly when to follow up with a bride. This is explicitly a workflow/approval-tracking surface — separate from where the customization was originally recorded (Recap).

## Inputs

- Photos attached in two contexts: reference photos on the original request, and production result photos on the approval step
- Underlying customization/recap data originated in Recap (`Customizations` table, `tbl7HUWDI7IRjWY92`)
- Stakeholders: Julia Collins; Margo Lafontaine (approval role referenced in filters); Production team; Sales team (needs to know when to follow up with a bride)

## Outputs

- Slack notification to Production recipients when a request reaches the point where Production approval is required
- Slack notification to Sales recipients when a request reaches the point where Sales needs to communicate back to the bride
- Photo attachments visible in the same context where they were added (reference vs. production-result)

## Workflow

1. Staff open a customization request's detail page in the Customization Requests interface (this page is separate from Recap/`CustomizationModal` — confirmed explicitly, not a tab or mode inside Recap).
2. The detail page provides a **Margo filter** and a **Production filter** — not access-gated tabs; any staff member can view or switch between either filter, there is no role-based access restriction (this was explicitly decided: role-based access was originally proposed, then removed — filters remain purely as views anyone can use).
3. Each filter shows only requests currently pending that specific approval stage's criteria; a request pending Margo's approval does not appear in the Production filter, and vice versa, until its status changes to the other stage's pending state.
4. When a request reaches the point requiring Production approval, the Production Slack notification fires.
5. When a request reaches the point where Sales needs to loop back to the bride, the Sales Slack notification fires (separate automation from the Production one).
6. Staff can attach photos at two points: as reference photos on the original request, and as production-result photos once Production has acted — both are visible later in their original context.

## Rules

- No access control/permissions layer on this interface — any staff member can access or edit anything on it (explicit product decision, confirmed by Axel after an access-control proposal was walked back).
- The Margo/Production split is implemented as **filters**, not as separate access-gated views — do not build permission checks around them.
- This interface must not show a request in a filter it isn't currently awaiting — filter membership must be derived from live approval-stage state, not a static category.
- Slack recipient configuration for Production and Sales is separate per notification type — do not combine into a single Slack target list.
- DFS team Slack member IDs were pending from Julia as of the last review — this blocks the Customization Request approval notifications specifically; verify these are populated before assuming notifications fire correctly.
- Known open bug (Julia, Jul 15, High priority): "Unable to create a new customization request in the interface."
- Larger rework in progress/planned: a broader "Customization Requests workflow with approval gates and notifications" was flagged as a large-effort item during Sprint 4 feedback analysis — treat the above as the current confirmed shape, but expect scope to expand (e.g., a new Terms of Customization document was also raised in the same session).

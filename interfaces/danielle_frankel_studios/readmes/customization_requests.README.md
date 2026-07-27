# Customization Requests

Group: Daily Ops · File: `customization_requests.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Track every customization request through its full approval lifecycle — internal (Margo/SA) review, then the client's own decision — with a workdesk view for daily work and a dedicated approval queue for triaging new requests. Distinct from Recap: Recap is where a customization gets recorded during/after an appointment; this interface is where it gets reviewed, approved, denied, or counter-proposed.

## Inputs

- `Customizations` table (`tbl7HUWDI7IRjWY92`) — same underlying records Recap creates.
- Related: `Customization Pricing`, Styles, Staff (Sales Associates), Clients.
- Stakeholders: Julia Collins (product owner/feedback), Margo (internal approver), Sales Associates.

## Outputs

- Two toggleable layouts, switched via a `LayoutDropdown`:
  - **Workdesk** (`ops`) — a flat table of every request (Client, Style, Internal Status, Client Status, Sales Associate, Date of Request, Proposed Total, Approved Price). Default filter hides already-resolved statuses (Internal Denied, Client Approved, Client Denied, and both "… • Counter-Proposal" variants) so staff land on what's still actionable.
  - **Approval** — a two-column split view: "New Requests" (draggable rows) and "Under Review" (drop target). Dragging a New Request onto Under Review writes `internal_approval_status: 'Under Review'`.
- A `RecordDetailPage` per request with the full review/decision flow.
- A "New Customization Request" creation flow (Regular or Hybrid).

## Workflow

1. **Counter-proposal threads**: every non-root record links to its thread root via `parent_customization_request`. Only the single latest record in a thread ever shows as its own row in either layout — older thread members (including the root, once it has children) are hidden from the list and reachable only through the Detail Page's Counter-Proposal History.
2. **Combined status**: the list's displayed status prefers `client_approval_status` once it has any value ("Client …"), otherwise falls back to `internal_approval_status` ("Internal …", defaulting to "New Request" when blank).
3. **Detail Page actions**, gated by which layout the page was opened from (`sourceLayout`):
   - Internal Approve/Deny/Counter-Propose: only from Under Review (Approval layout) or Counter-Proposed (Workdesk, prefixed "SA" when the SA acts on it).
   - Client Approve/Deny/Counter-Propose: only from Workdesk, only once `client_approval_status = "Request Review"`. Client Approve is terminal (no longer flips `production_status`); Client Deny is terminal; a client counter writes "Denied • Counter-Proposal" directly.
   - Field editability requires Workdesk **and** an early stage (blank/New Request/Under Review) — the Approval layout is always read-only, and Style/Customizations stay frozen on any counter-proposal record even in Workdesk (only editable on the thread's root).
4. **Hybrid customizations** use the same model as Recap: one record with two direct Style links, priced at `max(baseA, baseB) × 1.85` (the merge surcharge) plus shared customization line items, based on whichever style has the higher base price.
5. **Deep links**: a `?record=recXXXXX` URL param (used by the notification automations' "Click here to review" links) jumps straight to that record's Detail Page on first load — `sourceLayout` is set to `approval` if the record is Under Review, otherwise `ops`.
6. **New Customization Request**: pick Regular or Hybrid, search for a client (no stage restriction — any client is selectable), pick style(s), customizations, Embroidery/Paint/Lace Amount, Additional Details. The in-progress draft lives in the parent component's state, so dismissing the modal (outside click, Escape, Cancel) does **not** lose what was typed — only a successful submit clears it.

## Rules

- "Denied • Counter-Proposal" statuses (internal and client) are always hidden from the default Workdesk filter — that status only means a newer counter-proposal already superseded the record, it's not a real outcome needing action (per Julia, 2026-07-27).
- Style dropdown (Regular and Hybrid) is intentionally unfiltered — shows every style, no "Favorite Styles in Acuity" scoping (per Julia, 2026-07-24/27).
- Client-approve no longer flips `production_status` to "Sent to Production" — approved requests now move into a separate Shopify-purchase phase (per Julia, 2026-07-27).
- "Original Total"/"Original Costs" on a counter-proposal is always computed from the thread's ROOT record's own fields, never the currently-open counter-proposal — Style/Customizations are frozen after the first counter, so the root is the only reliable source.
- Self Usage field IDs are hardcoded (not fuzzy name-matched) after a 2026-07-27 bug where the wrong style's Self Usage got picked up, scaling a multiplier fee incorrectly.
- A multiplier-priced customization line missing its Embroidery/Paint/Lace Amount tier shows an "amount *" indicator (red asterisk, hover tooltip) in the Rate column instead of a misleading $0.00.
- Counter-Proposal's Embroidery/Paint/Lace Amount is read-only, inherited from the parent request — nothing is editable once a request is past its first review (per Julia, 2026-07-27).
- Currency parsing (`parseCurrencyString`) handles both US (`1,990.00`) and EU/LatAm (`1.990,00`) formats by detecting which separator trails 1–2 digits — don't assume US formatting when reading a rollup/lookup number cell as a string.
- No access-control/permissions layer — any staff member can view or act on any request; this was an explicit product decision (an earlier Margo/Production filter-based access proposal was walked back). Don't reintroduce role-gating without confirming with Axel/Julia first.
- Never include `import './style.css';` in this file.

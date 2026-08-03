# Draft Orders

Group: Daily Ops · File: `draft_orders.tsx`

> See [`docs/CROSS_CUTTING.md`](../../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Let Sales Associates build, save, and revisit itemized draft order pricing for a bride before finalizing a sale — distinct from both the Customization Line-Item Pricing interface and the Order Price Adjustment Log (verified non-duplicative during scoping).

## Inputs

- `draft_orders` table (`tblp7foUmlN9823WW`), flat single-table structure (chosen over a child-table approach)
- Linked `style` and `customizations` records (customizations pull from the `Customizations` table, which has its own `Effective Price` formula field added specifically to support clean rollups here)
- Stakeholders: Julia Collins (confirmed requirements in a June onboarding session); story `JuliMigLui37084`, Sprint 4, 12 SP, owner Axel

## Outputs

- No document generation (explicitly out of scope — a scope discrepancy between the locked AC and an earlier stand-up pitch was resolved by confirming document generation is NOT part of this story)
- No Shopify write-back in the current build (a later "Shopify draft order API integration" was separately flagged as a distinct large-effort item during Sprint 4 feedback triage — do not assume it's part of this story)

## Workflow — four-layer navigation

1. **Active Clients list** → shows brides with draft order activity.
2. **Client Drafts popup** → shows this client's existing drafts.
3. **Create Draft modal** → staff can create a new draft: fields are `style` (link), `customizations` (link), `rush_fee` (currency, auto-recalculated on line-item change, not manually editable), `shipping`/`taxes`/`discount` (+ notes, currency, editable), and read-only rollup/formula totals: `style_subtotal`, `customization_subtotal`, `total`, `grand_total`. Actions: "Save Draft" (creates the record); Cancel/X/backdrop/Escape trigger a discard-confirmation dialog if any field has been touched.
4. **Draft Detail** (full page) → view/edit one existing draft, gated by a specific editability rule (see Rules). A `locked` checkbox (`fldTcFzPYNKajZepk`) is always toggleable via a Lock/Unlock action regardless of the editability rule.

## Rules

- Editability rule: a draft is editable only if it is the **most recent draft for its client** (by `created_at`) AND `locked = false` AND the user has write permission. Otherwise every section renders read-only with a banner stating the specific reason.
- Alterations and M2M (Made-to-Measure) are **intentionally not fields** on this page — those pricing components live on the linked Customization record itself (`alterations_options` / `m2m_options`) and would duplicate data if repeated here. This was confirmed as an intentional decision during code review, not a gap.
- A "Tentative" status label for unapproved customization pricing was removed from this page by explicit decision — do not re-add without confirming with Julia.
- "Other Charges" ended up as six named categories mirroring the `Orders - Shopify` table: Rush Fee, Alterations, M2M, Shipping, Taxes, Discount (even though Alterations/M2M aren't editable fields here — they're represented in the rollup math via the linked Customization record).
- Financial totals (`style_subtotal`, `customization_subtotal`, `grand_total`) must be read directly from Airtable rollup/formula fields — never computed and stored only in the interface layer (this was corrected mid-build after Axel pushed back on an interface-only totals approach).
- Access: any editor or viewer with base access can open this interface — no dedicated role/group restriction defined specifically for Draft Orders. Write actions are gated at the record level via `hasPermissionToUpdateRecords()` / `hasPermissionToCreateRecords()`; if either returns false, the relevant control is disabled with an explanatory message rather than attempting the write.
- All schema changes for this table were routed through Claude Code prompts, never executed directly — this table's field IDs must be re-verified via `get_table_schema` if anyone modifies its structure.
- **Shipping Address (2026-07-30):** a new "Shipping Address" row sits above Shipping in the Additional Charges table, both in Create Draft and Draft Detail. `AddressSelector` offers the client's three existing addresses on file (`Shopify Address`/`Acuity Address`/`Other Address`, from `DF Clients`) as quick-pick suggestions, but the same input also accepts a freehand new address typed directly — there's no separate "existing vs. new" mode. Saves to `draft_order_address` (`fldZY2glO0rB19Eho`, singleLineText, created via API in the sandbox base). In Create Draft it's held in local state and saved once with everything else on "Save Draft"; in Draft Detail it autosaves on blur (or immediately on picking a suggestion), same as the other Notes fields. This field is not yet wired to any Shopify write-back — the story only covers selecting/saving the address in Airtable.
- **Style picker is unfiltered (2026-07-30):** previously, if a client had any Customization Request at all, the Style dropdown narrowed to only the styles those CRs touched (`eligibleStyleIds`/`eligibleStyles`). Removed per Julia — any style should always be selectable, in both Create Draft and Draft Detail. Only the text search and the 20-result cap remain.
- **Pending-customization messaging (2026-07-30):** the Customizations section already had a client-wide banner for "this client has customization requests, but none are approved yet." That banner doesn't fire once the client has *any* approved CR, even if the *specific style(s)* on this draft only have a pending/unapproved one — that CR would previously just silently never appear, with no explanation. Added a second, per-style banner (`pendingCustomizationsForSelectedStyles` in Create Draft, `pendingCustomizationsForLinkedStyles` in Draft Detail) that fires whenever a selected/linked style has an unapproved CR, telling the SA to push for approval. Draft Detail's Customizations section previously only rendered at all when the client had ≥1 approved CR; it now also renders (showing just this banner) when there's a pending one for a linked style, even with zero approved CRs yet.

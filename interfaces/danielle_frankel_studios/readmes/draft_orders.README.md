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
- **Shipping Address (2026-07-30):** a top-level "Shipping Address" section sits where State Costs used to be (right after Client, before Styles), in both Create Draft and Draft Detail — this is the field's primary, prominent location, not a row buried in Additional Charges. `AddressSelector` offers the client's three existing addresses on file (`Shopify Address`/`Acuity Address`/`Other Address`, from `DF Clients`) as quick-pick suggestions, but the same input also accepts a freehand new address typed directly — there's no separate "existing vs. new" mode. Saves to `draft_order_address` (`fldZY2glO0rB19Eho`, singleLineText, created via API in the sandbox base). In Create Draft it's held in local state and saved once with everything else on "Save Draft"; in Draft Detail it autosaves on blur (or immediately on picking a suggestion), same as the other Notes fields. This field is not yet wired to any Shopify write-back — the story only covers selecting/saving the address in Airtable.
- **State Costs / Shipping / Taxes removed entirely (2026-07-30):** per Julia, Shopify will calculate shipping and taxes automatically from the selected shipping address going forward, so the State Costs selector (and the Shipping/Taxes rows it drove, both the live preview in Create Draft and the read-only lookup/formula display in Draft Detail) were removed from the UI in both layers. The underlying Airtable fields/table (`state_costs`, `DRAFT_SHIPPING`, `DRAFT_TAXES`, their Notes fields) were **not** deleted — only the interface no longer reads/writes them going forward. `total`/`grand_total` no longer include a shipping or tax component.
- **Style picker is unfiltered and shows every style (2026-07-30):** previously, if a client had any Customization Request at all, the Style dropdown narrowed to only the styles those CRs touched (`eligibleStyleIds`/`eligibleStyles`), and results were capped at 20. Removed per Julia — any style should always be selectable. The picker now lists every style alphabetically (no cap), excluding any style whose name matches `/customized/i` (e.g. "Ada - Customized" alongside the real "Ada" — these are internal variants, never directly selectable).
- **Combined pending-approval banner (2026-07-30):** previously two separate banners could show in the Customizations section — a client-wide "none approved yet" message, and a per-style "N requests still waiting" message. Merged into one: a fixed intro line ("This client has customization requests waiting for internal review. They need to be approved before they can be added here.") followed by one line per selected/linked style that has a pending request ("{Style}: {N} pending approval(s)"), computed via `pendingCountsByStyle` in both layers. Draft Detail's Customizations section renders (showing just this banner) even with zero approved CRs, as long as a linked style has a pending one.

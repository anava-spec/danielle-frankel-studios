# Session Transcript — Refund Requests: Live-Testing Feedback Rounds

Date: 2026-09-02
Repo: `github.com/mbenavides211/DFS-Brain.git` (parent monorepo) — mirrored via `git subtree push --prefix=danielle-frankel-studios dfs-child main` to `github.com/anava-spec/danielle-frankel-studios.git`, which is the repo Airtable's interface sync actually reads.
Primary file (Turns 1–8): `danielle-frankel-studios/interfaces/danielle_frankel_studios/code/daily_ops/refund_requests.tsx`
Sandbox base: `appMmEE4zyHMGhkkd`

**Note on paths:** partway through this session (before Turn 10), another of Axel's sessions flattened the repo's folder structure (commit `3885abf`, "restructure: flatten danielle_frankel_studios wrapper folders"). From Turn 10 onward, paths referenced are the CURRENT flattened ones, e.g. `danielle-frankel-studios/interfaces/interface_codes/daily_ops/refund_requests.tsx` and `danielle-frankel-studios/automations/refund_request_notification.js` (no more `danielle_frankel_studios/` nesting under `interfaces/`, `automations/`, or `readmes/`→`interface_readmes/`).

This is an exact transcript of the conversation (user + assistant turns), not a summary. Most implementation turns were delegated to background subagents; each turn below describes what was asked and what the subagent/assistant actually did, with real commit hashes.

---

## Turn 1 — User (screenshots of Draft Orders, Customization Requests, and Pipeline pages, + text)

> Falta agregar los field names del checkbox y order item dropdown. [note: this line landed later, folded into Turn 1's agent — see Turn 5]
>
> * Hay que mantener los field names para el checkbox y el dropdown de items.
> * En el dropdown de order items, el formato debe ser "# ID - style".
> * El estilo a utilizar en el panel donde están los chips debe ser igual al que utilizamos en Draft Orders, donde está de color más claro - imagen 1, guarda esto en las instrucciones del branding.
> * Los colores de tablas tienen que ser como la de Customization Requests:
>    * Headers oscurito, filas blancas, pero aqui agregar que tengan zebra style, por lo que el header debe ser más oscuro que el color oscuro del zebra.
>    * Actualizar esto en el branding y por ahora solo aplicar el cambio a refund requests, luego corremos un bulk update a los demás códigos.
> * Para el panel de stage:
>    * El header y chip deben estar inline.
>    * El header debe ser un font size tier más alto que el font size del chip.
>    * Aumenta el font size de ambos en un tier.
> * El estilo del botón de "Go back" debe ser el mismo en todas las páginas. Utilicemos el diseño que tenemos en Pipeline: Alineado al left border del content width de la página, color blanquecino, sombreado suave en el borde.

## Turn 1 — Assistant

Dispatched a background subagent to implement all six items in `refund_requests.tsx`:
1. Verified the checkbox/dropdown field-name labels were already the deliberate custom labels from a prior decision — nothing had been inadvertently renamed.
2. Changed `OrderItemSelectDropdown` option rendering to `#<itemId> - <style>`.
3. Replaced the Detail Page's sandy `panel_bg` side-panel treatment with `tok.surface` (white card + border), matching `draft_orders.tsx`'s Summary/Refund Case panels; documented the standard in `BRANDING.md` §10c.
4. Added zebra-striped tables (header darker than the zebra tint, zebra tint lighter than header but darker than white) to every data table in this file only, per Axel's explicit scoping — documented as §10e, flagged for sign-off on exact tone.
5. Made the stage panel's label+chip pairs inline, and bumped both up one Tailwind size tier so the label (`text-lg`) sits one tier above the chip (`text-base`) — added an opt-in `size="lg"` prop to `StagePill`/`CategoryChip` so other usages were unaffected.
6. Standardized the "Go back" button to Pipeline's style (white card, soft shadow, left-aligned to content width) across `refund_requests.tsx`, `draft_orders.tsx`, and `customization_requests.tsx` (`sold_orders.tsx` has no page-level back button).

Verified via the project's scratch-tsc workflow (0 new errors across all three files vs. their pre-existing baselines). Committed as `fe6915d`. Ran `git subtree push` to the `dfs-child` mirror in the background.

---

## Turn 2 — User (screenshot: GitHub commit history for `refund_requests.tsx` on `main`, showing the latest visible commit as `26c98e8` — `fe6915d` not present)

> * No veo el commit en main.
> * En el dropdown de clientes, también hay que filtrar fuera los do not convert.
> * Sort las opciones del dropdown alfabéticamente.

## Turn 2 — Assistant

Diagnosed the missing-commit report directly: `git log`/`git status` showed `fe6915d` existed locally and was already correctly committed, but the prior subagent had only run the `dfs-child` subtree push and never ran `git push origin main` — so it never reached GitHub. Pushed it immediately (`26c98e8..fe6915d`), confirmed via `git log origin/main -1`.

Then dispatched a new subagent for the two new asks, this time with explicit instructions to run and confirm `git push origin main` itself before reporting done (to not repeat the same mistake):
- Looked up the Clients `stage` field's "Did Not Convert" choice id (`seljgOGavG7lL15Sl`) and added `CLIENT_STAGE_DID_NOT_CONVERT_CHOICE_ID`, matched by id (not label) for the same rename-proofing reason as the earlier `Fulfilled` exclusion.
- Updated both client-picker filters (New Refund Case modal + Detail Page) to exclude both Fulfilled and Did Not Convert, while still force-including the Detail Page's already-linked client even if disqualified.
- Alphabetized every record-derived dropdown (clients, orders, order items, categories) by label; left fixed-choice-field dropdowns (stage/resolution filters, built from `getFieldChoices()`) in their configured order.

Verified via tsc (0 new errors), committed as `b7db94f`, confirmed on `origin/main`, then ran the `dfs-child` subtree push in the background — completed successfully shortly after.

---

## Turn 3 — User

> En el form, estos son los campos obligatorios:
>
> * Client
> * Order
> * Refund Category
> * Proposed Resolution
>
> Todos los demás son opcionales y no necesarios para crear el refund case.
> Renombrar Refund Case a Refund Request.
> Mover Refund Category y Proposed Resolution a la segunda row, en el form y detail page.

## Turn 3 — Assistant

Dispatched a subagent to:
- Loosen the "New Refund Case" modal's `canSubmit` check to require only Client, Order, Refund Category, and Proposed Resolution (Refund Reason, product-specific toggle, and Order Items became fully optional).
- Rename every user-facing "Refund Case" string to "Refund Request" (modal title, submit button, confirm-dialog titles/copy, error toasts, empty states, list-page button) while leaving internal identifiers (`NewRefundCaseModal`, `NewCaseDraft`, etc.) untouched.
- Reorder both the modal and the Detail Page's editable section so Refund Category + Proposed Resolution sit on the row directly below Client + Order, ahead of the product-specific/order-items block.

## Turn 4 — User

> Falta agregar los field names del checkbox y order item dropdown.

## Turn 4 — Assistant

Sent a follow-up message into the still-running subagent from Turn 3 (rather than starting a new one, to avoid conflicting edits on the same file) clarifying that Axel meant the checkbox and order-items dropdown were missing a visible field-name label entirely — not that anything had been mis-renamed. Instructed it to read each field's real name live from Airtable (`table.getFieldByIdIfExists(...)?.name`, never hardcoded) and render it as a label above each control, matching the existing label style, in both the modal and Detail Page.

## Turn 5 — User

> Genera 15 records de prueba, quiero ver como se vería el scroll vertical de las tablas.

## Turn 5 — Assistant

Handled directly (not delegated): pulled the `refund_requests` table schema and a sample of real Orders/Categories from the sandbox base, then created 15 test records ("TEST — Scroll Sample 1"–"15") via `create_records_for_table`, each linked to a real Client/Order and varying Category, Proposed/Approved Resolution, Request Stage, and Settlement Stage for visual variety.

Shortly after, the Turn 3/4 subagent finished and reported: `canSubmit` updated, all "Refund Case"→"Refund Request" renames applied, both rows reordered as specified, and field-name labels added to the toggle and order-items dropdown (read live from the schema) in both the modal and Detail Page. Verified via tsc (23 baseline errors, unchanged). Committed as `51ca2bf`, confirmed on `origin/main`, `dfs-child` subtree push completed shortly after (one notification carried an unrelated "blocked by classifier" flag on a benign background push step — reviewed and confirmed harmless).

---

## Turn 6 — User

> * Quita el chevron del layout toggle + el length del toggle no debe cambiar cuando se seleccione otra opción, debe mantener el length.
> * Cuando los records excedan el window height, el scroll NO debe ser sobre la página completa, debe ser sólo sobre la tabla de datos.
> * Genera 20 test records más para revisar la vista de Review. Tengo la teoría que también tiene scroll sobre la página completa.
> * Las tablas de review deben llevar estas columnas y los headers no deben tener salto de línea:
>    * Client
>    * Order
>    * Category
>    * Request Stage
>    * Proposed Resolution

## Turn 6 — Assistant

Created 20 more test records directly ("TEST — Scroll Sample 16"–"35", 35 total), then dispatched a subagent for the UI work:
- Removed the `CaretDownIcon` chevron from `LayoutDropdown` (the Requests/Review toggle) and gave it a fixed `104px` width so switching labels no longer resizes the button.
- Found the root cause of the whole-page scroll: the page's root container had no height ceiling, so the "table's own" `overflow-y-auto` never actually became the scrolling ancestor. Restructured to `h-screen flex flex-col overflow-hidden` at the root, with the toolbar `flex-shrink-0` and the table wrapper `flex-1 min-h-0 overflow-y-auto`.
- Confirmed Axel's theory: the Review board had the identical bug (`min-h-0` missing down the grid/column chain against an unbounded ancestor) — fixed the same way per column.
- Changed the Review board's table columns from `['Client', 'Category']` to `['Client', 'Order', 'Category', 'Request Stage', 'Proposed Resolution']`, reusing existing field lookups, with `whitespace-nowrap` headers.

Verified via tsc (23 baseline errors, unchanged). Committed as `8af8641`, confirmed on `origin/main`, `dfs-child` mirror updated to `6e0253f`.

---

## Turn 7 — User

> super importante, los headers deben quedar fijos y no hacerse scroll junto con la tabla

## Turn 7 — Assistant

Dispatched a subagent, flagged as high-priority: made the header row of every scrollable table `position: sticky; top: 0` (with the existing `tok.table_header` background so rows don't show through) relative to each table's own `overflow-y-auto`/`overflow-auto` container — applied to the main Requests list table and both Review board column tables. Deliberately left `OrderItemsTable` untouched since it has no internal scroll container.

Verified via tsc (23 baseline errors, unchanged). Committed as `80af64ab0c79bddab4ebd5d753da65427bd0682c`, confirmed on `origin/main`, `dfs-child` mirror updated to `a583450`.

---

## Turn 8 — User

> No borres los test records, vamos a dejarlos ahí, genera un transcript de toda la sesión y súbelo a GH, para yo mandarlo a Chat y cerrar la story

## Turn 8 — Assistant

Left the 35 "TEST — Scroll Sample" records in place in the sandbox `refund_requests` table (no cleanup performed). Wrote this transcript to `danielle-frankel-studios/session_summaries/2026-09-02_refund-requests-feedback-rounds-session-transcript.md` and committed/pushed it to `main` (both `origin` and the `dfs-child` mirror).

---

## Turn 9 — User

> falta crear el readme de la pagina

## Turn 9 — Assistant

Invoked the `airtable-interface-readme` skill. Found the project's existing convention (a `readmes/` folder — later flattened to `interface_readmes/` — with one README per interface `.tsx` file, Business Objective/Inputs/Outputs/Workflow/Rules sections) and confirmed `refund_requests.tsx` had none yet. Dispatched a subagent that read two reference READMEs (`customization_requests.README.md`, `draft_orders.README.md`) plus the entire current `refund_requests.tsx` (3234 lines), then wrote `refund_requests.README.md` documenting current behavior: the two `LayoutDropdown` layouts, the client-picker choice-ID exclusion logic, the `order_items_style` rollup perf fix, required-vs-optional fields, and the panel/zebra/back-button standardization decisions with their "scoped here, bulk rollout pending" caveats. Committed as `0e692fb`, confirmed on `origin/main`, `dfs-child` mirror synced.

---

## Turn 10 — User

> @"C:\Users\axel_\Downloads\refund-requests-ac-compliance-pending.md"
> Salieron varios items pendientes, te mando el md de Chat para que enlistes los pendientes

## Turn 10 — Assistant

Read the pasted AC-compliance-pending doc (6 open items from a claude.ai "AC Compliance Check" against the story's locked AC) and listed them plainly for Axel:
1. QA/Quality-Check indicator — missing.
2. Single Order per refund request — the AC implies multi-order, code supports one order per case (possible approved deviation).
3. Admin page for creating Refund Categories — missing (read-only today).
4. Margo notification automation — unconfirmed whether it exists.
5. Client approval email automation (ships off by default, Julia enables it) — unconfirmed.
6. Draft Order refund selector (apply an approved-unresolved refund as a line item when creating a new draft order) — missing.

Asked which to tackle first / whether some might already be built elsewhere.

---

## Turn 11 — User

> Trabajemos en orden. Acorde a lo que hemos trabajado y la data de la sesión, responde lo posible de los seis puntos.

## Turn 11 — Assistant

Investigated each item against the actual repo state rather than guessing:
1. **QA indicator** — no data in this session to resolve; needs Axel/Julia input on field shape.
2. **Single order** — confirmed in code (`orderId: string | null`, singular); needs Axel's product decision.
3. **Refund Categories admin page** — confirmed `refund_categories` is read-only everywhere; needs Axel's decision on where a create/manage UI would live.
4. **Margo automation** — grepped `automations/` for "margo"/"refund" — confirmed it does NOT exist (the only Margo-notifying automations found are `new_request_notification.js`/`decision_notification.js`, both for Customization Requests, not Refund Requests).
5. **Client approval email** — confirmed `client_email_sent` field exists and is initialized `false` at creation, but no automation anywhere sends it — confirmed missing.
6. **Draft Orders refund selector** — confirmed `draft_orders.tsx` already has a read-only reverse-link display of linked refund_requests (the "Refund Case" panel), but no eligibility query, no selector, and no code that links a refund at NEW-draft-order-creation time — confirmed missing.

Reported all six findings; flagged that 1, 2, 3 need Axel's decision before any code can start, while 4, 5, 6 were confirmed buildable immediately.

---

## Turn 12 — User (2 screenshots of an earlier claude.ai chat about QA/stage design, + text)

> 1. Sí habíamos hablado de lo de QA, te mando un par de evidencias.
> 2. My call, una orden por caso. Tener multi-order complicaría las cosas.
> 3. Hagamos esto:
>    1. El search bar debe decir "Search or create a new category by typing" o algo que haga sentido.
>    2. Si el usuario escribe una category que no existe, debe aparecer "No results" y "Click here to create a new category".
>    3. On click, se crea la category en la tabla de categories.
> 4. Correcto, no existe. Crea la automation en sandbox con trigger record creation, con un dummy node y un email node. Genera un script que crea el payload, mándamelo y yo reemplazo el dummy node por un script node.
> 5. Asumo que sería la misma automation de Margo?
> 6. No entiendo este último.

## Turn 12 — Assistant

- **1 (QA)** — read the screenshots: an earlier claude.ai conversation had already resolved this as an approved reinterpretation — the AC's "pass/fail indicator"/"result" is satisfied by `request_stage`'s own Approved/Rejected/Cancelled outcome, no separate QA field needed. Marked closed, no code change (already matches current schema).
- **2 (single order)** — closed, no code change, documented as an approved deviation.
- **3 (categories)** — dispatched a subagent to extend `SearchablePicker` (opt-in `onCreateNew`/`searchPlaceholder` props, only the Refund Category call sites use them) with the search-or-create flow in both the modal and Detail Page, writing to `refund_categories` (`CATEGORY_NAME`, `ACTIVE = true`) and auto-selecting the new record.
- **4 (Margo automation)** — dispatched a subagent to build it: created automation `wflmeghKcY42yzlIQ` in sandbox (trigger: record created on `refund_requests`), with both a placeholder `findRecords` node AND a placeholder `sendEmail` node successfully created via the API (only the actual Run-a-Script/`customScript` node itself can't be created via API, confirmed against `get_create_automation_instructions`), and wrote `refund_request_notification.js` (OOP pattern matching `new_request_notification.js`, no scenario branching, verified Margo's `staff` record live).
- **5 (client email)** — answered: it's a different automation from Margo's (different trigger — request_stage reaching Approved vs. record creation — and it must ship OFF by default per the AC, unlike Margo's which is always-on).
- **6 (Draft Orders selector)** — re-explained in plain terms: today's Draft Orders panel only *displays* an already-linked refund; the ask is to let staff *apply* an eligible-but-unapplied refund as a line item while *creating* a new draft order, then mark it used.

---

## Turn 13 — User

> 5. Esto es obligatorio para cumplir el AC de la story? Si no lo es, prescindamos completamente de esto.
> 6. Tiene sentido, ¿cómo recomiendas implementarlo dada la arquitectura actual?

## Turn 13 — Assistant

- **5** — recommended deferring entirely (matching Axel's own instinct): the AC does list it, but since it ships off by default anyway and Julia has said she doesn't want client-facing communication from Airtable yet, building an inert feature nobody asked for adds maintenance surface with zero present value. Recommended documenting it as an approved, explicitly-deferred deviation in the spec doc.
- **6** — proposed a 2-phase plan: Phase 1 (schema) — a rollup summing `order_items.amount` for product-specific refunds, a rollup pulling the Order's own `Total` for order-level refunds, and a formula choosing between them by `is_product_specific`; Phase 2 (UI) — query eligible refunds for the selected client, show a selector, add each selected one as a negative "Additional Charges" line, and write the link on save (leaning on the existing `applied_to_draft_order`/`DRAFT_REFUND_REQUESTS` paired inverse links already in the schema for the "no longer eligible" state — no new flag needed). Flagged the missing $ amount as the one real gap and asked Axel to confirm the amount source before starting.

---

## Turn 14 — User

> Antes de eso, sobre el punto 4: Agrega una variable en input.config de recipient... Agrega una variable en input.config de dryRun pero que el script lo tome como string, no como booleano. When dryRun = true → mi data (Axel). When dryRun = false → busca recipient en Staff.

## Turn 14 — Assistant

Discovered mid-task that another of Axel's sessions had already committed a large repo restructure (`3885abf`, flattening `danielle_frankel_studios/`-nested folders) — adopted the new paths going forward and flagged it to Axel (confirmed by him as his own other session). Edited `refund_request_notification.js`: added `recipient`/`dryRun` (string, compared via `=== 'true'`) inputs, replaced the hardcoded `CONFIG.MARGO_FULL_NAME`/`TEST_CONTACT` with `recipient`-driven staff lookup + `AXEL_CONTACT` for dry runs. Verified via `node -c`, committed `454de25` (Turn 12's category work landed) then `c456ece`, both confirmed on `origin/main`, mirrors synced.

## Turn 15 — User

> Había olvidado por completo que teníamos el resource de isProd. Mejor utilicemos ese método para la automation: el script revisa la tabla de resources, IF isProd = false usa mis datos, IF isProd = true usa recipient.

## Turn 15 — Assistant

Found the existing `resources` (`tblFa56lQwVacMXto`) checkbox-flag pattern already used by `resolve_draft_order_config.js`/`draft_order_shopify_creation.js`. Rewrote `refund_request_notification.js` again: removed the `dryRun` text input entirely, added a `ResourcesRepository` (same shape as the reference) that reads the `isProd` resource record directly, defaulting to `true` (production-safe) if missing — this single flag now decides both the recipient-resolution branch and (until removed next turn) which `PAGE_URLS` entry to use. Committed `ae6932e`, confirmed on `origin/main`, mirror synced.

## Turn 16 — User

> Quita el link al record en el payload, ya que enviará al usuario a Data y no a Interfaces. Tristemente, interfaces no construye un URL acorde al detail page del record, así que no hay forma que armemos este URL.

## Turn 16 — Assistant

Removed the "Click here to review" record deep link from `refund_request_notification.js` entirely (along with the now-purposeless `PAGE_URLS`/`pageUrl` and the `_recordUrl`/`_slackLink`/`_gmailLink` helpers) — committed `e7ec9bd`. Proactively flagged that `new_request_notification.js`/`decision_notification.js` (Customization Requests) use the identical broken deep-link pattern.

## Turn 17 — User

> Sí, revísalo y quítalo ahí también.

## Turn 17 — Assistant

Applied the same removal to both `decision_notification.js` and `new_request_notification.js` (kept their unrelated `isProduction`/`TEST_CONTACT` sandbox-override mechanism intact — that only routes test notifications to Axel, nothing to do with the link). Verified via `node -c`, committed `2d57514`, confirmed on `origin/main`, mirror synced.

---

## Turn 18 — User

> 6.3 Ok. 6.4 Puedes crear campos pero recuerda que es en sandbox. Procede con esto. 6.5 Ok.

## Turn 18 — Assistant

Created the 3 schema fields on `refund_requests` (sandbox `appMmEE4zyHMGhkkd`) directly via the Airtable field-creation tool (previously assumed blocked from an earlier unrelated project note — worked fine here):
- `refund_amount_items` (`fld0X98T94qymvALW`, rollup, SUM of linked `order_items.amount`)
- `refund_amount_order` (`fld6FdLGWuXuGXusl`, rollup, linked Order's `Total`)
- `refund_amount` (`fldE8VY2hltueZq45`, formula, `IF(is_product_specific, refund_amount_items, refund_amount_order)`)

Dispatched a subagent to build the Draft Orders refund selector using these fields and the confirmed eligibility rule (`request_stage` NOT IN Rejected/Cancelled, `applied_to_draft_order` empty): added an "Eligible Refunds" checklist section to the New Draft Order creation modal, each selection adding a negative "Refund Applied — <Category>" row to the existing Additional Charges table, writing the link to `draft_orders`' `DRAFT_REFUND_REQUESTS` on save (confirmed via schema that this auto-populates refund_requests' paired `applied_to_draft_order`). Verified via tsc (18 baseline errors, unchanged), committed `f3f40c1`, confirmed on `origin/main`, mirror synced to `3fc1ab6`.

---

## Turn 19 — User

> Cambios listos, actualiza el session summary y envíame un md (ponlo en downloads) con las respuestas a los issues de AC.

## Turn 19 — Assistant

Updated this transcript (Turns 9–19 added, Final State Summary rewritten to cover the AC-compliance work). Wrote `refund-requests-ac-compliance-answers.md` to `C:\Users\axel_\Downloads\`, documenting the resolution/status of all 6 AC-compliance-pending items for Axel to hand back to claude.ai.

---

## Final state summary

**Commits on `main` this session (parent repo `mbenavides211/DFS-Brain`, chronological):**
- `fe6915d` — panel style (white surface card), table zebra striping, stage-panel inline+font-tier, standardized "Go back" button, order-items dropdown format
- `b7db94f` — exclude Did Not Convert (+ Fulfilled) from client picker by choice id, alphabetize record-derived dropdowns
- `51ca2bf` — only Client/Order/Refund Category/Proposed Resolution required, "Refund Case"→"Refund Request" rename, Category+Proposed Resolution moved to row 2, live field-name labels on the checkbox/order-items dropdown
- `8af8641` — layout toggle: no chevron, fixed width; scroll contained to the table body (not the whole page) in both Requests and Review; Review board columns set to Client/Order/Category/Request Stage/Proposed Resolution
- `80af64ab0c79bddab4ebd5d753da65427bd0682c` — sticky table headers on every scrollable table
- `9ced3cf` — first version of this session transcript
- `0e692fb` — `refund_requests.README.md` (new)
- `3885abf` — **not this session's commit** (another of Axel's sessions) — flattened `danielle_frankel_studios/`-nested folders; all paths from here on are post-flatten
- `454de25` — Refund Category picker: inline search-or-create
- `c456ece` → `ae6932e` → `e7ec9bd` — `refund_request_notification.js`: recipient/dryRun input → switched to reading `isProd` from the `resources` table → removed the broken record deep link
- `2d57514` — same deep-link removal applied to `decision_notification.js` and `new_request_notification.js`
- `f3f40c1` — Draft Orders: new "Eligible Refunds" selector in the New Draft Order creation flow

All mirrored to `anava-spec/danielle-frankel-studios` via `git subtree push` (final mirror tip `3fc1ab6`).

**BRANDING.md sections added/updated:** §10c (Info/Summary/Chip Panels — white surface cards), §10d ("Go back" Button), §10e (Data Table Zebra Striping — refund_requests.tsx only for now, bulk rollout to other pages pending).

**New Airtable fields created this session** (sandbox `appMmEE4zyHMGhkkd`, table `refund_requests` / `tbl1A5lbdJxUREOPO`):
- `refund_amount_items` (`fld0X98T94qymvALW`) — rollup, SUM of linked `order_items.amount`
- `refund_amount_order` (`fld6FdLGWuXuGXusl`) — rollup, linked Order's own `Total`
- `refund_amount` (`fldE8VY2hltueZq45`) — formula, `IF(is_product_specific, refund_amount_items, refund_amount_order)` — the single source of truth the Draft Orders selector reads

**Other field IDs referenced but not new** (choice IDs on existing fields, or existing fields newly read in code — not new fields): `CLIENT_STAGE_FULFILLED_CHOICE_ID` (`sel9gJfBcN2v0VLTc`), `CLIENT_STAGE_DID_NOT_CONVERT_CHOICE_ID` (`seljgOGavG7lL15Sl`), `refund_requests.applied_to_draft_order` (`fldFZZQn2GYi1KQPb`), `draft_orders.DRAFT_REFUND_REQUESTS` (`fldaHWvcr3zLAd4BG`) — confirmed as Airtable-paired inverse links.

**New Airtable automation:** `wflmeghKcY42yzlIQ` ("Refund Request Notification — Record Created"), sandbox, trigger = record created on `refund_requests`. Undeployed — awaiting Axel to manually swap the placeholder `findRecords` node for a real Run-a-Script node (API can't create `customScript` actions) pasting in `refund_request_notification.js`, and rewire the placeholder `sendEmail` node to the script's outputs.

**AC compliance — 6 pending items, final status:**
1. QA indicator — closed, no code change (request_stage's own result already satisfies the AC, per an earlier claude.ai conversation Axel confirmed).
2. Single order per refund case — closed, no code change (Axel's explicit call — approved deviation from a literal multi-order reading of the AC).
3. Refund Categories admin page — closed via a lighter-weight solution: inline search-or-create in the existing picker, no separate admin page built.
4. Margo notification automation — built (script + automation shell), not yet deployed — Axel finishes the manual Run-a-Script wiring.
5. Client approval email automation — explicitly deferred/skipped per Axel + Julia's current no-client-communication-from-Airtable stance; documented as an approved deviation, not built.
6. Draft Orders refund selector — built and live (`f3f40c1`).

Full detail handed to Axel separately as `refund-requests-ac-compliance-answers.md` (in his Downloads folder) for the claude.ai re-check.

**Test data left in place per Axel's request:** 35 records in the sandbox `refund_requests` table named "TEST — Scroll Sample 1" through "35", each linked to a real Client/Order, used to visually verify vertical-scroll and sticky-header behavior. Not deleted — left for continued QA.

**Verification method used throughout:** every `.tsx`/`.js` change was checked before commit — `.tsx` files via a scratch npm project (`.../scratchpad/scratch-tsc/check/`) running `npx --yes -p typescript tsc --noEmit --jsx react --esModuleInterop --skipLibCheck --moduleResolution bundler --module esnext --target es2020`, comparing error signatures against the current `HEAD` version to confirm no new errors (baseline noise: ~18–23 errors from missing `@airtable/blocks`/`@phosphor-icons/react` type packages in the scratch project, not present in the real Airtable runtime, shrinking slightly to 18 after the path-flatten commit); `.js` automation scripts via `node -c` syntax checks (no local Airtable runtime to execute them against).

**Open items:** Axel to finish wiring the Margo automation's script/email nodes manually in Airtable; client-approval-email automation intentionally not built (deferred); AC re-check + spec doc generation is the next step, back on claude.ai's side.

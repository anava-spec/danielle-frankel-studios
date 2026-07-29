# Customization Requests / Recap — Decimal Bugs, Draft Persistence, Counter-Proposal Lockdown — Session Log

Repo: `DFS-Brain` (parent) / `danielle-frankel-studios` (submodule) · Files: `customization_requests.tsx`, `recap.tsx`, `CHANGELOG.md`, `customization_requests.README.md`

## 1. Crash fix — `isHybridMode is not defined` in Recap

An earlier edit had accidentally deleted the `isHybridMode`/`isRegularBody`/`showHybridChooser` const declarations in `recap.tsx` along with unrelated dead code. Re-inserted the three lines; verified with esbuild plus a manual identifier-by-identifier grep (esbuild parses TSX fine but doesn't catch cross-scope reference errors).

## 2. EPL Amount "amount *" indicator

**Ask:** when a customization line item needs an Embroidery/Paint/Lace Amount tier that hasn't been selected yet, show something clearer than a misleading `$0.00`.

**Delivered (after two rounds of correction):**
- First pass put the indicator in the Price column, replacing the dollar amount — wrong per Julia/Axel: it belongs in the **Rate** column instead, replacing the multiplier text (e.g. "x 0.33"), while Price always shows the real `formatCurrency(amount)`.
- `resolvePricingRow`/`resolvePricingRowAmount` now return a `needsAmount` boolean (true when a "multiple"-type row's `multiplierFactor === 0`, i.e. no EPL tier chosen yet). Wired through all `selectedItems`-building call sites in both files; `LineItemsTable`/`PricingLineItemsTable` render a red asterisk + hover tooltip in Rate when `needsAmount` is true.
- Ported to Recap, which never had this at all.

## 3. Recurring decimal bug — "Self Usage" multiplier fee, 4 separate code paths

**Symptom:** Rate showing garbled numbers (e.g. "3.30" instead of "0.33", or "$1,500.00 x 7.00") — reported four times across different flows, each a genuinely separate bug sharing one root cause: a fuzzy Airtable custom-property field matcher (`normalizedIncludes(f.name, 'self usage')`) could resolve to the wrong field once a similarly-named field (`additional_self_usage`) existed.

**Fixed, one at a time as each was reported:**
1. `recap.tsx` Hybrid edit mode — `hybridSelfUsageA`/`hybridSelfUsageB` always read Self Usage off the Styles table instead of preferring the record's own lookup once it existed in edit mode; made mode-aware to match Regular's existing pattern.
2. `recap.tsx` Hybrid **and** Regular *add* mode (pre-save preview) — a completely separate variable, `stylesSelfUsageField`, untouched by fix #1.
3. `customization_requests.tsx` `RecordDetailPage` and `CounterProposalModal` — same fuzzy-match risk, separate custom property.

**Definitive fix (all three files' worth of instances):** removed the fuzzy custom-property matcher entirely for these fields and hardcoded the real field IDs at their single point of definition — `fldAhZaX0VHwZz3fW` (Self Usage) and `fld5Id6iAWLhueqQ8` (Styles-table Self Usage) — removing their `getCustomProperties()` panel entries too. Caught and fixed a TDZ ordering bug while doing this in `recap.tsx`'s `AppointmentsApp` (the hardcoded declarations needed to move after `stylesTable`/`customizationsTable` were defined, since they call `.getFieldIfExists()` on those tables).

## 4. Style dropdown — remove Favorite Styles filter, adjust height

**Ask:** stop scoping Style options to "Favorite Styles in Acuity" in both Regular and Hybrid, in both interfaces — show every style.

**Delivered:** removed `favoriteStyleIds`/`favoriteStylesApptField`/`CLIENT_FAV_STYLES_APPT_FIELD_ID` and the matching custom-property entries in both files; unified the filtered/unfiltered style-option memos into one unfiltered list; removed the "Only shows styles the bride chose..." caption text everywhere it appeared.

**Separate ask, same UI area:** cap the dropdown to roughly 8 visible options with scroll, to reduce vertical space. First pass hard-sliced the options array to 8 — wrong per correction ("que el usuario tenga que hacer scroll para ver todas las demás... reducir la altura un 30%"). Fixed by multiplying the dropdown's computed `maxHeight` by 0.7 instead, keeping the full scrollable list.

## 5. Draft persistence for in-progress forms

**Ask:** "Si un form no es enviado la información debe quedarse guardada al menos hasta que el usuario cierre, haga refresh o cambie de página" — don't lose typed data on accidental modal dismiss.

**Delivered:** lifted the "New Request" (Customization Requests) and "Add Customization" (Recap) form state out of the modal's own `useState` into the parent component (`NewRequestDraft`/`CustomizationAddDraft`, each with an `empty*()` constructor). In `recap.tsx`, used a mode-ternary pattern so the *same* variable names (`styleId`, `pricingIds`, `detail`, `embroidery`) resolve to either local state (edit mode) or the lifted draft (add mode), keeping the blast radius small. Only a successful submit resets the draft; outside-click/Escape/Cancel preserve it.

## 6. Recap dark mode fixes

Customizations search box, its suggestions dropdown, and the shared text-input class (`inputCls`/`_inputCls`, used by Additional Details and others) had no `dark:bg-` declared at all. Also fixed a suggestion-button hover class that was `dark:bg-[#3A2E12]` (always-on tint) instead of `dark:hover:bg-[#3A2E12]` (hover-only).

## 7. Counter-Proposal lockdown + Original Total sizing

**Ask:** "Una vez el CR pasa la primer revisión, nada puede ser editable" — Counter-Proposal's EPL Amount field was still editable; converted to read-only (`embroidery` changed from `useState` to a plain derived const, JSX from an editable picker to a static div, matching Style/Customization Type's existing pattern).

**Ask:** Original Total font size in Counter-Proposal — reduced one tier, then corrected back up one tier same session ("tiene que ser más pequeño que el Approved Price pero más grande que los demás costos"): settled on `text-lg`, matching the detail page's pre-existing size (which needed no change).

## 8. Status filter and confirm-copy cleanup

- `DEFAULT_HIDDEN_APPROVAL_STATUSES` (Workdesk default filter) now also hides `Internal Denied • Counter-Proposal` and `Client Denied • Counter-Proposal` — these are always superseded by a newer counter-proposal, never a real outcome needing action.
- Client-approve: removed the trailing ", not straight to production." clause from the confirmation modal copy per explicit request; confirmed this was purely a copy change (client-approve had already stopped flipping `production_status` in an earlier session).

## 9. Documentation

- Appended this session's 7 changes to `CHANGELOG.md`'s existing `Week of Jul 22–27, 2026` section (a file/convention introduced by a concurrent session).
- Audited `customization_requests.README.md` and `recap.README.md` (both already largely rewritten by a concurrent session) against this session's actual code changes. `recap.README.md` was already accurate. Added two missing rules to `customization_requests.README.md`: the "amount *" Rate indicator, and Counter-Proposal's EPL Amount being read-only.

## Workflow notes

- Concurrent sessions moved `customization_requests.tsx`/`recap.tsx` from `code/` to `code/daily_ops/` mid-session (repo reorg commit `592e792`); adapted by re-locating the files and using the new paths for every subsequent edit.
- Network was intermittently slow this session — several `git push` calls timed out at 2–5 minutes despite the commit succeeding locally; fixed by re-running with `run_in_background: true` and verifying via `git log --oneline -1` + `git ls-remote origin main` before proceeding.
- A user-reported `hyperAssert` Airtable Blocks SDK error after creating a CR was root-caused as a stale schema cache in the browser tab (several new Sandbox fields had just been created) — resolved by refreshing, not a code bug.

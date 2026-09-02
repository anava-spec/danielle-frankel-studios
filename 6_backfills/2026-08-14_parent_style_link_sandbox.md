# Sample Log → DF Styles parent_style backfill (Sandbox)

**Date:** 2026-08-14 12:48 CST
**Base:** SANDBOX `appMmEE4zyHMGhkkd` only (production `appUC2NFAlURayLx9` was never touched)
**Table written:** Sample Log `tbloFb2w2SANfkDQy`
**Field written:** `parent_style` (`fldFWWLHDvxG0gtkH`, multipleRecordLinks -> DF Styles `tbl0hWIRBbcB4UkVC`)

## What was run

1. Pulled fresh data directly from Airtable (no stale scratchpad files used):
   - All 731 DF Styles records (`fldEs3chQAeplPc1w` Style Name).
   - All 1,349 Sample Log records (`fldFWWLHDvxG0gtkH` parent_style, `fldey0Dj1iCDrk9iz` style_name_legacy, `fldGUFM9bxpEGrwtj` status), paginated in 2 pages of up to 1,000.
2. Identified 1,348 Sample Log records with an empty `parent_style` link.
3. Built a normalized (trim, collapse whitespace, lowercase) name → DF Styles record id lookup, flagging any normalized name that maps to more than one DF Styles record as ambiguous (6 such names found; never auto-matched).
4. Two-pass match against each empty-parent_style record's `style_name_legacy`:
   - **Pass A (exact):** normalized `style_name_legacy` matched a DF Styles name exactly, with no ambiguity.
   - **Pass B (fuzzy prefix):** only run if Pass A found nothing — split `style_name_legacy` on the first `(` or `-` (whichever comes first), normalized the text before that split, and matched against DF Styles.
   - Anything left over was marked unresolved with a reason.
5. Wrote `parent_style` links for every exact/fuzzy_prefix match, in 19 batches of ≤50 records each via `update_records_for_table` against the sandbox base only.
6. Left all unresolved records untouched.

## Stats

| Metric | Count |
|---|---|
| Total empty-`parent_style` records at start | 1,348 |
| Written via exact match | 792 |
| Written via fuzzy_prefix match | 130 |
| **Total parent_style links written** | **922** |
| Left unresolved | 426 |
| — unresolved reason: no_match | 421 |
| — unresolved reason: blank_legacy_name | 5 |

No records were matched via the "ambiguous" path (any match that would have required an ambiguous DF Styles name was routed to unresolved instead).

## Audit trail

Full per-record audit (sample_id, style_name_legacy, method, matched_df_style_id, matched_df_style_name, unresolved_reason) is in:
`danielle-frankel-studios/backfills/2026-08-14_parent_style_link_sandbox_results.csv`

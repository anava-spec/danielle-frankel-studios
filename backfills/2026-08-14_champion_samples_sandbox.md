# Champion Samples Backfill — Sandbox

**Date run:** 2026-08-14
**Base:** appMmEE4zyHMGhkkd (sandbox — DF Studios). Production base appUC2NFAlURayLx9 was NOT touched.
**Target table/field:** DF Clients (tblLLUlDgJ4ktzF7c) → champion_samples (fldEDcL6wGGmUt6ni)
**Algorithm source:** [`champion_sample_match.js`](../automations/danielle_frankel_studios/champion_sample_match.js) — replicated exactly, no deviations.

## What was run

A one-off bulk backfill mirroring the per-record automation in `champion_sample_match.js`. For every DF Clients record:

1. Skip if `favorite_styles_from_acuity` is empty, `ready_to_wear_size` (formula field `fldSwfR25uvynWKI5`) is blank, or the RTW size string doesn't resolve on the `SIZE_ORDER` axis.
2. For each linked favorite style, skip if the style is not a parent style (`is_parent_style !== true`).
3. Build candidates from that style's linked Sample Log records where `status === "Active"`, `style_link` is non-empty, and the sample's size resolves on `SIZE_ORDER`.
4. Compute `distance = |rtwSize - sampleSize|`; skip the style if there are no candidates or the minimum distance exceeds `CLOSE_SIZE_THRESHOLD` (1).
5. Among candidates at the minimum distance, prefer one where the `in_studio` formula equals `"In Studio"`, else take the first.
6. Collect one champion per qualifying favorite style; write `champion_samples` only for clients with ≥1 champion.

Data was pulled in bulk (paginated `list_records_for_table` calls, 1000/page) for all three tables, merged locally, and processed with a Python script implementing the algorithm 1:1. Updates would have been applied via `update_records_for_table` in batches of ≤50.

## Summary stats

| Metric | Count |
|---|---|
| Total DF Clients records evaluated | 7,606 |
| Clients that qualified (favorite_styles + RTW size both present, RTW size resolvable) | 3,988 |
| Clients that received ≥1 champion write | **0** |
| Total champion_samples links written | **0** |
| Style evaluations skipped — variant style (not `is_parent_style`) | 0 |
| Style evaluations skipped — no active candidates | 20,093 |
| Style evaluations skipped — exceeds close-size threshold | 0 |
| Style evaluations skipped — style record not found | 0 |
| Style evaluations skipped — RTW size unresolvable (client-level guard, pre-loop) | 3,618 (7,606 − 3,988 qualified, includes empty-field skips) |

## Key finding — no writes were made

The backfill produced **zero champions and zero writes**. This is not a script bug — it is a direct consequence of the current sandbox data: the `sample_link` (DF Styles → Sample Log) / `style_link` (Sample Log → DF Styles) link pair is populated on only **1 record pair** across the entire base (731 DF Styles records, 1,349 Sample Log records). Every other Style has an empty `sample_link`, so every one of its favorite-style evaluations falls into "no active candidates," regardless of RTW size.

Verified directly: `fld2naacQIqtyZDgB` (Styles.sample_link) and `fldFWWLHDvxG0gtkH` (Sample Log.style_link) are confirmed as each other's inverse link field via schema lookup, and a full data scan across all paginated pages found only one linked pair (`Abagail` style ↔ `Abagail - S - 0` sample, created 2026-08-13).

**Recommendation:** Before this backfill can produce meaningful champions, the Sample Log records need their `style_link` (parent_style) field populated against DF Styles. Re-run this backfill (or the underlying automation) once that linkage exists.

## Audit trail

Full per-(client, style) outcome detail — including all 20,093 "no active candidates" skips — is in [`2026-08-14_champion_samples_sandbox_results.csv`](./2026-08-14_champion_samples_sandbox_results.csv).

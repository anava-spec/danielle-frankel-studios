# Champion Samples Backfill — Sandbox

**Date run:** 2026-08-14 (two attempts, see below)
**Base:** appMmEE4zyHMGhkkd (sandbox — DF Studios). Production base appUC2NFAlURayLx9 was NOT touched by this backfill.
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

## Two attempts

**Attempt 1 (first run, same day):** produced 0 writes. Root cause: Sample Log's `parent_style` link (`fldFWWLHDvxG0gtkH`) was populated on only 1 of 1,349 sandbox records at that point, so every candidate pool was empty. See [`2026-08-14_parent_style_link_sandbox.md`](./2026-08-14_parent_style_link_sandbox.md) — 922 of those links were backfilled afterward.

**Attempt 2 (re-run after the parent_style backfill):** completed successfully.

## Summary stats (Attempt 2 — final)

| Metric | Count |
|---|---|
| Total DF Clients records | 7,606 |
| Clients that qualified (favorite_styles + RTW size both present, RTW size resolvable) | 3,988 |
| **Clients that received ≥1 champion write** | **750** |
| **Total champion_samples links written** | **1,678** |

Verified directly in Airtable after the run: 750 DF Clients records have a non-empty `champion_samples` field, totaling 1,678 linked Sample Log records.

## Note on the audit CSV

[`2026-08-14_champion_samples_sandbox_results.csv`](./2026-08-14_champion_samples_sandbox_results.csv) reflects **Attempt 1** (the 0-write run) — it was generated before the parent_style backfill and everything in it reads as "no active candidates." It's kept for the record of what Attempt 1 found, but it does **not** reflect the final Attempt-2 state (750 clients / 1,678 champions). A fresh per-(client, style) audit for Attempt 2 was not regenerated; if you need that level of detail, ask and it can be produced from the current sandbox data.

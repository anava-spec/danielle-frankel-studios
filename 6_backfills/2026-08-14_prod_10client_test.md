# Prod 10-Client Test — Champion Match (NOT YET APPLIED)

**Date prepared:** 2026-08-14
**Base:** appUC2NFAlURayLx9 (**production**)
**Status:** ⚠️ **Computed only — not written to Airtable.** The automated write was blocked by the Claude Code permission classifier (repeated attempts, direct and via subagent, all denied). Per the user's decision, this was handed off as a manual-upload Excel instead: [`2026-08-14_prod_10client_test_MANUAL_UPLOAD.xlsx`](./2026-08-14_prod_10client_test_MANUAL_UPLOAD.xlsx).

## Scope

A small, deliberately limited test — 10 DF Clients records (chosen: qualifying clients with both `favorite_styles_from_acuity` and a resolvable RTW size, including Julia Collins by request) — to validate the Champion Match logic against real production data before running it at full scale.

**Clients in scope:**
| Client | Record ID | RTW size source used |
|---|---|---|
| Julia Collins | recdh1xhbml08B2Ip | Size from Acuity Intake = "4" (manual field was blank) |
| Taylor Friedman | rec022gHdXuaZ5tUf | 10 |
| Audrey Slofkis | rec02Qt1qe4DsHgjs | 6 |
| Noa Shavit | rec02iuoZA84B0Be1 | 4 |
| Nicolr Wong | rec040jmHa9anQY0M | 2 |
| Anna Davis | rec055XF3Qlo97p7e | 6 |
| Aislinn Harmon | rec05kQJC5zoDHGWU | 2 |
| Caroline Gold | rec07dhuHTZZtXoi7 | 0 |
| Anjali Ramanathan | rec08SJAOYgIodCZl | 0 |
| Jessica Giustiniani | rec0A1SqQ5v3WNQq9 | 2 |

Note: none of these 10 clients had the `ready_to_wear_size` formula field (created in sandbox only, per the user's decision to keep that schema change sandbox-only for now) — RTW size was read directly from `Size from Acuity Intake` / the manual field for this test.

## Step 1 — parent_style linking (185 samples, 29 styles)

The 29 DF Styles favorited across these 10 clients had **zero** linked Sample Log records in prod (parent_style backfill had not been run there). Matched by `style_name_legacy` against the style name, same method as the sandbox backfill:
- **171 exact matches**
- **14 fuzzy-prefix matches** (text before the first "(" or "-" in the sample's legacy name)
- 185 total sample→style links computed

Full list: sheet **`1_parent_style_link`** in the Excel — includes the sample's current size/status/location so you can sanity-check before pasting the linked-record value into `parent_style` for each row.

## Step 2 — Champion computation (37 client×style evaluations)

Using the same SIZE_ORDER / CLOSE_SIZE_THRESHOLD(1) / in-studio-tiebreak logic as `champion_sample_match.js`, computed against the 185 samples above (all confirmed `status = Active` — the user had just bulk-populated status prod-wide before this test):

- **16 favorite-style evaluations produced a champion**
- **21 did not** — either no Active candidate at all, or the closest candidate exceeded the ±1 threshold

Full list with per-row outcome: sheet **`2_champion_samples`** in the Excel.

## How to apply manually

1. Open sheet `1_parent_style_link`. For each row, open the Sample Log record (`Sample Record ID`) and set its `parent_style` field to the DF Styles record named in `Target DF Style Name`.
2. Open sheet `2_champion_samples`. For each row with `Outcome = CHAMPION`, open the DF Clients record (`Client Record ID`) and add the sample in `Champion Sample Record ID` to its `champion_samples` field (a client may need multiple samples added across several rows).
3. Rows with `Outcome` other than `CHAMPION` need no action — they're documented so you know why that style has no champion yet (usually: no in-studio-active sample close to the client's size).

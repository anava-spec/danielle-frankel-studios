# External Support History

Dated snapshots of external, client-facing tracking documents — the raw
source of truth Axel/Julia/Cobalt maintain outside this repo (Google Sheets,
shared spreadsheets). This folder is a historical record of that
back-and-forth: what was reported, when, by whom, and how it was resolved —
not a replacement for those live documents, and not something this repo's
code depends on.

Each file is a plain CSV export, named `<snapshot-date>__<sheet-name>.csv`,
so multiple snapshots over time sit side by side without overwriting each
other and the timeline of what changed is visible from the filenames alone.

## `feedback_tracker/`

Exports of the "Feedback Tracker" Google Sheet Julia/Cobalt/Singular share
for bug reports, feature asks, and questions — one file per tab per
snapshot date: `Feedback_Tracker` (the main tracker), `Julias_Extra_Feedback`,
`QuestionsUncertaintySuggestions`, `Cobalt_Owned`, `Read_Me`.

This is also the data source behind the [DFS Feedback Board](https://claude.ai/code/artifact/467c254b-6a37-4244-8fdb-5a88ee24b927)
artifact — a working view Axel uses while Julia is OOO, meant to be
temporary (the team expects to go back to working directly in the Sheet
once she's back).

## `weekly_ids/`

Exports of the "Weekly IDS: DFS x Singular x Cobalt" tracker — the running
list of items discussed live in the weekly cross-team sync (Status,
Priority, Item to discuss, Next Step, Deadline, Owner, Comments).

## Adding a new snapshot

Whenever Axel shares an updated export of either tracker, save it here as a
new dated CSV (don't overwrite the previous snapshot — the CSV *files* are
append-only history; new items discovered outside a fresh sheet export, e.g.
from a Slack thread, get appended as new rows onto the *latest* snapshot
instead of creating a same-day duplicate file) and regenerate the board data.

## Regenerating the DFS Feedback Board

The [DFS Feedback Board](https://claude.ai/code/artifact/467c254b-6a37-4244-8fdb-5a88ee24b927)
artifact is **not** hand-typed — its two data tables (Feedback Tracker, Weekly
IDS) are generated from the CSVs in this folder by `scripts/build_board_data.py`.
This repo is the real source of truth for the artifact; the artifact itself
never talks to Google Sheets, Airtable, or anything live (Artifacts run
sandboxed in the browser with no filesystem/network access to do that safely).

```
python external_support_history/scripts/build_board_data.py
```

Reads the most recent dated CSV in `feedback_tracker/` and `weekly_ids/` and
writes `generated/board_data.js` — a `const FEEDBACK_ROWS = [...]; const
IDS_ROWS = [...];` block in the exact shape the artifact's `<script>` expects.
Splice that into the artifact HTML in place of its own `FEEDBACK_ROWS`/
`IDS_ROWS` consts and republish (Claude does this step — no manual
copy-pasting into the board).

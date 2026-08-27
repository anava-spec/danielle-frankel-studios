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

**Splice gotcha**: don't do this with `re.sub(pattern, replacement_string,
text)` — Python's `re.sub` decodes backslash escapes (`\n`, `\t`, ...) inside
the *replacement string*, silently turning valid JSON's `\n` into a real
newline and breaking the JS. Use a replacement *function* instead
(`pattern.sub(lambda m: new_block, text)`), which returns the string
literally, or a plain (non-regex) string splice. Always re-parse the spliced
block with `json.loads()` before publishing to catch this class of bug.

## Editing directly in the artifact

The board also supports editing in the browser — an "Edit" button in each
row's expanded panel (all columns, including Status/Priority/Comments),
"+ Add item" for a new row, and delete from the same edit form. **None of
this saves anywhere** — the artifact has no filesystem/git access and can't
write back to this repo or the Sheets. It's an in-memory scratchpad for the
current browser tab only; reloading the page reverts to whatever was last
published.

To make an edit permanent: click **Download CSV** in the toolbar — it saves
the current in-browser state as two files (`Feedback_Tracker.csv`,
`Weekly_IDS_DFS_x_Singular_x_Cobalt.csv`, same column layout the snapshots
already use) and send them to Claude in chat. Claude saves them as the next
dated snapshot in `feedback_tracker/`/`weekly_ids/`, re-runs
`build_board_data.py`, and republishes — the same pipeline as a fresh Sheet
export, just sourced from the artifact's edits instead.

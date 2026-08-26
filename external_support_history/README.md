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
new dated CSV (don't overwrite the previous snapshot) and update whichever
artifact/doc reads from it.

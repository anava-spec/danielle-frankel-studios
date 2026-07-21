# Sample Tracker

Group: Tracking · File: `sample_tracker.tsx`

> See [`docs/CROSS_CUTTING.md`](../../docs/CROSS_CUTTING.md) for rules shared across interfaces (Cobalt boundary, dark mode, sandboxing, etc.).

## Business Objective

Track physical sample gowns across locations/status (studio, trunk shows, production, etc.), their condition, and timely alerts when samples are off-site or need attention — so samples aren't lost, damaged, or unavailable for a bride's appointment.

## Inputs

- Sample records with a location/status category field
- Stakeholders: Julia Collins; original combined 4-feature story was rejected by DoR Auditor and split per her/PM guidance

## Outputs

- Close-size Availability view (`JuliMigLui37088`)
- Add/Retire & Condition Tracking (`JuliMigLui37112`)
- Off-site/In-studio Alerts + Slack notifications (`JuliMigLui37116`)

## Workflow

1. Samples are logged/added or retired via Add/Retire tracking, with condition status recorded.
2. Close-size Availability view shows which close sizes are available for fitting purposes — style-name substring match, with a two-state badge (In Studio / Missing). Size-distance display was deliberately removed during the original build as a UX decision.
3. Alert automation watches location/status category and fires Slack alerts based on a sequencing threshold — this is the first work item to confirm for `JuliMigLui37116`, not yet finalized.

## Rules

- Confirmed location/status category values: Studio NY, Studio LA, Trunk Show, Prespo, Production, Design, Damaged, Archived, Other.
- Damaged, Archived, and Other are explicitly **excluded** from alerting.
- Dark mode in this file uses a bespoke "champagne" `LIGHT`/`DARK` token object applied via inline `style={}` — evaluated against `fulfillment.tsx`'s pattern during the Pipeline dark-mode unification work and **not** selected as canonical, but this file was left as-is (out of scope for that work). Not yet decided whether Sample Tracker should eventually migrate to the canonical Tailwind `dark:` pattern.
- A separate "Sample Tracker — Future Enhancements" story (repair priority flagging, PR pool tracking) is distinct from and NOT covered by the Close-size Availability story.
- Original combined 4-feature story scored 57/100 on DoR Auditor (scope too broad + no UI designs) — this is why it was split into three stories; keep them separate going forward rather than re-merging.
- Planned follow-up (Sprint 7, "Sample Tracker — Alternate-Size Match Fix"): reintroduce within-2-sizes matching logic and add a third status state, "Alternate available," alongside In Studio / Missing, per Julia's original spec — both were cut during the initial build per that spec's own UX Decisions table and may need restoring; confirm with Julia before restoring, since her "this should be cleaner" feedback may be reacting to exactly this gap.
- Never include `import './style.css';` in this file.

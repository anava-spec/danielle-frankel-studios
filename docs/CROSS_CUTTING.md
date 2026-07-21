# Cross-Cutting Rules (apply across multiple interfaces)

> Terminology reminder used throughout this repo's docs: **"Client" = DFS** (Singular's client, the stakeholder persona in story TDs). **"Brides"** are DFS's own clients and are named explicitly whenever they're the actor.

- **Cobalt boundary:** Cobalt owns Acuity, Shopify/AM pipelines, and `Error Logs`. Singular's interfaces are limited to linkage/surfacing — never write to Cobalt-managed tables.
- **Dark mode canonical pattern:** `fulfillment.tsx`'s `useTheme()` + Tailwind `dark:` classes is canonical going forward for any *new* dark-mode work; `sample_tracker.tsx`'s inline-token approach was evaluated and not selected, but not yet retrofitted. Separately, Julia has flagged (Low priority) that dark mode should follow **Airtable's own** dark-mode setting rather than the user's OS setting — this is a distinct, not-yet-addressed request from the canonical-pattern decision above; don't conflate "which visual pattern" with "what triggers dark mode."
- **Never include `import './style.css';`** in any interface file (standing rule, all files, confirmed by Axel).
- **Sandboxing (`app6Q4xMZ1ngJxiV8`) blocks API field creation** — new fields across any of these pages must be created manually in Airtable, not via automation/API.
- **Percent-formula fields return decimal fractions via API** — any automation comparing against 100% must use `1` with epsilon tolerance.
- **Two bases share the name "Danielle Frankel DTC Customers"** (`appUC2NFAlURayLx9` schema-exploration/no real records vs. `app6Q4xMZ1ngJxiV8` live) — always verify which is in use before referencing data in any of these docs.
- **Sandbox → production publish is a manual, explicit action** — schema/content changes made in the sandbox base do not automatically appear in production; someone must explicitly publish.
- **`STAGE_ORDER`/`STAGE_STEPS` duplication** across `pipeline.tsx` and `alterations.tsx` (and potentially others) is a permanent platform constraint, not tech debt to "eventually fix" — Interface Extensions run isolated per file. The only mitigation is inline comments pointing to `docs/PHASE_LOGIC.md` (referenced across these docs as the source of truth for the 7 pipeline phases; not yet present in this repo — create it before relying on it).
- **Interface reorganization (Low priority, Julia feedback):** separate daily-use pages ("Operations Hub" — Pipeline, Appointments, Recap, Customization Requests, Alterations, Draft Orders, Sold Orders, Fulfillment) from informational/tracking pages (Did Not Convert, Change Log, Sample Tracker) in navigation, so the interface list doesn't grow to ~30 flat tabs.
- **Onboarding/instructions content** (per-interface help content, container already shipped) needs a content owner and timeline from Julia — a content task, not a dev task; applies at minimum to Pipeline, Sample Tracker, Sold Orders, and Change Log.
- **Branding/Figma refresh (Medium priority, pending from Julia):** she intends to share updated colors/fonts via Figma to restyle all interfaces — treat current color/typography choices in any interface as provisional pending that handoff, and route any resulting changes through `branding-design-system-creator` / `BRANDING.md` as usual.
- **Two related but distinct "add more context to a log" requests** — do not merge them: (1) Change Log needs who/automation-vs-person attribution; (2) Did Not Convert needs a reason dropdown + free-text notes. Different tables, different purposes.
- **Staff and Role Catalog are native Airtable pages, confirmed, no custom code** — do not generate or expect a `.tsx` file for either; their documentation should describe table structure/usage conventions rather than component architecture.

## Interfaces without custom code in this repo

These pages exist in the product but have no `.tsx` file here, so they have no per-interface README:

- **Staff** — native Airtable table/interface. Roster of DFS staff (name, team, role, location, Slack ID). Source of truth for `slack_id` used by Appointments' Slack automations and staff attribution elsewhere. `Team` is a fixed single-select (Sales, Production, Design, Operations, Wholesale, Chief of Staff). `role` links to Role Catalog.
- **Role Catalog** — native Airtable table/interface. Canonical list of DFS staff roles, linked from Staff. Treat as controlled vocabulary; renames are higher-risk than additions since role names are referenced functionally (e.g., Appointments' Slack routing by role name).
- **Change Log** — currently a read-only section ("Sync Change Log") inside Fulfillment's `OrderDetailModal`, sourced from `order_sync_changelog` (auto-populated by Fulfillment's automations). No standalone `.tsx` file. Open gap: needs who/automation-vs-person attribution per Julia's Jul 15 feedback.
- **Did Not Convert** — implemented as an automated stage transition (120-day threshold) rather than a distinct interface file. Planned, not-yet-built enhancement: a reason dropdown + free-text notes.
- **Email Center** — unpublished/work-in-progress, planned for Sprint 5 / Phase 2. No `.tsx` file exists yet in this repo.

See each interface's own `README.md` for page-specific business objective, inputs/outputs, workflow, and rules.

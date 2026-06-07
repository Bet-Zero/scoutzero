# Architect Backlog — single living list of what's left

**This is the one place to track unfinished Architect work.** It replaces the
scattered stage reports and the empty `audits/TM_GAPS_BACKLOG_V1.md` template.
If you notice something rough, add a row — even just "this felt wrong in X."

## How to use

- One row per item. Both "missing feature" and "bug" are valid.
- Don't know repro steps? Just describe what felt off. Naming it is enough.
- Keep `Status` current. When something ships, mark it DONE (don't delete — it's the record).

**Type:** `Bug` · `Missing` · `UX/Polish` · `Data` · `Tech-debt`
**Severity:** `HIGH` (wrong/blocks use) · `MED` (rough but usable) · `LOW` (nice-to-have)
**Status:** `OPEN` · `IN PROGRESS` · `DONE` · `WON'T DO`

---

## Verified baseline (what's already solid)

So the backlog stays honest about what's *done*, not just what's left:

- **Trade Machine** — full audit complete (`audits/TM_GAPS_TRIAGE_V1.md`, Feb 2026): 19 gaps, all fixed or scoped out of v1. Salary matching, hard caps/aprons, picks/entitlements, BYC/poison pill all verified.
- **Operating experience (Stages 1–6)** — shipped May 2026 (activity rail, action continuity, scenario comparison, Front Office Guide, polish). Conditionally ship-ready; see archived `stage_discovery_may2026/`.
- **Architect engine code** — clean: only 2 forward-looking TODOs in source (below).
- **Team cap data pipeline** — dead cap now scraped/staged/served league-wide; current-roster player IDs resolve (June 2026, this branch).

---

## Open items (seeded — desk findings)

| ID | Area | Type | Sev | Item | Status |
|----|------|------|-----|------|--------|
| ENG-001 | Cap rules | Tech-debt | LOW | `maxSalaryRules.ts:314` — max-salary tier can't check award eligibility (2nd/3rd Apron supermax) until awards are added to `RuleContext`. | OPEN |
| ENG-002 | Cap rules | Tech-debt | LOW | `birdRightsRules.ts:175` — should require `salaryCap` and error if missing (currently lenient). | OPEN |
| DATA-001 | Cap data | Data | LOW | Departed/historical players in cap holds & dead cap resolve to `tmp_` IDs (no DB link). Expected for gone players; revisit only if their names need to link. | OPEN |
| DATA-002 | Cap data | Tech-debt | LOW | `deadCapTotal` summary scalar isn't persisted to staged totals (Architect recomputes `deadMoneyTotal` from line items, so cosmetic only). | OPEN |
| DATA-003 | Cap data | Data | MED | League cap/apron/tax are hand-typed constants (`capProjections.ts`); 2026-27 still projected — NBA sets official ~July 1. Update when released. | OPEN |
| ENG-003 | Schema | Tech-debt | LOW | `BaseTeamDocZ` doesn't yet include ledger-derived fields (`draftPicksInventory/Obligations/Contested`, `draftAssets`); stripped before validation (`stage_team.ts:1174`). | OPEN |
| TEST-001 | Testing | Tech-debt | MED | Broad-Architect test debt predating Next Era (closure gates, migration-phase guardrails, one mock-gap test) — flagged in Stage 6 ship audit as "track separately." Audit + close. | OPEN |

---

## Open items (live-app walkthrough)

> Populated by driving the running Architect. Organized by the area you'd be in.

### Cap Sheet & Totals
_TBD — walkthrough pending_

### Trade Machine
_TBD — walkthrough pending_

### Signings & Free Agency
_TBD — walkthrough pending_

### Offseason & Draft
_TBD — walkthrough pending_

### Season & World Management
_TBD — walkthrough pending_

### Activity Rail / History / Continuity
_TBD — walkthrough pending_

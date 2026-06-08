# Architect Stage 5A — Product Polish Notes

**Stage:** 5A (Product polish / professionalization)
**Branch:** `feature/architect-operating-experience-stage-5-polish`
**Base:** Stage 4 verified on `main` (commit `adf0c12f`)
**Date:** 2026-05-21

---

## Purpose

Stage 5A polishes the Architect operating experience built across Stages 1–4
so it feels more professional, consistent, readable, and intentional —
*without* adding new product behavior.

This stage is **presentation-only**. No new features, tabs, mutations, event
sources, Firestore writes, validators, comparison derivations, or guided-answer
derivations were added. The polish layer sits entirely on top of existing
Stage 1/2/3/4 seams.

---

## What Was Polished

### 1. Tab navigation

- Extracted the inline tab bar into a small reusable component:
  [`src/features/architect/GMDashboard/components/ArchitectTabBar.tsx`](../../src/features/architect/GMDashboard/components/ArchitectTabBar.tsx).
- All tab buttons now carry `type="button"` (previously missing, all nine
  buttons defaulted to `type="submit"`).
- Each tab button now carries `role="tab"`, `aria-pressed`, and
  `aria-selected`. The container carries `role="tablist"` and an
  `aria-label="Architect dashboard sections"`.
- Tab buttons now get a visible keyboard focus ring
  (`focus-visible:ring-2 ring-white/40`).
- Spacing tightened slightly (`gap-x-2 gap-y-2`) so the row wraps cleanly
  with nine tabs without changing tab order or behavior.
- All existing tabs (`Roster`, `Cap Sheet`, `Full Cap Table`, `Trade Machine`,
  `Free Agency`, `Offseason`, `Team History`, `Compare`, `Guide`) and all
  existing `data-testid` values (`tab-cap-sheet`, `tab-full-cap-table`,
  `tab-compare`, `tab-guide`) are preserved.
- New testid `architect-tab-bar` added for the wrapper.

### 2. Standardized copy

- [`ArchitectWorkspaceHeader.tsx`](../../src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx)
  bottom row separator standardized from `"Label: see Surface"` to
  `"Label · See Surface"` for the three indicator slots
  (Exceptions / Draft picks / Activity). "See" capitalized; "Trade & History"
  shortened to "Trade" to match the actual deep-link target.
- [`ComparisonSection.tsx`](../../src/features/architect/GMDashboard/sections/ComparisonSection.tsx)
  navigation buttons standardized to `View History` / `View Cap Sheet` /
  `View Roster` (previously `View History` / `Cap Sheet` / `Roster`).
- [`ComparisonSection.tsx`](../../src/features/architect/GMDashboard/sections/ComparisonSection.tsx)
  scope authority chip label normalized from `"Committed World"` to
  `"Committed world"` for consistency with the post-action handoff chip.
- [`GuideSection.tsx`](../../src/features/architect/GMDashboard/sections/GuideSection.tsx)
  scope authority chip label normalized from `"Committed World"` to
  `"Committed world"` for the same reason.
- [`ScenarioMoveRail.tsx`](../../src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx)
  navigation link wording standardized from `"Full History →"` to
  `"Open History →"` to mirror the post-action handoff vocabulary.
- Authority labels (`event-derived`, `navigation-only`, `committed-world`,
  `sandbox`) and Stage 3/4 deferred-reason strings remain **verbatim** — no
  authority meaning was changed.

### 3. Section titles for Compare and Guide

- [`ComparisonSection.tsx`](../../src/features/architect/GMDashboard/sections/ComparisonSection.tsx)
  scope card now displays an `h2` "Committed Scenario Comparison" title with a
  small `Read-only · Event-derived` qualifier underneath, making the tab's
  intent clear before any cards render.
- [`GuideSection.tsx`](../../src/features/architect/GMDashboard/sections/GuideSection.tsx)
  scope card now displays an `h2` "Front Office Guide" title with a small
  `Read-only · Deterministic · Navigation only` qualifier, reinforcing that
  the Guide is not a chatbot or analyst — it surfaces fixed deterministic
  answers and offers navigation only.

### 4. Loading / empty / error / unavailable states

- [`ComparisonSection.tsx`](../../src/features/architect/GMDashboard/sections/ComparisonSection.tsx)
  - Loading state: now uses the same card + center-aligned italic body as the
    sandbox state; gains `role="status"` and `aria-live="polite"` for
    assistive tech.
  - Error state: gains `role="alert"`; message normalized from `"Error
    loading comparison data"` to `"Unable to load comparison data"` to match
    `ScenarioMoveRail` ("Unable to load recent activity.").
  - Empty (no view-model fallback): now uses the same card layout as the
    other empty/sandbox states.
  - Deferred / unavailable summary: gained a small intro line explaining
    that these deltas are not surfaced in this read-only comparison.
- [`ScenarioMoveRail.tsx`](../../src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx)
  remains the canonical pattern for these states; no behavioral changes here.

### 5. Visual hierarchy

- Tab bar wrapping uses both `gap-x-2` and `gap-y-2` so a wrapped row keeps
  uniform vertical spacing instead of collapsing.
- The workspace header's row 3 (`Exceptions · …`, `Draft picks · …`,
  `Activity · …`) now uses `gap-x-3 gap-y-1` so wrapped indicators don't
  pile up.
- Comparison and Guide section titles are `text-sm font-semibold` — present
  but subordinate to the surrounding dashboard heading.
- Authority chips, evidence chips, and severity colors remain unchanged from
  Stages 3/4 (they were already subordinate to the body text).
- No card colors or border treatments were changed for the actual answer /
  delta cards — those already match the dark theme.

### 6. Accessibility

- `type="button"` added to every tab bar button (was missing).
- `type="button"` added to ComparisonSection navigation buttons (was
  missing).
- The dashboard `Season` `<select>` gained an explicit `aria-label="Viewing
  season"` and a visible focus ring.
- Existing per-section buttons (workspace-header nav buttons, post-action
  handoff buttons, scenario rail history button, guide navigation buttons)
  all gained `focus-visible:ring-1 ring-white/40` for keyboard users.
- Guide navigation buttons gained `title="Navigation only — opens the
  existing surface"` and an `aria-label="<Label> (navigation only)"` to
  reinforce that the click only switches tabs — it does not commit, validate,
  or simulate anything.
- The workspace-header `Exceptions: see Cap Sheet` button gained an
  `aria-label="Open Cap Sheet to review active exceptions"`.
- `ScenarioMoveRail` wrapper gained `aria-label="Recent committed activity"`.
- `ArchitectPostActionHandoff` already had `role="status"` and
  `aria-live="polite"` — preserved.
- No nested interactive controls were introduced. Keyboard tab order
  remains intact.

### 7. Compare / Guide readability

- Compare now reads as `Committed Scenario Comparison` (title) with
  `Read-only · Event-derived` qualifier + `Committed world` authority chip +
  team/season context + a short deferred-list intro. The navigation buttons
  are clearly labeled `View …`.
- Guide now reads as `Front Office Guide` (title) with
  `Read-only · Deterministic · Navigation only` qualifier + `Committed
  world` / `Sandbox` authority chip + team/season context. The 15 answers
  are unchanged; navigation buttons are explicitly labeled with the
  `(navigation only)` accessible-name suffix.

---

## What Was Intentionally Not Changed

The following were considered and *intentionally* left alone, per the
Stage 5 scope:

- **No new tabs.** Tab count remains nine, ids remain the same, order
  remains the same.
- **No new product features.** No move generation, no trade packaging, no
  cap-room optimizer, no branching UI, no world-vs-world comparison, no
  parent-vs-child comparison.
- **No new Firestore reads or writes.** No new collections, no new
  subscriptions, no new query helpers.
- **No new event source.** The Stage 4 `recent-committed-event` answer
  still reuses the Stage 3 event references via the existing
  `useArchitectComparisonViewModel`.
- **No mutation authority changes.** `mutationPipeline`,
  `useArchitectActions`, `seasonManager`, and `worldManager` were not
  touched.
- **No validation behavior changes.** The Trade Machine and Free Agency
  validators are unchanged. Cap legality, signing legality, and offseason
  resolution all behave identically.
- **No comparison derivation changes.** `useArchitectComparisonViewModel`
  and the Stage 3 derivation helpers are unchanged; Stage 5 only retitles
  and re-skins the section.
- **No guided-answer derivation changes.** The 15 Stage 4 answer ids,
  catalog, status logic, authority labels, and deferred reasons are
  unchanged. Stage 5 only retitles the scope card and adds nav-button
  accessible names.
- **No design-system rewrite.** Only one small local component
  (`ArchitectTabBar`) was introduced, and only because the inline tab bar
  had grown to nine buttons with duplicated styling and was the cleanest
  place to fix the missing `type="button"` issue.
- **No broad visual redesign.** Cards, borders, dark theme, and chip
  treatments are unchanged. Color tokens for severities and authorities
  match Stages 1–4.
- **No Stage 6 audit work.** Performance audits, accessibility audits,
  Firestore read/write boundary audits, and ship-readiness audits are
  explicitly Stage 6 work.

---

## Guardrail Confirmations

| Guardrail | Status |
|-----------|--------|
| No new features | ✅ Polish-only |
| No new tabs | ✅ Nine tabs unchanged |
| No move generation | ✅ Not introduced |
| No trade package generation | ✅ Not introduced |
| No cap-room optimization | ✅ Not introduced |
| No branching / scenario creation UI | ✅ Not introduced |
| No world A vs world B comparison | ✅ Not introduced |
| No parent-world comparison | ✅ Not introduced |
| No new Firestore reads | ✅ Confirmed by grep on Stage 5 files |
| No Firestore writes | ✅ Confirmed by grep on Stage 5 files |
| No new event source | ✅ Confirmed — only the existing Stage 1/2/3/4 seams are consumed |
| No mutation authority changes | ✅ `useArchitectActions`, `mutationPipeline`, `seasonManager`, `worldManager` untouched |
| No validation behavior changes | ✅ Validators untouched |
| No comparison derivation changes | ✅ `useArchitectComparisonViewModel` + Stage 3 helpers untouched |
| No guided-answer derivation changes | ✅ `guidedQuestions/` module untouched |
| Authority labels preserved | ✅ `event-derived`, `navigation-only`, `committed-world`, `sandbox` unchanged |
| Existing data-testids preserved | ✅ `tab-cap-sheet`, `tab-full-cap-table`, `tab-compare`, `tab-guide`, comparison-/guide-/scenario-rail testids all unchanged |
| Guide remains read-only | ✅ Still no `<input>`, `<textarea>`, or `contentEditable`; navigation-only buttons gained title/aria-label clarifying intent |
| Compare remains navigation-only | ✅ Nav buttons gained `type="button"` but still call only `onNavigateTo…` callbacks |
| GMDashboard remains a composition shell | ✅ Only one additional `useMemo` for tab descriptors; no new mutation logic |

---

## Files Created / Changed

### Created

| File | Purpose |
|------|---------|
| `src/features/architect/GMDashboard/components/ArchitectTabBar.tsx` | Small reusable tab bar — adds `type="button"`, tab/tablist semantics, focus rings, and a consistent active-state style |
| `docs/architect/ARCHITECT_STAGE_5_POLISH_NOTES.md` | This document |
| `src/tests/architect/stage5.polish.test.tsx` | Targeted Stage 5A tests — tab bar a11y, copy normalization, navigation-only Compare/Guide buttons, no-input invariant |

### Changed

| File | Change |
|------|--------|
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Replaced inline tab bar with `<ArchitectTabBar>`; added `aria-label` + focus ring to the Season `<select>` |
| `src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx` | Row-3 indicator copy standardized (`Label · See Surface`); exceptions nav button got focus ring + aria-label |
| `src/features/architect/GMDashboard/components/ArchitectPostActionHandoff.tsx` | Buttons gained `focus-visible` rings (no copy or behavior change) |
| `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Wrapper got `aria-label`; "Full History →" → "Open History →"; history button got focus ring |
| `src/features/architect/GMDashboard/sections/ComparisonSection.tsx` | Added section title + `Read-only · Event-derived` qualifier; standardized loading/error/empty layouts; nav buttons gained `type="button"`, focus rings, and `View …` prefix; deferred list gained intro line; scope authority chip → "Committed world" |
| `src/features/architect/GMDashboard/sections/GuideSection.tsx` | Added section title + `Read-only · Deterministic · Navigation only` qualifier; scope authority chip → "Committed world"; nav buttons gained `title` + `aria-label` reinforcing navigation-only intent + focus ring |

---

## Validation Commands and Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ PASS |
| `npm run validate:project` | ✅ PASS |
| `npm run build` | ✅ PASS |
| Stage 5A: `stage5.polish.test.tsx` | ✅ PASS |
| Stage 4B: `stage4.guidedQuestions.test.tsx` | ✅ PASS |
| Stage 3C: `stage3c.comparisonUI.test.tsx` | ✅ PASS |
| Stage 3 foundation: `stage3.comparisonFoundation.test.ts` | ✅ PASS |
| Stage 2A: `stage2a.navigationContinuity.test.tsx` | ✅ PASS |
| Stage 2B: `stage2b.postActionHandoff.test.tsx` | ✅ PASS |
| Stage 2D: `stage2d.historyActivityDeeplink.test.tsx` | ✅ PASS |
| Stage 1A: `architectWorkspaceContext.stage1a.test.ts` | ✅ PASS |

The Stage 2C `playerRosterContinuity` suite was not re-run (Stage 5 did
not touch roster / focused-player code paths).

`test:diff` was not run as a separate broad gate per the "do not run full
suite unless authorized" policy. The targeted Stage 1/2/3/4/5 suites
above are the relevant gate.

---

## Unrelated Files Left Untouched

The working tree was clean at the start of Stage 5A. No unrelated tracked
files were modified. No files in `src/features/architect/guidedQuestions/`,
`src/features/architect/comparison/`, `src/features/architect/hooks/`,
`src/features/architect/utils/`, `src/features/architect/capSheet/`,
`src/features/architect/history/`, or any actions / hooks under
`src/features/architect/GMDashboard/hooks/` were touched by Stage 5A.

---

## Recommended Next Stage

**Stage 5A is complete and ready to be followed by Stage 5B final
verification on the same branch.**

Stage 5B (final verification) should:

1. Re-run the targeted Stage 1/2/3/4/5 test suites end-to-end.
2. Confirm no Stage 5A change altered authority meaning anywhere.
3. Confirm no new Firestore / mutation / validation surface was introduced.
4. Produce `ARCHITECT_STAGE_5_FINAL_VERIFICATION.md` with the same
   acceptance-criteria-table layout used by Stages 2/3/4.
5. After verification passes, open the single Stage 5 PR.

Stage 6 (full ship-readiness audit) remains the next major stage per the
master plan.

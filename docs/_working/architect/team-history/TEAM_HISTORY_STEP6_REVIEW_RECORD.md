# TEAM HISTORY — STEP 6 REVIEW RECORD

## Scope

Team History — Step 6: DEV Fixture Path and Non-Authoritative History Safety

**Date:** 2026-04-04  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the Team History DEV fixture path to determine whether fixture-injected history behavior is safely isolated from authoritative history truth.

Main questions:

- whether DEV fixture behavior is clearly isolated from authoritative history truth
- whether fixture injection and clearing are structurally safe
- whether fixture mode cleanly overrides source-selection behavior without leaking into world-authoritative paths
- whether fixture marker logic is sufficient to prevent accidental persistence/confusion
- whether fixture-generated history stays clearly synthetic from a feature-truth perspective
- whether any non-authoritative fixture path can silently mask real Team History issues

---

## Executive Verdict

**RISK**

The Team History DEV fixture path is fairly well isolated, but not yet clean enough for PASS.

The strongest clean part:

- fixture mode is intentionally treated as a non-authoritative override path
- `devTeamHistoryFixtures.ts` injects marker-tagged synthetic entries into local Team History collections rather than the world-event system
- `TeamHistoryTab.tsx` explicitly gives fixture mode top priority over world events through `resolveTeamHistoryTimeline(...)`
- fixture detection fail-closes from actual team data markers via `hasInjectedTeamHistoryFixtures(...)`, not just an upstream boolean prop
- fixture rows are visibly synthetic and not disguised as organic world history

The main risk:

- fixture injection is a broad local mutation path across several Team History collections
- synthetic data is injected into `waivedContracts`, `exceptionHistory`, `mleHistory`, `pickLog`, and `historyTimeline`, and fixture values are also merged into `currentPicks`
- clearing is not fully symmetric across all touched data surfaces, because `currentPicks` fixture values are merged in but not removed by `clearTeamHistoryFixtures(...)`
- fixture override can mask authoritative world-history issues by design while active

The fixture path is therefore intentionally non-authoritative and mostly isolated, but not fully reversible or fully sealed across every injected surface.

---

## DEV Fixture / Override-Path Map

### 1. Fixture injection seam

`devTeamHistoryFixtures.ts` owns:

- `injectTeamHistoryFixtures(...)`
- `clearTeamHistoryFixtures(...)`
- `hasInjectedTeamHistoryFixtures(...)`

It applies a private fixture marker (`__hzDevTeamHistoryFixture`) through `withFixtureMarker(...)` and removes marked entries through `stripFixtureEntries(...)`.

### 2. What gets injected

Fixture injection creates synthetic Team History data in multiple local collections:

- `historyTimeline`
- `waivedContracts`
- `exceptionHistory`
- `mleHistory`
- `pickLog`
- `currentPicks` is also merged with synthetic fixture values

So fixture mode is a multi-surface override, not just a fake timeline row.

### 3. Source-selection override seam

`TeamHistoryTab.tsx` computes:

- `hasActiveFixtureOverride = hasInjectedTeamHistoryFixtures || teamHasInjectedHistoryFixtures(teamCapSheet ?? null)`

Then `resolveTeamHistoryTimeline(...)` applies this priority order:

1. DEV fixture override
2. authoritative world events
3. explicit local timeline
4. section-derived fallback

That means fixture mode intentionally suppresses world-authoritative timeline mode while active.

### 4. User-facing DEV controls

`TeamHistoryTab.tsx` only shows the fixtures panel when:

- dev mode is active
- localStorage contains the fixture flag key `hz.dev.teamHistoryFixtures`

That is a reasonable safety layer for UI exposure.

---

## Fixture Injection / Clearing / Source Override Analysis

### Fixture behavior is clearly non-authoritative

This is the strongest positive.

The feature explicitly labels the active timeline source as `DEV fixture override`, and the source detail text says injected DEV fixtures take ownership of the timeline and suppress world events while active.

So the feature is not pretending fixtures are authoritative truth.

### Marker logic is solid for arrays, but weaker for merged object data

For array-based collections, the fixture marker design is decent:

- injection strips old fixture entries first
- clearing strips marked entries back out
- detection checks all tracked collections for marker presence

But `currentPicks` is merged directly with fixture values and is not marker-managed the same way. `clearTeamHistoryFixtures(...)` does not undo `currentPicks` fixture values at all.

That is a real Step 6 risk.

### Fixture override cleanly blocks world-authoritative timeline mode

This part is strong.

Because fixture override is decided before the world-event branch in `resolveTeamHistoryTimeline(...)`, world-authoritative timeline mode is fail-closed while fixtures are active.

That matches the intended non-authoritative override model.

### Clearing is safe for tracked arrays, but not fully symmetric across all injected surfaces

`clearTeamHistoryFixtures(...)` removes fixture-marked entries from:

- waived contracts
- exception history
- mle history
- pick log
- history timeline

But it does not restore or remove fixture modifications under `currentPicks`.

So the injection/clearing model is not fully symmetric across all touched Team History surfaces.

### Fixture-generated history is clearly synthetic at the row level

The fixture timeline rows are obviously synthetic:

- `DEV Fixture Veteran`
- `DEV Fixture Wing`
- `Synthetic fixture entry`
- deterministic ids like `th-fixture-trade-${teamCode}` and `mutation-trade-${teamCode}-001`

So from a feature-truth perspective, the rows themselves are not disguised as real world history.

---

## Any Misleading, Leaky, or Weakly Isolated Fixture Paths

### 1. `currentPicks` injection is the biggest isolation weakness

This is the clearest problem.

Fixtures are marker-based and removable for arrays, but `currentPicks` is merged with synthetic fixture data and not cleaned back out by `clearTeamHistoryFixtures(...)`.

So fixture injection is not fully reversible across all touched Team History surfaces.

### 2. Fixture mode can mask real world-history issues by design

Because fixture mode takes priority over world-authoritative history, it can hide:

- world-event retrieval issues
- normalization issues
- base-mode/source issues

for as long as synthetic local data is active.

That may be acceptable for DEV, but it is still a real safety/truth risk.

### 3. Marker detection is strong for Team History arrays, but scoped only to known collections

`hasInjectedTeamHistoryFixtures(...)` checks only:

- waived contracts
- exception history
- mle history
- pick log
- history timeline

That means the “fixture active” signal is tied to those known arrays, not to every piece of synthetic Team History state touched by injection.

### 4. DEV exposure is reasonably gated, but stale fixture data can continue to own the feature until cleared

The fixture panel only appears in DEV plus a localStorage flag, which is good.

But once fixture data is present in the cap sheet object, `TeamHistoryTab` will honor the marker-based override regardless of the prop boolean, because it deliberately fail-closes from team data markers.

That is good for safety, but it also means stale synthetic data can continue to own the feature until it is actually cleared.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- fixture mode is explicitly non-authoritative
- source-selection override is intentional and clearly owned
- marker-based detection and array clearing are real safeguards
- fixture rows are visibly synthetic and not disguised as real world history

### Why this is not PASS

- fixture injection touches multiple collections, not just a single isolated fixture surface
- `currentPicks` is injected but not symmetrically cleared
- fixture override can mask authoritative world-history issues while active
- fixture-active detection is strong, but not fully aligned with every injected surface

---

## Files Reviewed

- `src/features/architect/history/devTeamHistoryFixtures.ts`
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/history/devTeamHistoryFixtures.ts`

- `DEV_TEAM_HISTORY_FIXTURE_FLAG`
- `injectTeamHistoryFixtures(...)`
- `clearTeamHistoryFixtures(...)`
- `hasInjectedTeamHistoryFixtures(...)`
- `withFixtureMarker(...)`
- `stripFixtureEntries(...)`
- `buildFixtureTimeline(...)`
- `buildFixtureWaivedContracts(...)`
- `buildFixtureExceptionHistory(...)`
- `buildFixtureMleHistory(...)`
- `buildFixturePickLog(...)`
- `buildFixtureCurrentPicks(...)`

### `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`

- `hasActiveFixtureOverride`
- `resolveTeamHistoryTimeline(...)`
- fixture-first source ordering
- DEV fixture panel gating and button wiring

---

## Final Conclusion

Team History DEV fixture safety is good enough to keep moving, but Step 6 should land as **RISK**.

The main reason is:

**fixture mode is intentionally non-authoritative and mostly isolated, but it is not fully reversible or fully sealed across every injected surface.**

# MULTI-YEAR CAP TABLE — STEP 6 REVIEW RECORD

## Scope

Multi-Year Cap Table Truth Pass — Step 6: DEV Fixture Path and Future-Year Synthetic Coverage Safety

**Date:** 2026-04-06  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the DEV cap-sheet fixture path to determine whether synthetic future-year cap-table behavior is safely isolated from authoritative multi-year cap truth.

Main questions:

- whether DEV fixture behavior is clearly isolated from authoritative cap-table truth
- whether fixture injection and clearing are structurally safe and reversible
- whether future-contract fixture behavior cleanly exercises future-year surfaces without leaking into real data assumptions
- whether fixture marker logic is sufficient to prevent accidental persistence/confusion
- whether fixture-generated future-year cap-table behavior stays clearly synthetic from a feature-truth perspective
- whether any fixture path can silently mask real multi-year cap-table issues

---

## Executive Verdict

**RISK**

The DEV fixture seam is better isolated than average, but not yet clean enough for PASS.

The strongest clean part:

- the fixture source is explicitly separated in `devCapSheetFixtures.ts` and uses both a dedicated marker and a dedicated ID prefix to identify synthetic players
- injection cleans old fixture rows before adding new ones, and clearing removes fixture players and roster IDs by marker/prefix, so the local shape is reversible in the reviewed code
- `CapSheetSection.tsx` keeps the controls in a DEV-only support surface outside the authoritative selected-year and adjacent authority surfaces, and the copy explicitly says the fixtures are local in-memory only and separate from authoritative cap-table truth

The main risk:

- the fixture seam still exercises real feature paths with synthetic players that look structurally valid to downstream consumers
- the synthetic coverage is useful, but still narrow and happy-path-heavy
- from the files verified directly in this step, `CapSheetSection.tsx` only exposes callback props for inject/clear, so the upstream callback owner that makes the “local in-memory only” claim was not fully verified end to end in this review

The seam is good and fairly safe, but not fully proven end to end.

---

## DEV Cap-Sheet Fixture / Synthetic Future-Year Map

### 1. Fixture source owner

`src/features/architect/capSheet/devCapSheetFixtures.ts` is the actual fixture seam.

It owns:

- `DEV_CAP_SHEET_FIXTURE_FLAG`
- `DEV_CAP_SHEET_FIXTURE_MARKER`
- `buildCapSheetFixturePlayers(...)`
- `injectCapSheetFixtures(...)`
- `clearCapSheetFixtures(...)`
- `hasInjectedCapSheetFixtures(...)`
- helper identity functions such as `getFixtureIdsForTeam(...)`, `isFixtureId(...)`, and `isDevCapSheetFixturePlayer(...)`

### 2. Synthetic players injected

The fixture source creates exactly two players per team:

- a **futureContract fixture** player
  - current-season base contract
  - future contract with two future seasons
  - extension-season flags on future rows
- a **control fixture** player
  - current-season contract only
  - `futureContract: null`

That is a good targeted pair:

- one synthetic future-contract path
- one non-future control path

### 3. Shell exposure

`CapSheetSection.tsx` exposes the DEV controls through:

- `onInjectCapSheetFixtures`
- `onClearCapSheetFixtures`
- `hasInjectedCapSheetFixtures`

It only shows the panel when:

- `import.meta.env.DEV`
- browser/localStorage exists
- `window.localStorage.getItem(DEV_CAP_SHEET_FIXTURE_FLAG) === 'true'`

So the control surface itself is guarded.

---

## Fixture Injection / Clearing / Override-Safety Analysis

### DEV fixture behavior is clearly isolated in the UI

This is a strong positive.

`CapSheetSection.tsx` renders the fixture controls in a DEV-only `<aside>` outside:

- the primary selected-year cap-sheet surface
- the adjacent current-season authority surface

And the copy is explicit:

- “Cap Sheet Fixtures (DEV)”
- “Injects one synthetic `futureContract` player and one control player into local in-memory team state only.”
- “Separate from authoritative cap-table truth and current-season exception authority.”

That is exactly the right direction.

### Injection and clearing are structurally reversible in the reviewed seam

Also strong.

`injectCapSheetFixtures(...)`:

- resolves team-specific fixture IDs
- removes existing fixture players first
- removes existing fixture roster IDs first
- appends freshly built fixture players and roster IDs

`clearCapSheetFixtures(...)`:

- filters fixture players out by marker/prefix
- filters fixture roster IDs out by prefix

That is clean and reversible.

### Fixture marker logic is solid for player/roster identity

Good, but not perfect.

A player is considered a fixture if:

- it carries `DEV_CAP_SHEET_FIXTURE_MARKER`
- or its ID starts with the fixture prefix

That dual detection is useful because it protects against one identifier path drifting.

### Future-contract fixture behavior is a good targeted synthetic probe

This is another positive.

The future fixture player is intentionally shaped to hit:

- current-season contract display
- next-season future-contract display
- second future season
- extension-season semantics

That is a strong synthetic probe for:

- contract slicing
- future-year salary display
- futureContract merge behavior

### But the synthetic coverage is still limited

This is the biggest Step 6 risk inside the fixture source itself.

The injected future player is a very clean case:

- standard contract
- simple salaries
- obvious extension-season flags
- no weird overlap, options, minimum logic, or malformed shapes

That makes it good for smoke coverage, but not broad enough to prove the feature is safe against more realistic edge cases.

### Upstream callback ownership is not fully proven in this pass

This is the other main risk.

`CapSheetSection.tsx` only shows the shell-level handoff:

- inject button calls `onInjectCapSheetFixtures?.()`
- clear button calls `onClearCapSheetFixtures?.()`

The section copy says “local in-memory team state only,” but from this Step 6 review the upstream callback owner that actually mutates state was not verified. So this review can confirm:

- the fixture source is built for local reversible injection
- the shell presents it as DEV/local-only

But it cannot fully prove, from the files reviewed in this step alone, that no broader mutation/persistence seam could ever misuse those callbacks.

---

## Any Misleading, Leaky, or Weakly Isolated Fixture Paths

### 1. Upstream callback ownership is not fully proven in this pass

Biggest review limitation.

The shell exposes callback props, but the parent owner was not verified in this review. That keeps this out of PASS.

### 2. Synthetic future-year coverage is narrow

The future fixture is useful, but still a clean happy-path probe. It could mask issues that only show up with:

- overlapping year shapes
- options
- guaranteed/non-guaranteed nuance
- more complex future-contract data

### 3. Fixture players still flow through real feature surfaces

This is intentional, but worth noting.

Once injected, they look like real players to downstream display/contract logic except for their marker/IDs and obvious names. That is useful for testing, but it also means fixture data can visually resemble real data unless the user notices the DEV context.

### 4. Marker logic is player/roster scoped, not broader state scoped

This is fine, but limited.

The reviewed safety model focuses on:

- fixture players
- fixture roster IDs

A broader team-level fixture state contract is not visible in these files.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- the fixture seam is explicitly separated in source
- shell controls are DEV-only and visually isolated
- copy clearly says synthetic/local-only
- injection/clearing is reversible in the reviewed code
- marker/prefix logic is deliberate and reasonably strong

### Why this is not PASS

- upstream callback ownership was not fully proven from the reviewed files
- synthetic coverage is narrow and can only validate a clean futureContract path
- fixture players still flow through real feature surfaces and could mask edge cases the synthetic setup does not represent

---

## Files Reviewed

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/devCapSheetFixtures.ts`

---

## Exact File + Function Anchors

### `src/features/architect/capSheet/devCapSheetFixtures.ts`

- `DEV_CAP_SHEET_FIXTURE_FLAG`
- `DEV_CAP_SHEET_FIXTURE_MARKER`
- `isDevCapSheetFixturePlayer(...)`
- `buildCapSheetFixturePlayers(...)`
- `injectCapSheetFixtures(...)`
- `clearCapSheetFixtures(...)`
- `hasInjectedCapSheetFixtures(...)`

### `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`

- `CapSheetSection`
- DEV-only fixture panel gating
- `onInjectCapSheetFixtures`
- `onClearCapSheetFixtures`
- `hasInjectedCapSheetFixtures`
- DEV/local-only support-surface copy

---

## Final Conclusion

The DEV fixture seam is well isolated and reversible in the reviewed code, but Step 6 lands at **RISK**.

The main reason is:

**the fixture seam itself is good, but the synthetic coverage is narrow and the upstream callback owner behind the “local in-memory only” claim was not fully verified end to end in this review.**

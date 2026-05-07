# Architect TS Conversion Continuation Plan

_Last updated: 2026-04-10_

## Purpose

This document is the current continuation plan for finishing the Architect TypeScript conversion / hardening effort on the `main` branch.

It is intentionally based on the current repo state, not older audit conclusions.

---

## Current repo snapshot

### Tooling / validation reality

- TypeScript is enabled repo-wide, but `tsconfig.json` still has `"strict": false`, which means a green `npm run typecheck` is necessary but **not sufficient** to claim the Architect is fully hardened.
- The repo already has the exact validation commands needed for this effort:
  - `npm run typecheck`
  - `npm run build`
  - `npm run validate:project`
  - targeted node / feature test scripts under `npm run test:*`
- Repo policy in `AGENTS.md` explicitly prefers **targeted validation** over the full suite by default, and requires the full suite only when explicitly authorized.

### What is already true

- Architect is far along in the TS conversion compared with where it started.
- The biggest remaining work is no longer “convert JS files to TS files.”
- The remaining work is now **type hardening at authoritative runtime seams**.

### Current hotspot classes

From current code review, the most important remaining TS-conversion/hardening surfaces are:

1. `src/features/architect/utils/mutationPipeline.ts`
   - central mutation authority
   - still the highest-risk place for broad compatibility transport, normalization seams, and persistence/event shaping

2. `src/features/architect/utils/seasonManager.ts`
   - season-transition authority
   - still carries broad helper-layer transport in core season-advance / draft-resolution flows

3. `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
   - important adapter/state seam
   - lower priority than the two authorities above unless fresh evidence proves otherwise

### Practical interpretation

The work is now in the “finish the hardening” stage, not the “mass rename JS to TS” stage.

---

## Strategy going forward

### 1. Keep the new batched workflow

Do **not** go back to separate “audit pass” then “execution pass” cycles by default.

Each prompt should continue to ask the repo agent to:

1. audit the target area
2. fix everything it safely can in the same pass
3. document deliberate non-changes with justification
4. add focused tests for meaningful changes
5. run the required validation commands
6. return a package

This is faster and matches the current maturity of the codebase.

### 2. Prioritize authoritative runtime seams, not file count

Continue ranking work by:

- live runtime authority
- mutation / season-transition impact
- persistence/event shaping impact
- number and severity of broad transport seams

Do **not** prioritize by:

- raw grep count alone
- file size alone
- how annoying a file looks
- whether a file “feels old”

### 3. Keep doing bigger sweeps first, then narrow seams

The right pattern now is:

- broad sweep on the real top blocker
- re-evaluate
- broad sweep on the next exact blocker
- re-evaluate
- only then do micro-seam cleanup

This avoids wasting time on tiny seams before the ranking is stable.

### 4. Do not split giant files yet just because they are giant

Files like `mutationPipeline.ts` and `seasonManager.ts` are strong refactor candidates long-term, but **do not make file-splitting the first move** in this phase.

Reason:

- if the contracts are still blurry, splitting first often spreads the blur across more files
- that makes the TS hardening harder to reason about
- it also makes blocker ranking less clear

Rule:

- **harden first**
- **decompose after the remaining seams are small and named**

### 5. Treat `typecheck` green as baseline, not finish line

Because `strict` is still false, finishing this phase means:

- important live seams are specifically typed
- remaining permissive typing is small, localized, and justified
- broad bags are isolated to genuinely dynamic boundaries

It does **not** mean “everything typechecks, therefore done.”

---

## What to look for in every remaining pass

Every execution pass should explicitly inspect these patterns:

- `LooseRecord`
- `AnyRecord`
- `Record<string, unknown>`
- `Record<string, any>`
- `[key: string]: unknown`
- `unknown`
- `any`
- `as unknown as`
- `as any`
- local `...Like` bag types
- compatibility transport that leaks too far past ingress
- broad persistence/event payload shapes

For every meaningful occurrence, the pass must either:

1. narrow it to a truthful canonical type or slice
2. isolate it to a very small boundary helper
3. document why it is load-bearing and what would be required to remove it later

---

## Continuation order

## Phase A — Finish authoritative Architect hardening

### A1. `mutationPipeline.ts` stays first until a fresh re-evaluation says otherwise

Continue on `mutationPipeline.ts` **only while** it remains the top blocker by fresh current-code evidence.

The remaining work in this file should be attacked as **named seams**, not broad cleanup.

The expected remaining seam classes are:

- current-state normalization boundaries
- player/team/payload compatibility transport
- persistence/event shaping seams
- offer-sheet / RFA sidecar seams
- any last broad transport that still crosses the central mutation authority unnecessarily

Rule for this file:

- do broad sweeps while the dominant lane is still broad
- switch to micro-passes only once the remaining blocker is one exact seam

### A2. `seasonManager.ts` is the next major authority

As soon as `mutationPipeline.ts` is no longer the top blocker, move to `seasonManager.ts`.

This file should be treated similarly:

- focus on the authoritative season-advance / draft-resolution path
- isolate broad helper transport
- narrow season-transition summaries and persistence-adjacent structures
- leave genuinely dynamic resolution metadata broad only at the smallest truthful boundary

### A3. Adapter/state files stay below the authorities unless re-ranking proves otherwise

Files like:

- `useArchitectState.ts`
- `useArchitectActions.ts`
- `tradeContext/types.ts`
- `tradeContext/tradeContext.ts`

should not reclaim top priority unless a fresh progression-gate audit shows they now outrank the remaining authority-level seams.

---

## Phase B — Progression-gate audits after meaningful passes

After every meaningful hardening pass on a top blocker, run a fresh progression-gate re-evaluation.

That audit should answer exactly:

1. Is the previous top blocker still #1?
2. If yes, what exact seam keeps it there?
3. If not, what replaced it?
4. Are we down to small residuals, or does one meaningful lane still remain?
5. What is the one exact next move?

Rule:

- do not let audits inherit old rankings
- current code must win over old return packages

---

## Phase C — Finish hardening standard

The TS conversion / hardening phase should be considered complete when:

1. Architect runtime authority is fully TS-owned
2. No important live Architect seams are still dominated by broad compatibility transport
3. Remaining permissive typing is:
   - small
   - localized
   - intentional
   - documented
4. Progression-gate re-evaluation says the remaining issues are residual, not lane-defining

That is the real end state for this phase.

---

## Phase D — Post-hardening refactor phase

Only after Phase C should the project move into a dedicated decomposition phase for giant files.

Expected decomposition candidates:

- `mutationPipeline.ts`
- `seasonManager.ts`
- any other authority file that is sufficiently hardened but still too large

That decomposition phase should:

- split by responsibility, not by arbitrary size
- preserve authoritative contracts
- avoid reintroducing broad local mirrors
- keep SSOT boundaries intact

Good candidate subdomains for later extraction in `mutationPipeline.ts` include:

- current-state normalization
- mutation compute branches
- trade/apply helpers
- persistence shaping
- event/history shaping

Do **not** start that decomposition until the dominant hardening seams are already resolved.

---

## Validation policy for the remaining TS phase

Default validation for each execution pass:

1. `npm run typecheck`
2. `npm run test:node -- --reporter=dot <relevant test file(s)>`
3. `npm run build`

Add `npm run validate:project` when:

- new files are created
- exports/structure change
- repo structure changes

Do not run the full suite unless explicitly authorized.

Every return package should always include:

- files changed
- deliberate non-changes
- validation results
- standing failures, if any
- recommended next step

For tiny passes touching 3 or fewer files, keep the package compact.
For broader cross-module passes, use a fuller package.

---

## Practical next-step rule

When resuming after time away:

1. run a fresh progression-gate re-evaluation against current repo state
2. identify the current #1 blocker by live authority, not memory
3. run one batched execution pass on that exact seam
4. repeat until the top blocker falls below dominant-blocker status

This prevents restarting the old loop from stale assumptions.

---

## What not to do

- Do not restart the process from generic TS cleanup.
- Do not split giant files before the hardening seams are named and localized.
- Do not treat green `typecheck` alone as completion.
- Do not let old audit rankings dictate the next file without a fresh current-code check.
- Do not widen a narrow seam pass into a broad architecture rewrite unless the seam truly cannot be solved locally.

---

## Recommended immediate continuation

1. **Fresh progression-gate re-evaluation from current repo state**
   - decide whether `mutationPipeline.ts` is still the top blocker or whether `seasonManager.ts` has overtaken it

2. **If `mutationPipeline.ts` is still #1:**
   - target the one exact remaining seam named by that audit

3. **If `seasonManager.ts` is now #1:**
   - start the next broad hardening sweep there

4. **After the hardening ranking stabilizes and only residual seams remain:**
   - begin a separate file-decomposition phase for oversized authorities

---

## Finish definition for this document

This continuation plan should stay the source of truth until one of these happens:

- the progression-gate audits show a materially different blocker order
- `strict`-mode ratcheting becomes the next real phase
- the project enters the post-hardening decomposition phase

Until then, the operating rule is simple:

**current-code re-evaluation -> one exact batched hardening pass -> re-evaluate again**

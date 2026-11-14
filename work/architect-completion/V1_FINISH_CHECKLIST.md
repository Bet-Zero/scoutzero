---
name: V1_FINISH_CHECKLIST.md
description: The single current status home and frozen finish list for Architect V1 Trade Machine work (owner-approved 2026-11-10).
---

# Architect V1 finish checklist

Owner-approved November 10, 2026. This page is the **only current status home**
for finishing the Trade Machine and Architect V1. Update the boxes here as work
lands. Do not add narrative history; the PR is the evidence record.

Scope authority: [V1 completion contract](../../docs/agent-guides/architect-v1-completion-contract.md),
including its November 10 owner decisions. Rule authority: the pinned accepted
CBA Canon via `npm run architect:canon:lookup -- <LEAF>` (unchanged).

## Standing decisions (owner, 2026-11-10)

1. **Simulation standard everywhere.** NBA rules are applied exactly. Inputs are
   the best available public data. A gap is filled by a named, dated assumption
   that is visible in the product. Certified historical NBA legality is an
   optional label, never a V1 gate. Known liabilities, credible signals, actual
   rule violations and known restrictions are never assumed away.
2. **The 30 rights affected by the 29 unresolved evidence mappings** are not
   tradeable in V1 and show an honest reason. Where one reading is clearly the
   most likely, it may be adopted as a labeled simulation assumption instead.
   They never block the other 248 rights.
3. **This list is frozen.** Work found later goes post-V1 unless it is a defect
   in a listed item. Poison pill, performance incentives, nonzero trade bonuses
   and the Disabled Player Exception are post-V1 and show needs-input.
4. **First-round trading turns on in new simulation worlds** after Phase 1.
   Existing saved worlds are not migrated. The production switch-on/deploy is
   confirmed with the owner once, immediately before it ships.
5. **Proportionate proof.** Tests and independent Claude review stay on every
   legality, financial and saving change. Per-PR retained browser certificates
   and hash bundles are replaced by the final acceptance battery (E1).

## Working rule

Take the next unchecked item in phase order. Finishing an item is permission to
start the next one; no new owner direction is needed between items. Stop only for
a decision this page marks as the owner's, a production change, or a real defect
that changes the plan.

## Phase 1: real starting world

- [x] A1 Install all 278 June 5 draft rights (holders, protections, obligations)
      in new normal worlds from the existing private BZE-344 candidate.
- [x] A2 30-team money baseline under the simulation standard (PR #630 mechanism;
      resolve POR's extra Contract, BKN's $11,773 difference, roster aliases).
- [x] A3 Each team's exceptions, TPE balances and hard-cap status.
- [x] A4 Apron and tax history for frozen picks and repeater tax (labeled
      assumptions where history is missing).
- [x] A5 Apply decision 2 to the 30 gap-affected rights.
- [x] A6 Copying (branching) a simulation world.

## Phase 2: switch it on (owner confirms the deploy)

- [x] D1 First-round Apply enabled for simulation worlds (local; production is D2).
- [ ] D2 Normal Create World uses the baseline; functions and rules deployed.
      Both private packages are recoverable/rebuildable. No reusable executor
      deployment credential verified; existing GitHub Google identities are
      bounded data workers, not deploy authorization. Production remains off.
      Hosting stays on Vercel; Firebase supplies Functions/Firestore/private storage.
- [x] D3 Existing worlds left unmigrated and still readable.
- [x] D4 "Simulation" label and assumption notes visible in the product.
- [x] D5 Light manual intake for rare events (grievances, DPE grants, tenders).
      DPE grants stay post-V1 (needs-input).

## Phase 3: remaining trade mechanisms

- [ ] B1 Free-agent and minimum exceptions in player-plus-pick trades.
      January 10 blanket refusal repaired: full value through the deadline,
      then daily reduction only through Regular Season end. Undated historical
      use reserves the maximum reduction, visibly disclosed; exact chronology
      may permit more. Minimum Exception is not subject to that reduction.
      A06.1's two-month aggregation bar, A06.2's deadline carve-out, and
      A06.3's next-season minimum-stacking check are implemented. Saved
      acquisitions survive reload/copy; solo re-trades remain allowed.
      Missing or conflicting applicable minimum classifications stay needs-input.
      PR #656 contains the focused Canon/trust-boundary checks and opted-in
      real-data copy, aggregation-refusal, and solo re-trade browser proof.
      **Still open:** the already documented same-team combination of outgoing
      salary matching with a separate $0 Minimum Exception acquisition is not
      supported; the current Minimum Exception election requires no players sent.
      No owner deferral is recorded for that remaining B1 case.
- [x] B2 Cash in player-plus-pick trades (with the next-season Apron test
      after the Regular Season).
- [x] B3 Expanded TPE and below-cap TPE elections.
- [x] B4 Legacy 2027 conditional and ranked 2029 picks with players.
- [ ] B5 Remaining pick combinations (swap return ownership, reserved fallback
      picks, cross-program combinations). **Owner decision still unresolved:**
      no approval to exclude these combinations from V1 was found.
- [ ] B6 Sign-and-trade together with picks. **Moved after V1** (owner,
      2026-11-12): it needs the season move.
- [x] B7 Exact trade deadline input for simulation worlds.
      June 5 expiring/possible-last-season restrictions remain; finalist
      Standard players now stop under the disclosed postseason-roster assumption.
      A06 aggregation-history and minimum-stacking rules now have their own
      focused proof under B1; the deadline checkbox alone does not certify them.

## Phase 4: lifecycle across all 278

- [x] C1 part 1: coverage table (`C1_COVERAGE.md`) and the pure June 5 →
      July 1, 2026 season step (#652). Counts corrected: 278 retained,
      136 admitted, **118 currently tradeable** on June 5; 18 admitted current-draft
      picks remain blocked by post-V1 C2.
- [ ] C1 part 2, moving a world into 2026-27 and beyond. **Moved after V1**
      (owner, 2026-11-12: V1 finishes at June 5). Later drafts use the lottery
      order by default with an owner override (owner, 2026-11-12).
- [ ] C2 Rookie-scale money when a pick conveys. **Moved after V1** with the
      season move.

## Phase 5: acceptance

- [x] E1 Pick trades in the end-to-end check (#653; gated spec
      `tests/e2e/architect-simulation-first-round-apply.spec.ts`).
      November 14: financial-proof opt-in enabled; eight journey tests passed,
      zero skipped, plus older-world creation before package activation and
      two exception-Apply cases (Minimum and Non-Taxpayer MLE). This proves
      the exercised journeys, not the unresolved B1/B5 limitations or E2.
- [ ] E2 One owner review link and the owner's final V1 decision.

BZE-345's Done status records delivered simulation integration and a closed
bounded investigation. Its historical financial completeness limitation remains;
Done does not certify historical NBA legality or close B1, B5, D2, or E2.

## Post-V1 (not gaps)

Season move and what depends on it (C1 part 2, B6, C2).
Poison pill, performance incentives, nonzero trade bonuses (already Phase 3B),
Disabled Player Exception, certified historical NBA legality, four-team trades,
draft-night room, Offseason room.

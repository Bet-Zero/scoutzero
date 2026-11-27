---
name: V1_FINISH_CHECKLIST.md
description: The single V1 status home; current 2026-27 starting-world target corrected by the owner on 2026-11-14.
---

# Architect V1 finish checklist

Owner-approved November 10, corrected November 14, 2026. This page is the **only current status home**
for finishing the Trade Machine and Architect V1. Update the boxes here as work
lands. Do not add narrative history; the PR is the evidence record.

Scope authority: [V1 completion contract](../../docs/agent-guides/architect-v1-completion-contract.md),
including its November 14 owner correction. Rule authority: the pinned accepted
CBA Canon via `npm run architect:canon:lookup -- <LEAF>` (unchanged).

## Current product target (owner, 2026-11-14)

[BZE-243 decision](https://linear.app/bzero/issue/BZE-243#comment-ed97943f-acd4-4dd2-baf1-bf03627fa0ab):
a GM creates a new world with **current 2026-27 NBA teams, rosters, Contracts,
finances, draft rights and restrictions**, at a clearly identified current
snapshot date (prefer November 2026), and can make, validate, save and reload
trades. This supersedes the November 12 June 5 finish line. Initialize directly
from current inputs; changing labels or replaying every offseason action is
not the requirement. Future-season progression remains post-V1.

The June 5 packages and accepted engines/proofs, including PR #656, are
preserved. Reopened starting-state and acceptance boxes below concern the new
current-season target; they do not retract completed historical work. Establish
this state before resuming B1/B5. No production activation, package publishing,
existing-world migration, provider outreach or purchases are authorized here.

**Launch priority (owner, November 15):** ScoutZero must run without bills or
billable exposure from other users. The [BZE-243 cost decision](https://linear.app/bzero/issue/BZE-243#comment-b5088850-e1ed-4d1e-872a-7ac28c533afa)
supersedes the paid Firebase rollout recommendation. Keep PR #660 held; no Blaze,
billing linkage, paid service, production deployment, activation or migration
without explicit owner approval. Investigate only the smallest secure
Vercel plus Firebase Spark alternative, preserving accepted rules, private
starting-data trust and all saved worlds.
The [November 16 decision](https://linear.app/bzero/issue/BZE-243#comment-6f031d40-12c4-4a12-96c6-7c493a31a4a9)
confirms current personal/noncommercial use and authorizes the bounded technical
proof only; future monetization requires revisiting Hobby eligibility.

## Standing decisions (owner, 2026-11-10)

1. **Simulation standard everywhere.** NBA rules are applied exactly. Inputs are
   the best available public data. A gap is filled by a named, dated assumption
   that is visible in the product. Certified historical NBA legality is an
   optional label, never a V1 gate. Known liabilities, credible signals, actual
   rule violations and known restrictions are never assumed away.
2. **The 30 rights affected by the 29 unresolved evidence mappings** are not
   tradeable in V1 and show an honest reason. Where one reading is clearly the
   most likely, it may be adopted as a labeled simulation assumption instead.
   They never block unrelated rights. The 278/30/248 counts describe the retained
   historical inventory; current membership and tradeability must be reconciled
   after the 2026 draft and offseason, preserving unresolved-mapping lineage.
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

- [x] A1 Current 2026-27 draft rights, holders, protections and obligations in
      normal new worlds. Reconcile the 2026 draft/offseason against the retained
      278-identity history; preserve consumed rights and unresolved lineage.
      The installed June 5 BZE-344 package is historical evidence, not completion.
      The November 14 package reconciles all 210 original firsts in 2027–2033
      and 23 connected programs. Existing protections, swap returns, reserved
      fallbacks, ranked pools and second-round counterparties retain their terms.
      Source originals represented by those interests are reference-only.
      Historical identities/packages remain recoverable and are not migrated.
- [x] A2 Current 30-team rosters, Contracts and money under the simulation
      standard, including actual 2026 offseason transactions, options, expirations
      and rookie Contracts. Reuse the accepted financial/Contract engines;
      the June 5 baseline and its reconciliations remain valid for their date.
      November 14: 525 roster players, 551 current/future Contract records,
      all 30 actual 2026 first-round selections matched to signed Contracts,
      and all 30 current payrolls reconciled. Conflicting public guarantee
      fields are unknown in the world projection; original evidence and money
      remain intact, and affected current Contracts stay needs-input.
      A conflicting Two-Way method/type also stays needs-input for matching.
- [x] A3 Current-season exceptions, TPE balances and dated hard-cap triggers;
      do not carry expired prior-season restrictions or reset continuing ones.
      Current levels/open balances replace June values. Minnesota's conflicting
      hard-cap label has a named, visible Second Apron simulation correction.
- [x] A4 Current Apron/tax history, pick freezes and dated sanctions, with
      named assumptions only where missing facts permit them.
      Prior accepted Apron determinations are reused. Current Clippers sanctions
      remain blocked; final 2026–27 Tax Salary and pre-world cash history are
      unknown, never borrowed from June or invented as future observations.
- [x] A5 Apply decision 2 to the reconciled current rights and recompute
      retained, admitted and currently tradeable counts for the snapshot date.
      210 reported originals plus 30 explicitly assumed, non-tradeable 2034
      Stepien possession witnesses, plus 92 connected selection interests,
      total **332 retained identities**. 246 first-round records and 15
      second-only connected interests are admitted; **227 are selectable**
      (212 first-round interests and 15 second-round interests), subject to
      whole-trade validation. Counts describe interests, not extra original picks.
      66 originals are reference-only, five are forfeited, four admitted firsts
      are frozen and 30 admitted boundary witnesses are outside the trading window.
      The 278-record historical and 240-record current predecessors are preserved.
- [x] A6 Copying (branching) a simulation world.
      Copies retain server-established Contract roots even after the active
      starting package changes; historical release validation is preserved.

## Phase 2: switch it on (owner confirms the deploy)

- [x] D1 First-round Apply enabled for simulation worlds (local; production is D2).
- [ ] D2 Ordinary Create World with the current 2026-27 baseline on the
      protected Vercel Hobby and Firebase Spark route. The November 26 review
      records signed-in hosted creation, a saved mixed trade with reload,
      History and pick ownership, disposable-world deletion, and replacement
      creation and reopening. Preserve that proof and the existing owner
      access. The stable integrated release still needs candidate validation,
      required History indexes, Rules/runtime reconciliation and release
      authorization. Use the
      [protected Preview procedure](../../docs/operations/CLOUD_DEVELOPMENT.md#prepare-a-protected-owner-preview)
      for new rollout actions. PR #660 and public activation remain held.
- [x] D3 Existing worlds left unmigrated and still readable.
      Verify the rollout candidate with the reproducible historical and pre-B5
      [older-world compatibility fixtures](../../docs/operations/CLOUD_DEVELOPMENT.md#reproduce-older-world-compatibility-locally).
      The original #659 exports and inventory are unavailable. The regenerated
      fixtures establish compatibility for the tested formats. Leave actual hosted
      saves untouched during verification.
- [x] D4 "Simulation" label and assumption notes visible in the product.
- [x] D5 Light manual intake for rare events (grievances, DPE grants, tenders).
      DPE grants stay post-V1 (needs-input).

## Phase 3: remaining trade mechanisms

- [x] B1 Free-agent and minimum exceptions in player-plus-pick trades.
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
      Combined outgoing matching plus separately elected Minimum Exception
      acquisitions now preserves distinct components: minimum players use $0
      matching salary while full pay stays in team/apron books. Invalid or duplicate
      allocations fail; A06.3 counts only the matching component's replacement
      players. Current real-data HOU/MIL player-plus-pick proof saves, reloads and
      copies the separate receipt/acquisition history without changing older worlds.
- [x] B2 Cash in player-plus-pick trades (with the next-season Apron test
      after the Regular Season).
- [x] B3 Expanded TPE and below-cap TPE elections.
- [x] B4 Legacy 2027 conditional and ranked 2029 picks with players.
- [x] B5 Remaining pick combinations (swap return ownership, reserved fallback
      picks, cross-program combinations). **Included in full, with no exclusions**
      ([owner, November 14](https://linear.app/bzero/issue/BZE-243#comment-673a9dca-8f95-4cb0-9dac-d1cd2cb4f7f4)).
      Protected rights, swap returns, reserved fallbacks and connected obligations
      must trade when legally eligible in the current world, preserving all prior
      claims, priorities, protection branches, Stepien coverage and freezes.
      No owner scope decision remains. Present-day transfers preserve complete
      interests, all counterparty claims and every possible first-round possession
      branch through the existing Stepien, Apron, window and cash-sale rules.
      Connected firsts may accompany players and a separately elected Minimum
      Exception; connected second-only claims can also trade. Draft outcomes and
      future progression are not performed. Public CHA/MIN 2030 exercise details
      and CHA/PHX 2029 ranking wording remain visibly qualified; whole-interest
      transfers preserve them and use their invariant possession classes without
      inventing a final selection or priority resolution.
- [ ] B6 Sign-and-trade together with picks. **Moved after V1** (owner,
      2026-11-12): it needs the season move.
- [x] B7 Current-snapshot player timing, salary-cap-year calendar and deadline
      inputs verified. Exact deadline support and June 5 eligibility/A06 repairs
      are preserved. Current FA three-calendar-month/December 15, draft-rookie
      thirty-day and recent extension/renegotiation restrictions are governed;
      signed future extensions cannot disappear behind current salary rows.
      Bird/January 15 prior-pay, cap, prior-team and exact minimum/no-bonus
      predicates and veteran extension 120%/5% limits now use retained facts.
      Saved extension/renegotiation events supply their own signing date and
      extended rows without rewriting original Contracts. Existing accepted
      June 5 history may supply only missing prior pay, visibly disclosed;
      conflicting rows cannot be overwritten. Current Collins/Wiggins timing
      clears; Brooks's excessive raises remain restricted. Leonard's separate
      trade bonus and pending rookie poison pill retain their post-V1 refusals.
      Unknown signing-day cap/EAPS facts and date-only anniversary timing still
      require input where decisive. No June 5 acquisition clearance is imported
      into November; missing acquisition facts still block aggregation.

## Phase 4: draft history and future progression

- [x] C1 part 1: coverage table (`C1_COVERAGE.md`) and the pure June 5 →
      July 1, 2026 season step (#652). Counts corrected: 278 retained,
      136 admitted, **118 currently tradeable** on June 5; 18 admitted current-draft
      picks remain blocked by post-V1 C2.
      This count and season-step proof are historical; current counts belong in A5.
- [ ] C1 part 2, simulating progression into future seasons. **Post-V1**
      (owner, 2026-11-14). Direct initialization into 2026-27 is required in A1–A4.
      Later simulated drafts retain the recorded lottery-order default/override.
- [ ] C2 Future rookie-scale calculation when a pick conveys during progression.
      **Post-V1**. Actual 2026 draft outcomes and rookie money are required in A1/A2.

## Phase 5: acceptance

- [x] E1 Current 2026-27 ordinary creation, visible assumptions, player/pick
      trades, validation refusals, saving/receipts, reload/copy and older-world
      preservation, using the actual current packages with opt-in gates enabled.
      Current local journeys: **9 passed, 0 skipped**, with both financial and
      current-season opt-ins enabled. They save ordinary pick, player-plus-pick,
      player-only, protected/fallback, swap-return, second-counterparty and
      connected-pool trades, including separate Minimum Exception acquisitions.
      They check receipts, reload/copy, every untraded counterparty, Stepien and
      player-timing refusals, 1280×720 column bounds, and unchanged historical
      and pre-B5 current worlds. Both private packages replay byte-for-byte;
      the completed local emulator session is privately exported. Prior valid
      package-rotation copy/reload proof remains retained
      (**1 passed, 0 skipped**) against a retained current world with the older
      starting package active. The final review-mode acceptance battery passes:
      **25 passed, 1 intentionally skipped** (disabled draft-right authoring;
      the normal no-authoring-controls case passes). Controlled acceptance inputs
      supplement, rather than replace, the real current packages. It proves
      legal player trades, staged-draft retention, signing/re-signing, waiver,
      stretch/buyout lifecycles, RFA store/match/decline, both sign-and-trade entry
      points, receipts/history/compare and reload. Acceptance repairs preserve
      entered sign-and-trade terms across refreshes and use the saved-world date
      for offer-sheet validation and waiver receipts. A subsequent focused
      November signing journey also passes (**1 passed, 0 skipped**): a missing
      future Tax baseline does not block current Team/Apron-based signing, and
      remains explicitly unknown through save/reload. Other missing inputs,
      supplied conflicting baselines, hard caps and the season-end boundary
      remain enforced. The full battery was then repeated successfully after
      isolating each offer-sheet journey's immutable source inputs; it verifies
      that the shared seed and earlier worlds' evidence remain unchanged.
      The exact-candidate
      independent review remains a required landing gate; E2 is the owner's
      separate final acceptance, not an automated-test claim.
      Historical June 5 pick proof (#653; gated spec
      `tests/e2e/architect-simulation-first-round-apply.spec.ts`).
      November 14: financial-proof opt-in enabled; eight journey tests passed,
      zero skipped, plus older-world creation before package activation and
      two exception-Apply cases (Minimum and Non-Taxpayer MLE). This proves
      the historical journeys, not current-state readiness, B1/B5 closure or E2.
- [ ] E2 One owner review link and the owner's final V1 decision.

BZE-345's Done status records delivered simulation integration and a closed
bounded investigation. Its historical financial completeness limitation remains;
Done does not certify historical NBA legality or close B1, B5, D2, or E2.

## Post-V1 (not gaps)

Future-season move and related mechanisms (C1 part 2, B6, future C2).
The effects of the actual 2026 offseason/draft in the starting state are required.
Poison pill, performance incentives, nonzero trade bonuses (already Phase 3B),
Disabled Player Exception, certified historical NBA legality, four-team trades,
draft-night room, Offseason room.

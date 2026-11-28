---
name: architect-v1-completion-contract.md
description: What Architect V1 must do, what is excluded, and how V1 is accepted. Current owner decisions consolidated November 28, 2026. Serves BZE-243.
---

# Architect V1 Completion Contract

This page defines Architect V1: the target, the required workflows, the
deliberate exclusions, and how the finished product is accepted. It states the
owner's decisions as they stand now. The decisions came from BZE-244 (July 11,
2026), the locked August 27 and BZE-301 (September 4) decisions, the November 10
reset, the November 14 correction and the November 28 delivery direction. Their
earlier wording is in git history and
[BZE-243_STATUS_HISTORY_2026-11-10.md](../../work/architect-completion/BZE-243_STATUS_HISTORY_2026-11-10.md).

Status lives in the [V1 finish checklist](../../work/architect-completion/V1_FINISH_CHECKLIST.md);
the current order of work is in the
[execution plan](../../work/architect-completion/ARCHITECT_COMPLETION_EXECUTION_PLAN.md).
Product and design rules are in the [Architect boundary](architect-boundary.md).
How individual changes are built, tested, reviewed and merged is in
[AGENTS.md](../../AGENTS.md); this contract does not add per-change steps.

Architect is not complete until the owner accepts V1 (owner, July 11). Earlier
"green" or "complete" labels are history; work they cover stays valid
evidence that those moves execute.

## Target

[Owner decision, November 14](https://linear.app/bzero/issue/BZE-243#comment-ed97943f-acd4-4dd2-baf1-bf03627fa0ab):
a GM creates a new world using the **current 2026-27 NBA season**, with actual
teams, rosters, Contracts, finances, draft rights and restrictions at an
explicitly identified current snapshot date (prefer November 2026), then makes,
validates, saves and reloads trades. Changing a season label or reading future
salary rows from a June 5 roster does not establish this state.

- Initialize directly from a reconciled current-season baseline using the
  existing engines. Account for the 2026 offseason and draft: transactions,
  options and expirations, new Contracts including drafted rookies, draft
  outcomes and remaining rights, current league levels, exceptions, dated
  hard-cap triggers, sanctions, freezes and other known restrictions.
- Retain the 278 historical draft-asset identities and the unresolved-mapping
  lineage without claiming they are the current tradeable inventory. Do not
  backdate later evidence.
- The June 5 packages, the 118 selectable-pick count and their browser proofs
  are valid historical evidence; they do not certify the current state.
  Accepted implementations, including PR #656, are preserved; their
  date-dependent behavior is checked against the current snapshot.
- **Future-season progression is post-V1.** No simulated offseason is needed
  to start the current season. Actual 2026 draft results and rookie Contracts
  are required starting inputs; future draft conveyance and rookie-scale
  calculation during season advancement are deferred.

**Delivery** (owner, November 28): reviewed merges to `main` deliver Architect on
the normal ScoutZero site, with normal accounts and account-owned worlds. The
first hosted installation of the private baseline, shared Firebase deployments,
permission changes, existing-world migration, provider outreach and purchases
each need the owner's OK, as AGENTS.md lists.

## Standing owner decisions

1. **Simulation standard** (November 10). Architect worlds are simulations. NBA
   rules from the pinned accepted Canon are applied exactly; inputs are the best
   available public data; a missing fact is filled by a named, dated assumption
   that is visible in the product. Wherever V1 needs real-NBA state, a labeled
   simulation input satisfies it. Certified historical NBA legality is optional
   and never a V1 gate. Known liabilities, credible unresolved signals, actual
   rule violations and known restrictions are never assumed away, and source
   data is never relabeled.
2. **Unresolved evidence** (November 10). The rights affected by the 29
   unresolved evidence mappings are not tradeable in V1 and show an honest
   reason, unless a clearly most-likely reading is adopted as a labeled
   simulation assumption. They never block unrelated rights.
3. **Frozen scope** (November 10). The checklist is the complete remaining V1
   list. Later discoveries are post-V1 unless they are defects in a listed item.
4. **All draft-asset categories** ([owner, November 14](https://linear.app/bzero/issue/BZE-243#comment-673a9dca-8f95-4cb0-9dac-d1cd2cb4f7f4)).
   Swap-return ownership, protected rights and reserved fallback obligations,
   and cross-program, pooled and connected obligations are all required, with
   no exclusions. Present-day trading preserves every counterparty claim,
   priority, protection branch, Stepien witness and freeze. A genuinely missing
   decisive asset fact stays visibly unavailable.
5. **Activation** (November 10). First-round trading is enabled in new
   simulation worlds once the starting world is installed. Existing worlds stay
   on their own baselines.
6. **Proportionate proof** (November 10). Legality, financial and saving changes
   keep tests and an independent review. Per-change browser certificates and
   hash bundles are replaced by the final acceptance battery below.

## Required V1 workflows

All workflows run inside a saved world unless noted. Each must also meet the
[behavior standard](#behavior-standard). Rooms on `main`: Roster, Cap Sheet,
Full Cap Table, Trade Machine, Free Agency, Team History, Compare, Guide, and the
cockpit chrome (top bar, navigation rail, Team Plan drawer). The Offseason room
is excluded from V1 navigation.

- **W1. Saved world lifecycle.** Create a saved world, reopen it, switch worlds,
  advance the world date. A GM can create a world, act in it, leave entirely,
  and return to find everything as left; world-gated rooms offer inline world
  create/select instead of dead ends.
- **W2. Reading the books.** Cap Sheet, Full Cap Table, Roster and top-bar counts
  agree for any team and season; seasons are labeled correctly; official
  2026-27 league numbers apply; the Full Cap Table and Cap Sheet fit a full
  18-man roster (15 standard + 3 Two-Way) with zero scroll at 1280×720; the
  Roster room shows standard and Two-Way groups completely.
- **W3. Waive, waive-and-stretch, buyout** from the Full Cap Table row overflow
  (the proven entry point; other entry points are a scope change). Each variant
  produces the correct dead-cap treatment, the player leaves the roster, and the
  dead cap survives reload in the right seasons.
- **W4. Contracts and options.** Extend a player, exercise or decline team and
  player options, renounce rights (absolve a cap hold). Each action is reachable
  from its proven entry point, produces the correct money, and its Contract
  state is visible on the books.
- **W5. Free agency: league pool.** Sign another team's free agent from Free
  Agency. A legal signing applies with correct terms and cap treatment; an
  illegal one is blocked with the reason visible.
- **W6. Own free agents.** Re-sign or absolve your own free agent from the Full
  Cap Table own-FA row (owner-decided placement). Re-sign puts the player back
  with correct money; absolve clears the hold.
- **W7. Restricted free agency.** Store an offer sheet on another team's
  restricted free agent; as the home team, match or decline. Match keeps the
  player home; decline moves player and cap to the offering team; the exact
  Exercise Notice deadline (CBA2-L04.22) is enforced and explained when it
  blocks.
- **W8. Sign-and-trade.** Starts from Free Agency; assembled, validated and
  finished in the Trade Machine (BZE-190, reaffirmed July 11). It validates and
  applies like any trade, the receiving team is hard-capped at the first apron,
  and it survives the full trade lifecycle. The Full Cap Table own-FA entry also
  remains.
- **W9. Trades and draft assets.** The Trade Machine is a full-screen workspace
  for two- and three-team trades mixing players, picks and entitlements. A legal
  trade reaches a clear ready state and applies; an illegal trade is blocked
  before apply with the verdict and per-team reasons visible where the decision
  is made; warnings on allowed trades show before apply; a trade in progress is
  never silently discarded by leaving the room. The downloadable trade summary is
  part of V1. Supported ordinary trades are required; a trade that needs a
  nonzero trade-bonus calculation follows the exclusion below.
- **W10. Draft-asset rules.** Pick ownership, protections, conveyance,
  rookie-scale money and entitlement claims (including blocking conflicting
  claims) hold across the Trade Machine and season boundaries, using the world's
  draft-asset state (labeled simulation inputs qualify). `CBA2-A12.3` is
  authenticated in the pinned Canon. Branch-complete first-round ownership,
  Stepien, protection, conveyance, freeze, unfreeze, penalty and required
  transitions are required for the current first-round inventory. Decision 4
  covers swap returns, fallbacks and connected obligations. Where a needed input
  is neither known nor covered by a labeled assumption, the action stops before
  apply with an honest needs-input result; the product never guesses a branch,
  reuses simplified legacy rules, or treats a missing condition as satisfied.
- **W11. Season advance: post-V1.** Keep the existing Season Advance engine and
  its tests. A later progression workflow must preserve every team's books and
  history.
- **W12. Team History.** Every applied move lands in this world's history with
  correct detail, and the detail rehydrates after reload. Saved-world history
  only.
- **W13. Compare.** Before/after comparison reflects applied moves with correct
  player names, and is world-gated with inline create/select.
- **W14. Guide.** Guided questions produce next-move guidance in GM language with
  no dead ends (modest bar: works, honest, presentable).
- **W15. Team Plan hub.** The Team Plan drawer reports the active team, world and
  season, save status, moves so far, pending or unsaved work, pinned players,
  draft assets, and cap and roster warnings, and stays accurate after every
  applied action and after reload.

## Behavior standard

A required workflow is complete only when all six hold in the real product:

1. **Success is visible.** The action completes from its proven entry point, the
   updated numbers appear immediately, and the confirmation reads in GM language
   (no internal vocabulary; see the boundary's banned list).
2. **Blocked and error states are honest and usable.** Illegal actions are
   blocked before apply. The verdict and reasons are visible where the decision
   is made. A blocked state never reads as success. The user can fix the problem
   or back out cleanly.
3. **Applied work persists.** Applied actions write to the saved world. Staged
   but unapplied work survives navigation or the product warns before
   discarding it.
4. **Reload proves it.** After a full reload, books, roster and history are
   unchanged.
5. **Rooms agree.** After any applied action, Roster, Cap Sheet, Full Cap Table,
   Team History, Compare and the Team Plan drawer are consistent, including for
   every other team the action touched.
6. **History and Compare capture it.** Every applied action appears in Team
   History with correct details and is reflected in Compare.

Tests that pin these promises (blocked never reads as success, required honesty
notices) can change wording with a design change; only the owner changes the
promise. Time-window rules, such as the offer-sheet deadline, are tested with
world-clock setups, not wall-clock hacks.

## Deliberate V1 exclusions (not gaps)

Each excluded mechanism that a user can reach must stop before apply with an
honest needs-input or unavailable result. None may be assumed away.

- **Nonzero trade bonuses** (Phase 3B, August 27). A trade that needs a nonzero
  trade-bonus calculation stops before apply. It may not assume zero, omit the
  condition, or weaken another rule. Supported trades without that calculation
  remain required.
- **Poison-pill and performance-incentive salary bases, and the Disabled Player
  Exception** (grant and use) (November 10).
- **Sign-and-trade together with picks** (B6) and other mechanisms that need the
  future-season move.
- **Draft-night experience** (draft room, Make Pick screen, rookies landing on
  rosters), parked July 4. Draft-asset rules (W10) remain in scope.
- **Offseason room** (July 11): not in normal V1 navigation. Real offseason
  effects still belong in the starting state.
- **Entitlement and pick authoring controls** (July 11): hidden from normal GM
  users. Trading existing picks and entitlements (W9/W10) remains in scope.
- **Real-life franchise history** in Team History; a world shows its own history.
- **JSON or raw-data entry** anywhere in the GM flow (July 5).
- **Certified historical NBA legality** (November 10).
- **Four-team trades.**

## Acceptance

V1 is accepted once, at the end, not change by change:

- **E1. Acceptance battery.** The live scenario battery
  (`tests/e2e/architect-qa.spec.ts` in review mode, with the current packages)
  passes. It drives each required workflow end to end in seeded saved worlds at
  1280×720 with realistic data: full 18-man rosters for cap surfaces and
  realistic rosters on both sides of trades. It covers save, leaving the room,
  returning and full reload for every team an action touched. For every
  CBA-derived amount, threshold, date, eligibility result or verdict it checks,
  the expected value is written from the pinned Canon leaf and the source or
  labeled assumption it depends on, never taken from the app's output. Excluded
  mechanisms are expected to stop.
- **E2. Owner acceptance.** One review link per review wave (screenshots of
  every changed state at 1280×720 and a plain-language summary). The owner
  replies approve, approve with notes, or not yet, and explicitly accepts V1.

Remaining exclusions are documented honestly in the product and here.
Presentation is judged against the
[visual standard](../standards/ARCHITECT_VISUAL_STANDARD.md) and the boundary's
design laws.

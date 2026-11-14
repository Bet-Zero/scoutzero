---
name: architect-v1-completion-contract.md
description: Owner-approved product boundary and proof standard, corrected 2026-11-14 to a current 2026-27 starting world. Serves BZE-243; companion to architect-boundary.md.
---

# Architect V1 Completion Contract

**Status: OWNER-APPROVED (approve-with-notes), 2026-07-11; amended by locked
owner decisions, 2026-08-27 and BZE-301 (2026-09-04)** (BZE-244; drafted
against main `85d1f54c`, owner notes applied the same day). BZE-301 supersedes
the first-round lifecycle exclusion: branch-complete first-round lifecycle is
V1-required across the 278 then-exposed first-round entitlements (historical
inventory; the November 14 correction below governs current membership).
Unavailable nonzero trade-bonus authority remains deferred to Phase 3B.
Accepted Phase 3A evidence remains valid for its proven boundary; V1 acceptance
must also satisfy the expanded first-round requirement. **Reset by owner
decisions, 2026-11-10** (simulation standard, frozen finish list), and **corrected
2026-11-14 to a current 2026-27 starting world**, recorded below.

## Owner decision, 2026-11-14 (highest-precedence V1 target)

[BZE-243 owner decision](https://linear.app/bzero/issue/BZE-243#comment-ed97943f-acd4-4dd2-baf1-bf03627fa0ab)
supersedes the November 12 fixed June 5, 2026 finish line. A GM must create a
new world using the **current 2026-27 NBA season**, with actual teams, rosters,
Contracts, finances, draft rights and restrictions at an explicitly identified
current snapshot date (prefer November 2026), then make, validate, save and
reload trades. Changing a season label or reading future salary rows from a
June 5 roster does not establish this state.

Initialize directly from a reconciled current-season baseline using the existing
engines and best-available-public-data simulation standard. Account for the
2026 offseason and draft: transactions, options and expirations, new Contracts
including drafted rookies, draft outcomes and remaining rights, current league
levels, exceptions, dated hard-cap triggers, sanctions/freezes and other known
restrictions. Missing facts may use named, dated, visible assumptions; known
obligations and credible unresolved signals cannot be erased. Retain the 278
historical identities and unresolved-mapping lineage without claiming they are
the current tradeable inventory. Do not backdate later evidence.

The June 5 packages, 118 selectable-pick count and browser proofs remain valid
historical development evidence. They do not certify the new starting state.
Accepted implementations, including PR #656, are preserved; verify their
date-dependent behavior against the new snapshot. The existing checklist is
the sole status home; this is a correction to its starting-world requirement,
not a general roadmap expansion.

**Future-season progression remains post-V1.** No simulated offseason traversal
is required to initialize the current season. Existing 2026 draft results and
rookie Contracts are required starting inputs; future draft conveyance and
rookie-scale calculation during season advancement remain deferred. The other
recorded mechanism exclusions remain unchanged, and B5's remaining scope
decision remains unresolved.

Production baseline publication/deployment/activation, existing-world migration,
provider outreach and purchases retain separate authorization gates. Final V1
acceptance still requires the owner's hands-on review.

## Owner decisions, 2026-11-10 (these override conflicting text below)

The owner approved a finishing reset after the Trade Machine stalled on
evidence that no software change could supply. The frozen finish list and
current status live in
[V1_FINISH_CHECKLIST.md](../../work/architect-completion/V1_FINISH_CHECKLIST.md).

1. **Simulation standard.** Architect worlds are simulations. NBA rules from the
   pinned accepted Canon are applied exactly; inputs are the best available
   public data; a missing fact is filled by a named, dated assumption that is
   visible in the product. Wherever this contract asks for "authenticated" or
   "certified" real-NBA state, a labeled simulation input satisfies V1.
   Certified historical NBA legality is optional and never a V1 gate. Known
   liabilities, credible unresolved signals, actual rule violations and known
   restrictions are never assumed away, and source data is never relabeled.
2. **Unresolved evidence.** The 30 entitlements affected by the 29 unresolved
   evidence mappings are not tradeable in V1 and show an honest reason, unless a
   clearly most-likely reading is adopted as a labeled simulation assumption.
   They no longer gate V1 for the other 248 entitlements.
3. **Frozen scope.** The checklist is the complete remaining V1 list. Poison
   pill, performance incentives, nonzero trade bonuses and the Disabled Player
   Exception are post-V1 and must show needs-input. Later discoveries are
   post-V1 unless they are defects in a listed item.
4. **Activation.** First-round trading is enabled in new simulation worlds once
   the starting world is installed; existing worlds are not migrated. The
   production deploy is confirmed with the owner once, immediately before it ships.
5. **Proof.** Tests and independent review remain required for legality,
   financial and persistence changes. Per-change retained browser certificates
   are replaced by the final live scenario battery.

## Precedence

Owner decision on file (2026-07-11, BZE-243): **Architect is not complete.**
This overrides every earlier "green" or "complete" label, including the
2026-07-04 closure. Earlier merged work and green suites remain valid
evidence that individual moves execute; they do not by themselves prove a
workflow finished under this contract. Where an old claim and this contract
conflict, this contract wins.

## How to read this document

- **Required** (section below): must meet the behavior standard and evidence
  standard before Architect V1 can be called complete.
- **Excluded**: deliberately out of V1 by owner decision. Not gaps. Do not
  build, and do not report as missing. Authority-blocked exclusions must remain
  visibly fail-closed until their recorded unblocking event occurs.
- **Undecided**: genuinely needs owner judgment. Do not implement either way
  until decided.

Room names as they exist on main: Roster, Cap Sheet, Full Cap Table,
Trade Machine, Free Agency, Offseason (excluded from V1 navigation — see
exclusions), Team History, Compare, Guide, plus the cockpit chrome (top
bar, navigation rail, Team Plan drawer).

## Required V1 workflows

All workflows run inside a saved world unless noted. "Complete when" states
the workflow-specific expectation; every workflow must ALSO meet the
universal behavior standard in the next section.

### W1. Saved world lifecycle

Create a saved world, reopen it, switch worlds, advance the world date.
Complete when a GM can create a world, act in it, leave entirely, and return
to find everything as left; world-gated rooms offer inline world
create/select instead of dead ends.

### W2. Reading the books

Cap Sheet, Full Cap Table, Roster, and top-bar counts for any team/season.
Complete when the money and roster state agree across all of these surfaces
for the same team and season, seasons are labeled correctly, official
2026-27 league numbers are in effect, the Full Cap Table and Cap Sheet fit a
full 18-man roster (15 standard + 3 two-way) with zero scroll at 1280×720,
and the Roster room presents standard and two-way groups completely.

### W3. Waive, waive-and-stretch, buyout

From the Full Cap Table row overflow — the approved, proven entry point.
This contract does not require additional entry points (e.g. Roster
actions); adding one is a scope expansion needing separate confirmation.
Complete when each variant produces the correct dead-cap treatment, the
player leaves the roster, and the dead cap survives reload in the right
season(s).

### W4. Contracts and options

Extend a player, exercise/decline team and player options, renounce rights
(absolve a cap hold). Complete when each action is reachable from its proven
entry point, produces the correct money, and the resulting contract state is
visible on the books.

### W5. Free agency — league pool

Sign another team's free agent from the Free Agency room. Complete when a
legal signing applies with correct contract terms and cap treatment, and an
illegal one is blocked with the reason visible.

### W6. Own free agents

Re-sign or absolve your own free agent from the Full Cap Table own-FA
decision row (owner-decided placement: own FAs live on the Full Cap Table,
not in the league pool). Complete when re-sign puts the player back on the
roster with correct money and absolve clears the hold.

### W7. Restricted free agency — offer sheets

Store an offer sheet on another team's restricted free agent; as the home
team, match or decline an incoming sheet. Complete when match keeps the
player home and decline moves player and cap to the offering team, with the
48-hour match-window rule enforced and explained when it blocks.

### W8. Sign-and-trade

Starts from Free Agency; assembled, validated, and finished in the Trade
Machine (owner decision BZE-190, reaffirmed 2026-07-11). Complete when the
sign-and-trade validates and applies like any trade, the receiving team is
hard-capped at the first apron, and the piece survives the full trade
lifecycle. Context for the gap pass: current main's proven entry is the
Full Cap Table own-FA row (BZE-190 closing record — own free agents do not
appear in the world-mode FA pool today); making the Free Agency start point
real is expected, in-scope V1 work, not a silent scope change.

### W9. Trades and draft assets

The Trade Machine as a full-screen workspace: two- and three-team trades
mixing players, picks, and entitlements. Complete when a legal trade
validates with a clear, reachable ready state and applies; an illegal trade
is fail-closed before apply with the verdict and per-team reasons visible at
the point of decision (not buried); warnings on allowed trades surface
before apply; and a trade in progress is never silently discarded by
leaving the room. The downloadable trade-summary export is part of V1
(owner decision 2026-07-11) and is held to this contract's behavior and
presentation standards like any other required surface.

Supported ordinary trades remain required when their retained contracts need
no nonzero trade-bonus calculation, or when every required trade-bonus input is
authenticated. A trade that requires a nonzero trade-bonus calculation but
lacks the evidence named in the 2026-08-27 exclusion must stop before apply and
show an honest needs-input result. That exclusion cannot be implemented by
assuming zero, omitting the condition, or weakening another supported trade
rule.

### W10. Draft-asset rules

Pick ownership, protections, conveyance, rookie-scale money, and entitlement
claims (including blocking conflicting claims). Complete when these rules
hold across the supported Trade Machine picks flow and season boundaries using
the world's governed asset state (labeled simulation inputs qualify; see the
2026-11-10 decisions). Existing supported pick and entitlement
trades remain required. `CBA2-A12.3` is authenticated in the pinned accepted
Canon. Branch-complete first-round ownership, Stepien, protection, conveyance,
freeze, unfreeze, penalty, and required-transition lifecycle support is required
for the reconciled current first-round inventory. The historical 278 identities
(240 ownership, 27 swap rights, 11 conveyance rights) retain their lineage;
the 30 affected by the 29 unresolved evidence mappings follow November 10
decision 2. B5's remaining protected/swap/pool scope is unresolved, not an
approved V1 exclusion. Where a
needed input is neither known nor covered by a labeled simulation assumption,
the action stops before apply with an honest needs-input result. The product may
not silently guess a branch, reuse simplified legacy rules, or treat a missing
condition as satisfied. (The draft-night room itself
is excluded — see exclusions.)

### W11. Season advance — post-V1

Future-season progression is post-V1 under the November 14 decision. Preserve
the existing Season Advance engine and its accepted tests, but do not require
simulated progression as a prerequisite for a current 2026-27 starting world.
The effects of the already-completed real offseason belong in that initial
state. A later progression workflow must preserve all teams' books and history.

### W12. Team History

Every applied move lands in this world's history with correct detail, and
detail rehydrates after reload. Saved-world history only.

### W13. Compare

Before/after comparison reflects applied moves with correct player display
names, and is world-gated with inline create/select rather than a dead end.

### W14. Guide

The Guide room's guided questions produce next-move guidance in GM language
with no dead ends. (Modest bar: works, honest, presentable.)

### W15. Team Plan Hub

The Team Plan drawer/hub reports the active team, world, and season
identity, save status, moves made so far, pending/unsaved work, pinned
players, draft assets, and cap/roster warnings. Complete when everything it
shows stays accurate and consistent with the saved world — after every
applied action and after reload. (Added by owner decision 2026-07-11.)

## Universal behavior standard

A required workflow is complete only when all six hold, judged in the real
product, not only in tests:

1. **Success is visible.** The action completes from its proven entry point,
   the updated numbers/state appear immediately, and the confirmation reads
   in GM language (no internal vocabulary — see the boundary doc's banned
   list).
2. **Blocked and error states are honest and usable.** Illegal actions are
   fail-closed before apply. The verdict and its reasons are visible where
   the decision is made, without hunting. A blocked state never reads as
   success. The user can fix the problem or back out cleanly.
3. **Applied work persists.** Applied actions write to the saved world.
   Staged-but-unapplied work either survives navigation or the product warns
   before discarding it; silent loss is a completion blocker.
4. **Reload proves it.** After a full page reload (and re-entering the
   room), books, roster, and history are identical to pre-reload.
5. **Rooms agree.** After any applied action, Roster, Cap Sheet, Full Cap
   Table, Team History, Compare, and the Team Plan drawer are consistent —
   including every other team touched by the action.
6. **History and Compare capture it.** Every applied action appears in Team
   History with correct details and is reflected in Compare.

## Deliberate V1 exclusions (owner-decided — not gaps)

- **Ordinary trades requiring unavailable nonzero trade-bonus evidence** —
  moved to Phase 3B by locked owner decision 2026-08-27. When a proposed trade
  requires a nonzero trade-bonus calculation, the product must return an honest
  unavailable/needs-input result before mutation if retained contract evidence
  lacks authenticated bonus basis, allocation/protection schedule, amendment
  state, prior-trade/payability history, payer/reallocation state, or payment
  timing. This exclusion unblocks only when a new immutable contract-source
  release containing all required fields for the affected Contract is retained,
  independently recoverable, hash-verified, and certified for the applicable
  accepted-Canon trade-bonus leaves. Supported ordinary trades that do not
  require a nonzero trade-bonus calculation remain V1 requirements.
- **Draft-night experience** (draft room, Make Pick screen, rookies landing
  on rosters) — parked by owner 2026-07-04. Draft-asset rules (W10) remain
  in scope.
- **Real-life franchise history** in Team History — a saved world shows its
  own history only; never mixed by default.
- **JSON or raw-data entry anywhere in the GM flow** — owner decision
  2026-07-05; the product is operated through normal UI only.
- **Offseason room** — owner decision 2026-07-11: V1 does not ship a
  prominent nonfunctional preview room, so the Offseason room must not
  appear in normal V1 navigation (hiding/parking it is in-scope V1 work).
  The guided Offseason experience and future-season advancement (W11) are
  post-V1. This does not exclude real offseason effects from the starting state.
- **Entitlement and pick authoring controls** — owner decision 2026-07-11:
  hidden from normal V1 GM users (today they are feature-flagged on in
  review builds). Trading existing picks, protections, and entitlements
  through the Trade Machine (W9/W10) remains fully in scope.
- **Post-V1 trade mechanisms** — owner decision 2026-11-10: poison-pill salary
  basis, performance-incentive salary basis and the Disabled Player Exception
  (grant and use). Each must return an honest needs-input result before
  mutation; none may be assumed away.
- **Certified historical NBA legality** — owner decision 2026-11-10: V1 worlds
  are labeled simulations. A certified-history label is optional future work,
  not a V1 requirement.

## Undecided — owner decisions required

The three decisions raised at the 2026-07-11 review (the Offseason room,
authoring controls, and the trade-summary export) were resolved by the owner
the same day and are encoded in the sections above.

Phase 3A (BZE-267) is complete. Its accepted proof of the first-round safe stop
remains valid, but does not satisfy BZE-301's expanded W10 requirement. Nonzero
trade bonus remains a post-V1 needs-input/no-write boundary. Final Architect V1
acceptance remains with the owner under BZE-243. The 2026-11-10 decisions are
the explicit owner decision on the 30 gap-affected entitlements; any further
reduction requires another owner decision.

The remaining-exclusions matrix in
`work/architect-completion/PHASE3A_CLOSURE_EVIDENCE.md` is historical: its
first-round exclusion and pending owner states are superseded by BZE-301 and
this contract. Its safe-stop evidence remains accepted for that behavior only.

## Evidence standard

A required workflow counts as complete only with ALL of the following.
Reuse recent valid proof where it exists (BZE-245 method); re-prove only
what is stale, contradicted, or missing.

1. **Scoped test proof.** Relevant engine + UI suites green per `AGENTS.md`
   (note: `test:architect` skips `.tsx` — component checks need `test:ui`).
2. **Live browser proof.** The flow driven end to end in a seeded saved
   world through the review harness at 1280×720. Tests alone are never
   accepted for browser-visible or saved-world behavior. For Trade Machine
   work after 2026-11-10, the final live scenario battery is that proof;
   individual changes need a browser run only when they change rendered or
   saved-world behavior, and no retained per-change certificate is required.
3. **Persistence/reload proof.** Apply → leave room → return → full reload →
   identical state, verified for every team the action touched.
4. **Realistic data.** Cap surfaces judged at a full 18-man roster (15+3).
   Trade proofs need realistic rosters on both sides — a 3-player seeded
   team is not acceptance-grade evidence.
5. **Presentation bar.** Meets `docs/standards/ARCHITECT_VISUAL_STANDARD.md`
   and the boundary doc's design laws, after an adversarial self-review.
6. **Owner review.** One hosted artifact link per review wave: screenshots
   of every changed state at 1280×720 plus a plain-language summary. Owner
   replies approve / approve-with-notes / reject.

For every CBA-derived amount, threshold, date, percentage, eligibility result,
or verdict in the final battery, the expected result must be recorded before
the product runs, cite the exact pinned accepted-Canon leaf and the governed
source or declared simulation input it depends on, and show independent arithmetic where applicable.
Rendered output, persisted documents, receipts, events, and existing application
calculations are evidence about actual behavior, never the expectation oracle.
Unavailable authority requires a fail-closed expectation, including the
post-V1 needs-input exclusions. First-round safe-stop proof alone cannot close
the W10 requirement.

Final V1 acceptance (parent gate BZE-243): the live scenario battery
(`tests/e2e/architect-qa.spec.ts` in review mode) passes, remaining
exclusions are documented honestly, batched owner workflow review is done,
and the owner explicitly accepts Architect V1.

Standing evidence rules: test-pinned product promises (blocked never reads
as success, required honesty disclosures) get wording updates alongside
design changes — never intent removal — unless the owner changes the
promise. Time-window rules (e.g. the 48-hour offer-sheet match window) are
proven with world-clock-consistent setups, not wall-clock hacks.

## Relationship to other documents

- `docs/agent-guides/architect-boundary.md` — standing scope and design
  laws; still binding. Its status line defers to this contract.
- `docs/standards/ARCHITECT_VISUAL_STANDARD.md` — the presentation bar.
- BZE-243 — the completion gate this contract serves. BZE-245 — the
  reuse-first gap ledger built by comparing main against this contract; the
  ledger lives in `work/architect-completion/`.

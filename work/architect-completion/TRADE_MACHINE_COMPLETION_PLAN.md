# Trade Machine completion: shared capabilities, not individual examples

Owner-directed execution plan, recorded November 5, 2026.
This changes the development approach, not NBA rules, evidence acceptance,
production permissions, or the Architect V1 completion boundary.

## Start here

- [BZE-243](https://linear.app/bzero/issue/BZE-243) is the current status and
  sequencing home. Its latest owner direction overrides historical next steps.
- [BZE-340](https://linear.app/bzero/issue/BZE-340) is the first implementation:
  shared multi-Contract support across already-admitted mixed trades, implemented
  in [PR #613](https://github.com/Bet-Zero/scoutzero/pull/613). Its live PR retains
  the exact candidate, proof, independent review and landing status.
- [BZE-341](https://linear.app/bzero/issue/BZE-341) / [PR #614](https://github.com/Bet-Zero/scoutzero/pull/614)
  addresses shared participants and explicit first-round destinations (C2/C3).
  Its live PR records verification and landing status; C4/C5 and activation stay
  separate. No further trade variation starts automatically after this delivery.
- The [V1 completion contract](../../docs/agent-guides/architect-v1-completion-contract.md)
  defines what must be finished. This plan does not replace or reduce it.
- [BZE-342](https://linear.app/bzero/issue/BZE-342) addresses the established C4
  gap: resolved native selections and separately admitted unobligated originals
  in one transaction. Its [composition assessment](BZE-342_C4_COMPOSITION.md)
  distinguishes existing behavior, incompatible claims/dates and precise missing
  evidence. The live PR records its checks and landing status; broader C4 closure
  is not inferred from this delivery.
- [AGENTS.md](../../AGENTS.md),
  [Architect boundary](../../docs/agent-guides/architect-boundary.md),
  [Phase 3A execution](../../docs/agent-guides/phase3a-execution.md), and
  [independent review](../../docs/agent-guides/independent-review-boundary.md)
  govern execution. Their existing review and proof requirements remain in force.

Verified planning baseline: merged [PR #610](https://github.com/Bet-Zero/scoutzero/pull/610),
main `dc05d2332cd6f43b536dfae4303c49c4c6fc7c56`,
[post-merge CI](https://github.com/Bet-Zero/scoutzero/actions/runs/41846222279).
BZE-339 is Done; completed Phase 3A/BZE-267 stays Done. Refresh live main before
implementation. The unrelated Google sign-in PR #605 is not part of this plan.

## The owner-readable goal

Keep the Trade Machine and CBA work already built. Finish the connections so
supported players, picks, and rights can be combined under their actual rules,
without commissioning a new feature for each example trade. The finished product
must judge the complete deal, save it correctly, and continue the resulting world.
A new example is normally a test; it becomes implementation work only when it
exposes a genuine missing capability, rule, or supported source mechanism.

| Stage | What changes for the owner | Completion evidence |
| --- | --- | --- |
| 1. Complete shared transaction support | Ordinary supported player packages do not become artificially smaller when a pick is included. | General multi-player behavior through validation, saving, receipts, reload and affected lifecycles, not one named trade. |
| 2. Close remaining structural gaps | Supported two- and three-team packages work through shared rules rather than family-specific shortcuts. | Each known restriction has either been removed with proof or tied to a precise remaining rule, evidence or implementation dependency. |
| 3. Complete pick coverage and connect real starting data | The actual retained rights have the required behavior over time, using reliable starting facts and explicitly simulated future outcomes. | Full 278-record coverage with per-action evidence, required transitions and exact disposition of factual blockers. |
| 4. Prove the normal product and finish | The owner can use the ordinary interface, save a plan, return to it and continue it with consistent results. | Required integrated browser/hosted proof, separately authorized release/adoption steps and final owner acceptance. |

These are completion stages, not four giant automatic coding tickets. Work one
coherent capability at a time. Evidence needed by a later stage must be identified
early; do not spend every stage expanding a protected simulator and discover the
real-data delivery requirements only at the end.

## Keep the useful architecture

Preserve the established shared salary/roster/eligibility rules, trade preparation,
execution authority, atomic writer, history readers, draft mechanisms and season
manager. No new parallel engine, generic workflow framework, broad rewrite,
provider migration or speculative cleanup is authorized by this plan.

Keep three responsibilities distinct and connected:

1. **Evaluate a dated situation and proposal.** Use complete qualified or explicitly
   controlled inputs, compute the proposed result, and apply all relevant rules.
   Salary and draft mechanisms retain their own rule ownership. Genuine shared
   constraints, such as apron-related restrictions and resulting team state, are
   still evaluated together. A draft-asset handler must not implement a second
   salary-matching system or impose an unrelated player-count rule.
2. **Commit the complete accepted deal.** Use the existing apply-time checks and
   atomic writer. Re-read/fence the required live state, preserve exact destinations,
   and commit all affected assets/books/history or none. Preview is not permission
   to skip live-state checks. Saving and replay must understand the same proposal
   rather than reconstruct a narrower version of it.
3. **Advance the saved world.** Reuse the same governing rights and recorded
   outcomes for protection/fallback, priority, restriction and season transitions.
   Do not rebuild the trade rules in the season manager. An unknown future outcome
   may be a modeled alternative; an unknown governing rule is a different blocker.

The existing architecture already separates much of this. Extend or simplify only
where a demonstrated limitation requires it. Before changing a shared record,
identify its validation, writing, history, Compare, inventory, export and season
consumers so they are not predictably repaired one by one in later assignments.
Maintain stable original-selection identity, conditional/swap-right identity,
current holder and original allocation as distinct concepts.

The general transaction shape should carry collections of assets with explicit
origins/destinations and unchanged attached terms. Actual supported rules determine
eligibility and limits. Do not replace a one-player special case with a two-player
special case. Do not erase source-family admission limits merely because a generic
collection can describe an unsupported deal.

## Evidence-based capability register

This is a seed from inspected code and accepted records, not a claim that the
entire product has been audited again. Update these rows as their facts change;
use existing evidence rather than add a second database of completion totals.
The code locators below are relative to `src/features/architect/utils/` unless
another path is given. A restriction's presence proves a current boundary, not
permission to remove it or proof that every combination behind it is NBA-legal.

| ID | Current finding and evidence | Disposition |
| --- | --- | --- |
| C1 | BZE-340 / [PR #613](https://github.com/Bet-Zero/scoutzero/pull/613) carries complete ordinary Contract collections through the shared adapter, existing matching/aggregation, explicit routes, atomic saving, receipts and replay. Native/swap records no longer impose a three-player total or one player per sender. Original/protection receipts already retain collections in their existing financial/Contract format. | Implemented across the four currently admitted mixed paths, with several outgoing counts and failure/replay tests. Protected browser journeys cover split destinations, six-player packages and affected lifecycles; the PR records exact-head certification, CI, independent review and landing gates. No normal-product activation, new source/term admission or V1 closure. See [execution evidence](BZE-340_EXECUTION.md). |
| C2 | BZE-341 / [PR #614](https://github.com/Bet-Zero/scoutzero/pull/614) uses `draftReview/transactionRouting.ts` across original/protection, admitted native selection and ordered-swap preparation/replay. Original/protection transactions admit two or three genuine participants; a third participant need not send a player. Complete financial, ownership and post-trade Stepien evaluation includes conditional original obligors. | Shared implementation completed in the PR; its verification/landing record is authoritative. V1 stays at two/three teams. Ordered-swap return ownership, reserved fallback/pool selections, exact source/date admission and native chronology remain. Ranked 2029 has two actual holders and still excludes mixed players; legacy 2027/apron mechanism admission stays bilateral. Those remaining mechanism/proof dependencies are not NBA team-count rules. See [classification and proof](BZE-341_EXECUTION.md). |
| C3 | BZE-341 adds explicit per-first destinations to consideration facts while retaining historical single-recipient facts. The shared writer and receipts preserve each route; native and ordered-swap pick-only exchanges can have three genuine participants when admitted holdings supply the consideration. | The one-first-recipient-per-sender format limit is removed. Whole-deal review replaces independent bilateral decomposition; staged/exported routes, atomic saving, replay and affected-team history use the same destinations. New shared event player routes keep a pick-only participant’s Compare roster accurate; historical records remain readable. Cash sales, invented ownership, self/duplicate/out-of-scope routes and neutral participants remain blocked. Normal-product activation and compatible-right composition are separate. |
| C4 | BZE-342 recovered the retained catalogue, BZE-309 accepted audit and admitted 2028 v2 terms. Existing conditional collections, 2026 options with independent originals, and the internally composed 2028 protection/conveyance/native options remain supported. The confirmed gap is resolved 2028/2029 selections with separately admitted unobligated originals already available as retained Stepien witnesses. | Shared ownership replay now carries those originals with native selections through existing rules, atomic saving and historical views. Admission is frozen before resolution; native terms and allocations do not change. The [assessment and risk contract](BZE-342_C4_COMPOSITION.md) records required combinations and checks. Other unresolved cross-program combinations still need exact current rights, a common date and authoritative overlap/priority/activation terms before implementation; no example queue or complete-C4 claim. |
| C5 | BZE-343 implements the shared existing-Contract acquisition gap: Room across the four admitted mixed paths and assignment to an exact receiving-team-held Standard TPE, using existing rules and atomic exception lifecycle. The selector uses the saved-world date for expiry. | The [restriction assessment and risk contract](BZE-343_C5_ACQUISITION.md) distinguishes actual NBA rules, the approved bonus exclusion, evidence gaps, existing functionality and remaining shared implementation gaps. Saved Room acquisition, actual generated TPE reuse, receipts/export/reload and no-write failures are the scoped proof; the issue/PR records the final exact-head checks and landing. Two-Way, poison-pill, compatible sign-and-trade, other governed exception elections, cash and remaining mechanism admission are not silently completed or declared excluded. |
| C6 | Normal initialization already installs a dated trusted Contract baseline, but does not install a dated draft ownership/obligation baseline. The accepted 278-record read projection includes scoped evidence, not universal current ownership. `draftReview/capability.ts`, `draftPickRealReview.ts` and `tradeMachine/rules/validateStepien.ts` retain protected/normal permission separation. | Next dependency-ready prerequisite: reconcile existing Contract and draft evidence into an action/date admission map for all 278, retaining the exact 29 unresolved mappings. Identify missing custody, obligations/Stepien witnesses, qualified salary books, prior-apron/history and transition fields before publication/adoption/activation. This read-only assessment is actionable now and takes priority over another protected example. See [concrete findings](BZE-343_C5_ACQUISITION.md). Preserve separate owner/release gates and the environment check. |
| C7 | BZE-309 retains exact unresolved dependencies; BZE-329 retains remaining apron/lifecycle boundaries. | Factual and mechanism coverage must be resolved by affected action across all 278, not by more transaction examples. |
| C8 | PR #610 proves reload; its private emulator restart/export recovery is unverified. | Test-environment reproducibility limitation, not evidence of lost application saves. Keep distinct; repair only when it blocks a required workflow or recovery requirement. |

For an examined restriction, record in the existing PR/issue: affected user action,
code/evidence locator, classification, controlling rule or source when applicable,
smallest correction or exact missing input, and completion proof. Classifications
are: implemented/proven; implemented but unverified; required implementation gap;
evidence-blocked; deliberate owner exclusion; or release/owner gate. Unknown is not
implemented, legal, illegal, or out of scope.

## Stage 1: shared multi-Contract support

Implementation is in PR #613. The requirements below remain its acceptance
boundary; they are not an instruction to restart completed work. BZE-341 addresses
C2/C3. BZE-342 implements the established C4 resolved-selection/original gap;
the remaining C4 question is evidence of actual unresolved cross-program
combinations, not another automatically commissioned variation. BZE-343 addresses
the dependency-ready C5 Room/held-TPE integration; other classified C5 needs remain
separate. C6–C7 retain real-data and required
transition dependencies. Do not automatically start another transaction variation.

Execute BZE-340 rather than create a competing issue. Its bounded target is the
currently admitted original-first, protection/fallback, resolved-2028-selection
and unresolved-ordered-2026-swap mixed paths, retaining each path's source, date,
participant and lifecycle boundaries.

Use existing matching/aggregation rules and their applicable financial, apron,
hard-cap, timing and player-eligibility requirements. Trace the player collection
through preparation, schema validation, execution, receipts and replay. Preserve
existing zero/one-player behavior and all affected teams, including nontrading
pool participants. Historical records remain readable without silent rewriting.

The acceptance is shared behavior across those paths, not one successful example.
Use several outgoing counts and destinations in focused tests, including changed
order where order has no meaning. Do not change priority order for ordered claims.
Prove whole-deal rejection and later operations from the saved result. Cover
changed lifecycle dependencies; reuse unaffected accepted mechanism proof.

A narrowly justified implementation split is possible if actual dependencies or
review risk require it, but it must remain under the same capability outcome.
Record the reason and full residual acceptance before proceeding; do not quietly
close the issue after the easiest branch or automatically create family-by-family
children. No new source-family admission is implied.

Exit: the complete bounded capability is reviewed and delivered, its remaining
limits are stated, and C1/BZE-243 are updated with precise evidence. Then select
from the remaining register, not from an untested named transaction.

## Stage 2: complete required transaction composition

Use the Stage 1 dependency map and current code to resolve C2-C5. This is not a
second CBA audit. A team-count or right-type combination is not automatically a
new feature; determine the underlying common missing behavior first.

Where supported terms already establish the necessary rights, complete shared
routing, consideration and receipt/replay support for the required two-/three-team
scope. Where terms do not establish it, preserve a precise needs-input boundary.
Single-program correctness does not prove joint Stepien/claim compatibility;
check relevant possible post-trade outcomes together using the existing engines.
No arbitrary participant ordering may select an asset's recipient.

Preserve supported existing player-only/second-round and other accepted workflows.
The first assignment's exclusions are not permanent exclusions of the product.
Do not expand to four-team trades or new rules merely for abstract generality.

Exit: all required composition boundaries have evidence-backed dispositions;
implemented supported combinations no longer need family-specific player/routing
exceptions without a real governing reason. W9's staging, verdicts, warnings,
export and saved-state requirements have retained or fresh proof as needed.
Evidence-blocked or unimplemented required behavior keeps W9 open; blocked is not
complete. Final normal-mode availability is still a separate check.

## Stage 3: complete lifecycle and real-data coverage

Use BZE-309's existing retained inventory and action/dependency crosswalk; do not
re-audit the entire source corpus or create 278 implementation tickets. Group
records by genuinely shared mechanisms and use current admitted terms and pinned
Canon. Reuse BZE-329's accepted freeze/release/penalty work and identify only its
remaining required coverage. Do not manufacture a hypothetical 2033 pool conflict.

For every retained identity, distinguish its economic role (including archival
aliases), applicable actions, supported terms, implementation, proof, required
transitions and factual blockers. Preserve all 278 identities and lineage;
not every archival representation is a separately tradable right. A digest/count
match is preservation evidence, not a completion percentage.

The exact 29 unresolved mappings are the preserved baseline, not a permanent quota.
Unrelated software work, including BZE-340, must not alter their status. Later
qualification may resolve an obligation only through the established source and
independent-acceptance process, preserving its original identity, previous state,
affected actions and disposition history. Do not drop, relabel or close one merely
because a software demonstration passed.

Complete missing mechanisms/required transitions by family and reuse them across
applicable records. Keep unknown future outcomes separate from missing governing
terms; reason across supported alternatives rather than wait for future NBA games.
Keep a simulated world's own future distinct from later real-world NBA updates.

Identify real-data entry requirements early: the designated starting date,
qualified ownership/obligations and player/financial context, applicable prior
history, authenticated adoption and supported transitions. Use the existing
approved starting scope unless an owner decision changes it. A historical baseline
must be labeled historical, never presented as today's NBA. Do not automatically
refresh sources or backdate later facts to make a proposal pass.

Reuse accepted private sources and locators. For a real gap, record the exact
missing fact, affected actions, last failed route and specific untried route or
unblocking event. Do not repeat exhausted acquisition or lost-inventory searches.
The independently accepted and admitted 2028 v2 is reusable; its old missing file
is not a new recovery assignment. Follow existing qualification policy, not an
invented first-party-only rule or a silent relaxation.

Exit: inventory-wide required behavior and source/action coverage are established,
or exact remaining blockers remain openly assigned. A smaller permanently
certified subset is not authorized. Normal first-round functionality still needs
its explicit adoption/release gates.

## Stage 4: normal product integration and final acceptance

Prepare the normal saved-world path from the qualified baseline through the same
rule and transaction machinery. Do not build a separate standalone product and
later bolt worlds onto it; do not force the owner to enter raw JSON. Preserve
existing/custom histories and supported ordinary behavior without silently
certifying or migrating old worlds.

Verify the real client, existing API and Firebase/Firestore data path. Vercel is
the host, not a replacement draft-data store; Linear is coordination/private
review storage, never a runtime dependency. A deployment marked Ready does not
prove first-round behavior or source qualification. Plan/CI success does not
activate a disabled capability.

Before any source publication/write, first-round activation, new trust pin,
adoption/migration or permission change, identify the exact existing approval
and remaining gate. Obtain an owner-reserved decision where required, consolidated
with the evidence and consequences. No blanket authorization is inferred here.

Use the existing final W9/W10-related scenario battery and affected Architect
rooms: construct, validate, apply, leave/return/reload, make another permitted move,
resolve and advance where required, and verify every affected team. Retain clear
blocking reasons and warnings. Reuse unaffected W1-W15 evidence; do not restart
completed Phase 3A or unrelated UI passes. Batch the existing owner review and
record final acceptance only when actually granted.

Exit: required scope, reliable real starting data, normal product behavior,
persistence, required transitions, hosted proof and owner acceptance all pass.
A single scenario, reviewed component, preserved inventory or safe stop is not
W9/W10/Architect V1 completion.

## Verification without needless repetition

- Stabilize rule, collection, boundary, schema and replay behavior with focused
  automated tests before expensive browser work. Expectations come from governing
  sources/independent reasoning, not from the same application result under test.
- Check asset conservation and unique ownership, exact destination/salary attribution,
  relevant possible outcomes, version compatibility, rejected-operation no-write,
  stale/concurrent state and duplicate requests. Adding an unrelated player must
  not rewrite pick terms; it may legitimately change financial legality.
- Select complete representative browser journeys by distinct changed risk and
  mechanism. Map each claim to its proof and justify reuse of unaffected cases.
  This is not an arbitrary cap on cases, nor a mandate for every Cartesian product
  of team, player count, year and pick type.
- Preserve the existing complete diagnostic, frozen exact-pushed certification,
  independent automated Claude review, selected CI and normal landing gates.
  Required exact-head checks still apply. Do not weaken assertions, expand a
  timeout without diagnosis, or label a failed attempt passing to save time.
- Investigate repeated failures at the smallest relevant layer; distinguish
  application defects, fixture errors and environment failures. Repair a shared
  test helper only when justified by the affected proof. Reuse stable setup and
  unchanged accepted evidence with exact scope/dependencies; no blanket full-suite
  or nightly run just because a session, receipt or example changed.
- Record approximate implementation/check/browser/review time and repeated failure
  causes in the PR. More testing time than coding time is not itself proof of
  waste. Optimize useful capability delivered per verified change.

## Continuity, authority and owner communication

The agent owns technical choices, focused proof, normal automated Claude code
review, in-scope repairs, CI and authorized landing. The user has authorized this
plan and the BZE-340 issue branch/PR; they do not select tests or relay routine
reviews. Maintain one active product implementation at a time. Broader stages are
a roadmap, not permission to silently launch several agents or unrelated tasks.
At each coherent delivery update BZE-243 and select the next actual requirement
under the latest owner direction; do not automatically continue into a variation.

For any needed CBA interpretation the local coding agent must run
`npm run architect:canon:lookup -- <leaf>` and verify the pinned result. This plan,
conversation memory and the working-tree Canon are not substitute authority.
No new CBA interpretation was established by this planning update.

Commit/push verified code checkpoints on the authorized branch before vulnerable
handoffs. Preserve unfinished status and exact next commands if an environment
fails. Irreplaceable private governing inputs need recoverable locators, exact
bytes/size/hash, source identity and independent review in existing authorized
private storage; a local path or hash alone is not a durable handoff. Do not export
raw sources, screenshots, credentials or private reviewer material to public GitHub.
A separate private review is used only for a genuine private-source judgment, not
as the routine code-review path.

Owner updates lead with what works in the ordinary app versus protected testing,
what remains unavailable, and whether the blocker is code, proof, data, access or
owner authorization. Explain the practical next outcome before technical detail.
Do not equate merged code, simulated NBA behavior, source qualification and normal
product availability. Preserve all existing source, history and production gates.

## Scope of the original planning delivery (PR #611)

PR #611 changed only planning, routing and Linear coordination. It changed no
application code, CBA authority, admitted source program, CI/reviewer policy,
production setting, world data or permission. Its next implementation
was BZE-340; C1 above records the subsequent implementation. Vercel
connector deployment inspection returned 403 during planning; no deployment or
configuration change was attempted, and hosted product behavior is not newly
verified by this update. That access limitation does not become a new setup lane.

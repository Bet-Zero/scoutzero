# Trade Machine completion: shared capabilities, not individual examples

**Owner-directed execution plan, 2026-11-05.** This changes how the remaining
work is organized, not the required product or its acceptance safeguards.
[Architect completion](https://linear.app/bzero/issue/BZE-243) is the current
status home. [BZE-340](https://linear.app/bzero/issue/BZE-340) is the first
implementation assignment; this document is not a claim that it is delivered.

## Owner view: what we are doing

Keep the existing Trade Machine, CBA rule reference, saved worlds and completed
draft mechanisms. Finish the connections between them so supported assets can
be combined without requiring new code for each named trade.

| Outcome | What it means | Completion signal |
| --- | --- | --- |
| 1. Finish the shared player connection | Sending another eligible player with a pick should use the existing salary rules, not hit a one-player-only implementation limit. | Multiple-player packages work through checking, saving and reload across the already admitted mixed paths. |
| 2. Finish required combinations of supported assets | Two or three teams, explicit destinations and compatible pick/right mechanisms work through one complete transaction. | Confirmed structural restrictions are removed or tied to a real rule, source limitation or approved exclusion; examples alone cannot close this outcome. |
| 3. Finish draft obligations and their evidence | Every retained first-round record has the correct meaning, applicable behavior and supported consequences over time. | All 278 identities are accounted for with their required behavior; unresolved facts have accepted dispositions, not guessed answers. |
| 4. Make it usable in ordinary saved worlds and accept the product | Qualified NBA starting information feeds the same machinery that supports user-created futures. | Authorized normal-product operation, historical compatibility, final integrated proof and owner acceptance. |

The first task is **not** another calculator or a rewrite. BZE-340 completes a
shared capability. Later work is selected from the remaining requirements
below, one coherent assignment at a time. Software, evidence and release work
have different completion conditions; none may hide behind another.

A hypothetical future is allowed to differ from real NBA history. Once a
qualified starting state is established, valid user actions and explicitly
governed simulation outcomes create its subsequent state. Do not demand real
NBA confirmation of each hypothetical choice. Unknown future lottery results
are not the same as missing protection or priority terms.

## Authority, scope and records

Read [AGENTS.md](../../AGENTS.md), the
[Architect boundary](../../docs/agent-guides/architect-boundary.md),
[Phase 3A execution profile](../../docs/agent-guides/phase3a-execution.md) and
[unchanged V1 contract](../../docs/agent-guides/architect-v1-completion-contract.md).
W9 is the usable trading workflow; W10 is complete draft-asset behavior. W11,
History, Compare and Team Plan remain relevant consumers, not new projects.

The accepted CBA Canon and Phase 3A foundation remain governing and Done.
For actual CBA decisions, the local coding agent must use
`npm run architect:canon:lookup -- <leaf>` against the pinned accepted object.
This plan neither interprets a new CBA rule nor replaces that lookup with the
working-tree Canon, conversation memory or a test expectation.

Record detailed implementation and evidence in the PR; put concise current
outcome, blocker and next-step updates in BZE-243. Keep this plan's capability
register current at meaningful boundaries, not after every command. Exact
private sources, per-record evidence and inventories remain in their existing
authorized private homes. Do not build a duplicate public evidence database.

The owner's direction authorizes this plan and ordinary scoped implementation,
in-scope repairs, issue branches/PRs, proportionate checks, required independent
review and normal landing through the existing gates. It is **not** blanket
approval for production first-round activation, source publication/writes,
world migration, credentials/permissions, paid services, new providers,
subjective redesign or reduced product scope. Existing operation-specific
owner approvals remain in force only within their recorded boundaries.

## Verified starting point and evidence reuse

Baseline inspected: main `dc05d2332cd6f43b536dfae4303c49c4c6fc7c56`, following
[PR 610](https://github.com/Bet-Zero/scoutzero/pull/610). BZE-339 is Done;
[post-merge CI](https://github.com/Bet-Zero/scoutzero/actions/runs/41846222279)
and the subsequent scheduled main run passed. Refresh live state on entry;
this SHA is evidence, not an instruction to reset newer work.

Reusable foundations include the shared financial validators, routed trade
proposal, five-stage apply checks, atomic writer, saved receipts and season
manager. Preserve the admitted 2028 v2 terms and historical-only receipt
verification. The source-recovery/requalification work is not reopened.

Retained protected workflow evidence: original-first/player trades (PR 602),
protection/fallback/player trades (604), 2028 allocation and retrading (606),
two/three-team resolved-selection/player trades (607/608), and two/three-team
unresolved-swap/player lifecycles (609/610). The 2029 resolved-selection path
(601), ordered swap foundation (592) and second-apron work (593/595/597) remain
reusable within their actual scopes. These are not universal NBA-data or
production-readiness certifications.

PR 609's missing separate post-merge run remains an honestly recorded
historical limitation; do not manufacture an unrelated full-suite run. PR 610
proved browser reload, not private emulator shutdown/export/restart recovery.
That distinction must remain visible; it does not establish application data
loss or justify a new world-system redesign.

## Design commitments for the remaining implementation

1. **One set of basketball rules.** Reuse the existing salary, apron, hard-cap,
   eligibility, timing, roster, ownership, claim and Stepien evaluators. Do not
   copy salary calculations into draft-family handlers. Real financial/draft
   interactions still apply; these checks are separate responsibilities, not
   unrelated decisions.
2. **One complete proposal.** Represent the actual collection of outgoing assets
   and explicit recipients using the existing shared contracts where possible.
   Keep player identity, Contract identity, original selection, right,
   beneficiary/current holder and governing terms distinct. Group a restriction
   with its actual rule or admission basis, not a demonstration's team names.
3. **Separate judging, committing and advancing.** Evaluate a dated proposal
   without saving; commit all accepted changes together; advance the world with
   the same asset meanings. Preview and Apply share rule ownership while Apply
   rechecks live state. Do not pretend preview can replace live concurrency,
   duplicate-ownership or stale-state checks. Do not build a second standalone
   trade engine and later retrofit worlds.
4. **General structure, justified admission.** Collections and saved formats
   must not acquire arbitrary one/two-player ceilings from a sample. Existing
   source/date/family restrictions are not removed merely because the structure
   can represent a wider proposal. Two/three-team V1 scope is not an invitation
   to invent four-team scope or unspecified rights.
5. **Maintainability through focused repair.** Inspect the actual dependency
   chain; consolidate repeated assumptions when they cause the demonstrated
   gap. Keep interfaces compatible with required transaction shapes. Preserve
   authentic old receipts without rewriting old worlds or making historical
   authority valid for new actions. No blanket rewrite, new generic framework,
   cosmetic cleanup or speculative future-proofing is required.

## Capability register: the finite remaining questions

These rows track mechanisms and integration boundaries, not every possible
team/player/right permutation. Distinguish **implemented**, **verified**,
**evidence-qualified** and **available in the normal product**. A positive
controlled-world test establishes only the claims and environment it covers.

| ID | Requirement / observed boundary at baseline | Classification and treatment | Home |
| --- | --- | --- | --- |
| T1 | Multiple outgoing ordinary Contracts are rejected in the newer mixed path; aggregation already exists in general matching. | Confirmed integration gap. Complete collections, matching, saving and replay together across current mixed paths. | BZE-340 |
| T2 | Two/three-team admission varies by family; a sender's listed firsts require one recipient. | Confirmed structural restrictions. Establish which wider routes the accepted contract and qualified inputs require, then repair shared routing; do not simply delete guards. | BZE-243 after T1 |
| T3 | Mixed matching-path/Contract eligibility differs from otherwise supported ordinary trades. | Reuse T1's aggregation work; classify remaining Room, exception, Two-Way, sign-and-trade or special-salary integration only against existing V1 authority and evidence. Neither automatically add scope nor turn a tranche exclusion into a permanent product exclusion. | BZE-243 |
| T4 | Native receipt representations exclude simultaneous protection/swap programs; mixed native support is narrower than selection-only support. | Confirmed representation/admission boundary; exact required combinations remain to be established. Prove compatible mechanisms against one date/state and complete claim dependencies before admission. Group shared causes, not separate team examples. | BZE-243 |
| T5 | Verdicts, staging, export, atomic save and cross-room reads have accepted bounded proofs. | Reuse accepted behavior; verify changed consumers and subsequent legal actions. A new combination is not automatically a new UI project. | Active implementation PR |
| D1 | Protection, fallback, ordered claims and native allocation work in documented families. | Map remaining required terms/branches/transitions across the retained universe to existing mechanisms; implement genuinely missing mechanisms only. | BZE-309 / BZE-243 |
| D2 | Freeze/release/penalty lifecycle and placement have accepted bounded implementations. | Reuse BZE-329. Complete required remaining coverage and supported interactions; do not invent hypothetical 2033 pools or tie authority. | BZE-329 |
| D3 | Full 278-record behavior, including claims/conflicts and rookie-scale money, is not established by identity preservation. | Reconcile applicable operations per identity in the existing private coverage inventory; include a justified non-applicable/archival disposition rather than minting rights. | BZE-309 / BZE-243 |
| E1 | Exact 29 factual dependencies remain unresolved at baseline. | Keep identity, lineage and affected-action mappings; obtain accepted evidence where possible. Unknown future outcomes remain separate from missing terms. | BZE-309 |
| R1 | Positive first-round permission remains tied to protected review worlds; normal real-data review blocks Apply. | Required source-to-world/admission implementation and release work, not a flag flip. Qualify dated starting information and use the same trade/world machinery. | BZE-243 with BZE-309 |
| R2 | Historical worlds and final normal-product acceptance remain separate obligations. | Preserve read compatibility; no silent migration. Prove the intended authorized normal entry and final W9/W10 consumers before owner acceptance. | BZE-243 |
| O1 | Private emulator restart recovery remains unverified for the latest certificate. | Development-continuity limitation. Use existing recovery procedures when needed; do not confuse it with passing browser reload or reopen cloud setup by default. | Existing cloud runbook / relevant PR |

Starting code locators: `draftReview/simulationPlayers.ts`,
`simulationReview.ts`, `nativeTrading.ts`, `swapTradeReview.ts`,
`src/schemas/draftNativeTrading.ts`, `draftPickReviewMutation.ts`,
`tradeContext/tradeExecutionAuthority.ts`, and `draftPickRealReview.ts`.
Paths under `draftReview/` and `tradeContext/` are within
`src/features/architect/utils/`. These are inspection starting points, not
instructions to replace each file. The general salary-path tests live in
`tests/trade/tradeSalaryMatchingPaths.test.ts`.

For each unresolved row, retain the applicable product requirement, actual
code/source restriction, affected consumers, reusable evidence, missing proof
and next executable outcome. If already supported code lacks proof, verify it;
do not reimplement it. If evidence is missing, do not call that a code defect.
The register may be corrected with evidence, not expanded by speculative polish.

## Execution sequence and exit conditions

### 1. Complete shared ordinary-player consideration: BZE-340

Complete multiplicity across the four currently mixed-admitted paths: original
firsts, supported protection/fallback programs, resolved 2028 selections and
unresolved ordered 2026 swaps. Use existing Standard TPE, Room and Aggregated
Standard TPE rules only where actually applicable. Preserve each path's current
source, date, participant and lifecycle admission. Do not silently widen the
2029/apron lanes or unrelated Contract routes in this assignment.

Start with a short map of cardinality assumptions and affected consumers in the
PR; then implement. Support a collection, not a fixed two-player exception.
The complete route must agree from proposal and salary evaluation through
atomic save, receipts, History/Compare and reload. Preserve zero/one-player
behavior where currently supported. An illegal component must reject the whole
operation. Validate compatibility with already-saved receipts and a later
permitted transaction or affected lifecycle transition.

Exit: tests establish shared behavior across the admitted paths and their
allowed team counts; representative complete journeys prove affected user
behavior. Required review and landing gates pass. Update T1 and identify
residual T2-T4 requirements without claiming W9 or V1 complete. The issue owns
the detailed acceptance criteria; do not replace them with one named example.

### 2. Close required shared composition gaps, not a variation backlog

Use the T2-T4 findings to select the next largest coherent change supported by
common inputs, state and review. Explicit multi-recipient asset routing,
participant counting and compatible multiple obligation sets are capability
questions. Do not schedule one ticket per protection number, team or family.

Before widening a restriction, show whether it is an NBA rule, retained-source
condition, deliberately approved exclusion or temporary implementation limit.
Any separate simultaneous-program work must preserve correlated outcomes,
priority, aliases and Stepien consequences across the complete proposal; a
series of independently passing pick checks is not sufficient.

Exit: every required transaction shape has either positive implementation and
appropriate proof or an exact outstanding evidence/authority dependency. A
blocked required case is not completion. No supported ordinary behavior is
lost merely because a first-round asset is present. Unresolved rows remain
visible instead of being hidden by a broad "supported trades" label.

### 3. Complete lifecycle coverage and factual qualification

Use the existing BZE-309 private inventory and accepted source records; do not
repeat the whole CBA or draft-source audit. Connect all 278 retained identities
to applicable mechanism, supported actions, required transitions, evidence and
proof. Keep the actual economic rights distinct from archival representations.
Group missing behavior by mechanism/dependency, not by individual record.

BZE-329 retains second-apron lifecycle obligations. BZE-309 retains the exact
29 unresolved questions and their affected actions. Preserve that baseline;
only independently accepted new evidence may change a current disposition.
Record predecessor/new identities and the reason for each change. "Keep the
29" means do not lose or silently waive them, not leave resolved questions
permanently marked unresolved. This plan itself closes none.

Assess actionable source blockers before expensive affected verification. Reuse
retained qualified evidence and pursue only an untried route, changed evidence
or a concrete reason to revisit an earlier search. Independent implementation
may proceed where those facts are irrelevant; final completion still requires
the full contract. Complete future alternatives do not require the actual
future outcome to be known now. Missing governing terms do block that action.

Exit: complete applicable lifecycle coverage and evidence dispositions satisfy
W10 without reducing its 278-identity scope. Identity counts or safe rejection
alone cannot satisfy the exit. Required failures, actual NBA prohibitions and
legitimate future-pending outcomes are distinguished from missing functionality.

### 4. Admit the qualified starting state and prove the normal product

Do not defer discovering the real-data admission requirements until all test
scenarios are finished. Keep R1's exact prerequisites visible during earlier
work; prepare the source-to-world connection when its inputs are ready.
Use a coherent, qualified starting date rather than silently calling historical
captures current. User-created future actions follow the same rules and saved
state; approved scenario inputs stay labeled assumptions, not NBA facts.

Reuse Firebase/Firestore and the existing release/adoption mechanisms. Linear
is private evidence/coordination, never a runtime data provider. Vercel hosts
the application, not a substitute draft-data store. Keep separate explicit
gates for source publication, production first-round activation and any
existing-world adoption/migration. Read-only preparation is not activation.

Before requesting a reserved approval, prepare one precise action, affected
release/world scope, evidence, compatibility consequences and recovery approach.
Do not ask the owner to choose tests or relay routine reviews. When approved,
prove the actual deployed normal entry with the intended qualified data; a
deployment success or emulator certificate alone is not that proof.

Exit: W9/W10 meet the unchanged completion contract, other affected Architect
rooms agree, the final source-derived acceptance battery passes, deliberate
exclusions are accurately shown, batched owner workflow review is complete and
the owner explicitly accepts V1. Reuse unaffected W1-W15 proof; do not reopen
accepted unrelated workflows. BZE-243 remains open until that point.

## Verification that earns its cost

Plan proof by changed claims before coding. Build independent expectations
from pinned rules/qualified terms, not by copying application output.

- **Focused rule and structure checks first:** cover amounts and boundaries,
  multiple outgoing counts, allowed matching paths, explicit recipients,
  duplicate identities, missing authority and meaningful shared combinations.
  Use parameterized/generated cases where useful, with independent expected
  results. Reordering participants/assets must not change results when the
  order has no meaning; never reorder actual claim priorities as an invariant.
- **Transaction and lifecycle checks:** prove all-or-nothing writes, stale and
  concurrent rejection, correct current holders versus original identities,
  receipt compatibility, replay and subsequent actions. Revalidate changed
  season/resolution dependencies; preserve unaffected accepted proof.
- **Representative complete browser journeys:** cover each changed rendered,
  saved-state and cross-room risk using realistic rosters and all affected
  teams. Do not replay every arithmetic or team permutation in the browser.
  The existing diagnostic-before-freeze and exact-candidate certification
  policy remains controlling; this plan removes no mandatory proof.
- **Review and CI:** use diff-selected checks and automated independent Claude
  review for consequential implementation. After repairs, rerun affected proof
  and bind evidence to the actual candidate. A narrow fix does not justify an
  unrelated full suite; a broad risk does justify broader relevant checks.

Do not remove assertions, weaken no-write conditions or extend arbitrary waits
to produce green results. Diagnose whether a failure is product behavior,
incorrect expectations, test setup, environment or access, then repair its
actual cause. Keep implementation time, test setup/repairs, diagnostics,
certification, CI and review waits separate. A long test is not automatically
waste; repeated avoidable setup and redundant scope are the optimization target.

## Continuity, ownership and stopping

Use one lead and one active coherent implementation at a time. Reuse existing
issues; create a child only for a demonstrated executable requirement. Do not
turn every capability-register row or test case into a ticket. The default next
assignment is BZE-340, not a new audit or process-infrastructure project.

Commit and push meaningful verified checkpoints to the authorized issue branch
before lengthy checks when safe. Preserve unrelated work and accepted baselines.
If an environment fails, inspect recoverable work first; do not claim lost test
results validate rebuilt code. Use the durable issue/PR checkpoint, not an
unlocated private session. Irreplaceable governing inputs need exact inventory,
retained bytes and independently verified recovery in existing authorized
private storage; public GitHub must not receive those source bytes.

At each completed capability, report in product language: what can now be done,
where it works (controlled development or normal product), what was checked,
what remains, and the next dependency-ready outcome. Do not use record counts,
test counts or PR counts as a product completion percentage. Replace the current
BZE-243 summary rather than accumulating competing "next" instructions; retain
older decisions as clearly historical evidence.

Agents own routine technical choices, repairs, tests, review and authorized
landing. Stop for a genuinely missing input, unavailable required execution or
review capability, reserved owner decision, material architecture/data change
or failed mandatory gate. Do not self-approve an unresolved source or redefine
acceptance to get past the stop. No new automation/provider, broad refactor,
paid infrastructure or owner-operated review workflow is implied by this plan.

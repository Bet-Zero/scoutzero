# BZE-341: shared participants and destinations

Base: `112a1bad1ff19bf9d3bc964fb7442293e41d2174` (accepted PR #613).
The unchanged V1 contract requires two/three-team trades. C4, C5, real-data
adoption and activation are separate. This record is a risk/implementation map;
the implementation PR will retain actual checks, review and landing evidence.

## Restriction classification before implementation

- **NBA rules:** pinned Canon A12.1 current ownership, A12.2 no first-round cash
  sale, A12.3 every possible post-trade Stepien outcome, and A12.4 frozen picks.
  Local accepted-pin lookups passed. Existing salary/aggregation/apron/timing
  engines remain the authority for the complete player package.
  Authority pin: `6cf8aaf358c158a88e630e8a7336f7e9c3febc17`, artifact SHA-256
  `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.
- **Source admission:** exact catalogue, dates, family terms and unresolved
  dependencies remain. An ordered swap receiver must hold its specified return
  selection; underlying pool selections cannot be traded with that option.
  Resolved native selections require authenticated resolution and chronology.
  Protection fallback stages remain reserved, never separately tradable assets.
- **Product safeguards:** two/three distinct participating teams (V1 scope),
  explicit non-self destinations, complete noncash give/receive participation,
  unchanged identities/terms, all relevant post-trade branches, complete financial
  evaluation, stale-state fences and one atomic write. No four-team expansion.
- **Implementation limits:** `simulationInventory.ts` and `simulationReview.ts`
  restrict original/protection paths to two teams. Native replay and swap review
  require a player merely to admit a third participant. These shape restrictions
  are not NBA rules. `DraftPickConsiderationFactZ.recipientTeam` represents only
  one destination for all outgoing firsts; the preparer rejects otherwise-valid
  split routes to fit it. Add explicit per-selection routes while retaining the
  historical single-recipient representation and whole-package evaluation.
- **Separate remaining coverage:** 2029 native mixed-player admission requires
  its financial/lifecycle integration and remains outside this routing change.
  Apron-mode expansion remains with its mechanism proof. The historical
  `conditional-2027` mode retains its fixed branch example and bilateral admission
  for compatibility; supported general protection/fallback routing now uses the
  existing `protection-programs` mechanism with two or three participants.
  Source qualification, cross-program combinations and new player mechanisms
  are not inferred from a more expressive route record.
  The ranked 2029 pool allocates its three selections to two holders. Shared
  routing does not supply a third team with return consideration it does not
  own; its mixed-player boundary still applies. The newly usable three-party
  native selection-only exchange is demonstrated with admitted 2028 holdings.

## Consumers and intended proof

Trace preparation, inventory admission, consideration/Stepien components,
capability handoff, existing trade validator/writer, saved receipts/native replay,
conditional outcomes, History/Compare, inventory, Team Plan and export. Evaluate
complete post-trade ownership, including conditional obligors even when they do
not send a first in the current transaction. Preserve BZE-340 collections.

Consequential legality/persistence risk: focused route, schema, whole-branch,
historical replay and malformed/stale/duplicate failure checks first. Browser
journeys will cover three-team original split routing and conditional conveyance
and fallback, full affected-team save/reload and later actions. Reuse unaffected
accepted salary/source/lifecycle evidence with its actual boundary. Existing
diagnostic, frozen/pushed certification, CI and automated Claude ACCEPT apply.

Preservation scope is the admitted catalogue's exact original 278 IDs and exact
29 unresolved records, plus governing source pins and the unchanged V1 contract.
Capture membership from the authenticated original input before browser seeding;
compare the same set after operations and disclose private review limitations.
No private source bytes or test assumptions become production authority.

## Implementation and verification record

Implementation PR: [#614](https://github.com/Bet-Zero/scoutzero/pull/614), under
[BZE-341](https://linear.app/bzero/issue/BZE-341). The PR retains final candidate,
certification, CI, independent review and landing receipts; this document does
not substitute for those gates.

The shared routing checks replace the artificial shape restrictions. Preparation
uses the whole resulting ownership/obligation state and the existing financial
engine. Consideration facts carry one destination per outgoing first, while
historical single-recipient facts remain readable. Native and ordered-swap replay
use the same participant/route checks; source-family admission stays explicit.

Two affected-team consistency defects were repaired within this boundary:

- Conditional resolution events include governed participants in their history
  index, so a pick-only third team's Compare chain includes the intervening
  outcome. Custody writes remain limited to changed holders.
- The existing player persistence manifest supplies exact routes to new shared
  trade event metadata. History normalization and Compare classify only the
  active team's player movements. A pick-only participant no longer shows the
  other teams' players as removals. Historical events without routes retain their
  prior interpretation; malformed modern routes produce unavailable comparison
  data rather than fabricated movements. No historical record is rewritten.

Focused author checks pass 492 tests in 22 suites across consideration schemas,
whole-deal preparation/Stepien, native/swap routing and replay, finite scope,
conditional history/Contract continuity, player-route receipts and comparison.
The existing workflow-tooling suite passes 50 tests. Typecheck, generated-schema
checks, focused source lint and documentation checks pass. Final-head hosted CI
is independently recorded in the PR; checkpoint checks are not represented as
checks of a later head.

The complete browser suite exercises:

1. Three-team original-first split destinations without players: staging,
   validation, export, atomic save, all-team views/reload, and a return trade.
2. Three-team protection with six ordinary Contracts, split first destinations,
   and a pick-only participant: immediate conveyance and protection/fallback,
   saved rosters/books/rights, resolution, season advancement and reload.
3. The complete failure/no-write matrix, including third-team financial/stale
   state, an adverse conditional branch despite incoming consideration,
   ownership/term/Contract forgery, invalid outcomes and concurrent operations.

Diagnostic failures were used to repair the affected behavior before freeze.
Browser setup waits for each selected team to finish loading before selecting
another. Duplicate preparation of the same proposal was removed: staging is
followed by one UI validation and a complete no-write assertion. Stale-state
probes reuse an unused prepared snapshot, restore each document exactly and
require the stale-state reason; none of the failure cases was removed. The
original-only journey compares stable player membership/Contract terms, all
three financial books, exact player overrides and authoritative Contract
baselines, rather than incidental normalized display keys.

The mixed-conditional certification wrapper now has the existing one-hour budget
used by other complete multi-team suites. The four existing case bounds total
45 minutes before harness startup/teardown; measured complete workflows exceed
the former 30-minute aggregate budget. Individual 600/900-second limits and all
state/no-write assertions remain unchanged. Lightweight diagnostics precede
clean, pushed, exact-head retained certification; failed runs are not acceptance.

Optional CodeRabbit review was unavailable under its repository eligibility
policy. Optional Codex review completed without findings at `9ce9776e`; later
changes are not represented as covered by that review. Automated independent
Claude review remains required, with its exact candidate and limitations in the
PR. Private emulator artifacts are author evidence, not public source authority
or independently hosted proof.

The captured original input comparison passes exact 278-ID membership, exact
29-record unresolved equality and the unchanged complete catalogue hash. The
browser cases also check unchanged source documents and retained terms. Source
pins, the V1 contract, production settings and access rules have no diff.

## Remaining shared requirement

C4 compatible-right composition is next: establish which retained programs can
coexist in one complete transaction and how their actual claims interact, then
connect supported combinations through this shared machinery. Separate C5 player
mechanisms, remaining source/lifecycle evidence and normal-product activation
stay open. This delivery does not start another variation or follow-on issue.

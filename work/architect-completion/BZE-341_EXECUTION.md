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
  Apron/legacy conditional-mode expansion remains with its mechanism proof;
  source qualification, cross-program combinations and new player mechanisms
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

## Author checkpoints

Implementation PR: [#614](https://github.com/Bet-Zero/scoutzero/pull/614), under
[BZE-341](https://linear.app/bzero/issue/BZE-341). Verification is in progress;
this checkpoint is not independent acceptance or delivery.

The first focused run passes 270 tests across 10 relevant suites. Two additional
integration regressions cover conditional-resolution history routing for a third
participant under both outcomes. The browser exposed that missing history index:
custody and season saving were correct, but the third team's Compare receipt
chain lacked the intervening conditional result. Resolution events now carry the
governed participants as history dependencies; actual custody writes remain
limited to changed holders. Existing historical receipts are not rewritten.

Diagnostic iteration also caught a receiving-team Stepien request incorrectly
listing other teams' outgoing firsts, and a compact-card selector using a hidden
player image. The first is repaired with a separate empty-outgoing affected-team
entry into the same branch engine; ordinary outgoing ownership/transfer requests
still require actual assets. The second reuses the established compact name
selector. Failed diagnostics are not certification evidence.

The expanded fallback diagnostic reached the final lifecycle checks but exceeded
the unchanged 600-second case budget. Trace inspection measured approximately
80 seconds in duplicate preparation of the same proposal. The journey now stages
before its single UI validation and checks the entire world remains unchanged
after that actual UI preparation. API failure/no-write checks remain separate.
No assertion of final state, participant consistency or failure behavior was
dropped and no timeout was increased. A subsequent environment restart interrupted
the remaining run; it is not counted as passing evidence.

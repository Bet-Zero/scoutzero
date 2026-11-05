# BZE-340: shared ordinary Contract collections

Implementation: [PR #613](https://github.com/Bet-Zero/scoutzero/pull/613).
The live PR is the authority for final candidate, certification, CI, independent
Claude verdict and landing; this record does not pre-claim those gates.
Complete author browser diagnostics passed before final freeze: native resolved
selection, both conditional outcomes, and all three swap cases (exercise, waiver
and the full failure/concurrency matrix).
Base: `1e446835ccf13f484abd287b2fa31808c090a3b0`; its hosted CI passed.
The current completion plan and unchanged V1 contract govern this assignment.

## Restrictions removed and consumers checked

- `draftReview/simulationPlayers.ts` now handles every outgoing Contract and
  accepts the existing Aggregated Standard TPE election. Exact salary-map
  cardinality, live Contract authority, unique player/Contract identity, explicit
  destinations and current branch admission still apply to the whole collection.
- `src/schemas/draftNativeTrading.ts` and `draftPickReviewMutation.ts` no longer
  cap saved player movements at three. Native replay and swap receipt validation
  no longer require a unique sending team per player. Unique player/Contract
  identity, genuine participant consideration and self-route rejection remain.
- `simulationReview.ts` already constructs full consideration and fences every
  source player and destination override. The existing handoff and atomic writer
  commit the complete player manifest. `nativeTradeApply.ts` and
  `conditionalWorld.ts` compare full saved movement/Contract/event collections.
  History, Compare, roster/cap books, inventory, Team Plan and export consume those
  collections without additional count restrictions.
- Original-first and protection transactions retain their existing generic
  `playerIds` and financial/Contract receipts. Native and swap transactions retain
  structured player movements. No migration, new receipt format or historical
  reauthorization is necessary; omitted historical fields stay omitted.
- Existing salary matching, aggregation, apron, hard-cap, timing, eligibility and
  roster rules own legality. No salary formula was added to draft handlers.

## Author verification and preserved authority

- 256 focused tests passed across collection preparation, native/swap schemas and
  replay, original-first retained preparation, salary paths, apron, aggregation
  and timing. Counts 2, 3 and 5, both admitted participant counts, reordered
  collections, split destinations and late invalid members establish collection
  behavior beyond the browser examples. Missing/forged salaries, authority,
  Contracts, duplicate identities and routes remain blocked.
- Typecheck, generated-schema check and build passed. The selected hosted CI
  covers the complete diff; its exact final receipt is linked from the PR.
- Diagnostic browser journeys cover a three-team resolved-2028 trade with two
  outgoing players from one team sent to different destinations, all-team reload
  and later selection retrade; and both conditional conveyance/fallback outcomes
  with three outgoing players per team, aggregation, cap consequences, complete
  saved books/Contracts and season advancement. A corrupted later member blocks
  the whole season operation without writes.
- The five-player three-team swap journey exercises both exercise and waiver,
  all affected participants, continuing Contracts and season/reload behavior.
  The existing `--three-team-swap` wrapper is the retained exact-head certificate,
  including its full negative/stale-operation matrix. Diagnostic runs are not
  certification. Exact candidate/artifact identities and outcomes remain in the PR.
- Unchanged original-first/lifecycle/source-admission evidence is reused within
  its accepted boundary. The full native negative matrix is not repeated solely
  to refresh a receipt; affected collection failures have focused tests and the
  selected end-to-end cases. No blanket re-audit of CBA or retained sources.

Local Canon lookup used the accepted pin
`6cf8aaf358c158a88e630e8a7336f7e9c3febc17` for A02.4/A02.5 aggregation and
matching, A02.12 apron allowance, A05.10 Row H and A03.3 postseason salary basis.
These rules were reused, not reinterpreted or rewritten. Exploratory browser
fixtures correctly failed on unsupported bonus/option/protected-salary inputs;
the fixtures were corrected to eligible existing Contracts. No source facts or
eligibility rule were changed to admit them. The conditional Apply wait now uses
the existing native/swap 120-second bound for complete validation, preserving the
same enabled-state and result assertions. The swap roster display assertion now
follows each actual incoming collection instead of assuming every exchange leaves
every team at fifteen standard players. Its complete rerun passed all three cases.

All 278 identities and the exact 29 unresolved mappings remain intact. The
authenticated catalogue, Contract-source pins, V1 completion contract, production
permissions and activation checks are unchanged. Existing private source locators
from the accepted replacement-program document and catalogue attachment were
reused; their contents were not committed or published.

## Product boundary and next requirement

A GM can compose multiple eligible outgoing ordinary Contracts alongside the
currently admitted draft assets, using existing financial rules, and continue
the saved world with the full package. This is protected testing capability;
normal-product first-round Apply and qualified real-NBA starting-data adoption
are separate gates. It does not establish arbitrary combinations of rights.

Original/protection paths remain bilateral; resolved 2028 and ordered 2026 swap
paths retain their existing two/three-team scope. C2–C5 retain participant,
first-round destination, cross-program composition and additional player
mechanism restrictions. C6–C7 retain real-data release, exact unresolved mappings
and remaining required apron/lifecycle coverage. W9, W10 and V1 stay open.
The next recommended requirement is shared participant/destination and compatible
right composition under the existing contract, with the actual admission and
data dependencies identified before implementation. No next variation is started.

## Risk and proof contract

Consequential legality/persistence change: focused collection, schema, replay,
salary and reader tests first, including multiple counts, split destinations,
reordering, duplicate identities and invalid/missing inputs. All four admitted
families and their existing participant counts remain the bounded scope.
Representative complete browser journeys must establish whole-world no-write,
atomic save, all affected teams, navigation/reload, export and a later action;
protection and swap lifecycle dependencies receive affected proof. Reuse
unchanged accepted evidence explicitly. Preserve all 278 original identities and
the exact 29 unresolved mappings from the admitted catalogue, separately from
new test worlds or artifacts.

Use the existing diagnostic then frozen/pushed certification route, selected CI,
independent automated Claude ACCEPT and normal authorized landing checks. Source
pins, NBA facts, production activation, permissions and unrelated work remain
outside this change. The PR is the detailed evidence and timing record.

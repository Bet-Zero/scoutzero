# BZE-318 — inventory membership and history trust

## Cloud resumption and declared risk contract

October 3, 2026: clean cloud checkout, origin/main and live main verified at
`4406cb55a70f21b4bae13488691b598ee1e96efe`; hosted CI34746128692 passed.
No BZE-318 branch, dangling commit, local modification or prior local execution
record was recoverable here. The September 13 plan references a local record
that is unavailable; its contents are not reconstructed. Accepted BZE-310–317
are reused. BZE-318 remains the existing active issue.

Controlling observations recovered from durable acceptance receipts:

- [PR538](https://github.com/Bet-Zero/scoutzero/pull/538#issuecomment-5651035995):
  “collection membership beyond consumed documents must be addressed before any
  non-synthetic/live path (new unreferenced document currently does not block)”.
- [PR540](https://github.com/Bet-Zero/scoutzero/pull/540#issuecomment-5652040581):
  “client-authored history linkage is not server provenance (future
  trust-boundary assessment)”. Original private Claude reports are unavailable
  in this cloud; these durable receipts establish the accepted observations.

Risk class: transaction/persistence and authenticated-client trust boundary.
Concrete A counterexample before repair: prepare the legal pinned trade, add a
second entitlement claiming its original first using owner permissions without
changing an already consumed document, then commit the old review. Smallest
proof uses the actual browser SDK, production rules in a demo emulator, and
existing mutation writer. Check additions, removals, reassignment, races after
transaction reads, competing trades, retry, no partial event/ownership/stats,
and the unchanged legal and default-blocked controls.

Implemented candidate: a monotonic inventory revision on existing world metadata,
enforced by rules for every entitlement write and team inventory membership
change in explicitly fenced worlds. Existing transaction metadata reads fence
the collection. Clients cannot install, remove or rewind the fence. Only new
synthetic fixtures opt in here; no existing world migration or production
activation. Non-participating writers must fail closed, not bypass the fence.

Concrete B counterexample retained: an authenticated owner publishes a
complete internally consistent alternative season history/manifest/event bundle
at creation, with recalculated digests and matching current team state. This
tests origin, not stale hashes. Trace the existing Admin-created baseline,
owner-writable world state, client transition writer, append-only creation rules,
and subsequent review consumer before proposing any architecture.

Validation: focused node/domain and relevant UI/persistence suites, actual rules
and browser/emulator integration, typecheck, build, applicable project/docs
checks, Graphify after source topology stabilizes, automated review, exact-head
CI and retained exact-head certificates. Reuse unaffected prior Canon/rule and
source proofs. Fresh pinned lookups: CBA2-A12.1, A12.3, L08.3 (same accepted
Canon candidate and fingerprint as phase3a-execution.md).

Claude is unavailable in this cloud, confirmed by owner. Finish author work,
automated review, exact-head CI, freeze and immutable compact handoff; do not
change reviewer/provider, self-accept or merge. Original private source packages
are unnecessary for this synthetic safeguard lane and remain unavailable.

## Before-repair discriminator

The real owner-SDK/browser/emulator test failed on unchanged application/rules:
`addition.written === true` and `applyWorldMutation.success === true` after
adding a DEN claim for BOS's 2028 original first outside the consumed-document
set. This is a behavioral failure, not a stale hash or mocked transaction.
Raw diagnostic: `work/bze-318/logs/before-repair-owner-sdk.log` (uncommitted
scratch); test now retained in architect-draft-review-proof.spec.ts. Earlier
attempts failed at CLI config, browser discovery, and duplicate browser SDK
imports respectively; none counts as vulnerability proof.

## Writer and reader map

- `draftReview/capability.ts`: metadata first, complete teams/entitlements scan,
  roster-linked player overrides, v2 season prerequisite, pure component review.
- `draftReview/seasonCapability.ts`: metadata first, complete team/entitlement
  membership and empty event-set check. Embedded players are this path's input.
- `mutationPipeline.ts` and `.persist.ts`: private capability, coordinator seal,
  transactional known-document comparisons, ownership/team/event/stats one commit.
- `seasonManager.ts` / `.history.ts`: browser computes and writes all 30 histories,
  teams, manifest, event and metadata in one transaction; now advances revision.
- `entitlements/entitlementWriter.ts`: direct create/update/delete and team
  link/unlink; `moveWorldEntitlement.ts`: identity change/reassignment transaction;
  `entitlements/dare/entitlementMutator.ts` and legacy season writer: batch
  rollover/conversion/removal; `worldManager.core.ts`: branch copying. All reach
  rules and cannot modify a fenced team's/entitlement's/event's state without
  an atomic revision advance. Non-participating calls fail closed. Parent worlds
  and branches are not admitted to the synthetic review.
- `functions/src/architect/initializeWorld.ts`: Admin creates fresh governed
  baseline/root (not client-authored source), cannot overwrite this root; does
  not opt production worlds into the fence. Partial-branch cleanup claims change
  metadata and already close client writes. `purgeWorld.ts` bypasses rules and
  deletes non-atomically; it now refuses fenced worlds before recursive deletion.
- Existing source seed/production Admin pipelines remain out of scope and are
  never run. Synthetic fixture initialization/teardown uses local demo Admin
  before review, not an untrusted concurrent writer.
- `seasonPrerequisite.ts`: checks schemas, pin, expected synthetic freeze result,
  cross-record digests and current teams. It does not prove initial publication
  came from the Season Advance function. Histories/manifests are immutable after
  create; owners can still publish the initial mutually consistent bundle.

## History counterexample and owner boundary

Actual authenticated-owner emulator publication succeeded after replacing one
BOS roster identity consistently in current and historical state/books and
recomputing the consumed digests. The subsequent v2 review and trade succeeded;
normal/default Apply remained blocked and later history editing was denied.
No stale-hash shortcut and no Admin authoring of the counterfeit bundle: Admin
only reset the fresh starting fixture, then the owner SDK published all records.
`architect-draft-season-proof.spec.ts` retains this intentionally passing
limitation probe and its complete substituted history/manifest/event evidence.

This proves owner-authored consistency, not certified transition origin. The
smallest proposed solution uses the existing server-function hosting boundary
for authoritative transition validation/publication and denies browser creation
of certified records. A server stamp on arbitrary client payloads is insufficient.
Every certified input must be protected or derived from the trusted baseline
and accepted transition lineage; mutable current Team documents cannot alone
supply that origin. The product decision is whether governed worlds guarantee
only supported moves,
with explicitly separate custom simulation history, and how existing writable
histories are treated. No implicit migration or new authority implementation.
This separable owner decision does not waive independent review of the inventory
candidate or authorize production first-round assets.

## Author validation and evidence reuse

The complete nine-phase diagnostic browser/emulator run passed: all existing
v1/v2 legal, negative and atomic scenarios plus membership and history probes.
The legal flow retains both-team leave/return and full reload state equality.
The new matrix proves unknown-ID addition, deletion, reassignment, team addition
and deletion, team inventory mutation and event addition either require an
atomic revision advance or are denied. Old reviews reject the advanced state
without partial ownership/event/stats writes. A write injected after transaction
reads forces retry and rejection; a conflict without inventory change retries
successfully once. Competing operation IDs transfer only once; replay fails.
Owner-callable Admin purge refuses the fenced world without deleting anything.
The trust probe publishes its alternative bundle through authenticated client
rules, proves later immutable-history editing fails, and retains default Apply
blocked. No production/source collections were seeded or written.

Completed author commands (logs retained in the final evidence package):

- `npm run test:node -- tests/architect/draftReviewConsumption.test.ts tests/architect/draftReviewSeason.test.ts tests/architect/draftReviewCommitGate.test.ts tests/architect/draftReviewWorldFixture.test.ts tests/architect/draftReviewEnvironment.test.ts tests/architect/draftReviewComparison.test.ts tests/architect/draftPickReview.test.ts src/tests/architect/capAuditEventV1.persistWorldMutation.guardrails.test.ts src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts --reporter=dot`: 93 tests, nine files.
- `npm run test:ui -- src/tests/architect/tmCapIntegration.ui.tradeApply_updatesTeamHistory.integration.test.tsx src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx src/tests/architect/teamHistory.detailView.integration.test.tsx --reporter=dot`: five tests, three files.
- `npm run test:rules -- --reporter=dot`, inside the demo Firestore emulator:
  28 tests passed. Initial run exposed an existing fixture defect; unchanged
  main reproduced it (25 pass / one fail). Two missing `cashAmountCents: null`
  fields are now present so the existing forged-ledger authority test reaches
  its intended assertion. No schema or ledger policy changed.
- `npm run typecheck`, `npm run build`, `npm --prefix functions run build`:
  passed; existing bundle-size warning retained.
- `npm run validate:project`, `npm run docs:guardrails`, scoped Markdown lint,
  and `npm run test:phase3a-workflow` (19 tests): passed. Initial project/workflow
  attempts encountered sandbox IPC restrictions; the configured reruns passed.
- `graphify update .`: refreshed topology (16,405 nodes, 41,877 edges);
  the new fence helper's four consumers were verified. No later source-topology
  change; subsequent edits affect proof packaging, fixture shape and docs only.
- `git diff --check`: clean. Repository commit/push hooks regenerated component
  docs and passed the Architect cast-ledger gate (which runs scoped ESLint).
  No full suite, manual broad ESLint, schema generation/check, production
  deployment, migration or source pipeline was requested or run.
  Schema generation is inapplicable: the marker is explicitly opt-in world
  metadata and no canonical schema definition changed.

Early draft PR541 at `9aa574c1cb17eeaed116ced7b67884a65bbb3d60` passed hosted
CI37108422596. Automated Codex review completed with no major issues
([receipt](https://github.com/Bet-Zero/scoutzero/pull/541#issuecomment-5967042144));
CodeRabbit skipped the draft and is optional. These are author-side receipts,
not Claude acceptance. The final commit must receive its own green hosted CI.
Existing node/UI/build proof is reused where subsequent fixture/docs/packaging
edits leave its dependency surface unchanged; required exact-head browser
certificates are produced after final freeze and published separately so this
record does not mutate the certified candidate. The wrapper requires and hashes
all five membership JSON artifacts and the history counterexample JSON.

Cloud harness uses installed Firebase CLI/cache, writable XDG config, and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. That optional config
override preserves the default browser selection elsewhere. Both retained
commands use world-only demo fixtures:
`npm run architect:proof:trade-receipt -- --draft-review` and
`npm run architect:proof:trade-receipt -- --draft-season`.

Disposition: implementation candidate only. No normal merge, activation or Done
claim. Required Claude review is unavailable by explicit owner confirmation.
The separable inventory change still needs that acceptance; certified history
also needs the owner product/authority decision above. BZE-309's accepted source
disposition, all 278 entitlement IDs, June 5, 2026 start, and Stage B/W10/V1
status are unchanged. Final immutable handoff will identify exact head/base,
artifact hashes, CI, risk locators, known limits and the focused checker request.

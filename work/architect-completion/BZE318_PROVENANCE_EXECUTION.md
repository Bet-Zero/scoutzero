# BZE-318 — certified transition provenance

October 3, 2026 owner amendment: governed first-round authority must distinguish
certified supported ScoutZero transitions from custom/previously owner-authored
history. Preserve custom data and ordinary behavior; never retro-certify. Use
the existing server functions and atomic persistence, with trusted baseline and
complete certified predecessor lineage. No new broad mode/UI, real-asset
activation, baseline/adoption changes or BZE-309 research.

Historical candidate `3c6fb02038c74541dff55e30e8ebd1036ce4c3dc` and its immutable
handoff/proof remain unchanged in GitHub and Linear. This replacement continues
PR541 on the same branch. Live main remains clean/synchronized at
`4406cb55a70f21b4bae13488691b598ee1e96efe`; exact predecessor CI37109163006 passed.
No unrelated checkout modifications existed at resumption. Governing guides
remain byte-identical to the previously read main; freeze/review boundary read
again. Graph parsed at 9aa574c1: subsequent changes were tests/docs/packaging.

Declared risk: an owner publishes consistent historical/current state through
permitted client writes and obtains first-round authority. Existing digests and
private capabilities prove consistency/current handoff, not earlier authorship.
Before repair, change only the existing realistic owner-SDK counterexample's
expected authorization to rejection and retain its behavioral failure. Do not
substitute a stale-hash case.

Proposed correction: reuse the accepted season preparation/validation in a
server-safe shared core. One owner-authenticated server transaction reads the
actual state and protected lineage, validates accepted pinned inputs, computes
the supported transition itself, and atomically publishes normal history,
manifest, event and a server-only provenance record. No client-supplied output
bundle is certified. Baseline/state digests bind the complete consumed inventory;
all records used for later authority join the existing commit-time read set.
Only trusted, newly initialized synthetic fixtures can opt in while real draft
inputs remain unresolved. Uncertified existing worlds retain their current
custom transition path; first-round authoritative consumers fail closed.

Minimum proof: counterfeit publication preserved but not authoritative; client
certificate creation/alteration denied; legitimate server transition and reload;
trusted-state/prior-lineage substitution and transactional races rejected with
no partial writes; nonowner/direct callable abuse rejected; custom/old records
preserved; inventory fence and default first-round block unchanged. Reuse
unaffected accepted work. Run changed-risk node/UI/rules/functions checks,
type/build/project/docs/schema checks as applicable, Graphify, automated review,
then exact-head CI and browser certificates. Claude remains unavailable; finish
all author work and replace the frozen handoff, without self-acceptance or merge.

## Implementation and discriminating evidence

The original owner-SDK substitution probe was changed only to require rejection
before any repair. At historical head `3c6fb020`, it failed because review still
prepared and the reviewed trade committed. The retained before-repair log/trace
is `work/bze-318/provenance/before-repair` (packaged with the replacement handoff).
This is a consistent replacement of player identity, not a stale-digest test.

The shared `seasonManager.prepare.ts` and `seasonManager.teamTransition.core.ts`
contain the existing computation and cap validation; the browser legacy adapter
retains its existing database readers. The functions build bundles this core,
with a build-time assertion excluding browser Firebase SDK/configuration.
`seasonManager.server.ts` admits only the separately pinned demo release, reads
and verifies the full saved predecessor and protected chain in its Admin
transaction, computes the transition, then creates the ordinary publication and
protected receipts atomically. It increments the existing inventory fence.
`certifiedHistory.ts` verifies SHA-256 links through the protected baseline;
`seasonPrerequisite.ts` adds exact published/current-state verification and puts
all provenance records into the existing later-trade snapshot fence. No source
collection, production deployment, adoption or certification of old data occurs.

The three new diagnostic emulator/browser cases passed: conflicting custom
output preserves all state; two direct concurrent callable requests publish
exactly one complete result; owner certificate creation/update/deletion and
nonowner reads fail; arbitrary client output payloads fail; legitimate
certification reloads; missing baseline/transition/head and current-state
substitution reject authority; original custom publication succeeds and remains
saved but cannot authorize a trade. An earlier diagnostic was invalidated by
Vite reloading while author files changed; it is retained as failed diagnostic
history, not acceptance. Final certificates run against a clean exact commit.

Scoped author validation before automated review:

- Node: 13 files / 166 tests passed for season provenance, inventory/commit gates,
  environment gates and legacy season/pick-carrier regressions. Earlier focused
  ordinary Season Advance suites added 28 + 31 passing tests and the committed
  team artifact suite 3. Two source-location guard failures caused by extraction
  were repaired to follow the shared core, then passed (3 tests).
- UI/persistence: 4 files / 9 tests passed for season controls, trade Apply and
  saved history display/detail.
- Real emulator rules: 29 tests passed, including custom history and server-only
  certification permissions. The browser cases separately exercised real Admin
  publication and transaction contention.
- Typecheck, production build, functions build, cast gate, project validation,
  schema generation passed. Existing bundle-size / Browserslist notices remain;
  the server core bundles without browser-runtime imports.
- Fresh pinned Canon lookups: CBA2-A12.4, CBA2-A12.3, CBA2-L08.1 at accepted commit
  `6cf8aaf358c158a88e630e8a7336f7e9c3febc17`. No rule interpretation changes.

Final exact-head CI, browser certificates, automated-review verdict and artifact
hashes are published externally after the final candidate commit, so producing
receipts does not mutate that candidate. Old candidate/handoff/evidence remain
unchanged historical author evidence. Full suite, broad lint, source acquisition,
production deployment and real-asset activation are intentionally not run.
Required independent Claude review remains mandatory and unavailable here.


The first exact-head season run found a real serialization difference: Admin
Firestore preserved a computed `-0` in committed team salary-book entries while
JSON-cloned history contained `0`. The shared preparation now applies the same
existing canonical JSON clone to the committed team before publication. This
changes no rule amounts and restores exact history/team/reload equality across
both persistence adapters. The failed certificate is retained; replacement
exact-head proof follows this repair. Workflow tests initially refused the
uncommitted changed lockfile (expected exact-source safeguard); all 19 passed
once the matching dependency change was committed. Graphify refreshed to 16,437
nodes / 42,035 edges; schema check and docs checks passed.


A follow-up certificate exposed stale ignored `functions/lib` output: the old
proof coordinator started emulators without rebuilding functions. The corrected
coordinator now rebuilds functions from the clean pushed candidate before any
synthetic proof, retains/hashes every compiled file, and rejects source/runtime
changes through teardown. The negative-zero rerun before this tooling repair
still executed the old server bundle and is not a result for the repaired source.
This closes the exact-candidate evidence dependency introduced by server execution.

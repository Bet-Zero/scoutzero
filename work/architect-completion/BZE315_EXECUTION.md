# BZE-315: supported synthetic first-round review mutation

Base: accepted main `729cd6fa6b42ecef4b6dedd0a4a84efa35ea03ae`.
All four predecessor reviews and post-merge CI passed. This work is not yet
independently accepted. Production first-round Apply stays blocked.

## Contract and expectation oracle

Use a retained, explicitly synthetic, complete original-first exchange with
realistic saved-world rosters. The source stipulates the exact proposal,
entitlement inventory and complete component inputs; its pin is separate from
the bytes loaded. It establishes no NBA asset readiness. Rebinding its component
contexts is permitted only after matching the actual proposal and saved asset
state to that source. Recheck the entire consumed saved state atomically at
commit, including date, release pointer and retry identity.

The existing component review stays `components-only`, `not-evaluated` and
`apply: blocked`. A separate, non-serializable review-environment capability
permits its supported consumption through the existing five-gate trade pipeline.
It grants no whole-trade success and cannot be minted or consumed in production.

Pre-run expected results derive from the pinned accepted Canon, candidate
`6cf8aaf358c158a88e630e8a7336f7e9c3febc17`, SHA-256
`23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`:

- A12.1: a current, complete unconditional original right may be conveyed;
  wrong current owner prohibits, incomplete/conflicting claims need input.
- A12.3/L09.6: every supplied possible post-trade branch must retain a first
  in at least one draft of each consecutive future pair. Any empty pair fails.
- A12.2: complete established noncash consideration is outside the cash-sale
  prohibition; a complete positive cash-only sale of a first is prohibited;
  mixed/unclassified/incomplete consideration needs input.
- A12.4/A12.5/L09.3: dated frozen state blocks; non-applicable pre-2024 trigger
  has no freeze prohibition. Unsupported protection/deferral is unavailable.
- L09.4: preserve independent ownership, frozen, unfrozen, penalty and placement
  states. A restriction result is not ownership or an overall trade verdict.

The legal synthetic exchange must commit exactly once through the existing
transaction writer, preserving all five other trade authority gates. A stale
proposal, state, release or date, forged/cloned permission, required component
failure, or actual atomic commit failure must write nothing. Receipt, event,
History and Compare must identify the actual pick movement and survive leaving,
returning and full reload for both teams. Default/production must still reject.

## Validation scope

Focused node/domain and changed UI tests; typecheck; schema/project/docs checks
where affected; build and exact-head hosted CI; Graphify after final code edits.
Browser/emulator evidence is required, with world-only fixtures and 1280x720
captures. Do not run the existing source-collection seeder. Record diagnostic
proof before freeze and retain final exact-head evidence before independent
Claude review. Manual full-suite allowance remains unused until final integration.

## Author validation checkpoint

Before the first reviewable commit:

- Positive browser diagnostic: PASS (3.4m). Actual review consumption, default
  and forged rejection, two pick movements, one event/statistics update, retry
  rejection, both teams' History/Compare and leave/return/full reload agree.
- Component/staleness browser diagnostic: PASS (2.5m). Six component negative
  variants and four stale context variants leave complete saved state unchanged.
- Atomic browser diagnostic: PASS (2.7m). Real emulator rules deny the final
  metadata update after successful computation; all queued writes roll back.
- Scoped node: 112 passed across consumption, Compare, actual environment gate,
  synthetic world construction, existing world statistics, real blocked ingress
  and workspace inventory honesty.
- Scoped UI: 38 passed across Compare and History subsections.
- Final initial-candidate typecheck and production build passed. The production
  bundle rejects capability consumption unconditionally; this is a compiled
  environment boundary, not an event or fixture field.
- Schema check, project validation, scoped Markdown and docs guardrails passed.
  The generator covers only legacy schema boilerplate, not these Zod contracts;
  its three newly generated untracked boilerplate files were removed. Contract
  validation is supplied by the scoped behavioral tests and actual loader.
- Workflow tooling: 19 passed. Graphify updated at initial candidate
  `0fe0d376a3b673ad0f9c08cfd00fe96296830098`; exact-head hosted PR validation
  run `34731999864` passed. The frozen certificate and independent Claude
  review have not yet occurred. Manual full-suite allowance remains unused.

Diagnostics are author evidence, not exact-head certification. Six 1280x720
images and the positive/negative/atomic receipts are retained privately; the
final certificate uses a unique candidate-bound directory and three individually
bounded browser invocations. The original Trade Receipt mode remains unchanged.

Earlier failed diagnostics exposed incomplete fixture salary books, a missing
ordinary trade context and a new transaction branch falling through to player
contract-ledger checks; those were repaired. One combined run was stopped at
four minutes and is not passing evidence. History and emulator-denial assertion
text was corrected to match actual existing formatter/SDK responses without
weakening movement, no-write or commit-stage requirements.

The only added presentation is actual committed pick movement in the existing
Compare lists and correction of false empty legacy inventory claims. No layout,
product direction or normal first-round activation is proposed.

## Automated review repairs

PR #538 found two material gaps before freeze. Compare now requires the actual
synthetic review environment before deriving draft deltas from event metadata;
a production user-created receipt cannot enable the display. The existing
unavailable state remains explicit.

The public capability verifier alone no longer authorizes persistence. Only
the mutation coordinator seals a result after all its validation succeeds.
Its private gate binds the capability object and every persistence argument
to exact normalized snapshot text. The writer consumes that seal once, rejects
changed results, and rechecks after asynchronous transaction reads before any
writes. Transaction retries can recheck the unchanged consumed result; callers
cannot reuse a consumed seal. A caller-created gate has an independent registry
and cannot mint a seal recognized by the writer. The writer's reverse import
of the consume-only function is evaluated at call time, after module setup;
no mint function for the coordinator's registry is exported.

Targeted repair checks: 73 node tests across commit seals, production receipt
display, existing Compare aggregation and cap-audit persistence; 49 UI tests
across Compare and dashboard smoke; typecheck passed. An initial node run found
the older shared Firebase test mock missing the new environment export; its
default now explicitly stays closed, and all 73 tests passed on rerun.

The browser harness additionally attempts direct writes with a publicly
verified real capability, a forged seal and a foreign-gate seal, asserting no
saved-state change before the genuine positive control. Diagnostic 12 reached
successful mutation but was interrupted at the four-minute budget during the
first team's reload while other validation competed for resources. It is not
passing evidence. Diagnostic 13 reached both-team reload checks but exceeded
its 180-second inner timeout; it also is not passing evidence.

Replacement positive diagnostic 14 passed (3.4m), including all three direct
writer attacks, the real positive mutation, both-team re-entry/reload and empty
source collections. Navigation waits for DOM readiness and then asserts the
actual rendered state; independent source reads run together. The 200-second
inner test timeout remains below the certificate's unchanged four-minute
process cap. Repair production build, project checks and docs guardrails passed.
The exact-head certificate will recheck the positive, component/staleness and
atomic rollback groups separately before independent acceptance. Unchanged
component and fixture author results above are reused with that scope.

The first hosted repair run exposed an old source-marker literal; its one-character
update preserves the no-validation-in-persistence guardrail (27 tests passed).
The next hosted run passed all 6,140 node tests and exposed two per-file UI mocks
missing the new environment export. Both mocks now explicitly return false;
30 dashboard-boundary tests passed and all 10 smoke tests passed with CI's UTC
timezone. One local smoke assertion had expected UTC text in the local timezone;
no production formatter or assertion was changed for it.

The first exact-head certificate attempt timed out and recorded FAIL, including
unclean teardown; its leftover emulator was stopped explicitly. Diagnostic 15
then passed with the same certificate flags/reports (3.9m): both teams use
independent pages observing the same committed world, preserving each full
History/Compare/leave-return/reload sequence and complete before/after state
checks. Both pick labels are asserted after each reload. All six explicit
1280x720 captures, full trace and structured receipts remain required. Final
exact-head CI, certificate and independent acceptance are still pending.

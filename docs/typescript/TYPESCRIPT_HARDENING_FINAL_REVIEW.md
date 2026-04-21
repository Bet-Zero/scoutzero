# TypeScript Hardening Final Review

Captured: 2026-04-21

This review closes the execution work completed through Steps 3-12 of
`docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`. It does not claim repo-wide strict
readiness. It records what this plan materially hardened, what remains, and
what kind of follow-up the remaining debt actually needs.

## Verdict

`PASS WITH DEBT — hardening meaningfully improved, targeted debt remains`

Why this is not `CONCERN`:

- The strongest declaration-layer dishonesty mechanism
  (`src/global-shims.d.ts`) is gone.
- The shared/runtime strict probe moved from `244` errors to `0`.
- The planned shared player, storage, route, and Architect/base-data ingress
  boundaries were hardened away from cast-only trust.
- The central Firebase mock and one persistence-truth suite no longer rely on
  the tracked dishonesty markers that originally made the test layer look more
  truthful than it was.

Why this is not a clean `PASS`:

- `tsconfig.architect-strict.json` still reports `2,632` errors and spans `194`
  files.
- The remaining Architect/test debt is not one narrow cleanup wave; it is a
  broader contract-normalization problem across runtime carriers, dashboard
  adapters, and large persistence/season test harnesses.
- The typed test layer improved materially, but the highest-value Architect
  action/trade/cap suites still bypass runtime truth too often.

## Resolved In This Plan

| Area | What changed | Why it matters now |
| --- | --- | --- |
| Declaration layer | Deleted `src/global-shims.d.ts`, removed fake ambient module contracts, and reclassified the remaining local `.d.ts` files. | Downstream imports now see real module exports instead of repo-wide `any` shims. |
| Shared player/runtime boundaries | Hardened `src/shared/hooks/useSimplePlayerData.ts`, `src/shared/hooks/usePlayerDetail.ts`, Tier Maker storage restore, and the route/list/roster/table surfaces that fed the shared strict probe. | Shared/runtime data ingress is now materially more truthful, and the shared strict probe passes (`244 -> 0`). |
| Architect/base-data Firestore ingress | Hardened `subscribeArchitectPlayerData.ts`, `loadArchitectBasePlayer.ts`, `teamLoader.ts`, `worldManager.ts`, and `firebaseTeamPlanHelpers.ts`. | The core planned Architect world/base read stack no longer depends on cast-only trust at ingress. |
| Typed test support layer | Tightened `tests/__mocks__/firebase.ts`, removed tracked dishonesty markers from `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`, and reduced typed-bypass density in `src/tests/architect/useArchitectActions.freeAgency.test.tsx`. | Test infrastructure now reinforces some runtime contracts instead of swallowing unreal shapes by default. |
| Measurement posture | Added the baseline, execution map, declaration review, Architect boundary review, test typing review, and strictness checkpoint docs. | The repo now has before/after evidence instead of vague migration-complete claims. |

## Safe To Defer

| File or group | Why it can defer |
| --- | --- |
| `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.d.ts` | Still suspicious, but it is now a local declaration bridge rather than a repo-wide trust blocker. |
| `src/features/architect/utils/entitlements/*` resolver and pick-rule reads | Real boundary debt remains, but it is narrower and lower leverage than the world/base-data ingress paths already hardened here. |
| Compatibility-style suites with some bag typing, including `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts`, `src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts`, and `tests/trade/useTradeMachine.validatorTrust.test.ts` | These still carry weak types, but another targeted pass here would not change trust posture as much as the next architect-contract wave. |
| Scattered leaf suites with sparse `as unknown as` casts | The debt is real but too isolated to justify its own wave right now. |

## Needs Dedicated Follow-Up Plan

| File or group | Why it needs its own plan |
| --- | --- |
| `src/features/architect/utils/mutationPipeline.ts` | It remains the highest runtime Architect hotspot and concentrates nullability and assignability debt that reaches many downstream consumers. |
| `src/features/architect/GMDashboard/**`, `src/features/architect/hooks/useTradeMachine.ts`, and `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | These surfaces still disagree with mutation/cap-sheet/player carrier shapes; the work is contract normalization, not another boundary patch. |
| `tests/architect/seasonManager.test.ts`, `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`, `tests/architect/offerSheetPersistence.test.ts`, and the remaining trade/cap integration harnesses | These dominate the Architect strict backlog and still contain the highest-value typed-test dishonesty after Step 8. |
| Architect strict families `TS18048` / `TS18049` / `TS2533`, `TS2322` / `TS2345`, and `TS7006` / `TS7005` / `TS18046` | The remaining debt is broad enough that it should be attacked as a dedicated Architect nullability/contract/test-harness normalization phase, not squeezed into one late cleanup step. |

## Needs Product/Architecture Decision

| File or group | Decision needed |
| --- | --- |
| `src/features/architect/GMDashboard/**` dashboard/action adapter contracts | Current strict errors show disagreement between dashboard cap-sheet/player shapes, mutation-pipeline carrier shapes, and trade/cap consumers. The codebase needs an explicit contract owner and normalization direction before a large cleanup wave is honest. |

## Area-By-Area Posture

### Declaration Layer

Materially hardened. The repo no longer has live `declare module` shims masking
real TS/TSX files. Remaining declaration debt is localized and explicit.

### Shared/Runtime Boundaries

Materially hardened. The shared boundary probe now passes, which is the clearest
evidence that the shared player/data ingress work landed truthfully.

### Architect/Base-Data Boundaries

Improved at ingress. The planned world/base-data read stack is more honest, but
the wider Architect runtime still carries downstream optionality and
assignability churn that boundary cleanup alone did not solve.

### Typed Tests

Improved but still mixed. Central mock truth is better, and one persistence
truth suite is now clean, but the highest-value Architect action/trade/cap
harnesses still rely on too many broad fixtures and compatibility casts.

### Strictness Readiness

Split outcome. Shared/runtime strictness is now ready on its dedicated probe.
Architect/test strictness is not ready. Step 10 therefore correctly chose
Option C, and Step 11 was intentionally skipped rather than widened into an
unbounded strict migration.

## Plain-Language Conclusion

This plan succeeded at its stated goal: it removed the biggest type-dishonesty
mechanisms first, hardened the highest-value shared and Architect ingress
boundaries second, reduced some of the worst typed-test bypasses third, and
then stopped honestly when the remaining strict debt no longer fit one bounded
wave.

The repo is more trustworthy than the Step 1 baseline, especially at the
declaration layer and the shared/runtime surface. It is not strict-ready across
Architect/test code, and the next honest move is a separate follow-on plan for
Architect contract normalization and test-harness tightening.

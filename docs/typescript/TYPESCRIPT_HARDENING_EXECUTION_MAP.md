# TypeScript Hardening Execution Map

Captured: 2026-04-21

This map converts the post-migration audit and live baseline into the ordered
work queue for `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`. It is intentionally
narrow: it focuses on central trust boundaries, declaration masking, and the
test/mocking surfaces that most distort TypeScript evidence.

## Validation Shorthand

Tables below use these shorthand labels for exact commands:

| Label | Command |
| --- | --- |
| `root` | `npm run typecheck` |
| `shared-strict` | `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |
| `architect-strict` | `npm run typecheck -- --project tsconfig.architect-strict.json` |
| `project` | `npm run validate:project` |
| `scouting-tests` | `npm run test:scouting -- --reporter=dot` |
| `architect-tests` | `npm run test:architect -- --reporter=dot` |
| `trade-tests` | `npm run test:trade -- --reporter=dot` |
| `ui-tests` | `npm run test:ui -- --reporter=dot` |
| `diff-tests` | `npm run test:diff -- --reporter=dot` |
| `build` | `npm run build` |

Use the narrowest label set that proves the changed surface. Do not run the full
suite unless the prompt contains `RUN FULL SUITE`.

## Declaration-Layer Dishonesty

| Path or group | Risk category | Why it matters | Criticality | Probe | Wave | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| `src/global-shims.d.ts` | Ambient module shims exporting `any` | It has `11` ambient declarations that collapse real modules to `any`; `Dialog` also declares exports the implementation does not provide. | Declaration-only, trust-critical | Both | Step 3 | `root`, `shared-strict`, `architect-strict`, `project`, plus `diff-tests` or scoped tests for broken consumers |
| `src/shared/components/BirdRightsIcon.tsx`, `src/shared/components/TeamLogo.tsx`, `src/shared/components/TeamSelectDropdown.tsx`, `src/shared/components/ui/Dialog.tsx`, `src/shared/components/ui/filters/index.ts` | Real shared UI hidden by shims | These files already exist as TS/TSX, so the matching shims should be deleted or replaced by real exports; `Dialog` needs the export mismatch fixed. | Runtime-critical shared UI | `shared-strict` | Step 3 | `root`, `shared-strict`, `project`, `diff-tests` |
| `src/features/architect/utils/capTotals/index.ts`, `src/features/architect/utils/exceptions/index.ts`, `src/features/architect/utils/persistenceContracts/index.ts`, `src/features/architect/utils/tradeContext/index.ts`, `src/features/architect/utils/tradeContext/legacy/index.ts`, `src/features/architect/utils/tradeMachine/index.ts` | Architect TS barrels hidden by shims | These are central Architect contract surfaces; keeping extensionless imports typed as `any` masks downstream contract errors. | Runtime-critical Architect utilities | `architect-strict` and sometimes both | Step 3 | `root`, `architect-strict`, `project`, `architect-tests`, `trade-tests` where trade consumers break |
| `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.d.ts` | Sibling declaration facade | The implementation is TSX, but an external `.d.ts` still supplies a cleaner prop facade; this should be classified and likely removed after implementation props are truthful. | Declaration-only with runtime UI impact | `shared-strict` | Step 4 classification, Step 11 if strict-prep target | `root`, `shared-strict`, `ui-tests` or `diff-tests` |
| `src/vite-env.d.ts`, `src/types/player.d.ts` | Remaining non-library declarations | These may be justified boundary declarations, but Step 4 must explicitly classify them so later work knows they are not hidden type debt. | Declaration-only | Both if touched | Step 4 | `root`; add strict probe only if changed |

## Shared/Runtime Boundary Honesty

| Path or group | Risk category | Why it matters | Criticality | Probe | Wave | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| `src/shared/hooks/useSimplePlayerData.ts` | Firestore read without schema parse | This is the primary `players_v2` list hook; it spreads `docSnap.data()` into enriched output and asserts the result as `SimplePlayer`. | Runtime-critical shared data | `shared-strict` | Step 5 first | `root`, `shared-strict`, `scouting-tests`, `build` |
| `src/shared/hooks/usePlayerDetail.ts` | DEV-only validation followed by production casts | It validates player/subcollection docs only in DEV, then casts raw data to `PlayerV2`, `ContractDoc`, `SeasonDoc`, and `EvaluationDoc`. | Runtime-critical shared data | `shared-strict` | Step 5 first | `root`, `shared-strict`, `scouting-tests`, `build` |
| `src/features/tierMaker/hooks/useTierDraft.ts` | Session storage JSON parse into typed envelope | The hook parses `sessionStorage` straight into `DraftEnvelope`; it needs a cheap runtime guard or schema-style narrowing before trust. | Runtime-critical persisted UI state | `shared-strict` | Step 5 second wave if hooks finish cleanly | `root`, `shared-strict`, `diff-tests`, `build` |
| `src/pages/ListManager.tsx`, `src/pages/TeamRosterView.tsx`, `src/features/profile/hooks/usePlayerNavigation.ts` | Route-param boundary consistency | `usePlayerNavigation` already types route params, while `ListManager` and `TeamRosterView` read params untyped; `ListManager` also leads the shared strict probe with `43` errors. | Runtime-critical routes | `shared-strict` | Step 5 for param boundary; Step 11 for larger strict cleanup | `root`, `shared-strict`, `scouting-tests` or `diff-tests`, `build` |
| `src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts`, `src/features/ranker/utils/rankerLocalDraft.ts`, `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts`, `src/features/architect/admin/pickRightWizardDraft.ts` | Storage-boundary mixed posture | These files show both stronger localStorage/sessionStorage patterns and shallow object guards; use them as pattern references before widening Step 5. | Runtime-critical persisted state | `shared-strict` or `architect-strict` by owner | Classification only unless touched by Step 5/7 | Probe by owner plus `diff-tests` |

## Architect/Base-Data Firestore Boundary Honesty

| Path or group | Risk category | Why it matters | Criticality | Probe | Wave | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| `src/features/architect/utils/subscribeArchitectPlayerData.ts` | Firestore subscription double-casts | It double-casts `onSnapshot` arguments and spreads `doc.data()` into `ArchitectPlayerData` without boundary validation. | Runtime-critical Architect player data | `architect-strict` | Step 6 wave 1 | `root`, `architect-strict`, `architect-tests` |
| `src/features/architect/utils/loadArchitectBasePlayer.ts` | Base player read reassembled from broad records | It reads Firestore into broad records and reconstructs typed-looking base player output through casts. | Runtime-critical base player ingress | `architect-strict` | Step 6 wave 1 | `root`, `architect-strict`, `architect-tests` |
| `src/features/architect/utils/teamLoader.ts` | Base/world team loader casts | It does repeated `doc.data() as TeamLike` / `as PlayerLike` at central team and player load boundaries. | Runtime-critical team/player ingress | `architect-strict` | Step 6 wave 1 | `root`, `architect-strict`, `architect-tests` |
| `src/features/architect/utils/worldManager.ts` | World metadata cast-only reads | World metadata is cast directly from Firestore reads and query results, so invalid metadata can look typed. | Runtime-critical world metadata | `architect-strict` | Step 7 wave 2 | `root`, `architect-strict`, `architect-tests` |
| `src/features/architect/utils/firebaseTeamPlanHelpers.ts` | Team plan/base team/free-agent loose reads | It has load-bearing `null as any`, unvalidated base-team casts, and loosely spread free-agent documents. | Runtime-critical planning helpers | `architect-strict` | Step 7 wave 2 | `root`, `architect-strict`, `architect-tests` |
| `src/features/architect/utils/mutationPipeline.ts`, `src/features/architect/utils/tradeMachine/constants/types.ts`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, `src/features/architect/hooks/useTradeMachine.ts` | Central carrier/compatibility types | These are not first boundary targets, but they are likely where hardened inputs expose downstream bag-type debt. | Runtime-critical Architect core | `architect-strict` | Classify during Steps 6-7; possible Step 11 target | `root`, `architect-strict`, `architect-tests`, `trade-tests` as relevant |

## Typed-Test Dishonesty

| Path or group | Risk category | Why it matters | Criticality | Probe | Wave | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| `tests/__mocks__/firebase.ts` | Broad Firestore mock | It is the central Firebase mock and currently has `87` Architect strict errors; loose clone/data helpers let tests accept unreal shapes. | Test-critical shared mock | `architect-strict` | Step 8 first | `root`, `architect-strict`, `architect-tests` |
| `src/tests/architect/useArchitectActions.freeAgency.test.tsx` | Heavy `any`/`as any` action fixtures | This high-value action-layer suite bypasses contracts in fixtures, hook state, and action arguments. | Test-critical Architect integration | `architect-strict` | Step 8 | `root`, `architect-strict`, `architect-tests` |
| `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` | Bag-object persistence truth fixtures | The test claims persistence truth but builds validators, teams, players, and cap holds as `Record<string, any>`. | Test-critical persistence guardrail | `architect-strict` | Step 8 | `root`, `architect-strict`, `architect-tests`, `trade-tests` if trade path is touched |
| `src/tests/architect/tmCapIntegration.*`, `src/tests/architect/mutationPipeline.boundary.e107.test.ts`, `src/tests/architect/mutationPipeline.computeResultBridge.test.ts`, `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts` | Cast-heavy guardrail/integration tests | These tests cover critical mutation/trade/cap paths but often construct invalidly broad inputs. | Test-critical Architect/trade guardrails | `architect-strict` | Step 8 second wave if central mock work exposes shared fixes | `root`, `architect-strict`, `architect-tests`, `trade-tests` |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`, `tests/architect/seasonManager.test.ts`, `tests/architect/offerSheetPersistence.test.ts`, `tests/architect/teamLoader.test.ts` | Strict-error concentration | These files dominate the current strict probe and should be revisited after boundaries/mocks are hardened. | Test-critical strict-prep candidates | `architect-strict` | Step 10/11 only if evidence supports | `root`, `architect-strict`, `architect-tests` |

## Strict-Prep Candidates

These are not early work items. They become Step 11 candidates only after Step 10
proves a narrow strict-prep wave is worth doing.

| Path or group | Risk category | Why it matters | Criticality | Probe | Wave | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| `src/pages/ListManager.tsx` and related list components in the shared strict probe | Shared implicit-any/destructuring errors | The shared probe currently concentrates `TS7031`, `TS7006`, and `TS2339` in list/roster UI components; this may become a small high-leverage strict wave after data boundaries are honest. | Runtime UI | `shared-strict` | Step 11 candidate | `root`, `shared-strict`, `ui-tests` or `diff-tests`, `build` |
| `tests/__mocks__/firebase.ts` plus top Architect test builders | Test implicit-any and nullable strict errors | Mock tightening may collapse many downstream strict errors, but only after Step 8 proves which helpers can be typed without huge churn. | Test infrastructure | `architect-strict` | Step 11 candidate | `root`, `architect-strict`, `architect-tests` |
| `src/features/architect/utils/mutationPipeline.ts` | Core nullable/unknown carrier errors | It is the highest runtime file in the Architect strict probe (`55` errors) and may pay off if Steps 6-8 reduce upstream looseness. | Runtime Architect core | `architect-strict` | Step 11 or follow-on plan | `root`, `architect-strict`, `architect-tests`, `trade-tests` |
| `src/features/architect/GMDashboard/**` optional/nullability family | Exact optional/null readiness debt | Strict output shows optional/null interchange remains widespread; only target it if errors concentrate after earlier waves. | Runtime Architect UI/actions | `architect-strict` | Step 11 or follow-on plan | `root`, `architect-strict`, `architect-tests`, `build` |

## Recommended Execution Order

1. Step 3: Remove or truthfully narrow `src/global-shims.d.ts`, starting with
   real shared UI and Architect barrel modules whose TS implementations already
   exist.
2. Step 4: Re-audit remaining `.d.ts` files and classify each declaration as a
   justified boundary, temporary bridge, or still suspicious.
3. Step 5: Harden shared player data boundaries first:
   `useSimplePlayerData.ts` and `usePlayerDetail.ts`. Then address the route
   and storage boundaries only if they stay narrow.
4. Step 6: Harden Architect Firestore ingress wave 1:
   `subscribeArchitectPlayerData.ts`, `loadArchitectBasePlayer.ts`, and
   `teamLoader.ts`.
5. Step 7: Harden Architect wave 2:
   `worldManager.ts` and `firebaseTeamPlanHelpers.ts`, then classify remaining
   Architect boundary debt instead of widening into all Architect strict errors.
6. Step 8: Harden the central test/mock truth layer:
   `tests/__mocks__/firebase.ts`, then the highest-value Architect
   integration/guardrail suites affected by Steps 5-7.
7. Step 9: Re-measure test dishonesty markers and classify the remaining test
   debt.
8. Step 10: Re-run strict probes and compare to this baseline. Decide from
   evidence whether strict-prep is worth one narrow wave.
9. Step 11: If Step 10 recommends it, execute exactly one concentrated
   strict-prep wave from the candidates above. Otherwise mark the step complete
   with the evidence-based skip reason.
10. Step 12: Create the final hardening review and residual-risk classification.
11. Step 13: Close the living plan and recommend whether a separate next-phase
   plan is warranted.

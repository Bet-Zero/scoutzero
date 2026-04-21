# Post-Migration Hardening Audit

## Executive Summary

- The repo is structurally migrated in the app surface: `src/` contains `600` `.ts`, `321` `.tsx`, `0` `.js`, `0` `.jsx`, plus `4` `.d.ts`.
- That structural completion is not the same as hardening. The root repo is still configured as a permissive transitional TypeScript repo, not a hardened one: `strict: false`, `skipLibCheck: true`, no `checkJs`, and a partial-only `tsconfig.architect-strict.json`.
- Root `npm run typecheck` passes under the permissive config. The scoped strict config does not. `npm run typecheck -- --project tsconfig.architect-strict.json` reports `2,567` TypeScript errors.
- Weak typing is concentrated differently by layer. Runtime `src/` has relatively little `as any` (`5`) but a very large `unknown` footprint (`1,471`). Tests are the opposite: `755` `any`, `395` `as any`, `43` `as unknown as`.
- The strongest dishonesty signal is `src/global-shims.d.ts:8-92`: `11` ambient module shims export `any`, even for modules that now have real TS implementations. One shim (`@/shared/components/ui/Dialog`) exports symbols that the real file does not.
- User-content Firestore helpers are materially stronger than the Architect/base-data layer. `src/firebase/listHelpers.ts`, `src/firebase/rosterHelpers.ts`, and `src/firebase/rankerHelpers.ts` parse reads and writes with Zod. Architect/base-data reads frequently do `snapshot.data() as ...` with no schema guard.
- Several files are “TS in name only”: for example `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.tsx` still uses implicit-any props while a sibling `.d.ts` file supplies an external type facade.
- The realistic next step is a targeted hardening pass, not a strict-mode flip. Strict-mode preparation should come after boundary honesty and shim removal.

## Final Verdict

**CONCERN**

The migration is structurally complete in the main app codebase, but it is not hardened or fully trustworthy. This is not a JS repo wearing TS extensions, but it is also not an honest hardened TS repo. The live repo is best described as:

- conversion complete in the app/runtime surface
- hardening incomplete
- strongly typed in some user-content CRUD boundaries
- weakly typed in important Architect/base-data/runtime bridges
- heavily bypassed in the test layer

If someone claims the migration is “done” in the sense of being type-safe and trustworthy, that claim is overstated.

## Repo-Wide TypeScript Posture

### `tsconfig.json`

Observed posture from `tsconfig.json`:

- `strict: false`
- `strictFunctionTypes: true`
- `skipLibCheck: true`
- `isolatedModules: true`
- `noEmit: true`
- `moduleResolution: "bundler"`
- `resolveJsonModule: true`
- `baseUrl: "."` with `@/* -> ./src/*`
- `allowJs`: not enabled
- `checkJs`: not enabled

What that means in practice:

- The repo is **not** running in hardened TS mode.
- `noImplicitAny`, `strictNullChecks`, and the rest of `strict` are off at the repo root.
- JS files are not type-checked, and `checkJs` is not being used as a bridge.
- `skipLibCheck` is not the main problem, but it is another permissive setting.

### Partial strict config

`tsconfig.architect-strict.json` exists and sets `strict: true`, but it is scoped to selected Architect and test folders only:

- `src/features/architect/**/*`
- `src/tests/architect/**/*`
- `src/tests/tradeMachine/**/*`
- `tests/architect/**/*`
- `tests/trade/**/*`

This is useful as a probe, but it is not evidence of repo-wide strictness. In effect, the repo posture is:

- root repo: permissive transitional TS
- one feature/test slice: strictness experiment or prep surface

### Root vs strict typecheck result

- `npm run typecheck`: passes
- `npm run typecheck -- --project tsconfig.architect-strict.json`: fails with `2,567` TS errors

That gap matters more than the green root typecheck. The root compiler is proving “compatible with permissive settings,” not “hardened.”

## Live File Inventory

### Requested breakdown

| Scope | `.ts` | `.tsx` | `.js` | `.jsx` | `.d.ts` |
| --- | ---: | ---: | ---: | ---: | ---: |
| `src/` | 600 | 321 | 0 | 0 | 4 |
| `tests/` | 147 | 10 | 0 | 0 | 0 |
| Repo-wide | 879 | 331 | 26 | 0 | 4 |

Important nuance:

- `src/tests/` contains another `294` `.ts` and `99` `.tsx` test files.
- So the repo has two live test roots:
  - `tests/`
  - `src/tests/`

### Is meaningful runtime JS/JSX still present?

Inside the app surface, no:

- `src/`: no `.js` or `.jsx`
- `tests/`: no `.js` or `.jsx`

Repo-wide JS remains, but it is outside the app/runtime surface:

- `16` JS files in `scripts/`
- `9` JS config files (`vite.config.js`, `vitest.*.js`, `tailwind.config.js`, `postcss.config.js`)
- `1` JS file in `cursor_work/`

So the runtime React app is fully extension-migrated, but the repo is not 100% TS and the remaining JS is not checked by TypeScript.

## Weak Typing Findings

### Quantified weak-typing markers

Counts below are regex occurrence counts across tracked code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.d.ts`), excluding `docs/`, `return_packages/`, `archive/`, and `dist/`.

| Marker | Repo | Runtime `src/` excluding `src/tests/` | All tests (`tests/` + `src/tests/`) | Scripts/pipelines |
| --- | ---: | ---: | ---: | ---: |
| `any` | 1,223 | 174 | 755 | 293 |
| `as any` | 441 | 5 | 395 | 41 |
| `unknown` | 2,679 | 1,471 | 1,047 | 139 |
| `as unknown as` | 56 | 7 | 43 | 6 |
| `Record<string, any>` | 78 | 4 | 59 | 15 |
| non-null `!` | 319 | 24 | 206 | 89 |
| `@ts-ignore` | 0 | 0 | 0 | 0 |
| `@ts-expect-error` | 1 | 0 | 1 | 0 |
| ambient module shims | 11 | 11 | 0 | 0 |

Interpretation:

- Runtime code is not dominated by `as any`; it is dominated by `unknown` and bag types.
- Tests are where the repo most explicitly bypasses the type system.
- The absence of `@ts-ignore` is good, but it is outweighed by ambient shims, broad casts, and compatibility carrier types.

### Classification

#### Acceptable / boundary-appropriate

These are not the main debt:

- `unknown` at normalization boundaries in `src/features/ranker/utils/rankerLocalDraft.ts:50-108`
- defensive parsing of localStorage in `src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts:40-84`
- object-gated localStorage recovery in `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts:96-116`
- the single `@ts-expect-error` in `src/tests/architect/mutationPipeline.currentStateIngressClosure.test.ts:173-175`, which is a legitimate negative type assertion

#### Suspicious but maybe okay

- open schema pockets using `z.any()` in `src/schemas/players_v2.ts:134,211,237,253,274,313` and `src/schemas/architect.ts:151`
- validator internals that first narrow to object and then inspect dynamically, such as `src/features/architect/utils/capLegalityValidation.ts:1329-1360`
- storage helpers that only validate shallow object-ness before casting, such as `src/features/architect/admin/pickRightWizardDraft.ts:75-89`

These are survivable, but they are still debt.

#### Likely type debt

- compatibility carrier types like `Record<string, any>` and `AnyRecord` in `src/features/architect/utils/tradeContext/types.ts:14-17`
- broad index access after double-casts in `src/shared/utils/filtering/playerFilterUtils.ts:224-249`
- UI filter components still typed as bags, such as `src/shared/components/ui/filters/RangeSelector.tsx:10-18`
- nominal TSX with implicit-any params, especially `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.tsx:3-27,50-56`
- pervasive “unknown until proven otherwise” data carriers in `src/features/architect/utils/tradeMachine/constants/types.ts`

#### High-risk dishonesty

These actively mask the true typing state:

- `src/global-shims.d.ts:8-92`
  - `11` ambient shim modules
  - exports `any`
  - shadows modules that already have real TS barrels/files
  - `@/shared/components/ui/Dialog` shim exports `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogClose`, etc., but the real file at `src/shared/components/ui/Dialog.tsx:22-50` only exports `Dialog` and `DialogContent`
- `src/features/architect/utils/subscribeArchitectPlayerData.ts:81-118`
  - double-casts `onSnapshot` arguments
  - spreads `doc.data()` into an unvalidated `ArchitectPlayerData`
- `src/features/architect/utils/loadArchitectBasePlayer.ts:66-79`
  - reads Firestore into `Record<string, unknown>` and reassembles typed-looking output via casts
- `src/features/architect/utils/teamLoader.ts:116-159,241,305-319`
  - repeatedly does `doc.data() as TeamLike` / `as PlayerLike`
- `src/features/architect/utils/worldManager.ts:242,281,301`
  - world metadata is cast directly from Firestore reads
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts:192-194,279-295,342,402,417`
  - uses `null as any`, `as LooseBaseTeamDoc`, `as TeamTotals`, and multiple unvalidated Firestore casts

## Boundary Honesty Findings

### Firebase / Firestore boundaries

#### Honest or relatively honest

The user-content CRUD helpers are the strongest TS boundary work in the repo:

- `src/firebase/listHelpers.ts:166-186,231-260,454-472,670-673`
  - reads use `safeParse`
  - writes parse inputs before persistence
- `src/firebase/rosterHelpers.ts:81-99,125-159,174-190,301-333`
  - same pattern: parse on read, parse on write
- `src/firebase/rankerHelpers.ts:131-144,155-175,189-226,235-269`
  - same pattern: parsed reads, validated writes

This part of the repo is materially stronger than the rest.

#### Mixed honesty

`players_v2` reads are only partially protected:

- `src/shared/hooks/usePlayerDetail.ts:68-79,93-106,112-125,130-148`
  - schemas are checked only in `import.meta.env.DEV`
  - after warning, raw data is still cast into `ContractDoc`, `SeasonDoc`, `EvaluationDoc`, and `PlayerV2`
- `src/shared/hooks/useSimplePlayerData.ts:57-69`
  - no schema parse at all
  - `docSnap.data()` is spread into the enriched output and then asserted as `SimplePlayer`

So the schema exists, but the production read path is not fail-closed.

#### Not honestly protected

The Architect/base-data layer is mostly cast-based:

- `src/features/architect/utils/subscribeArchitectPlayerData.ts:81-118`
- `src/features/architect/utils/loadArchitectBasePlayer.ts:66-79`
- `src/features/architect/utils/teamLoader.ts:116-159,241,305-319`
- `src/features/architect/utils/worldManager.ts:242,281,301`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts:279-295,342,402-417`

These boundaries are usually:

- Firestore read
- `snapshot.data() as SomeLooseType`
- merge/spread into a richer object
- rely on downstream consumers to survive

That is transitional typing, not honest boundary typing.

### External data parsing / scraper boundaries

Mixed:

- Good example: `team-scrape/team-data/scripts/validate_output.ts:25-30` parses JSON and validates with `BaseTeamDoc.safeParse`
- Weak example: `player-scrape/contracts/scripts/parse_player.ts`
  - `any` is pervasive (`168`, `565`, `687`, `798`, `1678`, `2018`, `2112`, etc.)
  - helper signatures and records are broadly `any[]` / `any`

So scraper/pipeline code is not uniformly hardened.

### Route params / URL params

Inconsistent:

- Better: `src/features/profile/hooks/usePlayerNavigation.ts:79` uses `useParams<{ slug?: string }>()`
- Weaker: `src/pages/ListManager.tsx:23`, `src/pages/TeamRosterView.tsx:7`, and `src/features/architect/GMDashboard/GMDashboard.tsx:107-112` use untyped `useParams()` and normalize manually

This is not catastrophic, but it is not uniformly typed.

### localStorage / sessionStorage

Mixed honesty:

- Stronger:
  - `src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts:40-84`
  - `src/features/ranker/utils/rankerLocalDraft.ts:50-108`
  - `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts:96-116`
- Weaker:
  - `src/features/tierMaker/hooks/useTierDraft.ts:71-80` parses straight into `DraftEnvelope`
  - `src/features/architect/admin/pickRightWizardDraft.ts:75-89` only checks object-ness and sentinel keys before casting

### JSON parsing

Also mixed:

- Better:
  - `src/features/architect/GMDashboard/components/DraftPositionsInput.tsx:232-257` parses then validates via `validateDraftPositionsMap`
  - `src/features/architect/admin/entitlementEditorFormState.ts:248-261` at least requires a JSON object
- Not real validation:
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1433-1438`
  - `src/features/architect/utils/mutationPipeline.ts:3201-3209`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:54-60`

Those JSON round-trips are clone helpers, not type guards.

### Schema validation usage (Zod)

Zod exists and is used, but unevenly:

- strong in user-content Firebase helpers
- present but dev-only in some player reads
- largely absent at Architect/base-data Firestore ingress

That means the repo has validation capability, but it is not consistently placed on the boundaries that need it most.

## Runtime vs Test Typing Findings

### Runtime

The runtime app surface is fully extension-migrated, but not uniformly hardened.

Main runtime weak-typing concentration:

- `src/global-shims.d.ts`
- Architect mutation / trade / cap layers
- filter UI helpers and compatibility types

Top runtime weak-typing counts:

- `174` `any`
- `1,471` `unknown`
- `7` `as unknown as`
- `11` ambient shim modules

That profile is typical of a repo that has been renamed to TS and partially normalized, but still relies heavily on loose carrier types.

### Tests

The test layer is much weaker than the runtime layer.

Test weak-typing counts:

- `755` `any`
- `395` `as any`
- `43` `as unknown as`
- `59` `Record<string, any>`

Representative examples:

- `src/tests/architect/useArchitectActions.freeAgency.test.tsx:141-179`
  - fixtures and builders use `baseTeam: any`
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts:46-60,81-166`
  - mock validators take `Record<string, any>`
  - core team/player builders return `Record<string, any>`
- `tests/__mocks__/firebase.ts:17-49,117-219`
  - the Firestore mock is broadly untyped and clone-based

This means the tests often validate behavior against permissive fake shapes, not against the runtime contracts the app claims to use.

### Does the test layer reinforce type truth?

Mostly no.

It helps with runtime behavior, but as a typing enforcement layer it frequently undermines trust because:

- mocks are loose
- fixtures are bag objects
- `as any` is widespread in exactly the tests that should be pinning hard interfaces

The one notable positive exception is the explicit negative type assertion in `src/tests/architect/mutationPipeline.currentStateIngressClosure.test.ts:173-175`.

## Top 20 Highest-Risk Files

Ranked by a weighted weak-typing score (`any`, casts, bag types, non-null assertions, shim declarations), then reviewed manually.

| Rank | File | Why it is high risk |
| --- | --- | --- |
| 1 | `src/tests/architect/useArchitectActions.freeAgency.test.tsx` | Extreme `any`/`as any` density (`133` / `91`); tests bypass the action-layer contracts they should pin down. |
| 2 | `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx` | Integration test with heavy cast-based fixture wiring; weak evidence for a critical path. |
| 3 | `src/global-shims.d.ts` | `11` ambient modules to `any`; masks real module contracts and even invents exports. |
| 4 | `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts` | Guardrail test relies on broad casted payloads rather than typed fixtures. |
| 5 | `src/tests/architect/mutationPipeline.boundary.e107.test.ts` | Boundary test that still uses large `any`/`as any` volume. |
| 6 | `src/tests/architect/mutationPipeline.batchedHardening.test.ts` | “Hardening” test itself is cast-heavy. |
| 7 | `src/tests/architect/mutationPipeline.computeResultBridge.test.ts` | Bridge contract test leans on `any` and bag objects. |
| 8 | `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx` | UI integration path with large cast count. |
| 9 | `src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx` | Behavior test still depends on weakly typed fixture matrices. |
| 10 | `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts` | Compatibility tests reinforce compatibility shims more than strict contracts. |
| 11 | `src/tests/architect/tradeContext_assertions.contract.test.ts` | Contract test uses `any` instead of contract-valid inputs. |
| 12 | `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` | Persistence truth test builds nearly everything as `Record<string, any>`. |
| 13 | `player-scrape/shared/scripts/build_players_bios.ts` | Scraper-side TS file still carries strong `any`/`as any` debt. |
| 14 | `src/tests/architect/capSheet_toast_dedupe.behavior.test.ts` | Behavior test bypasses type truth through cast-heavy arrangements. |
| 15 | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` | Matrix guardrail still shaped by `any` and `Record<string, any>`. |
| 16 | `player-scrape/contracts/scripts/parse_player.ts` | High `any` concentration in a key scraper/parser boundary. |
| 17 | `src/tests/architect/GMDashboard.smoke.test.tsx` | Smoke test surface uses `any` instead of compile-time honest fixtures. |
| 18 | `src/features/architect/utils/mutationPipeline.ts` | Critical runtime core with `89` `unknown`, clone helpers, and loose carrier types. |
| 19 | `src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx` | Boundary test depends on broad typed bags. |
| 20 | `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts` | Behavioral assertions are built on cast-heavy inputs. |

Additional nominal-TS runtime files worth calling out even though they score lower:

- `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.tsx`
  - implicit-any props in implementation
  - sibling declaration facade at `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.d.ts`
- `src/shared/components/ui/filters/RangeSelector.tsx`
  - explicit `any` props and `Record<string, any>`
- `src/pages/TierMakerView.tsx`
  - helper params such as `value`, `tierListMode`, and `nextMode` are untyped under permissive settings

## Strict-Mode Readiness

### `strict: true`

Not ready.

Evidence:

- root config still has `strict: false`
- scoped strict config fails with `2,567` errors
- high-error files include:
  - `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts` (`95`)
  - `tests/__mocks__/firebase.ts` (`87`)
  - `tests/architect/seasonManager.test.ts` (`84`)
  - `tests/architect/offerSheetPersistence.test.ts` (`80`)
  - `src/features/architect/utils/mutationPipeline.ts` (`55`)

### `noImplicitAny`

Not ready.

Evidence:

- strict output includes many `TS7006` implicit-any errors in test files
- runtime examples still exist outside the strict slice, such as:
  - `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.tsx:3,50`
  - `src/pages/TierMakerView.tsx:22,25,80`

### `noUncheckedIndexedAccess`

Not ready.

Evidence:

- direct dictionary access after broad casts is common:
  - `src/shared/utils/filtering/playerFilterUtils.ts:227-249`
  - `src/features/architect/utils/capLegalityValidation.ts:1330-1360`
  - `src/features/architect/utils/worldManager.ts:321-338`

This flag would surface a large volume of latent undefined-path issues.

### `exactOptionalPropertyTypes`

Not ready.

Evidence from strict output:

- repeated `null` vs `undefined` incompatibilities in Architect runtime code
- examples include:
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx`
  - `src/features/architect/GMDashboard/GMDashboard.tsx`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

The codebase still treats optional and nullable as loosely interchangeable.

### Overall readiness judgment

**Nowhere near ready** for repo-wide strict mode.

There is useful groundwork:

- TS extensions dominate the app
- Zod exists
- a scoped strict config exists

But the remaining work is not small cleanup. It is architectural hardening around boundaries, compatibility carriers, and tests.

## Recommended Next Phase

**Targeted hardening pass**

This should happen before any repo-wide strict-mode preparation. Priority order:

1. Remove or retire `src/global-shims.d.ts` by fixing the real imports/exports it is masking.
2. Put real parse/validation at Architect/base-data Firestore ingress:
   - `subscribeArchitectPlayerData`
   - `loadArchitectBasePlayer`
   - `teamLoader`
   - `worldManager`
   - `firebaseTeamPlanHelpers`
3. Replace bag-object bridge types in the most central runtime files:
   - `mutationPipeline.ts`
   - `tradeMachine/constants/types.ts`
   - `useArchitectActions.ts`
   - `useTradeMachine.ts`
4. Harden the highest-value tests and mocks so they stop bypassing the contracts:
   - `tests/__mocks__/firebase.ts`
   - top Architect integration/guardrail tests
5. After that, re-run the scoped strict config and measure the delta before considering wider strict-mode prep.

## Evidence Appendix

### Commands run

- `sed -n '1,220p' tsconfig.json`
- `sed -n '1,260p' package.json`
- `sed -n '1,200p' tsconfig.architect-strict.json`
- `rg --files -g 'tsconfig*.json' -g 'package.json' -g '*.d.ts' -g 'AGENTS.md'`
- `rg --files src tests | rg '\\.(js|jsx)$'`
- `rg --files | rg '\\.(js|jsx)$'`
- repo inventory/counting via `node -e` / `node <<'NODE' ... NODE`
- weak-marker counting via `node <<'NODE' ... NODE`
- `rg -n "useParams|useSearchParams|useLocation" src`
- `rg -n "localStorage|sessionStorage" src tests`
- `rg -n "JSON\\.parse|safeParse\\(|\\.parse\\(" ...`
- `rg -n "getDoc\\(|getDocs\\(|setDoc\\(|addDoc\\(|updateDoc\\(" ...`
- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run typecheck -- --project tsconfig.architect-strict.json 2>&1 | rg -c "error TS"`

### Most important files inspected

- `tsconfig.json`
- `tsconfig.architect-strict.json`
- `package.json`
- `src/global-shims.d.ts`
- `src/shared/components/ui/Dialog.tsx`
- `src/shared/components/BirdRightsIcon.tsx`
- `src/shared/components/TeamLogo.tsx`
- `src/shared/components/TeamSelectDropdown.tsx`
- `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.tsx`
- `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.d.ts`
- `src/firebase/listHelpers.ts`
- `src/firebase/rosterHelpers.ts`
- `src/firebase/rankerHelpers.ts`
- `src/shared/hooks/useSimplePlayerData.ts`
- `src/shared/hooks/usePlayerDetail.ts`
- `src/features/architect/utils/subscribeArchitectPlayerData.ts`
- `src/features/architect/utils/loadArchitectBasePlayer.ts`
- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/utils/worldManager.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/tradeMachine/constants/types.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/hooks/useTradeMachine.ts`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/shared/utils/filtering/playerFilterUtils.ts`
- `src/shared/components/ui/filters/RangeSelector.tsx`
- `src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts`
- `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts`
- `src/features/architect/admin/pickRightWizardDraft.ts`
- `src/features/ranker/utils/rankerLocalDraft.ts`
- `src/features/architect/GMDashboard/components/DraftPositionsInput.tsx`
- `tests/__mocks__/firebase.ts`
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- `src/tests/architect/mutationPipeline.currentStateIngressClosure.test.ts`
- `team-scrape/team-data/scripts/validate_output.ts`
- `player-scrape/contracts/scripts/parse_player.ts`

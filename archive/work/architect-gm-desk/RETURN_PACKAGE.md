# Architect GM Desk Home Base Return Package

## Outcome

The Full Cap Table now operates as the Architect team desk home base:

- full roster contract horizon with aligned canonical yearly totals;
- expandable dead-money and cap-hold detail plus incomplete-roster charges;
- desk-level FA Options that stay separate from roster truth until signing;
- applied trade and completed signing return paths to the Full Cap Table;
- receipt-driven multi-player row highlights and affected total-year highlights.

The existing contract modal, Free Agency signing flow, Trade Machine legality
flow, Architect action layer, and mutation pipeline remain the action
authorities.

## Source Checkpoints

| Commit | Purpose |
|--------|---------|
| `4e762242` | Derive cap-table horizon from visible team data |
| `bc4c9c3b` | Expose canonical non-player money details |
| `2833c69b` | Surface desk-level FA Options |
| `6c551d0a` | Highlight receipt-driven row and total changes |

## Files Changed

- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/offerSheetTypes.ts`
- `src/features/architect/GMDashboard/sections/CapTableSection.tsx`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/types.ts`
- `src/tests/architect/capSheetFull_homeBase.behavior.test.tsx`
- `src/tests/architect/GMDashboard.smoke.test.tsx`
- `src/tests/architect/editContractModal_closure.gate.test.ts`
- `src/tests/architect/freeAgency_closure.gate.test.ts`
- `src/features/architect/ARCHITECT_FEATURE_README.md`
- `archive/work/architect-gm-desk/GM_DESK_HOME_BASE_UX_SPEC.md`
- `archive/work/architect-gm-desk/GOAL_AND_ACCEPTANCE.md`
- `archive/work/architect-gm-desk/IMPLEMENTATION_PLAN.md`
- `archive/work/architect-gm-desk/RETURN_PACKAGE.md`

## Validation

- `npm run typecheck` - passed.
- `npm run build` - passed with existing dependency, Firebase import, and bundle
  size warnings.
- `npm run validate:project` - passed.
- `npm run docs` - passed; generated component docs were unchanged.
- `npm run docs:guardrails` - passed.
- `npm run test:ui -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx src/tests/architect/GMDashboard.smoke.test.tsx src/tests/architect/stage2a.navigationContinuity.test.tsx src/tests/architect/stage2c.playerRosterContinuity.test.tsx --reporter=dot`
  - passed, 4 files and 58 tests.
- `npm run test:architect -- --reporter=dot` - passed, 287 files and 3393
  tests.
- `npm run lint:md` - reports six pre-existing failures in unrelated
  `docs/architect/*` files. This initiative did not modify those files.

## Intentionally Skipped

- `npm run lint`: skipped per `AGENTS.md`; the repo has many pre-existing lint
  errors and lint was not requested.
- `npm run test:full`: skipped because the prompt did not contain the required
  exact permission phrase `RUN FULL SUITE`.
- `npm run test:diff`: not rerun after implementation because its branch-diff
  inference selects a full run from pre-existing shared-file changes.

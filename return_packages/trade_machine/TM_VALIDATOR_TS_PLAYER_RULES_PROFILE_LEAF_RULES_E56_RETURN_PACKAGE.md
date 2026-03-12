# TM_VALIDATOR_TS_PLAYER_RULES_PROFILE_LEAF_RULES_E56 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the five `playerRulesProfile` leaf-rule modules into authoritative TypeScript:
  - `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.ts`
  - `src/features/architect/utils/playerRulesProfile/maxSalaryRules.ts`
  - `src/features/architect/utils/playerRulesProfile/birdRightsRules.ts`
  - `src/features/architect/utils/playerRulesProfile/rfaRules.ts`
  - `src/features/architect/utils/playerRulesProfile/extensionRules.ts`
- Behavior was preserved across the leaf-rule phase: legacy entry points, RuleContext entry points, result shapes, warning behavior, fallback/default behavior, exported constants, aliases, and reason strings remained unchanged.
- No leaf-rule business logic had to remain JS. The kept leaf `.js` files remain only as pure compatibility shims for explicit `.js` and direct-path import stability.

## 2. Files Changed
- `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.ts`
  - Added the authoritative TS implementation for minimum-salary lookups, years-of-service extraction, RuleContext handling, and trade minimum cap-hit logic.
  - Safe because the runtime logic, returned fields, fallback behavior, and `MINIMUM_SALARY_SCALE` alias were ported line-faithfully.
- `src/features/architect/utils/playerRulesProfile/maxSalaryRules.ts`
  - Added the authoritative TS implementation for max-salary tiers, supermax checks, and RuleContext handling.
  - Safe because the tier math, 105% Bird fallback, award parsing, and reason strings were preserved exactly.
- `src/features/architect/utils/playerRulesProfile/birdRightsRules.ts`
  - Added the authoritative TS implementation for Bird-rights classification, signing abilities, and RuleContext handling.
  - Safe because Bird-type mapping, tenure inference, warnings, summaries, and signing-capability calculations were preserved exactly.
- `src/features/architect/utils/playerRulesProfile/rfaRules.ts`
  - Added the authoritative TS implementation for RFA status, qualifying-offer calculations, deadlines, and RuleContext handling.
  - Safe because expiring-contract checks, rookie/veteran QO logic, minimum-salary floor behavior, and timing outputs were preserved exactly.
- `src/features/architect/utils/playerRulesProfile/extensionRules.ts`
  - Added the authoritative TS implementation for extension eligibility, extension terms, and RuleContext handling.
  - Safe because blocker logic, veteran/rookie/designated-veteran/trade-restricted branching, warnings, and term calculations were preserved exactly.
- `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js`
  - Reduced to a pure compatibility shim.
  - Safe because existing explicit `.js` imports still resolve the same named exports through the TS authority.
- `src/features/architect/utils/playerRulesProfile/maxSalaryRules.js`
  - Reduced to a pure compatibility shim.
  - Safe because direct `.js` consumers still resolve the same export surface with no call-site changes.
- `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
  - Reduced to a pure compatibility shim.
  - Safe because legacy direct-path imports and extensionless TS imports continue to converge on the same authority.
- `src/features/architect/utils/playerRulesProfile/rfaRules.js`
  - Reduced to a pure compatibility shim.
  - Safe because the existing RFA import surface remains stable while business logic now lives in TS.
- `src/features/architect/utils/playerRulesProfile/extensionRules.js`
  - Reduced to a pure compatibility shim.
  - Safe because explicit `.js` imports continue working and no consumer rewiring was required.
- `tests/architect/playerRulesProfile.test.js`
  - Added direct RuleContext coverage for minimum salary, max salary, Bird rights, RFA, and extension surfaces, plus export-contract checks for behavior-bearing constants and aliases.
  - Safe because this only strengthens proof around the migrated leaf surfaces without altering runtime logic.
- `tests/smoke/playerRulesProfileLeafImports.smoke.test.ts`
  - Added focused compatibility proof for extensionless imports, explicit `.js` deep imports, export identity parity, and shim-only JS contents across all five leaf modules.
  - Safe because it verifies compatibility requirements without changing runtime behavior.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E56 execution entry.
  - Safe because it is documentation only.
- `return_packages/trade_machine/TM_VALIDATOR_TS_PLAYER_RULES_PROFILE_LEAF_RULES_E56_RETURN_PACKAGE.md`
  - Added this execution return package.
  - Safe because it is documentation only.

## 3. Types Introduced or Hardened
- `MinimumSalaryInfo`
  - Represents the authoritative minimum-salary result shape.
  - Applies in `minimumSalaryRules.ts` for both legacy and RuleContext entry points.
- `MaxSalaryTier` and `SupermaxEligibilityInfo`
  - Represent the authoritative max-salary tier definitions and supermax-evaluation result shape.
  - Apply in `maxSalaryRules.ts` across tier selection, supermax checks, and reason construction.
- `BirdRightsSigningAbilities` and `BirdRightsInfo`
  - Represent the authoritative Bird-rights signing-capability shape and final Bird-rights result.
  - Apply in `birdRightsRules.ts` across both legacy and RuleContext paths.
- `ExtensionEligibilityInfo`, `ExtensionTermsInfo`, and `ExtensionProfile`
  - Represent the authoritative extension eligibility, terms, and combined RuleContext output shapes.
  - Apply in `extensionRules.ts` across eligibility and term calculation flows.
- Narrow local `*RuleContextLike` and player/contract helper types in each leaf module
  - Represent the minimal accepted shapes required by the authoritative TS leaf paths without widening into shared contracts.
  - Apply only inside the five migrated leaf modules.

## 4. Migration Work Completed
- `minimumSalaryRules`
  - Moved the authoritative implementation into `minimumSalaryRules.ts`.
  - Preserved years-of-service extraction, season normalization/fallback, dual legacy/RuleContext entry handling, minimum-salary lookup behavior, and the `MINIMUM_SALARY_SCALE` alias exactly.
  - No contract correction was required by typing.
- `maxSalaryRules`
  - Moved the authoritative implementation into `maxSalaryRules.ts`.
  - Preserved max-tier routing, supermax / Higher Max handling, Bird 105% comparison behavior, award normalization, and both legacy + RuleContext entry paths exactly.
  - No contract correction was required by typing.
- `birdRightsRules`
  - Moved the authoritative implementation into `birdRightsRules.ts`.
  - Preserved Bird-rights normalization, existing-contract overrides, tenure inference, warning behavior for missing cap/currentYear context, summary strings, and RuleContext mapping behavior exactly.
  - No contract correction was required by typing.
- `rfaRules`
  - Moved the authoritative implementation into `rfaRules.ts`.
  - Preserved expiring-contract detection, rookie/veteran qualifying-offer calculations, minimum-salary floor behavior, deadline handling, and RuleContext synthesis exactly.
  - Typing exposed an existing contract mismatch: one legacy `computeRFAStatus()` branch returns the RFA/QO payload without a `reason` field. Runtime behavior was left unchanged and the TS return typing for that surface was kept loose rather than correcting the payload.
- `extensionRules`
  - Moved the authoritative implementation into `extensionRules.ts`.
  - Preserved veteran/rookie eligibility rules, blocker strings, warning behavior, extension-term calculations, and RuleContext synthesis exactly.
  - No contract correction was required by typing.

## 5. JS Holdouts
- `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js`
  - Remains JS intentionally as a pure compatibility shim for explicit `.js` imports and direct-path compatibility.
- `src/features/architect/utils/playerRulesProfile/maxSalaryRules.js`
  - Remains JS intentionally as a pure compatibility shim for explicit `.js` imports and direct-path compatibility.
- `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
  - Remains JS intentionally as a pure compatibility shim for explicit `.js` imports and direct-path compatibility.
- `src/features/architect/utils/playerRulesProfile/rfaRules.js`
  - Remains JS intentionally as a pure compatibility shim for explicit `.js` imports and direct-path compatibility.
- `src/features/architect/utils/playerRulesProfile/extensionRules.js`
  - Remains JS intentionally as a pure compatibility shim for explicit `.js` imports and direct-path compatibility.
- `src/features/architect/utils/playerRulesProfile/computeProfile.js`
  - Remains JS because E56 was explicitly limited to the leaf-rule phase and `computeProfile.js` is the deferred aggregation hub for the next follow-up phase.
- `src/features/architect/utils/playerRulesProfile/index.js`
  - Remains JS because it is an intentional public barrel surface, not part of the leaf-rule business-logic migration.
- `src/features/architect/utils/playerRulesProfile/types.js`
  - Remains JS because it is JSDoc-only support documentation, not a live leaf-rule business-logic module.

## 6. Regression Coverage Run
- `npm run test:node -- --reporter=dot tests/architect/playerRulesProfile.test.js tests/architect/ruleContextTiming.test.js tests/architect/salaryEngine.test.js tests/smoke/playerRulesProfileLeafImports.smoke.test.ts`
  - Proved unchanged direct leaf behavior, unchanged RuleContext behavior, unchanged salary-engine wrapper behavior, and direct-path / explicit `.js` import compatibility across the five migrated leaf modules.
  - Result: PASS (`4` files, `95` tests).
- `npm run typecheck`
  - Proved the five new authoritative TS leaf modules, the shim-backed compatibility paths, and the focused tests compile cleanly under the repo TypeScript configuration.
  - Result: PASS.
- `npm run validate:project`
  - Proved the repo structure remained valid after adding the five TS authorities, the smoke test, and the return-package/doc updates.
  - Result: PASS.

## 7. Post-E56 Status
- The `playerRulesProfile` leaf-rule phase is effectively complete.
- No follow-up is required inside E56 itself. The remaining JS inside the migrated leaf surfaces is intentional shim-only compatibility support.
- The grouped phase succeeded cleanly.
- `computeProfile.js` remains the intended next follow-up phase unless future execution evidence proves otherwise.

## 8. Master Doc Update
- Added `### Validator TS Player Rules Profile Leaf Rules E56 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the five `playerRulesProfile` leaf-rule modules are now TS-backed.
- Recorded that behavior remained unchanged across legacy + RuleContext entry points, warnings, fallbacks, constants, aliases, and reason strings.
- Recorded that the kept leaf `.js` files are now shim-only compatibility surfaces.
- Recorded that the grouped leaf-rule phase completed cleanly and that `computeProfile.js` remains the intended next follow-up phase.

# TM_VALIDATOR_TS_ARCHITECT_CONTRACT_CAP_HOOKS_E71 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the Architect contract/cap hook boundary to authoritative TypeScript in `src/features/architect/hooks/usePlayerRulesProfiles.ts` and `src/features/architect/hooks/useCapValidation.ts`.
- Preserved behavior, export surfaces, returned object key order, nested helper key order, `useMemo` dependency arrays, memoization boundaries, warning/error assembly, and fallback behavior exactly.
- No business logic had to remain in JS. The two original `.js` hook files remain only as pure compatibility shims for direct-path, explicit `.js`, and extensionless import stability.

## 2. Files Changed
- `src/features/architect/hooks/usePlayerRulesProfiles.ts`
  - Added the authoritative TS implementation of the player-rules-profile hook.
  - Safe because the runtime logic, return-object key order, helper ordering, and dependency array were copied exactly from the prior JS authority with type-only hardening kept local.
- `src/features/architect/hooks/useCapValidation.ts`
  - Added the authoritative TS implementation of the contract/cap validation hook and `buildSigningGuardrails`.
  - Safe because branch order, warning/error messages, fallback behavior, object assembly order, and memoization boundaries were preserved exactly; TS-only adapter casts were used where needed instead of semantic changes.
- `src/features/architect/hooks/usePlayerRulesProfiles.js`
  - Replaced business logic with a pure `export *` shim to the TS authority.
  - Safe because named-export behavior is unchanged and existing consumers continue resolving the same path.
- `src/features/architect/hooks/useCapValidation.js`
  - Replaced business logic with a pure shim that re-exports named exports plus `default` from the TS authority.
  - Safe because named/default export behavior remains identical for direct-path and explicit `.js` consumers.
- `src/tests/architect/usePlayerRulesProfiles.behavior.test.ts`
  - Added focused hook coverage for empty/default return shapes, key ordering, multi-year helper behavior, default-year fallback, zero-salary apron quirk, and exact memoization boundaries.
  - Safe because it validates the public hook surface without widening into adjacent UI or orchestration files.
- `src/tests/architect/useCapValidation.behavior.test.ts`
  - Added focused hook coverage for signing guardrails, extension behavior with and without `rulesProfile`, option timing/apron messaging, signing warning ordering, waive/stretch warnings, sign-and-trade blocking, return-object key ordering, and memoization boundaries.
  - Safe because it tests the existing hook contract directly rather than changing consumers.
- `src/tests/architect/architectContractCapHooks.compatibility.guardrail.test.ts`
  - Added compatibility guardrails proving the two kept `.js` files are shim-only and that explicit `.js` imports expose the same API as extensionless imports.
  - Safe because it only enforces the intended E71 compatibility contract.
- `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js`
  - Added `src/features/architect/hooks/useCapValidation.ts` to the allowlist alongside the existing `.js` shim path.
  - Safe because the hook’s warning/apron comparisons already existed and remain UI-only; the authoritative file path just moved.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E71 execution entry documenting the TS-backed hook boundary, behavior preservation, shim retention, and completion status.
  - Safe because it records the executed scope without affecting runtime code.
- `return_packages/trade_machine/TM_VALIDATOR_TS_ARCHITECT_CONTRACT_CAP_HOOKS_E71_RETURN_PACKAGE.md`
  - Added the E71 execution return package.
  - Safe because it is documentation only.

## 3. Types Introduced or Hardened
- `PlayerRulesProfilesResult`
  - Represents the exact returned hook surface from `usePlayerRulesProfiles`, including `Map` containers and helper functions.
  - Applies in `src/features/architect/hooks/usePlayerRulesProfiles.ts` to lock the authoritative TS return path without changing runtime assembly order.
- `PlayerRulesProfilePlayer`
  - Represents the permissive player shape accepted by `usePlayerRulesProfiles`, layered on top of the salary-engine authority input type.
  - Applies in `src/features/architect/hooks/usePlayerRulesProfiles.ts` so current partial caller/test objects still typecheck while keeping the existing player ID fallback logic intact.
- `SigningGuardrails`
  - Represents the assembled `buildSigningGuardrails` return object with the existing key set and ordering.
  - Applies in `src/features/architect/hooks/useCapValidation.ts` on the authoritative guardrail path used by `useCapValidation` and `EditContractModal`.
- `RulesProfileLike`
  - Represents the permissive partial rules-profile shape accepted by `useCapValidation`.
  - Applies in `src/features/architect/hooks/useCapValidation.ts` so current callers can continue passing partial profile objects without widening scope into shared type exports.
- `UseCapValidationResult`
  - Represents the exact `{ warnings, errors, isValid, incomplete }` surface returned by the cap-validation hook.
  - Applies in `src/features/architect/hooks/useCapValidation.ts` to keep the authoritative return path explicit without altering runtime behavior.

## 4. Migration Work Completed
- `usePlayerRulesProfiles`
  - Moved the full hook implementation into `usePlayerRulesProfiles.ts`.
  - Preserved authoritative behavior by keeping the exact return-object key order for both empty and populated branches, the exact player-key fallback chain, the same multi-year `Map` assembly, the same default-year resolution, and the same `useMemo` dependency array ordering.
  - Minimal contract correction required by typing: none at runtime. The one cast around `getTeamApronStatus` was intentionally used to preserve the existing legacy numeric-call behavior rather than “fix” it.
- `useCapValidation`
  - Moved the full hook implementation and `buildSigningGuardrails` into `useCapValidation.ts`.
  - Preserved authoritative behavior by keeping the exact branch order, message text, return-object key order, helper key order, warning/error push order, guardrail math, Bird-rights warning source lookup, and the exact `useMemo` dependency array ordering.
  - Minimal contract correction required by typing: none at runtime. The `calculateTeamCapHit` adapter now uses a typed cast so the existing `getContractYearSlice` wiring remains unchanged.

## 5. JS Holdouts
- `src/features/architect/hooks/usePlayerRulesProfiles.js`
  - Remains JS intentionally as a pure compatibility shim only.
  - Reason: preserve direct-path, explicit `.js`, and extensionless import compatibility without rewriting consumers in E71.
- `src/features/architect/hooks/useCapValidation.js`
  - Remains JS intentionally as a pure compatibility shim only.
  - Reason: preserve current named/default import compatibility, including explicit `.js` imports, without widening E71 into consumers.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new TS hook authorities and focused tests compile cleanly in the repo.
  - Result: PASS.
- `npm run validate:project`
  - Proved the repo structure still matches the approved project schema after adding the new TS hook/test files.
  - Result: PASS.
- `npm run test:node -- --reporter=dot src/tests/architect/usePlayerRulesProfiles.behavior.test.ts src/tests/architect/useCapValidation.behavior.test.ts src/tests/architect/architectContractCapHooks.compatibility.guardrail.test.ts src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js`
  - Proved the hook behavior, return shapes, memoization boundaries, `.js` shim compatibility, and updated apron allowlist all behave as required inside the E71 scope.
  - Result: PASS (`4` files, `22` tests).
- `npm run test:ui -- --reporter=dot tests/architect/EditContractModal.rules.test.jsx tests/architect/CapSheetFull.rules.test.jsx`
  - Proved the narrow downstream UI consumers that depend on these hooks still behave unchanged.
  - Result: PASS (`2` files, `14` tests).
- Commands intentionally skipped:
  - `npm run test:architect -- --reporter=dot`
  - Skipped because the repo’s `test:architect` script ignores file-level filters and currently includes an unrelated known failure in `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`, so it is not a narrow or attributable E71 proof command.
  - `npm run build`
  - Skipped because E71 changed hook internals and focused validations, not routes/components/layouts; the downstream consumer proof set covered the affected UI surfaces directly.

## 7. Post-E71 Status
- The contract/cap hook phase is effectively complete.
- No follow-up is currently recommended beyond any future importer-state-driven decision to retire the kept `.js` shims if they ever become unnecessary.
- The grouped mini-arc succeeded cleanly with no blocker that required widening into `useArchitectPlayerData`, adjacent UI hooks, consumers, or orchestration.
- The broader Architect contract/cap hook arc is now effectively complete.

## 8. Master Doc Update
- Added `### Validator TS Architect Contract/Cap Hooks E71 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the Architect contract/cap hook boundary is now TS-backed through `usePlayerRulesProfiles.ts` and `useCapValidation.ts`.
- Recorded that behavior remained unchanged, including export surfaces, returned object key order, nested helper key order, warning/error assembly, fallback behavior, and `useMemo` dependency arrays.
- Recorded that no immediate follow-up remains beyond optional future shim retirement.
- Recorded that the grouped E71 phase completed cleanly.
- Explicitly stated that the broader Architect contract/cap hook arc is now effectively complete.

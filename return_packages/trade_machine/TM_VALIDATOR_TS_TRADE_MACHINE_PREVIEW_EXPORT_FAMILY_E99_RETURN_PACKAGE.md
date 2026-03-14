# TM_VALIDATOR_TS_TRADE_MACHINE_PREVIEW_EXPORT_FAMILY_E99 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the counted Trade Machine preview/export family to authoritative TypeScript-backed surfaces:
  - `src/features/architect/tradeMachine/TradePreviewModal.tsx`
  - `src/features/architect/tradeMachine/TradeExportCapture.tsx`
- Preserved behavior across the preview/export pair, including exact visible export text, labels, empty states, disclaimer text, legal footer semantics, hidden offscreen capture behavior, modal open/close flow, scale/measurement flow, and download wiring.
- No business logic had to remain in JSX. The only directly related JS/JSX holdouts are the same-path `.jsx` compatibility shims, which remain by E99 rule.

## 2. Files Changed
- `src/features/architect/tradeMachine/TradePreviewModal.tsx`
  - Added the authoritative TS-backed modal implementation.
  - Safe because it preserves the existing `open` short-circuit, dual-surface render shape, `useLayoutEffect` lifecycle, `ResizeObserver` wiring, and download trigger flow exactly.
- `src/features/architect/tradeMachine/TradeExportCapture.tsx`
  - Added the authoritative TS-backed export/capture implementation.
  - Safe because it preserves the current `forwardRef` contract, incoming asset derivation, ordering, export text, disclaimer/footer text, and loose fallback behavior exactly.
- `src/features/architect/tradeMachine/tradePreviewExportTypes.ts`
  - Added a local permissive type helper for `teams`, `result`, `yearKey`, player, entitlement, and modal/capture prop shapes.
  - Safe because the types stay internal to the preview/export family and use optional fields plus index signatures rather than hardening runtime contracts.
- `src/features/architect/tradeMachine/TradePreviewModal.jsx`
  - Replaced the legacy JSX authority with a pure same-path compatibility shim.
  - Safe because the file now re-exports the `.tsx` authority without changing the default export surface.
- `src/features/architect/tradeMachine/TradeExportCapture.jsx`
  - Replaced the legacy JSX authority with a pure same-path compatibility shim.
  - Safe because the file now re-exports the `.tsx` authority without changing the default export surface.
- `src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts`
  - Added E99 compatibility guardrails for the two kept `.jsx` shims.
  - Safe because the test proves the exact-path compatibility contract instead of changing runtime behavior.
- `src/tests/trade/TradePreviewExport.guardrail.test.tsx`
  - Added narrow UI guardrails for closed/open modal behavior, hidden capture count, scale wiring, download wiring, export rendering, and footer/disclaimer text.
  - Safe because the test is scoped to the counted preview/export pair only.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E99 master-doc entry.
  - Safe because it documents the completed boundary without changing runtime code.
- `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_PREVIEW_EXPORT_FAMILY_E99_RETURN_PACKAGE.md`
  - Added the E99 execution return package.
  - Safe because it records the completed migration and validation evidence only.

## 3. Types Introduced or Hardened
- `TradePreviewModalProps`
  - Represents the live preview modal contract: `open`, `onClose`, `teams`, `result`, and `yearKey`.
  - Applies in `TradePreviewModal.tsx` as the authoritative modal prop shape.
- `TradeExportCaptureProps`
  - Represents the export-only capture contract: `teams`, `result`, `yearKey`, `label`, and `date`.
  - Applies in `TradeExportCapture.tsx` as the authoritative capture prop shape.
- `TradePreviewTeamLike`
  - Represents the loose per-team slot shape used by both preview and export surfaces.
  - Applies across the authoritative pair as the shared `teams[]` input contract.
- `TradePreviewPlayerLike`
  - Represents the loose outgoing/incoming player shape with current route, salary, display-name, and headshot fallbacks.
  - Applies in the authoritative capture rendering path and incoming asset preprocessing loop.
- `TradePreviewEntitlementLike`
  - Represents the loose entitlement asset shape with current routing, badge, and terms fallback fields.
  - Applies in the authoritative capture preprocessing and entitlement render path.
- `TradePreviewResultLike`
  - Represents the loose preview/export result contract, especially `legal` and `summaryByTeamIndex`.
  - Applies in both authoritative files for footer state and cap impact display.
- `IncomingTradeAssets`
  - Represents the internal preprocessed incoming assets bucket for each team card.
  - Applies only inside the authoritative `TradeExportCapture.tsx` preprocessing/render flow.

## 4. Migration Work Completed
- Shared local typing
  - Added `tradePreviewExportTypes.ts` so the preview/export pair could compile cleanly without widening into public feature-level types.
  - Authoritative behavior was preserved by keeping all fields optional and index-signature friendly.
  - No runtime contract correction was required.
- `TradePreviewModal` authority migration
  - Moved the preview modal into `TradePreviewModal.tsx` and preserved the exact dual-render open state: one hidden offscreen capture surface plus one visible preview surface.
  - Preserved exact modal close behavior, download button behavior, `scale` default, window resize listener wiring, and `ResizeObserver` setup/cleanup sequencing.
  - No callback contract or prop behavior correction was required.
- `TradeExportCapture` authority migration
  - Moved the capture/export surface into `TradeExportCapture.tsx` and preserved the exact export layout, team ordering, player/entitlement sections, empty states, disclaimer text, and legal footer text.
  - Preserved the current `forwardRef` behavior, incoming asset routing/fallback logic, `yearKey` salary fallback, and cap impact lookup from `result.summaryByTeamIndex`.
  - No render-text or formatting correction was required.
- Compatibility and proof work
  - Replaced both same-path `.jsx` files with pure compatibility shims and added a dedicated E99 compatibility guardrail.
  - Added a narrow UI guardrail that proves the modal/capture pair still behaves as one offscreen capture surface plus one visible preview surface and still uses the current download and scale/measurement contract.
  - The only follow-up change during validation was a test-only timezone-safe fixture adjustment from a midnight UTC string to a midday `Date`, which did not change runtime code or behavior.

## 5. JS/JSX Holdouts
- `src/features/architect/tradeMachine/TradePreviewModal.jsx`
  - Remains JSX as a shim-only compatibility surface by E99 rule.
  - Exact reason: same-path `.jsx` deletion was explicitly out of scope for this pass even if importer scans looked favorable.
- `src/features/architect/tradeMachine/TradeExportCapture.jsx`
  - Remains JSX as a shim-only compatibility surface by E99 rule.
  - Exact reason: same-path `.jsx` deletion was explicitly out of scope for this pass even if importer scans looked favorable.
- `src/features/architect/tradeMachine/TradeEditor.jsx`
  - Remains JSX and out of scope.
  - Exact reason: E99 was locked to the preview/export pair only, and execution did not surface any blocker requiring expansion into the editor hub.
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - Remains JSX and out of scope.
  - Exact reason: E99 was locked to the preview/export pair only, and execution did not surface any blocker requiring expansion into the team-card hub.
- `src/features/architect/tradeMachine/CapImpactTiles.jsx`, `src/features/architect/tradeMachine/SelectTeamCard.jsx`, `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`, `src/features/architect/tradeMachine/TradePlayerRow.jsx`, `src/features/architect/tradeMachine/EntitlementPicksList.jsx`, `src/features/architect/tradeMachine/EntitlementPickRow.jsx`, `src/features/architect/tradeMachine/TradeExceptionManager.jsx`
  - Remain JS/JSX and out of scope.
  - Exact reason: these excluded Trade Team Card leaf surfaces were explicitly outside the E99 preview/export boundary, and no execution blocker required reopening them.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new `.tsx` authorities and local preview/export types compile cleanly without widening type fallout into excluded areas.
  - Result: PASS.
- `npm run test:node -- --reporter=dot src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts`
  - Proved both `.jsx` files remain pure shims and that explicit `.jsx` imports still match extensionless imports with the same default-only API.
  - Result: PASS.
- `npm run test:ui -- --reporter=dot src/tests/trade/TradePreviewExport.guardrail.test.tsx`
  - First run exposed a timezone-sensitive test fixture expectation (`January 15, 2026` from a midnight UTC string) rather than a runtime regression.
  - Result: FAIL on the first run for the test fixture only.
- `npm run test:ui -- --reporter=dot src/tests/trade/TradePreviewExport.guardrail.test.tsx`
  - Re-run after converting the test fixture to a midday `Date`, which removed the timezone rollover from the assertion while keeping the runtime component unchanged.
  - Proved closed/open modal behavior, exact one-hidden-plus-one-visible render shape, scale/measurement wiring, download wiring, forwardRef behavior, export text, empty states, disclaimer, footer text, ordering, and current fallback behavior.
  - Result: PASS.
- `npm run build`
  - Proved the preview/export TS migration builds in production mode.
  - Result: PASS with pre-existing warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunks outside the E99 boundary.
- `npm run validate:project`
  - Proved the repo structure remains valid after adding the new authorities, tests, and local type helper.
  - Result: PASS.
- Intentionally skipped commands
  - `npm run test:diff`, `npm run test:trade`, and `npm run test:architect` were skipped because the new E99 guardrails directly cover the counted preview/export pair and broader suites were not required to prove this boundary.
  - `npm run test:full` was skipped because the prompt did not contain `RUN FULL SUITE`, and AGENTS.md blocks full-suite execution without that exact phrase.
  - `npm run lint` was skipped because AGENTS.md limits lint to explicit requests and the repo carries known pre-existing lint noise outside E99.
  - `npm run schema:generate` and `npm run schema:check` were skipped because E99 did not modify schemas.

## 7. Post-E99 Status
- The counted preview/export family is effectively complete and is now materially TS-backed through `.tsx` authorities.
- No follow-up is recommended inside the named preview/export pair beyond any future optional cleanup decision about removing the kept `.jsx` shims.
- The grouped batched pass succeeded cleanly and did not require widening into `TradeEditor.jsx`, `TradeTeamCard.jsx`, the Trade Team Card leaf family, `mutationPipeline.js`, or dashboard hubs.
- The broader preview/export boundary is now effectively complete.
- Remaining Trade Machine JS/JSX work is outside E99 in excluded editing/orchestration hubs and the excluded Trade Team Card leaf family.

## 8. Master Doc Update
- Added the indexed `Validator TS Trade Machine Preview/Export Family E99 (2026-03-14)` entry to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that:
  - `TradePreviewModal.tsx` and `TradeExportCapture.tsx` are now the authoritative TS-backed preview/export surfaces
  - both same-path `.jsx` files remain shim-only by rule
  - behavior remained unchanged across preview/export text, lifecycle, measurement, capture, download, and footer/disclaimer semantics
  - the grouped batch completed cleanly
  - no mandatory follow-up remains inside the preview/export pair
  - the broader preview/export boundary is now effectively complete

# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E102 — EXECUTION RETURN PACKAGE

## 1. Summary
- Execution-time repo inspection re-ran the full two-lane comparison instead of locking the surgical winner in advance.
- The strongest Lane A surgical comparison target from the current repo state is the paired Trade Machine orchestration boundary:
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- The recommended next migration move is still a `batched low-risk` pass, not a `high-risk surgical` scope.
- Current repo evidence points to the `GM world-support family` as the best next scope:
  - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
- Estimated live JS/JSX/TSX business-logic count for the recommended scope: `3`.
- It still looks worth doing next because it is the smallest coherent live-business-logic batch left near the dashboard/world frontier, with a cleaner cutoff and less behavior risk than the strongest remaining surgical alternative.

## 2. Closed Scope Confirmation
- This audit treated E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, E86, E88, E89, E91, E93, E95, E97, E99, and E101 as closed or complete.
- The audit avoided silently reopening them by:
  - treating same-path `.js/.jsx` files that already have `.ts/.tsx` authorities as `TS-backed shims`
  - keeping the closed E97 validator/result-presentation family, the closed E99 preview/export family, and the closed E101 Trade Team Card leaf family out of new live-business-logic counts
  - classifying top-level architect wrapper files, section wrappers, and index barrels as compatibility or wiring surfaces rather than new migration targets
  - calling out weak-import or test-backed residue explicitly instead of silently folding it into the next scope
- No current repo evidence forced a reopening of any prior closed arc.

## 3. Candidate Next Scopes

### Frontier Inventory Snapshot
- `live business logic`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - `src/shared/components/EditContractModal.jsx`
  - `src/shared/utils/contracts/contractUtils.js`
  - `src/shared/utils/contracts/seasonNormalizer.js`
- `TS-backed shim`
  - the closed E101 same-path `.jsx` files under `src/features/architect/tradeMachine/`
  - the closed E97 same-path `.jsx` files under `src/features/architect/tradeMachine/`
  - the closed E99 same-path `.jsx` files under `src/features/architect/tradeMachine/`
  - `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - the same-path `.js` tradeMachine utility shims such as `computeTradeDraftKey.js`, `devSntInjector.js`, `entitlementWarnings.js`, and `getOfficialSalaryMatchingSnapshot.js`
- `barrel/public entrypoint`
  - `src/features/architect/GMDashboard/index.jsx`
  - `src/features/architect/GMDashboard/components/index.js`
  - `src/shared/utils/contracts/index.js`
- `constants/data/config`
  - `src/features/architect/utils/capProjections.js`
- `thin wrapper/deprecated wrapper`
  - `src/features/architect/ValidationWarnings.jsx`
  - `src/features/architect/LeagueView.jsx`
  - `src/features/architect/RosterVisual.jsx`
  - `src/features/architect/GMDashboard/sections/TradeSection.jsx`
  - `src/features/architect/GMDashboard/sections/RosterSection.jsx`
  - `src/features/architect/GMDashboard/sections/HistorySection.jsx`
  - `src/features/architect/GMDashboard/sections/CapTableSection.jsx`
- `debug/support/monitoring`
  - no remaining JS/JSX file in the nearby frontier beat the leading Lane A or Lane B candidates; the notable active debug surface in this area is already TS-backed (`CapAuditDebugPanel.tsx`)
- `dead/scratch/zero-import residue`
  - `src/features/architect/contract/ContractEditor/ContractEditor.jsx` was inspected and classified as weak-import residue through folder exports only
  - `src/features/architect/contract/ContractEditorModal/ContractEditorModal.jsx` was inspected and classified as weak-import residue through folder exports only
  - `src/shared/utils/contracts/contractParser.js` was inspected and classified as test-backed residue, not a live app-runtime leader
- `low-risk presentational component`
  - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
- `high-risk state/orchestration hub`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/shared/components/EditContractModal.jsx`

### Candidate 1 — mutationPipeline.js
- Scope name: `mutationPipeline.js`
- Lane: `high-risk surgical`
- What it includes:
  - `src/features/architect/utils/mutationPipeline.js`
- What it excludes:
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - dashboard/world hubs
- Estimated live JS/JSX/TSX business-logic file count: `1`
- Why it is or isn’t a good next move:
  - It remains a serious candidate because it is the central mutation read/compute/validate/persist engine and still sits at roughly `4589` LOC.
  - It loses the Lane A comparison because its cross-feature blast radius is broader than a sensible next-step audit should promote while smaller coherent batches still exist.

### Candidate 2 — TradeEditor.jsx alone
- Scope name: `TradeEditor.jsx`
- Lane: `high-risk surgical`
- What it includes:
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
- What it excludes:
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - the closed E101 leaf family
  - the closed E97 and E99 families
- Estimated live JS/JSX/TSX business-logic file count: `1`
- Why it is or isn’t a good next move:
  - It is a real surgical candidate because it owns `useTradeMachine` wiring, preview modal control, entitlement editing state, and apply-trade dispatch.
  - It loses inside Lane A because its most important behavior immediately delegates into `TradeTeamCard.jsx`, so the single-file boundary is less coherent than the paired orchestration boundary.

### Candidate 3 — TradeEditor.jsx + TradeTeamCard.jsx
- Scope name: `TradeEditor + TradeTeamCard orchestration boundary`
- Lane: `high-risk surgical`
- What it includes:
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- What it excludes:
  - the closed E101 leaf-family authorities and their shim-only `.jsx` files
  - the closed E97 validator/result-presentation family
  - the closed E99 preview/export family
  - `src/features/architect/utils/mutationPipeline.js`
- Estimated live JS/JSX/TSX business-logic file count: `2`
- Why it is or isn’t a good next move:
  - This is the strongest Lane A surgical comparison target because it is the cleanest remaining Trade Machine orchestration boundary after E101.
  - It keeps the next cut on a real product surface while avoiding the much larger mutation engine.
  - It still loses overall because it remains more behavior-sensitive than the best remaining low-risk batch: hook wiring, validation gating, entitlement editing, callback fan-out, and multi-team trade state all converge here.

### Candidate 4 — GMDashboard.jsx + WorldSelector.jsx + SeasonAdvanceModal.jsx
- Scope name: `dashboard/world surgical boundary`
- Lane: `high-risk surgical`
- What it includes:
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
- What it excludes:
  - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
- Estimated live JS/JSX/TSX business-logic file count: `3`
- Why it is or isn’t a good next move:
  - It remains a serious surgical alternative because it owns dashboard tab orchestration, world selection/create/branch/archive/delete wiring, and season-advance workflow state.
  - It loses Lane A because the boundary is less clean than the TradeEditor + TradeTeamCard pair and sits adjacent to still-live support leaves and section wiring that would remain split off.

### Candidate 5 — GM world-support family
- Scope name: `GM world-support family`
- Lane: `batched low-risk`
- What it includes:
  - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
- What it excludes:
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - all TS-backed shim `.js/.jsx` files, barrels, and compatibility wrappers
- Estimated live JS/JSX/TSX business-logic file count: `3`
- Why it is or isn’t a good next move:
  - This is the best Lane B batch because all three files are real live leaves with narrow importer footprints:
    - `DeleteWorldModal.jsx` is used only by `WorldSelector.jsx`
    - `WorldTimeControls.jsx` is used only by `GMDashboard.jsx`
    - `DraftPositionsInput.jsx` is used only through `OffseasonSection.jsx`
  - The boundary is cleaner than the shared display/support family and materially safer than the strongest Lane A surgical pair.
  - It wins overall because it stays on active user-facing world-support behavior without stepping into the dashboard/world hubs themselves.

### Candidate 6 — shared display/support family
- Scope name: `shared display/support family`
- Lane: `batched low-risk`
- What it includes:
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
- What it excludes:
  - `src/features/architect/ValidationWarnings.jsx`
  - `src/features/architect/LeagueView.jsx`
  - `src/features/architect/RosterVisual.jsx`
- Estimated live JS/JSX/TSX business-logic file count: `3`
- Why it is or isn’t a good next move:
  - It is coherent enough to inspect, but it loses because it is more of a leftovers bucket than a single runtime-facing migration move.
  - The files are low-risk, but they do not beat the GM world-support batch on product relevance or boundary clarity.

### Candidate 7 — legacy contract pocket
- Scope name: `legacy contract pocket`
- Lane: `batched low-risk`
- What it includes:
  - `src/shared/components/EditContractModal.jsx`
  - `src/shared/utils/contracts/contractUtils.js`
  - `src/shared/utils/contracts/seasonNormalizer.js`
- What it excludes:
  - `src/features/architect/contract/ContractEditor/ContractEditor.jsx`
  - `src/features/architect/contract/ContractEditorModal/ContractEditorModal.jsx`
  - `src/shared/utils/contracts/contractParser.js`
- Estimated live JS/JSX/TSX business-logic file count: `3`
- Why it is or isn’t a good next move:
  - It was a serious Lane B candidate only until execution-time evidence reclassified `EditContractModal.jsx` as the live center and a behavior hub at roughly `1570` LOC.
  - The pocket is not truly low-risk now because the utilities are small but the modal itself owns many action paths, validation modes, and callback contracts.
  - `ContractEditor.jsx` and `ContractEditorModal.jsx` were explicitly inspected before exclusion and do not rescue this batch because they are only weak-import residue.

### Candidate 8 — wrapper/support cleanup pockets
- Scope name: `wrapper/support cleanup pockets`
- Lane: `batched low-risk`
- What it includes:
  - top-level architect compatibility wrappers
  - thin GM section wrappers
  - public index barrels
- What it excludes:
  - all real live business-logic leaves and hubs
- Estimated live JS/JSX/TSX business-logic file count: `0`
- Why it is or isn’t a good next move:
  - These files were explicitly classified, but they do not form a meaningful migration arc because they carry almost no live business logic.
  - They are cleanup residue, not the best next move.

## 4. Recommended Next Scope
- Recommended next migration scope: `GM world-support family`
- Lane: `batched low-risk`
- Why it is the best next choice:
  - It is the smallest coherent live-business-logic batch still left after E101.
  - It stays on active user-facing world-support behavior while avoiding the dangerous dashboard/world hubs and the heavier Trade Machine orchestration pair.
  - It beats the strongest Lane A winner (`TradeEditor.jsx + TradeTeamCard.jsx`) because the batch is smaller, cleaner, and materially less behavior-sensitive while still migrating real nearby runtime logic.
- Recommended handling shape: `one grouped arc`
- Direct batching answer:
  - The repo still supports `batched low-risk` work by default.
  - Surgical treatment should remain reserved for the dangerous-hub list led by `mutationPipeline.js`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx`.
  - E101 did not exhaust the best remaining low-risk batch.

## 5. Live JS/JSX/TSX Business-Logic Inventory For Recommended Scope
- `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - Why it belongs in scope: live world-management confirmation leaf with exact modal copy, confirm-text behavior, and delete affordance rules
  - Central or peripheral: `peripheral`
- `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  - Why it belongs in scope: live world-date control leaf with direct metadata write behavior and narrow parent wiring through `GMDashboard.jsx`
  - Central or peripheral: `peripheral`
- `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
  - Why it belongs in scope: live draft-position support surface with JSON validation, load/save flows, and the most substantive logic in the batch
  - Central or peripheral: `central`

## 6. Validation / Inspection Run
- Files changed:
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E102_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- Commands and inspection steps used:
  - `npm run typecheck`
  - `npm run validate:project`
  - `wc -l src/features/architect/utils/mutationPipeline.js src/features/architect/tradeMachine/TradeEditor.jsx src/features/architect/tradeMachine/TradeTeamCard.jsx src/features/architect/GMDashboard/GMDashboard.jsx src/features/architect/GMDashboard/components/WorldSelector.jsx src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx src/features/architect/GMDashboard/components/DeleteWorldModal.jsx src/features/architect/GMDashboard/components/WorldTimeControls.jsx src/features/architect/GMDashboard/components/DraftPositionsInput.jsx src/shared/components/EditContractModal.jsx`
  - `rg -n -F "@/features/architect/utils/mutationPipeline" src`
  - `rg -n -F "@/features/architect/tradeMachine/TradeEditor" src`
  - `rg -n -F "./TradeTeamCard" src/features/architect src/pages`
  - `rg -n -F "SeasonAdvanceModal" src/features/architect src/pages`
  - `rg -n -F "DeleteWorldModal" src`
  - `rg -n -F "WorldTimeControls" src`
  - `rg -n -F "DraftPositionsInput" src`
  - targeted `sed -n` reads of the Lane A and Lane B candidates plus nearby wrappers and contract-pocket files
  - a small Node inspection pass to identify same-path `.js/.jsx` shim files that already have `.ts/.tsx` authorities
- What they proved:
  - `mutationPipeline.js` remains the largest and broadest remaining JS hub at `4589` lines.
  - `TradeEditor.jsx` is imported through `TradeSection.jsx`, and `TradeTeamCard.jsx` is its direct orchestration child, which makes the pair the cleanest Lane A surgical boundary.
  - `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx` form a real dashboard/world surgical alternative, but their boundary is noisier because of adjacent live support leaves and section wiring.
  - `DeleteWorldModal.jsx`, `WorldTimeControls.jsx`, and `DraftPositionsInput.jsx` are real live leaves with narrow importer footprints and no same-path TS authority yet.
  - Same-path `.js/.jsx` files with `.ts/.tsx` authorities are still present across the closed E97, E99, and E101 families and must remain classified as `TS-backed shims`.
  - `ContractEditor.jsx` and `ContractEditorModal.jsx` were explicitly inspected and classified before exclusion; they do not form a strong live batch.
- Results:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run test:*` suites were skipped because this was an audit-only documentation pass and no runtime uncertainty required broader test execution
  - `npm run build` was skipped because no production code or route behavior changed in E102

## 7. Complexity / Risk Assessment
- Likely size relative to prior arcs:
  - smaller than E91
  - smaller than E93
  - smaller than E95
  - smaller than E97
  - smaller than E99
  - smaller than E101
- Delivery shape:
  - it looks like another `grouped migration arc`
  - it does not currently want pre-splitting
  - it does not look like a larger batched pass
- Whether batching still wins by default:
  - yes; current repo evidence still supports batched low-risk work by default, with surgical treatment reserved for the short dangerous-hub list
- Key risks and caveats:
  - `DeleteWorldModal.jsx` has exact modal-copy and confirmation-behavior risk
  - `WorldTimeControls.jsx` has world-date persistence semantics and direct metadata write behavior
  - `DraftPositionsInput.jsx` has JSON validation and `worldManager` contract typing risk, even though it remains a contained support surface
  - the strongest surgical alternative remains the `TradeEditor.jsx + TradeTeamCard.jsx` pair, so if the low-risk batch is exhausted later the next move should likely pivot there rather than to a broader hub

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E102 (2026-03-14)` to `docs/architect/TRADE_MACHINE_MASTER.md` immediately after the E101 entry.
- Recorded that E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, E86, E88, E89, E91, E93, E95, E97, E99, and E101 remain closed or complete.
- Recorded that the strongest Lane A comparison target from current repo evidence is `TradeEditor.jsx + TradeTeamCard.jsx`.
- Recorded that the recommended next migration scope is the `GM world-support family`.
- Recorded that the winning lane is `batched low-risk`.
- Recorded that the estimated live JS/JSX/TSX business-logic count for that scope is `3`.
- Recorded that the next move should likely stay `one grouped arc`.
- Recorded that the remaining frontier still supports batching by default except for the short dangerous-hub list led by `mutationPipeline.js`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx`.

# A1 Architect Surface Map

## Stage A ENTRY Checks
- Repo read access: PASS (all required Architect paths opened).
- Artifact root write access: PASS (`return_packages/architect/audit/`).
- Canonical docs loaded: PASS (`ARCHITECT_SHIP_GATES_MASTER.md`, `ARCHITECT_SMOKE_MASTER.md`, domain masters, prior return packages).

## Entrypoints and Feature Spine
- Route entrypoints:
  - `src/App.jsx:L34-L36` (`/gm`, `/gm/:teamId`).
  - `src/pages/GmDashboardView.jsx:L5-L23` (auth gate + dashboard mount).
- Main orchestrator:
  - `src/features/architect/GMDashboard/GMDashboard.jsx:L62-L401` (tab routing, world selector, world time controls, section composition).

## Discovered Domain Set (Stage B Driver)

| Domain ID | Domain | Purpose | Key Files (anchors) | Primary Tests | Boundaries |
|---|---|---|---|---|---|
| D01 | GMDashboard Orchestration | Route + tab orchestration + world controls wiring | `src/features/architect/GMDashboard/GMDashboard.jsx:L62-L401`, `src/features/architect/GMDashboard/components/WorldSelector.jsx:L46-L99`, `src/features/architect/GMDashboard/components/WorldTimeControls.jsx:L16-L93` | `src/tests/architect/GMDashboard.smoke.test.tsx` | Shared UI shell + world metadata writes |
| D02 | Trade Machine | Trade legality, routing, apply pipeline integration | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:L7-L33`, `src/features/architect/utils/mutationPipeline.js:L1895-L2035`, `src/features/architect/utils/mutationPipeline.js:L3526-L3690` | `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts:L157-L265`, `tests/trade/*` | Writes only under `architect_worlds/{worldId}` |
| D03 | Cap Sheet + Totals SSOT | Canonical cap totals and UI display consistency | `src/features/architect/utils/capTotals/computeTeamCapTotals.js:L204-L282`, `src/features/architect/capSheet/CapSheet/CapSheet.jsx:L54-L58` | `src/tests/architect/phase72_ssot_cap_totals_unification_guardrails.test.js:L50-L90`, `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js:L17-L33` | SSOT totals consumed across UI/engine |
| D04 | Free Agency + Offer Sheets | Signings, S&T, offer-sheet lifecycle | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1511-L2085`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:L503-L620`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:L42-L205` | `src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx:L83-L167`, `src/tests/architect/useArchitectState.worldFreeAgency.test.tsx:L82-L134` | World-required persistence for authoritative actions |
| D05 | Offseason + Season Advance | DEV preview gating + world season transition | `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L50-L210`, `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:L95-L101`, `src/features/architect/utils/seasonManager.js:L185-L268` | `src/tests/architect/offseason.devGate.guardrail.test.ts:L64-L82`, `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` | Preview non-persist path + world persist path |
| D06 | Team History | Timeline truth from world events + fallback sections | `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx:L81-L119`, `src/features/architect/history/hooks/useWorldTeamEvents.ts:L64-L189`, `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts:L95-L153` | `src/tests/architect/teamHistory.worldEvents.integration.test.tsx:L27-L88`, `src/tests/architect/teamHistory.worldBoundary.integration.test.tsx:L90-L100` | Reads world events scoped to world/team |
| D07 | Entitlements Admin + DARE | Entitlement authoring, collision safety, DARE persistence | `src/features/architect/utils/entitlements/entitlementWriter.ts:L451-L617`, `src/features/architect/admin/saveEntitlementFromFormState.ts:L176-L252`, `src/features/architect/utils/entitlements/dare/entitlementMutator.ts:L64-L132` | `src/tests/architect/entitlementWriter.collision.test.ts:L54-L118`, `src/tests/architect/dareMutatorExclusivityGate.test.ts` | Writes to world entitlements + team entitlementIds |
| D08 | Contract Editor | Contract action modal + action gating | `src/shared/components/EditContractModal.jsx:L133-L224`, `src/features/architect/contract/ContractEditor/ContractEditor.jsx:L10-L97` | `src/tests/architect/editContractModal_closure.gate.test.ts:L63-L219` | Mostly UI + action callback contracts |
| D09 | Persistence + World Data | Fallback chain, world metadata and mutation persistence control plane | `src/features/architect/utils/teamLoader.js:L23-L71`, `src/features/architect/utils/worldTeamData.ts:L81-L105`, `src/features/architect/utils/worldManager.js:L65-L126`, `src/features/architect/utils/mutationPipeline.js:L757-L887` | `src/tests/architect/capSheet.worldBoundary.integration.test.tsx:L151-L205` | World/base split and scoped writes |
| D10 | Security + Data Boundaries | Firestore rules + collection/path boundary policy | `firestore.rules:L55-L131`, `src/constants/collections.ts:L17-L67`, `src/data/firestorePaths.js:L47-L60`, `src/features/architect/utils/architectFirestorePaths.ts:L51-L159` | `src/tests/security/architectSecurity.rulesSource.guardrail.test.ts:L15-L99`, `src/tests/security/firestoreRules.integration.test.ts:L206-L240` | Base collections read-only, world owner-gated writes |

## Owned vs Shared Boundary Map
- Owned by Architect feature:
  - `src/features/architect/**`
  - Architect world persistence surfaces (`architect_worlds/{worldId}`, teams/players/events/entitlements).
- Shared dependencies affecting Architect behavior:
  - `src/constants/collections.ts`
  - `src/data/firestorePaths.js`
  - `firestore.rules`
  - `src/shared/components/EditContractModal.jsx`
  - `src/shared/hooks/useAuth.js`

## Collection Boundary Inventory
- Base/source (must remain read-only to GM flows):
  - `players_v2`, `architect_basePlayers`, `architect_baseTeams`, `architect_baseEntitlements`, `architect_basePickRules`.
- Architect/user writable (intended):
  - `architect_worlds/{worldId}` and subcollections `teams`, `teams/{teamCode}/players`, `events`, `entitlements`.
  - Supporting user collections outside Architect world flow: `lists`, `tierLists`, `rosterProjects`, `freeAgents`.

## Stage A EXIT Validation
- 100% discovered domains mapped: PASS (D01-D10).
- Requirement IDs prepared for all domains: PASS (A2).
- Evidence index skeleton with proof slots: PASS (A3).
- Reuse/staleness classification prepared: PASS (A4).

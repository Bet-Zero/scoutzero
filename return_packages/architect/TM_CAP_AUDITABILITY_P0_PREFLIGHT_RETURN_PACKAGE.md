# TM_CAP_AUDITABILITY_P0_PREFLIGHT_RETURN_PACKAGE

Date: 2026-02-28  
Mode: Discovery-only (docs-only, no runtime/code behavior changes)

## Executive Summary

This preflight found one authoritative mutation pipeline for world writes (`applyWorldMutation`), but not one end-to-end cap auditability gate across all cap-changing paths. World trade/signing flows are mostly centralized, while multiple other paths remain bridged or bypassed:

1. Optimistic local-first handlers (`waive`, `extend`, `option`, `renounce`, `setDeadCap`, `setExceptions`) mutate local state before async authoritative persistence.
2. Base-mode paths are local-only and emit no durable audit trail.
3. Season advance writes cap-changing world snapshots through `seasonManager` write batches without emitting world `events`.
4. Legacy exported season APIs and dormant exported mutation surfaces remain bypass candidates.

Result: STOP is triggered on all required conditions (direct-write/local bypasses, no unified post-state validator, no consistent audit event emission, schema gaps).

## Evidence Index

- `E1` `src/features/architect/utils/mutationPipeline.js:450-673` (`applyWorldMutation`: read -> compute -> validate -> persist -> post-update)
- `E2` `src/features/architect/utils/mutationPipeline.js:925-1072` (`computeWorldMutation` mutation switch)
- `E3` `src/features/architect/utils/mutationPipeline.js:2210-2477` (`validateMutation` per-mutation switch + default unknown_type block)
- `E4` `src/features/architect/utils/mutationPipeline.js:2501-2652` (`persistWorldMutation` writeBatch + world `events`)
- `E5` `src/features/architect/utils/mutationPipeline.js:742-902` (`loadStateForMutation` for waive/extend/option/offer/renounce/deadCap/exceptions/signAndTrade)
- `E6` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:463-503` (`persistMutation`, worldId guard, applyWorldMutation)
- `E7` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:547-608` (`runAuthoritativeFAMutation`)
- `E8` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:612-810` (trade world/base split; base uses `computeWorldMutation`)
- `E9` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:832-973` (sign world/base split; base local validate+compute)
- `E10` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:997-1300` (sign-and-trade + offer sheet actions)
- `E11` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1304-1340` (local optimistic dead cap/exceptions + async persistMutation)
- `E12` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1359-1443` (local renounce + local `overrideAuditLog` + async persistMutation)
- `E13` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1556-1894` (local extend/waive/option decisions + async persistMutation)
- `E14` `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:42-57` (single-team offseason local `runOffseason` + state update)
- `E15` `src/features/architect/utils/runOffseason.js:16-49` (local wrapper around `resolveOffseasonTransition`)
- `E16` `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx:337-377` (world season advance entry to `advanceSeasonInWorld`)
- `E17` `src/features/architect/utils/seasonManager.js:572-835` (`advanceSeasonInWorld` writeBatch path, no events collection write)
- `E18` `src/features/architect/utils/seasonManager.js:850-1080` (`processTeamSeasonTransitionWithOptions` -> `resolveOffseasonTransition` -> totals recompute)
- `E19` `src/features/architect/utils/offseason/resolveOffseasonTransition.ts:415-570,1024-1059` (`validateOffseasonState`, totals recompute, violation block)
- `E20` `src/features/architect/utils/seasonManager.js:144-227,237-299` (legacy `advanceSeason`/`processSeasonTransition`/`processTeamSeasonTransition`)
- `E21` `src/features/architect/utils/architectCore.js:33-42` (legacy trade/season exports still publicly exported)
- `E22` `src/features/architect/utils/tradeManager.js:1-40,193-204,217-432` (read-only compute/exported mutation-like API, no Firestore writes)
- `E23` `src/features/architect/hooks/useCapSheetState.js:46-113` (local mutation hook), plus caller search not found in `src`
- `E24` `src/features/architect/utils/persistenceContracts/contracts.js:261-332` (current event contract is metadata-light)
- `E25` `src/features/architect/utils/persistenceContracts/enforcement.js:37-71,88-112` (persist contract enforcement test-on/prod-off)
- `E26` `src/features/architect/utils/architectFirestorePaths.ts:19-23,69-83,111-137` (world/team/player/entitlement helpers; no event helper)
- `E27` `src/constants/collections.ts:57-64` (`architect_worlds` + `entitlements` constants; no event constant)
- `E28` `src/features/architect/utils/capHelpers.ts:97-115` (`minimumTeamSalary` exists in cap context)
- `E29` `src/features/architect/utils/tradeMachine/constants/cbaConstants.js:21` (`MINIMUM_TEAM_SALARY` constant exists)
- `E30` Not-found evidence files:
  - `/tmp/tmcap_p0_nf_validateTeamCapState.txt` (0 lines)
  - `/tmp/tmcap_p0_nf_validateCapLegality.txt` (0 lines)
  - `/tmp/tmcap_p0_nf_salary_floor_phrase.txt` (0 lines)
  - `/tmp/tmcap_p0_nf_minimum_team_salary_phrase.txt` (0 lines)
- `E31` Mandatory command output counts:
  - `/tmp/tmcap_p0_mand1.txt` 230 lines
  - `/tmp/tmcap_p0_mand2.txt` 189 lines
  - `/tmp/tmcap_p0_mand3.txt` 64 lines
  - `/tmp/tmcap_p0_mand4.txt` 2519 lines
  - `/tmp/tmcap_p0_mand5.txt` 160 lines
  - `/tmp/tmcap_p0_mand6.txt` 95 lines

## STOP Report

| STOP Condition | Triggered | Evidence | Why |
| --- | --- | --- | --- |
| Direct-write bypasses exist (cap-changing writes not routed through one unified gate) | Yes | `E11` `E12` `E13` `E14` `E15` `E20` `E22` | Multiple local-first and legacy paths can mutate cap state outside one authoritative compute->validate->persist->log contract. |
| No unified post-state validator exists | Yes | `E3` `E19` `E30` | `validateMutation` is per-action switch; `validateOffseasonState` is offseason-specific; `validateTeamCapState`/`validateCapLegality` names not found. |
| No consistent audit log for all cap-changing operations | Yes | `E4` `E17` `E14` `E15` `E22` `E23` | World mutation pipeline writes `events`; season advance/local/base/dormant paths do not emit a consistent durable event envelope. |
| Schema ambiguity undermines validator/audit reliability | Yes | `E24` `E25` `E26` `E27` | Current event schema lacks before/after totals and validator verdict/version; event path is hardcoded in one module and not centralized in path constants. |

## Write-Path Ledger (Complete)

| # | Write Path | Entry UI/hook | Compute Function(s) Today | Validation Gate(s) Today | Persistence Today | Audit/Event Emitted Today | Gate-to-Trust | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | World trade apply (`executeTrade`) | `useArchitectActions.ts:612-725` (`applyTradeToCapSheet` world branch) | `computeWorldMutation('executeTrade')` -> snapshot + `computeTradeResult` (`E2`) | `validateMutation` (prevalidated trade context) + league/entitlement/exclusivity invariants (`E1`,`E3`) | `persistWorldMutation` writeBatch teams/players/entitlements/events (`E4`) | Yes: world `events` + team `exceptionHistory` for TPE lifecycle (`E4`) | A | Medium: centralized, but event schema not full audit envelope. |
| 2 | Base-mode trade apply | `useArchitectActions.ts:728-810` | `computeWorldMutation('executeTrade')` with `worldId:null` (`E8`) | Base hook checks `_validatedTradeContext` + `legal` (`E8`) | Local `setTeamCapSheet` only | No | C | High: local-only path, no durable log, no unified post-state validator contract. |
| 3 | World sign free agent | `useArchitectActions.ts:872-893` | `computeWorldMutation('signFreeAgent')` (`E2`) | `validateMutation` -> `validateSigning` (`E3`) | `persistWorldMutation` (`E4`) | Yes: world `events` (`E4`) | A | Medium: authoritative path exists, but validator is action-scoped only. |
| 4 | Base-mode sign free agent | `useArchitectActions.ts:895-973` | `computeWorldMutation('signFreeAgent')` (`E9`) | Local `validateSigning` (`E9`) | Local `setTeamCapSheet`/`setFreeAgents` | No | C | High: local-only mutation + no durable audit/event. |
| 5 | World sign-and-trade | `useArchitectActions.ts:997-1070` | `computeSignAndTradeResult` + `computeTradeResult` (`E2`) | `validateMutation` uses `_signingValidation` + `_validatedTradeContext` (`E3`) | `persistWorldMutation` (`E4`) | Yes: world `events`; TPE history when relevant (`E4`) | A | Medium: centralized, but lacks holistic post-state validator output structure. |
| 6 | World offer sheet store | `useArchitectActions.ts:1078-1137` | `computeStoreOfferSheetResult` (`E2`) | `validateMutation` -> `validateSigning`; store invariants in compute (`E3`) | `persistWorldMutation` (`E4`) | Yes: world `events` (`E4`) | A | Medium: action-level legality only. |
| 7 | World offer sheet match | `useArchitectActions.ts:1142-1177` | `computeMatchOfferSheetResult` (`E2`) | `validateMutation` -> `validateOfferSheetResolution(match)` (`E3`) | `persistWorldMutation` (`E4`) | Yes: world `events` (`E4`) | A | Medium: same per-action validator limitation. |
| 8 | World offer sheet decline | `useArchitectActions.ts:1181-1216` | `computeDeclineOfferSheetResult` (`E2`) | `validateMutation` -> `validateOfferSheetResolution(decline)` (`E3`) | `persistWorldMutation` (`E4`) | Yes: world `events` (`E4`) | A | Medium: same per-action validator limitation. |
| 9 | World finalize offer sheet (matched) | `useArchitectActions.ts:1250-1266` | `computeFinalizeMatchedOfferSheetResult` (`E2`) | No explicit `validateMutation` case; falls to default unknown_type block (`E3`) | Blocked before persist in current map | No (blocked) | B | High: mapped compute type but missing validator case causes fail-closed path gap. |
| 10 | World finalize offer sheet (declined) | `useArchitectActions.ts:1269-1289` | `computeFinalizeDeclinedOfferSheetResult` (`E2`) | No explicit `validateMutation` case; falls to default unknown_type block (`E3`) | Blocked before persist in current map | No (blocked) | B | High: same mapping gap as finalize matched. |
| 11 | World waive player (optimistic local + async persist) | `useArchitectActions.ts:1636-1725` | Local `setTeamCapSheet` transform + pipeline `computeWaiveResult` (`E13`,`E2`) | Local: none; world persist path: `validateWaive` (`E3`) | `persistMutation` -> `applyWorldMutation` when worldId exists (`E6`) | Partial: yes only if persist succeeds; optimistic local mutation itself not evented | B | High: local-first can drift from authoritative result/failure and lacks pre-persist holistic gate. |
| 12 | Base-mode waive player | `useArchitectActions.ts:1636-1725` | Local `setTeamCapSheet` only (`E13`) | None | Local only (`persistMutation` short-circuits on `!worldId`) (`E6`) | No | C | High: no authoritative gate, no audit trail. |
| 13 | World extend player (optimistic local + async persist) | `useArchitectActions.ts:1556-1630` | Local future-contract mutation + pipeline `computeExtensionResult` (`E13`,`E2`) | Local: none; world path: `validateExtension` (`E3`) | `persistMutation` -> `applyWorldMutation` (`E6`) | Partial: world event only on persist success | B | High: local-first state mutates before legality confirmation. |
| 14 | Base-mode extend player | `useArchitectActions.ts:1556-1630` | Local only (`E13`) | None | Local only | No | C | High: no validator/audit gate. |
| 15 | World option decision (optimistic local + async persist) | `useArchitectActions.ts:1737-1894` | Local option/cap-hold logic + pipeline `computeOptionResult` (`E13`,`E2`) | Local: none; world path: `validateOptionDecision` (`E3`) | `persistMutation` -> `applyWorldMutation` (`E6`) | Partial: world event only on persist success | B | High: local-first mutation + no unified post-state validator output. |
| 16 | Base-mode option decision | `useArchitectActions.ts:1737-1894` | Local only (`E13`) | None | Local only | No | C | High: local-only with no durable auditability. |
| 17 | World renounce rights (optimistic local + async persist) | `useArchitectActions.ts:1359-1443,1905-1913` | Local cap-hold/player rights update + pipeline `computeRenounceResult` (`E12`,`E2`) | Local: none; world path: `validateRenounceRights` (`E3`) | `persistMutation` -> `applyWorldMutation` (`E6`) | Partial: world event on successful persist; local `overrideAuditLog` is UI-local only (`E12`) | B | High: hybrid local/remote path with inconsistent audit semantics. |
| 18 | Base-mode renounce rights | `useArchitectActions.ts:1359-1443` | Local only (`E12`) | None | Local only | No durable event (UI-local `overrideAuditLog` only) | C | High: no authoritative persist or system audit event. |
| 19 | World set dead cap (optimistic local + async persist) | `useArchitectActions.ts:1304-1318` | Local deadCap set + pipeline `computeSetDeadCapResult` (`E11`,`E2`) | Local: none; world path: `validateDeadCap` (`E3`) | `persistMutation` -> `applyWorldMutation` (`E6`) | Partial: world event on successful persist | B | High: local-first mutation can diverge from authoritative verdict. |
| 20 | Base-mode set dead cap | `useArchitectActions.ts:1304-1318` | Local only (`E11`) | None | Local only | No | C | High: local-only bypass of authoritative gate/audit. |
| 21 | World set exceptions (optimistic local + async persist) | `useArchitectActions.ts:1324-1338` | Local exceptions set + pipeline `computeSetExceptionsResult` (`E11`,`E2`) | Local: none; world path: `validateExceptions` (`E3`) | `persistMutation` -> `applyWorldMutation` (`E6`) | Partial: world event on successful persist | B | High: local-first mutation with no unified post-state validator contract. |
| 22 | Base-mode set exceptions | `useArchitectActions.ts:1324-1338` | Local only (`E11`) | None | Local only | No | C | High: local-only bypass/audit gap. |
| 23 | World season advance (`SeasonAdvanceModal` -> `advanceSeasonInWorld`) | `SeasonAdvanceModal.jsx:337-377` -> `seasonManager.js:572-835` | `processTeamSeasonTransitionWithOptions` + `resolveOffseasonTransition` + `computeTeamCapTotals` (`E17`,`E18`,`E19`) | `validateOffseasonState` (offseason-specific) + persist contract assert bridge (`E19`,`E17`,`E25`) | `writeBatch` team snapshots + metadata (+ DARE writes) then `batch.commit()` (`E17`) | No world `events`; only `exceptionHistory` for TPE expiry (`E19`) | B | High: world cap-changing writes occur outside mutation pipeline event envelope and outside one shared validator contract. |
| 24 | Single-team offseason local (`OffseasonTab` -> `runOffseason`) | `OffseasonTab.jsx:42-57` -> `runOffseason.js:16-49` | `resolveOffseasonTransition` + `computeTeamCapTotals` (`E14`,`E15`,`E19`) | `validateOffseasonState` (`E19`) | Local state only (`setTeamCapSheet`, `setCurrentYear`) (`E14`) | No | C | High: local-only mutation path remains available in world UI context. |
| 25 | Legacy exported season path (`advanceSeason`/`processSeasonTransition`) | `seasonManager.js:144-227` (exported via `architectCore.js:41`) | `processTeamSeasonTransition` legacy helpers + `computeTeamCapTotals` (`E20`) | No `validateOffseasonState`/holistic post-state gate in legacy flow (`E20`) | `writeBatch` set team snapshots + metadata commit (`E20`) | No | C | High: direct world-write path bypasses modern season bridge and audit event scheme; no in-repo UI caller found, but exported. |
| 26 | Dormant legacy local mutation surfaces (`tradeManager` + `useCapSheetState`) | `tradeManager.js` exports + `useCapSheetState.js` export (`E22`,`E23`) | Trade manager ad hoc computes + `computeTeamCapTotals`; hook mutates local state/history (`E22`,`E23`) | `tradeManager.executeTrade` uses `validateTrade`; other functions/hook have no unified cap legality gate | No Firestore writes in tradeManager; hook local-only | No durable audit/event | C | Medium: currently dormant in app flow (caller not found except tests), but exported mutation APIs remain bypass candidates. |

## Holistic Validator Gap Analysis

### Finding 1: No true reusable post-state cap legality validator exists

- `validateMutation` is a mutation-type switch that delegates to per-action validators (`validateSigning`, `validateWaive`, `validateOptionDecision`, etc.) (`E3`).
- OSTE has `validateOffseasonState`, but it is specific to offseason transitions and not used as a global validator contract for all mutation types (`E19`).
- Not-found searches:
  - `validateTeamCapState` -> not found (`E30`)
  - `validateCapLegality` -> not found (`E30`)

### Finding 2: Current validation is action-scoped, not universal post-state

- Trades and sign-and-trades rely on prevalidated trade/signing contexts (`E3`).
- Non-trade mutations validate mutation-specific payload/state pairs (`E3`).
- Season advance uses a separate validator (`validateOffseasonState`) on OSTE output (`E19`).
- Legacy/base/local paths can bypass this architecture (`E11`,`E13`,`E14`,`E20`,`E22`,`E23`).

### Finding 3: Salary floor exists in settings surfaces, but is not wired into the main cap legality gate

- `minimumTeamSalary` and floor values exist in cap context/constants (`E28`,`E29`).
- Exact phrase searches:
  - `salary floor` -> not found (`E30`)
  - `minimum team salary` -> not found (`E30`)
- `validateMutation` and `validateOffseasonState` do not include a salary-floor enforcement rule in their explicit checks (`E3`,`E19`).

### Proposed Docs-Only Contract: `PostStateCapValidator`

#### Input (`PostStateCapValidationInput`)

- `operationId`: deterministic or UUID operation key
- `mutationType`: canonical action/mutation type
- `category`: `trade|freeAgency|waive|option|renounce|deadCap|exceptions|seasonAdvance|legacy`
- `mode`: `world|base`
- `asOfDate`: ISO date used for timing-sensitive rules
- `seasonId` and `year`
- `worldId` (nullable in base mode)
- `teamCodes`: affected teams
- `beforeTeamsByCode`: canonical pre-state snapshots
- `afterTeamsByCode`: canonical post-state snapshots
- `rulesContext`: cap/tax/apron/floor settings and rule profile inputs
- `relatedRefs`: `playerIds`, `tradeId`, `offerSheetId`, `teamCode`, etc.

#### Output (`PostStateCapValidationResult`)

- `valid: boolean`
- `violations: Array<{ code, severity, teamCode, path, message, expected?, actual? }>`
- `warnings: Array<{ code, severity, teamCode, path, message }>`
- `ruleResults: Record<string, { pass: boolean; details?: any }>`
- `validatorVersion: string` (semantic, e.g., `1.0.0`)
- `schemaVersion: string` (validation-result schema version, e.g., `cap-validator-result-v1`)

#### Versioning Strategy

- Persist both `validatorVersion` and `schemaVersion` on every emitted audit event.
- Validator upgrades use semantic versioning (`major.minor.patch`).
- Breaking output-shape changes require `schemaVersion` bump.

### State-Level CBA Rules Missing or Not Enforceable Today

1. Salary-floor enforcement as a universal state rule is not enforced in the cap mutation gate (`E3`,`E19`,`E28`,`E29`,`E30`).
2. One universal post-state team legality check cannot be guaranteed across base/local/legacy paths (`E11`,`E14`,`E20`,`E22`,`E23`).
3. Offer-sheet finalize mutation types are defined in compute paths but not mapped in `validateMutation`, causing a validator coverage gap (`E2`,`E3`).

## Auditability / Event Logging Gap Analysis

### Existing Logging Inventory

1. World mutation pipeline emits one event doc to `architect_worlds/{worldId}/events/{eventId}` in `persistWorldMutation` (`E4`).
2. Team-level `exceptionHistory[]` exists for TPE lifecycle entries (`TPE_CREATED`/`TPE_CONSUMED`/`TPE_EXPIRED`) (`E4`,`E19`).
3. `overrideAuditLog` is local UI state attached in handlers, not durable system audit (`E12`).
4. Season advance world writes do not emit world events in `seasonManager` (`E17`, plus word-boundary `events` search not found in season/offseason files).

### Gaps

1. No single audit envelope spans mutation pipeline + season advance + base/local paths.
2. Event payload lacks mandatory auditability fields:
   - before/after totals snapshots
   - validator verdict details
   - validator/schema version
   - operation correlation ID
3. Event path helpers/constants are not centralized (hardcoded `'events'` in mutation pipeline) (`E4`,`E26`,`E27`).

### Proposed Unified Event Schema (Docs-Only): `CapAuditEventV1`

```ts
type CapAuditEventV1 = {
  eventId: string;
  schemaVersion: 'cap-audit-event-v1';
  validatorVersion: string;
  operationId: string;

  mutationType: string;
  category: string;
  sourcePath: string; // e.g. 'useArchitectActions.handleWaiveContract'

  actorUserId: string | null;
  occurredAt: string; // ISO
  mode: 'world' | 'base';

  worldId: string | null;
  teamCode: string | null;
  teamCodes: string[];
  playerIds: string[];
  tradeId?: string | null;
  offerSheetId?: string | null;

  beforeTotalsByTeam: Record<string, any>;
  afterTotalsByTeam: Record<string, any>;

  valid: boolean;
  violations: Array<{ code: string; message: string; severity: 'error' | 'warning'; teamCode?: string }>;
  warnings: Array<{ code: string; message: string; severity: 'warning'; teamCode?: string }>;

  diffSummary: {
    playersMoved?: any[];
    capHoldsChanged?: any[];
    deadCapChanged?: any[];
    exceptionsChanged?: any[];
    tpeChanged?: any[];
  };

  persisted: boolean;
  persistPath: string | null;
};
```

### Firestore Partition Recommendation

1. Canonical durable event stream:
   - `architect_worlds/{worldId}/events/{eventId}`
2. Team query fan-out references:
   - `architect_worlds/{worldId}/teams/{teamCode}/eventRefs/{eventId}`
3. Base mode (no world document writes):
   - Local `capAuditEvents` array (session or persisted client storage) using the same schema contract minus Firestore refs.

## Insertion Points Plan (No Code)

| Write Path | Insertion Point(s) | What to Log | What to Validate | Notes |
| --- | --- | --- | --- | --- |
| World mutation pipeline (all `applyWorldMutation` types) | `applyWorldMutation` immediately after `computeWorldMutation`, before `validateMutation`; then just before `persistWorldMutation` | Full `CapAuditEventV1` payload with before/after totals + diff + verdict + versions | New `PostStateCapValidator` on computed post-state, then retain action-specific validators for granular rule messages | Establish one gate-to-trust in this function. |
| Mutation event write | `persistWorldMutation` event construction block (`E4`) | Replace metadata-light event with `CapAuditEventV1`; persist `operationId`, `validatorVersion`, `schemaVersion` | Persist-time shape assert for `CapAuditEventV1` | Keep existing sanitize/assert/removeUndefined ordering. |
| Optimistic world handlers (`waive/extend/option/renounce/deadCap/exceptions`) | `useArchitectActions` handlers before local `setTeamCapSheet`, and after persistence response | Pre-commit local audit envelope + authoritative persisted envelope on success/failure | Run post-state validator on local preview state, then again on authoritative compute result from pipeline | Prevent silent drift between optimistic UI and authoritative state. |
| Base-mode trade/sign paths | In base branches immediately after `computeWorldMutation` result is available | Local `CapAuditEventV1` (`mode: base`, `persisted:false`) | Run same `PostStateCapValidator` contract used in world mode | Required for parity with world legality semantics. |
| Base-mode local-only handlers (`waive/extend/option/renounce/deadCap/exceptions`) | In each handler around `setTeamCapSheet` updater | Local event with before/after snapshot and diff | New post-state validator against produced local next state | Today these handlers have no legality gate in base mode. |
| World season advance | `advanceSeasonInWorld`: per-team after `processTeamSeasonTransitionWithOptions` returns and before `batch.set`; plus operation-level summary before `batch.commit` | Team-level and operation-level `CapAuditEventV1` entries including season transition summary | Post-state validator per updated team (in addition to `validateOffseasonState`) | Ensure season writes emit same audit contract as mutations. |
| OSTE engine | `resolveOffseasonTransition` just after totals recompute (`nextTeam.totals`), before returning success | Validator input/output and applied changes summary | Invoke shared post-state validator with `category: seasonAdvance` | Keep `validateOffseasonState` as rule contributor or decompose into shared validator modules. |
| Legacy season APIs | `processSeasonTransition` + `processTeamSeasonTransition` | Bridge event + validator verdicts, or route calls to `advanceSeasonInWorld` internals | Shared post-state validator before any writeBatch set | Best long-term path is deprecate legacy writes and route through authoritative season path. |
| Single-team offseason UI | `runOffseason` and `OffseasonTab.handleAdvanceYear` | Local event with operation context (`mode: base` unless explicitly world-routed) | Shared post-state validator contract | If worldId is active, either disable local-only path or require durable world write path. |
| Dormant legacy exports (`tradeManager`, `useCapSheetState`) | At exported mutation-like APIs | Local audit envelope + explicit deprecation metadata | Shared validator if retained; otherwise route/disable | Mark as unsupported or route through authoritative pipeline to remove bypass risk. |

## Next Execution Tickets (Scoped)

### E1 — Introduce Post-State Validator Contract

- Objective: Add a shared `PostStateCapValidator` interface and execute it in mutation pipeline + season advance flows.
- Files likely touched:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`
  - `src/features/architect/utils/capLegalityValidation.js` (or new validator module)
  - `src/features/architect/utils/persistenceContracts/contracts.js` (result schema allowlist if persisted)
- Acceptance criteria:
  1. Every cap-changing world operation returns validator verdict (`valid`, `violations`, `warnings`) with `validatorVersion`.
  2. Base-mode compute paths invoke same validator contract.
  3. Offer-sheet finalize operations have explicit validator mapping.
- Validation commands:
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - `npm run typecheck`
- Return package required:
  - validator contract spec
  - path-by-path validator insertion diff map
  - failing/passing test evidence

### E2 — Unified Audit Event Envelope

- Objective: Emit one `CapAuditEventV1` schema for mutation + season write paths.
- Files likely touched:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/architectFirestorePaths.ts`
  - `src/constants/collections.ts`
  - `src/features/architect/utils/persistenceContracts/contracts.js`
- Acceptance criteria:
  1. Event payload contains before/after totals, validator verdict, diff summary, version fields.
  2. Season advance emits durable world events using same schema.
  3. Team eventRefs fan-out (or equivalent indexed access path) is documented and implemented.
- Validation commands:
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - `npm run validate:project`
- Return package required:
  - schema doc
  - sample persisted events
  - migration/backfill decision notes

### E3 — Eliminate/Contain Bypasses

- Objective: Ensure no cap-changing world operation can bypass unified validator + audit emission.
- Files likely touched:
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/architectCore.js`
  - `src/features/architect/utils/tradeManager.js`
- Acceptance criteria:
  1. Optimistic handlers reconcile/rollback against authoritative verdicts.
  2. World-mode local-only offseason bypass is removed, routed, or explicitly blocked.
  3. Legacy exported bypass paths are routed through authoritative gate or marked deprecated/disabled.
- Validation commands:
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - Manual smoke: trade/sign/waive/option/renounce/deadCap/exceptions/season advance
- Return package required:
  - bypass closure matrix
  - manual smoke evidence
  - residual risk list

### E4 — Auditability Gates + Documentation Sync

- Objective: Add explicit ship gates for validator and audit completeness, and sync docs.
- Files likely touched:
  - `docs/SHIP_GATES_MASTER.md`
  - `docs/architect/CAP_AUDITABILITY_MASTER.md`
  - `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` (if needed for cross-links)
- Acceptance criteria:
  1. Ship gates include validator coverage and event coverage checks.
  2. Manual smoke list covers all cap-changing categories.
  3. SSOT docs reflect final architecture and stop conditions.
- Validation commands:
  - `npm run validate:project`
  - `npm run build`
- Return package required:
  - gate checklist
  - docs parity checklist
  - sign-off template update

## Commands Run + Results (Summarized)

### Mandatory Discovery Commands

1. `rg -n "applyWorldMutation|computeWorldMutation|validateMutation|persistWorldMutation" src`  
   - Output: 230 matches (`/tmp/tmcap_p0_mand1.txt`)
   - Key result: authoritative mutation pipeline anchors located (`E1`,`E2`,`E3`,`E4`).

2. `rg -n "advanceSeason|resolveOffseasonTransition|validateOffseasonState|seasonManager" src`  
   - Output: 189 matches (`/tmp/tmcap_p0_mand2.txt`)
   - Key result: season advance + OSTE split identified (`E16`,`E17`,`E18`,`E19`,`E20`).

3. `rg -n "writeBatch|batch\.commit|setDoc\(|updateDoc\(|addDoc\(" src`  
   - Output: 64 matches (`/tmp/tmcap_p0_mand3.txt`)
   - Key result: cap-changing world writes confirmed in mutation pipeline + season manager (`E4`,`E17`,`E20`).

4. `rg -n "events|audit|history|log" src docs`  
   - Output: 2519 matches (`/tmp/tmcap_p0_mand4.txt`)
   - Key result: world `events`, `exceptionHistory`, local `overrideAuditLog` inventory extracted (`E4`,`E12`,`E19`,`E24`).

5. `rg -n "validateSigning|validateWaive|validateOptionDecision|validateRenounceRights|validateDeadCap|validateExceptions|validateContractRows" src`  
   - Output: 160 matches (`/tmp/tmcap_p0_mand5.txt`)
   - Key result: per-action validator usage confirmed in pipeline + OSTE (`E3`,`E19`).

6. `rg -n "salary floor|minimum team salary|90%|floor" src docs`  
   - Output: 95 matches (`/tmp/tmcap_p0_mand6.txt`)
   - Key result: floor settings/constants exist; no direct salary-floor phrase enforcement in main gate (`E28`,`E29`,`E30`).

### Explicit Not-Found Commands

- `rg -n "validateTeamCapState" src` -> not found (`/tmp/tmcap_p0_nf_validateTeamCapState.txt`, 0 lines)
- `rg -n "validateCapLegality" src` -> not found (`/tmp/tmcap_p0_nf_validateCapLegality.txt`, 0 lines)
- `rg -n "salary floor" src docs` -> not found (`/tmp/tmcap_p0_nf_salary_floor_phrase.txt`, 0 lines)
- `rg -n "minimum team salary" src docs` -> not found (`/tmp/tmcap_p0_nf_minimum_team_salary_phrase.txt`, 0 lines)

### Commands Intentionally Skipped

- Runtime validation commands (`npm run test:*`, `npm run build`, `npm run typecheck`) were intentionally skipped because this phase is discovery-only/docs-only.

## RETURN PACKAGE (PASTE BACK)

- Files created/updated:
  - `return_packages/architect/TM_CAP_AUDITABILITY_P0_PREFLIGHT_RETURN_PACKAGE.md`
  - `docs/architect/CAP_AUDITABILITY_MASTER.md`
  - `docs/SHIP_GATES_MASTER.md`
- STOP table: included in **STOP Report** section above.
- Complete write-path ledger: included in **Write-Path Ledger (Complete)** section above.
- Proposed event schema: included in **Auditability / Event Logging Gap Analysis** (`CapAuditEventV1`).
- Proposed post-state validator requirements: included in **Holistic Validator Gap Analysis** (`PostStateCapValidator` contract).
- Next Execution ticket list: included in **Next Execution Tickets (Scoped)** (`E1`..`E4`).

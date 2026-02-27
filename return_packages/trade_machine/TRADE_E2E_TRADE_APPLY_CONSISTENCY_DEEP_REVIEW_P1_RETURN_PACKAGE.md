# TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1 — Return Package

**Date:** 2026-02-26
**Mode:** PREFLIGHT (discovery-only)
**Scope:** End-to-end validator ↔ apply-time ↔ persistence parity for Trade Machine inside Architect (world-aware)
**Sources of Truth:** `docs/architect/TRADE_MACHINE_MASTER.md`, `docs/SHIP_GATES_MASTER.md`

---

## 1. STOP REPORT

**STOP REPORT: Not Triggered**

All five STOP conditions were evaluated against the codebase evidence. None are triggered.

| # | STOP Condition | Triggered? | Evidence |
|---|---------------|------------|----------|
| 1 | Validator and apply-time interpret the same trade payload fields differently (semantic mismatch) | **No** | Both validator (`tradeValidator.js:120–138`) and apply-time (`tradeContext.js:217–256`) use the same field resolution chain for player destinations: `receivingTeamId → tradeTo → toTeamId → destTeamId`. Both use identical 2-team broadcast fallback / 3+-team explicit routing semantics. Entitlement routing uses `toTeamId` consistently. Salary matching values (`matchOutgoing`/`matchIncoming`) are computed once by `computeMatchingValues()` in the validator and flow through to apply-time via the validated context. |
| 2 | UI summary shows assets/usage/created items that do not persist at apply-time | **No** | The UI summary is derived from `validateTrade()` result. Apply-time re-validates via `validatePostTradeSnapshotForContext()` using the same `validateTrade()` function. Both see the same `createdTPE`, same salary matching evaluations, same entitlement routing. The only cosmetic divergence is `usedTradeExceptions` in `exportCurrentTrade()` (always empty — see Minor #1 below), which is informational and not used by apply-time. |
| 3 | Apply-time can commit a trade even when validation indicates illegal (or vice versa) | **No** | `applyWorldMutation()` (mutationPipeline.js:522–540) calls `validateMutation()` which for `executeTrade` reads the pre-validated context from `computeWorldMutation`. If `!validationResult.valid`, it returns `{ success: false }` immediately — no batch is opened. Additionally, `buildPostTradeTeamsSnapshot()` throws on routing invariant violations before any persistence. The UI also gates the Apply button on `hasCurrentValidation && result?.legal === true` (TradeEditor.jsx:245). |
| 4 | Any tradeable asset type has a "silent drop" path that changes outcomes | **No** | Players: the `applyTradeToCapSheet()` transformation (useArchitectActions.ts:629–703) maps all player fields including `tradeTo`, `receivingTeamId`, `receivingTeamIndex`, `signAndTrade`, `signAndTradeContract`, `absorptionMode`, `tpeId`. Entitlements: `outgoingEntitlements` and `entitlementsOut` are both forwarded (line 700–702). The `usedTradeExceptions` field is a dead informational field (see Minor #1) — it does not affect apply-time outcomes. |
| 5 | World inheritance/fallback changes legality or apply outcomes without explicit explanation | **No** | `loadStateForMutation('executeTrade')` (mutationPipeline.js:698–718) loads teams via `getTeam(worldId, code)` which uses the documented fallback chain: world snapshot → parent world → base team (teamLoader.js:34–71). The same `loadWorldTeamData()` is used by `useTradeMachine` during UI-time team loading (useTradeMachine.js:342, 725). Both paths use identical fallback chains. World writes go exclusively to the world snapshot — never to parent or base. |

---

## 2. Ship-Readiness Verdict for Apply Consistency

**Ship-ready.**

The validator-to-apply-to-persistence pipeline is well-structured with no semantic mismatches, no silent drops that change outcomes, and fail-closed behavior at every stage. The pipeline enforces atomicity via a single `writeBatch(db).commit()` call. All asset types (players, entitlements, TPE) flow through consistent field interpretations.

Two minor issues were found (dead code field, cosmetic naming alias) — neither affects correctness or outcomes. No blockers or majors.

---

## 3. System Map (SSOT Table)

### Players

| Aspect | Detail |
|--------|--------|
| **UI payload representation** | `exportCurrentTrade()` → `{ teamId, outgoingPlayers: [...sends], incomingPlayers: [...routed] }`. Each player carries: `id/player_id`, `tradeTo`, `signAndTrade`, `signAndTradeContract`, `absorptionMode`, `tpeId`, `bucketType`, `matchOutgoing`, `matchIncoming`. |
| **Validator interpretation** | `tradeValidator.js:validateTrade()` → `resolvePlayerDestinationTeamId(player)` reads `player.tradeTo ?? player.toTeamId ?? player.destTeamId` (line 120–124). `shouldRoutePlayerToTeam()` enforces explicit routing for 3+ teams (line 126–138). Salary computed via `computeMatchingValues()` which sets `matchOutgoing`/`matchIncoming` on player objects. |
| **Apply-time interpretation** | `useArchitectActions.ts:applyTradeToCapSheet()` (line 614–876) reads `p.receivingTeamId ∥ p.tradeTo ∥ p.toTeamId ∥ p.destTeamId` and resolves to canonical teamCode via `resolveTeamCode()`. Sets `receivingTeamIndex` for index-based routing. Forwards `signAndTrade`, `signAndTradeContract`, `absorptionMode`, `tpeId` to mutation pipeline. |
| **Persistence write target** | `persistWorldMutation()` → `batch.set(worldTeamRef(worldId, teamCode), sanitizedTeam)`. Player data persists as part of `team.players[]` and `team.roster[]` arrays on the team overlay doc. Sign-and-trade contracts are normalized via `normalizeContractForWorld()` in `buildPostTradeTeamsSnapshot()`. |
| **World awareness** | `loadStateForMutation('executeTrade')` → `getTeam(worldId, code)` → fallback chain: world → parent → base. UI loads via same `loadWorldTeamData()`. |
| **Known normalizers** | `resolveTeamCode()` (slug → 3-letter code). `normalizeContractForWorld()` for S&T contracts. `computeMatchingValues()` for BYC/poison pill/trade kicker adjustments. |
| **Fail-closed guard** | Validator: `validatePlayerRouting()` blocks incomplete routing (3+ teams). Apply: `buildPostTradeTeamsSnapshot()` throws `TRADE_APPLY_ROUTING_ERROR` for unrouted players in 3+ team trades (tradeContext.js:217–256). S&T preflight throws on invalid eligibility/contract/destination (tradeContext.js:147–213). |

### Entitlements (Draft Assets)

| Aspect | Detail |
|--------|--------|
| **UI payload representation** | `exportCurrentTrade()` → `{ outgoingEntitlements: [...entitlementsOut], incomingEntitlements: [...routed] }`. Each entitlement carries: `entitlementId/id`, `fromTeamId`, `toTeamId`, `seasonYear`, `round`, `kind`, `terms`, `draftKey`. Decorated via `decorateEntitlementForTrade()`. |
| **Validator interpretation** | `validateEntitlementRouting()` checks uniqueness, ownership, destination validity. `validateEntitlementLinkageLegality()` enforces linked package completeness. `validateEntitlementExclusivity()` checks post-trade overlapping claims. All are blocking (return early with `legal: false` on failure). |
| **Apply-time interpretation** | `applyTradeToCapSheet()` forwards `outgoingEntitlements` and `entitlementsOut` (line 700–702). `buildPostTradeTeamsSnapshot()` (tradeContext.js:426–487) updates `team.entitlementIds[]`: removes outgoing IDs, adds incoming IDs (respecting `toTeamId` routing for 3+ teams, broadcast for 2 teams). Post-apply invariant assertion checks no entitlement appears on multiple teams (tradeContext.js:528–540). |
| **Persistence write target** | Three layers: (1) `team.entitlementIds[]` on team overlay doc, (2) `holderTeam` field patched on individual entitlement override docs via `batch.set(entitlementRef, { holderTeam }, { merge: true })` (mutationPipeline.js:2564–2580), (3) `entitlementsTraded` in event log metadata. |
| **World awareness** | Entitlements resolved via `resolveEntitlementsForTeam(worldId, teamCode)` which reads from world overlay entitlements subcollection with fallback to parent/base. |
| **Known normalizers** | `decorateEntitlementForTrade()` adds `terms`, `termsShort`, `description`, `draftKey` display fields. These are informational — persistence reads `entitlementId`/`holderTeam` only. |
| **Fail-closed guard** | Validator: `validateEntitlementRouting()`, `validateEntitlementLinkageLegality()`, `validateEntitlementExclusivity()` — all blocking. Apply: post-apply `entitlementOwnership` Map check throws on cross-team duplicate (tradeContext.js:528–540). Pipeline: `validateMutationEntitlementInvariants()` (Phase B5) and `validateTradeApplyExclusivity()` (Phase 3.7) — both blocking. |

### TPE (Trade Player Exception) Usage

| Aspect | Detail |
|--------|--------|
| **UI payload representation** | TPE usage is encoded on the **outgoing player send entry** (not a separate field): `player.absorptionMode = 'TPE'`, `player.tpeId = '<selected TPE id>'`. Set via `useTradeMachine.setPlayerTrade('setAbsorptionMode')` and `setPlayerTrade('setTpeId')`. |
| **Validator interpretation** | `validateTradeExceptions.js`: (1) `absorptionMode === 'TPE'` without `tpeId` → violation, (2) `tpeId` not found in team's TPE list → violation, (3) TPE expired/consumed/too small → violation, (4) prior-year TPE for second-apron team → violation, (5) TPE combined with outgoing salary → violation. |
| **Apply-time interpretation** | `computeTradeResult()` (mutationPipeline.js:1192–1289): fail-closed pre-check requires `tpeId` + `matchIncoming` for any `absorptionMode === 'TPE'` player. On valid usage: `remainingAmount` decremented, `usedAmount` incremented, `isUsed` set when `remainingAmount === 0`. |
| **Persistence write target** | TPEs stored in `team.tradeExceptions[]` at compute-time, then normalized to `team.exceptions.tpe[]` via `normalizeTeamTpeSchema()` before Firestore write (mutationPipeline.js:2524). Exception history entries appended to `team.exceptionHistory[]`. |
| **World awareness** | TPEs loaded as part of team data via `getTeam()` fallback chain. |
| **Known normalizers** | `normalizeTeamTpeSchema()` merges legacy `tradeExceptions[]` into canonical `exceptions.tpe[]` and removes the legacy field before persistence. `normalizeTPE()` in tradeContext.js normalizes field names (`remainingAmount ↔ amount`). |
| **Fail-closed guard** | Validator: 5 blocking rules in `validateTradeExceptions.js`. Apply: fail-closed pre-check blocks mutation if `absorptionMode === 'TPE'` without valid `tpeId` + `matchIncoming` (mutationPipeline.js:1192–1219). If errors exist, entire trade mutation returns `{ success: false }` (mutationPipeline.js:1499–1508). |

### TPE Creation

| Aspect | Detail |
|--------|--------|
| **UI payload representation** | Not directly in UI payload. TPE creation is computed by validator: `createdTPE` in `teamResult` when team sends out more salary than received while over cap. |
| **Validator interpretation** | `tradeValidator.js:942–956`: calls `createTPE()` with `{ isOverCap, outgoing, incoming, tradeDate }`. Returns TPE object with amount, season, expiry. |
| **Apply-time interpretation** | `computeTradeResult()` reads `teamResult.createdTPE` and adds to `updatedTPEs[]` with idempotent signature-based duplicate detection (mutationPipeline.js:1326–1414). Creates `exceptionHistory` entry. |
| **Persistence write target** | Same as TPE usage: `team.tradeExceptions[]` → normalized to `exceptions.tpe[]`. |
| **Fail-closed guard** | Duplicate detection prevents double-creation on retry. Signature: `(createdSeason, expiresOn, totalAmount, createdFrom)`. |

### Cash

| Aspect | Detail |
|--------|--------|
| **UI payload representation** | **Not modeled in Trade Machine UI.** No UI element allows adding cash to a trade. |
| **Validator interpretation** | `cashSent`/`cashReceived` fields exist in validator data structures (tradeValidator.js:577) but are always `0`. `validateCash()` rule exists but operates on these zero values. |
| **Apply-time interpretation** | `buildPostTradeTeamsSnapshot()` does not process cash fields. |
| **Persistence write target** | N/A — no cash data persists. |
| **Fail-closed guard** | N/A. |

---

## 4. E2E Flow Traces

### Trace 1: 2-Team Player-Only Trade

```
UI: User selects 2 teams, marks players for trade
  → useTradeMachine.setPlayerTrade(idx, player, 'trade', destTeamId)
    → teams[idx].sends = [..., { ...player, tradeTo: destTeamId }]

UI: User clicks "Validate Trade"
  → TradeEditor.handleValidate()
    → useTradeMachine.handleValidate()
      → validateCurrentTrade()
        → validateTrade({ teams: [{ team, sends, entitlementsOut }], capProjections, currentYear })
          → resolveTeamIdentity() for each team
          → computeMatchingValues() sets matchOutgoing/matchIncoming on players
          → validateEntitlementRouting(), validateEntitlementLinkageLegality(), validatePlayerRouting()
          → Per-team: validateSalaryMatching(), validateHardCap(), validateStepien(), etc.
          → Returns { legal: true/false, teamResults, tradeReceipt }

UI: User clicks "Apply Trade" (canApplyTrade = hasCurrentValidation && result.legal)
  → exportCurrentTrade()
    → Returns [{ teamId, outgoingPlayers, outgoingEntitlements, incomingPlayers, incomingEntitlements }]
  → onApplyTrade(tradeData) → applyTradeToCapSheet(tradeData)

World mode path:
  → useArchitectActions.applyTradeToCapSheet(tradeData)
    → Transforms payload: resolveTeamCode(), maps sends with routing fields
    → runAuthoritativeFAMutation('executeTrade', { teams, tradeCtx })
      → applyWorldMutation({ userId, worldId, seasonId, mutationType: 'executeTrade', payload })
        → Phase 1: loadStateForMutation() → getTeam(worldId, code) for each team
        → Phase 2: computeWorldMutation('executeTrade')
          → buildPostTradeTeamsSnapshot() — pure roster transform
          → validatePostTradeSnapshotForContext() — calls validateTrade() on POST-TRADE state
          → computeTradeResult() — applies TPE creation/consumption
        → Phase 3: validateMutation() — reads pre-validated context, checks legal
        → Phase 3.5: validateMutationLeagueInvariants() — no cross-team duplicate players
        → Phase 3.6: validateMutationEntitlementInvariants() — no cross-team duplicate entitlements
        → Phase 3.7: validateTradeApplyExclusivity() — no overlapping entitlement claims
        → Phase 4: persistWorldMutation()
          → writeBatch(db)
          → batch.set(worldTeamRef, sanitizedTeam) for each team
          → batch.set(entitlementRef, { holderTeam }, { merge: true }) for each transferred entitlement
          → batch.set(eventRef, sanitizedEvent) — event log
          → batch.update(metadataRef, worldPatch) — world metadata
          → batch.commit() — ATOMIC
```

### Trace 2: 3-Team Player Routing Trade

```
UI: User adds 3rd team, marks players with explicit tradeTo destinations
  → useTradeMachine.setPlayerTrade(idx, player, 'trade', destTeamId)
  → activeTeamCount = 3

UI: Validate
  → validateTrade()
    → validatePlayerRouting({ teams }) — checks all outgoing players have valid destinations
      → If any player missing destination → { valid: false, errors: [...] } → early return, legal: false
    → shouldRoutePlayerToTeam() with activeTeamCount > 2:
      → REQUIRES destinationTeamId !== null && destinationTeamId === receivingTeamId
      → No broadcast fallback for 3+ teams
    → Salary matching uses routed incoming values only

UI: Apply
  → applyTradeToCapSheet() transforms with receivingTeamIndex for index-based routing
  → applyWorldMutation('executeTrade')
    → buildPostTradeTeamsSnapshot():
      → Fail-closed: activeTeamCount >= 3, every outgoing player must resolve to valid destination
        → Missing destination → throws TRADE_APPLY_ROUTING_ERROR (no partial writes)
      → Incoming players collected via explicit routing (no broadcast)
    → validatePostTradeSnapshotForContext() re-validates routed state
    → persistWorldMutation() → batch.commit()
```

### Trace 3: Trade Including Entitlements

```
UI: User toggles entitlement for trading
  → useTradeMachine.toggleEntitlement(idx, entitlement)
    → 2-team: auto-sets toTeamId to other team
    → 3+-team: leaves toTeamId null (UI prompts user)
  → decorateEntitlementForTrade() adds display fields

UI: User sets destination (3+ teams)
  → useTradeMachine.setEntitlementDestination(fromTeamIndex, entitlementId, toTeamId)

UI: Validate
  → validateTrade()
    → validateEntitlementRouting({ teams }) — checks uniqueness, destinations, ownership
    → validateEntitlementLinkageLegality({ teams }) — checks linked package completeness
    → Per-team: validateEntitlementExclusivity() via buildEntitlementRoutingMap() + computePostTradeEntitlements()

UI: Apply
  → exportCurrentTrade() → outgoingEntitlements with toTeamId routing
  → applyTradeToCapSheet() forwards outgoingEntitlements and entitlementsOut
  → applyWorldMutation('executeTrade')
    → buildPostTradeTeamsSnapshot():
      → Updates team.entitlementIds[]: removes outgoing, adds incoming (respects toTeamId routing)
      → Post-apply invariant: checks no entitlement on multiple teams (throws on violation)
    → computeTradeResult():
      → Builds entitlementsTraded for event log
      → Builds entitlementUpdates[] for holderTeam patches
    → persistWorldMutation():
      → batch.set(teamRef, team) — includes updated entitlementIds[]
      → batch.set(entitlementRef, { holderTeam }, { merge: true }) — patches holderTeam
      → batch.commit() — ATOMIC
```

### Trace 4: Trade with Linked Packages

```
UI: User toggles only one part of a linked package
  → toggleEntitlement() adds the entitlement to entitlementsOut

UI: Validate
  → validateTrade()
    → validateEntitlementLinkageLegality({ teams })
      → For each entitlement with linkedEntitlementIds:
        → Checks all linked IDs are also being traded by the same team
        → If incomplete → { valid: false, errors: ["Linked package incomplete..."] }
      → For each entitlement with residualOfEntitlementId:
        → Checks residual references are valid
        → If invalid → error
    → Returns legal: false with specific error identifying missing linked entitlement IDs

UI: Apply button disabled (canApplyTrade = false because result.legal = false)
  → Trade cannot proceed — fail-closed at validation stage
```

### Trace 5: TPE Absorption Trade

```
UI: User selects incoming player absorption mode
  → useTradeMachine.setPlayerTrade(idx, player, 'setAbsorptionMode', 'TPE')
    → player.absorptionMode = 'TPE'
  → useTradeMachine.setPlayerTrade(idx, player, 'setTpeId', tpeId)
    → player.tpeId = tpeId, player.absorptionMode = 'TPE'

UI: Validate
  → validateTrade()
    → validateTradeExceptions():
      → Checks absorptionMode='TPE' has tpeId → pass
      → Checks tpeId resolves to real TPE → pass
      → Checks TPE not expired, not consumed, sufficient remaining → pass
      → Checks no outgoing salary combined with TPE → pass
    → Salary matching: skip reason set when TPE absorption applies

UI: Apply
  → exportCurrentTrade() → player carries absorptionMode + tpeId on send entry
  → applyTradeToCapSheet() → forwards player fields to mutation pipeline
  → applyWorldMutation('executeTrade')
    → computeWorldMutation():
      → buildPostTradeTeamsSnapshot() moves players
      → validatePostTradeSnapshotForContext() re-validates (same TPE rules)
      → computeTradeResult():
        → FAIL-CLOSED PRE-CHECK: absorptionMode='TPE' requires tpeId + matchIncoming
          → If missing → tpeConsumptionErrors → entire trade returns { success: false }
        → On valid: tpeUsageMap tracks consumed amount per tpeId
        → Updates TPE: remainingAmount decremented, usedAmount incremented, isUsed if depleted
        → Creates consumption history entry
    → validateMutation() → reads pre-validated context → valid
    → persistWorldMutation():
      → team.tradeExceptions = updatedTPEs
      → normalizeTeamTpeSchema() moves to canonical exceptions.tpe[]
      → appendExceptionHistory() adds lifecycle entries
      → batch.commit() — ATOMIC
```

### Trace 6: Sign-and-Trade via Trade Machine

```
UI: User clicks "Sign-and-Trade" on a free agent
  → TradeEditor.openTradeMachineSatModal(teamIndex, player, defaultDest)
  → EditContractModal opens with contract capture
  → User sets destination team + contract details
  → handleTradeMachineSignAndTrade(player, contractPayload, destinationTeamId)
    → validateSignAndTradeContractPayload() — contract shape check
    → useTradeMachine.setPlayerTrade(idx, player, 'signAndTrade', destTeamId, { signAndTradeContract })
      → send = { ...player, tradeTo: destTeamId, signAndTrade: true, signAndTradeContract: validated }

UI: Validate
  → validateTrade()
    → validateSignAndTrade() rule checks S&T-specific constraints
    → Salary matching uses S&T first-year salary from signAndTradeContract.salariesByYear[]
    → S&T triggers hard-cap metadata on receiving team

UI: Apply
  → applyTradeToCapSheet()
    → Re-validates S&T contract via validateSignAndTradeContractPayload()
    → Throws on missing destination or invalid contract
    → Forwards signAndTrade, signAndTradeContract, contract fields
  → applyWorldMutation('executeTrade')
    → buildPostTradeTeamsSnapshot():
      → S&T PREFLIGHT (tradeContext.js:147–213):
        → isSignAndTradeEligible() — status must be FREE_AGENT or CAP_HOLD
        → Destination must be valid participant, not self
        → signAndTradeContract must be present and valid
        → Any failure → throws SIGN_AND_TRADE_APPLY_ERROR (no partial writes)
      → Incoming S&T player gets: normalized contract, signedDate, originTeamId
      → Source team: cap hold removed for S&T player
      → Receiving team: hard-cap metadata set (hardCapped, hardCapLevel, hardCapTriggeredBy)
    → computeTradeResult() + persistWorldMutation() → ATOMIC
```

---

## 5. Parity Answers (5 Required Questions)

### Q1: Can validator mark a trade legal if apply-time would still block it?

**Answer: No (with one theoretical edge case).**

Apply-time (`applyWorldMutation`) re-validates the trade via `validatePostTradeSnapshotForContext()` which calls the same `validateTrade()` function. Additionally, apply-time adds these extra blocking checks that the UI-time validator does not run:

- `validateMutationLeagueInvariants()` — cross-team duplicate player prevention (Phase 86)
- `validateMutationEntitlementInvariants()` — cross-team duplicate entitlement prevention (Phase B5)
- `validateTradeApplyExclusivity()` — per-team entitlement exclusivity (Phase 3.7)
- `buildPostTradeTeamsSnapshot()` routing invariants and S&T preflight

These additional checks mean apply-time is **stricter** than UI-time validation. The UI validator could mark a trade legal that apply-time blocks — but only due to state changes between validate and apply (e.g., another mutation modified a team between clicks). This is correct behavior (optimistic validation + pessimistic apply).

**Evidence:** `mutationPipeline.js:522–620` (validation + invariant chain), `tradeContext.js:147–256` (apply-time-only preflight checks).

### Q2: Can apply-time succeed if validator would mark it illegal?

**Answer: No.**

Apply-time calls `validatePostTradeSnapshotForContext()` which internally calls `validateTrade()` — the same canonical validator. If `!validationResult.valid`, `applyWorldMutation` returns `{ success: false }` at line 533–540 of mutationPipeline.js. No batch is opened, no writes occur.

The only bypass is the `VITE_ENABLE_CBA_OVERRIDE` environment flag which allows `forceTrade` in the UI validator (useTradeMachine.js:972), but this flag is checked at UI-time only. The apply-time pipeline does NOT have any override bypass — it uses the raw `validation.legal` from `validatePostTradeSnapshotForContext()`.

**Evidence:** `mutationPipeline.js:933–962` (compute calls `validatePostTradeSnapshotForContext`), `mutationPipeline.js:2232–2250` (validateMutation for executeTrade reads pre-validated context, throws if missing).

### Q3: Can UI show a result (summary, created assets, usage) that apply-time does not persist?

**Answer: No meaningful divergence.**

The UI shows the `tradeReceipt` from `validateTrade()`. Apply-time recomputes via the same validator and then `computeTradeResult()` persists the outcomes. Both use the same `createdTPE` computation (`createTPE()` in tradeUtilities.js), the same salary matching values, and the same entitlement routing.

The one cosmetic gap: `exportCurrentTrade()` produces `usedTradeExceptions` filtering on `p.acquiredViaTPE`, but `acquiredViaTPE` is never set by any action in `useTradeMachine`. This field is always an empty array. Apply-time correctly reads `absorptionMode` + `tpeId` instead. This is dead code, not a persistence gap.

**Evidence:** `useTradeMachine.js:1037–1039` (`acquiredViaTPE` filter — never set), `mutationPipeline.js:1192–1289` (apply reads `absorptionMode` + `tpeId`).

### Q4: Are there any "silent drop" conversions between UI payload and mutation payload?

**Answer: No silent drops that change outcomes.**

The transformation in `applyTradeToCapSheet()` (useArchitectActions.ts:614–703) explicitly maps all semantically meaningful fields:

- `tradeTo` → resolved via `resolveTeamCode()` → forwarded as both `tradeTo` and `receivingTeamId`
- `receivingTeamIndex` → computed from `teamIndexByCode` map
- `signAndTrade` → forwarded + re-validated
- `signAndTradeContract` → forwarded + re-validated via `validateSignAndTradeContractPayload()`
- `absorptionMode`, `tpeId` → forwarded as-is on player sends
- `outgoingEntitlements` → forwarded as both `outgoingEntitlements` and `entitlementsOut`
- `playerId` → explicitly extracted (`p.id || p.player_id`)

Fields that are NOT forwarded:
- `incomingPlayers` / `incomingEntitlements` — correctly not forwarded, because apply-time recomputes incoming from outgoing sends via routing
- `usedTradeExceptions` — dead field (always empty), not used by apply-time

**Evidence:** `useArchitectActions.ts:629–703` (transformation), `useTradeMachine.js:1019–1043` (export shape).

### Q5: Is the apply behavior deterministic across world → parent fallback contexts?

**Answer: Yes.**

`loadStateForMutation('executeTrade')` calls `getTeam(worldId, code)` for each team. `getTeam()` (teamLoader.js:34–71) follows the deterministic fallback chain: world snapshot → parent world (recursive) → base team. The same data is always returned for the same world state.

Apply-time writes go **exclusively** to the world snapshot layer (`worldTeamRef(worldId, teamCode)`) via `persistWorldMutation()`. Parent and base data are never written. This means:

- A child world always sees its own snapshots first (if they exist)
- Fallback to parent/base only occurs for teams not yet modified in this world
- Apply writes create/update world snapshots, establishing the team in this world's layer

The fallback chain is identical to the one used by `loadWorldTeamData()` in the UI (worldTeamData.ts:81–106), so there is no divergence between what the UI sees and what apply reads.

**Evidence:** `teamLoader.js:34–71` (fallback chain), `mutationPipeline.js:2534` (write target is worldTeamRef).

---

## 6. Fail-Closed / Atomicity Findings

### Atomicity

**Confirmed: Single batch commit, no partial writes.**

`persistWorldMutation()` (mutationPipeline.js:2501–2660) creates a single `writeBatch(db)` and stages all writes before calling `batch.commit()` exactly once (line 2646). The staged writes include:

1. Team snapshots — `batch.set(worldTeamRef, sanitizedTeam)` for each team
2. Player overrides — `batch.set(worldPlayerRef, sanitizedPlayer)` for each player
3. Entitlement holderTeam patches — `batch.set(entitlementRef, { holderTeam }, { merge: true })` for each transferred entitlement
4. Event log entry — `batch.set(eventRef, sanitizedEvent)`
5. World metadata — `batch.update(metadataRef, worldPatch)`

All of these are staged via `batch.set()` / `batch.update()` before the single `batch.commit()`. If any write fails, the entire batch is rolled back by Firestore (Firestore batch writes are atomic).

### Fail-Closed Guards

| Guard | Location | What It Blocks |
|-------|----------|----------------|
| Missing teamCode in payload | `loadStateForMutation` (mutationPipeline.js:703) | Throws before any computation |
| Missing playerId in trade sends | `applyTradeToCapSheet` (useArchitectActions.ts:706–716) | Throws before calling mutation pipeline |
| S&T missing destination/contract | `applyTradeToCapSheet` (useArchitectActions.ts:657–667) | Throws before calling mutation pipeline |
| Player routing incomplete (3+ teams) | `buildPostTradeTeamsSnapshot` (tradeContext.js:217–256) | Throws TRADE_APPLY_ROUTING_ERROR |
| S&T eligibility/contract invalid | `buildPostTradeTeamsSnapshot` (tradeContext.js:147–213) | Throws SIGN_AND_TRADE_APPLY_ERROR |
| Entitlement cross-team duplicate (post-apply) | `buildPostTradeTeamsSnapshot` (tradeContext.js:528–540) | Throws INVARIANT VIOLATION |
| TPE absorptionMode='TPE' without tpeId/matchIncoming | `computeTradeResult` (mutationPipeline.js:1192–1219) | Returns `{ success: false }` |
| TPE consumption errors | `computeTradeResult` (mutationPipeline.js:1499–1508) | Returns `{ success: false }` |
| Validation not legal | `applyWorldMutation` (mutationPipeline.js:533–540) | Returns `{ success: false }`, no batch opened |
| League duplicate player | `validateMutationLeagueInvariants` (mutationPipeline.js:544–565) | Returns `{ success: false }` |
| Entitlement duplicate across teams | `validateMutationEntitlementInvariants` (mutationPipeline.js:569–591) | Returns `{ success: false }` |
| Entitlement exclusivity violation | `validateTradeApplyExclusivity` (mutationPipeline.js:600–620) | Returns `{ success: false }` |
| Missing pre-validated context | `validateMutation` (mutationPipeline.js:2247–2250) | Throws (Phase 57 violation) |
| Persistence contract violation | `assertPersistableOrThrow` (mutationPipeline.js:2527–2531) | Throws in test env |

### No "warnings-only" branches that should be blockers

All identified warning paths are correctly non-blocking:

- `tpeConsumptionWarnings` (mutationPipeline.js:1259–1270) — only logged, does not block; actual errors use `tpeConsumptionErrors` which IS blocking
- `capSettingsResult.warnings` (tradeValidator.js:498–502) — informational cap settings source warnings; cap settings themselves are still applied
- `dataWarnings` from `validateTradeData()` (tradeValidator.js:968) — data quality warnings for UI display; do not affect legality

---

## 7. Issues List

### Blockers

None.

### Majors

None.

### Minors

**Minor #1: `usedTradeExceptions` dead code in `exportCurrentTrade()`**

- **Severity:** Minor (cosmetic dead code)
- **Files:** `src/features/architect/hooks/useTradeMachine.js:1037–1039`
- **Description:** `exportCurrentTrade()` produces `usedTradeExceptions: t.sends.filter(p => p.acquiredViaTPE).map(p => p.tpeId)`. However, `acquiredViaTPE` is never set by any action in `useTradeMachine`. The `setAbsorptionMode` and `setTpeId` actions set `absorptionMode` and `tpeId` respectively — not `acquiredViaTPE`. Result: `usedTradeExceptions` is always `[]`.
- **Impact:** None — apply-time correctly reads `absorptionMode` + `tpeId` from the player sends. The field is informational and not consumed by the mutation pipeline.
- **Invariant:** Does not break any SHIP_GATES_MASTER invariant.
- **Recommended fix:** Either (a) update the filter to use `p.absorptionMode === 'TPE'` for correctness, or (b) remove the field entirely since it's not consumed downstream.

**Minor #2: `incomingPlayers` / `incomingEntitlements` in export payload are redundant**

- **Severity:** Minor (cosmetic)
- **Files:** `src/features/architect/hooks/useTradeMachine.js:1029–1036`
- **Description:** `exportCurrentTrade()` includes `incomingPlayers` and `incomingEntitlements` in the export payload, but `applyTradeToCapSheet()` does not use them for world mode (incoming is recomputed from outgoing sends via routing at apply-time). They are only used for vacuum mode local state manipulation.
- **Impact:** None — redundant data, not a semantic mismatch.
- **Invariant:** Does not break any SHIP_GATES_MASTER invariant.

---

## 8. Proposed Master Doc Deltas (Do Not Apply)

### `docs/architect/TRADE_MACHINE_MASTER.md`

**Delta 1:** Add explicit documentation of the apply-time re-validation guarantee.

```markdown
## Apply-Time Re-Validation Guarantee

Apply-time (`applyWorldMutation('executeTrade')`) re-validates the trade via `validatePostTradeSnapshotForContext()`,
which calls the same canonical `validateTrade()` function used by the Trade Machine UI. This ensures that:

1. State changes between UI validation and apply are caught
2. Apply-time is strictly >= UI-time in enforcement (additional league/entitlement invariants are checked)
3. No trade can be persisted that would fail validation at the time of apply
```

**Delta 2:** Document the `usedTradeExceptions` dead code for future cleanup.

```markdown
### Known Dead Code

- `exportCurrentTrade().usedTradeExceptions` filters on `acquiredViaTPE` which is never set.
  The authoritative TPE usage path is `absorptionMode` + `tpeId` on player send entries.
  This field is always empty and not consumed by apply-time.
```

### `docs/SHIP_GATES_MASTER.md`

No deltas needed. The existing gates and invariants accurately reflect the codebase state.

---

## 9. Validation Outputs

### `npm run test:trade -- --reporter=dot`

**Result: PASS**

```
Test Files  55 passed (55)
     Tests  513 passed | 1 skipped | 3 todo (517)
  Duration  85.07s
```

### `npm run test:architect -- --reporter=dot`

**Result: PASS**

```
Test Files  136 passed (136)
     Tests  2206 passed | 1 skipped | 3 todo (2210)
  Duration  174.94s
```

### `npm run build`

**Result: PASS**

```
✓ 3052 modules transformed.
✓ built in 3m 5s
```

### `npm run validate:project`

**Result: PASS**

```
✅ All validations passed!
```

---

## 10. Exact Files/Functions Referenced

### UI Payload Build
- `src/features/architect/tradeMachine/TradeEditor.jsx` — `TradeEditor` component, Apply Trade handler (lines 502–541)
- `src/features/architect/hooks/useTradeMachine.js` — `exportCurrentTrade()` (lines 1019–1043), `validateCurrentTrade()` (lines 897–1002), `handleValidate()` (lines 1009–1017), `setPlayerTrade()` (lines 462–629), `toggleEntitlement()` (lines 636–679), `setEntitlementDestination()` (lines 682–701)

### Validator
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` — `validateTrade()` (lines 450–1020), `resolvePlayerDestinationTeamId()` (lines 120–124), `shouldRoutePlayerToTeam()` (lines 126–138), `generateTradeReceipt()` (lines 174–442)
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` — `validateTradeExceptions()` (absorptionMode/tpeId checks)
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` — `validateEntitlementRouting()`, `validateEntitlementLinkageLegality()`
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js` — `validatePlayerRouting()`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js` — `validateSignAndTrade()`
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` — `computeMatchingValues()`
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` — `createTPE()`
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts` — `isSignAndTradeEligible()`, `resolveSignAndTradeContractPayload()`, `validateSignAndTradeContractPayload()`

### Apply Entrypoint
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` — `applyTradeToCapSheet()` (lines 614–876), `runAuthoritativeFAMutation()` (lines 549–610), `persistMutation()` (lines 465–505)

### Mutation Pipeline
- `src/features/architect/utils/mutationPipeline.js`:
  - `applyWorldMutation()` (lines 450–680) — orchestrator
  - `loadStateForMutation('executeTrade')` (lines 696–718) — state loading
  - `computeWorldMutation('executeTrade')` (lines 925–963) — compute dispatcher
  - `computeTradeResult()` (lines 1095–1530) — trade compute (TPE creation/consumption, entitlement updates)
  - `validateMutation()` (lines 2210–2400) — validation gate
  - `persistWorldMutation()` (lines 2501–2660) — atomic Firestore write

### Trade Context
- `src/features/architect/utils/tradeContext/tradeContext.js`:
  - `buildPostTradeTeamsSnapshot()` (lines 75–563) — pure roster transform with fail-closed invariants
  - `validatePostTradeSnapshotForContext()` (lines 593–642) — re-validation wrapper

### Persistence Contracts
- `src/features/architect/utils/persistenceContracts/contracts.js` — `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`, `TRADE_EXCEPTION_ITEM_ALLOWLIST`, `PERSISTENCE_CONTRACTS`
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js` — `normalizeTeamTpeSchema()`, `getTeamTpeList()`

### League Invariants
- `src/features/architect/utils/leagueInvariants.ts` — `validateMutationLeagueInvariants()`, `validateMutationEntitlementInvariants()`, `validateTradeApplyExclusivity()`

### Entitlement Utilities
- `src/features/architect/utils/entitlements/entitlementResolver.js` — `resolveEntitlementsForTeam()`
- `src/features/architect/utils/entitlements/entitlementTerms.js` — `decorateEntitlementForTrade()`
- `src/features/architect/utils/entitlements/entitlementExclusivityValidator.js` — `validateEntitlementExclusivity()`
- `src/features/architect/utils/tradeMachine/utils/buildEntitlementRoutingMap.ts` — `buildEntitlementRoutingMap()`
- `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` — `computePostTradeEntitlements()`

### World Loader
- `src/features/architect/utils/worldTeamData.ts` — `loadWorldTeamData()`, `resolveTeamCode()`
- `src/features/architect/utils/teamLoader.js` — `getTeam()` (fallback chain: world → parent → base)

### Master Docs
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`

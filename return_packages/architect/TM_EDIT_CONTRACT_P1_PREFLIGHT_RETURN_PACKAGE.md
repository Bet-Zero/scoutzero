# TM_EDIT_CONTRACT_P1 — PREFLIGHT RETURN PACKAGE

**Ticket:** TM_EDIT_CONTRACT_P1  
**Mode:** PREFLIGHT (Discovery + verification; docs-only outputs)  
**Date:** 2026-02-28  
**Scope:** Cap Sheet tab (`activeTab === 'cap'`) → player row click → Edit Contract modal → save paths → cap totals refresh

---

## 1. Executive Summary

This preflight completed a code-trace audit of the Cap Sheet entry flow into `EditContractModal` and all save paths reachable from Cap Sheet row-click context.

Primary conclusions:

- Cap Sheet row click wiring to the modal is clear and deterministic.
- Save handlers are centralized in `useArchitectActions.ts`, with optimistic local updates and post-state validation.
- Base mode correctly avoids Firestore writes for cap-sheet mutation handlers.
- World mode persistence routes through `applyWorldMutation` and world snapshot/event paths.
- **P0 findings were identified**:
  - `Buyout Contract` does not collect buyout amount and effectively behaves like waive semantics.
  - Local optimistic world-state behavior for some flows (`waive`, `option decline`) diverges from authoritative world compute semantics, creating post-refresh drift risk.

Runtime UI smoke was not executed in-browser in this preflight; findings are code-trace plus automated test/build evidence.

---

## 2. Source-of-Truth Map (Call Graph)

### 2.1 Route → Dashboard → Cap Sheet Tab

```bash
nl -ba src/App.jsx | sed -n '33,36p'
```

```text
33  <Route path="/player-ranker" element={<PlayerRankerPage />} />
34  <Route path="/gm" element={<GmLeagueView />} />
35  <Route path="/gm/:teamId" element={<GmDashboardView />} />
```

```bash
nl -ba src/pages/GmDashboardView.jsx | sed -n '2,8p'
```

```text
2  import GMDashboard from '@/features/architect/GMDashboard';
7      <GMDashboard />
```

### 2.2 Cap Sheet Section → Row Click Entry

```bash
nl -ba src/features/architect/GMDashboard/GMDashboard.jsx | sed -n '282,289p'
```

```text
282  {activeTab === 'cap' && (
283    <CapSheetSection
286      onSelectPlayer={actions.handleEditContract}
```

```bash
nl -ba src/features/architect/GMDashboard/sections/CapSheetSection.jsx | sed -n '18,22p'
```

```text
18  <CapSheet
21    onSelectPlayer={onSelectPlayer}
```

```bash
nl -ba src/features/architect/capSheet/CapSheet/CapSheet.jsx | sed -n '291,294p'
```

```text
291  <div className="font-medium text-xs text-white/90 truncate">
292    <button
293      onClick={() => onSelectPlayer && onSelectPlayer(player)}
```

### 2.3 Callback that Opens Edit Contract Modal

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '1882,1891p'
```

```text
1882 const handleEditContract = useCallback(
1883   (player: ArchitectPlayer): void => {
1884     setSelectedPlayer(player);
1885     setSelectedRulesYear(currentYear);
1887     openContractModal({
1888       initialAction: null,
1889       targetYear: null,
1890       actionContext: null,
```

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectModals.ts | sed -n '89,96p'
```

```text
89  const openContractModal = useCallback((context?: EditModalContext): void => {
91    setInitialAction(context.initialAction ?? null);
92    setTargetYear(context.targetYear ?? null);
93    setActionContext(context.actionContext ?? null);
95    setShowContractModal(true);
```

### 2.4 Modal Component, State Owner, and Context Passed

`selectedPlayer` / `activeTab` state owner:

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectState.ts | sed -n '334,339p'
```

```text
334  const [selectedRulesYear, setSelectedRulesYear] = useState<number>(currentYear);
336  const [selectedPlayer, setSelectedPlayer] = useState<ArchitectPlayer | null>(null);
339  const [activeTab, setActiveTab] = useState<ActiveTab>('roster');
```

Modal mount + props:

```bash
nl -ba src/features/architect/GMDashboard/GMDashboard.jsx | sed -n '422,444p'
```

```text
422  {showContractModal && (
423    <EditContractModal
426      player={selectedPlayer}
429      actionContext={actionContext}
431      teamCapSheet={teamCapSheet}
432      currentYear={currentYear}
438      onExtend={actions.handleExtendContract}
439      onWaive={actions.handleWaiveContract}
440      onOptionDecision={actions.handleOptionDecision}
```

### 2.5 Save/Confirm Handler in Modal

```bash
nl -ba src/shared/components/EditContractModal.jsx | sed -n '658,721p'
```

```text
658  switch (selectedAction) {
659    case 'accept':
660      onOptionDecision?.(player, true, overrideMetadata);
665    case 'signNew':
666      (onSignFreeAgent || onSaveContract || onSave)?.(player, ...)
695    case 'extend':
704      onExtend?.(player, { ...contract, ...(overrideMetadata || {}) });
707    case 'waive':
708      onWaive?.(player, { stretch: false, buyout: false, ...(overrideMetadata || {}) });
713    case 'buyout':
714      onWaive?.(player, { stretch: false, buyout: true, ...(overrideMetadata || {}) });
720  onClose();
```

### 2.6 Mutation Handlers Invoked (Base + World)

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '2108,2171p'
```

```text
2108 const mutationResult = applyCapAuditedTeamMutation({
2109   mutationType: 'extendPlayer',
2164   persistPayload: { teamCode, playerId, extension: { salariesByYear: ... } }
```

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '2197,2267p'
```

```text
2197 const mutationResult = applyCapAuditedTeamMutation({
2198   mutationType: 'waivePlayer',
2261   persistPayload: {
2262     teamCode,
2263     playerId,
2264     stretch: !!stretch,
2265     stretchYears: stretch ? 3 : 0,
```

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '2292,2432p'
```

```text
2292 const mutationResult = applyCapAuditedTeamMutation({
2293   mutationType: 'optionDecision',
2427   persistPayload: { teamCode, playerId, accepted, targetYear }
```

### 2.7 Post-State Validation Invocation

Local/optimistic cap-audit validator:

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '920,951p'
```

```text
920  const previewEvent = buildCapAuditEvaluation({...});
939  if (!previewEvent.validation.valid) { ... return { applied: false ... } }
951  setTeamCapSheet(afterTeamSnapshot);
```

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '575,586p'
```

```text
577  const validation = validatePostStateCapLegality({
582    beforeTeamsByCode,
583    afterTeamsByCode,
584    beforeTotalsByTeam,
585    afterTotalsByTeam,
```

World pipeline validator:

```bash
nl -ba src/features/architect/utils/mutationPipeline.js | sed -n '810,844p'
```

```text
810 // PHASE 3.8: POST-STATE CAP VALIDATOR (world mutation gold path)
834 const postStateValidation = validatePostStateCapLegality({
839   beforeTeamsByCode,
840   afterTeamsByCode,
841   beforeTotalsByTeam,
842   afterTotalsByTeam,
```

### 2.8 Team Snapshot Update + Totals Recompute + Cap Sheet Refresh

Cap Sheet totals SSOT:

```bash
nl -ba src/features/architect/capSheet/CapSheet/CapSheet.jsx | sed -n '42,57p'
```

```text
42  const [selectedYear, setSelectedYear] = useState(currentYear);
55  const totals = React.useMemo(
56    () => computeTeamCapTotals(teamCapSheet, selectedYear),
57    [teamCapSheet, selectedYear]
```

Optimistic update + world rollback on persist failure:

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '951,983p'
```

```text
951 setTeamCapSheet(afterTeamSnapshot);
961 const persistPromise = persistMutation(...)
979 onFailure: (message) => {
980   setTeamCapSheet(beforeTeamSnapshot);
```

World persistence path:

```bash
nl -ba src/features/architect/utils/mutationPipeline.js | sed -n '2815,2837p'
```

```text
2815 for (const { teamCode, team } of computeResult.teamUpdates) {
2836   const teamRef = worldTeamRef(worldId, teamCode);
2837   batch.set(teamRef, sanitizedTeam);
```

---

## 3. Modal Surface Inventory

### 3.1 Declared Action Modes

```bash
nl -ba src/shared/components/EditContractModal.jsx | sed -n '90,94p'
```

```text
90  const ACTION_SETS = {
91    option: ['accept', 'decline', 'signNew'],
92    freeAgent: ['resign', 'signAndTrade', 'renounce'],
93    underContract: ['extend', 'waive', 'waiveStretch', 'buyout'],
```

### 3.2 Action Set Predicate (from Cap Sheet row-click context)

```bash
nl -ba src/shared/components/EditContractModal.jsx | sed -n '237,245p'
```

```text
237 const actionSet = actionContext
238   ? actionContext
239   : hasOption
240     ? 'option'
241     : isFreeAgent && !isUnderContract
242       ? 'freeAgent'
243       : isUnderContract
244         ? 'underContract'
```

### 3.3 Reachability From Cap Sheet Player Row

```bash
nl -ba src/features/architect/capSheet/CapSheet/CapSheet.jsx | sed -n '161,163p'
```

```text
161 const filteredPlayers = teamCapSheet.players
162   .filter((p) => getContractYearSlice(p, selectedYear))
```

| Mode | Predicate | Reachable from Cap Sheet row-click? | Notes |
| --- | --- | --- | --- |
| `underContract` (`extend`, `waive`, `waiveStretch`, `buyout`) | `isUnderContract && !hasOption` | Yes | Standard under-contract roster row flow |
| `option` (`accept`, `decline`, `signNew`) | `hasOption` | Yes | Optioned players get option set first |
| `freeAgent` (`resign`, `signAndTrade`, `renounce`) | `isFreeAgent && !isUnderContract` | Typically no from Cap Sheet row | Cap Sheet rows require `getContractYearSlice(...)` truthy, so pure cap-hold players are generally not row-click entries |

### 3.4 Per Requested Entry Cases

- Player under contract: reaches `underContract` action set.
- Player with team/player option: reaches `option` action set (option set takes precedence over `underContract`).
- Extension-eligible player: `extend` appears in `underContract`; disabled if `!isExtendEligible` (`EditContractModal.jsx:895-897`).

Potentially incorrect/at-risk surface:

- `Buyout Contract` is exposed but buyout amount is not surfaced in modal inputs (see Section 8, P0).

---

## 4. Workflow Inventory Table

| Workflow name | Entry control(s) | User steps | Expected state changes (team/player fields) | Mutation type(s) / action payloads | Validator gates | Post-state validator inclusion | Base mode persistence behavior | World mode persistence behavior | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Extend Contract | Cap Sheet row → modal action `extend` | Select `extend` → set years/salaries → Confirm | Local: append extension years to `player.futureContract.salariesByYear` (`useArchitectActions.ts:2133-2143`) | `extendPlayer`, payload includes `teamCode`, `playerId`, `extension.salariesByYear` (`2164-2169`) | Modal `useCapValidation`; local `validatePostStateCapLegality`; world `validateExtension` + world post-state validator | Yes (`useArchitectActions.ts:577-586`, `mutationPipeline.js:834-844`) | No Firestore writes (persist short-circuit when no world: `693-695`) | `applyWorldMutation` → team snapshot write + event (`mutationPipeline.js:632-640`, `2815-2837`, `2888-2894`) | Modal closes immediately (`EditContractModal.jsx:720`); if world persist fails, optimistic rollback to `beforeTeamSnapshot` (`useArchitectActions.ts:980`) |
| Waive Player | Cap Sheet row → modal action `waive` | Select `waive` → Confirm → browser confirm prompt | Local: mark player `waived`, clear salaries, add `deadCap` object on player (`2224-2238`) | `waivePlayer`, payload includes `stretch`, `stretchYears` (`2261-2267`) | Modal `useCapValidation`; local `validatePostStateCapLegality`; world `validateWaive` + world post-state validator | Yes | No Firestore writes in base mode | World mutation writes team snapshot/event; compute path removes player from roster/players (`mutationPipeline.js:1991-1999`) | If browser confirm canceled, handler returns but modal still closes (`useArchitectActions.ts:2188`, `EditContractModal.jsx:720`) |
| Waive & Stretch | Cap Sheet row → modal action `waiveStretch` | Select `waiveStretch` → Confirm → browser confirm | Local: same player flags as waive, plus `deadCap.stretched=true` | `waivePlayer` with `stretch=true`, `stretchYears=3` default | Same as waive | Yes | Base mode local-only | World compute applies stretched `deadCap.amountByYear` schedule (`mutationPipeline.js:2005-2029`) | Same close behavior as waive |
| Buyout Contract | Cap Sheet row → modal action `buyout` | Select `buyout` → Confirm | Local: `onWaive(...{buyout:true})`; dead cap uses `buyoutAmount` if supplied, but modal does not capture amount | Routed as `waivePlayer` (no explicit buyout fields in persist payload) | Same as waive | Yes | Local-only in base | World compute for `waivePlayer` does not read `buyout`/`buyoutAmount` (`mutationPipeline.js:1969-1970`) | User sees buyout label, behavior maps to waive semantics |
| Accept Option | Cap Sheet row (option player) → action `accept` | Select `accept` → Confirm | Local: set `optionUsed: true` in target option year (`2321-2326`) | `optionDecision` with `accepted=true`, `targetYear=currentYear+1` | Modal `useCapValidation`; local `validatePostStateCapLegality`; world `validateOptionDecision` + world post-state validator | Yes | Local-only | World compute updates option and persists snapshot/event | Modal closes immediately; invalid post-state blocks before apply and error toast is emitted |
| Decline Option | Cap Sheet row (option player) → action `decline` | Select `decline` → Confirm | Local: trim future salaries, set `freeAgentYear`, add cap hold (`2339-2383`, `2398-2407`) | `optionDecision` with `accepted=false` | Same as accept option | Yes | Local-only | World compute removes player from team roster/players and adds cap hold (`mutationPipeline.js:2271-2277`, `2287-2289`) | Potential local/world drift until refresh (see P0) |
| Sign New Contract (option context) | Cap Sheet row (option player) → action `signNew` | Select `signNew` → enter terms → Confirm | World: `handleSign` authoritative sign pipeline; Base: validate + compute + `setTeamCapSheet(updatedTeam)` | `signFreeAgent` payload with normalized contract (`1360-1364`) | Modal `useCapValidation`; `validateSigning` in base; world `validateMutation(signFreeAgent)` + post-state validator | Yes | Base mode stays local; no Firestore writes | World mode uses `runAuthoritativeFAMutation` + `applyWorldMutation` + sync changed team (`833`, `763-773`) | Modal closes immediately; failures surface via toast/error path |

---

## 5. Field-by-Field Wiring Table

| UI label / surface | Data source path used | Computation origin | Write target path on save | Notes on drift/mismatch |
| --- | --- | --- | --- | --- |
| Contract year rows (season + salary) | `contractYears` from `getContractYearsForDisplay(player)` | `contractUtils.js` merges `player.contract.salariesByYear` + `player.futureContract.salariesByYear` (`94-124`) | Depends on action: extension writes `player.futureContract.salariesByYear`; option writes `player.contract.salariesByYear`; sign writes normalized contract | No separate cap-hit display in modal; salary is rendered (`EditContractModal.jsx:744-801`) |
| Remaining value / years | `summary.remainingValue`, `summary.remainingYears` | `contractYears.filter(y.year >= CURRENT_YEAR)` (`341-349`) | Indirect, based on selected action write path | Display is derived; no direct write |
| Option context text (`optionType`, `optionYear`) | `optionYearEntry = contractYears.find(y.year > CURRENT_YEAR && y.option)` (`202-206`) | Derived from contract rows | `optionDecision` mutation path | Correctly tied to future option row existence |
| Action modes list | `ACTION_SETS[actionSet]` | `actionSet` inference (`237-245`) | N/A | Option takes precedence over under-contract |
| Contract type select | `extension.contractType` (`956-963`) | Local state | Used in signing payload via `buildCanonicalSigningPayload` (`603-615`) | Not used for waive/option actions |
| Exception type select | `selectedException` (`973-985`) | Local state | Included in signing payload (`611`) | Signing-only |
| Extension years selector | `extension.years` (`1003-1017`) | Guardrail-clamped local state | Used by `buildCanonicalSigningPayload` and extension generation | Signing/extend only |
| Salary inputs grid | `salaryInputs[idx]` / `extension.salaries[idx]` (`1134-1169`) | Local state + guardrails | Signing payload `salariesByYear` or extension contract generation | Works for signing/extend actions |
| Waive/stretch/buyout controls | Action radio only (`waive`, `waiveStretch`, `buyout`) | Action selection only | `onWaive` booleans; `buyoutAmount` not captured in modal | **Buyout amount input missing** despite buyout path expecting `buyoutAmount` in handler |
| Current salary / cap hit / years remaining (requested minimum) | Salary rows + summary; no dedicated cap-hit widget | `contractYears` + `summary` | Action-dependent (see above) | Cap-hit is not independently surfaced; “years remaining” derives from year filtering |
| Resulting totals preview | None in modal | No `computeTeamCapTotals` call in modal | N/A | Modal does not show cap totals preview before commit |

Evidence for no dedicated buyout input:

```bash
nl -ba src/shared/components/EditContractModal.jsx | sed -n '946,949p'
```

```text
946 {['signNew', 'resign', 'extend', 'signAndTrade'].includes(selectedAction) && (
```

Evidence buyout action payload:

```bash
nl -ba src/shared/components/EditContractModal.jsx | sed -n '713,715p'
```

```text
713 case 'buyout':
714   onWaive?.(player, { stretch: false, buyout: true, ...(overrideMetadata || {}) });
```

---

## 6. Cap Totals Refresh Proof

### 6.1 SSOT Recompute Call

`CapSheet` recomputes totals from current `teamCapSheet` + selected year:

```bash
nl -ba src/features/architect/capSheet/CapSheet/CapSheet.jsx | sed -n '55,57p'
```

```text
55 const totals = React.useMemo(
56   () => computeTeamCapTotals(teamCapSheet, selectedYear),
57   [teamCapSheet, selectedYear]
```

### 6.2 State Update That Triggers Recompute

For extend/waive/option flows, `applyCapAuditedTeamMutation` performs optimistic state update:

```bash
nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '951,958p'
```

```text
951 setTeamCapSheet(afterTeamSnapshot);
953 if (!worldId) {
954   return { applied: true, operationId, persistPromise: Promise.resolve(true) };
```

### 6.3 Year Correctness

Cap Sheet uses user-selected year (`selectedYear`), initialized from `currentYear` and user-switchable:

```bash
nl -ba src/features/architect/capSheet/CapSheet/CapSheet.jsx | sed -n '42,42p;239,239p'
```

```text
42  const [selectedYear, setSelectedYear] = useState(currentYear);
239 onClick={() => setSelectedYear(year)}
```

### 6.4 Immediate Update vs Rollback

- Immediate update: `setTeamCapSheet(afterTeamSnapshot)` occurs before world persistence.
- Rollback on world persist failure: `setTeamCapSheet(beforeTeamSnapshot)` (`useArchitectActions.ts:980`).

### 6.5 Workflow-by-Workflow Refresh Note

- Extend / Waive / Option: immediate optimistic cap-sheet refresh via `setTeamCapSheet`.
- Sign New / Re-sign (world): authoritative sync path calls `syncTeamFromMutationResult` and sets team from `changedTeams` (`useArchitectActions.ts:763-773`, `833`).
- World persist success for extend/waive/option does **not** currently resync from returned `changedTeams`; it keeps optimistic local snapshot unless reload (see P0 drift).

---

## 7. Mode Parity Matrix (Base vs World)

| Workflow | Base mode behavior | World mode behavior | operationId / event correlation | Parity status |
| --- | --- | --- | --- | --- |
| Extend | Optimistic local mutation only; no Firestore write | Optimistic local + `applyWorldMutation('extendPlayer')` persist | Local `operationId` generated (`911`), passed to world mutation (`712`), linked to authoritative event ID on success (`964-973`) | Generally aligned, but no success resync |
| Waive | Local player flagged `waived`, contract cleared, player remains in players array (`2218-2239`) | World compute removes player from team roster/players (`1991-1999`) and writes snapshot | Same operation/event flow as above | **Mismatch (P0)** |
| Option Decline | Local keeps player object, trims contract, sets `freeAgentYear`, adds cap hold (`2372-2383`) | World compute removes player from roster/players (`2271-2277`) + cap hold | Same operation/event flow as above | **Mismatch (P0)** |
| Sign New (from option set) | Local validate/compute path, set updated team in memory (`1405-1437`, `1502`) | Authoritative world mutation with changed-team sync back to state (`1367-1374`, `833`) | World event + changedTeams returned (`924-929`) | Better parity than optimistic cap actions |

World persistence paths:

- Team snapshots: `architect_worlds/{worldId}/teams/{teamCode}` (`architectFirestorePaths.ts:79-83`, `mutationPipeline.js:2836-2837`)
- Player overrides: `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` (`architectFirestorePaths.ts:146-159`, `mutationPipeline.js:2861-2862`)
- Event log: `architect_worlds/{worldId}/events/{eventId}` (`mutationPipeline.js:2888-2895`)

---

## 8. Ranked Gap List (P0/P1/P2)

| Priority | What user sees | Why it matters | Evidence | Minimal repro (Cap Sheet only) | Likely fix direction |
| --- | --- | --- | --- | --- | --- |
| **P0** | `Buyout Contract` exists but no amount field; save behaves like waive semantics | Saves wrong business intent and hides reduced-buyout path | `EditContractModal.jsx:105-106`, `713-714`; `useArchitectActions.ts:2214-2216`, `2261-2267`; `mutationPipeline.js:1969-1970` | In world mode, Cap Sheet row → Buyout → Confirm; observe no buyout amount prompt and waive-like result | Add explicit buyout amount input and include buyout fields in persist payload + world compute |
| **P0** | Waive/decline option can appear one way immediately, then differ after reload | Local optimistic state diverges from authoritative world mutation semantics | Local waive/decline updates: `useArchitectActions.ts:2218-2239`, `2372-2383`; World removes player: `mutationPipeline.js:1991-1999`, `2271-2277`; no success resync in optimistic path (`961-978`) | World mode: Cap Sheet row → Decline option or Waive → save → compare immediate UI vs hard refresh | Resync `teamCapSheet` from authoritative `changedTeams` after successful persist |
| **P1** | Modal closes even on canceled confirm or blocked save | Users lose context and may think action succeeded/failed unclearly | Unconditional close: `EditContractModal.jsx:720`; waive cancel path: `useArchitectActions.ts:2188` | Cap Sheet row → Waive → Confirm → cancel browser confirm; modal still closes | Gate close on handler success (or explicit cancel behavior) |
| **P1** | Option players only see option actions; cannot directly choose extend/waive from same entry | May hide valid team operations from Cap Sheet row context | Action-set precedence: `EditContractModal.jsx:237-245` | Cap Sheet row on player with future option; only option action set appears | Consider mixed action-set or secondary action surface for option players |
| **P2** | Extension world compute path does not recalc `updatedTeam.totals` field explicitly | Potential persisted totals-field staleness for consumers that trust stored totals | `computeExtensionResult` returns without totals recompute (`mutationPipeline.js:2076-2159`), while waive/option paths do recompute (`2055`, `2299`) | World mode: extend then inspect persisted team `totals` vs recompute | Recompute and persist `updatedTeam.totals` consistently in extension compute path |

---

## 9. Minimal Smoke Checklist

Estimated runtime: 8-10 minutes.

1. Base mode (no world selected): Cap Sheet row → `Extend Contract` with 1-year sample salary → Confirm.
2. Verify Cap Sheet totals tile/row values update immediately for selected year and no Firestore write is required.
3. Base mode: Cap Sheet row with option player → `Decline Option` → Confirm; verify cap hold appears and player status updates.
4. World mode (select active world): Cap Sheet row → `Waive Player` → Confirm.
5. Verify immediate Cap Sheet refresh, then hard refresh page and compare roster/cap state for parity.
6. World mode: Cap Sheet row with option player → `Decline Option` → Confirm; repeat hard-refresh parity check.
7. Failure behavior check: Cap Sheet row → `Waive Player` → Confirm → cancel browser confirm; verify whether modal remains open or closes.

---

## 10. Commands Run / Skipped

### Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:node -- --run --reporter=dot` | ✅ Passed | 255 files; 3226 tests; 3214 passed, 9 skipped, 3 todo |
| `npm run test:ui -- --run --reporter=dot` | ✅ Passed | 37 files; 383 tests; 381 passed, 2 skipped |
| `npm run build` | ✅ Passed | Build completed in 54.48s |
| `npm run validate:project` | ✅ Passed | All validations passed |
| `npm run test:architect -- --run src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts src/tests/architect/worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts --reporter=dot` | ✅ Passed | Script executed broader architect/tradeMachine suites (153 files) due script scope |

### Commands Intentionally Skipped

| Command | Why skipped |
| --- | --- |
| `npm run test:full` | Prompt did not include `RUN FULL SUITE`; blocked by AGENTS policy |
| Manual browser smoke (`npm run dev` + interactive UI) | This preflight used code-trace + automated validation only; no interactive browser session performed |

---

## 11. Files Examined (list)

- `src/App.jsx`
- `src/pages/GmDashboardView.jsx`
- `src/features/architect/GMDashboard/GMDashboard.jsx`
- `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectModals.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/utils/contractUtils.js`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/architectFirestorePaths.ts`
- `src/constants/collections.ts`
- `src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts`

---

## 12. Stop Condition Report (explicit table)

| Stop condition | Triggered? | Evidence | Classification |
| --- | --- | --- | --- |
| 1. Cap Sheet click does not open correct modal reliably | No | Wiring chain is direct (`CapSheet` row click → `handleEditContract` → `openContractModal` → `EditContractModal`) | Not triggered |
| 2. Save does not change state OR changes wrong path | **Yes** | Buyout flow lacks amount wiring and persists as waive-like path (`EditContractModal.jsx:713-714`, `useArchitectActions.ts:2261-2267`, `mutationPipeline.js:1969-1970`) | **P0** |
| 3. World mode save can succeed but totals do not refresh | No direct proof of no-refresh | Optimistic `setTeamCapSheet` refresh exists (`useArchitectActions.ts:951`) | Not triggered as stated |
| 4. World mode save fails silently or persists partial writes | No | Failure paths emit errors/toasts and rollback (`980`, `1005-1011`) | Not triggered |
| 5. Modal exposes impossible action from Cap Sheet entry | No hard violation proven | Free-agent-only set is generally not Cap Sheet row-reachable; option precedence issue logged as P1, not impossible action exposure | Not triggered |


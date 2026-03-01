# TM_OFFER_SHEETS_P1 PREFLIGHT RETURN PACKAGE

**Ticket:** TM_OFFER_SHEETS_P1  
**Scope:** Offer Sheet lifecycle end-to-end (FA tab only)  
**Date:** 2026-03-01  
**Status:** **COMPLETE**  
**Master Doc:** `docs/architect/FREE_AGENCY_MASTER.md`

---

## 1. Executive Summary

The Offer Sheet lifecycle is **fully implemented end-to-end** with no stop conditions triggered. All 5 mutation types trace cleanly through the authoritative world mutation pipeline with:

- Proper two-team state updates (offering + home teams)
- Totals recompute on finalization stages
- Status transition enforcement via `validateOfferSheetResolution`
- Error handling that keeps modals open on failure

**No P0 or P1 gaps identified.** One architectural note (P2) regarding UI sync for non-current team.

---

## 2. Full Lifecycle Call-Graphs

### 2.1 Store Offer Sheet (Initiate)

```
UI: EditContractModal.jsx (signNew action + "RFA Offer Sheet" checkbox)
  → onStoreOfferSheet(player, contract)
  → GMDashboard.jsx props: actions.handleStoreOfferSheet
  → useArchitectActions.ts:1658 handleStoreOfferSheet()
    → useArchitectActions.ts:1708 runAuthoritativeFAMutation('storeOfferSheet', payload)
      → mutationPipeline.js:626 applyWorldMutation()
        → mutationPipeline.js:1019 loadStateForMutation() [loads offering team + home team + player]
        → mutationPipeline.js:1243 computeWorldMutation() → computeStoreOfferSheetResult()
        → mutationPipeline.js:2631 validateMutation() → validateSigning()
        → mutationPipeline.js:867 persistWorldMutation()
        → returns { success, changedTeams: [offeringTeam, homeTeam] }
    → useArchitectActions.ts:768 syncTeamFromMutationResult() [updates current team state]
    → toast.success('Saved changes')
```

**Evidence (computeStoreOfferSheetResult L3015-3165):**

```javascript
// Line 3100-3107: Updates offering team's offerSheets array
updatedOfferingTeam.offerSheets = [
  ...(updatedOfferingTeam.offerSheets || []),
  offerSheet,
];

// Line 3130-3145: MIRRORS to home team's incomingOfferSheets
updatedHomeTeam.incomingOfferSheets = [
  ...(updatedHomeTeam.incomingOfferSheets || []),
  offerSheet,
];

// Line 3158-3165: Returns both teams
return {
  success: true,
  teamUpdates: [
    { teamCode, team: updatedOfferingTeam },
    { teamCode: homeTeam.teamCode, team: updatedHomeTeam }
  ],
  ...
};
```

### 2.2 Match Offer Sheet

```
UI: OfferSheetList.jsx (incoming list, "Match" button on PENDING_MATCH row)
  → onMatch(os.offeringTeamCode, os.id)
  → useArchitectActions.ts:1734 handleMatchOfferSheet()
    → useArchitectActions.ts:1753 runAuthoritativeFAMutation('matchOfferSheet', payload)
      → mutationPipeline.js:626 applyWorldMutation()
        → mutationPipeline.js:1049 loadStateForMutation() [loads homeTeam + offeringTeam]
        → mutationPipeline.js:1251 computeWorldMutation() → computeMatchOfferSheetResult()
        → mutationPipeline.js:2653 validateMutation() → validateOfferSheetResolution('match')
        → persistWorldMutation()
        → returns { success, changedTeams: [offeringTeam, homeTeam] }
    → syncTeamFromMutationResult()
```

**Evidence (computeMatchOfferSheetResult L3169-3247):**

```javascript
// Line 3189-3191: Validates status
if (existingSheet.status !== 'PENDING_MATCH') {
  return {
    success: false,
    error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
  };
}

// Line 3194-3198: Updates status to MATCHED
const updatedOfferSheet = {
  ...existingSheet,
  status: 'MATCHED',
  matchedAt: new Date(timestamp).toISOString(),
};

// Line 3213-3226: MIRRORS status update to home team
if (homeTeam && homeTeam.incomingOfferSheets) {
  const homeIndex = homeTeam.incomingOfferSheets.findIndex(
    (os) => os.id === offerSheetId
  );
  if (homeIndex !== -1) {
    updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
    teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
  }
}
```

### 2.3 Decline Offer Sheet

```
UI: OfferSheetList.jsx (incoming list, "Decline" button on PENDING_MATCH row)
  → onDecline(os.offeringTeamCode, os.id)
  → useArchitectActions.ts:1773 handleDeclineOfferSheet()
    → useArchitectActions.ts:1793 runAuthoritativeFAMutation('declineOfferSheet', payload)
      → mutationPipeline.js:626 applyWorldMutation()
        → mutationPipeline.js:1050 loadStateForMutation() [loads homeTeam + offeringTeam]
        → mutationPipeline.js:1259 computeWorldMutation() → computeDeclineOfferSheetResult()
        → mutationPipeline.js:2672 validateMutation() → validateOfferSheetResolution('decline')
        → persistWorldMutation()
        → returns { success, changedTeams: [offeringTeam, homeTeam] }
    → syncTeamFromMutationResult()
```

**Evidence (computeDeclineOfferSheetResult L3252-3332):**

```javascript
// Line 3268-3272: Updates status to DECLINED
const updatedOfferSheet = {
  ...existingSheet,
  status: 'DECLINED',
  declinedAt: new Date(timestamp).toISOString(),
};

// Line 3287-3300: MIRRORS status update to home team (same pattern as Match)
```

### 2.4 Finalize Match (Home Team Keeps Player)

```
UI: OfferSheetList.jsx (incoming list, "Finalize Match" button on MATCHED row)
  → onFinalize(offerSheet)
  → useArchitectActions.ts:1812 handleFinalizeOfferSheet()
    → [status === 'MATCHED' && homeTeamCode === teamCode] branch
    → useArchitectActions.ts:1843 runAuthoritativeFAMutation('finalizeMatchedOfferSheet', payload)
      → mutationPipeline.js:626 applyWorldMutation()
        → mutationPipeline.js:1051 loadStateForMutation() [loads homeTeam + offeringTeam]
        → mutationPipeline.js:1267 computeWorldMutation() → computeFinalizeMatchedOfferSheetResult()
        → mutationPipeline.js:2715 validateMutation() → validateOfferSheetResolution('finalize')
        → persistWorldMutation()
        → returns { success, changedTeams: [homeTeam, offeringTeam] }
    → syncTeamFromMutationResult()
```

**Evidence (computeFinalizeMatchedOfferSheetResult L3335-3445):**

```javascript
// Line 3363-3366: Remove offer sheet from home team
updatedHomeTeam.incomingOfferSheets = incomingOfferSheets.filter(
  (os) => os.id !== offerSheetId
);

// Line 3390-3401: Apply contract to player on home team
updatedPlayer.contract = newContract;
updatedHomeTeam.players = [
  ...updatedHomeTeam.players.slice(0, playerIndex),
  updatedPlayer,
  ...updatedHomeTeam.players.slice(playerIndex + 1),
];

// Line 3409-3412: RECOMPUTE TOTALS for home team
updatedHomeTeam.totals = computeTeamCapTotals(
  updatedHomeTeam,
  toEndYear(seasonId)
);

// Line 3419-3422: Remove from offering team's offerSheets (cleanup)
updatedOfferingTeam.offerSheets = (
  updatedOfferingTeam.offerSheets || []
).filter((os) => os.id !== offerSheetId);
```

### 2.5 Finalize Declined (Offering Team Gets Player)

```
UI: OfferSheetList.jsx (outgoing list, "Finalize Signing" button on DECLINED row)
  → onFinalize(offerSheet)
  → useArchitectActions.ts:1812 handleFinalizeOfferSheet()
    → [status === 'DECLINED' && offeringTeamCode === teamCode] branch
    → useArchitectActions.ts:1865 runAuthoritativeFAMutation('finalizeDeclinedOfferSheet', payload)
      → mutationPipeline.js:626 applyWorldMutation()
        → mutationPipeline.js:1052 loadStateForMutation() [loads homeTeam + offeringTeam]
        → mutationPipeline.js:1275 computeWorldMutation() → computeFinalizeDeclinedOfferSheetResult()
        → mutationPipeline.js:2715 validateMutation() → validateOfferSheetResolution('finalize')
        → persistWorldMutation()
        → returns { success, changedTeams: [offeringTeam, homeTeam] }
    → syncTeamFromMutationResult()
```

**Evidence (computeFinalizeDeclinedOfferSheetResult L3447-3615):**

```javascript
// Line 3492-3495: Remove offer sheet from offering team
updatedOfferingTeam.offerSheets = offerSheets.filter(
  (os) => os.id !== offerSheetId && (!dedupKey || os.dedupKey !== dedupKey)
);

// Line 3523-3534: Add player to offering team roster with contract
if (playerIndex !== -1) {
  updatedOfferingTeam.players[playerIndex] = { ...player, contract: newContract, teamCode };
} else {
  updatedOfferingTeam.players = [...players, newPlayer];
}

// Line 3544-3547: RECOMPUTE TOTALS for offering team
updatedOfferingTeam.totals = computeTeamCapTotals(
  updatedOfferingTeam,
  toEndYear(seasonId)
);

// Line 3559-3563: Remove offer sheet from home team
updatedHomeTeam.incomingOfferSheets = (
  updatedHomeTeam.incomingOfferSheets || []
).filter((os) => os.id !== offerSheetId && ...);

// Line 3568-3577: Remove player from home team roster
updatedHomeTeam.roster = updatedHomeTeam.roster.filter(id => id !== playerId);
updatedHomeTeam.players = updatedHomeTeam.players.filter(p => (p.player_id || p.id) !== playerId);

// Line 3582-3585: RECOMPUTE TOTALS for home team
updatedHomeTeam.totals = computeTeamCapTotals(
  updatedHomeTeam,
  toEndYear(seasonId)
);
```

---

## 3. Two-Team State Update Proof

### 3.1 Pipeline State Loading

All offer sheet mutations load both teams via `loadStateForMutation()`:

**Evidence (mutationPipeline.js L1049-1067):**

```javascript
case 'matchOfferSheet':
case 'declineOfferSheet':
case 'finalizeMatchedOfferSheet':
case 'finalizeDeclinedOfferSheet': {
  const { teamCode: homeTeamCode, offeringTeamCode, offerSheetId } = payload;

  const [homeTeam, offeringTeam] = await Promise.all([
    getTeam(worldId, homeTeamCode),
    getTeam(worldId, offeringTeamCode),
  ]);

  return { homeTeam, offeringTeam, offerSheetId };
}
```

### 3.2 Two-Team Return Contract

Every offer sheet compute function returns `teamUpdates` array containing both teams:

| Mutation Type                | Teams in `teamUpdates`                             |
| ---------------------------- | -------------------------------------------------- |
| `storeOfferSheet`            | `[{teamCode: offeringTeam}, {teamCode: homeTeam}]` |
| `matchOfferSheet`            | `[{teamCode: offeringTeam}, {teamCode: homeTeam}]` |
| `declineOfferSheet`          | `[{teamCode: offeringTeam}, {teamCode: homeTeam}]` |
| `finalizeMatchedOfferSheet`  | `[{teamCode: homeTeam}, {teamCode: offeringTeam}]` |
| `finalizeDeclinedOfferSheet` | `[{teamCode: offeringTeam}, {teamCode: homeTeam}]` |

### 3.3 Persistence Proof

Both teams are persisted in `persistWorldMutation()`:

**Evidence (mutationPipeline.js L883-924):**

```javascript
// Write team updates
if (computeResult.teamUpdates?.length > 0) {
  for (const update of computeResult.teamUpdates) {
    const teamDocRef = doc(
      db,
      `architect_worlds/${worldId}/teams`,
      update.teamCode
    );
    await setDoc(teamDocRef, update.team, { merge: true });
  }
}
```

### 3.4 UI State Sync

Current team is synced immediately via `syncTeamFromMutationResult`:

**Evidence (useArchitectActions.ts L768-794):**

```typescript
const syncTeamFromMutationResult = useCallback(
  async (mutationType: string, result: any): Promise<void> => {
    const changedTeams = Array.isArray(result?.changedTeams)
      ? result.changedTeams
      : [];
    const currentTeamUpdate = changedTeams.find(
      (update: any) => update?.teamCode === teamCode && update?.team
    );

    if (currentTeamUpdate?.team) {
      setTeamCapSheet(currentTeamUpdate.team as CapSheet);
    } else if (worldId) {
      const refreshedTeam = await loadWorldTeamData(worldId, teamCode);
      if (refreshedTeam) {
        setTeamCapSheet(refreshedTeam as CapSheet);
      }
    }

    await refreshWorldRosterIndex();
  },
  [refreshWorldRosterIndex, setTeamCapSheet, teamCode, worldId]
);
```

**Note:** The other affected team is correctly persisted to Firestore but not immediately synced to any open UI. This is expected architecture — switching teams or refreshing will load the updated state.

---

## 4. Totals Proof

### 4.1 Totals Recompute by Stage

| Stage             | Home Team Totals      | Offering Team Totals  | Rationale                                                            |
| ----------------- | --------------------- | --------------------- | -------------------------------------------------------------------- |
| Store             | ❌ None               | ❌ None               | Offer sheet is pending; no cap impact yet                            |
| Match             | ❌ None               | ❌ None               | Status change only; no player movement                               |
| Decline           | ❌ None               | ❌ None               | Status change only; no player movement                               |
| Finalize Match    | ✅ Recomputed (L3409) | ❌ None               | Home team applies contract; offering team only removes pending offer |
| Finalize Declined | ✅ Recomputed (L3582) | ✅ Recomputed (L3544) | Player moves from home → offering; both caps affected                |

### 4.2 Totals Compute Function

All totals are computed via `computeTeamCapTotals()`:

**Evidence (mutationPipeline.js L89):**

```javascript
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
```

### 4.3 UI Totals Derivation

Cap Sheet UI derives totals from SSOT:

**Evidence (CapSheet.jsx L54-58):**

```javascript
const calculatedTotals = useMemo(
  () => computeTeamCapTotals(teamCapSheet, selectedYear),
  [teamCapSheet, selectedYear]
);
```

This ensures consistent totals whether accessed immediately after mutation sync or on subsequent navigation.

---

## 5. Failure UX Proof

### 5.1 Authoritative Pipeline Error Path

**Evidence (useArchitectActions.ts L831-847):**

```typescript
if (!result.success) {
  const message = result.error || `Failed to run ${mutationType} mutation.`;
  reportMutationError(message, { mutationType, payload, result });
  finishSave(message);
  return result;
}
```

### 5.2 Modal Error Handling

**Evidence (EditContractModal.jsx L813-823):**

```jsx
const normalizedResult = normalizeActionResult(actionResult);
if (normalizedResult.success) {
  onClose(); // Close modal on success ONLY
  return;
}

setSaveError(
  normalizedResult.message ||
    'Action was not completed. Review details and try again.'
);
// Modal stays OPEN on failure - shows error in UI
```

### 5.3 Validation Layer

**Evidence (capLegalityValidation.js L3819-3899):**

```javascript
export function validateOfferSheetResolution({
  offerSheet,
  actingTeamCode,
  action,
  asOfDate,
}) {
  const violations = [];

  // Offering team cannot finalize MATCHED sheet
  if (action === 'finalize' && actingTeamCode === offeringTeamCode) {
    if (status === 'MATCHED') {
      violations.push({
        rule: 'rfa_offer_sheet_matched_offering_team_cannot_finalize',
        message:
          'Offer sheet has been MATCHED by home team. The player stays with home team.',
        severity: 'error',
      });
    }
  }

  // Home team cannot finalize DECLINED sheet
  if (action === 'finalize' && actingTeamCode === homeTeamCode) {
    if (status === 'DECLINED') {
      violations.push({
        rule: 'rfa_offer_sheet_declined_home_team_cannot_finalize',
        message:
          'Offer sheet has been DECLINED. The player goes to the offering team.',
        severity: 'error',
      });
    }
  }

  // Only home team can Match/Decline
  if (action === 'match' || action === 'decline') {
    if (actingTeamCode !== homeTeamCode) {
      violations.push({
        rule: 'rfa_offer_sheet_resolution_required',
        message: 'Only the home team can Match or Decline an offer sheet.',
        severity: 'error',
      });
    }
  }

  return { valid: violations.length === 0, violations, warnings };
}
```

---

## 6. Ranked Gaps List

### P0 (Critical / Ship-blocker)

**None identified.**

### P1 (High / Should fix before GA)

**None identified.**

### P2 (Low / Note for future)

| ID       | Gap                      | Description                                                                                                                                                            | Minimal Repro                                                                                                                                   |
| -------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-GAP-1 | Non-current team UI sync | When Team A sends offer to Team B, Team B's UI is not immediately synced (only persisted). If user has Team B open in another tab, they see stale state until refresh. | 1. Open LAL dashboard. 2. Send offer sheet to player on BOS. 3. Open BOS dashboard (same session). 4. Incoming list may be stale until refresh. |

**Mitigation:** This is expected single-team-context architecture. Each team context manages its own state. Cross-team live sync would require additional subscription infrastructure.

---

## 7. Stop Condition Report

| #   | Stop Condition                                             | Status  | Evidence                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cannot trace lifecycle step to mutation type + persistence | ✅ PASS | All 5 mutation types traced: `storeOfferSheet`, `matchOfferSheet`, `declineOfferSheet`, `finalizeMatchedOfferSheet`, `finalizeDeclinedOfferSheet`. All route through `applyWorldMutation` → `persistWorldMutation`.              |
| 2   | Finalize step changes UI but has no persist/sync           | ✅ PASS | Both finalize mutations return `teamUpdates` for both teams, persisted via `setDoc()` calls, and current team synced via `syncTeamFromMutationResult`.                                                                           |
| 3   | Totals do not recompute for affected team                  | ✅ PASS | `computeTeamCapTotals()` called at L3409 (finalize match, home), L3544 (finalize declined, offering), L3582 (finalize declined, home).                                                                                           |
| 4   | Illegal status transitions allowed without failure         | ✅ PASS | `validateOfferSheetResolution()` enforces: PENDING_MATCH required for match/decline; MATCHED required for home finalize; DECLINED required for offering finalize. Tests exist at `tests/architect/offerSheetResolution.test.js`. |

---

## 8. Commands Run (PREFLIGHT Discovery Only)

| Command Type | Commands Executed                                                         |
| ------------ | ------------------------------------------------------------------------- |
| Search       | `grep_search` for mutation types, offer sheet props, validation functions |
| Read         | `read_file` for handlers, compute functions, validation layer             |
| Discovery    | `file_search` for test files, component structure                         |

**Commands Intentionally Skipped:**

- `npm run dev` — not needed for code-trace discovery
- `npm run build` — not needed for docs-only output
- `npm run test:*` — not needed for PREFLIGHT mode (read-only)
- `npm run validate:project` — not needed for docs-only output

---

## 9. Files Changed

| File                                                                       | Change Type | Description                                                          |
| -------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `return_packages/architect/TM_OFFER_SHEETS_P1_PREFLIGHT_RETURN_PACKAGE.md` | **NEW**     | This preflight return package                                        |
| `docs/architect/FREE_AGENCY_MASTER.md`                                     | **UPDATED** | Added "Offer Sheet Lifecycle — Call Graph + Invariants (P1)" section |

---

## 10. Confirmation

- [x] Full call-graph trace for all 5 lifecycle stages
- [x] Two-Team State Update Proof with evidence snippets
- [x] Totals Proof showing recompute locations
- [x] Ranked gaps list (0 P0, 0 P1, 1 P2)
- [x] Stop condition report table (all PASS)
- [x] No stop conditions triggered
- [x] Master doc updated with lifecycle invariants

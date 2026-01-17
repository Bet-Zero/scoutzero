# RETURN PACKAGE: CAP RULES PROVENANCE + STRICT DATA CONFIDENCE

**DATE**: 2026-01-17
**STATUS**: COMPLETE

## 1. What Changed

- **CapRulesProfile API**: Added `_meta` field containing `sourcesSummary` (real/reported/projected) and granular source tags.
- **SSOT (TeamCapTotals)**: Exposed `rulesSourcesSummary` and `rulesSources` in the totals object via `_meta`.
- **Validation**: Introduced `evaluateDataConfidence` helper.
  - **STRICT Mode**: Hard blocks operations on projected data.
  - **WARN Mode**: Emits warnings for projected data.
- **UI**: Cap Sheet header now displays a confidence label ("Official", "Reported", "Projected").
- **Documentation**: Updated master docs with new "No Silent Invention" policy.

## 2. Files Created/Modified

| File | Purpose |
|------|---------|
| `src/features/architect/utils/capRulesProfile/capRulesProfile.ts` | Added `SourceTag`, `CapRulesMeta`, and provenance logic. |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | Threaded `_meta` from rules to totals. |
| `src/features/architect/utils/capLegalityValidation.js` | Added `evaluateDataConfidence` and integration points. |
| `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | Added visual confidence label. |
| `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js` | Updated `normalizeCapEntry` to preserve `rookieMinSource`. |
| `src/tests/architect/utils/capRulesProfile.test.ts` | Updated tests to verify provenance and reduce brittleness. |
| `docs/architect/CAP_RULES_PROFILE_MASTER_DOC.md` | Updated API definition with `_meta`. |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added strict data confidence policy. |

## 3. Final CapRulesProfile Interface (Excerpt)

```typescript
export interface CapRulesProfile {
  // ... (cap, exceptions, salaries)
  _meta?: {
    source: string; // 'CapRulesProfile'
    resolved: boolean;
    projectionMethod?: string;
    sourcesSummary: 'real' | 'reported' | 'projected' | 'unknown';
    sources: {
      cap: Record<keyof CapLines, SourceTag>;
      exceptions: Record<keyof ExceptionAmounts, SourceTag>;
      salaries: { rookieMin: SourceTag };
    };
  };
}
```

## 4. Final TeamCapTotals._meta Example

```javascript
{
  source: 'computeTeamCapTotals',
  rulesSource: 'CapRulesProfile',
  rulesSourcesSummary: 'real', // or 'projected'
  rulesSources: { ... },       // granular map
  capSettingsSource: 'via_facade',
  seasonKey: '2024-25'
}
```

## 5. STRICT vs WARN Behavior

**Configuration**: Controlled via `VITE_CAP_DATA_CONFIDENCE` environment variable (default: WARN).

- **STRICT Mode** (`VITE_CAP_DATA_CONFIDENCE=STRICT`):
  - **Behavior**: Blocking error (`unverified_cap_inputs`).
  - **Message**: "Operation blocked: Cap rules are PROJECTED (Strict Mode). Cannot validate legality against projected data."

- **WARN Mode** (Default):
  - **Behavior**: Warning message.
  - **Message**: "Operation using PROJECTED cap data. Validation reliability is lower."

## 6. Tests Run

`npx vitest src/tests/architect/utils/capRulesProfile.test.ts`

- **Result**: 5 passed.
- **Coverage**: Verified `rookieMinSource` correctness for 2024 (real), 2025 (real), and 2027 (projected).

## 7. Build Results

`npm run build`

- **Result**: Success (Exit code 0).

## 8. Doc Updates

- **CAP_RULES_PROFILE_MASTER_DOC.md**: Added `_meta` API definition and provenance fields.
- **CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md**: Added `unverified_cap_inputs` to hard block rules list and documented strict mode policy.

## 9. Follow-ups

- **UI Tiles**: Consider adding confidence indicators to `CapImpactTiles.jsx` (currently optional).
- **Environment**: Ensure `VITE_CAP_DATA_CONFIDENCE` is set in CI/CD pipelines as needed.

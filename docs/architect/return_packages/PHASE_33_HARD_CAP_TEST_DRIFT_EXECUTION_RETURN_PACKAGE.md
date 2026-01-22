# PHASE 33 — Hard Cap Test Drift Execution Return Package

**DATE:** 2026-01-23  
**PHASE:** 33 — TradeValidator Hard Cap Test Drift Fix  
**STATUS:** ✅ COMPLETE  
**MASTER DOC:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## Summary

Fixed test drift in `tests/tradeValidator.test.js` where the hard cap test was failing because it asserted against `violations[0]` which contained a salary matching violation (due to collection order), not the hard cap violation.

**Root Cause:** Both `validateSalaryMatching` and `validateHardCap` emit violations for this scenario. The violations array collects them in object key order, placing salary matching first.

**Fix:** Changed assertion to use rule-scoped `rules.hardCap.violations` instead of `violations[0]`, making the test resilient to rule evaluation order.

---

## Files Changed

| File                                                          | Change                                        |
| ------------------------------------------------------------- | --------------------------------------------- |
| `tests/tradeValidator.test.js`                                | Updated hard cap test assertion (lines 68-76) |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 33 changelog entry                |

---

## Diff: Test Change

### Before

```javascript
expect(result.legal).toBe(false);
expect(result.teamResults[0].legal).toBe(false);
expect(result.teamResults[0].violations[0]).toContain(
  '1st Apron hard cap violation'
);
expect(result.teamResults[0].rules.hardCap.passed).toBe(false);
```

### After

```javascript
expect(result.legal).toBe(false);
expect(result.teamResults[0].legal).toBe(false);
// Assert against rule-scoped violations (not violations[0]) to avoid order dependency
expect(result.teamResults[0].rules.hardCap.passed).toBe(false);
expect(result.teamResults[0].rules.hardCap.violations).toEqual(
  expect.arrayContaining([
    expect.stringContaining('1st Apron hard cap violation'),
  ])
);
```

---

## Updated Test Block (Complete)

```javascript
it('flags trades that would violate a hard cap', () => {
  // Team A is at first apron level (180M) and hard-capped
  // First apron is 179M for 2024-25, so 180M is above first apron but below second apron (190M)
  const teamA = makeTeam('A', 180_000_000);
  const teamB = makeTeam('B', 150_000_000);
  const incoming = makePlayer('Bstar', 10_000_000);
  teamB.players.push(incoming);

  const result = validateTrade({
    teams: [
      { team: teamA, sends: [], picksOut: [], hardCapped: true },
      { team: teamB, sends: [incoming], picksOut: [] },
    ],
    capProjections,
    currentYear,
  });

  expect(result.legal).toBe(false);
  expect(result.teamResults[0].legal).toBe(false);
  // Assert against rule-scoped violations (not violations[0]) to avoid order dependency
  expect(result.teamResults[0].rules.hardCap.passed).toBe(false);
  expect(result.teamResults[0].rules.hardCap.violations).toEqual(
    expect.arrayContaining([
      expect.stringContaining('1st Apron hard cap violation'),
    ])
  );
});
```

---

## Test Output

```
 ✓ tests/tradeValidator.test.js (14) 338ms
   ✓ tradeValidator (14) 337ms
     ✓ enforces salary matching when a team is over the cap
     ✓ flags trades that would violate a hard cap
     ✓ enforces sign-and-trade restrictions
     ✓ allows valid sign-and-trade deals
     ✓ blocks sign-and-trade hard cap violations
     ✓ requires sign-and-trade contracts to be 3-4 years
     ✓ detects Stepien Rule violations
     ✓ allows protected picks to bypass Stepien Rule
     ✓ enforces second apron restrictions
     ✓ prevents second apron teams from taking back more salary
     ✓ blocks cash considerations for second apron teams
     ✓ restricts trading picks more than 7 years out
     ✓ handles 3-team trades correctly
     ✓ provides summary and financial deltas

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  6.26s
```

---

## Acceptance Criteria

- [x] `tests/tradeValidator.test.js` passes (14/14 tests)
- [x] Assertion no longer depends on `violations[0]` ordering
- [x] Uses `rules.hardCap.violations` for rule-scoped assertion
- [x] Master Doc updated with Phase 33 entry
- [x] Return package saved in `docs/architect/return_packages/`
- [x] Debug files cleaned up

---

## Notes

### Secondary Issue Identified (Not Fixed)

During preflight, a spurious third violation was observed: `'Second apron team cannot receive more salary than sent'`. This incorrectly fires when Team A (at $180M) has a post-trade salary of $190M (which equals the second apron threshold). This is a boundary condition bug where the check treats "at threshold" as "above threshold".

**Recommendation:** Track as separate issue for future fix. Does not affect this phase's scope.

---

## Return Package Complete

**Execution Time:** ~5 minutes  
**Risk Realized:** None  
**Production Code Changed:** None (test-only)

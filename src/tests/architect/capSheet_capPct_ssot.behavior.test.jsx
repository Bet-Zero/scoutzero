/**
 * FILE: src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx
 * PURPOSE: Verify cap % denominator uses canonicalTotals.salaryCap (SSOT), not deprecated capProjections.
 * OWNERSHIP: Feature: architect/cap-sheet (E2)
 *
 * HISTORY:
 *  - 2026-02-28: Created for TM_CAP_SHEET_E2 Task A verification
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Cap Sheet Cap % Denominator SSOT Guardrail (E2)', () => {
  const capSheetPath = path.resolve(
    __dirname,
    '../../features/architect/capSheet/CapSheet/CapSheet.tsx'
  );

  it('does not import capProjections (deprecated for cap % denominator)', () => {
    const content = fs.readFileSync(capSheetPath, 'utf-8');

    // Verify capProjections is NOT imported
    const importMatches = content.match(/import\s+capProjections\s+from/);
    expect(importMatches).toBeNull();
  });

  it('uses canonicalTotals.salaryCap for cap percentage calculation, not capProjections', () => {
    const content = fs.readFileSync(capSheetPath, 'utf-8');

    // Verify getCapPercentage is called with canonicalTotals.salaryCap
    const usesCanonicalTotalsSalaryCap = content.includes(
      'getCapPercentage(capHit, canonicalTotals.salaryCap'
    );
    expect(usesCanonicalTotalsSalaryCap).toBe(true);

    // Verify it does NOT use capProjections[yearKey] for salaryCap
    const usesCapProjectionsSalaryCap = content.includes(
      'capProjections[yearKey]?.cap'
    );
    expect(usesCapProjectionsSalaryCap).toBe(false);
  });

  it('has removed yearKey variable used for capProjections lookup', () => {
    const content = fs.readFileSync(capSheetPath, 'utf-8');

    // The yearKey at top-level (for capProjections) should be removed
    // Only function-parameter yearKey (in getCapHit, renderNotes) should exist
    const topLevelYearKeyAssignment = content.match(
      /const yearKey = \`\$\{selectedYear/
    );
    expect(topLevelYearKeyAssignment).toBeNull();
  });
});

/**
 * FILE: src/tests/architect/capSheet_closure.gate.test.ts
 * PURPOSE: Closure permanence gates for Cap Sheet page (E1/E2 fixes).
 * OWNERSHIP: Feature: architect/cap-sheet (E3)
 *
 * HISTORY:
 *  - 2026-02-28: Created for TM_CAP_SHEET_E3 Task A — permanent regression gates
 *
 * GATES:
 *  1. Cap % denominator uses SSOT canonicalTotals.salaryCap (no capProjections)
 *  2. CapSummaryTiles consumes parent-supplied canonical totals
 *  3. DPE not exposed in Cap Sheet Exceptions UI
 *  4. ExceptionTracker reads canonical exceptions first and does not own totals
 *  5. TPE expiry display uses canonical normalized fields
 *  6. Modal save does not close-before-confirm
 *  7. World failure toast dedupe logic exists
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// === FILE PATH CONSTANTS ===

const CAP_SHEET_PATH = path.resolve(
  __dirname,
  '../../features/architect/capSheet/CapSheet/CapSheet.tsx'
);

const CAP_SUMMARY_TILES_PATH = path.resolve(
  __dirname,
  '../../features/architect/capSheet/CapSheet/CapSummaryTiles.tsx'
);

const EXCEPTION_TRACKER_PATH = path.resolve(
  __dirname,
  '../../features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx'
);

const MANAGE_EXCEPTIONS_MODAL_PATH = path.resolve(
  __dirname,
  '../../features/architect/capSheet/modals/ManageExceptionsModal.tsx'
);

const MANAGE_DEAD_MONEY_MODAL_PATH = path.resolve(
  __dirname,
  '../../features/architect/capSheet/modals/ManageDeadMoneyModal.tsx'
);

const USE_ARCHITECT_ACTIONS_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectActions.ts'
);

// === HELPER FUNCTIONS ===

/**
 * Read file contents with error handling
 */
const readFileContent = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Gate file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
};

// === GATE 1: Cap % uses canonicalTotals.salaryCap (SSOT) ===

describe('Gate 1: Cap % Denominator SSOT (E1/E2)', () => {
  const content = readFileContent(CAP_SHEET_PATH);

  it('imports getPlayerCapHitForYear from contractUtils for row cap-hit display', () => {
    const importsSharedCapHitHelper =
      /import[\s\S]*getPlayerCapHitForYear[\s\S]*from\s+['"]@\/features\/architect\/utils\/contractUtils['"]/.test(
        content
      );
    expect(importsSharedCapHitHelper).toBe(true);
  });

  it('does NOT import capProjections for cap % denominator', () => {
    // capProjections import should not exist for cap % calculation
    const importCapProjections = /import\s+capProjections\s+from/.test(content);
    expect(importCapProjections).toBe(false);
  });

  it('uses canonicalTotals.salaryCap (or equivalent SSOT) for cap percentage', () => {
    // The cap percentage call should reference canonicalTotals.salaryCap
    const usesCanonicalTotalsSalaryCapPattern =
      /getCapPercentage\s*\(\s*\w+\s*,\s*canonicalTotals\.salaryCap/.test(
        content
      );
    expect(usesCanonicalTotalsSalaryCapPattern).toBe(true);
  });

  it('does NOT use capProjections[yearKey]?.cap as cap % denominator', () => {
    // Legacy pattern that should not exist
    const usesCapProjectionsLegacy =
      /capProjections\s*\[\s*\w+\s*\]?\s*\?\s*\.cap/.test(content);
    expect(usesCapProjectionsLegacy).toBe(false);
  });

  it('does NOT define a local getCapHit helper in CapSheet', () => {
    const definesLocalGetCapHit = /const\s+getCapHit\s*=\s*\(/.test(content);
    expect(definesLocalGetCapHit).toBe(false);
  });

  it('uses getPlayerCapHitForYear for row cap-hit display', () => {
    const usesSharedCapHitHelper =
      /getPlayerCapHitForYear\s*\(\s*player\s*,\s*selectedYear\s*\)/.test(
        content
      );
    expect(usesSharedCapHitHelper).toBe(true);
  });
});

// === GATE 2: Cap Sheet canonical totals consumer structure ===

describe('Gate 2: CapSummaryTiles Canonical Totals Consumer (CS-1B)', () => {
  const capSheetContent = readFileContent(CAP_SHEET_PATH);
  const capSummaryTilesContent = readFileContent(CAP_SUMMARY_TILES_PATH);

  it('CapSheet computes canonicalTotals exactly once from computeTeamCapTotals at runtime', () => {
    const runtimeComputeCalls =
      capSheetContent.match(/computeTeamCapTotals\s*\(/g) || [];

    expect(runtimeComputeCalls).toHaveLength(1);
    expect(capSheetContent).toMatch(
      /const\s+canonicalTotals\s*=\s*React\.useMemo\s*\(\s*\(\)\s*=>\s*computeTeamCapTotals\s*\(/
    );
  });

  it('CapSheet passes parent-computed canonicalTotals into CapSummaryTiles', () => {
    const passesCanonicalTotals =
      /<CapSummaryTiles[\s\S]*canonicalTotals=\{canonicalTotals\}/.test(
        capSheetContent
      );
    expect(passesCanonicalTotals).toBe(true);
  });

  it('CapSheet keeps current-year breakdown and footer as direct canonicalTotals reads', () => {
    const canonicalTotalsFields = [
      'playersTotal',
      'deadMoneyTotal',
      'capHoldsTotal',
      'incompleteChargesTotal',
      'totalCapAllocations',
    ];

    for (const field of canonicalTotalsFields) {
      expect(capSheetContent).toMatch(
        new RegExp(`canonicalTotals\\.${field}`)
      );
    }
  });

  it('CapSummaryTiles accepts canonicalTotals and does NOT call computeTeamCapTotals locally', () => {
    expect(capSummaryTilesContent).toContain('canonicalTotals');
    expect(/computeTeamCapTotals\s*\(/.test(capSummaryTilesContent)).toBe(
      false
    );
  });

  it('CapSummaryTiles does NOT read teamCapSheet.totals as a competing totals source', () => {
    expect(capSummaryTilesContent).not.toMatch(
      /teamCapSheet\s*\??\.\s*totals/
    );
  });
});

// === GATE 3: DPE not exposed in Cap Sheet Exceptions UI ===

describe('Gate 3: DPE Not Exposed in Cap Sheet Exceptions UI (E1)', () => {
  it('ManageExceptionsModal does NOT include DPE in EXCEPTION_TYPES', () => {
    const content = readFileContent(MANAGE_EXCEPTIONS_MODAL_PATH);

    // Check EXCEPTION_TYPES array does not include 'dpe'
    // Pattern: EXCEPTION_TYPES = [...] should not contain 'dpe'
    const exceptionTypesMatch = content.match(
      /EXCEPTION_TYPES\s*=\s*\[([\s\S]*?)\]/
    );
    expect(exceptionTypesMatch).not.toBeNull();

    if (exceptionTypesMatch) {
      const typesContent = exceptionTypesMatch[1].toLowerCase();
      expect(typesContent).not.toContain("'dpe'");
      expect(typesContent).not.toContain('"dpe"');
    }
  });

  it('ExceptionTracker does NOT render DPE card/label', () => {
    const content = readFileContent(EXCEPTION_TRACKER_PATH);

    // Check that there is no DPE-specific card/label rendering
    // Pattern: label="DPE" or label="dpe" or DPE in exception cards
    const hasDpeLabel = /label\s*=\s*["'](?:DPE|dpe)["']/.test(content);
    expect(hasDpeLabel).toBe(false);

    // Also check for DPE normalization calls (should not exist for display)
    const normalizesDpeForDisplay =
      /normalizeExceptionForTracker\s*\(\s*teamCapSheet\s*,\s*['"]dpe['"]/.test(
        content
      );
    expect(normalizesDpeForDisplay).toBe(false);
  });
});

// === GATE 4: ExceptionTracker reads canonical exceptions first ===

describe('Gate 4: ExceptionTracker Canonical Exceptions Read-First (E1)', () => {
  const content = readFileContent(EXCEPTION_TRACKER_PATH);

  it('reads from teamCapSheet.exceptions (canonical) for MLE/TPMLE/BAE/ROOM', () => {
    // normalizeExceptionForTracker should check canonical first
    // Pattern: teamCapSheet?.exceptions?.[canonicalKey]
    const readsCanonicalExceptions =
      /teamCapSheet\s*\?\s*\.\s*exceptions\s*\?\s*\.\s*\[/.test(content);
    expect(readsCanonicalExceptions).toBe(true);
  });

  it('normalizeExceptionForTracker function exists with canonical priority', () => {
    // The normalizer should read canonicalEntry from teamCapSheet.exceptions
    const hasNormalizer = content.includes('normalizeExceptionForTracker');
    expect(hasNormalizer).toBe(true);

    // Should have canonical entry lookup: teamCapSheet?.exceptions?.[canonicalKey]
    const canonicalEntryPattern =
      /const\s+canonicalEntry\s*=\s*teamCapSheet\s*\?\s*\.\s*exceptions\s*\?\s*\.\s*\[\s*canonicalKey/.test(
        content
      );
    expect(canonicalEntryPattern).toBe(true);
  });

  it('has legacy fallback read (read-only fallback is ok)', () => {
    // Pattern: legacyEntry = teamCapSheet?.[legacyKey]
    // TS authority may cast through Record<string, unknown> before bracket access.
    const hasLegacyFallback =
      /const\s+legacyEntry\s*=\s*(?:\(\s*teamCapSheet\s+as\s+Record<string,\s*unknown>\s*\)|teamCapSheet)\s*\?\s*\.\s*\[\s*legacyKey/.test(
        content
      );
    expect(hasLegacyFallback).toBe(true);
  });

  it('uses canonical-then-legacy source selection', () => {
    // Pattern: sourceEntry = hasCanonicalEntry ? canonicalEntry : legacyEntry
    const hasSourceSelection =
      /sourceEntry\s*=\s*hasCanonicalEntry\s*\?\s*canonicalEntry\s*:\s*legacyEntry/.test(
        content
      );
    expect(hasSourceSelection).toBe(true);
  });

  it('uses the shared normalized exception default helper from capSettingsProvider', () => {
    expect(content).toContain('getExceptionDefaultAmountFromCapSettings');

    const helperCallCount =
      content.match(/getExceptionDefaultAmountFromCapSettings\s*\(/g)?.length || 0;
    expect(helperCallCount).toBeGreaterThanOrEqual(4);
  });

  it('consumes canUseRoomException for room availability without importing computeTeamCapTotals directly', () => {
    expect(content).toContain('canUseRoomException');
    expect(content).toMatch(/canUseRoomException\s*\(\s*teamCapSheet\s*,\s*currentYear/);
  });

  it('does NOT import or call computeTeamCapTotals', () => {
    const importsComputeTeamCapTotals =
      /(?:^|\n)\s*import\s*\{[^}]*\bcomputeTeamCapTotals\b[^}]*\}\s*from/m.test(
        content
      ) ||
      /import\s+computeTeamCapTotals\s+from/.test(content);
    expect(importsComputeTeamCapTotals).toBe(false);
    expect(/computeTeamCapTotals\s*\(/.test(content)).toBe(false);
  });
});

describe('Gate 4B: ManageExceptionsModal Shared Exception Default Contract (CS-4A)', () => {
  const content = readFileContent(MANAGE_EXCEPTIONS_MODAL_PATH);

  it('imports and calls the shared normalized exception default helper', () => {
    expect(content).toContain('getExceptionDefaultAmountFromCapSettings');

    const helperCallCount =
      content.match(/getExceptionDefaultAmountFromCapSettings\s*\(/g)?.length || 0;
    expect(helperCallCount).toBeGreaterThanOrEqual(3);
  });

  it('does NOT keep a modal-local default amount resolver', () => {
    expect(content).not.toContain('getDefaultTotalAmount');
  });

  it('does NOT reference stale legacy cap-settings keys for MLE/TPMLE defaults', () => {
    expect(content).not.toContain('nonTaxMLE');
    expect(content).not.toContain('taxMLE');
    expect(content).not.toMatch(/capSettings\.(?:mle|tpmle|room)\b/);
  });
});

// === GATE 5: TPE expiry display uses canonical normalized fields ===

describe('Gate 5: TPE Expiry Canonical Fields (E1)', () => {
  const content = readFileContent(EXCEPTION_TRACKER_PATH);

  it('TPE expiry display prefers expiresOn and/or expirationDate', () => {
    // Pattern: tpe.expiresOn || tpe.expirationDate || tpe.expires
    // Should have canonical fields (expiresOn, expirationDate) before legacy (expires)
    const expiryDisplayPattern =
      /tpe\s*\.\s*expiresOn\s*\|\|\s*tpe\s*\.\s*expirationDate\s*\|\|\s*tpe\s*\.\s*expires/.test(
        content
      );
    expect(expiryDisplayPattern).toBe(true);
  });

  it('does NOT rely solely on tpe.expires without canonical fallback', () => {
    // There should not be a pattern like: const expiry = tpe.expires;
    // without also checking expiresOn/expirationDate first
    const soloExpiresPattern =
      /(?:const|let|var)\s+\w*[Ee]xpir\w*\s*=\s*tpe\s*\.\s*expires\s*[;,]/.test(
        content
      );

    // If we find a solo expires assignment, verify it's part of a fallback chain
    if (soloExpiresPattern) {
      // If solo pattern exists, the file should still have the canonical fallback chain
      const hasCanonicalChain =
        /expiresOn\s*\|\|\s*expirationDate/.test(content) ||
        /expirationDate\s*\|\|\s*expiresOn/.test(content);
      expect(hasCanonicalChain).toBe(true);
    }
  });

  it('CompactTradeExceptionRow renders expiry from normalized fields', () => {
    // The row component should use the normalized expiry display
    const hasExpiryDisplay =
      /expiryDisplay\s*=[\s\S]*?expiresOn[\s\S]*?expirationDate/.test(content);
    expect(hasExpiryDisplay).toBe(true);
  });
});

// === GATE 6: Modal save does not close-before-confirm ===

describe('Gate 6: Modal Save Close-After-Confirm (E1)', () => {
  describe('ManageExceptionsModal', () => {
    const content = readFileContent(MANAGE_EXCEPTIONS_MODAL_PATH);

    it('awaits onSave promise before closing', () => {
      // Pattern: await onSave(...) followed by conditional close
      const hasAwaitOnSave = /await\s+onSave\s*\(/.test(content);
      expect(hasAwaitOnSave).toBe(true);
    });

    it('closes only on success (not unconditionally)', () => {
      // handleSave should check result before calling onClose
      // Pattern: if (saveResult === false) { ... return; } ... onClose();
      // Or: try { await onSave(); onClose(); } catch { setSaveError(...); }
      const hasConditionalClose =
        /saveResult\s*===\s*false[\s\S]*?return[\s\S]*?onClose\s*\(/.test(
          content
        ) ||
        /try\s*\{[\s\S]*?await\s+onSave[\s\S]*?onClose[\s\S]*?\}\s*catch[\s\S]*?setSaveError/.test(
          content
        );
      expect(hasConditionalClose).toBe(true);
    });

    it('has inline error surface for failure', () => {
      // Pattern: role="alert" or saveError display block
      const hasErrorSurface =
        /role\s*=\s*["']alert["']/.test(content) ||
        /saveError\s*&&[\s\S]*?<div/.test(content) ||
        /{saveError\s*&&/.test(content);
      expect(hasErrorSurface).toBe(true);
    });
  });

  describe('ManageDeadMoneyModal', () => {
    const content = readFileContent(MANAGE_DEAD_MONEY_MODAL_PATH);

    it('awaits onSave promise before closing', () => {
      // Pattern: await onSave(...) followed by conditional close
      const hasAwaitOnSave = /await\s+onSave\s*\(/.test(content);
      expect(hasAwaitOnSave).toBe(true);
    });

    it('closes only on success (not unconditionally)', () => {
      // handleSave should check result before calling onClose
      const hasConditionalClose =
        /saveResult\s*===\s*false[\s\S]*?return[\s\S]*?onClose\s*\(/.test(
          content
        ) ||
        /try\s*\{[\s\S]*?await\s+onSave[\s\S]*?onClose[\s\S]*?\}\s*catch[\s\S]*?setSaveError/.test(
          content
        );
      expect(hasConditionalClose).toBe(true);
    });

    it('has inline error surface for failure', () => {
      // Pattern: role="alert" or saveError display block
      const hasErrorSurface =
        /role\s*=\s*["']alert["']/.test(content) ||
        /saveError\s*&&[\s\S]*?<div/.test(content) ||
        /{saveError\s*&&/.test(content);
      expect(hasErrorSurface).toBe(true);
    });
  });
});

// === GATE 7: World failure toast dedupe logic exists ===

describe('Gate 7: World Failure Toast Dedupe (E2)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('persistMutation helper exists', () => {
    const hasPersistMutation = /const\s+persistMutation\s*=\s*useCallback/.test(
      content
    );
    expect(hasPersistMutation).toBe(true);
  });

  it('has explicit guard for toast dedupe when onFailure callback exists', () => {
    // Pattern: if (!options.onFailure) toast.error(...)
    // This guard prevents double-toasting when caller handles error via callback
    const hasDedupeGuard =
      /if\s*\(\s*!\s*options\s*\.?\s*onFailure\s*\)[\s\S]*?toast\s*\.\s*error/.test(
        content
      );
    expect(hasDedupeGuard).toBe(true);
  });

  it('onFailure callback receives error details before any internal toast', () => {
    // Pattern: options.onFailure?.(...) should be called
    const callsOnFailure = /options\s*\.\s*onFailure\s*\?\s*\.\s*\(/.test(
      content
    );
    expect(callsOnFailure).toBe(true);
  });

  it('E2 fix comment documents dedupe behavior', () => {
    // The fix should have a comment explaining the dedupe logic
    const hasDedupeComment =
      /E2\s+fix.*Skip\s+toast\s+when\s+onFailure\s+callback\s+handles/i.test(
        content
      );
    expect(hasDedupeComment).toBe(true);
  });
});

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
 *  8. Manual Cap Sheet save authority remains routed through audited owner
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

const EDIT_CONTRACT_MODAL_PATH = path.resolve(
  __dirname,
  '../../shared/components/EditContractModal.tsx'
);

const CAP_SHEET_SECTION_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/sections/CapSheetSection.tsx'
);

const GM_DASHBOARD_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/GMDashboard.tsx'
);

const USE_ARCHITECT_ACTIONS_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectActions.ts'
);

const MUTATION_PIPELINE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/mutationPipeline.ts'
);

const CAP_LEGALITY_VALIDATION_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation.ts'
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

const readRegion = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Could not extract region from ${start} to ${end}`);
  }
  return source.slice(startIndex, endIndex);
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

  it('CapSheet passes currentYear into CapSummaryTiles so hard-cap truth can be year-gated', () => {
    expect(capSheetContent).toMatch(
      /<CapSummaryTiles[\s\S]*currentYear=\{currentYear\}/
    );
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

  it('CapSummaryTiles routes hard-cap badge display through getHardCapStatus', () => {
    expect(capSummaryTilesContent).toContain('getHardCapStatus');
    expect(capSummaryTilesContent).toContain('hardCapCeilingType');
    expect(capSummaryTilesContent).toContain('hardCapCeilingLabel');
    expect(capSummaryTilesContent).toContain(
      'const showCurrentYearHardCapTruth = selectedYear === currentYear;'
    );
    expect(capSummaryTilesContent).not.toContain('isHardCappedAtFirstApron');
    expect(capSummaryTilesContent).not.toContain('getFirstApronHardCapReason');
  });
});

describe('Gate 2B: Cap Tab Year Coherence (Closeout)', () => {
  const capSheetSectionContent = readFileContent(CAP_SHEET_SECTION_PATH);
  const capSummaryTilesContent = readFileContent(CAP_SUMMARY_TILES_PATH);
  const capSheetContent = readFileContent(CAP_SHEET_PATH);
  const exceptionTrackerContent = readFileContent(EXCEPTION_TRACKER_PATH);

  it('CapSheetSection owns selectedYear and passes one shared value to CapSheet and ExceptionTracker', () => {
    expect(capSheetSectionContent).toMatch(
      /const\s+\[selectedYear,\s*setSelectedYear\]\s*=\s*useState\(currentYear\)/
    );
    expect(capSheetSectionContent).toMatch(
      /<CapSheet[\s\S]*selectedYear=\{selectedYear\}[\s\S]*onSelectedYearChange=\{setSelectedYear\}/
    );
    expect(capSheetSectionContent).toMatch(
      /<ExceptionTracker[\s\S]*selectedYear=\{selectedYear\}/
    );
  });

  it('CapSummaryTiles explicitly fences hard-cap truth to the current season', () => {
    expect(capSummaryTilesContent).toContain(
      'const showCurrentYearHardCapTruth = selectedYear === currentYear;'
    );
    expect(capSummaryTilesContent).toMatch(
      /showCurrentYearHardCapTruth\s*&&[\s\S]*hardCapStatus\.isHardCapped/
    );
  });

  it('ExceptionTracker renders an explicit future-year boundary panel instead of mixed-year hard-cap or exception truth', () => {
    expect(exceptionTrackerContent).toContain(
      'cap-sheet-future-year-boundary-panel'
    );
    expect(exceptionTrackerContent).toContain('selectedYear = currentYear');
    expect(exceptionTrackerContent).toContain(
      'const isViewingCurrentYear = selectedYear === currentYear;'
    );
    expect(exceptionTrackerContent).toContain('Current-Season Only');
  });

  it('CapSheet fences exception editing to the current season and passes real currentYear into ManageExceptionsModal', () => {
    expect(capSheetContent).toContain(
      'const isViewingCurrentYear = selectedYear === currentYear;'
    );
    expect(capSheetContent).toContain(
      'cap-sheet-future-year-exception-edit-boundary'
    );
    expect(capSheetContent).toMatch(
      /<ManageExceptionsModal[\s\S]*currentYear=\{currentYear\}/
    );
    expect(capSheetContent).not.toMatch(
      /<ManageExceptionsModal[\s\S]*currentYear=\{selectedYear\}/
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
    const readsCanonicalExceptions =
      /teamCapSheet\s*\?\s*\.\s*exceptions\s*\?\s*\.\s*\[/.test(content);
    expect(readsCanonicalExceptions).toBe(true);
  });

  it('keeps canonical, compatibility, and default exception stages as separate helpers', () => {
    expect(content).toContain('getCanonicalExceptionEntry');
    expect(content).toContain('getCompatibilityExceptionEntry');
    expect(content).toContain('resolveExceptionTrackerEntry');
    expect(content).toContain('normalizeResolvedExceptionForTracker');
    expect(content).not.toContain('normalizeExceptionForTracker');
  });

  it('keeps legacy fallback as a compatibility-only top-level read helper', () => {
    const hasLegacyFallback =
      /const\s+legacyEntry\s*=\s*\(\s*teamCapSheet\s+as\s+Record<string,\s*unknown>\s*\)\s*\?\s*\.\s*\[\s*legacyKey/.test(
        content
      );
    expect(hasLegacyFallback).toBe(true);
  });

  it('resolves exception tracker sources explicitly before numeric normalization', () => {
    expect(content).toContain("source: 'canonical'");
    expect(content).toContain("source: 'compatibility'");
    expect(content).toContain("source: 'default'");
  });

  it('uses getTeamTpeList(teamCapSheet) for TPE presentation reads', () => {
    expect(content).toMatch(
      /const\s+tradeExceptions\s*=\s*getTeamTpeList\s*\(\s*teamCapSheet\s*\)/
    );
  });

  it('does NOT read teamCapSheet.tradeExceptions directly inside ExceptionTracker', () => {
    expect(content).not.toMatch(/teamCapSheet\s*\??\.\s*tradeExceptions/);
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

  it('routes hard-cap card display through getHardCapStatus', () => {
    expect(content).toContain('getHardCapStatus');
    expect(content).toMatch(/const\s+hardCapStatus\s*=\s*getHardCapStatus\s*\(/);
    expect(content).toMatch(
      /<HardCapCard[\s\S]*hardCapStatus=\{hardCapStatus\}/
    );
  });

  it('does NOT keep tracker-local hard-cap reason or activation synthesis', () => {
    expect(content).not.toContain('let hardCapReason');
    expect(content).not.toContain('usedNTPMLE');
    expect(content).not.toContain('usedBAE');
    expect(content).not.toContain('hardCapped || (');
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

describe('Gate 7B: Hard-Cap Ownership Canonicalization (Closeout)', () => {
  const mutationPipelineContent = readFileContent(MUTATION_PIPELINE_PATH);
  const capLegalityValidationContent = readFileContent(
    CAP_LEGALITY_VALIDATION_PATH
  );
  const actionsContent = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('mutationPipeline canonicalizes team updates before compute return and world changedTeams return', () => {
    expect(mutationPipelineContent).toContain(
      'canonicalizeTeamUpdatesWithCanonicalTotals'
    );
    expect(mutationPipelineContent).toContain(
      'return canonicalizeComputeResultTeamUpdates(result, seasonId);'
    );
    expect(mutationPipelineContent).toContain(
      'const canonicalChangedTeams ='
    );
    expect(mutationPipelineContent).toContain(
      'changedTeams: canonicalChangedTeams'
    );
  });

  it('mutationPipeline no longer writes raw computeTeamCapTotals snapshots directly onto team.totals', () => {
    expect(mutationPipelineContent).not.toContain(
      'team.totals = computeTeamCapTotals('
    );
  });

  it('capLegalityValidation no longer keeps a file-local getHardCapStatus competitor', () => {
    expect(capLegalityValidationContent).not.toContain(
      'function getHardCapStatus('
    );
    expect(capLegalityValidationContent).toContain(
      'getHardCapStatus as getSharedHardCapStatus'
    );
    expect(capLegalityValidationContent).toContain(
      'function getValidationHardCapStatus('
    );
  });

  it('validation and local audit totals both read canonicalized totals snapshots', () => {
    expect(capLegalityValidationContent).toContain(
      'computeCanonicalMutationTeamCapTotals'
    );
    expect(actionsContent).toContain(
      'const canonicalTeam = synchronizeTeamTotalsSnapshot(team as any, year);'
    );
    expect(actionsContent).toContain(
      'canonicalTeam?.totals || computeTeamCapTotals(team, year)'
    );
  });
});

describe('Gate 8: Manual Cap Sheet Mutation Authority (CS-5A)', () => {
  const capSheetContent = readFileContent(CAP_SHEET_PATH);
  const capSheetSectionContent = readFileContent(CAP_SHEET_SECTION_PATH);
  const gmDashboardContent = readFileContent(GM_DASHBOARD_PATH);
  const actionsContent = readFileContent(USE_ARCHITECT_ACTIONS_PATH);
  const editContractModalContent = readFileContent(EDIT_CONTRACT_MODAL_PATH);
  const gmDashboardCapRegion = readRegion(
    gmDashboardContent,
    "{activeTab === 'cap' && (",
    "{activeTab === 'capfull' && ("
  );
  const modalActionCallbacksRegion = readRegion(
    gmDashboardContent,
    'const modalActionCallbacks: EditContractArchitectActionCallbacks = {',
    '  if (authLoading || isLoading) return <p>Loading GM Dashboard...</p>;'
  );
  const manualLedgerHelperRegion = readRegion(
    actionsContent,
    'const runManualCapSheetLedgerMutation = useCallback(',
    '// === Dead Money Actions (Phase 24) ==='
  );
  const preparedLifecycleHelperRegion = readRegion(
    actionsContent,
    'const prepareCapAuditedTeamMutationLifecycle = useCallback(',
    '// === Persistence Helper ==='
  );
  const applyCapAuditedTeamMutationRegion = readRegion(
    actionsContent,
    'const applyCapAuditedTeamMutation = useCallback(',
    'const finalizeCapMutationResult = useCallback('
  );
  const handleSetDeadCapRegion = readRegion(
    actionsContent,
    'const handleSetDeadCap = useCallback(',
    'const handleSetExceptions = useCallback('
  );
  const handleSetExceptionsRegion = readRegion(
    actionsContent,
    'const handleSetExceptions = useCallback(',
    'const hasInjectedCapSheetFixtures = useMemo('
  );
  const handleSaveDeadCapEditRegion = readRegion(
    capSheetContent,
    'const handleSaveDeadCapEdit = React.useCallback(',
    'const handleSaveExceptionsEdit = React.useCallback('
  );
  const handleSaveExceptionsEditRegion = readRegion(
    capSheetContent,
    'const handleSaveExceptionsEdit = React.useCallback(',
    '  return ('
  );

  it('CapSheet uses an explicit manualCapSheetMutationAuthority prop with named handoff callbacks', () => {
    expect(capSheetContent).toMatch(/manualCapSheetMutationAuthority\?:/);
    expect(capSheetContent).toMatch(
      /const\s+handleSaveDeadCapEdit\s*=\s*React\.useCallback/
    );
    expect(capSheetContent).toMatch(
      /const\s+handleSaveExceptionsEdit\s*=\s*React\.useCallback/
    );
    expect(capSheetContent).not.toMatch(/onSave=\{\s*\(\w+\)\s*=>/);
  });

  it('CapSheet save callbacks remain thin authority handoffs without local mutation ownership', () => {
    expect(handleSaveDeadCapEditRegion).toMatch(
      /manualCapSheetMutationAuthority\.handleSetDeadCap/
    );
    expect(handleSaveExceptionsEditRegion).toMatch(
      /manualCapSheetMutationAuthority\.handleSetExceptions/
    );

    const forbiddenPatterns = [
      /setTeamCapSheet/,
      /appendLocalCapAuditEvent/,
      /updateLocalCapAuditEvent/,
      /validatePostStateCapLegality/,
      /persistMutation/,
      /applyWorldMutation/,
      /applyCapAuditedTeamMutation/,
    ];

    for (const forbidden of forbiddenPatterns) {
      expect(handleSaveDeadCapEditRegion).not.toMatch(forbidden);
      expect(handleSaveExceptionsEditRegion).not.toMatch(forbidden);
    }
  });

  it('CapSheet disables manual edit controls when audited authority is unavailable', () => {
    expect(capSheetContent).toContain('const canManageExceptions =');
    expect(capSheetContent).toMatch(/disabled=\{!canManageExceptions\}/);
    expect(capSheetContent).toMatch(
      /disabled=\{!hasManualCapSheetMutationAuthority\}/
    );
    expect(capSheetContent).toMatch(
      /if\s*\(!canManageExceptions\)\s*return;\s*setShowExceptionsModal\(true\);/
    );
    expect(capSheetContent).toMatch(
      /if\s*\(!hasManualCapSheetMutationAuthority\)\s*return;\s*setShowDeadMoneyModal\(true\);/
    );
  });

  it('CapSheet and CapSheetSection stay free of local save or audited-persist ownership logic', () => {
    const forbiddenPatterns = [
      /setTeamCapSheet/,
      /applyWorldMutation/,
      /applyCapAuditedTeamMutation/,
    ];

    for (const forbidden of forbiddenPatterns) {
      expect(capSheetContent).not.toMatch(forbidden);
      expect(capSheetSectionContent).not.toMatch(forbidden);
    }
  });

  it('GMDashboard cap-tab region passes one authority object instead of wiring alternate mutation logic', () => {
    expect(gmDashboardContent).toMatch(
      /const\s+manualCapSheetMutationAuthority\s*=\s*useMemo/
    );
    expect(gmDashboardContent).toMatch(/handleSetDeadCap:\s*actions\.handleSetDeadCap/);
    expect(gmDashboardContent).toMatch(
      /handleSetExceptions:\s*actions\.handleSetExceptions/
    );
    expect(gmDashboardCapRegion).toMatch(
      /manualCapSheetMutationAuthority=\{manualCapSheetMutationAuthority\}/
    );
    expect(gmDashboardCapRegion).not.toMatch(/applyWorldMutation/);
    expect(gmDashboardCapRegion).not.toMatch(/applyCapAuditedTeamMutation/);
    expect(gmDashboardCapRegion).not.toMatch(/setTeamCapSheet/);
  });

  it('GMDashboard cap-tab region fences current-year Cap Sheet from Full Cap Table-only contract launch props', () => {
    expect(gmDashboardCapRegion).toMatch(
      /onOpenPlayerContractModal=\{\s*contractActionRouting\.currentYearCapSheet\.openPlayerContractModal\s*\}/
    );
    expect(gmDashboardCapRegion).not.toMatch(/onLaunchContractAction=/);
    expect(gmDashboardCapRegion).not.toMatch(/onRenounceCapHold=/);
    expect(gmDashboardCapRegion).not.toMatch(
      /contractActionRouting\.fullCapTable/
    );
  });

  it('GMDashboard modal callback surface keeps world-only SAT and offer-sheet callbacks behind worldId guards', () => {
    expect(modalActionCallbacksRegion).toMatch(
      /onSignAndTrade:\s*worldId[\s\S]*\?\s*\(actions\.handleSignAndTrade[\s\S]*:\s*null/
    );
    expect(modalActionCallbacksRegion).toMatch(
      /getSignAndTradePreflight:\s*worldId[\s\S]*\?\s*\(actions\.getSignAndTradePreflight[\s\S]*:\s*null/
    );
    expect(modalActionCallbacksRegion).toMatch(
      /getOfferSheetPreflight:\s*worldId[\s\S]*\?\s*\(actions\.getOfferSheetPreflight[\s\S]*:\s*null/
    );
    expect(modalActionCallbacksRegion).toMatch(
      /onStoreOfferSheet:\s*worldId[\s\S]*\?\s*\(actions\.handleStoreOfferSheet[\s\S]*:\s*null/
    );
  });

  it('GMDashboard still derives rules-profile context from selectedRulesYear while targetYear and actionContext come from modal state', () => {
    expect(gmDashboardContent).toMatch(
      /selectedPlayer\s*\?\s*getRulesProfile\(selectedPlayer,\s*selectedRulesYear\)\s*:\s*null/
    );
    expect(gmDashboardContent).not.toMatch(
      /getRulesProfile\(selectedPlayer,\s*targetYear\)/
    );
    expect(gmDashboardContent).not.toMatch(
      /getRulesProfile\(selectedPlayer,\s*currentYear\)/
    );
    expect(gmDashboardContent).toMatch(
      /\(\s*selectedRulesYear\s*&&\s*leagueContextByYear\?\.get\(selectedRulesYear\)\s*\)\s*\|\|\s*rulesLeagueContext/
    );
    expect(gmDashboardContent).not.toMatch(
      /leagueContextByYear\?\.get\(targetYear\)/
    );
    expect(gmDashboardContent).toMatch(
      /<EditContractModal[\s\S]*targetYear=\{targetYear\}/
    );
    expect(gmDashboardContent).toMatch(
      /<EditContractModal[\s\S]*actionContext=\{actionContext\}/
    );
    expect(gmDashboardContent).toMatch(
      /<EditContractModal[\s\S]*rulesLeagueContext=\{selectedRulesLeagueContext\}/
    );
  });

  it('removes raw local-only contract-editor and reset mutators from the public action surface', () => {
    expect(actionsContent).not.toMatch(/handleSaveContract/);
    expect(actionsContent).not.toMatch(/handleUpdateRoster/);
    expect(actionsContent).not.toMatch(/handleResetCapSheet/);
  });

  it('fences DEV-only fixture utilities behind explicit nested dev tool surfaces', () => {
    expect(actionsContent).toMatch(/interface\s+CapSheetDevTools/);
    expect(actionsContent).toMatch(/interface\s+TeamHistoryDevTools/);
    expect(actionsContent).toMatch(/capSheetDevTools:\s*CapSheetDevTools/);
    expect(actionsContent).toMatch(/teamHistoryDevTools:\s*TeamHistoryDevTools/);
    expect(actionsContent).toMatch(/const\s+capSheetDevTools\s*=\s*useMemo/);
    expect(actionsContent).toMatch(/const\s+teamHistoryDevTools\s*=\s*useMemo/);
    expect(actionsContent).not.toMatch(/handleInjectCapSheetFixtures\s*:/);
    expect(actionsContent).not.toMatch(/handleClearCapSheetFixtures\s*:/);
    expect(actionsContent).not.toMatch(/handleInjectTeamHistoryFixtures\s*:/);
    expect(actionsContent).not.toMatch(/handleClearTeamHistoryFixtures\s*:/);
  });

  it('keeps fixture wiring on explicit dev-tool namespaces and removes generic contract-modal save fallback wiring', () => {
    expect(gmDashboardContent).toMatch(
      /onInjectCapSheetFixtures=\{actions\.capSheetDevTools\.injectFixtures\}/
    );
    expect(gmDashboardContent).toMatch(
      /onClearCapSheetFixtures=\{actions\.capSheetDevTools\.clearFixtures\}/
    );
    expect(gmDashboardContent).toMatch(
      /hasInjectedCapSheetFixtures=\{\s*actions\.capSheetDevTools\.hasInjectedFixtures\s*\}/
    );
    expect(gmDashboardContent).toMatch(
      /actions\.teamHistoryDevTools\.injectFixtures/
    );
    expect(gmDashboardContent).toMatch(
      /actions\.teamHistoryDevTools\.clearFixtures/
    );
    expect(gmDashboardContent).toMatch(
      /actions\.teamHistoryDevTools\.hasInjectedFixtures/
    );
    expect(gmDashboardContent).not.toMatch(/onSaveContract=/);
    expect(editContractModalContent).not.toMatch(/onSaveContract/);
    expect(editContractModalContent).not.toMatch(/onSave\?:\s*SigningActionCallback/);
    expect(editContractModalContent).toMatch(
      /case 'signNew':[\s\S]*actionResult = await onSignFreeAgent\?\./
    );
    expect(editContractModalContent).toMatch(
      /case 'resign':[\s\S]*actionResult = await onResign\?\./
    );
    expect(editContractModalContent).not.toMatch(/onSignFreeAgent\s*\|\|\s*onSave/);
    expect(editContractModalContent).not.toMatch(/onResign\s*\|\|\s*onSave/);
  });

  it('handleSetDeadCap and handleSetExceptions delegate through the shared manual ledger helper', () => {
    expect(handleSetDeadCapRegion).toMatch(/runManualCapSheetLedgerMutation\(\{/);
    expect(handleSetDeadCapRegion).not.toMatch(/applyCapAuditedTeamMutation/);
    expect(handleSetDeadCapRegion).not.toMatch(/appendLocalCapAuditEvent/);
    expect(handleSetDeadCapRegion).not.toMatch(/persistMutation/);
    expect(handleSetExceptionsRegion).toMatch(
      /runManualCapSheetLedgerMutation\(\{/
    );
    expect(handleSetExceptionsRegion).not.toMatch(/applyCapAuditedTeamMutation/);
    expect(handleSetExceptionsRegion).not.toMatch(/appendLocalCapAuditEvent/);
    expect(handleSetExceptionsRegion).not.toMatch(/persistMutation/);
  });

  it('shared manual ledger helper remains the only audited mutation bridge for dead cap and exceptions', () => {
    expect(manualLedgerHelperRegion).toMatch(
      /const\s+runManualCapSheetLedgerMutation\s*=\s*useCallback/
    );
    expect(manualLedgerHelperRegion).toMatch(/params\.type === 'deadCap'/);
    expect(manualLedgerHelperRegion).toMatch(/mutationType:\s*'setDeadCap'/);
    expect(manualLedgerHelperRegion).toMatch(/mutationType:\s*'setExceptions'/);
    expect(manualLedgerHelperRegion).toMatch(/applyCapAuditedTeamMutation\(/);
    expect(manualLedgerHelperRegion).not.toMatch(/appendLocalCapAuditEvent/);
    expect(manualLedgerHelperRegion).not.toMatch(/updateLocalCapAuditEvent/);
    expect(manualLedgerHelperRegion).not.toMatch(/persistMutation/);
    expect(manualLedgerHelperRegion).not.toMatch(/validatePostStateCapLegality/);
  });

  it('applyCapAuditedTeamMutation consumes one prepared lifecycle contract for preview, validation, local apply, and persist callbacks', () => {
    expect(actionsContent).toMatch(
      /type\s+PreparedCapAuditedMutationLifecycle\s*=\s*\{/
    );
    expect(preparedLifecycleHelperRegion).toMatch(
      /const\s+prepareCapAuditedTeamMutationLifecycle\s*=\s*useCallback/
    );
    expect(preparedLifecycleHelperRegion).toMatch(/buildCapAuditEvaluation\(/);
    expect(preparedLifecycleHelperRegion).toMatch(/applyLocalPreview:\s*\(\)\s*=>/);
    expect(preparedLifecycleHelperRegion).toMatch(/linkPersistSuccess:\s*\(result\)\s*=>/);
    expect(preparedLifecycleHelperRegion).toMatch(/rollbackPersistFailure:\s*\(\)\s*=>/);
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /prepareCapAuditedTeamMutationLifecycle\(\{/
    );
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /appendLocalCapAuditEvent\(lifecycle\.previewAuditEvaluation\.event/
    );
    expect(applyCapAuditedTeamMutationRegion).toMatch(/lifecycle\.applyLocalPreview\(\)/);
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /onSuccess:\s*lifecycle\.linkPersistSuccess/
    );
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /lifecycle\.rollbackPersistFailure\(\)/
    );
    expect(applyCapAuditedTeamMutationRegion).not.toMatch(
      /buildCapAuditEvaluation\(/ 
    );
  });

  it('applyCapAuditedTeamMutation preserves the authoritative preview -> validation -> local apply -> persist order', () => {
    const previewAppendIndex = applyCapAuditedTeamMutationRegion.indexOf(
      'appendLocalCapAuditEvent(lifecycle.previewAuditEvaluation.event'
    );
    const invalidGateIndex = applyCapAuditedTeamMutationRegion.indexOf(
      'if (!lifecycle.previewAuditEvaluation.validation.valid)'
    );
    const invalidReturnIndex = applyCapAuditedTeamMutationRegion.indexOf(
      'applied: false',
      invalidGateIndex
    );
    const localPreviewIndex = applyCapAuditedTeamMutationRegion.indexOf(
      'lifecycle.applyLocalPreview()'
    );
    const persistScheduleIndex = applyCapAuditedTeamMutationRegion.indexOf(
      'const persistPromise = persistMutation'
    );

    expect(previewAppendIndex).toBeGreaterThan(-1);
    expect(invalidGateIndex).toBeGreaterThan(-1);
    expect(invalidReturnIndex).toBeGreaterThan(-1);
    expect(localPreviewIndex).toBeGreaterThan(-1);
    expect(persistScheduleIndex).toBeGreaterThan(-1);

    expect(previewAppendIndex).toBeLessThan(invalidGateIndex);
    expect(invalidGateIndex).toBeLessThan(invalidReturnIndex);
    expect(invalidReturnIndex).toBeLessThan(localPreviewIndex);
    expect(localPreviewIndex).toBeLessThan(persistScheduleIndex);
  });

  it('applyCapAuditedTeamMutation threads the preview operationId into persistence and keeps lifecycle callbacks bound', () => {
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /const\s+persistPromise\s*=\s*persistMutation\(\s*mutationType\s*,\s*persistPayload\s*,\s*\{/
    );
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /operationId:\s*lifecycle\.operationId/
    );
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /onSuccess:\s*lifecycle\.linkPersistSuccess/
    );
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /onFailure:\s*\(message\)\s*=>\s*\{/
    );
    expect(applyCapAuditedTeamMutationRegion).toMatch(
      /lifecycle\.rollbackPersistFailure\(\)/
    );
  });
});

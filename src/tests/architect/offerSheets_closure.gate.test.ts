/**
 * FILE: src/tests/architect/offerSheets_closure.gate.test.ts
 * PURPOSE: Closure permanence gates for Offer Sheet lifecycle end-to-end invariants.
 * OWNERSHIP: Feature: architect/free-agency (E1)
 *
 * HISTORY:
 *  - 2026-03-01: Created for TM_OFFER_SHEETS_E1 — permanent regression gates
 *
 * GATES:
 *  1. Mutation types present + routed in pipeline
 *  2. loadStateForMutation loads BOTH teams for offer sheet mutations
 *  3. Validation uses validateOfferSheetResolution
 *  4. Store mirrors to offering + home team arrays
 *  5. Match/Decline enforce status + mirror update
 *  6. Finalize matched recomputes home totals
 *  7. Finalize declined recomputes BOTH totals
 *  8. Persistence writes teamUpdates
 *  9. UI wiring + world gating exists
 *  10. E113 deleted JSX shims remain absent while authorities stay intact
 *  11. Current team sync reads changedTeams
 *  12. Lifecycle routing stays role-aware
 *  13. Lifecycle final-state sync stays explicit
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// === FILE PATH CONSTANTS ===

const MUTATION_PIPELINE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/mutationPipeline.ts'
);

const CAP_LEGALITY_VALIDATION_AUTHORITY_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation.ts'
);

const NON_TRADE_STAGE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/nonTradeMutationValidationStage.ts'
);

const USE_ARCHITECT_ACTIONS_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectActions.ts'
);

const OFFER_SHEET_LIST_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/components/OfferSheetList.tsx'
);

const OFFER_SHEET_LIST_SHIM_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/components/OfferSheetList.jsx'
);

const FREE_AGENCY_SECTION_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/sections/FreeAgencySection.tsx'
);

const FREE_AGENCY_SECTION_SHIM_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/sections/FreeAgencySection.jsx'
);

// === HELPER FUNCTIONS ===

const readFileContent = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Gate file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
};

// === GATE 1: Mutation Types Are Present + Routed in Pipeline ===

describe('Gate 1: Mutation types are present + routed in pipeline (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('defines storeOfferSheet mutation type', () => {
    const hasStoreOfferSheet = /['"]storeOfferSheet['"]/.test(content);
    expect(hasStoreOfferSheet).toBe(true);
  });

  it('defines matchOfferSheet mutation type', () => {
    const hasMatchOfferSheet = /['"]matchOfferSheet['"]/.test(content);
    expect(hasMatchOfferSheet).toBe(true);
  });

  it('defines declineOfferSheet mutation type', () => {
    const hasDeclineOfferSheet = /['"]declineOfferSheet['"]/.test(content);
    expect(hasDeclineOfferSheet).toBe(true);
  });

  it('defines finalizeMatchedOfferSheet mutation type', () => {
    const hasFinalizeMatchedOfferSheet =
      /['"]finalizeMatchedOfferSheet['"]/.test(content);
    expect(hasFinalizeMatchedOfferSheet).toBe(true);
  });

  it('defines finalizeDeclinedOfferSheet mutation type', () => {
    const hasFinalizeDeclinedOfferSheet =
      /['"]finalizeDeclinedOfferSheet['"]/.test(content);
    expect(hasFinalizeDeclinedOfferSheet).toBe(true);
  });

  it('routes mutations through applyWorldMutation', () => {
    const hasApplyWorldMutation =
      /export\s+(async\s+)?function\s+applyWorldMutation/.test(content);
    expect(hasApplyWorldMutation).toBe(true);
  });

  it('routes mutations through loadStateForMutation', () => {
    const hasLoadStateForMutation =
      /(async\s+)?function\s+loadStateForMutation/.test(content);
    expect(hasLoadStateForMutation).toBe(true);
  });

  it('routes mutations through computeWorldMutation', () => {
    const hasComputeWorldMutation = /function\s+computeWorldMutation/.test(
      content
    );
    expect(hasComputeWorldMutation).toBe(true);
  });
});

// === GATE 2: loadStateForMutation Loads BOTH Teams for Offer Sheet Mutations ===

describe('Gate 2: loadStateForMutation loads BOTH teams for offer sheet mutations (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('case block handles matchOfferSheet/declineOfferSheet/finalize mutations', () => {
    const hasCaseBlock =
      /case\s+['"]matchOfferSheet['"][\s\S]{0,80}case\s+['"]declineOfferSheet['"][\s\S]{0,80}case\s+['"]finalizeMatchedOfferSheet['"][\s\S]{0,80}case\s+['"]finalizeDeclinedOfferSheet['"]/.test(
        content
      );
    expect(hasCaseBlock).toBe(true);
  });

  it('loads homeTeam via getTeam with homeTeamCode', () => {
    const loadsHomeTeam = /getTeam\s*\(\s*worldId\s*,\s*homeTeamCode\s*\)/.test(
      content
    );
    expect(loadsHomeTeam).toBe(true);
  });

  it('loads offeringTeam via getTeam with offeringTeamCode', () => {
    const loadsOfferingTeam =
      /getTeam\s*\(\s*worldId\s*,\s*offeringTeamCode\s*\)/.test(content);
    expect(loadsOfferingTeam).toBe(true);
  });

  it('returns both homeTeam and offeringTeam from state loader', () => {
    const returnsBothTeams =
      /return\s*\{[\s\S]{0,200}homeTeam[\s\S]{0,200}offeringTeam[\s\S]{0,120}offerSheetId[\s\S]{0,200}\}/.test(
        content
      );
    expect(returnsBothTeams).toBe(true);
  });
});

// === GATE 3: Validation Uses validateOfferSheetResolution ===

describe('Gate 3: Validation uses validateOfferSheetResolution (E1)', () => {
  const pipelineContent = readFileContent(MUTATION_PIPELINE_PATH);
  const nonTradeStageContent = readFileContent(NON_TRADE_STAGE_PATH);
  const validationContent = readFileContent(
    CAP_LEGALITY_VALIDATION_AUTHORITY_PATH
  );

  it('validateOfferSheetResolution function is defined', () => {
    const hasFunctionDef =
      /export\s+function\s+validateOfferSheetResolution/.test(
        validationContent
      );
    expect(hasFunctionDef).toBe(true);
  });

  it('non-trade validation stage imports validateOfferSheetResolution', () => {
    const importsValidator =
      /import[\s\S]{0,500}validateOfferSheetResolution[\s\S]{0,200}from/.test(
        nonTradeStageContent
      );
    expect(importsValidator).toBe(true);
  });

  it('mutationPipeline delegates non-trade validation to the extracted stage', () => {
    expect(pipelineContent).toContain('validateNonTradeMutationStage');
  });

  it('validateOfferSheetResolution is called for match action in the extracted stage', () => {
    const usedForMatch =
      /validateOfferSheetResolution\s*\(\s*\{[\s\S]{0,200}action\s*:\s*['"]match['"]/.test(
        nonTradeStageContent
      );
    expect(usedForMatch).toBe(true);
  });

  it('validateOfferSheetResolution is called for decline action in the extracted stage', () => {
    const usedForDecline =
      /validateOfferSheetResolution\s*\(\s*\{[\s\S]{0,200}action\s*:\s*['"]decline['"]/.test(
        nonTradeStageContent
      );
    expect(usedForDecline).toBe(true);
  });

  it('validateOfferSheetResolution is called for finalize action in the extracted stage', () => {
    const usedForFinalize =
      /validateOfferSheetResolution\s*\(\s*\{[\s\S]{0,200}action\s*:\s*['"]finalize['"]/.test(
        nonTradeStageContent
      );
    expect(usedForFinalize).toBe(true);
  });
});

// === GATE 4: Store Mirrors to Offering + Home Team Arrays ===

describe('Gate 4: Store mirrors to offering + home team arrays (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('defines computeStoreOfferSheetResult function', () => {
    const hasFunctionDef = /function\s+computeStoreOfferSheetResult/.test(
      content
    );
    expect(hasFunctionDef).toBe(true);
  });

  it('updates offering team offerSheets array', () => {
    const updatesOfferingTeam = /updatedOfferingTeam\.offerSheets\s*=/.test(
      content
    );
    expect(updatesOfferingTeam).toBe(true);
  });

  it('mirrors to home team incomingOfferSheets array', () => {
    const mirrorsToHomeTeam = /updatedHomeTeam\.incomingOfferSheets\s*=/.test(
      content
    );
    expect(mirrorsToHomeTeam).toBe(true);
  });

  it('returns teamUpdates containing both teams', () => {
    // Look for pattern that returns teamUpdates with both offering and home team
    const returnsBothTeams =
      /computeStoreOfferSheetResult[\s\S]{0,9000}teamUpdates\.push\s*\(\s*\{\s*teamCode\s*:\s*homeTeam\.teamCode/.test(
        content
      );
    expect(returnsBothTeams).toBe(true);
  });
});

describe('Gate 4B: Store ownership resolves from strict home-team authority (E5)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);
  const storeOfferSheetBlock =
    content.match(
      /case\s+['"]storeOfferSheet['"]:\s*\{[\s\S]{0,1200}\n\s*\}/
    )?.[0] || '';

  it('routes storeOfferSheet through resolveStoreOfferSheetAuthority', () => {
    expect(storeOfferSheetBlock).toContain('resolveStoreOfferSheetAuthority');
  });

  it('does not load storeOfferSheet player truth from offering-team getPlayer path', () => {
    expect(storeOfferSheetBlock).not.toMatch(
      /getPlayer\s*\(\s*worldId\s*,\s*teamCode\s*,\s*playerId\s*\)/
    );
  });

  it('checks roster membership before players[] fallback for ownership', () => {
    expect(content).toContain('const rosterOwners = ownershipCandidates.filter');
    expect(content).toContain('const playersOwners = ownershipCandidates.filter');
    expect(content).toContain('if (rosterOwners.length === 1)');
    expect(content).toContain('else if (playersOwners.length === 1)');
  });

  it('fails closed when snapshot roster and players[] membership disagree', () => {
    expect(content).toContain(
      'snapshot roster membership disagrees with players[] membership'
    );
  });

  it('derives storeOfferSheet homeTeamCode from resolved homeTeam authority', () => {
    expect(content).toContain('const homeTeamCode = homeTeam.teamCode;');
  });
});

// === GATE 5: Match/Decline Enforce Status + Mirror Update ===

describe('Gate 5: Match/Decline enforce status + mirror update (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('computeMatchOfferSheetResult checks for PENDING_MATCH status', () => {
    const checksStatus =
      /computeMatchOfferSheetResult[\s\S]{0,1500}status\s*!==\s*['"]PENDING_MATCH['"]/.test(
        content
      );
    expect(checksStatus).toBe(true);
  });

  it('computeMatchOfferSheetResult sets status to MATCHED', () => {
    const setsMatched =
      /computeMatchOfferSheetResult[\s\S]{0,2000}status\s*:\s*['"]MATCHED['"]/.test(
        content
      );
    expect(setsMatched).toBe(true);
  });

  it('computeDeclineOfferSheetResult checks for PENDING_MATCH status', () => {
    const checksStatus =
      /computeDeclineOfferSheetResult[\s\S]{0,1500}status\s*!==\s*['"]PENDING_MATCH['"]/.test(
        content
      );
    expect(checksStatus).toBe(true);
  });

  it('computeDeclineOfferSheetResult sets status to DECLINED', () => {
    const setsDeclined =
      /computeDeclineOfferSheetResult[\s\S]{0,2000}status\s*:\s*['"]DECLINED['"]/.test(
        content
      );
    expect(setsDeclined).toBe(true);
  });

  it('match/decline mirror update to home team incomingOfferSheets', () => {
    // Both match and decline update home team's incomingOfferSheets
    const mirrorsUpdate =
      /compute(Match|Decline)OfferSheetResult[\s\S]{0,3000}updatedHomeTeam\.incomingOfferSheets/.test(
        content
      );
    expect(mirrorsUpdate).toBe(true);
  });
});

// === GATE 6: Finalize Matched Recomputes Home Totals ===

describe('Gate 6: Finalize matched recomputes home totals (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('computeFinalizeMatchedOfferSheetResult is defined', () => {
    const hasFunctionDef =
      /function\s+computeFinalizeMatchedOfferSheetResult/.test(content);
    expect(hasFunctionDef).toBe(true);
  });

  it('removes offer sheet from home team incomingOfferSheets', () => {
    const removesFromHome =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,2500}updatedHomeTeam\.incomingOfferSheets\s*=[\s\S]{0,200}removeOfferSheetEntries/.test(
        content
      );
    expect(removesFromHome).toBe(true);
  });

  it('normalizes the matched contract before applying it', () => {
    const normalizesContract =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,3500}buildNormalizedOfferSheetFinalContract/.test(
        content
      );
    expect(normalizesContract).toBe(true);
  });

  it('recomputes home team totals through the canonical totals bridge', () => {
    const recomputesTotals =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,4500}updatedHomeTeam\.totals\s*=\s*(?:computeTeamCapTotals|synchronizeTeamTotalsSnapshot)/.test(
        content
      );
    expect(recomputesTotals).toBe(true);
  });

  it('cleans up offer sheet from offering team', () => {
    const cleansUpOffering =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,5500}updatedOfferingTeam\.offerSheets\s*=[\s\S]{0,200}removeOfferSheetEntries/.test(
        content
      );
    expect(cleansUpOffering).toBe(true);
  });

  it('builds canonical replace manifest with no delete path', () => {
    const usesReplaceManifest =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,6500}buildCanonicalPlayerPersistenceManifest[\s\S]{0,400}mode:\s*['"]replace['"]/.test(
        content
      );
    expect(usesReplaceManifest).toBe(true);
  });
});

// === GATE 7: Finalize Declined Recomputes BOTH Totals ===

describe('Gate 7: Finalize declined recomputes BOTH totals (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('computeFinalizeDeclinedOfferSheetResult is defined', () => {
    const hasFunctionDef =
      /function\s+computeFinalizeDeclinedOfferSheetResult/.test(content);
    expect(hasFunctionDef).toBe(true);
  });

  it('adds player to offering team roster', () => {
    const addsToOffering =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,5000}updatedOfferingTeam\.players\s*=/.test(
        content
      );
    expect(addsToOffering).toBe(true);
  });

  it('recomputes offering team totals through the canonical totals bridge', () => {
    const recomputesOfferingTotals =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,6000}updatedOfferingTeam\.totals\s*=\s*(?:computeTeamCapTotals|synchronizeTeamTotalsSnapshot)/.test(
        content
      );
    expect(recomputesOfferingTotals).toBe(true);
  });

  it('removes player from home team roster', () => {
    const removesFromHome =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,7000}updatedHomeTeam\.players\s*=[\s\S]{0,200}filter/.test(
        content
      );
    expect(removesFromHome).toBe(true);
  });

  it('recomputes home team totals through the canonical totals bridge', () => {
    const recomputesHomeTotals =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,8000}updatedHomeTeam\.totals\s*=\s*(?:computeTeamCapTotals|synchronizeTeamTotalsSnapshot)/.test(
        content
      );
    expect(recomputesHomeTotals).toBe(true);
  });

  it('derives destination player from canonical home snapshot plus normalized contract', () => {
    const derivesFromSourceSnapshot =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,3000}const sourcePlayer = findPlayerInTeamPlayers\(homeTeam,\s*playerId\)[\s\S]{0,2200}buildNormalizedOfferSheetFinalContract[\s\S]{0,1600}const updatedPlayer = \{\s*\.\.\.sourcePlayer/.test(
        content
      );
    expect(derivesFromSourceSnapshot).toBe(true);
  });

  it('builds canonical move manifest with explicit delete path', () => {
    const usesMoveManifest =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,8500}buildCanonicalPlayerPersistenceManifest[\s\S]{0,500}mode:\s*['"]move['"]/.test(
        content
      );
    expect(usesMoveManifest).toBe(true);
  });
});

// === GATE 8: Persistence Writes teamUpdates ===

describe('Gate 8: Persistence writes teamUpdates (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('persistWorldMutation function is defined', () => {
    const hasFunctionDef = /(async\s+)?function\s+persistWorldMutation/.test(
      content
    );
    expect(hasFunctionDef).toBe(true);
  });

  it('iterates over computeResult.teamUpdates', () => {
    const iteratesTeamUpdates =
      /for\s*\(\s*const\s*\{\s*teamCode\s*,\s*team\s*\}\s*of\s+(?:computeResult\.teamUpdates|teamUpdates)\s*\)/.test(
        content
      );
    expect(iteratesTeamUpdates).toBe(true);
  });

  it('writes team updates to Firestore via batch.set', () => {
    const writesToFirestore =
      /persistWorldMutation[\s\S]{0,3000}batch\.set\s*\(\s*teamRef/.test(
        content
      );
    expect(writesToFirestore).toBe(true);
  });
});

// === GATE 9: UI Wiring + World Gating Exists ===

describe('Gate 9: UI wiring + world gating exists (E1)', () => {
  const offerSheetListContent = readFileContent(OFFER_SHEET_LIST_PATH);
  const freeAgencySectionContent = readFileContent(FREE_AGENCY_SECTION_PATH);

  it('OfferSheetList defines one role-aware lifecycle surface decision table', () => {
    expect(offerSheetListContent).toMatch(
      /function\s+getOfferSheetLifecycleSurfaceState/
    );
    expect(offerSheetListContent).toMatch(
      /case\s+'incoming:PENDING_MATCH'[\s\S]*actions:\s*\['match',\s*'decline'\]/
    );
    expect(offerSheetListContent).toMatch(
      /case\s+'incoming:MATCHED'[\s\S]*actions:\s*\['finalizeMatched'\]/
    );
    expect(offerSheetListContent).toMatch(
      /case\s+'outgoing:DECLINED'[\s\S]*actions:\s*\['finalizeDeclined'\]/
    );
    expect(offerSheetListContent).toMatch(
      /case\s+'outgoing:MATCHED'[\s\S]*Matched by Home Team/
    );
    expect(offerSheetListContent).toMatch(
      /case\s+'outgoing:PENDING_MATCH'[\s\S]*Waiting for home team/
    );
  });

  it('OfferSheetList emits one unified lifecycle callback with explicit role truth', () => {
    expect(offerSheetListContent).toMatch(/surfaceRole,\s*\n?\s*onLifecycleAction,/);
    expect(offerSheetListContent).toMatch(
      /onLifecycleAction\?\.\(\{\s*[\s\S]*action,\s*[\s\S]*offerSheet:\s*os,\s*[\s\S]*surfaceRole,\s*[\s\S]*\}\)/
    );
    expect(offerSheetListContent).not.toMatch(/onMatch\s*\?\.\s*\(/);
    expect(offerSheetListContent).not.toMatch(/onDecline\s*\?\.\s*\(/);
    expect(offerSheetListContent).not.toMatch(/onFinalize\s*\?\.\s*\(/);
  });

  it('OfferSheetList derives counterparty display from explicit surfaceRole', () => {
    expect(offerSheetListContent).toMatch(
      /function\s+getOfferSheetCounterpartyLabel/
    );
    expect(offerSheetListContent).toMatch(
      /function\s+getOfferSheetCounterpartyCode/
    );
    expect(offerSheetListContent).toMatch(
      /surfaceRole\s*===\s*'incoming'\s*\?\s*'Offering Team'\s*:\s*'Target Team'/
    );
  });

  it('OfferSheetList has actionsDisabled prop for world gating', () => {
    const hasActionsDisabled = /actionsDisabled\s*[=:]/.test(
      offerSheetListContent
    );
    expect(hasActionsDisabled).toBe(true);
  });

  it('FreeAgencySection derives actionsDisabled from the published offer-sheet section availability contract', () => {
    const derivesSectionAvailability =
      /const\s+offerSheetSectionAvailability\s*=\s*actionOwner\.offerSheetSectionAvailability[\s\S]*const\s+offerSheetLifecycleActionOwner[\s\S]*offerSheetSectionAvailability\.lifecycleActionOwner/.test(
        freeAgencySectionContent
      );
    const passesPublishedGating =
      /actionsDisabled\s*=\s*\{\s*offerSheetSectionAvailability\.actionsDisabled\s*\}/.test(
        freeAgencySectionContent
      );
    const passesPublishedReason =
      /actionsDisabledReason\s*=\s*\{\s*offerSheetLifecycleDisabledReason\s*\}/.test(
        freeAgencySectionContent
      );
    const passesUnifiedLifecycleHandler =
      /onLifecycleAction=\{handleOfferSheetLifecycleAction\}/.test(
        freeAgencySectionContent
      );
    expect(derivesSectionAvailability).toBe(true);
    expect(passesPublishedGating).toBe(true);
    expect(passesPublishedReason).toBe(true);
    expect(passesUnifiedLifecycleHandler).toBe(true);
  });
});

// === GATE 10: E113 Deleted JSX Shims Remain Absent ===

describe('Gate 10: E113 deleted JSX shims remain absent while authorities stay intact', () => {
  it('OfferSheetList.jsx is absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(OFFER_SHEET_LIST_SHIM_PATH)).toBe(false);
  });

  it('FreeAgencySection.jsx is absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(FREE_AGENCY_SECTION_SHIM_PATH)).toBe(false);
  });

  it('OfferSheetList.tsx remains the default-export authority', () => {
    const authorityContent = readFileContent(OFFER_SHEET_LIST_PATH);
    expect(authorityContent).toContain('export default OfferSheetList;');
  });

  it('FreeAgencySection.tsx remains the named-export authority', () => {
    const authorityContent = readFileContent(FREE_AGENCY_SECTION_PATH);
    expect(authorityContent).toContain('export { FreeAgencySection };');
  });
});

// === GATE 11: Offer-Sheet Created-State Sync Stays Explicit ===

describe('Gate 11: offer-sheet created-state sync stays explicit (FA-5C/5D)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('keeps the generic changedTeams sync helper for non-offer-sheet mutations', () => {
    const hasSyncHelper =
      /const\s+syncTeamFromMutationResult\s*=\s*useCallback/.test(content);
    expect(hasSyncHelper).toBe(true);
    expect(content).toMatch(
      /const\s+buildCommittedWorldReloadPlan\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+applyCommittedWorldReloadPlan\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /syncTeamFromMutationResult[\s\S]{0,2200}await\s+buildCommittedWorldReloadPlan\s*\(\s*mutationType\s*,\s*result\s*\)/
    );
    expect(content).toMatch(
      /syncTeamFromMutationResult[\s\S]{0,2200}await\s+applyCommittedWorldReloadPlan/
    );
  });

  it('defines dedicated offer-sheet committed-state helpers in useArchitectActions', () => {
    expect(content).toMatch(
      /const\s+resolveCommittedOfferSheetState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+applyCommittedOfferSheetState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+executeWorldModeOfferSheetStore\s*=\s*useCallback/
    );
  });

  it('routes handleStoreOfferSheet through the explicit offer-sheet store executor instead of generic mutation sync', () => {
    expect(content).toMatch(
      /handleStoreOfferSheet[\s\S]{0,2200}executeWorldModeOfferSheetStore/
    );
    expect(content).toMatch(
      /handleStoreOfferSheet[\s\S]{0,2800}applyCommittedOfferSheetState/
    );
    expect(content).not.toMatch(
      /handleStoreOfferSheet[\s\S]{0,2200}runAuthoritativeFAMutation\s*\(\s*'storeOfferSheet'/
    );
  });

  it('verifies committed pending offer-sheet identity against the resolved active-team snapshot', () => {
    expect(content).toMatch(/buildCommittedOfferSheetIdentity/);
    expect(content).toMatch(/matchesCommittedOfferSheetIdentity/);
    expect(content).toMatch(
      /resolveCommittedOfferSheetState[\s\S]{0,2200}await\s+resolveCommittedWorldTeamSnapshot/
    );
    expect(content).toMatch(
      /resolveCommittedOfferSheetState[\s\S]{0,2200}committedTeam\.offerSheets/
    );
    expect(content).toMatch(
      /Offer sheet saved but the committed pending offer sheet could not be verified in the active team snapshot\./
    );
  });
});

// === GATE 12: Offer-Sheet Lifecycle Routing Stays Role-Aware ===

describe('Gate 12: offer-sheet lifecycle routing stays role-aware (FA-6A/6B)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('defines shared lifecycle routing helpers for match/decline and finalize resolution', () => {
    expect(content).toMatch(
      /const\s+runOfferSheetResolutionAction\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+resolveOfferSheetFinalizeMutationRoute\s*=\s*useCallback/
    );
  });

  it('routes match and decline through one shared resolution helper', () => {
    expect(content).toMatch(
      /const\s+mutationType:\s*OfferSheetResolutionMutationType\s*=\s*action\s*===\s*'match'\s*\?\s*'matchOfferSheet'\s*:\s*'declineOfferSheet'/
    );
    expect(content).toMatch(
      /handleMatchOfferSheet[\s\S]{0,600}runOfferSheetResolutionAction\s*\(\s*'match'/
    );
    expect(content).toMatch(
      /handleDeclineOfferSheet[\s\S]{0,600}runOfferSheetResolutionAction\s*\(\s*'decline'/
    );
    expect(content).toMatch(
      /runOfferSheetResolutionAction[\s\S]{0,1600}activeTeamArrayKey:\s*'incomingOfferSheets'[\s\S]{0,800}presence:\s*'present'/
    );
    expect(content).toMatch(
      /runOfferSheetResolutionAction[\s\S]{0,2200}status:\s*action\s*===\s*'match'\s*\?\s*'MATCHED'\s*:\s*'DECLINED'/
    );
    expect(content).toMatch(
      /executeWorldModeOfferSheetLifecycleMutation\s*\(\s*mutationType/
    );
  });

  it('resolves finalize routing from status plus acting-team role before dispatch', () => {
    expect(content).toMatch(
      /offerSheet\.status\s*===\s*'MATCHED'[\s\S]*offerSheet\.homeTeamCode\s*===\s*teamCode[\s\S]*mutationType:\s*'finalizeMatchedOfferSheet'/
    );
    expect(content).toMatch(
      /offerSheet\.status\s*===\s*'DECLINED'[\s\S]*offerSheet\.offeringTeamCode\s*===\s*teamCode[\s\S]*mutationType:\s*'finalizeDeclinedOfferSheet'/
    );
    expect(content).toMatch(
      /handleFinalizeOfferSheet[\s\S]{0,1200}resolveOfferSheetFinalizeMutationRoute/
    );
    expect(content).toMatch(
      /handleFinalizeOfferSheet[\s\S]{0,2200}finalizeRoute\.mutationType\s*===\s*'finalizeMatchedOfferSheet'[\s\S]*activeTeamArrayKey:\s*'incomingOfferSheets'[\s\S]*presence:\s*'absent'/
    );
    expect(content).toMatch(
      /handleFinalizeOfferSheet[\s\S]{0,2800}activeTeamArrayKey:\s*'offerSheets'[\s\S]*presence:\s*'absent'/
    );
    expect(content).toMatch(
      /handleFinalizeOfferSheet[\s\S]{0,3200}executeWorldModeOfferSheetLifecycleMutation\s*\(\s*finalizeRoute\.mutationType/
    );
    expect(content).toMatch(
      /Cannot finalize offer sheet: status\/team mismatch/
    );
  });
});

describe('Gate 13: offer-sheet lifecycle final-state sync stays explicit (FA-6C/6D)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('defines dedicated lifecycle committed-state helpers in useArchitectActions', () => {
    expect(content).toMatch(
      /const\s+resolveCommittedOfferSheetLifecycleState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+applyCommittedOfferSheetLifecycleState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+executeWorldModeOfferSheetLifecycleMutation\s*=\s*useCallback/
    );
    expect(content).toMatch(/buildCommittedOfferSheetLifecycleIdentity/);
    expect(content).toMatch(/matchesCommittedOfferSheetLifecycleIdentity/);
  });

  it('verifies present lifecycle truth against incomingOfferSheets for match and decline', () => {
    expect(content).toMatch(
      /runOfferSheetResolutionAction[\s\S]{0,2200}activeTeamArrayKey:\s*'incomingOfferSheets'/
    );
    expect(content).toMatch(
      /runOfferSheetResolutionAction[\s\S]{0,2200}presence:\s*'present'/
    );
    expect(content).toMatch(
      /runOfferSheetResolutionAction[\s\S]{0,2200}status:\s*action\s*===\s*'match'\s*\?\s*'MATCHED'\s*:\s*'DECLINED'/
    );
  });

  it('verifies absent lifecycle truth against the correct visible array for finalize actions', () => {
    expect(content).toMatch(
      /handleFinalizeOfferSheet[\s\S]{0,2400}mutationType\s*===\s*'finalizeMatchedOfferSheet'[\s\S]*activeTeamArrayKey:\s*'incomingOfferSheets'[\s\S]*presence:\s*'absent'/
    );
    expect(content).toMatch(
      /handleFinalizeOfferSheet[\s\S]{0,3200}activeTeamArrayKey:\s*'offerSheets'[\s\S]*presence:\s*'absent'/
    );
  });

  it('resolves changedTeams first, reloads second, and keeps roster-index refresh out of the lifecycle seam', () => {
    expect(content).toMatch(
      /const\s+resolveCommittedWorldTeamSnapshot\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /resolveCommittedWorldTeamSnapshot[\s\S]{0,2200}findUpdatedTeamSnapshot\s*\(\s*result\?\.changedTeams\s*,\s*teamCode\s*\)/
    );
    expect(content).toMatch(
      /resolveCommittedWorldTeamSnapshot[\s\S]{0,2200}loadWorldTeamData\s*\(\s*worldId\s*,\s*teamCode\s*\)/
    );
    expect(content).toMatch(
      /resolveCommittedOfferSheetLifecycleState[\s\S]{0,2200}await\s+resolveCommittedWorldTeamSnapshot/
    );
    expect(content).toMatch(
      /executeWorldModeOfferSheetLifecycleMutation[\s\S]{0,2600}await\s+resolveCommittedOfferSheetLifecycleState/
    );
    expect(content).not.toMatch(
      /executeWorldModeOfferSheetLifecycleMutation[\s\S]{0,3200}refreshWorldRosterIndex/
    );
  });

  it('keeps lifecycle final-state handling off the generic authoritative mutation sync helper', () => {
    expect(content).not.toMatch(
      /runOfferSheetResolutionAction[\s\S]{0,2600}runAuthoritativeFAMutation/
    );
    expect(content).not.toMatch(
      /handleFinalizeOfferSheet[\s\S]{0,3200}runAuthoritativeFAMutation/
    );
    expect(content).toMatch(
      /runAuthoritativeFAMutation[\s\S]{0,2200}await\s+syncTeamFromMutationResult\s*\(\s*mutationType\s*,\s*result\s*\)/
    );
  });
});

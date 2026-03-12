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
 *  10. Current team sync reads changedTeams
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// === FILE PATH CONSTANTS ===

const MUTATION_PIPELINE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/mutationPipeline.js'
);

const CAP_LEGALITY_VALIDATION_AUTHORITY_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation.ts'
);

const USE_ARCHITECT_ACTIONS_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectActions.ts'
);

const OFFER_SHEET_LIST_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/components/OfferSheetList.jsx'
);

const FREE_AGENCY_SECTION_PATH = path.resolve(
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
      /return\s*\{\s*homeTeam\s*,\s*offeringTeam\s*,\s*offerSheetId\s*\}/.test(
        content
      );
    expect(returnsBothTeams).toBe(true);
  });
});

// === GATE 3: Validation Uses validateOfferSheetResolution ===

describe('Gate 3: Validation uses validateOfferSheetResolution (E1)', () => {
  const pipelineContent = readFileContent(MUTATION_PIPELINE_PATH);
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

  it('mutationPipeline imports validateOfferSheetResolution', () => {
    const importsValidator =
      /import[\s\S]{0,500}validateOfferSheetResolution[\s\S]{0,200}from/.test(
        pipelineContent
      );
    expect(importsValidator).toBe(true);
  });

  it('validateOfferSheetResolution is called for match action', () => {
    const usedForMatch =
      /validateOfferSheetResolution\s*\(\s*\{[\s\S]{0,200}action\s*:\s*['"]match['"]/.test(
        pipelineContent
      );
    expect(usedForMatch).toBe(true);
  });

  it('validateOfferSheetResolution is called for decline action', () => {
    const usedForDecline =
      /validateOfferSheetResolution\s*\(\s*\{[\s\S]{0,200}action\s*:\s*['"]decline['"]/.test(
        pipelineContent
      );
    expect(usedForDecline).toBe(true);
  });

  it('validateOfferSheetResolution is called for finalize action', () => {
    const usedForFinalize =
      /validateOfferSheetResolution\s*\(\s*\{[\s\S]{0,200}action\s*:\s*['"]finalize['"]/.test(
        pipelineContent
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
      /computeStoreOfferSheetResult[\s\S]{0,6000}teamUpdates\.push\s*\(\s*\{\s*teamCode\s*:\s*homeTeam\.teamCode/.test(
        content
      );
    expect(returnsBothTeams).toBe(true);
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
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,2000}updatedHomeTeam\.incomingOfferSheets\s*=[\s\S]{0,200}filter/.test(
        content
      );
    expect(removesFromHome).toBe(true);
  });

  it('applies contract to player on home team', () => {
    const appliesContract =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,3500}updatedPlayer\.contract\s*=/.test(
        content
      );
    expect(appliesContract).toBe(true);
  });

  it('calls computeTeamCapTotals for home team', () => {
    const recomputesTotals =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,4500}updatedHomeTeam\.totals\s*=\s*computeTeamCapTotals/.test(
        content
      );
    expect(recomputesTotals).toBe(true);
  });

  it('cleans up offer sheet from offering team', () => {
    const cleansUpOffering =
      /computeFinalizeMatchedOfferSheetResult[\s\S]{0,5500}updatedOfferingTeam\.offerSheets\s*=[\s\S]{0,200}filter/.test(
        content
      );
    expect(cleansUpOffering).toBe(true);
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

  it('calls computeTeamCapTotals for offering team', () => {
    const recomputesOfferingTotals =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,6000}updatedOfferingTeam\.totals\s*=\s*computeTeamCapTotals/.test(
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

  it('calls computeTeamCapTotals for home team', () => {
    const recomputesHomeTotals =
      /computeFinalizeDeclinedOfferSheetResult[\s\S]{0,8000}updatedHomeTeam\.totals\s*=\s*computeTeamCapTotals/.test(
        content
      );
    expect(recomputesHomeTotals).toBe(true);
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
      /for\s*\(\s*const\s*\{\s*teamCode\s*,\s*team\s*\}\s*of\s+computeResult\.teamUpdates\s*\)/.test(
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

  it('OfferSheetList calls onMatch handler', () => {
    const callsOnMatch = /onMatch\s*\?\.\s*\(/.test(offerSheetListContent);
    expect(callsOnMatch).toBe(true);
  });

  it('OfferSheetList calls onDecline handler', () => {
    const callsOnDecline = /onDecline\s*\?\.\s*\(/.test(offerSheetListContent);
    expect(callsOnDecline).toBe(true);
  });

  it('OfferSheetList calls onFinalize handler', () => {
    const callsOnFinalize = /onFinalize\s*\?\.\s*\(/.test(
      offerSheetListContent
    );
    expect(callsOnFinalize).toBe(true);
  });

  it('OfferSheetList has actionsDisabled prop for world gating', () => {
    const hasActionsDisabled = /actionsDisabled\s*[=:]/.test(
      offerSheetListContent
    );
    expect(hasActionsDisabled).toBe(true);
  });

  it('FreeAgencySection passes actionsDisabled based on worldId', () => {
    const passesWorldGating = /actionsDisabled\s*=\s*\{\s*!worldId\s*\}/.test(
      freeAgencySectionContent
    );
    expect(passesWorldGating).toBe(true);
  });
});

// === GATE 10: Current Team Sync Reads changedTeams ===

describe('Gate 10: Current team sync reads changedTeams (E1)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('syncTeamFromMutationResult helper is defined', () => {
    const hasSyncHelper =
      /const\s+syncTeamFromMutationResult\s*=\s*useCallback/.test(content);
    expect(hasSyncHelper).toBe(true);
  });

  it('reads changedTeams from result', () => {
    const readsChangedTeams =
      /result\?\.changedTeams|result\.changedTeams/.test(content);
    expect(readsChangedTeams).toBe(true);
  });

  it('finds current team update by teamCode', () => {
    const findsCurrentTeam =
      /changedTeams\.find[\s\S]{0,200}teamCode\s*===\s*teamCode/.test(content);
    expect(findsCurrentTeam).toBe(true);
  });

  it('calls setTeamCapSheet with current team data', () => {
    const callsSetTeamCapSheet =
      /setTeamCapSheet\s*\(\s*currentTeamUpdate\.team/.test(content);
    expect(callsSetTeamCapSheet).toBe(true);
  });
});

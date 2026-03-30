/**
 * FILE: src/tests/architect/freeAgency_closure.gate.test.ts
 * PURPOSE: Ownership-boundary closure gates for Free Agency action routing.
 * OWNERSHIP: Feature: architect/free-agency
 *
 * HISTORY:
 *  - 2026-03-01: Created for TM_FREE_AGENCY_E2 world-mode offer-sheet wiring permanence.
 *  - 2026-03-30: Reworked for FA-1A to pin the explicit Free Agency action-owner boundary.
 *
 * GATES:
 *  1. useArchitectActions publishes one explicit Free Agency action owner
 *  2. GMDashboard and FreeAgencySection hand off grouped Free Agency authority
 *  3. FreeAgentPool remains a staging / dispatch surface, not a mutation owner
 *  4. EditContractModal remains a callback dispatcher for Free Agency actions
 *  5. The authoritative hook path still owns store-offer-sheet mutation and sync
 *  6. ActiveTab union still includes runtime fa/cap/capfull keys
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const FREE_AGENT_POOL_PATH = path.resolve(
  __dirname,
  '../../features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx'
);

const USE_ARCHITECT_ACTIONS_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectActions.ts'
);

const FREE_AGENCY_SECTION_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/sections/FreeAgencySection.tsx'
);

const GMDASHBOARD_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/GMDashboard.tsx'
);

const EDIT_CONTRACT_MODAL_PATH = path.resolve(
  __dirname,
  '../../shared/components/EditContractModal.tsx'
);

const USE_ARCHITECT_STATE_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectState.ts'
);

const readFileContent = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Gate file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
};

const readRegion = (content: string, start: string, end: string): string => {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end, startIndex + start.length);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(
      `Unable to read region between "${start}" and "${end}".`
    );
  }

  return content.slice(startIndex, endIndex);
};

describe('Gate 1: useArchitectActions publishes one explicit Free Agency owner (FA-1A)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('defines and builds a FreeAgencyActionOwner surface', () => {
    expect(content).toMatch(/export\s+interface\s+FreeAgencyActionOwner/);
    expect(content).toMatch(
      /const\s+freeAgencyActionOwner\s*=\s*useMemo<FreeAgencyActionOwner>/
    );
  });

  it('maps grouped owner callbacks directly to the authoritative Free Agency handlers', () => {
    expect(content).toMatch(/signFreeAgent:\s*handleSign/);
    expect(content).toMatch(/signAndTrade:\s*handleSignAndTrade/);
    expect(content).toMatch(/storeOfferSheet:\s*handleStoreOfferSheet/);
    expect(content).toMatch(/matchOfferSheet:\s*handleMatchOfferSheet/);
    expect(content).toMatch(/declineOfferSheet:\s*handleDeclineOfferSheet/);
    expect(content).toMatch(/finalizeOfferSheet:\s*handleFinalizeOfferSheet/);
  });

  it('returns the grouped owner while keeping flat Free Agency handlers for compatibility', () => {
    expect(content).toMatch(/return\s*\{\s*[\s\S]*freeAgencyActionOwner,/);
    expect(content).toMatch(/return\s*\{\s*[\s\S]*handleSign,/);
    expect(content).toMatch(/return\s*\{\s*[\s\S]*handleStoreOfferSheet,/);
    expect(content).toMatch(/return\s*\{\s*[\s\S]*handleFinalizeOfferSheet,/);
  });
});

describe('Gate 2: dashboard and section hand off grouped Free Agency authority (FA-1A)', () => {
  const gmDashboardContent = readFileContent(GMDASHBOARD_PATH);
  const freeAgencySectionContent = readFileContent(FREE_AGENCY_SECTION_PATH);
  const gmDashboardFreeAgencyRegion = readRegion(
    gmDashboardContent,
    "{activeTab === 'fa' && (",
    "{activeTab === 'offseason' && ("
  );

  it('GMDashboard reads one grouped owner from useArchitectActions and passes it into FreeAgencySection', () => {
    expect(gmDashboardContent).toMatch(
      /const\s+freeAgencyActionOwner\s*=\s*actions\.freeAgencyActionOwner/
    );
    expect(gmDashboardFreeAgencyRegion).toMatch(
      /<FreeAgencySection[\s\S]*actionOwner=\{freeAgencyActionOwner\}/
    );
  });

  it('GMDashboard Free Agency tab no longer wires split mutation callbacks directly', () => {
    const forbiddenProps = [
      /onSign=/,
      /onSignAndTrade=/,
      /getSignAndTradePreflight=/,
      /getOfferSheetPreflight=/,
      /onStoreOfferSheet=/,
      /onMatch=/,
      /onDecline=/,
      /onFinalize=/,
      /teamCapSheet=/,
    ];

    for (const forbidden of forbiddenProps) {
      expect(gmDashboardFreeAgencyRegion).not.toMatch(forbidden);
    }
  });

  it('FreeAgencySection stays a thin wiring surface over the grouped owner', () => {
    expect(freeAgencySectionContent).toMatch(
      /const\s+handleMatchOfferSheet\s*=/
    );
    expect(freeAgencySectionContent).toMatch(
      /const\s+handleDeclineOfferSheet\s*=/
    );
    expect(freeAgencySectionContent).toMatch(
      /const\s+handleFinalizeOfferSheet\s*=/
    );
    expect(freeAgencySectionContent).toMatch(
      /handleMatchOfferSheet[\s\S]*actionOwner\.matchOfferSheet/
    );
    expect(freeAgencySectionContent).toMatch(
      /handleDeclineOfferSheet[\s\S]*actionOwner\.declineOfferSheet/
    );
    expect(freeAgencySectionContent).toMatch(
      /handleFinalizeOfferSheet[\s\S]*actionOwner\.finalizeOfferSheet/
    );
    expect(freeAgencySectionContent).toMatch(
      /onMatch=\{handleMatchOfferSheet\}/
    );
    expect(freeAgencySectionContent).toMatch(
      /onDecline=\{handleDeclineOfferSheet\}/
    );
    expect(freeAgencySectionContent).toMatch(
      /onFinalize=\{handleFinalizeOfferSheet\}/
    );
    expect(freeAgencySectionContent).toMatch(
      /<FreeAgentPool[\s\S]*actionOwner=\{actionOwner/
    );
  });
});

describe('Gate 3: FreeAgentPool stays staging / dispatch only (FA-1A)', () => {
  const content = readFileContent(FREE_AGENT_POOL_PATH);
  const modalDispatchRegion = readRegion(
    content,
    'const freeAgencyModalDispatch = useMemo(',
    '  return ('
  );

  it('passes standard signing directly from the grouped owner into the modal dispatch object', () => {
    expect(modalDispatchRegion).toMatch(
      /onSignFreeAgent:\s*actionOwner\.signFreeAgent/
    );
  });

  it('builds one world-gated modal dispatch object from the grouped owner', () => {
    expect(modalDispatchRegion).toMatch(/worldId\s*\?\s*actionOwner\.signAndTrade/);
    expect(modalDispatchRegion).toMatch(
      /worldId\s*\?\s*actionOwner\.getSignAndTradePreflight/
    );
    expect(modalDispatchRegion).toMatch(
      /worldId\s*\?\s*actionOwner\.getOfferSheetPreflight/
    );
    expect(modalDispatchRegion).toMatch(
      /worldId\s*\?\s*actionOwner\.storeOfferSheet/
    );
  });

  it('does not keep a local standard-signing payload adapter or salary-row builder', () => {
    expect(content).not.toMatch(/dispatchStandardSigningToActionOwner/);
    expect(content).not.toMatch(/salariesByYear\.push/);
    expect(content).not.toMatch(/toSeasonCode/);
    expect(content).not.toMatch(/yearsLeft:/);
  });

  it('does not import or run mutation-layer executors directly', () => {
    const forbiddenPatterns = [
      /applyWorldMutation/,
      /computeWorldMutation/,
      /preflightSignAndTradeMutation/,
      /preflightOfferSheetMutation/,
      /runAuthoritativeFAMutation/,
    ];

    for (const forbidden of forbiddenPatterns) {
      expect(content).not.toMatch(forbidden);
    }
  });
});

describe('Gate 4: EditContractModal remains a callback dispatcher for Free Agency actions (FA-1A)', () => {
  const content = readFileContent(EDIT_CONTRACT_MODAL_PATH);
  const dispatchRegion = readRegion(
    content,
    'const dispatchSelectedFreeAgencyAction = useCallback(',
    '  const handleConfirm = async () => {'
  );

  it('extracts Free Agency confirm handling into one dispatch helper', () => {
    expect(content).toMatch(
      /const\s+dispatchSelectedFreeAgencyAction\s*=\s*useCallback/
    );
    expect(content).toMatch(/const\s+buildSigningDispatchPayload\s*=\s*useCallback/);
    expect(content).not.toMatch(/buildCanonicalSigningPayload/);
    expect(dispatchRegion).toMatch(/onStoreOfferSheet\?\./);
    expect(dispatchRegion).toMatch(/onSignFreeAgent\?\./);
    expect(dispatchRegion).toMatch(/onResign\?\./);
    expect(dispatchRegion).toMatch(/onSignAndTrade\?\./);
  });

  it('delegates signNew, resign, and signAndTrade confirm paths through the dispatch helper', () => {
    expect(content).toMatch(
      /selectedAction\s*===\s*'signNew'[\s\S]*selectedAction\s*===\s*'resign'[\s\S]*selectedAction\s*===\s*'signAndTrade'/
    );
    expect(content).toMatch(
      /actionResult\s*=\s*await\s+dispatchSelectedFreeAgencyAction\(overrideMetadata\)/
    );
  });

  it('does not import or execute mutation-layer ownership logic directly', () => {
    const forbiddenPatterns = [
      /applyWorldMutation/,
      /computeWorldMutation/,
      /preflightSignAndTradeMutation/,
      /preflightOfferSheetMutation/,
      /runAuthoritativeFAMutation/,
    ];

    for (const forbidden of forbiddenPatterns) {
      expect(content).not.toMatch(forbidden);
    }
  });
});

describe('Gate 5: authoritative hook path still owns world mutation and sync (FA-1A)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('routes Free Agency signing and signing-preflight paths through one authoritative preparation helper', () => {
    expect(content).toMatch(
      /const\s+prepareAuthoritativeSigningDetails\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /handleSign[\s\S]{0,3200}prepareAuthoritativeSigningDetails/
    );
    expect(content).toMatch(
      /handleSignAndTrade[\s\S]{0,3200}prepareAuthoritativeSigningDetails/
    );
    expect(content).toMatch(
      /getSignAndTradePreflight[\s\S]{0,3200}prepareAuthoritativeSigningDetails/
    );
    expect(content).toMatch(
      /getOfferSheetPreflight[\s\S]{0,3200}prepareAuthoritativeSigningDetails/
    );
    expect(content).toMatch(
      /handleStoreOfferSheet[\s\S]{0,3200}prepareAuthoritativeSigningDetails/
    );
  });

  it('stores offer sheets through runAuthoritativeFAMutation with the canonical mutation key', () => {
    expect(content).toMatch(
      /const\s+handleStoreOfferSheet\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /handleStoreOfferSheet[\s\S]{0,2600}runAuthoritativeFAMutation\s*\(\s*['"]storeOfferSheet['"]/
    );
  });

  it('keeps authoritative team sync inside useArchitectActions after successful world mutations', () => {
    expect(content).toMatch(
      /const\s+syncTeamFromMutationResult\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /findUpdatedTeamSnapshot\s*\(\s*result\?\.changedTeams\s*,\s*teamCode\s*\)/
    );
    expect(content).toMatch(
      /runAuthoritativeFAMutation[\s\S]{0,2200}await\s+syncTeamFromMutationResult\s*\(\s*mutationType\s*,\s*result\s*\)/
    );
  });
});

describe('Gate 6: ActiveTab includes fa/cap/capfull runtime keys (E1 cleanup)', () => {
  const content = readFileContent(USE_ARCHITECT_STATE_PATH);

  it('defines ActiveTab union type', () => {
    expect(content).toMatch(/type\s+ActiveTab\s*=/);
  });

  it('ActiveTab union includes fa', () => {
    expect(content).toMatch(/type\s+ActiveTab[\s\S]{0,240}['"]fa['"]/);
  });

  it('ActiveTab union includes cap and capfull', () => {
    expect(content).toMatch(/type\s+ActiveTab[\s\S]{0,240}['"]cap['"]/);
    expect(content).toMatch(/type\s+ActiveTab[\s\S]{0,240}['"]capfull['"]/);
  });
});

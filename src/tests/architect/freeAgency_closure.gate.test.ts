/**
 * FILE: src/tests/architect/freeAgency_closure.gate.test.ts
 * PURPOSE: Ownership-boundary closure gates for Free Agency action routing.
 * OWNERSHIP: Feature: architect/free-agency
 *
 * HISTORY:
 *  - 2026-03-01: Created for TM_FREE_AGENCY_E2 world-mode offer-sheet wiring permanence.
 *  - 2026-03-30: Reworked for FA-1A to pin the explicit Free Agency action-owner boundary.
 *  - 2026-03-30: Reworked for FA-1C to pin the explicit dual-path vs world-only owner split.
 *  - 2026-03-30: Hardened for FA-1D to pin grouped-owner permanence and world-only fail-closed routes.
 *  - 2026-03-30: Hardened for FA-2D to keep Step 2 UI-truth seams closed.
 *  - 2026-03-30: Hardened for FA-3A / FA-3B standard-sign payload and legality alignment.
 *
 * GATES:
 *  1. useArchitectActions publishes one explicit dual-path vs world-only Free Agency owner
 *  2. Free Agency UI prop contracts stay grouped behind actionOwner
 *  3. GMDashboard and FreeAgencySection hand off grouped Free Agency authority
 *  4. FreeAgentPool remains a staging / dispatch surface, not a mutation owner
 *  4B. Step 2 UI truth keeps shared launch, owner-projected availability, and shared-entry identity
 *  5. EditContractModal remains a callback dispatcher and stages lean standard-sign payloads
 *  6. The authoritative hook path keeps world-only routes fail-closed, canonical, and standard-sign aligned
 *  7. ActiveTab union still includes runtime fa/cap/capfull keys
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

const FREE_AGENT_POOL_TYPES_PATH = path.resolve(
  __dirname,
  '../../features/architect/freeAgency/FreeAgentPool/types.ts'
);

const FREE_AGENT_ROW_PATH = path.resolve(
  __dirname,
  '../../features/architect/freeAgency/FreeAgentPool/FreeAgentRow.tsx'
);

const SELECTED_FREE_AGENT_CARDS_PATH = path.resolve(
  __dirname,
  '../../features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx'
);

const FREE_AGENT_CARD_PATH = path.resolve(
  __dirname,
  '../../features/architect/freeAgency/FreeAgentPool/FreeAgentCard.tsx'
);

const USE_ARCHITECT_ACTIONS_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectActions.ts'
);

const OFFER_SHEET_TYPES_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/offerSheetTypes.ts'
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

describe('Gate 1: useArchitectActions publishes one explicit dual-path vs world-only owner (FA-1C)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('defines explicit dual-path and world-only owner types before the grouped action owner', () => {
    expect(content).toMatch(
      /export\s+interface\s+FreeAgencyDualPathSigningOwner/
    );
    expect(content).toMatch(
      /export\s+interface\s+FreeAgencyWorldOnlyActionOwner/
    );
    expect(content).toMatch(
      /export\s+interface\s+FreeAgentModalAvailability/
    );
    expect(content).toMatch(/export\s+interface\s+FreeAgencyActionOwner/);
  });

  it('builds the grouped owner from a dedicated world-only owner split plus explicit modal-availability truth', () => {
    expect(content).toMatch(
      /const\s+freeAgencyWorldOnlyActionOwner\s*=\s*useMemo<FreeAgencyWorldOnlyActionOwner\s*\|\s*null>/
    );
    expect(content).toMatch(
      /const\s+freeAgentModalAvailability\s*=\s*useMemo<FreeAgentModalAvailability>/
    );
    expect(content).toMatch(
      /const\s+signAndTradeInitiation\s*=\s*useMemo<FreeAgentSignAndTradeInitiation\s*\|\s*null>/
    );
    expect(content).toMatch(
      /const\s+freeAgencyActionOwner\s*=\s*useMemo<FreeAgencyActionOwner>/
    );
  });

  it('maps standard signing into dualPathSigning, fences world-only callbacks behind the world-only owner, and derives visible modal availability from handler completeness', () => {
    expect(content).toMatch(
      /dualPathSigning:\s*\{\s*signFreeAgent:\s*handleSign/
    );
    expect(content).toMatch(/worldOnly:\s*freeAgencyWorldOnlyActionOwner/);
    expect(content).toMatch(
      /const\s+freeAgencyActionOwner\s*=\s*useMemo<FreeAgencyActionOwner>[\s\S]*freeAgentModalAvailability,/
    );
    expect(content).toMatch(/worldId[\s\S]*\?\s*\{[\s\S]*signAndTrade:\s*handleSignAndTrade/);
    expect(content).toMatch(
      /const\s+hasWorldOnlySignAndTradeAvailability\s*=\s*Boolean\([\s\S]*freeAgencyWorldOnlyActionOwner\?\.signAndTrade[\s\S]*freeAgencyWorldOnlyActionOwner\.getSignAndTradePreflight/
    );
    expect(content).toMatch(
      /const\s+hasWorldOnlyOfferSheetAvailability\s*=\s*Boolean\([\s\S]*freeAgencyWorldOnlyActionOwner\?\.storeOfferSheet[\s\S]*freeAgencyWorldOnlyActionOwner\.getOfferSheetPreflight/
    );
    expect(content).toMatch(
      /const\s+signAndTradeInitiation\s*=\s*useMemo<FreeAgentSignAndTradeInitiation\s*\|\s*null>\([\s\S]*hasWorldOnlySignAndTradeAvailability(?:\s*&&\s*freeAgencyWorldOnlyActionOwner)?[\s\S]*\?\s*\{[\s\S]*onSignAndTrade:\s*freeAgencyWorldOnlyActionOwner\.signAndTrade[\s\S]*getSignAndTradePreflight:\s*freeAgencyWorldOnlyActionOwner\.getSignAndTradePreflight[\s\S]*\}\s*:\s*null/
    );
    expect(content).toMatch(
      /const\s+offerSheetInitiation\s*=\s*useMemo<FreeAgentOfferSheetInitiation\s*\|\s*null>\([\s\S]*hasWorldOnlyOfferSheetAvailability(?:\s*&&\s*freeAgencyWorldOnlyActionOwner)?[\s\S]*\?\s*\{[\s\S]*getOfferSheetPreflight:\s*freeAgencyWorldOnlyActionOwner\.getOfferSheetPreflight[\s\S]*storeOfferSheet:\s*freeAgencyWorldOnlyActionOwner\.storeOfferSheet[\s\S]*\}\s*:\s*null/
    );
    expect(content).toMatch(
      /visibleActions:\s*signAndTradeInitiation\s*\?\s*\['signNew',\s*'signAndTrade'\]\s*:\s*\['signNew'\]/
    );
    expect(content).toMatch(
      /showOfferSheetToggle:\s*Boolean\(offerSheetInitiation\)/
    );
    expect(content).toMatch(/offerSheetInitiation,\s*\}\)/);
    expect(content).toMatch(/storeOfferSheet:\s*handleStoreOfferSheet/);
    expect(content).toMatch(/matchOfferSheet:\s*handleMatchOfferSheet/);
    expect(content).toMatch(/declineOfferSheet:\s*handleDeclineOfferSheet/);
    expect(content).toMatch(/finalizeOfferSheet:\s*handleFinalizeOfferSheet/);
    expect(content).toMatch(/\}\s*:\s*null/);
  });

  it('returns the grouped owner while keeping flat Free Agency handlers for compatibility', () => {
    expect(content).toMatch(/return\s*\{\s*[\s\S]*freeAgencyActionOwner,/);
    expect(content).toMatch(/return\s*\{\s*[\s\S]*handleSign,/);
    expect(content).toMatch(/return\s*\{\s*[\s\S]*handleStoreOfferSheet,/);
    expect(content).toMatch(/return\s*\{\s*[\s\S]*handleFinalizeOfferSheet,/);
  });
});

describe('Gate 2: Free Agency UI prop contracts stay grouped behind actionOwner (FA-1D)', () => {
  const offerSheetTypesContent = readFileContent(OFFER_SHEET_TYPES_PATH);
  const freeAgentPoolTypesContent = readFileContent(FREE_AGENT_POOL_TYPES_PATH);
  const freeAgencySectionPropsRegion = readRegion(
    offerSheetTypesContent,
    'export interface FreeAgencySectionProps {',
    '}'
  );
  const freeAgentPoolPropsRegion = readRegion(
    freeAgentPoolTypesContent,
    'export interface FreeAgentPoolProps {',
    '}'
  );

  it('imports FreeAgencyActionOwner from the authoritative action hook in both UI prop surfaces', () => {
    expect(offerSheetTypesContent).toMatch(
      /import\s+type\s+\{\s*FreeAgencyActionOwner\s*\}\s+from\s+['"].\/hooks\/useArchitectActions['"]/
    );
    expect(freeAgentPoolTypesContent).toMatch(
      /import\s+type\s+\{\s*FreeAgencyActionOwner\s*\}\s+from\s+['"]@\/features\/architect\/GMDashboard\/hooks\/useArchitectActions['"]/
    );
  });

  it('keeps FreeAgencySectionProps and FreeAgentPoolProps grouped behind actionOwner', () => {
    expect(freeAgencySectionPropsRegion).toMatch(
      /actionOwner:\s*FreeAgencyActionOwner;/
    );
    expect(freeAgentPoolPropsRegion).toMatch(
      /actionOwner:\s*FreeAgencyActionOwner;/
    );
  });

  it('does not re-expand grouped Free Agency handler props on the public section or pool contracts', () => {
    const forbiddenPatterns = [
      /onSign\??:/,
      /onSignAndTrade\??:/,
      /getSignAndTradePreflight\??:/,
      /getOfferSheetPreflight\??:/,
      /onStoreOfferSheet\??:/,
      /onMatch\??:/,
      /onDecline\??:/,
      /onFinalize\??:/,
      /playersById\??:/,
      /worldId\??:/,
    ];

    for (const forbidden of forbiddenPatterns) {
      expect(freeAgencySectionPropsRegion).not.toMatch(forbidden);
      expect(freeAgentPoolPropsRegion).not.toMatch(forbidden);
    }
  });

  it('keeps the offer-sheet list contract role-aware with one unified lifecycle callback', () => {
    expect(offerSheetTypesContent).toMatch(
      /export\s+type\s+OfferSheetSurfaceRole\s*=\s*'incoming'\s*\|\s*'outgoing'/
    );
    expect(offerSheetTypesContent).toMatch(
      /export\s+type\s+OfferSheetLifecycleAction\s*=\s*[\s\S]*'match'[\s\S]*'decline'[\s\S]*'finalizeMatched'[\s\S]*'finalizeDeclined'/
    );
    expect(offerSheetTypesContent).toMatch(
      /export\s+interface\s+OfferSheetLifecycleActionEvent\s*\{/
    );
    expect(offerSheetTypesContent).toMatch(/surfaceRole:\s*OfferSheetSurfaceRole;/);
    expect(offerSheetTypesContent).toMatch(
      /onLifecycleAction\?:\s*\(event:\s*OfferSheetLifecycleActionEvent\)\s*=>\s*unknown;/
    );
    expect(offerSheetTypesContent).not.toMatch(/isIncoming\??:/);
    expect(offerSheetTypesContent).not.toMatch(/onMatch\??:/);
    expect(offerSheetTypesContent).not.toMatch(/onDecline\??:/);
    expect(offerSheetTypesContent).not.toMatch(/onFinalize\??:/);
  });
});

describe('Gate 3: dashboard and section hand off grouped Free Agency authority (FA-1A)', () => {
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
    expect(gmDashboardContent).toMatch(
      /const\s+freeAgencyWorldOnlyOwner\s*=\s*freeAgencyActionOwner\.worldOnly/
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
      /const\s+worldOnlyActionOwner\s*=\s*actionOwner\.worldOnly/
    );
    expect(freeAgencySectionContent).toMatch(
      /const\s+hasWorldOnlyActions\s*=\s*Boolean\(worldOnlyActionOwner\)/
    );
    expect(freeAgencySectionContent).toMatch(
      /const\s+incomingOfferSheetSurface\s*=\s*\{[\s\S]*surfaceRole:\s*'incoming'/
    );
    expect(freeAgencySectionContent).toMatch(
      /const\s+outgoingOfferSheetSurface\s*=\s*\{[\s\S]*surfaceRole:\s*'outgoing'/
    );
    expect(freeAgencySectionContent).toMatch(
      /const\s+handleOfferSheetLifecycleAction\s*:/
    );
    expect(freeAgencySectionContent).toMatch(
      /handleOfferSheetLifecycleAction[\s\S]*worldOnlyActionOwner\?\.matchOfferSheet/
    );
    expect(freeAgencySectionContent).toMatch(
      /handleOfferSheetLifecycleAction[\s\S]*worldOnlyActionOwner\?\.declineOfferSheet/
    );
    expect(freeAgencySectionContent).toMatch(
      /handleOfferSheetLifecycleAction[\s\S]*worldOnlyActionOwner\?\.finalizeOfferSheet/
    );
    expect(freeAgencySectionContent).toMatch(
      /<OfferSheetList[\s\S]*\{\.\.\.incomingOfferSheetSurface\}[\s\S]*onLifecycleAction=\{handleOfferSheetLifecycleAction\}/
    );
    expect(freeAgencySectionContent).toMatch(
      /<OfferSheetList[\s\S]*\{\.\.\.outgoingOfferSheetSurface\}[\s\S]*onLifecycleAction=\{handleOfferSheetLifecycleAction\}/
    );
    expect(freeAgencySectionContent).toMatch(
      /<FreeAgentPool[\s\S]*actionOwner=\{actionOwner/
    );
    expect(freeAgencySectionContent).not.toMatch(/onMatch=/);
    expect(freeAgencySectionContent).not.toMatch(/onDecline=/);
    expect(freeAgencySectionContent).not.toMatch(/onFinalize=/);
    expect(freeAgencySectionContent).not.toMatch(/worldId,/);
  });
});

describe('Gate 4: FreeAgentPool stays staging / dispatch only with explicit dual-path vs world-only routing (FA-1C)', () => {
  const content = readFileContent(FREE_AGENT_POOL_PATH);
  const freeAgentPoolTypesContent = readFileContent(FREE_AGENT_POOL_TYPES_PATH);
  const freeAgentRowContent = readFileContent(FREE_AGENT_ROW_PATH);
  const selectedFreeAgentCardsContent = readFileContent(
    SELECTED_FREE_AGENT_CARDS_PATH
  );
  const freeAgentCardContent = readFileContent(FREE_AGENT_CARD_PATH);
  const modalDispatchRegion = readRegion(
    content,
    'const freeAgentModalAvailability = actionOwner.freeAgentModalAvailability;',
    '  return ('
  );

  it('passes standard signing directly from the grouped owner into the modal dispatch object', () => {
    expect(modalDispatchRegion).toMatch(
      /onSignFreeAgent:\s*dualPathSigningOwner\s*\.signFreeAgent/
    );
  });

  it('builds one shared surface-entry identity model for row display, selection, and modal staging', () => {
    expect(freeAgentPoolTypesContent).toMatch(
      /export\s+interface\s+FreeAgentSurfaceEntry/
    );
    expect(freeAgentPoolTypesContent).toMatch(
      /surfacePlayer:\s*ResolvedFreeAgentPlayer;/
    );
    expect(freeAgentPoolTypesContent).toMatch(/selectionKey:\s*string;/);
    expect(freeAgentPoolTypesContent).not.toMatch(/playersById\??:/);
    expect(content).toMatch(/const\s+buildFreeAgentSurfaceEntry\s*=\s*\(/);
    expect(content).toMatch(/const\s+entriesBySelectionKey\s*=\s*useMemo/);
    expect(content).toMatch(/const\s+selectedEntries\s*=\s*useMemo/);
  });

  it('reads world-only availability from the grouped owner instead of reconstructing it from worldId', () => {
    expect(content).toMatch(
      /const\s+freeAgentModalAvailability\s*=\s*actionOwner\.freeAgentModalAvailability/
    );
    expect(content).toMatch(
      /const\s+dualPathSigningOwner\s*=\s*actionOwner\.dualPathSigning/
    );
    expect(modalDispatchRegion).toMatch(
      /const\s+signAndTradeInitiation\s*=\s*freeAgentModalAvailability\.signAndTradeInitiation/
    );
    expect(modalDispatchRegion).toMatch(
      /const\s+offerSheetInitiation\s*=\s*freeAgentModalAvailability\.offerSheetInitiation/
    );
    expect(modalDispatchRegion).toMatch(
      /signAndTradeInitiation:\s*signAndTradeInitiation\s+as\s+EditContractModalProps\['signAndTradeInitiation'\]/
    );
    expect(modalDispatchRegion).toMatch(
      /offerSheetInitiation\s*\?\s*offerSheetInitiation\.getOfferSheetPreflight/
    );
    expect(modalDispatchRegion).toMatch(
      /offerSheetInitiation\s*\?\s*offerSheetInitiation\.storeOfferSheet/
    );
    expect(content).toMatch(
      /actionsOverride:\s*freeAgentModalAvailability\.visibleActions/
    );
    expect(content).toMatch(
      /actionLabelsOverride:\s*freeAgentModalAvailability\.actionLabelsOverride/
    );
    expect(content).toMatch(
      /showOfferSheetToggle:\s*freeAgentModalAvailability\.showOfferSheetToggle/
    );
    expect(content).toMatch(
      /getOfferSheetPreflight:\s*\(offerSheetInitiation[\s\S]*offerSheetInitiation\.getOfferSheetPreflight/
    );
    expect(content).toMatch(
      /onStoreOfferSheet:\s*\(offerSheetInitiation[\s\S]*offerSheetInitiation\.storeOfferSheet/
    );
    expect(content).not.toMatch(
      /actionsOverride:\s*worldOnlyActionOwner\s*\?\s*\['signNew',\s*'signAndTrade'\]\s*:\s*\['signNew'\]/
    );
    expect(content).not.toMatch(/worldId\s*=\s*null/);
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

  it('defines one shared contract-modal launch callback and passes it to both visible pool entry surfaces', () => {
    expect(content).toMatch(
      /const\s+openContractModal\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /setContractModalTarget\s*\(\s*buildFreeAgentModalLaunchTarget\(entry\)\s*\)/
    );
    expect(content).toMatch(
      /<SelectedFreeAgentCards[\s\S]*selectedEntries=\{selectedEntries\}[\s\S]*onOpenContractModal=\{openContractModal\}/
    );
    expect(content).toMatch(
      /<FreeAgentRow[\s\S]*entry=\{entry\}[\s\S]*onOpenContractModal=\{openContractModal\}/
    );
  });

  it('tracks selection and row-menu visibility by stable selection keys instead of player names', () => {
    expect(content).toMatch(
      /const\s+\[selectedPlayerKeys,\s*setSelectedPlayerKeys\]\s*=\s*useState<string\[\]>\(\[\]\)/
    );
    expect(content).toMatch(
      /const\s+\[openMenuSelectionKey,\s*setOpenMenuSelectionKey\]\s*=\s*useState/
    );
    expect(content).toMatch(/prev\.includes\(entry\.selectionKey\)/);
    expect(content).toMatch(/selectedPlayerKeysSet\.has\(entry\.selectionKey\)/);
    expect(content).not.toMatch(/selectedPlayers/);
    expect(content).not.toMatch(/p\.name\s*===\s*player\.name/);
    expect(content).not.toMatch(/player\.name\s+as\s+string/);
  });

  it('keeps child entry surfaces on the shared entry path instead of mixed raw player props', () => {
    expect(freeAgentPoolTypesContent).toMatch(
      /export\s+interface\s+FreeAgentRowProps\s*\{[\s\S]*entry:\s*FreeAgentSurfaceEntry;/
    );
    expect(freeAgentPoolTypesContent).toMatch(
      /export\s+interface\s+FreeAgentCardProps\s*\{[\s\S]*entry:\s*FreeAgentSurfaceEntry;/
    );
    expect(freeAgentRowContent).toMatch(
      /const\s+\{\s*surfacePlayer:\s*player,\s*freeAgent\s*\}\s*=\s*entry/
    );
    expect(freeAgentRowContent).toMatch(
      /openMenuSelectionKey\s*===\s*entry\.selectionKey/
    );
    expect(selectedFreeAgentCardsContent).toMatch(
      /selectedEntries:\s*FreeAgentSurfaceEntry\[\];/
    );
    expect(freeAgentCardContent).toMatch(
      /const\s+\{\s*surfacePlayer:\s*player\s*\}\s*=\s*entry/
    );
    expect(freeAgentCardContent).toMatch(/onRemove\(entry\.selectionKey\)/);
  });

  it('keeps row and selected-card entry surfaces free of modal ownership', () => {
    expect(freeAgentRowContent).not.toMatch(/EditContractModal/);
    expect(selectedFreeAgentCardsContent).not.toMatch(/EditContractModal/);
    expect(freeAgentCardContent).not.toMatch(/EditContractModal/);
  });
});

describe('Gate 4B: Step 2 UI truth keeps shared launch, owner-projected availability, and shared-entry identity durable (FA-2D)', () => {
  const freeAgentPoolContent = readFileContent(FREE_AGENT_POOL_PATH);
  const freeAgentPoolTypesContent = readFileContent(FREE_AGENT_POOL_TYPES_PATH);
  const freeAgentRowContent = readFileContent(FREE_AGENT_ROW_PATH);
  const selectedFreeAgentCardsContent = readFileContent(
    SELECTED_FREE_AGENT_CARDS_PATH
  );
  const freeAgentCardContent = readFileContent(FREE_AGENT_CARD_PATH);

  it('keeps the legacy Step 2 seams removed from the pool surface', () => {
    expect(freeAgentPoolContent).not.toMatch(/resolvePlayerData/);
    expect(freeAgentPoolContent).not.toMatch(
      /\[selectedPlayers,\s*setSelectedPlayers\]/
    );
    expect(freeAgentPoolContent).not.toMatch(
      /\[openMenuPlayerName,\s*setOpenMenuPlayerName\]/
    );
    expect(freeAgentPoolContent).not.toMatch(/playersById/);
    expect(freeAgentRowContent).not.toMatch(/openMenuPlayerName/);
  });

  it('keeps one shared launch callback and one shared staged modal identity path across both entry surfaces', () => {
    const sharedLaunchCallbackMatches =
      freeAgentPoolContent.match(/const\s+openContractModal\s*=\s*useCallback/g) ||
      [];
    const sharedLaunchPropMatches =
      freeAgentPoolContent.match(/onOpenContractModal=\{openContractModal\}/g) ||
      [];
    const stagedModalTargetMatches =
      freeAgentPoolContent.match(/buildFreeAgentModalLaunchTarget\(entry\)/g) ||
      [];

    expect(sharedLaunchCallbackMatches).toHaveLength(1);
    expect(sharedLaunchPropMatches).toHaveLength(2);
    expect(stagedModalTargetMatches).toHaveLength(1);
    expect(freeAgentPoolTypesContent).toMatch(
      /export\s+type\s+FreeAgentModalLaunchTarget\s*=\s*FreeAgentSurfaceEntry;/
    );
    expect(freeAgentPoolContent).toMatch(
      /player:\s*activeContractModalTarget\.surfacePlayer/
    );
  });

  it('keeps Step 2 UI truth routed only through grouped-owner availability and the shared entry contract', () => {
    expect(freeAgentPoolContent).toMatch(
      /const\s+freeAgentModalAvailability\s*=\s*actionOwner\.freeAgentModalAvailability/
    );
    expect(freeAgentPoolContent).toMatch(
      /actionsOverride:\s*freeAgentModalAvailability\.visibleActions/
    );
    expect(freeAgentPoolContent).toMatch(
      /showOfferSheetToggle:\s*freeAgentModalAvailability\.showOfferSheetToggle/
    );
    expect(freeAgentPoolTypesContent).toMatch(
      /export\s+interface\s+FreeAgentRowProps\s*\{[\s\S]*entry:\s*FreeAgentSurfaceEntry;/
    );
    expect(selectedFreeAgentCardsContent).toMatch(
      /selectedEntries:\s*FreeAgentSurfaceEntry\[\];/
    );
    expect(freeAgentCardContent).toMatch(
      /const\s+\{\s*surfacePlayer:\s*player\s*\}\s*=\s*entry/
    );
  });
});

describe('Gate 5: EditContractModal remains a callback dispatcher for Free Agency actions (FA-1A)', () => {
  const content = readFileContent(EDIT_CONTRACT_MODAL_PATH);
  const dispatchRegion = readRegion(
    content,
    'const dispatchSelectedFreeAgencyAction = useCallback(',
    '  const handleConfirm = async () => {'
  );
  const standardSigningDispatchRegion = readRegion(
    content,
    'const buildSigningDispatchPayload = useCallback(',
    '  const buildCanonicalSigningDispatchPayload = useCallback('
  );
  const canonicalSigningDispatchRegion = readRegion(
    content,
    '  const buildCanonicalSigningDispatchPayload = useCallback(',
    '  const buildOfferSheetDispatchPayload = useCallback('
  );

  it('extracts Free Agency confirm handling into one dispatch helper', () => {
    expect(content).toMatch(
      /const\s+dispatchSelectedFreeAgencyAction\s*=\s*useCallback/
    );
    expect(content).toMatch(/const\s+buildSigningDispatchPayload\s*=\s*useCallback/);
    expect(content).toMatch(
      /const\s+buildCanonicalSigningDispatchPayload\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+resolvedOfferSheetInitiation\s*=\s*useMemo<OfferSheetInitiation\s*\|\s*null>/
    );
    expect(content).toMatch(
      /const\s+buildOfferSheetDispatchPayload\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+resolvedSignAndTradeInitiation\s*=\s*useMemo<SignAndTradeInitiation\s*\|\s*null>/
    );
    expect(content).toMatch(
      /const\s+signAndTradeDispatchPayload\s*=\s*useMemo/
    );
    expect(content).not.toMatch(/buildCanonicalSigningPayload/);
    expect(dispatchRegion).toMatch(/resolvedOfferSheetInitiation\?\.onStoreOfferSheet\?\./);
    expect(dispatchRegion).toMatch(/onSignFreeAgent\?\./);
    expect(dispatchRegion).toMatch(/onResign\?\./);
    expect(dispatchRegion).toMatch(
      /resolvedSignAndTradeInitiation\?\.onSignAndTrade\?\./
    );
  });

  it('keeps standard signNew and resign dispatch lean instead of finalizing canonical rows or totals in the modal', () => {
    const forbiddenPatterns = [
      /salariesByYear/,
      /base:/,
      /totalValue/,
      /averageAnnualValue/,
      /firstYearGuaranteed/,
    ];

    for (const forbidden of forbiddenPatterns) {
      expect(standardSigningDispatchRegion).not.toMatch(forbidden);
    }
    expect(canonicalSigningDispatchRegion).not.toMatch(
      /rfaOfferSheetStatus:\s*'PENDING_MATCH'/
    );
  });

  it('delegates signNew, resign, and signAndTrade confirm paths through the dispatch helper', () => {
    expect(content).toMatch(
      /selectedAction\s*===\s*'signNew'[\s\S]*selectedAction\s*===\s*'resign'[\s\S]*selectedAction\s*===\s*'signAndTrade'/
    );
    expect(content).toMatch(
      /actionResult\s*=\s*await\s+dispatchSelectedFreeAgencyAction\(overrideMetadata\)/
    );
    expect(dispatchRegion).toMatch(
      /signAndTradeDispatchPayload/
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

describe('Gate 6: authoritative hook path keeps world-only Free Agency routes fail-closed and canonical (FA-1D)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);
  const handleSignRegion = readRegion(
    content,
    'const handleSign = useCallback(',
    'const applyCommittedSignAndTradeState = useCallback('
  );
  const applyCommittedSignAndTradeStateRegion = readRegion(
    content,
    'const applyCommittedSignAndTradeState = useCallback(',
    'const executeWorldModeSignAndTrade = useCallback('
  );
  const executeWorldModeSignAndTradeRegion = readRegion(
    content,
    'const executeWorldModeSignAndTrade = useCallback(',
    'const handleSignAndTrade = useCallback('
  );
  const applyCommittedStandardSigningStateRegion = readRegion(
    content,
    'const applyCommittedStandardSigningState = useCallback(',
    'const executeWorldModeStandardSigning = useCallback('
  );
  const executeWorldModeStandardSigningRegion = readRegion(
    content,
    'const executeWorldModeStandardSigning = useCallback(',
    'const executeVacuumModeStandardSigning = useCallback('
  );
  const executeVacuumModeStandardSigningRegion = readRegion(
    content,
    'const executeVacuumModeStandardSigning = useCallback(',
    'const applyCapAuditedTeamMutation = useCallback('
  );
  const prepareOfferSheetCreationDefinitionRegion = readRegion(
    content,
    'const prepareOfferSheetCreationDefinition = useCallback(',
    'const prepareSignAndTradeTransactionDefinition = useCallback('
  );
  const prepareSignAndTradeTransactionDefinitionRegion = readRegion(
    content,
    'const prepareSignAndTradeTransactionDefinition = useCallback(',
    '  const applyTradeToCapSheet = useCallback('
  );
  const handleSignAndTradeRegion = readRegion(
    content,
    'const handleSignAndTrade = useCallback(',
    'const getSignAndTradePreflight = useCallback('
  );
  const getSignAndTradePreflightRegion = readRegion(
    content,
    'const getSignAndTradePreflight = useCallback(',
    'const getOfferSheetPreflight = useCallback('
  );
  const getOfferSheetPreflightRegion = readRegion(
    content,
    'const getOfferSheetPreflight = useCallback(',
    '// === RFA Offer Sheet Actions ==='
  );
  const resolveCommittedOfferSheetStateRegion = readRegion(
    content,
    'const resolveCommittedOfferSheetState = useCallback(',
    'const applyCommittedOfferSheetState = useCallback('
  );
  const applyCommittedOfferSheetStateRegion = readRegion(
    content,
    'const applyCommittedOfferSheetState = useCallback(',
    'const executeWorldModeOfferSheetStore = useCallback('
  );
  const executeWorldModeOfferSheetStoreRegion = readRegion(
    content,
    'const executeWorldModeOfferSheetStore = useCallback(',
    'const resolveCommittedOfferSheetLifecycleState = useCallback('
  );
  const resolveCommittedOfferSheetLifecycleStateRegion = readRegion(
    content,
    'const resolveCommittedOfferSheetLifecycleState = useCallback(',
    'const applyCommittedOfferSheetLifecycleState = useCallback('
  );
  const applyCommittedOfferSheetLifecycleStateRegion = readRegion(
    content,
    'const applyCommittedOfferSheetLifecycleState = useCallback(',
    'const executeWorldModeOfferSheetLifecycleMutation = useCallback('
  );
  const executeWorldModeOfferSheetLifecycleMutationRegion = readRegion(
    content,
    'const executeWorldModeOfferSheetLifecycleMutation = useCallback(',
    'const applyCommittedStandardSigningState = useCallback('
  );
  const handleStoreOfferSheetRegion = readRegion(
    content,
    'const handleStoreOfferSheet = useCallback(',
    'const runOfferSheetResolutionAction = useCallback('
  );
  const runOfferSheetResolutionActionRegion = readRegion(
    content,
    'const runOfferSheetResolutionAction = useCallback(',
    'const resolveOfferSheetFinalizeMutationRoute = useCallback('
  );
  const resolveOfferSheetFinalizeMutationRouteRegion = readRegion(
    content,
    'const resolveOfferSheetFinalizeMutationRoute = useCallback(',
    'const handleMatchOfferSheet = useCallback('
  );
  const handleMatchOfferSheetRegion = readRegion(
    content,
    'const handleMatchOfferSheet = useCallback(',
    'const handleDeclineOfferSheet = useCallback('
  );
  const handleDeclineOfferSheetRegion = readRegion(
    content,
    'const handleDeclineOfferSheet = useCallback(',
    'const handleFinalizeOfferSheet = useCallback('
  );
  const handleFinalizeOfferSheetRegion = readRegion(
    content,
    'const handleFinalizeOfferSheet = useCallback(',
    'const runManualCapSheetLedgerMutation = useCallback('
  );

  it('routes Free Agency signing and signing-preflight paths through one authoritative preparation helper', () => {
    expect(content).toMatch(
      /const\s+prepareAuthoritativeSigningDetails\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+prepareStandardSigningMutationPayload\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+prepareOfferSheetCreationDefinition\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+runOfferSheetResolutionAction\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+resolveOfferSheetFinalizeMutationRoute\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+prepareSignAndTradeTransactionDefinition\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+resolveCommittedOfferSheetState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+applyCommittedOfferSheetState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+executeWorldModeOfferSheetStore\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+resolveCommittedOfferSheetLifecycleState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+applyCommittedOfferSheetLifecycleState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+executeWorldModeOfferSheetLifecycleMutation\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+applyCommittedStandardSigningState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+applyCommittedSignAndTradeState\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+executeWorldModeStandardSigning\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+executeWorldModeSignAndTrade\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /const\s+executeVacuumModeStandardSigning\s*=\s*useCallback/
    );
    expect(handleSignRegion).toMatch(
      /prepareStandardSigningMutationPayload/
    );
    expect(executeVacuumModeStandardSigningRegion).toMatch(
      /validateSigning\(\{\s*[\s\S]*contract:\s*standardSigningPayload\.contract,\s*[\s\S]*signedUsing:\s*standardSigningPayload\.signedUsing/
    );
    expect(executeVacuumModeStandardSigningRegion).toMatch(
      /computeWorldMutation\(\{\s*[\s\S]*payload:\s*standardSigningPayload/
    );
    expect(handleSignRegion).toMatch(/executeWorldModeStandardSigning/);
    expect(handleSignRegion).toMatch(/executeVacuumModeStandardSigning/);
    expect(handleSignRegion).toMatch(/applyCommittedStandardSigningState/);
    expect(handleSignAndTradeRegion).toMatch(
      /prepareSignAndTradeTransactionDefinition/
    );
    expect(handleSignAndTradeRegion).toMatch(/executeWorldModeSignAndTrade/);
    expect(handleSignAndTradeRegion).toMatch(/applyCommittedSignAndTradeState/);
    expect(content).toMatch(
      /handleSign[\s\S]{0,3200}prepareStandardSigningMutationPayload/
    );
    expect(content).toMatch(
      /getSignAndTradePreflight[\s\S]{0,2400}prepareSignAndTradeTransactionDefinition/
    );
    expect(content).toMatch(
      /getOfferSheetPreflight[\s\S]{0,2200}prepareOfferSheetCreationDefinition/
    );
    expect(content).toMatch(
      /handleStoreOfferSheet[\s\S]{0,2200}prepareOfferSheetCreationDefinition/
    );
    expect(prepareOfferSheetCreationDefinitionRegion).toMatch(
      /prepareAuthoritativeSigningDetails/
    );
    expect(prepareOfferSheetCreationDefinitionRegion).toMatch(
      /rfaOfferSheetStatus:\s*'PENDING_MATCH'/
    );
    expect(handleStoreOfferSheetRegion).toMatch(/executeWorldModeOfferSheetStore/);
    expect(handleStoreOfferSheetRegion).toMatch(/applyCommittedOfferSheetState/);
    expect(handleMatchOfferSheetRegion).toMatch(
      /runOfferSheetResolutionAction\s*\(\s*'match'/
    );
    expect(handleDeclineOfferSheetRegion).toMatch(
      /runOfferSheetResolutionAction\s*\(\s*'decline'/
    );
    expect(handleFinalizeOfferSheetRegion).toMatch(
      /resolveOfferSheetFinalizeMutationRoute/
    );
  });

  it('keeps standard-sign world and vacuum execution on explicit hook-local executors plus one shared final-state applier', () => {
    expect(applyCommittedOfferSheetStateRegion).toMatch(
      /setTeamCapSheetSafe\s*\(\s*committedTeam\s*\)/
    );
    expect(applyCommittedOfferSheetStateRegion).not.toMatch(/setFreeAgents/);
    expect(resolveCommittedOfferSheetStateRegion).toMatch(
      /buildCommittedOfferSheetIdentity/
    );
    expect(resolveCommittedOfferSheetStateRegion).toMatch(
      /findUpdatedTeamSnapshot\s*\(\s*result\.changedTeams\s*,\s*teamCode\s*\)/
    );
    expect(resolveCommittedOfferSheetStateRegion).toMatch(
      /loadWorldTeamData\s*\(\s*worldId\s*,\s*teamCode\s*\)/
    );
    expect(resolveCommittedOfferSheetStateRegion).toMatch(
      /matchesCommittedOfferSheetIdentity/
    );
    expect(executeWorldModeOfferSheetStoreRegion).toMatch(
      /applyWorldMutation\(\{\s*[\s\S]*mutationType:\s*'storeOfferSheet'/
    );
    expect(executeWorldModeOfferSheetStoreRegion).toMatch(
      /await\s+resolveCommittedOfferSheetState/
    );
    expect(executeWorldModeOfferSheetStoreRegion).not.toMatch(
      /refreshWorldRosterIndex/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /buildCommittedOfferSheetLifecycleIdentity/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /findUpdatedTeamSnapshot\s*\(\s*result\.changedTeams\s*,\s*teamCode\s*\)/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /loadWorldTeamData\s*\(\s*worldId\s*,\s*teamCode\s*\)/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /matchesCommittedOfferSheetLifecycleIdentity/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /expectation\.activeTeamArrayKey\s*===\s*'incomingOfferSheets'/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /expectation\.presence\s*===\s*'present'/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /expectation\.presence\s*===\s*'absent'/
    );
    expect(applyCommittedOfferSheetLifecycleStateRegion).toMatch(
      /setTeamCapSheetSafe\s*\(\s*committedTeam\s*\)/
    );
    expect(applyCommittedOfferSheetLifecycleStateRegion).not.toMatch(
      /setFreeAgents/
    );
    expect(executeWorldModeOfferSheetLifecycleMutationRegion).toMatch(
      /applyWorldMutation\(\{\s*[\s\S]*mutationType,\s*[\s\S]*payload:\s*mutationPayload/
    );
    expect(executeWorldModeOfferSheetLifecycleMutationRegion).toMatch(
      /await\s+resolveCommittedOfferSheetLifecycleState/
    );
    expect(executeWorldModeOfferSheetLifecycleMutationRegion).toMatch(
      /applyCommittedOfferSheetLifecycleState/
    );
    expect(executeWorldModeOfferSheetLifecycleMutationRegion).not.toMatch(
      /refreshWorldRosterIndex/
    );
    expect(applyCommittedStandardSigningStateRegion).toMatch(
      /setTeamCapSheetSafe\s*\(\s*committedTeam\s*\)/
    );
    expect(applyCommittedStandardSigningStateRegion).toMatch(
      /setFreeAgents\s*\(\s*\(prev\)\s*=>/
    );
    expect(executeWorldModeStandardSigningRegion).toMatch(
      /applyWorldMutation\(\{\s*[\s\S]*mutationType:\s*'signFreeAgent'/
    );
    expect(executeWorldModeStandardSigningRegion).toMatch(
      /findUpdatedTeamSnapshot\s*\(\s*result\.changedTeams\s*,\s*teamCode\s*\)/
    );
    expect(executeWorldModeStandardSigningRegion).toMatch(
      /loadWorldTeamData\s*\(\s*worldId\s*,\s*teamCode\s*\)/
    );
    expect(executeWorldModeStandardSigningRegion).toMatch(
      /await\s+refreshWorldRosterIndex\s*\(\s*\)/
    );
    expect(executeVacuumModeStandardSigningRegion).toMatch(/validateSigning/);
    expect(executeVacuumModeStandardSigningRegion).toMatch(
      /computeWorldMutation/
    );
    expect(executeVacuumModeStandardSigningRegion).toMatch(
      /buildCapAuditEvaluation/
    );
    expect(applyCommittedSignAndTradeStateRegion).toMatch(
      /setTeamCapSheetSafe\s*\(\s*committedTeam\s*\)/
    );
    expect(applyCommittedSignAndTradeStateRegion).not.toMatch(/setFreeAgents/);
    expect(executeWorldModeSignAndTradeRegion).toMatch(
      /applyWorldMutation\(\{\s*[\s\S]*mutationType:\s*'signAndTrade'/
    );
    expect(executeWorldModeSignAndTradeRegion).toMatch(
      /findUpdatedTeamSnapshot\s*\(\s*result\.changedTeams\s*,\s*teamCode\s*\)/
    );
    expect(executeWorldModeSignAndTradeRegion).toMatch(
      /loadWorldTeamData\s*\(\s*worldId\s*,\s*teamCode\s*\)/
    );
    expect(executeWorldModeSignAndTradeRegion).toMatch(
      /await\s+refreshWorldRosterIndex\s*\(\s*\)/
    );
  });

  it('keeps all world-only Free Agency paths fail-closed when no active world is present', () => {
    expect(prepareSignAndTradeTransactionDefinitionRegion).toMatch(
      /if\s*\(!worldId\)[\s\S]*Sign-and-trade requires an active world to commit\./
    );
    expect(prepareSignAndTradeTransactionDefinitionRegion).toMatch(
      /Destination team is required for sign-and-trade\./
    );
    expect(prepareSignAndTradeTransactionDefinitionRegion).toMatch(
      /Destination team must be different from the current team for sign-and-trade\./
    );
    expect(prepareSignAndTradeTransactionDefinitionRegion).toMatch(
      /Cannot complete sign-and-trade: missing player ID\./
    );
    expect(prepareSignAndTradeTransactionDefinitionRegion).toMatch(
      /Cannot complete sign-and-trade: contract payload is invalid\./
    );
    expect(handleSignAndTradeRegion).toMatch(
      /prepareSignAndTradeTransactionDefinition/
    );
    expect(getSignAndTradePreflightRegion).toMatch(
      /prepareSignAndTradeTransactionDefinition/
    );
    expect(getOfferSheetPreflightRegion).toMatch(
      /if\s*\(!worldId\)[\s\S]*buildOfferSheetPreflightResult\s*\(\s*'blocked'\s*,\s*'Offer sheet requires an active world to commit\.'\s*\)/
    );
    expect(handleStoreOfferSheetRegion).toMatch(
      /if\s*\(!worldId\)[\s\S]*return\s*\{\s*success\s*:\s*false,\s*message\s*:\s*'Offer sheet actions require an active world to commit\.'/
    );
    expect(runOfferSheetResolutionActionRegion).toMatch(
      /if\s*\(!worldId\)[\s\S]*reportMutationError\(\s*OFFER_SHEET_WORLD_REQUIRED_MESSAGE/
    );
    expect(handleFinalizeOfferSheetRegion).toMatch(
      /if\s*\(!worldId\)[\s\S]*reportMutationError\(\s*OFFER_SHEET_WORLD_REQUIRED_MESSAGE/
    );
  });

  it('routes world-only Free Agency execution through canonical authoritative mutation keys', () => {
    expect(handleSignRegion).not.toMatch(
      /runAuthoritativeFAMutation\s*\(\s*'signFreeAgent'/
    );
    expect(handleSignAndTradeRegion).not.toMatch(
      /runAuthoritativeFAMutation\s*\(\s*'signAndTrade'/
    );
    expect(executeWorldModeSignAndTradeRegion).toMatch(
      /applyWorldMutation\(\{\s*[\s\S]*mutationType:\s*'signAndTrade'/
    );
    expect(handleStoreOfferSheetRegion).not.toMatch(
      /runAuthoritativeFAMutation\s*\(\s*'storeOfferSheet'/
    );
    expect(executeWorldModeOfferSheetStoreRegion).toMatch(
      /applyWorldMutation\(\{\s*[\s\S]*mutationType:\s*'storeOfferSheet'/
    );
    expect(runOfferSheetResolutionActionRegion).toMatch(
      /const\s+mutationType:\s*OfferSheetResolutionMutationType\s*=\s*action\s*===\s*'match'\s*\?\s*'matchOfferSheet'\s*:\s*'declineOfferSheet'/
    );
    expect(runOfferSheetResolutionActionRegion).toMatch(
      /activeTeamArrayKey:\s*'incomingOfferSheets'/
    );
    expect(runOfferSheetResolutionActionRegion).toMatch(
      /presence:\s*'present'/
    );
    expect(runOfferSheetResolutionActionRegion).toMatch(
      /status:\s*action\s*===\s*'match'\s*\?\s*'MATCHED'\s*:\s*'DECLINED'/
    );
    expect(runOfferSheetResolutionActionRegion).toMatch(
      /executeWorldModeOfferSheetLifecycleMutation\s*\(\s*mutationType/
    );
    expect(resolveOfferSheetFinalizeMutationRouteRegion).toMatch(
      /mutationType:\s*'finalizeMatchedOfferSheet'/
    );
    expect(resolveOfferSheetFinalizeMutationRouteRegion).toMatch(
      /mutationType:\s*'finalizeDeclinedOfferSheet'/
    );
    expect(handleFinalizeOfferSheetRegion).toMatch(
      /finalizeRoute\.mutationType\s*===\s*'finalizeMatchedOfferSheet'[\s\S]*activeTeamArrayKey:\s*'incomingOfferSheets'[\s\S]*presence:\s*'absent'/
    );
    expect(handleFinalizeOfferSheetRegion).toMatch(
      /activeTeamArrayKey:\s*'offerSheets'[\s\S]*presence:\s*'absent'/
    );
    expect(handleFinalizeOfferSheetRegion).toMatch(
      /executeWorldModeOfferSheetLifecycleMutation\s*\(\s*finalizeRoute\.mutationType/
    );
  });

  it('does not grow local compute or local state-write fallback inside world-only handlers', () => {
    const worldOnlyMutationRegions = [
      handleSignAndTradeRegion,
      executeWorldModeOfferSheetStoreRegion,
      executeWorldModeOfferSheetLifecycleMutationRegion,
      handleStoreOfferSheetRegion,
      runOfferSheetResolutionActionRegion,
      resolveOfferSheetFinalizeMutationRouteRegion,
      handleMatchOfferSheetRegion,
      handleDeclineOfferSheetRegion,
      handleFinalizeOfferSheetRegion,
    ];
    const forbiddenPatterns = [
      /computeWorldMutation/,
      /applyCapAuditedTeamMutation/,
      /setTeamCapSheet/,
      /setFreeAgents/,
    ];

    for (const region of worldOnlyMutationRegions) {
      for (const forbidden of forbiddenPatterns) {
        expect(region).not.toMatch(forbidden);
      }
    }
  });

  it('keeps generic team sync for unrelated mutations while offer-sheet lifecycle sync stays explicit', () => {
    expect(content).toMatch(
      /const\s+syncTeamFromMutationResult\s*=\s*useCallback/
    );
    expect(content).toMatch(
      /findUpdatedTeamSnapshot\s*\(\s*result\?\.changedTeams\s*,\s*teamCode\s*\)/
    );
    expect(content).toMatch(
      /runAuthoritativeFAMutation[\s\S]{0,2200}await\s+syncTeamFromMutationResult\s*\(\s*mutationType\s*,\s*result\s*\)/
    );
    expect(handleSignAndTradeRegion).not.toMatch(/runAuthoritativeFAMutation/);
    expect(handleStoreOfferSheetRegion).not.toMatch(/runAuthoritativeFAMutation/);
    expect(executeWorldModeOfferSheetStoreRegion).toMatch(
      /await\s+resolveCommittedOfferSheetState/
    );
    expect(runOfferSheetResolutionActionRegion).not.toMatch(
      /runAuthoritativeFAMutation/
    );
    expect(handleFinalizeOfferSheetRegion).not.toMatch(
      /runAuthoritativeFAMutation/
    );
    expect(executeWorldModeOfferSheetLifecycleMutationRegion).toMatch(
      /await\s+resolveCommittedOfferSheetLifecycleState/
    );
    expect(executeWorldModeOfferSheetLifecycleMutationRegion).not.toMatch(
      /refreshWorldRosterIndex/
    );
    expect(executeWorldModeSignAndTradeRegion).toMatch(
      /const\s+changedTeam\s*=\s*findUpdatedTeamSnapshot/
    );
    expect(executeWorldModeSignAndTradeRegion).toMatch(
      /const\s+reloadedTeam\s*=\s*changedTeam[\s\S]*loadWorldTeamData/
    );
    expect(resolveCommittedOfferSheetStateRegion).toMatch(
      /const\s+committedOfferSheet\s*=\s*\(\s*committedTeam\.offerSheets\s*\|\|\s*\[\]\s*\)\.find/
    );
    expect(resolveCommittedOfferSheetLifecycleStateRegion).toMatch(
      /const\s+committedOfferSheetEntries\s*=/
    );
  });
});

describe('Gate 7: ActiveTab includes fa/cap/capfull runtime keys (E1 cleanup)', () => {
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

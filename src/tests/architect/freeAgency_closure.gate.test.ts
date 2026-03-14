/**
 * FILE: src/tests/architect/freeAgency_closure.gate.test.ts
 * PURPOSE: Closure permanence gates for Free Agency E1 fixes.
 * OWNERSHIP: Feature: architect/free-agency (E2)
 *
 * HISTORY:
 *  - 2026-03-01: Created for TM_FREE_AGENCY_E2 — permanent regression gates
 *
 * GATES:
 *  1. World-mode offer sheet initiation wiring exists
 *  2. Base mode cannot access offer sheet initiation
 *  3. Store mutation uses authoritative storeOfferSheet path
 *  4. Authoritative sync path updates current team from changedTeams
 *  5. FreeAgencySection does not pass stale capProjections prop
 *  6. ActiveTab union includes runtime fa/cap/capfull keys
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// === FILE PATH CONSTANTS ===

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

const USE_ARCHITECT_STATE_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectState.ts'
);

// === HELPER FUNCTIONS ===

const readFileContent = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Gate file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
};

// === GATE 1: World-mode offer sheet initiation wiring exists ===

describe('Gate 1: World-mode offer sheet initiation wiring exists (E1)', () => {
  const content = readFileContent(FREE_AGENT_POOL_PATH);

  it('instantiates EditContractModal in FreeAgentPool', () => {
    const hasEditContractModal = /<EditContractModal\b/.test(content);
    expect(hasEditContractModal).toBe(true);
  });

  it('passes onStoreOfferSheet prop into EditContractModal', () => {
    const hasOnStoreOfferSheetProp = /onStoreOfferSheet\s*=/.test(content);
    expect(hasOnStoreOfferSheetProp).toBe(true);
  });

  it('guards onStoreOfferSheet with worldId in modal props', () => {
    const hasWorldGuardedStoreCallback =
      /onStoreOfferSheet\s*=\s*\{\s*worldId\s*\?\s*onStoreOfferSheet\s*:\s*null\s*\}/.test(
        content
      );
    expect(hasWorldGuardedStoreCallback).toBe(true);
  });

  it('uses world actionsOverride branch with signNew and signAndTrade', () => {
    const hasWorldActionsOverride =
      /actionsOverride\s*=\s*\{\s*worldId\s*\?\s*\[[^\]]*['"]signNew['"][^\]]*['"]signAndTrade['"][^\]]*\]\s*:\s*\[[^\]]*['"]signNew['"][^\]]*\]\s*\}/.test(
        content
      );
    expect(hasWorldActionsOverride).toBe(true);
  });
});

// === GATE 2: Base mode cannot access offer sheet initiation ===

describe('Gate 2: Base mode cannot access offer sheet initiation (E1)', () => {
  const content = readFileContent(FREE_AGENT_POOL_PATH);

  it('defaults onStoreOfferSheet prop to null in FreeAgentPool args', () => {
    const hasNullDefault = /onStoreOfferSheet\s*=\s*null/.test(content);
    expect(hasNullDefault).toBe(true);
  });

  it('base actionsOverride branch is restricted to signNew', () => {
    const hasBaseSignNewOnly =
      /actionsOverride\s*=\s*\{\s*worldId\s*\?[\s\S]{0,120}:\s*\[\s*['"]signNew['"]\s*\]\s*\}/.test(
        content
      );
    expect(hasBaseSignNewOnly).toBe(true);
  });

  it('does not directly pass onStoreOfferSheet without world guard', () => {
    const hasUnguardedStoreCallback =
      /onStoreOfferSheet\s*=\s*\{\s*onStoreOfferSheet\s*\}/.test(content);
    expect(hasUnguardedStoreCallback).toBe(false);
  });
});

// === GATE 3: Store mutation type is authoritative and correct ===

describe('Gate 3: Store mutation is authoritative storeOfferSheet path (E1)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('defines handleStoreOfferSheet', () => {
    const hasHandleStoreOfferSheet =
      /const\s+handleStoreOfferSheet\s*=\s*useCallback/.test(content);
    expect(hasHandleStoreOfferSheet).toBe(true);
  });

  it('calls runAuthoritativeFAMutation with storeOfferSheet mutation key', () => {
    const usesStoreOfferSheetMutation =
      /handleStoreOfferSheet[\s\S]{0,2600}runAuthoritativeFAMutation\s*\(\s*['"]storeOfferSheet['"]/.test(
        content
      );
    expect(usesStoreOfferSheetMutation).toBe(true);
  });

  it('returns normalized failure contract { success: false, message }', () => {
    const hasFailureContract =
      /handleStoreOfferSheet[\s\S]{0,3200}if\s*\(!result\?\.success\)\s*\{[\s\S]{0,220}success\s*:\s*false[\s\S]{0,220}message\s*:/.test(
        content
      );
    expect(hasFailureContract).toBe(true);
  });

  it('returns success contract { success: true } on success path', () => {
    const hasSuccessContract =
      /handleStoreOfferSheet[\s\S]{0,3600}return\s*\{\s*success\s*:\s*true\s*\}/.test(
        content
      );
    expect(hasSuccessContract).toBe(true);
  });
});

// === GATE 4: Authoritative sync path drives current team update ===

describe('Gate 4: Authoritative sync path updates current team from changedTeams (E1)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('defines syncTeamFromMutationResult helper', () => {
    const hasSyncHelper =
      /const\s+syncTeamFromMutationResult\s*=\s*useCallback/.test(content);
    expect(hasSyncHelper).toBe(true);
  });

  it('reads changedTeams and resolves currentTeamUpdate', () => {
    const readsChangedTeams =
      /const\s+changedTeams\s*=\s*Array\.isArray\(result\?\.changedTeams\)/.test(
        content
      );
    const resolvesCurrentTeam = /changedTeams\.find\s*\(/.test(content);
    expect(readsChangedTeams).toBe(true);
    expect(resolvesCurrentTeam).toBe(true);
  });

  it('updates team state from authoritative changed team snapshot', () => {
    const updatesTeamState =
      /setTeamCapSheet\s*\(\s*currentTeamUpdate\.team\s+as\s+CapSheet\s*\)/.test(
        content
      );
    expect(updatesTeamState).toBe(true);
  });

  it('runAuthoritativeFAMutation success path invokes syncTeamFromMutationResult', () => {
    const syncCalledOnSuccess =
      /runAuthoritativeFAMutation[\s\S]{0,1800}if\s*\(!result\.success\)[\s\S]{0,500}await\s+syncTeamFromMutationResult\s*\(\s*mutationType\s*,\s*result\s*\)/.test(
        content
      );
    expect(syncCalledOnSuccess).toBe(true);
  });
});

// === GATE 5: E1 cleanup - no stale capProjections prop pass-through ===

describe('Gate 5: FreeAgencySection does not pass stale capProjections prop (E1 cleanup)', () => {
  const content = readFileContent(FREE_AGENCY_SECTION_PATH);

  it('renders FreeAgentPool from FreeAgencySection', () => {
    const rendersFreeAgentPool = /<FreeAgentPool\b/.test(content);
    expect(rendersFreeAgentPool).toBe(true);
  });

  it('does not pass capProjections prop into FreeAgentPool', () => {
    const passesCapProjections = /\bcapProjections\s*=/.test(content);
    expect(passesCapProjections).toBe(false);
  });

  it('keeps teamCapSheet in FreeAgencySection prop surface', () => {
    const includesTeamCapSheetProp =
      /const\s+FreeAgencySection\s*=\s*\(\s*\{[\s\S]{0,240}teamCapSheet,/.test(
        content
      );
    expect(includesTeamCapSheetProp).toBe(true);
  });
});

// === GATE 6: E1 cleanup - ActiveTab includes runtime fa key ===

describe('Gate 6: ActiveTab includes fa/cap/capfull runtime keys (E1 cleanup)', () => {
  const content = readFileContent(USE_ARCHITECT_STATE_PATH);

  it('defines ActiveTab union type', () => {
    const hasActiveTabType = /type\s+ActiveTab\s*=/.test(content);
    expect(hasActiveTabType).toBe(true);
  });

  it('ActiveTab union includes fa', () => {
    const includesFa = /type\s+ActiveTab[\s\S]{0,240}['"]fa['"]/.test(content);
    expect(includesFa).toBe(true);
  });

  it('ActiveTab union includes cap and capfull', () => {
    const includesCap = /type\s+ActiveTab[\s\S]{0,240}['"]cap['"]/.test(
      content
    );
    const includesCapfull = /type\s+ActiveTab[\s\S]{0,240}['"]capfull['"]/.test(
      content
    );
    expect(includesCap).toBe(true);
    expect(includesCapfull).toBe(true);
  });
});

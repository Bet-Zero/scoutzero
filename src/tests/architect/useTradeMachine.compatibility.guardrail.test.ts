// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import capProjections from '@/features/architect/utils/capProjections';
import * as useTradeMachineModule from '@/features/architect/hooks/useTradeMachine';
import { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';

const worldTeamDataMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
}));

const entitlementResolverMocks = vi.hoisted(() => ({
  resolveEntitlementsForTeam: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
}));

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: entitlementResolverMocks.resolveEntitlementsForTeam,
}));

const CURRENT_YEAR = 2026;
const SEASON = '2025-26';

const expectedReturnKeys = [
  'teams',
  'result',
  'forceTrade',
  'previewOpen',
  'setPreviewOpen',
  'setForceTrade',
  'setPlayerTrade',
  'toggleEntitlement',
  'setEntitlementDestination',
  'selectTeam',
  'addTeam',
  'removeTeam',
  'handleValidate',
  'exportCurrentTrade',
  'undoPlayerTrade',
  'resetTrade',
  'yearKey',
  'incomingAssets',
  'salaryOut',
  'activeTeamCount',
  'applyEntitlementOverrideUpdate',
  'refreshEntitlements',
  'isValidating',
  'currentDraftKey',
  'hasCurrentValidation',
  'validatedAt',
  'hasInjectedDevSntPlayers',
  'injectDevSntPlayers',
  'clearInjectedDevSntPlayers',
  'getValidatedAt',
  'initError',
  'fullLegalityResult',
] as const;

const expectedExportKeys = [
  'teamId',
  'outgoingPlayers',
  'outgoingEntitlements',
  'incomingPlayers',
  'incomingEntitlements',
  'usedTradeExceptions',
] as const;

const primaryEntitlement = {
  id: 'LAL-2030-1',
  entitlementId: 'LAL-2030-1',
  holderTeam: 'LAL',
  seasonYear: 2030,
  round: 1,
  description: 'LAL 2030 1st',
};

const secondaryEntitlement = {
  id: 'BOS-2031-1',
  entitlementId: 'BOS-2031-1',
  holderTeam: 'BOS',
  seasonYear: 2031,
  round: 1,
  description: 'BOS 2031 1st',
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function makePlayer(
  id: string,
  teamCode: string,
  salary = 1_000_000
): Record<string, any> {
  return {
    id,
    player_id: id,
    name: id,
    teamCode,
    bio: {
      displayName: id,
      playerId: id,
      position: 'G',
    },
    contract: {
      salariesByYear: [
        {
          season: SEASON,
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
    },
  };
}

function makeRoster(teamCode: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    makePlayer(`${teamCode}_player_${index + 1}`, teamCode)
  );
}

function makeTeamData(
  teamCode: 'LAL' | 'BOS',
  id: string,
  teamName: string
) {
  const players = makeRoster(teamCode, 14);

  return {
    id,
    teamCode,
    teamName,
    abbreviation: teamCode,
    players,
    totalSalary: 14_000_000,
    teamTotalSalary: 14_000_000,
    capHolds: [],
    deadCap: [],
    entitlementIds: [`${teamCode}-entitlement-root`],
    totals: {},
  };
}

const primaryTeamData = makeTeamData('LAL', 'lal', 'Los Angeles Lakers');
const secondaryTeamData = makeTeamData('BOS', 'BOS', 'Boston Celtics');

async function setupHookWithSecondaryTeam() {
  const stablePrimaryTeamData = clone(primaryTeamData);

  const hook = renderHook(() =>
    useTradeMachine(
      'LAL',
      capProjections,
      CURRENT_YEAR,
      stablePrimaryTeamData,
      null,
      '2026-02-01'
    )
  );

  await waitFor(() => {
    expect(hook.result.current.teams[0]?.team?.players?.length).toBe(14);
  });

  await act(async () => {
    await hook.result.current.selectTeam(1, 'BOS');
  });

  await waitFor(() => {
    expect(hook.result.current.teams[1]?.team?.id).toBe('BOS');
    expect(hook.result.current.teams[1]?.team?.players?.length).toBe(14);
  });

  return hook;
}

describe('E78 useTradeMachine compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const authorityPath = path.join(srcRoot, 'hooks/useTradeMachine.ts');

  beforeEach(() => {
    worldTeamDataMocks.loadWorldTeamData.mockReset();
    entitlementResolverMocks.resolveEntitlementsForTeam.mockReset();

    worldTeamDataMocks.loadWorldTeamData.mockImplementation(
      async (_worldId: string | null, teamId: string) => {
        if (teamId === 'BOS' || teamId === 'celtics') {
          return clone(secondaryTeamData);
        }
        return clone(primaryTeamData);
      }
    );

    entitlementResolverMocks.resolveEntitlementsForTeam.mockImplementation(
      async (_worldId: string | null, teamCode: string) => {
        if (teamCode === 'BOS') {
          return [clone(secondaryEntitlement)];
        }
        if (teamCode === 'LAL') {
          return [clone(primaryEntitlement)];
        }
        return [];
      }
    );
  });

  it('useTradeMachine.js shim has been deleted', () => {
    const shimPath = path.join(srcRoot, 'hooks/useTradeMachine.js');
    expect(fs.existsSync(shimPath)).toBe(false);
  });

  it('extensionless import resolves to the TS authority with no default export', () => {
    const source = fs.readFileSync(authorityPath, 'utf-8');

    expect(Object.keys(useTradeMachineModule)).toEqual(['useTradeMachine']);
    expect(
      Array.from(source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)).map(
        ([, exportName]) => exportName
      )
    ).toEqual(['useTradeMachine']);
    expect(source).not.toContain('export default');
  });

  it('preserves the returned hook key ordering exactly', async () => {
    const { result } = await setupHookWithSecondaryTeam();

    expect(Object.keys(result.current)).toEqual(Array.from(expectedReturnKeys));
  });

  it('preserves stale-validation invalidation boundaries after explicit validate', async () => {
    const { result } = await setupHookWithSecondaryTeam();
    const primarySlot = assertDefined(
      result.current.teams[0],
      'Primary trade slot should be present'
    );
    const secondarySlot = assertDefined(
      result.current.teams[1],
      'Secondary trade slot should be present'
    );
    const primaryTeam = assertDefined(
      primarySlot.team,
      'Primary team should be loaded'
    );
    const secondaryTeam = assertDefined(
      secondarySlot.team,
      'Secondary team should be loaded'
    );
    const primaryPlayers = assertDefined(
      primaryTeam.players,
      'Primary team players should be loaded'
    );
    const secondaryPlayers = assertDefined(
      secondaryTeam.players,
      'Secondary team players should be loaded'
    );
    const primaryTeamId = assertDefined(primaryTeam.id, 'Primary team id missing');
    const secondaryTeamId = assertDefined(
      secondaryTeam.id,
      'Secondary team id missing'
    );
    const outgoingPlayer = assertDefined(
      primaryPlayers[0],
      'Expected an outgoing player'
    );
    const incomingPlayer = assertDefined(
      secondaryPlayers[0],
      'Expected an incoming player'
    );

    expect(result.current.hasCurrentValidation).toBe(false);

    act(() => {
      result.current.handleValidate();
    });

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
      expect(result.current.hasCurrentValidation).toBe(true);
    });

    const validatedDraftKey = result.current.currentDraftKey;
    const validatedAt = result.current.getValidatedAt();

    expect(typeof validatedAt).toBe('number');
    expect(result.current.validatedAt).toBe(validatedAt);

    act(() => {
      result.current.setPlayerTrade(0, outgoingPlayer, 'trade', secondaryTeamId);
      result.current.setPlayerTrade(1, incomingPlayer, 'trade', primaryTeamId);
    });

    await waitFor(() => {
      expect(result.current.currentDraftKey).not.toBe(validatedDraftKey);
      expect(result.current.hasCurrentValidation).toBe(false);
    });
  });

  it('preserves trade export payload assembly and usedTradeExceptions ordering', async () => {
    const { result } = await setupHookWithSecondaryTeam();
    const primarySlot = assertDefined(
      result.current.teams[0],
      'Primary trade slot should be present'
    );
    const secondarySlot = assertDefined(
      result.current.teams[1],
      'Secondary trade slot should be present'
    );
    const primaryTeam = assertDefined(
      primarySlot.team,
      'Primary team should be loaded'
    );
    const secondaryTeam = assertDefined(
      secondarySlot.team,
      'Secondary team should be loaded'
    );
    const primaryPlayers = assertDefined(
      primaryTeam.players,
      'Primary team players should be loaded'
    ).slice(0, 3);
    const secondaryPlayer = assertDefined(
      assertDefined(
        secondaryTeam.players,
        'Secondary team players should be loaded'
      )[0],
      'Expected a secondary player'
    );
    const primaryTeamEntitlement = assertDefined(
      assertDefined(
        primaryTeam.entitlements,
        'Primary entitlements should be loaded'
      )[0],
      'Expected a primary entitlement'
    );
    const secondaryTeamEntitlement = assertDefined(
      assertDefined(
        secondaryTeam.entitlements,
        'Secondary entitlements should be loaded'
      )[0],
      'Expected a secondary entitlement'
    );
    const primaryTeamId = assertDefined(primaryTeam.id, 'Primary team id missing');
    const secondaryTeamId = assertDefined(
      secondaryTeam.id,
      'Secondary team id missing'
    );

    act(() => {
      result.current.setPlayerTrade(0, primaryPlayers[0], 'trade', secondaryTeamId);
      result.current.setPlayerTrade(0, primaryPlayers[1], 'trade', secondaryTeamId);
      result.current.setPlayerTrade(0, primaryPlayers[2], 'trade', secondaryTeamId);
      result.current.setPlayerTrade(1, secondaryPlayer, 'trade', primaryTeamId);
      result.current.setPlayerTrade(0, primaryPlayers[0], 'setTpeId', 'LAL-TPE-B');
      result.current.setPlayerTrade(0, primaryPlayers[1], 'setTpeId', 'LAL-TPE-A');
      result.current.setPlayerTrade(0, primaryPlayers[2], 'setTpeId', 'LAL-TPE-B');
      result.current.toggleEntitlement(0, primaryTeamEntitlement);
      result.current.toggleEntitlement(1, secondaryTeamEntitlement);
    });

    await waitFor(() => {
      expect(result.current.teams[0].sends).toHaveLength(3);
      expect(result.current.teams[0].entitlementsOut).toHaveLength(1);
      expect(result.current.teams[1].entitlementsOut).toHaveLength(1);
    });

    const exportPayload = result.current.exportCurrentTrade();
    const primaryExport = exportPayload.find(
      (teamExport: Record<string, any>) => teamExport.teamId === primaryTeamId
    );
    const secondaryExport = exportPayload.find(
      (teamExport: Record<string, any>) => teamExport.teamId === secondaryTeamId
    );
    const definedPrimaryExport = assertDefined(
      primaryExport,
      'Primary export payload should exist'
    );
    const definedSecondaryExport = assertDefined(
      secondaryExport,
      'Secondary export payload should exist'
    );

    expect(Object.keys(definedPrimaryExport)).toEqual(Array.from(expectedExportKeys));
    expect(Object.keys(definedSecondaryExport)).toEqual(Array.from(expectedExportKeys));
    expect(definedPrimaryExport.outgoingPlayers).toHaveLength(3);
    expect(definedPrimaryExport.incomingPlayers).toHaveLength(1);
    expect(definedPrimaryExport.outgoingEntitlements).toHaveLength(1);
    expect(definedPrimaryExport.incomingEntitlements).toHaveLength(1);
    expect(definedPrimaryExport.usedTradeExceptions).toEqual([
      'LAL-TPE-B',
      'LAL-TPE-A',
    ]);
    expect(definedPrimaryExport.outgoingEntitlements[0]).toMatchObject({
      id: primaryEntitlement.id,
      toTeamId: secondaryTeamId,
    });
    expect(definedPrimaryExport.incomingEntitlements[0]).toMatchObject({
      id: secondaryEntitlement.id,
      fromTeamId: secondaryTeamId,
    });
    expect(definedSecondaryExport.incomingPlayers[0]).toMatchObject({
      id: primaryPlayers[0].id,
      fromTeamId: primaryTeamId,
    });
  });
});

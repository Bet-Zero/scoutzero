// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CapSheetSection } from '@/features/architect/GMDashboard/sections/CapSheetSection';

const firestoreMocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<any> => undefined),
  getDoc: vi.fn(async (): Promise<any> => ({ exists: () => false, data: () => ({}) })),
}));

const teamLoaderMocks = vi.hoisted(() => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async (): Promise<any[]> => []),
  mergePlayerOverride: vi.fn((base: any, override: any) =>
    override ? { ...base, ...override } : base
  ),
}));

vi.mock('@/firebaseConfig', () => ({ db: 'db' }));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: firestoreMocks.batchSet,
    update: firestoreMocks.batchUpdate,
    delete: firestoreMocks.batchDelete,
    commit: firestoreMocks.batchCommit,
  })),
  getDoc: firestoreMocks.getDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
  doc: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: teamLoaderMocks.getTeam,
  getPlayer: teamLoaderMocks.getPlayer,
  getLeague: teamLoaderMocks.getLeague,
  mergePlayerOverride: teamLoaderMocks.mergePlayerOverride,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(async () => undefined),
  getWorldMetadata: vi.fn(async () => ({ parentWorldId: null as any })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateExtension: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateOptionDecision: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  validateExceptions: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, success: true, legal: true })),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
}));

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.UTC(2026, 2, 3, 12, 0, 0);
const WORLD_ID = 'world_tm_cap_e2_ui';
const SEASON_ID = '2025-26';
const CURRENT_YEAR = 2026;

type PlayerFixture = {
  id: string;
  player_id: string;
  name: string;
  displayName: string;
  teamCode: string;
  salary: number;
  currentSalary: number;
  contract: {
    contractType: string;
    salariesByYear: Array<{
      season: string;
      salary: number;
      capHit: number;
      guaranteed: boolean;
    }>;
  };
};

type TeamFixture = {
  teamCode: string;
  teamName: string;
  roster: string[];
  players: PlayerFixture[];
  capHolds: unknown[];
  draftPicks: unknown[];
  entitlementIds: string[];
  tradeExceptions: unknown[];
  exceptionHistory: unknown[];
  exceptions: { tpe: unknown[] };
  deadCap: unknown[];
  totals: {
    totalSalary: number;
    capHit: number;
    teamSalary: number;
    totalCapAllocations: number;
  };
};

type MutationResultLike = {
  success: boolean;
  changedTeams: Array<{
    teamCode: string;
    team: TeamFixture;
  }>;
};

function makePlayer(
  id: string,
  salary: number,
  teamCode: string
): PlayerFixture {
  return {
    id,
    player_id: id,
    name: id,
    displayName: id,
    teamCode,
    salary,
    currentSalary: salary,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        { season: SEASON_ID, salary, capHit: salary, guaranteed: true },
      ],
    },
  };
}

function makeTeam(teamCode: string, players: PlayerFixture[]): TeamFixture {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(
        player?.contract?.salariesByYear?.[0]?.capHit ??
          player?.currentSalary ??
          player?.salary ??
          0
      ),
    0
  );

  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: { tpe: [] },
    deadCap: [],
    totals: {
      totalSalary,
      capHit: totalSalary,
      teamSalary: totalSalary,
      totalCapAllocations: totalSalary,
    },
  };
}

function parseCurrency(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readVisibleTotalCapHit(): number {
  const label = screen.getByText(/Total Cap Hit/i);
  const row = label.parentElement;
  const values = row ? Array.from(row.querySelectorAll('span')) : [];
  const rawValue = values[values.length - 1]?.textContent;
  return parseCurrency(rawValue);
}

describe('TM_CAP_INTEGRATION_E2 UI: trade apply updates Cap Sheet surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const lalOut = makePlayer('lal_out_18m', 18_000_000, 'LAL');
    const bosOut = makePlayer('bos_out_10m', 10_000_000, 'BOS');

    const teamByCode: Record<string, TeamFixture> = {
      LAL: makeTeam('LAL', [lalOut]),
      BOS: makeTeam('BOS', [bosOut]),
    };

    teamLoaderMocks.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => teamByCode[teamCode]
    );
  });

  it('renders roster movement and cap total changes after deterministic executeTrade apply', async () => {
    const beforeLal = makeTeam('LAL', [
      makePlayer('lal_out_18m', 18_000_000, 'LAL'),
    ]);

    const result = (await applyWorldMutation({
      userId: 'user_tm_cap_e2_ui',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      timestamp: FIXED_TIMESTAMP,
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [
              {
                ...makePlayer('lal_out_18m', 18_000_000, 'LAL'),
                tradeTo: 'BOS',
              },
            ],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [
              {
                ...makePlayer('bos_out_10m', 10_000_000, 'BOS'),
                tradeTo: 'LAL',
              },
            ],
            entitlementsOut: [],
          },
        ],
        tradeCtx: {
          worldId: WORLD_ID,
          seasonId: SEASON_ID,
          source: 'tradeMachine',
        },
      },
    })) as MutationResultLike;

    expect(result.success).toBe(true);

    const afterLal = result.changedTeams.find(
      (entry) => entry.teamCode === 'LAL'
    )?.team;

    expect(afterLal).toBeDefined();

    const onSetDeadCap = vi.fn(async () => true);
    const onSetExceptions = vi.fn(async () => true);

    const { rerender } = render(
      <CapSheetSection
        teamCapSheet={beforeLal}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onSetDeadCap={onSetDeadCap}
        onSetExceptions={onSetExceptions}
      />
    );

    expect(screen.getByText('lal_out_18m')).toBeInTheDocument();
    expect(screen.queryByText('bos_out_10m')).not.toBeInTheDocument();

    const beforeTotal = readVisibleTotalCapHit();

    rerender(
      <CapSheetSection
        teamCapSheet={afterLal}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onSetDeadCap={onSetDeadCap}
        onSetExceptions={onSetExceptions}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('lal_out_18m')).not.toBeInTheDocument();
      expect(screen.getByText('bos_out_10m')).toBeInTheDocument();
    });

    const afterTotal = readVisibleTotalCapHit();
    expect(afterTotal).not.toBe(beforeTotal);
    expect(afterTotal).toBeLessThan(beforeTotal);
  });
});

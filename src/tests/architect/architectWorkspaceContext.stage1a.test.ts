/**
 * FILE: src/tests/architect/architectWorkspaceContext.stage1a.test.ts
 * PURPOSE: Unit coverage for Stage 1A read-only Architect workspace presentation seams.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import { describe, expect, it, vi } from 'vitest';
import {
  deriveArchitectEntryAuthorityPresentation,
  deriveArchitectModePresentation,
} from '@/features/architect/GMDashboard/hooks/useArchitectModePresentation';
import { deriveArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import type {
  ArchitectWorldModeBoundary,
  CapSheet,
} from '@/features/architect/GMDashboard/hooks/useArchitectState';
import type { ArchitectExceptionsLike } from '@/features/architect/GMDashboard/hooks/useArchitectState';

const sandboxBoundary: ArchitectWorldModeBoundary = {
  kind: 'sandbox',
  worldId: null,
  onReloadWorldData: null,
};

const worldBoundary = (worldId: string): ArchitectWorldModeBoundary => ({
  kind: 'world',
  worldId,
  onReloadWorldData: vi.fn(async () => null),
});

const teamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  players: [
    {
      id: 'player_1',
      name: 'Player One',
      contract: {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 10_000_000 }],
      },
    },
    {
      id: 'player_2',
      name: 'Player Two',
      contract: {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 12_000_000 }],
      },
    },
  ],
  capHolds: [],
  deadCap: [],
} as CapSheet;

describe('Stage 1A Architect mode presentation', () => {
  it('labels active world state as committed world truth', () => {
    const presentation = deriveArchitectModePresentation({
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(presentation).toMatchObject({
      kind: 'committed-world',
      label: 'Committed World',
      shortLabel: 'World',
      worldId: 'world_deadline',
      isCommittedWorldTruth: true,
    });
  });

  it('labels no-world state as sandbox without committed-world authority', () => {
    const presentation = deriveArchitectModePresentation({
      worldId: null,
      worldModeBoundary: sandboxBoundary,
    });

    expect(presentation).toMatchObject({
      kind: 'sandbox',
      label: 'Sandbox',
      worldId: null,
      isCommittedWorldTruth: false,
    });
  });

  it('reports loading and unavailable context states conservatively', () => {
    const loading = deriveArchitectModePresentation({
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
      worldMetadataLoading: true,
    });
    const unavailable = deriveArchitectModePresentation({
      worldId: 'world_deadline',
      worldModeBoundary: sandboxBoundary,
    });

    expect(loading.kind).toBe('loading');
    expect(loading.isCommittedWorldTruth).toBe(false);
    expect(unavailable.kind).toBe('unavailable');
    expect(unavailable.isCommittedWorldTruth).toBe(false);
  });

  it('reports error state with higher priority than loading state', () => {
    const errorOnly = deriveArchitectModePresentation({
      worldId: 'world_deadline',
      error: 'Connection failed',
    });
    const errorDuringLoad = deriveArchitectModePresentation({
      worldId: 'world_deadline',
      worldMetadataLoading: true,
      error: 'Connection failed',
    });

    expect(errorOnly.kind).toBe('error');
    expect(errorOnly.tone).toBe('danger');
    expect(errorOnly.isCommittedWorldTruth).toBe(false);
    expect(errorDuringLoad.kind).toBe('error');
    expect(errorDuringLoad.kind).not.toBe('loading');
  });

  it('keeps local, pending, failed, and DEV preview labels non-committed', () => {
    expect(
      deriveArchitectEntryAuthorityPresentation('local-only-preview')
    ).toMatchObject({
      kind: 'local-only-preview',
      label: 'Local Preview',
      isCommittedWorldTruth: false,
    });
    expect(
      deriveArchitectEntryAuthorityPresentation('pending-world-preview')
    ).toMatchObject({
      kind: 'pending-world-preview',
      label: 'Pending World Save',
      isCommittedWorldTruth: false,
    });
    expect(
      deriveArchitectEntryAuthorityPresentation('failed-world-preview')
    ).toMatchObject({
      kind: 'failed-world-preview',
      label: 'Failed Preview',
      isCommittedWorldTruth: false,
    });
    expect(
      deriveArchitectEntryAuthorityPresentation('dev-only-preview')
    ).toMatchObject({
      kind: 'dev-only-preview',
      label: 'Developer Preview',
      isCommittedWorldTruth: false,
    });
  });
});

describe('Stage 1A Architect workspace context derivation', () => {
  it('derives reliable active team, world, season, roster, and cap posture fields', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamFixture,
      teamId: 'LAL',
      currentYear: 2026,
      worldId: 'world_deadline',
      activeWorldLabel: 'Deadline World',
      worldAsOfDate: '2026-02-01',
      worldCurrentSeason: '2025-26',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.team).toMatchObject({
      status: 'available',
      id: 'LAL',
      label: 'Los Angeles Lakers',
    });
    expect(context.world).toMatchObject({
      status: 'available',
      id: 'world_deadline',
      label: 'Deadline World',
      labelSource: 'provided',
    });
    expect(context.seasons).toMatchObject({
      selectedViewingSeason: 2026,
      selectedViewingSeasonLabel: '2025-26',
      authoritativeWorldSeason: '2025-26',
      authoritativeWorldSeasonLabel: '2025-26',
      viewingSeasonDiffersFromWorldSeason: false,
    });
    expect(context.worldDate).toMatchObject({
      status: 'available',
      value: '2026-02-01',
    });
    expect(context.mode.kind).toBe('committed-world');
    expect(context.roster).toMatchObject({
      status: 'available',
      count: 2,
      source: 'players',
    });
    expect(context.cap.status).toBe('available');
    if (context.cap.status === 'available') {
      expect(context.cap.seasonLabel).toBe('2025-26');
      expect(context.cap.source).toBe('computeTeamCapTotals');
      expect(Number.isFinite(context.cap.totalCapAllocations)).toBe(true);
    }
    // teamFixture has no exceptions field → unavailable with see-cap-sheet hint
    expect(context.exceptions.status).toBe('unavailable');
    if (context.exceptions.status === 'unavailable') {
      expect(context.exceptions.deferralHint).toBe('see-cap-sheet');
    }
    // teamFixture has no draftPicks field → unavailable with see-trade-history hint
    expect(context.draftAssets.status).toBe('unavailable');
    if (context.draftAssets.status === 'unavailable') {
      expect(context.draftAssets.deferralHint).toBe('see-trade-history');
    }
    expect(context.recentActivity.status).toBe('deferred');
    expect(context.recentActivity.entryPoint).toBe('history-tab');
  });

  it('does not assume selected viewing season matches authoritative world season', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamFixture,
      currentYear: 2027,
      worldId: 'world_deadline',
      worldCurrentSeason: '2025-26',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.seasons.selectedViewingSeasonLabel).toBe('2026-27');
    expect(context.seasons.authoritativeWorldSeasonLabel).toBe('2025-26');
    expect(context.seasons.viewingSeasonDiffersFromWorldSeason).toBe(true);
  });

  it('counts hydrated roster players from the selected-year contract slice', () => {
    const teamWithMixedYears = {
      ...teamFixture,
      players: [
        {
          id: 'expired-player',
          name: 'Expired Player',
          contract: {
            contractType: 'Standard',
            salariesByYear: [{ season: '2025-26', salary: 10_000_000 }],
          },
        },
        {
          id: 'active-player',
          name: 'Active Player',
          contract: {
            contractType: 'Standard',
            salariesByYear: [{ season: '2026-27', salary: 12_000_000 }],
          },
        },
        {
          id: 'future-player',
          name: 'Future Player',
          contract: {
            contractType: 'Standard',
            salariesByYear: [{ season: '2027-28', salary: 14_000_000 }],
          },
        },
      ],
    } as CapSheet;

    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamWithMixedYears,
      currentYear: 2027,
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.roster).toMatchObject({
      status: 'available',
      count: 1,
      source: 'players',
    });
  });

  it('keeps loading state visible without inventing unavailable summaries', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: null,
      currentYear: 2026,
      worldId: 'world_loading',
      worldMetadataLoading: true,
      isLoading: true,
      worldModeBoundary: worldBoundary('world_loading'),
    });

    expect(context.team.status).toBe('loading');
    expect(context.world.status).toBe('loading');
    expect(context.seasons.authoritativeWorldSeasonStatus).toBe('loading');
    expect(context.worldDate.status).toBe('loading');
    expect(context.mode.kind).toBe('loading');
    expect(context.roster.status).toBe('loading');
    expect(context.cap.status).toBe('loading');
  });

  it('uses a friendly default label (never the raw world id) when no world name is available', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamFixture,
      currentYear: 2026,
      worldId: 'world_12345678abcd',
      activeWorldLabel: null,
      worldModeBoundary: worldBoundary('world_12345678abcd'),
    });

    expect(context.world.status).toBe('available');
    if (context.world.status === 'available') {
      expect(context.world.labelSource).toBe('world-id-fallback');
      expect(context.world.label).toBe('Saved Team Plan');
      // Raw ids never leak into the display label (BZE-209 rule).
      expect(context.world.label).not.toContain('world_');
      expect(context.world.id).toBe('world_12345678abcd');
    }
  });

  it('represents no-world operation without world season authority', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamFixture,
      currentYear: 2026,
      worldId: null,
      worldModeBoundary: sandboxBoundary,
    });

    expect(context.world).toMatchObject({
      status: 'sandbox',
      id: null,
      label: 'Sandbox',
    });
    expect(context.mode.kind).toBe('sandbox');
    expect(context.seasons.authoritativeWorldSeasonStatus).toBe('unavailable');
    expect(context.seasons.viewingSeasonDiffersFromWorldSeason).toBeNull();
    expect(context.worldDate.status).toBe('unavailable');
  });
});

describe('Stage 1C exception summary derivation', () => {
  const teamWithExceptions = {
    ...teamFixture,
    exceptions: {
      mle: { available: true, totalAmount: 12_400_000 },
      bae: null,
      room: null,
      tpe: [
        { id: 'tpe_1', remainingAmount: 8_000_000 },
        { id: 'tpe_2', remainingAmount: 3_500_000 },
      ],
    } satisfies ArchitectExceptionsLike,
  } as CapSheet;

  it('derives available exception summary from cap sheet exceptions data', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamWithExceptions,
      currentYear: 2026,
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.exceptions.status).toBe('available');
    if (context.exceptions.status === 'available') {
      expect(context.exceptions.hasAvailableMle).toBe(true);
      expect(context.exceptions.hasAvailableBae).toBe(false);
      expect(context.exceptions.hasAvailableRoom).toBe(false);
      expect(context.exceptions.tpeCount).toBe(2);
      expect(context.exceptions.hasAnyActive).toBe(true);
      expect(context.exceptions.worldSeasonBasis).toBe(true);
    }
  });

  it('returns unavailable with see-cap-sheet hint when cap sheet has no exceptions field', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamFixture,
      currentYear: 2026,
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.exceptions.status).toBe('unavailable');
    if (context.exceptions.status === 'unavailable') {
      expect(context.exceptions.deferralHint).toBe('see-cap-sheet');
    }
  });

  it('returns loading when cap sheet is loading', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: null,
      currentYear: 2026,
      worldId: 'world_deadline',
      isLoading: true,
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.exceptions.status).toBe('loading');
  });

  it('draft assets defer to trade history when the cap sheet has no pick data', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamFixture,
      currentYear: 2026,
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.draftAssets.status).toBe('unavailable');
    if (context.draftAssets.status === 'unavailable') {
      expect(context.draftAssets.deferralHint).toBe('see-trade-history');
    }
  });

  it('derives the draft-pick stash from cap sheet draftPicks in GM language', () => {
    const teamWithPicks = {
      ...teamFixture,
      draftPicks: [
        // Own 2026 first — kept
        { id: 'p1', year: 2026, round: 1, pick: null, owner: 'LAL' },
        // Acquired 2027 first via BOS with protection — kept, labeled "via BOS"
        {
          id: 'p2',
          year: 2027,
          round: 1,
          pick: null,
          owner: 'LAL',
          originalTeam: 'BOS',
          protection: 'Top-10',
        },
        // Own 2026 second involved in a swap — kept, swap flagged
        {
          id: 'p3',
          year: 2026,
          round: 2,
          pick: null,
          owner: 'LAL',
          originalTeam: 'LAL',
          isSwap: true,
        },
        // Own pick traded away (current owner is another team) — listed as outgoing
        {
          id: 'p4',
          year: 2027,
          round: 2,
          pick: null,
          owner: 'MIL',
          originalTeam: 'LAL',
        },
        // Another team's pick passing through the data — not this team's asset
        {
          id: 'p6',
          year: 2028,
          round: 1,
          pick: null,
          owner: 'BOS',
          originalTeam: 'PHX',
        },
        // Past-year pick — excluded from the forward-looking stash
        { id: 'p5', year: 2024, round: 1, pick: null, owner: 'LAL' },
      ],
    } as CapSheet;

    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamWithPicks,
      currentYear: 2026,
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.draftAssets.status).toBe('available');
    if (context.draftAssets.status === 'available') {
      expect(context.draftAssets.firstRoundCount).toBe(2);
      expect(context.draftAssets.secondRoundCount).toBe(1);
      expect(context.draftAssets.years.map((y) => y.year)).toEqual([
        2026, 2027,
      ]);

      const [y2026, y2027] = context.draftAssets.years;
      expect(y2026.firstRound).toHaveLength(1);
      expect(y2026.firstRound[0]).toMatchObject({
        isOwn: true,
        sourceLabel: 'Own',
        protectionLabel: null,
        isSwap: false,
      });
      expect(y2026.secondRound[0]).toMatchObject({
        isOwn: true,
        isSwap: true,
      });

      expect(y2027.firstRound[0]).toMatchObject({
        isOwn: false,
        sourceLabel: 'via BOS',
        protectionLabel: 'Top-10',
      });
      // The traded-away 2027 second is not in the held stash — it lists as outgoing.
      expect(y2027.secondRound).toHaveLength(0);
      expect(context.draftAssets.outgoing).toHaveLength(1);
      expect(context.draftAssets.outgoing[0]).toMatchObject({
        year: 2027,
        round: 2,
        sourceLabel: 'to MIL',
      });
    }
  });

  it('recent activity always points to history tab', () => {
    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamFixture,
      currentYear: 2026,
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.recentActivity.status).toBe('deferred');
    expect(context.recentActivity.entryPoint).toBe('history-tab');
  });

  it('worldSeasonBasis is false in sandbox mode because no active world provides season authority', () => {
    const teamWithExceptions = {
      ...teamFixture,
      exceptions: {
        mle: { available: true, totalAmount: 12_400_000 },
        tpe: [],
      } satisfies ArchitectExceptionsLike,
    } as CapSheet;

    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamWithExceptions,
      currentYear: 2026,
      worldId: null,
      worldModeBoundary: sandboxBoundary,
    });

    expect(context.exceptions.status).toBe('available');
    if (context.exceptions.status === 'available') {
      expect(context.exceptions.worldSeasonBasis).toBe(false);
      expect(context.exceptions.hasAvailableMle).toBe(true);
    }
  });

  it('hasAnyActive is false when exceptions exist but none are available', () => {
    const teamWithEmptyExceptions = {
      ...teamFixture,
      exceptions: {
        mle: null,
        bae: null,
        room: null,
        tpe: [],
      } satisfies ArchitectExceptionsLike,
    } as CapSheet;

    const context = deriveArchitectWorkspaceContext({
      teamCapSheet: teamWithEmptyExceptions,
      currentYear: 2026,
      worldId: 'world_deadline',
      worldModeBoundary: worldBoundary('world_deadline'),
    });

    expect(context.exceptions.status).toBe('available');
    if (context.exceptions.status === 'available') {
      expect(context.exceptions.hasAnyActive).toBe(false);
      expect(context.exceptions.tpeCount).toBe(0);
      expect(context.exceptions.hasAvailableMle).toBe(false);
    }
  });
});

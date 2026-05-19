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
    expect(context.exceptions.status).toBe('unavailable');
    expect(context.draftAssets.status).toBe('unavailable');
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

  it('uses world id as conservative fallback label when no world name is available', () => {
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
      expect(context.world.label).toMatch(/^World /);
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

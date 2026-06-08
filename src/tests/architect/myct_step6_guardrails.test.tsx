// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CapSheetSection } from '@/features/architect/GMDashboard/sections/CapSheetSection';
import {
  DEV_CAP_SHEET_FIXTURE_BOUNDARY,
  DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD,
  DEV_CAP_SHEET_FIXTURE_FLAG,
  DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
  DEV_CAP_SHEET_FIXTURE_MARKER,
  DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
  buildCapSheetFixturePlayers,
  clearCapSheetFixtures,
  hasInjectedCapSheetFixtures,
  injectCapSheetFixtures,
  isDevCapSheetFixturePlayer,
} from '@/features/architect/capSheet/devCapSheetFixtures';

vi.mock('@/features/architect/capSheet/CapSheet', () => {
  const CapSheet = () => <div data-testid="mock-cap-sheet-surface" />;
  return { default: CapSheet, CapSheet };
});

vi.mock('@/features/architect/capSheet/ExceptionTracker', () => {
  const ExceptionTracker = () => (
    <div data-testid="mock-exception-tracker-surface" />
  );
  return { default: ExceptionTracker, ExceptionTracker };
});

const CURRENT_YEAR = 2026;

const ACTIONS_PATH =
  'src/features/architect/GMDashboard/hooks/useArchitectActions.ts';
const CAP_SHEET_SECTION_PATH =
  'src/features/architect/GMDashboard/sections/CapSheetSection.tsx';
const GM_DASHBOARD_PATH =
  'src/features/architect/GMDashboard/GMDashboard.tsx';
const FIXTURES_PATH =
  'src/features/architect/capSheet/devCapSheetFixtures.ts';

type FixturePlayer = Record<string, unknown> & {
  id?: string;
  player_id?: string;
  playerId?: string;
};

type CapSheetSectionTeam = NonNullable<
  Parameters<typeof CapSheetSection>[0]['teamCapSheet']
>;

type FixtureTeam = CapSheetSectionTeam & {
  teamCode: string;
  teamName: string;
  roster: string[];
  players: FixturePlayer[];
  deadCap: [];
  capHolds: [];
  exceptions: Record<string, unknown>;
  totals: Record<string, unknown>;
};

function readSource(pathValue: string): string {
  return readFileSync(resolve(process.cwd(), pathValue), 'utf-8');
}

function readRegion(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function buildBaseTeam(): FixtureTeam {
  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: ['base_guard'],
    players: [
      {
        id: 'base_guard',
        player_id: 'base_guard',
        playerId: 'base_guard',
        name: 'Base Guard',
        displayName: 'Base Guard',
      },
    ],
    deadCap: [],
    capHolds: [],
    exceptions: {},
    totals: {},
  };
}

function getFixtureIdsForBaseTeam(): [string, string] {
  const fixturePlayers = buildCapSheetFixturePlayers(
    buildBaseTeam(),
    CURRENT_YEAR
  );
  return fixturePlayers.map((player) => String(player.id)) as [string, string];
}

function getFixturePlayers(team: FixtureTeam): FixturePlayer[] {
  return team.players
    .filter((player) => isDevCapSheetFixturePlayer(player))
    .map((player) => player as FixturePlayer);
}

function getFixtureRosterIds(team: FixtureTeam): string[] {
  const [futureFixtureId, controlFixtureId] = getFixtureIdsForBaseTeam();
  const fixtureIds = new Set([futureFixtureId, controlFixtureId]);
  return team.roster
    .map((rawId) => String(rawId))
    .filter((rawId) => fixtureIds.has(rawId));
}

const buildShellProps = (overrides: Partial<FixtureTeam> = {}) => ({
  teamCapSheet: {
    ...buildBaseTeam(),
    ...overrides,
  },
  currentYear: CURRENT_YEAR,
  onOpenPlayerContractModal: vi.fn(),
  manualCapSheetMutationAuthority: {
    handleSetDeadCap: vi.fn(async () => true),
    handleSetExceptions: vi.fn(async () => true),
  },
});

describe('MYCT-6C DEV cap-sheet fixture guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('pins DEV-local ownership and keeps fixture callbacks out of persistence paths', () => {
    const actionsSource = readSource(ACTIONS_PATH);
    const gmDashboardSource = readSource(GM_DASHBOARD_PATH);
    const actionRegion = readRegion(
      actionsSource,
      'const hasInjectedCapSheetFixtures = useMemo(',
      'const hasInjectedTeamHistoryFixtures = useMemo('
    );

    expect(actionsSource).toContain('interface CapSheetDevTools');
    expect(actionsSource).toContain('injectLocalFixtures: () => MutationActionResult;');
    expect(actionsSource).toContain('clearLocalFixtures: () => MutationActionResult;');
    expect(actionsSource).toContain('hasInjectedLocalFixtures: boolean;');
    expect(actionsSource).toContain(
      'localStateOwner: typeof DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER;'
    );
    expect(actionsSource).toContain(
      'syntheticCoverageBoundary: typeof DEV_CAP_SHEET_FIXTURE_BOUNDARY;'
    );
    expect(actionsSource).toContain(
      'runtimeBoundary: typeof DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY;'
    );

    expect(actionRegion).toContain('const applyLocalDevCapSheetFixtureState');
    expect(actionRegion).toContain('if (!import.meta.env.DEV)');
    expect(actionRegion).toContain(
      'Cap sheet DEV fixtures are only available in local DEV builds.'
    );
    expect(actionRegion).toContain("applyLocalDevCapSheetFixtureState('inject')");
    expect(actionRegion).toContain("applyLocalDevCapSheetFixtureState('clear')");
    expect(actionRegion).toContain('setTeamCapSheetSafe(nextTeam as CapSheet)');
    expect(actionRegion.match(/setTeamCapSheetSafe\(nextTeam as CapSheet\)/g)).toHaveLength(1);
    expect(actionRegion).not.toMatch(/\bsetTeamCapSheet\(/);
    expect(actionsSource).toContain(
      'runtimeBoundary: DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,'
    );

    const forbiddenOwnershipLeaks = [
      /\bapplyWorldMutation\b/,
      /\bcomputeWorldMutation\b/,
      /\bpersistMutation\b/,
      /\bappendLocalCapAuditEvent\b/,
      /\bupdateLocalCapAuditEvent\b/,
      /\bwriteBatch\b/,
      /\bsetDoc\b/,
      /\bupdateDoc\b/,
      /\baddDoc\b/,
      /\bdeleteDoc\b/,
    ];

    for (const forbiddenPattern of forbiddenOwnershipLeaks) {
      expect(actionRegion).not.toMatch(forbiddenPattern);
    }

    expect(gmDashboardSource).toContain(
      'const capSheetSectionSurface: CapSheetSectionProps = {'
    );
    expect(gmDashboardSource).toContain(
      'capSheetDevFixtureControls: actions.capSheetDevTools,'
    );
    expect(gmDashboardSource).not.toContain(
      'onInjectCapSheetFixtures={actions.capSheetDevTools.injectFixtures}'
    );
    expect(gmDashboardSource).not.toContain(
      'onClearCapSheetFixtures={actions.capSheetDevTools.clearFixtures}'
    );
  });

  it('pins grouped shell handoff, DEV gating, and synthetic-boundary copy in source', () => {
    const sectionSource = readSource(CAP_SHEET_SECTION_PATH);
    const fixturesSource = readSource(FIXTURES_PATH);
    const controlsRegion = readRegion(
      sectionSource,
      'const injectLocalDevFixtures =',
      'const isViewingCurrentYear = selectedYear === currentYear;'
    );

    expect(sectionSource).toContain('import.meta.env.DEV &&');
    expect(sectionSource).toContain(
      "window.localStorage?.getItem(DEV_CAP_SHEET_FIXTURE_FLAG) === 'true'"
    );
    expect(controlsRegion.indexOf('capSheetDevFixtureControls?.injectLocalFixtures')).toBeLessThan(
      controlsRegion.indexOf('onInjectCapSheetFixtures')
    );
    expect(controlsRegion.indexOf('capSheetDevFixtureControls?.clearLocalFixtures')).toBeLessThan(
      controlsRegion.indexOf('onClearCapSheetFixtures')
    );
    expect(
      controlsRegion.indexOf('capSheetDevFixtureControls?.hasInjectedLocalFixtures')
    ).toBeLessThan(controlsRegion.indexOf('hasInjectedCapSheetFixtures'));
    expect(sectionSource).toContain(
      'runtimeBoundary?: typeof DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY;'
    );
    expect(sectionSource).toContain(
      'capSheetDevFixtureControls?.runtimeBoundary ??'
    );
    expect(sectionSource).toContain('cap-sheet-fixtures-boundary-note');
    expect(sectionSource).toContain('cap-sheet-fixtures-runtime-note');
    expect(sectionSource).toContain('cap-sheet-fixtures-active-note');
    expect(sectionSource).toContain(
      'Local owner: {localFixtureStateOwner.ownerLabel}'
    );
    expect(sectionSource).toContain(
      'representative of{'
    );

    expect(fixturesSource).toContain('DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD');
    expect(fixturesSource).toContain('DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY');
    expect(fixturesSource).toContain(
      "activationRequirement:\n    'requires-local-dev-build-and-explicit-local-intent-flag'"
    );
    expect(fixturesSource).toContain(
      "intentLabel: 'Bounded futureContract seam probe'"
    );
    expect(fixturesSource).toContain('authoritative: false');
    expect(fixturesSource).toContain(
      "'minimum-contract reimbursement'"
    );
    expect(fixturesSource).toContain(
      "scenario: 'futureContractProbe'"
    );
    expect(fixturesSource).toContain(
      "scenario: 'noFutureContractControl'"
    );
  });

  it('keeps fixture inject idempotent and clear reversible across marker and prefix cleanup', () => {
    const baseTeam = buildBaseTeam();
    const [futureFixtureId, controlFixtureId] = getFixtureIdsForBaseTeam();
    const staleMarkerOnlyPlayer = {
      id: 'stale-marker-only-fixture',
      player_id: 'stale-marker-only-fixture',
      name: 'Stale Marker Only Fixture',
      [DEV_CAP_SHEET_FIXTURE_MARKER]: true,
    };
    const staleBoundaryOnlyPlayer = {
      id: 'stale-boundary-only-fixture',
      player_id: 'stale-boundary-only-fixture',
      name: 'Stale Boundary Only Fixture',
      [DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD]: {
        ...DEV_CAP_SHEET_FIXTURE_BOUNDARY,
        scenario: 'futureContractProbe',
      },
    };
    const stalePrefixOnlyPlayer = {
      id: futureFixtureId,
      player_id: futureFixtureId,
      name: 'Stale Prefix Fixture',
    };
    const dirtyTeam: FixtureTeam = {
      ...baseTeam,
      roster: [...baseTeam.roster, futureFixtureId, controlFixtureId],
      players: [
        ...baseTeam.players,
        staleMarkerOnlyPlayer,
        staleBoundaryOnlyPlayer,
        stalePrefixOnlyPlayer,
      ],
    };

    expect(hasInjectedCapSheetFixtures(dirtyTeam)).toBe(true);

    const injectedOnce = injectCapSheetFixtures(
      dirtyTeam,
      CURRENT_YEAR
    ) as FixtureTeam;
    const injectedTwice = injectCapSheetFixtures(
      injectedOnce,
      CURRENT_YEAR
    ) as FixtureTeam;

    expect(getFixturePlayers(injectedOnce)).toHaveLength(2);
    expect(getFixtureRosterIds(injectedOnce)).toEqual([
      futureFixtureId,
      controlFixtureId,
    ]);
    expect(getFixturePlayers(injectedTwice)).toHaveLength(2);
    expect(getFixtureRosterIds(injectedTwice)).toEqual([
      futureFixtureId,
      controlFixtureId,
    ]);
    expect(injectedTwice.players.map((player) => player.id)).not.toContain(
      'stale-marker-only-fixture'
    );
    expect(injectedTwice.players.map((player) => player.id)).not.toContain(
      'stale-boundary-only-fixture'
    );
    expect(hasInjectedCapSheetFixtures(injectedTwice)).toBe(true);

    const clearedOnce = clearCapSheetFixtures(injectedTwice) as FixtureTeam;
    const clearedTwice = clearCapSheetFixtures(clearedOnce) as FixtureTeam;

    expect(hasInjectedCapSheetFixtures(clearedOnce)).toBe(false);
    expect(clearedOnce.players).toEqual(baseTeam.players);
    expect(clearedOnce.roster).toEqual(baseTeam.roster);
    expect(clearedTwice).toEqual(baseTeam);
  });

  it('keeps hasInjected aligned with marker, boundary metadata, and roster-prefix detection', () => {
    const baseTeam = buildBaseTeam();
    const [futureFixtureId] = getFixtureIdsForBaseTeam();

    const markerOnlyTeam: FixtureTeam = {
      ...baseTeam,
      players: [
        ...baseTeam.players,
        {
          id: 'marker-only-fixture',
          [DEV_CAP_SHEET_FIXTURE_MARKER]: true,
        },
      ],
    };
    const boundaryOnlyTeam: FixtureTeam = {
      ...baseTeam,
      players: [
        ...baseTeam.players,
        {
          id: 'boundary-only-fixture',
          [DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD]: true,
        },
      ],
    };
    const rosterPrefixOnlyTeam: FixtureTeam = {
      ...baseTeam,
      roster: [...baseTeam.roster, futureFixtureId],
    };

    expect(hasInjectedCapSheetFixtures(markerOnlyTeam)).toBe(true);
    expect(hasInjectedCapSheetFixtures(boundaryOnlyTeam)).toBe(true);
    expect(hasInjectedCapSheetFixtures(rosterPrefixOnlyTeam)).toBe(true);

    expect(hasInjectedCapSheetFixtures(clearCapSheetFixtures(markerOnlyTeam))).toBe(
      false
    );
    expect(hasInjectedCapSheetFixtures(clearCapSheetFixtures(boundaryOnlyTeam))).toBe(
      false
    );
    expect(
      hasInjectedCapSheetFixtures(clearCapSheetFixtures(rosterPrefixOnlyTeam))
    ).toBe(false);
  });

  it('keeps fixture players explicitly non-authoritative and bounded', () => {
    const fixturePlayers = buildCapSheetFixturePlayers(
      buildBaseTeam(),
      CURRENT_YEAR
    );
    const futureProbe = fixturePlayers.find(
      (player) => player.futureContract
    );
    const controlProbe = fixturePlayers.find(
      (player) => player.futureContract === null
    );

    expect(futureProbe?.[DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD]).toMatchObject({
      ...DEV_CAP_SHEET_FIXTURE_BOUNDARY,
      authoritative: false,
      scenario: 'futureContractProbe',
    });
    expect(controlProbe?.[DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD]).toMatchObject({
      ...DEV_CAP_SHEET_FIXTURE_BOUNDARY,
      authoritative: false,
      scenario: 'noFutureContractControl',
    });
    expect(DEV_CAP_SHEET_FIXTURE_BOUNDARY.modeledSeams).toEqual([
      'futureContract future-season row visibility',
      'no-futureContract control row',
    ]);
    expect(DEV_CAP_SHEET_FIXTURE_BOUNDARY.notModeledSeams).toEqual([
      'real options',
      'guarantee complexity',
      'minimum-contract reimbursement',
      'irregular real-data contract overlaps',
    ]);
  });

  it('keeps the DEV fixture panel gated and routes clicks through grouped local controls before legacy props', () => {
    vi.stubEnv('DEV', false);
    localStorage.setItem(DEV_CAP_SHEET_FIXTURE_FLAG, 'true');

    const groupedInject = vi.fn();
    const groupedClear = vi.fn();
    const legacyInject = vi.fn();
    const legacyClear = vi.fn();

    const { rerender } = render(
      <CapSheetSection
        {...buildShellProps()}
        capSheetDevFixtureControls={{
          injectLocalFixtures: groupedInject,
          clearLocalFixtures: groupedClear,
          hasInjectedLocalFixtures: true,
          localStateOwner: DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
          syntheticCoverageBoundary: DEV_CAP_SHEET_FIXTURE_BOUNDARY,
          runtimeBoundary: DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
        }}
        onInjectCapSheetFixtures={legacyInject}
        onClearCapSheetFixtures={legacyClear}
        hasInjectedCapSheetFixtures={false}
      />
    );

    expect(screen.queryByTestId('cap-sheet-fixtures-panel')).not.toBeInTheDocument();

    vi.stubEnv('DEV', true);
    localStorage.removeItem(DEV_CAP_SHEET_FIXTURE_FLAG);
    rerender(
      <CapSheetSection
        {...buildShellProps()}
        capSheetDevFixtureControls={{
          injectLocalFixtures: groupedInject,
          clearLocalFixtures: groupedClear,
          hasInjectedLocalFixtures: true,
          localStateOwner: DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
          syntheticCoverageBoundary: DEV_CAP_SHEET_FIXTURE_BOUNDARY,
          runtimeBoundary: DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
        }}
        onInjectCapSheetFixtures={legacyInject}
        onClearCapSheetFixtures={legacyClear}
        hasInjectedCapSheetFixtures={false}
      />
    );

    expect(screen.queryByTestId('cap-sheet-fixtures-panel')).not.toBeInTheDocument();

    localStorage.setItem(DEV_CAP_SHEET_FIXTURE_FLAG, 'true');
    rerender(
      <CapSheetSection
        {...buildShellProps()}
        capSheetDevFixtureControls={{
          injectLocalFixtures: groupedInject,
          clearLocalFixtures: groupedClear,
          hasInjectedLocalFixtures: true,
          localStateOwner: DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
          syntheticCoverageBoundary: DEV_CAP_SHEET_FIXTURE_BOUNDARY,
          runtimeBoundary: DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
        }}
        onInjectCapSheetFixtures={legacyInject}
        onClearCapSheetFixtures={legacyClear}
        hasInjectedCapSheetFixtures={false}
      />
    );

    const panel = screen.getByTestId('cap-sheet-fixtures-panel');
    expect(panel).toHaveTextContent('Cap Sheet Fixtures (DEV)');
    expect(panel).toHaveTextContent(
      `Local owner: ${DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER.ownerLabel}.`
    );
    expect(panel).toHaveTextContent(
      `Scope: ${DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER.stateScope}.`
    );
    expect(panel).toHaveTextContent(
      `Persistence: ${DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER.persistence}.`
    );
    expect(screen.getByTestId('cap-sheet-fixtures-boundary-note')).toHaveTextContent(
      'Bounded futureContract seam probe'
    );
    expect(screen.getByTestId('cap-sheet-fixtures-boundary-note')).toHaveTextContent(
      'Not representative of real options, guarantee complexity, minimum-contract reimbursement, irregular real-data contract overlaps.'
    );
    expect(screen.getByTestId('cap-sheet-fixtures-runtime-note')).toHaveTextContent(
      `DEV only via \`${DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY.activationFlag}\`.`
    );
    expect(screen.getByTestId('cap-sheet-fixtures-runtime-note')).toHaveTextContent(
      `Activation: ${DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY.activationRequirement}.`
    );
    expect(screen.getByTestId('cap-sheet-fixtures-runtime-note')).toHaveTextContent(
      `Persistence: ${DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY.persistence}.`
    );
    expect(screen.getByTestId('cap-sheet-fixtures-runtime-note')).toHaveTextContent(
      `These controls ${DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY.committedWorldRelationship}.`
    );
    expect(screen.getByTestId('cap-sheet-fixtures-active-note')).toHaveTextContent(
      'Synthetic DEV fixture players are active in local team state.'
    );

    fireEvent.click(screen.getByTestId('cap-sheet-inject-fixtures-button'));
    fireEvent.click(screen.getByTestId('cap-sheet-clear-fixtures-button'));

    expect(groupedInject).toHaveBeenCalledTimes(1);
    expect(groupedClear).toHaveBeenCalledTimes(1);
    expect(legacyInject).not.toHaveBeenCalled();
    expect(legacyClear).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import {
  DEV_TEAM_HISTORY_FIXTURE_FLAG,
  injectTeamHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';

const emptyTeam = {
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
};

describe('Team History DEV fixture gating', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('hides injector panel when not in DEV mode', () => {
    vi.stubEnv('DEV', false);
    localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');

    render(<TeamHistoryTab teamCapSheet={emptyTeam} />);

    expect(
      screen.queryByTestId('team-history-fixtures-panel')
    ).not.toBeInTheDocument();
  });

  it('hides injector panel when DEV flag is missing from localStorage', () => {
    vi.stubEnv('DEV', true);
    localStorage.removeItem(DEV_TEAM_HISTORY_FIXTURE_FLAG);

    render(<TeamHistoryTab teamCapSheet={emptyTeam} />);

    expect(
      screen.queryByTestId('team-history-fixtures-panel')
    ).not.toBeInTheDocument();
  });

  it('shows injector panel only when DEV + explicit localStorage flag are enabled', () => {
    vi.stubEnv('DEV', true);
    localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');

    render(<TeamHistoryTab teamCapSheet={emptyTeam} />);

    expect(
      screen.getByTestId('team-history-fixtures-panel')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-inject-fixtures-button')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-clear-fixtures-button')
    ).toBeInTheDocument();
  });

  it('shows an explicit active-fixture warning when synthetic history is already injected', () => {
    vi.stubEnv('DEV', true);
    localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');

    render(<TeamHistoryTab teamCapSheet={injectTeamHistoryFixtures(emptyTeam)} />);

    expect(
      screen.getByTestId('team-history-fixtures-active-note')
    ).toHaveTextContent(
      'Clear them before trusting world-event or local-history behavior.'
    );
  });
});

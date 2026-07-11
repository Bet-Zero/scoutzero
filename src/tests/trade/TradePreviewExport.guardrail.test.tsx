// @vitest-environment jsdom
import React, { createRef } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TradePreviewModal from '@/features/architect/tradeMachine/TradePreviewModal';
import TradeExportCapture from '@/features/architect/tradeMachine/TradeExportCapture';

const {
  downloadSpy,
  formatSalaryMock,
  formatCurrencyMock,
  getEntitlementKindBadgeMock,
  getSalaryForYearMock,
  getTeamColorsMock,
  getYearsRemainingMock,
  normalizeEntitlementTermsMock,
  formatEntitlementTermsShortMock,
  sanitizeEntitlementMock,
} = vi.hoisted(() => ({
  downloadSpy: vi.fn(),
  formatSalaryMock: vi.fn((value: unknown) => `SALARY:${String(value)}`),
  formatCurrencyMock: vi.fn((value: unknown) => `CURRENCY:${String(value)}`),
  getEntitlementKindBadgeMock: vi.fn(() => ({
    label: 'BADGE',
    colorClass: 'badge-class',
  })),
  getSalaryForYearMock: vi.fn(() => 7_500_000),
  getTeamColorsMock: vi.fn(() => ({ primary: '#00ff00' })),
  getYearsRemainingMock: vi.fn(() => 3),
  normalizeEntitlementTermsMock: vi.fn((value: unknown) => value),
  formatEntitlementTermsShortMock: vi.fn(() => 'formatted terms'),
  sanitizeEntitlementMock: vi.fn((value: unknown) => value),
}));

vi.mock('@/shared/hooks/useImageDownload', () => ({
  useImageDownload: () => downloadSpy,
}));

vi.mock('@/shared/components/TeamLogo', () => ({
  TeamLogo: ({
    teamAbbr,
    teamId,
  }: {
    teamAbbr?: string | number;
    teamId?: string | number;
  }) => <div>{`logo:${String(teamId || teamAbbr)}`}</div>,
}));

vi.mock('@/shared/utils/formatting/teamColors', () => ({
  getTeamColors: getTeamColorsMock,
}));

vi.mock('@/shared/utils/contracts', () => ({
  getYearsRemaining: getYearsRemainingMock,
}));

vi.mock('@/shared/utils/formatting', () => ({
  formatSalary: formatSalaryMock,
}));

vi.mock('@/features/architect/utils/tradeHelpers', () => ({
  getSalaryForYear: getSalaryForYearMock,
  formatCurrency: formatCurrencyMock,
}));

vi.mock(
  '@/features/architect/tradeMachine/utils/entitlementWarnings',
  () => ({
    getEntitlementKindBadge: getEntitlementKindBadgeMock,
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/entitlementTerms',
  () => ({
    formatEntitlementTermsShort: formatEntitlementTermsShortMock,
    normalizeEntitlementTerms: normalizeEntitlementTermsMock,
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/sanitizeVacuumMetadata',
  () => ({
    sanitizeEntitlement: sanitizeEntitlementMock,
  })
);

type ResizeObserverInstance = {
  callback: ResizeObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
};

let offsetHeightDescriptor: PropertyDescriptor | undefined;
let resizeObserverInstances: ResizeObserverInstance[] = [];

function buildTeams() {
  return [
    {
      team: {
        id: 'BOS',
        teamId: 'BOS',
        teamName: 'Boston Celtics',
      },
      sends: [],
      entitlementsOut: [],
    },
    {
      team: {
        id: 'LAL',
        teamId: 'LAL',
        teamName: 'Los Angeles Lakers',
      },
      sends: [
        {
          id: 'p1',
          player_id: 'p1',
          name: 'Fallback Name',
          tradeTo: 'BOS',
          contract: {
            freeAgency: {
              year: 2028,
            },
          },
          teamId: 'LAL',
          bio: {
            displayName: 'Visible Name',
            display: {
              team: 'LAL',
            },
          },
        },
      ],
      entitlementsOut: [
        {
          id: 'e1',
          seasonYear: 2028,
          round: 1,
          kind: 'firstRoundPick',
          toTeamId: 'BOS',
          originalTeam: 'LAL',
        },
      ],
    },
  ];
}

function buildPreviewAuthority(legal = true) {
  return {
    legal,
    reason: legal ? 'Preview authority passed' : 'Preview authority failed',
    violations: legal ? [] : [{ message: 'Incoming exceeds allowable' }],
    warnings: [],
    source: 'apply-preview',
    omittedStages: [
      'LEAGUE_INVARIANTS',
      'ENTITLEMENT_INVARIANTS',
      'ENTITLEMENT_EXCLUSIVITY',
    ],
  };
}

function buildSnapshotValidationDetails() {
  return {
    summaryByTeamIndex: [
      {
        teamName: 'Boston Celtics',
        capDelta: 5_000_000,
      },
      {
        teamName: 'Los Angeles Lakers',
        capDelta: -5_000_000,
      },
    ],
  };
}

function findOffscreenWrapper(container: HTMLElement) {
  return Array.from(container.querySelectorAll('div')).find(
    (element) =>
      element.style.position === 'absolute' &&
      element.style.top === '-9999px' &&
      element.style.left === '-9999px'
  );
}

function findScaleWrapper(container: HTMLElement) {
  return Array.from(container.querySelectorAll('div')).find(
    (element) =>
      element.style.width === '1200px' &&
      element.style.transform.startsWith('scale(')
  );
}

function findBackdrop(container: HTMLElement) {
  return Array.from(container.querySelectorAll('div')).find(
    (element) =>
      typeof element.className === 'string' &&
      // BZE-235: backdrop scrim migrated from bg-black/80 to the cockpit void token
      element.className.includes('fixed inset-0 z-50 bg-cockpit-void/80')
  );
}

describe('E99 TradePreviewModal guardrails', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    resizeObserverInstances = [];

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
      writable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1400,
      writable: true,
    });

    offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight'
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        if (
          typeof (this as HTMLElement).className === 'string' &&
          (this as HTMLElement).className.includes('w-[1200px]')
        ) {
          return 900;
        }
        return 0;
      },
    });

    class ResizeObserverMock {
      callback: ResizeObserverCallback;
      disconnect = vi.fn();
      observe = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeObserverInstances.push({
          callback,
          disconnect: this.disconnect,
          observe: this.observe,
        });
      }
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();

    if (offsetHeightDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'offsetHeight',
        offsetHeightDescriptor
      );
    } else {
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    }
  });

  it('returns null when closed', () => {
    const { container } = render(
      <TradePreviewModal
        open={false}
        onClose={vi.fn()}
        teams={buildTeams()}
        previewAuthority={buildPreviewAuthority()}
        snapshotValidationDetails={buildSnapshotValidationDetails()}
        yearKey="2027-28"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('preserves one offscreen capture surface, one visible preview surface, and the current scale wiring', async () => {
    const { container } = render(
      <TradePreviewModal
        open
        onClose={vi.fn()}
        teams={buildTeams()}
        previewAuthority={buildPreviewAuthority()}
        snapshotValidationDetails={buildSnapshotValidationDetails()}
        yearKey="2027-28"
      />
    );

    expect(screen.getAllByText('Trade Summary')).toHaveLength(2);
    expect(findOffscreenWrapper(container)).toBeTruthy();
    expect(resizeObserverInstances).toHaveLength(1);
    expect(resizeObserverInstances[0].observe).toHaveBeenCalledTimes(1);

    const scaleWrapper = findScaleWrapper(container);
    expect(scaleWrapper).toBeTruthy();

    await waitFor(() => {
      expect(scaleWrapper?.style.transform).toBe('scale(0.8)');
    });

    window.innerHeight = 620;
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(scaleWrapper?.style.transform).toBe('scale(0.6)');
    });
  });

  it('preserves backdrop close, close button, inner click stop-propagation, and download wiring', () => {
    const onClose = vi.fn();
    const { container } = render(
      <TradePreviewModal
        open
        onClose={onClose}
        teams={buildTeams()}
        previewAuthority={buildPreviewAuthority()}
        snapshotValidationDetails={buildSnapshotValidationDetails()}
        yearKey="2027-28"
      />
    );

    const backdrop = findBackdrop(container);
    const scaleWrapper = findScaleWrapper(container);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(downloadSpy).toHaveBeenCalledWith('trade.png', {
      backgroundColor: '#111',
      pixelRatio: 2,
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(scaleWrapper!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('E99 TradeExportCapture guardrails', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('preserves forwardRef behavior, ordering, exact labels, empty states, disclaimer text, and legal footer semantics', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <TradeExportCapture
        ref={ref}
        teams={buildTeams()}
        previewAuthority={buildPreviewAuthority(true)}
        snapshotValidationDetails={buildSnapshotValidationDetails()}
        yearKey="2027-28"
        date={new Date('2026-01-15T12:00:00.000Z')}
      />
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(container.firstChild);
    expect(screen.getByText('Trade Summary')).toBeInTheDocument();
    expect(screen.getByText('January 15, 2026')).toBeInTheDocument();

    const teamHeadings = Array.from(container.querySelectorAll('h3')).map(
      (heading) => heading.textContent
    );
    expect(teamHeadings).toEqual(['Boston Celtics', 'Los Angeles Lakers']);

    expect(screen.getAllByText('Players Received')).toHaveLength(2);
    expect(screen.getAllByText('Picks Received')).toHaveLength(2);
    expect(screen.getByText('Visible Name')).toBeInTheDocument();
    expect(screen.getByText('SALARY:7500000 • 3 yrs')).toBeInTheDocument();
    expect(screen.getByText('No players received')).toBeInTheDocument();
    expect(screen.getByText('No picks received')).toBeInTheDocument();
    expect(screen.getByText('2028 R1')).toBeInTheDocument();
    expect(screen.getByText('BADGE')).toBeInTheDocument();
    expect(screen.getByText('formatted terms')).toBeInTheDocument();
    expect(screen.getByText('CURRENCY:5000000')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Salaries shown are base contract values. Matching values for trade legality may differ (BYC, trade kicker, poison pill adjustments).'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Trade Passed')).toBeInTheDocument();
    expect(screen.getAllByText('logo:LAL').length).toBeGreaterThan(0);

    expect(getSalaryForYearMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'p1' })],
      '2027-28'
    );
    expect(getYearsRemainingMock).toHaveBeenCalledWith(2028, 2027);
    expect(
      (screen.getByAltText('Fallback Name') as HTMLImageElement).getAttribute(
        'src'
      )
    ).toBe('/assets/headshots/p1.png');
  });

  it('preserves the failed legal footer text when preview authority is false', () => {
    render(
      <TradeExportCapture
        teams={buildTeams()}
        previewAuthority={buildPreviewAuthority(false)}
        snapshotValidationDetails={buildSnapshotValidationDetails()}
        yearKey="2027-28"
      />
    );

    expect(screen.getByText('Trade Failed')).toBeInTheDocument();
    expect(screen.queryByText('Trade Passed')).not.toBeInTheDocument();
  });
});
